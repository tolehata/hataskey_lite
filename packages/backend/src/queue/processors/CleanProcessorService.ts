/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In, LessThan } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { AntennasRepository, HatadyNotificationsRepository, RegistrationApplicationsRepository, RoleAssignmentsRepository, UserIpsRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import type { Config } from '@/config.js';
import { ReversiService } from '@/core/ReversiService.js';
import { HataigoChatService } from '@/core/HataigoChatService.js';
import { HataigoService } from '@/core/HataigoService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class CleanProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.userIpsRepository)
		private userIpsRepository: UserIpsRepository,

		@Inject(DI.antennasRepository)
		private antennasRepository: AntennasRepository,

		@Inject(DI.registrationApplicationsRepository)
		private registrationApplicationsRepository: RegistrationApplicationsRepository,

		@Inject(DI.roleAssignmentsRepository)
		private roleAssignmentsRepository: RoleAssignmentsRepository,

		@Inject(DI.hatadyNotificationsRepository)
		private hatadyNotificationsRepository: HatadyNotificationsRepository,

		private queueLoggerService: QueueLoggerService,
		private reversiService: ReversiService,
		private hataigoService: HataigoService,
		private hataigoChatService: HataigoChatService,
		private idService: IdService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('clean');
	}

	@bindThis
	public async process(): Promise<void> {
		this.logger.info('Cleaning...');

		this.userIpsRepository.delete({
			createdAt: LessThan(new Date(Date.now() - (1000 * 60 * 60 * 24 * 90))),
		});

		// 使われてないアンテナを停止
		if (this.config.deactivateAntennaThreshold > 0) {
			this.antennasRepository.update({
				lastUsedAt: LessThan(new Date(Date.now() - this.config.deactivateAntennaThreshold)),
			}, {
				isActive: false,
			});
		}

		const expiredRoleAssignments = await this.roleAssignmentsRepository.createQueryBuilder('assign')
			.where('assign.expiresAt IS NOT NULL')
			.andWhere('assign.expiresAt < :now', { now: new Date() })
			.getMany();

		if (expiredRoleAssignments.length > 0) {
			await this.roleAssignmentsRepository.delete({
				id: In(expiredRoleAssignments.map(x => x.id)),
			});
		}

		this.reversiService.cleanOutdatedGames();
		await this.hataigoService.sweepTimeouts();
		await this.hataigoChatService.cleanExpired();

		// 古い登録申請のクリーンアップ
		// pending: 30日経過で削除
		this.registrationApplicationsRepository.delete({
			status: 'pending',
			createdAt: LessThan(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)),
		});

		// Hatady 独自通知は表示用途のみ。90日を過ぎた既読・未読を定期掃除して単調増加を防ぐ。
		await this.hatadyNotificationsRepository.delete({
			createdAt: LessThan(new Date(Date.now() - 1000 * 60 * 60 * 24 * 90)),
		});
		// rejected: 90日経過で削除
		this.registrationApplicationsRepository.delete({
			status: 'rejected',
			createdAt: LessThan(new Date(Date.now() - 1000 * 60 * 60 * 24 * 90)),
		});

		this.logger.succ('Cleaned.');
	}
}
