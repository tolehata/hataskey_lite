/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { reactive, watch } from 'vue';
import { throttle } from 'throttle-debounce';
import type { Reactive } from 'vue';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import * as os from '@/os.js';
import { deepClone } from '@/utility/clone.js';
import { deepEqual } from '@/utility/deep-equal.js';

// ウィジェットの保存データはJSON値。フォームの型が許すunknownはこの境界で扱う。
type WidgetValue = string | number | boolean | null | undefined | WidgetValue[] | { [key: string]: WidgetValue };
type WidgetData = Record<string, WidgetValue>;

export type Widget<P extends Record<string, unknown>> = {
	id: string;
	data: Partial<P>;
};

export type WidgetComponentProps<P extends Record<string, unknown>> = {
	widget?: Widget<P>;
};

export type WidgetComponentEmits<P extends Record<string, unknown>> = {
	(ev: 'updateProps', props: P);
};

export type WidgetComponentExpose = {
	name: string;
	id: string | null;
	configure: () => void;
};

export const useWidgetPropsManager = <F extends FormWithDefault>(
	name: string,
	propsDef: F,
	props: Readonly<WidgetComponentProps<GetFormResultType<F>>>,
	emit: WidgetComponentEmits<GetFormResultType<F>>,
): {
	widgetProps: Reactive<GetFormResultType<F>>;
	save: (options?: { immediate?: boolean }) => void;
	configure: () => void;
} => {
	const withDefaults = (data: Partial<GetFormResultType<F>>) => {
		const value = deepClone(data as WidgetData);
		for (const prop of Object.keys(propsDef)) {
			if (typeof value[prop] === 'undefined') value[prop] = deepClone(propsDef[prop].default as WidgetValue);
		}
		return value;
	};
	let savedProps = withDefaults(props.widget?.data ?? {});
	const widgetProps = reactive<WidgetData>(deepClone(savedProps));

	const mergeProps = () => {
		for (const prop of Object.keys(propsDef)) {
			if (typeof widgetProps[prop] === 'undefined') {
				widgetProps[prop] = deepClone(propsDef[prop].default as WidgetValue);
			}
		}
	};

	watch(widgetProps, () => {
		mergeProps();
	}, { deep: true, immediate: true });

	watch(() => props.widget?.data, data => {
		const incoming = withDefaults(data ?? {});
		// 他の表示で保存された値を取り込み、まだ保存していない編集は残す。
		for (const key of new Set([...Object.keys(savedProps), ...Object.keys(incoming)])) {
			if (!deepEqual(widgetProps[key], savedProps[key])) continue;
			if (Object.hasOwn(incoming, key)) widgetProps[key] = deepClone(incoming[key]);
			else delete widgetProps[key];
		}
		savedProps = incoming;
	}, { deep: true, flush: 'sync' });

	const emitProps = () => {
		savedProps = deepClone(widgetProps);
		emit('updateProps', deepClone(savedProps) as GetFormResultType<F>);
	};
	const throttledSave = throttle(3000, emitProps);
	const save = (options?: { immediate?: boolean }) => {
		if (options?.immediate) {
			throttledSave.cancel({ upcomingOnly: true });
			emitProps();
		} else {
			throttledSave();
		}
	};

	const configure = async () => {
		const initialProps = deepClone(widgetProps);
		const form = deepClone(propsDef);
		for (const item of Object.keys(form)) {
			form[item].default = deepClone(initialProps[item]);
		}
		const { canceled, result } = await os.form(name, form);
		if (canceled) return;

		const resultData = result as WidgetData;
		for (const key of Object.keys(resultData)) {
			if (!deepEqual(resultData[key], initialProps[key])) widgetProps[key] = resultData[key];
		}

		save();
	};

	return {
		widgetProps: widgetProps as Reactive<GetFormResultType<F>>,
		save,
		configure,
	};
};
