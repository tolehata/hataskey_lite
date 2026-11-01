/* SPDX-License-Identifier: AGPL-3.0-only */
import { defineComponent, getCurrentInstance, h, inject, nextTick, onUnmounted, provide, watch } from 'vue';
import type { Ref } from 'vue';
import type { MenuItem } from '@/types/menu.js';
import type { HataGoesPopupScope, HataGoesPopupSession } from '@/utility/hatagoes-context.js';
import * as os from '@/os.js';
import { captureHk3ComposerMenu } from '@/components/hataskey3/hk3-composer-menu.js';
import { getHTMLElementOrNull } from '@/utility/get-dom-node-or-null.js';
import { DI } from '@/di.js';
import { HATA_GOES_HOST, HATA_GOES_POPUP_SCOPE, HATA_GOES_SESSION, HATA_GOES_THEME } from '@/utility/hatagoes-context.js';

function createDraftScope(): HataGoesPopupScope & { preserve: () => void } {
	const drafts = new Set<() => void>();
	return {
		preserveDraft(save) { drafts.add(save); return () => { drafts.delete(save); }; },
		preserve() {
			for (const save of [...drafts]) {
				try { save(); } catch (error) { console.error('Failed to preserve HataGoes draft', error); }
			}
		},
	};
}

/** A shell owns only the popups opened through its own injection tree. */
export function createHataGoesPopupSession(active: Ref<boolean>): HataGoesPopupSession {
	const open = new Set<() => void>();
	const draftScope = createDraftScope();
	watch(active, value => {
		if (!value) {
			draftScope.preserve();
			for (const close of [...open]) {
				try { close(); } catch (error) { console.error('Failed to close HataGoes popup', error); }
			}
		}
	}, { flush: 'sync' });
	return {
		active,
		track(close) {
			if (!active.value) { close(); return () => {}; }
			open.add(close);
			return () => open.delete(close);
		},
		preserveDraft: draftScope.preserveDraft,
	};
}

/** Capture the launching pane during setup, before asynchronous imports/events. */
export function useHataGoesPopup(): typeof os.popup {
	const host = inject(HATA_GOES_HOST, null);
	const session = inject(HATA_GOES_SESSION, null);
	const theme = inject(HATA_GOES_THEME, null);
	const router = inject(DI.router, null);
	if (!host) return os.popup;
	let ownerAlive = true;
	const owned = new Set<() => void>();
	if (getCurrentInstance()) onUnmounted(() => {
		ownerAlive = false;
		for (const close of [...owned]) {
			try { close(); } catch (error) { console.error('Failed to close HataGoes popup', error); }
		}
	});
	return (component, props, events = {}) => {
		if (!ownerAlive || (session && !session.active.value)) {
			// A delayed import can complete after the source or the shell has gone.
			queueMicrotask(() => (events as { closed?: () => void }).closed?.());
			return { dispose: () => {} };
		}
		const draftScope = createDraftScope();
		const contextualComponent = defineComponent({
			name: 'HataGoesPopupContext',
			inheritAttrs: false,
			setup(_, { attrs }) {
				provide(HATA_GOES_HOST, host);
				if (session) provide(HATA_GOES_SESSION, session);
				provide(HATA_GOES_POPUP_SCOPE, draftScope);
				if (theme) provide(HATA_GOES_THEME, theme);
				if (router) provide(DI.router, router);
				// pageWindowClose intentionally stays with each dialog's close guard.
				return () => {
					const palette = theme?.value;
					return h('div', {
						class: palette?.className,
						'data-hatagoes-palette': palette ? '' : undefined,
						'data-hatask-theme': palette?.hataskTheme,
						'data-hatask-mode': palette?.hataskMode,
						'data-hatady-theme': palette?.hatadyTheme,
						style: { display: 'contents', ...palette?.style },
					}, h(component, attrs));
				};
			},
		});
		let disposed = false;
		let closed = false;
		let forced = false;
		// The synchronous closed callback can run before popup() returns its disposer.
		// eslint-disable-next-line prefer-const
		let underlying: { dispose: () => void } | undefined;
		let untrack = () => {};

		function dispose() {
			if (disposed) return;
			disposed = true;
			owned.delete(close);
			untrack();
			underlying?.dispose();
		}

		function notifyClosed() {
			if (closed) return;
			closed = true;
			const inform = () => {
				try { (events as { closed?: () => void }).closed?.(); } finally { dispose(); }
			};
			if (underlying) inform(); else queueMicrotask(inform);
		}

		function close() {
			if (forced || disposed || closed) return;
			forced = true;
			draftScope.preserve();
			try { notifyClosed(); } finally { dispose(); }
		}

		owned.add(close);
		if (session) untrack = session.track(close);
		if (disposed) return { dispose };
		const guardedEvents = Object.fromEntries(Object.entries(events).map(([name, callback]) => [name,
																																																																																													typeof callback === 'function'
																																																																																														? (...args: unknown[]) => { if (!closed && !disposed) return callback(...args); }
																																																																																														: callback,
		])) as typeof events;
		// A synchronous close from a popup implementation is safe: all handlers
		// exist before the popup returns its underlying disposer.
		underlying = os.popup(contextualComponent, props, { ...guardedEvents, closed: notifyClosed });
		if (disposed) underlying.dispose();
		return { dispose };
	};
}

