/* SPDX-License-Identifier: AGPL-3.0-only */

export interface ConcrntServerInfo {
	domain: string;
	name: string;
	iconUrl?: string;
}

function publicIcon(value: unknown): string | undefined {
	if (typeof value !== 'string' || value.length > 4096) return undefined;
	try {
		const url = new URL(value);
		const host = url.hostname.toLowerCase();
		if (url.protocol !== 'https:' || url.username || url.password || !host.includes('.') || host.endsWith('.') || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal') || /^[\d.]+$/.test(host) || host.includes(':')) return undefined;
		return url.href;
	} catch {
		return undefined;
	}
}

/** Display-only fields from core a52686b and world-app dcec14d7 ServerChip. */
export function normalizeConcrntServerInfo(domain: string, meta: unknown): ConcrntServerInfo {
	const value = meta !== null && typeof meta === 'object' && !Array.isArray(meta) ? meta as Record<string, unknown> : {};
	const nickname = typeof value.nickname === 'string' ? value.nickname.trim() : '';
	const name = nickname && nickname.length <= 200 && !/\p{Cc}/u.test(nickname) ? nickname : domain;
	const iconUrl = publicIcon(value.logo);
	return { domain, name, ...(iconUrl ? { iconUrl } : {}) };
}
