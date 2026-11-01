/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/* eslint-disable vue/one-component-per-file -- Test-only component stubs. */

import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { expect, test, vi } from 'vitest';

vi.mock('./MkTooltip.vue', async () => {
	const { h: vueH, defineComponent: vueDefineComponent } = await import('vue');
	return { default: vueDefineComponent({ render() { return vueH('div', this.$slots.default?.()); } }) };
});
vi.mock('@/components/MkReactionIcon.vue', () => ({ default: { render: () => null } }));
vi.mock('@@/js/emojilist.js', () => ({ getEmojiName: () => 'emoji' }));

import Details from './MkReactionsViewer.details.vue';
import type * as Misskey from 'cherrypick-js';
import type { PropType } from 'vue';

function user(id: string): Misskey.entities.UserLite {
	return {
		id,
		name: null,
		username: id,
		host: null,
		avatarUrl: '',
		avatarBlurhash: null,
		avatarDecorations: [],
		isLocked: false,
		emojis: {},
		onlineStatus: 'unknown',
	};
}

test('remaining count uses the users actually shown and stays current as count changes', async () => {
	const allUsers = Array.from({ length: 12 }, (_, i) => user(`u${i}`));
	const props = ref({ users: allUsers, count: 13 });
	const container = window.document.createElement('div');
	const anchorElement = window.document.createElement('button');
	window.document.body.append(container);
	const app = createApp({ render: () => h(Details, { ...props.value, showing: true, reaction: ':test:', anchorElement }) });
	app.component('MkAvatar', { render: () => null });
	app.component('MkUserName', defineComponent({
		props: { user: { type: Object as PropType<Misskey.entities.UserLite>, required: true } },
		setup: userProps => () => h('span', { class: 'test-user' }, userProps.user.id),
	}));
	app.mount(container);
	const names = () => [...container.querySelectorAll('.test-user')].map(element => element.textContent);
	try {
		expect(names()).toHaveLength(10);
		expect(container.textContent).toContain('+3');
		props.value = { users: allUsers, count: 7 };
		await nextTick();
		expect(names()).toHaveLength(7);
		expect(container.textContent).not.toContain('+');
		props.value = { users: allUsers.slice(0, 3), count: 7 };
		await nextTick();
		expect(names()).toHaveLength(3);
		expect(container.textContent).toContain('+4');
		props.value = { users: allUsers.slice(0, 3), count: 1 };
		await nextTick();
		expect(names()).toHaveLength(1);
		expect(container.textContent).not.toContain('+');
		props.value.users.splice(0, 1, user('replacement'));
		await nextTick();
		expect(names()).toEqual(['replacement']);
	} finally {
		app.unmount();
		container.remove();
	}
});
