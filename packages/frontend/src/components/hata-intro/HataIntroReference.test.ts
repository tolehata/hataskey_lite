/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, KeepAlive, nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HataIntro from './HataIntro.vue';
import HataIntroReference from './HataIntroReference.vue';
import { courses } from './content.js';
import { allCourses, referenceById, referenceCourses, references } from './reference-content.js';
import { findReferences } from './search.js';
import type { IntroReference } from './reference-content.js';
import type { App, VNode } from 'vue';

// This approved inventory must not shrink when the production registry loses an entry.
const expectedReferences = [
	['ref-hataskOverview', 'Hataskとは', 'hatask'],
	['ref-calendarAttendance', 'カレンダー・出欠確認', 'hatask'],
	['ref-todoList', 'やることリスト', 'hatask'],
	['ref-moodLog', 'きもち記録', 'hatask'],
	['ref-mealLog', 'ごはん記録', 'hatask'],
	['ref-garden', 'お花を育てる・咲いた花を見る', 'hatask'],
	['ref-hataskEye', 'ホームのひとこと（Hatask Eye）', 'hatask'],
	['ref-hataskAppearance', 'Hataskのテーマを変える', 'hatask'],
	['ref-hatadyOverview', 'Hatadyとは', 'apps'],
	['ref-studyAndBookshelf', '学習記録と本棚', 'apps'],
	['ref-bookmarksNotesMaterials', 'しおり・メモ・学習題材', 'apps'],
	['ref-goalsReview', '目標と振り返り', 'apps'],
	['ref-publicStudy', 'みんなの活動', 'apps'],
	['ref-hatadySettings', '見た目・表示言語・書き出し', 'apps'],
	['ref-externalOverview', '外部アカウント連携とは', 'external'],
	['ref-externalPosts', '外部の投稿を見る', 'external'],
	['ref-favoriteReactionEmoji', 'お気に入りのリアクション絵文字', 'external'],
	['ref-externalNotifications', '外部アカウントの通知', 'external'],
	['ref-languageSupport', 'Hataskey独自機能の表示言語', 'settings'],
	['ref-chooseUi', '画面の種類を選ぶ', 'settings'],
	['ref-hatasabaUi', 'Hataskey UI', 'settings'],
	['ref-deck', 'Hataskey UIのデッキ表示', 'timeline'],
	['ref-noteAnimation', '新しい投稿が現れる動き', 'timeline'],
	['ref-hideReactionEmoji', 'リアクション絵文字の非表示', 'notes'],
	['ref-hideBotPosts', 'Bot投稿の非表示', 'timeline'],
	['ref-weatherBackground', '天気の背景演出', 'timeline'],
	['ref-drawingTool', 'Hatadint', 'apps'],
	['ref-hataCardMaker', 'HataCardMaker', 'apps'],
	['ref-hatalyze', 'HATAlyze', 'apps'],
	['ref-drawingButton', '投稿フォームのHatadintボタン', 'post'],
	['ref-visibilityBorder', '投稿範囲ごとの枠色', 'post'],
	['ref-privateChannel', 'プライベートチャンネル', 'timeline'],
	['ref-feastChallenge', '宴（うたげ）チャレンジ', 'post'],
	['ref-gamesOverview', 'Hataskey Gamesとは', 'games'],
	['ref-whatsNewGuide', '更新内容の案内', 'help'],
	['ref-loginDaysAchievements', 'ログイン日数・実績', 'hatask'],
	['ref-hataskSearch', 'Hatask内検索', 'hatask'],
	['ref-hataskTutorial', 'Hataskの初回案内', 'hatask'],
	['ref-announcementsFilter', 'お知らせの絞り込み', 'help'],
	['ref-mascotOverview', 'マスコット機能とは', 'mascot'],
	['ref-mascotDisplay', '画面上での表示', 'mascot'],
	['ref-expressionsLines', '表情とセリフ', 'mascot'],
	['ref-autoSwitch', '表情とセリフの自動切り替え', 'mascot'],
	['ref-notificationBirthday', '通知・誕生日の演出', 'mascot'],
	['ref-hataskMascot', 'Hataskとマスコット', 'mascot'],
	['ref-mascotTransfer', '設定の保存と読み込み', 'mascot'],
	['ref-hatafeedOverview', 'HataFeedとは', 'apps'],
	['ref-bousai-0', '地震・津波情報を見る', 'apps'],
	['ref-bousai-1', '地震・津波の通知', 'apps'],
	['ref-betaOverview', '開発中の機能を試す', 'help'],
] as const;

