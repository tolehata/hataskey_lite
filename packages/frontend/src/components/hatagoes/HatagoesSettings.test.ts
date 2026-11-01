/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, reactive } from 'vue';
import { HATAGOES_CATALOG } from '@/utility/hatagoes-catalog.js';
import { normalizeHatagoesCards, normalizeHatagoesCardsV3 } from '@/utility/hatagoes-preferences.js';
import type { HatagoesCardV3, HatagoesHomeTheme } from '@/utility/hatagoes-preferences.js';
import HatagoesSettings from './HatagoesSettings.vue';

vi.mock('@/store.js', async () => ({ store: { r: { darkMode: (await import('vue')).ref(true) } } }));
vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(false) } } }));
vi.mock('@/components/hatask/HataskThemePreview.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: { theme: String, mode: String }, setup(props) { return () => h('span', { 'data-preview': props.theme, 'data-mode': props.mode }); } }) };
});

let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); });

async function mount(withFeed = false) {
	const props = reactive({
		pins: ['hatask.cal'], appPins: ['hatask.recipe'], cards: normalizeHatagoesCards(undefined), cardsV3: normalizeHatagoesCardsV3(undefined),
		theme: { theme: 'akatsuki', darkMode: false, autoTheme: true } as HatagoesHomeTheme, ready: true, saving: false, error: false,
		screens: HATAGOES_CATALOG.filter(screen => withFeed || screen.app !== 'hatafeed'),
	});
	const editAppPins = vi.fn();
	const appSettings = vi.fn();
	const navigate = vi.fn();
	const save = vi.fn();
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ render: () => h(HatagoesSettings, { ...props, onEditAppPins: editAppPins, onAppSettings: appSettings, onNavigate: navigate, onSave: save }) });
	app.mount(target);
	cleanup = () => { app.unmount(); target.remove(); };
	await nextTick();
	return { target, props, editAppPins, appSettings, navigate, save };
}

