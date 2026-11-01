<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
旗鯖fork: CTL 投稿の宛先ピッカー（world-app の TimelinePicker と同じ考え方）。
投稿するプロフィール（公開／鍵）、自分のホームへの投稿、複数のタイムラインを選ぶ。
誰が読めるかは選んだプロフィールとタイムラインの設定で決まるため、公開とは表示しない。
-->

<template>
<MkModal ref="modal" v-slot="{ type, maxHeight }" :zPriority="'high'" :preferType="'popup'" :anchorElement="anchorElement" :transparentBg="true" @click="close()" @closed="emit('closed')">
	<div :class="['_popup', $style.root, { [$style.drawer]: type === 'drawer' }]" :style="{ maxHeight: `${maxHeight ? Math.min(maxHeight, 520) : 520}px` }" role="dialog" aria-label="投稿先を選ぶ" @click.stop>
		<section :class="$style.section">
			<h3 :class="$style.heading">投稿するプロフィール</h3>
			<button
				v-for="profile in profiles" :key="profile.id" class="_button" :class="$style.row" role="radio"
				:aria-checked="concrntPostProfile === profile.id" :data-active="concrntPostProfile === profile.id || undefined" @click="concrntDraft.profile = profile.id"
			>
				<img v-if="profile.avatarUrl" :class="$style.avatar" :src="profile.avatarUrl" alt="" referrerpolicy="no-referrer"/>
				<span v-else :class="[$style.avatar, $style.fallback]" aria-hidden="true"><i class="ti ti-user"></i></span>
				<span :class="$style.label">{{ profile.name || profile.id }}<small v-if="profile.id !== 'main'">{{ profile.id }}</small></span>
				<i v-if="profile.visibility === 'restricted'" class="ti ti-lock" :class="$style.lock" title="鍵（閲覧できる人が限られます）"></i>
				<i v-if="concrntPostProfile === profile.id" class="ti ti-check" :class="$style.check"></i>
			</button>
		</section>
		<section :class="$style.section">
			<h3 :class="$style.heading">投稿先</h3>
			<button class="_button" :class="$style.row" role="checkbox" :aria-checked="concrntPostHome" :data-active="concrntPostHome || undefined" @click="concrntDraft.postHome = !concrntPostHome">
				<span :class="[$style.avatar, $style.fallback]" aria-hidden="true"><i class="ti ti-home"></i></span>
				<span :class="$style.label">自分のホーム<small>{{ currentProfile?.name || concrntPostProfile }} のホームTL</small></span>
				<i v-if="currentProfile?.visibility === 'restricted'" class="ti ti-lock" :class="$style.lock" title="鍵（閲覧できる人が限られます）"></i>
				<i :class="[concrntPostHome ? 'ti ti-square-check-filled' : 'ti ti-square', $style.check]"></i>
			</button>
			<button
				v-for="uri in candidates" :key="uri" class="_button" :class="$style.row" role="checkbox"
				:aria-checked="concrntDestinations.includes(uri)" :data-active="concrntDestinations.includes(uri) || undefined" @click="toggle(uri)"
			>
				<img v-if="info[uri]?.iconUrl" :class="$style.avatar" :src="info[uri]!.iconUrl" alt="" referrerpolicy="no-referrer"/>
				<span v-else :class="[$style.avatar, $style.fallback]" aria-hidden="true"><i class="ti ti-hash"></i></span>
				<span :class="$style.label">{{ info[uri]?.name ?? (failed.has(uri) ? '名前を取得できないタイムライン' : '読み込み中…') }}</span>
				<i v-if="info[uri]?.restricted" class="ti ti-lock" :class="$style.lock" title="閲覧できる人が限られるタイムライン"></i>
				<i :class="[concrntDestinations.includes(uri) ? 'ti ti-square-check-filled' : 'ti ti-square', $style.check]"></i>
			</button>
			<p v-if="!candidates.length" :class="$style.note">リストに登録したコミュニティがここに出ます。</p>
		</section>
		<p :class="$style.note"><i class="ti ti-info-circle"></i> 読める人は、選んだプロフィールとタイムラインの設定で決まります。</p>
		<div :class="$style.footer">
			<button v-if="concrntDestinationsCustomized" class="_button" :class="$style.reset" @click="resetConcrntDestinations()"><i class="ti ti-arrow-back-up"></i>リストの既定に戻す</button>
			<button class="_button" :class="$style.done" @click="close()">完了</button>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref, useTemplateRef } from 'vue';
