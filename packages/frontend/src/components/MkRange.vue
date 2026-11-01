<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="timctyfi" :class="{ disabled, easing, settingsRedesign: isSettingsRedesign }">
	<div :id="labelId" class="label">
		<slot name="label"></slot>
	</div>
	<div v-adaptive-border class="body" :class="{ 'disabled': disabled, fontSizeSlider: isFontSizeSlider }">
		<slot name="prefix"></slot>
		<div ref="containerEl" class="container">
			<div class="track">
				<div class="highlight right" :style="{ width: rightTrackWidth, left: rightTrackPosition }">
					<div class="shine right"></div>
				</div>
				<div class="highlight left" :style="{ width: leftTrackWidth, left: leftTrackPosition }">
					<div class="shine left"></div>
				</div>
			</div>
			<div v-if="steps && showTicks" class="ticks">
				<div v-for="i in (steps + 1)" class="tick" :style="{ left: (((i - 1) / steps) * 100) + '%' }"></div>
			</div>
			<div
				ref="thumbEl"
				class="thumb"
				role="slider"
				:tabindex="disabled ? -1 : 0"
				:aria-disabled="disabled || undefined"
				:aria-labelledby="labelId"
				:aria-describedby="captionId"
				:aria-valuemin="min"
				:aria-valuemax="max"
				:aria-valuenow="finalValue"
				:aria-valuetext="textConverter(finalValue)"
				aria-orientation="horizontal"
				:style="{ left: thumbPosition + 'px' }"
				@mouseenter.passive="onMouseenter"
				@pointerdown="onPointerdown"
				@keydown="onKeydown"
			>
				<div class="thumbInner"></div>
			</div>
		</div>
		<slot name="suffix"></slot>
	</div>
	<div :id="captionId" class="caption">
		<slot name="caption"></slot>
	</div>
	<SettingsControlRelated v-if="isSettingsRedesign" :data-settings-search-id="$attrs['data-settings-search-id']"/>
</div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, inject, onMounted, onUnmounted, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';
import { isTouchUsing } from '@/utility/touch.js';
import * as os from '@/os.js';
import { haptic } from '@/utility/haptic.js';
import { genId } from '@/utility/id.js';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';
import SettingsControlRelated from '@/components/settings-redesign/SettingsControlRelated.vue';

const props = withDefaults(defineProps<{
	modelValue: number;
	disabled?: boolean;
	min: number;
	max: number;
	step?: number;
	textConverter?: (value: number) => string,
	showTicks?: boolean;
	easing?: boolean;
	continuousUpdate?: boolean;
	isFontSizeSlider?: boolean;
}>(), {
	step: 1,
	textConverter: (v: number) => (Math.round(v * 1000) / 1000).toString(),
	easing: false,
});

const emit = defineEmits<{
	(ev: 'update:modelValue', value: number): void;
	(ev: 'dragEnded', value: number): void;
	(ev: 'thumbDoubleClicked'): void;
}>();

const containerEl = useTemplateRef('containerEl');
const thumbEl = useTemplateRef('thumbEl');
const isSettingsRedesign = inject(settingsSearchV2ContextKey, null) != null;
const inputId = `mk-range-${genId()}`;
const labelId = `${inputId}-label`;
const captionId = `${inputId}-caption`;

const maxRatio = computed(() => Math.abs(props.max) / (props.max + Math.abs(Math.min(0, props.min))));
const minRatio = computed(() => Math.abs(Math.min(0, props.min)) / (props.max + Math.abs(Math.min(0, props.min))));

const rightTrackWidth = computed(() => {
	return Math.max(0, (steppedRawValue.value - minRatio.value) * 100) + '%';
});
const leftTrackWidth = computed(() => {
	return Math.max(0, (minRatio.value - steppedRawValue.value) * 100) + '%';
});
const rightTrackPosition = computed(() => {
	return (Math.abs(Math.min(0, props.min)) / (props.max + Math.abs(Math.min(0, props.min)))) * 100 + '%';
});
const leftTrackPosition = computed(() => {
	return (Math.min(minRatio.value, steppedRawValue.value) * 100) + '%';
});

const calcRawValue = (value: number) => {
	return (value - props.min) / (props.max - props.min);
};

const rawValue = ref(calcRawValue(props.modelValue));
const steppedRawValue = computed(() => {
	if (props.step) {
		const step = props.step / (props.max - props.min);
		return (step * Math.round(rawValue.value / step));
	} else {
		return rawValue.value;
	}
});
const finalValue = computed(() => {
	if (Number.isInteger(props.step)) {
		return Math.round((steppedRawValue.value * (props.max - props.min)) + props.min);
	} else {
		return (steppedRawValue.value * (props.max - props.min)) + props.min;
	}
});

const getThumbWidth = () => {
	if (thumbEl.value == null) return 0;
	return thumbEl.value!.offsetWidth;
};
const thumbPosition = ref(0);
const calcThumbPosition = () => {
	if (containerEl.value == null) {
		thumbPosition.value = 0;
	} else {
		thumbPosition.value = (containerEl.value.offsetWidth - getThumbWidth()) * steppedRawValue.value;
	}
};
watch([steppedRawValue, containerEl], calcThumbPosition);
watch(() => props.modelValue, (newVal) => {
	const newRawValue = calcRawValue(newVal);
	if (rawValue.value === newRawValue) return;
	rawValue.value = newRawValue;
});

