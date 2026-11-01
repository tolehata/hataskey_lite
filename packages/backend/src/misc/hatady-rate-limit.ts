/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Hatady API の利用者1人あたりの基準レート制限。
 *
 * 実際の上限は ApiCallService がロールの rateLimitFactor を適用して決める。
 * たとえば max: 120 の制限は、factor 0.5 のロールでは 240 回、
 * factor 2 のロールでは 60 回になる。
 */
export const HATADY_RATE_LIMITS = {
	read: {
		duration: 60 * 1000,
		max: 120,
	},
	heavyRead: {
		duration: 60 * 1000,
		max: 60,
	},
	write: {
		duration: 60 * 1000,
		max: 60,
	},
	destructive: {
		duration: 60 * 1000,
		max: 30,
	},
	adminDestructive: {
		duration: 60 * 60 * 1000,
		max: 30,
	},
} as const;
