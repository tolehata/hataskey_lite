<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<SearchMarker path="/settings/note-charm" :label="i18n.ts._noteCharm.title" :keywords="['note', 'charm', 'character', 'ノートチャーム']" icon="ti ti-diamond">
	<div class="_gaps_m">
		<MkNoteCharmSettings/>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import MkNoteCharmSettings from '@/components/MkNoteCharmSettings.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

definePage(() => ({
	title: i18n.ts._noteCharm.title,
	icon: 'ti ti-diamond',
}));
</script>
