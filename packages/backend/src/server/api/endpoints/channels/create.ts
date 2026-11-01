/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import ms from 'ms';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { ChannelsRepository, DriveFilesRepository } from '@/models/_.js';
import type { MiChannel } from '@/models/Channel.js';
import { IdService } from '@/core/IdService.js';
import { ChannelEntityService } from '@/core/entities/ChannelEntityService.js';
import { ChannelService } from '@/core/ChannelService.js';
import { RoleService } from '@/core/RoleService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { DI } from '@/di-symbols.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['channels'],

	requireCredential: true,

	prohibitMoved: true,

	kind: 'write:channels',

	limit: {
		duration: ms('1hour'),
		max: 10,
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'Channel',
	},

	errors: {
		noSuchFile: {
			message: 'No such file.',
			code: 'NO_SUCH_FILE',
			id: 'cd1e9f3e-5a12-4ab4-96f6-5d0a2cc32050',
		},
		// 旗鯖fork: プライベートチャンネル作成権限がない
		privateChannelNotAllowed: {
			message: 'You are not allowed to create a private channel.',
			code: 'PRIVATE_CHANNEL_NOT_ALLOWED',
			id: '2d6b1f0a-9c3e-4a7b-8f1c-7a2b3c4d5e6f',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', minLength: 1, maxLength: 128 },
		description: { type: 'string', nullable: true, minLength: 1, maxLength: 2048 },
		bannerId: { type: 'string', format: 'misskey:id', nullable: true },
		color: { type: 'string', minLength: 1, maxLength: 16 },
		isSensitive: { type: 'boolean', nullable: true },
		allowRenoteToExternal: { type: 'boolean', nullable: true },
		// 旗鯖fork: プライベートチャンネル
		isPrivate: { type: 'boolean', nullable: true },
		// 旗鯖fork: 合言葉(password) は backend で暗号学的乱数による自動生成に変更。
		// ユーザー入力の弱い合言葉(例: '1234')でブルートフォース侵入される事故を防ぐため、
		// API のパラメータからは削除。生成された合言葉は作成レスポンスの password フィールドで返る。
		moderatorUserIds: { type: 'array', items: { type: 'string', format: 'misskey:id' }, nullable: true },
	},
	required: ['name'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		private idService: IdService,
		private channelEntityService: ChannelEntityService,
		private channelService: ChannelService,
		private roleService: RoleService,
		private notificationService: NotificationService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// 旗鯖fork: プライベートチャンネルの作成はロールポリシーで許可された場合のみ。
			if (ps.isPrivate) {
				const policies = await this.roleService.getUserPolicies(me.id);
				if (!policies.canMakePrivateChannel) {
					throw new ApiError(meta.errors.privateChannelNotAllowed);
				}
			}

			let banner = null;
			if (ps.bannerId != null) {
				banner = await this.driveFilesRepository.findOneBy({
					id: ps.bannerId,
					userId: me.id,
				});

				if (banner == null) {
					throw new ApiError(meta.errors.noSuchFile);
				}
			}

			// 旗鯖fork: 副管理者は重複排除し、作成者自身は含めない。
			const moderatorUserIds = ps.moderatorUserIds ? [...new Set(ps.moderatorUserIds)].filter(uid => uid !== me.id) : [];

			const channel = await this.channelsRepository.insertOne({
				id: this.idService.gen(),
				userId: me.id,
				name: ps.name,
				description: ps.description ?? null,
				bannerId: banner ? banner.id : null,
				isSensitive: ps.isSensitive ?? false,
				...(ps.color !== undefined ? { color: ps.color } : {}),
				// 旗鯖fork: プライベートチャンネルはチャンネル外リノート不可で固定
				allowRenoteToExternal: (ps.isPrivate ?? false) ? false : (ps.allowRenoteToExternal ?? true),
				// 旗鯖fork: プライベートチャンネル。合言葉はサーバー側で暗号学的乱数を自動生成する
				// (32文字英数字、secureRndstr による CSPRNG)。プライベートでない場合は null。
				isPrivate: ps.isPrivate ?? false,
				password: (ps.isPrivate ?? false) ? secureRndstr(32) : null,
				moderatorUserIds,
			} as MiChannel);

			// 旗鯖fork: 作成者・副管理者をメンバーに登録(プライベートでも閲覧できるように)。
			await this.channelService.addMember(channel.id, me.id);
			for (const uid of moderatorUserIds) {
				await this.channelService.addMember(channel.id, uid);
			}

			// 旗鯖fork: プライベートチャンネルで副管理者として追加されたユーザーへ通知。
			if (channel.isPrivate) {
				for (const uid of moderatorUserIds) {
					this.notificationService.createNotification(uid, 'addedToPrivateChannel', {
						customBody: `プライベートチャンネル「${channel.name}」の副管理者に追加されました。タップしてチャンネルを開く。`,
						customHeader: 'プライベートチャンネルへ追加',
						customIcon: null,
						customLink: `/channels/${channel.id}`,
					}, me.id);
				}
			}

			return await this.channelEntityService.pack(channel, me);
		});
	}
}
