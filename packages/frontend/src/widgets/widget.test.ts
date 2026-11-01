/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { effectScope, nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useWidgetPropsManager } from './widget.js';
import type { EffectScope } from 'vue';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import * as os from '@/os.js';

vi.mock('@/os.js', () => ({ form: vi.fn() }));

const definition = {
	height: { type: 'number', default: 300 },
	excludeBots: { type: 'boolean', default: false, hidden: true },
	excludeTypes: { type: 'array', default: [] as string[], hidden: true },
} satisfies FormWithDefault;
type WidgetProps = GetFormResultType<typeof definition>;
const scopes: EffectScope[] = [];

function createFixture() {
	let stored = JSON.stringify({ height: 300, excludeBots: false, excludeTypes: [] });
	const parent = reactive({ widget: { id: 'notifications-1', data: JSON.parse(stored) as WidgetProps } });
	const emitted: WidgetProps[] = [];
	const createInstance = () => {
		const scope = effectScope();
		scopes.push(scope);
		return scope.run(() => useWidgetPropsManager('notifications', definition, parent, (_event, data) => {
			emitted.push(data);
			stored = JSON.stringify(data);
			parent.widget = { id: parent.widget.id, data: JSON.parse(stored) as WidgetProps };
		}))!;
	};
	return { parent, emitted, createInstance, readSaved: () => JSON.parse(stored) as WidgetProps };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-09-09T00:00:00Z'));
	vi.mocked(os.form).mockReset();
});

afterEach(() => {
	for (const scope of scopes.splice(0)) scope.stop();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('widget props persistence', () => {
	test('同じIDの別表示からのBot設定を取り込み、別項目の保存でも維持する', () => {
		const fixture = createFixture();
		const first = fixture.createInstance();
		const second = fixture.createInstance();
		first.widgetProps.excludeBots = true;
		first.save();
		expect(second.widgetProps.excludeBots).toBe(true);

		second.widgetProps.height = 420;
		second.save();
		expect(fixture.readSaved()).toMatchObject({ excludeBots: true, height: 420 });
		expect(fixture.createInstance().widgetProps.excludeBots).toBe(true);
	});

	test('親の設定更新は未保存の項目や配列の編集を消さない', () => {
		const fixture = createFixture();
		const first = fixture.createInstance();
		const second = fixture.createInstance();
		second.widgetProps.height = 420;
		second.widgetProps.excludeTypes.push('follow');
		first.widgetProps.excludeBots = true;
		first.save();

		expect(second.widgetProps).toMatchObject({ excludeBots: true, height: 420, excludeTypes: ['follow'] });
		second.save();
		expect(fixture.readSaved()).toMatchObject({ excludeBots: true, height: 420, excludeTypes: ['follow'] });
	});

	test('親が同じ項目を更新しても未保存のローカル編集を優先する', () => {
		const fixture = createFixture();
		const first = fixture.createInstance();
		const second = fixture.createInstance();
		second.widgetProps.height = 420;
		first.widgetProps.height = 500;
		first.save();
		expect(second.widgetProps.height).toBe(420);
		second.save();
		expect(fixture.readSaved().height).toBe(420);
	});

	test('通常保存は初回即時、続く保存を3秒まで間引く', () => {
		const fixture = createFixture();
		const instance = fixture.createInstance();
		instance.widgetProps.height = 400;
		instance.save();
		expect(fixture.readSaved().height).toBe(400);
		instance.widgetProps.height = 500;
		instance.save();
		expect(fixture.readSaved().height).toBe(400);
		vi.advanceTimersByTime(3000);
		expect(fixture.readSaved().height).toBe(500);
		expect(fixture.emitted).toHaveLength(2);
	});

	test('明示した即時保存は待機中の保存をまとめて確定し、すぐ再読込できる', () => {
		const fixture = createFixture();
		const instance = fixture.createInstance();
		instance.widgetProps.height = 400;
		instance.save();
		instance.widgetProps.height = 500;
		instance.save();
		instance.widgetProps.excludeBots = true;
		instance.save({ immediate: true });
		expect(fixture.readSaved()).toMatchObject({ height: 500, excludeBots: true });
		expect(fixture.createInstance().widgetProps.excludeBots).toBe(true);
		vi.advanceTimersByTime(3000);
		expect(fixture.emitted).toHaveLength(2);
		// 保存イベントの引数も、以降のローカル変更から切り離しておく。
		instance.widgetProps.height = 600;
		expect(fixture.emitted[0]).toMatchObject({ height: 400, excludeBots: false });
		expect(fixture.emitted[1]).toMatchObject({ height: 500, excludeBots: true });
	});

	test('設定フォームを開いている間に別表示で保存されたBot設定を巻き戻さない', async () => {
		const fixture = createFixture();
		const first = fixture.createInstance();
		const second = fixture.createInstance();
		let finish!: (result: { canceled: false; result: WidgetProps }) => void;
		vi.mocked(os.form).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
		const configuring = second.configure();
		first.widgetProps.excludeBots = true;
		first.save();
		finish({ canceled: false, result: { height: 420, excludeBots: false, excludeTypes: [] } });
		await configuring;
		expect(fixture.readSaved()).toMatchObject({ height: 420, excludeBots: true });
	});

	test('未保存の既定配列を別のウィジェットや定義と共有しない', async () => {
		const scope = effectScope();
		scopes.push(scope);
		const first = scope.run(() => useWidgetPropsManager('notifications', definition, {}, vi.fn()))!;
		const second = scope.run(() => useWidgetPropsManager('notifications', definition, {}, vi.fn()))!;
		first.widgetProps.excludeTypes.push('follow');
		await nextTick();
		expect(second.widgetProps.excludeTypes).toEqual([]);
		expect(definition.excludeTypes.default).toEqual([]);
	});
});
