/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import type { UserProfilesRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { LoggerService } from '@/core/LoggerService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { RegistrationApplicationReviewService } from '@/core/RegistrationApplicationReviewService.js';
import locales from '../../../../locales/index.js';

@Injectable()
export class RegistrationApplicationNotificationService {
	private logger: Logger;

	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private registrationApplicationReviewService: RegistrationApplicationReviewService,
		private notificationService: NotificationService,
		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('registration-application-notification');
	}

	/** A saved application only triggers a generic notice; applicant data never enters this service. */
	@bindThis
	public async notifyNewApplication(): Promise<void> {
		try {
			const staff = await this.registrationApplicationReviewService.getCurrentStaff();
			for (const id of new Set(staff.map(member => member.userId))) {
				await this.notifyRecipient(id);
			}
		} catch {
			this.logger.warn('Failed to resolve registration application notification recipients.');
		}
	}

	@bindThis
	private async notifyRecipient(id: string): Promise<void> {
		try {
			if (await this.registrationApplicationReviewService.getCurrentStaffMember(id) == null) return;

			const profile = await this.userProfilesRepository.findOne({ where: { userId: id }, select: { lang: true } });
			const lang = profile?.lang ?? 'ja-JP';
			const copy = (Object.hasOwn(locales, lang) ? locales[lang] : locales['ja-JP'])._hata._registrationApplications;

			// Recheck after loading the language: assignments or conditional eligibility may have changed.
			const member = await this.registrationApplicationReviewService.getCurrentStaffMember(id);
			if (member == null) return;
			await this.notificationService.createNotificationAsync(id, 'app', {
				appAccessTokenId: null,
				customHeader: copy.notificationTitle,
				customBody: member.isRoot ? copy.notificationBody : copy.notificationVoteBody,
				customIcon: null,
				customLink: '/admin/registration-applications',
			});
		} catch {
			// Never expose raw errors or make an already saved application appear unsuccessful.
			this.logger.warn('Failed to deliver a registration application notification.');
		}
	}
}
