/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const fixture = vi.hoisted(() => ({ api: vi.fn(), notify: vi.fn(), finish: vi.fn(), close: vi.fn(), save: vi.fn(), saved: null as Record<string, unknown> | null, saveSuccess: true }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/utility/hatafeed-ui.js', () => ({ hataFeedNotify: fixture.notify }));
vi.mock('@/utility/hatasaba-device-prefs.js', async () => ({ hataFeedTheme: (await import('vue')).ref('light') }));
vi.mock('@/utility/drive.js', () => ({ chooseDriveFile: vi.fn() }));
vi.mock('@/utility/hatafeed-draft.js', async () => {
	const { ref } = await import('vue');
	return { useHataFeedDraft: (options: { capture: () => Record<string, unknown>; restore: (draft: Record<string, unknown>) => void }) => {
		const hasDraft = ref(fixture.saved != null);
		return {
			saveDraft: () => fixture.save(options.capture()),
			finishSubmission: () => { fixture.saved = null; fixture.finish(); },
			beforeClose: () => true, prompt: false, hasDraft,
			resumeDraft: () => { if (fixture.saved) options.restore(fixture.saved); hasDraft.value = false; },
		};
	} };
});
vi.mock('@/i18n.js', async () => ({ i18n: (await import('@/utility/hatask-test-i18n.js')).createTestHataskI18n() }));
vi.mock('@/components/MkWindow.vue', () => ({ default: defineComponent({ setup(_, { slots, expose }) { expose({ close: fixture.close }); return () => h('section', slots.default?.()); } }) }));
vi.mock('@/components/MkButton.vue', () => ({ default: defineComponent({ props: ['disabled'], setup(props, { slots, attrs }) { return () => h('button', { ...attrs, disabled: props.disabled }, slots.default?.()); } }) }));
vi.mock('@/components/MkInput.vue', () => ({ default: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup(props, { slots, emit }) { return () => h('label', [slots.label?.(), h('input', { value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value) })]); } }) }));
vi.mock('@/components/MkTextarea.vue', () => ({ default: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup(props, { slots, emit }) { return () => h('label', [slots.label?.(), h('textarea', { value: props.modelValue, onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value) })]); } }) }));
import HataFeedRoadmapWizard from './HataFeedRoadmapWizard.vue';

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); fixture.api.mockReset(); fixture.notify.mockReset(); fixture.finish.mockReset(); fixture.close.mockReset(); fixture.save.mockReset(); fixture.saved = null; fixture.saveSuccess = true; });

async function mount(host: boolean) {
	fixture.save.mockImplementation((draft: Record<string, unknown>) => { if (!fixture.saveSuccess) return false; fixture.saved = JSON.parse(JSON.stringify(draft)); return true; });
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp(HataFeedRoadmapWizard);
	if (host) app.provide(HATA_GOES_HOST, {} as never);
	app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	await nextTick();
	return target;
}

function button(target: HTMLElement, label: string) {
	const result = [...target.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label);
	if (!result) throw new Error(`Missing button: ${label}`);
	return result;
}

