/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
const fixture = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn(), closes: 0, mounts: 0 }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/router.js', () => ({ useRouter: () => ({ pushByPath: fixture.push }) }));
// The browser locale loader fetches at module initialization; these control-flow tests need no network.
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/components/HyDialog.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: { bare: Boolean, back: Boolean, title: String }, emits: ['close', 'back', 'closed'], setup(props, { slots, emit, expose }) {
		fixture.mounts++; expose({ close: () => { fixture.closes++; emit('closed'); } });
		return () => h('section', { 'data-dialog': '' }, [h('button', { 'data-action': 'dialog-close', onClick: () => emit('close') }, '閉じる'), props.back ? h('button', { 'data-action': 'dialog-back', onClick: () => emit('back') }, '戻る') : null, !props.bare ? h('h2', props.title) : null, slots.default?.()]);
	} }) };
});
vi.mock('@/components/HyMediaCover.vue', async () => { const { defineComponent, h } = await import('vue'); return { default: defineComponent({ setup: () => () => h('span', '表紙') }) }; });
vi.mock('@/components/HatadyComposer.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: { kind: String, embedded: Boolean }, emits: ['done', 'back', 'closed'], setup(props, { emit, expose }) { expose({ requestClose: () => emit('closed') }); return () => h('div', { 'data-form': 'composer', 'data-kind': props.kind, 'data-embedded': props.embedded }, [h('button', { 'data-action': 'composer-back', onClick: () => emit('back') }, '戻る'), h('button', { 'data-action': 'composer-done', onClick: () => { emit('done', { id: 'log' }); emit('closed'); } }, '保存')]); } }) };
});
vi.mock('@/components/HatadyMediaSessionForm.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: { work: { type: Object, required: true }, embedded: Boolean }, emits: ['done', 'back', 'closed'], setup(props, { emit, expose }) { expose({ requestClose: () => emit('closed') }); return () => h('div', { 'data-form': 'session', 'data-work': props.work.id, 'data-embedded': props.embedded }, [h('button', { 'data-action': 'session-back', onClick: () => emit('back') }, '戻る'), h('button', { 'data-action': 'session-done', onClick: () => { emit('done', { id: 'session' }); emit('closed'); } }, '保存')]); } }) };
});
vi.mock('@/components/HatadyMediaWorkForm.vue', async () => {
	const { defineComponent, h } = await import('vue');
	return { default: defineComponent({ props: { kind: String, embedded: Boolean }, emits: ['done', 'back', 'closed'], setup(props, { emit, expose }) { expose({ requestClose: () => emit('closed') }); return () => h('div', { 'data-form': 'work', 'data-kind': props.kind }, [h('button', { 'data-action': 'work-back', onClick: () => emit('back') }, '戻る'), h('button', { 'data-action': 'work-done', onClick: () => { emit('done', { id: 'new-work', title: '新作', kind: props.kind }); emit('closed'); } }, '保存')]); } }) };
});
import HatadyActivityRecordChooser from '@/components/HatadyActivityRecordChooser.vue';
const cleanups: Array<() => void> = [];

async function settle() { await nextTick(); await Promise.resolve(); await nextTick(); }

function mountChooser() {
	const done = vi.fn(), closed = vi.fn(), target = window.document.createElement('div'); window.document.body.append(target);
	const app = createApp({ render: () => h(HatadyActivityRecordChooser, { onDone: done, onClosed: closed }) }); app.mount(target);
	cleanups.push(() => { app.unmount(); target.remove(); });
	return { target, done, closed, host: target.querySelector('[data-dialog]')! };
}

async function clickText(target: HTMLElement, text: string) {
	const button = Array.from(target.querySelectorAll('button')).find(button => button.textContent?.includes(text)); expect(button, `button ${text}`).toBeTruthy(); button!.click(); await settle();
}

async function action(target: HTMLElement, name: string) { const button = target.querySelector<HTMLButtonElement>(`[data-action="${name}"]`); expect(button, name).toBeTruthy(); button!.click(); await settle(); }

beforeEach(() => { fixture.closes = 0; fixture.mounts = 0; fixture.push.mockReset(); fixture.api.mockReset(); fixture.api.mockImplementation(async (_endpoint: string, payload: any) => [{ id: `${payload.kind}-work`, title: `${payload.kind} の作品`, kind: payload.kind }]); });
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); });

