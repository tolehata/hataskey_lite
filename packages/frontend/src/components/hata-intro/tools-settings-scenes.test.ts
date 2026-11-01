/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { init as initTools, templates as toolTemplates } from './tool-scenes.js';
import { init as initSettings, templates as settingsTemplates } from './settings-scenes.js';

type Mounted = { scene: HTMLElement; cleanup: () => void };
const mounted: Mounted[] = [];
const restorers: (() => void)[] = [];
const effects: string[] = [];
const animationCancel = vi.fn();
let hit: Element | null = null;
let captured = new WeakMap<Element, Set<number>>();

class SceneObserver {
	static instances: SceneObserver[] = [];
	readonly targets: Element[] = [];
	disconnect = vi.fn();
	constructor(readonly callback: (entries: Partial<IntersectionObserverEntry>[]) => void, readonly options: IntersectionObserverInit) {
		SceneObserver.instances.push(this);
	}
	observe(target: Element) { this.targets.push(target); }
	emit(selected: string) {
		this.callback(this.targets.map(target => ({ target, isIntersecting: (target as HTMLElement).dataset.hguSection === selected, intersectionRect: { height: (target as HTMLElement).dataset.hguSection === selected ? 180 : 0 } as DOMRectReadOnly })));
	}
}

function property(target: object, key: string, value: unknown) {
	const previous = Object.getOwnPropertyDescriptor(target, key);
	Object.defineProperty(target, key, { configurable: true, writable: true, value });
	restorers.push(() => {
		if (previous) Object.defineProperty(target, key, previous);
		else Reflect.deleteProperty(target, key);
	});
}

function deny(kind: string): never {
	effects.push(kind);
	throw new Error(`Guide attempted ${kind}`);
}

function noEffects() { expect(effects).toEqual([]); }

beforeEach(() => {
	effects.length = 0;
	SceneObserver.instances.length = 0;
	animationCancel.mockClear();
	captured = new WeakMap();
	hit = null;
	vi.stubGlobal('fetch', vi.fn(() => deny('fetch')));
	vi.stubGlobal('XMLHttpRequest', class { constructor() { deny('xhr'); } });
	vi.stubGlobal('WebSocket', class { constructor() { deny('websocket'); } });
	vi.stubGlobal('IntersectionObserver', SceneObserver);
	vi.spyOn(window, 'open').mockImplementation(() => deny('window.open'));
	vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: true, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: () => true }));
	// HappyDOM Storage is a Proxy whose method-assignment trap can silently
	// discard vi.spyOn replacements. Replace the exposed storage object itself.
	for (const name of ['localStorage', 'sessionStorage'] as const) {
		const storage: Storage = {
			length: 0,
			key: () => null,
			getItem: () => null,
			setItem: () => deny(`${name}.setItem`),
			removeItem: () => deny(`${name}.removeItem`),
			clear: () => deny(`${name}.clear`),
		};
		vi.stubGlobal(name, storage);
	}
	property(navigator, 'sendBeacon', () => deny('beacon'));
	// These platform doubles test lifecycle and DOM state, not browser geometry,
	// animation rendering, native dialog focus trapping, or physical dragging.
	property(Element.prototype, 'scrollIntoView', vi.fn());
	property(Element.prototype, 'getAnimations', () => [{ cancel: animationCancel }]);
	property(Element.prototype, 'setPointerCapture', function (this: Element, id: number) {
		const ids = captured.get(this) ?? new Set<number>(); ids.add(id); captured.set(this, ids);
	});
	property(Element.prototype, 'hasPointerCapture', function (this: Element, id: number) { return captured.get(this)?.has(id) ?? false; });
	property(Element.prototype, 'releasePointerCapture', function (this: Element, id: number) { captured.get(this)?.delete(id); });
	property(window.document, 'elementFromPoint', () => hit);
	property(HTMLDialogElement.prototype, 'showModal', function (this: HTMLDialogElement) { this.open = true; });
	property(HTMLDialogElement.prototype, 'close', function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')); });
});

