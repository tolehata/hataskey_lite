/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import type * as Misskey from 'cherrypick-js';
import type { HataskeyTimelineNewNotesAvatar } from '@/utility/hataskey-timeline-new-notes.js';
import MkTimelineNewNotesContent from './MkTimelineNewNotesContent.vue';

const cleanups: (() => void)[] = [];
let reduced = false;
const listeners = new Set<() => void>();
const effects: { element: HTMLElement; frames: Keyframe[]; duration: number; cancel: ReturnType<typeof vi.fn> }[] = [];
beforeEach(() => {
	effects.length = 0;
	reduced = false;
	listeners.clear();
	vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, addEventListener: (_: string, listener: () => void) => listeners.add(listener), removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) }));
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		const animated = effects.some(effect => effect.element === this && effect.cancel.mock.calls.length === 0);
		const left = Number(this.dataset.geometry ?? 0) + (animated ? 5 : 0);
		return { left, top: 0, width: 26, height: 26, right: left + 26, bottom: 26, x: left, y: 0, toJSON() {} };
	});
	vi.stubGlobal('Animation', class {});
	Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: function (this: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
		const cancel = vi.fn();
		effects.push({ element: this, frames, duration: Number(options.duration), cancel });
		return { cancel, finished: new Promise(() => {}) };
	} });
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (HTMLElement.prototype as Partial<HTMLElement>).animate; });
function mount() {
	const state = ref<{ avatars: HataskeyTimelineNewNotesAvatar[]; count: number; motion: boolean }>({ avatars: [{ id: 'a', url: 'a.png' }], count: 1, motion: true });
	const target = document.createElement('div');
	document.body.append(target);
	const app = createApp({ render: () => h(MkTimelineNewNotesContent, state.value) });
	app.component('MkAvatar', { props: ['user', 'link', 'preview'], setup: props => () => h('span', { 'data-avatar-link': String(props.link), 'data-avatar-preview': String(props.preview) }, [h('img', { src: props.user.avatarUrl }), h('img', { 'data-decoration': props.user.avatarDecorations[0].url })]) });
	app.component('Mfm', { props: ['text'], setup: props => () => h('span', props.text) });
	app.mount(target);
	let mounted = true;
	function unmount() { if (mounted) { app.unmount(); mounted = false; } }
	cleanups.push(() => { unmount(); target.remove(); });
	return { state, target, unmount, face: (id: string) => target.querySelector<HTMLElement>(`[data-new-notes-face="${id}"]`)! };
}
async function settle() { await nextTick(); await nextTick(); }
describe('new notes content', () => {
	it('preserves keyed faces and restarts interrupted movement from the rendered geometry', async () => {
		const view = mount();
		const original = view.face('a');
		view.state.value = { ...view.state.value, avatars: [{ id: 'b', url: 'b.png' }, ...view.state.value.avatars], count: 2 };
		await settle();
		expect(view.face('a')).toBe(original);
		const first = effects.find(effect => effect.element === original)!;
		view.state.value = { ...view.state.value, avatars: [{ id: 'c', url: 'c.png' }, ...view.state.value.avatars], count: 3 };
		await settle();
		expect(view.face('a')).toBe(original);
		expect(first.cancel).toHaveBeenCalledOnce();
		const latest = effects.filter(effect => effect.element === original).at(-1)!;
		expect(latest.frames[0].transform).toBe('translate(5px, 0px) scale(1)');
		expect(latest.duration).toBe(520);
		expect(effects.some(effect => effect.duration === 380)).toBe(true);
	});
	it('caps faces at three and clears departing ghosts and effects when motion turns off', async () => {
		const view = mount();
		view.state.value = { ...view.state.value, avatars: ['b', 'c', 'd', 'e'].map(id => ({ id, url: `${id}.png` })), count: 5 };
		await settle();
		expect(view.target.querySelectorAll('[data-new-notes-face]')).toHaveLength(3);
		expect(view.target.querySelectorAll('[data-new-notes-ghost]')).toHaveLength(1);
		view.state.value = { ...view.state.value, motion: false };
		await settle();
		expect(view.target.querySelector('[data-new-notes-ghost]')).toBeNull();
		expect(effects.every(effect => effect.cancel.mock.calls.length === 1)).toBe(true);
	});
	it('passes decoration data to a noninteractive avatar and cancels on unmount', async () => {
		const view = mount();
		const user = { id: 'u', username: 'u', avatarUrl: 'u.png', avatarDecorations: [{ url: 'deco.png', angle: .2 }] };
		view.state.value = { ...view.state.value, avatars: [{ id: 'u', user: user as unknown as Misskey.entities.UserLite }], count: 2 };
		await settle();
		expect(view.target.querySelector('[data-avatar-link]')?.getAttribute('data-avatar-link')).toBe('false');
		expect(view.target.querySelector('[data-avatar-preview]')?.getAttribute('data-avatar-preview')).toBe('false');
		expect(view.target.querySelector('[data-decoration]')?.getAttribute('data-decoration')).toBe('deco.png');
		expect(view.target.querySelector('a')).toBeNull();
		view.unmount();
		expect(effects.every(effect => effect.cancel.mock.calls.length === 1)).toBe(true);
		expect(view.target.querySelector('[data-new-notes-ghost]')).toBeNull();
	});
	it('keeps same-count replacements smooth and lets earlier departing ghosts finish', async () => {
		const view = mount();
		view.state.value = { ...view.state.value, avatars: ['a', 'b', 'c'].map(id => ({ id, url: `${id}.png` })), count: 3 };
		await settle();
		const original = view.face('a');
		view.state.value = { ...view.state.value, avatars: ['d', 'a', 'b'].map(id => ({ id, url: `${id}.png` })) };
		await settle();
		const ghost = view.target.querySelector<HTMLElement>('[data-new-notes-ghost]')!;
		const departure = effects.find(effect => effect.element === ghost)!;
		const priorCountEffects = effects.filter(effect => effect.duration === 380).length;
		view.state.value = { ...view.state.value, avatars: ['e', 'd', 'a'].map(id => ({ id, url: `${id}.png` })) };
		await settle();
		expect(view.face('a')).toBe(original);
		expect(departure.cancel).not.toHaveBeenCalled();
		expect(view.target.querySelectorAll('[data-new-notes-ghost]')).toHaveLength(2);
		expect(effects.filter(effect => effect.duration === 380)).toHaveLength(priorCountEffects);
	});
	it('immediately cleans running movement and ghosts when OS reduced motion changes', async () => {
		const view = mount();
		view.state.value = { ...view.state.value, avatars: [{ id: 'b', url: 'b.png' }], count: 2 };
		await settle();
		expect(view.target.querySelector('[data-new-notes-ghost]')).not.toBeNull();
		reduced = true;
		listeners.forEach(listener => listener());
		await settle();
		expect(view.target.querySelector('[data-new-notes-ghost]')).toBeNull();
		expect(effects.every(effect => effect.cancel.mock.calls.length === 1)).toBe(true);
		const effectCount = effects.length;
		view.state.value = { ...view.state.value, count: 3 };
		await settle();
		expect(effects).toHaveLength(effectCount);
		view.unmount();
		expect(listeners.size).toBe(0);
	});
});
