/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { computed, createApp, h, nextTick, reactive, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({ api: vi.fn(), consent: vi.fn(), choose: vi.fn(), update: vi.fn(), me: null as any, available: null as any, display: null as any }));
vi.mock('@/i.js', () => ({ ensureSignin: () => fixtures.me }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: (endpoint: string, payload: unknown) => endpoint.startsWith('hata/consent/') ? fixtures.consent(endpoint, payload) : fixtures.api(endpoint, payload) }));
vi.mock('@/utility/drive.js', () => ({ chooseDriveFile: fixtures.choose }));
vi.mock('@/accounts.js', () => ({ updateCurrentAccount: (value: object) => { fixtures.update(value); Object.assign(fixtures.me, value); } }));
vi.mock('@/os.js', () => ({ claimZIndex: () => 10000 }));
vi.mock('@/preferences.js', () => ({ prefer: { s: { animation: false, useBlurEffectForModal: false } } }));
vi.mock('@/composables/use-note-charm-context.js', async importOriginal => {
	const original = await importOriginal<typeof import('@/composables/use-note-charm-context.js')>();
	return { ...original, useNoteCharmAvailability: () => {
		const available = original.useNoteCharmAvailability();
		return computed(() => available.value && fixtures.available.value);
	} };
});
vi.mock('@/utility/hatasaba-device-prefs.js', () => ({ get noteCharmDisplay() { return fixtures.display; }, setNoteCharmDisplay: (patch: object) => { fixtures.display.value = { ...fixtures.display.value, ...patch }; } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { close: '閉じる', retry: '再試行', loading: '読み込み中', _noteCharm: {
	consentTitle: 'チャームの利用にあたって', consentBody: '利用前に次の内容をご確認ください。', consentImageRights: '画像の権利を確認してください。', consentProhibitedImages: '成人向け画像は使えません。', consentDisplay: '画像は加工して表示されます。', consentRecord: '同意日時を記録します。', consentAgree: '同意して使う', consentLoadFailed: '同意状況を読み込めません', consentRecordFailed: '同意を記録できません', consentRequired: 'チャームの利用には同意が必要です', consentTerms: 'チャームの利用条件', consentAgreed: '同意済み', stepImage: '画像を選ぶ', stepStyle: '見た目を調整', stepSave: '保存',
	smartphoneUnavailable: 'スマートフォンとモバイル表示ではノートチャームを利用できません。',
	title: 'ノートチャーム', enabled: '全ノートに飾る', image: 'キャラクター', chooseImage: '画像を選ぶ', replaceImage: '差し替える', removeImage: '画像を外す', width: 'チャームの幅', pattern: '柄', color: '色', save: '保存', info: '情報', conditions: '利用条件を確認', saved: '保存した飾りつけを確認', accountScope: 'アカウント共通', roleUnavailable: 'ロールで許可されていません', uiUnavailable: 'このUIでは利用できません', bothUnavailable: 'ロールとUIが利用条件を満たしていません', noSaved: '未設定', fileRequirements: 'PNG・WebP・JPEG · 5 MBまで', invalidFile: '使えない画像', saveFailed: '保存に失敗', savedSuccessfully: '保存しました', imageLoadFailed: '画像を読み込めません', preview: 'プレビュー', slotCount: '1体まで', show: 'チャームを表示', showOthers: '他のユーザーのチャームを表示', motion: 'スクロールに合わせて揺らす', wind: '風で揺らす', patterns: { cutout: '切り抜き', clear: 'クリア', dots: '水玉', stripes: 'ストライプ', check: 'チェック' },
} } } }));
vi.mock('@/components/MkButton.vue', () => ({ default: { props: ['disabled', 'wait'], template: '<button type="button" :disabled="disabled || wait"><slot/></button>' } }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: { props: ['modelValue', 'disabled'], emits: ['update:modelValue'], template: '<label><slot name="label"/><input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)"/></label>' } }));
vi.mock('@/components/MkRange.vue', () => ({ default: { props: ['modelValue', 'disabled', 'min', 'max'], emits: ['update:modelValue'], template: '<label><slot name="label"/><input type="range" :value="modelValue" :min="min" :max="max" :disabled="disabled" @input="$emit(\'update:modelValue\', Number($event.target.value))"/></label>' } }));
vi.mock('@/components/settings-redesign/SettingsControlRelated.vue', () => ({ default: { template: '<div/>' } }));
vi.mock('@/components/MkNoteCharmPreview.vue', () => ({ default: { props: ['charm'], template: '<div data-preview :data-charm="JSON.stringify(charm)"/>' } }));

import MkNoteCharmSettings from './MkNoteCharmSettings.vue';
import { hotkeyDirective } from '@/directives/hotkey.js';

const raw = { fileId: 'saved', enabled: false, size: 89, pattern: 'check', color: '#123456' };
const file = (id: string, overrides = {}) => ({ id, userId: 'me', type: 'image/png', size: 200, isSensitive: false, name: `${id}.png`, url: `https://example.test/${id}.png`, ...overrides });
const cleanup: (() => void)[] = [];

async function flush() { await Promise.resolve(); await nextTick(); await Promise.resolve(); await nextTick(); }