describe('HataFeedRoadmapWizard', () => {
	test('host flow retries a failed status update without creating another issue', async () => {
		let updateCount = 0;
		fixture.api.mockImplementation((endpoint: string) => {
			if (endpoint.endsWith('/create')) return Promise.resolve({ id: 'created-roadmap' });
			if (endpoint.endsWith('/update')) return ++updateCount === 1 ? Promise.reject(new Error('temporary')) : Promise.resolve({});
			throw new Error(`Unexpected endpoint: ${endpoint}`);
		});
		const target = await mount(true);
		const input = target.querySelector<HTMLInputElement>('input');
		expect(input).toBeInstanceOf(HTMLInputElement);
		input!.value = '改善予定';
		input!.dispatchEvent(new Event('input', { bubbles: true }));
		await nextTick();
		button(target, '次へ').click();
		await nextTick();
		button(target, '次へ').click();
		await nextTick();
		button(target, '掲示する').click();
		await vi.waitFor(() => expect(target.querySelector('[role="alert"]')?.textContent).toContain('状態を保存できませんでした'));
		expect(fixture.finish).not.toHaveBeenCalled();
		expect(fixture.saved).toMatchObject({ createdIssueId: 'created-roadmap', status: 'planned' });
		expect(target.textContent).toContain('状態の保存だけを再試行します');
		expect([...target.querySelectorAll('button')].some(item => item.textContent?.trim() === '戻る')).toBe(false);
		button(target, '掲示する').click();
		await vi.waitFor(() => expect(fixture.finish).toHaveBeenCalledOnce());
		expect(fixture.api.mock.calls.filter(([endpoint]) => String(endpoint).endsWith('/create'))).toHaveLength(1);
		expect(fixture.api.mock.calls.filter(([endpoint]) => String(endpoint).endsWith('/update'))).toHaveLength(2);
		expect(fixture.close).toHaveBeenCalledOnce();
	});

	test('resumes a partially published roadmap by updating the original issue', async () => {
		let updateCount = 0;
		fixture.api.mockImplementation((endpoint: string) => {
			if (endpoint.endsWith('/create')) return Promise.resolve({ id: 'created-roadmap' });
			if (endpoint.endsWith('/update')) return ++updateCount === 1 ? Promise.reject(new Error('temporary')) : Promise.resolve({});
			throw new Error(`Unexpected endpoint: ${endpoint}`);
		});
		const first = await mount(true);
		const input = first.querySelector<HTMLInputElement>('input')!;
		input.value = '改善予定'; input.dispatchEvent(new Event('input', { bubbles: true }));
		await nextTick(); button(first, '次へ').click(); await nextTick(); button(first, '次へ').click(); await nextTick();
		button(first, '掲示する').click();
		await vi.waitFor(() => expect(first.querySelector('[role="alert"]')?.textContent).toContain('状態を保存できませんでした'));
		expect(fixture.saved).toMatchObject({ title: '改善予定', createdIssueId: 'created-roadmap' });
		cleanups.splice(0).forEach(cleanup => cleanup());
		const resumed = await mount(true);
		button(resumed, '続きから編集').click();
		await nextTick();
		expect(resumed.textContent).toContain('改善予定');
		expect([...resumed.querySelectorAll('button')].some(item => item.textContent?.trim() === '戻る')).toBe(false);
		button(resumed, '掲示する').click();
		await vi.waitFor(() => expect(fixture.finish).toHaveBeenCalledOnce());
		expect(fixture.api.mock.calls.filter(([endpoint]) => String(endpoint).endsWith('/create'))).toHaveLength(1);
		expect(fixture.api.mock.calls.filter(([endpoint]) => String(endpoint).endsWith('/update'))).toEqual([
		['hata/feedback/issues/update', { issueId: 'created-roadmap', status: 'planned' }],
		['hata/feedback/issues/update', { issueId: 'created-roadmap', status: 'planned' }],
	]);
		expect(fixture.saved).toBeNull();
	});

	test('finishes the same issue when checkpoint storage fails but status update succeeds', async () => {
		fixture.saveSuccess = false;
		fixture.api.mockImplementation((endpoint: string) => endpoint.endsWith('/create') ? Promise.resolve({ id: 'created-roadmap' }) : Promise.resolve({}));
		const target = await mount(true);
		const input = target.querySelector<HTMLInputElement>('input')!;
		input.value = '改善予定'; input.dispatchEvent(new Event('input', { bubbles: true }));
		await nextTick(); button(target, '次へ').click(); await nextTick(); button(target, '次へ').click(); await nextTick();
		button(target, '掲示する').click();
		await vi.waitFor(() => expect(fixture.finish).toHaveBeenCalledOnce());
		expect(fixture.notify).toHaveBeenCalledWith(expect.stringContaining('下書きを保存できませんでした'));
		expect(fixture.api.mock.calls.filter(([endpoint]) => String(endpoint).endsWith('/create'))).toHaveLength(1);
		expect(fixture.api.mock.calls.filter(([endpoint]) => String(endpoint).endsWith('/update'))).toEqual([
		['hata/feedback/issues/update', { issueId: 'created-roadmap', status: 'planned' }],
	]);
		expect(fixture.saved).toBeNull();
	});

	test('legacy route keeps the one-screen form without requiring a checkpoint', async () => {
		const target = await mount(false);
		expect(target.textContent).toContain('対応予定');
		expect(target.textContent).not.toContain('次へ');
		expect(button(target, '掲示する')).toBeInstanceOf(HTMLButtonElement);
		const input = target.querySelector<HTMLInputElement>('input')!;
		input.value = '旧ルートの予定'; input.dispatchEvent(new Event('input', { bubbles: true }));
		fixture.saveSuccess = false;
		fixture.api.mockImplementation((endpoint: string) => endpoint.endsWith('/create') ? Promise.resolve({ id: 'legacy-roadmap' }) : Promise.resolve({}));
		await nextTick(); button(target, '掲示する').click();
		await vi.waitFor(() => expect(fixture.finish).toHaveBeenCalledOnce());
		expect(fixture.save).not.toHaveBeenCalled();
		expect(fixture.api.mock.calls.filter(([endpoint]) => String(endpoint).endsWith('/create'))).toHaveLength(1);
	});
});
