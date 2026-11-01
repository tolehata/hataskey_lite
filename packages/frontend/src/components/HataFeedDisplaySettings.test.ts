/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
const fixtures = vi.hoisted(() => ({ guide: vi.fn(), stopGuide: vi.fn(), save: vi.fn(), close: vi.fn(), api: vi.fn(), form: vi.fn(), popup: vi.fn(), confirm: vi.fn(), staff: true, available: true, failLoad: false, projects: [
	{ id: 'official', name: 'Hataskey', ownerId: null, isOfficial: true, suspended: false, description: '公式', genre: null, url: null, color: null },
	{ id: 'own', name: '自分のプロジェクト', ownerId: 'me', isOfficial: false, suspended: false, description: '説明', genre: 'ツール', url: 'https://example.test/repo', color: '#41b883' },
	{ id: 'other', name: '別のプロジェクト', ownerId: 'other', isOfficial: false, suspended: false, description: '', genre: null, url: null, color: null },
] }));
vi.mock('@/i.js', () => ({ $i: { id: 'me' }, get iAmModerator() { return fixtures.staff; } }));
vi.mock('@/utility/hatafeed-tutorial-launcher.js', () => ({ showHataFeedTutorial: fixtures.guide }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixtures.api }));
vi.mock('@/os.js', () => ({ form: fixtures.form, popup: fixtures.popup, confirm: fixtures.confirm, toast: vi.fn() }));
vi.mock('@/components/HataFeedExportWindow.vue', () => ({ default: { name: 'HataFeedExportWindow', template: '<div/>' } }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/utility/hatasaba-device-prefs.js', async () => {
	const theme = (await import('vue')).ref('light');
	return { hataFeedTheme: theme, setHataFeedTheme: (value: string) => { fixtures.save(value); theme.value = value; } };
});
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	const leaves = ref(false);
	return { prefer: { r: { animation: ref(false), 'hatafeed.leaves': leaves }, commit: (key: string, value: boolean) => { if (key !== 'hatafeed.leaves') throw new Error('wrong key'); leaves.value = value; } } };
});
vi.mock('@/components/MkWindow.vue', async () => {
	const { defineComponent } = await import('vue');
	return { default: defineComponent({ setup(_, { expose }) { expose({ close: fixtures.close }); }, template: '<section data-window><header><slot name="header"/><button aria-label="閉じる"/></header><slot/></section>' }) };
});
import HataFeedDisplaySettings from './HataFeedDisplaySettings.vue';
import source from './HataFeedDisplaySettings.vue?raw';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { prefer } from '@/preferences.js';
import { hataFeedProjectId } from '@/utility/hatafeed-ui.js';
const cleanups: Array<() => void> = [];
beforeEach(() => {
	fixtures.guide.mockReset().mockResolvedValue(fixtures.stopGuide); fixtures.stopGuide.mockReset();
	fixtures.staff = true; fixtures.available = true; fixtures.failLoad = false;
	hataFeedProjectId.value = null;
	fixtures.form.mockReset().mockResolvedValue({ canceled: true });
	fixtures.confirm.mockReset().mockResolvedValue({ canceled: true });
	fixtures.popup.mockReset().mockReturnValue({ dispose: vi.fn() });
	fixtures.api.mockReset().mockImplementation(async (endpoint: string) => {
		if (endpoint.endsWith('/available')) return { available: fixtures.available, isStaff: fixtures.staff };
		if (endpoint.endsWith('/projects')) {
			if (fixtures.failLoad) throw new Error('load failed');
			return structuredClone(fixtures.projects);
		}
		return {};
	});
});
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); fixtures.save.mockReset(); fixtures.close.mockReset(); hataFeedTheme.value = 'light'; prefer.r['hatafeed.leaves'].value = false; });

async function mount(embedded: boolean, onProjectsChanged = vi.fn()) {
	const target = window.document.createElement('div'); window.document.body.append(target);
	const app = createApp({ render: () => h(HataFeedDisplaySettings, { embedded, onProjectsChanged }) }); app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await vi.waitFor(() => expect(target.querySelector('[aria-label="プロジェクト設定"] [role="status"]')).toBeNull());
	return target;
}

