/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HataCardStyle = 'standard' | 'gold';

export const HATA_CARD_GOLD_UNLOCK_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export function isHataCardGoldUnlocked(createdAt: string | null | undefined, now = Date.now()): boolean {
	if (createdAt == null) return false;
	const createdAtMs = Date.parse(createdAt);
	return Number.isFinite(createdAtMs) && now - createdAtMs >= HATA_CARD_GOLD_UNLOCK_AGE_MS;
}

export function normalizeHataCardGlassOpacity(value: number): number {
	if (!Number.isFinite(value)) return 55;
	return Math.min(90, Math.max(20, Math.round(value / 5) * 5));
}

/**
 * MkAvatar の装飾はアバター直径の2倍の画像に対して、offsetを割合指定する。
 * Canvas出力でも同じ基準へ揃え、プレビューと保存画像の位置を一致させる。
 */
export function calculateHataCardDecorationOffset(avatarSize: number, offset: number | null | undefined): number {
	return avatarSize * 2 * (offset ?? 0);
}

export function calculateHataCardDeviceTilt(betaDelta: number, gammaDelta: number, screenAngle: number): { x: number; y: number } {
	const angle = ((screenAngle % 360) + 360) % 360;
	let vertical = betaDelta;
	let horizontal = gammaDelta;
	if (angle === 90) {
		vertical = -gammaDelta;
		horizontal = betaDelta;
	} else if (angle === 180) {
		vertical = -betaDelta;
		horizontal = -gammaDelta;
	} else if (angle === 270) {
		vertical = gammaDelta;
		horizontal = -betaDelta;
	}

	return {
		x: Math.max(-10, Math.min(10, -vertical / 3)),
		y: Math.max(-10, Math.min(10, horizontal / 3)),
	};
}

export function makeHataCardFileName(username: string, style: HataCardStyle): string {
	const safeUsername = username
		.normalize('NFKC')
		.replace(/[^\p{L}\p{N}._-]+/gu, '-')
		.replace(/^[.-]+|[.-]+$/g, '')
		.slice(0, 48) || 'member';
	return `hata-card-${style}-${safeUsername}.png`;
}
