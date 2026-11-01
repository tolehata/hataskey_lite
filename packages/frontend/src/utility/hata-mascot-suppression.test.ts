/* SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, KeepAlive, nextTick, ref } from 'vue';
import { afterEach, expect, test } from 'vitest';
import { hataMascotSuppressed, useHataMascotSuppression } from './hata-mascot-suppression.js';

const mounted: { unmount: () => void; element: HTMLElement }[] = [];

function mount(active = ref(true)) {
	const element = window.document.createElement('div');
	window.document.body.append(element);
	const app = createApp(defineComponent({ setup() { useHataMascotSuppression(active); return () => h('div'); } }));
	app.mount(element);
	mounted.push({ unmount: () => app.unmount(), element });
	return active;
}

afterEach(() => {
	for (const item of mounted.splice(0)) { item.unmount(); item.element.remove(); }
});

test('複数の表示 claim を個別に解除し、最後の画面を閉じると元に戻る', async () => {
	const first = mount();
	const second = mount();
	expect(hataMascotSuppressed.value).toBe(true);
	first.value = false;
	await nextTick();
	expect(hataMascotSuppressed.value).toBe(true);
	second.value = false;
	await nextTick();
	expect(hataMascotSuppressed.value).toBe(false);
	first.value = true;
	await nextTick();
	expect(hataMascotSuppressed.value).toBe(true);
});

test('KeepAlive で非アクティブになった画面は claim を外して復帰時に再登録する', async () => {
	const show = ref(true);
	const Child = defineComponent({ setup() { useHataMascotSuppression(true); return () => h('div'); } });
	const Other = defineComponent({ setup: () => () => h('span') });
	const element = window.document.createElement('div');
	window.document.body.append(element);
	const app = createApp(defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => show.value ? h(Child) : h(Other) }) }));
	app.mount(element);
	mounted.push({ unmount: () => app.unmount(), element });
	expect(hataMascotSuppressed.value).toBe(true);
	show.value = false;
	await nextTick();
	expect(hataMascotSuppressed.value).toBe(false);
	show.value = true;
	await nextTick();
	expect(hataMascotSuppressed.value).toBe(true);
});
