/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 * 旗鯖fork: プライベートチャンネルの権限判定・メンバーシップ管理。
 *   - 閲覧可否(canView): 公開チャンネルは誰でも可。プライベートは作成者・副管理者・メンバーのみ。
 *   - 管理可否(canManage): 作成者・副管理者・インスタンスのモデレーター。
 *   - メンバー追加/削除、あいことば(password)による入室。
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { ChannelsRepository, ChannelInvitationsRepository, ChannelMembersRepository } from '@/models/_.js';
import type { MiChannel } from '@/models/Channel.js';
import type { MiChannelInvitation } from '@/models/ChannelInvitation.js';
import type { MiUser } from '@/models/User.js';
import { IdService } from '@/core/IdService.js';
import { RoleService } from '@/core/RoleService.js';
import { MemoryKVCache } from '@/misc/cache.js';
import { bindThis } from '@/decorators.js';

@Injectable()
export class ChannelService {
	// 旗鯖fork: isMember は canView / addMember 冪等チェック / ChannelEntityService.pack 等から
	//   高頻度に呼ばれるため、(channelId, userId) → boolean をメモリキャッシュする。
	//   個別の exists クエリ自体は主キー検索で軽いが、ノートやページ表示で重複呼び出しが発生するため
	//   それを削減する目的。TTL は短め(30秒)・addMember / removeMember では即時 invalidate する。
	private readonly isMemberCache = new MemoryKVCache<boolean>(1000 * 30);

	constructor(
		@Inject(DI.channelsRepository)
		private channelsRepository: ChannelsRepository,
		@Inject(DI.channelMembersRepository)
		private channelMembersRepository: ChannelMembersRepository,
		@Inject(DI.channelInvitationsRepository)
		private channelInvitationsRepository: ChannelInvitationsRepository,

		private idService: IdService,
		private roleService: RoleService,
	) {
	}

	// (channelId, userId) を一意なキーに正規化する。両IDとも英数字なので ':' 区切りで衝突しない。
	private membershipKey(channelId: MiChannel['id'], userId: MiUser['id']): string {
		return `${channelId}:${userId}`;
	}

	// この Issue のメンバーか。
	@bindThis
	public async isMember(channelId: MiChannel['id'], userId: MiUser['id']): Promise<boolean> {
		return this.isMemberCache.fetch(
			this.membershipKey(channelId, userId),
			() => this.channelMembersRepository.exists({ where: { channelId, userId } }),
		);
	}

	// チャンネルを閲覧できるか。公開なら常に可。
	// プライベートなら作成者・副管理者・メンバー、加えてインスタンスのモデレーター/管理者(全チャンネルにアクセス可)。
	@bindThis
	public async canView(channel: MiChannel, userId: MiUser['id'] | null): Promise<boolean> {
		if (!channel.isPrivate) return true;
		if (userId == null) return false;
		if (channel.userId === userId) return true;
		if (channel.moderatorUserIds.includes(userId)) return true;
		if (await this.isMember(channel.id, userId)) return true;
		// モデレーター/管理者は全チャンネルへアクセスできる。
		return this.roleService.isModerator({ id: userId });
	}

	// チャンネル(メンバー・設定)を管理できるか。作成者・副管理者・インスタンスのモデレーター。
	@bindThis
	public async canManage(channel: MiChannel, userId: MiUser['id'] | null): Promise<boolean> {
		if (userId == null) return false;
		if (channel.userId === userId) return true;
		if (channel.moderatorUserIds.includes(userId)) return true;
		return this.roleService.isModerator({ id: userId });
	}

	@bindThis
	public async addMember(channelId: MiChannel['id'], userId: MiUser['id']): Promise<void> {
		if (await this.isMember(channelId, userId)) return;
		await this.channelMembersRepository.insert({
			id: this.idService.gen(),
			createdAt: new Date(),
			channelId,
			userId,
		});
		// 旗鯖fork: 追加直後の canView/joinByPassword フローで TRUE を即時反映する。
		this.isMemberCache.set(this.membershipKey(channelId, userId), true);
	}

	@bindThis
	public async removeMember(channelId: MiChannel['id'], userId: MiUser['id']): Promise<void> {
		await this.channelMembersRepository.delete({ channelId, userId });
		// 旗鯖fork: 退会後に古い TRUE キャッシュで権限が残らないよう即時 invalidate。
		this.isMemberCache.set(this.membershipKey(channelId, userId), false);
	}

	// 管理者による追加は即時参加ではなく招待として保存する。
	// 却下済みの相手を再び招待した場合は、新しい招待として作り直す。
	@bindThis
	public async inviteMember(channelId: MiChannel['id'], userId: MiUser['id'], invitedById: MiUser['id']): Promise<{ invitation: MiChannelInvitation; shouldNotify: boolean }> {
		const existing = await this.channelInvitationsRepository.findOneBy({ channelId, userId });
		if (existing != null) {
			if (existing.status === 'pending') return { invitation: existing, shouldNotify: false };
			// 古い却下通知が再び有効にならないよう、再招待では新しいIDを発行する。
			await this.channelInvitationsRepository.delete(existing.id);
		}

		const invitation = await this.channelInvitationsRepository.insertOne({
			id: this.idService.gen(),
			createdAt: new Date(),
			respondedAt: null,
			channelId,
			userId,
			invitedById,
			status: 'pending',
		});
		return { invitation, shouldNotify: true };
	}

	// 招待された本人だけが承認できる。承認時に初めて channel_member へ登録する。
	@bindThis
	public async acceptInvitation(invitationId: MiChannelInvitation['id'], userId: MiUser['id']): Promise<MiChannelInvitation | null> {
		const invitation = await this.channelInvitationsRepository.findOneBy({ id: invitationId, userId, status: 'pending' });
		if (invitation == null) return null;
		// 同じ招待の承認が同時に届いても、pending の招待を削除できた1要求だけが
		// メンバー追加へ進む。userId も条件に含め、他人の招待は獲得できない。
		const claimed = await this.channelInvitationsRepository.delete({ id: invitationId, userId, status: 'pending' });
		if (claimed.affected !== 1) return null;
		await this.addMember(invitation.channelId, userId);
		return invitation;
	}

	// 却下は履歴として残し、管理画面から「招待拒否」を確認できるようにする。
	@bindThis
	public async rejectInvitation(invitationId: MiChannelInvitation['id'], userId: MiUser['id']): Promise<MiChannelInvitation | null> {
		const invitation = await this.channelInvitationsRepository.findOneBy({ id: invitationId, userId, status: 'pending' });
		if (invitation == null) return null;
		const respondedAt = new Date();
		await this.channelInvitationsRepository.update(invitation.id, { status: 'rejected', respondedAt });
		return { ...invitation, status: 'rejected', respondedAt };
	}

	// あいことば(キーフレーズ)だけで該当するプライベートチャンネルを探す。見つからなければ null。
	@bindThis
	public async findPrivateChannelByPassword(password: string): Promise<MiChannel | null> {
		if (password == null || password.length === 0) return null;
		return this.channelsRepository.findOneBy({ isPrivate: true, password, isArchived: false });
	}

	// あいことばで入室(メンバー化)する。成功したら true。
	@bindThis
	public async joinByPassword(channel: MiChannel, userId: MiUser['id'], password: string): Promise<boolean> {
		if (!channel.isPrivate) return false;
		if (channel.password == null || channel.password.length === 0) return false;
		if (channel.password !== password) return false;
		await this.addMember(channel.id, userId);
		return true;
	}
}
