/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiMeta } from '@/models/_.js';
import { ApiError } from '@/server/api/error.js';

export const registrationApplicationsDisabledError = {
	message: 'Registration applications are disabled.',
	code: 'REGISTRATION_APPLICATIONS_DISABLED',
	id: 'cf912bfa-4293-4aac-9f84-ea152b2b8d17',
} as const;

export const registrationApplicationApprovalErrors = {
	noSuchApplication: {
		message: 'No such application.',
		code: 'NO_SUCH_APPLICATION',
		id: 'b0000001-0001-0001-0001-000000000001',
	},
	alreadyProcessed: {
		message: 'This application has already been processed.',
		code: 'ALREADY_PROCESSED',
		id: 'b0000001-0001-0001-0001-000000000002',
	},
	missingApplicantData: {
		message: 'Applicant data (username or email) is missing on the application.',
		code: 'MISSING_APPLICANT_DATA',
		id: 'b0000001-0001-0001-0001-000000000003',
	},
} as const;

/** Applications remain available only in application mode while registration is open. */
export function assertRegistrationApplicationsEnabled(meta: Pick<MiMeta, 'disableRegistration'> & Partial<Pick<MiMeta, 'registrationClosed'>>): void {
	if (meta.registrationClosed || meta.disableRegistration !== true) throw new ApiError(registrationApplicationsDisabledError);
}
