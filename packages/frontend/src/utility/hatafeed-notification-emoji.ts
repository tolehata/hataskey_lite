/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HataFeedNotificationSegment =
	| { type: 'text'; text: string }
	| { type: 'emoji'; name: string; host: string | null; url?: string };

/** HataFeed通知本文を、HTMLを解釈せずテキストと絵文字ショートコードだけに分ける。 */
export function splitHataFeedNotificationBody(text: string): HataFeedNotificationSegment[] {
	const result: HataFeedNotificationSegment[] = [];
	const pattern = /:([A-Za-z0-9_+-]+)(?:@([A-Za-z0-9.-]+|\.))?:/gu;
	let cursor = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text)) !== null) {
		if (match.index > cursor) result.push({ type: 'text', text: text.slice(cursor, match.index) });
		const name = match[1];
		const matchedHost = match[2];
		const host = matchedHost && matchedHost !== '.' ? matchedHost : null;
		result.push({
			type: 'emoji',
			name,
			host,
			url: host == null ? `/emoji/${encodeURIComponent(name)}.webp` : undefined,
		});
		cursor = match.index + match[0].length;
	}
	if (cursor < text.length) result.push({ type: 'text', text: text.slice(cursor) });
	return result;
}
