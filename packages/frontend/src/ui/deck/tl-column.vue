<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-FileCopyrightText: noridev and cherrypick-project
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<XColumn :menu="menu" :column="column" :isStacked="isStacked" :refresher="reloadTimeline" :preserveBody="column.tl === 'ctl'">
	<template #header>
		<i v-if="column.tl != null" :class="timelineIcon"/>
		<span style="margin-left: 8px;">{{ column.name || timelineName || i18n.ts._deck._columns.tl }}</span>
	</template>

	<!-- 外部タイムライン -->
	<ConcrntTimeline v-if="column.tl === 'ctl'" ref="concrntTimeline" embedded :active="column.active !== false"/>
	<MkExternalTimeline
		v-else-if="isExternalTimeline && isExternalEnabled"
		ref="externalTimeline"
		:key="column.tl"
		:src="(column.tl as 'ohtl' | 'oltl')"
		:host="externalHost"
		:token="externalToken"
		:sound="true"
	/>
	<!-- 外部タイムライン未連携時 -->
	<div v-else-if="isExternalTimeline && !isExternalEnabled" :class="$style.disabled">
		<p :class="$style.disabledTitle">
			<i class="ti ti-link-off"></i>
			{{ timelineCopy.externalNotConnected }}
		</p>
		<p :class="$style.disabledDescription">{{ timelineCopy.connectExternalInSettings }}</p>
	</div>
	<!-- 旗鯖fork: トレンドタイムライン (TTL) -->
	<MkTrendingTimeline
		v-else-if="column.tl === 'trending'"
		ref="trendingTimeline"
		:key="'trending'"
	/>
	<!-- 通常タイムライン無効時 -->
	<div v-else-if="isBasicTimeline(column.tl) && !isAvailableBasicTimeline(column.tl)" :class="$style.disabled">
		<p :class="$style.disabledTitle">
			<i class="ti ti-circle-minus"></i>
			{{ i18n.ts._disabledTimeline.title }}
		</p>
		<p :class="$style.disabledDescription">{{ i18n.ts._disabledTimeline.description }}</p>
	</div>
	<!-- 通常タイムライン -->
	<MkStreamingNotesTimeline
		v-else-if="isBasicTimeline(column.tl)"
		ref="timeline"
		:key="column.tl + withRenotes + withReplies + onlyFiles + onlyCats"
		:src="column.tl"
		:withRenotes="withRenotes"
		:withReplies="withReplies"
		:withSensitive="withSensitive"
		:onlyFiles="onlyFiles"
		:onlyCats="onlyCats"
		:sound="true"
		:customSound="soundSetting"
	/>
</XColumn>
</template>

<script lang="ts" setup>
import { onMounted, watch, ref, useTemplateRef, computed, defineAsyncComponent } from 'vue';
import XColumn from './column.vue';
import type { Column } from '@/deck.js';
import type { MenuItem } from '@/types/menu.js';
import type { SoundStore } from '@/preferences/def.js';
import { removeColumn, updateColumn } from '@/deck.js';
import MkStreamingNotesTimeline from '@/components/MkStreamingNotesTimeline.vue';
import MkExternalTimeline from '@/components/MkExternalTimeline.vue';
// 旗鯖fork: トレンドタイムライン (TTL)
import MkTrendingTimeline from '@/components/MkTrendingTimeline.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { hasWithReplies, isAvailableBasicTimeline, basicTimelineIconClass, isBasicTimeline } from '@/timelines.js';
import { soundSettingsButton } from '@/ui/deck/tl-note-notification.js';
import { prefer } from '@/preferences.js';
import { concrntState } from '@/utility/concrnt/runtime.js';

const ConcrntTimeline = defineAsyncComponent(() => import('@/components/concrnt/ConcrntTimeline.vue'));

const timelineCopy = i18n.ts._hata._timelineCustom;

const props = defineProps<{
	column: Column;
	isStacked: boolean;
}>();

const timeline = useTemplateRef('timeline');
const externalTimeline = useTemplateRef('externalTimeline');
const trendingTimeline = useTemplateRef('trendingTimeline');
const concrntTimeline = useTemplateRef('concrntTimeline');

// 外部サーバー連携設定
const isExternalEnabled = computed(() => {
	return prefer.s['external.enabled'] && prefer.s['external.token'] != null;
});
const externalHost = computed(() => prefer.s['external.host'] || '');
const externalToken = computed(() => prefer.s['external.token'] || '');
const enableOHTL = computed(() => prefer.s['external.enableOHTL']);
const enableOLTL = computed(() => prefer.s['external.enableOLTL']);

// 外部タイムラインかどうか
const isExternalTimeline = computed(() => {
	return props.column.tl === 'ohtl' || props.column.tl === 'oltl';
});

// タイムラインアイコン
const timelineIcon = computed(() => {
	if (props.column.tl === 'ctl') return 'concrnt-icon';
	if (props.column.tl === 'ohtl') return 'ti ti-home';
	if (props.column.tl === 'oltl') return 'ti ti-planet';
	// 旗鯖fork: トレンドタイムラインアイコン
	if (props.column.tl === 'trending') return 'ti ti-flame';
	return props.column.tl && isBasicTimeline(props.column.tl) ? basicTimelineIconClass(props.column.tl) : '';
});

