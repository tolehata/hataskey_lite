/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 旗鯖fork: 横開きの折りたたみ端末(Fold等)のメインディスプレイ向け判定。
 *
 * ⚠️機種名では判定しない。対象端末は増え続けるので必ず破綻する。
 *   「PCほど広くはないが、スマホよりは広く、指で操作する」という条件で拾う。
 * ⚠️クラムシェル(Flip/Razr)のメイン画面は通常のスマホ比率なので、幅が足りず自然に対象外になる。
 *   これは意図した仕様。あちらはPCライクにしても操作しづらいだけ。
 * ⚠️閾値は実機の実測値が無いままの暫定値。実測後に見直すこと。
 */

import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import type { Ref } from 'vue';
import { foldableLayoutMode } from '@/utility/hatasaba-device-prefs.js';

/** 折りたたみ端末とみなす下限幅。これ未満は通常のスマホ表示のまま。 */
export const FOLDABLE_MIN_WIDTH = 600;

/**
 * 現在の画面が「折りたたみ端末の広い面」かどうか。
 * @param desktopThreshold これ以上ならPC表示なので対象外にする幅。
 */
export function useFoldableWide(desktopThreshold: number) {
	const width = ref(window.innerWidth);
	// ⚠️指で操作する端末に限る。狭くしたPCのウィンドウで誤発動させないため。
	const coarsePointer = ref(window.matchMedia('(pointer: coarse)').matches);

	function update(): void {
		width.value = window.innerWidth;
		coarsePointer.value = window.matchMedia('(pointer: coarse)').matches;
	}

	onMounted(() => window.addEventListener('resize', update, { passive: true }));
	onUnmounted(() => window.removeEventListener('resize', update));

	const autoDetected = computed(() =>
		coarsePointer.value &&
		width.value >= FOLDABLE_MIN_WIDTH &&
		width.value < desktopThreshold);

	return computed(() => {
		if (foldableLayoutMode.value === 'on') return true;
		if (foldableLayoutMode.value === 'off') return false;
		return autoDetected.value;
	});
}

/**
 * 折りたたむ/開くでレイアウトが切り替わっても、いま読んでいた位置を保つ。
 *
 * 端末を開くと幅が変わり、本文が折り返し直されるので scrollTop は意味を失う。
 * そこで「画面の一番上に見えていた要素」を覚えておき、切り替え後に同じ要素が
 * 同じ高さに来るよう scrollTop を調整し直す。
 *
 * ⚠️目印は resize より前に取っておく必要がある。resize が飛んでくる時点では
 *   ブラウザは既に折り返し直したあとで、そこから元の位置は復元できない。
 *   そのためスクロール中に(1フレームに1回だけ)目印を更新しておく。
 * ⚠️elementFromPoint を使うのは、スクローラの直下が単なるラッパー1枚のことがあり、
 *   直下の子を見るだけでは位置の目印にならないため。座標から最も深い要素を直接拾う。
 *
 * @param isWide useFoldableWide() の戻り値。これが変わった瞬間を切り替えとみなす。
 * @param getScroller スクロールする要素を返す関数。まだ無ければ null でよい。
 */
export function useFoldableScrollAnchor(isWide: Ref<boolean>, getScroller: () => HTMLElement | null | undefined): void {
	// 目印の要素と、スクローラ上端からの距離(px)。
	let anchorEl: Element | null = null;
	let anchorOffset = 0;
	let rafId = 0;

	function capture(): void {
		const sc = getScroller();
		if (!sc) return;
		const rect = sc.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		// 上端ちょうどだとスクローラ自身を拾うことがあるので少しだけ内側を見る。
		const el = window.document.elementFromPoint(rect.left + rect.width / 2, rect.top + 2);
		if (!el || el === sc || !sc.contains(el)) return;
		anchorEl = el;
		anchorOffset = el.getBoundingClientRect().top - rect.top;
	}

	function onScroll(): void {
		if (rafId !== 0) return;
		rafId = window.requestAnimationFrame(() => {
			rafId = 0;
			capture();
		});
	}

	function restore(): void {
		const sc = getScroller();
		if (!sc || !anchorEl || !anchorEl.isConnected || !sc.contains(anchorEl)) return;
		const delta = (anchorEl.getBoundingClientRect().top - sc.getBoundingClientRect().top) - anchorOffset;
		if (Math.abs(delta) >= 1) sc.scrollTop += delta;
	}

	watch(isWide, () => {
		nextTick(() => {
			restore();
			// 画像やCSS遷移で1フレーム遅れて高さが確定することがあるので、もう一度合わせる。
			window.requestAnimationFrame(() => {
				restore();
				capture();
			});
		});
	});

	// スクロールは document 側で拾う。スクローラ要素はマウント後に差し替わることがあり、
	// 要素へ直接張ると付け外しの管理が増えるため。capture 側で対象を毎回引き直す。
	onMounted(() => window.document.addEventListener('scroll', onScroll, { capture: true, passive: true }));
	onUnmounted(() => {
		window.document.removeEventListener('scroll', onScroll, { capture: true });
		if (rafId !== 0) window.cancelAnimationFrame(rafId);
	});
}
