/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, reactive, ref } from 'vue';

const fixture = vi.hoisted(() => ({ api: vi.fn(), changed: vi.fn(), openRecord: vi.fn(), capturePageTurn: vi.fn(() => ({ play: vi.fn(), cancel: vi.fn() })) }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/router.js', async () => {
	const { ref } = await import('vue');
	return { useRouter: () => ({ push: vi.fn(), currentRef: ref({ _parsedRoute: { queryString: '' } }) }) };
});
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: { id: 'viewer', username: 'viewer', name: '本人 :self_badge:', host: null, emojis: {} } }));
vi.mock('@/os.js', () => ({ popup: vi.fn(), popupMenu: vi.fn() }));
vi.mock('@/preferences.js', async () => ({ prefer: { s: { nicknameEnabled: false, advancedMfm: false }, r: { enablePullToRefresh: (await import('vue')).ref(true) } } }));
vi.mock('@/store.js', async () => ({ store: { r: { darkMode: (await import('vue')).ref(false) } } }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	return { i18n: createTestHataskI18n() };
});
vi.mock('@/utility/hatady.js', () => ({ hyBookmarkColor: () => '' }));
vi.mock('@/utility/hatady-subjects.js', () => ({ loadHySubjects: vi.fn().mockResolvedValue([]) }));
vi.mock('@/utility/hatady-prefs.js', async () => ({ hatadyTheme: (await import('vue')).ref('light'), hatadyTzOffset: () => 0, loadHatadyDisplay: vi.fn() }));
vi.mock('@/utility/hatady-tutorial-launcher.js', () => ({ showHatadyTutorial: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utility/hatady-record-launcher.js', () => ({ openHatadyRecord: fixture.openRecord }));
vi.mock('@/utility/hatady-motion.js', () => ({ captureHatadyPageTurn: fixture.capturePageTurn }));
vi.mock('@/utility/hatady-list-motion.js', () => ({ createHatadyListEntrance: () => ({ play: vi.fn(), finish: vi.fn(), cancel: vi.fn() }) }));
vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
vi.mock('@/utility/touch.js', async () => ({ isHorizontalSwipeSwiping: (await import('vue')).ref(false) }));
vi.mock('@/utility/hatady-ui.js', async () => ({
	HATADY_ACTIVITY_CHOICES: ['study', 'movie', 'game', 'exercise', 'work'].map(value => ({ value, label: value, icon: 'ti ti-book' })),
	HATADY_RECORD_TAGS: [], hatadyDialogSurfaces: (await import('vue')).ref([]), hatadyDuration: () => '', hatadySeconds: () => null, hatadyNotify: vi.fn(),
}));
vi.mock('@/components/HyNav.vue', () => ({ default: {
	props: ['options', 'modelValue'], emits: ['update:modelValue'],
	template: '<nav><button v-for="option in options" :data-tab="option.value" @click="$emit(\'update:modelValue\', option.value)">{{ option.label }}</button></nav>',
} }));
vi.mock('@/components/HyCapsule.vue', () => ({ default: {
	props: ['options', 'modelValue', 'label'], emits: ['update:modelValue'],
	template: '<div :aria-label="label"><button v-for="option in options" :data-value="option.value" @click="$emit(\'update:modelValue\', option.value)">{{ option.label }}</button></div>',
} }));
vi.mock('@/components/hatady/HyCategorySelect.vue', () => ({ default: {
	props: ['options', 'modelValue', 'label', 'card'], emits: ['update:modelValue'],
	template: '<div :aria-label="label"><button v-if="card" data-card-trigger :aria-label="label + \': \' + modelValue"><span>{{ label }}</span><small>{{ options.find(option => option.value === modelValue)?.label ?? label }}</small></button><button v-for="option in options" :data-value="option.value" @click="$emit(\'update:modelValue\', option.value)">{{ option.label }}</button></div>',
} }));
vi.mock('@/components/HyBookCover.vue', () => ({ default: { template: '<span/>' } }));
vi.mock('@/components/HyMediaCover.vue', () => ({ default: { template: '<span/>' } }));
vi.mock('@/components/HatadyHome.vue', () => ({ default: {
	props: ['headerDateTarget', 'headerActionsTarget', 'active'],
	template: '<section data-home :data-date-ready="!!headerDateTarget?.isConnected" :data-actions-ready="!!headerActionsTarget?.isConnected" :data-actions-location="headerActionsTarget?.dataset.anchor" :data-active="active">ホーム</section>',
} }));
vi.mock('@/components/HatadyProfile.vue', () => ({ default: {
	props: ['headerActionsTarget', 'active'],
	template: '<section data-profile :data-actions-ready="!!headerActionsTarget?.isConnected" :data-active="active"/>',
} }));
vi.mock('@/components/HatadyModeration.vue', () => ({ default: { template: '<section/>' } }));
vi.mock('@/components/HatadyActivityCard.vue', () => ({ default: { props: ['activity'], emits: ['deleted'], template: '<article>{{ activity.id }}<button data-delete-record @click="$emit(\'deleted\')">削除</button></article>' } }));
// Exercise the real username and MFM parser without fetching emoji images.
vi.mock('@/components/global/MkCustomEmoji.vue', () => ({ default: {
	props: ['name', 'url', 'host', 'normal'], template: '<img data-custom-emoji :alt="name" :src="url" :data-host="host" :data-normal="normal"/>',
} }));
vi.mock('@/components/global/MkA.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/global/MkUrl.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/global/MkTime.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/global/MkEmoji.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkLink.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkMention.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkCode.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkCodeInline.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkGoogle.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkSparkle.vue', () => ({ default: { render: () => null } }));
import Hatady from './hatady.vue';
import MkUserName from '@/components/global/MkUserName.vue';
import Mfm from '@/components/global/MkMfm.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { hatadyMediaCopy } from '@/utility/hatady-media.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const cleanups: Array<() => void> = [];
const row = (id: string) => ({ id, type: 'study', occurredAt: '2026-09-18T00:00:00Z', study: { id, title: id, kind: 'study' } });
const page = (id: string, nextCursor: string | null = null) => ({ items: [row(id)], hasMore: !!nextCursor, nextCursor });
const calls = () => fixture.api.mock.calls.filter(([endpoint]) => endpoint === 'hata/hatady/activities');

async function settle() { for (let i = 0; i < 6; i++) { await nextTick(); await Promise.resolve(); } }

function touch(target: EventTarget, type: string, x: number, y: number) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : [{ identifier: 1, screenX: x, screenY: y }] });
	target.dispatchEvent(event);
}

