/*
 * SPDX-FileCopyrightText: syuilo and misskey-project / hatacha
 * SPDX-License-Identifier: AGPL-3.0-only
 * Faithful landing-page migration; source SHA-256: d1f18ce4af591e56161ca7a7ba13b48c612d6ffc087f1a7e8f55abb19f4b9b6c
 */
/* global document, getComputedStyle, IntersectionObserver, performance, ResizeObserver, window */

const HK = '/client-assets/hatakyu/';
const THEMES = {
	kisetsu: { bg: '#f4f1ea', surface: '#fff', fg: '#211d18', fg2: '#5f574c', fg3: '#7c7367', rule: '#cdc7bb', accent: '#8a3d1f', head: '\'Shippori Mincho B1\',serif', body: '\'Zen Kaku Gothic New\',sans-serif', anim: 'hWelcome-htkItemKi' },
	kashin: { bg: '#fff5e6', surface: '#fff', fg: '#25201c', fg2: '#5f574c', fg3: '#8a8175', rule: 'rgba(37,32,28,.16)', accent: '#ff6b4a', head: '\'Zen Maru Gothic\',sans-serif', body: '\'Zen Maru Gothic\',sans-serif', anim: 'hWelcome-htkItemKa' },
	suri: { bg: '#efe7d4', surface: '#fff', fg: '#1a1a2e', fg2: '#4a4a5a', fg3: '#7a7a8a', rule: 'rgba(26,26,46,.18)', accent: '#2a52c0', head: '\'Zen Kaku Gothic Antique\',sans-serif', body: '\'Zen Kaku Gothic Antique\',sans-serif', anim: 'hWelcome-htkItemSu' },
	hatakyu: { bg: '#c9975f', surface: '#fdf6e6', fg: '#3b2a1c', fg2: '#6f5b3f', fg3: '#7a5c34', rule: '#cdb98f', accent: '#1272ec', head: '\'Zen Maru Gothic\',sans-serif', body: '\'Zen Kaku Gothic New\',sans-serif', anim: 'hWelcome-hkPin' },
};
const DARK_THEMES = {
	kisetsu: { bg: '#171b1d', surface: '#22282b', fg: '#f2ece3', fg2: '#d0c7ba', fg3: '#aaa094', rule: '#4a4f50', accent: '#ff9b72', head: '\'Shippori Mincho B1\',serif', body: '\'Zen Kaku Gothic New\',sans-serif', anim: 'hWelcome-htkItemKi' },
	kashin: { bg: '#1f1b19', surface: '#2a2421', fg: '#fff1e6', fg2: '#dbc4b5', fg3: '#b89e8e', rule: 'rgba(255,241,230,.18)', accent: '#ff9b7f', head: '\'Zen Maru Gothic\',sans-serif', body: '\'Zen Maru Gothic\',sans-serif', anim: 'hWelcome-htkItemKa' },
	suri: { bg: '#171824', surface: '#232437', fg: '#f3f2ff', fg2: '#c8c7dc', fg3: '#aeadc8', rule: 'rgba(243,242,255,.2)', accent: '#91adff', head: '\'Zen Kaku Gothic Antique\',sans-serif', body: '\'Zen Kaku Gothic Antique\',sans-serif', anim: 'hWelcome-htkItemSu' },
	hatakyu: { bg: '#261e18', surface: '#33271e', fg: '#fff1dc', fg2: '#d7c2a5', fg3: '#c3a987', rule: '#65513a', accent: '#77b4ff', head: '\'Zen Maru Gothic\',sans-serif', body: '\'Zen Kaku Gothic New\',sans-serif', anim: 'hWelcome-hkPin' },
};
const APPS = [
	{ s: 'Hatadint', se: 'Hatadint', i: 'ti ti-brush', c: '#7eb5b2' },
	{ s: 'HataCardMaker', se: 'HataCardMaker', i: 'ti ti-cards', c: '#e8a87c' },
	{ s: 'SideStudio', se: 'SideStudio', i: 'ti ti-layout-sidebar-left-expand', c: '#8b7cf6' },
	{ s: '更新内容', se: 'What\'s new', i: 'ti ti-news', c: '#5b8fd6' },
	{ s: '独自設定', se: 'Settings', i: 'ti ti-flag', c: '#f472b6' },
	{ s: 'HataFeed', se: 'HataFeed', i: 'ti ti-message-report', c: '#34d399' },
	{ s: 'Hatady', se: 'Hatady', i: 'ti ti-book-2', c: '#e79b5e' },
];
const EVENTS = [
	{ d: '11/04', t: '月・週・日・予定一覧を切り替え', te: 'Switch between month, week, day and list', tm: '21:00 - 22:00', c: '#34d399' },
	{ d: '11/06', t: '予定を日付や時刻へそのまま移動', te: 'Move events to another date or time', tm: '終日', c: '#ff6b4a' },
	{ d: '11/09', t: '予定を開いて、内容を確認・編集', te: 'Open an event to view or edit it', tm: '13:30 - 14:00', c: '#8b7cf6' },
];
const TODOS = [
	{ t: '今日・これからのやることを整理', te: 'Organize today and upcoming tasks', done: true },
	{ t: '期日を決めて、やることを見通す', te: 'Set due dates to plan ahead', done: true },
	{ t: '繰り返す用事をまとめて設定', te: 'Set up tasks that repeat', done: false },
	{ t: '大きな用事をサブタスクに分ける', te: 'Break bigger tasks into subtasks', done: false },
];
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
		this.tab = 'following';
		this.device = null;
		this.deviceManual = false;
		this.vis = 0;
		this.localOnly = false;
		this.realtime = true;
		this.theme = 'kisetsu';
		this.hyTab = 0;
		this.shape = 'rounded';
		this.cols = 3;
		this.paw = 'paw';
		this.posting = false;
		this.rtTimer = null;
		this.arrivals = [
			{ n: 'そら', a: '@sora', g: '#cfe6ef,#7fbcd6', t: 'デッキのタブ、5枚まで増やしたら逆に見やすくなった' },
			{ n: 'ゆの', a: '@yuno', g: '#f4d7bb,#d99a63', t: 'ハタキュテーマの紙、風でめくれるの好き' },
			{ n: 'みなも', a: '@minamo', g: '#a5d8b5,#57a97a', t: 'カウントダウン3秒、ちょうどいい' },
			{ n: 'こまち', a: '@komachi', g: '#f0c98f,#e0a44f', t: 'お花、今朝ようやく咲きました 🌼' },
		];
		this.arrIdx = 0;
		this.rootRef = (el) => { this.root = el; };
		this.tlRef = (el) => { this.tl = el; };
		this.feedRef = (el) => { this.feed = el; };
		this.formRef = (el) => { this.form = el; };
		this.inputRef = (el) => { this.input = el; };
		this.postBtnRef = (el) => { this.postBtn = el; };
		this.submitInnerRef = (el) => { this.submitInner = el; };
		this.visRef = (el) => { this.visBtn = el; };
		this.loRef = (el) => { this.loBtn = el; };
		this.rtRef = (el) => { this.rtBtn = el; };
		this.pillRef = (el) => { this.pill = el; };
		this.sideRef = (el) => { this.side = el; };
		this.sideScrollRef = (el) => { this.sideScroll = el; };
		this.shellRef = (el) => { this.shell = el; };
		this.chromeRef = (el) => { this.chrome = el; };
		this.bottomRef = (el) => { this.bottom = el; };
		this.drawerBtnRef = (el) => { this.drawerBtn = el; };
		this.delayRef = (el) => { this.delayBar = el; };
		this.ringRef = (el) => { this.ring = el; };
		this.utageRef = (el) => { this.utage = el; };
		this.utageBadgeRef = (el) => { this.utageBadge = el; };
		this.hataskRef = (el) => { this.hatask = el; };
		this.hataskBodyRef = (el) => { this.hataskBody = el; };
		this.hatadyBodyRef = (el) => { this.hatadyBody = el; };
		this.studioGridRef = (el) => { this.studioGrid = el; };
		this.studioPreviewRef = (el) => { this.studioPreview = el; };
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
		this.setupDeckMotionPreference();
		this.setupDeviceMode();
		this.renderHatask();
		this.setupHataskClock();
		this.setupHataskBodyPreview();
		this.renderHatady();
		this.renderStudio();
		this.setupSymbolHeadings();
		this.setupFediverse();
		this.setupFeatureEntrance();
		this.setupTextMotion();
		this.setupUiScrollHandoff();
		document.fonts?.ready?.then?.(() => {
			if (!this.root) return;
			this.setupDeckLayout();
			this.measure();
			this.dirty = true;
		});
		this.startRealtime();
	}

	componentWillUnmount() {
		this.teardownFediverse();
		this.teardownHataskClock();
		this.teardownUiScrollHandoff();
		if (this.rtTimer) this.cancelInterval(this.rtTimer);
		if (this.raf) this.cancelFrame(this.raf);
		if (this.raf2) this.cancelFrame(this.raf2);
		if (this.onWindowResize) window.removeEventListener('resize', this.onWindowResize);
		if (this.onHeaderPointerDown) document.removeEventListener('pointerdown', this.onHeaderPointerDown);
		if (this.onHeaderKeyDown) document.removeEventListener('keydown', this.onHeaderKeyDown);
		if (this.onHeaderToggle) document.removeEventListener('toggle', this.onHeaderToggle, true);
		if (this.deckMotionQuery && this.onDeckMotionChange) {
			if (this.deckMotionQuery.removeEventListener) this.deckMotionQuery.removeEventListener('change', this.onDeckMotionChange);
			else this.deckMotionQuery.removeListener?.(this.onDeckMotionChange);
		}
		if (this.deviceQuery && this.onDeviceModeChange) {
			if (this.deviceQuery.removeEventListener) this.deviceQuery.removeEventListener('change', this.onDeviceModeChange);
			else this.deviceQuery.removeListener?.(this.onDeviceModeChange);
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
		this.featureObserver?.disconnect();
		if (this.featureSection && this.onFeatureAnimationEnd) this.featureSection.removeEventListener('animationend', this.onFeatureAnimationEnd);
		if (this.featureFallbackTimer) this.cancelTimeout(this.featureFallbackTimer);
		if (this.featureStartTimer) this.cancelTimeout(this.featureStartTimer);
		if (this.featureLoopTimer) this.cancelTimeout(this.featureLoopTimer);
		this.hataskBodyResizeObserver?.disconnect();
		if (this.onHataskBodyResize) window.removeEventListener('resize', this.onHataskBodyResize);
		if (this.hataskBodyRevealTimer) this.cancelTimeout(this.hataskBodyRevealTimer);
		this.cancelHataskFlower();
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
		heading.dataset.symbolState = this.deckMotionQuery?.matches ? 'done' : 'ready';
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
		if (this.deckMotionQuery?.matches || !('IntersectionObserver' in window)) {
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
		if (this.deckMotionQuery?.matches) {
			this.symbolHeadingObserver?.disconnect();
			(this.symbolHeadings || []).forEach(heading => this.finishSymbolHeading(heading));
		} else {
			this.setupSymbolHeadings();
		}
	}

	finishFeatureEntrance() {
		if (!this.featureSection) return;
		if (this.featureFallbackTimer) {
			this.cancelTimeout(this.featureFallbackTimer);
			this.featureFallbackTimer = null;
		}
		if (this.featureStartTimer) {
			this.cancelTimeout(this.featureStartTimer);
			this.featureStartTimer = null;
		}
		if (this.featureLoopTimer) {
			this.cancelTimeout(this.featureLoopTimer);
			this.featureLoopTimer = null;
		}
		this.featureSection.dataset.featurePhase = 'loop';
	}

	holdFeatureEntrance() {
		if (!this.featureSection || this.featureSection.dataset.featurePhase !== 'gathering') return;
		if (this.featureFallbackTimer) {
			this.cancelTimeout(this.featureFallbackTimer);
			this.featureFallbackTimer = null;
		}
		if (this.featureLoopTimer) this.cancelTimeout(this.featureLoopTimer);
		this.featureSection.dataset.featurePhase = 'holding';
		this.featureLoopTimer = this.scheduleTimeout(() => {
			this.featureLoopTimer = null;
			if (this.featureSection?.dataset.featurePhase === 'holding') this.finishFeatureEntrance();
		}, FEATURE_HOLD_MS);
	}

	resetFeatureEntrance() {
		if (!this.featureSection || this.deckMotionQuery?.matches) return;
		if (this.featureFallbackTimer) this.cancelTimeout(this.featureFallbackTimer);
		if (this.featureStartTimer) this.cancelTimeout(this.featureStartTimer);
		if (this.featureLoopTimer) this.cancelTimeout(this.featureLoopTimer);
		this.featureFallbackTimer = null;
		this.featureStartTimer = null;
		this.featureLoopTimer = null;
		this.featureGathered = new Set();
		this.featureSection.dataset.featurePhase = 'waiting';
	}

	startFeatureEntrance() {
		if (!this.featureSection || this.featureSection.dataset.featurePhase !== 'waiting' || this.featureStartTimer) return;
		if (this.deckMotionQuery?.matches) {
			this.finishFeatureEntrance();
			return;
		}
		this.featureStartTimer = this.scheduleTimeout(() => {
			this.featureStartTimer = null;
			if (!this.featureSection || this.featureSection.dataset.featureVisible !== 'true') return;
			this.featureGathered = new Set();
			this.featureSection.dataset.featurePhase = 'gathering';
			this.featureFallbackTimer = this.scheduleTimeout(() => this.holdFeatureEntrance(), 3000);
		}, 460);
	}

	setupFeatureEntrance() {
		this.featureObserver?.disconnect();
		if (this.featureSection && this.onFeatureAnimationEnd) this.featureSection.removeEventListener('animationend', this.onFeatureAnimationEnd);
		this.featureSection = this.root.querySelector('.more-features[data-feature-phase]');
		if (!this.featureSection) return;
		this.featureSection.dataset.motionReady = 'true';
		this.featureSection.dataset.featureVisible = 'false';
		if (this.featureSection.dataset.featurePhase === 'gathering' || this.featureSection.dataset.featurePhase === 'holding') this.featureSection.dataset.featurePhase = 'waiting';
		this.featureItems = Array.from(this.featureSection.querySelectorAll('.feature-item'));
		this.onFeatureAnimationEnd = (ev) => {
			if (this.featureSection.dataset.featurePhase !== 'gathering') return;
			if (ev.animationName !== 'hWelcome-featureGather' || !ev.target.matches?.('.feature-item')) return;
			this.featureGathered?.add(ev.target);
			if ((this.featureGathered?.size || 0) >= this.featureItems.length) this.holdFeatureEntrance();
		};
		this.featureSection.addEventListener('animationend', this.onFeatureAnimationEnd);
		if (this.deckMotionQuery?.matches) {
			this.finishFeatureEntrance();
			return;
		}
		this.resetFeatureEntrance();
		if (!('IntersectionObserver' in window)) {
			this.featureSection.dataset.featureVisible = 'true';
			this.startFeatureEntrance();
			return;
		}
		this.featureObserver = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					this.featureSection.dataset.featureVisible = 'true';
					if (entry.intersectionRatio >= .18) this.startFeatureEntrance();
				} else if (this.featureSection.dataset.featurePhase === 'waiting') {
					this.featureSection.dataset.featureVisible = 'false';
				}
			});
		}, { root: this.root, threshold: [0, .18], rootMargin: '0px' });
		this.featureObserver.observe(this.featureSection.querySelector('.feature-window') || this.featureSection);
	}

	syncFeatureMotionPreference() {
		if (!this.featureSection) return;
		if (this.deckMotionQuery?.matches) this.finishFeatureEntrance();
		else if (this.featureSection.dataset.featurePhase === 'waiting' && this.featureSection.dataset.featureVisible === 'true') this.startFeatureEntrance();
	}

	setupDeckMotionPreference() {
		this.deckMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		this.onDeckMotionChange = () => this.scheduleFrame(() => {
			if (!this.root) return;
			this.syncSymbolMotionPreference();
			this.syncFeatureMotionPreference();
			if (this.deckMotionQuery?.matches) this.finishHataskFlower();
			this.syncHataskBodyMotionPreference();
			this.setupDeckLayout();
			this.measure();
			this.dirty = true;
		});
		if (this.deckMotionQuery.addEventListener) this.deckMotionQuery.addEventListener('change', this.onDeckMotionChange);
		else this.deckMotionQuery.addListener?.(this.onDeckMotionChange);
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
		this.renderHatask();
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
			this.root.querySelectorAll('[data-utage-note]').forEach(note => this.updateUtageBadge(note));
			this.renderHatask();
			this.renderHatady();
			this.renderStudio();
			this.updateColorModeControl();
			this.refreshFediverseLanguage();
			this.root.querySelectorAll('[data-splitdone]').forEach(el => { delete el.dataset.splitdone; });
			this.setupTextMotion();
			this.scheduleFrame(() => { this.setupDeckLayout(); this.measure(); this.dirty = true; });
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
			if (/marquee|pulseDot|hkSway|utageFlash|floatY|trail|fly|deckPaneIn|noteIn|hyHeatIn|hyBlockIn|bloom|htkItem|hkPin/.test(name)) return;
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
		if (this.deckMotionQuery?.matches) p = 1;
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
		const map = { top: 'stretch', ui: 'gather', deck: 'scatter', hatask: 'wipe', hatady: 'stretch', hatafeed: 'scatter', studio: 'gather', join: 'drop' };
		return map[id] || 'wipe';
	}

	applyHeading(h, p) {
		if (this.deckMotionQuery?.matches) p = 1;
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
		this.setupFocus();
		this.setupDeckLayout();
		const clamp = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
		this.measure();
		this.onWindowResize = () => { this.setupDeckLayout(); this.measure(); this.dirty = true; };
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
				this.tickFocus(y);
				this.tickDeckStory(y);
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
		(this.focusGroups || []).forEach(fg => { m(fg.g); fg.kids.forEach(m); });
		if (this.sections) this.sections.forEach(sc => m(sc.el));
		const p = this.root.querySelector('[data-plane]');
		if (p) { m(p.parentElement); this.planeHost = p.parentElement; }
		if (this.deckStory) m(this.deckStory);
	}

	/* ---------- モバイルは縦スクロールで3枚のデッキを受け渡す ---------- */
	applyDeckActive(frames, active) {
		const next = frames[active];
		if (!next) return;
		next.removeAttribute('inert');
		next.removeAttribute('aria-hidden');
		const focusedFrame = frames.find(frame => frame.contains(document.activeElement));
		if (focusedFrame && focusedFrame !== next) {
			next.querySelector('[data-dtab],button,[tabindex]')?.focus({ preventScroll: true });
		}
		frames.forEach((frame, i) => {
			const on = i === active;
			frame.dataset.deckActive = String(on);
			frame.toggleAttribute('inert', !on);
			if (on) frame.removeAttribute('aria-hidden');
			else frame.setAttribute('aria-hidden', 'true');
		});
		this.deckActive = active;
		this.desktopDeckIndex = active;
		this.syncDeckCarouselControls();
	}

	syncDeckCarouselControls() {
		this.root.querySelectorAll('[data-deck-go]').forEach((button, index) => {
			button.setAttribute('aria-current', String(index === this.desktopDeckIndex));
		});
	}

	setDesktopDeck(index) {
		if (this.deckStory?.dataset.deckMode !== 'carousel' || !this.deckFrames?.length) return;
		const total = this.deckFrames.length;
		const next = ((index % total) + total) % total;
		if (next === this.desktopDeckIndex) return;
		this.applyDeckActive(this.deckFrames, next);
	}

	onDeckPrev = () => { this.setDesktopDeck((this.desktopDeckIndex ?? 0) - 1); };
	onDeckNext = () => { this.setDesktopDeck((this.desktopDeckIndex ?? 0) + 1); };
	onDeckGo = (ev) => { this.setDesktopDeck(Number(ev.currentTarget.dataset.deckGo)); };

	setupDeckLayout() {
		const g = this.root.querySelector('[data-deckgrid]');
		const story = this.root.querySelector('[data-deckstory]');
		const stage = story?.querySelector('[data-deckstage]');
		const intro = story?.querySelector('[data-deckintro]');
		if (!g || !story || !stage || !intro) return;
		const frames = Array.from(g.querySelectorAll(':scope > [data-deckframe]'));
		const sectionWidth = g.closest('#deck')?.clientWidth || this.viewportWidth;
		const narrow = sectionWidth < 820;
		const reduced = this.deckMotionQuery?.matches ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const usableHeight = this.viewportHeight - 76;
		const guide = story.querySelector('.deck-scroll-guide');
		const gap = parseFloat(getComputedStyle(stage).rowGap) || 12;
		const introHeight = intro.offsetHeight;
		const guideHeight = guide?.offsetHeight || 24;
		const minimumStageHeight = introHeight + guideHeight + 300 + gap * 2;
		const storyMode = narrow && !reduced && usableHeight >= minimumStageHeight;
		const previousMode = story.dataset.deckMode;
		const mode = storyMode ? 'story' : narrow ? 'stack' : 'carousel';

		story.dataset.deckMode = mode;
		this.deckStory = story;
		this.deckStage = stage;
		this.deckGrid = g;
		this.deckFrames = frames;
		this.deckNarrow = storyMode;

		if (mode === 'stack') {
			frames.forEach(f => {
				f.style.translate = '';
				delete f.dataset.deckActive;
				f.removeAttribute('inert');
				f.removeAttribute('aria-hidden');
			});
			this.deckActive = -1;
		} else if (mode === 'carousel') {
			frames.forEach(f => { f.style.translate = ''; });
			const active = Math.min(frames.length - 1, Math.max(0, this.desktopDeckIndex ?? 0));
			this.applyDeckActive(frames, active);
		} else if (previousMode !== 'story') {
			frames.forEach((f, i) => {
				f.style.translate = String(i * 105) + '% 0';
			});
			this.applyDeckActive(frames, 0);
		}
		this.dirty = true;
	}

	tickDeckStory(y) {
		const story = this.deckStory;
		const stage = this.deckStage;
		const g = this.deckGrid;
		const frames = this.deckFrames;
		if (!this.deckNarrow || !story || !stage || !g || !frames?.length || story._top == null) return;
		const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
		const smooth = t => t * t * (3 - 2 * t);
		const stickyTop = parseFloat(getComputedStyle(stage).top) || 0;
		const travel = Math.max(1, story._h - stage.offsetHeight);
		const p = clamp((y + stickyTop - story._top) / travel);
		let pos = 0;
		if (p < .10) pos = 0;
		else if (p < .40) pos = smooth((p - .10) / .30);
		else if (p < .50) pos = 1;
		else if (p < .80) pos = 1 + smooth((p - .50) / .30);
		else pos = 2;

		const slot = g.clientWidth + 14;
		frames.forEach((f, i) => { f.style.translate = ((i - pos) * slot).toFixed(1) + 'px 0'; });
		const active = Math.round(pos);
		if (active !== this.deckActive) {
			this.applyDeckActive(frames, active);
		}
	}

	/* ---------- 締めの飛行機 ---------- */
	tickPlane(sy) {
		if (this.deckMotionQuery?.matches) return;
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
			top: '#172326', fediverse: '#2c2329', ui: '#1a282b', deck: '#152427', hatask: '#282721', hatady: '#2a241c',
			hatafeed: '#17272a', studio: '#19272a', more: '#1a292c', hatakyu: '#232821', join: '#101a1d',
		} : {
			top: '#e9eff0', fediverse: '#fff0f4', ui: '#eef3f4', deck: '#e4edee', hatask: '#efeae1', hatady: '#f4ecdd',
			hatafeed: '#e8f0f1', studio: '#eaf2f3', more: '#edf3f3', hatakyu: '#e3ecee', join: '#2f4547',
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

	/* ---------- 要素をひとつずつ拾い上げる ---------- */
	setupFocus() {
		this.focusGroups = Array.from(this.root.querySelectorAll('[data-focus]')).map(g => {
			const kids = Array.from(g.children).filter(k => k.nodeType === 1);
			if (getComputedStyle(g).position === 'static') g.style.position = 'relative';
			kids.forEach(k => {
				k.style.transition = 'transform .62s cubic-bezier(.16,1,.3,1), opacity .5s ease, filter .5s ease, box-shadow .5s ease';
				k.style.transformOrigin = 'center center';
				k.style.willChange = 'transform,opacity,filter';
			});
			const focusBase = kids.map(k => ({ transform: k.style.transform, opacity: k.style.opacity, filter: k.style.filter, boxShadow: k.style.boxShadow, zIndex: k.style.zIndex }));
			const marker = document.createElement('div');
			marker.style.cssText = 'position:absolute;left:0;top:0;width:3px;border-radius:999px;background:var(--accent);pointer-events:none;opacity:0;transition:transform .62s cubic-bezier(.16,1,.3,1),height .62s cubic-bezier(.16,1,.3,1),opacity .4s ease;z-index:3';
			const step = document.createElement('div');
			step.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-100%,0);padding-right:12px;font-family:Righteous,cursive;font-size:12px;letter-spacing:.08em;color:var(--accent);pointer-events:none;opacity:0;transition:transform .62s cubic-bezier(.16,1,.3,1),opacity .4s ease;z-index:3;white-space:nowrap';
			g.appendChild(marker);
			g.appendChild(step);
			return { g, kids, marker, step, focusBase, last: null };
		});
	}

	tickFocus(y) {
		if (!this.focusGroups) return;
		const vh = this.viewportHeight;
		const cy = vh * 0.5;
		this.focusGroups.forEach(fg => {
			const { g, kids, marker, step, focusBase } = fg;
			const deckMode = g.matches('[data-deckgrid]') ? g.closest('[data-deckstory]')?.dataset.deckMode : null;
			if (this.deckMotionQuery?.matches || (deckMode && deckMode !== 'grid')) {
				fg.last = 'deck-static';
				kids.forEach((k, i) => {
					const base = focusBase[i];
					k.style.transform = base.transform;
					k.style.opacity = base.opacity;
					k.style.filter = base.filter;
					k.style.boxShadow = base.boxShadow;
					k.style.zIndex = base.zIndex;
				});
				marker.style.opacity = '0';
				step.style.opacity = '0';
				return;
			}
			const gTop = g._top - y;
			if (gTop + g._h < vh * 0.06 || gTop > vh * 0.94) {
				if (fg.last !== 'off') {
					fg.last = 'off';
					kids.forEach(k => { k.style.transform = ''; k.style.opacity = ''; k.style.filter = ''; k.style.boxShadow = ''; k.style.zIndex = ''; });
					marker.style.opacity = '0';
					step.style.opacity = '0';
				}
				return;
			}
			let best = null, bestD = Infinity, bestI = 0;
			kids.forEach((k, i) => {
				const kTop = k._top - y;
				const d = Math.abs(kTop + k._h / 2 - cy);
				if (d < bestD) { bestD = d; best = k; bestI = i; }
			});
			if (fg.last === bestI) return;
			fg.last = bestI;
			const bi = kids.indexOf(best);
			kids.forEach((k, i) => {
				const on = k === best;
				const away = i - bi;
				if (on) {
					k.style.transform = 'translateY(-12px) scale(1.055)';
					k.style.opacity = '1';
					k.style.filter = 'none';
					k.style.boxShadow = '0 26px 60px -18px rgba(34,66,69,.42)';
					k.style.zIndex = '2';
				} else {
					const push = Math.sign(away) * Math.min(3, Math.abs(away)) * 6;
					k.style.transform = `translate(${push}px, ${10 + Math.min(3, Math.abs(away)) * 3}px) scale(.9) rotate(${away * 0.5}deg)`;
					k.style.opacity = '.42';
					k.style.filter = 'saturate(.72)';
					k.style.boxShadow = 'none';
					k.style.zIndex = '';
				}
			});
			const oy = best._top - g._top;
			marker.style.height = `${Math.max(28, best._h * 0.55)}px`;
			marker.style.transform = `translate(-18px, ${oy + best._h * 0.22}px)`;
			marker.style.opacity = '1';
			step.style.transform = `translate(-100%, ${oy + best._h * 0.22}px)`;
			step.style.opacity = '1';
			step.textContent = `${String(bi + 1).padStart(2, '0')} / ${String(kids.length).padStart(2, '0')}`;
		});
	}

	/* ---------- UIの入れ子スクロール ---------- */
	setupUiScrollHandoff() {
		this.teardownUiScrollHandoff();
		this.uiScrollHandoffs = [this.tl, this.sideScroll].filter(Boolean).map(scroller => {
			const onWheel = (event) => {
				if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
				const lineHeight = Number.parseFloat(getComputedStyle(scroller).lineHeight);
				const unit = event.deltaMode === 1
					? (Number.isFinite(lineHeight) ? lineHeight : 16)
					: event.deltaMode === 2 ? this.viewportHeight : 1;
				const delta = event.deltaY * unit;
				const top = Math.max(0, scroller.scrollTop);
				const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
				const available = delta > 0 ? Math.max(0, max - top) : Math.max(0, top);
				if (Math.abs(delta) <= available) return;
				const remainder = delta > 0 ? delta - available : delta + available;
				const page = this.root;
				const pageTop = Math.max(0, this.root.scrollTop);
				const pageMax = Math.max(0, page.scrollHeight - this.viewportHeight);
				const pageAvailable = remainder > 0 ? Math.max(0, pageMax - pageTop) : Math.max(0, pageTop);
				if (pageAvailable <= 1) return;
				event.preventDefault();
				scroller.scrollTop = delta > 0 ? max : 0;
				this.root.scrollBy({ top: remainder, left: 0, behavior: 'instant' });
			};
			scroller.addEventListener('wheel', onWheel, { passive: false });
			return { scroller, onWheel };
		});
	}

	teardownUiScrollHandoff() {
		(this.uiScrollHandoffs || []).forEach(({ scroller, onWheel }) => {
			scroller.removeEventListener('wheel', onWheel);
		});
		this.uiScrollHandoffs = [];
	}

	/* ---------- Hataskey UI ---------- */
	setupDeviceMode() {
		this.deviceManual = false;
		this.deviceQuery = window.matchMedia('(max-width: 820px)');
		this.applyDevice(this.deviceQuery.matches ? 'mobile' : 'pc', false);
		this.onDeviceModeChange = (ev) => {
			if (!this.deviceManual) this.applyDevice(ev.matches ? 'mobile' : 'pc', false);
		};
		if (this.deviceQuery.addEventListener) this.deviceQuery.addEventListener('change', this.onDeviceModeChange);
		else this.deviceQuery.addListener?.(this.onDeviceModeChange);
	}

	applyDevice(dev, animate = true) {
		if (dev !== 'pc' && dev !== 'mobile') return;
		this.device = dev;
		const section = this.root.querySelector('[data-ui-section]');
		if (section) section.dataset.device = dev;
		this.root.querySelectorAll('.device-mode-switch [data-dev]').forEach(x => {
			const on = x.dataset.dev === dev;
			x.setAttribute('aria-pressed', String(on));
			x.style.background = on ? 'var(--deviceActiveBg)' : 'transparent';
			x.style.color = on ? 'var(--deviceActiveFg)' : 'var(--fgMuted)';
		});
		const mobile = dev === 'mobile';
		this.shell.style.maxWidth = mobile ? '420px' : '100%';
		this.shell.style.borderRadius = mobile ? '34px' : '20px';
		this.chrome.style.display = mobile ? 'none' : 'flex';
		this.side.style.display = mobile ? 'none' : 'flex';
		this.bottom.style.display = mobile ? 'flex' : 'none';
		this.drawerBtn.style.display = mobile ? 'flex' : 'none';
		this.tl.style.paddingBottom = mobile ? '84px' : '20px';
		if (animate) {
			this.tl.style.animation = 'hWelcome-swipeIn .45s cubic-bezier(.2,.8,.2,1) both';
			this.scheduleTimeout(() => { if (this.tl) this.tl.style.animation = ''; }, 500);
		}
	}

	onDevice = (ev) => {
		this.deviceManual = true;
		this.applyDevice(ev.currentTarget.dataset.dev, true);
	};

	onTab = (ev) => {
		const b = ev.currentTarget;
		this.tab = b.dataset.tab;
		const labels = { following: ['ホーム', 'Home'], local: ['ローカル', 'Local'], mixed: ['グローバル', 'Global'], list: ['リスト', 'List'], channel: ['チャンネル', 'Channel'], antenna: ['アンテナ', 'Antenna'] };
		this.pill.querySelectorAll('[data-tab]').forEach(x => {
			const on = x === b;
			x.setAttribute('aria-selected', String(on));
			x.style.background = on ? 'var(--btnBg)' : 'transparent';
			x.style.color = on ? 'var(--accent)' : 'var(--fgMuted)';
			const lab = x.querySelector('span');
			if (lab) lab.remove();
			if (on) {
				const s = document.createElement('span');
				s.style.cssText = 'font-size:12.2px;font-weight:600;line-height:1;white-space:nowrap;overflow:hidden;animation:tabLabelIn .18s linear both';
				s.textContent = labels[x.dataset.tab][this.lang === 'en' ? 1 : 0];
				x.appendChild(s);
			}
		});
		if (this.tl) {
			this.tl.style.animation = 'none';
			void this.tl.offsetWidth;
			this.tl.style.animation = 'hWelcome-swipeIn .34s cubic-bezier(.2,.8,.2,1) both';
		}
	};

	onSidebar = (ev) => {
		const b = ev.currentTarget;
		this.side.querySelectorAll('[data-sb]').forEach(x => {
			const on = x === b;
			x.style.background = on ? 'var(--accentedBg)' : 'transparent';
			x.style.color = on ? 'var(--accent)' : 'var(--fg)';
			x.style.opacity = on ? '1' : '.7';
			x.style.fontWeight = on ? '600' : '400';
		});
		if (b.dataset.sb === 'notifications') {
			const badge = this.root.querySelector('[data-notifbadge]');
			if (badge) badge.style.display = 'none';
		}
	};

	onRealtime = () => {
		this.realtime = !this.realtime;
		const icon = this.rtBtn.querySelector('[data-rticon]');
		const state = this.rtBtn.querySelector('[data-rtstate]');
		icon.className = (this.realtime ? 'ti ti-bolt' : 'ti ti-bolt-off');
		icon.style.cssText = 'font-size:18.4px;width:22px;text-align:center;flex-shrink:0';
		state.textContent = this.realtime ? 'ON' : 'OFF';
		this.rtBtn.style.background = this.realtime ? 'var(--accentedBg)' : 'transparent';
		this.rtBtn.style.color = this.realtime ? 'var(--accent)' : 'var(--fg)';
		this.rtBtn.style.opacity = this.realtime ? '1' : '.7';
	};

	focusComposer = () => { this.input?.focus(); };

	cycleVis = () => {
		const modes = [
			{ i: 'ti ti-world', ja: '公開', en: 'Public', c: '' },
			{ i: 'ti ti-home', ja: 'ホーム', en: 'Home', c: '#5b8fd6' },
			{ i: 'ti ti-lock', ja: 'フォロワー', en: 'Followers', c: 'color-mix(in srgb,var(--hyAccent) 78%,white)' },
			{ i: 'ti ti-mail', ja: 'ダイレクト', en: 'Direct', c: '#c05a8a' },
		];
		this.vis = (this.vis + 1) % modes.length;
		const m = modes[this.vis];
		this.visBtn.querySelector('[data-visicon]').innerHTML = `<i class="${m.i}"></i>`;
		const lab = this.visBtn.querySelector('[data-vislabel]');
		lab.textContent = this.lang === 'en' ? m.en : m.ja;
		lab.dataset.en = m.en; lab.dataset.ja = m.ja;
		this.form.style.boxShadow = m.c ? `0 0 0 2px ${m.c} inset` : 'none';
	};

	toggleLocalOnly = () => {
		this.localOnly = !this.localOnly;
		this.loBtn.innerHTML = `<i class="ti ti-rocket${this.localOnly ? '-off' : ''}"></i>`;
		this.loBtn.style.color = this.localOnly ? '#ff2a2a' : 'var(--fg)';
	};

	insertUtage = () => { if (this.input) { this.input.value = '今夜は宴だ！'; this.input.focus(); } };

	onPost = () => {
		if (this.posting) return;
		const text = (this.input.value || '').trim();
		if (!text) { this.input.focus(); return; }
		this.posting = true;
		this.delayBar.style.display = 'flex';
		const total = 3000;
		const start = performance.now();
		this.cancelled = false;
		const tick = () => {
			if (this.cancelled) return;
			const p = Math.min(1, (performance.now() - start) / total);
			this.ring.style.background = `conic-gradient(var(--accent) ${p}turn, rgba(64,89,91,.15) ${p}turn)`;
			const left = Math.ceil((1 - p) * 3);
			const t = this.delayBar.querySelector('[data-delaytext]');
			t.textContent = this.lang === 'en' ? `Posting in ${left}s` : `${left}秒後に投稿します`;
			if (p < 1) this.raf = this.scheduleFrame(tick); else this.sendNow();
		};
		this.raf = this.scheduleFrame(tick);
	};

	cancelDelay = () => {
		this.cancelled = true;
		if (this.raf) this.cancelFrame(this.raf);
		this.delayBar.style.display = 'none';
		this.posting = false;
	};

	sendNow = () => {
		if (!this.posting) return;
		this.cancelled = true;
		if (this.raf) this.cancelFrame(this.raf);
		this.delayBar.style.display = 'none';
		const text = (this.input.value || '').trim();
		const isUtage = /宴|うたげ|utage/i.test(text);
		this.submitInner.style.background = '#507b21';
		this.submitInner.innerHTML = '<i class="ti ti-check"></i>';
		this.scheduleTimeout(() => {
			this.submitInner.style.background = 'var(--accent)';
			this.submitInner.innerHTML = `<span data-postlabel data-en="Note">${this.lang === 'en' ? 'Note' : 'ノート'}</span><i class="ti ti-send"></i>`;
		}, 900);
		this.prependNote({ n: 'あなた', a: '@you', g: '#cfe6ef,#7fbcd6', t: text }, isUtage);
		this.input.value = '';
		this.posting = false;
	};

	noteHtml(o, utage) {
		const avatarMap = {
			'@you': 'waving.png', '@sora': 'stargazing.png', '@yuno': 'reading-book.png',
			'@minamo': 'checking-time.png', '@komachi': 'watering-flower.png', '@kurumi': 'questioning.png',
		};
		const avatar = avatarMap[o.a] || 'chatting.png';
		const utageAttrs = utage ? ' data-utage-note data-utage-state="pending"' : '';
		return `<div${utageAttrs} style="position:relative;font-size:16.8px;background:var(--panel);border:1px solid var(--divider);border-radius:14px;margin-bottom:8px;overflow:visible;animation:hWelcome-noteIn .4s cubic-bezier(.2,.8,.2,1) both">
      <article style="position:relative;padding:10px 10px 6px"><div style="position:relative">
        <div style="display:flex;padding-bottom:10px">
          <img class="hatakyu-user-avatar hatakyu-user-avatar-note" src="/client-assets/hatakyu/${avatar}" width="58" height="58" alt="" aria-hidden="true" draggable="false" decoding="async">
          <div style="flex:1;min-width:0">
            <header style="display:flex"><div style="align-items:flex-start;white-space:nowrap;flex-direction:column;overflow:hidden"><div style="display:flex;align-items:baseline"><span style="margin:0 .5em 0 0;font-weight:bold">${esc(o.n)}</span><span style="margin:0 .5em 0 0;font-size:.95em;opacity:.7">${esc(o.a)}</span></div></div><div style="display:flex;align-items:center;margin-left:auto;padding-left:10px;gap:.5em;font-size:.9em;opacity:.7"><span>たった今</span></div></header>
            <div style="margin-top:4px"><div style="overflow-wrap:break-word;line-height:1.75">${esc(o.t)}</div></div>
            <footer style="margin:4px 0 -8px;display:flex">
              <button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;color:color-mix(in srgb,var(--panel),var(--fg) 70%)"><i class="ti ti-arrow-back-up"></i></button>
              <button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;color:color-mix(in srgb,var(--panel),var(--fg) 70%)"><i class="ti ti-repeat"></i></button>
              <button${utage ? ' data-utage-react' : ''} style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;color:color-mix(in srgb,var(--panel),var(--fg) 70%)"><i class="ti ti-plus"></i></button>
              <button style="margin:0;padding:8px;border:0;background:none;cursor:pointer;color:color-mix(in srgb,var(--panel),var(--fg) 70%)"><i class="ti ti-dots"></i></button>
            </footer>
          </div>
        </div>
        ${utage ? '<div data-utage-badge aria-live="polite">' + (this.lang === 'en' ? 'Pending' : '判定待ち') + '</div>' : ''}
      </div></article></div>`;
	}

	prependNote(o, utage) {
		const wrap = document.createElement('div');
		wrap.innerHTML = this.noteHtml(o, utage);
		const node = wrap.firstElementChild;
		this.feed.insertBefore(node, this.feed.firstChild);
		if (this.tl) this.tl.scrollTop = 0;
		if (utage) {
			node.querySelector('[data-utage-react]')?.addEventListener('click', this.onReact);
			this.updateUtageBadge(node);
		}
	}

	startRealtime() {
		this.rtTimer = this.scheduleInterval(() => {
			if (!this.realtime || !this.feed) return;
			if (document.hidden) return;
			const r = this.feed.getBoundingClientRect();
			if (r.bottom < -400 || r.top > this.viewportHeight + 400) return;
			const o = this.arrivals[this.arrIdx % this.arrivals.length];
			this.arrIdx++;
			this.prependNote(o, false);
			while (this.feed.children.length > 6) this.feed.removeChild(this.feed.lastChild);
		}, 9000);
	}

	updateUtageBadge(note) {
		const badge = note?.querySelector('[data-utage-badge]');
		if (!badge) return;
		const state = note.dataset.utageState || 'pending';
		const labels = this.lang === 'en'
			? { pending: 'Pending', judging: 'Judging…', blocked: 'Failed' }
			: { pending: '判定待ち', judging: '判定中…', blocked: '失敗' };
		badge.textContent = labels[state] || labels.pending;
	}

	beginUtageJudgement(note, button) {
		if (!note || note.dataset.utageState !== 'pending') return;
		note.dataset.utageState = 'judging';
		button.dataset.on = '1';
		button.setAttribute('data-rx', '');
		button.setAttribute('aria-disabled', 'true');
		button.disabled = true;
		button.style.cursor = 'default';
		button.innerHTML = '🎉<span style="font-size:.9em;margin-left:5px" data-c>1</span>';
		button.style.background = 'var(--accentedBg)';
		button.style.color = 'var(--accent)';
		button.style.boxShadow = '0 0 0 1px var(--accent) inset';
		this.updateUtageBadge(note);
		this.scheduleTimeout(() => {
			if (!note.isConnected || note.dataset.utageState !== 'judging') return;
			note.dataset.utageState = 'blocked';
			note.style.background = 'color-mix(in srgb, var(--error) 8%, var(--panel))';
			this.updateUtageBadge(note);
		}, 650);
	}

	onReact = (ev) => {
		const b = ev.currentTarget;
		if (b.matches('[data-utage-react]')) {
			const note = b.closest('[data-utage-note]');
			if (note?.dataset.utageState === 'pending') {
				this.beginUtageJudgement(note, b);
				b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'cubic-bezier(.34,1.56,.64,1)' });
				return;
			}
			if (note?.dataset.utageState === 'judging') return;
		}
		const c = b.querySelector('[data-c]');
		if (c) {
			const on = b.style.background.includes('accentedBg') || b.dataset.on === '1';
			b.dataset.on = on ? '0' : '1';
			c.textContent = String(Number(c.textContent) + (on ? -1 : 1));
			b.style.background = on ? 'var(--btnBg)' : 'var(--accentedBg)';
			b.style.color = on ? 'inherit' : 'var(--accent)';
			b.style.boxShadow = on ? 'none' : '0 0 0 1px var(--accent) inset';
		}
		b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'cubic-bezier(.34,1.56,.64,1)' });
	};

	/* ---------- デッキ ---------- */
	onDeckTab = (ev) => {
		const b = ev.currentTarget;
		const key = b.dataset.dtab;
		const frame = key.split('-')[0];
		this.root.querySelectorAll(`[data-dtab^="${frame}-"]`).forEach(x => {
			const on = x === b;
			x.style.opacity = on ? '1' : '.6';
			x.style.background = on ? 'var(--bg)' : 'transparent';
			x.style.borderColor = on ? (x.closest('div').style.borderBottomColor || 'var(--divider)') : 'transparent';
			x.style.borderStyle = 'solid';
			x.style.borderWidth = '1px';
			x.style.borderBottom = 'none';
			x.style.flexGrow = on ? '1' : '0';
			x.style.maxWidth = on ? '240px' : '180px';
		});
		this.root.querySelectorAll(`[data-dpane^="${frame}-"]`).forEach(p => {
			const on = p.dataset.dpane === key;
			p.style.display = on ? 'flex' : 'none';
			if (on) { p.style.animation = 'none'; void p.offsetWidth; p.style.animation = 'hWelcome-deckPaneIn .3s cubic-bezier(.2,.8,.2,1) both'; }
		});
	};

	/* ---------- Hatask ---------- */
	onTheme = (ev) => {
		this.theme = ev.currentTarget.dataset.th;
		this.renderHatask();
	};

	hataskClockParts(date = this.options.now?.() ?? new Date()) {
		const locale = this.lang === 'en' ? 'en-US' : 'ja-JP';
		const format = options => new Intl.DateTimeFormat(locale, options).format(date);
		const pad = value => String(value).padStart(2, '0');
		return {
			time: format({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
			shortDate: format({ month: 'short', day: 'numeric' }),
			longDate: format({ year: 'numeric', month: 'short', day: 'numeric' }),
			numericDate: date.getFullYear() + '.' + pad(date.getMonth() + 1) + '.' + pad(date.getDate()),
			weekday: format({ weekday: 'long' }),
		};
	}

	updateHataskClock() {
		if (!this.hataskBody) return;
		const parts = this.hataskClockParts();
		this.hataskBody.querySelectorAll('[data-hatask-clock]').forEach(node => {
			const text = parts[node.dataset.hataskClock];
			if (typeof text === 'string' && node.textContent !== text) node.textContent = text;
		});
	}

	setupHataskClock() {
		this.teardownHataskClock();
		this.updateHataskClock();
		this.hataskClockTimer = this.scheduleInterval(() => {
			if (!document.hidden) this.updateHataskClock();
		}, 1000);
		this.onHataskClockVisibility = () => {
			if (!document.hidden) this.updateHataskClock();
		};
		document.addEventListener('visibilitychange', this.onHataskClockVisibility);
	}

	teardownHataskClock() {
		if (this.hataskClockTimer != null) this.cancelInterval(this.hataskClockTimer);
		if (this.onHataskClockVisibility) document.removeEventListener('visibilitychange', this.onHataskClockVisibility);
		this.hataskClockTimer = null;
		this.onHataskClockVisibility = null;
	}
	syncHataskBodyToggle() {
		const viewport = this.hatask?.querySelector('[data-hatask-body-viewport]');
		const button = viewport?.querySelector('.hatask-body-toggle');
		if (!viewport || !button) return;
		const state = viewport.dataset.hataskBodyState || 'collapsed';
		const expanded = state === 'expanded';
		const revealing = state === 'revealing';
		button.setAttribute('aria-expanded', String(expanded));
		button.setAttribute('aria-disabled', String(revealing));
		const icon = button.querySelector('i');
		if (icon) icon.className = 'ti ti-chevron-down';
		const label = button.querySelector('[data-hatask-body-toggle-label]');
		if (label) label.textContent = this.lang === 'en' ? 'Show all' : 'すべて見る';
		button.setAttribute('aria-label', this.lang === 'en' ? 'Show the full Hatask Home preview' : 'Hataskのホームをすべて見る');
		if (this.hataskBody) this.hataskBody.inert = Boolean(this.hataskBodyIsMobile && !expanded);
	}

	syncHataskBodyPreview(width = 0) {
		const viewport = this.hatask?.querySelector('[data-hatask-body-viewport]');
		if (!viewport) return;
		const rectWidth = this.hatask?.getBoundingClientRect?.().width || 0;
		const measuredWidth = Number(width) || rectWidth || this.hatask?.clientWidth || this.viewportWidth;
		this.hataskBodyIsMobile = measuredWidth <= 720;
		if (!this.hataskBodyIsMobile) viewport.dataset.hataskBodyState = 'expanded';
		else if (this.hataskBodyUserExpanded) viewport.dataset.hataskBodyState = 'expanded';
		else if (viewport.dataset.hataskBodyState !== 'revealing') viewport.dataset.hataskBodyState = 'collapsed';
		this.syncHataskBodyToggle();
	}

	setupHataskBodyPreview() {
		this.hataskBodyResizeObserver?.disconnect();
		if (this.onHataskBodyResize) window.removeEventListener('resize', this.onHataskBodyResize);
		if (!this.hatask || !this.hataskBody) return;
		this.onHataskBodyResize = () => this.syncHataskBodyPreview();
		if (typeof window.ResizeObserver === 'function') {
			this.hataskBodyResizeObserver = new ResizeObserver((entries) => {
				const width = entries.at(-1)?.contentRect?.width || 0;
				this.syncHataskBodyPreview(width);
			});
			this.hataskBodyResizeObserver.observe(this.hatask);
		} else {
			window.addEventListener('resize', this.onHataskBodyResize);
		}
		this.syncHataskBodyPreview();
	}

	syncHataskBodyMotionPreference() {
		const viewport = this.hatask?.querySelector('[data-hatask-body-viewport]');
		if (!viewport || !this.deckMotionQuery?.matches || viewport.dataset.hataskBodyState !== 'revealing') return;
		if (this.hataskBodyRevealTimer) this.cancelTimeout(this.hataskBodyRevealTimer);
		this.hataskBodyRevealTimer = null;
		viewport.dataset.hataskBodyState = 'expanded';
		this.syncHataskBodyToggle();
		this.hataskBody?.focus?.({ preventScroll: true });
	}

	toggleHataskBody = () => {
		const viewport = this.hatask?.querySelector('[data-hatask-body-viewport]');
		if (!viewport || viewport.dataset.hataskBodyState === 'revealing' || viewport.dataset.hataskBodyState === 'expanded') return;
		if (this.hataskBodyRevealTimer) this.cancelTimeout(this.hataskBodyRevealTimer);
		this.hataskBodyRevealTimer = null;
		this.hataskBodyUserExpanded = true;
		const finish = () => {
			this.hataskBodyRevealTimer = null;
			viewport.dataset.hataskBodyState = 'expanded';
			this.syncHataskBodyToggle();
			this.hataskBody?.focus?.({ preventScroll: true });
		};
		if (this.deckMotionQuery?.matches) {
			finish();
			return;
		}
		viewport.dataset.hataskBodyState = 'revealing';
		this.syncHataskBodyToggle();
		this.hataskBodyRevealTimer = this.scheduleTimeout(finish, 260);
	};

	renderHatask() {
		if (!this.hataskBody) return;
		const t = (this.colorMode === 'dark' ? DARK_THEMES : THEMES)[this.theme];
		const en = this.lang === 'en';
		this.hatask.style.background = t.bg;
		this.hataskBody.style.color = t.fg;
		this.hataskBody.style.fontFamily = t.body;
		this.hatask.style.setProperty('--hatask-bg', t.bg);
		this.hatask.style.setProperty('--hatask-surface', t.surface);
		this.hatask.style.setProperty('--hatask-fg', t.fg);
		this.hatask.style.setProperty('--hatask-fg2', t.fg2);
		this.hatask.style.setProperty('--hatask-rule', t.rule);
		this.hatask.style.setProperty('--hatask-accent', t.accent);
		this.hatask.style.setProperty('--hatask-head-font', t.head);
		this.hatask.style.setProperty('--hatask-body-font', t.body);
		this.root?.querySelectorAll('#hatask [data-th]').forEach(button => {
			const active = button.dataset.th === this.theme;
			button.setAttribute('aria-pressed', String(active));
			button.dataset.active = String(active);
		});
		if (this.theme === 'kashin') {
			this.hatask.style.backgroundImage = 'radial-gradient(rgba(255,107,74,.14) 1.4px,transparent 1.4px)';
			this.hatask.style.backgroundSize = '13px 13px';
		} else if (this.theme === 'suri') {
			this.hatask.style.backgroundImage = `radial-gradient(${t.rule} 1px,transparent 1px)`;
			this.hatask.style.backgroundSize = '4px 4px';
		} else {
			this.hatask.style.backgroundImage = 'none';
		}
		let html = '';
		if (this.theme === 'kisetsu') html = this.kisetsu(t, en);
		else if (this.theme === 'kashin') html = this.kashin(t, en);
		else if (this.theme === 'suri') html = this.suri(t, en);
		else html = this.hatakyu(t, en);
		this.hataskBody.innerHTML = html;
		this.hataskBody.querySelectorAll('[data-i]').forEach(el => {
			el.style.animation = `${t.anim} .5s cubic-bezier(.2,.8,.2,1) ${Number(el.dataset.i) * 0.055}s both`;
		});
		this.animateFlower();
		this.updateHataskClock();
		this.syncHataskBodyToggle();
	}

	cancelHataskFlower() {
		if (this.hataskFlowerTimer) this.cancelTimeout(this.hataskFlowerTimer);
		if (this.hataskFlowerRaf) this.cancelFrame(this.hataskFlowerRaf);
		this.hataskFlowerTimer = null;
		this.hataskFlowerRaf = null;
	}

	resetHataskFlower() {
		this.cancelHataskFlower();
		const ring = this.hataskBody?.querySelector('[data-flowerring]');
		if (ring) {
			const length = Number(ring.dataset.len) || 0;
			ring.style.strokeDashoffset = String(length * .32);
		}
		const stage = this.hataskBody?.querySelector('[data-floweremoji]');
		if (stage) {
			stage.innerHTML = '<i class="ti ti-seeding" aria-hidden="true"></i>';
			stage.style.animation = 'none';
		}
		const label = this.hataskBody?.querySelector('[data-flowerlabel]');
		if (label) label.textContent = this.lang === 'en' ? 'Hinagiku ・ 68%' : 'ヒナギク・68%';
	}

	finishHataskFlower() {
		this.cancelHataskFlower();
		const ring = this.hataskBody?.querySelector('[data-flowerring]');
		if (ring) ring.style.strokeDashoffset = '0';
		const stage = this.hataskBody?.querySelector('[data-floweremoji]');
		if (stage) {
			stage.innerHTML = '<i class="ti ti-flower" aria-hidden="true"></i>';
			stage.style.animation = this.deckMotionQuery?.matches ? 'none' : 'hWelcome-bloom .8s cubic-bezier(.34,1.56,.64,1) both';
		}
		const label = this.hataskBody?.querySelector('[data-flowerlabel]');
		if (label) label.textContent = this.lang === 'en' ? 'Hinagiku ・ bloomed!' : 'ヒナギク・咲きました！';
	}

	animateFlower() {
		this.resetHataskFlower();
		if (this.deckMotionQuery?.matches) {
			this.finishHataskFlower();
			return;
		}
		const ring = this.hataskBody?.querySelector('[data-flowerring]');
		if (!ring) return;
		const length = Number(ring.dataset.len) || 0;
		this.hataskFlowerTimer = this.scheduleTimeout(() => {
			this.hataskFlowerTimer = null;
			let startedAt = null;
			const step = (time) => {
				if (!this.hataskBody?.contains(ring)) return;
				if (startedAt == null) startedAt = time;
				const progress = Math.min(1, (time - startedAt) / 1120);
				const percent = 68 + 32 * progress;
				ring.style.strokeDashoffset = String(length - (length * percent / 100));
				if (progress < 1) this.hataskFlowerRaf = this.scheduleFrame(step);
				else {
					this.hataskFlowerRaf = null;
					this.finishHataskFlower();
				}
			};
			this.hataskFlowerRaf = this.scheduleFrame(step);
		}, 140);
	}

	flowerSvg(t, size, len, stroke) {
		return `<svg viewBox="0 0 ${size} ${size}" style="width:100%;height:100%;transform:rotate(-90deg)"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 6}" fill="none" stroke="${t.rule}" stroke-width="${stroke}"/><circle data-flowerring data-len="100" pathLength="100" cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 6}" fill="none" stroke="${t.accent}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="100" stroke-dashoffset="100"/></svg>`;
	}

	todoHtml(t, en) {
		return TODOS.map(x => `<div style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid ${t.rule};font-size:calc(var(--welcome-rem,16px) * .86)"><span style="width:17px;height:17px;border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;background:${x.done ? t.accent : 'transparent'};border:1.5px solid ${x.done ? t.accent : t.rule}">${x.done ? '<i class="ti ti-check"></i>' : ''}</span><span style="flex:1;${x.done ? 'opacity:.5;text-decoration:line-through' : ''}">${esc(en ? x.te : x.t)}</span></div>`).join('');
	}

	appsHtml(t, en, size, radius, border) {
		return APPS.map(a => `<button style="display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;background:none;border:none;font:inherit;padding:0"><span style="width:${size}px;height:${size}px;border-radius:${radius};display:flex;align-items:center;justify-content:center;font-size:calc(var(--welcome-rem,16px) * 1.3);color:#fff;background:${a.c};${border}"><i class="${a.i}"></i></span><small style="max-width:100%;font-size:calc(var(--welcome-rem,16px) * .6);font-weight:700;color:${t.fg2};text-align:center">${esc(en ? a.se : a.s)}</small></button>`).join('');
	}

	kisetsu(t, en) {
		const dept = (jp, en2, n) => `<div data-i="${n}" style="font-family:'Bebas Neue',sans-serif;font-size:calc(var(--welcome-rem,16px) * .7);letter-spacing:.28em;color:${t.accent};display:flex;align-items:center;gap:8px;margin:26px 0 12px"><span style="font-family:${t.head};letter-spacing:0;color:${t.fg};font-size:calc(var(--welcome-rem,16px) * .82)">${en ? en2 : jp}</span>${en2}<i style="flex:1;height:1px;background:${t.rule};font-style:normal"></i></div>`;
		return `
    <div data-i="0" style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:6px"><div style="font-family:${t.head};font-weight:800;font-size:calc(var(--welcome-rem,16px) * 4.4);line-height:.8;letter-spacing:-.02em" data-hatask-clock="time">--:--</div><div style="font-family:${t.head};font-size:calc(var(--welcome-rem,16px) * .9);color:${t.fg2};text-align:right;line-height:1.5"><span data-hatask-clock="shortDate"></span><br><span data-hatask-clock="weekday"></span></div></div>
    ${dept('ログイン日数', 'LOGIN DAYS', 1)}
    <div data-i="2" style="display:flex;align-items:baseline;gap:12px;padding:14px 0;border-top:1px solid ${t.rule};border-bottom:1px solid ${t.rule}"><div style="font-family:${t.head};font-weight:800;font-size:calc(var(--welcome-rem,16px) * 2.6);line-height:.9">128</div><div style="font-size:calc(var(--welcome-rem,16px) * .82);color:${t.fg2}">${en ? 'days in a row' : '日目'}</div><div style="margin-left:auto;font-size:calc(var(--welcome-rem,16px) * .78);display:flex;align-items:center;gap:6px;color:${t.fg2}"><i class="ti ti-trophy" style="color:${t.accent}"></i>${en ? 'rank' : 'サーバー内'} <b style="font-family:${t.head};color:${t.accent};font-size:calc(var(--welcome-rem,16px) * 1.1)">7</b> / 214</div></div>
    ${dept('道具', 'APPS', 3)}
    <div data-i="4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px 6px">${this.appsHtml(t, en, 46, '14px', '')}</div>
    ${dept('カレンダー', 'CALENDAR', 5)}
    <div data-hatask-feature="calendar" data-i="6">${EVENTS.map(e => `<div style="display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid ${t.rule};cursor:pointer"><span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:${e.c}"></span><span style="font-family:${t.head};font-weight:700;font-size:calc(var(--welcome-rem,16px) * 1);color:${t.accent};min-width:44px">${e.d}</span><span style="flex:1;font-size:calc(var(--welcome-rem,16px) * .88);font-weight:500">${esc(en ? e.te : e.t)}</span><span style="font-size:calc(var(--welcome-rem,16px) * .74);color:${t.fg3}">${e.tm}</span></div>`).join('')}</div>
    ${dept('やること', 'TODO', 7)}
    <div data-hatask-feature="todo" data-i="8">${this.todoHtml(t, en)}</div>
    <div data-i="9" style="display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:18px">
      <div><div style="font-family:'Bebas Neue',sans-serif;font-size:calc(var(--welcome-rem,16px) * .7);letter-spacing:.28em;color:${t.accent};margin-bottom:10px">MOOD</div><div style="display:flex;justify-content:space-between">${MOODS.map((m, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:5px"><i class="${m || 'ti ti-minus'}" style="font-size:calc(var(--welcome-rem,16px) * 1.25);color:${m ? t.accent : t.fg3}"></i><small style="font-size:calc(var(--welcome-rem,16px) * .58);color:${t.fg3}">${DOW[i]}</small></div>`).join('')}</div></div>
      <div data-hatask-feature="garden"><div style="font-family:'Bebas Neue',sans-serif;font-size:calc(var(--welcome-rem,16px) * .7);letter-spacing:.28em;color:${t.accent};margin-bottom:10px">GARDEN</div><div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="position:relative;width:88px;height:88px">${this.flowerSvg(t, 88, 239, 7)}<div data-floweremoji style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:calc(var(--welcome-rem,16px) * 2)">🌱</div></div><div data-flowerlabel style="font-size:calc(var(--welcome-rem,16px) * .72);color:${t.fg2}">${en ? 'Hinagiku ・ 68%' : 'ヒナギク・68%'}</div></div></div>
    </div>
    ${dept('ひとこと', 'HATASK EYE', 10)}
    <div data-i="11" style="border:1px solid ${t.fg};padding:18px 20px;text-align:center"><div style="font-family:'Bebas Neue',sans-serif;font-size:calc(var(--welcome-rem,16px) * .68);letter-spacing:.3em;color:${t.accent};margin-bottom:8px">EYE</div><div style="font-family:${t.head};font-size:calc(var(--welcome-rem,16px) * 1.02);line-height:1.9;font-weight:600">${en ? 'Bringing your social feed and daily life together' : 'SNSと日常をつなぎます'}</div></div>`;
	}

	kashin(t, en) {
		const cell = (bg, color, n, inner, span) => `<div data-i="${n}"${n === 2 ? ' data-hatask-feature="garden"' : n === 4 ? ' data-hatask-feature="calendar"' : n === 5 ? ' data-hatask-feature="todo"' : ''} style="border-radius:20px;padding:16px;border:2.5px solid ${t.fg};box-shadow:4px 4px 0 rgba(37,32,28,.16);background:${bg};color:${color};${span ? 'grid-column:span 2;' : ''}overflow:hidden">${inner}</div>`;
		const lbl = (i, s) => `<div style="font-size:calc(var(--welcome-rem,16px) * .66);font-weight:900;letter-spacing:.04em;opacity:.9;margin-bottom:8px;display:flex;align-items:center;gap:6px"><i class="${i}" style="font-size:calc(var(--welcome-rem,16px) * .95)"></i>${s}</div>`;
		return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${cell('#12a89c', '#fff', 0, '<div style="font-weight:900;font-size:calc(var(--welcome-rem,16px) * 3.2);line-height:.9;letter-spacing:-.02em" data-hatask-clock="time">--:--</div><div style="font-size:calc(var(--welcome-rem,16px) * .8);font-weight:700;opacity:.92;margin-top:4px"><span data-hatask-clock="longDate"></span> <span data-hatask-clock="weekday"></span></div>', true)}
      ${cell('#ffc23c', '#25201c', 1, `${lbl('ti ti-flame', en ? 'LOGIN DAYS' : 'ログイン日数')}<div style="font-weight:900;font-size:calc(var(--welcome-rem,16px) * 3);line-height:.85">128</div><div style="font-size:calc(var(--welcome-rem,16px) * .74);font-weight:700">${en ? 'days' : '日目'}</div><div style="font-size:calc(var(--welcome-rem,16px) * .72);font-weight:700;margin-top:8px;background:#25201c;color:#ffc23c;display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px"><i class="ti ti-trophy"></i>7位 / 214</div>`)}
      ${cell(t.surface, t.fg, 2, `${lbl('ti ti-flower', en ? 'GARDEN' : 'お庭')}<div style="position:relative;width:76px;height:76px;margin:0 auto">${this.flowerSvg(t, 76, 201, 7)}<div data-floweremoji style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:calc(var(--welcome-rem,16px) * 1.8)">🌱</div></div><div data-flowerlabel style="text-align:center;font-size:calc(var(--welcome-rem,16px) * .72);font-weight:700;margin-top:4px">${en ? 'Hinagiku 68%' : 'ヒナギク 68%'}</div>`)}
      ${cell(t.surface, t.fg, 3, `${lbl('ti ti-apps', en ? 'TOOLS' : '道具')}<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px 4px">${this.appsHtml(t, en, 44, '14px', 'border:2px solid #25201c;')}</div>`, true)}
      ${cell('#7a5cff', '#fff', 4, `${lbl('ti ti-calendar', en ? 'CALENDAR' : 'カレンダー')}${EVENTS.map(e => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1.5px solid rgba(255,255,255,.28)"><span style="font-weight:900;font-size:calc(var(--welcome-rem,16px) * .8);background:#fff;color:#7a5cff;padding:3px 7px;border-radius:8px;min-width:44px;text-align:center">${e.d}</span><span style="flex:1;font-size:calc(var(--welcome-rem,16px) * .8);font-weight:700">${esc(en ? e.te : e.t)}</span><span style="font-size:calc(var(--welcome-rem,16px) * .72);opacity:.85;font-weight:700">${e.tm}</span></div>`).join('')}`, true)}
      ${cell(t.surface, t.fg, 5, `${lbl('ti ti-checkbox', en ? 'TODO' : 'やること')}${this.todoHtml(t, en)}`, true)}
      ${cell('#ff6b4a', '#fff', 6, `${lbl('ti ti-mood-smile', en ? 'MOOD' : 'きもち')}<div style="display:flex;justify-content:space-between;margin-top:4px">${MOODS.map((m, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:3px"><i class="${m || 'ti ti-minus'}" style="font-size:calc(var(--welcome-rem,16px) * 1.2);${m ? '' : 'opacity:.45'}"></i><small style="font-size:calc(var(--welcome-rem,16px) * .55);opacity:.9;font-weight:700">${DOW[i]}</small></div>`).join('')}</div>`)}
      ${cell(t.fg, t.bg, 7, `${lbl('ti ti-eye', 'Hatask Eye')}<div style="font-weight:700;font-size:calc(var(--welcome-rem,16px) * .94);line-height:1.7;margin-top:4px">${en ? 'Bringing your social feed and daily life together' : 'SNSと日常をつなぎます'}</div>`)}
    </div>`;
	}

	suri(t, en) {
		const head = (jp, en2, n) => `<div data-i="${n}" style="display:flex;align-items:center;gap:8px;font-family:'Bebas Neue',sans-serif;letter-spacing:.1em;font-size:calc(var(--welcome-rem,16px) * .92);color:${t.accent};margin:22px 0 10px">${en2}<b style="font-family:${t.head};font-weight:900;font-size:calc(var(--welcome-rem,16px) * .72);letter-spacing:0;color:${t.fg};background:#ffe14f;padding:1px 6px">${en ? '' : jp}</b><i style="flex:1;border-top:2px dotted ${t.accent};font-style:normal"></i></div>`;
		return `
    <div data-i="0" style="border:3px solid ${t.fg};background:${t.accent};color:#fff;padding:16px 18px;display:flex;align-items:flex-end;justify-content:space-between;box-shadow:5px 5px 0 #ff4f9a"><div style="font-weight:900;font-size:calc(var(--welcome-rem,16px) * 3.6);line-height:.82;letter-spacing:-.03em" data-hatask-clock="time">--:--</div><div style="font-size:calc(var(--welcome-rem,16px) * .76);font-weight:700;text-align:right;line-height:1.4"><span data-hatask-clock="numericDate"></span><br><span data-hatask-clock="weekday"></span></div></div>
    ${head('ログイン日数', 'LOGIN DAYS', 1)}
    <div data-i="2" style="display:flex;align-items:center;gap:12px;border:3px solid ${t.fg};padding:12px 16px;background:#ffe14f"><div style="font-weight:900;font-size:calc(var(--welcome-rem,16px) * 2.6);line-height:.85">128</div><div style="font-size:calc(var(--welcome-rem,16px) * .76);font-weight:900">${en ? 'DAYS' : '日目'}</div><div style="margin-left:auto;font-size:calc(var(--welcome-rem,16px) * .74);font-weight:900;display:flex;align-items:center;gap:5px"><i class="ti ti-trophy"></i><b style="color:${t.accent};font-size:calc(var(--welcome-rem,16px) * 1.05)">7</b>/214</div></div>
    ${head('道具', 'APPS', 3)}
    <div data-i="4" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px 4px">${APPS.map(a => `<button style="display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;background:none;border:none;font:inherit"><span style="width:46px;height:46px;border:2.5px solid ${t.fg};display:flex;align-items:center;justify-content:center;font-size:calc(var(--welcome-rem,16px) * 1.35);color:${t.fg}"><i class="${a.i}"></i></span><small style="max-width:100%;font-size:calc(var(--welcome-rem,16px) * .6);font-weight:900;color:${t.fg2};text-align:center">${esc(en ? a.se : a.s)}</small></button>`).join('')}</div>
    ${head('カレンダー', 'CALENDAR', 5)}
    <div data-hatask-feature="calendar" data-i="6">${EVENTS.map(e => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:2px dotted ${t.rule}"><span style="width:10px;height:10px;flex-shrink:0;background:#ff4f9a"></span><span style="font-family:'Bebas Neue',sans-serif;font-size:calc(var(--welcome-rem,16px) * 1.1);color:#ff4f9a;min-width:42px">${e.d}</span><span style="flex:1;font-size:calc(var(--welcome-rem,16px) * .82);font-weight:700">${esc(en ? e.te : e.t)}</span><span style="font-size:calc(var(--welcome-rem,16px) * .72);font-weight:900;color:${t.accent}">${e.tm}</span></div>`).join('')}</div>
    ${head('やること', 'TODO', 7)}
    <div data-hatask-feature="todo" data-i="8">${this.todoHtml(t, en)}</div>
    ${head('お庭', 'GARDEN', 9)}
    <div data-hatask-feature="garden" data-i="10" style="display:flex;align-items:center;gap:18px;border:3px solid ${t.fg};padding:14px 18px;box-shadow:5px 5px 0 #ff4f9a"><div style="position:relative;width:84px;height:84px;flex-shrink:0">${this.flowerSvg(t, 84, 226, 7)}<div data-floweremoji style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:calc(var(--welcome-rem,16px) * 1.9)">🌱</div></div><div><div data-flowerlabel style="font-weight:900;font-size:calc(var(--welcome-rem,16px) * .95)">${en ? 'Hinagiku ・ 68%' : 'ヒナギク・68%'}</div><div style="font-size:calc(var(--welcome-rem,16px) * .74);color:${t.fg2};margin-top:4px">${en ? '24 bloomed so far' : 'これまでに咲いた花 24'}</div></div></div>`;
	}

	hatakyu(t, en) {
		const pin = (n, r, cls, inner, bg) => `<div class="hatakyu-pin" data-i="${n}"${n === 4 ? ' data-hatask-feature="calendar"' : n === 5 ? ' data-hatask-feature="todo"' : n === 6 ? ' data-hatask-feature="garden"' : ''} style="--r:${r};position:relative;break-inside:avoid;margin-bottom:18px;transform:rotate(${r})"><span style="position:absolute;top:-9px;left:50%;margin-left:-9px;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 8%,${cls} 46%,#8c2118);box-shadow:0 3px 5px rgba(0,0,0,.45);z-index:4"></span><div class="hatakyu-card" style="position:relative;background:${this.colorMode === 'dark' ? t.surface : (bg || t.surface)};color:${t.fg};padding:15px 16px 16px;box-shadow:0 12px 22px -10px rgba(40,24,8,.7)">${inner}</div></div>`;
		const jl = (i, s) => `<div style="font-family:${t.head};font-weight:900;font-size:calc(var(--welcome-rem,16px) * .86);margin-bottom:8px;display:flex;align-items:center;gap:6px"><i class="${i}" style="font-size:calc(var(--welcome-rem,16px) * 1.05);color:${t.accent}"></i>${s}</div>`;
		const row = (inner) => `<div class="hatakyu-row" style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed ${t.rule};font-size:calc(var(--welcome-rem,16px) * .82);font-weight:700">${inner}</div>`;
		return `
    <div data-i="0" style="position:relative;margin:2px 0 24px;padding-top:22px"><span style="content:'';position:absolute;top:8px;left:-6px;right:-6px;height:3px;border-radius:2px;background:linear-gradient(#e8d4a8,#b99a63);box-shadow:0 2px 3px rgba(0,0,0,.3)"></span>
      <div class="hatakyu-shortcuts">
        ${[['waving', 'ようこそ', 'Welcome', '-2deg'], ['checking-time', 'よてい', 'Schedule', '1.6deg'], ['watering-flower', 'おにわ', 'Garden', '-1.2deg'], ['chef-cooking', 'ごはん', 'Meal', '2.2deg']].map(([f, jp, e2, r], i) => `<button class="hatakyu-shortcut" style="--r:${r};background:none;border:none;padding:0;cursor:pointer;position:relative;transform:rotate(var(--r));animation:hWelcome-hkSway ${5 + i * 0.7}s ease-in-out infinite"><span style="position:absolute;top:-14px;left:50%;margin-left:-5px;width:10px;height:16px;border-radius:3px;background:linear-gradient(#e6d3ae,#a98a58)"></span><span style="display:block;background:${t.surface};padding:8px 8px 6px;box-shadow:0 10px 18px -8px rgba(40,24,8,.7)"><img src="${HK}${f}.png" alt="" style="width:100%;display:block" draggable="false"><span style="display:block;text-align:center;font-family:${t.head};font-weight:700;font-size:calc(var(--welcome-rem,16px) * .66);color:${t.fg2};margin-top:4px">${en ? e2 : jp}</span></span></button>`).join('')}
      </div>
    </div>
    <div class="hatakyu-board">
      ${pin(1, '-1.1deg', '#e0483c', `<div style="font-family:'Bebas Neue',sans-serif;letter-spacing:.2em;font-size:calc(var(--welcome-rem,16px) * .62);font-weight:700;color:${t.fg3};margin-bottom:6px;display:flex;align-items:center;gap:6px"><i class="ti ti-clock" style="font-size:calc(var(--welcome-rem,16px) * .95);color:${t.accent}"></i>NOW</div><div style="font-family:${t.head};font-weight:900;font-size:calc(var(--welcome-rem,16px) * 2.6);line-height:.86" data-hatask-clock="time">--:--</div><div style="font-size:calc(var(--welcome-rem,16px) * .76);font-weight:700;color:${t.fg2};margin-top:5px"><span data-hatask-clock="longDate"></span> <span data-hatask-clock="weekday"></span></div>`)}
      ${pin(2, '1.4deg', '#e8b52e', `${jl('ti ti-flame', en ? 'Login days' : 'ログイン日数')}<div style="font-family:${t.head};font-weight:900;font-size:calc(var(--welcome-rem,16px) * 2.3);line-height:.9;color:${t.accent}">128<small style="font-size:calc(var(--welcome-rem,16px) * .8);color:${t.fg2}">&nbsp;${en ? 'days' : '日目'}</small></div><div style="font-size:calc(var(--welcome-rem,16px) * .74);color:${t.fg2};font-weight:700;display:flex;align-items:center;gap:5px;margin-top:5px"><i class="ti ti-trophy" style="color:#b9791f"></i>7位 / 214人</div>`, '#fdeec4')}
      ${pin(3, '-.7deg', '#2f7de0', `${jl('ti ti-apps', en ? 'Tools' : '道具')}<div class="hatakyu-apps">${APPS.map(a => `<button class="hatakyu-app-button" style="display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;background:none;border:none;font:inherit;padding:0"><span style="width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:calc(var(--welcome-rem,16px) * 1.2);color:#fff;background:${a.c};box-shadow:0 3px 6px -2px rgba(0,0,0,.4)"><i class="${a.i}"></i></span><small style="max-width:100%;font-size:calc(var(--welcome-rem,16px) * .58);font-weight:700;color:${t.fg2};text-align:center">${esc(en ? a.se : a.s)}</small></button>`).join('')}</div>`)}
      ${pin(4, '.9deg', '#43976a', `${jl('ti ti-calendar-event', en ? 'Calendar' : 'カレンダー')}${EVENTS.map(e => row(`<span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:${e.c}"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${esc(en ? e.te : e.t)}</span><b style="margin-left:auto;font-size:calc(var(--welcome-rem,16px) * .7);color:${t.fg2};white-space:nowrap">${e.d} ${e.tm}</b>`)).join('')}`)}
      ${pin(5, '-1.6deg', '#a660c8', `${jl('ti ti-checkbox', en ? 'To do' : 'やること')}${this.todoHtml({ rule: t.rule, accent: t.accent }, en)}`, '#e3f0ff')}
      ${pin(6, '1.1deg', '#e0483c', `${jl('ti ti-flower', en ? 'Garden' : 'おにわ')}<span style="position:relative;display:block;width:104px;height:104px;margin:2px auto 0">${this.flowerSvg({ rule: t.rule, accent: '#6fbc8b' }, 104, 283, 6)}<span data-floweremoji class="hatakyu-garden-growth" style="position:absolute;inset:0;font-size:calc(var(--welcome-rem,16px) * 1.6)">🌱</span></span><div data-flowerlabel style="font-size:calc(var(--welcome-rem,16px) * .74);color:${t.fg2};font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;margin-top:5px"><i class="ti ti-plant-2" style="color:#b9791f"></i>${en ? 'Hinagiku ・ 68%' : 'ヒナギク・68%'}</div>`, '#e4f6ee')}
      ${pin(7, '-.5deg', '#2f7de0', `${jl('ti ti-mood-smile', en ? 'Mood' : 'きもち')}<div style="display:flex;justify-content:space-between">${MOODS.map((m, i) => `<span style="display:flex;flex-direction:column;align-items:center;gap:3px"><i class="${m || 'ti ti-point'}" style="font-size:calc(var(--welcome-rem,16px) * 1.3);color:${m ? t.accent : t.fg2};${m ? '' : 'opacity:.5'}"></i><small style="font-size:calc(var(--welcome-rem,16px) * .56);font-weight:700">${DOW[i]}</small></span>`).join('')}</div>`)}
      ${pin(8, '.6deg', '#a660c8', `<div style="font-family:'Bebas Neue',sans-serif;letter-spacing:.2em;font-size:calc(var(--welcome-rem,16px) * .62);font-weight:700;color:${t.fg3};margin-bottom:6px;display:flex;align-items:center;gap:6px"><i class="ti ti-eye" style="font-size:calc(var(--welcome-rem,16px) * .95);color:${t.accent}"></i>HATASK EYE</div><div style="font-family:${t.head};font-weight:700;font-size:calc(var(--welcome-rem,16px) * .94);line-height:1.75">${en ? 'Bringing your social feed and daily life together' : 'SNSと日常をつなぎます'}</div>`, '#fdeec4')}
      ${pin(9, '1.7deg', '#e8b52e', `${jl('ti ti-message-report', 'HataFeed')}${row(`<i class="ti ti-circle-check" style="color:#b9791f"></i><span style="flex:1">${en ? 'Share a suggestion or report a problem' : '気づいたことや要望を投稿'}</span>`)}${row(`<i class="ti ti-message" style="color:#b9791f"></i><span style="flex:1">${en ? 'Follow replies and progress' : '返信や対応の進み具合を確認'}</span>`)}`)}
    </div>`;
	}

	/* ---------- Hatady ---------- */
	onHatadyTab = (ev) => {
		const b = ev.currentTarget;
		this.hyTab = Number(b.dataset.hy);
		b.parentElement.querySelectorAll('[data-hy]').forEach(x => {
			const on = x === b;
			x.dataset.active = String(on);
			x.style.color = on ? 'var(--hyFg)' : 'var(--hyMuted)';
			x.style.fontWeight = on ? '700' : '500';
			x.style.borderBottomColor = on ? 'var(--hyAccent)' : 'transparent';
		});
		this.renderHatady();
	};

	renderHatady() {
		if (!this.hatadyBody) return;
		const en = this.lang === 'en';
		const stat = (n, l, i, d) => `<div style="min-width:0;display:flex;flex-direction:column;justify-content:center;background:var(--hySurface);border:1px solid var(--hyDivider);border-radius:12px;padding:12px 16px;animation:hWelcome-hyBlockIn .45s cubic-bezier(.22,.9,.3,1) ${d}s both"><div style="font-family:'Zen Maru Gothic',sans-serif;font-weight:900;font-size:20px;color:var(--hyFg)">${i ? `<i class="${i}" style="color:var(--hyAccent)"></i> ` : ''}${n}</div><div style="font-size:10.5px;color:var(--hyMuted);margin-top:2px">${l}</div></div>`;
		let body = '';
		if (this.hyTab === 0) {
			const cells = [];
			for (let c = 0; c < 20; c++) {
				let col = '';
				for (let r = 0; r < 7; r++) {
					const v = Math.max(0, Math.round(Math.sin(c * 0.9 + r * 1.7) * 2 + 1.4));
					const alpha = [0.07, 0.28, 0.55, 0.85][Math.min(3, v)];
					col += `<span style="width:14px;height:14px;border-radius:3px;flex-shrink:0;background:rgba(217,130,74,${alpha});animation:hWelcome-hyHeatIn .42s cubic-bezier(.34,1.56,.64,1) ${(c * 7 + r) * 0.006}s both"></span>`;
				}
				cells.push(`<div style="display:flex;flex-direction:column;gap:4px">${col}</div>`);
			}
			body = `<div style="max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;align-items:center;gap:13px;border:1px solid rgba(217,130,74,.4);border-radius:14px;padding:14px 18px;background:color-mix(in srgb,var(--hyAccent) 10%,var(--hySurface));animation:hWelcome-hyBlockIn .4s both">
          <span style="font-size:26px"><i class="ti ti-flame" style="color:var(--hyAccent)"></i></span>
          <span style="flex:1;font-size:12.5px;line-height:1.5;color:var(--hySoft)"><b style="font-family:'Zen Maru Gothic',sans-serif;font-size:14px;color:var(--hyFg)">${en ? 'Not recorded today yet' : '今日はまだ記録がありません'}</b><br>${en ? '31 days in a row — do not let it break here.' : '31日目。ここで途切れさせないでおきましょう。'}</span>
          <button style="flex-shrink:0;display:inline-flex;align-items:center;gap:6px;background:linear-gradient(90deg,color-mix(in srgb,var(--hyAccent) 78%,white),var(--hyAccent));color:#fff;border:none;border-radius:999px;padding:9px 18px;font-size:12.5px;font-weight:700;cursor:pointer">${en ? 'Record' : '記録する'}</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:stretch">
          <div style="flex:2 1 420px;min-width:0;background:var(--hySurface);border:1px solid var(--hyDivider);border-radius:14px;padding:16px 18px;box-shadow:0 1px 3px rgba(96,70,35,.06);animation:hWelcome-hyBlockIn .5s .05s both">
            <div style="font-size:12.5px;font-weight:700;color:var(--hyFg);margin-bottom:12px">${en ? 'Last 20 weeks' : '過去20週'}</div>
            <div style="display:flex;gap:4px;overflow-x:auto">${cells.join('')}</div>
          </div>
          <div style="flex:1 1 260px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
            ${stat('31', en ? 'Streak' : '連続記録', 'ti ti-flame', 0)}
            ${stat('18', en ? 'Books' : '読んだ本', '', 0.05)}
            ${stat('42h', en ? 'Studied' : '学習時間', '', 0.1)}
            ${stat('9', en ? 'Games' : 'ゲーム', '', 0.15)}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;animation:hWelcome-hyBlockIn .5s .18s both">
          ${[['ti ti-book', '灯台守の手紙', en ? 'Read 32 pages' : '32ページ読んだ', 'var(--hyAccent)'], ['ti ti-device-gamepad-2', 'ソラリス・ドリフト', en ? '1h 20m ・ co-op' : '1時間20分 ・ 協力プレイ', '#8b7cf6'], ['ti ti-movie', '雨の日の観測所', en ? 'Watched ・ ★★★★☆' : '鑑賞 ・ ★★★★☆', '#5b8fd6']].map(([i, t2, s, c]) => `<div style="display:flex;gap:12px;align-items:center;background:var(--hySurface);border:1px solid var(--hyDivider);border-radius:12px;padding:14px 16px"><span style="width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;color:#fff;background:${c};flex-shrink:0"><i class="${i}"></i></span><span style="min-width:0"><b style="display:block;font-size:13px;color:var(--hyFg)">${t2}</b><small style="font-size:11.5px;color:var(--hyMuted)">${s}</small></span></div>`).join('')}
        </div>
      </div>`;
		} else {
			body = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px">${[['灯台守の手紙', 'ti ti-book', 'var(--hyAccent)'], ['ソラリス・ドリフト', 'ti ti-device-gamepad-2', '#8b7cf6'], ['雨の日の観測所', 'ti ti-movie', '#5b8fd6'], ['夜行バスの窓', 'ti ti-book', 'var(--hyAccent)'], ['カゲロウ・サーキット', 'ti ti-device-gamepad-2', '#8b7cf6'], ['八月の潜水艇', 'ti ti-movie', '#5b8fd6']].map(([n, i, c], k) => `<div style="background:var(--hySurface);border:1px solid var(--hyDivider);border-radius:12px;padding:14px;animation:hWelcome-hyBlockIn .45s cubic-bezier(.22,.9,.3,1) ${k * 0.06}s both"><span style="display:flex;width:36px;height:36px;border-radius:10px;align-items:center;justify-content:center;color:#fff;background:${c};margin-bottom:10px"><i class="${i}"></i></span><b style="display:block;font-size:13px;color:var(--hyFg);line-height:1.5">${n}</b><small style="font-size:11px;color:var(--hyMuted)">${en ? 'records' : '記録'} ${3 + k}</small></div>`).join('')}</div>`;
		}
		this.hatadyBody.innerHTML = body;
	}

	/* ---------- HataSideStudio ---------- */
	renderStudio() {
		if (!this.studioGrid) return;
		const items = [
			{ i: 'ti ti-home', l: 'TL', c: '' }, { i: 'ti ti-search', l: this.lang === 'en' ? 'Search' : '検索', c: '' }, { i: 'ti ti-bell', l: this.lang === 'en' ? 'Notifications' : '通知', c: '' },
			{ i: 'ti ti-eye', l: 'Hatask', c: '#7eb5b2' }, { i: 'ti ti-book-2', l: 'Hatady', c: '#e79b5e' }, { i: 'ti ti-message-report', l: 'Feed', c: '#34d399' },
		];
		const radius = this.shape === 'circle' ? '999px' : this.shape === 'pill' ? '999px' : '10px';
		const square = this.shape === 'circle';
		this.studioGrid.style.gridTemplateColumns = `repeat(${this.cols},minmax(0,1fr))`;
		this.studioGrid.innerHTML = items.map((it, k) => `<button style="display:flex;${this.cols > 1 ? 'flex-direction:column;justify-content:center;text-align:center;' : ''}align-items:center;gap:${this.cols > 1 ? '4px' : '10px'};padding:${square ? '0' : '9px 8px'};${square ? 'width:44px;height:44px;justify-self:center;justify-content:center;' : ''}border:none;border-radius:${radius};background:${it.c ? it.c + '22' : 'var(--panel)'};color:${it.c || 'var(--fg)'};cursor:pointer;font-size:12px;font-weight:600;transition:all .28s cubic-bezier(.2,.8,.2,1);animation:hWelcome-fadeUp .38s cubic-bezier(.2,.8,.2,1) ${k * 0.04}s both"><i class="${it.i}" style="font-size:17px"></i>${square ? '' : `<span style="font-size:${this.cols > 1 ? '11px' : '12.5px'}">${it.l}</span>`}</button>`).join('');
	}

	onShape = (ev) => {
		this.shape = ev.currentTarget.dataset.shape;
		ev.currentTarget.parentElement.querySelectorAll('[data-shape]').forEach(x => {
			const on = x === ev.currentTarget;
			x.style.borderColor = on ? 'var(--accent)' : 'var(--divider)';
			x.style.background = on ? 'var(--accentedBg)' : 'var(--panel)';
			x.style.color = on ? 'var(--accent)' : 'var(--fgSoft)';
		});
		this.renderStudio();
	};

	onCols = (ev) => {
		this.cols = Number(ev.currentTarget.dataset.col);
		ev.currentTarget.parentElement.querySelectorAll('[data-col]').forEach(x => {
			const on = x === ev.currentTarget;
			x.style.borderColor = on ? 'var(--accent)' : 'var(--divider)';
			x.style.background = on ? 'var(--accentedBg)' : 'var(--panel)';
			x.style.color = on ? 'var(--accent)' : 'var(--fgSoft)';
		});
		this.renderStudio();
	};

	onPaw = (ev) => {
		this.paw = ev.currentTarget.dataset.paw;
		ev.currentTarget.parentElement.querySelectorAll('[data-paw]').forEach(x => {
			const on = x === ev.currentTarget;
			x.style.borderColor = on ? 'var(--accent)' : 'var(--divider)';
			x.style.background = on ? 'var(--accentedBg)' : 'var(--panel)';
			x.style.color = on ? 'var(--accent)' : 'var(--fgSoft)';
		});
		const icon = this.studioPreview.querySelector('[data-studiopaw]');
		if (icon) {
			icon.className = this.paw === 'paw' ? 'ti ti-paw' : 'ti ti-pencil';
			icon.setAttribute('data-studiopaw', '');
			icon.animate([{ transform: 'scale(.6) rotate(-20deg)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
		}
	};

	/* ---------- 参加 ---------- */
	onInvite = () => {
		const msg = this.root.querySelector('[data-invitemsg]');
		if (!msg) return;
		msg.textContent = this.lang === 'en' ? 'Demo page — nothing is actually sent.' : 'デモページのため、実際の照合は行われません。';
		msg.style.opacity = '1';
	};

	onApply = (ev) => {
		const b = ev.currentTarget.querySelector('[data-applylabel]');
		if (!b) return;
		const before = b.textContent;
		b.textContent = this.lang === 'en' ? 'Demo only' : 'デモです';
		this.scheduleTimeout(() => { b.textContent = before; }, 1600);
	};
}
