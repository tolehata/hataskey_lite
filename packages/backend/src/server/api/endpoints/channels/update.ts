/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { DriveFilesRepository, ChannelsRepository } from '@/models/_.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { ChannelService } from '@/core/ChannelService.js';
import { DI } from '@/di-symbols.js';
import { RoleService } from '@/core/RoleService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['channels'],

	requireCredential: true,

	kind: 'write:channels',

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Channel',
	},

	errors: {
		noSuchChannel: {
			message: 'No such channel.',
			code: 'NO_SUCH_CHANNEL',
			id: 'f9c5467f-d492-4c3c-9a8d-a70dacc86512',
		},

		accessDenied: {
			message: 'You do not have edit privilege of the channel.',
			code: 'ACCESS_DENIED',
			id: '1fb7cb09-d46a-4fdf-b8df-057788cce513',
		},

		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'e86c14a4-0da2-4032-8df3-e737a04c7f3b',
		},
		// 旗鯖fork: プライベートチャンネル化の権限がない
		privateChannelNotAllowed: {
			message: 'You are not allowed to make this channel private.',
			code: 'PRIVATE_CHANNEL_NOT_ALLOWED',
			id: '3e7c2a1b-4d5e-4f6a-9b8c-1d2e3f4a5b6c',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		channelId: { type: 'string', format: 'misskey:id' },
		name: { type: 'string', minLength: 1, maxLength: 128 },
		description: { type: 'string', nullable: true, minLength: 1, maxLength: 2048 },
		bannerId: { type: 'string', format: 'misskey:id', nullable: true },
		isArchived: { type: 'boolean', nullable: true },
		pinnedNoteIds: {
			type: 'array',
			items: {
				type: 'string', format: 'misskey:id',
			},
		},
		color: { type: 'string', minLength: 1, maxLength: 16 },
		isSensitive: { type: 'boolean', nullable: true },
		allowRenoteToExternal: { type: 'boolean', nullable: true },
		// 旗鯖fork: プライベートチャンネル
		isPrivate: { type: 'boolean', nullable: true },
		// 旗鯖fork: 合言葉(password) の直接編集は廃止。代わりに「再生成フラグ」で
		// サーバー側で暗号学的乱数による新しい合言葉を生成する設計。
		// 弱い合言葉(例: '1234')でブルートフォース侵入される事故と、UI 上で平文を
		// 編集できることのフィッシング/ショルダーハック懸念を同時に解消する。
		regeneratePassword: { type: 'boolean', nullable: true },
		moderatorUserIds: { type: 'array', items: { type: 'string', format: 'misskey:id' }, nullable: true },
	},
	required: ['channelId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private channelEntityService: ChannelEntityService,

		private roleService: RoleService,
		private channelService: ChannelService,
		private notificationService: NotificationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const channel = await this.channelsRepository.findOneBy({
				id: ps.channelId,
			});

			if (channel == null) {
				throw new ApiError(meta.errors.noSuchChannel);
			}

			// 旗鯖fork: 作成者・副管理者・インスタンスのモデレーターが編集できる。
			if (!await this.channelService.canManage(channel, me.id)) {
				throw new ApiError(meta.errors.accessDenied);
			}

			// 旗鯖fork: 非プライベート→プライベート化はロールポリシーが必要(既にプライベートなら不問)。
			if (ps.isPrivate === true && !channel.isPrivate) {
				const policies = await this.roleService.getUserPolicies(me.id);
				if (!policies.canMakePrivateChannel) {
					throw new ApiError(meta.errors.privateChannelNotAllowed);
				}
			}

			// eslint:disable-next-line:no-unnecessary-initializer
			let banner = undefined;
			if (ps.bannerId != null) {
				banner = await this.driveFilesRepository.findOneBy({
					id: ps.bannerId,
					userId: me.id,
				});

				if (banner == null) {
					throw new ApiError(meta.errors.noSuchFile);
				}
			} else if (ps.bannerId === null) {
				banner = null;
			}

			// 旗鯖fork: プライベートチャンネルは一度設定したら解除できない。
			//   既にプライベート、または今回プライベート化する場合は常に private 扱い。
			//   (ps.isPrivate=false が来ても、既存が private なら無視して private を維持する)
			const effectiveIsPrivate = channel.isPrivate || ps.isPrivate === true;

			await this.channelsRepository.update(channel.id, {
				...(ps.name !== undefined ? { name: ps.name } : {}),
				...(ps.description !== undefined ? { description: ps.description } : {}),
				...(ps.pinnedNoteIds !== undefined ? { pinnedNoteIds: ps.pinnedNoteIds } : {}),
				...(ps.color !== undefined ? { color: ps.color } : {}),
				...(typeof ps.isArchived === 'boolean' ? { isArchived: ps.isArchived } : {}),
				...(banner ? { bannerId: banner.id } : {}),
				...(typeof ps.isSensitive === 'boolean' ? { isSensitive: ps.isSensitive } : {}),
				// 旗鯖fork: プライベートチャンネルはチャンネル外リノートを不可で固定。
				...(effectiveIsPrivate ? { allowRenoteToExternal: false } : (typeof ps.allowRenoteToExternal === 'boolean' ? { allowRenoteToExternal: ps.allowRenoteToExternal } : {})),
				// 旗鯖fork: プライベート化は許可するが、解除(true→false)は不可。常に effectiveIsPrivate を書く。
				...(effectiveIsPrivate ? { isPrivate: true } : {}),
				// 旗鯖fork: 合言葉は regeneratePassword フラグで再生成のみ可能。
				// 任意文字列の直接書き換えは廃止 (弱い合言葉のブルートフォース対策)。
				...(ps.regeneratePassword === true && effectiveIsPrivate ? { password: secureRndstr(32) } : {}),
				...(ps.moderatorUserIds !== undefined ? { moderatorUserIds: [...new Set(ps.moderatorUserIds)].filter(uid => uid !== channel.userId) } : {}),
			});

			// 旗鯖fork: 副管理者をメンバーにも登録(閲覧できるように) + 差分通知。
			if (ps.moderatorUserIds !== undefined) {
				const newModerators = [...new Set(ps.moderatorUserIds)].filter(uid => uid !== channel.userId);
				const oldModerators = channel.moderatorUserIds ?? [];
				const added = newModerators.filter(uid => !oldModerators.includes(uid));
				const removed = oldModerators.filter(uid => !newModerators.includes(uid));

				for (const uid of newModerators) {
					await this.channelService.addMember(channel.id, uid);
				}

				// プライベートチャンネル向けに、追加/除外された副管理者へ通知。
				if (effectiveIsPrivate) {
					for (const uid of added) {
						if (uid === me.id) continue;
						this.notificationService.createNotification(uid, 'addedToPrivateChannel', {
							customBody: `プライベートチャンネル「${channel.name}」の副管理者に追加されました。タップしてチャンネルを開く。`,
							customHeader: 'プライベートチャンネルへ追加',
							customIcon: null,
							customLink: `/channels/${channel.id}`,
						}, me.id);
					}
					for (const uid of removed) {
						if (uid === me.id) continue;
						this.notificationService.createNotification(uid, 'removedFromPrivateChannel', {
							customBody: `プライベートチャンネル「${channel.name}」の副管理者から外れました。`,
							customHeader: 'プライベートチャンネルから除外',
							customIcon: null,
							customLink: null,
						}, me.id);
					}
				}
			}

			return await this.channelEntityService.pack(channel.id, me);
		});
	}
}