function mount() {
	const container = window.document.createElement('div'); window.document.body.append(container);
	const app = createApp({ render: () => h(MkNoteCharmSettings) }); app.directive('adaptive-border', {}); app.directive('hotkey', hotkeyDirective); app.mount(container);
	cleanup.push(() => { app.unmount(); container.remove(); });
	return container;
}

function button(target: HTMLElement, text: string) { return [...target.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.includes(text))!; }

function preview(target: HTMLElement) { return JSON.parse(target.querySelector('[data-preview]')!.getAttribute('data-charm')!); }

beforeEach(() => {
	fixtures.me = reactive({ id: 'me', policies: { canUseNoteCharm: true }, noteCharmSettings: { ...raw }, noteCharm: null });
	fixtures.available = ref(true); fixtures.display = ref({ show: true, motion: true, showOthers: true, wind: true });
	vi.stubGlobal('innerWidth', 1400);
	vi.stubGlobal('navigator', { userAgent: 'desktop', maxTouchPoints: 0 });
	fixtures.consent.mockReset().mockResolvedValue({ agreed: true, agreedAt: '2026-10-27T00:00:00.000Z', version: null });
	fixtures.api.mockReset().mockImplementation(async (endpoint, payload) => endpoint === 'drive/files/show' ? file(payload.fileId) : { ...fixtures.me, noteCharmSettings: payload.noteCharm });
	fixtures.choose.mockReset(); fixtures.update.mockReset();
});
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); vi.unstubAllGlobals(); });

