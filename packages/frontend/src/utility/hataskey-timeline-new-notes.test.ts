/* SPDX-License-Identifier: AGPL-3.0-only */
import { createApp, defineComponent, h, KeepAlive, nextTick, provide, ref } from 'vue';
import type { entities } from 'cherrypick-js';
import type { App, Ref } from 'vue';
import type { HataskeyTimelineNewNotes } from './hataskey-timeline-new-notes.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHataskeyTimelineNewNotes, hataskeyTimelineNewNotesKey, useHataskeyTimelineNewNotes, useRetainedHataskeyTimelineNewNotes } from './hataskey-timeline-new-notes.js';

let app: App | undefined;
afterEach(() => {
	app?.unmount();
	app = undefined;
	window.document.body.innerHTML = '';
	vi.useRealTimers();
});

function mount() {
	const selected = ref('home');
	const activeKey = ref<string | null>('home');
	const showTimeline = ref(true);
	const counts: Record<string, Ref<number>> = { home: ref(3), external: ref(7) };
	const enabled = ref(true);
	const context = createHataskeyTimelineNewNotes(activeKey);
	const show = vi.fn((key: string) => { counts[key].value = 0; });
	const Timeline = defineComponent({
		props: { source: { type: String, required: true } },
		setup(props) {
			const integrated = useHataskeyTimelineNewNotes(() => props.source, () => enabled.value && counts[props.source].value > 0 ? {
				count: counts[props.source].value, text: `${props.source}: ${counts[props.source].value} new notes`, icon: 'ti ti-arrow-up', show: () => show(props.source),
				...(props.source === 'external' ? {
					avatars: [{ id: 'note-1', url: 'https://example.com/avatar.png', user: { id: 'external-user', host: 'example.com', avatarDecorations: [{ id: 'decoration', url: 'https://example.com/decoration.png' }] } as entities.UserLite }],
					emojiUrls: { wave: 'https://example.com/wave.png' },
				} : {}),
			} : null);
			return () => h('div', { 'data-source': props.source, 'data-integrated': integrated.value });
		},
	});
	app = createApp(defineComponent({
		setup() {
			provide(hataskeyTimelineNewNotesKey, context);
			return () => [
				h(KeepAlive, null, { default: () => showTimeline.value ? h(Timeline, { key: selected.value, source: selected.value }) : null }),
				context.notice.value ? h('button', { onClick: context.notice.value.show }, context.notice.value.text) : null,
			];
		},
	}));
	const root = window.document.createElement('div');
	window.document.body.append(root);
	app.mount(root);
	return { root, selected, activeKey, showTimeline, counts, enabled, context, show };
}

