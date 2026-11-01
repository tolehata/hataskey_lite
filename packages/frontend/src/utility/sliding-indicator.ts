/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Ref } from 'vue';

/**
 * 選ばれたタブの位置と大きさを測り、その下に敷いた1枚の「選択の下地」を滑らせる。
 * - 選択が変わったときだけ動かす（最初の表示や大きさの変化では瞬時に合わせる）
 * - 動きを減らす設定のときは CSS 側で transition を切る
 */
export function useSlidingIndicator(container: Ref<HTMLElement | null>, selector: string, selected: () => unknown) {
	const style = ref<Record<string, string>>({ opacity: '0' });
	const animate = ref(false);
	let observer: ResizeObserver | undefined;
	let frame = 0;

	function update(): void {
		const element = container.value?.querySelector<HTMLElement>(selector);
		if (!element || element.offsetWidth === 0) { style.value = { opacity: '0' }; return; }
		style.value = { opacity: '1', width: `${element.offsetWidth}px`, height: `${element.offsetHeight}px`, transform: `translate(${element.offsetLeft}px, ${element.offsetTop}px)` };
	}

	/** 動かさずに合わせ、次のフレームから動きを戻す */
	function snap(): void {
		animate.value = false;
		update();
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => { animate.value = true; });
	}

	watch(selected, () => { void nextTick(update); });
	onMounted(() => {
		snap();
		if (typeof ResizeObserver === 'function' && container.value) {
			observer = new ResizeObserver(snap);
			observer.observe(container.value);
		}
	});
	onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(frame); });

	return { style, animate, update };
}
