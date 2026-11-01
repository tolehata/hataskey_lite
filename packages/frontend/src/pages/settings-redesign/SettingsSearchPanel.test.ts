/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick, reactive } from 'vue';
import type { App } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import panelSource from './SettingsSearchPanel.vue?raw';

const layerMocks = vi.hoisted(() => ({ claimZIndex: vi.fn() }));
vi.mock('@/os.js', () => ({ claimZIndex: layerMocks.claimZIndex }));

const workerMocks = vi.hoisted(() => {
	type Message = { type: string; catalogRevision: number; queryRevision?: number; query?: string };
	const instances: MockSearchWorker[] = [];
	const state = { throwOnCreate: false };
	class MockSearchWorker {
		public onmessage: ((event: MessageEvent) => void) | null = null;
		public onerror: ((event: Event) => void) | null = null;
		public terminated = false;
		public readonly messages: Message[] = [];
		public autoInitialize = true;

		constructor() {
			if (state.throwOnCreate) throw new Error('Worker is unavailable');
			instances.push(this);
		}

		postMessage(message: Message) {
			this.messages.push(message);
			if (message.type === 'initialize' && this.autoInitialize) {
				void Promise.resolve().then(() => this.onmessage?.({ data: { type: 'initialized', catalogRevision: message.catalogRevision } } as MessageEvent));
			}
		}

		terminate() {
			this.terminated = true;
		}

		respond(query: Message, labels: string | string[], totalResults = Array.isArray(labels) ? labels.length : 1) {
			const resultLabels = Array.isArray(labels) ? labels : [labels];
			this.onmessage?.({ data: {
				type: 'result',
				catalogRevision: query.catalogRevision,
				queryRevision: query.queryRevision,
				response: {
					normalizedQuery: query.query ?? '',
					totalResults,
					results: resultLabels.map(label => ({ stableId: `settings.control.${label}`, route: '/settings/preferences', controlId: `settings.control.${label}`, activation: { kind: 'popup', category: 'glassUi', popup: 'hatasaba-ui2' }, label, categoryLabel: '表示', aliases: [], legacyLabels: [], preferenceKeys: [], relatedIds: [], related: [], source: 'control', searchable: true, searchRank: 0, score: 1000, matchKind: 'labelExact' })),
					suggestions: [],
				},
			} } as MessageEvent);
		}
	}
	return { instances, state, MockSearchWorker };
});

