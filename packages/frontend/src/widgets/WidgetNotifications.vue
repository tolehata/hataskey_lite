<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkContainer :style="`height: ${widgetProps.height}px;`" :showHeader="widgetProps.showHeader" :scrollable="true" data-testid="mkw-notifications" class="mkw-notifications" :class="$style.root">
	<template #icon><i class="ti ti-bell"></i></template>
	<template #header>{{ i18n.ts.notifications }}</template>
	<template #func="{ buttonStyleClass }">
		<button v-tooltip="i18n.ts.markAllAsRead" class="_button" :class="buttonStyleClass" @click="readAllNotifications"><i class="ti ti-check"></i></button>
		<button v-tooltip="i18n.ts.settings" class="_button" :class="buttonStyleClass" @click="configureNotification()"><i class="ti ti-settings"></i></button>
	</template>

	<div>
		<MkStreamingNotificationsTimeline :excludeTypes="resolvedExcludeTypes" :excludeBots="widgetProps.excludeBots" :includeBrands="resolvedDetails.includeBrands" :includeHataskApp="resolvedDetails.includeHataskApp" :excludeHatadySubtypes="resolvedDetails.excludeHatadySubtypes" :showFilterPolicyNotice="hasConfiguredFilter"/>
	</div>
</MkContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useWidgetPropsManager } from './widget.js';
import type { WidgetComponentEmits, WidgetComponentExpose, WidgetComponentProps } from './widget.js';
import type { FormWithDefault, GetFormResultType } from '@/utility/form.js';
import type { NotificationFilterDetails, NotificationType, ResolvedNotificationFilterDetails } from '@/utility/notification-filter.js';
import MkContainer from '@/components/MkContainer.vue';
import MkStreamingNotificationsTimeline from '@/components/MkStreamingNotificationsTimeline.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { hasConfiguredNotificationFilter, migrateNotificationFilterSnapshot, resolveNotificationFilter, resolveNotificationFilterDetails, serializeNotificationFilterDetails } from '@/utility/notification-filter.js';
import { deepClone } from '@/utility/clone.js';
import { deepEqual } from '@/utility/deep-equal.js';
import { $i } from '@/i.js';
import { refreshNotificationUnreadState } from '@/utility/notification-unread-sync.js';

const name = 'notifications';

const widgetPropsDef = {
	showHeader: {
		type: 'boolean',
		default: true,
	},
	height: {
		type: 'number',
		default: 300,
	},
	excludeTypes: {
		type: 'array',
		hidden: true,
		default: [] as string[],
	},
	notificationFilterKnownTypes: {
		type: 'array',
		hidden: true,
		default: [] as string[],
	},
	excludeBots: {
		type: 'boolean',
		hidden: true,
		default: false,
	},
	notificationFilterDetails: {
		type: 'object',
		hidden: true,
		default: {} as NotificationFilterDetails,
	},
} satisfies FormWithDefault;

type WidgetProps = GetFormResultType<typeof widgetPropsDef>;

const props = defineProps<WidgetComponentProps<WidgetProps>>();
const emit = defineEmits<WidgetComponentEmits<WidgetProps>>();

const { widgetProps, configure, save } = useWidgetPropsManager(name,
	widgetPropsDef,
	props,
	emit,
);

const resolvedExcludeTypes = computed<NotificationType[]>((previous) => {
	const resolved = resolveNotificationFilter(widgetProps.excludeTypes, widgetProps.notificationFilterKnownTypes).excludeTypes;
	// 設定同期で同じ配列を受け取っても、一覧を再取得してスクロール位置を失わない。
	return previous && deepEqual(previous, resolved) ? previous : resolved;
});
const resolvedDetails = computed<ResolvedNotificationFilterDetails>((previous) => {
	const resolved = resolveNotificationFilterDetails(widgetProps.notificationFilterDetails, resolvedExcludeTypes.value);
	return previous && deepEqual(previous, resolved) ? previous : resolved;
});
const hasConfiguredFilter = computed(() => hasConfiguredNotificationFilter(
	widgetProps.excludeTypes,
	widgetProps.notificationFilterKnownTypes,
));

onMounted(() => {
	const migrated = migrateNotificationFilterSnapshot(widgetProps.excludeTypes, widgetProps.notificationFilterKnownTypes);
	if (migrated == null) return;
	widgetProps.notificationFilterKnownTypes = migrated.knownTypes;
	save();
});

async function readAllNotifications() {
	const ownerId = $i?.id;
	try {
		await os.apiWithDialog('notifications/mark-all-as-read', {});
		await refreshNotificationUnreadState(ownerId);
	} catch {
		// apiWithDialog reports the failed read request.
	}
}

const configureNotification = async () => {
	const initialRawDetails = deepClone(widgetProps.notificationFilterDetails);
	const initialFilter = deepClone({
		excludeTypes: widgetProps.excludeTypes,
		knownTypes: widgetProps.notificationFilterKnownTypes,
		excludeBots: widgetProps.excludeBots,
		filterDetails: serializeNotificationFilterDetails(resolvedDetails.value, initialRawDetails),
	});
	const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkNotificationSelectWindow.vue').then(x => x.default), initialFilter, {
		done: async (res) => {
			const { excludeTypes, knownTypes, excludeBots, filterDetails } = res;
			if (!deepEqual(excludeTypes, initialFilter.excludeTypes)) widgetProps.excludeTypes = excludeTypes;
			if (!deepEqual(knownTypes, initialFilter.knownTypes)) widgetProps.notificationFilterKnownTypes = knownTypes;
			if (excludeBots !== initialFilter.excludeBots) widgetProps.excludeBots = excludeBots;
			if (!deepEqual(filterDetails, initialFilter.filterDetails) || deepEqual(widgetProps.notificationFilterDetails, initialRawDetails)) {
				widgetProps.notificationFilterDetails = filterDetails;
			}
			save({ immediate: true });
		},
		closed: () => dispose(),
	});
};

defineExpose<WidgetComponentExpose>({
	name,
	configure,
	id: props.widget ? props.widget.id : null,
});
</script>

<style lang="scss" module>
:global(html[data-hk3-ui]) .root {
	--hk3-notifications-bg: transparent;
	--hk3-notifications-blur: none;
	background: transparent;

	> header,
	> div {
		background: transparent;
	}
}
</style>
