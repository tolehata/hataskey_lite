/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import sanitizeHtml from 'sanitize-html';

// The server description is written by an administrator but shown to every
// visitor, so only simple inline and text formatting survives. Scripts, event
// handlers, styles, classes, images, frames and forms are always removed.
const options: sanitizeHtml.IOptions = {
	allowedTags: ['a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'small', 'code', 'br', 'p', 'span', 'ul', 'ol', 'li', 'blockquote'],
	allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
	allowedSchemes: ['http', 'https', 'mailto'],
	allowedSchemesAppliedToAttributes: ['href'],
	allowProtocolRelative: false,
	disallowedTagsMode: 'discard',
	transformTags: {
		// Always open outside the entrance and never pass the opener or referrer.
		a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }),
	},
};

/** Returns safe HTML for the description, or an empty string when nothing visible remains. */
export function sanitizeServerDescription(value: unknown): string {
	if (typeof value !== 'string') return '';
	const html = sanitizeHtml(value, options).trim();
	const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
	return text ? html : '';
}
