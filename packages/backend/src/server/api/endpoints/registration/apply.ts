/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { IsNull, Raw } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { IdService } from '@/core/IdService.js';
import { CaptchaService } from '@/core/CaptchaService.js';
import { RegistrationApplicationNotificationService } from '@/core/RegistrationApplicationNotificationService.js';
import { assertRegistrationApplicationsEnabled, registrationApplicationsDisabledError } from '@/core/registration-application-policy.js';
import { DI } from '@/di-symbols.js';
import type {
	MiMeta,
	RegistrationApplicationsRepository,
	UsedUsernamesRepository,
	UsersRepository,
} from '@/models/_.js';
import { ApiError } from '@/server/api/error.js';
import { trackPromise } from '@/misc/promise-tracker.js';

export const meta = {
	tags: ['registration'],
	requireCredential: false,

	// レートリミット: 1IP / 1時間2回
	limit: {
		duration: 60 * 60 * 1000,
		max: 2,
	},

	errors: {
		registrationApplicationsDisabled: registrationApplicationsDisabledError,
		applicationSaveFailed: {
			message: 'The registration application could not be saved.',
			code: 'REGISTRATION_APPLICATION_SAVE_FAILED',
			id: '11dc4c4a-0c6e-4c37-9b4d-93b4772f0b2d',
			kind: 'server',
			httpStatusCode: 500,
		},
		usernameAlreadyExists: {
			message: 'This username is already taken or has a pending application.',
			code: 'USERNAME_ALREADY_EXISTS',
			id: 'a0000001-0001-0001-0001-000000000001',
		},
		invalidUsername: {
			message: 'Invalid username.',
			code: 'INVALID_USERNAME',
			id: 'a0000001-0001-0001-0001-000000000002',
		},
		passwordTooShort: {
			message: 'Password is too short.',
			code: 'PASSWORD_TOO_SHORT',
			id: 'a0000001-0001-0001-0001-000000000003',
		},
		reasonRequired: {
			message: 'Reason is required.',
			code: 'REASON_REQUIRED',
			id: 'a0000001-0001-0001-0001-000000000004',
		},
		additionalContactsRequired: {
			message: 'Contact details are required when declaring a relationship with the administrator.',
			code: 'ADDITIONAL_CONTACTS_REQUIRED',
			id: '7a256957-c11c-49ad-9781-762969d634d3',
		},
		captchaFailed: {
			message: 'CAPTCHA verification failed.',
			code: 'CAPTCHA_FAILED',
			id: 'a0000001-0001-0001-0001-000000000005',
		},
		// 旗鯖fork: メールアドレス形式の検証エラー
		invalidEmail: {
			message: 'Invalid email format.',
			code: 'INVALID_EMAIL',
			id: 'a0000001-0001-0001-0001-000000000006',
		},
		// 旗鯖fork: 同一メールアドレスからの連続申請を拒否
		// pending または rejected で email が残ってる場合に発火
		emailAlreadyExists: {
			message: 'This email address has been used for a recent application.',
			code: 'EMAIL_ALREADY_EXISTS',
			id: 'a0000001-0001-0001-0001-000000000007',
		},
	},

	res: {
		type: 'object',
		properties: {
			success: { type: 'boolean' },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		username: { type: 'string', minLength: 1, maxLength: 20 },
		// パスワード: bcrypt 仕様に合わせて最大 72 バイト相当 (実用上 64 文字制限)
		password: { type: 'string', minLength: 8, maxLength: 64 },
		reason: { type: 'string', maxLength: 1024, default: '', description: 'Required unless hasAdminRelationship is true.' },
		hasAdminRelationship: { type: 'boolean', default: false, description: 'Self-reported relationship with the server administrator. Requires additionalContacts instead of reason; the application still needs review.' },
		email: { type: 'string', minLength: 5, maxLength: 256 },
		additionalContacts: { type: 'string', maxLength: 1024, nullable: true, description: 'Required when hasAdminRelationship is true.' },
		'hcaptcha-response': { type: 'string', nullable: true },
		'g-recaptcha-response': { type: 'string', nullable: true },
		'turnstile-response': { type: 'string', nullable: true },
		'm-captcha-response': { type: 'string', nullable: true },
		'testcaptcha-response': { type: 'string', nullable: true },
	},
	required: ['username', 'password', 'email'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.meta)
		private serverMeta: MiMeta,

		@Inject(DI.registrationApplicationsRepository)
		private registrationApplicationsRepository: RegistrationApplicationsRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.usedUsernamesRepository)
		private usedUsernamesRepository: UsedUsernamesRepository,

		private idService: IdService,
		private captchaService: CaptchaService,
		private registrationApplicationNotificationService: RegistrationApplicationNotificationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			assertRegistrationApplicationsEnabled(this.serverMeta);
			// ========================================
			// CAPTCHA検証（SignupApiService.ts と同じパターン）
			// ========================================
			if (process.env.NODE_ENV !== 'test') {
				if (this.serverMeta.enableHcaptcha) {
					if (!this.serverMeta.hcaptchaSecretKey?.trim()) {
						throw new ApiError(meta.errors.captchaFailed);
					}
					await this.captchaService.verifyHcaptcha(
						this.serverMeta.hcaptchaSecretKey,
						ps['hcaptcha-response'],
					).catch(() => {
						throw new ApiError(meta.errors.captchaFailed);
					});
				}

				if (this.serverMeta.enableMcaptcha) {
					if (!this.serverMeta.mcaptchaSecretKey?.trim() || !this.serverMeta.mcaptchaSitekey?.trim() || !this.serverMeta.mcaptchaInstanceUrl?.trim()) {
						throw new ApiError(meta.errors.captchaFailed);
					}
					await this.captchaService.verifyMcaptcha(
						this.serverMeta.mcaptchaSecretKey,
						this.serverMeta.mcaptchaSitekey,
						this.serverMeta.mcaptchaInstanceUrl,
						ps['m-captcha-response'],
					).catch(() => {
						throw new ApiError(meta.errors.captchaFailed);
					});
				}

				if (this.serverMeta.enableRecaptcha) {
					if (!this.serverMeta.recaptchaSecretKey?.trim()) {
						throw new ApiError(meta.errors.captchaFailed);
					}
					await this.captchaService.verifyRecaptcha(
						this.serverMeta.recaptchaSecretKey,
						ps['g-recaptcha-response'],
					).catch(() => {
						throw new ApiError(meta.errors.captchaFailed);
					});
				}

				if (this.serverMeta.enableTurnstile) {
					if (!this.serverMeta.turnstileSecretKey?.trim()) {
						throw new ApiError(meta.errors.captchaFailed);
					}
					await this.captchaService.verifyTurnstile(
						this.serverMeta.turnstileSecretKey,
						ps['turnstile-response'],
					).catch(() => {
						throw new ApiError(meta.errors.captchaFailed);
					});
				}

				if (this.serverMeta.enableTestcaptcha) {
					await this.captchaService.verifyTestcaptcha(
						ps['testcaptcha-response'],
					).catch(() => {
						throw new ApiError(meta.errors.captchaFailed);
					});
				}
			}

			assertRegistrationApplicationsEnabled(this.serverMeta);
			// ========================================
			// バリデーション
			// ========================================
			if (!/^[a-zA-Z0-9_]{1,20}$/.test(ps.username)) {
				throw new ApiError(meta.errors.invalidUsername);
			}

			if (ps.password.length < 8) {
				throw new ApiError(meta.errors.passwordTooShort);
			}

			if (!ps.hasAdminRelationship && ps.reason.trim().length === 0) {
				throw new ApiError(meta.errors.reasonRequired);
			}
			const contactsTrimmed = ps.additionalContacts?.trim() ?? '';
			const additionalContacts = contactsTrimmed.length > 0 ? contactsTrimmed : null;
			if (ps.hasAdminRelationship && additionalContacts === null) {
				throw new ApiError(meta.errors.additionalContactsRequired);
			}

			// 旗鯖fork: メールアドレス形式の検証 (RFC 5322 を完全に検証するのは過剰なので、
			// よくある明らかな誤入力・攻撃用文字列を弾く程度の実用的な検証)
			const emailTrimmed = ps.email.trim();
			// 制御文字・空白・複数 @ を弾き、最低限の @local 部 + ドメイン形式を要求
			const emailValid = emailTrimmed.length >= 5
				&& emailTrimmed.length <= 256
				&& !/[\s\u0000-\u001F<>"'`\\]/.test(emailTrimmed)
				&& /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);
			if (!emailValid) {
				throw new ApiError(meta.errors.invalidEmail);
			}

			// 既存ユーザーとの重複
			if (await this.usersRepository.exists({
				where: { usernameLower: ps.username.toLowerCase(), host: IsNull() },
			})) {
				throw new ApiError(meta.errors.usernameAlreadyExists);
			}

			// 過去に使用されたユーザー名
			if (await this.usedUsernamesRepository.exists({
				where: { username: ps.username.toLowerCase() },
			})) {
				throw new ApiError(meta.errors.usernameAlreadyExists);
			}

			// 予約済みユーザー名
			const isPreserved = this.serverMeta.preservedUsernames
				.map(x => x.toLowerCase())
				.includes(ps.username.toLowerCase());
			if (isPreserved) {
				throw new ApiError(meta.errors.usernameAlreadyExists);
			}

			// 旗鯖fork: 申請中・申請拒否済みの username との重複チェック
			// - pending: まだ未処理の申請があれば重複扱い (本来の重複防止)
			// - rejected: 通常は reject 時に null セットされるので重複扱いされない
			//   ただし、旧仕様 (今回のプライバシー保護改修前) で reject されて未クリーンアップ
			//   なレコードには username が残ってるため、それを重複扱いする (一括クリーンアップ完了まで)
			// 結果として、新仕様で reject された ID は他人 (本人含む) が即座に再利用できる
			// Preserve the requested spelling, but reserve the ID without case distinctions.
			const applicationUsername = Raw(alias => `LOWER(${alias}) = :usernameLower`, { usernameLower: ps.username.toLowerCase() });
			if (await this.registrationApplicationsRepository.exists({
				where: [
					{ username: applicationUsername, status: 'pending' },
					{ username: applicationUsername, status: 'rejected' },
				],
			})) {
				throw new ApiError(meta.errors.usernameAlreadyExists);
			}

			// 旗鯖fork: 同一メールアドレスからの連続申請を拒否
			// - pending: email が残ってる (まだ未処理) → 重複扱い
			// - rejected: email が残ってる (90日以内、未クリーンアップ) → 重複扱い
			// - rejected で email が null (90日経過で Clean Processor が削除済み) → 新規申請OK
			if (await this.registrationApplicationsRepository.exists({
				where: [
					{ email: emailTrimmed, status: 'pending' },
					{ email: emailTrimmed, status: 'rejected' },
				],
			})) {
				throw new ApiError(meta.errors.emailAlreadyExists);
			}

			// パスワードハッシュ化
			assertRegistrationApplicationsEnabled(this.serverMeta);
			const salt = await bcrypt.genSalt(8);
			assertRegistrationApplicationsEnabled(this.serverMeta);
			const hashedPassword = await bcrypt.hash(ps.password, salt);

			// 申請作成
			assertRegistrationApplicationsEnabled(this.serverMeta);
			try {
				await this.registrationApplicationsRepository.insert({
					id: this.idService.gen(),
					username: ps.username,
					hashedPassword,
					// Keep the declaration in the existing review record; never imply verified trust or approval.
					reason: ps.hasAdminRelationship ? 'サーバー管理者と関係があります（フォロワー・知り合いなど、本人申告）。' : ps.reason.trim(),
					email: emailTrimmed,
					additionalContacts,
					status: 'pending',
					createdAt: new Date(),
				});
			} catch {
				// Database errors can embed the complete row, including private contacts.
				// Never attach their message, detail, parameters or cause to the API error.
				throw new ApiError(meta.errors.applicationSaveFailed);
			}
			// Standard notifications are best-effort; recipient discovery must not delay signup responses.
			// The service handles its own delivery errors without carrying applicant data.
			trackPromise(this.registrationApplicationNotificationService.notifyNewApplication());

			return { success: true };
		});
	}
}
