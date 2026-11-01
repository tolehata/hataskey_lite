<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/profiles" :label="i18n.ts._preferencesProfile.manageProfiles" :keywords="['profile', 'settings', 'preferences', 'manage']" icon="ti ti-settings-cog">
	<div class="_gaps">
		<MkButton primary :class="$style.profileMenuButton" @click="openProfileMenu"><i class="ti ti-adjustments" aria-hidden="true"></i> {{ i18n.ts.preferencesProfile }} <i class="ti ti-chevron-down" aria-hidden="true"></i></MkButton>
		<!-- 旗鯖fork: 1件も無いと画面が真っ白になり、何をすればよいか分からなかった。 -->
		<div v-if="backups.length === 0" class="_gaps_s">
			<MkResult type="empty" :text="hataCopy.emptyProfilesTitle"/>
			<p style="margin: 0; opacity: .75; font-size: .9em; line-height: 1.6;">{{ hataCopy.emptyProfilesText }}</p>
		</div>
		<MkFolder v-for="backup in backups" v-else :key="backup.name">
			<template #label>{{ backup.name }}</template>
			<MkButton danger @click="del(backup)">{{ i18n.ts.delete }}</MkButton>
		</MkFolder>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import MkButton from '@/components/MkButton.vue';
import MkFolder from '@/components/MkFolder.vue';
import MkResult from '@/components/global/MkResult.vue';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { deleteCloudBackup, getPreferencesProfileMenu, listCloudBackups } from '@/preferences/utility.js';

const backups = await listCloudBackups();

const hataCopy = i18n.ts._hata._settingsRedesign.gateway;

// 旗鯖fork: 新旧どちらの設定UIでも、同じプロファイル操作を使う。
function openProfileMenu(event: MouseEvent) {
	const menu = getPreferencesProfileMenu().filter(item => !('type' in item) || item.type !== 'link' || item.to !== '/settings/profiles');
	const lastItem = menu.at(-1);
	if (lastItem != null && 'type' in lastItem && lastItem.type === 'divider') menu.pop();
	os.popupMenu(menu, event.currentTarget ?? event.target);
}

function del(backup) {
	deleteCloudBackup(backup.name);
}

definePage(() => ({
	title: i18n.ts._preferencesProfile.manageProfiles,
	icon: 'ti ti-settings-cog',
}));
</script>

<style lang="scss" module>
.profileMenuButton {
	margin-inline: auto;
}
</style>
