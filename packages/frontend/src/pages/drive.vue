<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<!-- 旗鯖fork: 本家 2026.6.0 から取り込み: ドライブ/ユーザーページのスクロール位置保持 -->
<div ref="scrollContainer" class="_pageScrollable">
	<MkDrive @cd="x => folder = x"/>
</div>
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkDrive from '@/components/MkDrive.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useScrollPositionKeeper } from '@/composables/use-scroll-position-keeper.js';

const scrollContainer = useTemplateRef('scrollContainer');
useScrollPositionKeeper(scrollContainer);

const folder = ref<Misskey.entities.DriveFolder | null>(null);

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: folder.value ? folder.value.name : i18n.ts.drive,
	icon: 'ti ti-cloud',
	hideHeader: true,
}));
</script>
