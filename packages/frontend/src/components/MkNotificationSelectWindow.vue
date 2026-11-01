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
			<div v-for="category in NOTIFICATION_FILTER_CATEGORIES" :key="category" class="_gaps_s">
				<MkSwitch v-model="categoryMap[category].value">{{ i18n.ts._hata._notificationBrands[category] }}</MkSwitch>
				<div :class="[$style.children, '_gaps_s']">
					<template v-if="category === 'standard'">
						<MkSwitch v-for="ntype in STANDARD_NOTIFICATION_TYPES" :key="ntype" v-model="typesMap[ntype].value" :disabled="!categoryMap[category].value">{{ i18n.ts._notification._types[ntype] }}</MkSwitch>
					</template>
					<template v-else-if="category === 'hatady'">
						<MkSwitch v-for="subtype in hatadyNotificationSubtypes" :key="subtype" v-model="hatadySubtypesMap[subtype].value" :disabled="!categoryMap[category].value">{{ i18n.ts._hata._hatady._notification[subtype] }}</MkSwitch>
					</template>
					<template v-else-if="category === 'hatask'">
						<MkSwitch v-for="ntype in HATASK_NOTIFICATION_TYPES" :key="ntype" v-model="typesMap[ntype].value" :disabled="!categoryMap[category].value">{{ i18n.ts._notification._types[ntype] }}</MkSwitch>
						<MkSwitch v-model="includeHataskApp" :disabled="!categoryMap[category].value">{{ copy.otherHatask }}</MkSwitch>
					</template>
					<MkSwitch v-else v-model="typesMap.hataFeed.value" :disabled="!categoryMap[category].value">{{ i18n.ts._notification._types.hataFeed }}</MkSwitch>
				</div>
			</div>
		</div>
	</div>
</MkModalWindow>
</template>

<script lang="ts" setup>
import { computed, ref, toRefs, useTemplateRef, watch } from 'vue';
import { notificationTypes, hatadyNotificationSubtypes } from 'cherrypick-js';
import MkSwitch from './MkSwitch.vue';
import MkInfo from './MkInfo.vue';
import MkButton from './MkButton.vue';
import type { Ref } from 'vue';
import type { HataNotificationCategory } from '@/utility/hatasaba-device-prefs.js';
import type { NotificationFilterDetails } from '@/utility/notification-filter.js';
import MkModalWindow from '@/components/MkModalWindow.vue';
import { i18n } from '@/i18n.js';
import { HATASK_NOTIFICATION_TYPES, NOTIFICATION_FILTER_CATEGORIES, STANDARD_NOTIFICATION_TYPES, resolveNotificationFilter, resolveNotificationFilterDetails, serializeNotificationFilter, serializeNotificationFilterDetails } from '@/utility/notification-filter.js';

type TypesMap = Record<typeof notificationTypes[number], Ref<boolean>>;
type HatadySubtypesMap = Record<typeof hatadyNotificationSubtypes[number], Ref<boolean>>;

const emit = defineEmits<{
	(ev: 'done', v: { excludeTypes: string[]; knownTypes: string[]; excludeBots: boolean; filterDetails: NotificationFilterDetails }): void,
	(ev: 'closed'): void,
}>();

const props = withDefaults(defineProps<{
	excludeTypes?: string[];
	knownTypes?: string[];
	excludeBots?: boolean;
	filterDetails?: NotificationFilterDetails;
}>(), {
	excludeTypes: () => [],
	knownTypes: () => [],
	excludeBots: false,
	filterDetails: () => ({}),
});

const dialog = useTemplateRef('dialog');

const propRefs = toRefs(props);
const initialFilter = resolveNotificationFilter(propRefs.excludeTypes.value, propRefs.knownTypes.value);
const initialDetails = resolveNotificationFilterDetails(propRefs.filterDetails.value, initialFilter.excludeTypes);
const typesMap = notificationTypes.reduce((p, t) => ({ ...p, [t]: ref<boolean>(!initialFilter.excludeTypes.includes(t)) }), {} as TypesMap);
const categoryEnabled = NOTIFICATION_FILTER_CATEGORIES.reduce((result, category) => ({
	...result,
	[category]: ref(initialDetails.includeBrands?.includes(category) ?? true),
}), {} as Record<HataNotificationCategory, Ref<boolean>>);
if (initialFilter.excludeTypes.includes('hatady')) categoryEnabled.hatady.value = false;
const categoryMap = NOTIFICATION_FILTER_CATEGORIES.reduce((result, category) => ({
	...result,
	[category]: computed({
		get: () => categoryEnabled[category].value,
		set: enabled => {
			categoryEnabled[category].value = enabled;
			if (category === 'hatady' && enabled) typesMap.hatady.value = true;
		},
	}),
}), {} as Record<HataNotificationCategory, Ref<boolean>>);
const hatadySubtypesMap = hatadyNotificationSubtypes.reduce((result, subtype) => ({
	...result,
	[subtype]: ref(!initialDetails.excludeHatadySubtypes.includes(subtype)),
}), {} as HatadySubtypesMap);
const includeHataskApp = ref(initialDetails.includeHataskApp);
const showBots = ref(true);
const copy = i18n.ts._hata._notificationFilter;

watch(() => props.excludeBots, value => {
	showBots.value = value !== true;
}, { immediate: true });

function ok() {
	const disabledTypes = (Object.keys(typesMap) as typeof notificationTypes[number][])
		.filter(type => !typesMap[type].value);
	const includeBrands = NOTIFICATION_FILTER_CATEGORIES.filter(category => categoryEnabled[category].value);
	emit('done', {
		...serializeNotificationFilter(disabledTypes, props.excludeTypes, props.knownTypes),
		excludeBots: !showBots.value,
		filterDetails: serializeNotificationFilterDetails({
			includeBrands,
			includeHataskApp: includeHataskApp.value,
			excludeHatadySubtypes: hatadyNotificationSubtypes.filter(subtype => !hatadySubtypesMap[subtype].value),
		}, props.filterDetails),
	});

	if (dialog.value) dialog.value.close();
}

function disableAll() {
	showBots.value = false;
	includeHataskApp.value = false;
	for (const category of NOTIFICATION_FILTER_CATEGORIES) categoryEnabled[category].value = false;
	for (const subtype of hatadyNotificationSubtypes) hatadySubtypesMap[subtype].value = false;
	for (const type of notificationTypes) {
		typesMap[type].value = false;
	}
}

function enableAll() {
	showBots.value = true;
	includeHataskApp.value = true;
	for (const category of NOTIFICATION_FILTER_CATEGORIES) categoryEnabled[category].value = true;
	for (const subtype of hatadyNotificationSubtypes) hatadySubtypesMap[subtype].value = true;
	for (const type of notificationTypes) {
		typesMap[type].value = true;
	}
}
</script>

<style lang="scss" module>
.children {
	padding-inline-start: 16px;
}
</style>
