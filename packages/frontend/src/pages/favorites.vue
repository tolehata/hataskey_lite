<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader>
	<div class="_spacer" style="--MI_SPACER-w: 1140px;">
		<MkFavoriteFolders/>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import MkFavoriteFolders from '@/components/MkFavoriteFolders.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';

definePage(() => ({
	title: i18n.ts.favorites,
	icon: 'ti ti-star',
}));
</script>
