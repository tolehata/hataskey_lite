/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'cherrypick-js';
import { inject, isRef, onActivated, onBeforeUnmount, provide, ref, toValue, watch } from 'vue';
import { DI } from './di.js';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { hataAppNames } from '@/utility/hata-app-brand.js';
import type { HataApp } from '@/utility/hata-app-brand.js';

export type PageMetadata = {
	title: string;
	subtitle?: string;
	icon?: string | null;
	hataApp?: HataApp;
	avatar?: Misskey.entities.User | null;
	userName?: Misskey.entities.User | null;
	needWideArea?: boolean;
};

export function isExactHataAppTitle(metadata: PageMetadata): boolean {
	const app = metadata.hataApp;
	return app != null && metadata.title === `${hataAppNames[app].head}${hataAppNames[app].tail}`;
}

type PageMetadataGetter = () => PageMetadata;
type PageMetadataReceiver = (getter: PageMetadataGetter) => void;

const RECEIVER_KEY = Symbol('ReceiverKey');
const setReceiver = (v: PageMetadataReceiver): void => {
	provide<PageMetadataReceiver>(RECEIVER_KEY, v);
};
const getReceiver = (): PageMetadataReceiver | undefined => {
	return inject<PageMetadataReceiver>(RECEIVER_KEY);
};

const METADATA_KEY = Symbol('MetadataKey');
const setMetadata = (v: Ref<PageMetadata | null>): void => {
	provide<Ref<PageMetadata | null>>(METADATA_KEY, v);
};

export const definePage = (maybeRefOrGetterMetadata: MaybeRefOrGetter<PageMetadata>): void => {
	const metadataRef = ref(toValue(maybeRefOrGetterMetadata));
	const metadataGetter = () => metadataRef.value;
	const receiver = getReceiver();

	// setup handler
	receiver?.(metadataGetter);

	// update handler
	onBeforeUnmount(watch(
		() => toValue(maybeRefOrGetterMetadata),
		(metadata) => {
			metadataRef.value = metadata;
			receiver?.(metadataGetter);
		},
		{ deep: true },
	));
	onActivated(() => {
		receiver?.(metadataGetter);
	});

	provide(DI.pageMetadata, metadataRef);
};

export const provideMetadataReceiver = (receiver: PageMetadataReceiver): void => {
	setReceiver(receiver);
};

export const provideReactiveMetadata = (metadataRef: Ref<PageMetadata | null>): void => {
	setMetadata(metadataRef);
};
