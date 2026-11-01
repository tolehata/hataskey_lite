/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import ms from 'ms';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { ApiError } from '@/server/api/error.js';
import { bindThis } from '@/decorators.js';
import type { Config } from '@/config.js';
import type { UserProfilesRepository, DriveFilesRepository } from '@/models/_.js';

// 旗鯖fork: マスコット機能のデータを更新する。
// サーバー側で上限(ロール)・XSS・URLドメインを検証してから保存する。
//   - キャラ数 / 表情数 / 文言数 はロールの上限内
//   - 名前・ラベル・文言テキストは長さ制限 + 制御文字除去(XSS/壊れ対策)
//   - 画像URLは自サーバーのドライブ/メディア配信ドメインのみ許可(外部URL混入を防ぐ)
//   画像本体はクライアントがDLしてローカルにキャッシュするため、ここではURL参照のみ扱う。

const NAME_MAX = 30;
const LABEL_MAX = 30;
const PHRASE_MAX = 140;
// 旗鯖fork: マスコット画像の制限。ドライブのファイルメタ(size/type)で検証する。
//   ドライブは登録時にマジックバイトで type を判定済みなので、その type を信頼してよい。
const IMAGE_MAX_BYTES = 500 * 1024; // 500KB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// 0〜1 にクランプ。数値でなければ fallback。
function clamp01(v: unknown, fallback: number): number {
	if (typeof v !== 'number' || Number.isNaN(v)) return fallback;
	return Math.min(1, Math.max(0, v));
}

// min〜max にクランプ。数値でなければ fallback。
function clampRange(v: unknown, min: number, max: number, fallback: number): number {
	if (typeof v !== 'number' || Number.isNaN(v)) return fallback;
	return Math.min(max, Math.max(min, v));
}