vi.mock('@/workers/settings-search-v2?worker', () => ({ default: workerMocks.MockSearchWorker }));
vi.mock('@/preferences.js', () => ({ prefer: { r: { animation: { value: true } } } }));
vi.mock('@/i18n.js', async () => {
	const fs = await import('node:fs');
	const path = await import('node:path');
	const yaml = await import('js-yaml');
	const { I18n } = await import('@@/js/i18n.js');
	const locale = yaml.load(fs.readFileSync(path.resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8'));
	return { i18n: new I18n(locale as any) };
});

import SettingsSearchPanel from './SettingsSearchPanel.vue';
import type { SettingsSearchCloseEvent } from './SettingsSearchPanel.vue';
import { buildSettingsCatalogV2 } from '@/utility/settings-search-v2.js';

type MountedPanel = {
	app: App<Element>;
	container: HTMLDivElement;
	props: { open: boolean; catalog: ReturnType<typeof buildSettingsCatalogV2> | null; catalogState: 'pending' | 'ready' | 'error' };
	closed: SettingsSearchCloseEvent[];
	selected: Array<{ stableId?: string; route: string; anchor?: string; controlId?: string; activation?: unknown }>;
};

const mounted: MountedPanel[] = [];

const fixtureControlMetadata = {
	persistence: 'profile' as const,
	saveMode: 'immediate' as const,
	availability: 'all' as const,
	owner: 'core' as const,
	applicableUi: 'all' as const,
	metadataEvidence: {
		persistence: 'test fixture: profile persistence',
		saveMode: 'test fixture: immediate save',
		availability: 'test fixture: all viewports',
		owner: 'test fixture: core owner',
		applicableUi: 'test fixture: all UI contexts',
	},
};

function catalogFixture() {
	return buildSettingsCatalogV2([], [
		{ stableId: 'settings.control.display', route: '/settings/preferences', label: '表示設定', aliases: ['表示'], preferenceKeys: ['display.note'], sourceFile: 'preferences.vue', sourceLine: 1, relatedHostId: 'settings-search-panel-fixture', destructive: false, ...fixtureControlMetadata },
		{ stableId: 'settings.control.display-detail', route: '/settings/preferences', label: '表示の詳細', aliases: ['表示'], preferenceKeys: ['display.note'], sourceFile: 'preferences.vue', sourceLine: 2, relatedHostId: 'settings-search-panel-fixture', destructive: false, ...fixtureControlMetadata },
	]);
}

function mountPanel(): MountedPanel {
	const props = reactive({ open: true, catalog: catalogFixture(), catalogState: 'ready' as const });
	const closed: SettingsSearchCloseEvent[] = [];
	const selected: MountedPanel['selected'] = [];
	const app = createApp(defineComponent({
		setup() {
			return () => h(SettingsSearchPanel, {
				...props,
				onClose: (event: SettingsSearchCloseEvent) => closed.push(event),
				onSelect: (item: MountedPanel['selected'][number]) => selected.push(item),
			});
		},
	}));
	const container = window.document.createElement('div');
	window.document.body.appendChild(container);
	app.mount(container);
	const result = { app, container, props, closed, selected };
	mounted.push(result);
	return result;
}

async function flush() {
	await Promise.resolve();
	await nextTick();
	await Promise.resolve();
}

function input(): HTMLInputElement {
	const element = Array.from(window.document.querySelectorAll<HTMLInputElement>('input[aria-label="設定を検索"]')).at(-1);
	if (element == null) throw new Error('検索入力欄が見つかりません');
	return element;
}

function enterQuery(value: string) {
	const element = input();
	element.value = value;
	element.dispatchEvent(new Event('input', { bubbles: true }));
}

function latestQuery() {
	const worker = workerMocks.instances.at(-1);
	const message = worker?.messages.filter(item => item.type === 'search').at(-1);
	if (worker == null || message == null) throw new Error('検索worker requestが見つかりません');
	return { worker, message };
}

beforeEach(() => {
	vi.useFakeTimers();
	layerMocks.claimZIndex.mockReset().mockReturnValue(2000100);
	workerMocks.instances.splice(0);
	workerMocks.state.throwOnCreate = false;
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
	});
});

afterEach(() => {
	for (const item of mounted.splice(0)) {
		item.app.unmount();
		item.container.remove();
	}
	window.document.querySelectorAll('[data-settings-search-overlay]').forEach(element => element.remove());
	vi.useRealTimers();
});

