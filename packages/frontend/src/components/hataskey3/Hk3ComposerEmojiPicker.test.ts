/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, shallowRef } from 'vue';
import Hk3ComposerEmojiPicker from './Hk3ComposerEmojiPicker.vue';
import { prefer } from '@/preferences.js';

const shared = vi.hoisted(() => ({ focus: vi.fn(), reset: vi.fn() }));
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { r: {
		emojiPaletteForMain: ref<string | null>(null),
		emojiPalettes: ref([{ id: 'first', emojis: ['🌸'] }, { id: 'selected', emojis: [':custom:'] }]),
	} } };
});
vi.mock('@/components/MkEmojiPicker.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({
		props: ['showPinned', 'pinnedEmojis', 'asReactionPicker', 'asDrawer', 'maxHeight'],
		emits: ['chosen', 'esc'],
		setup(props, { emit, expose }) {
			expose(shared);
			return () => h('div', { 'data-shared-picker': '', 'data-props': JSON.stringify(props) }, [
				h('button', { onClick: () => emit('chosen', ':custom:') }, 'Choose'),
				h('button', { onClick: () => emit('esc') }, 'Close'),
			]);
		},
	}) };
});

const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).forEach(run => run()); vi.clearAllMocks(); prefer.r.emojiPaletteForMain.value = null; });

function mount() {
	const target = window.document.createElement('div');
	const picker = shallowRef<{ focus: () => void; reset: () => void }>();
	const done = vi.fn();
	const closed = vi.fn();
	const app = createApp({ render: () => h(Hk3ComposerEmojiPicker, { ref: picker, maxHeight: 260, onDone: done, onClosed: closed }) });
	app.mount(target);
	cleanup.push(() => app.unmount());
	return { target, picker, done, closed, props: () => JSON.parse(target.querySelector('[data-shared-picker]')!.getAttribute('data-props')!) };
}

describe('UI S embedded shared emoji picker', () => {
	it('uses the main palette reactively and retains shared composer picker options', async () => {
		const view = mount();
		expect(view.props()).toMatchObject({ showPinned: true, pinnedEmojis: ['🌸'], asReactionPicker: false, asDrawer: true, maxHeight: 260 });
		prefer.r.emojiPaletteForMain.value = 'selected';
		await nextTick();
		expect(view.props().pinnedEmojis).toEqual([':custom:']);
	});

	it('forwards exact chosen values, close, focus and reset to the existing picker', () => {
		const view = mount();
		view.target.querySelectorAll('button')[0].click();
		view.target.querySelectorAll('button')[1].click();
		view.picker.value!.focus();
		view.picker.value!.reset();
		expect(view.done).toHaveBeenCalledWith(':custom:');
		expect(view.closed).toHaveBeenCalledOnce();
		expect(shared.focus).toHaveBeenCalledOnce();
		expect(shared.reset).toHaveBeenCalledOnce();
	});
});
