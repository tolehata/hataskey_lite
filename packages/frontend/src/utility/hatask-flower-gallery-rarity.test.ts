/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { findHataskFlora, floraData, generateFlowerNickname, isRareHataskFlower, localizeFloraName, nameAdjectives } from './hatask-flora.js';

const api = vi.hoisted(() => vi.fn());
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));

const page = readFileSync(`${process.cwd()}/src/pages/hatask.vue`, 'utf8');
const care = readFileSync(`${process.cwd()}/src/components/hatask/HataskFlowerCare.vue`, 'utf8');
const pageScript = page.match(/<script lang="ts" setup>([\s\S]*?)<\/script>/u)![1];
const careScript = care.match(/<script setup lang="ts">([\s\S]*?)<\/script>/u)![1];

// Run the actual component/page handlers while replacing only state and API boundaries.
function handler(source: string, name: string, bindings: Record<string, unknown>): (...args: unknown[]) => Promise<unknown> {
	const ast = ts.createSourceFile(`${name}.ts`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
	if (!declaration) throw new Error(`Missing handler: ${name}`);
	const code = ts.transpileModule(declaration.getText(ast).replace('await import(\'@/components/MkDialog.vue\').then(module => module.default)', 'await loadInputDialog()'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
	return new Function(...Object.keys(bindings), `${code}; return ${name};`)(...Object.values(bindings));
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
	return { promise, resolve, reject };
}

function careFixture() {
	const original = { id: 'flower-1', name: '流星花', emoji: '☄️', rare: true, speciesId: 'meteor', rank: 3, memory: ['本を読んだ'], progress: 100 };
	const state = { value: { flower: original, zukan: { catalog: [] } } };
	const bloomFlower = { value: null as Record<string, unknown> | null };
	const busy = { value: false }, bloom = { value: false };
	const bloomDialog = { value: { close: vi.fn() } };
	const harvestHataskFlower = vi.fn(), receive = vi.fn(), emit = vi.fn(), notify = vi.fn();
	const bindings = { state, bloomFlower, busy, bloom, bloomDialog, harvestHataskFlower, receive, emit, notify,
		active: true, lastBloomId: '', meaning: { value: '希望' }, nextTick: () => Promise.resolve(), copy: { harvested: '収穫', harvestFailed: '失敗' }, generateFlowerNickname };
	return { ...bindings, original, open: handler(careScript, 'openBloom', bindings), harvest: handler(careScript, 'harvest', bindings) };
}

function inputFixture(activeTab = { value: 'garden' }) {
	let events: { done: (result: { canceled: boolean; result?: string }) => void; closed: () => void } | undefined;
	const dispose = vi.fn(), loadInputDialog = vi.fn().mockResolvedValue({});
	const popup = vi.fn((_component: unknown, _props: unknown, handlers: NonNullable<typeof events>) => { events = handlers; return { dispose }; });
	return { activeTab, dispose, loadInputDialog, popup,
		input: handler(pageScript, 'inputFlowerName', { activeTab, hataskPageActive: true, loadInputDialog, popup }),
		finish() { if (!events) throw new Error('Flower name dialog did not open'); events.done({ canceled: false, result: '窓辺のお花' }); events.closed(); } };
}

const nameInputProps = { title: '収穫', text: '名前', default: 'お花', minLength: 1, maxLength: 80 };
beforeEach(() => { api.mockReset(); vi.resetModules(); });

describe('Hatask current flower harvest and rarity integration', () => {
	test('満開の花だけが収穫画面を開き、品種・レア・思い出を入力画面へ渡す', async () => {
		const f = careFixture();
		f.state.value.flower.progress = 99;
		await f.open();
		expect(f.bloom.value).toBe(false);
		f.state.value.flower.progress = 100;
		await f.open();
		expect(f.bloom.value).toBe(true);
		expect(f.bloomFlower.value).toMatchObject({ id: 'flower-1', speciesId: 'meteor', rare: true, rank: 3, memory: ['本を読んだ'], meaning: '希望' });
		// 旗鯖fork: 名前欄には「上フレーズ＋品種名」が自動で入る。
		const nickname = String(f.bloomFlower.value?.nickname);
		expect(nameAdjectives.some(prefix => nickname === `${prefix}流星花`)).toBe(true);
		expect(care).toContain('@click="openBloom"');
	});

	test('名前と花IDを現行保存APIへ渡し、応答の品種情報をそのまま採用する', async () => {
		const f = careFixture();
		await f.open();
		const saved = { flower: { id: 'next-flower' }, zukan: { entries: [{ speciesId: 'meteor', nickname: '窓辺のお花', rare: true, rank: 3, memory: ['本を読んだ'] }] } };
		f.harvestHataskFlower.mockResolvedValue(saved);
		await f.harvest('  窓辺のお花  ');
		expect(f.harvestHataskFlower).toHaveBeenCalledExactlyOnceWith('flower-1', '窓辺のお花');
		expect(f.receive).toHaveBeenCalledExactlyOnceWith(saved);
		expect(f.emit).toHaveBeenCalledWith('harvested', saved);
		expect(f.bloomDialog.value.close).toHaveBeenCalledOnce();
	});

	test('名前が空なら元の名前で保存し、失敗時は育成中の花を保持する', async () => {
		const f = careFixture();
		await f.open();
		f.harvestHataskFlower.mockRejectedValue(new Error('offline'));
		await f.harvest('   ');
		expect(f.harvestHataskFlower).toHaveBeenCalledExactlyOnceWith('flower-1', '流星花');
		expect(f.state.value.flower).toBe(f.original);
		expect(f.receive).not.toHaveBeenCalled();
		expect(f.emit).not.toHaveBeenCalled();
		expect(f.bloomDialog.value.close).not.toHaveBeenCalled();
		expect(f.busy.value).toBe(false);
	});

	test('保存中の二重収穫を止め、元の花IDを送る', async () => {
		const f = careFixture();
		await f.open();
		const pending = deferred<unknown>();
		f.harvestHataskFlower.mockReturnValue(pending.promise);
		const first = f.harvest('一輪目');
		await f.harvest('二輪目');
		f.state.value.flower = { ...f.original, id: 'flower-2' };
		expect(f.harvestHataskFlower).toHaveBeenCalledExactlyOnceWith('flower-1', '一輪目');
		pending.resolve({ flower: { id: 'flower-2' } });
		await first;
	});

	test('保存所有者は古い読取結果で図鑑を戻さない', async () => {
		const { getHataskFlowerState, harvestHataskFlower, HATASK_FLOWER_STATE_EVENT } = await import('./hatask-flower-v2.js');
		const old = deferred<unknown>();
		const saved = { flower: { id: 'next-flower' }, zukan: { entries: [{ speciesId: 'meteor', nickname: '一輪目', rare: true, rank: 3 }] } };
		api.mockReturnValueOnce(old.promise).mockResolvedValueOnce(saved);
		const published: unknown[] = [];
		const listener = (event: Event) => published.push((event as CustomEvent).detail);
		window.addEventListener(HATASK_FLOWER_STATE_EVENT, listener);
		try {
			const read = getHataskFlowerState();
			const result = await harvestHataskFlower('flower-1', '一輪目');
			expect(api).toHaveBeenLastCalledWith('hatask/flowers/harvest', expect.objectContaining({ flowerId: 'flower-1', nickname: '一輪目' }));
			expect(result).toBe(saved);
			old.resolve({ flower: { id: 'flower-1' }, zukan: { entries: [] } });
			expect(await read).toBe(saved);
			expect(published).toEqual([saved]);
		} finally { window.removeEventListener(HATASK_FLOWER_STATE_EVENT, listener); }
	});

	test('保存所有者は収穫中の二重更新を拒否し、失敗時は状態を公開しない', async () => {
		const { harvestHataskFlower, renameHataskFlower, HATASK_FLOWER_STATE_EVENT } = await import('./hatask-flower-v2.js');
		const pending = deferred<unknown>();
		api.mockReturnValueOnce(pending.promise);
		const published: unknown[] = [];
		const listener = (event: Event) => published.push((event as CustomEvent).detail);
		window.addEventListener(HATASK_FLOWER_STATE_EVENT, listener);
		try {
			const first = harvestHataskFlower('flower-1', '一輪目');
			await expect(renameHataskFlower('flower-1', '別名')).rejects.toThrow('already in progress');
			pending.reject(new Error('offline'));
			await expect(first).rejects.toThrow('offline');
			expect(api).toHaveBeenCalledTimes(1);
			expect(published).toEqual([]);
		} finally { window.removeEventListener(HATASK_FLOWER_STATE_EVENT, listener); }
	});

	test.each(['home', 'todo', 'eye'])('%s から旧ギャラリーの名前入力を開かない', async tab => {
		const f = inputFixture({ value: tab });
		await expect(f.input(nameInputProps)).resolves.toEqual({ canceled: true });
		expect(f.loadInputDialog).not.toHaveBeenCalled();
		expect(f.popup).not.toHaveBeenCalled();
	});

	test('旧ギャラリーの名前入力中にタブが変われば取り消す', async () => {
		const loading = inputFixture();
		const beforeOpen = loading.input(nameInputProps);
		loading.activeTab.value = 'home';
		await expect(beforeOpen).resolves.toEqual({ canceled: true });
		expect(loading.popup).not.toHaveBeenCalled();
		const opened = inputFixture();
		const beforeClose = opened.input(nameInputProps);
		await Promise.resolve();
		opened.activeTab.value = 'home';
		opened.finish();
		await expect(beforeClose).resolves.toEqual({ canceled: true });
		expect(opened.dispose).toHaveBeenCalledOnce();
	});

	test('v2改名は花IDをAPIへ渡し、失敗時は元の品種情報を保つ', async () => {
		const original = { id: 'flower-1', name: '流星花', speciesId: 'meteor', rare: true, v2: true };
		const renameHataskFlower = vi.fn().mockRejectedValue(new Error('offline'));
		const applyFlowerState = vi.fn();
		const rename = handler(pageScript, 'renameFlower', { localizeFloraName, inputFlowerName: vi.fn().mockResolvedValue({ canceled: false, result: '窓辺のお花' }), renameHataskFlower, applyFlowerState,
			invalidateCommunityFlowers: vi.fn(), registrySet: vi.fn(), gallery: { value: [] }, syncFlowerGallery: vi.fn(), copy: {} });
		await expect(rename(original)).rejects.toThrow('offline');
		expect(renameHataskFlower).toHaveBeenCalledExactlyOnceWith('flower-1', '窓辺のお花');
		expect(original).toMatchObject({ name: '流星花', speciesId: 'meteor', rare: true });
		expect(applyFlowerState).not.toHaveBeenCalled();
	});

	test('旧ギャラリーの改名は品種IDを保持し、保存失敗でも表示名を戻す', async () => {
		const species = floraData.find(item => item.speciesId != null)!;
		const original = { id: 'legacy', emoji: species.emoji, name: species.name, speciesId: species.speciesId };
		const gallery = { value: [original] };
		const registrySet = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
		const syncFlowerGallery = vi.fn();
		const rename = handler(pageScript, 'renameFlower', { localizeFloraName, inputFlowerName: vi.fn().mockResolvedValue({ canceled: false, result: '窓辺のお花' }), registrySet, gallery, syncFlowerGallery, copy: {} });
		await expect(rename(original)).rejects.toThrow('offline');
		expect(original.name).toBe(species.name);
		await rename(original);
		expect(original).toMatchObject({ name: '窓辺のお花', speciesId: species.speciesId });
		expect(findHataskFlora(original)).toBe(species);
		expect(syncFlowerGallery).toHaveBeenCalledWith([original]);
	});

	test('改名後の旧レア花も品種を誤判定しない', () => {
		expect(isRareHataskFlower({ emoji: '💎', name: '大切な思い出' })).toBe(true);
		expect(isRareHataskFlower({ emoji: '🌼', name: '宝石フラワー' })).toBe(false);
	});
});
