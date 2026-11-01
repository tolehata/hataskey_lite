/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { readFileSync } from 'node:fs';
import { createApp, h, nextTick, reactive } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { load } from 'js-yaml';
import HataskEventMembers from './HataskEventMembers.vue';
import type { App } from 'vue';
import type { HataskPlannerTemplate } from '@/utility/hatask-planner-storage.js';

const mocks = vi.hoisted(() => ({ popup: vi.fn(), selectUser: vi.fn(), inputText: vi.fn(), confirm: vi.fn(), api: vi.fn() }));
vi.mock('@/os.js', () => ({ popup: mocks.popup, selectUser: mocks.selectUser, inputText: mocks.inputText, confirm: mocks.confirm }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: load(readFileSync(`${process.cwd()}/../../locales/ja-JP.yml`, 'utf8')) } }));

const mounts: { app: App; el: HTMLDivElement }[] = [];
afterEach(() => { for (const { app, el } of mounts.splice(0)) { app.unmount(); el.remove(); } vi.resetAllMocks(); });

function required<T extends Element>(root: ParentNode, selector: string): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`Missing ${selector}`);
	return element;
}

async function settle() { for (let tick = 0; tick < 8; tick++) await nextTick(); }

async function fixture(ready = true) {
	mocks.api.mockResolvedValue([]);
	mocks.inputText.mockResolvedValue({ canceled: false, result: '集まり' });
	const template: HataskPlannerTemplate = { id: 'template', name: '定例', kind: 'members', position: 0, archivedAt: null, payload: { visibleUserIds: ['first', 'second'] } };
	const props = reactive({ modelValue: [] as string[], disabled: false, templatesReady: ready, templates: [template] });
	const save = vi.fn().mockResolvedValue(undefined); const remove = vi.fn().mockResolvedValue(undefined);
	const el = window.document.createElement('div'); window.document.body.append(el);
	const app = createApp({ render: () => h(HataskEventMembers, { ...props, save, remove, 'onUpdate:modelValue': value => { props.modelValue = value; } }) });
	app.mount(el); mounts.push({ app, el }); await settle();

	function button(text: string) { const found = [...el.querySelectorAll('button')].find(node => node.textContent.includes(text)); if (!found) throw new Error(`Missing button ${text}`); return found; }

	return { props, el, template, save, remove, button };
}

describe('event member editor', () => {
	test('manual selection uses local members and rejects duplicates', async () => {
		const f = await fixture(); mocks.selectUser.mockResolvedValue({ id: 'first', username: 'first', name: 'メンバー' });
		f.button('メンバーを追加').click(); await settle();
		f.button('メンバーを追加').click(); await settle();
		expect(mocks.selectUser).toHaveBeenCalledWith({ localOnly: true, includeSelf: false });
		expect(f.props.modelValue).toEqual(['first']);
		expect(f.el.querySelectorAll('li')).toHaveLength(1);
		required<HTMLButtonElement>(f.el, 'li button').click(); await settle();
		expect(f.props.modelValue).toEqual([]);
	});
	test('loading a template copies its members and later edits do not change the template', async () => {
		const f = await fixture(); const select = required<HTMLSelectElement>(f.el, 'select');
		select.value = 'template'; select.dispatchEvent(new Event('change')); await settle();
		expect(f.props.modelValue).toEqual(['first', 'second']);
		required<HTMLButtonElement>(f.el, 'li button').click(); await settle();
		expect(f.props.modelValue).toEqual(['second']);
		expect(f.template.payload.visibleUserIds).toEqual(['first', 'second']);
		f.button('このメンバー構成を保存').click(); await settle();
		expect(f.save).toHaveBeenCalledWith('集まり', ['second']);
	});
	test('failed template reads prevent overwriting templates but allow manual selection', async () => {
		const f = await fixture(false);
		expect(required<HTMLSelectElement>(f.el, 'select').disabled).toBe(true);
		expect(f.button('このメンバー構成を保存').disabled).toBe(true);
		expect(f.button('メンバーを追加').disabled).toBe(false);
		expect(f.save).not.toHaveBeenCalled();
	});
	test('save failures keep the current members and expose an error', async () => {
		const f = await fixture(); f.props.modelValue = ['first']; await settle();
		f.save.mockRejectedValue(new Error('conflict'));
		f.button('このメンバー構成を保存').click(); await settle();
		expect(f.el.querySelector('[role="alert"]')?.textContent).toContain('保存できませんでした');
		expect(f.props.modelValue).toEqual(['first']);
	});
});
