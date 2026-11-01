/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import * as Vue from 'vue';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { refreshNotificationUnreadState } from '@/utility/notification-unread-sync.js';
import { acceptNotificationUnreadState, forgetNotificationUnreadState } from '@/utility/notification-unread-state.js';
import { normalizeUiSBottomNav, resolveUiSBottomNav } from '@/utility/hatasaba-navigation.js';

const fixture = vi.hoisted(() => ({
	account: { id: 'owner', hasUnreadNotification: true, unreadNotificationsCount: 3 },
	api: vi.fn(),
}));
vi.mock('@/i.js', () => ({ get $i() { return fixture.account; } }));
vi.mock('@/accounts.js', () => ({ updateCurrentAccount: (partial: object) => Object.assign(fixture.account, partial) }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (...args: unknown[]) => fixture.api(...args) }));

function source(path: string) {
	const filename = resolve(process.cwd(), 'src', path);
	const descriptor = parse(readFileSync(filename, 'utf8'), { filename }).descriptor;
	if (!descriptor.scriptSetup || !descriptor.template?.ast) throw new Error(`Missing SFC blocks: ${path}`);
	return { templateAst: descriptor.template.ast, script: ts.createSourceFile(`${path}.ts`, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS) };
}

const simple = source('ui/simple.vue');
const modern = source('components/hataskey3/Hk3App.vue');
const dock = source('components/hataskey3/Hk3MobileDock.vue');
type TemplateNode = typeof simple.templateAst.children[number];
type ElementNode = Extract<TemplateNode, { type: 1 }>;

function button(nodes: TemplateNode[], predicate: (node: ElementNode) => boolean): ElementNode {
	const found: ElementNode[] = [];

	function visit(node: TemplateNode) {
		if (node.type !== 1) return;
		if (node.tag === 'button' && predicate(node)) found.push(node);
		node.children.forEach(visit);
	}

	nodes.forEach(visit);
	if (found.length !== 1) throw new Error('Expected one production notification button');
	return found[0];
}

function compileButton(content: string, loop: string) {
	const compiled = compileTemplate({ source: `<template v-for="item in ${loop}"><button v-if="false"></button>${content}</template>`, filename: 'notification-badge-test.vue', id: 'notification-badge-test', compilerOptions: { mode: 'function', prefixIdentifiers: true, cacheHandlers: false } });
	if (compiled.errors.length > 0) throw new Error(String(compiled.errors[0]));
	return new Function('Vue', compiled.code)(Vue) as Vue.RenderFunction;
}

const simpleButton = button(simple.templateAst.children, node => node.props.some(prop => prop.type === 7 && prop.name === 'else-if' && prop.exp?.type === 4 && prop.exp.content === 'item.id===\'notifications\''));
const dockButton = button(dock.templateAst.children, node => node.props.some(prop => prop.type === 7 && prop.name === 'else') && node.loc.source.includes('item.badge'));
const simpleRender = compileButton(simpleButton.loc.source, '[{ id: \'notifications\' }]');
const modernRender = compileButton(dockButton.loc.source, 'mobileNav.filter(item => item.path === \'/my/notifications\')');

function codeFor(file: ts.SourceFile, names: string[], includeWatch = false) {
	const statements = file.statements.filter(statement => ts.isVariableStatement(statement)
		? statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && names.includes(declaration.name.text))
		: includeWatch && ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)
			&& statement.expression.expression.getText(file) === 'watch' && statement.getText(file).includes('syncUnreadFromI'));
	return ts.transpileModule(`${statements.map(statement => statement.getText(file)).join('\n')}\nreturn { ${names.join(', ')} };`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
}

const simpleCode = codeFor(simple.script, ['hasUnreadNotif', 'unreadNotifCount', 'showUnreadNotifCount', 'mainCh', 'broadcastStream', 'unreadPollTimer', 'streamUnmounted', 'syncUnreadFromI', 'checkUnread', 'initStream', 'startUnreadPoll', 'stopUnreadPoll'], true);
const modernCode = codeFor(modern.script, ['mobileNav']);
const cleanups: (() => void)[] = [];

beforeEach(() => {
	vi.useFakeTimers();
	fixture.account = Vue.reactive({ id: 'owner', hasUnreadNotification: true, unreadNotificationsCount: 3 });
	fixture.api.mockReset().mockResolvedValue({ unreadNotificationsCount: 0, revision: '2' });
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	forgetNotificationUnreadState('owner');
	vi.useRealTimers();
});

