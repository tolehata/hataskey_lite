/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, createApp, h, nextTick, ref } from 'vue';
import type { App } from 'vue';
import MkExternalNotificationToastContainer from './MkExternalNotificationToastContainer.vue';
import { createHataskeyNotificationToasts, registerNotificationPageContext } from '@/utility/hataskey-notification-toast.js';
import { resetNotificationToastSuppressionForTest } from '@/utility/notification-toast-suppression.js';

vi.mock('@/components/MkExternalNotificationToast.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: { notification: { type: Object, required: true } },
		emits: ['close'],
		setup(props, { emit }) {
			return () => render('button', {
				'data-external-toast': props.notification.id,
				onClick: () => emit('close'),
			}, props.notification.id);
		},
	}) };
});

let app: App | undefined;
const releases: Array<() => void> = [];

beforeEach(() => resetNotificationToastSuppressionForTest());
afterEach(() => {
	app?.unmount();
	app = undefined;
	releases.splice(0).forEach(release => release());
	window.document.body.innerHTML = '';
	resetNotificationToastSuppressionForTest();
});

async function mountContainer() {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	app = createApp({ render: () => h(MkExternalNotificationToastContainer) });
	app.mount(target);
	await nextTick();
}

async function receive(id: string) {
	window.dispatchEvent(new CustomEvent('external-notification', { detail: { id } }));
	await nextTick();
}

function visibleIds() {
	return Array.from(window.document.querySelectorAll('[data-external-toast]'), element => element.getAttribute('data-external-toast'));
}

describe('legacy external toast ownership', () => {
	test('keeps the existing bounded and dismissible stack without a page receiver', async () => {
		await mountContainer();
		for (const id of ['first', 'second', 'third', 'fourth']) await receive(id);
		expect(visibleIds()).toEqual(['second', 'third', 'fourth']);
		window.document.querySelector<HTMLButtonElement>('[data-external-toast="third"]')!.click();
		await nextTick();
		expect(visibleIds()).toEqual(['second', 'fourth']);
	});

	test('yields new events to an active page and resumes after deactivation or release', async () => {
		await mountContainer();
		const active = ref(false);
		const context = createHataskeyNotificationToasts(computed(() => true), computed(() => true));
		const release = registerNotificationPageContext(context, () => active.value);
		releases.push(release);
		await receive('before-activation');
		expect(visibleIds()).toEqual(['before-activation']);
		active.value = true;
		await receive('owned-by-page');
		expect(visibleIds()).toEqual(['before-activation']);
		// Receipt stays with the page renderer; this container must not enqueue again.
		expect(context.items.value).toEqual([]);
		active.value = false;
		await receive('after-deactivation');
		expect(visibleIds()).toEqual(['before-activation', 'after-deactivation']);
		active.value = true;
		release();
		await receive('after-release');
		expect(visibleIds()).toEqual(['before-activation', 'after-deactivation', 'after-release']);
	});
});
