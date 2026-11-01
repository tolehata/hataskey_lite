/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash } from 'node:crypto';
import { ApiError } from '@/server/api/error.js';
import type { MiRegistrationApplication, RegistrationReviewVote } from '@/models/RegistrationApplication.js';

export type ReviewStaff = {
	userId: string;
	name: string | null;
	username: string;
	isRoot: boolean;
	isAdministrator: boolean;
	eligibilityKey: string;
};

export const registrationReviewErrors = {
	forbidden: { message: 'Registration review access denied.', code: 'REGISTRATION_REVIEW_FORBIDDEN', id: 'd2a7980f-fab0-4b41-b4e8-5d93cf44ee01' },
	changed: { message: 'Registration review state has changed.', code: 'REGISTRATION_REVIEW_CHANGED', id: 'd2a7980f-fab0-4b41-b4e8-5d93cf44ee02' },
	reasonRequired: { message: 'A reason is required when opposing registration.', code: 'REGISTRATION_REVIEW_REASON_REQUIRED', id: 'd2a7980f-fab0-4b41-b4e8-5d93cf44ee03' },
	notUnanimous: { message: 'All current moderators must agree.', code: 'REGISTRATION_REVIEW_NOT_UNANIMOUS', id: 'd2a7980f-fab0-4b41-b4e8-5d93cf44ee04' },
} as const;

export function registrationReviewRevision(application: Pick<MiRegistrationApplication, 'id' | 'reviewVersion' | 'status'>, staff: ReviewStaff[]): string {
	return createHash('sha256').update(JSON.stringify([
		application.id, application.reviewVersion, application.status,
		staff.map(x => [x.userId, x.isRoot, x.eligibilityKey]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
	])).digest('hex');
}

export function currentRegistrationVote(votes: Record<string, RegistrationReviewVote>, member: ReviewStaff): RegistrationReviewVote | null {
	const vote = Object.hasOwn(votes, member.userId) ? votes[member.userId] : null;
	return vote?.eligibilityKey === member.eligibilityKey && ['agree', 'oppose'].includes(vote.choice) ? vote : null;
}

export function normalizeRegistrationVoteReason(choice: 'agree' | 'oppose', value: string): string {
	const reason = value.trim();
	if (choice === 'oppose' && !reason.replace(/[\s\p{C}\p{M}\p{Default_Ignorable_Code_Point}\u2800]/gu, '')) throw new ApiError(registrationReviewErrors.reasonRequired);
	return reason;
}

export const registrationReviewActorSchema = {
	type: 'object', properties: {
		userId: { type: 'string' }, name: { type: 'string', nullable: true }, username: { type: 'string', nullable: true },
	},
} as const;

export const registrationReviewSchema = {
	type: 'object', properties: {
		revision: { type: 'string' },
		voters: { type: 'array', items: { type: 'object', properties: {
			...registrationReviewActorSchema.properties,
			isCurrent: { type: 'boolean' }, choice: { type: 'string', enum: ['agree', 'oppose'], nullable: true },
			reason: { type: 'string', nullable: true }, votedAt: { type: 'string', nullable: true },
		} } },
		requiredCount: { type: 'integer' }, agreeCount: { type: 'integer' }, opposeCount: { type: 'integer' }, waitingCount: { type: 'integer' },
		myChoice: { type: 'string', enum: ['agree', 'oppose'], nullable: true },
		canVote: { type: 'boolean' }, canFinalize: { type: 'boolean' }, isRoot: { type: 'boolean' },
		decidedBy: { ...registrationReviewActorSchema, nullable: true }, decidedAt: { type: 'string', nullable: true },
	},
} as const;