let ro: ResizeObserver | undefined;

onMounted(() => {
	ro = new ResizeObserver((entries, observer) => {
		calcThumbPosition();
	});
	if (containerEl.value) ro.observe(containerEl.value);
});

onUnmounted(() => {
	if (ro) ro.disconnect();
});

const steps = computed(() => {
	if (props.step) {
		return (props.max - props.min) / props.step;
	} else {
		return 0;
	}
});

const tooltipForDragShowing = ref(false);
const tooltipForHoverShowing = ref(false);
let activeDragCleanup: (() => void) | null = null;

onBeforeUnmount(() => {
	activeDragCleanup?.();
	// 何らかの問題で表示されっぱなしでもコンポーネントを離れたら消えるように
	tooltipForDragShowing.value = false;
	tooltipForHoverShowing.value = false;
});

function onMouseenter() {
	if (isTouchUsing) return;

	tooltipForHoverShowing.value = true;

	const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkTooltip.vue')), {
		showing: computed(() => tooltipForHoverShowing.value && !tooltipForDragShowing.value),
		text: computed(() => {
			return props.textConverter(finalValue.value);
		}),
		anchorElement: thumbEl.value ?? undefined,
	}, {
		closed: () => dispose(),
	});

	thumbEl.value!.addEventListener('mouseleave', () => {
		tooltipForHoverShowing.value = false;
	}, { once: true, passive: true });
}

let lastClickTime: number | null = null;

function onPointerdown(ev: PointerEvent) {
	if (props.disabled) return; // Prevent interaction if disabled
	if (ev.pointerType === 'mouse' && ev.button !== 0) return;
	// A second contact must not silently discard a non-continuous first drag
	// before its dragEnded consumer has persisted the value.
	if (activeDragCleanup != null) return;

	thumbEl.value?.focus({ preventScroll: true });
	thumbEl.value?.setPointerCapture?.(ev.pointerId);
	haptic();

	ev.preventDefault();

	tooltipForDragShowing.value = true;

	const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkTooltip.vue')), {
		showing: tooltipForDragShowing,
		text: computed(() => {
			return props.textConverter(finalValue.value);
		}),
		anchorElement: thumbEl.value ?? undefined,
	}, {
		closed: () => dispose(),
	});

	const thumbWidth = getThumbWidth();
	const pointerId = ev.pointerId;
	let lastEmittedValue = finalValue.value;

	const onDrag = (ev: PointerEvent) => {
		if (ev.pointerId !== pointerId) return;
		ev.preventDefault();
		const containerRect = containerEl.value!.getBoundingClientRect();
		const pointerX = ev.clientX;
		const pointerPositionOnContainer = pointerX - (containerRect.left + (thumbWidth / 2));
		rawValue.value = Math.min(1, Math.max(0, pointerPositionOnContainer / (containerEl.value!.offsetWidth - thumbWidth)));

		if (props.continuousUpdate && lastEmittedValue !== finalValue.value) {
			emit('update:modelValue', finalValue.value);
			lastEmittedValue = finalValue.value;
		}
	};

	const beforeValue = finalValue.value;

	const onMouseup = (ev: PointerEvent) => {
		if (ev.pointerId !== pointerId) return;
		tooltipForDragShowing.value = false;
		cleanupDrag();

		// 値が変わってたら通知
		if (beforeValue !== finalValue.value) {
			if (!props.continuousUpdate) {
				emit('update:modelValue', finalValue.value);
			}
			emit('dragEnded', finalValue.value);
		}
	};

	const cleanupDrag = () => {
		window.removeEventListener('pointermove', onDrag);
		window.removeEventListener('pointerup', onMouseup);
		window.removeEventListener('pointercancel', onMouseup);
		if (thumbEl.value?.hasPointerCapture?.(pointerId)) {
			thumbEl.value.releasePointerCapture?.(pointerId);
		}
		if (activeDragCleanup === cleanupActiveDrag) activeDragCleanup = null;
	};
	const cleanupActiveDrag = () => {
		tooltipForDragShowing.value = false;
		cleanupDrag();
	};
	activeDragCleanup = cleanupActiveDrag;

	window.addEventListener('pointermove', onDrag);
	window.addEventListener('pointerup', onMouseup);
	window.addEventListener('pointercancel', onMouseup);

	if (lastClickTime == null) {
		lastClickTime = Date.now();
		return;
	} else {
		const now = Date.now();
		if (now - lastClickTime < 300) { // 300ms以内のクリックはダブルクリックとみなす
			lastClickTime = null;
			emit('thumbDoubleClicked');
			return;
		} else {
			lastClickTime = now;
		}
	}
}

