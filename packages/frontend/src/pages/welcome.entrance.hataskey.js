/*
 * SPDX-FileCopyrightText: syuilo and misskey-project / hatacha
 * SPDX-License-Identifier: AGPL-3.0-only
 * Faithful landing-page migration; source SHA-256: d1f18ce4af591e56161ca7a7ba13b48c612d6ffc087f1a7e8f55abb19f4b9b6c
 */
/* global document, getComputedStyle, IntersectionObserver, performance, ResizeObserver, window */

const HK = '/client-assets/hatakyu/';
const MOODS = ['ti ti-mood-happy', 'ti ti-mood-smile', 'ti ti-mood-neutral', 'ti ti-mood-happy', 'ti ti-mood-smile', '', ''];
const DOW = ['月', '火', '水', '木', '金', '土', '日'];
const FEATURE_HOLD_MS = 3600;

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

export class HataskeyWelcomeController {
	get viewportHeight() { return this.root?.clientHeight || window.innerHeight; }
	get viewportWidth() { return this.root?.clientWidth || window.innerWidth; }
	scheduleTimeout(callback, delay) { const id = window.setTimeout(() => { this.timeouts.delete(id); if (!this.destroyed) callback(); }, delay); this.timeouts.add(id); return id; }
	cancelTimeout(id) { window.clearTimeout(id); this.timeouts.delete(id); }
	scheduleInterval(callback, delay) { const id = window.setInterval(() => { if (!this.destroyed) callback(); }, delay); this.intervals.add(id); return id; }
	cancelInterval(id) { window.clearInterval(id); this.intervals.delete(id); }
	scheduleFrame(callback) { const id = window.requestAnimationFrame(time => { this.frames.delete(id); if (!this.destroyed) callback(time); }); this.frames.add(id); return id; }
	cancelFrame(id) { window.cancelAnimationFrame(id); this.frames.delete(id); }
	requestMeasure() { if (this.measureFrame || this.destroyed) return; this.measureFrame = this.scheduleFrame(() => { this.measureFrame = null; this.measure(); this.dirty = true; }); }
	setLanguage(language) { const button = this.root?.querySelector('[data-lang="' + language + '"]'); if (button) this.selectLang({ currentTarget: button }); }
	mount() {
		this.componentDidMount();
		if (typeof ResizeObserver === 'function') {
			this.layoutObserver = new ResizeObserver(() => this.requestMeasure());
			this.layoutObserver.observe(this.root);
			this.root.querySelectorAll('section[id]').forEach(section => this.layoutObserver.observe(section));
		}
	}
	destroy() {
		this.destroyed = true;
		this.componentWillUnmount();
		this.layoutObserver?.disconnect();
		this.timeouts.forEach(id => window.clearTimeout(id));
		this.intervals.forEach(id => window.clearInterval(id));
		this.frames.forEach(id => window.cancelAnimationFrame(id));
		this.timeouts.clear(); this.intervals.clear(); this.frames.clear();
		this.root = null;
	}
	constructor(options = {}) {
		this.options = options;
		this.timeouts = new Set();
		this.intervals = new Set();
		this.frames = new Set();
		this.destroyed = false;
		this.lang = 'ja';
		this.rootRef = (el) => { this.root = el; };
	}

	setupFediverse() {
		this.teardownFediverse();
		this.fediverseSection = this.root.querySelector('#fediverse');
		if (!this.fediverseSection) return;
		this.fediverseListeners = [];
		this.fediverseFocused = false;
		this.fediverseVisible = !('IntersectionObserver' in window);
		this.fediverseMap = this.fediverseSection.querySelector('.fediverse-map');
		this.fediverseMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		this.fediverseSection.dataset.fediverseStage = 'waiting';
		this.fediverseSection.dataset.fediverseMoving = 'false';
		this.setFediversePrimerExpanded(false, false);
		const listen = (target, type, handler) => {
			target.addEventListener(type, handler);
			this.fediverseListeners.push(() => target.removeEventListener(type, handler));
		};
		listen(this.fediverseSection, 'click', (event) => {
			const primerToggle = event.target.closest?.('[data-fediverse-primer-toggle]');
			if (primerToggle && this.fediverseSection?.contains(primerToggle)) {
				this.setFediversePrimerExpanded(primerToggle.getAttribute('aria-expanded') !== 'true');
				return;
			}
			const noteLink = event.target.closest?.('.fediverse-footnote-ref');
			if (noteLink && this.fediverseSection?.contains(noteLink)) {
				const rights = this.root.querySelector('#fediverse-rights');
				if (rights) {
					rights.open = true;
					this.measure?.();
					this.dirty = true;
				}
				return;
			}
			const button = event.target.closest?.('[data-federation-preview]');
			if (!button || !this.fediverseSection?.contains(button)) return;
			this.setFederationMode(button.dataset.federationPreview);
		});
		listen(this.fediverseSection, 'focusin', () => {
			this.fediverseFocused = true;
			this.finishFediverseEntrance();
			this.syncFediverseMotion();
		});
		listen(this.fediverseSection, 'focusout', (event) => {
			if (this.fediverseSection?.contains(event.relatedTarget)) return;
			this.fediverseFocused = false;
			this.syncFediverseMotion();
		});
		listen(document, 'visibilitychange', () => {
			if (document.hidden) this.finishFediverseEntrance();
			this.syncFediverseMotion();
		});
		if (this.fediverseMotionQuery?.addEventListener) listen(this.fediverseMotionQuery, 'change', () => this.syncFediverseMotion());
		if ('IntersectionObserver' in window) {
			this.fediverseObserver = new IntersectionObserver((entries) => {
				for (const entry of entries) {
					this.fediverseVisible = entry.isIntersecting && entry.intersectionRatio >= .08;
					if (!this.fediverseVisible) {
						this.finishFediverseEntrance();
						if (this.fediverseSection) this.fediverseSection.dataset.fediverseStage = 'waiting';
					}
					this.syncFediverseMotion();
				}
			}, { root: this.root, threshold: [0, .08], rootMargin: '0px 0px -3% 0px' });
			this.fediverseObserver.observe(this.fediverseMap || this.fediverseSection);
		}
		const mode = this.options.federationMode ?? 'unknown';
		this.setFederationMode(mode);
		this.syncFediverseMotion();
	}

