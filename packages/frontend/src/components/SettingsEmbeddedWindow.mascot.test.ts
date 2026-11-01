/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/* eslint-disable vue/one-component-per-file -- Test-only global and popup stubs isolate the real mascot form. */

import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'vue';
import MkMascotSettings from '@/pages/MkMascotSettings.vue';

const mocks = vi.hoisted(() => ({ api: vi.fn(), loadMascot: vi.fn(), toast: vi.fn(), alert: vi.fn(), policies: { canUseMascot: true } }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/utility/drive.js', () => ({ chooseDriveFile: vi.fn() }));
vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
vi.mock('@/os.js', () => ({ toast: mocks.toast, alert: mocks.alert }));
vi.mock('@/i.js', () => ({ $i: { policies: mocks.policies } }));
vi.mock('@/i18n.js', () => ({
	i18n: {
		ts: { 'close': '閉じる', done: '完了', _hata: { _mascotSettings: new Proxy({}, { get: (_, key) => String(key) }) } },
		tsx: { _hata: { _mascotSettings: new Proxy({}, { get: (_, key) => () => String(key) }) } },
	},
}));
vi.mock('@/utility/mascot-store.js', async () => ({
	displaySettings: (await import('vue')).ref({}),
	loadDisplaySettings: vi.fn().mockResolvedValue(undefined),
	saveDisplaySettings: vi.fn(),
	loadMascot: mocks.loadMascot,
}));
vi.mock('@/components/MkModalWindow.vue', async () => ({ default: (await import('vue')).defineComponent({ render: () => null }) }));
vi.mock('@/components/MkMascotImportSelectDialog.vue', async () => ({ default: (await import('vue')).defineComponent({ render: () => null }) }));

const mounted: { app: App; container: HTMLDivElement }[] = [];

function mascotResponse() {
	return {
		consented: true,
		data: {
			activeCharacterId: 'fixture-character',
			showName: true,
			characters: [{ id: 'fixture-character', name: 'キャラクター', expressions: [{ id: 'fixture-expression', label: '通常', url: '/fixture-mascot.png', driveFileId: null }], phrases: [] }],
		},
	};
}

async function settle() {
	for (let i = 0; i < 4; i++) await nextTick();
}

async function mountMascot(response = mascotResponse(), saveResult: Promise<unknown> = Promise.resolve({})) {
	mocks.api.mockImplementation((endpoint: string) => {
		if (endpoint === 'hata/mascot/get') return Promise.resolve(response);
		if (endpoint === 'hata/mascot/update') return saveResult;
		throw new Error(`Unexpected API: ${endpoint}`);
	});
	const onClosed = vi.fn();
	const app = createApp(MkMascotSettings, { embedded: true, onClosed });
	app.component('MkA', defineComponent({ setup: (_, { slots }) => () => h('a', slots.default?.()) }));
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	await settle();
	return { container, onClosed };
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.policies.canUseMascot = true;
});

afterEach(() => {
	for (const { app, container } of mounted.splice(0)) {
		app.unmount();
		container.remove();
	}
});

describe('embedded mascot settings save contract', () => {
	it('実マスコット部品のOKが既存保存APIへ届き、保存中は再操作を防ぐ', async () => {
		let completeSave!: () => void;
		const pendingSave = new Promise<void>(resolve => { completeSave = resolve; });
		const { container, onClosed } = await mountMascot(mascotResponse(), pendingSave);
		const ok = container.querySelector<HTMLButtonElement>('[data-testid="settings-embedded-ok"]');
		expect(ok?.disabled).toBe(false);
		ok?.click();
		await settle();
		expect(mocks.api).toHaveBeenCalledWith('hata/mascot/update', expect.objectContaining({
			activeCharacterId: 'fixture-character',
			showName: true,
			characters: [expect.objectContaining({ id: 'fixture-character', expressions: [expect.objectContaining({ id: 'fixture-expression', url: '/fixture-mascot.png' })] })],
		}));
		expect(ok?.disabled).toBe(true);
		ok?.click();
		expect(mocks.api.mock.calls.filter(([endpoint]) => endpoint === 'hata/mascot/update')).toHaveLength(1);
		expect(mocks.loadMascot).not.toHaveBeenCalled();
		completeSave();
		await settle();
		expect(mocks.loadMascot).toHaveBeenCalledExactlyOnceWith(true);
		expect(mocks.toast).toHaveBeenCalledExactlyOnceWith('saved');
		expect(ok?.disabled).toBe(false);
		expect(onClosed).not.toHaveBeenCalled();
		container.querySelector<HTMLButtonElement>('[data-testid="settings-embedded-close"]')?.click();
		expect(onClosed).toHaveBeenCalledTimes(1);
	});

	it('立ち絵のないキャラクターは既存の検証により保存できない', async () => {
		const response = mascotResponse();
		response.data.characters[0].expressions = [];
		const { container } = await mountMascot(response);
		const ok = container.querySelector<HTMLButtonElement>('[data-testid="settings-embedded-ok"]');
		expect(ok?.disabled).toBe(true);
		ok?.click();
		expect(mocks.api.mock.calls.map(([endpoint]) => endpoint)).toEqual(['hata/mascot/get']);
	});

	it('未同意の画面に保存入口を出さず、既存の辞退操作で一度だけ閉じる', async () => {
		const response = mascotResponse();
		response.consented = false;
		const { container, onClosed } = await mountMascot(response);
		expect(container.querySelector('[data-testid="settings-embedded-ok"]')).toBeNull();
		const decline = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'decline');
		expect(decline).toBeDefined();
		decline?.click();
		expect(onClosed).toHaveBeenCalledTimes(1);
	});

	it('利用ロールがない場合は保存入口を表示しない', async () => {
		mocks.policies.canUseMascot = false;
		const { container } = await mountMascot();
		expect(container.textContent).toContain('unavailableTitle');
		expect(container.querySelector('[data-testid="settings-embedded-ok"]')).toBeNull();
	});
});
