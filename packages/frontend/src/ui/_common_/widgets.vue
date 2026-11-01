<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.widgetsRoot" :data-motion="prefer.r.animation.value">
	<MkWidgetControls v-if="!deckEmbedded" :editing="editMode" :collapsible="canCollapse" :collapsed="isCollapsed" :controls="widgetsId" @edit="editMode = !editMode" @toggle="emit('toggleCollapse')"/>

	<Transition :name="$style.widgetFade" :css="canCollapse && prefer.r.animation.value">
		<XWidgets v-show="!isCollapsed" :id="widgetsId" :inert="isCollapsed" :aria-hidden="isCollapsed" :edit="editMode" :widgets="widgets" @addWidget="addWidget" @removeWidget="removeWidget" @updateWidget="updateWidget" @updateWidgets="updateWidgets" @exit="editMode = false"/>
	</Transition>
</div>
</template>

<script lang="ts">
import { computed, ref, useId } from 'vue';
const editMode = ref(false);
</script>
<script lang="ts" setup>
import XWidgets from '@/components/MkWidgets.vue';
import MkWidgetControls from '@/components/MkWidgetControls.vue';
import { prefer } from '@/preferences.js';

const props = withDefaults(defineProps<{
	// null = 全てのウィジェットを表示
	// left = place: leftだけを表示
	// right = rightとnullを表示
	place?: 'left' | null | 'right';
	// デッキではカラムのメニューから編集するため、操作ボタン行を表示しない。
	deckEmbedded?: boolean;
	collapsible?: boolean;
	collapsed?: boolean;
}>(), {
	place: null,
	deckEmbedded: false,
	collapsible: false,
	collapsed: false,
});

const emit = defineEmits<{ toggleCollapse: [] }>();
const widgetsId = useId();
const canCollapse = computed(() => props.collapsible && !props.deckEmbedded);
const isCollapsed = computed(() => canCollapse.value && props.collapsed);

// 旗鯖fork(新デッキ): 親 (hatasaba-deck) の三点メニュー / タブ右クリックから編集モードを
// 制御するため、editMode の参照とトグル関数を expose する。
defineExpose({
	getWidgetEditMode: () => editMode.value,
	setWidgetEditMode: (v: boolean) => { editMode.value = v; },
	toggleWidgetEditMode: () => { editMode.value = !editMode.value; },
});

const widgets = computed(() => {
	if (props.place === null) return prefer.r.widgets.value;
	if (props.place === 'left') return prefer.r.widgets.value.filter(w => w.place === 'left');
	return prefer.r.widgets.value.filter(w => w.place !== 'left');
});

function addWidget(widget) {
	prefer.commit('widgets', [{
		...widget,
		place: props.place,
	}, ...prefer.s.widgets]);
}

function removeWidget(widget) {
	prefer.commit('widgets', prefer.s.widgets.filter(w => w.id !== widget.id));
}

function updateWidget({ id, data }) {
	prefer.commit('widgets', prefer.s.widgets.map(w => w.id === id ? {
		...w,
		data,
		place: props.place,
	} : w));
}

function updateWidgets(thisWidgets) {
	if (props.place === null) {
		prefer.commit('widgets', thisWidgets);
		return;
	}
	if (props.place === 'left') {
		prefer.commit('widgets', [
			...thisWidgets.map(w => ({ ...w, place: 'left' })),
			...prefer.s.widgets.filter(w => w.place !== 'left' && !thisWidgets.some(t => w.id === t.id)),
		]);
		return;
	}
	prefer.commit('widgets', [
		...prefer.s.widgets.filter(w => w.place === 'left' && !thisWidgets.some(t => w.id === t.id)),
		...thisWidgets.map(w => ({ ...w, place: 'right' })),
	]);
}
</script>

<style lang="scss" module>
.widgetFade {
	:global(&-enter-active) { transition: opacity .22s ease .06s, transform .28s cubic-bezier(.22,1,.36,1); }
	:global(&-leave-active) { transition: opacity .14s ease, transform .18s ease; }
	:global(&-enter-from), :global(&-leave-to) { opacity: 0; transform: translateX(12px); }
}
.widgetsRoot[data-motion='false'] .widgetFade {
	:global(&-enter-active), :global(&-leave-active) { transition: none; }
	:global(&-enter-from), :global(&-leave-to) { transform: none; }
}
@media (prefers-reduced-motion: reduce) {
	.widgetFade {
		:global(&-enter-active), :global(&-leave-active) { transition: none; }
		:global(&-enter-from), :global(&-leave-to) { transform: none; }
	}
}

/* 旗鯖fork: ウィジェット欄内の MkContainer ヘッダの sticky 追従を無効化。
   sticky のままだと一番上のウィジェットのタイトルバーだけがスクロールに張り付いて
   動いて見える問題が起きる。MkContainer のヘッダクラスは CSS Modules でハッシュ化され
   外部から狙えないため、素のグローバルクラス ._panel 直下の <header> 要素を対象にする。 */
.widgetsRoot :global(._panel) > header {
	position: static !important;
}
</style>
