/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { generateKeyPair } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
//import bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';
import { DataSource, IsNull } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { MiMeta, UsedUsernamesRepository, UsersRepository } from '@/models/_.js';
import { MiUser } from '@/models/User.js';
import { MiUserProfile } from '@/models/UserProfile.js';
import { IdService } from '@/core/IdService.js';
import { MiUserKeypair } from '@/models/UserKeypair.js';
import { MiUsedUsername } from '@/models/UsedUsername.js';
import { MiRegistrationApplication } from '@/models/RegistrationApplication.js';
import { generateNativeUserToken } from '@/misc/token.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { bindThis } from '@/decorators.js';
import UsersChart from '@/core/chart/charts/users.js';
import { UtilityService } from '@/core/UtilityService.js';
import { UserService } from '@/core/UserService.js';
import { SystemAccountService } from '@/core/SystemAccountService.js';
import { MetaService } from '@/core/MetaService.js';
import { assertRegistrationApplicationsEnabled, registrationApplicationApprovalErrors } from '@/core/registration-application-policy.js';
import { ApiError } from '@/server/api/error.js';
import { RegistrationApplicationReviewService } from './RegistrationApplicationReviewService.js';
import type { RegistrationReviewContext } from './RegistrationApplicationReviewService.js';

type SignupOptions = {
	username: MiUser['username'];
	password?: string | null;
	passwordHash?: MiUserProfile['password'] | null;
	host?: string | null;
	ignorePreservedUsernames?: boolean;
};

@Injectable()
export class SignupService {
	constructor(
		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.usedUsernamesRepository)
		private usedUsernamesRepository: UsedUsernamesRepository,

