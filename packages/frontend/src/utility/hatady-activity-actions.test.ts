/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, provide, ref } from 'vue';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { HatadyActivity, HatadyMediaSession } from './hatady-media.js';
import { HATA_GOES_HOST } from './hatagoes-context.js';

const fixture = vi.hoisted(() => ({ menu: vi.fn(), clipboard: vi.fn(), push: vi.fn(), popup: vi.fn(() => ({ dispose: vi.fn() })) }));
vi.mock('@@/js/config.js', () => ({ url: 'https://example.test' }));
vi.mock('@/i.js', () => ({ $i: { id: 'me' } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	copyLink: 'リンクをコピー', reactionsList: 'リアクション一覧',
	_hata: { _hatady: { _home: { openInHatady: 'Hatadyで開く', edit: '編集', delete: '削除', report: '通報', hatadyProfile: 'プロフィール' } } },
} } }));
vi.mock('@/router.js', () => ({ mainRouter: { pushByPath: fixture.push }, useRouter: () => ({ pushByPath: fixture.push }) }));
vi.mock('@/utility/hatady-home.js', () => ({ activityData: () => ({ title: '', body: '' }) }));
vi.mock('@/utility/hatady-prefs.js', () => ({ loadHatadyDisplay: vi.fn() }));
vi.mock('@/utility/hatady-record-delete.js', () => ({ confirmHatadyRecordDeletion: vi.fn() }));
vi.mock('@/utility/hatagoes-popup.js', () => ({ useHataGoesPopup: () => fixture.popup, useHataGoesPopupMenu: () => fixture.menu }));
vi.mock('@/components/HatadyBookDetail.vue', () => ({ default: {} }));
vi.mock('@/components/HatadyConversation.vue', () => ({ default: {} }));
vi.mock('@/components/HatadyMediaWorkDetail.vue', () => ({ default: {} }));
vi.mock('@/components/HatadyProfile.vue', () => ({ default: {} }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: fixture.clipboard }));
import { useHatadyActivityActions } from './hatady-activity-actions.js';

const cleanup: Array<() => void> = [];
type Menu = Array<{ text: string; action: () => void; danger?: boolean }>;
const record = (mine: boolean, media = false): HatadyActivity => ({
	id: 'activity', type: 'study', occurredAt: '2026-01-01T00:00:00Z', visibility: 'public', isMine: mine,
	user: { id: mine ? 'me' : 'other', username: 'other' } as HatadyActivity['user'],
	...(media ? { media: { work: null, session: { id: 'session-1', workId: 'work-1' } as HatadyMediaSession } } : { study: { id: 'log-1' } }),
});

function menu(host: boolean, activity: HatadyActivity): Menu {
	const element = window.document.createElement('div');
	const app = createApp(defineComponent({ setup() {
		if (host) provide(HATA_GOES_HOST, { active: ref(true), register: vi.fn(), changed: vi.fn() });
		return () => h(defineComponent({ setup() {
			const actions = useHatadyActivityActions({});
			return () => h('button', { onClick: (event: MouseEvent) => actions.openActivityMenu(activity, event) }, 'menu');
		} }));
	} }));
	app.mount(element);
	cleanup.push(() => app.unmount());
	element.querySelector('button')?.click();
	return fixture.menu.mock.lastCall?.[0] as Menu;
}

beforeEach(() => { fixture.menu.mockReset(); fixture.clipboard.mockReset(); fixture.push.mockReset(); fixture.popup.mockClear(); });
afterEach(() => cleanup.splice(0).forEach(fn => fn()));

test('HataGoes owner menu orders edit, copy, breakdown and guarded delete', () => {
	const items = menu(true, record(true));
	expect(items.map(item => item.text)).toEqual(['編集', 'リンクをコピー', 'リアクション一覧', '削除']);
	expect(items.at(-1)?.danger).toBe(true);
	items.find(item => item.text === 'リンクをコピー')?.action();
	expect(fixture.clipboard).toHaveBeenCalledWith('https://example.test/hatagoes?view=%2Fhatady%3Ftab%3Drecords%26hgKind%3Dlog%26hgId%3Dlog-1', 'link');
});

