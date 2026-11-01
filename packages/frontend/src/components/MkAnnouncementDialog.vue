<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal ref="modal" :zPriority="'middle'" :preferType="'dialog'" @closed="$emit('closed')" @click="onBgClick">
	<div ref="rootEl" :class="$style.root">
		<div :class="$style.header">
			<span :class="$style.icon">
				<i v-if="announcement.icon === 'info'" class="ti ti-info-circle"></i>
				<i v-else-if="announcement.icon === 'warning'" class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i>
				<i v-else-if="announcement.icon === 'error'" class="ti ti-circle-x" style="color: var(--MI_THEME-error);"></i>
				<i v-else-if="announcement.icon === 'success'" class="ti ti-check" style="color: var(--MI_THEME-success);"></i>
				<i v-else-if="announcement.icon === 'maintenance'" class="ti ti-tool" style="color: var(--MI_THEME-error);"></i>
			</span>
			<Mfm :text="announcement.title"/>
		</div>
		<div :class="$style.content">
			<Mfm :text="announcement.text"/>
			<!-- 旗鯖fork: メンテナンスお知らせの進捗バー(4段階) -->
			<MkAnnouncementProgress
				v-if="announcement.icon === 'maintenance' && announcement.progressSteps"
				:steps="announcement.progressSteps"
				:completed="announcement.progressCompleted"
			/>
			<img v-if="announcement.imageUrl" :src="announcement.imageUrl"/>
		</div>
		<div ref="bottomEl"></div>
		<div :class="$style.footer">
			<MkButton
				primary
				rounded
				full
				:disabled="!hasReachedBottom"
				@click="ok"
			>
				{{ hasReachedBottom ? i18n.ts.close : i18n.ts.scrollToClose }}
			</MkButton>
			<!-- 旗鯖fork: お知らせ一覧画面へ遷移するボタン -->
			<MkButton
				rounded
				full
				:class="$style.toListButton"
				@click="goToList"
			>
				<i class="ti ti-speakerphone"></i> {{ i18n.ts.goToAnnouncements }}
			</MkButton>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { onMounted, ref, useTemplateRef } from 'vue';
import * as Misskey from 'cherrypick-js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import MkModal from '@/components/MkModal.vue';
import MkButton from '@/components/MkButton.vue';
import MkAnnouncementProgress from '@/components/MkAnnouncementProgress.vue';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { updateCurrentAccount } from '@/accounts.js';
import { mainRouter } from '@/router.js';

const props = defineProps<{
	announcement: Misskey.entities.Announcement;
}>();

const rootEl = useTemplateRef('rootEl');
const bottomEl = useTemplateRef('bottomEl');
const modal = useTemplateRef('modal');

async function ok() {
	if (props.announcement.needConfirmationToRead) {
		const confirm = await os.confirm({
			type: 'question',
			title: i18n.ts._announcement.readConfirmTitle,
			text: i18n.tsx._announcement.readConfirmText({ title: props.announcement.title }),
		});
		if (confirm.canceled) return;
	}

	modal.value?.close();
	misskeyApi('i/read-announcement', { announcementId: props.announcement.id });
	updateCurrentAccount({
		unreadAnnouncements: $i!.unreadAnnouncements.filter(a => a.id !== props.announcement.id),
	});
}

// 旗鯖fork: お知らせ一覧画面へ遷移する。既読化は明示的な「閉じる」(ok) のときだけ行い、
// ここでは遷移のみとする (既読確認が必要なお知らせを遷移ボタンで勝手に既読にしないため)
function goToList() {
	modal.value?.close();
	mainRouter.push('/announcements');
}

function onBgClick() {
	rootEl.value?.animate([{
		offset: 0,
		transform: 'scale(1)',
	}, {
		offset: 0.5,
		transform: 'scale(1.1)',
	}, {
		offset: 1,
		transform: 'scale(1)',
	}], {
		duration: 100,
	});
}

const hasReachedBottom = ref(false);

onMounted(() => {
	if (bottomEl.value && rootEl.value) {
		const bottomElRect = bottomEl.value.getBoundingClientRect();
		const rootElRect = rootEl.value.getBoundingClientRect();
		if (
			bottomElRect.top >= rootElRect.top &&
			bottomElRect.top <= (rootElRect.bottom - 66) // 66 ≒ 75 * 0.9 (modalのアニメーション分)
		) {
			hasReachedBottom.value = true;
			return;
		}

		const observer = new IntersectionObserver(entries => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					hasReachedBottom.value = true;
					observer.disconnect();
				}
			}
		}, {
			root: rootEl.value,
			rootMargin: '0px 0px -75px 0px',
		});

		observer.observe(bottomEl.value);
	}
});
</script>

<style lang="scss" module>
.root {
	margin: auto;
	position: relative;
	padding: 32px 32px 0;
	min-width: 320px;
	max-width: 480px;
	max-height: 100%;
	overflow-y: auto;
	overflow-x: hidden;
	box-sizing: border-box;
	background: var(--MI_THEME-panel);
	border-radius: var(--MI-radius);
}

.header {
	font-weight: bold;
	font-size: 120%;
}

.icon {
	margin-right: 0.5em;
}

.content {
	margin: 1em 0;

	> img {
		display: block;
		max-height: 300px;
		max-width: 100%;
	}
}

.footer {
	position: sticky;
	bottom: 0;
	left: -32px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	backdrop-filter: var(--MI-blur, blur(15px));
	background: color(from var(--MI_THEME-bg) srgb r g b / 0.5);
	margin: 0 -32px;
	padding: 24px 32px;
}

.toListButton {
	// 「閉じる」ボタンより控えめな見た目 (primary なし)。間隔は .footer の gap で確保
}
</style>