import type { ConcrntTimelineInfo } from '@/utility/concrnt/types.js';
import MkModal from '@/components/MkModal.vue';
import { concrntState, runConcrntAction } from '@/utility/concrnt/runtime.js';
import { concrntDestinations, concrntDestinationsCustomized, concrntDraft, concrntKnownTimelines, concrntPostHome, concrntPostProfile, resetConcrntDestinations } from '@/utility/concrnt/composer.js';

defineProps<{ anchorElement?: HTMLElement | null }>();
const emit = defineEmits<{ closed: [] }>();
const modal = useTemplateRef('modal');
const info = reactive<Record<string, ConcrntTimelineInfo | undefined>>({});
const failed = ref(new Set<string>());

const profiles = computed<{ id: string; name: string; avatarUrl?: string; visibility: string }[]>(() => concrntState.profiles.length ? concrntState.profiles : [{ id: concrntPostProfile.value, name: '', visibility: 'unknown' }]);
const currentProfile = computed(() => concrntState.profiles.find(profile => profile.id === concrntPostProfile.value));
// Keep the order stable while toggling: list communities first, then any extra destination.
// A timeline whose name cannot be read is not offered, unless it is already selected (so it can be removed).
const candidates = computed(() => [...new Set([...concrntKnownTimelines.value, ...concrntDestinations.value])]
	.filter(uri => !failed.value.has(uri) || concrntDestinations.value.includes(uri)));

function toggle(uri: string): void {
	const current = concrntDestinations.value;
	concrntDraft.destinations = current.includes(uri) ? current.filter(item => item !== uri) : [...current, uri];
}

function close(): void { modal.value?.close(); }

onMounted(() => {
	for (const uri of candidates.value) {
		runConcrntAction(client => client.getTimelineInfo(uri)).then(value => { info[uri] = value; }, () => { failed.value = new Set([...failed.value, uri]); });
	}
});
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
	width: 340px;
	max-width: calc(100vw - 24px);
	overflow-y: auto;
	overscroll-behavior: contain;
	border-radius: 16px;
	padding: 8px;
	box-sizing: border-box;
}

.drawer {
	width: 100%;
	max-width: 100%;
	border-radius: 24px 24px 0 0;
}

.section + .section {
	margin-top: 4px;
	padding-top: 4px;
	border-top: 1px solid var(--MI_THEME-divider);
}

.heading {
	margin: 6px 10px 4px;
	font-size: .78em;
	font-weight: 700;
	opacity: .6;
}

.row {
	display: flex;
	align-items: center;
	gap: 10px;
	width: 100%;
	min-height: 44px;
	padding: 6px 10px;
	box-sizing: border-box;
	border-radius: 10px;
	text-align: left;

	&:hover { background: var(--MI_THEME-buttonHoverBg); }
	&[data-active] { color: var(--MI_THEME-accent); }
	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: -2px; }
}

.avatar {
	flex: none;
	width: 28px;
	height: 28px;
	border-radius: 50%;
	object-fit: cover;
}

.fallback {
	display: grid;
	place-items: center;
	background: var(--MI_THEME-buttonBg);
	color: var(--MI_THEME-fg);
	font-size: 15px;
}

.label {
	flex: 1;
	min-width: 0;
	overflow-wrap: anywhere;
	color: var(--MI_THEME-fg);

	small {
		display: block;
		font-size: .78em;
		opacity: .6;
	}
}

.lock {
	opacity: .7;
}

.check {
	flex: none;
	font-size: 1.15em;
}

.note {
	margin: 8px 10px;
	font-size: .8em;
	opacity: .7;
}

.footer {
	display: flex;
	gap: 8px;
	padding: 4px 6px 4px;
}

.reset {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 8px 10px;
	border-radius: 8px;
	font-size: .85em;

	&:hover { background: var(--MI_THEME-buttonHoverBg); }
}

.done {
	margin-left: auto;
	padding: 8px 16px;
	border-radius: 999px;
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);
	font-weight: bold;
}
</style>