const expectedFeatureIds: Record<string, string[]> = {
	uis: ['uiSOverview', 'uiSPost', 'uiSWorkspace', 'uiSSettings'],
	hatagoes: ['goesHome', 'goesApps', 'goesSearch', 'goesSettings'],
	timeline: ['timeline', 'lists', 'channels', 'antenna', 'quiet', 'deck'],
	notes: ['noteActions', 'reaction', 'favorite'],
	post: ['composer', 'visibility', 'attach', 'airreply'],
	apps: ['hatady', 'draw', 'card', 'analyze', 'studio', 'feed'],
	hatask: ['todo', 'calendar', 'mood'],
	settings: ['theme', 'layout'],
	external: [], mascot: [], games: [], help: [],
};
const referenceIds = expectedReferences.map(([id]) => id);
const mounted: { app: App<Element>; container: HTMLDivElement }[] = [];
const runtimeErrors: unknown[] = [];
const attempts: string[] = [];
const storageDescriptors: { name: 'localStorage' | 'sessionStorage'; descriptor?: PropertyDescriptor }[] = [];
let scrollDescriptor: PropertyDescriptor | undefined;
let scrollIntoView: ReturnType<typeof vi.fn>;

function deny(kind: string): (...args: unknown[]) => never {
	return () => { attempts.push(kind); throw new Error(`blocked ${kind}`); };
}

beforeEach(() => {
	runtimeErrors.splice(0);
	attempts.splice(0);
	scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
	scrollIntoView = vi.fn();
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: scrollIntoView });
	vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
		media: query, matches: true, onchange: null,
		addListener: vi.fn(), removeListener: vi.fn(),
		addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(() => true),
	}));
	vi.stubGlobal('IntersectionObserver', class {
		observe = vi.fn();
		unobserve = vi.fn();
		disconnect = vi.fn();
	});
	vi.stubGlobal('fetch', vi.fn(deny('fetch')));
	vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(deny('xhr'));
	vi.spyOn(window, 'open').mockImplementation(deny('window.open'));
	vi.spyOn(navigator, 'sendBeacon').mockImplementation(deny('beacon'));
	vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(deny('clipboard'));
	vi.stubGlobal('WebSocket', class { constructor() { deny('websocket')(); } });
	vi.stubGlobal('indexedDB', { open: vi.fn(deny('indexedDB')) });
	const probes: Array<[string, () => unknown]> = [
		['fetch', () => window.fetch('/hata-intro-positive-control')],
		['xhr', () => new XMLHttpRequest().open('GET', '/hata-intro-positive-control')],
		['window.open', () => window.open('/hata-intro-positive-control')],
		['beacon', () => navigator.sendBeacon('/hata-intro-positive-control')],
		['clipboard', () => navigator.clipboard.writeText('hata-intro-positive-control')],
		['websocket', () => new WebSocket('wss://example.invalid')],
		['indexedDB', () => indexedDB.open('hata-intro-positive-control')],
	];
	for (const name of ['localStorage', 'sessionStorage'] as const) {
		// Happy DOM's Storage Proxy ignores method replacement; guard both exposed realms.
		storageDescriptors.push({ name, descriptor: Object.getOwnPropertyDescriptor(window, name) });
		const guardedStorage: Storage = {
			get length() { return deny(`${name}.length`)(); },
			key: deny(`${name}.key`), getItem: deny(`${name}.getItem`),
			setItem: deny(`${name}.setItem`), removeItem: deny(`${name}.removeItem`), clear: deny(`${name}.clear`),
		};
		vi.stubGlobal(name, guardedStorage);
		Object.defineProperty(window, name, { configurable: true, writable: true, value: guardedStorage });
		expect(globalThis[name]).toBe(guardedStorage);
		expect(window[name]).toBe(guardedStorage);
		for (const owner of [globalThis, window]) {
			for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const) {
				probes.push([`${name}.${method}`, () => {
					const storage = owner[name];
					if (method === 'setItem') storage.setItem('hata-intro-positive-control', 'example');
					else if (method === 'clear') storage.clear();
					else if (method === 'key') storage.key(0);
					else storage[method]('hata-intro-positive-control');
				}]);
			}
			probes.push([`${name}.length`, () => owner[name].length]);
		}
	}
	for (const [kind, probe] of probes) expect(probe, kind).toThrow(`blocked ${kind}`);
	expect(attempts).toEqual(probes.map(([kind]) => kind));
	attempts.splice(0);
});