afterEach(() => {
	try {
		for (const item of mounted.splice(0)) { item.cleanup(); item.scene.remove(); }
		noEffects();
	} finally {
		for (const restore of restorers.splice(0).reverse()) restore();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	}
});

function mount(kind: 'card' | 'settings', instance = 'guide-test') {
	const scene = window.document.createElement('figure');
	scene.dataset.scene = kind;
	scene.dataset.hataIntroInstance = instance;
	scene.innerHTML = kind === 'card' ? toolTemplates['hg-card-scene'] : settingsTemplates['hg-layout-scene'];
	window.document.body.append(scene);
	const cleanup = (kind === 'card' ? initTools : initSettings)(scene);
	const item = { scene, cleanup }; mounted.push(item); return item;
}

function get<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
	const result = root.querySelector<T>(selector);
	if (!result) throw new Error(`Missing scene element: ${selector}`);
	return result;
}

function click(root: ParentNode, selector: string) { get<HTMLElement>(root, selector).click(); }

function input(root: ParentNode, selector: string, value: string) {
	const element = get<HTMLInputElement>(root, selector); element.value = value; element.dispatchEvent(new Event('input', { bubbles: true }));
}

function toggle(root: ParentNode, selector: string, checked: boolean) {
	const element = get<HTMLInputElement>(root, selector); element.checked = checked; element.dispatchEvent(new Event('change', { bubbles: true }));
}

function pointer(element: Element, type: string, values: PointerEventInit = {}) {
	element.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, buttons: 1, bubbles: true, cancelable: true, ...values }));
}

function action(root: ParentNode, name: string) { click(root, `[data-hgu-action="${name}"]`); }

function order(root: ParentNode) { return [...root.querySelectorAll<HTMLElement>('[data-hgu-nav] [data-nav-id]')].map(item => item.dataset.navId); }

function dirty(root: ParentNode) { return get(root, '[data-hgu-changebar]').dataset.dirty; }

describe('HataIntro card and settings effect guards', () => {
	test('positive controls prove transport, navigation, and storage attempts are detected', () => {
		const attempts: [string, () => unknown][] = [
			['fetch', () => window.fetch('https://guide.example.invalid/positive-control')],
			['xhr', () => new XMLHttpRequest()],
			['websocket', () => new WebSocket('wss://guide.example.invalid/positive-control')],
			['window.open', () => window.open('https://guide.example.invalid/positive-control')],
			['beacon', () => navigator.sendBeacon('/positive-control')],
			['localStorage.setItem', () => localStorage.setItem('guide-positive', '1')],
			['localStorage.removeItem', () => localStorage.removeItem('guide-positive')],
			['localStorage.clear', () => localStorage.clear()],
			['sessionStorage.setItem', () => sessionStorage.setItem('guide-positive', '1')],
			['sessionStorage.removeItem', () => sessionStorage.removeItem('guide-positive')],
			['sessionStorage.clear', () => sessionStorage.clear()],
		];
		for (const [kind, attempt] of attempts) {
			expect(attempt, kind).toThrow(`Guide attempted ${kind}`);
			expect(effects, kind).toEqual([kind]);
			expect(noEffects).toThrow();
			effects.length = 0;
		}
	});
	test('unrelated figures return harmless cleanup functions', () => {
		const scene = window.document.createElement('figure');
		expect(() => { initTools(scene)(); initSettings(scene)(); }).not.toThrow();
	});
});