async function pull(target: HTMLElement, dx = 0, dy = 200) {
	touch(target, 'touchstart', 20, 20);
	touch(window, 'touchmove', 20 + dx, 20 + dy);
	touch(window, 'touchend', 20 + dx, 20 + dy);
	await settle();
	await vi.advanceTimersByTimeAsync(230);
	await settle();
}

async function chooseRecordKind(target: HTMLElement, value: string) {
	const mocked = target.querySelector<HTMLButtonElement>(`[aria-label="活動の種類"] [data-value="${value}"]`);
	if (mocked) { mocked.click(); return; }
	const trigger = target.querySelector<HTMLButtonElement>('button[aria-label^="活動の種類:"]');
	expect(trigger).not.toBeNull();
	trigger!.click();
	await settle();
	const options = window.document.querySelector<HTMLElement>('[role="listbox"][aria-label="活動の種類"]');
	const choice = [...(options?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])].find(button => button.textContent?.trim() === value);
	expect(choice).toBeDefined();
	choice!.click();
}

async function mount(embedded = false, withHeader = false) {
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const header = window.document.createElement('nav');
	const headerDate = window.document.createElement('div');
	const headerActions = window.document.createElement('div');
	header.append(headerDate, headerActions);
	if (withHeader) window.document.body.append(header);
	const headerTargets = { date: ref<HTMLElement | null>(headerDate), actions: ref<HTMLElement | null>(headerActions), overview: ref<HTMLElement | null>(null) };
	const hostActive = ref(true);
	const pageProps = reactive({ embedded, paneActive: true, requestedTab: 'records' });
	const app = createApp(defineComponent({ setup: () => () => h(Hatady, pageProps) }));
	if (embedded) app.provide(HATA_GOES_HOST, { active: hostActive, hatadyHeader: withHeader ? headerTargets : undefined, register: () => () => {}, changed: fixture.changed });
	app.component('MkStickyContainer', { setup: (_, { slots }) => () => h('div', slots.default?.()) });
	app.component('MkLoading', { template: '<span role="status">更新中</span>' });
	app.component('MkUserName', MkUserName);
	// eslint-disable-next-line vue/multi-word-component-names -- Register the existing production global name.
	app.component('Mfm', Mfm);
	// Happy DOM does not lay out imported CSS. Supply only the existing .main overflow rule;
	// the production getScrollContainer still walks the real mounted ancestor chain.
	const originalStyle = window.getComputedStyle.bind(window);
	vi.spyOn(window, 'getComputedStyle').mockImplementation(element => {
		if (element.tagName === 'MAIN') (element as HTMLElement).style.overflowY = 'auto';
		return originalStyle(element);
	});
	app.mount(target);
	let mounted = true;
	const unmount = () => {
		if (!mounted) return;
		mounted = false;
		app.unmount(); target.remove(); header.remove();
	};
	cleanups.push(unmount);
	await settle();
	return { target, main: target.querySelector('main')!, list: target.querySelector<HTMLElement>('main > div')!, pageProps, header, headerTargets, hostActive, unmount };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	window.localStorage.setItem('hatadyActiveTab', 'records');
	window.localStorage.removeItem('hatadyLogKinds');
	window.localStorage.removeItem('hatadyCollectionKind');
	prefer.r.enablePullToRefresh.value = true;
	fixture.api.mockReset().mockImplementation(async endpoint => endpoint === 'hata/hatady/activities' ? page('kept', 'old-cursor') : { count: 0 });
	fixture.changed.mockReset();
	fixture.openRecord.mockReset();
	fixture.capturePageTurn.mockClear();
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	window.localStorage.removeItem('hatadyActiveTab');
	window.localStorage.removeItem('hatadyLogKinds');
	window.localStorage.removeItem('hatadyCollectionKind');
});

