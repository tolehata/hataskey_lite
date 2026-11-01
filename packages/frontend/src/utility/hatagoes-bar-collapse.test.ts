/* SPDX-License-Identifier: AGPL-3.0-only */
import { computed, effectScope, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useHatagoesBarCollapse } from './hatagoes-bar-collapse.js';

describe('HataGoes temporary bar collapse', () => {
	it('persists normal-page toggles through the existing setter', () => {
		const active = ref(false);
		const saved = ref(false);
		const write = vi.fn((value: boolean) => { saved.value = value; });
		const scope = effectScope();
		const collapsed = scope.run(() => useHatagoesBarCollapse(active, () => saved.value, write));
		if (!collapsed) throw new Error('Scope did not initialize');
		try {
			collapsed.value = true;
			expect(write).toHaveBeenCalledWith(true);
			expect(saved.value).toBe(true);
		} finally {
			scope.stop();
		}
	});

	it.each([false, true])('keeps saved collapsed=%s unchanged and restores it on exit', initial => {
		const active = ref(false);
		const saved = ref(initial);
		const write = vi.fn((value: boolean) => { saved.value = value; });
		const scope = effectScope();
		const collapsed = scope.run(() => useHatagoesBarCollapse(active, () => saved.value, write));
		if (!collapsed) throw new Error('Scope did not initialize');
		try {
			active.value = true;
			expect(collapsed.value).toBe(true);
			collapsed.value = false;
			expect(collapsed.value).toBe(false);
			expect(saved.value).toBe(initial);
			expect(write).not.toHaveBeenCalled();
			active.value = false;
			expect(collapsed.value).toBe(initial);
			active.value = true;
			expect(collapsed.value).toBe(true);
		} finally {
			scope.stop();
		}
	});

	it('starts collapsed on a direct visit and preserves manual expansion across internal screen changes', () => {
		const route = ref('/hatagoes?app=home');
		const active = computed(() => route.value.split('?')[0] === '/hatagoes');
		const scope = effectScope();
		const collapsed = scope.run(() => useHatagoesBarCollapse(active, () => false));
		if (!collapsed) throw new Error('Scope did not initialize');
		try {
			expect(collapsed.value).toBe(true);
			collapsed.value = false;
			route.value = '/hatagoes?app=hatask';
			expect(collapsed.value).toBe(false);
			route.value = '/hatask';
			expect(collapsed.value).toBe(false);
			route.value = '/hatagoes';
			expect(collapsed.value).toBe(true);
		} finally {
			scope.stop();
		}
	});

	it('keeps both bars independent and leaves persistent preferences intact when the shell unmounts', () => {
		const active = ref(true);
		const savedLeft = ref(false);
		const savedRight = ref(true);
		const scope = effectScope();
		const bars = scope.run(() => ({
			left: useHatagoesBarCollapse(active, () => savedLeft.value),
			right: useHatagoesBarCollapse(active, () => savedRight.value),
		}));
		if (!bars) throw new Error('Scope did not initialize');
		bars.left.value = false;
		expect(bars.right.value).toBe(true);
		bars.right.value = false;
		scope.stop();
		expect(savedLeft.value).toBe(false);
		expect(savedRight.value).toBe(true);
	});
});
