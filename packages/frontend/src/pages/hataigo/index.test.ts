// SPDX-FileCopyrightText: Tolehata and hatasaba-project
// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, expect, it, vi } from 'vitest';
 
import { createApp, h, nextTick, ref } from 'vue';
import Index from './index.vue';

const popupSpy = vi.hoisted(() => vi.fn(() => ({ dispose: () => {} })));
vi.mock('@/store.js', () => ({ store: { r: { darkMode: { value: false } } } }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/os.js', () => ({ popup: popupSpy }));
const routerPush = vi.hoisted(() => vi.fn());
vi.mock('@/router.js', () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock('@/utility/hataigo/prefs.js', async () => {
	const { ref: makeRef } = await import('vue');
	return { useHataigoPrefs: () => ({ error: makeRef(null) }) };
});
vi.mock('@/components/HyNav.vue', async () => {
	const { defineComponent: makeComponent, h: makeNode } = await import('vue');
	return { default: makeComponent({
		props: { modelValue: { type: String, required: true }, options: { type: Array, required: true } }, emits: ['update:modelValue'],
		setup(props, { emit }) {
			return () => makeNode('nav', (props.options as { value: string; label: string }[]).map(option => makeNode('button', { onClick: () => emit('update:modelValue', option.value) }, option.label)));
		},
	}) };
});
vi.mock('@/components/hataigo/HataigoRewards.vue', async () => {
	const { defineComponent: makeComponent, h: makeNode } = await import('vue');
	return { default: makeComponent({ props: { active: Boolean, refreshKey: Number }, setup(props) { return () => makeNode('output', { 'data-reward-active': String(props.active), 'data-refresh-key': props.refreshKey }); } }) };
});
vi.mock('@/components/hataigo/HataigoInfo.vue', async () => {
	const { defineComponent: makeComponent, h: makeNode } = await import('vue');
	return { default: makeComponent({ setup() { return () => makeNode('aside', { 'data-info': '' }, 'HataIgo info'); } }) };
});
vi.mock('@/components/hataigo/HataigoSettings.vue', async () => {
	const { defineComponent: makeComponent, h: makeNode } = await import('vue');
	return { default: makeComponent({ setup() { return () => makeNode('aside', { 'data-settings': '' }, 'HataIgo settings'); } }) };
});
vi.mock('./home.vue', async () => {
	const { defineComponent: makeComponent, h: makeNode } = await import('vue');
	return { default: makeComponent({ emits: ['play', 'ai', 'online', 'open', 'navigate'], setup(_, { emit }) {
		return () => makeNode('section', [
			makeNode('button', { onClick: () => emit('play', 9) }, '9路で始める'),
			makeNode('button', { onClick: () => emit('ai', 9) }, 'AIで始める'),
			makeNode('button', { onClick: () => emit('online', 9) }, 'オンライン対局'),
		]); 
	} }) };
});
vi.mock('./collection.vue', () => ({ default: { render: () => null } }));
vi.mock('./history.vue', async () => {
	const { defineComponent: makeComponent, h: makeNode } = await import('vue');
	return { default: makeComponent({ props: { active: Boolean }, emits: ['replay', 'open'], setup(_, { emit }) {
		return () => makeNode('section', [
			makeNode('button', { onClick: () => emit('replay', { id: 'record-1', sgf: '(;SZ[9])' }) }, 'replay-record'),
			makeNode('button', { onClick: () => emit('open', 'history-game') }, 'open-history-game'),
		]); 
	} }) };
});
vi.mock('./lobby.vue', async () => {
	const { defineComponent: makeComponent, h: makeNode } = await import('vue');
	return { default: makeComponent({ props: { initialSize: Number, active: Boolean, embedded: Boolean }, emits: ['open'], setup(_, { emit }) { return () => makeNode('button', { 'data-lobby': '', onClick: () => emit('open', 'lobby-game') }, 'ロビーの対局'); } }) };
});
vi.mock('./online-game.vue', async () => {
	const { defineComponent: makeComponent, h: makeNode } = await import('vue');
	return { default: makeComponent({ props: { gameId: { type: String, required: true }, active: Boolean, embedded: Boolean }, emits: ['finished', 'exit'], setup(props, { emit }) { return () => makeNode('button', { 'data-online-game': props.gameId, onClick: () => emit('finished') }, `online:${props.gameId}:finish`); } }) };
});
vi.mock('./ai-game.vue', async () => {
	const { defineComponent: makeComponent, h: makeNode } = await import('vue');
	return { default: makeComponent({ props: { initialSize: Number, active: Boolean, embedded: Boolean }, emits: ['finished'], setup(props, { emit }) { return () => makeNode('button', { 'data-ai-game': props.initialSize, onClick: () => emit('finished') }, `AI:${props.initialSize}:finish`); } }) };
});
vi.mock('./analysis.vue', async () => {
	const { defineComponent: makeComponent, h: makeNode, ref: makeRef } = await import('vue');
	return { default: makeComponent({
		props: { mode: { type: String, required: true }, initialSize: { type: Number, required: true }, active: Boolean, replayRequest: Object },
		setup(props) {
			const moves = makeRef(0);
			return () => makeNode('button', { 'data-analysis': props.mode, 'data-replay-id': (props.replayRequest as { id?: string } | undefined)?.id, onClick: () => moves.value++ }, `${props.initialSize}路:${moves.value}手`);
		},
	}) };
});

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

function mountIndex(options: { embedded?: boolean; paneActive?: boolean; gameId?: string } = {}) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const gameId = ref(options.gameId);
	const app = createApp({ render: () => h(Index, { embedded: options.embedded, paneActive: options.paneActive, gameId: gameId.value }) });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	return { host, setGameId: (value: string | undefined) => { gameId.value = value; } };
}

async function settle(): Promise<void> { await nextTick(); await Promise.resolve(); await nextTick(); }

async function click(host: HTMLElement, text: string): Promise<void> {
	const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent === text);
	if (!button) throw new Error(`Missing button: ${text}`);
	button.click();
	await settle();
}

it('keeps the unsaved solo record while visiting another tab and isolates replay state', async () => {
	const { host } = mountIndex();
	await click(host, '9路で始める');
	await click(host, '9路:0手');
	await click(host, '9路:1手');
	await click(host, '棋譜');
	expect(host.querySelector('[data-analysis="replay"]')?.textContent).toBe('9路:0手');
	await click(host, 'ホーム');
	await click(host, '対局');
	expect(host.querySelector('[data-analysis="solo"]')?.textContent).toBe('9路:2手');
});

it('keeps how-to, privacy and source behind one info button and settings behind the gear', async () => {
	const { host } = mountIndex();
	popupSpy.mockClear();
	const info = (await import('@/components/hataigo/HataigoInfo.vue')).default;
	const settings = (await import('@/components/hataigo/HataigoSettings.vue')).default;
	// ペインの中ではなく os.popup でルートに出す（HataGoes のヘッダーに隠れないように）
	expect(host.querySelector('[data-info], [data-settings]')).toBeNull();
	host.querySelector<HTMLButtonElement>('button[aria-label="遊び方・公開範囲・ソースコード"]')?.click();
	await settle();
	expect(popupSpy).toHaveBeenLastCalledWith(info, {}, expect.objectContaining({ closed: expect.any(Function) }));
	host.querySelector<HTMLButtonElement>('button[aria-label="盤と石の設定"]')?.click();
	await settle();
	expect(popupSpy).toHaveBeenLastCalledWith(settings, {}, expect.objectContaining({ closed: expect.any(Function) }));
	expect(popupSpy).toHaveBeenCalledTimes(2);
});

it('offers an exit button only when opened on its own, and it goes back to the top', () => {
	const standalone = mountIndex();
	standalone.host.querySelector<HTMLButtonElement>('button[aria-label="HataIgo を終了"]')?.click();
	expect(routerPush).toHaveBeenCalledExactlyOnceWith('/');
	const embedded = mountIndex({ embedded: true });
	expect(embedded.host.querySelector('button[aria-label="HataIgo を終了"]')).toBeNull();
});

it('keeps its own tabs and tools when HataGoes shows it in a pane', () => {
	const { host } = mountIndex({ embedded: true });
	expect(host.querySelector('nav, [aria-label="HataIgo"]')).not.toBeNull();
	expect(host.querySelector('button[aria-label="遊び方・公開範囲・ソースコード"]')).not.toBeNull();
	expect(host.querySelector('button[aria-label="盤と石の設定"]')).not.toBeNull();
});

it('opens an online deep link directly and replaces the selected game when the route changes', async () => {
	const { host, setGameId } = mountIndex({ gameId: 'game-one' });
	await settle();
	expect(host.querySelector('[data-online-game="game-one"]')).not.toBeNull();
	setGameId('game-two');
	await settle();
	expect(host.querySelector('[data-online-game="game-two"]')).not.toBeNull();
});

it('shows the history screen and passes an explicit replay request to the replay board', async () => {
	const { host } = mountIndex();
	await click(host, '棋譜');
	expect(host.querySelector('section')).not.toBeNull();
	expect(host.querySelector('[data-analysis="replay"]')?.getAttribute('data-replay-id')).toBeNull();
	await click(host, 'replay-record');
	expect(host.querySelector('[data-analysis="replay"]')?.getAttribute('data-replay-id')).toBe('record-1');
});

it('refreshes rewards after AI and online completions', async () => {
	const { host } = mountIndex();
	const refreshKey = () => host.querySelector('[data-refresh-key]')?.getAttribute('data-refresh-key');
	await click(host, 'AIで始める');
	await click(host, 'AI:9:finish');
	expect(refreshKey()).toBe('1');
	await click(host, 'ホーム');
	await click(host, 'オンライン対局');
	await click(host, 'ロビーの対局');
	await click(host, 'online:lobby-game:finish');
	expect(refreshKey()).toBe('2');
});
