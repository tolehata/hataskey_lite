/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import HyCapsule from './HyCapsule.vue';
import { captureHatadyPageTurn } from '@/utility/hatady-motion.js';

vi.mock('@/preferences.js', async () => {
	const { ref: state } = await import('vue');
	return { prefer: { r: { animation: state(true) } } };
});

const cleanups: Array<() => void> = [];
const options = [
	{ value: 'mine', label: '自分の記録', icon: 'ti ti-user' },
	{ value: 'recent', label: 'みんな', icon: 'ti ti-users' },
	{ value: 'following', label: 'フォロー中', icon: 'ti ti-user-check' },
];

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
	vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(() => ({
		cancel: vi.fn(), finished: new Promise(() => {}),
	}) as unknown as Animation);
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

async function mountCapsule() {
	const target = window.document.createElement('main');
	window.document.body.append(target);
	const selected = ref('mine');
	const app = createApp({ render: () => h('section', [
		h('h1', '日々の記録'),
		h(HyCapsule, { modelValue: selected.value, options, label: '記録の範囲', 'onUpdate:modelValue': value => { selected.value = value; } }),
		h('article', { 'data-content': '' }, `記録 ${selected.value}`),
	]) });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await nextTick();
	return { target, selected };
}

function sizePage(target: HTMLElement, controlsBottom: () => number) {
	Object.defineProperties(target, { clientWidth: { value: 400 }, clientHeight: { value: 500 } });
	vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 600, width: 400, height: 500 } as DOMRect);
	const controls = target.querySelector<HTMLElement>('[data-hy-page-controls]')!;
	vi.spyOn(controls, 'getBoundingClientRect').mockImplementation(() => ({ top: 100, bottom: controlsBottom() } as DOMRect));
}

