/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ref, watch, onBeforeUnmount } from 'vue';
import type { Ref } from 'vue';

export function useTooltip(
	elRef: Ref<HTMLElement | { $el: HTMLElement } | null | undefined>,
	onShow: (showing: Ref<boolean>) => void,
	delay = 300,
): void {
	let isHovering = false;

	// iOS(Androidも？)では、要素をタップした直後に(おせっかいで)mouseoverイベントを発火させたりするため、それを無視するためのフラグ
	// 無視しないと、画面に触れてないのにツールチップが出たりし、ユーザビリティが損なわれる
	// TODO: 一度でもタップすると二度とマウスでツールチップ出せなくなるのをどうにかする 定期的にfalseに戻すとか...？
	let shouldIgnoreMouseover = false;

	let timeoutId: number;

	let changeShowingState: (() => void) | null;

	let autoHidingTimer;

	const open = () => {
		close();
		if (!isHovering) return;
		if (elRef.value == null) return;
		const el = elRef.value instanceof Element ? elRef.value : elRef.value.$el;
		if (!window.document.body.contains(el)) return; // openしようとしたときに既に元要素がDOMから消えている場合があるため

		const showing = ref(true);
		onShow(showing);
		changeShowingState = () => {
			showing.value = false;
		};

		autoHidingTimer = window.setInterval(() => {
			if (elRef.value == null || !window.document.body.contains(elRef.value instanceof Element ? elRef.value : elRef.value.$el)) {
				if (!isHovering) return;
				isHovering = false;
				window.clearTimeout(timeoutId);
				close();
				window.clearInterval(autoHidingTimer);
			}
		}, 1000);
	};

	const close = () => {
		if (changeShowingState != null) {
			changeShowingState();
			changeShowingState = null;
		}
	};

	const onMouseover = () => {
		if (isHovering) return;
		if (shouldIgnoreMouseover) return;
		isHovering = true;
		timeoutId = window.setTimeout(open, delay);
	};

	const onMouseleave = () => {
		if (!isHovering) return;
		isHovering = false;
		window.clearTimeout(timeoutId);
		window.clearInterval(autoHidingTimer);
		close();
	};

	let ignoreMouseoverTimer: number | undefined;

	const cancelTouchTooltip = () => {
		shouldIgnoreMouseover = true;
		isHovering = false;
		window.clearTimeout(timeoutId);
		window.clearInterval(autoHidingTimer);
		close();
		window.clearTimeout(ignoreMouseoverTimer);
		// iOS がタップ後に合成する mouseover だけを無視し、後から接続した
		// マウスまで永久に無効化しない。
		ignoreMouseoverTimer = window.setTimeout(() => {
			shouldIgnoreMouseover = false;
		}, 1200);
	};

	const stop = watch(elRef, () => {
		if (elRef.value) {
			stop();
			const el = elRef.value instanceof Element ? elRef.value : elRef.value.$el;
			el.addEventListener('mouseover', onMouseover, { passive: true });
			el.addEventListener('mouseleave', onMouseleave, { passive: true });
			// タッチ開始から合成 click までに非同期取得とツールチップDOM追加を
			// 挟まない。iOSではこの途中変更がclick対象を失わせることがあるため、
			// タッチでは実操作を必ず優先する。
			el.addEventListener('touchstart', cancelTouchTooltip, { passive: true });
			el.addEventListener('touchend', cancelTouchTooltip, { passive: true });
			el.addEventListener('touchcancel', cancelTouchTooltip, { passive: true });
			el.addEventListener('click', close, { passive: true });
		}
	}, {
		immediate: true,
		flush: 'post',
	});

	onBeforeUnmount(() => {
		window.clearTimeout(ignoreMouseoverTimer);
		close();
		if (elRef.value) {
			const el = elRef.value instanceof Element ? elRef.value : elRef.value.$el;
			el.removeEventListener('mouseover', onMouseover);
			el.removeEventListener('mouseleave', onMouseleave);
			el.removeEventListener('touchstart', cancelTouchTooltip);
			el.removeEventListener('touchend', cancelTouchTooltip);
			el.removeEventListener('touchcancel', cancelTouchTooltip);
			el.removeEventListener('click', close);
		}
	});
}