afterEach(() => {
	try {
		for (const item of mounted.splice(0)) { item.app.unmount(); item.container.remove(); }
		expect(runtimeErrors).toEqual([]);
		expect(attempts).toEqual([]);
	} finally {
		if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor);
		else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		for (const { name, descriptor } of storageDescriptors.splice(0)) {
			if (descriptor) Object.defineProperty(window, name, descriptor);
			else Reflect.deleteProperty(window, name);
		}
	}
});

function mountView(render: () => VNode) {
	const navigate = vi.fn();
	const app = createApp(defineComponent({ setup: () => render }));
	app.config.errorHandler = error => { runtimeErrors.push(error); };
	app.component('MkA', defineComponent({
		props: { to: { type: String, required: true } },
		setup: (link, { slots }) => () => h('a', {
			href: link.to, 'data-native-route': link.to,
			onClick: (event: MouseEvent) => { event.preventDefault(); navigate(link.to); },
		}, slots.default?.()),
	}));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	mounted.push({ app, container });
	app.mount(container);
	return { app, container, navigate };
}

function mountGuides(count = 1, initialPage: 'home' | 'index' = 'home') {
	const props = reactive({ darkMode: false, animation: false, initialPage });
	const view = mountView(() => h('div', Array.from({ length: count }, (_, key) => h(HataIntro, { ...props, key }))));
	const roots = [...view.container.querySelectorAll<HTMLElement>('.hata-intro')];
	expect(roots).toHaveLength(count);
	return { ...view, roots, root: roots[0], props };
}

function element<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
	const found = root.querySelector<T>(selector);
	if (!found) throw new Error(`Missing reference element: ${selector}`);
	return found;
}

async function settle(): Promise<void> {
	await nextTick();
	await Promise.resolve();
	await nextTick();
}

async function click(root: ParentNode, selector: string, keyboard = false): Promise<void> {
	const target = element(root, selector);
	if (keyboard) target.focus();
	target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: keyboard ? 0 : 1 }));
	await settle();
}

async function search(root: HTMLElement, value: string): Promise<void> {
	const input = element<HTMLInputElement>(root, '[data-guide-search-form] input[type="search"]');
	input.value = value;
	input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
	await settle();
}

function results(root: ParentNode): string[] {
	return [...root.querySelectorAll<HTMLElement>('[data-search-result]')].map(item => item.dataset.searchResult!);
}

async function openReferenceFromContents(root: HTMLElement, id: string): Promise<void> {
	expect(element(root, '.hg-courses')).toBeTruthy();
	const target = element(root, `.hg-reference-links [data-id="${id}"]`);
	const fold = target.closest('details');
	if (fold) fold.open = true;
	await click(root, `.hg-reference-links [data-id="${id}"]`, true);
}

function compact(text: string | null): string {
	return (text ?? '').replace(/<br\s*\/?>/g, '').replace(/\s/gu, '');
}

function texts(root: ParentNode, selector: string): string[] {
	return [...root.querySelectorAll(selector)].map(item => compact(item.textContent));
}

function duplicateIds(root: ParentNode): string[] {
	const seen = new Set<string>();
	return [...root.querySelectorAll('[id]')].map(item => item.id).filter(id => {
		if (seen.has(id)) return true;
		seen.add(id);
		return false;
	});
}