describe('capsule selection and page-turn copies', () => {
	test('switching in both directions keeps only the selected label and preserves every accessible name', async () => {
		const { target } = await mountCapsule();
		for (const value of ['recent', 'following', 'mine']) {
			const label = options.find(option => option.value === value)!.label;
			target.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click();
			await nextTick();
			const buttons = Array.from(target.querySelectorAll('button'));
			expect(buttons.filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.textContent)).toEqual([label]);
			expect(buttons.filter(button => button.getAttribute('data-active') === 'false').every(button => !button.textContent)).toBe(true);
			expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(options.map(option => option.label));
		}
	});

	test.each([
		['mine', 'recent', 1],
		['following', 'mine', -1],
	] as const)('the whole page turns from %s to %s with the destination capsule selection', async (before, after, direction) => {
		const { target, selected } = await mountCapsule();
		selected.value = before;
		await nextTick();
		sizePage(target, () => 260);
		const transition = captureHatadyPageTurn(target, direction);
		cleanups.push(transition.cancel);
		selected.value = after;
		await nextTick();
		const live = target.firstElementChild!;
		const liveMarkup = live.innerHTML;
		const activeButton = live.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')!;
		activeButton.focus();
		transition.play(200);
		const leaf = target.querySelector<HTMLElement>('.hy-page-leaf')!;
		expect(leaf, 'the actual page-turn effect still plays').not.toBeNull();
		expect(leaf.style.clipPath).toBe('');
		expect(leaf.dataset.direction).toBe(direction < 0 ? 'backward' : 'forward');
		for (const copy of leaf.querySelectorAll<HTMLElement>('.hy-paper-copy')) {
			const controls = copy.querySelector<HTMLElement>('[data-hy-page-controls]')!;
			expect(controls.style.visibility).not.toBe('hidden');
			expect(getComputedStyle(controls).visibility).not.toBe('hidden');
			expect(copy.querySelector('h1')?.textContent).toBe('日々の記録');
			expect(getComputedStyle(copy.querySelector('h1')!).visibility).not.toBe('hidden');
			expect(controls.querySelector('button[aria-pressed="true"]')?.textContent).toBe(activeButton.textContent);
			expect(controls.querySelector('button[data-active="true"]')?.getAttribute('aria-label')).toBe(activeButton.getAttribute('aria-label'));
			expect(copy.querySelector('[data-content]')?.textContent).toBe(`記録 ${before}`);
		}
		expect(live.innerHTML).toBe(liveMarkup);
		expect(window.document.activeElement).toBe(activeButton);
		transition.cancel();
		expect(target.querySelector('.hy-page-leaf')).toBeNull();
	});

	test('a toolbar above the scroll viewport does not clip visible content', async () => {
		const { target } = await mountCapsule();
		sizePage(target, () => 80);
		target.scrollTop = 280;
		const transition = captureHatadyPageTurn(target);
		cleanups.push(transition.cancel);
		transition.play();
		const leaf = target.querySelector<HTMLElement>('.hy-page-leaf')!;
		expect(leaf.style.clipPath).toBe('');
		expect(leaf.style.top).toBe('280px');
		expect(leaf.querySelector('[data-content]')).not.toBeNull();
	});

	test('new capsule copies sanitize their root and descendants while preserving live root and nested scrolls', async () => {
		const { target, selected } = await mountCapsule();
		sizePage(target, () => 260);
		const controls = target.querySelector<HTMLElement>('[data-hy-page-controls]')!;
		controls.scrollLeft = 15;
		const transition = captureHatadyPageTurn(target);
		cleanups.push(transition.cancel);
		selected.value = 'following';
		await nextTick();
		controls.id = 'live-controls';
		controls.setAttribute('name', 'live-controls-name');
		controls.setAttribute('autofocus', '');
		controls.setAttribute('aria-describedby', 'live-help');
		controls.tabIndex = 0;
		controls.insertAdjacentHTML('beforeend', '<div data-nested-scroll><label for="live-input">メモ</label><input id="live-input" name="live-note" form="live-form" autofocus aria-labelledby="live-help"><div data-inner-scroll contenteditable="true" tabindex="0">下書き</div></div>');
		const nested = controls.querySelector<HTMLElement>('[data-nested-scroll]')!;
		const inner = controls.querySelector<HTMLElement>('[data-inner-scroll]')!;
		const input = controls.querySelector<HTMLInputElement>('input')!;
		controls.scrollLeft = 45; controls.scrollTop = 12;
		nested.scrollLeft = 18; nested.scrollTop = 33;
		inner.scrollTop = 9;
		input.value = '編集中';
		input.focus();
		const liveMarkup = controls.outerHTML;
		transition.play(300);
		const leaf = target.querySelector<HTMLElement>('.hy-page-leaf')!;
		for (const copy of leaf.querySelectorAll<HTMLElement>('.hy-paper-copy')) {
			const copiedControls = copy.querySelector<HTMLElement>('[data-hy-page-controls]')!;
			expect(copiedControls.scrollLeft).toBe(45);
			expect(copiedControls.scrollTop).toBe(12);
			expect(copiedControls.querySelector<HTMLElement>('[data-nested-scroll]')!.scrollLeft).toBe(18);
			expect(copiedControls.querySelector<HTMLElement>('[data-nested-scroll]')!.scrollTop).toBe(33);
			expect(copiedControls.querySelector<HTMLElement>('[data-inner-scroll]')!.scrollTop).toBe(9);
			expect(copiedControls.querySelector<HTMLElement>('[contenteditable]')!.getAttribute('contenteditable')).toBe('false');
			expect(copiedControls.tabIndex).toBe(-1);
			for (const node of copiedControls.querySelectorAll<HTMLElement>('button,input,[tabindex]')) expect(node.tabIndex).toBe(-1);
			expect(copy.querySelector('[id],[name],[autofocus],[for],[form],[aria-labelledby],[aria-describedby],[data-hy-paper-scroll]')).toBeNull();
		}
		expect(leaf.inert).toBe(true);
		expect(leaf.getAttribute('aria-hidden')).toBe('true');
		expect(controls.outerHTML).toBe(liveMarkup);
		expect(input.value).toBe('編集中');
		expect(window.document.activeElement).toBe(input);
		expect(controls.scrollLeft).toBe(45);
		expect(nested.scrollTop).toBe(33);
	});

	test('different page groups leave the captured page intact instead of substituting an unrelated selection', async () => {
		const { target } = await mountCapsule();
		sizePage(target, () => 900);
		const transition = captureHatadyPageTurn(target);
		cleanups.push(transition.cancel);
		const controls = target.querySelector<HTMLElement>('[data-hy-page-controls]')!;
		controls.setAttribute('aria-label', 'コレクションの種類');
		transition.play();
		const leaf = target.querySelector<HTMLElement>('.hy-page-leaf')!;
		expect(leaf, 'a tall toolbar must not suppress the entire paper').not.toBeNull();
		expect(leaf.style.clipPath).toBe('');
		expect(leaf.querySelector('[aria-label="記録の範囲"] button[aria-pressed="true"]')?.textContent).toBe('自分の記録');
		expect(leaf.querySelector('[aria-label="コレクションの種類"]')).toBeNull();
	});

	test('canceling an earlier capture during rapid changes cannot replay its old highlighted selection', async () => {
		const { target, selected } = await mountCapsule();
		sizePage(target, () => 260);
		const earlier = captureHatadyPageTurn(target);
		cleanups.push(earlier.cancel);
		selected.value = 'recent';
		await nextTick();
		earlier.cancel();
		const latest = captureHatadyPageTurn(target, -1);
		cleanups.push(latest.cancel);
		selected.value = 'mine';
		await nextTick();
		earlier.play(400);
		expect(target.querySelector('.hy-page-leaf')).toBeNull();
		latest.play(450);
		expect(target.querySelectorAll('.hy-page-leaf')).toHaveLength(1);
		for (const controls of target.querySelectorAll('.hy-page-leaf [data-hy-page-controls]')) {
			expect(controls.querySelector('button[aria-pressed="true"]')?.textContent).toBe('自分の記録');
		}
		expect(target.querySelector('.hy-page-leaf [data-content]')?.textContent).toBe('記録 recent');
	});
});
