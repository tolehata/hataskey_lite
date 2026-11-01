<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: 標準デッキUI用 外部通知カラム。外部アカウント連携の通知を表示する。
-->
<template>
<XColumn :menu="menu" :naked="false" :column="column" :isStacked="isStacked">
	<template #header><i class="ti ti-bell-ringing" style="margin-right: 8px;"></i>{{ column.name || i18n.ts._deck._columns[column.type] }}</template>
	<template #func><button class="_button" :class="$style.headBtn" @click="markRead"><i class="ti ti-check"></i></button></template>

	<div :class="$style.root">
		<div v-if="!externalReady" :class="$style.notLinked">
			<i class="ti ti-link-off" :class="$style.notLinkedIcon"></i>
			<div>{{ copy.notConnected }}</div>
			<MkA to="/settings/external-account" :class="$style.notLinkedLink">{{ copy.openConnectionSettings }}</MkA>
		</div>
		<WidgetExternalNotifications v-else ref="bodyEl" :widget="widgetProps" :showHeader="false"/>
	</div>
</XColumn>
</template>

<script lang="ts" setup>
import { computed, useTemplateRef } from 'vue';
import XColumn from './column.vue';
import type { Column } from '@/deck.js';
import WidgetExternalNotifications from '@/widgets/WidgetExternalNotifications.vue';
import MkA from '@/components/global/MkA.vue';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	column: Column;
	isStacked: boolean;
}>();
const copy = i18n.ts._hata._externalNotifications;

const bodyEl = useTemplateRef<{ fetchNotifications?: () => void; markRead?: () => void }>('bodyEl');

const externalHost = computed(() => prefer.s['external.host']);
const externalToken = computed(() => prefer.s['external.token']);
const externalReady = computed(() => externalHost.value != null && externalHost.value !== '' && externalToken.value != null);

const widgetProps = computed(() => ({ id: `deck-extnotif-${props.column.id}`, name: 'externalNotifications', data: {} }));

function markRead() { bodyEl.value?.markRead?.(); }

const menu = [{
	icon: 'ti ti-refresh',
	text: i18n.ts.reload,
	action: () => { bodyEl.value?.fetchNotifications?.(); },
}, {
	icon: 'ti ti-check',
	text: copy.markAllRead,
	action: markRead,
}, {
	icon: 'ti ti-link',
	text: copy.connectionSettings,
	action: () => { window.location.href = '/settings/external-account'; },
}];
</script>

<style lang="scss" module>
.root { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; }
.headBtn { display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; }
.notLinked { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 16px; text-align: center; opacity: .8; }
.notLinkedIcon { font-size: 2.2em; opacity: .5; }
.notLinkedLink { color: var(--MI_THEME-accent); font-weight: 700; margin-top: 6px; }
</style>
