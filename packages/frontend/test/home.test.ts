/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, assert, describe, test, vi } from 'vitest';
import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/vue';
import './init';
import * as Misskey from 'cherrypick-js';
import { directives } from '@/directives/index.js';
import { components } from '@/components/index.js';
import XHome from '@/pages/user/home.vue';
import 'intersection-observer';

describe('XHome', () => {
	const renderHome = (user: Partial<Misskey.entities.UserDetailed>): RenderResult => {
		return render(XHome, {
			props: { user: user as Misskey.entities.UserDetailed, disableNotes: true },
			global: { directives, components },
		});
	};

	afterEach(() => {
		cleanup();
	});

	test('Should render the remote caution when user.host exists', async () => {
		const home = renderHome({
			id: 'blobcat',
			name: 'blobcat',
			host: 'example.com',
			uri: 'https://example.com/@user',
			url: 'https://example.com/@user/profile',
			roles: [],
			createdAt: '1970-01-01T00:00:00.000Z',
			fields: [],
			pinnedNotes: [],
			avatarUrl: 'https://example.com',
			avatarDecorations: [],
		});

		const anchor = home.container.querySelector<HTMLAnchorElement>('a[href^="https://example.com/"]');
		assert.exists(anchor, 'anchor to the remote exists');
		assert.strictEqual(anchor?.href, 'https://example.com/@user/profile');
	});

	test('The remote caution should fall back to uri if url is null', async () => {
		const home = renderHome({
			id: 'blobcat',
			name: 'blobcat',
			host: 'example.com',
			uri: 'https://example.com/@user',
			url: null,
			roles: [],
			createdAt: '1970-01-01T00:00:00.000Z',
			fields: [],
			pinnedNotes: [],
			avatarUrl: 'https://example.com',
			avatarDecorations: [],
		});

		const anchor = home.container.querySelector<HTMLAnchorElement>('a[href^="https://example.com/"]');
		assert.exists(anchor, 'anchor to the remote exists');
		assert.strictEqual(anchor?.href, 'https://example.com/@user');
	});

	test('refresh updates the profile while preserving a memo being edited', async () => {
		const user = {
			id: 'memo-user', username: 'memo-user', host: null, name: 'Before', memo: 'saved memo',
			roles: [], createdAt: '1970-01-01T00:00:00.000Z', fields: [], pinnedNotes: [],
			avatarUrl: 'https://example.com/avatar.png', avatarDecorations: [],
		} as unknown as Misskey.entities.UserDetailed;
		const home = renderHome(user);
		const memo = home.container.querySelector<HTMLTextAreaElement>('.memo textarea');
		assert.exists(memo);
		await fireEvent.focus(memo);
		await fireEvent.update(memo, 'unsaved memo');

		await home.rerender({ user: { ...user, name: 'After', memo: 'new server memo' }, disableNotes: true });
		assert.strictEqual(memo.value, 'unsaved memo');
		assert.include(home.container.textContent, 'After');

		vi.mocked(window.fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
		await fireEvent.blur(memo);
		await new Promise(resolve => setTimeout(resolve, 0));
		await home.rerender({ user: { ...user, name: 'After save', memo: 'saved on server' }, disableNotes: true });
		assert.strictEqual(memo.value, 'saved on server');
	});
});
