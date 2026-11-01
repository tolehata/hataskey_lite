/* SPDX-License-Identifier: AGPL-3.0-only */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyle, compileTemplate, parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import * as Vue from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, Ref } from 'vue';
import type { entities } from 'cherrypick-js';
import { getLtlEmojiVoteAnchor } from '@/utility/ltl-emoji-vote-anchor.js';
import { notificationOutlinePaths } from '@/utility/hataskey-notification-toast.js';
import MkLtlEmojiVoteOutline from '@/components/MkLtlEmojiVoteOutline.vue';

type RootNode = NonNullable<NonNullable<ReturnType<typeof parse>['descriptor']['template']>['ast']>;
type TemplateChildNode = RootNode['children'][number];
type ElementNode = Extract<TemplateChildNode, { type: 1 }>;
// Compiler AST node kinds; use the installed compiler-sfc public AST so this
// regression needs no new compiler-dom dependency in the frontend package.
const NodeTypes = { ELEMENT: 1, SIMPLE_EXPRESSION: 4, ATTRIBUTE: 6, DIRECTIVE: 7 } as const;

function production(filename: string) {
	const descriptor = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename }).descriptor;
	if (!descriptor.template?.ast || !descriptor.scriptSetup) throw new Error(`Missing production SFC: ${filename}`);
	return {
		template: descriptor.template.ast,
		style: descriptor.styles[0],
		setup: ts.createSourceFile(`${filename}.ts`, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
	};
}

const simple = production('src/ui/simple.vue');
const timeline = production('src/components/MkStreamingNotesTimeline.vue');

function element(root: RootNode | ElementNode, predicate: (node: ElementNode) => boolean): ElementNode {
	let found: ElementNode | undefined;

	function visit(node: RootNode | TemplateChildNode) {
		if (node.type === NodeTypes.ELEMENT && predicate(node)) { found ??= node; return; }
		if ('children' in node && Array.isArray(node.children)) for (const child of node.children) visit(child as TemplateChildNode);
	}

	visit(root);
	if (!found) throw new Error('Expected production template node');
	return found;
}

function prop(node: ElementNode, name: string): string | undefined {
	const value = node.props.find(item => item.type === NodeTypes.ATTRIBUTE ? item.name === name : item.arg?.type === NodeTypes.SIMPLE_EXPRESSION && item.arg.content === name);
	return value?.type === NodeTypes.ATTRIBUTE ? value.value?.content : value?.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? value.exp.content : undefined;
}

function opening(node: ElementNode): string {
	const first = node.children.at(0);
	if (!first) throw new Error('Expected a production container with children');
	return node.loc.source.slice(0, first.loc.start.offset - node.loc.start.offset);
}

function declaration(setup: ts.SourceFile, name: string): ts.Statement {
	const found = setup.statements.filter(node => ts.isVariableStatement(node)
		&& node.declarationList.declarations.some(item => ts.isIdentifier(item.name) && item.name.text === name));
	if (found.length !== 1) throw new Error(`Expected one production declaration: ${name}`);
	return found[0];
}

function execute(setup: ts.SourceFile, names: string[], bindings: Record<string, unknown>, extra: ts.Statement[] = []): Record<string, unknown> {
	const statements = [...names.map(name => declaration(setup, name)), ...extra].sort((a, b) => a.pos - b.pos);
	const source = `${statements.map(node => node.getText(setup)).join('\n')}\nreturn { ${names.join(', ')} };`;
	const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
	return new Function(...Object.keys(bindings), code)(...Object.values(bindings));
}

function render(template: string) {
	const result = compileTemplate({ source: template, filename: 'navbar-fixture.vue', id: 'navbar-fixture', compilerOptions: { mode: 'function', prefixIdentifiers: true, cacheHandlers: false } });
	if (result.errors.length) throw new Error(`Fixture template compilation failed: ${String(result.errors[0])}`);
	return new Function('Vue', result.code)(Vue);
}