		private utilityService: UtilityService,
		private userService: UserService,
		private userEntityService: UserEntityService,
		private idService: IdService,
		private systemAccountService: SystemAccountService,
		private metaService: MetaService,
		private usersChart: UsersChart,
		private registrationReviewService: RegistrationApplicationReviewService,
	) {
	}

	@bindThis
	public async signup(opts: SignupOptions | { registrationApplicationId: string; reviewerId: string; revision: string }): Promise<{ account: MiUser; secret: string; applicationEmail: string | null }> {
		const assertRegistrationOpen = () => {
			if (this.meta.registrationClosed) throw new Error('REGISTRATION_CLOSED');
		};
		assertRegistrationOpen();
		const applicationId = 'registrationApplicationId' in opts ? opts.registrationApplicationId : null;
		if (applicationId !== null) assertRegistrationApplicationsEnabled(this.meta);
		// Normal signup retains its preparation-before-transaction behavior.
		const prepared = 'username' in opts ? await this.prepareSignup(opts) : null;
		let account!: MiUser;
		let secret!: string;
		let applicationEmail: string | null = null;

		if (applicationId !== null) assertRegistrationApplicationsEnabled(this.meta);
		await this.db.transaction(async transactionalEntityManager => {
			let details = prepared;
			let reviewContext: RegistrationReviewContext | null = null;
			if (applicationId !== null) {
				if (!('reviewerId' in opts)) throw new Error('Missing registration reviewer');
				await this.registrationReviewService.assertRoot(opts.reviewerId);
				const application = await transactionalEntityManager.findOne(MiRegistrationApplication, {
					where: { id: applicationId },
					lock: { mode: 'pessimistic_write' },
					select: { id: true, status: true, username: true, hashedPassword: true, email: true, reviewVotes: true, reviewVersion: true },
				});
				assertRegistrationApplicationsEnabled(this.meta);
				if (!application) throw new ApiError(registrationApplicationApprovalErrors.noSuchApplication);
				if (application.status !== 'pending') throw new ApiError(registrationApplicationApprovalErrors.alreadyProcessed);
				if (application.username == null || application.hashedPassword == null || application.email == null) {
					throw new ApiError(registrationApplicationApprovalErrors.missingApplicantData);
				}
				// Stay on the locked transaction's connection, including duplicate checks.
				details = await this.prepareSignup(
					{ username: application.username, passwordHash: application.hashedPassword },
					transactionalEntityManager.getRepository(MiUser),
					transactionalEntityManager.getRepository(MiUsedUsername),
				);
				applicationEmail = application.email;
				reviewContext = await this.registrationReviewService.lockReview(transactionalEntityManager, application, opts.reviewerId, opts.revision, true);
				this.registrationReviewService.assertUnanimous(reviewContext);
			}
			if (details == null) throw new Error('Missing signup data');
			const { username, hash, host, keyPair } = details;
			secret = details.secret;
			// 上流 2026.10.1 のセキュリティ修正: ローカルユーザーのユーザー名は host が NULL のため、(usernameLower, host) の
			// 複合ユニークインデックスでは重複を防げない（NULLは互いにdistinct扱い）。
			// 同一ユーザー名の並行サインアップをトランザクション単位のadvisory lockで直列化し、
			// チェック→挿入のTOCTOU競合を排除する。
			await transactionalEntityManager.query(
				'SELECT pg_advisory_xact_lock(hashtext($1))',
				[`signup:username:${username.toLowerCase()}`],
			);
			const exist = await transactionalEntityManager.findOneBy(MiUser, {
				usernameLower: username.toLowerCase(),
				host: IsNull(),
			});

			if (exist) throw new Error(' the username is already used');
			if (applicationId !== null) assertRegistrationApplicationsEnabled(this.meta);

			assertRegistrationOpen();
			account = await transactionalEntityManager.save(new MiUser({
				id: this.idService.gen(),
				username: username,
				usernameLower: username.toLowerCase(),
				host: this.utilityService.toPunyNullable(host),
				token: secret,
			}));

			await transactionalEntityManager.save(new MiUserKeypair({
				publicKey: keyPair[0],
				privateKey: keyPair[1],
				userId: account.id,
			}));

			await transactionalEntityManager.save(new MiUserProfile({
				userId: account.id,
				autoAcceptFollowed: true,
				// 旗鯖の既定表示言語。リモートユーザーのプロフィールには設定しない。
				lang: 'ja-JP',
				password: hash,
				...(applicationId !== null ? { email: applicationEmail, emailVerified: true } : {}),
			}));

			await transactionalEntityManager.save(new MiUsedUsername({
				createdAt: new Date(),
				username: username.toLowerCase(),
			}));
			if (applicationId !== null) {
				// Never save the whole application: stale review contacts must not revive.
				await transactionalEntityManager.update(MiRegistrationApplication, applicationId, {
					status: 'approved', approvedAt: new Date(), userId: account.id, additionalContacts: null,
				});
				if (!reviewContext) throw new Error('Missing registration review');
				await this.registrationReviewService.recordDecision(transactionalEntityManager, reviewContext, true, account.id);
				// Any mode switch while awaiting a write rolls back account and decision.
				assertRegistrationApplicationsEnabled(this.meta);
			}
			assertRegistrationOpen();
		});

		this.usersChart.update(account, true);
		this.userService.notifySystemWebhook(account, 'userCreated');

		if (this.meta.rootUserId == null) {
			await this.metaService.update({ rootUserId: account.id });
		}

		return { account, secret, applicationEmail };
	}

	private async prepareSignup(
		opts: SignupOptions,
		usersRepository: Pick<UsersRepository, 'exists'> = this.usersRepository,
		usedUsernamesRepository: Pick<UsedUsernamesRepository, 'exists'> = this.usedUsernamesRepository,
	) {
		const { username, password, passwordHash, host } = opts;
		let hash = passwordHash;

		// Validate username
		if (!this.userEntityService.validateLocalUsername(username)) {
			throw new Error('INVALID_USERNAME');
		}

		if (password != null && passwordHash == null) {
			// Validate password
			if (!this.userEntityService.validatePassword(password)) {
				throw new Error('INVALID_PASSWORD');
			}

			// Generate hash of password
			//const salt = await bcrypt.genSalt(8);
			hash = await argon2.hash(password);
		}

		// Generate secret
		const secret = generateNativeUserToken();

		// Check username duplication
		if (await usersRepository.exists({ where: { usernameLower: username.toLowerCase(), host: IsNull() } })) {
			throw new Error('DUPLICATED_USERNAME');
		}

		// Check deleted username duplication
		if (await usedUsernamesRepository.exists({ where: { username: username.toLowerCase() } })) {
			throw new Error('USED_USERNAME');
		}

		if (!opts.ignorePreservedUsernames && this.meta.rootUserId != null) {
			const isPreserved = this.meta.preservedUsernames.map(x => x.toLowerCase()).includes(username.toLowerCase());
			if (isPreserved) {
				throw new Error('USED_USERNAME');
			}

			const hasProhibitedWords = this.utilityService.isKeyWordIncluded(username.toLowerCase(), this.meta.prohibitedWordsForNameOfUser);
			if (hasProhibitedWords) {
				throw new Error('USED_USERNAME');
			}
		}

		const keyPair = await new Promise<string[]>((res, rej) =>
			generateKeyPair('rsa', {
				modulusLength: 2048,
				publicKeyEncoding: {
					type: 'spki',
					format: 'pem',
				},
				privateKeyEncoding: {
					type: 'pkcs8',
					format: 'pem',
					cipher: undefined,
					passphrase: undefined,
				},
			}, (err, publicKey, privateKey) =>
				err ? rej(err) : res([publicKey, privateKey]),
			));

		return { username, hash, host, keyPair, secret };
	}
}