test('Hatagoes omits duplicate Hatady headings while keeping the record action available', async () => {
	const { main, header, pageProps } = await mount(true, true);
	expect(header.querySelector('h1')).toBeNull();
	expect(main.querySelector('h1')).toBeNull();
	const recordButton = header.querySelector<HTMLButtonElement>(`button[aria-label="${i18n.ts._hata._hatady._home.recordActivity}"]`);
	expect(recordButton).not.toBeNull();
	recordButton?.click();
	await settle();
	expect(fixture.openRecord).toHaveBeenCalledOnce();
	expect(fixture.openRecord).toHaveBeenCalledWith({ onDone: expect.any(Function), popup: expect.any(Function) });
	pageProps.requestedTab = 'collection';
	await settle();
	expect(header.querySelector('h1')).toBeNull();
	expect(main.querySelector('h1')).toBeNull();
});

test('Hatady record action follows pane and shell lifetime and restores the inline fallback', async () => {
	const { main, header, headerTargets, hostActive, pageProps, unmount } = await mount(true, true);
	const actionsTarget = headerTargets.actions.value;
	pageProps.paneActive = false;
	await settle();
	expect(header.querySelector('h1, button')).toBeNull();
	pageProps.paneActive = true;
	await settle();
	expect(header.querySelector('h1')).toBeNull();
	expect(header.querySelectorAll('button')).toHaveLength(1);
	hostActive.value = false;
	await settle();
	expect(header.querySelector('h1, button')).toBeNull();
	hostActive.value = true;
	headerTargets.actions.value = null;
	await settle();
	expect(main.querySelector('h1')?.textContent).toBe('日々の記録');
	expect(header.querySelector('h1, button')).toBeNull();
	headerTargets.actions.value = actionsTarget;
	await settle();
	expect(main.querySelector('h1')).toBeNull();
	expect(header.querySelectorAll('button')).toHaveLength(1);
	unmount();
	expect(header.querySelector('h1, button')).toBeNull();
});

test('standalone Hatady keeps its heading inside the page', async () => {
	const { main, header } = await mount(false, true);
	expect(main.querySelector('h1')?.textContent).toBe('日々の記録');
	expect(header.querySelector('h1, button')).toBeNull();
});

