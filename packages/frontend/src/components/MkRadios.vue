<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts">
import { defineComponent, h, inject, nextTick, ref, watch } from 'vue';
import MkRadio from './MkRadio.vue';
import type { VNode } from 'vue';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';
import SettingsControlRelated from './settings-redesign/SettingsControlRelated.vue';
import { genId } from '@/utility/id.js';

export default defineComponent({
	inheritAttrs: false,
	props: {
		modelValue: {
			required: false,
		},
		vertical: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['update:modelValue'],
	setup(props, context) {
		const isSettingsRedesign = inject(settingsSearchV2ContextKey, null) != null;
		const value = ref(props.modelValue);
		const groupId = `mk-radios-${genId()}`;
		const labelId = `${groupId}-label`;
		const captionId = `${groupId}-caption`;
		const bodyEl = ref<HTMLElement | null>(null);
		watch(value, () => {
			context.emit('update:modelValue', value.value);
		});
		watch(() => props.modelValue, v => {
			value.value = v;
		});
		if (!context.slots.default) return null;

		return () => {
			let options = context.slots.default!();
			const label = context.slots.label?.();
			const caption = context.slots.caption?.();

			// なぜかFragmentになることがあるため
			if (options.length === 1 && options[0].props == null) options = options[0].children as VNode[];

			// vnodeのうちv-if=falseなものを除外する(trueになるものはoptionなど他typeになる)
			options = options.filter(vnode => !(typeof vnode.type === 'symbol' && vnode.type.description === 'v-cmt' && vnode.children === 'v-if'));
			const firstEnabledIndex = options.findIndex(option => !option.props?.disabled);
			const selectedIndex = options.findIndex(option => option.props?.value === value.value && !option.props?.disabled);
			const focusableIndex = selectedIndex >= 0 ? selectedIndex : firstEnabledIndex;
			const onGroupKeydown = (event: KeyboardEvent) => {
				const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
				if (!keys.includes(event.key)) return;
				const enabledIndexes = options.flatMap((option, index) => option.props?.disabled ? [] : [index]);
				if (enabledIndexes.length === 0) return;
				event.preventDefault();
				const currentIndex = enabledIndexes.indexOf(focusableIndex);
				const nextIndex = event.key === 'Home'
					? enabledIndexes[0]
					: event.key === 'End'
						? enabledIndexes.at(-1)!
						: enabledIndexes[(currentIndex + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + enabledIndexes.length) % enabledIndexes.length];
				value.value = options[nextIndex].props?.value;
				void nextTick(() => bodyEl.value?.querySelectorAll<HTMLInputElement>('input[type="radio"]')[nextIndex]?.focus());
			};

			return h('div', {
				...context.attrs,
				class: [
					context.attrs.class,
					'novjtcto',
					...(props.vertical ? ['vertical'] : []),
					...(isSettingsRedesign ? ['settingsRedesign'] : []),
				],
			}, [
				...(label ? [h('div', {
					id: labelId,
					class: 'label',
				}, label)] : []),
				h('div', {
					ref: bodyEl,
					class: 'body',
					role: 'radiogroup',
					'aria-labelledby': label ? labelId : undefined,
					'aria-describedby': caption ? captionId : undefined,
					onKeydown: onGroupKeydown,
				}, options.map((option, index) => h(MkRadio, {
					key: option.key as string,
					value: option.props?.value,
					disabled: option.props?.disabled,
					name: groupId,
					tabindex: index === focusableIndex ? 0 : -1,
					modelValue: value.value,
					'onUpdate:modelValue': _v => value.value = _v,
				}, () => option.children)),
				),
				...(caption ? [h('div', {
					id: captionId,
					class: 'caption',
				}, caption)] : []),
				...(isSettingsRedesign ? [h(SettingsControlRelated, {
					'data-settings-search-id': context.attrs['data-settings-search-id'],
				})] : []),
			]);
		};
	},
});
</script>

<style lang="scss" scoped>
.novjtcto {
	> .label {
		font-size: 0.85em;
		padding: 0 0 8px 0;
		user-select: none;

		&:empty {
			display: none;
		}
	}

	> .body {
		display: flex;
    gap: 10px;
    flex-wrap: wrap;
	}

	> .caption {
		font-size: 0.85em;
		padding: 8px 0 0 0;
		color: color(from var(--MI_THEME-fg) srgb r g b / 0.75);

		&:empty {
			display: none;
		}
	}

	&.vertical {
		> .body {
			flex-direction: column;
		}
	}

	&.settingsRedesign {
		> .label {
			padding-bottom: 7px;
		}

		> .body {
			gap: 8px;
			justify-content: center;
		}

		> .caption {
			padding-top: 7px;
			line-height: 1.55;
		}
	}
}
</style>
