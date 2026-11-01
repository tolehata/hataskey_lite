/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Raw } from 'typeorm';
import { redactRegisteredEmail, redactRegistrationReviewText } from '@/misc/registration-review-privacy.js';
import { ApiError } from '@/server/api/error.js';
import { RegistrationApplicationReviewService } from '@/core/RegistrationApplicationReviewService.js';
import { rejectionNotificationSchema, rejectionNotificationRetryAvailable } from '@/core/RegistrationRejectionNotificationService.js';
import { registrationReviewErrors, registrationReviewSchema } from '@/core/registration-review-policy.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { MiMeta, RegistrationApplicationsRepository } from '@/models/_.js';
import { assertRegistrationApplicationsEnabled, registrationApplicationsDisabledError } from '@/core/registration-application-policy.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	secure: true,
	kind: 'read:admin:registration-applications',
	errors: { ...registrationReviewErrors, registrationApplicationsDisabled: registrationApplicationsDisabledError },

	res: {
		type: 'array',
		items: {
			type: 'object',
			properties: {
				id: { type: 'string' },
				// 旗鯖fork: reject 後は null になる
				username: { type: 'string', nullable: true },
				reason: { type: 'string' },
				// 旗鯖fork: 却下済み申請は申請日から90日経過後の定期削除まで保持
				email: { type: 'string', nullable: true, optional: true },
				review: registrationReviewSchema,
				additionalContacts: { type: 'string', nullable: true },
				status: { type: 'string' },
				notificationStatus: rejectionNotificationSchema,
				notificationRetryAvailable: { type: 'boolean' },
				createdAt: { type: 'string' },
				// 旗鯖fork: 個人情報削除済みフラグと削除日時
				personalDataDeletedAt: { type: 'string', nullable: true },
				rejectedAt: { type: 'string', nullable: true },
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		status: { type: 'string', enum: ['pending', 'approved', 'rejected'], default: 'pending' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
		offset: { type: 'integer', minimum: 0, default: 0 },
		needsReview: { type: 'boolean', default: false },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.meta)
		private serverMeta: MiMeta,

		@Inject(DI.registrationApplicationsRepository)
		private registrationApplicationsRepository: RegistrationApplicationsRepository,
		private registrationReviewService: RegistrationApplicationReviewService,
	) {
		super(meta, paramDef, async (ps, me) => {
			assertRegistrationApplicationsEnabled(this.serverMeta);
			const viewer = await this.registrationReviewService.assertStaff(me.id);
			const applications = await this.registrationApplicationsRepository.find({
				select: {
					id: true, username: true, reason: true, email: true, status: true,
					reviewVotes: true, reviewVersion: true, reviewDecision: true,
					createdAt: true, personalDataDeletedAt: true, rejectedAt: true,
					rejectionNotificationStatus: true, rejectionNotificationAttemptedAt: true,
					additionalContacts: ps.status === 'pending',
				},
				where: { status: ps.status, ...(ps.needsReview && !viewer.isRoot ? {
					reviewVotes: Raw(alias => `(${alias} -> :reviewerId ->> 'eligibilityKey') IS DISTINCT FROM :eligibilityKey`, { reviewerId: viewer.userId, eligibilityKey: viewer.eligibilityKey }),
				} : {}) },
				order: { createdAt: 'DESC' },
				take: ps.limit,
				skip: ps.offset,
			});

			assertRegistrationApplicationsEnabled(this.serverMeta);
			const staff = await this.registrationReviewService.getCurrentStaff();
			assertRegistrationApplicationsEnabled(this.serverMeta);
			const currentViewer = staff.find(x => x.userId === me.id);
			if (!currentViewer || currentViewer.isRoot !== viewer.isRoot || currentViewer.eligibilityKey !== viewer.eligibilityKey) throw new ApiError(registrationReviewErrors.forbidden);
			return applications.map(app => {
				const redact = (value: string | null) => viewer.isRoot ? value : redactRegistrationReviewText(value, app.email);
				// 担当者名は公開プロフィールの表示名。「名前@ひとこと」をメール扱いしないよう、申請者のメールだけを隠す。
				const redactName = (value: string | null) => viewer.isRoot ? value : redactRegisteredEmail(value, app.email);
				const review = this.registrationReviewService.packReview(app, staff, currentViewer);
				if (!viewer.isRoot) {
					review.voters = review.voters.map(voter => ({ ...voter, name: redactName(voter.name), reason: redact(voter.reason) }));
					if (review.decidedBy) review.decidedBy = { ...review.decidedBy, name: redactName(review.decidedBy.name) };
				}
				return {
					id: app.id,
					username: app.username,
					reason: redact(app.reason) ?? '',
					...(viewer.isRoot ? { email: app.email } : {}),
					review,
					additionalContacts: ps.status === 'pending' && app.status === 'pending' ? redact(app.additionalContacts ?? null) : null,
					status: app.status,
					notificationStatus: viewer.isRoot ? app.rejectionNotificationStatus ?? null : null,
					notificationRetryAvailable: viewer.isRoot && rejectionNotificationRetryAvailable(app),
					createdAt: app.createdAt.toISOString(),
					personalDataDeletedAt: app.personalDataDeletedAt ? app.personalDataDeletedAt.toISOString() : null,
					rejectedAt: app.rejectedAt ? app.rejectedAt.toISOString() : null,
				};
			});
		});
	}
}