const topBar = element(simple.template, node => prop(node, 'class')?.includes('$style.topBar,') ?? false);
const stack = element(topBar, node => prop(node, 'ref') === 'topNavStackEl');
const frame = element(topBar, node => prop(node, 'ref') === 'notificationOutlineEl');
const voteOutline = element(frame, node => node.tag === 'MkLtlEmojiVoteOutline');
const pill = element(frame, node => prop(node, 'class') === '$style.topPill');
const navigation = element(pill, node => prop(node, 'class') === '$style.topPillNav');
const tabs = element(navigation, node => prop(node, 'ref') === 'emojiVoteNavbarTabs');
const navbarTarget = element(pill, node => prop(node, 'ref') === 'ltlEmojiVoteNavbarTarget');
const localTimeline = element(simple.template, node => node.tag === 'MkStreamingNotesTimeline' && prop(node, 'src') === 'local');
const navbarCard = element(timeline.template, node => node.tag === 'Teleport' && prop(node, 'to') === 'props.emojiVoteNavbarTarget');
const inlineCard = element(timeline.template, node => node.tag === 'MkLtlEmojiVote' && prop(node, 'class') === '$style.emojiVoteRow');
const loop = element(timeline.template, node => node.tag === 'template' && node.props.some(item => item.type === NodeTypes.DIRECTIVE && item.name === 'for' && item.exp?.type === NodeTypes.SIMPLE_EXPRESSION && item.exp.content.includes('visibleItems')));
const navbarStateStatements = timeline.setup.statements.filter(node => ts.isExpressionStatement(node)
	&& ts.isCallExpression(node.expression) && ['watch', 'onBeforeUnmount'].includes(node.expression.expression.getText(timeline.setup))
	&& node.getText(timeline.setup).includes('emit(\'emojiVoteNavbarState\''));
if (navbarStateStatements.length !== 2) throw new Error('Expected production navbar state watcher and cleanup');
const navbarWidthStatements = simple.setup.statements.filter(node => ts.isExpressionStatement(node)
	&& ts.isCallExpression(node.expression) && node.expression.expression.getText(simple.setup) === 'watch'
	&& node.getText(simple.setup).includes('watch([emojiVoteInNavbar, emojiVoteNavbarNav, emojiVoteNavbarTabs]'));
if (navbarWidthStatements.length !== 1) throw new Error('Expected production navbar width observer');

