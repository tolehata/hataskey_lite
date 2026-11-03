/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 * 旗鯖fork: チャンネルの管理権限の判定。
 *   - 管理可否(canManage): 作成者・副管理者・インスタンスのモデレーター。
 */

import { Injectable } from '@nestjs/common';
import type { MiChannel } from '@/models/Channel.js';
import type { MiUser } from '@/models/User.js';
import { RoleService } from '@/core/RoleService.js';
import { bindThis } from '@/decorators.js';

@Injectable()
export class ChannelService {
	constructor(
		private roleService: RoleService,
	) {
	}

	// チャンネル(設定)を管理できるか。作成者・副管理者・インスタンスのモデレーター。
	@bindThis
	public async canManage(channel: MiChannel, userId: MiUser['id'] | null): Promise<boolean> {
		if (userId == null) return false;
		if (channel.userId === userId) return true;
		if (channel.moderatorUserIds.includes(userId)) return true;
		return this.roleService.isModerator({ id: userId });
	}
}
