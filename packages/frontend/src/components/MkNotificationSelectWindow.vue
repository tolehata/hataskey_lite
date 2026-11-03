<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModalWindow
	ref="dialog"
	:width="400"
	:height="450"
	:withOkButton="true"
	:okButtonDisabled="false"
	@ok="ok()"
	@close="dialog?.close()"
	@closed="emit('closed')"
>
	<template #header>{{ i18n.ts.notificationSetting }}</template>

	<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 28px;">
		<div class="_gaps_m">
			<MkInfo>{{ i18n.ts.notificationSettingDesc }}</MkInfo>
			<MkSwitch v-model="showBots">
				{{ copy.botNotifications }}
				<template #caption>{{ copy.botNotificationsDescription }}</template>
			</MkSwitch>
			<div class="_buttons">
				<MkButton inline @click="disableAll">{{ i18n.ts.disableAll }}</MkButton>
				<MkButton inline @click="enableAll">{{ i18n.ts.enableAll }}</MkButton>
			</div>
			<MkSwitch v-for="ntype in notificationTypes" :key="ntype" v-model="typesMap[ntype].value">{{ i18n.ts._notification._types[ntype] }}</MkSwitch>
		</div>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef, watch } from 'vue';
import { notificationTypes } from 'cherrypick-js';
import MkSwitch from './MkSwitch.vue';
import MkInfo from './MkInfo.vue';
import MkButton from './MkButton.vue';
import type { Ref } from 'vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import { i18n } from '@/i18n.js';
import { resolveNotificationFilter, serializeNotificationFilter } from '@/utility/notification-filter.js';

type TypesMap = Record<typeof notificationTypes[number], Ref<boolean>>;

const emit = defineEmits<{
	(ev: 'done', v: { excludeTypes: string[]; knownTypes: string[]; excludeBots: boolean }): void,
	(ev: 'closed'): void,
}>();

const props = withDefaults(defineProps<{
	excludeTypes?: string[];
	knownTypes?: string[];
	excludeBots?: boolean;
}>(), {
	excludeTypes: () => [],
	knownTypes: () => [],
	excludeBots: false,
});

const dialog = useTemplateRef('dialog');

const initialFilter = resolveNotificationFilter(props.excludeTypes, props.knownTypes);
const typesMap = notificationTypes.reduce((p, t) => ({ ...p, [t]: ref<boolean>(!initialFilter.excludeTypes.includes(t)) }), {} as TypesMap);
const showBots = ref(true);
const copy = i18n.ts._hata._notificationFilter;

watch(() => props.excludeBots, value => {
	showBots.value = value !== true;
}, { immediate: true });

function ok() {
	const disabledTypes = (Object.keys(typesMap) as typeof notificationTypes[number][])
		.filter(type => !typesMap[type].value);
	emit('done', {
		...serializeNotificationFilter(disabledTypes, props.excludeTypes, props.knownTypes),
		excludeBots: !showBots.value,
	});

	if (dialog.value) dialog.value.close();
}

function disableAll() {
	showBots.value = false;
	for (const type of notificationTypes) {
		typesMap[type].value = false;
	}
}

function enableAll() {
	showBots.value = true;
	for (const type of notificationTypes) {
		typesMap[type].value = true;
	}
}
</script>