// タイムライン名
const timelineName = computed(() => {
	if (props.column.tl === 'ctl') return 'CTL';
	if (props.column.tl === 'ohtl') return 'OHTL';
	if (props.column.tl === 'oltl') return 'OLTL';
	// 旗鯖fork: トレンドタイムライン名
	if (props.column.tl === 'trending') return i18n.ts._timelines.trending;
	return props.column.tl && isBasicTimeline(props.column.tl) ? i18n.ts._timelines[props.column.tl] : null;
});

async function reloadTimeline() {
	if (props.column.tl === 'ctl') { await concrntTimeline.value?.reloadTimeline(); return; }
	if (isExternalTimeline.value) {
		await externalTimeline.value?.reloadTimeline();
		return;
	}
	if (props.column.tl === 'trending') {
		await trendingTimeline.value?.reload();
		return;
	}
	await timeline.value?.reloadTimeline();
}

const soundSetting = ref<SoundStore>(props.column.soundSetting ?? { type: null, volume: 1 });
const withRenotes = ref(props.column.withRenotes ?? true);
const withReplies = ref(props.column.withReplies ?? false);
const withSensitive = ref(props.column.withSensitive ?? true);
const onlyFiles = ref(props.column.onlyFiles ?? false);
const onlyCats = ref(props.column.onlyCats ?? false);

watch(withRenotes, v => {
	updateColumn(props.column.id, {
		withRenotes: v,
	});
});

watch(withReplies, v => {
	updateColumn(props.column.id, {
		withReplies: v,
	});
});

watch(withSensitive, v => {
	updateColumn(props.column.id, {
		withSensitive: v,
	});
});

watch(onlyFiles, v => {
	updateColumn(props.column.id, {
		onlyFiles: v,
	});
});

watch(onlyCats, v => {
	updateColumn(props.column.id, {
		onlyCats: v,
	});
});

watch(soundSetting, v => {
	updateColumn(props.column.id, { soundSetting: v });
});

onMounted(() => {
	if (props.column.tl == null) {
		setType();
	}
});

async function setType() {
	// 基本タイムラインの選択肢
	const items: { value: NonNullable<Column['tl']>; label: string }[] = [{
		value: 'home', label: i18n.ts._timelines.home,
	}, {
		value: 'local', label: i18n.ts._timelines.local,
	}, {
		value: 'social', label: i18n.ts._timelines.social,
	}, {
		value: 'global', label: i18n.ts._timelines.global,
	}, {
		value: 'media', label: i18n.ts._timelines.media,
	}, {
		value: 'bubble', label: i18n.ts._timelines.bubble,
	}, {
		// 旗鯖fork: トレンドタイムライン (TTL)。通常タブ群の後・外部TLの前に配置
		value: 'trending', label: i18n.ts._timelines.trending,
	}];

	// 外部サーバー連携が有効な場合、OHTL/OLTLを追加
	if (isExternalEnabled.value) {
		if (enableOHTL.value) {
			items.push({
				value: 'ohtl', label: timelineCopy.ohtlLabel,
			});
		}
		if (enableOLTL.value) {
			items.push({
				value: 'oltl', label: timelineCopy.oltlLabel,
			});
		}
	}

	if (concrntState.connection && concrntState.settings.enabled) items.push({ value: 'ctl', label: 'CTL（コンカレント）' });

	const { canceled, result: src } = await os.select({
		title: i18n.ts.timeline,
		items,
	});
	if (canceled) {
		if (props.column.tl == null) {
			removeColumn(props.column.id);
		}
		return;
	}
	if (src == null) return;
	updateColumn(props.column.id, {
		tl: src,
	});
}

const menu = computed<MenuItem[]>(() => {
	const menuItems: MenuItem[] = [];
	const basicTimeline = isBasicTimeline(props.column.tl) ? props.column.tl : null;

	menuItems.push({
		icon: 'ti ti-pencil',
		text: i18n.ts.timeline,
		action: setType,
	});
	if (props.column.tl === 'ctl') {
		menuItems.push({ type: 'link', text: 'コンカレント連携(BETA)の設定', icon: 'concrnt-icon', to: '/settings/concrnt' });
		return menuItems;
	}

	// 外部タイムラインの場合はサウンド設定のみ
	if (isExternalTimeline.value) {
		menuItems.push({
			icon: 'ti ti-bell',
			text: i18n.ts._deck.newNoteNotificationSettings,
			action: () => soundSettingsButton(soundSetting),
		});
		return menuItems;
	}

	// 通常タイムラインの場合
	menuItems.push({
		icon: 'ti ti-bell',
		text: i18n.ts._deck.newNoteNotificationSettings,
		action: () => soundSettingsButton(soundSetting),
	}, {
		type: 'switch',
		text: i18n.ts.showRenotes,
		ref: withRenotes,
	});

	if (hasWithReplies(basicTimeline)) {
		menuItems.push({
			type: 'switch',
			text: i18n.ts.showRepliesToOthersInTimeline,
			ref: withReplies,
			disabled: onlyFiles,
		});
	}

	menuItems.push({
		type: 'switch',
		text: i18n.ts.fileAttachedOnly,
		ref: onlyFiles,
		disabled: hasWithReplies(basicTimeline) ? withReplies : false,
	}, {
		type: 'switch',
		text: i18n.ts.withSensitive,
		ref: withSensitive,
	}, {
		type: 'switch',
		text: i18n.ts.showCatOnly,
		ref: onlyCats,
	});

	return menuItems;
});
</script>

<style lang="scss" module>
.disabled {
	text-align: center;
}

.disabledTitle {
	margin: 16px;
}

.disabledDescription {
	font-size: 90%;
}
</style>
