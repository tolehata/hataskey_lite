/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { type SharedOptions, http, HttpResponse } from 'msw';
import { HttpNetworkFrame } from 'msw/experimental';

export const onUnhandledFrame = (({ frame, defaults }) => {
	if (frame instanceof HttpNetworkFrame) {
		const url = new URL(frame.data.request.url);
		if (url.hostname !== 'localhost' || /^\/(?:client-assets\/|fluent-emoji\/|iframe.html$|node_modules\/|src\/|sb-|static-assets\/|vite\/)/.test(url.pathname)) {
			return;
		}
	}
	defaults.warn();
}) satisfies SharedOptions['onUnhandledFrame'];

export const commonHandlers = [
	http.get('/fluent-emoji/:codepoints.png', async ({ params }) => {
		const { codepoints } = params;
		const value = await fetch(`https://raw.githubusercontent.com/misskey-dev/emojis/main/dist/${codepoints}.png`).then((response) => response.blob());
		return new HttpResponse(value, {
			headers: {
				'Content-Type': 'image/png',
			},
		});
	}),
	http.get('/fluent-emojis/:codepoints.png', async ({ params }) => {
		const { codepoints } = params;
		const value = await fetch(`https://raw.githubusercontent.com/misskey-dev/emojis/main/dist/${codepoints}.png`).then((response) => response.blob());
		return new HttpResponse(value, {
			headers: {
				'Content-Type': 'image/png',
			},
		});
	}),
	http.get('/twemoji/:codepoints.svg', async ({ params }) => {
		const { codepoints } = params;
		const value = await fetch(`https://unpkg.com/@discordapp/twemoji@16.0.1/dist/svg/${codepoints}.svg`).then((response) => response.blob());
		return new HttpResponse(value, {
			headers: {
				'Content-Type': 'image/svg+xml',
			},
		});
	}),
];
