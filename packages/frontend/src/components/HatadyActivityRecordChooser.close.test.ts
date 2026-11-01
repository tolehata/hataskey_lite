/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import HatadyActivityRecordChooser from './HatadyActivityRecordChooser.vue';

const mocks = vi.hoisted(() => ({ close: vi.fn() }));
vi.mock('@/components/HyDialog.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({
		props: ['title', 'variant', 'instantClose'], emits: ['close'],
		setup(props, { emit, slots, expose }) {
			expose({ close: mocks.close });
			return () => h('div', { 'data-variant': props.variant, 'data-title': props.title, 'data-instant-close': String(props.instantClose) }, [
				h('button', { 'data-close': '', onClick: () => emit('close') }, 'Close'), slots.header?.(), slots.default?.(),
			]);
		},
	}) };
});
vi.mock('@/components/HyMediaCover.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/HatadyComposer.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/HatadyMediaSessionForm.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/HatadyMediaWorkForm.vue', () => ({ default: { render: () => null } }));
vi.mock('@/utility/hatady-ui.js', () => ({ HATADY_ACTIVITY_CHOICES: ['study', 'movie', 'game', 'exercise', 'work', 'cooking'].map(value => ({ value, label: value, icon: 'ti ti-book' })) }));
vi.mock('@/utility/hatady-media.js', () => ({ normalizeMediaWorks: () => [] }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/router.js', () => ({ useRouter: () => ({ pushByPath: vi.fn() }) }));
vi.mock('@/i18n.js', () => ({
	i18n: { ts: { cancel: 'Cancel', _hata: { _hatady: {
		_home: { chooseRecordType: 'What would you like to record?' },
		_activityChooser: { title: 'Record', studyDescription: '', movieDescription: '', gameDescription: '', exerciseDescription: '', workDescription: '', cookingChoiceDescription: '' },
	} } } },
}));

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.useRealTimers(); mocks.close.mockClear(); vi.unstubAllGlobals(); });

function mount(variant: 'hatady' | 'ui' | 'uis') {
	const host = window.document.createElement('div'); window.document.body.append(host);
	const app = createApp(defineComponent({ render: () => h(HatadyActivityRecordChooser, { variant }) }));
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	return host;
}

describe('Hatady chooser close motion', () => {
	it('finishes the six-row exit and closes the UI modal at 320 ms without a second modal leave', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
		const host = mount('ui');
		expect(host.querySelector('[data-title="What would you like to record?"]')).not.toBeNull();
		expect(host.textContent).toContain('What would you like to record?');
		host.querySelector<HTMLButtonElement>('[data-close]')!.click(); await nextTick();
		expect(host.querySelector('[data-closing="true"]')).not.toBeNull();
		expect(host.querySelector('[data-instant-close="true"]')).not.toBeNull();
		await vi.advanceTimersByTimeAsync(319);
		expect(mocks.close).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(mocks.close).toHaveBeenCalledOnce();
	});
	it('closes immediately for reduced motion and keeps Hatady default closing behavior', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
		let host = mount('uis');
		host.querySelector<HTMLButtonElement>('[data-close]')!.click(); await nextTick();
		expect(mocks.close).toHaveBeenCalledOnce();
		expect(host.querySelector('[data-instant-close="true"]')).not.toBeNull();
		cleanups.pop()?.(); mocks.close.mockClear();
		host = mount('hatady');
		expect(host.querySelector('[data-title="Record"]')).not.toBeNull();
		host.querySelector<HTMLButtonElement>('[data-close]')!.click(); await nextTick();
		expect(mocks.close).toHaveBeenCalledOnce();
		expect(host.querySelector('[data-instant-close="false"]')).not.toBeNull();
	});
});
