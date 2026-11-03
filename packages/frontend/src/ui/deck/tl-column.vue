<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-FileCopyrightText: noridev and cherrypick-project
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<XColumn :menu="menu" :column="column" :isStacked="isStacked" :refresher="reloadTimeline">
	<template #header>
		<i v-if="column.tl != null" :class="timelineIcon"/>
		<span style="margin-left: 8px;">{{ column.name || timelineName || i18n.ts._deck._columns.tl }}</span>
	</template>

	<!-- 旗鯖fork: トレンドタイムライン (TTL) -->
	<MkTrendingTimeline
		v-if="column.tl === 'trending'"
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
import { onMounted, watch, ref, useTemplateRef, computed } from 'vue';
import XColumn from './column.vue';
import type { Column } from '@/deck.js';
import type { MenuItem } from '@/types/menu.js';
import type { SoundStore } from '@/preferences/def.js';
import { removeColumn, updateColumn } from '@/deck.js';
import MkStreamingNotesTimeline from '@/components/MkStreamingNotesTimeline.vue';
// 旗鯖fork: トレンドタイムライン (TTL)
import MkTrendingTimeline from '@/components/MkTrendingTimeline.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { hasWithReplies, isAvailableBasicTimeline, basicTimelineIconClass, isBasicTimeline } from '@/timelines.js';
import { soundSettingsButton } from '@/ui/deck/tl-note-notification.js';
import { prefer } from '@/preferences.js';


const props = defineProps<{
	column: Column;
	isStacked: boolean;
}>();

const timeline = useTemplateRef('timeline');
const trendingTimeline = useTemplateRef('trendingTimeline');

// タイムラインアイコン
const timelineIcon = computed(() => {
	// 旗鯖fork: トレンドタイムラインアイコン
	if (props.column.tl === 'trending') return 'ti ti-flame';
	return props.column.tl && isBasicTimeline(props.column.tl) ? basicTimelineIconClass(props.column.tl) : '';
});

// タイムライン名
const timelineName = computed(() => {
	// 旗鯖fork: トレンドタイムライン名
	if (props.column.tl === 'trending') return i18n.ts._timelines.trending;
	return props.column.tl && isBasicTimeline(props.column.tl) ? i18n.ts._timelines[props.column.tl] : null;
});

async function reloadTimeline() {
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
		// 旗鯖fork: トレンドタイムライン (TTL)。通常タブ群の後に配置
		value: 'trending', label: i18n.ts._timelines.trending,
	}];

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
