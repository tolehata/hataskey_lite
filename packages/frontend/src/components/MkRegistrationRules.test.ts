/* SPDX-License-Identifier: AGPL-3.0-only */
import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MkRegistrationRules from './MkRegistrationRules.vue';
import { instance } from '@/instance.js';

vi.mock('@/instance.js', async () => {
	const { reactive } = await import('vue');
	return { instance: reactive({ serverRules: ['A rule'], tosUrl: '/terms', privacyPolicyUrl: null, disableRegistration: false, federation: 'all' }) };
});
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: { animation: ref(false) } } };
});
vi.mock('@/i18n.js', () => {
	const words = new Proxy({}, { get: (_target, key) => String(key) });
	return { i18n: { ts: { serverRules: 'rules', termsOfService: 'terms', privacyPolicy: 'policy', agree: 'agree', _hata: { _registrationApplications: { _application: words, _flow: words } } } } };
});
vi.mock('@/components/MkButton.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: ['disabled'], setup: (props, { slots }) => () => h('button', { disabled: props.disabled }, slots.default?.()) }) };
});
vi.mock('@/components/MkInfo.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ setup: (_props, { slots }) => () => h('div', slots.default?.()) }) };
});

const meta = instance as unknown as { serverRules: string[]; tosUrl: string | null; privacyPolicyUrl: string | null };
const cleanup: (() => void)[] = [];

function create(props: Record<string, unknown> = {}) {
	const container = window.document.createElement('div');
	// Keep Vue's activation handlers while preventing the DOM emulator from navigating.
	container.addEventListener('click', event => event.preventDefault());
	container.addEventListener('auxclick', event => event.preventDefault());
	window.document.body.append(container);
	const agreed: boolean[] = [];
	const done = vi.fn();
	const app = createApp(defineComponent({ render: () => h(MkRegistrationRules, { application: true, ...props, 'onUpdate:agreed': (value: boolean) => agreed.push(value), onDone: done }) }));
	app.mount(container);
	cleanup.push(() => { app.unmount(); container.remove(); });

	function checkbox(id: string) { return container.querySelector<HTMLInputElement>(`[data-testid="signup-rules-${id}-agree"]`)!; }

	async function change(id: string, value: boolean) {
		const input = checkbox(id);
		input.checked = value;
		input.dispatchEvent(new Event('change', { bubbles: true }));
		await nextTick();
	}

	async function open(middle = false) {
		container.querySelector('a')!.dispatchEvent(new MouseEvent(middle ? 'auxclick' : 'click', { button: middle ? 1 : 0, bubbles: true, cancelable: true }));
		await nextTick();
	}

	return { container, agreed, done, checkbox, change, open, next: () => container.querySelector<HTMLButtonElement>('[data-testid="signup-rules-continue"]')! };
}

beforeEach(() => { meta.serverRules = ['A rule']; meta.tosUrl = '/terms'; meta.privacyPolicyUrl = null; });
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); });

describe('registration rules consent flow', () => {
	it('retains mandatory signup basic notes when policies are absent', async () => {
		meta.serverRules = [];
		meta.tosUrl = null;
		const item = create({ application: false });
		expect(item.checkbox('terms')).toBeNull();
		await item.change('privacy', true);
		expect(item.checkbox('notes').disabled).toBe(true);
		expect(item.next().disabled).toBe(true);
		await item.open();
		await item.change('notes', true);
		expect(item.agreed.at(-1)).toBe(true);
	});
	it('requires link activation, keeps next explicit, and ignores parent agreement', async () => {
		const item = create({ agreed: true });
		expect(item.next().disabled).toBe(true);
		await item.change('rules', true);
		expect(item.checkbox('terms').disabled).toBe(true);
		await item.open();
		expect(item.checkbox('terms').disabled).toBe(false);
		await item.change('terms', true);
		await item.change('privacy', true);
		expect(item.agreed.at(-1)).toBe(true);
		expect(item.done).not.toHaveBeenCalled();
		item.next().click();
		expect(item.done).toHaveBeenCalledTimes(1);
	});
	it('revokes later consent and resets when a document setting changes', async () => {
		const item = create();
		await item.change('rules', true);
		await item.open(true);
		await item.change('terms', true);
		await item.change('privacy', true);
		await item.change('rules', false);
		expect(item.checkbox('terms').checked).toBe(false);
		meta.tosUrl = 'javascript:alert(1)';
		await nextTick();
		expect(item.container.querySelector('a')).toBeNull();
		expect(item.agreed.at(-1)).toBe(false);
		expect(item.next().disabled).toBe(true);
	});
	it('does not move delayed focus into a hidden parent', async () => {
		const item = create();
		const outside = window.document.createElement('button');
		window.document.body.append(outside);
		outside.focus();
		item.container.style.display = 'none';
		await item.change('rules', true);
		expect(window.document.activeElement).toBe(outside);
		outside.remove();
	});
});