describe('Hataskey navbar new notes', () => {
	it('updates the count and uses the original timeline action until its queue is released', async () => {
		const current = mount();
		await nextTick();
		expect(current.root.querySelector('button')?.textContent).toBe('home: 3 new notes');
		current.counts.home.value = 5;
		await nextTick();
		expect(current.root.querySelector('button')?.textContent).toBe('home: 5 new notes');
		current.root.querySelector('button')?.click();
		await nextTick();
		expect(current.show).toHaveBeenCalledExactlyOnceWith('home');
		expect(current.root.querySelector('button')).toBeNull();
	});

	it('does not let a cached timeline overwrite or clear the currently selected timeline', async () => {
		const current = mount();
		current.selected.value = 'external';
		current.activeKey.value = 'external';
		await nextTick();
		await nextTick();
		expect(current.root.querySelector('button')?.textContent).toBe('external: 7 new notes');
		expect(current.context.notice.value?.count).toBe(7);
		expect(current.context.notice.value?.avatars?.[0].user?.avatarDecorations).toEqual([{ id: 'decoration', url: 'https://example.com/decoration.png' }]);
		expect(current.context.notice.value?.emojiUrls).toEqual({ wave: 'https://example.com/wave.png' });
		current.counts.home.value = 20;
		await nextTick();
		expect(current.root.querySelector('button')?.textContent).toBe('external: 7 new notes');
		current.root.querySelector('button')?.click();
		expect(current.show).toHaveBeenCalledExactlyOnceWith('external');
		current.selected.value = 'home';
		current.activeKey.value = 'home';
		await nextTick();
		await nextTick();
		expect(current.root.querySelector('button')?.textContent).toBe('home: 20 new notes');
		expect(current.context.notice.value?.avatars).toBeUndefined();
	});

	it('hides off-route and in Deck without discarding the original queued notes', async () => {
		const current = mount();
		await nextTick();
		for (const key of ['list:other', null]) {
			current.activeKey.value = key;
			await nextTick();
			expect(current.root.querySelector('button')).toBeNull();
			expect(current.root.querySelector('[data-integrated]')?.getAttribute('data-integrated')).toBe('false');
		}
		current.activeKey.value = 'home';
		await nextTick();
		expect(current.root.querySelector('button')?.textContent).toBe('home: 3 new notes');
		expect(current.show).not.toHaveBeenCalled();
	});

	it('removes the navbar notice on deactivation and restores it on activation', async () => {
		const current = mount();
		await nextTick();
		current.showTimeline.value = false;
		await nextTick();
		await nextTick();
		expect(current.context.notice.value).toBeNull();
		current.showTimeline.value = true;
		await nextTick();
		await nextTick();
		expect(current.root.querySelector('button')?.textContent).toBe('home: 3 new notes');
		app?.unmount();
		app = undefined;
		expect(current.context.notice.value).toBeNull();
	});

	it('reacts to hidden notices without dropping their queue', async () => {
		const current = mount();
		await nextTick();
		current.enabled.value = false;
		await nextTick();
		expect(current.root.querySelector('button')).toBeNull();
		current.enabled.value = true;
		await nextTick();
		expect(current.root.querySelector('button')?.textContent).toBe('home: 3 new notes');
	});

	it('keeps unconnected UI and Deck consumers on their existing presentation', () => {
		const root = window.document.createElement('div');
		app = createApp(defineComponent({
			setup() {
				const integrated = useHataskeyTimelineNewNotes('home', null);
				return () => h('span', String(integrated.value));
			},
		}));
		app.mount(root);
		expect(root.textContent).toBe('false');
	});
});


describe('navbar retained new notes content', () => {
	function retainedMount() {
		const show = vi.fn();
		const source = ref<HataskeyTimelineNewNotes | null>({ count: 3, text: '3 new notes', icon: 'ti ti-arrow-up', show });
		const motion = ref(true);
		let content: ReturnType<typeof useRetainedHataskeyTimelineNewNotes>;
		app = createApp(defineComponent({ setup() {
			content = useRetainedHataskeyTimelineNewNotes(source, motion);
			return () => h('button', { inert: source.value == null, disabled: source.value == null, onClick: () => source.value?.show() }, content.value?.text);
		} }));
		const root = window.document.createElement('div');
		window.document.body.append(root);
		app.mount(root);
		return { source, motion, root, show };
	}

	it('retains old text during collapse while disabling the action immediately', async () => {
		vi.useFakeTimers();
		const current = retainedMount();
		current.source.value = null;
		await nextTick();
		const button = current.root.querySelector('button')!;
		expect(button.textContent).toBe('3 new notes');
		expect(button.disabled).toBe(true);
		expect(button.hasAttribute('inert')).toBe(true);
		button.click();
		expect(current.show).not.toHaveBeenCalled();
		vi.advanceTimersByTime(349);
		await nextTick();
		expect(button.textContent).toBe('3 new notes');
		vi.advanceTimersByTime(1);
		await nextTick();
		expect(button.textContent).toBe('');
	});

	it('does not let an old collapse clear a newly received notice', async () => {
		vi.useFakeTimers();
		const current = retainedMount();
		current.source.value = null;
		vi.advanceTimersByTime(140);
		current.source.value = { count: 4, text: '4 new notes', icon: 'ti ti-arrow-up', show: current.show };
		vi.advanceTimersByTime(400);
		await nextTick();
		expect(current.root.querySelector('button')?.textContent).toBe('4 new notes');
		expect(current.root.querySelector('button')?.disabled).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('clears immediately when motion is disabled and cleans pending timers on unmount', async () => {
		vi.useFakeTimers();
		const current = retainedMount();
		current.source.value = null;
		expect(vi.getTimerCount()).toBe(1);
		current.motion.value = false;
		await nextTick();
		expect(current.root.querySelector('button')?.textContent).toBe('');
		expect(vi.getTimerCount()).toBe(0);
		current.motion.value = true;
		current.source.value = { text: 'again', icon: 'ti ti-arrow-up', show: current.show };
		current.source.value = null;
		expect(vi.getTimerCount()).toBe(1);
		app?.unmount(); app = undefined;
		expect(vi.getTimerCount()).toBe(0);
	});
});
