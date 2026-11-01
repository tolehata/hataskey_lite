<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div :class="$style.message" :data-navbar-notice-kind="notice.kind">
	<template v-if="notice.kind === 'emojiAdded'"><span :class="$style.check" aria-hidden="true"><i class="ti ti-check" :class="$style.checkIcon"></i></span><span :class="$style.full">{{ copy.emojiPrefix }}</span><span :class="$style.compact">{{ copy.emojiCompactPrefix }}</span><span :class="$style.emoji"><MkCustomEmoji :name="notice.emoji.name" :url="notice.emoji.url" normal noStyle fallbackToImage/></span><span :class="$style.full">{{ copy.emojiRest }}</span><span :class="$style.compact">{{ copy.emojiCompactRest }}</span></template>
	<template v-else-if="notice.kind === 'noteAction'"><MkNoteActionAnimation :action="notice.action" :motion="motion"/><span :class="$style.noteCopy"><span :class="$style.noteTitle">{{ notice.message }}</span><span v-if="notice.target" :class="$style.noteTarget">{{ notice.target }}</span></span></template>
	<template v-else-if="notice.kind === 'hourlyTime'"><i class="ti ti-clock" :class="$style.clock" aria-hidden="true"></i><span :class="$style.time">{{ i18n.tsx._hata._navbarNotice.timeSignal({ time: notice.time }) }}</span></template>
	<template v-else><span :class="$style.status"><MkHataskeyNoticeIcon :icon="statusIcon(notice.icon)" :animations="motion"/><span>{{ notice.message }}</span></span></template>
</div>
</template>

<script setup lang="ts">
import type { HataskeyNavbarNotice } from '@/utility/hataskey-notification-toast.js';
import MkNoteActionAnimation from '@/components/MkNoteActionAnimation.vue';
import MkHataskeyNoticeIcon from '@/components/MkHataskeyNoticeIcon.vue';
import { i18n } from '@/i18n.js';

withDefaults(defineProps<{ notice: HataskeyNavbarNotice; motion?: boolean }>(), { motion: true });
const copy = i18n.ts._hata._navbarNotice;

function statusIcon(icon?: string): string {
	const aliases: Record<string, string> = {
		posted: 'ti-check', reply: 'ti-arrow-back-up', renote: 'ti-repeat', quote: 'ti-quote',
		edited: 'ti-pencil', drafted: 'ti-pencil-minus', scheduled: 'ti-calendar-time', copied: 'ti-copy',
	};
	if (icon?.startsWith('ti ')) return icon;
	return `ti ${aliases[icon ?? ''] ?? 'ti-check'}`;
}
</script>

<style module lang="scss">
.message { min-height: 44px; font-size: 13px; line-height: 44px; white-space: nowrap; text-align: center; }
.check {
	display: inline-grid; place-items: center; box-sizing: border-box;
	width: 14px; height: 14px; margin-inline-end: 4px; vertical-align: middle; line-height: 0;
	border: 1.5px solid var(--MI_THEME-panel); border-radius: 50%; background: var(--MI_THEME-success); color: #fff;
}
.checkIcon { display: grid; place-items: center; width: 9px; height: 9px; font-size: 9px; line-height: 1; }
.emoji { display: inline-block; width: 28px; height: 28px; margin-inline: 3px; vertical-align: middle; line-height: 0; }
.emoji > img { display: block; width: 100%; height: 100%; max-width: none; max-height: none; object-fit: contain; }
.compact { display: none; }
.clock { display: inline-grid; place-items: center; width: 22px; height: 22px; margin-inline-end: 7px; vertical-align: middle; font-size: 22px; line-height: 1; }
.time { font-variant-numeric: tabular-nums; }
.status { display: inline-flex; align-items: center; justify-content: center; gap: 8px; line-height: 1.4; white-space: normal; vertical-align: middle; }
.status i { flex: none; }
.status span { min-width: 0; overflow-wrap: anywhere; }
.message[data-navbar-notice-kind='noteAction'] { display: flex; align-items: center; justify-content: center; min-width: 0; line-height: normal; }
.noteCopy { display: flex; flex: 0 1 auto; flex-direction: column; justify-content: center; min-width: 0; padding-inline-start: 7px; line-height: 1.3; text-align: start; }
.noteTitle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; }
.noteTarget { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; color: var(--hata-toast-muted, var(--MI_THEME-fgMuted)); font-size: 11px; }
@container hataskey-notice (max-width: 500px) {
	.full { display: none; }
	.compact { display: inline; }
}
@container hataskey-notice (max-width: 280px) {
	.message { font-size: 12px; }
	.emoji { width: 26px; height: 26px; }
}
</style>
