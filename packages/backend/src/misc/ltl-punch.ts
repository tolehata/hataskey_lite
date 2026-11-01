/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type LtlPunchState = {
	id: string; revision: number; startedAt: number; fallAt: number; endsAt: number;
	finishedAt: number | null; status: 'active' | 'won' | 'escaped';
	hp: number; maxHp: number; people: number; serverNow: number;
};

export function hasLtlPunchTrigger(text: string | null): boolean {
	return /(🤛{3,}|👊{3,}|🤜{3,})/u.test((text ?? '').replace(/[\uFE0E\uFE0F]/gu, '').replace(/[\u{1F3FB}-\u{1F3FF}]/gu, ''));
}

export function validLtlPunchId(value: unknown): value is string {
	return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}