describe('統合機能解説の固定母集団と検索', () => {
	test('53件の参考記事と図・手順・FAQを維持し、UI SとHataGoesを含む8つの操作カテゴリへ結び付ける', () => {
		function assertInventory(items: readonly IntroReference[]) {
			expect(items.map(item => [item.id, item.title, item.course])).toEqual(expectedReferences);
		}

		expect(expectedReferences).toHaveLength(50);
		expect(() => assertInventory(references.slice(1))).toThrow();
		expect(() => assertInventory([references[0], ...references.slice(0, -1)])).toThrow();
		assertInventory(references);
		expect(Object.keys(referenceById).sort()).toEqual([...referenceIds].sort());
		for (const item of references) expect(referenceById[item.id]).toBe(item);
		expect(courses.map(course => course.id)).toEqual(['uis', 'hatagoes', 'timeline', 'notes', 'post', 'apps', 'hatask', 'settings']);
		expect(referenceCourses.map(course => course.id)).toEqual(['external', 'mascot', 'games', 'help']);
		expect(allCourses).toEqual([...courses, ...referenceCourses]);
		expect(allCourses).not.toBe(courses);
		expect(allCourses).not.toBe(referenceCourses);
		expect(references.filter(item => item.diagram).map(item => item.id)).toEqual([
			'ref-calendarAttendance', 'ref-mealLog', 'ref-garden', 'ref-hatadyOverview', 'ref-externalOverview', 'ref-privateChannel',
		]);
		expect(references.filter(item => item.steps?.length).map(item => item.id)).toEqual([
			'ref-mealLog', 'ref-garden', 'ref-hataskAppearance', 'ref-goalsReview', 'ref-externalOverview', 'ref-hataskSearch',
		]);
		expect(references.filter(item => item.help?.length).map(item => item.id)).toEqual([
			'ref-mealLog', 'ref-garden', 'ref-externalOverview', 'ref-externalNotifications', 'ref-privateChannel',
		]);
	});

	test('旧機能解説用のindex入口は82件を示し、12カテゴリで操作ガイドと機能解説を一緒に絞る', async () => {
		const { root } = mountGuides(1, 'index');
		expect(element(root, '[data-guide-search-panel]').hidden).toBe(false);
		expect(results(root)).toHaveLength(82);
		expect(new Set(results(root)).size).toBe(82);
		expect(results(root).sort()).toEqual([...Object.values(expectedFeatureIds).flat(), ...referenceIds].sort());
		expect(element(root, '[data-guide-search-panel] [role="status"]').textContent).toContain('82件 · 操作ガイド 32 / 機能解説 50');
		expect(findReferences('').map(item => item.id)).toEqual(referenceIds);
		for (const [course, featureIds] of Object.entries(expectedFeatureIds)) {
			await click(root, `[data-action="filter"][data-id="${course}"]`);
			const ids = expectedReferences.filter(([, , category]) => category === course).map(([id]) => id);
			expect(findReferences('', course).map(item => item.id)).toEqual(ids);
			expect(results(root).sort()).toEqual([...featureIds, ...ids].sort());
			expect(element(root, `[data-action="filter"][data-id="${course}"]`).getAttribute('aria-pressed')).toBe('true');
		}
		await click(root, '[data-action="filter"][data-id="all"]');
		await search(root, '通知');
		expect(results(root)).toContain('ref-externalNotifications');
		expect(results(root)).toContain('ref-bousai-1');
		await click(root, '[data-action="filter"][data-id="external"]');
		expect(results(root)).toContain('ref-externalNotifications');
		expect(results(root)).not.toContain('ref-bousai-1');
		await click(root, '[data-action="filter"][data-id="apps"]');
		expect(results(root)).toContain('ref-bousai-1');
		expect(results(root)).not.toContain('ref-externalNotifications');
		expect(element<HTMLInputElement>(root, 'input[type="search"]').value).toBe('通知');
	});

	test.each(expectedReferences)('%s: タイトル検索から本文・図・手順・本体入口を読み、元の検索へ戻れる', async (id, title, course) => {
		const { root, navigate } = mountGuides(1, 'index');
		const item = referenceById[id];
		expect(item).toBeDefined();
		expect(item.title).toBe(title);
		expect(item.course).toBe(course);
		expect(findReferences(title).map(found => found.id)).toContain(id);
		await search(root, title);
		expect(results(root)).toContain(id);
		const before = results(root);
		await click(root, `[data-search-result="${id}"]`, true);
		const article = element(root, `[data-reference-article="${id}"]`);
		expect(root.querySelector('[data-guide-article]')).toBeNull();
		expect(article.querySelector('[data-scene]')).toBeNull();
		expect(element(article, '[data-guide-title]').textContent).toBe(title);
		expect(window.document.activeElement).toBe(element(article, '[data-guide-title]'));
		expect(compact(element(article, '.hg-step-desc').textContent)).toBe(compact(item.lead));
		expect(compact(element(article, '.hg-entry p').textContent)).toBe(compact(item.where));
		const paragraphs = item.body.split(/(?:<br\s*\/?>\s*){2,}|\n\n/).filter(Boolean);
		expect(paragraphs.length).toBeGreaterThan(0);
		expect(texts(article, '.hg-reference-reading > p')).toEqual(paragraphs.map(compact));
		expect(texts(article, '.hg-reference-reading > .hg-note > p')).toEqual(item.tips.map(compact));
		expect(texts(article, '.hg-reference-reading > .hg-how .hg-instructions > li')).toEqual((item.steps ?? []).map(compact));
		expect(texts(article, '.hg-help .hg-faq summary')).toEqual((item.help ?? []).map(([question]) => compact(question)));
		expect(texts(article, '.hg-help .hg-faq p')).toEqual((item.help ?? []).map(([, answer]) => compact(answer)));
		expect(element(article, '.hg-source-note').textContent).toContain(item.source);
		if (item.diagram) {
			const figure = element(article, '.hg-reference-diagram');
			expect(element(figure, 'figcaption strong').textContent).toBe(item.diagram.title);
			expect(element(figure, 'figcaption span').textContent).toContain('実際の操作画面ではありません');
			expect(texts(figure, 'ol > li strong')).toEqual(item.diagram.nodes.map(([label]) => compact(label)));
			expect(texts(figure, 'ol > li p')).toEqual(item.diagram.nodes.map(([, description]) => compact(description)));
			expect(texts(figure, '.hg-number')).toEqual(item.diagram.nodes.map((_, index) => String(index + 1)));
			if (item.diagram.note) expect(compact(element(figure, '.hg-reference-diagram-note').textContent)).toBe(compact(item.diagram.note));
		} else {
			expect(article.querySelector('.hg-reference-diagram')).toBeNull();
		}
		const practice = [...article.querySelectorAll<HTMLElement>('.hg-reference-practice [data-action="feature"]')];
		expect(practice.map(button => button.dataset.id)).toEqual(item.related);
		if (item.link) {
			const anchor = element<HTMLAnchorElement>(article, '.hg-entry a[data-native-route]');
			expect(anchor.getAttribute('href')).toBe(item.link);
			expect(anchor.getAttribute('href')).toMatch(/^\/(?!\/)/);
			expect(anchor.textContent).toContain(item.linkLabel || '本体で開く');
			await click(article, '.hg-entry a[data-native-route]');
			expect(navigate).toHaveBeenCalledTimes(1);
			expect(navigate).toHaveBeenLastCalledWith(item.link);
			expect(element(root, '[data-reference-article]').dataset.referenceArticle).toBe(id);
		} else {
			expect(article.querySelector('.hg-entry a')).toBeNull();
			expect(navigate).not.toHaveBeenCalled();
		}
		await click(root, '[data-action="back"]');
		expect(element<HTMLInputElement>(root, 'input[type="search"]').value).toBe(title);
		expect(results(root)).toEqual(before);
		expect(window.document.activeElement).toBe(element(root, `[data-search-result="${id}"]`));
	});
});

