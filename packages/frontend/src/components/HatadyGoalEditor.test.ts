/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, provide, ref } from 'vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const fixture = vi.hoisted(() => ({ api: vi.fn(), confirm: vi.fn(), clear: vi.fn(), notify: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/os.js', () => ({ confirm: fixture.confirm }));
vi.mock('@/utility/hata-form-draft.js', () => ({ useHataFormDraft: () => ({ hasChanges: () => false, clearDraft: fixture.clear, restored: { value: false } }) }));
vi.mock('@/utility/hatady-ui.js', () => ({ hatadyNotify: fixture.notify }));
vi.mock('@/utility/hatady-home.js', () => ({ localDateKey: () => '2026-10-02' }));
vi.mock('@/i18n.js', () => ({ i18n: {
	ts: { _hata: { _hatady: {
		_goalEditor: { editGoal: '目標を編集', nextGoal: '次の目標', goal: '目標', goalPlaceholder: '', note: 'ひとこと', optional: '任意', period: '期間', goalPeriod: '期間', deadline: '期限', metric: '目安', target: '目標', progressHint: '', close: '閉じる', save: '保存する', createGoal: '目標を作る', shortTerm: '短期', longTerm: '長期', manual: '手動', time: '時間', logCount: '記録', bookCount: '本', minuteUnit: '分', recordUnit: '件', bookUnit: '冊', savedDraftDeleteFailed: '下書き削除失敗', saveFailed: '保存失敗' },
		_goals: { delete: '目標を削除' },
	} } },
	tsx: { _hata: { _hatady: { _goals: { confirmDelete: ({ title }: { title: string }) => `${title}を削除しますか？` } } } },
} }));
vi.mock('@/components/HyDialog.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ emits: ['closed'], setup(_, { slots, emit, expose }) {
		expose({ close: () => emit('closed') });
		return () => render('section', [slots.default?.(), render('footer', slots.actions?.())]);
	} }) };
});
vi.mock('@/components/HyCapsule.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ setup: () => () => render('div') }) };
});
vi.mock('@/components/HatadyDraftPrompt.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({ setup: () => () => render('div') }) };
});

import HatadyGoalEditor from './HatadyGoalEditor.vue';

const cleanup: (() => void)[] = [];
beforeEach(() => { fixture.api.mockReset(); fixture.confirm.mockReset(); fixture.clear.mockReset().mockReturnValue(true); fixture.notify.mockReset(); });
afterEach(() => cleanup.splice(0).forEach(fn => fn()));

function mount(host: boolean) {
	const done = vi.fn(), closed = vi.fn();
	const target = window.document.createElement('div');
	window.document.body.append(target);
	const app = createApp({ setup() {
		if (host) provide(HATA_GOES_HOST, { active: ref(true), register: vi.fn(), changed: vi.fn() });
		return () => h(HatadyGoalEditor, { goal: { id: 'goal-one', title: '読書を続ける', termType: 'short' }, onDone: done, onClosed: closed });
	} });
	app.mount(target);
	cleanup.push(() => { app.unmount(); target.remove(); });
	return { target, done, closed };
}

describe('Hatady goal editor delete action', () => {
	test('legacy editor does not expose delete', () => {
		const { target } = mount(false);
		expect(target.textContent).not.toContain('目標を削除');
	});
	test('embedded editor uses the existing confirmation and delete endpoint', async () => {
		fixture.confirm.mockResolvedValue({ canceled: false });
		fixture.api.mockResolvedValue(undefined);
		const { target, done, closed } = mount(true);
		Array.from(target.querySelectorAll('button')).find(button => button.textContent === '目標を削除')!.click();
		await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
		expect(fixture.confirm).toHaveBeenCalledWith({ type: 'warning', text: '読書を続けるを削除しますか？' }, expect.any(Function));
		expect(fixture.api).toHaveBeenCalledExactlyOnceWith('hata/hatady/goals/delete', { goalId: 'goal-one' });
		expect(fixture.clear).toHaveBeenCalledOnce();
		expect(closed).toHaveBeenCalledOnce();
	});
	test('canceling deletion leaves goal and draft untouched', async () => {
		fixture.confirm.mockResolvedValue({ canceled: true });
		const { target, done } = mount(true);
		Array.from(target.querySelectorAll('button')).find(button => button.textContent === '目標を削除')!.click();
		await nextTick();
		await nextTick();
		expect(fixture.api).not.toHaveBeenCalled();
		expect(fixture.clear).not.toHaveBeenCalled();
		expect(done).not.toHaveBeenCalled();
	});
});