export const meta = {
	tags: ['hata'],

	requireCredential: true,

	kind: 'write:account',

	limit: {
		duration: ms('1hour'),
		max: 60,
		minInterval: ms('1sec'),
	},

	errors: {
		forbidden: {
			message: 'You are not allowed to use the mascot feature.',
			code: 'MASCOT_FORBIDDEN',
			id: 'b1a2c3d4-0001-0001-0001-000000000008',
		},
		notConsented: {
			message: 'You have not consented to the mascot feature.',
			code: 'MASCOT_NOT_CONSENTED',
			id: 'b1a2c3d4-0001-0001-0001-000000000001',
		},
		tooManyCharacters: {
			message: 'Too many characters.',
			code: 'MASCOT_TOO_MANY_CHARACTERS',
			id: 'b1a2c3d4-0001-0001-0001-000000000002',
		},
		tooManyExpressions: {
			message: 'Too many expressions.',
			code: 'MASCOT_TOO_MANY_EXPRESSIONS',
			id: 'b1a2c3d4-0001-0001-0001-000000000003',
		},
		tooManyPhrases: {
			message: 'Too many phrases.',
			code: 'MASCOT_TOO_MANY_PHRASES',
			id: 'b1a2c3d4-0001-0001-0001-000000000004',
		},
		invalidImageUrl: {
			message: 'Image URL must point to this server\'s drive.',
			code: 'MASCOT_INVALID_IMAGE_URL',
			id: 'b1a2c3d4-0001-0001-0001-000000000005',
		},
		imageTooLarge: {
			message: 'Image file is too large (max 500KB).',
			code: 'MASCOT_IMAGE_TOO_LARGE',
			id: 'b1a2c3d4-0001-0001-0001-000000000006',
		},
		invalidImageType: {
			message: 'Image must be JPEG, PNG, WebP or GIF.',
			code: 'MASCOT_INVALID_IMAGE_TYPE',
			id: 'b1a2c3d4-0001-0001-0001-000000000007',
		},
		imageNotFound: {
			message: 'Referenced drive file was not found or not owned by you.',
			code: 'MASCOT_IMAGE_NOT_FOUND',
			id: 'b1a2c3d4-0001-0001-0001-000000000008',
		},
		// 旗鯖fork: マスコットに最低 1 つの立ち絵 (expression) が必須。
		// 立ち絵未設定だとフロント側で実体描画されず、フローティング ON だけが立つ状態となり
		// 「マスコットは見えないのに通知トーストが抑制される」原因になっていた。
		noExpressions: {
			message: 'At least one expression (standing portrait) is required for the character.',
			code: 'MASCOT_NO_EXPRESSIONS',
			id: 'b1a2c3d4-0001-0001-0001-000000000009',
		},
	},

	res: {
		type: 'object',
		nullable: false, optional: false,
		properties: {
			ok: { type: 'boolean', nullable: false, optional: false },
			updatedAt: { type: 'number', nullable: false, optional: false },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		characters: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: { type: 'string' },
					name: { type: 'string' },
					expressions: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								id: { type: 'string' },
								label: { type: 'string' },
								url: { type: 'string' },
								driveFileId: { type: 'string', nullable: true },
								bubbleX: { type: 'number', nullable: true },
								bubbleY: { type: 'number', nullable: true },
								bubbleScale: { type: 'number', nullable: true },
								bubbleTail: { type: 'string', nullable: true, enum: ['left', 'right', null] },
								motion: { type: 'string', nullable: true, enum: ['none', 'bounce', 'shake', 'sway', 'spin', null] },
								motionIntensity: { type: 'number', nullable: true },
								questionEnabled: { type: 'boolean', nullable: true },
								qBubbleX: { type: 'number', nullable: true },
								qBubbleY: { type: 'number', nullable: true },
								qBubbleScale: { type: 'number', nullable: true },
								qBubbleTail: { type: 'string', nullable: true, enum: ['left', 'right', null] },
								textColor: { type: 'string', nullable: true },
								qTextColor: { type: 'string', nullable: true },
							},
							required: ['id', 'label', 'url'],
						},
					},
					phrases: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								id: { type: 'string' },
								text: { type: 'string' },
								expressionId: { type: 'string', nullable: true },
							},
							required: ['id', 'text'],
						},
					},
					notifyExpression: {
						type: 'object',
						nullable: true,
						properties: {
							url: { type: 'string', nullable: true },
							driveFileId: { type: 'string', nullable: true },
							label: { type: 'string', nullable: true },
							text: { type: 'string', nullable: true },
							motion: { type: 'string', nullable: true, enum: ['none', 'bounce', 'shake', 'sway', 'spin', null] },
							motionIntensity: { type: 'number', nullable: true },
							bubbleX: { type: 'number', nullable: true },
							bubbleY: { type: 'number', nullable: true },
							bubbleScale: { type: 'number', nullable: true },
							bubbleTail: { type: 'string', nullable: true, enum: ['left', 'right', null] },
							exclaimEnabled: { type: 'boolean', nullable: true },
							eBubbleX: { type: 'number', nullable: true },
							eBubbleY: { type: 'number', nullable: true },
							eBubbleScale: { type: 'number', nullable: true },
							eBubbleTail: { type: 'string', nullable: true, enum: ['left', 'right', null] },
							textColor: { type: 'string', nullable: true },
							eTextColor: { type: 'string', nullable: true },
						},
					},
					notifyExpression2: {
						type: 'object',
						nullable: true,
						properties: {
							url: { type: 'string', nullable: true },
							driveFileId: { type: 'string', nullable: true },
							label: { type: 'string', nullable: true },
							text: { type: 'string', nullable: true },
							motion: { type: 'string', nullable: true, enum: ['none', 'bounce', 'shake', 'sway', 'spin', null] },
							motionIntensity: { type: 'number', nullable: true },
							bubbleX: { type: 'number', nullable: true },
							bubbleY: { type: 'number', nullable: true },
							bubbleScale: { type: 'number', nullable: true },
							bubbleTail: { type: 'string', nullable: true, enum: ['left', 'right', null] },
							exclaimEnabled: { type: 'boolean', nullable: true },
							eBubbleX: { type: 'number', nullable: true },
							eBubbleY: { type: 'number', nullable: true },
							eBubbleScale: { type: 'number', nullable: true },
							eBubbleTail: { type: 'string', nullable: true, enum: ['left', 'right', null] },
							textColor: { type: 'string', nullable: true },
							eTextColor: { type: 'string', nullable: true },
						},
					},
					birthdayExpression: {
						type: 'object',
						nullable: true,
						properties: {
							url: { type: 'string', nullable: true },
							driveFileId: { type: 'string', nullable: true },
							label: { type: 'string', nullable: true },
							text: { type: 'string', nullable: true },
							motion: { type: 'string', nullable: true, enum: ['none', 'bounce', 'shake', 'sway', 'spin', null] },
							motionIntensity: { type: 'number', nullable: true },
							bubbleX: { type: 'number', nullable: true },
							bubbleY: { type: 'number', nullable: true },
							bubbleScale: { type: 'number', nullable: true },
							bubbleTail: { type: 'string', nullable: true, enum: ['left', 'right', null] },
							textColor: { type: 'string', nullable: true },
						},
					},
					charBirthdayEnabled: { type: 'boolean', nullable: true },
					charBirthdayMonth: { type: 'number', nullable: true },
					charBirthdayDay: { type: 'number', nullable: true },
					charBirthdayExpression: {
						type: 'object',
						nullable: true,
						properties: {
							url: { type: 'string', nullable: true },
							driveFileId: { type: 'string', nullable: true },
							label: { type: 'string', nullable: true },
							text: { type: 'string', nullable: true },
							motion: { type: 'string', nullable: true, enum: ['none', 'bounce', 'shake', 'sway', 'spin', null] },
							motionIntensity: { type: 'number', nullable: true },
							bubbleX: { type: 'number', nullable: true },
							bubbleY: { type: 'number', nullable: true },
							bubbleScale: { type: 'number', nullable: true },
							bubbleTail: { type: 'string', nullable: true, enum: ['left', 'right', null] },
							textColor: { type: 'string', nullable: true },
						},
					},
				},
				required: ['id', 'name'],
			},
		},
		activeCharacterId: { type: 'string', nullable: true },
		showName: { type: 'boolean' },
	},
	required: ['characters'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.config)
		private config: Config,
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: me.id });

			// 同意していなければ拒否(同意管理と連動)
			if (profile.hataConsentMascot !== true) {
				throw new ApiError(meta.errors.notConsented);
			}

			const policies = await this.roleService.getUserPolicies(me.id);

			// 旗鯖fork: マスコット機能の利用がロールで許可されていなければ拒否(フロントUIに加えた最終防衛線)
			if (!policies.canUseMascot) {
				throw new ApiError(meta.errors.forbidden);
			}

			// 上限チェック
			if (ps.characters.length > policies.mascotMaxCharacters) {
				throw new ApiError(meta.errors.tooManyCharacters);
			}

			const characters = ps.characters.map((c) => {
				const expressions = (c.expressions ?? []);
				const phrases = (c.phrases ?? []);
				// 旗鯖fork: 立ち絵 (expression) が 0 個ならマスコットとして機能しないので拒否。
				// 未設定保存を許してしまうと、フロント側でフローティング ON だけ立って通知トーストが
				// 完全に消える不具合 (#trial で報告) の温床になっていたため、保存段階で弾く。
				if (expressions.length === 0) {
					throw new ApiError(meta.errors.noExpressions);
				}
				if (expressions.length > policies.mascotMaxExpressions) {
					throw new ApiError(meta.errors.tooManyExpressions);
				}
				if (phrases.length > policies.mascotMaxPhrases) {
					throw new ApiError(meta.errors.tooManyPhrases);
				}

				const expIds = new Set<string>();
				const cleanExpressions = expressions.map((e) => {
					// 旗鯖fork: driveFileId がある場合は後段の DB 検証 (所有者/type/size、L470-486) で
					// 安全性が担保されるため、URL ホストチェックは不要。本番運用で driveUrl/mediaProxy が
					// instance URL と異なる独自ドメインに設定されていると、allowedOrigins に含まれず
					// MASCOT_INVALID_IMAGE_URL で全保存が失敗していた問題を回避。
					// driveFileId が無い (= 外部 URL 直接指定) ケースのみ自サーバードメインに限定。
					if (!e.driveFileId && !this.isAllowedImageUrl(e.url)) {
						throw new ApiError(meta.errors.invalidImageUrl);
					}
					expIds.add(e.id);
					return {
						id: this.sanitize(e.id, 64),
						label: this.sanitize(e.label, LABEL_MAX),
						url: e.url,
						driveFileId: e.driveFileId ?? null,
						// 吹き出し位置(立ち絵に対する相対割合 0〜1)。未指定はデフォルト(上中央寄り)。
						bubbleX: clamp01(e.bubbleX, 0.5),
						bubbleY: clamp01(e.bubbleY, 0.1),
						// 吹き出しサイズ(0.6〜1.6)としっぽの左右
						bubbleScale: clampRange(e.bubbleScale, 0.6, 1.6, 1),
						bubbleTail: (e.bubbleTail === 'right' ? 'right' : 'left'),
						// 旗鯖fork: e.motion は string | null | undefined のため、includes に渡す前に '' へ寄せる。
						motion: (['bounce', 'shake', 'sway', 'spin'].includes(e.motion ?? '') ? e.motion : 'none'),
						motionIntensity: clampRange(e.motionIntensity, 0.3, 2, 1),
						questionEnabled: e.questionEnabled === true,
						qBubbleX: clamp01(e.qBubbleX, 0.7),
						qBubbleY: clamp01(e.qBubbleY, 0.05),
						qBubbleScale: clampRange(e.qBubbleScale, 0.6, 1.6, 1),
						qBubbleTail: (e.qBubbleTail === 'right' ? 'right' : 'left'),
						textColor: this.sanitizeColor((e as Record<string, any>).textColor),
						qTextColor: this.sanitizeColor((e as Record<string, any>).qTextColor),
					};
				});

				const cleanPhrases = phrases.map((p) => ({
					id: this.sanitize(p.id, 64),
					text: this.sanitize(p.text, PHRASE_MAX),
					// 紐付け先の表情が存在しなければ null に落とす
					expressionId: (p.expressionId && expIds.has(p.expressionId)) ? p.expressionId : null,
				}));

				// 通知用の専用表情(フル装備 + ！小吹き出し)。画像URLは許可元のみ。
				let cleanNotify: Record<string, unknown> | null = null;
				const nx = (c as Record<string, any>).notifyExpression;
				if (nx && (nx.url || nx.driveFileId)) {
					// 旗鯖fork: driveFileId があれば後段の DB 検証で安全性担保。URL 直接指定のみホスト制限。
					if (!nx.driveFileId && nx.url && !this.isAllowedImageUrl(nx.url)) {
						throw new ApiError(meta.errors.invalidImageUrl);
					}
					cleanNotify = {
						url: nx.url ?? null,
						driveFileId: nx.driveFileId ?? null,
						label: this.sanitize(nx.label ?? '', LABEL_MAX),
						text: this.sanitize(nx.text ?? '', PHRASE_MAX),
						motion: (['bounce', 'shake', 'sway', 'spin'].includes(nx.motion) ? nx.motion : 'none'),
						motionIntensity: clampRange(nx.motionIntensity, 0.3, 2, 1),
						bubbleX: clamp01(nx.bubbleX, 0.5),
						bubbleY: clamp01(nx.bubbleY, 0.1),
						bubbleScale: clampRange(nx.bubbleScale, 0.6, 1.6, 1),
						bubbleTail: (nx.bubbleTail === 'right' ? 'right' : 'left'),
						exclaimEnabled: nx.exclaimEnabled === true,
						eBubbleX: clamp01(nx.eBubbleX, 0.7),
						eBubbleY: clamp01(nx.eBubbleY, 0.05),
						eBubbleScale: clampRange(nx.eBubbleScale, 0.6, 1.6, 1),
						eBubbleTail: (nx.eBubbleTail === 'right' ? 'right' : 'left'),
						textColor: this.sanitizeColor(nx.textColor),
						eTextColor: this.sanitizeColor(nx.eTextColor),
					};
				}

				// 通知用の専用表情(2つ目)。通知時はこれと notifyExpression からランダムに選ばれる。
				let cleanNotify2: Record<string, unknown> | null = null;
				const nx2 = (c as Record<string, any>).notifyExpression2;
				if (nx2 && (nx2.url || nx2.driveFileId)) {
					// 旗鯖fork: driveFileId があれば後段の DB 検証で安全性担保。URL 直接指定のみホスト制限。
					if (!nx2.driveFileId && nx2.url && !this.isAllowedImageUrl(nx2.url)) {
						throw new ApiError(meta.errors.invalidImageUrl);
					}
					cleanNotify2 = {
						url: nx2.url ?? null,
						driveFileId: nx2.driveFileId ?? null,
						label: this.sanitize(nx2.label ?? '', LABEL_MAX),
						text: this.sanitize(nx2.text ?? '', PHRASE_MAX),
						motion: (['bounce', 'shake', 'sway', 'spin'].includes(nx2.motion) ? nx2.motion : 'none'),
						motionIntensity: clampRange(nx2.motionIntensity, 0.3, 2, 1),
						bubbleX: clamp01(nx2.bubbleX, 0.5),
						bubbleY: clamp01(nx2.bubbleY, 0.1),
						bubbleScale: clampRange(nx2.bubbleScale, 0.6, 1.6, 1),
						bubbleTail: (nx2.bubbleTail === 'right' ? 'right' : 'left'),
						exclaimEnabled: nx2.exclaimEnabled === true,
						eBubbleX: clamp01(nx2.eBubbleX, 0.7),
						eBubbleY: clamp01(nx2.eBubbleY, 0.05),
						eBubbleScale: clampRange(nx2.eBubbleScale, 0.6, 1.6, 1),
						eBubbleTail: (nx2.eBubbleTail === 'right' ? 'right' : 'left'),
						textColor: this.sanitizeColor(nx2.textColor),
						eTextColor: this.sanitizeColor(nx2.eTextColor),
					};
				}

				// 誕生日用の専用表情(フル装備、ただし！は無し)
				let cleanBirthday: Record<string, unknown> | null = null;
				const bx = (c as Record<string, any>).birthdayExpression;
				if (bx && (bx.url || bx.driveFileId)) {
					// 旗鯖fork: driveFileId があれば後段の DB 検証で安全性担保。URL 直接指定のみホスト制限。
					if (!bx.driveFileId && bx.url && !this.isAllowedImageUrl(bx.url)) {
						throw new ApiError(meta.errors.invalidImageUrl);
					}
					cleanBirthday = {
						url: bx.url ?? null,
						driveFileId: bx.driveFileId ?? null,
						label: this.sanitize(bx.label ?? '', LABEL_MAX),
						text: this.sanitize(bx.text ?? '', PHRASE_MAX),
						motion: (['bounce', 'shake', 'sway', 'spin'].includes(bx.motion) ? bx.motion : 'none'),
						motionIntensity: clampRange(bx.motionIntensity, 0.3, 2, 1),
						bubbleX: clamp01(bx.bubbleX, 0.5),
						bubbleY: clamp01(bx.bubbleY, 0.1),
						bubbleScale: clampRange(bx.bubbleScale, 0.6, 1.6, 1),
						bubbleTail: (bx.bubbleTail === 'right' ? 'right' : 'left'),
						textColor: this.sanitizeColor(bx.textColor),
					};
				}

				// キャラ自身の誕生日(月日)と、その日に言う専用表情(！なし)
				let cleanCharBirthday: Record<string, unknown> | null = null;
				const cbx = (c as Record<string, any>).charBirthdayExpression;
				if (cbx && (cbx.url || cbx.driveFileId)) {
					// 旗鯖fork: driveFileId があれば後段の DB 検証で安全性担保。URL 直接指定のみホスト制限。
					if (!cbx.driveFileId && cbx.url && !this.isAllowedImageUrl(cbx.url)) {
						throw new ApiError(meta.errors.invalidImageUrl);
					}
					cleanCharBirthday = {
						url: cbx.url ?? null,
						driveFileId: cbx.driveFileId ?? null,
						label: this.sanitize(cbx.label ?? '', LABEL_MAX),
						text: this.sanitize(cbx.text ?? '', PHRASE_MAX),
						motion: (['bounce', 'shake', 'sway', 'spin'].includes(cbx.motion) ? cbx.motion : 'none'),
						motionIntensity: clampRange(cbx.motionIntensity, 0.3, 2, 1),
						bubbleX: clamp01(cbx.bubbleX, 0.5),
						bubbleY: clamp01(cbx.bubbleY, 0.1),
						bubbleScale: clampRange(cbx.bubbleScale, 0.6, 1.6, 1),
						bubbleTail: (cbx.bubbleTail === 'right' ? 'right' : 'left'),
						textColor: this.sanitizeColor(cbx.textColor),
					};
				}
				const cbMonthRaw = (c as Record<string, any>).charBirthdayMonth;
				const cbDayRaw = (c as Record<string, any>).charBirthdayDay;
				const charBirthdayMonth = (typeof cbMonthRaw === 'number' && cbMonthRaw >= 1 && cbMonthRaw <= 12) ? Math.floor(cbMonthRaw) : null;
				const charBirthdayDay = (typeof cbDayRaw === 'number' && cbDayRaw >= 1 && cbDayRaw <= 31) ? Math.floor(cbDayRaw) : null;

				return {
					id: this.sanitize(c.id, 64),
					name: this.sanitize(c.name, NAME_MAX),
					expressions: cleanExpressions,
					phrases: cleanPhrases,
					notifyExpression: cleanNotify,
					notifyExpression2: cleanNotify2,
					birthdayExpression: cleanBirthday,
					charBirthdayEnabled: (c as Record<string, any>).charBirthdayEnabled === true,
					charBirthdayMonth,
					charBirthdayDay,
					charBirthdayExpression: cleanCharBirthday,
				};
			});

			const charIds = new Set(characters.map(c => c.id));
			const activeCharacterId = (ps.activeCharacterId && charIds.has(ps.activeCharacterId))
				? ps.activeCharacterId
				: (characters[0]?.id ?? null);

			// 旗鯖fork: 画像の実体検証。各表情の driveFileId からドライブのメタを引き、
			//   サイズ(500KB以下)・タイプ(JPEG/PNG/WebP/GIF)・所有者(本人)を検証する。
			//   ドライブは登録時にマジックバイトで type を判定済みなので、その type を信頼する。
			const driveFileIds = Array.from(new Set(
				characters.flatMap(c => [
					...c.expressions.map(e => e.driveFileId),
					(c.notifyExpression as Record<string, any> | null)?.driveFileId ?? null,
					(c.notifyExpression2 as Record<string, any> | null)?.driveFileId ?? null,
					(c.birthdayExpression as Record<string, any> | null)?.driveFileId ?? null,
					(c.charBirthdayExpression as Record<string, any> | null)?.driveFileId ?? null,
				].filter((x): x is string => !!x)),
			));
			if (driveFileIds.length > 0) {
				const files = await this.driveFilesRepository.findBy({ id: In(driveFileIds) });
				const fileMap = new Map(files.map(f => [f.id, f]));
				for (const id of driveFileIds) {
					const f = fileMap.get(id);
					// 存在しない or 本人所有でないファイルは拒否
					if (!f || f.userId !== me.id) {
						throw new ApiError(meta.errors.imageNotFound);
					}
					if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
						throw new ApiError(meta.errors.invalidImageType);
					}
					if (f.size > IMAGE_MAX_BYTES) {
						throw new ApiError(meta.errors.imageTooLarge);
					}
				}
			}

			const updatedAt = Date.now();
			const data = {
				characters,
				activeCharacterId,
				showName: ps.showName ?? false,
				updatedAt,
			};

			// 旗鯖fork: TypeORM v1 で update() の引数型が _QueryDeepPartialEntity に厳格化された影響により、
			//   data 内の motion などの string literal 型が string と一致せず TS2322 となる。
			//   data は上で sanitize / clamp / 許可リスト検証済みのため、as any で TypeORM の型チェックを回避する。
			await this.userProfilesRepository.update(me.id, { hataMascotData: data } as any);

			return { ok: true, updatedAt };
		});
	}

	// 文字色のサニタイズ: #rgb / #rrggbb 形式のみ許可。それ以外(空含む)は null(テーマ既定色)。
	@bindThis
	private sanitizeColor(v: unknown): string | null {
		if (typeof v !== 'string') return null;
		const s = v.trim();
		if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) return s;
		return null;
	}

	// テキストのサニタイズ: 長さ制限 + 制御文字(改行以外)除去。
	// 表示側でもエスケープするが、保存時にも最低限の正規化を行う。
	@bindThis
	private sanitize(s: string, max: number): string {
		// 制御文字(タブ・改行は許容)を除去
		// eslint-disable-next-line no-control-regex
		const cleaned = String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
		return cleaned.slice(0, max);
	}

	// 画像URLが自サーバーのドライブ/メディア配信ドメインかを検証する。
	@bindThis
	private isAllowedImageUrl(url: string): boolean {
		let u: URL;
		try {
			u = new URL(url);
		} catch {
			return false;
		}
		if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;

		const allowedOrigins: string[] = [];
		for (const base of [this.config.url, this.config.driveUrl, this.config.mediaProxy]) {
			if (!base) continue;
			try { allowedOrigins.push(new URL(base).host); } catch { /* noop */ }
		}
		return allowedOrigins.includes(u.host);
	}
}
