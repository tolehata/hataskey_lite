/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, KeepAlive, nextTick, ref } from 'vue';
import { describe, expect, test, vi } from 'vitest';
import source from './SearchMarker.vue?raw';

const routerState = vi.hoisted(() => ({
	currentRef: null as { value: unknown } | null,
	fullPath: '/settings',
}));

vi.mock('@/router.js', () => ({
	useRouter: () => ({
		currentRef: routerState.currentRef ?? { value: null },
		getCurrentFullPath: () => routerState.fullPath,
	}),
}));

vi.mock('@/preferences.js', () => ({
	prefer: { r: { animation: { value: true } } },
}));

vi.mock('@/pages/settings-redesign/SettingsRelatedLinks.vue', async () => {
	const { defineComponent } = await import('vue');
	return { default: defineComponent({ render: () => null }) };
});

import SearchMarker from './SearchMarker.vue';

describe('SearchMarker related-settings integration', () => {
	test('legacy-only marker forwards every related candidate and its typed activation to the shared expander', () => {
		expect(source).toContain('getRelatedSettingsV2(settingsSearchContext.catalog.value, descriptor.value.stableId, Number.MAX_SAFE_INTEGER)');
		expect(source).not.toContain('descriptor.value.stableId, 3)');
		expect(source).toContain('...(related.activation ? { activation: related.activation } : {})');
		expect(source).toContain('<SettingsRelatedLinks');
	});

	test('shellがfooterへ集約した時はlegacy marker直下の関連表示を抑止する', () => {
		expect(source).toContain('if (settingsSearchContext.inlineRelated === false) return [];');
	});

	test('granular controls suppress the duplicate marker-level block, including nested marker ancestry', () => {
		expect(source).toContain('item.source === \'control\'');
		expect(source).toContain('item.legacyMarkerParentId === props.markerId || item.legacyMarkerAncestorIds?.includes(props.markerId ?? \'\')');
	});

	test('related replacement uses the shared 160ms contract and respects app plus OS motion reduction', () => {
		expect(source).toContain('<Transition :name="motionEnabled ? \'settings-related\' : \'\'">');
		expect(source).toContain('transition: opacity 160ms ease, transform 160ms ease;');
		expect(source).not.toContain('transition-duration: 130ms');
		expect(source).not.toContain('transition: opacity 180ms');
		expect(source).toContain('prefer.r.animation?.value !== false && !prefersReducedMotion.value');
		expect(source).toContain('@media (prefers-reduced-motion: reduce)');
	});

	test('KeepAliveのdeactivate中はlistenerとobserverを外し、再activateでhashのhighlightを復元する', async () => {
		const originalHash = window.location.hash;
		const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
		const originalMutationObserver = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
		const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
		const originalFocus = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'focus');
		const mediaListeners = new Set<EventListenerOrEventListenerObject>();
		const mediaQuery = {
			matches: false,
			media: '(prefers-reduced-motion: reduce)',
			onchange: null,
			addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
				if (type === 'change') mediaListeners.add(listener);
			}),
			removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
				if (type === 'change') mediaListeners.delete(listener);
			}),
		} as unknown as MediaQueryList;
		const observer = { observe: vi.fn(), disconnect: vi.fn(), takeRecords: vi.fn(() => []) };
		class MutationObserverMock {
			public constructor(_callback: MutationCallback) {}
			public observe(...args: Parameters<typeof observer.observe>): ReturnType<typeof observer.observe> {
				return observer.observe(...args);
			}
			public disconnect(): ReturnType<typeof observer.disconnect> {
				return observer.disconnect();
			}
			public takeRecords(): ReturnType<typeof observer.takeRecords> {
				return observer.takeRecords();
			}
		}
		Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => mediaQuery) });
		Object.defineProperty(window, 'MutationObserver', { configurable: true, value: MutationObserverMock });
		const scrollIntoView = vi.fn();
		const focus = vi.fn();
		Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
		Object.defineProperty(HTMLElement.prototype, 'focus', { configurable: true, value: focus });
		window.location.hash = '#other-marker';
		routerState.currentRef = ref(null);
		routerState.fullPath = '/settings';

		const addEventListener = vi.spyOn(window, 'addEventListener');
		const removeEventListener = vi.spyOn(window, 'removeEventListener');
		const active = ref(true);
		const Alternate = defineComponent({ name: 'SearchMarkerAlternate', render: () => h('div') });
		const app = createApp(defineComponent({
			setup() {
				return () => h(KeepAlive, null, [active.value
					? h(SearchMarker, { markerId: 'target-marker' })
					: h(Alternate)]);
			},
		}));
		const container = window.document.createElement('div');
		window.document.body.append(container);
		try {
			app.mount(container);
			await nextTick();
			await nextTick();
			const initialRoot = container.querySelector<HTMLElement>('[data-in-app-search-marker-id="target-marker"]');
			if (initialRoot == null) throw new Error('KeepAlive検証用markerを生成できませんでした');
			const inactiveClassName = initialRoot.className;
			expect(addEventListener.mock.calls.filter(([type]) => type === 'hashchange')).toHaveLength(1);
			expect(mediaQuery.addEventListener).toHaveBeenCalledTimes(1);
			expect(observer.observe).toHaveBeenCalledTimes(1);

			active.value = false;
			await nextTick();
			await nextTick();
			expect(removeEventListener.mock.calls.filter(([type]) => type === 'hashchange')).toHaveLength(1);
			expect(mediaQuery.removeEventListener).toHaveBeenCalledTimes(1);
			expect(observer.disconnect).toHaveBeenCalledTimes(1);

			window.location.hash = '#target-marker';
			window.dispatchEvent(new Event('hashchange'));
			routerState.fullPath = '/settings#target-marker';
			routerState.currentRef.value = { route: 'changed-while-hidden' };
			await nextTick();
			expect(scrollIntoView).not.toHaveBeenCalled();
			expect(focus).not.toHaveBeenCalled();
			active.value = true;
			await nextTick();
			await nextTick();
			await nextTick();
			const reactivatedRoot = container.querySelector<HTMLElement>('[data-in-app-search-marker-id="target-marker"]');
			expect(reactivatedRoot?.className).not.toBe(inactiveClassName);
			expect(scrollIntoView).toHaveBeenCalledTimes(1);
			expect(focus).toHaveBeenCalledTimes(1);
			expect(addEventListener.mock.calls.filter(([type]) => type === 'hashchange')).toHaveLength(2);
			expect(mediaQuery.addEventListener).toHaveBeenCalledTimes(2);
			expect(observer.observe).toHaveBeenCalledTimes(2);
		} finally {
			app.unmount();
			container.remove();
			addEventListener.mockRestore();
			removeEventListener.mockRestore();
			if (originalMatchMedia == null) delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
			else Object.defineProperty(window, 'matchMedia', originalMatchMedia);
			if (originalMutationObserver == null) delete (window as { MutationObserver?: typeof window.MutationObserver }).MutationObserver;
			else Object.defineProperty(window, 'MutationObserver', originalMutationObserver);
			if (originalScrollIntoView == null) delete (HTMLElement.prototype as { scrollIntoView?: () => void }).scrollIntoView;
			else Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
			if (originalFocus == null) delete (HTMLElement.prototype as { focus?: () => void }).focus;
			else Object.defineProperty(HTMLElement.prototype, 'focus', originalFocus);
			window.location.hash = originalHash;
			routerState.currentRef = null;
			routerState.fullPath = '/settings';
		}
	});

	test('listenerとobserverのactivation lifecycleは二重登録しない', () => {
		expect(source).toContain('let listenersRegistered = false;');
		expect(source).toContain('let observerRegistered = false;');
		expect(source).toContain('if (listenersRegistered) return;');
		expect(source).toContain('if (!observerRegistered)');
		expect(source).toContain('onActivated(activate);');
		expect(source).toContain('onDeactivated(deactivate);');
		expect(source).toContain('if (!markerActive || activationSynchronizing) return;');
		expect(source).toContain('function focusHighlightedMarker()');
	});
});