test('HataGoes other-user menu offers report and a session-specific link', () => {
	const items = menu(true, record(false, true));
	expect(items.map(item => item.text)).toEqual(['リンクをコピー', 'リアクション一覧', 'プロフィール', '通報']);
	items[0].action();
	expect(fixture.clipboard).toHaveBeenCalledWith('https://example.test/hatagoes?view=%2Fhatady%3Ftab%3Drecords%26hgKind%3DmediaSession%26hgId%3Dsession-1', 'link');
	expect(items.some(item => item.text === '編集' || item.text === '削除')).toBe(false);
});

test('legacy menu does not gain HataGoes actions', () => {
	expect(menu(false, record(true)).map(item => item.text)).toEqual(['編集', '削除']);
	expect(menu(false, record(false)).map(item => item.text)).toEqual(['プロフィール', '通報']);
});

function actions() {
	let result!: ReturnType<typeof useHatadyActivityActions>;
	const app = createApp(defineComponent({ setup() { result = useHatadyActivityActions({}); return () => null; } }));
	app.mount(window.document.createElement('div'));
	cleanup.push(() => app.unmount());
	return result;
}

test.each(['book', 'work', 'log', 'session', 'profile'])('notifies the owner when its %s detail closes', async kind => {
	const current = actions();
	const closed = vi.fn();
	if (kind === 'book') await current.openBookDetail('book', closed);
	else if (kind === 'work') await current.openMediaDetailById('work', undefined, closed);
	else if (kind === 'log') await current.openConversation('log', closed);
	else if (kind === 'session') await current.openSession('session', undefined, closed);
	else await current.openProfile('other', closed);
	const events = (fixture.popup.mock.calls[0] as unknown as [unknown, unknown, { closed: () => void }])[2];
	expect(closed).not.toHaveBeenCalled();
	events.closed();
	expect(closed).toHaveBeenCalledOnce();
});

test('closing a nested log keeps the parent book result open', async () => {
	const current = actions();
	const closed = vi.fn();
	await current.openBookDetail('book', closed);
	const book = (fixture.popup.mock.calls[0] as unknown as [unknown, unknown, { closed: () => void; openLog: (id: string) => Promise<void> }])[2];
	await book.openLog('log');
	const log = (fixture.popup.mock.calls[1] as unknown as [unknown, unknown, { closed: () => void }])[2];
	log.closed();
	expect(closed).not.toHaveBeenCalled();
	book.closed();
	expect(closed).toHaveBeenCalledOnce();
});

test.each(['book', 'books', 'work', 'mediaWork', 'mediaWorks', 'log', 'session', 'mediaSession', 'user', 'users'])('the Hatady page bridge forwards the %s close callback to the real popup', async kind => {
	const source = readFileSync(resolve(process.cwd(), 'src/pages/hatady.vue'), 'utf8').match(/<script[^>]*>([\s\S]*?)<\/script>/)![1];
	const ast = ts.createSourceFile('hatady.ts', source, ts.ScriptTarget.Latest, true);
	let method: ts.MethodDeclaration | undefined;
	const visit = (node: ts.Node) => {
		if (ts.isMethodDeclaration(node) && node.name.getText(ast) === 'openResult') method = node;
		ts.forEachChild(node, visit);
	};
	visit(ast);
	if (!method) throw new Error('Missing Hatady bridge');
	const production = method.getText(ast).replace('async openResult', 'async function openResult');
	const context = { activityActions: actions(), props: { paneActive: true }, output: undefined as unknown };
	runInNewContext(ts.transpileModule(`${production}; output = openResult;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
	const closed = vi.fn();
	await (context.output as (kind: string, id: string, closed: () => void) => Promise<void>)(kind, 'record', closed);
	const events = (fixture.popup.mock.lastCall as unknown as [unknown, unknown, { closed: () => void }])[2];
	events.closed();
	expect(closed).toHaveBeenCalledOnce();
});