function onKeydown(event: KeyboardEvent) {
	if (props.disabled) return;

	const key = event.key;
	if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(key)) return;
	event.preventDefault();

	const step = props.step && props.step > 0 ? props.step : 1;
	const nextValue = key === 'Home'
		? props.min
		: key === 'End'
			? props.max
			: key === 'ArrowLeft' || key === 'ArrowDown'
				? finalValue.value - step
				: finalValue.value + step;
	const clampedValue = Math.min(props.max, Math.max(props.min, nextValue));
	const steppedValue = props.step && props.step > 0
		? props.min + (Math.round((clampedValue - props.min) / props.step) * props.step)
		: clampedValue;
	const next = Math.min(props.max, Math.max(props.min, steppedValue));
	if (next === finalValue.value) return;
	rawValue.value = calcRawValue(next);
	emit('update:modelValue', next);
	emit('dragEnded', next);
}
</script>

<style lang="scss" scoped>
@use "sass:math";

.timctyfi {
	position: relative;

	> .label {
		font-size: 0.85em;
		padding: 0 0 8px 0;
		user-select: none;

		&:empty {
			display: none;
		}
	}

	> .caption {
		font-size: 0.85em;
		padding: 8px 0 0 0;
		color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);

		&:empty {
			display: none;
		}
	}

	$thumbHeight: 44px;
	$thumbWidth: 44px;
	$thumbInnerHeight: 19px;
	$thumbInnerWidth: 19px;

	> .body {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 0px 4px;
		background: var(--MI_THEME-panel);
		border: solid 1px var(--MI_THEME-panel);
		border-radius: 6px;

		&.disabled {
			pointer-events: none;
			opacity: 0.6;
		}

		> .container {
			--mk-range-thumb-width: #{$thumbWidth};
			--mk-range-thumb-height: #{$thumbHeight};

			flex: 1;
			position: relative;
			height: var(--mk-range-thumb-height);

			> .track {
				position: absolute;
				top: 0;
				bottom: 0;
				left: 0;
				right: 0;
				margin: auto;
				width: calc(100% - var(--mk-range-thumb-width));
				height: 3px;
				background: rgba(0, 0, 0, 0.1);
				border-radius: 999px;
				overflow: clip;

				> .highlight {
					position: absolute;
					top: 0;
					height: 100%;
					background: color(from var(--MI_THEME-buttonGradateA) srgb r g b / 0.5);
					overflow: clip;

					> .shine {
						position: absolute;
						top: 0;
						width: 64px;
						height: 100%;
					}
				}

				> .highlight.right {
					> .shine.right {
						right: calc(#{$thumbInnerWidth} / 2);
						background: linear-gradient(-90deg, var(--MI_THEME-buttonGradateB), color(from var(--MI_THEME-buttonGradateA) srgb r g b / 0));
					}
				}

				> .highlight.left {
					> .shine.left {
						left: calc(#{$thumbInnerWidth} / 2);
						background: linear-gradient(90deg, var(--MI_THEME-buttonGradateB), color(from var(--MI_THEME-buttonGradateA) srgb r g b / 0));
					}
				}
			}

			> .ticks {
				$tickWidth: 3px;

				position: absolute;
				top: 0;
				bottom: 0;
				left: 0;
				right: 0;
				margin: auto;
				width: calc(100% - var(--mk-range-thumb-width));

				> .tick {
					position: absolute;
					bottom: 0;
					width: $tickWidth;
					height: 3px;
					margin-left: - math.div($tickWidth, 2);
					background: var(--MI_THEME-divider);
					border-radius: 999px;
				}
			}

			> .thumb {
				position: absolute;
				width: var(--mk-range-thumb-width);
				height: var(--mk-range-thumb-height);
				cursor: grab;
				touch-action: none;

				&:hover {
					> .thumbInner {
						background: hsl(from var(--MI_THEME-accent) h s calc(l + 10));
					}
				}

				&:focus-visible {
					outline: 2px solid var(--MI_THEME-focus);
					outline-offset: 2px;
				}

				> .thumbInner {
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					margin: auto;
					width: $thumbInnerWidth;
					height: $thumbInnerHeight;
					background: var(--MI_THEME-accent);
					border-radius: 999px;
					pointer-events: none;
				}
			}
		}

		&.fontSizeSlider {
			background: var(--MI_THEME-bg);
			border: none;
		}
	}

	&.easing {
		> .body {
			> .container {
				> .track {
					> .highlight {
						transition: width 0.2s cubic-bezier(0, 0, 0, 1);
					}
				}

				> .thumb {
					transition: left 0.2s cubic-bezier(0, 0, 0, 1);
				}
			}
		}
	}

	&.settingsRedesign {
		> .label {
			padding-bottom: 7px;
		}

		> .body {
			min-height: 44px;
			padding-inline: 10px;
			border-color: color-mix(in srgb, var(--MI_THEME-divider) 78%, transparent);
			border-radius: 22px;
			background: color-mix(in srgb, var(--MI_THEME-panel) 94%, var(--MI_THEME-bg));

			> .container {
				--mk-range-thumb-width: 44px;
				--mk-range-thumb-height: 44px;
			}
		}

		> .caption {
			padding-top: 7px;
			line-height: 1.55;
		}
	}
}
</style>