function mountSimple(showCount = true) {
	const listeners = new Map<string, (state: { unreadNotificationsCount: number; revision: string }) => void>();
	const globals = {
		ref: Vue.ref, computed: Vue.computed, watch: Vue.watch, $i: fixture.account,
		prefer: { s: { showUnreadNotificationsCount: showCount } },
		acceptNotificationUnreadState, refreshNotificationUnreadState,
		updateCurrentAccount: (partial: object) => Object.assign(fixture.account, partial),
		useStream: () => ({ useChannel: () => ({ on: (event: string, fn: (state: { unreadNotificationsCount: number; revision: string }) => void) => listeners.set(event, fn) }), on: vi.fn() }),
		onHataTimelineCollapse: vi.fn(), scheduleStreamRetry: vi.fn(),
	};
	type SimpleState = { checkUnread: () => Promise<void>; initStream: () => void; startUnreadPoll: () => void; stopUnreadPoll: () => void };
	const mounted = { state: null as SimpleState | null };
	const app = Vue.createApp({ render: simpleRender, setup() {
		const state: SimpleState = new Function('window', ...Object.keys(globals), simpleCode)(globalThis.window, ...Object.values(globals));
		mounted.state = state;
		state.initStream();
		return { ...state, navbarSearchOpen: false, isNotifPage: false, playSimpleNavMotion: vi.fn(), goToNotifications: vi.fn() };
	} });
	const target = window.document.createElement('div'); window.document.body.append(target);
	app.config.globalProperties.$style = new Proxy({}, { get: (_target, key) => key });
	app.mount(target);
	const mountedState = mounted.state;
	if (mountedState == null) throw new Error('Simple navbar setup did not run');
	cleanups.push(() => { mountedState.stopUnreadPoll(); app.unmount(); target.remove(); });
	return { target, state: mountedState, emit: (event: string, count: number, revision: string) => {
		const listener = listeners.get(event);
		if (!listener) throw new Error(`Missing production event subscription: ${event}`);
		listener({ unreadNotificationsCount: count, revision });
	} };
}

function mountModern() {
	const Icon = Vue.markRaw({ render: () => Vue.h('svg') });
	const globals = {
		computed: Vue.computed, $i: fixture.account, normalizeUiSBottomNav, resolveUiSBottomNav,
		copy: { tabHome: 'Home', paneWidgets: 'Widgets' }, i18n: { ts: { search: 'Search', notifications: 'Notifications' } },
		House: Icon, Search: Icon, Bell: Icon, Sparkles: Icon, LayoutGrid: Icon, MessageSquareWarning: Icon,
		prefer: { r: { hataskeyUi3BottomNav: Vue.ref([{ id: 'notifications' }]), 'simpleUi.bottomNav': Vue.ref([{ id: 'notifications' }]) } },
		sharedBottomNavDefaults: [{ id: 'notifications' }], mobilePane: Vue.ref(null), isHome: Vue.ref(true), path: Vue.ref('/'),
	};
	const app = Vue.createApp({ render: modernRender, setup: () => ({ ...new Function(...Object.keys(globals), modernCode)(...Object.values(globals)), expanded: false, emit: vi.fn() }) });
	const target = window.document.createElement('div'); window.document.body.append(target);
	app.config.globalProperties.$style = new Proxy({}, { get: (_target, key) => key });
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return target;
}

test('the lower badge does not return at the next poll after a read event without the boot subscriber', async () => {
	const view = mountSimple();
	expect(view.target.querySelector('.badgeCount')?.textContent).toBe('3');
	view.state.startUnreadPoll();
	view.emit('readAllNotifications', 0, '2');
	await Vue.nextTick();
	expect(view.target.querySelector('.badgeCount')).toBeNull();
	fixture.api.mockRejectedValue(new Error('offline'));
	await vi.advanceTimersByTimeAsync(60000);
	expect(view.target.querySelector('.badgeCount')).toBeNull();
	expect(view.target.querySelector('.badge')).toBeNull();
	expect(fixture.account.unreadNotificationsCount).toBe(0);
});

test.each([true, false])('a server refresh clears a stale lower badge with count display %s', async showCount => {
	const view = mountSimple(showCount);
	expect(view.target.querySelector(showCount ? '.badgeCount' : '.badge')).not.toBeNull();
	await view.state.checkUnread();
	await Vue.nextTick();
	expect(fixture.api).toHaveBeenCalledWith('notifications/unread-count', {});
	expect(view.target.querySelector('.badgeCount, .badge')).toBeNull();
});

test('both lower navbars follow the authoritative remaining count and then clear together', async () => {
	const old = mountSimple();
	const modernView = mountModern();
	expect(modernView.querySelector('.badge')?.getAttribute('aria-label')).toBe('3');
	fixture.api.mockResolvedValueOnce({ unreadNotificationsCount: 2, revision: '2' });
	await refreshNotificationUnreadState('owner');
	await Vue.nextTick();
	expect(old.target.querySelector('.badgeCount')?.textContent).toBe('2');
	expect(modernView.querySelector('.badge')?.getAttribute('aria-label')).toBe('2');
	fixture.api.mockResolvedValueOnce({ unreadNotificationsCount: 0, revision: '3' });
	await refreshNotificationUnreadState('owner');
	await Vue.nextTick();
	expect(old.target.querySelector('.badgeCount, .badge')).toBeNull();
	expect(modernView.querySelector('.badge')).toBeNull();
});