function selectedProjectName(target: HTMLElement) {
	const select = target.querySelector<HTMLSelectElement>('[aria-label="対象のプロジェクト"]')!;
	return select.options[select.selectedIndex]?.textContent;
}

function button(target: HTMLElement, text: string) { return [...target.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text)); }

async function selectProject(target: HTMLElement, id: string) {
	const select = target.querySelector<HTMLSelectElement>('[aria-label="対象のプロジェクト"]')!;
	select.value = id; select.dispatchEvent(new Event('change')); await nextTick();
}

describe('HataFeed display settings', () => {
	test.each([true, false])('embedded=%s chooses the correct shell and close controls', async embedded => {
		const target = await mount(embedded);
		expect(target.querySelector('[data-window]') != null).toBe(!embedded);
		expect(target.querySelector('[aria-label="閉じる"]') != null).toBe(!embedded);
		const close = [...target.querySelectorAll('button')].find(button => button.textContent === '閉じる');
		expect(close).toBeUndefined();
		expect(button(target, 'エクスポート')).toBeDefined();
		expect(button(target, 'プロジェクトを編集')).toBeDefined();
		expect(fixtures.close).not.toHaveBeenCalled();
	});

	test.each([true, false])('embedded=%s replays both guides without closing settings or persisting completion', async embedded => {
		const target = await mount(embedded);
		for (const [label, kind] of [['HataFeedの使い方', 'initial'], ['新しくなったHataFeed', 'update']]) {
			const anchor = button(target, label)!;
			anchor.click(); await nextTick();
			expect(fixtures.guide).toHaveBeenLastCalledWith(expect.objectContaining({ kind, replay: true, isStaff: true, anchorElement: anchor }));
			expect(fixtures.guide.mock.lastCall![0].isActive()).toBe(true);
		}
		expect(fixtures.close).not.toHaveBeenCalled();
		expect(fixtures.api.mock.calls.every(([endpoint]) => endpoint.endsWith('/available') || endpoint.endsWith('/projects'))).toBe(true);
		cleanups.pop()!();
		expect(fixtures.guide.mock.lastCall![0].isActive()).toBe(false);
		expect(fixtures.stopGuide).toHaveBeenCalledOnce();
	});

	test.each(['', 'own'])('exports the selected project %s from settings without immediately exporting data', async id => {
		const target = await mount(true); await selectProject(target, id);
		button(target, 'エクスポート')!.click();
		await vi.waitFor(() => expect(fixtures.popup).toHaveBeenCalledOnce());
		expect(fixtures.popup.mock.calls[0][0].name).toBe('HataFeedExportWindow');
		expect(fixtures.popup.mock.calls[0][1]).toEqual({ projectId: id || null, projectName: id ? '自分のプロジェクト' : 'Hataskey' });
		expect(fixtures.api.mock.calls.every(([endpoint]) => endpoint.endsWith('/available') || endpoint.endsWith('/projects'))).toBe(true);
	});

	test.each(['', 'own'])('edits project %s with existing values and refreshes the selected name', async id => {
		const changed = vi.fn(); const target = await mount(false, changed); await selectProject(target, id);
		const project = fixtures.projects.find(item => item.id === (id || 'official'))!;
		const updated = { name: '変更した名前', genre: '新しいジャンル', description: '変更した説明', url: '', color: '' };
		fixtures.form.mockResolvedValueOnce({ canceled: false, result: updated });
		fixtures.api.mockImplementation(async (endpoint: string) => endpoint.endsWith('/projects') ? fixtures.projects.map(item => item.id === project.id ? { ...item, ...updated } : item) : {});
		button(target, 'プロジェクトを編集')!.click();
		await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
		expect(fixtures.form.mock.calls[0][1].name.default).toBe(project.name);
		expect(fixtures.form.mock.calls[0][1].url.default).toBe(project.url ?? '');
		expect(fixtures.api).toHaveBeenCalledWith('hata/feedback/projects/update', { projectId: project.id, ...updated, color: null, url: null });
		expect(selectedProjectName(target)).toBe('変更した名前');
		expect(fixtures.close).not.toHaveBeenCalled();
	});

	test('canceling a project edit does not save or emit a change', async () => {
		const changed = vi.fn(); const target = await mount(false, changed);
		button(target, 'プロジェクトを編集')!.click(); await nextTick(); await nextTick();
		expect(fixtures.form).toHaveBeenCalledOnce();
		expect(fixtures.api).not.toHaveBeenCalledWith('hata/feedback/projects/update', expect.anything());
		expect(changed).not.toHaveBeenCalled();
	});

	test('failed edits keep the selected project and allow retry', async () => {
		const changed = vi.fn(); const target = await mount(true, changed); await selectProject(target, 'own');
		fixtures.form.mockResolvedValueOnce({ canceled: false, result: { name: '失敗する変更' } });
		fixtures.api.mockRejectedValueOnce(new Error('update rejected'));
		button(target, 'プロジェクトを編集')!.click();
		await vi.waitFor(() => expect(target.querySelector('[role="alert"]')?.textContent).toContain('更新できませんでした'));
		expect(button(target, 'プロジェクトを編集')!.disabled).toBe(false);
		expect(selectedProjectName(target)).toBe('自分のプロジェクト');
		expect(changed).not.toHaveBeenCalled();
	});

	test('non-staff can export only their project and cannot manage projects', async () => {
		fixtures.staff = false; const target = await mount(true);
		for (const id of ['', 'other', 'own']) {
			await selectProject(target, id);
			expect(!!button(target, 'エクスポート')).toBe(id === 'own');
			expect(button(target, 'プロジェクトを編集')).toBeUndefined();
			expect(target.querySelector('.ti-plus')).toBeNull();
		}
	});

	test('access denial does not fetch projects; failed loading can be retried', async () => {
		fixtures.available = false; const denied = await mount(true);
		expect(denied.querySelector('select')).toBeNull();
		expect(fixtures.api).not.toHaveBeenCalledWith('hata/feedback/projects', expect.anything());
		fixtures.available = true; fixtures.failLoad = true; const target = await mount(false);
		expect(target.querySelector('[role="alert"]')?.textContent).toContain('読み込めませんでした');
		fixtures.failLoad = false; button(target, '再読み込み')!.click();
		await vi.waitFor(() => expect(target.querySelector('select')).not.toBeNull());
	});
	test('themes and the existing leaves preference update immediately without a modal close', async () => {
		const target = await mount(true);
		target.querySelector<HTMLButtonElement>('[role="group"] [aria-label="エスプレッソ"]')!.click(); await nextTick();
		expect(fixtures.save).toHaveBeenCalledWith('espresso');
		expect(target.querySelector('[data-embedded]')?.getAttribute('data-hatady-theme')).toBe('espresso');
		expect(target.querySelector<HTMLButtonElement>('[aria-label="次のテーマ"]')!.disabled).toBe(true);
		target.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); await nextTick();
		expect(prefer.r['hatafeed.leaves'].value).toBe(true);
		expect(fixtures.close).not.toHaveBeenCalled();
	});
	test('failed theme persistence retains the current selection and reports the failure', async () => {
		fixtures.save.mockImplementationOnce(() => { throw new Error('storage full'); });
		const target = await mount(true);
		target.querySelector<HTMLButtonElement>('[aria-label="次のテーマ"]')!.click(); await nextTick();
		expect(hataFeedTheme.value).toBe('light');
		expect(target.querySelector('[role="alert"]')?.textContent).toBe('テーマを保存できませんでした');
	});
	test('embedded content has natural height and vertical touch scroll is not intercepted', () => {
		expect(source).toContain('.surface[data-embedded=\'true\'] { height: auto; min-height: 0; overflow: visible;');
		expect(source).toContain('touch-action: pan-y');
		expect(source).toContain('@touchstart.passive');
		expect(source).not.toContain('@wheel');
	});
});
