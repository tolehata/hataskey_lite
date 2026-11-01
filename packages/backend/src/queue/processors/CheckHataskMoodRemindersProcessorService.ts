/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import locales from '../../../../../locales/index.js';
import { DI } from '@/di-symbols.js';
import type { RegistryItemsRepository, UserProfilesRepository } from '@/models/_.js';
import { MiRegistryItem } from '@/models/RegistryItem.js';
import { IdService } from '@/core/IdService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { getDueHataskMoodReminder } from '@/misc/hatask-mood-reminder.js';
import { bindThis } from '@/decorators.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

const SCOPE = ['client', 'hatask'];
const MARKER_KEY = 'moodReminderNotifications';
const PAGE_SIZE = 100;

@Injectable()
export class CheckHataskMoodRemindersProcessorService {
	constructor(
		@Inject(DI.registryItemsRepository)
		private registryItemsRepository: RegistryItemsRepository,
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
		private idService: IdService,
		private notificationService: NotificationService,
		private queueLoggerService: QueueLoggerService,
	) { }

	@bindThis
	public async process(): Promise<void> {
		let cursor = '';
		let failures = 0;
		while (true) {
			const owners = await this.registryItemsRepository.createQueryBuilder('settings')
				.select('settings.userId', 'userId').distinct(true)
				.innerJoin('settings.user', 'owner')
				.where('settings.domain IS NULL')
				.andWhere('settings.scope = :scope', { scope: SCOPE })
				.andWhere('settings.key = :key', { key: 'settings' })
				.andWhere(`settings.value -> 'moodRemind' = 'true'::jsonb`)
				.andWhere('owner.host IS NULL AND owner.isDeleted = false AND owner.isSuspended = false')
				.andWhere('settings.userId > :cursor', { cursor })
				.orderBy('settings.userId', 'ASC').limit(PAGE_SIZE)
				.getRawMany<{ userId: string }>();
			if (owners.length === 0) break;
			for (const { userId } of owners) {
				try {
					await this.checkOwner(userId);
				} catch {
					failures++;
					// Never include journal contents, Registry values, or query parameters in logs.
					this.queueLoggerService.logger.error('Hatask mood reminder failed', { userId });
				}
			}
			cursor = owners[owners.length - 1].userId;
			if (owners.length < PAGE_SIZE) break;
		}
		if (failures > 0) throw new Error(`Hatask mood reminders failed for ${failures} users`);
	}

	private async checkOwner(userId: string): Promise<void> {
		await this.registryItemsRepository.manager.transaction(async manager => {
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['hatask-mood-reminder', userId]);
			const repository = manager.getRepository(MiRegistryItem);
			// Re-read the latest settings and owner status inside the lock. A stale scan
			// must not deliver after a saved disable, account deletion, or suspension.
			const settings = await repository.createQueryBuilder('settings')
				.innerJoin('settings.user', 'owner')
				.where('settings.userId = :userId', { userId })
				.andWhere('settings.domain IS NULL')
				.andWhere('settings.scope = :scope', { scope: SCOPE })
				.andWhere('settings.key = :key', { key: 'settings' })
				.andWhere('owner.host IS NULL AND owner.isDeleted = false AND owner.isSuspended = false')
				.orderBy('settings.updatedAt', 'DESC').addOrderBy('settings.id', 'DESC')
				.setLock('pessimistic_write', undefined, ['settings']).getOne();
			if (settings == null) return;
			const now = Date.now();
			const savedAt = settings.updatedAt?.getTime();
			// Outside a due slot, do not load the entire private journal every minute.
			if (getDueHataskMoodReminder(settings.value, [], [], now, savedAt) == null) return;
			const read = (key: string) => repository.createQueryBuilder('item')
				.where('item.userId = :userId', { userId })
				.andWhere('item.domain IS NULL')
				.andWhere('item.scope = :scope', { scope: SCOPE })
				.andWhere('item.key = :key', { key })
				.orderBy('item.updatedAt', 'DESC').addOrderBy('item.id', 'DESC')
				.setLock('pessimistic_write').getOne();
			const marker = await read(MARKER_KEY);
			const handledSlots: string[] = Array.isArray(marker?.value?.handledSlots)
				? marker.value.handledSlots.filter((slot: unknown): slot is string => typeof slot === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(slot)).slice(-64)
				: [];
			// The catch-up window stays open after delivery; skip the journal once the slot is handled.
			if (getDueHataskMoodReminder(settings.value, [], handledSlots, now, savedAt) == null) return;
			const moods = await read('moods');
			// A missing collection is an empty journal; malformed saved data is not.
			const due = getDueHataskMoodReminder(settings.value, moods == null ? [] : moods.value, handledSlots, now, savedAt);
			if (due == null) return;
			const profile = await this.userProfilesRepository.findOne({ where: { userId }, select: { lang: true } });
			const lang = profile?.lang ?? 'ja-JP';
			const locale = Object.hasOwn(locales, lang) ? locales[lang] : locales['ja-JP'];
			const copy = locale._hata._hatask._main;
			await this.notificationService.createNotificationAsync(userId, 'app', {
				appAccessTokenId: null,
				customHeader: copy.moodReminderTitle,
				customBody: copy.moodReminderBody,
				customIcon: null,
				customLink: '/hatask?tab=mood&notice=mood',
			}, undefined, `hatask-mood:${due.key}`);
			// Redis delivery is idempotent too: a failed DB commit after delivery can
			// be retried without appending a second notification to the timeline.
			// Explicit receive-mutes return null and count as handled for this slot.
			const value = { handledSlots: [...handledSlots, due.key].slice(-64) };
			if (marker) {
				await repository.update(marker.id, { value, updatedAt: new Date(now) });
			} else {
				await repository.insert({ id: this.idService.gen(), userId, domain: null, scope: SCOPE, key: MARKER_KEY, value, updatedAt: new Date(now) });
			}
		});
	}
}