describe('one persistent activity entry dialog', () => {
	test('料理の確認で戻る・キャンセルは選択画面を保ち、確定だけ遷移する', async () => {
		const { target, host, closed } = mountChooser();
		await clickText(target, '料理');
		expect(target.textContent).toContain('Hatadyを離れてHataskのレシピ画面へ移動');
		expect(fixture.push).not.toHaveBeenCalled();
		await action(target, 'dialog-back');
		expect(target.querySelector('[data-dialog]')).toBe(host);
		expect(target.textContent).toContain('今日は、何をした？');
		await clickText(target, '料理');
		await clickText(target, 'キャンセル');
		expect(fixture.push).not.toHaveBeenCalled();
		await clickText(target, '料理');
		await clickText(target, 'Hataskで記録する');
		expect(fixture.push).toHaveBeenCalledExactlyOnceWith('/hatask?tab=recipe&from=hatady&action=cooking');
		expect(closed).toHaveBeenCalledOnce();
	});
	test.each([['勉強・読書', 'study'], ['運動', 'exercise'], ['作業', 'work']])('%s opens its embedded composer without replacing the outer modal', async (label, kind) => {
		const { target, host, done, closed } = mountChooser();
		await clickText(target, label);
		expect(target.querySelector('[data-dialog]')).toBe(host); expect(fixture.mounts).toBe(1); expect(fixture.closes).toBe(0);
		expect(target.querySelector('[data-form="composer"]')?.getAttribute('data-kind')).toBe(kind);
		expect(target.querySelector('[data-form="composer"]')?.getAttribute('data-embedded')).toBe('true');
		await action(target, 'composer-back'); expect(target.querySelectorAll('[data-form]').length).toBe(0); expect(target.querySelector('[data-dialog]')).toBe(host);
		await clickText(target, label); await action(target, 'composer-done'); expect(done).toHaveBeenCalledWith({ id: 'log' }); expect(closed).toHaveBeenCalledOnce();
	});
	test.each([['映画', 'movie'], ['ゲーム', 'game']])('%s chooses a work and opens its session within the same modal', async (label, kind) => {
		const { target, host } = mountChooser(); await clickText(target, label);
		expect(fixture.api).toHaveBeenCalledWith('hata/hatady/media/works/list', expect.objectContaining({ kind }));
		await clickText(target, `${kind} の作品`);
		expect(target.querySelector('[data-form="session"]')?.getAttribute('data-work')).toBe(`${kind}-work`); expect(target.querySelector('[data-dialog]')).toBe(host); expect(fixture.closes).toBe(0);
		await action(target, 'session-back'); expect(target.textContent).toContain(`${kind} の作品`); expect(target.querySelector('[data-dialog]')).toBe(host);
	});
	test('creating a work continues into its session instead of closing the recording flow', async () => {
		const { target, host, done } = mountChooser(); await clickText(target, '映画'); await clickText(target, '作品を登録');
		await action(target, 'work-done');
		expect(fixture.closes).toBe(0); expect(done).not.toHaveBeenCalled(); expect(target.querySelector('[data-dialog]')).toBe(host); expect(target.querySelector('[data-form="session"]')?.getAttribute('data-work')).toBe('new-work');
		await action(target, 'session-done'); expect(done).toHaveBeenCalledWith({ id: 'session' }); expect(fixture.closes).toBe(1);
	});
	test('an older request cannot overwrite a later category selection', async () => {
		const requests: Array<(value: unknown) => void> = [];
		fixture.api.mockImplementation(() => new Promise(resolve => requests.push(resolve)));
		const { target } = mountChooser(); await clickText(target, '映画'); await action(target, 'dialog-back'); await clickText(target, 'ゲーム');
		expect(requests).toHaveLength(2);
		requests[1]([{ id: 'game', kind: 'game', title: '最新のゲーム' }]); await settle(); requests[0]([{ id: 'movie', kind: 'movie', title: '古い映画' }]); await settle();
		expect(target.textContent).toContain('最新のゲーム'); expect(target.textContent).not.toContain('古い映画');
	});
	test('work loading failure keeps retry available without changing the modal', async () => {
		fixture.api.mockRejectedValueOnce(new Error('offline'));
		const { target, host } = mountChooser(); await clickText(target, '映画'); expect(target.textContent).toContain('読み込めませんでした');
		await clickText(target, '再読み込み'); expect(target.textContent).toContain('movie の作品'); expect(target.querySelector('[data-dialog]')).toBe(host);
	});
});