test('only embedded home and profile receive navigation targets and follow pane activity', async () => {
	const { target, main, pageProps, hostActive } = await mount(true, true);
	pageProps.requestedTab = 'home';
	await settle();
	expect(main.querySelector('[data-home]')?.getAttribute('data-date-ready')).toBe('true');
	expect(main.querySelector('[data-home]')?.getAttribute('data-actions-ready')).toBe('true');
	pageProps.paneActive = false;
	await settle();
	expect(main.querySelector('[data-home]')?.getAttribute('data-active')).toBe('false');
	pageProps.requestedTab = 'profile';
	await settle();
	expect(main.querySelector('[data-profile]')?.getAttribute('data-actions-ready')).toBe('true');
	expect(main.querySelector('[data-profile]')?.getAttribute('data-active')).toBe('false');
	pageProps.paneActive = true;
	await settle();
	expect(main.querySelector('[data-profile]')?.getAttribute('data-active')).toBe('true');
	hostActive.value = false;
	await settle();
	expect(main.querySelector('[data-profile]')?.getAttribute('data-active')).toBe('false');
	pageProps.embedded = false;
	await settle();
	expect(main.querySelector('[data-profile]')?.getAttribute('data-actions-ready')).toBe('false');
	target.querySelector<HTMLButtonElement>('button[data-tab="home"]')!.click();
	await settle();
	expect(main.querySelector('[data-home]')?.getAttribute('data-date-ready')).toBe('false');
	expect(main.querySelector('[data-home]')?.getAttribute('data-actions-ready')).toBe('false');
});

test('mobile home uses its overview target while the record and profile controls keep their own target', async () => {
	const { main, header, headerTargets, pageProps } = await mount(true, true);
	const overviewTarget = window.document.createElement('div');
	overviewTarget.dataset.anchor = 'before-notifications';
	header.append(overviewTarget);
	headerTargets.date.value = null;
	headerTargets.overview.value = overviewTarget;
	pageProps.requestedTab = 'home';
	await settle();
	expect(main.querySelector('[data-home]')?.getAttribute('data-date-ready')).toBe('false');
	expect(main.querySelector('[data-home]')?.getAttribute('data-actions-location')).toBe('before-notifications');
	expect(headerTargets.actions.value?.querySelector('button')).not.toBeNull();
	expect(overviewTarget.querySelector('button')).toBeNull();
	pageProps.requestedTab = 'profile';
	await settle();
	expect(main.querySelector('[data-profile]')?.getAttribute('data-actions-ready')).toBe('true');
	expect(headerTargets.actions.value?.querySelector('button')).not.toBeNull();
});

test('embedded record controls keep readable period and kind labels', async () => {
	const { target } = await mount(true);
	const period = target.querySelector<HTMLButtonElement>(`button[aria-label="${i18n.ts._hata._hatady._home.period}"]`)!;
	expect(period).not.toBeNull();
	expect(period.classList.contains('hy-icon-button')).toBe(false);
	expect(period.textContent).toContain('すべて');
	expect(target.querySelector('[data-card-trigger]')?.textContent).toContain('活動の種類');
});

test('Hatadyの埋込タブ変更は初回表示を動かさず、外側からの遷移で既存motionを起動する', async () => {
	const { target, pageProps } = await mount(true);
	expect(fixture.capturePageTurn).not.toHaveBeenCalled();
	pageProps.requestedTab = 'collection';
	await settle();
	expect(target.querySelector('main h1')?.textContent).toBe('コレクション');
	expect(fixture.capturePageTurn).toHaveBeenCalledTimes(1);
	expect(fixture.capturePageTurn).toHaveBeenCalledWith(expect.any(HTMLElement), 1);
});

test.each(['mine', 'recent', 'following'])('refreshes the selected %s scope with activity and date filters, replacing rather than appending', async scope => {
	const { target, main, list } = await mount();
	expect(main.style.touchAction).toContain('pan-x');
	target.querySelector<HTMLButtonElement>(`[aria-label="記録の範囲"] [data-value="${scope}"]`)!.click();
	await settle();
	await chooseRecordKind(target, 'game');
	await settle();
	target.querySelector<HTMLButtonElement>(`button[aria-label="${i18n.ts._hata._hatady._home.period}"]`)!.click();
	await settle();
	for (const [label, value] of [['開始日', '2026-09-01'], ['終了日', '2026-09-18']]) {
		const input = target.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
		input.value = value;
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}
	target.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
	await settle();
	const previous = calls().at(-1)![1], before = calls().length;
	fixture.api.mockResolvedValueOnce(page('fresh'));
	await pull(list);
	expect(calls()).toHaveLength(before + 1);
	expect(calls().at(-1)![1]).toEqual(previous);
	expect(previous).toMatchObject({ scope, kinds: ['game'], sinceDate: expect.any(Number), untilDate: expect.any(Number) });
	expect(previous).not.toHaveProperty('cursor');
	expect(target.textContent).toContain('fresh');
	expect(target.textContent).not.toContain('kept');
});

