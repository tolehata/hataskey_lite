/* SPDX-License-Identifier: AGPL-3.0-only */
/** Break opportunities after punctuation, including closing quotes, without changing the copy. */
export function splitNotificationText(text: string): string[] {
	const parts: string[] = [];
	let start = 0;
	for (const match of text.matchAll(/[、。！？]+[」』）】〉》”’]*/gu)) {
		const end = match.index + match[0].length;
		parts.push(text.slice(start, end));
		start = end;
	}
	if (start < text.length) parts.push(text.slice(start));
	return parts;
}