describe('HataIntro HataCardMaker teaching scene', () => {
	test('retains the card artwork, fictional identity, locked design, and labelled controls', () => {
		const { scene } = mount('card');
		expect(scene.querySelectorAll('svg')).toHaveLength(3);
		expect(get(scene, '[data-card-code-matrix]').getAttribute('d')?.length).toBeGreaterThan(1000);
		expect(scene.textContent).toContain('@haru@example.invalid');
		expect(scene.textContent).toContain('利用開始から1年');
		expect(get<HTMLButtonElement>(scene, '.hgt-c-segment button[disabled]').disabled).toBe(true);
		expect(scene.querySelectorAll('[data-tool-action="card-accent"][aria-label]')).toHaveLength(4);
	});
	test('changes accent and opacity only in the selected card instance', () => {
		const one = mount('card', 'v:one'), two = mount('card', 'v:two');
		click(one.scene, '[data-color="#e76f9a"]');
		input(one.scene, '[data-card-opacity]', '80');
		expect(get(one.scene, '[data-hg-tool]').style.getPropertyValue('--maker-accent')).toBe('#e76f9a');
		expect(get(one.scene, '[data-card-opacity-output]').textContent).toBe('80%');
		expect(get(one.scene, '[data-hg-tool]').style.getPropertyValue('--maker-opacity')).toBe('0.8');
		expect(get(one.scene, '[data-color="#4f8ff7"]').getAttribute('aria-pressed')).toBe('false');
		expect(get(two.scene, '[data-card-opacity-output]').textContent).toBe('55%');
		expect(get(two.scene, '[data-color="#4f8ff7"]').getAttribute('aria-pressed')).toBe('true');
	});
	test('tilts by pointer movement, releases capture, and resets the angle', () => {
		const { scene } = mount('card'), tilt = get(scene, '[data-card-tilt]'), face = get(scene, '[data-card-face]');
		pointer(tilt, 'pointerdown', { clientX: 20, clientY: 20 });
		expect(tilt.hasPointerCapture(1)).toBe(true);
		pointer(tilt, 'pointermove', { clientX: 80, clientY: 50 });
		expect(face.style.transform).toContain('rotateX(-8.6deg)');
		expect(face.style.transition).toBe('none');
		pointer(tilt, 'pointerup');
		expect(tilt.hasPointerCapture(1)).toBe(false);
		expect(tilt.hasAttribute('data-dragging')).toBe(false);
		click(scene, '[data-tool-action="card-reset"]');
		expect(face.style.transform).toContain('rotateX(0deg) rotateY(0deg)');
	});
	test.each(['pointercancel', 'lostpointercapture'])('%s stops further card rotation', type => {
		const { scene } = mount('card'), tilt = get(scene, '[data-card-tilt]'), face = get(scene, '[data-card-face]');
		pointer(tilt, 'pointerdown'); pointer(tilt, 'pointermove', { clientX: 30, clientY: 20 });
		pointer(tilt, type); const transform = face.style.transform;
		pointer(tilt, 'pointermove', { clientX: 180, clientY: 180 });
		expect(face.style.transform).toBe(transform);
		expect(tilt.hasPointerCapture(1)).toBe(false);
	});
	test('save explains the real destination without creating a download or writing data', () => {
		const { scene } = mount('card'); click(scene, '[data-tool-action="card-save"]');
		expect(get(scene, '[data-tool-feedback]').textContent).toContain('保存・ダウンロードしません');
		expect(scene.querySelector('a[download]')).toBeNull();
		noEffects();
	});
	test('cleanup is idempotent and disables listeners even while the element remains connected', () => {
		const { scene, cleanup } = mount('card'), tilt = get(scene, '[data-card-tilt]');
		pointer(tilt, 'pointerdown');
		cleanup(); cleanup();
		const status = get(scene, '[data-tool-feedback]').textContent;
		const transform = get(scene, '[data-card-face]').style.transform;
		click(scene, '[data-tool-action="card-save"]'); input(scene, '[data-card-opacity]', '90'); pointer(tilt, 'pointermove', { clientX: 180 });
		expect(get(scene, '[data-tool-feedback]').textContent).toBe(status);
		expect(get(scene, '[data-card-opacity-output]').textContent).toBe('55%');
		expect(get(scene, '[data-card-face]').style.transform).toBe(transform);
		expect(tilt.hasPointerCapture(1)).toBe(false);
		expect(animationCancel).toHaveBeenCalledTimes(1);
	});
});