test('a failed pull retains entries and pagination, and a pending refresh cannot start another fetch', async () => {
	const { target, list } = await mount();
	let reject!: (reason: Error) => void;
	fixture.api.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
	await pull(list);
	expect(calls()).toHaveLength(2);
	await pull(list);
	expect(calls()).toHaveLength(2);
	expect(target.textContent).toContain('kept');
	reject(new Error('offline'));
	await settle();
	await vi.advanceTimersByTimeAsync(230);
	expect(target.textContent).toContain('記録を読み込めませんでした');
	expect(target.textContent).toContain('kept');
	const loadMore = [...target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === hatadyMediaCopy().loadMore);
	expect(loadMore).toBeDefined();
	loadMore!.click();
	await settle();
	expect(calls().at(-1)![1]).toMatchObject({ cursor: 'old-cursor' });
});

test('an embedded record deletion notifies the shared home once after success', async () => {
	const { target } = await mount(true);
	expect(target.querySelector('[data-delete-record]')).not.toBeNull();
	expect(fixture.changed).not.toHaveBeenCalled();
	target.querySelector<HTMLButtonElement>('[data-delete-record]')!.click();
	await settle();
	expect(fixture.changed).toHaveBeenCalledOnce();
});

test('does not fetch from a scrolled position, a horizontal gesture, or a cancelled touch', async () => {
	const { main, list } = await mount();
	main.scrollTop = 80;
	await pull(list);
	main.scrollTop = 0;
	await pull(list, 280, 210);
	touch(list, 'touchstart', 20, 20);
	touch(window, 'touchmove', 20, 240);
	touch(window, 'touchcancel', 20, 240);
	touch(window, 'touchend', 20, 240);
	await vi.advanceTimersByTimeAsync(450);
	expect(calls()).toHaveLength(1);
});

test('respects the existing preference and cancels a pull when leaving records', async () => {
	const { target, list } = await mount();
	touch(list, 'touchstart', 20, 20);
	touch(window, 'touchmove', 20, 240);
	target.querySelector<HTMLButtonElement>('[data-tab="home"]')!.click();
	await settle();
	touch(window, 'touchend', 20, 240);
	await vi.advanceTimersByTimeAsync(450);
	expect(calls()).toHaveLength(1);
	prefer.r.enablePullToRefresh.value = false;
	target.querySelector<HTMLButtonElement>('[data-tab="records"]')!.click();
	await settle();
	const before = calls().length;
	await pull(target.querySelector('main > section')!);
	expect(calls()).toHaveLength(before);
});

test('removes a successfully deleted record even when reloading the list fails', async () => {
	const { target } = await mount();
	expect(target.querySelector('article')?.textContent).toContain('kept');
	fixture.api.mockImplementation(async endpoint => {
		if (endpoint === 'hata/hatady/activities') throw new Error('offline');
		return { count: 0 };
	});
	target.querySelector<HTMLButtonElement>('[data-delete-record]')!.click();
	await settle();
	expect(target.querySelector('article')).toBeNull();
	expect(target.textContent).toContain('記録を読み込めませんでした');
});