// Keep the actual production attributes, vote branches and emitted-state expressions.
// Unrelated navigation buttons, network subscriptions and note rendering are fixtures.
const rootTemplate = `<div>${opening(topBar)}${opening(stack)}${opening(frame)}${voteOutline.loc.source}${opening(pill)}${opening(navigation)}${opening(tabs)}<span>navigation</span></div></div><template v-if="hostAvailable">${navbarTarget.loc.source}</template></div></div></div></div>${localTimeline.loc.source.replace('v-else-if=', 'v-if=')}</div>`;
const childTemplate = `<div>${navbarCard.loc.source}<div data-inline-cards>${opening(loop).replace(' v-else', '')}${inlineCard.loc.source}</template></div></div>`;
const classes = new Proxy({}, { get: (_target, key) => key });
const apps: App[] = [];
const resizeObservers: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
let dimensions = { nav: 240, tabs: 220, tabsViewport: 220, frameWidth: 440, frameHeight: 360 };
beforeEach(() => {
	dimensions = { nav: 240, tabs: 220, tabsViewport: 220, frameWidth: 440, frameHeight: 360 };
	resizeObservers.length = 0;
	vi.stubGlobal('ResizeObserver', class {
		disconnect = vi.fn();
		constructor(callback: ResizeObserverCallback) { resizeObservers.push({ callback, disconnect: this.disconnect }); }
		observe() {}
	});
	vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
		return this.classList.contains('topPillNav') ? dimensions.nav : this.classList.contains('topPillTabs') ? dimensions.tabs : 0;
	});
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
		return this.classList.contains('topPillTabs') ? dimensions.tabsViewport : 0;
	});
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ x: 0, y: 0, top: 0, left: 0, right: dimensions.frameWidth, bottom: dimensions.frameHeight, width: dimensions.frameWidth, height: dimensions.frameHeight, toJSON: () => ({}) }));
});
afterEach(() => {
	for (const app of apps.splice(0)) app.unmount();
	window.document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function flush() { await Vue.nextTick(); await Vue.nextTick(); await Vue.nextTick(); }

function fixture(options: { host?: boolean; tab?: string; deck?: boolean; page?: boolean; hidden?: boolean; voteEnabled?: boolean; inline?: boolean } = {}) {
	const tab = Vue.ref(options.tab ?? 'local');
	const deckActive = Vue.ref(options.deck ?? false);
	const isPageView = Vue.ref(options.page ?? false);
	const hostAvailable = Vue.ref(options.host ?? true);
	const showTopBar = Vue.ref(false);
	const voteEnabled = Vue.ref(options.voteEnabled ?? true);
	const phase = Vue.ref('voting');
	const declined = Vue.ref(false);
	const round = Vue.ref({ id: 'round', noteId: 'trigger', total: 0, phase: 'voting' });
	const notificationToasts = { navbarNotice: Vue.ref(null), items: Vue.ref<unknown[]>([]), integrated: Vue.ref(false), surface: Vue.ref(null), outline: Vue.ref<HTMLElement | null>(null) };
	const navbarNewNotes = Vue.ref<{ text: string } | null>(null);
	const paginator = { fetching: Vue.ref(false), error: Vue.ref(false) };
	const notes = Vue.ref([{ id: 'trigger', text: '絵文字を選ぶぞ', userId: 'author', user: { id: 'author', host: null }, visibility: 'public', channelId: null, files: [], isHidden: options.hidden ?? false }] as unknown as entities.Note[]);
	const card = Vue.defineComponent({
		props: { navbar: Boolean, phase: String },
		setup: props => () => Vue.h('section', { 'data-vote-card': props.navbar ? 'navbar' : 'inline', 'data-phase': props.phase }),
	});
	const child = Vue.defineComponent({
		props: ['src', 'withSensitive', 'visitorMode', 'emojiVoteActive', 'emojiVoteEffectTarget', 'emojiVoteNavbar', 'emojiVoteNavbarTarget'],
		emits: ['emojiVoteNavbarState'],
		components: { MkLtlEmojiVote: card },
		setup(props, { emit }) {
			const bindings = {
				computed: Vue.computed, watch: Vue.watch, onBeforeUnmount: Vue.onBeforeUnmount,
				props, emit, paginator, isHatasaba: true, getLtlEmojiVoteAnchor, visibleItems: notes,
				prefer: { r: { ltlEmojiVoteEnabled: voteEnabled } },
				emojiVoteRound: round, emojiVotePhase: phase, emojiVoteDeclined: declined, $i: null,
			};
			const selected = execute(timeline.setup, ['emojiVoteActive', 'emojiVoteAnchor'], bindings, navbarStateStatements);
			const { $i: _account, ...renderBindings } = bindings;
			return {
				...renderBindings, ...selected, emojiVoteChoice: null, emojiVoteNow: 0,
				emojiVoteSubmitting: false, emojiVoteError: null, claimEmojiVoteEffect: () => false, voteEmoji: () => {}, dismissEmojiVote: () => {},
			};
		},
		render: render(childTemplate),
	});
	let state: Record<string, Ref<unknown>>;
	const root = Vue.defineComponent({
		components: { MkStreamingNotesTimeline: child, MkLtlEmojiVoteOutline },
		setup() {
			const bindings = {
				ref: Vue.ref, computed: Vue.computed, watch: Vue.watch, tab, deckActive, isPageView,
				isCollectionTimelinePage: Vue.ref(false), isDesktop: Vue.ref(true),
				notificationToasts, navbarNewNotes, navbarNewNotesContent: navbarNewNotes,
				punchBusy: Vue.ref(false), punchVisible: Vue.ref(false),
				pullRefresh: {
					active: Vue.ref(false), state: Vue.ref({ phase: 'idle', height: 0, distance: 0 }), style: Vue.ref({}),
				},
				navbarLoadingShown: Vue.ref(false), newNotesMotionEnabled: Vue.ref(false), pendingApiRequestsCount: Vue.ref(0),
			};
			state = execute(simple.setup, [
				'normalLtlVoteActive', 'nativeNavbarVisible', 'ltlEmojiVoteNavbarTarget', 'emojiVoteNavbarState', 'emojiVoteInNavbar', 'mobileNotificationOnly',
				'emojiVoteNavbarNav', 'emojiVoteNavbarTabs', 'emojiVoteNavbarRestWidth', 'notificationOutlineEl', 'emojiVoteNavbarStackStyle',
				'navbarPullPillEl', 'navbarPullFrameStyle',
			], bindings, navbarWidthStatements) as typeof state;
			return {
				...bindings, ...state, hostAvailable, showTopBar, footerIsDark: false, navbarSearchOpen: false,
				navbarNotificationShowing: Vue.computed(() => notificationToasts.items.value.length > 0 && notificationToasts.integrated.value),
				navbarNotificationShrinking: false, navbarNotificationSizing: false, navbarNotificationKind: undefined, navbarNotificationWidthStyle: {},
				mobileToastVisible: false, prefer: { r: { animation: Vue.ref(true) } },
				withRenotes: true, withSensitive: true, onlyFiles: false, timelineGlassBg: false, ltlEmojiVoteEffects: null,
			};
		},
		render: render(rootTemplate),
	});
	const mountPoint = window.document.createElement('div');
	window.document.body.append(mountPoint);
	const app = options.inline
		? Vue.createApp(child, { src: 'local', withSensitive: true, emojiVoteActive: true, emojiVoteNavbar: false })
		: Vue.createApp(root);
	app.config.globalProperties.$style = classes;
	app.config.globalProperties.$i = null;
	apps.push(app);
	app.mount(mountPoint);

	function required(selector: string): HTMLElement {
		const found = mountPoint.querySelector<HTMLElement>(selector);
		if (!found) throw new Error(`Expected fixture element: ${selector}`);
		return found;
	}

	return {
		mountPoint, required, tab, deckActive, isPageView, hostAvailable, showTopBar, voteEnabled, phase, declined, round, notes, paginator, notificationToasts, navbarNewNotes,
		get state() { return state; },
	};
}

describe('Hataskey emoji vote navbar production wiring', () => {
	it('keeps the navbar in its ordinary state when the vote preference starts disabled', async () => {
		const view = fixture({ voteEnabled: false });
		await flush();
		expect(view.mountPoint.querySelector('[data-vote-card]')).toBeNull();
		expect(view.mountPoint.querySelector('[data-emoji-vote-outline]')).toBeNull();
		expect(view.required('.topBar').dataset.emojiVote).toBe('false');
		expect(view.state.emojiVoteNavbarStackStyle.value).toEqual({});
		view.voteEnabled.value = true;
		await flush();
		expect(view.required('[data-vote-card]').dataset.voteCard).toBe('navbar');
	});

	it('removes a result and its outline on a live preference change while retaining ordinary notices', async () => {
		const view = fixture();
		view.phase.value = 'result';
		view.round.value = { ...view.round.value, total: 5, phase: 'result' };
		view.navbarNewNotes.value = { text: '新しいノート' };
		await flush();
		expect(view.required('.topPillFrame').dataset.emojiCelebrating).toBe('true');
		view.voteEnabled.value = false;
		await flush();
		expect(view.mountPoint.querySelector('[data-vote-card]')).toBeNull();
		expect(view.mountPoint.querySelector('[data-emoji-vote-outline]')).toBeNull();
		expect(view.state.emojiVoteNavbarStackStyle.value).toEqual({});
		expect(view.required('.topPill').dataset.newNotes).toBe('true');
		expect(view.required('.topBar').dataset.hidden).toBe('false');
	});

	it('gates the same inline vote branch used by deck LTL columns', async () => {
		const view = fixture({ inline: true, voteEnabled: false });
		await flush();
		expect(view.mountPoint.querySelector('[data-vote-card]')).toBeNull();
		view.voteEnabled.value = true;
		await flush();
		expect(view.required('[data-vote-card]').dataset.voteCard).toBe('inline');
		view.voteEnabled.value = false;
		await flush();
		expect(view.mountPoint.querySelector('[data-vote-card]')).toBeNull();
	});

	it('reserves navbar placement before its target arrives and mounts only one card in the target afterwards', async () => {
		const view = fixture({ host: false });
		await flush();
		expect(view.mountPoint.querySelectorAll('[data-vote-card]')).toHaveLength(0);
		view.hostAvailable.value = true;
		await flush();
		expect(view.mountPoint.querySelectorAll('[data-vote-card="inline"]')).toHaveLength(0);
		expect(view.required('.emojiVoteNavbarViewport').querySelectorAll('[data-vote-card="navbar"]')).toHaveLength(1);
		expect(view.mountPoint.querySelectorAll('[data-vote-card]')).toHaveLength(1);
	});

	it.each(['fetching', 'error'] as const)('releases the navbar pin while the timeline is %s', async state => {
		const view = fixture();
		await flush();
		expect(view.required('.topBar').dataset.emojiVote).toBe('true');
		view.paginator[state].value = true;
		await flush();
		expect(view.mountPoint.querySelectorAll('[data-vote-card]')).toHaveLength(0);
		expect(view.required('.topBar').dataset.emojiVote).toBe('false');
		view.paginator[state].value = false;
		await flush();
		expect(view.mountPoint.querySelectorAll('[data-vote-card]')).toHaveLength(1);
		expect(view.required('.topBar').dataset.emojiVote).toBe('true');
	});

	it.each([{ tab: 'following' }, { deck: true }, { page: true }, { hidden: true }])('does not expose or pin a vote outside its visible local timeline: %j', async options => {
		const view = fixture(options);
		await flush();
		expect(view.mountPoint.querySelectorAll('[data-vote-card]')).toHaveLength(0);
		expect(view.required('.topBar').dataset.emojiVote).toBe('false');
		expect(view.required('.topBar').dataset.hidden).toBe('true');
		expect(view.required('.topPillFrame').dataset.emojiCelebrating).toBe('false');
	});

	it('pins the visible vote during scroll hiding and lights the outline only for a result with votes', async () => {
		const view = fixture();
		await flush();
		expect(view.showTopBar.value).toBe(false);
		expect(view.required('.topBar').dataset.hidden).toBe('false');
		expect(view.required('.topPillFrame').dataset.emojiCelebrating).toBe('false');
		view.phase.value = 'result';
		await flush();
		expect(view.required('.topPillFrame').dataset.emojiCelebrating).toBe('false');
		view.round.value = { ...view.round.value, total: 5 };
		await flush();
		expect(view.required('.topPillFrame').dataset.emojiCelebrating).toBe('true');
	});

	it('keeps the result outline mounted while leaving shrinks to ordinary navigation width', async () => {
		const view = fixture();
		view.phase.value = 'result';
		view.round.value = { ...view.round.value, total: 5, phase: 'result' };
		await flush();
		expect(view.required('.topPillFrame').dataset.emojiCelebrating).toBe('true');
		expect(view.state.emojiVoteNavbarStackStyle.value).toEqual({ width: 'min(440px, 100%)' });
		const outline = view.required('[data-emoji-vote-outline]');
		view.phase.value = 'leaving';
		await flush();
		expect(view.required('.topPillFrame').dataset.emojiCelebrating).toBe('true');
		expect(view.required('.topPillFrame').dataset.emojiLeaving).toBe('true');
		expect(view.required('[data-emoji-vote-outline]')).toBe(outline);
		expect(view.state.emojiVoteNavbarStackStyle.value).toEqual({ width: 'min(240px, 100%)' });
		expect(view.mountPoint.querySelectorAll('[data-vote-card]')).toHaveLength(1);
		view.phase.value = 'idle';
		await flush();
		expect(view.mountPoint.querySelectorAll('[data-vote-card]')).toHaveLength(0);
		expect(view.required('.topBar').dataset.emojiVote).toBe('false');
		expect(view.state.emojiVoteNavbarStackStyle.value).toEqual({});
		expect(view.mountPoint.querySelector('[data-emoji-vote-outline]')).toBeNull();
		expect(view.required('.emojiVoteNavbarViewport').dataset.active).toBe('false');
		expect(view.required('.topBar').dataset.hidden).toBe('true');
		view.showTopBar.value = true;
		await flush();
		expect(view.required('.topBar').dataset.hidden).toBe('false');
		expect(view.required('.topPillNav').style.display).not.toBe('none');
	});

	it('clears a visible navbar vote when its anchor becomes hidden or the timeline unmounts', async () => {
		const view = fixture();
		await flush();
		expect(view.required('.topBar').dataset.emojiVote).toBe('true');
		view.notes.value = [{ ...view.notes.value[0], isHidden: true }];
		await flush();
		expect(view.mountPoint.querySelectorAll('[data-vote-card]')).toHaveLength(0);
		expect(view.required('.topBar').dataset.emojiVote).toBe('false');
		view.notes.value = [{ ...view.notes.value[0], isHidden: false }];
		await flush();
		expect(view.required('.topBar').dataset.emojiVote).toBe('true');
		view.tab.value = 'following';
		await flush();
		expect(view.state.emojiVoteNavbarState.value).toEqual({ visible: false, celebrating: false, leaving: false });
		expect(view.mountPoint.querySelectorAll('[data-vote-card]')).toHaveLength(0);
	});

	it.each(['notification', 'new-notes'] as const)('preserves the ordinary notice width when closing a vote beside %s', async notice => {
		const view = fixture();
		await flush();
		if (notice === 'notification') {
			view.notificationToasts.items.value = [{ id: 'notification' }];
			view.notificationToasts.integrated.value = true;
		} else {
			view.navbarNewNotes.value = { text: '新しいノート' };
		}
		view.phase.value = 'leaving';
		await flush();
		expect(view.state.emojiVoteNavbarStackStyle.value).toEqual({ width: 'min(360px, 100%)' });
		view.phase.value = 'idle';
		await flush();
		expect(view.state.emojiVoteNavbarStackStyle.value).toEqual({});
		expect(view.required('.topPill').dataset[notice === 'notification' ? 'notification' : 'newNotes']).toBe('true');
		if (notice === 'notification') expect(view.notificationToasts.items.value).toHaveLength(1);
		else expect(view.required('.topBar').dataset.hidden).toBe('false');
	});

	it('includes clipped tab content when measuring the ordinary navbar width', async () => {
		dimensions.nav = 440;
		dimensions.tabs = 640;
		dimensions.tabsViewport = 400;
		const view = fixture();
		await flush();
		view.phase.value = 'leaving';
		await flush();
		expect(view.state.emojiVoteNavbarStackStyle.value).toEqual({ width: 'min(680px, 100%)' });
		dimensions.tabs = 520;
		for (const observer of resizeObservers) observer.callback([], {} as ResizeObserver);
		await flush();
		expect(view.state.emojiVoteNavbarStackStyle.value).toEqual({ width: 'min(560px, 100%)' });
	});

	it('keeps declined feedback visible and then shrinks without lighting a result outline', async () => {
		const view = fixture();
		await flush();
		view.declined.value = true;
		view.phase.value = 'declined';
		await flush();
		expect(view.required('.topBar').dataset.emojiVote).toBe('true');
		expect(view.required('.topPillFrame').dataset.emojiCelebrating).toBe('false');
		expect(view.required('[data-vote-card]').dataset.phase).toBe('declined');
		view.round.value = { ...view.round.value, phase: 'result', total: 5 };
		view.phase.value = 'leaving';
		await flush();
		expect(view.required('.topPillFrame').dataset.emojiCelebrating).toBe('false');
		expect(view.required('.topPillFrame').dataset.emojiLeaving).toBe('true');
		expect(view.state.emojiVoteNavbarStackStyle.value).toEqual({ width: 'min(240px, 100%)' });
		view.phase.value = 'idle';
		await flush();
		expect(view.required('.topBar').dataset.emojiVote).toBe('false');
	});

	it('uses the notification outer paths with seven gradient stops and tracks its resizing frame', async () => {
		const view = fixture();
		await flush();
		view.required('.topPillFrame').style.borderTopLeftRadius = '24px';
		for (const observer of resizeObservers) observer.callback([], {} as ResizeObserver);
		await flush();
		const outline = view.required('[data-emoji-vote-outline]');
		expect(outline.dataset.integrated).toBe('true');
		expect([...outline.querySelectorAll('path')].map(path => path.getAttribute('d'))).toEqual(notificationOutlinePaths(440, 360, 24, true));
		expect(new Set([...outline.querySelectorAll('stop')].map(stop => stop.getAttribute('stop-color'))).size).toBe(7);
		expect(outline.getAttribute('stroke')).toBe(`url(#${outline.querySelector('linearGradient')?.id})`);
		dimensions.frameWidth = 240;
		dimensions.frameHeight = 48;
		for (const observer of resizeObservers) observer.callback([], {} as ResizeObserver);
		await flush();
		expect(outline.getAttribute('viewBox')).toBe('0 0 240 48');
		expect([...outline.querySelectorAll('path')].map(path => path.getAttribute('d'))).toEqual(notificationOutlinePaths(240, 48, 24, true));
		for (const observer of resizeObservers) observer.disconnect.mockClear();
		view.tab.value = 'following';
		await flush();
		expect(view.mountPoint.querySelector('[data-emoji-vote-outline]')).toBeNull();
		for (const observer of resizeObservers) expect(observer.disconnect).toHaveBeenCalledOnce();
	});

	it('compiles the notification blur and exit transitions without the former masked hard borders', () => {
		const compiled = compileStyle({ source: simple.style.content, filename: 'simple.vue', id: 'navbar-style', preprocessLang: 'scss' });
		expect(compiled.errors).toEqual([]);
		const rules = [...compiled.code.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.replace(/["']/g, '').replace(/\s+/g, ' ').trim(), body }));
		const integrated = rules.find(rule => rule.selector === '.topPillFrame > svg[data-integrated=true]');
		expect(integrated?.body).toMatch(/stroke-width:\s*40;/);
		expect(integrated?.body).toMatch(/filter:\s*blur\(14px\);/);
		expect(integrated?.body).toMatch(/opacity:\s*0?\.55;/);
		const fading = rules.find(rule => rule.selector === '.topPillFrame > svg[data-emoji-vote-outline=true]');
		expect(fading?.body).toMatch(/opacity:\s*0;/);
		expect(fading?.body).toMatch(/transition:\s*opacity 0?\.48s/);
		const expanding = rules.filter(rule => rule.selector.split(',').some(selector => selector.trim() === '.topBar[data-emoji-vote=true] .topNavStack'));
		expect(expanding.some(rule => /transition:\s*width 0?\.48s/.test(rule.body))).toBe(true);
		expect(expanding.some(rule => /transition:\s*none !important/.test(rule.body))).toBe(true);
		expect(rules.some(rule => rule.selector.includes('.topBar[data-toast-motion=false] .topNavStack') && /transition:\s*none/.test(rule.body))).toBe(true);
		expect(compiled.code).not.toContain('.topPillFrame::before');
		expect(compiled.code).not.toContain('.topPillFrame::after');
	});
});
