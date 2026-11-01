<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<XColumn :column="column" :isStacked="isStacked" :menu="menu" :refresher="reload">
	<template #header><i class="ti ti-bell" style="margin-right: 8px;"></i>{{ column.name || i18n.ts._deck._columns.notifications }}</template>

	<MkStreamingNotificationsTimeline ref="notificationsComponent" :excludeTypes="resolvedExcludeTypes" :excludeBots="props.column.excludeBots" :includeBrands="resolvedDetails.includeBrands" :includeHataskApp="resolvedDetails.includeHataskApp" :excludeHatadySubtypes="resolvedDetails.excludeHatadySubtypes" :showFilterPolicyNotice="hasConfiguredFilter"/>
</XColumn>
</template>

<script lang="ts" setup>
import { computed, onMounted, useTemplateRef } from 'vue';
import XColumn from './column.vue';
import type { NotificationType, ResolvedNotificationFilterDetails } from '@/utility/notification-filter.js';
import type { Column } from '@/deck.js';
import { updateColumn } from '@/deck.js';
import MkStreamingNotificationsTimeline from '@/components/MkStreamingNotificationsTimeline.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { hasConfiguredNotificationFilter, migrateNotificationFilterSnapshot, resolveNotificationFilter, resolveNotificationFilterDetails, serializeNotificationFilterDetails } from '@/utility/notification-filter.js';
import { deepClone } from '@/utility/clone.js';
import { deepEqual } from '@/utility/deep-equal.js';

const props = defineProps<{
	column: Column;
	isStacked: boolean;
}>();

const notificationsComponent = useTemplateRef('notificationsComponent');
const resolvedExcludeTypes = computed<NotificationType[]>((previous) => {
	const resolved = resolveNotificationFilter(props.column.excludeTypes, props.column.notificationFilterKnownTypes).excludeTypes;
	return previous && deepEqual(previous, resolved) ? previous : resolved;
});
const resolvedDetails = computed<ResolvedNotificationFilterDetails>((previous) => {
	const resolved = resolveNotificationFilterDetails(props.column.notificationFilterDetails, resolvedExcludeTypes.value);
	return previous && deepEqual(previous, resolved) ? previous : resolved;
});
const hasConfiguredFilter = computed(() => hasConfiguredNotificationFilter(
	props.column.excludeTypes,
	props.column.notificationFilterKnownTypes,
));

onMounted(() => {
	const migrated = migrateNotificationFilterSnapshot(props.column.excludeTypes, props.column.notificationFilterKnownTypes);
	if (migrated == null) return;
	updateColumn(props.column.id, {
		notificationFilterKnownTypes: migrated.knownTypes,
	});
});

async function reload() {
	await notificationsComponent.value?.reload();
}

async function func() {
	const initialRawDetails = deepClone(props.column.notificationFilterDetails);
	const initialFilter = deepClone({
		excludeTypes: props.column.excludeTypes,
		knownTypes: props.column.notificationFilterKnownTypes,
		excludeBots: props.column.excludeBots,
		filterDetails: serializeNotificationFilterDetails(resolvedDetails.value, initialRawDetails),
	});
	const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkNotificationSelectWindow.vue').then(x => x.default), initialFilter, {
		done: async (res) => {
			const { excludeTypes, knownTypes, excludeBots, filterDetails } = res;
			const changes: Partial<Column> = {};
			if (!deepEqual(excludeTypes, initialFilter.excludeTypes)) changes.excludeTypes = excludeTypes;
			if (!deepEqual(knownTypes, initialFilter.knownTypes)) changes.notificationFilterKnownTypes = knownTypes;
			if (excludeBots !== initialFilter.excludeBots) changes.excludeBots = excludeBots;
			if (!deepEqual(filterDetails, initialFilter.filterDetails) || deepEqual(props.column.notificationFilterDetails, initialRawDetails)) {
				changes.notificationFilterDetails = filterDetails;
			}
			if (Object.keys(changes).length > 0) updateColumn(props.column.id, changes);
		},
		closed: () => dispose(),
	});
}

const menu = [{
	icon: 'ti ti-pencil',
	text: i18n.ts.notificationSetting,
	action: func,
}];
</script>
