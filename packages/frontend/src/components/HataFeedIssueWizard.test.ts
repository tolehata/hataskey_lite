/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';

const fixture = vi.hoisted(() => ({
	api: vi.fn(), notify: vi.fn(), records: new Map<string, string>(),
	pending: null as null | { props: { save: () => boolean }; events: { done: (leave: boolean) => void; closed: () => void } },
}));
vi.mock('@/i.js', () => ({ $i: { id: 'environment-user' }, iAmModerator: false }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: {
	getItemAsJson(key: string) { const value = fixture.records.get(key); return value == null ? undefined : JSON.parse(value); },
	setItemAsJson(key: string, value: unknown) { fixture.records.set(key, JSON.stringify(value)); },
} }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => ({ hataFeedTheme: (await import('vue')).ref('light') }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/utility/drive.js', () => ({ chooseDriveFile: vi.fn() }));
vi.mock('@/utility/hatafeed-ui.js', async () => ({ hataFeedNotify: fixture.notify, hataFeedDraftPromptOpen: (await import('vue')).ref(false) }));
vi.mock('@/utility/hatafeed.js', () => ({
	creatableCategoryKeys: ['bug'], staffOnlyCategoryKeys: [],
	categoryLabel: { bug: '不具合' }, categoryDesc: { bug: '不具合を報告' }, categoryIcon: { bug: 'ti ti-bug' },
}));
vi.mock('@/os.js', () => ({ popup: (_component: unknown, props: NonNullable<typeof fixture.pending>['props'], events: NonNullable<typeof fixture.pending>['events']) => {
	fixture.pending = { props, events }; return { dispose: vi.fn() };
} }));
vi.mock('@/utility/hatagoes-popup.js', async () => { const os = await import('@/os.js'); return { useHataGoesPopup: () => os.popup }; });
vi.mock('@/components/HataFeedDraftPrompt.vue', () => ({ default: { template: '<div/>' } }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/components/MkWindow.vue', () => ({ default: defineComponent({
	props: ['beforeClose'], emits: ['closed'],
	setup(props, { slots, emit, expose }) {
		const close = async () => { if (await props.beforeClose()) emit('closed'); };
		expose({ close });
		return () => h('section', [h('button', { 'aria-label': '閉じる', onClick: close }), slots.default?.()]);
	},
}) }));
vi.mock('@/components/MkButton.vue', () => ({ default: defineComponent({ template: '<button><slot/></button>' }) }));
vi.mock('@/components/MkInput.vue', () => ({ default: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], template: '<label><slot name="label"/><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"/></label>' }) }));
vi.mock('@/components/MkTextarea.vue', () => ({ default: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], template: '<label><slot name="label"/><textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"/></label>' }) }));
vi.mock('@/components/MkSelect.vue', () => ({ default: { template: '<div><slot name="label"/></div>' } }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: { template: '<div/>' } }));
import HataFeedIssueWizard from './HataFeedIssueWizard.vue';
import { i18n } from '@/i18n.js';

const cleanups: Array<() => void> = [];
const storageKey = 'hataFormDrafts:environment-user';
const draftKey = 'hatafeed:issue:general';
beforeEach(() => {
	fixture.api.mockReset().mockResolvedValue({ id: 'created-issue' });
	fixture.notify.mockReset(); fixture.records.clear(); fixture.pending = null;
});
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); });

async function mount() {
	const target = window.document.createElement('div'); window.document.body.append(target);
	const app = createApp({ render: () => h(HataFeedIssueWizard, { projectId: null, projects: [] }) }); app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await nextTick(); return target;
}

async function click(target: HTMLElement, name: string) {
	const button = [...target.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === name || item.textContent?.includes(name));
	if (!button) throw new Error(`Missing button: ${name}`);
	button.click(); await nextTick();
}

function field(target: HTMLElement, name: string): HTMLInputElement | HTMLTextAreaElement {
	const label = [...target.querySelectorAll('label')].find(item => item.textContent?.startsWith(name));
	const control = label?.querySelector('input, textarea');
	if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) throw new Error(`Missing field: ${name}`);
	return control;
}

async function enter(target: HTMLElement, name: string, value: string) {
	const control = field(target, name); control.value = value;
	control.dispatchEvent(new Event('input', { bubbles: true })); await nextTick();
}

