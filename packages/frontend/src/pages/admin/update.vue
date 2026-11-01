<!--
SPDX-FileCopyrightText: noridev and cherrypick-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps_m">
			<FormSection first>
				<template #label>{{ instanceName }}</template>
				<MkKeyValue @click="whatIsNewCherryPick">
					<template #key>{{ i18n.ts.currentVersion }} <i class="ti ti-external-link"></i></template>
					<template #value>{{ version }} <span :class="$style.commitHash" @click.stop="openCommitPage('kokonect-link/cherrypick', gitHash)">({{ gitHash.substring(0, 8) }})</span></template>
				</MkKeyValue>
			</FormSection>

			<FormSection @click="whatIsNewLatestCherryPick">
				<template #label>CherryPick <i class="ti ti-external-link"></i></template>
				<MkKeyValue>
					<template #key>{{ i18n.ts.latestVersion }}</template>
					<template v-if="releasesCherryPick" #value>{{ releasesCherryPick[0].tag_name }} <span :class="$style.commitHash" @click.stop="openCommitPage('kokonect-link/cherrypick', cherryPickTagsMap.get(releasesCherryPick[0].tag_name) || '')">({{ (cherryPickTagsMap.get(releasesCherryPick[0].tag_name) || 'unknown').substring(0, 8) }})</span></template>
					<template v-else #value><MkEllipsis/></template>
				</MkKeyValue>
				<MkKeyValue style="margin: 8px 0 0; color: color(from var(--MI_THEME-fg) srgb r g b / 0.75); font-size: 0.85em;">
					<template v-if="releasesCherryPick" #value><MkTime :time="releasesCherryPick[0].published_at" mode="detail"/></template>
					<template v-else #value><MkEllipsis/></template>
				</MkKeyValue>
			</FormSection>

			<FormSection @click="whatIsNewLatestMisskey">
				<template #label>Misskey <i class="ti ti-external-link"></i></template>
				<MkKeyValue>
					<template #key>{{ i18n.ts.latestVersion }}</template>
					<template v-if="releasesMisskey" #value>{{ releasesMisskey[0].tag_name }} <span :class="$style.commitHash" @click.stop="openCommitPage('misskey-dev/misskey', misskeyTagsMap.get(releasesMisskey[0].tag_name) || '')">({{ (misskeyTagsMap.get(releasesMisskey[0].tag_name) || 'unknown').substring(0, 8) }})</span></template>
					<template v-else #value><MkEllipsis/></template>
				</MkKeyValue>
				<MkKeyValue style="margin: 8px 0 0; color: color(from var(--MI_THEME-fg) srgb r g b / 0.75); font-size: 0.85em;">
					<template v-if="releasesMisskey" #value><MkTime :time="releasesMisskey[0].published_at" mode="detail"/></template>
					<template v-else #value><MkEllipsis/></template>
				</MkKeyValue>
			</FormSection>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { version, instanceName, gitHash } from '@@/js/config.js';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';
import { openCommitPage, getCommitHashForRelease } from '@/utility/fetch-releases.js';
import FormSection from '@/components/form/section.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';

// CherryPick / Misskey の最新バージョンを GitHub Releases から取得（表示用トラッキング機能）
// プレリリースは含めない（管理者通知機能を削除したため、プレリリース切替UIも削除済み）
const cherryPickResponse = await window.fetch('https://api.github.com/repos/kokonect-link/cherrypick/releases');
const cherryPickData = await cherryPickResponse.json();
const releasesCherryPick = ref(cherryPickData.filter(x => !x.prerelease));
const misskeyResponse = await window.fetch('https://api.github.com/repos/misskey-dev/misskey/releases');
const misskeyData = await misskeyResponse.json();
const releasesMisskey = ref(misskeyData.filter(x => !x.prerelease));
const cherryPickTagsMap = new Map<string, string>();
const misskeyTagsMap = new Map<string, string>();

if (releasesCherryPick.value.length > 0) {
	const hash = await getCommitHashForRelease('kokonect-link/cherrypick', releasesCherryPick.value[0]);
	cherryPickTagsMap.set(releasesCherryPick.value[0].tag_name, hash);
}

if (releasesMisskey.value.length > 0) {
	const hash = await getCommitHashForRelease('misskey-dev/misskey', releasesMisskey.value[0]);
	misskeyTagsMap.set(releasesMisskey.value[0].tag_name, hash);
}

const whatIsNewCherryPick = () => {
	window.open(`https://github.com/kokonect-link/cherrypick/blob/develop/CHANGELOG_CHERRYPICK.md#${version.replace(/\./g, '')}`, '_blank');
};

const whatIsNewLatestCherryPick = () => {
	window.open(`https://github.com/kokonect-link/cherrypick/blob/develop/CHANGELOG_CHERRYPICK.md#${releasesCherryPick.value[0].tag_name.replace(/\./g, '')}`, '_blank');
};

const whatIsNewLatestMisskey = () => {
	window.open(`https://github.com/misskey-dev/misskey/blob/develop/CHANGELOG.md#${releasesMisskey.value[0].tag_name.replace(/\./g, '')}`, '_blank');
};

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.cherrypickUpdate,
	icon: 'ti ti-refresh',
}));
</script>

<style lang="scss" module>
.commitHash {
	font-size: 11px;
	opacity: 0.5;
	cursor: pointer;

	&:hover {
		opacity: 1 !important;
		text-decoration: underline;
		color: var(--MI_THEME-link);
	}
}
</style>
