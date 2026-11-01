<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!-- 旗鯖fork: CTL のプロフィールポップアップ（外部TLのユーザーポップアップと同じ構成）。 -->

<template>
<MkModal ref="modal" :zPriority="'high'" @click="close()" @closed="emit('closed')">
	<div :class="$style.root" role="dialog" :aria-label="`${displayName}のプロフィール`" @click.stop>
		<div v-if="loading" :class="$style.loading"><MkLoading/></div>
		<div v-else :class="$style.content">
			<div :class="$style.banner" :style="profile?.bannerUrl ? { backgroundImage: `url(${JSON.stringify(profile.bannerUrl)})` } : {}">
				<button class="_button" :class="$style.closeBtn" aria-label="閉じる" @click="close()"><i class="ti ti-x"></i></button>
			</div>
			<div :class="$style.avatarArea">
				<img v-if="avatarUrl" :class="$style.avatar" :src="avatarUrl" alt="" referrerpolicy="no-referrer"/>
				<span v-else :class="[$style.avatar, $style.avatarFallback]" aria-hidden="true"><i class="ti ti-user"></i></span>
			</div>
			<div :class="$style.nameArea">
				<div :class="$style.name">{{ displayName }}</div>
				<div :class="$style.source"><i class="concrnt-icon" aria-hidden="true"></i>コンカレント<span v-if="profileId !== 'main'"> · {{ profileId }}</span></div>
			</div>
			<p v-if="failed" :class="$style.noDescription" role="alert">プロフィールを取得できませんでした。</p>
			<div v-else-if="descriptionParts.length" :class="$style.description">
				<template v-for="(part, index) in descriptionParts" :key="index">
					<span v-if="part.type === 'text'">{{ part.text }}</span>
					<a v-else-if="part.type === 'link'" :href="part.url" target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer">{{ part.text }}</a>
					<img v-else-if="part.type === 'emoji'" :class="$style.emoji" :src="part.url" :alt="part.text" :title="part.text" referrerpolicy="no-referrer"/>
				</template>
			</div>
			<div v-else :class="$style.noDescription">自己紹介はありません</div>
			<div :class="$style.actions">
				<button class="_button" :class="$style.actionBtn" @click="copyId"><i class="ti ti-copy"></i><span>コンカレントIDをコピー</span></button>
			</div>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, useTemplateRef } from 'vue';
import type { ConcrntUserProfile } from '@/utility/concrnt/types.js';
import MkModal from '@/components/MkModal.vue';
import * as os from '@/os.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import { runConcrntAction } from '@/utility/concrnt/runtime.js';
import { concrntContentParts, concrntDisplayName } from '@/utility/concrnt/content.js';

const props = defineProps<{
	ccid: string;
	profileId?: string;
	/** Already known display data; shown while the profile loads. */
	initialName?: string;
	initialAvatarUrl?: string;
}>();

const emit = defineEmits<{ closed: [] }>();

const modal = useTemplateRef('modal');
const profileId = computed(() => props.profileId || 'main');
const profile = ref<ConcrntUserProfile | null>(null);
const loading = ref(!props.initialName);
const failed = ref(false);
const displayName = computed(() => concrntDisplayName(profile.value?.name || props.initialName));
const avatarUrl = computed(() => profile.value?.avatarUrl ?? props.initialAvatarUrl);
// Profile text is CFM from another server: links and emoji only, never MFM or HTML.
const descriptionParts = computed(() => profile.value?.description ? concrntContentParts(profile.value.description) : []);

function close(): void { modal.value?.close(); }

function copyId(): void {
	copyToClipboard(props.ccid);
	os.toast('コンカレントIDをコピーしました');
}

onMounted(async () => {
	try {
		profile.value = await runConcrntAction(client => client.getUserProfile(props.ccid, profileId.value));
	} catch {
		failed.value = true;
	} finally {
		loading.value = false;
	}
});
</script>

<style lang="scss" module>
.root {
	width: 350px;
	max-width: calc(100vw - 32px);
	max-height: calc(100vh - 64px);
	margin: auto;
	overflow: hidden auto;
	border-radius: 16px;
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
}

.loading {
	padding: 40px;
	text-align: center;
}

.content {
	display: flex;
	flex-direction: column;
}

.banner {
	position: relative;
	height: 100px;
	background-color: color-mix(in srgb, var(--MI_THEME-accent) 30%, var(--MI_THEME-bg));
	background-position: center;
	background-size: cover;
}

.closeBtn {
	position: absolute;
	top: 8px;
	right: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border-radius: 50%;
	background: rgba(0, 0, 0, .5);
	color: #fff;
	font-size: .9em;
	transition: background .2s;

	&:hover { background: rgba(0, 0, 0, .7); }
}

.avatarArea {
	position: relative;
	z-index: 2;
	display: flex;
	justify-content: center;
	margin-top: -36px;
}

.avatar {
	box-sizing: border-box;
	width: 72px;
	height: 72px;
	border: 4px solid var(--MI_THEME-panel);
	border-radius: 50%;
	background: var(--MI_THEME-panel);
	object-fit: cover;
}

.avatarFallback {
	display: grid;
	place-items: center;
	color: var(--MI_THEME-fgTransparentWeak);
	font-size: 32px;
}

.nameArea {
	padding: 8px 20px 0;
	text-align: center;
}

.name {
	font-size: 1.1em;
	font-weight: bold;
	overflow-wrap: anywhere;
}

.source {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	margin-top: 4px;
	font-size: .8em;
	opacity: .7;
}

.description,
.noDescription {
	margin-top: 12px;
	padding: 12px 20px;
	border-top: 1px solid var(--MI_THEME-divider);
	border-bottom: 1px solid var(--MI_THEME-divider);
	font-size: .85em;
}

.description {
	max-height: 180px;
	overflow-y: auto;
	line-height: 1.6;
	white-space: pre-wrap;
	overflow-wrap: anywhere;

	a {
		color: var(--MI_THEME-link);
	}
}

.noDescription {
	text-align: center;
	opacity: .5;
}

.emoji {
	height: 1.4em;
	max-width: 5em;
	object-fit: contain;
	vertical-align: -.3em;
}

.actions {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 14px 16px 16px;
}

.actionBtn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	width: 100%;
	padding: 10px 16px;
	border-radius: 8px;
	background: var(--MI_THEME-buttonBg);
	color: var(--MI_THEME-fg);
	font-size: .9em;
	transition: background .2s;

	&:hover { background: var(--MI_THEME-buttonHoverBg); }
}
</style>
