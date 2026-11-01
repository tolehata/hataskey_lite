/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { ChannelFavoritesRepository, ChannelFollowingsRepository, ChannelMembersRepository, ChannelsRepository, DriveFilesRepository, NotesRepository } from '@/models/_.js';
import type { Packed } from '@/misc/json-schema.js';
import type { } from '@/models/Blocking.js';
import type { MiUser } from '@/models/User.js';
import type { MiChannel } from '@/models/Channel.js';
import type { MiChannelFollowing } from '@/models/ChannelFollowing.js';
import type { MiChannelFavorite } from '@/models/ChannelFavorite.js';
import type { MiChannelMember } from '@/models/ChannelMember.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { ChannelService } from '@/core/ChannelService.js';
import { RoleService } from '@/core/RoleService.js';
import { DriveFileEntityService } from './DriveFileEntityService.js';
import { NoteEntityService } from './NoteEntityService.js';
import { In } from 'typeorm';

@Injectable()
export class ChannelEntityService {
	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,

		@Inject(DI.channelFollowingsRepository)
		private channelFollowingsRepository: ChannelFollowingsRepository,

		@Inject(DI.channelFavoritesRepository)
		private channelFavoritesRepository: ChannelFavoritesRepository,

		// 旗鯖fork: packMany でのプライベートチャンネルのメンバー判定バッチに使用。
		@Inject(DI.channelMembersRepository)
		private channelMembersRepository: ChannelMembersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private noteEntityService: NoteEntityService,
		private driveFileEntityService: DriveFileEntityService,
		private idService: IdService,
		private channelService: ChannelService,
		// 旗鯖fork: packMany での isModerator バッチ判定に使用。
		private roleService: RoleService,
	) {
	}

	@bindThis
	public async pack(
		src: MiChannel['id'] | MiChannel,
		me?: { id: MiUser['id'] } | null | undefined,
		detailed?: boolean,
		_hint_?: {
			// 旗鯖fork: packMany が事前に集約した N+1 解消用の hint。
			bannerMap?: Map<string, string | null>; // bannerId -> bannerUrl
			followingSet?: Set<MiChannel['id']>;
			favoritedSet?: Set<MiChannel['id']>;
			memberSet?: Set<MiChannel['id']>;
			iAmModerator?: boolean;
		},
	): Promise<Packed<'Channel'>> {
		const channel = typeof src === 'object' ? src : await this.channelsRepository.findOneByOrFail({ id: src });
		const meId = me ? me.id : null;

		// 旗鯖fork: hint があれば DB を引かずに済む。
		const bannerUrl = channel.bannerId
			? (_hint_?.bannerMap?.has(channel.bannerId)
				? _hint_.bannerMap.get(channel.bannerId)!
				: await (async () => {
					const banner = await this.driveFilesRepository.findOneBy({ id: channel.bannerId! });
					return banner ? this.driveFileEntityService.getPublicUrl(banner) : null;
				})())
			: null;

		const isFollowing = meId
			? (_hint_?.followingSet
				? _hint_.followingSet.has(channel.id)
				: await this.channelFollowingsRepository.exists({
					where: { followerId: meId, followeeId: channel.id },
				}))
			: false;

		const isFavorited = meId
			? (_hint_?.favoritedSet
				? _hint_.favoritedSet.has(channel.id)
				: await this.channelFavoritesRepository.exists({
					where: { userId: meId, channelId: channel.id },
				}))
			: false;

		// 旗鯖fork: プライベートチャンネルのメンバー判定・管理権限。
		const isMember = (meId && channel.isPrivate)
			? (_hint_?.memberSet
				? _hint_.memberSet.has(channel.id)
				: await this.channelService.isMember(channel.id, meId))
			: false;
		// canManage は roleService.isModerator が必要。hint があれば集約結果から再計算する。
		const canManage = meId
			? (_hint_?.iAmModerator !== undefined
				? (channel.userId === meId
					|| channel.moderatorUserIds.includes(meId)
					|| _hint_.iAmModerator)
				: await this.channelService.canManage(channel, meId))
			: false;

		const pinnedNotes = channel.pinnedNoteIds.length > 0 ? await this.notesRepository.find({
			where: {
				id: In(channel.pinnedNoteIds),
			},
		}) : [];

		return {
			id: channel.id,
			createdAt: this.idService.parse(channel.id).date.toISOString(),
			lastNotedAt: channel.lastNotedAt ? channel.lastNotedAt.toISOString() : null,
			name: channel.name,
			description: channel.description,
			userId: channel.userId,
			bannerId: channel.bannerId,
			bannerUrl: bannerUrl,
			pinnedNoteIds: channel.pinnedNoteIds,
			color: channel.color,
			isArchived: channel.isArchived,
			usersCount: channel.usersCount,
			notesCount: channel.notesCount,
			isSensitive: channel.isSensitive,
			allowRenoteToExternal: channel.allowRenoteToExternal,
			// 旗鯖fork: プライベートチャンネル情報
			isPrivate: channel.isPrivate,
			hasPassword: channel.password != null && channel.password.length > 0,
			moderatorUserIds: channel.moderatorUserIds,

			...(me ? {
				isFollowing,
				isFavorited,
				hasUnreadNote: false, // 後方互換性のため
				isMember,
				canManage,
			} : {}),

			...(detailed ? {
				pinnedNotes: (await this.noteEntityService.packMany(pinnedNotes, me)).sort((a, b) => channel.pinnedNoteIds.indexOf(a.id) - channel.pinnedNoteIds.indexOf(b.id)),
			} : {}),
		};
	}

	// 旗鯖fork: チャンネル一覧の N+1 を解消するバッチ pack。
	//   - banner(DriveFile), following / favorited / member の exists、isModerator を
	//     全件横断でまとめて 1 〜数クエリに集約する。
	//   - detailed=true のときの pinnedNotes は noteEntityService.packMany 経由でさらに最適化される
	//     ためここでは個別 pack に任せる(detailed リスト系エンドポイントは現状無い)。
	@bindThis
	public async packMany(
		src: (MiChannel['id'] | MiChannel)[],
		me?: { id: MiUser['id'] } | null | undefined,
		detailed?: boolean,
	): Promise<Packed<'Channel'>[]> {
		if (src.length === 0) return [];

		// channel 本体の解決(ID 渡しと object 渡しの混在を許容)。
		const idsToFetch = src.filter((x): x is MiChannel['id'] => typeof x !== 'object');
		const fetched = idsToFetch.length > 0
			? await this.channelsRepository.findBy({ id: In(idsToFetch) })
			: [];
		const fetchedMap = new Map(fetched.map(c => [c.id, c]));
		const channels: MiChannel[] = [];
		for (const x of src) {
			if (typeof x === 'object') channels.push(x);
			else {
				const c = fetchedMap.get(x);
				if (c) channels.push(c);
			}
		}
		if (channels.length === 0) return [];

		const meId = me ? me.id : null;

		// banner を一括取得し bannerId -> bannerUrl にしておく。
		const bannerIds = [...new Set(channels.map(c => c.bannerId).filter((x): x is string => x != null))];
		const bannerMap = new Map<string, string | null>();
		if (bannerIds.length > 0) {
			const banners = await this.driveFilesRepository.findBy({ id: In(bannerIds) });
			const bannerById = new Map(banners.map(b => [b.id, b]));
			for (const bid of bannerIds) {
				const b = bannerById.get(bid);
				bannerMap.set(bid, b ? this.driveFileEntityService.getPublicUrl(b) : null);
			}
		}

		let followingSet: Set<MiChannel['id']> | undefined;
		let favoritedSet: Set<MiChannel['id']> | undefined;
		let memberSet: Set<MiChannel['id']> | undefined;
		let iAmModerator: boolean | undefined;
		if (meId) {
			const channelIds = channels.map(c => c.id);
			const [followings, favorites, members, isMod] = await Promise.all([
				this.channelFollowingsRepository.findBy({
					followerId: meId,
					followeeId: In(channelIds),
				}),
				this.channelFavoritesRepository.findBy({
					userId: meId,
					channelId: In(channelIds),
				}),
				(async () => {
					const privateIds = channels.filter(c => c.isPrivate).map(c => c.id);
					if (privateIds.length === 0) return [] as { channelId: string }[];
					return await this.channelMembersRepository.findBy({
						userId: meId,
						channelId: In(privateIds),
					});
				})(),
				// canManage 用の isModerator(1 回だけ呼ぶ)。
				this.roleService.isModerator({ id: meId }),
			]);
			followingSet = new Set(followings.map((f: MiChannelFollowing) => f.followeeId));
			favoritedSet = new Set(favorites.map((f: MiChannelFavorite) => f.channelId));
			memberSet = new Set(members.map((m: { channelId: string }) => m.channelId));
			iAmModerator = isMod;
		}

		return await Promise.all(channels.map(c => this.pack(c, me, detailed, {
			bannerMap,
			followingSet,
			favoritedSet,
			memberSet,
			iAmModerator,
		})));
	}
}