test('all collections combine kinds and qualify ambiguous statuses without changing a stored category', async () => {
	window.localStorage.setItem('hatadyActiveTab', 'collection');
	window.localStorage.setItem('hatadyCollectionKind', 'movie');
	const works = [
		{ id: 'movie', title: 'Movie title', kind: 'movie', status: 'planned', userId: 'viewer' },
		{ id: 'game', title: 'Game title', kind: 'game', status: 'planned', userId: 'viewer' },
		{ id: 'work', title: 'Work title', kind: 'work', status: 'in_progress', userId: 'viewer' },
	];
	fixture.api.mockImplementation(async (endpoint, params) => {
		if (endpoint === 'hata/hatady/books') return [{ id: 'book', title: 'Book title', status: 'reading', userId: 'viewer' }];
		if (endpoint === 'hata/hatady/media/works/list') return params.kind ? works.filter(work => work.kind === params.kind) : works;
		return { count: 0 };
	});
	const { target } = await mount();
	expect(target.querySelectorAll('h2')).toHaveLength(1);
	expect(target.textContent).toContain('Movie title');
	target.querySelector<HTMLButtonElement>('[aria-label="作品の種類"] [data-value="all"]')!.click();
	await settle();
	expect([...target.querySelectorAll('h2')].map(node => node.textContent?.trim()).sort()).toEqual(['Book title', 'Game title', 'Movie title', 'Work title']);
	expect(window.localStorage.getItem('hatadyCollectionKind')).toBe('all');
	const filter = [...target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.querySelector('.ti-filter'))!;
	filter.click();
	await settle();
	const status = target.querySelector<HTMLSelectElement>('select')!;
	expect([...status.options].map(option => option.value)).toEqual(expect.arrayContaining(['book:reading', 'movie:planned', 'game:planned', 'work:in_progress']));
	status.value = 'game:planned';
	status.dispatchEvent(new Event('change', { bubbles: true }));
	await settle();
	expect([...target.querySelectorAll('h2')].map(node => node.textContent)).toEqual(['Game title']);
	const query = target.querySelector<HTMLInputElement>('input[type="search"]')!;
	query.value = 'unmatched';
	query.dispatchEvent(new Event('input', { bubbles: true }));
	await settle();
	expect(target.querySelector('h2')).toBeNull();
});

test.each([false, true])('collection owner names render custom emoji and preserve fallbacks (embedded=%s)', async embedded => {
	window.localStorage.setItem('hatadyActiveTab', 'collection');
	const kinds = ['book', 'movie', 'game', 'work'];
	const rows = kinds.map(kind => ({
		id: kind, kind, title: `${kind} title`, status: kind === 'book' ? 'reading' : 'planned', userId: `owner-${kind}`,
		user: { id: `owner-${kind}`, username: `owner_${kind}`, name: '名前 :flower:', host: `${kind}.test`, emojis: { flower: `https://${kind}.test/flower.webp` } },
	}));
	const ownWork = { id: 'own', kind: 'work', title: '本人の作業', status: 'in_progress', userId: 'viewer' };
	const unnamedWork = { id: 'unnamed', kind: 'game', title: '表示名なし', status: 'planned', userId: 'unnamed', user: { id: 'unnamed', username: 'plain_owner', name: null, host: null, emojis: {} } };
	fixture.api.mockImplementation(async (endpoint, params) => {
		if (endpoint === 'hata/hatady/activities') return page('kept');
		if (endpoint === 'hata/hatady/books') return params.scope === 'mine' ? [] : rows.filter(collectionItem => collectionItem.kind === 'book');
		if (endpoint === 'hata/hatady/media/works/list') return params.scope === 'mine' ? [ownWork] : [...rows.filter(collectionItem => collectionItem.kind !== 'book'), ownWork, unnamedWork];
		return { count: 0 };
	});
	const { target, pageProps } = await mount(embedded);
	if (embedded) {
		pageProps.requestedTab = 'collection';
		await settle();
	}
	const recent = target.querySelector<HTMLButtonElement>('[data-value="recent"]');
	expect(recent).not.toBeNull();
	recent?.click();
	await settle();
	const cardFor = (title: string) => [...target.querySelectorAll<HTMLButtonElement>('main button[data-kind]')].find(card => card.querySelector('h2')?.textContent.trim() === title);
	for (const kind of kinds) {
		const card = cardFor(`${kind} title`);
		expect(card).toBeDefined();
		const image = card?.querySelector<HTMLImageElement>('[data-custom-emoji]');
		expect(image?.getAttribute('src')).toBe(`https://${kind}.test/flower.webp`);
		expect(image?.getAttribute('data-host')).toBe(`${kind}.test`);
		expect(image?.getAttribute('data-normal')).toBe('true');
		expect(card?.textContent).toContain('名前');
		expect(card?.textContent).not.toContain(':flower:');
	}
	const ownCard = cardFor('本人の作業');
	expect(ownCard?.textContent).toContain('本人');
	expect(ownCard?.querySelector('[data-custom-emoji]')?.getAttribute('alt')).toBe('self_badge');
	expect(cardFor('表示名なし')?.textContent).toContain('plain_owner');
	expect(target.querySelectorAll('[data-custom-emoji]')).toHaveLength(5);
});
