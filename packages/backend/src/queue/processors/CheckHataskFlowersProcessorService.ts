/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { HataskFlowerV2Service } from '@/core/HataskFlowerV2Service.js';
import { AvatarDecorationService } from '@/core/AvatarDecorationService.js';
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { RegistryItemsRepository } from '@/models/_.js';
import { MiRegistryItem } from '@/models/RegistryItem.js';
import { IdService } from '@/core/IdService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { getReadyHataskFlower } from '@/misc/hatask-flower-ready.js';
import { bindThis } from '@/decorators.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

const FLOWER_SCOPE = ['client', 'hatask'];
// Separate from the growing flower: older clients replace that value when they sync growth.
const NOTIFIED_SCOPE = FLOWER_SCOPE;
const NOTIFIED_KEY = 'flowerReadyNotification';
const PAGE_SIZE = 100;

@Injectable()
export class CheckHataskFlowersProcessorService {
	constructor(
		private flowerV2Service: HataskFlowerV2Service,
		@Inject(DI.registryItemsRepository)
		private registryItemsRepository: RegistryItemsRepository,
		private idService: IdService,
		private notificationService: NotificationService,
		private queueLoggerService: QueueLoggerService,
		private avatarDecorationService: AvatarDecorationService,
	) { }

	@bindThis
	public async process(): Promise<void> {
		await this.avatarDecorationService.removeUnavailableDecorations();
		const decorationFailures: unknown[] = [];
		try {
			await this.avatarDecorationService.notifyUnlockedDecorations();
		} catch (error) {
			decorationFailures.push(error);
			this.queueLoggerService.logger.error('Hatask decoration notification failed', { error });
		}
		await this.flowerV2Service.checkNotifications();
		let cursor = '';
		let failures = 0;
		while (true) {
			const owners = await this.registryItemsRepository.createQueryBuilder('flower')
				.select('flower.userId', 'userId')
				.distinct(true)
				.innerJoin('flower.user', 'owner')
				.where('flower.domain IS NULL')
				.andWhere('flower.scope = :scope', { scope: FLOWER_SCOPE })
				.andWhere('flower.key = :key', { key: 'flower' })
				.andWhere('owner.host IS NULL AND owner.isDeleted = false AND owner.isSuspended = false')
				.andWhere('flower.userId > :cursor', { cursor })
				.andWhere('NOT EXISTS (SELECT 1 FROM hatask_drop_wallet w WHERE w."userId" = flower."userId" AND w.flower IS NOT NULL)')
				// Skip already delivered flowers without loading every user's marker separately.
				.andWhere(`NOT EXISTS (
					SELECT 1 FROM registry_item notified
					WHERE notified."userId" = flower."userId" AND notified.domain IS NULL
					AND notified.scope = :notifiedScope AND notified.key = :notifiedKey
					AND notified.value ->> 'startedAt' = flower.value ->> 'startedAt'
				)`, { notifiedScope: NOTIFIED_SCOPE, notifiedKey: NOTIFIED_KEY })
				.orderBy('flower.userId', 'ASC')
				.limit(PAGE_SIZE)
				.getRawMany<{ userId: string }>();
			if (owners.length === 0) break;
			for (const { userId } of owners) {
				try {
					await this.checkOwner(userId);
				} catch (error) {
					failures++;
					this.queueLoggerService.logger.error('Hatask flower notification failed', { userId, error });
				}
			}
			cursor = owners[owners.length - 1].userId;
			if (owners.length < PAGE_SIZE) break;
		}
		if (failures > 0) throw new Error(`Hatask flower notifications failed for ${failures} users`);
		if (decorationFailures.length > 0) throw new AggregateError(decorationFailures, 'Hatask decoration notifications failed');
	}

	private async checkOwner(userId: string): Promise<void> {
		await this.registryItemsRepository.manager.transaction(async manager => {
			// Serialize workers per owner, including first-time marker creation.
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['hatask-flower-ready', userId]);
			const repository = manager.getRepository(MiRegistryItem);
			const flower = await repository.createQueryBuilder('flower')
				.where('flower.userId = :userId', { userId })
				.andWhere('flower.domain IS NULL')
				.andWhere('flower.scope = :scope', { scope: FLOWER_SCOPE })
				.andWhere('flower.key = :key', { key: 'flower' })
				.orderBy('flower.updatedAt', 'DESC').addOrderBy('flower.id', 'DESC')
				// A harvest/growth update must not replace the flower during delivery.
				.setLock('pessimistic_write')
				.getOne();
			const ready = getReadyHataskFlower(flower?.value, Date.now());
			if (ready == null) return;
			const marker = await repository.createQueryBuilder('notified')
				.where('notified.userId = :userId', { userId })
				.andWhere('notified.domain IS NULL')
				.andWhere('notified.scope = :scope', { scope: NOTIFIED_SCOPE })
				.andWhere('notified.key = :key', { key: NOTIFIED_KEY })
				.orderBy('notified.updatedAt', 'DESC').addOrderBy('notified.id', 'DESC')
				.getOne();
			if (marker?.value?.startedAt === ready.startedAt) return;

			// Receive settings, unread status, streaming and Web Push all use the standard path.
			// A muted notification returns null and is considered handled; failures are retried next tick.
			await this.notificationService.createNotificationAsync(userId, 'hataskFlowerReady', {
				customHeader: 'Hataskのお花',
				customBody: 'お花が満開になりました。Hataskの「おはな」で収穫できます。',
				customIcon: null,
				customLink: '/hatask?tab=garden',
			});
			if (marker) {
				await repository.update(marker.id, { value: ready as MiRegistryItem['value'], updatedAt: new Date() });
			} else {
				await repository.insert({
					id: this.idService.gen(), userId, domain: null, scope: NOTIFIED_SCOPE,
					key: NOTIFIED_KEY, value: ready as MiRegistryItem['value'], updatedAt: new Date(),
				});
			}
		});
	}
}