describe('HataIntro Hataskey UI settings teaching scene', () => {
	test('keeps the integrated editor, six category targets, eight buffered settings, and disabled mobile example', () => {
		const { scene } = mount('settings');
		expect(get(scene, '.hgu-page')).toBeTruthy();
		expect([...scene.querySelectorAll('[data-hgu-category]')].map(element => element.getAttribute('aria-label'))).toEqual(['ナビ', 'ガラスとぼかし', 'ノート', 'デッキ', 'サイドメニュー', '折りたたみ端末']);
		expect(scene.querySelectorAll('[data-hgu-switch]')).toHaveLength(8);
		expect(get<HTMLButtonElement>(scene, '[data-hgu-action="save"]').disabled).toBe(true);
		expect(get(scene, '[data-hgu-action="save"]').hidden).toBe(false);
		expect(get(scene, '[data-hgu-action="discard"]').hidden).toBe(true);
		expect(scene.querySelectorAll('[data-hgu-bottom] input')).toHaveLength(7);
		expect(scene.querySelectorAll('[data-hgu-bottom] input:checked')).toHaveLength(4);
		expect([...scene.querySelectorAll<HTMLInputElement>('[data-hgu-bottom] input')].every(element => element.disabled)).toBe(true);
	});
	test('isolates IDs, category associations, radio groups, and dirty values across windows', () => {
		const one = mount('settings', 'v:one'), two = mount('settings', 'v:two');
		const ids = [...window.document.querySelectorAll<HTMLElement>('[data-hgu] [id]')].map(element => element.id);
		expect(ids).toHaveLength(12); expect(new Set(ids).size).toBe(ids.length);
		for (const item of [one, two]) for (const control of item.scene.querySelectorAll('[data-hgu-category]')) {
			const target = window.document.getElementById(control.getAttribute('aria-controls') ?? '');
			expect(target).not.toBeNull(); expect(item.scene.contains(target)).toBe(true);
		}
		expect(get<HTMLInputElement>(one.scene, '[data-hgu-foldable-mode]').name).not.toBe(get<HTMLInputElement>(two.scene, '[data-hgu-foldable-mode]').name);
		toggle(one.scene, '[data-hgu-foldable-mode][value="on"]', true);
		toggle(one.scene, '[data-hgu-switch="bubble"]', true);
		expect(get<HTMLInputElement>(two.scene, '[data-hgu-foldable-mode][value="auto"]').checked).toBe(true);
		expect(dirty(one.scene)).toBe('true'); expect(dirty(two.scene)).toBe('false');
	});
	test('counts reversible edits and commits only the teaching snapshot', () => {
		const { scene } = mount('settings');
		toggle(scene, '[data-hgu-switch="bubble"]', true); toggle(scene, '[data-hgu-switch="trending"]', false);
		expect(get(scene, '[data-hgu-unsaved]').textContent).toContain('2件');
		toggle(scene, '[data-hgu-switch="bubble"]', false); toggle(scene, '[data-hgu-switch="trending"]', true);
		expect(dirty(scene)).toBe('false');
		input(scene, '[data-hgu-opacity]', '80'); action(scene, 'save');
		expect(dirty(scene)).toBe('false'); expect(get(scene, '[data-hgu-scroll]').hidden).toBe(false);
		expect(get(scene, '[data-hgu-status]').textContent).toContain('本体や端末にも保存しません');
		input(scene, '[data-hgu-opacity]', '81'); expect(dirty(scene)).toBe('true');
		input(scene, '[data-hgu-opacity]', '80'); expect(dirty(scene)).toBe('false');
	});
	test('preview opens and closes without replacing or clearing buffered inputs', () => {
		const { scene } = mount('settings'), opacity = get<HTMLInputElement>(scene, '[data-hgu-opacity]');
		input(scene, '[data-hgu-opacity]', '80'); toggle(scene, '[data-hgu-switch="bubble"]', true); action(scene, 'preview');
		expect(get<HTMLDialogElement>(scene, '[data-hgu-preview]').open).toBe(true);
		expect(Number(get(scene, '[data-hgu-preview-stage]').style.getPropertyValue('--hgu-preview-opacity'))).toBeCloseTo(0.68);
		expect(get(scene, '[data-hgu-preview-stage]').dataset.bubble).toBe('true');
		expect(scene.querySelectorAll('[data-hgu-preview] input,[data-hgu-preview] select')).toHaveLength(0);
		action(scene, 'preview-close'); expect(get<HTMLDialogElement>(scene, '[data-hgu-preview]').open).toBe(false);
		expect(get(scene, '[data-hgu-opacity]')).toBe(opacity); expect(opacity.value).toBe('80'); expect(dirty(scene)).toBe('true');
	});
	test('deck-width preview keeps the original three-column diagram and respects simple notes', () => {
		const { scene } = mount('settings');
		toggle(scene, '[data-hgu-switch="width"]', true); toggle(scene, '[data-hgu-switch="bubble"]', true); action(scene, 'preview');
		expect(get(scene, '[data-hgu-phone]').hidden).toBe(true); expect(get(scene, '[data-hgu-preview-deck]').hidden).toBe(false);
		expect(scene.querySelectorAll('.hgu-deck-col')).toHaveLength(3); expect(get(scene, '[data-hgu-preview-stage]').dataset.bubble).toBe('false');
		action(scene, 'preview-close'); toggle(scene, '[data-hgu-switch="width"]', false); action(scene, 'preview');
		expect(get(scene, '[data-hgu-phone]').hidden).toBe(false);
	});
	test('discard cancellation retains draft; confirmation restores saved values but not immediate choices', () => {
		const { scene } = mount('settings');
		input(scene, '[data-hgu-opacity]', '80'); action(scene, 'save');
		toggle(scene, '[data-hgu-foldable-mode][value="on"]', true); toggle(scene, '[data-hgu-brand]', false);
		expect(dirty(scene)).toBe('false');
		input(scene, '[data-hgu-opacity]', '10'); action(scene, 'discard');
		expect(get<HTMLDialogElement>(scene, '[data-hgu-confirm]').open).toBe(true);
		action(scene, 'confirm-cancel'); expect(get<HTMLInputElement>(scene, '[data-hgu-opacity]').value).toBe('10');
		action(scene, 'discard'); action(scene, 'confirm-apply');
		expect(get(scene, '[data-hgu-overview]').hidden).toBe(false); expect(get(scene, '[data-hgu-scroll]').hidden).toBe(true);
		expect(get<HTMLInputElement>(scene, '[data-hgu-opacity]').value).toBe('80');
		expect(get<HTMLInputElement>(scene, '[data-hgu-foldable-mode][value="on"]').checked).toBe(true);
		expect(get<HTMLInputElement>(scene, '[data-hgu-brand]').checked).toBe(false);
		expect(window.document.activeElement).toBe(get(scene, '[data-hgu-action="enter"]'));
		action(scene, 'enter'); expect(dirty(scene)).toBe('false'); expect(get(scene, '[data-hgu-scroll]').hidden).toBe(false);
	});
	test('categories and the scroll observer select targets without rebuilding edited controls', () => {
		const { scene } = mount('settings'), opacity = get(scene, '[data-hgu-opacity]');
		input(scene, '[data-hgu-opacity]', '65');
		for (const category of scene.querySelectorAll<HTMLElement>('[data-hgu-category]')) {
			category.click(); expect(scene.querySelectorAll('[data-hgu-category][aria-current="true"]')).toHaveLength(1);
			expect(get(scene, '[data-hgu-opacity]')).toBe(opacity);
		}
		const observer = SceneObserver.instances[0]; expect(observer.targets).toHaveLength(6);
		expect(observer.options.root).toBe(get(scene, '[data-hgu-scroll]'));
		observer.emit('foldable'); expect(get(scene, '[data-hgu-category][aria-current="true"]').dataset.hguCategory).toBe('foldable');
		expect(get<HTMLInputElement>(scene, '[data-hgu-opacity]').value).toBe('65');
	});
	test('nav drag cancellation restores order and pointerup commits it', () => {
		const { scene } = mount('settings');
		hit = get(scene, '[data-nav-id="local"]');
		let grip = get(scene, '[data-hgu-grip="following"]');
		pointer(grip, 'pointerdown'); pointer(grip, 'pointermove', { clientY: 100 });
		expect(order(scene)).toEqual(['local', 'following', 'social', 'mixed']);
		pointer(grip, 'pointercancel'); expect(order(scene)).toEqual(['following', 'local', 'social', 'mixed']);
		expect(grip.hasPointerCapture(1)).toBe(false);
		grip = get(scene, '[data-hgu-grip="following"]'); hit = get(scene, '[data-nav-id="local"]');
		pointer(grip, 'pointerdown'); pointer(grip, 'pointermove', { clientY: 100 }); pointer(grip, 'pointerup');
		expect(order(scene)).toEqual(['local', 'following', 'social', 'mixed']); expect(dirty(scene)).toBe('true');
	});
	test('ignores drag targets in another instance and cancels when pointer capture is lost', () => {
		const one = mount('settings'), two = mount('settings'); const grip = get(one.scene, '[data-hgu-grip="following"]');
		hit = get(two.scene, '[data-nav-id="local"]'); pointer(grip, 'pointerdown'); pointer(grip, 'pointermove', { clientY: 100 });
		expect(order(one.scene)).toEqual(['following', 'local', 'social', 'mixed']);
		grip.releasePointerCapture(1); pointer(grip, 'lostpointercapture');
		hit = get(one.scene, '[data-nav-id="local"]'); pointer(grip, 'pointermove', { clientY: 100 });
		expect(order(one.scene)).toEqual(['following', 'local', 'social', 'mixed']); expect(dirty(two.scene)).toBe('false');
	});
	test('reset leaves nav and immediate choices intact; nav reset leaves opacity intact', () => {
		const { scene } = mount('settings');
		const grip = get(scene, '[data-hgu-grip="following"]'); hit = get(scene, '[data-nav-id="local"]');
		pointer(grip, 'pointerdown'); pointer(grip, 'pointermove', { clientY: 100 }); pointer(grip, 'pointerup');
		toggle(scene, '[data-hgu-brand]', false); input(scene, '[data-hgu-opacity]', '80');
		action(scene, 'reset'); action(scene, 'confirm-apply');
		expect(order(scene)).toEqual(['local', 'following', 'social', 'mixed']); expect(get<HTMLInputElement>(scene, '[data-hgu-opacity]').value).toBe('55');
		expect(get<HTMLInputElement>(scene, '[data-hgu-brand]').checked).toBe(false);
		input(scene, '[data-hgu-opacity]', '65'); action(scene, 'nav-reset'); action(scene, 'confirm-apply');
		expect(order(scene)).toEqual(['following', 'local', 'social', 'mixed']); expect(get<HTMLInputElement>(scene, '[data-hgu-opacity]').value).toBe('65');
	});
	test('cleanup closes dialogs, releases drag, disconnects observer, and disables queued and direct callbacks', () => {
		const one = mount('settings'), two = mount('settings');
		input(one.scene, '[data-hgu-opacity]', '80'); action(one.scene, 'preview');
		const grip = get(one.scene, '[data-hgu-grip="following"]'); pointer(grip, 'pointerdown');
		const observer = SceneObserver.instances[0];
		one.cleanup(); one.cleanup();
		expect(observer.disconnect).toHaveBeenCalledTimes(1); expect(SceneObserver.instances[1].disconnect).not.toHaveBeenCalled();
		expect(get<HTMLDialogElement>(one.scene, '[data-hgu-preview]').open).toBe(false); expect(grip.hasPointerCapture(1)).toBe(false);
		const text = get(one.scene, '[data-hgu-status]').textContent;
		observer.emit('foldable'); input(one.scene, '[data-hgu-opacity]', '90'); action(one.scene, 'preview');
		get(one.scene, '[data-hgu-preview]').dispatchEvent(new Event('close'));
		expect(get(one.scene, '[data-hgu-value]').textContent).toBe('80%'); expect(get(one.scene, '[data-hgu-status]').textContent).toBe(text);
		expect(get<HTMLDialogElement>(one.scene, '[data-hgu-preview]').open).toBe(false);
		expect(get(one.scene, '[data-hgu-category][aria-current="true"]').dataset.hguCategory).toBe('nav');
		toggle(two.scene, '[data-hgu-switch="bubble"]', true); expect(dirty(two.scene)).toBe('true');
	});
});
