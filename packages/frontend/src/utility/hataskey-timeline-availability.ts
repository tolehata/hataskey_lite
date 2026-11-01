/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { $i } from '@/i.js';
import { instance } from '@/instance.js';

/** Hataskey UI keeps its own tab preferences; only server/role policies override them. */
export function isHataskeyTimelineAllowed(type: string): boolean {
	const policies = $i?.policies ?? instance.policies;
	switch (type) {
		case 'local':
		case 'social':
		case 'media':
			return policies.ltlAvailable;
		case 'mixed': // Hataskey UI's global timeline tab.
		case 'global':
			return policies.gtlAvailable;
		case 'bubble':
			return policies.btlAvailable;
		default:
			return true;
	}
}