describe('ノートチャーム設定', () => {
	test('画像・見た目・保存の順に、編集内容を保った3つの手順を表示する', async () => {
		const target = mount(); await flush();
		const steps = [...target.querySelectorAll<HTMLElement>('ol > li')];
		expect(steps.map(step => step.querySelector('h4')?.textContent)).toEqual(['1画像を選ぶ', '2見た目を調整', '3保存']);
		expect(button(steps[0]!, '差し替える')).toBeDefined();
		expect(steps[1]!.querySelector('[data-preview]')).not.toBeNull();
		const range = steps[1]!.querySelector<HTMLInputElement>('input[type="range"]')!;
		expect(steps[1]!.querySelector('input[type="radio"]')).not.toBeNull();
		expect(steps[1]!.querySelector('input[type="color"]')).not.toBeNull();
		expect(steps[2]!.querySelector('input[type="checkbox"]')).not.toBeNull();
		const save = button(steps[2]!, '保存');
		expect(save.disabled).toBe(true);
		range.value = '55'; range.dispatchEvent(new Event('input')); await flush();
		expect(preview(steps[1]!).size).toBe(55);
		expect(save.disabled).toBe(false);
		expect(fixtures.api.mock.calls.some(([endpoint]) => endpoint === 'i/update')).toBe(false);
	});

	test.each([true, false])('ダイアログの同意済み表示はサーバーの確認結果に従う agreed=%s', async agreed => {
		fixtures.consent.mockResolvedValueOnce({ agreed, agreedAt: agreed ? '2026-10-27T00:00:00.000Z' : null, version: null });
		const target = mount(); await flush();
		button(target, '情報').click(); await flush();
		const panel = window.document.querySelector<HTMLElement>('[role="dialog"]')!;
		const status = panel.querySelector('[role="status"]');
		expect(status?.textContent?.trim() ?? null).toBe(agreed ? '同意済み' : null);
		expect(fixtures.consent).toHaveBeenCalledExactlyOnceWith('hata/consent/get', { type: 'noteCharm' });
	});

	test('同意確認中や取得失敗時にはダイアログに同意済みを表示しない', async () => {
		let rejectConsent!: (reason: Error) => void;
		fixtures.consent.mockImplementationOnce(() => new Promise((_, reject) => { rejectConsent = reject; }));
		const target = mount(); await flush();
		button(target, '情報').click(); await flush();
		const panel = window.document.querySelector<HTMLElement>('[role="dialog"]')!;
		expect(panel.querySelector('[role="status"]')).toBeNull();
		rejectConsent(new Error('offline')); await flush();
		expect(panel.querySelector('[role="status"]')).toBeNull();
		expect(target.querySelector('[role="alert"]')?.textContent).toContain('同意状況を読み込めません');
	});

	test.each([true, false])('同意の記録中には未表示とし、成功した場合だけ開いたダイアログに同意済みを表示する success=%s', async success => {
		fixtures.consent.mockResolvedValueOnce({ agreed: false, agreedAt: null, version: null });
		const target = mount(); await flush();
		let resolveConsent!: (value: { ok: boolean }) => void;
		let rejectConsent!: (reason: Error) => void;
		fixtures.consent.mockImplementationOnce(() => new Promise((resolve, reject) => { resolveConsent = resolve; rejectConsent = reject; }));
		button(target, '同意して使う').click(); await flush();
		button(target, '情報').click(); await flush();
		const panel = window.document.querySelector<HTMLElement>('[role="dialog"]')!;
		expect(panel.querySelector('[role="status"]')).toBeNull();
		if (success) resolveConsent({ ok: true }); else rejectConsent(new Error('offline'));
		await flush();
		expect(panel.querySelector('[role="status"]')?.textContent?.trim() ?? null).toBe(success ? '同意済み' : null);
		expect(fixtures.consent.mock.calls.filter(([endpoint]) => endpoint === 'hata/consent/update')).toEqual([['hata/consent/update', { type: 'noteCharm', agree: true }]]);
	});
	test('PCの幅を狭めると編集・表示切替・プレビューを隠し、広げると未保存の編集を復元する', async () => {
		const target = mount(); await flush();
		const range = target.querySelector<HTMLInputElement>('input[type=range]')!;
		range.value = '55'; range.dispatchEvent(new Event('input')); await flush();
		const display = { ...fixtures.display.value };
		const saved = { ...fixtures.me.noteCharmSettings };
		const info = button(target, '情報'); info.click(); await flush();
		const panel = window.document.getElementById(info.getAttribute('aria-controls')!)!;
		expect(panel.querySelector('[data-preview]')).not.toBeNull();
		vi.stubGlobal('innerWidth', 390);
		window.dispatchEvent(new Event('resize')); await flush();
		expect(target.querySelector('[role=status]')?.textContent).toContain('モバイル表示');
		expect(target.querySelector('input')).toBeNull();
		expect(target.querySelector('[data-preview]')).toBeNull();
		expect(panel.querySelector('[data-preview]')).toBeNull();
		expect(button(target, '保存')).toBeUndefined();
		vi.stubGlobal('innerWidth', 1400);
		window.dispatchEvent(new Event('resize')); await flush();
		expect(target.querySelector<HTMLInputElement>('input[type=range]')!.value).toBe('55');
		expect(button(target, '保存').disabled).toBe(false);
		expect(target.querySelector('[data-preview]')).not.toBeNull();
		expect(panel.querySelector('[data-preview]')).not.toBeNull();
		expect(fixtures.display.value).toEqual(display);
		expect(fixtures.me.noteCharmSettings).toEqual(saved);
		expect(fixtures.api.mock.calls.some(([endpoint]) => endpoint === 'i/update')).toBe(false);
	});

	test('同意確認が完了するまで編集を開かず、端末の表示設定は使える', async () => {
		let resolveConsent!: (value: unknown) => void;
		fixtures.consent.mockImplementation(() => new Promise(resolve => { resolveConsent = resolve; }));
		const target = mount(); await flush();
		expect(fixtures.consent).toHaveBeenCalledExactlyOnceWith('hata/consent/get', { type: 'noteCharm' });
		expect(target.querySelector('[role=status]')?.textContent).toContain('読み込み中');
		expect(button(target, '差し替える')).toBeUndefined();
		expect(button(target, '保存')).toBeUndefined();
		const show = target.querySelector<HTMLInputElement>('input[type=checkbox]')!;
		show.checked = false; show.dispatchEvent(new Event('change')); await flush();
		expect(fixtures.display.value.show).toBe(false);
		resolveConsent({ agreed: false, agreedAt: null, version: null }); await flush();
		expect(button(target, '同意して使う')).toBeDefined();
		expect(button(target, '差し替える')).toBeUndefined();
		expect(fixtures.consent).toHaveBeenCalledTimes(1);
	});

	test('同意取得に失敗したら閉じたまま再試行し、確認済みの同意で編集を開く', async () => {
		fixtures.consent.mockRejectedValueOnce(new Error('offline'));
		const target = mount(); await flush();
		expect(target.querySelector('[role=alert]')?.textContent).toContain('同意状況を読み込めません');
		expect(button(target, '差し替える')).toBeUndefined();
		expect(button(target, '同意して使う')).toBeUndefined();
		button(target, '再試行').click(); await flush();
		expect(fixtures.consent).toHaveBeenCalledTimes(2);
		expect(button(target, '差し替える')).toBeDefined();
	});

	test.each([true, false])('再試行ボタンで同意状況を読み直した後は次の操作へフォーカスを移す agreed=%s', async agreed => {
		fixtures.consent.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ agreed, agreedAt: null, version: null });
		const target = mount(); await flush(); const retry = button(target, '再試行'); retry.focus(); retry.click(); await flush();
		expect(window.document.activeElement).toBe(button(target, agreed ? '差し替える' : '同意して使う'));
	});

	test('同意記録を二重送信せず、失敗時は閉じたまま成功後だけ編集へフォーカスを移す', async () => {
		fixtures.consent.mockResolvedValueOnce({ agreed: false, agreedAt: null, version: null });
		const target = mount(); await flush();
		let rejectConsent!: (error: Error) => void;
		fixtures.consent.mockImplementationOnce(() => new Promise((_, reject) => { rejectConsent = reject; }));
		const agree = button(target, '同意して使う'); agree.focus(); agree.click(); agree.click(); await flush();
		expect(fixtures.consent.mock.calls.filter(([endpoint]) => endpoint === 'hata/consent/update')).toEqual([['hata/consent/update', { type: 'noteCharm', agree: true }]]);
		expect(agree.disabled).toBe(true); expect(button(target, '差し替える')).toBeUndefined();
		rejectConsent(new Error('offline')); await flush();
		expect(target.querySelector('[role=alert]')?.textContent).toContain('同意を記録できません');
		expect(agree.disabled).toBe(false); expect(button(target, '差し替える')).toBeUndefined();
		fixtures.consent.mockResolvedValueOnce({ ok: true }); agree.focus(); agree.click(); await flush();
		expect(button(target, '差し替える')).toBeDefined();
		expect(window.document.activeElement).toBe(button(target, '差し替える'));
		expect(fixtures.api.mock.calls.some(([endpoint]) => endpoint === 'i/update')).toBe(false);
	});

	test('未同意で設定を離れても同意記録を作らず、古い取得応答は次の画面を開かない', async () => {
		let resolveConsent!: (value: unknown) => void;
		fixtures.consent.mockImplementationOnce(() => new Promise(resolve => { resolveConsent = resolve; }));
		mount(); await flush(); cleanup.pop()!();
		fixtures.consent.mockResolvedValueOnce({ agreed: false, agreedAt: null, version: null });
		const target = mount(); await flush();
		resolveConsent({ agreed: true, agreedAt: '2026-10-27T00:00:00.000Z', version: null }); await flush();
		expect(button(target, '差し替える')).toBeUndefined(); expect(button(target, '同意して使う')).toBeDefined();
		expect(fixtures.consent.mock.calls.every(([endpoint]) => endpoint === 'hata/consent/get')).toBe(true);
	});

	test('同意保存を待つ間に別の操作へ移ったときはフォーカスを奪わない', async () => {
		fixtures.consent.mockResolvedValueOnce({ agreed: false, agreedAt: null, version: null });
		const target = mount(); await flush();
		let resolveConsent!: (value: unknown) => void;
		fixtures.consent.mockImplementationOnce(() => new Promise(resolve => { resolveConsent = resolve; }));
		const agree = button(target, '同意して使う'); agree.focus(); agree.click(); await flush();
		const show = target.querySelector<HTMLInputElement>('input[type=checkbox]')!; show.focus();
		resolveConsent({ ok: true }); await flush();
		expect(button(target, '差し替える')).toBeDefined(); expect(window.document.activeElement).toBe(show);
	});

	test('設定を離れた後の同意保存完了が現在の画面からフォーカスを奪わない', async () => {
		fixtures.consent.mockResolvedValueOnce({ agreed: false, agreedAt: null, version: null });
		const target = mount(); await flush();
		let resolveConsent!: (value: unknown) => void;
		fixtures.consent.mockImplementationOnce(() => new Promise(resolve => { resolveConsent = resolve; }));
		button(target, '同意して使う').focus(); button(target, '同意して使う').click(); await flush(); cleanup.pop()!();
		const current = mount(); await flush(); const info = button(current, '情報'); info.focus();
		resolveConsent({ ok: true }); await flush();
		expect(window.document.activeElement).toBe(info);
		expect(fixtures.api.mock.calls.some(([endpoint]) => endpoint === 'i/update')).toBe(false);
	});

	test('保存時に同意を拒否されたら再同意に戻り、編集中の画像と幅を保持する', async () => {
		const target = mount(); await flush();
		fixtures.choose.mockResolvedValue([file('draft')]); button(target, '差し替える').click(); await flush();
		const range = target.querySelector<HTMLInputElement>('input[type=range]')!; range.value = '55'; range.dispatchEvent(new Event('input')); await flush();
		fixtures.api.mockRejectedValueOnce({ code: 'NOTE_CHARM_NOT_CONSENTED' });
		button(target, '保存').focus(); button(target, '保存').click(); await flush();
		expect(button(target, '差し替える')).toBeUndefined();
		expect(target.querySelector('[role=alert]')?.textContent).toContain('チャームの利用には同意が必要です');
		expect(window.document.activeElement?.textContent).toContain('チャームの利用には同意が必要です');
		fixtures.consent.mockResolvedValueOnce({ ok: true }); button(target, '同意して使う').click(); await flush();
		expect(preview(target)).toMatchObject({ url: file('draft').url, size: 55 });
		expect(button(target, '保存').disabled).toBe(false); expect(fixtures.me.noteCharmSettings).toEqual(raw);
	});

	test.each([[false, true], [true, false]])('利用条件を満たさない間は同意UIより既存の利用不可案内を優先する role=%s UI=%s', async (role, ui) => {
		fixtures.me.policies.canUseNoteCharm = role; fixtures.available.value = ui;
		fixtures.consent.mockRejectedValue(new Error('offline'));
		const target = mount(); await flush();
		expect(button(target, '同意して使う')).toBeUndefined(); expect(button(target, '再試行')).toBeUndefined();
		expect(target.querySelector('[role=status]')?.textContent).toContain(role ? 'このUI' : 'ロールで');
		expect(target.querySelectorAll('input[type=checkbox]')).toHaveLength(4);
	});

	test.each([[true, true], [true, false], [false, true], [false, false]])('スマートフォンの案内を優先し、編集・同意・表示切替・プレビューを出さず保存値を保つ role=%s agreed=%s', async (role, agreed) => {
		vi.stubGlobal('navigator', { userAgent: 'iPhone', maxTouchPoints: 5 });
		fixtures.available.value = false; fixtures.me.policies.canUseNoteCharm = role;
		fixtures.consent.mockResolvedValue({ agreed, agreedAt: null, version: null });
		const display = { ...fixtures.display.value };
		const target = mount(); await flush();
		expect(target.querySelector('[role=status]')?.textContent).toBe('スマートフォンとモバイル表示ではノートチャームを利用できません。');
		for (const label of ['同意して使う', '再試行', '画像を選ぶ', '差し替える', '画像を外す', '保存']) {
			expect(button(target, label)).toBeUndefined();
		}
		expect(target.querySelector('input')).toBeNull();
		expect(target.querySelector('[data-preview]')).toBeNull();
		const info = button(target, '情報'); info.click(); await flush();
		const panel = window.document.getElementById(info.getAttribute('aria-controls')!)!;
		expect(panel.textContent).toContain('saved.png');
		expect(panel.textContent).toContain('64 px');
		expect(panel.textContent).toContain('#123456');
		expect(panel.querySelector('[data-preview]')).toBeNull();
		expect(fixtures.display.value).toEqual(display);
		expect(fixtures.me.noteCharmSettings).toEqual(raw);
		expect(fixtures.choose).not.toHaveBeenCalled();
		expect(fixtures.update).not.toHaveBeenCalled();
		expect(fixtures.api.mock.calls).toEqual([['drive/files/show', { fileId: 'saved' }]]);
		expect(fixtures.consent.mock.calls).toEqual([['hata/consent/get', { type: 'noteCharm' }]]);
	});

	test('同意後も情報欄で同じ利用条件を読み直せる', async () => {
		const target = mount(); await flush(); const info = button(target, '情報'); info.click(); await flush();
		const panel = window.document.getElementById(info.getAttribute('aria-controls')!)!;
		expect(panel.textContent).toContain('チャームの利用条件');
		expect(panel.textContent).toContain('画像の権利を確認してください。');
		expect(panel.textContent).toContain('成人向け画像は使えません。');
		expect(panel.textContent).toContain('画像は加工して表示されます。');
		expect(panel.textContent).toContain('同意日時を記録します。');
	});

	test('風だけをオフにしても動き・表示・編集中の下書きは変えず、アカウントへ保存しない', async () => {
		const target = mount(); await flush();
		const range = target.querySelector<HTMLInputElement>('input[type=range]')!;
		range.value = '52'; range.dispatchEvent(new Event('input')); await flush();
		const before = preview(target);
		const wind = [...target.querySelectorAll('label')].find(label => label.textContent?.includes('風で揺らす'))?.querySelector<HTMLInputElement>('input');
		expect(wind).toBeDefined(); expect(wind!.checked).toBe(true);
		wind!.checked = false; wind!.dispatchEvent(new Event('change')); await flush();
		expect(fixtures.display.value).toEqual({ show: true, motion: true, showOthers: true, wind: false });
		expect(preview(target)).toEqual(before); expect(button(target, '保存').disabled).toBe(false);
		expect(fixtures.me.noteCharmSettings).toEqual(raw);
		expect(fixtures.api.mock.calls.filter(([name]) => name === 'i/update')).toHaveLength(0);
	});

	test('風の設定は表示または全体の揺れがオフの間だけ無効になり、風の選択値は保つ', async () => {
		fixtures.me.policies.canUseNoteCharm = false;
		const target = mount(); await flush();
		const wind = [...target.querySelectorAll('label')].find(label => label.textContent?.includes('風で揺らす'))?.querySelector<HTMLInputElement>('input');
		expect(wind).toBeDefined(); expect(wind!.disabled).toBe(false);
		fixtures.display.value.motion = false; await flush(); expect(wind!.disabled).toBe(true);
		fixtures.display.value.motion = true; fixtures.display.value.show = false; await flush(); expect(wind!.disabled).toBe(true);
		fixtures.display.value.show = true; await flush(); expect(wind!.disabled).toBe(false); expect(wind!.checked).toBe(true);
		expect(fixtures.api.mock.calls.filter(([name]) => name === 'i/update')).toHaveLength(0);
	});

	test.each([76, 96])('旧幅 %s は保存値を変えず表示と下書きを64pxへ収め、未編集では保存しない', async size => {
		fixtures.me.noteCharmSettings = { ...raw, size };
		const target = mount(); await flush();
		const range = target.querySelector<HTMLInputElement>('input[type=range]')!;
		expect(range.min).toBe('48'); expect(range.max).toBe('64'); expect(range.value).toBe('64');
		expect(target.querySelector('output')?.textContent).toBe('64 px');
		expect(preview(target)).toEqual({ url: file('saved').url, size: 64, pattern: 'check', color: '#123456' });
		expect(button(target, '保存').disabled).toBe(true);
		const info = button(target, '情報'); info.click(); await flush();
		const panel = window.document.getElementById(info.getAttribute('aria-controls')!)!;
		expect(preview(panel).size).toBe(64); expect(panel.textContent).toContain('64 px');
		expect(fixtures.me.noteCharmSettings).toEqual({ ...raw, size });
		expect(fixtures.api.mock.calls.filter(([name]) => name === 'i/update')).toHaveLength(0);
		expect(fixtures.update).not.toHaveBeenCalled();
	});
	test('未設定から画像を選んだチャームは60pxで始まり、保存するまでアカウントを変えない', async () => {
		fixtures.me.noteCharmSettings = null;
		const target = mount(); await flush(); fixtures.choose.mockResolvedValue([file('new')]);
		button(target, '画像を選ぶ').click(); await flush();
		expect(preview(target).size).toBe(60); expect(target.querySelector('output')?.textContent).toBe('60 px');
		expect(fixtures.me.noteCharmSettings).toBeNull();
		expect(fixtures.api.mock.calls.filter(([name]) => name === 'i/update')).toHaveLength(0);
	});
	test('旧幅を正規化した未編集値は外部更新に追従し、編集中の下書きは保持する', async () => {
		const target = mount(); await flush();
		fixtures.me.noteCharmSettings = { ...raw, size: 50 }; await flush();
		expect(preview(target).size).toBe(50); expect(button(target, '保存').disabled).toBe(true);
		const range = target.querySelector<HTMLInputElement>('input[type=range]')!; range.value = '52'; range.dispatchEvent(new Event('input')); await flush();
		fixtures.me.noteCharmSettings = { ...raw, size: 96, color: '#fedcba' }; await flush();
		expect(preview(target)).toMatchObject({ size: 52, color: '#123456' });
		expect(button(target, '保存').disabled).toBe(false);
		button(target, '保存').click(); await flush();
		expect(fixtures.api).toHaveBeenLastCalledWith('i/update', { noteCharm: { ...raw, size: 52 } });
	});
	test('無効な保存済み設定も画像と全パラメータを復元し、明示保存で維持する', async () => {
		const target = mount(); await flush();
		expect(preview(target)).toEqual({ url: file('saved').url, size: 64, pattern: 'check', color: '#123456' });
		expect(fixtures.api.mock.calls.filter(([name]) => name === 'i/update')).toHaveLength(0);
		const range = target.querySelector<HTMLInputElement>('input[type=range]')!; range.value = '60'; range.dispatchEvent(new Event('input')); await flush();
		expect(preview(target).size).toBe(60);
		button(target, '保存').click(); await flush();
		expect(fixtures.api).toHaveBeenLastCalledWith('i/update', { noteCharm: { ...raw, size: 60 } });
		expect(fixtures.update).toHaveBeenCalledOnce();
	});
	test.each([[false, true, 'ロールで'], [true, false, 'このUI'], [false, false, 'ロールとUI']])('role=%s UI=%s を区別して保存を禁止し、生設定は保持する', async (role, ui, reason) => {
		fixtures.me.policies.canUseNoteCharm = role; fixtures.available.value = ui;
		const target = mount(); await flush();
		expect(target.textContent).toContain(reason); expect(button(target, '保存')).toBeUndefined();
		const info = button(target, '情報'); info.click(); await flush();
		const panel = window.document.getElementById(info.getAttribute('aria-controls')!)!;
		expect(panel.textContent).toContain('64 px'); expect(preview(panel).url).toBe(file('saved').url);
		expect(fixtures.me.noteCharmSettings).toEqual(raw);
		expect(target.querySelectorAll('input[type=checkbox]')).toHaveLength(4);
	});
	test.each([{ type: 'image/svg+xml' }, { size: 5 * 1024 * 1024 + 1 }, { userId: 'other' }, { isSensitive: true }])('使えないドライブ画像を拒否する %j', async invalid => {
		const target = mount(); await flush(); fixtures.choose.mockResolvedValue([file('new', invalid)]);
		button(target, '差し替える').click(); await flush();
		expect(fixtures.choose).toHaveBeenCalledWith({ multiple: false, excludeSensitive: true });
		expect(target.querySelector('[role=alert]')?.textContent).toContain('使えない画像');
		expect(preview(target).url).toBe(file('saved').url);
	});
	test('古い画像取得が新しく選んだ画像を上書きしない', async () => {
		let resolveOld!: (value: any) => void;
		fixtures.api.mockImplementation(() => new Promise(resolve => { resolveOld = resolve; }));
		const target = mount(); await flush(); fixtures.choose.mockResolvedValue([file('new')]);
		button(target, '差し替える').click(); await flush();
		resolveOld(file('saved')); await flush();
		expect(preview(target).url).toBe(file('new').url);
	});
	test('画像取得失敗を表示し、生設定を削除しない', async () => {
		fixtures.api.mockRejectedValue(new Error('not found')); const target = mount(); await flush();
		expect(target.querySelector('[role=alert]')?.textContent).toContain('画像を読み込めません');
		expect(fixtures.me.noteCharmSettings).toEqual(raw);
	});
	test('保存中は再送せず、失敗時は編集内容を残す', async () => {
		const target = mount(); await flush();
		const range = target.querySelector<HTMLInputElement>('input[type=range]')!; range.value = '62'; range.dispatchEvent(new Event('input')); await flush();
		let rejectSave!: (error: Error) => void; fixtures.api.mockImplementation(() => new Promise((_, reject) => { rejectSave = reject; }));
		const save = button(target, '保存'); save.click(); await flush(); save.click();
		expect(fixtures.api.mock.calls.filter(([name]) => name === 'i/update')).toHaveLength(1);
		rejectSave(new Error('failed')); await flush();
		expect(target.querySelector('[role=alert]')?.textContent).toContain('保存に失敗'); expect(preview(target).size).toBe(62);
	});
	test('画像を外す保存はnullだけを送る', async () => {
		const target = mount(); await flush(); button(target, '画像を外す').click(); await flush(); button(target, '保存').click(); await flush();
		expect(fixtures.api).toHaveBeenLastCalledWith('i/update', { noteCharm: null });
	});
	test('保存値のキー順が異なっていても未編集では保存できない', async () => {
		fixtures.me.noteCharmSettings = { color: raw.color, pattern: raw.pattern, size: raw.size, enabled: raw.enabled, fileId: raw.fileId };
		const target = mount(); await flush(); expect(button(target, '保存').disabled).toBe(true);
	});
	test('5MiBちょうどの本人画像を選び、柄・色・有効状態を明示保存して本人公開値も同期する', async () => {
		const target = mount(); await flush(); fixtures.choose.mockResolvedValue([file('new', { type: 'image/webp', size: 5 * 1024 * 1024 })]);
		button(target, '差し替える').click(); await flush();
		const enabled = target.querySelector<HTMLInputElement>('input[type=checkbox]')!; enabled.checked = true; enabled.dispatchEvent(new Event('change'));
		const dots = target.querySelector<HTMLInputElement>('input[value=dots]')!; dots.checked = true; dots.dispatchEvent(new Event('change'));
		const color = target.querySelector<HTMLInputElement>('input[type=color]')!; color.value = '#fedcba'; color.dispatchEvent(new Event('input')); await flush();
		const publicCharm = { url: file('new').url, size: 64, pattern: 'dots', color: '#fedcba' };
		fixtures.api.mockImplementation(async (_endpoint, payload) => ({ ...fixtures.me, noteCharmSettings: payload.noteCharm, noteCharm: publicCharm }));
		button(target, '保存').click(); await flush();
		expect(fixtures.api).toHaveBeenLastCalledWith('i/update', { noteCharm: { ...raw, fileId: 'new', enabled: true, size: 64, pattern: 'dots', color: '#fedcba' } });
		expect(fixtures.me.noteCharm).toEqual(publicCharm); expect(button(target, '保存').disabled).toBe(true);
	});
	test('編集途中にロールを失っても保存値と下書きを保持し、権限復帰後に続けられる', async () => {
		const target = mount(); await flush(); const range = target.querySelector<HTMLInputElement>('input[type=range]')!;
		range.value = '63'; range.dispatchEvent(new Event('input')); await flush();
		fixtures.me.policies.canUseNoteCharm = false; await flush(); expect(button(target, '保存')).toBeUndefined();
		expect(fixtures.me.noteCharmSettings).toEqual(raw);
		fixtures.me.policies.canUseNoteCharm = true; await flush(); expect(preview(target).size).toBe(63);
	});
	test('利用不可時の表示・揺れ設定は端末だけに保存する', async () => {
		fixtures.me.policies.canUseNoteCharm = false; const target = mount(); await flush();
		const show = target.querySelector<HTMLInputElement>('input[type=checkbox]')!; show.checked = false; show.dispatchEvent(new Event('change')); await flush();
		expect(fixtures.display.value).toEqual({ show: false, motion: true, showOthers: true, wind: true });
		expect([...target.querySelectorAll<HTMLInputElement>('input[type=checkbox]')][1].disabled).toBe(true);
		expect(fixtures.api.mock.calls.filter(([name]) => name === 'i/update')).toHaveLength(0); expect(fixtures.update).not.toHaveBeenCalled();
	});
	test('他人のチャームだけを非表示・再表示し、自分の表示と保存済み飾りを変更しない', async () => {
		fixtures.me.policies.canUseNoteCharm = false;
		const target = mount(); await flush();
		const others = [...target.querySelectorAll('label')].find(label => label.textContent?.includes('他のユーザーのチャームを表示'))?.querySelector<HTMLInputElement>('input');
		expect(others).toBeDefined();
		others!.checked = false; others!.dispatchEvent(new Event('change')); await flush();
		expect(fixtures.display.value).toEqual({ show: true, motion: true, showOthers: false, wind: true });
		expect(fixtures.me.noteCharmSettings).toEqual(raw);
		others!.checked = true; others!.dispatchEvent(new Event('change')); await flush();
		expect(fixtures.display.value.showOthers).toBe(true);
		expect(fixtures.api.mock.calls.filter(([name]) => name === 'i/update')).toHaveLength(0);
		expect(fixtures.update).not.toHaveBeenCalled();
	});
	test('保存済みfileIdが更新された後に古い取得が終わっても現在の画像を保つ', async () => {
		const requests = new Map<string, (value: unknown) => void>(); fixtures.api.mockImplementation((_endpoint, payload) => new Promise(resolve => requests.set(payload.fileId, resolve)));
		const target = mount(); fixtures.me.noteCharmSettings = { ...raw, fileId: 'latest' }; await flush();
		requests.get('latest')!(file('latest')); await flush(); requests.get('saved')!(file('saved')); await flush();
		expect(preview(target).url).toBe(file('latest').url);
	});
	test('新しい選択と削除の後で古い画像選択が戻っても編集内容を巻き戻さない', async () => {
		const target = mount(); await flush(); const requests: ((value: unknown) => void)[] = [];
		fixtures.choose.mockImplementation(() => new Promise(resolve => requests.push(resolve)));
		button(target, '差し替える').click(); button(target, '差し替える').click();
		requests[1]([file('latest')]); await flush(); requests[0]([file('older')]); await flush();
		expect(preview(target).url).toBe(file('latest').url);
		button(target, '差し替える').click(); button(target, '画像を外す').click(); await flush(); requests[2]([file('removed')]); await flush();
		expect(preview(target)).toBeNull();
	});
	test('未編集の色を別のアカウント更新が変えたとき、実カラー入力も新しい色を表示する', async () => {
		const target = mount(); await flush(); expect(target.querySelector<HTMLInputElement>('input[type=color]')!.value).toBe('#123456');
		fixtures.me.noteCharmSettings = { ...raw, color: '#fedcba' }; await flush();
		expect(target.querySelector<HTMLInputElement>('input[type=color]')!.value).toBe('#fedcba'); expect(preview(target).color).toBe('#fedcba');
	});
	test('infoはダイアログとして開き、Escape・背景・閉じる操作で閉じてトリガーへ戻る', async () => {
		const target = mount(); await flush(); const info = button(target, '情報');
		for (const action of ['escape', 'backdrop', 'close'] as const) {
			info.focus(); info.click(); await flush();
			const panel = window.document.getElementById(info.getAttribute('aria-controls')!)!;
			expect(info.getAttribute('aria-haspopup')).toBe('dialog');
			expect(info.getAttribute('aria-expanded')).toBe('true');
			expect(panel.getAttribute('role')).toBe('dialog');
			expect(panel.getAttribute('aria-modal')).toBe('true');
			expect(window.document.getElementById(panel.getAttribute('aria-labelledby')!)?.textContent).toBe('情報');
			expect(target.inert).toBe(true);
			expect(panel.inert).not.toBe(true);
			expect(window.document.activeElement).toBe(panel.querySelector('button'));
			if (action === 'escape') window.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
			else if (action === 'backdrop') window.document.querySelector<HTMLElement>('[data-modal-backdrop]')!.click();
			else panel.querySelector<HTMLButtonElement>('button[aria-label="閉じる"]')!.click();
			await vi.waitFor(() => expect(info.getAttribute('aria-expanded')).toBe('false'));
			expect(window.document.getElementById(panel.id)).toBeNull();
			expect(target.inert).toBe(false);
			expect(window.document.activeElement).toBe(info);
		}
	});
	test('infoは変形された設定セクションの外へ出し、開閉で本文の要素を押し下げない', async () => {
		const target = mount(); target.style.transform = 'translateX(20px)'; await flush();
		const section = target.querySelector('section')!;
		const children = [...section.children];
		const info = button(target, '情報'); info.style.setProperty('--MI_THEME-bg', '#123456'); info.click(); await flush();
		const panel = window.document.getElementById(info.getAttribute('aria-controls')!)!;
		expect(panel).not.toBeNull();
		expect(window.document.body.contains(panel)).toBe(true);
		expect(target.contains(panel)).toBe(false);
		expect(panel.style.getPropertyValue('--MI_THEME-bg')).toBe('#123456');
		expect([...section.children]).toEqual(children);
		expect(panel.textContent).toContain('64 px');
		expect(window.document.activeElement).toBe(panel.querySelector('button'));
		panel.querySelector<HTMLButtonElement>('button[aria-label="閉じる"]')!.click();
		await vi.waitFor(() => expect(window.document.getElementById(panel.id)).toBeNull());
		expect(window.document.activeElement).toBe(info);
		expect([...section.children]).toEqual(children);
	});
	test('infoは背景のスクロールやフォーカス移動で閉じず、内容を保持する', async () => {
		const target = mount(); await flush(); const info = button(target, '情報');
		info.click(); await flush();
		const panel = window.document.getElementById(info.getAttribute('aria-controls')!)!;
		const saved = panel.textContent;
		target.scrollTop = 400;
		target.dispatchEvent(new Event('scroll', { bubbles: true }));
		window.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('resize'));
		button(target, '差し替える').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		await flush();
		expect(window.document.getElementById(panel.id)).toBe(panel);
		expect(info.getAttribute('aria-expanded')).toBe('true');
		expect(target.inert).toBe(true);
		expect(panel.textContent).toBe(saved);
	});
	test('infoを開いた設定画面を破棄すると、実モーダルの背景inertを解除する', async () => {
		const background = window.document.createElement('button');
		window.document.body.append(background);
		cleanup.push(() => background.remove());
		const target = mount(); await flush(); const info = button(target, '情報');
		info.click(); await flush();
		expect(background.inert).toBe(true);
		cleanup.pop()!();
		await flush();
		expect(window.document.querySelector('[role="dialog"]')).toBeNull();
		expect(background.inert).toBe(false);
		background.focus();
		expect(window.document.activeElement).toBe(background);
	});
});