describe('操作ガイドと機能解説の往復・フォーカス', () => {
	test('timeline検索結果から戻ると、同名カテゴリfilterではなく選んだ結果にフォーカスする', async () => {
		const { root } = mountGuides(1, 'index');
		await search(root, 'タイムライン');
		expect(results(root)).toContain('timeline');
		expect(element(root, '[data-action="filter"][data-id="timeline"]')).toBeTruthy();
		await click(root, '[data-search-result="timeline"]', true);
		expect(element(root, '[data-guide-article]').dataset.guideArticle).toBe('timeline');
		await click(root, '[data-action="back"]');
		expect(window.document.activeElement).toBe(element(root, '[data-search-result="timeline"]'));
		expect(window.document.activeElement).not.toBe(element(root, '[data-action="filter"][data-id="timeline"]'));
	});

	test.each([
		'ref-deck', 'ref-hideReactionEmoji', 'ref-drawingButton',
		'ref-hatadyOverview', 'ref-garden', 'ref-hatasabaUi',
	])('%sから目次へ戻ると、再生成された閉じたdetailsを開いて元リンクへフォーカスする', async id => {
		const { root } = mountGuides();
		const original = element(root, `.hg-reference-links [data-id="${id}"]`);
		const fold = original.closest('details');
		expect(fold).not.toBeNull();
		expect(fold?.open).toBe(false);
		await openReferenceFromContents(root, id);
		await click(root, '[data-action="back"]');
		const replacement = element(root, `.hg-reference-links [data-id="${id}"]`);
		expect(replacement).not.toBe(original);
		expect(replacement.closest('details')?.open).toBe(true);
		expect(window.document.activeElement).toBe(replacement);
	});

	test('deckとref-deckを別の記事として検索し、解説・操作図・検索の履歴を順に戻す', async () => {
		const { root } = mountGuides(1, 'index');
		await click(root, '[data-action="filter"][data-id="timeline"]');
		await search(root, 'デッキ');
		expect(results(root)).toContain('deck');
		expect(results(root)).toContain('ref-deck');
		expect(element(root, '[data-search-result="deck"]').dataset.action).toBe('feature');
		expect(element(root, '[data-search-result="ref-deck"]').dataset.action).toBe('reference');
		const before = results(root);
		await click(root, '[data-search-result="ref-deck"]');
		await click(root, '.hg-reference-practice [data-id="deck"]', true);
		expect(element(root, '[data-guide-article]').dataset.guideArticle).toBe('deck');
		expect(root.querySelector('[data-reference-article]')).toBeNull();
		await click(root, '[data-action="demo-view"][data-view="deck"]');
		expect(element(root, '[data-deck]').dataset.deck).toBe('true');
		await click(root, '[data-action="back"]');
		expect(element(root, '[data-reference-article]').dataset.referenceArticle).toBe('ref-deck');
		expect(window.document.activeElement).toBe(element(root, '.hg-reference-practice [data-id="deck"]'));
		await click(root, '[data-action="back"]');
		expect(results(root)).toEqual(before);
		expect(element<HTMLInputElement>(root, 'input[type="search"]').value).toBe('デッキ');
		expect(element(root, '[data-action="filter"][data-id="timeline"]').getAttribute('aria-pressed')).toBe('true');
		expect(window.document.activeElement).toBe(element(root, '[data-search-result="ref-deck"]'));
		await click(root, '[data-search-result="deck"]');
		await click(root, '[data-action="expand-example"]');
		await click(root, '.hg-reference-bridge [data-id="ref-deck"]', true);
		expect(element(root, '[data-reference-article]').dataset.referenceArticle).toBe('ref-deck');
		await click(root, '[data-action="back"]');
		expect(element(root, '[data-guide-article]').dataset.guideArticle).toBe('deck');
		expect(element(root, '.hg-learn').dataset.expanded).toBe('true');
		expect(window.document.activeElement).toBe(element(root, '.hg-reference-bridge [data-id="ref-deck"]'));
	});

	test.each([
		['ref-chooseUi', 'uiSOverview'],
		['ref-hataskSearch', 'goesSearch'],
		['ref-garden', 'goesHome'],
	])('%sから新しい操作ガイド%sを開き、元の解説と検索へ戻れる', async (referenceId, featureId) => {
		const { root } = mountGuides(1, 'index');
		await search(root, referenceById[referenceId].title);
		const before = results(root);
		await click(root, `[data-search-result="${referenceId}"]`);
		await click(root, `.hg-reference-practice [data-id="${featureId}"]`, true);
		expect(element(root, '[data-guide-article]').dataset.guideArticle).toBe(featureId);
		await click(root, '[data-action="back"]');
		expect(element(root, '[data-reference-article]').dataset.referenceArticle).toBe(referenceId);
		expect(window.document.activeElement).toBe(element(root, `.hg-reference-practice [data-id="${featureId}"]`));
		await click(root, '[data-action="back"]');
		expect(results(root)).toEqual(before);
		expect(window.document.activeElement).toBe(element(root, `[data-search-result="${referenceId}"]`));
	});

	test('同カテゴリの別解説から戻ると記事の折りたたみリンクを、さらに戻ると目次のリンクを復元する', async () => {
		const { root } = mountGuides();
		await openReferenceFromContents(root, 'ref-garden');
		const adjacent = element<HTMLDetailsElement>(root, 'article .hg-reference-fold');
		expect(adjacent.open).toBe(false);
		adjacent.open = true;
		await click(root, 'article .hg-reference-fold [data-id="ref-mealLog"]', true);
		expect(element(root, '[data-reference-article]').dataset.referenceArticle).toBe('ref-mealLog');
		await click(root, '[data-action="back"]');
		expect(element(root, '[data-reference-article]').dataset.referenceArticle).toBe('ref-garden');
		expect(element<HTMLDetailsElement>(root, 'article .hg-reference-fold').open).toBe(true);
		expect(window.document.activeElement).toBe(element(root, 'article .hg-reference-fold [data-id="ref-mealLog"]'));
		await click(root, '[data-action="back"]');
		expect(window.document.activeElement).toBe(element(root, '.hg-reference-links [data-id="ref-garden"]'));
	});

	test('index入口の全項目から解説を往復すると82件と用語集へ戻り、履歴が空なら目次へ戻れる', async () => {
		const { root } = mountGuides(1, 'index');
		expect(results(root)).toHaveLength(82);
		expect(element(root, '[data-glossary-title]').textContent).toBe('よく出てくる言葉');
		await click(root, '[data-search-result="ref-garden"]', true);
		const adjacent = element<HTMLDetailsElement>(root, 'article .hg-reference-fold');
		adjacent.open = true;
		await click(root, 'article .hg-reference-fold [data-id="ref-mealLog"]', true);
		await click(root, '[data-action="back"]');
		expect(element(root, '[data-reference-article]').dataset.referenceArticle).toBe('ref-garden');
		expect(window.document.activeElement).toBe(element(root, 'article .hg-reference-fold [data-id="ref-mealLog"]'));
		await click(root, '[data-action="back"]');
		expect(results(root)).toHaveLength(82);
		expect(element(root, '[data-glossary-title]').textContent).toBe('よく出てくる言葉');
		expect(window.document.activeElement).toBe(element(root, '[data-search-result="ref-garden"]'));
		await click(root, '[data-action="back"]');
		expect(element(root, '[data-guide-home-content]').hidden).toBe(false);
		expect(element(root, '.hg-hero .hg-eyebrow .hg-brand').textContent).toBe('HataIntro');
	});

	test('Hatadintの解説から操作ガイドへ進んでも、お絵描き操作モックを追加しない', async () => {
		const { root } = mountGuides();
		await openReferenceFromContents(root, 'ref-drawingTool');
		await click(root, '.hg-reference-practice [data-id="draw"]');
		expect(element(root, '[data-guide-article]').dataset.guideArticle).toBe('draw');
		expect(root.querySelector('[data-scene]')).toBeNull();
		expect(element(root, '.hg-how').textContent).toContain('書き出す');
		await click(root, '[data-action="back"]');
		expect(element(root, '[data-reference-article]').dataset.referenceArticle).toBe('ref-drawingTool');
	});
});