describe('SettingsSearchPanel', () => {
	test('検索を開くたびにウィンドウより手前のポップアップ層を取得して適用する', async () => {
		const panel = mountPanel();
		await flush();
		const overlay = () => window.document.querySelector<HTMLElement>('[data-settings-search-overlay]');
		expect(layerMocks.claimZIndex).toHaveBeenLastCalledWith('middle');
		expect(overlay()?.style.zIndex).toBe('2000100');
		expect(overlay()?.parentElement).toBe(window.document.body);

		panel.props.open = false;
		await flush();
		expect(layerMocks.claimZIndex).toHaveBeenCalledTimes(1);
		// A window can acquire a newer layer while the search panel is closed.
		layerMocks.claimZIndex.mockReturnValueOnce(2000900);
		panel.props.open = true;
		await flush();
		expect(layerMocks.claimZIndex).toHaveBeenCalledTimes(2);
		expect(layerMocks.claimZIndex).toHaveBeenLastCalledWith('middle');
		expect(overlay()?.style.zIndex).toBe('2000900');
	});

	test('Tab focus trap declares its focusable collection exactly once', () => {
		expect(panelSource.match(/const focusables = Array\.from\(/gu)).toHaveLength(1);
	});

	test('モーダル背景はぼかさず、候補は44px以上の省略可能な横並びを維持する', () => {
		expect(panelSource).not.toContain('backdrop-filter');
		expect(panelSource).toContain('overscroll-behavior: contain;');
		expect(panelSource).toContain('min-height: 44px');
		expect(panelSource).toContain('white-space: nowrap');
		expect(panelSource).toContain('text-overflow: ellipsis');
		expect(panelSource).toContain('&[aria-selected=\'true\']:hover');
		expect(panelSource).toContain('min-height: clamp(96px, 18dvh, 136px);');
		expect(panelSource).not.toContain('min-height: 188px');
	});

	test('実際のworker未完了時だけ150ms後に検索中を表示し、完了で消す', async () => {
		mountPanel();
		await flush();
		enterQuery('表示');
		await flush();
		const { worker, message } = latestQuery();
		await vi.advanceTimersByTimeAsync(149);
		expect(window.document.body.textContent).not.toContain('検索中');
		expect(window.document.querySelector('[aria-live="polite"]')?.textContent).toBe('');
		await vi.advanceTimersByTimeAsync(1);
		expect(window.document.body.textContent).toContain('検索中');
		expect(window.document.querySelector('[aria-live="polite"]')?.textContent).toBe('設定を検索中');
		worker.respond(message, '新しい結果');
		await flush();
		expect(window.document.querySelector('[aria-live="polite"]')?.textContent).toBe('1件の設定と0件の候補');
		await vi.advanceTimersByTimeAsync(160);
		expect(window.document.body.textContent).not.toContain('検索中');
		expect(window.document.body.textContent).toContain('新しい結果');
	});

	test('worker request直後はneutralに保ち、current revisionの空応答後だけ一致なしを通知する', async () => {
		mountPanel();
		await flush();
		enterQuery('表示');
		await flush();
		const { worker, message } = latestQuery();

		// The request is already pending, but the delayed progress affordance must
		// not flash an empty-result message or live announcement for a fast query.
		expect(window.document.body.textContent).not.toContain('「表示」に一致する設定は見つかりませんでした');
		expect(window.document.querySelector('[aria-live="polite"]')?.textContent).toBe('');
		expect(window.document.querySelector('[role="option"]')).toBeNull();
		expect(panelSource).toContain('v-else-if="isSearchPending || response == null"');
		expect(panelSource).toContain('.empty, .status, .neutral {');
		expect(panelSource).toContain('min-height: clamp(96px, 18dvh, 136px);');
		expect(panelSource).not.toContain('min-height: 188px');

		await vi.advanceTimersByTimeAsync(149);
		expect(window.document.body.textContent).not.toContain('設定を検索中');
		worker.respond(message, []);
		await flush();
		expect(window.document.body.textContent).toContain('「表示」に一致する設定は見つかりませんでした');
		expect(window.document.querySelector('[aria-live="polite"]')?.textContent).toBe('一致する設定はありません');
	});

	test('古いquery revisionのworker結果を破棄する', async () => {
		mountPanel();
		await flush();
		enterQuery('最初');
		await flush();
		const first = latestQuery();
		await vi.advanceTimersByTimeAsync(149);
		enterQuery('次');
		await flush();
		const second = latestQuery();
		// Revision 1 would reach its delayed announcement now. It must not leak
		// into the newer pending query.
		await vi.advanceTimersByTimeAsync(1);
		expect(window.document.querySelector('[aria-live="polite"]')?.textContent).toBe('');
		first.worker.respond(first.message, '古い結果');
		await flush();
		expect(window.document.body.textContent).not.toContain('古い結果');
		second.worker.respond(second.message, '新しい結果');
		await flush();
		expect(window.document.body.textContent).toContain('新しい結果');
	});

	test('catalog再読込時はworker catalogを再初期化してから検索する', async () => {
		const mountedPanel = mountPanel();
		await flush();
		const worker = workerMocks.instances[0]!;
		expect(worker.messages.filter(message => message.type === 'initialize')).toHaveLength(1);
		mountedPanel.props.catalog = catalogFixture();
		await flush();
		expect(worker.messages.filter(message => message.type === 'initialize')).toHaveLength(2);
	});

	test('close後に同じ検索語で開き直すと、現在のworkerへ再検索を送る', async () => {
		const mountedPanel = mountPanel();
		await flush();
		enterQuery('表示');
		await flush();
		const first = latestQuery();
		mountedPanel.props.open = false;
		await flush();
		mountedPanel.props.open = true;
		await flush();
		const second = latestQuery();
		expect(second.message.queryRevision).toBeGreaterThan(first.message.queryRevision!);
		second.worker.respond(second.message, '開き直し結果');
		await flush();
		expect(window.document.body.textContent).toContain('開き直し結果');
	});

	test('Workerを作れない環境では安全な同期検索へ切り替える', async () => {
		workerMocks.state.throwOnCreate = true;
		mountPanel();
		await flush();
		enterQuery('表示');
		await flush();
		expect(window.document.body.textContent).toContain('表示設定');
		await vi.advanceTimersByTimeAsync(150);
		expect(window.document.body.textContent).not.toContain('設定を検索中');
	});

	test('入力欄のaria・optionのtabindex・キーボード選択を維持し、親の遷移承認まで閉じない', async () => {
		const mountedPanel = mountPanel();
		await flush();
		expect(input().getAttribute('aria-label')).toBe('設定を検索');
		enterQuery('表示');
		await flush();
		const { worker, message } = latestQuery();
		worker.respond(message, ['選択結果A', '選択結果B']);
		await flush();
		const option = window.document.querySelector<HTMLButtonElement>('[role="option"]');
		expect(option?.tabIndex).toBe(-1);
		const arrowDown = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
		input().dispatchEvent(arrowDown);
		await flush();
		expect(arrowDown.defaultPrevented).toBe(true);
		expect(input().getAttribute('aria-activedescendant')).toBe('settings-search-v2-options-0');
		input().dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
		await flush();
		expect(input().getAttribute('aria-activedescendant')).toBe('settings-search-v2-options-1');
		input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
		await flush();
		expect(input().getAttribute('aria-activedescendant')).toBe('settings-search-v2-options-0');
		input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		expect(mountedPanel.selected).toEqual([expect.objectContaining({ stableId: 'settings.control.選択結果A', controlId: 'settings.control.選択結果A', activation: { kind: 'popup', category: 'glassUi', popup: 'hatasaba-ui2' } })]);
		expect(mountedPanel.closed).toEqual([]);
		expect(panelSource).toContain('function select(item: SettingsSearchDescriptor) {\n\temit(\'select\', item);\n}');
		expect(panelSource).toContain('select: [item: Pick<SettingsSearchDescriptor, \'stableId\' | \'route\' | \'anchor\' | \'controlId\' | \'activation\'>]');
	});

	test('件数pillはrelated候補を混ぜず、結果上限前の一致件数を表示する', async () => {
		mountPanel();
		await flush();
		enterQuery('表示');
		await flush();
		const { worker, message } = latestQuery();
		worker.respond(message, '表示結果', 42);
		await flush();
		expect(window.document.body.textContent).toContain('42件');
		expect(window.document.body.textContent).toContain('42件の設定と0件の候補');
		expect(panelSource).toContain('copyx.search.resultCount({ count: response.totalResults })');
		expect(panelSource).toContain('results: response.value?.totalResults ?? 0');
	});

	test('可視ラベルの直接一致だけをmarkし、候補には検索に寄与した公開可能なキーを添える', async () => {
		mountPanel();
		await flush();
		enterQuery('ぼかし');
		await flush();
		const first = latestQuery();
		first.worker.onmessage?.({ data: {
			type: 'result',
			catalogRevision: first.message.catalogRevision,
			queryRevision: first.message.queryRevision,
			response: {
				normalizedQuery: 'ぼかし', totalResults: 1,
				results: [{ stableId: 'settings.control.blur', route: '/settings/preferences', label: '背景ぼかし', categoryLabel: '表示', aliases: ['blur'], preferenceKeys: [], related: [], relatedIds: [], source: 'control', searchable: true, searchRank: 0, score: 900, matchKind: 'labelIncludes' }],
				suggestions: [],
			},
		} } as MessageEvent);
		await flush();
		expect(window.document.querySelector('mark')?.textContent).toBe('ぼかし');

		enterQuery('opacity');
		await flush();
		const second = latestQuery();
		second.worker.onmessage?.({ data: {
			type: 'result',
			catalogRevision: second.message.catalogRevision,
			queryRevision: second.message.queryRevision,
			response: {
				normalizedQuery: 'opacity', totalResults: 1,
				results: [{ stableId: 'settings.control.opacity', route: '/settings/hata-custom', label: '透過率', categoryLabel: 'Hataskey UI', aliases: ['opacity'], preferenceKeys: ['simpleUi.glassUiCardOpacity'], related: [], relatedIds: [], source: 'control', searchable: true, searchRank: 0, score: 750, matchKind: 'alias' }],
				suggestions: [{ stableId: 'settings.control.opacity-related', route: '/settings/hata-custom', label: 'カードの透過率', categoryLabel: 'Hataskey UI', aliases: [], preferenceKeys: ['simpleUi.glassUiCardOpacity'], related: [], relatedIds: [], source: 'control', searchable: true, searchRank: 0, score: 650, matchKind: 'related' }],
			},
		} } as MessageEvent);
		await flush();
		expect(window.document.querySelector<HTMLElement>('code')?.textContent).toBe('simpleUi.glassUiCardOpacity');

		enterQuery('opacity');
		await flush();
		const third = latestQuery();
		third.worker.onmessage?.({ data: {
			type: 'result',
			catalogRevision: third.message.catalogRevision,
			queryRevision: third.message.queryRevision,
			response: {
				normalizedQuery: 'opacity', totalResults: 1,
				results: [{ stableId: 'settings.control.opacity-safe', route: '/settings/hata-custom', label: '透過率', categoryLabel: 'Hataskey UI', aliases: ['opacity'], preferenceKeys: [], related: [], relatedIds: [], source: 'control', searchable: true, searchRank: 0, score: 750, matchKind: 'alias' }],
				suggestions: [{ stableId: 'settings.control.opacity-local', route: '/settings/hata-custom', label: 'カードの透過率', categoryLabel: 'Hataskey UI', aliases: ['editor.draft.editedOpacity'], preferenceKeys: [], related: [], relatedIds: [], source: 'control', searchable: true, searchRank: 0, score: 650, matchKind: 'related' }],
			},
		} } as MessageEvent);
		await flush();
		// The preceding keyed Transition may still retain its leaving suggestion
		// for the motion duration.  Assert the public boundary itself rather than
		// mistaking that prior, valid preference key for the current suggestion.
		const visibleEvidence = [...window.document.querySelectorAll('code')].map(element => element.textContent ?? '');
		expect(visibleEvidence).not.toContain('editor.draft.editedOpacity');
		expect(visibleEvidence.every(value => !/(?:^|[._])(draft|edited|value)(?:[._]|$)/iu.test(value))).toBe(true);
		expect(panelSource).toContain('function labelParts(label: string)');
		expect(panelSource).toContain('function searchEvidence(item: SettingsSearchDescriptor)');
		expect(panelSource).toContain('!/(?:^|[._])(draft|edited|value)(?:[._]|$)/iu.test(value)');
		expect(panelSource).not.toContain('v-html');
	});

	test('controlのカテゴリには意味別iconを補い、legacy固有iconを優先する', async () => {
		mountPanel();
		await flush();
		enterQuery('テーマ');
		await flush();
		const { worker, message } = latestQuery();
		worker.onmessage?.({ data: {
			type: 'result',
			catalogRevision: message.catalogRevision,
			queryRevision: message.queryRevision,
			response: {
				normalizedQuery: 'テーマ', totalResults: 2,
				results: [
					{ stableId: 'settings.control.theme', route: '/settings/theme', label: 'テーマ', categoryId: 'theme-font', categoryLabel: 'テーマ・フォント', aliases: [], preferenceKeys: [], related: [], relatedIds: [], source: 'control', searchable: true, searchRank: 0, score: 900, matchKind: 'labelExact' },
					{ stableId: 'settings.legacy.theme', route: '/settings/theme', label: '旧テーマ', icon: 'ti ti-brush', categoryId: 'theme-font', categoryLabel: 'テーマ・フォント', aliases: [], preferenceKeys: [], related: [], relatedIds: [], source: 'legacy', searchable: true, searchRank: 0, score: 850, matchKind: 'labelIncludes' },
				],
				suggestions: [],
			},
		} } as MessageEvent);
		await flush();
		const icons = [...window.document.querySelectorAll<HTMLElement>('[role="option"] span:first-child > i')];
		expect(icons[0]?.className).toContain('ti-palette');
		expect(icons[1]?.className).toContain('ti-brush');
		expect(panelSource).toContain('\'theme-font\': \'ti ti-palette\'');
		expect(panelSource).toContain('function resultIcon(item: SettingsSearchDescriptor)');
	});

	test('combobox以外のbuttonはactive resultのEnter/Home/Endを奪われない', async () => {
		const mountedPanel = mountPanel();
		await flush();
		enterQuery('表示');
		await flush();
		const { worker, message } = latestQuery();
		worker.respond(message, '選択結果');
		await flush();
		input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
		await flush();
		const closeButton = window.document.querySelector<HTMLButtonElement>('button[aria-label="検索を閉じる"]')!;
		closeButton.focus();
		closeButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
		closeButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await flush();
		expect(mountedPanel.selected).toEqual([]);
		expect(mountedPanel.closed).toEqual([]);
		expect(panelSource).toContain('if (event.target === inputEl.value) onKeydown(event);');
	});

	test('Tabはpanel内を通常移動し、先頭/末尾だけを閉じる。Escapeはorigin復帰用理由を渡す', async () => {
		const mountedPanel = mountPanel();
		await flush();
		const closeButton = window.document.querySelector<HTMLButtonElement>('button[aria-label="検索を閉じる"]')!;
		input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
		closeButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
		expect(mountedPanel.closed).toEqual([]);
		closeButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
		input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
		input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(mountedPanel.closed).toEqual([
			{ reason: 'tab', direction: 'next' },
			{ reason: 'tab', direction: 'previous' },
			{ reason: 'escape' },
		]);
		const worker = workerMocks.instances[0]!;
		mountedPanel.app.unmount();
		expect(worker.terminated).toBe(true);
	});

	test('backdropと閉じるボタンも親がorigin focusへ戻すための理由を渡す', async () => {
		const mountedPanel = mountPanel();
		await flush();
		window.document.querySelector<HTMLElement>('[data-settings-search-overlay]')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		window.document.querySelector<HTMLButtonElement>('button[aria-label="検索を閉じる"]')?.click();
		expect(mountedPanel.closed).toEqual([{ reason: 'backdrop' }, { reason: 'button' }]);
	});
});