/** Keep the pane's injection context when the shared popup host mounts a menu elsewhere. */
export function useHataGoesPopupMenu(forceMotion = false): typeof os.popupMenu {
	const host = inject(HATA_GOES_HOST, null);
	const session = inject(HATA_GOES_SESSION, null);
	if (!host && !forceMotion) return os.popupMenu;
	const popup = useHataGoesPopup();
	let ownerAlive = true;
	if (getCurrentInstance()) onUnmounted(() => { ownerAlive = false; });
	const available = () => ownerAlive && (!session || session.active.value);

	function guardMenuItem(item: MenuItem, menuAvailable: () => boolean): MenuItem {
		if (item instanceof Promise) return item.then(result => guardMenuItem(result, menuAvailable)) as MenuItem;
		if (item.type === 'parent') {
			const source = item.children;
			if (Array.isArray(source)) return { ...item, children: source.map(child => guardMenuItem(child, menuAvailable)) };
			return { ...item, children: () => {
				if (!menuAvailable()) return [];
				const children = source();
				return Array.isArray(children) ? children.map(child => guardMenuItem(child, menuAvailable)) : children.then(rows => menuAvailable() ? rows.map(child => guardMenuItem(child, menuAvailable)) : []);
			} };
		}
		if ('action' in item) return { ...item, action: event => { if (menuAvailable()) item.action(event); } } as MenuItem;
		return item;
	}

	return (items, source, options) => {
		let menuClosed = false;
		const menuAvailable = () => !menuClosed && available();
		const anchorElement = source instanceof HTMLElement ? source : null;
		const composerMenu = captureHk3ComposerMenu(anchorElement);
		let returnFocusTo = getHTMLElementOrNull(anchorElement) ?? getHTMLElementOrNull(window.document.activeElement);
		return new Promise<void>((resolve, reject) => {
			void nextTick(async () => {
				if (!menuAvailable()) { composerMenu?.release(); resolve(); return; }
				try {
					const { default: MkPopupMenu } = await import('@/components/MkPopupMenu.vue');
					let dispose = () => {};
					const popupHandle = popup(MkPopupMenu, {
						items: items.filter((item): item is MenuItem => item != null).map(item => guardMenuItem(item, menuAvailable)),
						anchorElement,
						width: options?.width,
						align: options?.align,
						returnFocusTo,
						motionPreset: options?.motionPreset ?? (composerMenu ? 'postform' : undefined),
						appearance: options?.appearance ?? (composerMenu ? 'uiS-composer' : undefined),
						appearanceStyle: composerMenu?.style,
						forceMotion: true,
					}, {
						closed: () => { menuClosed = true; composerMenu?.release(); resolve(); dispose(); returnFocusTo = null; },
						closing: () => options?.onClosing?.(),
					});
					dispose = popupHandle.dispose;
				} catch (error) {
					menuClosed = true;
					composerMenu?.release();
					reject(error);
				}
			});
		});
	};
}