describe('機能解説の複数ウィンドウ・KeepAlive・安全性', () => {
	test('検索・記事・履歴とIDはインスタンスごとに独立し、配色だけは本体に追従する', async () => {
		const { container, roots: [first, second], props } = mountGuides(2, 'index');
		const original = element(first, '[id]');
		const duplicate = original.cloneNode(false) as HTMLElement;
		container.append(duplicate);
		expect(duplicateIds(container)).toContain(original.id);
		duplicate.remove();
		expect(duplicateIds(container)).toEqual([]);
		for (const root of [first, second]) {
			for (const label of root.querySelectorAll<HTMLLabelElement>('label[for]')) expect(element(root, `[id="${label.htmlFor}"]`)).toBeTruthy();
			expect(element<HTMLAnchorElement>(root, '.hg-skip').getAttribute('href')).toBe(`#${element(root, 'main').id}`);
		}
		await search(first, 'デッキ');
		await search(second, 'お花');
		await click(first, '[data-search-result="ref-deck"]');
		await click(second, '[data-search-result="ref-garden"]');
		await click(first, '.hg-reference-practice [data-id="deck"]');
		expect(element(second, '[data-reference-article]').dataset.referenceArticle).toBe('ref-garden');
		await click(first, '[data-action="back"]');
		await click(first, '[data-action="back"]');
		expect(element<HTMLInputElement>(first, 'input[type="search"]').value).toBe('デッキ');
		expect(element(second, '[data-reference-article]').dataset.referenceArticle).toBe('ref-garden');
		await click(second, '[data-action="back"]');
		expect(element<HTMLInputElement>(second, 'input[type="search"]').value).toBe('お花');
		props.darkMode = true;
		await settle();
		for (const root of [first, second]) {
			expect(root.dataset.theme).toBe('system');
			expect(root.style.colorScheme).toBe('dark');
		}
		expect(duplicateIds(container)).toEqual([]);
	});

	test('KeepAlive再表示で解説と履歴を保ち、非表示への切替中の遷移は別画面からフォーカスを奪わない', async () => {
		const state = reactive({ shown: true, darkMode: false });
		const otherPage = defineComponent({ setup: () => () => h('button', { 'data-other-page': '' }, '別の画面') });
		const { container } = mountView(() => h(KeepAlive, null, {
			default: () => state.shown
				? h(HataIntro, { key: 'guide', initialPage: 'index', animation: false, darkMode: state.darkMode })
				: h(otherPage, { key: 'other' }),
		}));
		const root = element(container, '.hata-intro');
		await click(root, '[data-action="filter"][data-id="timeline"]');
		await search(root, 'デッキ');
		await click(root, '[data-search-result="ref-deck"]');
		state.shown = false;
		await settle();
		expect(root.isConnected).toBe(false);
		state.darkMode = true;
		state.shown = true;
		await settle();
		expect(element(container, '.hata-intro')).toBe(root);
		expect(element(root, '[data-reference-article]').dataset.referenceArticle).toBe('ref-deck');
		expect(root.style.colorScheme).toBe('dark');
		scrollIntoView.mockClear();
		// Queue navigation and deactivate before its post-render focus continuation runs.
		element(root, '.hg-reference-practice [data-id="deck"]').click();
		state.shown = false;
		await nextTick();
		const outside = element(container, '[data-other-page]');
		outside.focus();
		await settle();
		expect(window.document.activeElement).toBe(outside);
		expect(scrollIntoView).not.toHaveBeenCalled();
		state.shown = true;
		await settle();
		expect(element(root, '[data-guide-article]').dataset.guideArticle).toBe('deck');
		expect(element(root, '[data-scene="deck"]')).toBeTruthy();
		await click(root, '[data-action="back"]');
		expect(element(root, '[data-reference-article]').dataset.referenceArticle).toBe('ref-deck');
		await click(root, '[data-action="back"]');
		expect(element<HTMLInputElement>(root, 'input[type="search"]').value).toBe('デッキ');
		expect(element(root, '[data-action="filter"][data-id="timeline"]').getAttribute('aria-pressed')).toBe('true');
		expect(window.document.activeElement).toBe(element(root, '[data-search-result="ref-deck"]'));
	});

	test('Vue実行時エラーと欠落DOMの検出器は陽性対照を捕捉する', () => {
		const positive = new Error('reference runtime positive control');
		const broken = defineComponent({ setup: () => () => { throw positive; } });
		mountView(() => h(broken));
		expect(runtimeErrors).toEqual([positive]);
		runtimeErrors.splice(0);
		const { root } = mountGuides();
		expect(() => element(root, '[data-missing-reference-positive-control]')).toThrow('Missing reference element:');
		expect(element(root, '[data-guide-title]')).toBeTruthy();
	});

	test('記事の全テキスト欄はHTMLとして実行せず、図と手順も表示用文字列として扱う', () => {
		const probe = '<img data-reference-injection-probe src="x" onerror="void 0">';
		const control = window.document.createElement('template');
		control.innerHTML = probe;
		expect(control.content.querySelector('[data-reference-injection-probe]')).not.toBeNull();
		const item: IntroReference = {
			...referenceById['ref-garden'], id: 'reference-text-probe', related: [], link: null,
			title: `Hata${probe}`, body: `${probe}<br><br>${probe}`, lead: probe, where: probe,
			tips: [probe], source: probe, steps: [probe], stepsTitle: probe,
			help: [[probe, probe]], diagram: { title: probe, nodes: [[probe, probe]], note: probe },
		};
		const { container } = mountView(() => h('div', { class: 'hata-intro' }, h(HataIntroReference, { reference: item })));
		const article = element(container, '[data-reference-article]');
		expect(article.querySelector('[data-reference-injection-probe]')).toBeNull();
		for (const selector of [
			'[data-guide-title]', '.hg-step-desc', '.hg-entry p', '.hg-reference-reading > p',
			'.hg-how h2', '.hg-instructions li', '.hg-note p', '.hg-faq summary', '.hg-faq p',
			'.hg-reference-diagram figcaption strong', '.hg-reference-diagram li strong',
			'.hg-reference-diagram li p', '.hg-reference-diagram-note', '.hg-source-note',
		]) expect(element(article, selector).textContent).toContain(probe);
		expect(article.querySelectorAll('.hg-reference-reading > p')).toHaveLength(2);
	});
});
