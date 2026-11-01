<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only

旗鯖fork: 設定画面の右ペインへ埋め込むための「枠なし窓」。

⚠️MkWindow / MkModalWindow / MkModal はどれも position: fixed の重ね表示で、
  CSS では right ペインの中に収められない。そこで**窓そのものを差し替える**。
  受け口（#header / 本体 / #footer / close()）を既存の窓と同じ形に揃えてあるので、
  各画面は `<component :is="...">` の付け替えだけで埋め込みへ回せる。

⚠️窓の寸法・リサイズ用 props は、DOMへ落とさないように受け取る。
  保存・閉じる操作は元の窓と同じイベント契約を維持する。
-->

<template>
<section :class="[$style.root, panelClass]" :data-hatask-theme="panelTheme" :data-hatask-mode="panelMode">
	<header v-if="$slots.header || withOkButton" :class="$style.head">
		<h2 v-if="$slots.header" :class="$style.title"><slot name="header"></slot></h2>
		<MkButton v-if="withOkButton" type="button" primary gradate rounded :class="$style.action" data-testid="settings-embedded-ok" :disabled="okButtonDisabled" @click="emit('ok')">{{ i18n.ts.done }} <i class="ti ti-check" aria-hidden="true"></i></MkButton>
		<button v-if="closeButton ?? withCloseButton" type="button" class="_button" :class="$style.action" data-testid="settings-embedded-close" :aria-label="i18n.ts.close" @click="requestClose"><i class="ti ti-x" aria-hidden="true"></i></button>
	</header>
	<div :class="$style.body">
		<slot></slot>
	</div>
	<footer v-if="$slots.footer" :class="$style.foot">
		<slot name="footer"></slot>
	</footer>
</section>
</template>

<script setup lang="ts">
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	// MkWindow 由来
	initialWidth?: number;
	initialHeight?: number;
	canResize?: boolean;
	closeButton?: boolean;
	mini?: boolean;
	front?: boolean;
	contextmenu?: unknown;
	buttonsLeft?: unknown;
	buttonsRight?: unknown;
	beforeClose?: () => boolean | Promise<boolean>;
	// MkModalWindow 由来
	withOkButton?: boolean;
	withCloseButton?: boolean;
	okButtonDisabled?: boolean;
	panelClass?: string;
	panelTheme?: string;
	panelMode?: string;
	width?: number;
	height?: number;
	// MkModal 由来
	preferType?: string;
	disableBgBlur?: boolean;
}>(), {
	closeButton: undefined,
	withOkButton: false,
	withCloseButton: true,
	okButtonDisabled: false,
});

const emit = defineEmits<{
	closed: [];
	close: [];
	ok: [];
}>();

/**
 * ⚠️各画面は `dialog.value?.close()` で自分を閉じる。埋め込みでも同じ呼び方が
 *   通るようにしておかないと、画面内の「閉じる」「保存して閉じる」が黙って効かなくなる。
 *   close はユーザーの閉じる要求、closed は閉じた通知。公開 close() から
 *   close を再発火させると、親の @close="dialog?.close()" に再入する。
 */
let closed = false;

function close(): void {
	if (closed) return;
	closed = true;
	emit('closed');
}

function requestClose(): void {
	if (props.closeButton !== undefined) close();
	else emit('close');
}

defineExpose({ close });
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-block-size: 0;
}

/* 見出しは右ペイン内の節として配置し、保存・閉じる操作を併置する。 */
.head {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-block-end: 14px;
	padding-block-end: 12px;
	border-block-end: 1px solid var(--settings-border, color-mix(in srgb, var(--MI_THEME-divider) 78%, transparent));
}

.title {
	flex: 1;
	margin: 0;
	min-width: 0;
	overflow: hidden;
	color: var(--MI_THEME-fg);
	font-size: 1.05rem;
	font-weight: 800;
	line-height: 1.3;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.action {
	flex-shrink: 0;
	min-inline-size: 44px;
	min-block-size: 44px;
}

.body {
	min-width: 0;
	min-block-size: 0;
}

/* ⚠️窓のときは本体が独自にスクロールしていた。埋め込みでは右ペインが
   スクロールを持つので、中の高さ固定・内部スクロールを解除する。 */
.body :deep([data-embedded-scroll]) {
	max-block-size: none;
	overflow: visible;
}

.foot {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
	margin-block-start: 14px;
	padding-block-start: 12px;
	border-block-start: 1px solid var(--settings-border, color-mix(in srgb, var(--MI_THEME-divider) 78%, transparent));
}
</style>
