<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<!-- 旗鯖fork: フェードはコンテンツ自体を mask で透過させる方式に変更(半透明ガラス面でも
     背景に溶けるようにするため)。ボタンはマスク対象外にしたいので content の兄弟に出す。 -->
<!-- 旗鯖fork: omitted 状態は data-omitted 属性で表現する。
     `$style.omitted`(ネストした &.omitted のみで定義)は unwind-css-module-class-name が
     ハッシュ解決できずクラスが付かない→max-height/overflow/mask が効かず長文が崩れる。
     data-* 属性ならモジュールCSSからも確実に当たる(CLAUDE.md のGotcha)。 -->
<div :class="$style.wrapper" :data-omitted="omitted ? true : null">
	<div ref="content" :class="$style.content">
		<slot></slot>
	</div>
	<button v-if="omitted" :class="$style.fade" class="_button" @click="() => { ignoreOmit = true; omitted = false; }">
		<span :class="$style.fadeLabel">{{ i18n.ts.showMore }}</span>
	</button>
</div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef, ref } from 'vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { globalEvents } from '@/events.js';

const props = withDefaults(defineProps<{
	maxHeight?: number;
}>(), {
	maxHeight: 200,
});

const content = useTemplateRef('content');
const omitted = ref(false);
const ignoreOmit = ref(false);

const calcOmit = () => {
	if (omitted.value || ignoreOmit.value || content.value == null) return;
	omitted.value = content.value.offsetHeight > props.maxHeight;
};

const omitObserver = new ResizeObserver((entries, observer) => {
	calcOmit();
});

onMounted(() => {
	calcOmit();
	omitObserver.observe(content.value as HTMLElement);

	globalEvents.on('showNoteContent', (value) => {
		if (value) {
			ignoreOmit.value = true;
			omitted.value = false;
		}
	});
});

onUnmounted(() => {
	omitObserver.disconnect();
});
</script>

<style lang="scss" module>
.content {
	--MI-stickyTop: 0px;
}

.wrapper {
	&[data-omitted] {
		position: relative;

		> .content {
			max-height: v-bind("props.maxHeight + 'px'");
			overflow: hidden;
			/* 旗鯖fork: 不透明パネル帯のオーバーレイをやめ、コンテンツ自体を下部で透過。
			   これでガラス面(半透明カード)でも文字が背景に溶けて崩れない。 */
			-webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 calc(100% - 64px), transparent 100%);
			mask-image: linear-gradient(to bottom, #000 0%, #000 calc(100% - 64px), transparent 100%);
		}

		> .fade {
			display: block;
			position: absolute;
			z-index: 10;
			bottom: 0;
			left: 0;
			width: 100%;
			height: 64px;

			> .fadeLabel {
				display: inline-block;
				background: var(--MI_THEME-panel);
				padding: 6px 10px;
				font-size: 0.8em;
				border-radius: 999px;
				box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
			}

			&:hover {
				> .fadeLabel {
					background: var(--MI_THEME-panelHighlight);
				}
			}
		}
	}
}
</style>