	setFederationMode(mode) {
		if (!this.fediverseSection) return;
		const next = ['all', 'none', 'specified', 'unknown'].includes(mode) ? mode : 'unknown';
		this.root.dataset.federationMode = next;
		this.fediverseSection.dataset.federationMode = next;
		this.root.querySelectorAll('.federation-belt').forEach(belt => { belt.hidden = next !== 'all'; });
		this.root.querySelectorAll('.federation-status-notice').forEach(notice => { notice.hidden = next === 'all'; });
		this.fediverseSection.querySelectorAll('[data-federation-preview]').forEach(button => {
			button.setAttribute('aria-pressed', String(button.dataset.federationPreview === next));
		});
		this.refreshFediverseLanguage();
		this.queueFediverseMeasure();
	}

	setFediversePrimerExpanded(expanded, measure = true) {
		if (!this.fediverseSection) return;
		const toggle = this.fediverseSection.querySelector('[data-fediverse-primer-toggle]');
		const panel = this.fediverseSection.querySelector('[data-fediverse-primer-panel]');
		const disclosure = toggle?.closest('.fediverse-primer-disclosure');
		if (!toggle || !panel || !disclosure) return;
		const next = !!expanded;
		if (!next && panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
		toggle.setAttribute('aria-expanded', String(next));
		panel.setAttribute('aria-hidden', String(!next));
		panel.inert = !next;
		disclosure.dataset.fediversePrimerState = next ? 'open' : 'closed';
		if (!measure) return;
		this.queueFediverseMeasure();
		if (this.fediversePrimerMeasureTimer) this.cancelTimeout(this.fediversePrimerMeasureTimer);
		this.fediversePrimerMeasureTimer = this.scheduleTimeout(() => {
			this.fediversePrimerMeasureTimer = null;
			this.queueFediverseMeasure();
		}, this.fediverseMotionQuery?.matches ? 0 : 440);
	}

	queueFediverseMeasure() {
		if (this.fediverseMeasureFrame) this.cancelFrame(this.fediverseMeasureFrame);
		this.fediverseMeasureFrame = this.scheduleFrame(() => {
			this.fediverseMeasureFrame = null;
			if (!this.fediverseSection) return;
			this.measure?.();
			this.dirty = true;
		});
	}

	refreshFediverseLanguage() {
		if (!this.fediverseSection) return;
		const english = this.lang === 'en';
		const mode = this.root.dataset.federationMode;
		const status = {
			all: { ja: 'このサーバーでは、ほかのサーバーとの連合が有効になっています', en: 'Federation is enabled on this server.', compactJa: 'このサーバーの連合は有効です', compactEn: 'Federation is enabled.' },
			none: { ja: 'このサーバーでは、ほかのサーバーとの連合は有効になっていません', en: 'Federation with other servers is not enabled on this server.', compactJa: 'このサーバーの連合は無効です', compactEn: 'Federation is disabled.' },
			specified: { ja: 'このサーバーは特定のサーバーのみと連合しています', en: 'This server federates only with selected servers.', compactJa: '連合先は特定のサーバーのみです', compactEn: 'Federation is limited.' },
			unknown: { ja: 'このサーバーの連合設定は、まだ確認できていません', en: 'This server’s federation settings have not been confirmed.', compactJa: '連合状態を確認できません', compactEn: 'Federation status is unknown.' },
		};
		const copy = status[mode] || status.unknown;
		this.root.querySelectorAll('[data-federation-status-copy-wide]').forEach(node => { node.textContent = english ? copy.en : copy.ja; });
		this.root.querySelectorAll('[data-federation-status-copy-compact]').forEach(node => { node.textContent = english ? copy.compactEn : copy.compactJa; });
	}

	syncFediverseMotion() {
		const section = this.fediverseSection;
		if (!section) return;
		const reduced = !!this.fediverseMotionQuery?.matches;
		if (!this.fediverseVisible || document.hidden || this.fediverseFocused || reduced) {
			if (section.dataset.fediverseStage === 'entering' || reduced) this.finishFediverseEntrance();
			section.dataset.fediverseMoving = 'false';
			return;
		}
		if (section.dataset.fediverseStage === 'waiting') this.startFediverseEntrance();
	}

	startFediverseEntrance() {
		const section = this.fediverseSection;
		if (!section || this.fediverseMotionQuery?.matches || document.hidden || this.fediverseFocused || !this.fediverseVisible) return;
		if (this.fediverseEntranceTimer) this.cancelTimeout(this.fediverseEntranceTimer);
		section.dataset.fediverseStage = 'entering';
		section.dataset.fediverseMoving = 'true';
		// Each visit plays a short introduction once. Text headings own their observers.
		this.fediverseEntranceTimer = this.scheduleTimeout(() => this.finishFediverseEntrance(), 1600);
	}

	finishFediverseEntrance() {
		if (this.fediverseEntranceTimer) this.cancelTimeout(this.fediverseEntranceTimer);
		this.fediverseEntranceTimer = null;
		if (!this.fediverseSection) return;
		this.fediverseSection.dataset.fediverseStage = 'complete';
		this.fediverseSection.dataset.fediverseMoving = 'false';
	}

	teardownFediverse() {
		this.finishFediverseEntrance();
		if (this.fediversePrimerMeasureTimer) this.cancelTimeout(this.fediversePrimerMeasureTimer);
		this.fediversePrimerMeasureTimer = null;
		if (this.fediverseMeasureFrame) this.cancelFrame(this.fediverseMeasureFrame);
		this.fediverseMeasureFrame = null;
		this.fediverseObserver?.disconnect();
		this.fediverseObserver = null;
		(this.fediverseListeners || []).forEach(remove => remove());
		this.fediverseListeners = [];
		if (this.fediverseSection) this.fediverseSection.dataset.fediverseMoving = 'false';
		this.fediverseSection = null;
		this.fediverseMap = null;
		this.fediverseMotionQuery = null;
	}

	componentDidMount() {
		this.collectLang();
		this.setupColorMode();
		this.setupHeaderMenus();
		this.setupMotionPreference();
		this.setupSymbolHeadings();
		this.setupFediverse();
		this.setupTextMotion();
		document.fonts?.ready?.then?.(() => {
			if (!this.root) return;
			this.measure();
			this.dirty = true;
		});
	}

	componentWillUnmount() {
		this.teardownFediverse();
		if (this.raf) this.cancelFrame(this.raf);
		if (this.raf2) this.cancelFrame(this.raf2);
		if (this.onWindowResize) window.removeEventListener('resize', this.onWindowResize);
		if (this.onHeaderPointerDown) document.removeEventListener('pointerdown', this.onHeaderPointerDown);
		if (this.onHeaderKeyDown) document.removeEventListener('keydown', this.onHeaderKeyDown);
		if (this.onHeaderToggle) document.removeEventListener('toggle', this.onHeaderToggle, true);
		if (this.motionQuery && this.onMotionChange) {
			if (this.motionQuery.removeEventListener) this.motionQuery.removeEventListener('change', this.onMotionChange);
			else this.motionQuery.removeListener?.(this.onMotionChange);
		}
		if (this.colorSchemeQuery && this.onSystemColorChange) {
			if (this.colorSchemeQuery.removeEventListener) this.colorSchemeQuery.removeEventListener('change', this.onSystemColorChange);
			else this.colorSchemeQuery.removeListener?.(this.onSystemColorChange);
		}
		this.symbolHeadingObserver?.disconnect();
		if (this.onSymbolAnimationEnd) this.root?.removeEventListener('animationend', this.onSymbolAnimationEnd);
		(this.symbolHeadings || []).forEach(heading => {
			if (heading._symbolTimer) this.cancelTimeout(heading._symbolTimer);
			if (heading._symbolQueueTimer) this.cancelTimeout(heading._symbolQueueTimer);
		});
		if (this.themeTransitionTimer) this.cancelTimeout(this.themeTransitionTimer);
		this.themeViewTransition?.skipTransition?.();
		this.scrollBound = false;
	}

	setupHeaderMenus() {
		const close = (menu) => {
			menu.querySelectorAll('.visitor-submenu[open]').forEach(submenu => submenu.removeAttribute('open'));
			menu.removeAttribute('open');
		};
		this.onHeaderPointerDown = (ev) => {
			const current = ev.target.closest?.('[data-header-menu]');
			this.root.querySelectorAll('[data-header-menu][open]').forEach(menu => {
				if (menu !== current) close(menu);
			});
		};
		this.onHeaderKeyDown = (ev) => {
			if (ev.key !== 'Escape') return;
			const open = Array.from(this.root.querySelectorAll('[data-header-menu][open]')).pop();
			if (!open) return;
			const child = Array.from(open.querySelectorAll('.visitor-submenu[open]')).pop();
			if (child) {
				child.removeAttribute('open');
				child.querySelector(':scope > summary')?.focus();
				return;
			}
			close(open);
			open.querySelector(':scope > summary')?.focus();
		};
		this.onHeaderToggle = (ev) => {
			const current = ev.target;
			if (current.matches?.('[data-header-menu][open]')) {
				this.root.querySelectorAll('[data-header-menu][open]').forEach(menu => {
					if (menu !== current) close(menu);
				});
			} else if (current.matches?.('.visitor-submenu[open]')) {
				current.closest('[data-header-menu]')?.querySelectorAll('.visitor-submenu[open]').forEach(submenu => {
					if (submenu !== current) submenu.removeAttribute('open');
				});
			}
		};
		document.addEventListener('pointerdown', this.onHeaderPointerDown);
		document.addEventListener('keydown', this.onHeaderKeyDown);
		document.addEventListener('toggle', this.onHeaderToggle, true);
	}

	finishSymbolHeading(heading) {
		if (!heading) return;
		if (heading._symbolTimer) {
			this.cancelTimeout(heading._symbolTimer);
			heading._symbolTimer = null;
		}
		if (heading._symbolQueueTimer) {
			this.cancelTimeout(heading._symbolQueueTimer);
			heading._symbolQueueTimer = null;
		}
		heading.dataset.symbolState = 'done';
	}

	resetSymbolHeading(heading) {
		if (!heading) return;
		if (heading.dataset.symbolState === 'playing' || heading.dataset.symbolState === 'done') return;
		if (heading._symbolTimer) this.cancelTimeout(heading._symbolTimer);
		if (heading._symbolQueueTimer) this.cancelTimeout(heading._symbolQueueTimer);
		heading._symbolTimer = null;
		heading._symbolQueueTimer = null;
		heading.dataset.symbolState = this.motionQuery?.matches ? 'done' : 'ready';
	}

	queueSymbolHeading(heading) {
		if (!heading || heading.dataset.symbolState !== 'ready' || heading._symbolQueueTimer) return;
		heading._symbolQueueTimer = this.scheduleTimeout(() => {
			heading._symbolQueueTimer = null;
			this.playSymbolHeading(heading);
		}, 540);
	}

	playSymbolHeading(heading) {
		if (!heading || heading.dataset.symbolState !== 'ready') return;
		heading.dataset.symbolState = 'playing';
		heading._symbolTimer = this.scheduleTimeout(() => this.finishSymbolHeading(heading), 4600);
	}

	setupSymbolHeadings() {
		this.symbolHeadingObserver?.disconnect();
		if (this.onSymbolAnimationEnd) this.root.removeEventListener('animationend', this.onSymbolAnimationEnd);
		(this.symbolHeadings || []).forEach(heading => this.resetSymbolHeading(heading));
		this.symbolHeadings = Array.from(this.root.querySelectorAll('[data-symbol-heading]'));
		if (!this.symbolHeadings.length) return;
		this.onSymbolAnimationEnd = (ev) => {
			const target = ev.target;
			if (!target?.hasAttribute?.('data-symbol-last')) return;
			const heading = target.closest('[data-symbol-heading]');
			if (heading?.dataset.symbolState === 'playing') this.finishSymbolHeading(heading);
		};
		this.root.addEventListener('animationend', this.onSymbolAnimationEnd);
		if (this.motionQuery?.matches || !('IntersectionObserver' in window)) {
			this.symbolHeadings.forEach(heading => this.finishSymbolHeading(heading));
			return;
		}
		this.symbolHeadings.forEach(heading => this.resetSymbolHeading(heading));
		this.symbolHeadingObserver = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting && entry.intersectionRatio >= .34) this.queueSymbolHeading(entry.target);
				else if (!entry.isIntersecting && entry.target.dataset.symbolState === 'ready') this.resetSymbolHeading(entry.target);
			});
		}, { root: this.root, threshold: [0, .34], rootMargin: '0px 0px -8% 0px' });
		this.symbolHeadings.forEach(heading => this.symbolHeadingObserver.observe(heading));
	}

	syncSymbolMotionPreference() {
		if (this.motionQuery?.matches) {
			this.symbolHeadingObserver?.disconnect();
			(this.symbolHeadings || []).forEach(heading => this.finishSymbolHeading(heading));
		} else {
			this.setupSymbolHeadings();
		}
	}

	setupMotionPreference() {
		this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		this.onMotionChange = () => this.scheduleFrame(() => {
			if (!this.root) return;
			this.syncSymbolMotionPreference();
			this.measure();
			this.dirty = true;
		});
		if (this.motionQuery.addEventListener) this.motionQuery.addEventListener('change', this.onMotionChange);
		else this.motionQuery.addListener?.(this.onMotionChange);
	}


	/* ---------- カラーモード／ページ移動 ---------- */
	setupColorMode() {
		this.colorMode = this.options.colorMode || 'light';
		this.updateColorModeControl();
	}

	updateColorModeControl() {
		if (!this.root || !this.colorMode) return;
		this.root.dataset.colorMode = this.colorMode;
		const dark = this.colorMode === 'dark';
		const button = this.root.querySelector('.theme-toggle');
		if (!button) return;
		const label = this.lang === 'en'
			? (dark ? 'Switch to light mode' : 'Switch to dark mode')
			: (dark ? 'ライトモードに切り替える' : 'ダークモードに切り替える');
		button.setAttribute('aria-label', label);
		button.setAttribute('title', label);
		button.setAttribute('aria-pressed', String(dark));
		const icon = button.querySelector('[data-theme-icon]');
		if (icon) icon.className = dark ? 'ti ti-moon' : 'ti ti-sun';
	}

	applyColorMode(nextMode, animate = true) {
		if (this.destroyed || !this.root || nextMode === this.colorMode) return;
		// The client owns the view transition. Only animate colors locally on older browsers.
		if (animate && typeof document.startViewTransition !== 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			this.root.dataset.themeTransitioning = 'true';
			if (this.themeTransitionTimer) this.cancelTimeout(this.themeTransitionTimer);
			this.themeTransitionTimer = this.scheduleTimeout(() => {
				if (this.root) delete this.root.dataset.themeTransitioning;
			}, 440);
		}
		this.colorMode = nextMode;
		this.updateColorModeControl();
		this.setupBackdrop();
		this.dirty = true;
	}

	toggleColorMode = () => {
		this.colorModeManual = true;
		this.applyColorMode(this.colorMode === 'dark' ? 'light' : 'dark');
	};

	scrollToTop = () => {
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		this.root.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
	};

	tickBackToTop(y) {
		const button = this.backToTop || (this.backToTop = this.root.querySelector('.back-to-top'));
		if (!button) return;
		const visible = y > Math.max(480, this.viewportHeight * .7);
		if (visible === this.backToTopVisible) return;
		this.backToTopVisible = visible;
		button.dataset.visible = String(visible);
		button.setAttribute('aria-hidden', String(!visible));
		button.tabIndex = visible ? 0 : -1;
	}

	tickHeaderIdentity() {
		const identity = this.headerIdentity || (this.headerIdentity = this.root.querySelector('[data-header-identity]'));
		const firstFeature = this.root.querySelector('#fediverse') || this.root.querySelector('#ui');
		if (!identity || !firstFeature) return;
		const passed = firstFeature.getBoundingClientRect().top - this.root.getBoundingClientRect().top <= 72;
		if (passed === this.headerIdentityVisible) return;
		this.headerIdentityVisible = passed;
		this.root.dataset.heroPassed = String(passed);
		identity.setAttribute('aria-hidden', String(!passed));
		identity.tabIndex = passed ? 0 : -1;
	}

	/* ---------- 言語 ---------- */
	collectLang() {
		if (!this.root) return;
		this.langEntries = Array.from(this.root.querySelectorAll('[data-en]')).map(el => ({
			el,
			en: el.dataset.en,
			jaHtml: el.innerHTML,
			preserveChildren: !el.querySelector('br') && Array.from(el.childNodes).some(node => node.nodeType === 3 && node.textContent.trim()) && el.children.length > 0,
		}));
		this.root.querySelectorAll('[data-aria-en]').forEach(el => { el.dataset.ariaJa = el.getAttribute('aria-label') || ''; });
		this.root.querySelectorAll('[data-placeholder-en]').forEach(el => { el.dataset.placeholderJa = el.getAttribute('placeholder') || ''; });
	}
	selectLang = (ev) => {
		const nextLang = ev.currentTarget.dataset.lang;
		if (nextLang !== 'ja' && nextLang !== 'en') return;
		this.root.lang = nextLang;
		if (this.lang !== nextLang) {
			this.lang = nextLang;
			(this.langEntries || []).forEach(entry => {
				const { el } = entry;
				if (this.lang === 'ja') {
					el.innerHTML = entry.jaHtml;
				} else if (entry.preserveChildren) {
					el.innerHTML = entry.jaHtml;
					const labels = Array.from(el.childNodes).filter(node => node.nodeType === 3 && node.textContent.trim());
					if (labels.length) {
						labels[0].textContent = entry.en;
						labels.slice(1).forEach(node => { node.textContent = ''; });
					} else {
						el.textContent = entry.en;
					}
				} else {
					el.textContent = entry.en;
				}
			});
			this.root.querySelectorAll('[data-aria-en]').forEach(el => {
				el.setAttribute('aria-label', this.lang === 'en' ? el.dataset.ariaEn : el.dataset.ariaJa);
			});
			this.root.querySelectorAll('[data-postlabel]').forEach(el => {
				el.textContent = this.lang === 'en' ? 'Note' : 'ノート';
			});
			this.root.querySelectorAll('[data-placeholder-en]').forEach(el => {
				el.setAttribute('placeholder', this.lang === 'en' ? el.dataset.placeholderEn : el.dataset.placeholderJa);
			});
			this.updateColorModeControl();
			this.refreshFediverseLanguage();
			this.root.querySelectorAll('[data-splitdone]').forEach(el => { delete el.dataset.splitdone; });
			this.setupTextMotion();
			this.scheduleFrame(() => { this.measure(); this.dirty = true; });
		}
		this.root.querySelectorAll('[data-lang-choice]').forEach(button => {
			const active = button.dataset.lang === this.lang;
			button.setAttribute('aria-pressed', String(active));
			const check = button.querySelector('[data-language-check]');
			if (check) check.hidden = !active;
		});
		this.closeVisitorMenu(ev);
	};

	closeVisitorMenu = (ev) => {
		const menu = ev.currentTarget.closest('[data-header-menu]');
		if (!menu) return;
		const summary = menu.querySelector(':scope > summary');
		const restoreFocus = menu.contains(document.activeElement);
		menu.querySelectorAll('.visitor-submenu[open]').forEach(submenu => submenu.removeAttribute('open'));
		menu.removeAttribute('open');
		if (restoreFocus) this.scheduleFrame(() => summary?.focus({ preventScroll: true }));
	};

	/* ---------- 文字ごとの登場／退場 ---------- */
	setupTextMotion() {
		if (!this.root) return;
		const targets = [...this.root.querySelectorAll('h2:not([data-no-split]), h1:not([data-no-split])')]
			.filter(heading => !heading.closest('[data-welcome-app-preview]'));
		if (this.textObs) this.textObs.disconnect();
		targets.forEach(h => {
			if (h.dataset.splitdone) return;
			h.dataset.splitdone = '1';
			const frag = document.createDocumentFragment();
			Array.from(h.childNodes).forEach(node => {
				if (node.nodeName === 'BR') { frag.appendChild(node.cloneNode()); return; }
				const text = node.textContent || '';
				for (const ch of text) {
					if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); continue; }
					const s = document.createElement('span');
					s.textContent = ch;
					s.style.display = 'inline-block';
					s.style.opacity = '0';
					s.style.willChange = 'transform,opacity';
					frag.appendChild(s);
				}
			});
			h.textContent = '';
			h.appendChild(frag);
		});
		this.headings = Array.from(targets);
		this.headings.forEach(h => { h.querySelectorAll('span').forEach(sp => { sp.style.opacity = '0'; }); });
		this.setupReveal();
		this.bindScroll();
	}

	/* ---------- 一本の映像のように流れる登場 ---------- */
	setupReveal() {
		if (this.revealDone) return;
		this.revealDone = true;
		const els = Array.from(this.root.querySelectorAll('section [style*="animation"]'));
		this.reveals = [];
		els.forEach(el => {
			const name = el.style.animationName;
			if (!name || name === 'none') return;
			if (/marquee|pulseDot|hkSway|floatY|trail|fly|deckPaneIn|noteIn|hyHeatIn|hyBlockIn|bloom|htkItem|hkPin/.test(name)) return;
			let fx;
			if (/fromLeft/.test(name)) fx = { x: -150, y: 0, r: -5, s: 0.94, b: 6 };
			else if (/fromRight/.test(name)) fx = { x: 150, y: 0, r: 5, s: 0.94, b: 6 };
			else if (/spinIn/.test(name)) fx = { x: 90, y: 0, r: 0, s: 0.92, b: 7, ry: -34 };
			else if (/colIn|fromBelow|riseIn/.test(name)) fx = { x: 0, y: 150, r: 2, s: 0.9, b: 8 };
			else fx = { x: 0, y: 58, r: 0, s: 0.985, b: 1.5 };
			el.style.animation = 'none';
			el.style.willChange = 'transform,opacity,filter';
			el.style.backfaceVisibility = 'hidden';
			el._fx = fx;
			el._p = -1;
			this.reveals.push(el);
		});
	}

	applyReveal(el, p) {
		if (this.motionQuery?.matches) p = 1;
		if (Math.abs(p - el._p) < 0.004) return;
		el._p = p;
		const e = 1 - Math.pow(1 - p, 3.2);
		const f = el._fx;
		const inv = 1 - e;
		const ry = f.ry ? ` rotateY(${(f.ry * inv).toFixed(2)}deg)` : '';
		el.style.transform = `translate3d(${(f.x * inv).toFixed(2)}px, ${(f.y * inv).toFixed(2)}px, 0) rotate(${(f.r * inv).toFixed(2)}deg) scale(${(1 - (1 - f.s) * inv).toFixed(4)})${ry}`;
		el.style.opacity = String(Math.min(1, e * 1.25).toFixed(3));
		el.style.filter = inv > 0.02 ? `blur(${(f.b * inv).toFixed(2)}px)` : 'none';
		if (f.ry) el.style.perspective = '1400px';
	}

	/* ---------- 章ごとに違う文字の動き ---------- */
	headingMode(h) {
		const sec = h.closest('section');
		const id = sec ? sec.id : '';
		const map = { top: 'stretch', join: 'drop' };
		return map[id] || 'wipe';
	}

	applyHeading(h, p) {
		if (this.motionQuery?.matches) p = 1;
		const spans = h._spans || (h._spans = Array.from(h.querySelectorAll('span')));
		const mode = h._mode || (h._mode = this.headingMode(h));
		const n = spans.length || 1;
		if (h._rand === undefined) {
			h._rand = spans.map((_, i) => [(Math.sin(i * 12.9898) * 43758.5453 % 1), (Math.sin(i * 78.233) * 12345.6789 % 1)]);
		}
		spans.forEach((sp, i) => {
			const start = (i / n) * 0.55;
			let q = (p - start) / (1 - 0.55);
			q = q < 0 ? 0 : q > 1 ? 1 : q;
			const e = 1 - Math.pow(1 - q, 3.4);
			const inv = 1 - e;
			let t = '';
			if (mode === 'stretch') {
				t = `translate3d(0,${(26 * inv).toFixed(2)}px,0) scale(${(1 + 1.1 * inv).toFixed(3)},${(1 - 0.42 * inv).toFixed(3)})`;
			} else if (mode === 'scatter') {
				const r = h._rand[i];
				t = `translate3d(${((r[0] - 0.5) * 210 * inv).toFixed(2)}px,${((r[1] - 0.5) * 150 * inv).toFixed(2)}px,0) rotate(${((r[0] - 0.5) * 90 * inv).toFixed(2)}deg) scale(${(1 - 0.35 * inv).toFixed(3)})`;
			} else if (mode === 'gather') {
				const dir = i < n / 2 ? -1 : 1;
				t = `translate3d(${(dir * 120 * inv).toFixed(2)}px,0,0) scale(${(1 - 0.2 * inv).toFixed(3)})`;
			} else if (mode === 'drop') {
				t = `translate3d(0,${(-70 * inv).toFixed(2)}px,0) rotate(${(-16 * inv).toFixed(2)}deg)`;
			} else {
				t = `translate3d(0,${(88 * inv).toFixed(2)}px,0) rotate(${(5 * inv).toFixed(2)}deg)`;
			}
			sp.style.animation = 'none';
			sp.style.transform = t;
			sp.style.opacity = String(Math.min(1, e * 1.5).toFixed(3));
			sp.style.filter = inv > 0.05 ? `blur(${(5 * inv).toFixed(2)}px)` : 'none';
		});
		if (!h._prepped) {
			h._prepped = true;
			h.style.overflow = mode === 'wipe' ? 'hidden' : '';
			h.style.paddingBottom = mode === 'wipe' ? '.12em' : '';
			spans.forEach(sp => { sp.style.willChange = 'transform,opacity'; sp.style.transformOrigin = 'center bottom'; });
		}
	}

	bindScroll() {
		if (this.scrollBound) return;
		this.scrollBound = true;
		this.setupBackdrop();
		const clamp = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
		this.measure();
		this.onWindowResize = () => { this.measure(); this.dirty = true; };
		window.addEventListener('resize', this.onWindowResize);
		this.lastY = -1;
		this.dirty = true;
		const frame = () => {
			const y = this.root.scrollTop;
			if (y !== this.lastY || this.dirty) {
				this.lastY = y;
				this.dirty = false;
				const vh = this.viewportHeight;
				const inA = vh * 1.05, inB = vh * 0.52;
				(this.headings || []).forEach(h => {
					const top = h._top - y;
					if (top + h._h < -vh * 0.4 || top > vh * 1.3) return;
					this.applyHeading(h, clamp((inA - top) / (inA - inB)));
				});
				(this.reveals || []).forEach(el => {
					const top = el._top - y;
					if (top + el._h < -vh * 0.3 || top > vh * 1.25) return;
					this.applyReveal(el, clamp((vh * 1.0 - top) / (vh * 0.4)));
				});
				this.tickBackdrop(y);
				this.tickBackToTop(y);
				this.tickHeaderIdentity();
				this.tickPlane(y);
			}
			this.raf2 = this.scheduleFrame(frame);
		};
		this.raf2 = this.scheduleFrame(frame);
	}

	/* ---------- 位置を一度だけ測る（毎フレームのレイアウト計算を避ける） ---------- */
	measure() {
		const m = (el) => {
			let top = 0;
			for (let node = el; node && node !== this.root; node = node.offsetParent) top += node.offsetTop;
			el._top = top;
			el._h = el.offsetHeight;
		};
		(this.headings || []).forEach(m);
		(this.reveals || []).forEach(m);
		if (this.sections) this.sections.forEach(sc => m(sc.el));
		const p = this.root.querySelector('[data-plane]');
		if (p) { m(p.parentElement); this.planeHost = p.parentElement; }
	}

	/* ---------- 締めの飛行機 ---------- */
	tickPlane(sy) {
		if (this.motionQuery?.matches) return;
		const p = this.plane || (this.plane = this.root.querySelector('[data-plane]'));
		if (!p) return;
		const host = p.parentElement;
		const vh = this.viewportHeight;
		let t = (vh * 0.95 - ((host._top || 0) - (sy || 0))) / (vh * 0.75);
		t = t < 0 ? 0 : t > 1 ? 1 : t;
		const w = host.clientWidth;
		const h = host.clientHeight || 150;
		const inset = Math.min(20, h / 2);
		const startY = h - Math.max(inset, 26 * h / 150);
		const endY = Math.max(inset, 20 * h / 150);
		const yAt = progress => startY - (startY - endY) * Math.pow(progress, 1.6);
		const path = host.querySelector('[data-trailpath]');
		if (path && (path.dataset.w !== String(w) || path.dataset.h !== String(h))) {
			path.dataset.w = String(w);
			path.dataset.h = String(h);
			const pts = [];
			for (let k = 0; k <= 40; k++) {
				const tk = k / 40;
				pts.push(`${(-40 + (w + 80) * tk).toFixed(1)},${(yAt(tk)).toFixed(1)}`);
			}
			path.setAttribute('d', 'M' + pts.join(' L'));
		}
		const x = -40 + (w + 80) * t;
		const y = yAt(t);
		const rot = -8 - 14 * t;
		p.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
		p.style.opacity = t > 0.005 ? '1' : '0';
	}

	/* ---------- 次の章が近づく区間で地の色を連続補間する ---------- */
	setupBackdrop() {
		const tones = this.root?.dataset.colorMode === 'dark' ? {
			top: '#172326', lite: '#1a282b', fediverse: '#2c2329', join: '#101a1d',
		} : {
			top: '#e9eff0', lite: '#eef3f4', fediverse: '#fff0f4', join: '#2f4547',
		};
		const toRgb = (hex) => {
			const value = hex.slice(1);
			return [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16));
		};
		this.sections = Array.from(this.root.querySelectorAll('section')).map(el => ({
			el,
			color: tones[el.id] || null,
		})).filter(section => section.color).map(section => ({ ...section, rgb: toRgb(section.color) }));
		this.root.style.transition = 'none';
		this.backdropColor = null;
		this.backdropInk = null;
		this.dirty = true;
	}

	tickBackdrop(y) {
		if (!this.sections?.length) return;
		const viewport = Math.max(1, this.viewportHeight || 1);
		const clamp = value => value < 0 ? 0 : value > 1 ? 1 : value;
		let rgb = this.sections[0].rgb;
		for (let index = 1; index < this.sections.length; index++) {
			const previous = this.sections[index - 1];
			const next = this.sections[index];
			if (!Number.isFinite(next.el._top)) return;
			const start = next.el._top - viewport * 1.30;
			const end = next.el._top - viewport * .88;
			if (y <= start) break;
			const progress = clamp((y - start) / Math.max(1, end - start));
			const eased = progress * progress * (3 - 2 * progress);
			rgb = previous.rgb.map((channel, channelIndex) => Math.round(channel + (next.rgb[channelIndex] - channel) * eased));
			if (progress < 1) break;
			rgb = next.rgb;
		}
		const css = 'rgb(' + rgb.join(', ') + ')';
		const linear = rgb.map(channel => {
			const value = channel / 255;
			return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
		});
		const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
		const blackContrast = (luminance + .05) / .05;
		const whiteContrast = 1.05 / (luminance + .05);
		const ink = blackContrast >= whiteContrast ? '#000000' : '#ffffff';
		if (ink !== this.backdropInk) {
			this.backdropInk = ink;
			this.root.style.setProperty('--backdrop-ink', ink);
		}
		if (css === this.backdropColor) return;
		this.backdropColor = css;
		this.root.style.backgroundColor = css;
	}

}