function search(target: ParentNode, value: string) {
	const input = target.querySelector<HTMLInputElement>('input[type="search"]');
	if (!input) throw new Error('Missing settings search');
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('HataGoes settings categories', () => {
	test('uses the brand font only for English application names', async () => {
		const view = await mount(true);
		const wordmarks = [...view.target.querySelectorAll<HTMLElement>('[class*="appWordmark"]')];
		expect(wordmarks.map(node => node.textContent)).toEqual(expect.arrayContaining(['Hatask', 'Hatady', 'HataFeed']));
		expect(wordmarks.every(node => /^(Hatask|Hatady|HataFeed)$/u.test(node.textContent ?? ''))).toBe(true);
		expect(view.target.querySelector('section[aria-label="設定の検索結果"]')).toBeNull();
	});
	test('puts the theme first and saves carousel, appearance, pin and card changes without mount writes', async () => {
		const view = await mount(true);
		expect(view.save).not.toHaveBeenCalled();
		const sections = [...view.target.querySelectorAll<HTMLElement>('section')];
		expect(sections.find(section => section.getAttribute('aria-label') === 'ホーム専用テーマ')).toBe(sections[1]);
		expect(view.target.querySelectorAll('[data-theme]')).toHaveLength(7);
		const next = view.target.querySelector<HTMLButtonElement>('[aria-label="次のテーマ"]');
		next?.click();
		expect(view.save).toHaveBeenLastCalledWith('theme', { theme: 'koke', darkMode: false, autoTheme: true });
		view.props.theme.theme = 'koke';
		await nextTick();
		expect(view.target.querySelector('[data-theme="koke"]')?.getAttribute('aria-pressed')).toBe('true');
		const auto = [...view.target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(input => input.parentElement?.textContent?.includes('端末の設定に合わせる'));
		auto?.click();
		expect(view.save).toHaveBeenLastCalledWith('theme', { theme: 'koke', darkMode: false, autoTheme: false });
		view.props.theme.autoTheme = false;
		await nextTick();
		const dark = [...view.target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(input => input.parentElement?.textContent?.includes('ダークモード'));
		dark?.click();
		expect(view.save).toHaveBeenLastCalledWith('theme', { theme: 'koke', darkMode: true, autoTheme: false });
		expect(view.target.textContent).not.toContain('上部ナビに表示するアプリ');
		expect(view.props.pins).toEqual(['hatask.cal']);
		const card = view.target.querySelector<HTMLInputElement>('input[aria-label="あなたのイシューを表示"]');
		card?.click();
		expect(view.save).toHaveBeenLastCalledWith('cardsV3', expect.arrayContaining([expect.objectContaining({ id: 'issues', hidden: true })]));
	});

	test('offers Halloween in October without selecting it automatically and saves its independent theme choice', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 9, 19, 12));
		const view = await mount();
		const cardsBefore = view.props.cardsV3.map(card => ({ ...card }));
		expect(view.target.querySelector('[data-theme="halloween"]')?.textContent).toContain('10月のおすすめ');
		expect(view.props.theme.theme).toBe('akatsuki');
		expect(view.save).not.toHaveBeenCalled();
		view.target.querySelector<HTMLButtonElement>('[aria-label="ハロウィン テーマへ移動"]')?.click();
		expect(view.save).toHaveBeenLastCalledWith('theme', { theme: 'halloween', darkMode: false, autoTheme: true });
		expect(view.props.cardsV3).toEqual(cardsBefore);
		view.props.theme = { theme: 'halloween', darkMode: true, autoTheme: false };
		await nextTick();
		expect(view.target.querySelector('[data-theme="halloween"]')?.getAttribute('aria-pressed')).toBe('true');
		expect(view.target.querySelector('[data-preview="halloween"]')?.getAttribute('data-mode')).toBe('dark');
		search(view.target, 'ハロウィン');
		await nextTick();
		expect(view.target.querySelector('section[aria-label="ホーム専用テーマ"]')).not.toBeNull();
		expect(view.target.textContent).not.toContain('一致する設定はありません。');
	});

	test('keeps Halloween selectable outside October without seasonal recommendation copy', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 10, 1, 12));
		const view = await mount();
		expect(view.target.querySelector('[data-theme="halloween"]')?.textContent).toContain('かぼちゃ色と夜の紫');
		expect(view.target.querySelector('[data-theme="halloween"]')?.textContent).not.toContain('10月のおすすめ');
		view.target.querySelector<HTMLButtonElement>('[aria-label="ハロウィン テーマへ移動"]')?.click();
		expect(view.save).toHaveBeenLastCalledWith('theme', { theme: 'halloween', darkMode: false, autoTheme: true });
	});

	test('supports keyboard theme navigation and locks controls while saving', async () => {
		const view = await mount();
		const carousel = view.target.querySelector('[aria-label="ホームのデザインテーマ"]');
		carousel?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		expect(view.save).toHaveBeenCalledWith('theme', { theme: 'koke', darkMode: false, autoTheme: true });
		view.props.saving = true;
		await nextTick();
		const count = view.save.mock.calls.length;
		view.target.querySelector<HTMLButtonElement>('[aria-label="次のテーマ"]')?.click();
		expect(view.save).toHaveBeenCalledTimes(count);
		expect(view.target.querySelector<HTMLButtonElement>('[data-theme="koke"]')?.disabled).toBe(true);
	});

	test('keeps the home preview in saved order and omits hidden cards', async () => {
		const view = await mount();
		const preview = view.target.querySelector('[aria-label="現在のホームの並び"]');
		expect(preview?.querySelectorAll('[data-card]')).toHaveLength(8);
		expect(preview?.firstElementChild?.hasAttribute('data-preview-launcher')).toBe(true);
		expect(preview?.querySelector('[data-card]')?.textContent).toContain('きょうの記録');
		view.props.cardsV3 = [{ id: 'flower', hidden: false }, { id: 'daily', hidden: true }, ...view.props.cardsV3.filter(card => card.id !== 'flower' && card.id !== 'daily')];
		await nextTick();
		expect(preview?.querySelector('[data-card]')?.textContent).toContain('おはな');
		expect(preview?.textContent).not.toContain('きょうの記録');
		view.target.querySelector<HTMLButtonElement>('[aria-label="配置プレビューの画面幅"] button:last-child')?.click();
		await nextTick();
		expect(preview?.lastElementChild?.hasAttribute('data-preview-launcher')).toBe(true);
	});

	test('mobile preview groups all five daily records, keeps the launcher last and preserves grouped settings when moved', async () => {
		const view = await mount();
		view.props.cardsV3 = view.props.cardsV3.map(card => card.id === 'mood' ? { ...card, hidden: true } : card);
		const groupedBefore = view.props.cardsV3.filter(card => !['daily', 'schedule', 'issues'].includes(card.id)).map(card => ({ ...card }));
		view.target.querySelector<HTMLButtonElement>('[aria-label="配置プレビューの画面幅"] button:last-child')?.click();
		await nextTick();
		const ids = () => [...view.target.querySelectorAll<HTMLElement>('[aria-label="現在のホームの並び"] [data-card]')].map(card => card.dataset.card);
		const preview = view.target.querySelector('[aria-label="現在のホームの並び"]')!;
		expect(ids()).toEqual(['daily', 'schedule', 'issues']);
		expect(preview.lastElementChild?.hasAttribute('data-preview-launcher')).toBe(true);
		expect(preview.getAttribute('data-half-pair')).toBe('true');
		expect([...preview.querySelectorAll('[aria-label="きょうの記録にまとめる項目"] span')].map(item => item.textContent)).toEqual(['きもち', 'ごはん', 'ToDo', '水やり', '読書']);
		expect(view.target.textContent).toContain('モバイルでは5つの記録を「きょうの記録」にまとめます。');
		expect(view.target.querySelector('[aria-label="いまのきもちを表示"]')).toBeNull();
		expect(view.save).not.toHaveBeenCalled();
		view.target.querySelector<HTMLButtonElement>('[aria-label="あなたのイシューを前へ"]')?.click();
		const saved = view.save.mock.lastCall?.[1] as HatagoesCardV3[];
		expect(saved.map(card => card.id)).toEqual(['daily', 'issues', 'flower', 'todo', 'mood', 'meal', 'reading', 'schedule']);
		expect(saved.filter(card => !['daily', 'schedule', 'issues'].includes(card.id))).toEqual(groupedBefore);
		view.props.cardsV3 = saved;
		await nextTick();
		expect(ids()).toEqual(['daily', 'issues', 'schedule']);
		view.target.querySelector<HTMLButtonElement>('[aria-label="配置プレビューの画面幅"] button:first-child')?.click();
		await nextTick();
		expect(ids()).toEqual(saved.filter(card => !card.hidden).map(card => card.id));
		expect(view.target.querySelector('[aria-label="いまのきもちを表示"]')).not.toBeNull();
	});

	test('hiding daily restores independent cards and expands unpaired schedule or issues', async () => {
		const view = await mount();
		view.target.querySelector<HTMLButtonElement>('[aria-label="配置プレビューの画面幅"] button:last-child')?.click();
		await nextTick();
		view.target.querySelector<HTMLInputElement>('[aria-label="きょうの記録を表示"]')?.click();
		view.props.cardsV3 = view.save.mock.lastCall?.[1] as HatagoesCardV3[];
		await nextTick();
		const preview = view.target.querySelector('[aria-label="現在のホームの並び"]')!;
		expect([...preview.querySelectorAll<HTMLElement>('[data-card]')].map(card => card.dataset.card)).toEqual(['schedule', 'todo', 'mood', 'flower', 'reading', 'meal', 'issues']);
		expect(preview.getAttribute('data-half-pair')).toBe('false');
		expect(preview.getAttribute('data-flower-pair')).toBe('true');
		expect(preview.lastElementChild?.hasAttribute('data-preview-launcher')).toBe(true);
		view.props.cardsV3 = normalizeHatagoesCardsV3(undefined).map(card => ({ ...card, hidden: card.id === 'issues' }));
		await nextTick();
		expect(preview.getAttribute('data-half-pair')).toBe('false');
		expect([...preview.querySelectorAll<HTMLElement>('[data-card]')].map(card => card.dataset.card)).toEqual(['daily', 'schedule']);
		view.props.cardsV3 = normalizeHatagoesCardsV3(undefined).map(card => ({ ...card, hidden: card.id === 'schedule' }));
		await nextTick();
		expect(preview.getAttribute('data-half-pair')).toBe('false');
		expect([...preview.querySelectorAll<HTMLElement>('[data-card]')].map(card => card.dataset.card)).toEqual(['daily', 'issues']);
		view.props.cardsV3 = normalizeHatagoesCardsV3([{ id: 'schedule' }, { id: 'daily' }, { id: 'issues' }]);
		await nextTick();
		expect(preview.getAttribute('data-half-pair')).toBe('false');
		expect([...preview.querySelectorAll<HTMLElement>('[data-card]')].map(card => card.dataset.card)).toEqual(['schedule', 'daily', 'issues']);
	});

	test('keeps adjacent schedule and issues full width when daily is hidden', async () => {
		const view = await mount();
		view.props.cardsV3 = normalizeHatagoesCardsV3(undefined).map(card => ({ ...card, hidden: card.id !== 'schedule' && card.id !== 'issues' }));
		view.target.querySelector<HTMLButtonElement>('[aria-label="配置プレビューの画面幅"] button:last-child')?.click();
		await nextTick();
		const preview = view.target.querySelector('[aria-label="現在のホームの並び"]')!;
		expect([...preview.querySelectorAll<HTMLElement>('[data-card]')].map(card => card.dataset.card)).toEqual(['schedule', 'issues']);
		expect(preview.getAttribute('data-half-pair')).toBe('false');
		expect(preview.getAttribute('data-flower-pair')).toBe('false');
	});

	test('pairs only adjacent flower and reading cards in the mobile fallback', async () => {
		const view = await mount();
		view.props.cardsV3 = normalizeHatagoesCardsV3([{ id: 'flower' }, { id: 'reading' }, { id: 'daily', hidden: true }]);
		view.target.querySelector<HTMLButtonElement>('[aria-label="配置プレビューの画面幅"] button:last-child')?.click();
		await nextTick();
		const preview = view.target.querySelector('[aria-label="現在のホームの並び"]')!;
		expect(preview.getAttribute('data-flower-pair')).toBe('true');
		expect(preview.getAttribute('data-half-pair')).toBe('false');
		view.props.cardsV3 = normalizeHatagoesCardsV3([{ id: 'flower' }, { id: 'mood' }, { id: 'reading' }, { id: 'daily', hidden: true }]);
		await nextTick();
		expect(preview.getAttribute('data-flower-pair')).toBe('false');
		view.props.cardsV3 = normalizeHatagoesCardsV3([{ id: 'flower' }, { id: 'reading', hidden: true }, { id: 'daily', hidden: true }]);
		await nextTick();
		expect(preview.getAttribute('data-flower-pair')).toBe('false');
	});

	test('filters retired cards passed by an older caller without changing props or emitting a save', async () => {
		const view = await mount();
		const legacy = [{ id: 'feed', hidden: false }, { id: 'reading', hidden: true }, { id: 'history', hidden: false }, { id: 'daily', hidden: false }];
		view.props.cardsV3 = legacy as HatagoesCardV3[];
		await nextTick();
		expect(view.target.querySelector('[data-card="history"]')).toBeNull();
		expect(view.target.querySelector('[data-card="feed"]')).toBeNull();
		expect(view.target.querySelector('[aria-label="読みかけを表示"]')?.getAttribute('type')).toBe('checkbox');
		expect(view.props.cardsV3).toEqual(legacy);
		expect(view.save).not.toHaveBeenCalled();
	});

	test('starts with the actual narrow layout and keeps an explicit preview choice', async () => {
		const originalWidth = window.innerWidth;
		Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
		try {
			const view = await mount();
			const mode = view.target.querySelector('[aria-label="配置プレビューの画面幅"]')!;
			expect(mode.querySelector<HTMLButtonElement>('button:last-child')?.getAttribute('aria-pressed')).toBe('true');
			mode.querySelector<HTMLButtonElement>('button:first-child')?.click();
			window.dispatchEvent(new Event('resize'));
			await nextTick();
			expect(mode.querySelector<HTMLButtonElement>('button:first-child')?.getAttribute('aria-pressed')).toBe('true');
		} finally { Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth }); }
	});

	test('drag handle reorders a card, hidden cards can return, and saving locks editing', async () => {
		const view = await mount();
		const flowerHandle = view.target.querySelector<HTMLButtonElement>('[aria-label="おはなをドラッグして並べ替え"]')!;
		flowerHandle.dispatchEvent(new Event('dragstart', { bubbles: true }));
		view.target.querySelector<HTMLElement>('[data-card="schedule"]')?.dispatchEvent(new Event('drop', { bubbles: true }));
		expect((view.save.mock.lastCall?.[1] as HatagoesCardV3[]).map(card => card.id).slice(0, 3)).toEqual(['daily', 'flower', 'schedule']);
		view.props.cardsV3 = view.props.cardsV3.map(card => card.id === 'mood' ? { ...card, hidden: true } : card);
		await nextTick();
		expect(view.target.querySelector('[data-card="mood"]')).toBeNull();
		view.target.querySelector<HTMLInputElement>('[aria-label="いまのきもちを表示"]')?.click();
		expect(view.save).toHaveBeenLastCalledWith('cardsV3', expect.arrayContaining([expect.objectContaining({ id: 'mood', hidden: false })]));
		view.props.saving = true;
		await nextTick();
		const calls = view.save.mock.calls.length;
		expect(flowerHandle.disabled).toBe(true);
		view.target.querySelector<HTMLButtonElement>('[aria-label="おはなを前へ"]')?.click();
		expect(view.save).toHaveBeenCalledTimes(calls);
	});

	test('shows source, insertion target and a trail during drag without saving until drop', async () => {
		const view = await mount();
		const handle = view.target.querySelector<HTMLButtonElement>('[aria-label="おはなをドラッグして並べ替え"]')!;
		const source = view.target.querySelector<HTMLElement>('[data-card="flower"]')!;
		const target = view.target.querySelector<HTMLElement>('[data-card="schedule"]')!;
		handle.dispatchEvent(new Event('dragstart', { bubbles: true }));
		target.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
		await nextTick();
		expect(source.className).toContain('dragSource');
		expect(target.className).toContain('dragTarget');
		expect(view.target.textContent).toContain('「おはな」を「いま」の前へ');
		expect(view.target.querySelector('svg[class*="dragTrail"] path[d^="M "]')).not.toBeNull();
		expect(view.save).not.toHaveBeenCalled();
		handle.dispatchEvent(new Event('dragend', { bubbles: true }));
		await nextTick();
		expect(view.target.querySelector('svg[class*="dragTrail"]')).toBeNull();
		expect(target.className).not.toContain('dragTarget');
		expect(view.save).not.toHaveBeenCalled();
		handle.dispatchEvent(new Event('dragstart', { bubbles: true }));
		target.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
		target.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
		expect((view.save.mock.lastCall?.[1] as HatagoesCardV3[]).map(card => card.id).slice(0, 3)).toEqual(['daily', 'flower', 'schedule']);
	});

	test('resets only card order and preserves hidden cards, guarded by readiness', async () => {
		const view = await mount();
		const reset = view.target.querySelector<HTMLButtonElement>('button[class*="resetOrder"]')!;
		expect(reset.disabled).toBe(true);
		view.props.cardsV3 = [
			{ id: 'flower', hidden: true },
			...view.props.cardsV3.filter(card => card.id !== 'flower').map(card => card.id === 'issues' ? { ...card, hidden: true } : card),
		];
		await nextTick();
		expect(reset.disabled).toBe(false);
		reset.click();
		const saved = view.save.mock.lastCall?.[1] as HatagoesCardV3[];
		expect(saved.map(card => card.id)).toEqual(normalizeHatagoesCardsV3(undefined).map(card => card.id));
		expect(saved.find(card => card.id === 'flower')?.hidden).toBe(true);
		expect(saved.find(card => card.id === 'issues')?.hidden).toBe(true);
		expect(view.target.textContent).toContain('表示・非表示はそのままです。');
		view.props.saving = true;
		await nextTick();
		const calls = view.save.mock.calls.length;
		reset.click();
		expect(view.save).toHaveBeenCalledTimes(calls);
	});

	test('searches common and app settings and hides HataFeed when unavailable', async () => {
		const view = await mount();
		expect(view.target.textContent).toContain('ホームのカード（8件）');
		expect(view.target.textContent).not.toContain('先週のきょう');
		expect(view.target.textContent).not.toContain('みんなのきょう');
		expect([...view.target.querySelectorAll('section button')].some(button => button.textContent === 'HataFeed')).toBe(false);
		search(view.target, 'Hatady');
		await nextTick();
		expect(view.target.textContent).toContain('Hatadyの管理');
		const hatady = [...view.target.querySelectorAll<HTMLButtonElement>('section button')].find(button => button.textContent === 'Hatady');
		hatady?.click();
		expect(view.appSettings).toHaveBeenCalledExactlyOnceWith('hatady');
		search(view.target, 'Appピン');
		await nextTick();
		await vi.waitFor(() => expect(view.target.querySelectorAll('section[aria-label="ホーム専用テーマ"]')).toHaveLength(0));
		const edit = [...view.target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('＋メニューの項目を編集'));
		edit?.click();
		expect(view.editAppPins).toHaveBeenCalledOnce();
		search(view.target, '存在しない設定');
		await nextTick();
		expect(view.target.textContent).toContain('一致する設定はありません。');
	});

	test('opens real app sections and existing account and notification routes from search', async () => {
		const view = await mount();
		search(view.target, '週の始まり');
		await nextTick();
		const calendar = [...view.target.querySelectorAll<HTMLButtonElement>('[aria-label="設定の検索結果"] button')].find(button => button.textContent?.includes('カレンダー'));
		calendar?.click();
		expect(view.appSettings).toHaveBeenCalledWith('hatask', 'calendar');
		search(view.target, 'プロフィール');
		await nextTick();
		const profile = [...view.target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('プロフィールとアカウント設定'));
		profile?.click();
		expect(view.navigate).toHaveBeenCalledWith('/settings/profile');
		search(view.target, '通知設定');
		await nextTick();
		const notifications = [...view.target.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('アカウント全体の通知配信'));
		notifications?.click();
		expect(view.navigate).toHaveBeenCalledWith('/settings/notifications');
		expect(view.target.textContent).toContain('Hatady・HataFeed の通知一覧は各アプリから確認できます。');
	});

	test('uses the live dark mode for automatic theme previews', async () => {
		const view = await mount(true);
		expect(view.target.querySelector('[data-preview="akatsuki"]')?.getAttribute('data-mode')).toBe('dark');
		view.props.theme.autoTheme = false;
		await nextTick();
		expect(view.target.querySelector('[data-preview="akatsuki"]')?.getAttribute('data-mode')).toBe('light');
		expect([...view.target.querySelectorAll('section button')].some(button => button.textContent === 'HataFeed')).toBe(true);
	});
});