async function details() {
	const target = await mount(); await click(target, '不具合'); await enter(target, 'タイトル', '表示が崩れる'); return target;
}

describe('HataFeed issue environment', () => {
	test('optional empty fields leave the existing description unchanged', async () => {
		const target = await details(); await enter(target, i18n.ts._hata._hatafeed._issueWizard.description, '既存の説明\n');
		await click(target, '次へ'); await click(target, '送信');
		await vi.waitFor(() => expect(fixture.api).toHaveBeenCalledExactlyOnceWith('hata/feedback/issues/create', expect.objectContaining({ description: '既存の説明\n', title: '表示が崩れる', category: 'bug', projectId: null })));
	});
	test('reviews and submits the manually entered device, OS and browser with the issue', async () => {
		const target = await details(); await enter(target, i18n.ts._hata._hatafeed._issueWizard.description, 'タブを開くと崩れる');
		await enter(target, '使用端末', ' iPhone '); await enter(target, 'OS・バージョン', 'iOS テスト版'); await enter(target, 'ブラウザ・開き方', 'ホーム画面から起動');
		await click(target, '次へ');
		expect(target.textContent).toContain('iPhone'); expect(target.textContent).toContain('iOS テスト版'); expect(target.textContent).toContain('ホーム画面から起動');
		await click(target, '送信');
		await vi.waitFor(() => expect(fixture.api).toHaveBeenCalledExactlyOnceWith('hata/feedback/issues/create', expect.objectContaining({ description: 'タブを開くと崩れる\n\n【使用環境】\n使用端末: iPhone\nOS・バージョン: iOS テスト版\nブラウザ・開き方: ホーム画面から起動' })));
	});
	test('saving a draft with only environment details retains them for explicit resumption', async () => {
		const target = await mount(); await click(target, '不具合'); await enter(target, '使用端末', 'Pixel');
		await click(target, '閉じる');
		await vi.waitFor(() => expect(fixture.pending).not.toBeNull());
		expect(fixture.pending!.props.save()).toBe(true); fixture.pending!.events.done(true); fixture.pending!.events.closed(); await nextTick();
		const saved = JSON.parse(fixture.records.get(storageKey)!)[draftKey].data;
		expect(saved).toMatchObject({ title: '', device: 'Pixel', osVersion: '', browser: '' });
		const reopened = await mount(); await click(reopened, '続きから編集'); expect(field(reopened, '使用端末').value).toBe('Pixel');
		expect(fixture.api).not.toHaveBeenCalled();
	});
	test('older drafts without environment fields remain usable', async () => {
		fixture.records.set(storageKey, JSON.stringify({ [draftKey]: { version: 1, updatedAt: Date.now(), data: { step: 2, category: 'bug', title: '以前の下書き', description: '内容', files: [], code: '', codeEnabled: false, priority: 'normal' } } }));
		const target = await mount(); await click(target, '続きから編集');
		expect(field(target, 'タイトル').value).toBe('以前の下書き'); expect(field(target, '使用端末').value).toBe(''); expect(field(target, 'OS・バージョン').value).toBe('');
		await click(target, '次へ'); await click(target, '送信');
		await vi.waitFor(() => expect(fixture.api).toHaveBeenCalledExactlyOnceWith('hata/feedback/issues/create', expect.objectContaining({ description: '内容' })));
	});
	test('the combined description limit prevents submitting an oversized environment section', async () => {
		const target = await details(); await enter(target, i18n.ts._hata._hatafeed._issueWizard.description, '文'.repeat(8180)); await enter(target, '使用端末', 'iPhone');
		expect(target.querySelector('[role="alert"]')?.textContent).toContain('8,192');
		await click(target, '次へ'); expect(target.querySelector('textarea')).not.toBeNull(); expect(fixture.api).not.toHaveBeenCalled();
		await enter(target, i18n.ts._hata._hatafeed._issueWizard.description, '短い説明'); expect(target.querySelector('[role="alert"]')).toBeNull();
		await click(target, '次へ'); await click(target, '送信'); await vi.waitFor(() => expect(fixture.api).toHaveBeenCalledTimes(1));
	});
});
