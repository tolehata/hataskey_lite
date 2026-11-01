<!--
旗鯖fork(#11): マスコットウィジェット。
ウィジェット欄に現在のマスコット(立ち絵)を表示する。文言はウィジェット内でローカルに選ぶため、
フローティングマスコットや専用ページの表示状態には干渉しない(クリックで次の文言/任意で自動切替)。
-->
<template>
<MkContainer :naked="widgetProps.transparent" :showHeader="widgetProps.showHeader" :class="$style.container">
	<template #icon><i class="ti ti-mood-smile"></i></template>
	<template #header>{{ copy.title }}</template>

	<div :class="$style.root">
		<template v-if="character && imageUrl">
			<div
				:class="$style.stage"
				:style="{ height: stageHeight + 'px' }"
				:title="phraseText ? '' : copy.changePhrase"
				@click="next"
			>
				<img :src="imageUrl" :class="$style.img" draggable="false" :alt="expression?.label || 'mascot'"/>
			</div>
			<div v-if="widgetProps.showPhrase && phraseText" :class="$style.phrase">{{ phraseText }}</div>
		</template>
		<div v-else :class="$style.empty">
			<i class="ti ti-mood-puzzled" :class="$style.emptyIcon"></i>
			<div :class="$style.emptyText">{{ copy.notConfigured }}</div>
			<MkButton primary rounded small @click="goToSettings">{{ copy.configureMascot }}</MkButton>
		</div>
	</div>
</MkContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import MkContainer from '@/components/MkContainer.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { useRouter } from '@/router.js';
import {
	loadMascot,
	activeCharacter,
	expressionDisplayUrl,
	currentExpression,
	displayText,
	announceMessage,
	pickRandomPhrase,
	floatingMascotShown,
	type MascotExpression,
	type MascotPhrase,
} from '@/utility/mascot-store.js';

const name = 'mascot';
const copy = i18n.ts._hata._mascotWidget;

const widgetPropsDef = {
	transparent: {
		type: 'boolean',
		default: false,
	},
	showHeader: {
		type: 'boolean',
		default: true,
	},
	size: {
		type: 'radio',
		default: 'medium',
		options: [
			{ value: 'small' as const, label: copy.sizeSmall },
			{ value: 'medium' as const, label: copy.sizeMedium },
			{ value: 'large' as const, label: copy.sizeLarge },
		],
	},
	showPhrase: {
		type: 'boolean',
		default: true,
	},
	autoRotate: {
		type: 'boolean',
		default: false,
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { widgetProps, configure } = useWidgetPropsManager(name,
	widgetPropsDef,
	props,
	emit,
);

const router = useRouter();

const stageHeight = computed(() => widgetProps.size === 'small' ? 120 : widgetProps.size === 'large' ? 280 : 190);

const character = computed(() => activeCharacter.value);

// フローティングが吹き出しを出している間(floatingMascotShown=true)は、ウィジェットはローカルの通常文言のみを
// 表示し、特殊イベント(通知/誕生日)は出さない(同じアクティブキャラなので二重表示を避ける)。
// フローティング非表示のときは、ウィジェットがグローバル(currentExpression / displayText = 特殊イベント含む)を表示する。
const useGlobal = computed(() => !floatingMascotShown.value);

// フローティング表示中に使う、ウィジェット内ローカルの通常文言・表情。
const localPhrase = ref<MascotPhrase | null>(null);
function pickLocal() {
	const c = character.value;
	if (!c || c.phrases.length === 0) { localPhrase.value = null; return; }
	if (c.phrases.length === 1) { localPhrase.value = c.phrases[0]; return; }
	let pick: MascotPhrase;
	do {
		pick = c.phrases[Math.floor(Math.random() * c.phrases.length)];
	} while (pick.id === localPhrase.value?.id);
	localPhrase.value = pick;
}
const localExpression = computed<MascotExpression | null>(() => {
	const c = character.value;
	if (!c) return null;
	const linked = localPhrase.value?.expressionId;
	if (linked) {
		const found = c.expressions.find(e => e.id === linked);
		if (found) return found;
	}
	return c.expressions[0] ?? null;
});

const expression = computed<MascotExpression | null>(() => useGlobal.value ? currentExpression.value : localExpression.value);
const imageUrl = computed(() => expressionDisplayUrl(expression.value));
// テンプレートは {{ }} で出力するため(Vueが自動エスケープ)、ここでは生テキストを使う。
const phraseText = computed(() => useGlobal.value
	? (displayText.value ?? '')
	: (localPhrase.value?.text ?? ''));

function next() {
	if (useGlobal.value) {
		if (announceMessage.value) return; // 特殊イベント(通知/誕生日)の表示中は維持して切り替えない
		pickRandomPhrase(); // グローバルの通常文言を更新
	} else {
		pickLocal();
	}
}

function goToSettings() {
	router.push('/mascot');
}

// 初回 / モード(フローティング表示有無)切替時に、表示する文言が無ければ用意する。
watch([character, useGlobal], () => {
	if (character.value == null) return;
	if (useGlobal.value) {
		if (!announceMessage.value && !displayText.value) pickRandomPhrase();
	} else {
		if (localPhrase.value == null) pickLocal();
	}
}, { immediate: true });

let timer: ReturnType<typeof setInterval> | null = null;
function setupAutoRotate() {
	if (timer != null) { clearInterval(timer); timer = null; }
	if (widgetProps.autoRotate) {
		timer = setInterval(() => next(), 8000);
	}
}
watch(() => widgetProps.autoRotate, setupAutoRotate);

onMounted(() => {
	loadMascot();
	setupAutoRotate();
});
onUnmounted(() => {
	if (timer != null) clearInterval(timer);
});

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
.root {
	padding: 10px;
}

.stage {
	display: flex;
	align-items: flex-end;
	justify-content: center;
	cursor: pointer;
	user-select: none;
}

.img {
	max-width: 100%;
	height: 100%;
	object-fit: contain;
	-webkit-user-drag: none;
}

.phrase {
	margin: 8px auto 2px;
	max-width: 100%;
	padding: 8px 12px;
	background: color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel));
	border: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 25%, transparent);
	border-radius: 12px;
	font-size: 0.9em;
	line-height: 1.5;
	text-align: center;
	word-break: break-word;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 20px 12px;
	text-align: center;
	color: var(--MI_THEME-fg);
	opacity: 0.85;
}

.emptyIcon {
	font-size: 2em;
	opacity: 0.5;
}

.emptyText {
	font-size: 0.9em;
	opacity: 0.8;
}
</style>
