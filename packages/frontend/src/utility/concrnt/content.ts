/* SPDX-License-Identifier: AGPL-3.0-only */
export type ConcrntContentPart = { type: 'text'; text: string } | { type: 'link' | 'image' | 'emoji'; text: string; url: string };

export function safeConcrntMediaUrl(value: string): string | null {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':') || /\.(?:local|localhost|internal)$/.test(url.hostname)) return null;
		return url.href;
	} catch { return null; }
}

/** CFM links/images only. Preserve other syntax as text; never feed remote CFM into MFM or HTML. */
export function concrntContentParts(body: string, emojis: Record<string, { imageURL?: string }> = {}): ConcrntContentPart[] {
	const parts: ConcrntContentPart[] = [];
	const pattern = /(!?)\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)|(https:\/\/[^\s<>]+)/g;
	let offset = 0;
	for (const match of body.matchAll(pattern)) {
		if (match.index > offset) parts.push({ type: 'text', text: body.slice(offset, match.index) });
		const url = safeConcrntMediaUrl(match[3] ?? match[4]);
		parts.push(url ? { type: match[1] === '!' ? 'image' : 'link', text: match[2] ?? match[4], url } : { type: 'text', text: match[0] });
		offset = match.index + match[0].length;
	}
	if (offset < body.length) parts.push({ type: 'text', text: body.slice(offset) });
	return parts.flatMap(part => {
		if (part.type !== 'text') return [part];
		const segments: ConcrntContentPart[] = [];
		let end = 0;
		for (const match of part.text.matchAll(/:([a-zA-Z0-9_]+):/g)) {
			const url = safeConcrntMediaUrl(emojis[match[1]]?.imageURL ?? '');
			if (!url) continue;
			if (match.index > end) segments.push({ type: 'text', text: part.text.slice(end, match.index) });
			segments.push({ type: 'emoji', text: match[0], url });
			end = match.index + match[0].length;
		}
		if (end < part.text.length) segments.push({ type: 'text', text: part.text.slice(end) });
		return segments;
	});
}

/** Never fall back to a CCID: identifiers are not display names. */
export function concrntDisplayName(name: string | undefined | null): string {
	return name?.trim() || '名前未設定のユーザー';
}

const QUOTE_LINK = /\n*https:\/\/concrnt\.world\/post\/([A-Za-z0-9%._~-]+)\s*$/;

/** The quote format written by publish(): an optional trailing concrnt.world post link. */
export function concrntQuoteOf(body: string): { body: string; uri?: string } {
	const match = body.match(QUOTE_LINK);
	if (!match) return { body };
	try {
		const uri = decodeURIComponent(match[1]);
		return /^(?:cckv|ccfs):\/\/[^/\s]+\/\S+$/.test(uri) ? { body: body.slice(0, match.index).trimEnd(), uri } : { body };
	} catch { return { body }; }
}

/** Separate CFM images from the text flow so they open in the in-app media viewer. */
export function concrntBodyLayout(body: string, emojis: Record<string, { imageURL?: string }> = {}): { parts: ConcrntContentPart[]; images: { url: string; alt: string }[] } {
	const images: { url: string; alt: string }[] = [];
	const parts = concrntContentParts(body, emojis).filter(part => {
		if (part.type !== 'image') return true;
		images.push({ url: part.url, alt: part.text });
		return false;
	});
	while (parts.length && parts.at(-1)!.type === 'text' && !(parts.at(-1) as { text: string }).text.trim()) parts.pop();
	const last = parts.at(-1);
	if (last?.type === 'text') parts[parts.length - 1] = { type: 'text', text: last.text.trimEnd() };
	return { parts, images };
}

/** Shortcodes are rendered only when they match the CFM emoji grammar. */
export function concrntShortcode(value: string): string {
	return value.replace(/^:|:$/g, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 100) || 'emoji';
}

export const concrntNotificationLabels = {
	reaction: 'リアクションしました', like: 'いいねしました', reply: '返信しました', reroute: 'リルートしました',
	mention: 'あなたにメンションしました', follow: 'フォローしました', other: '通知が届きました',
};
