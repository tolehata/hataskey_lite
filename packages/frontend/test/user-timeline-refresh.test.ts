/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, assert, describe, test, vi } from 'vitest';
import { fireEvent, render, cleanup } from '@testing-library/vue';
import { defineComponent, ref } from 'vue';
import './init';
import XTimeline from '@/pages/user/index.timeline.vue';
import { Paginator } from '@/utility/paginator.js';
import { components } from '@/components/index.js';
import { directives } from '@/directives/index.js';
import type * as Misskey from 'cherrypick-js';

vi.mock('@/components/MkNotesTimeline.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/components/MkPagination.vue', () => ({ default: { template: '<div />' } }));

describe('user timeline refresh', () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	test('reloads the visible reactions tab', async () => {
		const reload = vi.spyOn(Paginator.prototype, 'reload').mockResolvedValue();
		const user = { id: 'user-1', publicReactions: true } as Misskey.entities.UserDetailed;
		const Harness = defineComponent({
			components: { XTimeline },
			setup() {
				const timeline = ref<InstanceType<typeof XTimeline> | null>(null);
				return { timeline, user, reloadTimeline: () => timeline.value?.reload() };
			},
			template: '<XTimeline ref="timeline" :user="user"/><button @click="reloadTimeline">Refresh test</button>',
		});
		const view = render(Harness, { global: { components, directives } });
		await fireEvent.click(view.getByRole('button', { name: 'Reactions' }));
		await fireEvent.click(view.getByRole('button', { name: 'Refresh test' }));
		assert.strictEqual(reload.mock.calls.length, 1);
		assert.strictEqual((reload.mock.contexts[0] as unknown as { endpoint: string }).endpoint, 'users/reactions');
	});
});
