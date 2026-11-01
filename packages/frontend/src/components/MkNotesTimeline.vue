<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkPagination :paginator="paginator" :direction="direction" :autoLoad="autoLoad" :pullToRefresh="pullToRefresh" :withControl="withControl" :onRefresh="onRefresh">
	<template #empty><MkResult type="empty" :text="i18n.ts.noNotes"/></template>

	<template #default="{ items: notes }">
		<div ref="listEl" :class="[$style.root, { [$style.noGap]: noGap, '_gaps': !noGap }]">
			<template v-for="(note, i) in notes" :key="note.id">
				<div
					v-if="i > 0 && isSeparatorNeeded(paginator.items.value[i - 1].createdAt, note.createdAt)"
					:data-scroll-anchor="note.id"
					:data-note-removal-id="note.id"
					:class="{ '_gaps': !noGap }"
				>
					<div :class="[$style.date, { [$style.noGap]: noGap }]">
						<span><i class="ti ti-chevron-up"></i> {{ getSeparatorInfo(paginator.items.value[i - 1].createdAt, note.createdAt)?.prevText }}</span>
						<span style="height: 1em; width: 1px; background: var(--MI_THEME-divider);"></span>
						<span>{{ getSeparatorInfo(paginator.items.value[i - 1].createdAt, note.createdAt)?.nextText }} <i class="ti ti-chevron-down"></i></span>
					</div>
					<MkNote :class="$style.note" :note="note" :withHardMute="true" :notification="notification" :forceShowReplyTargetNote="forceShowReplyTargetNote"/>
					<div v-if="note._shouldInsertAd_" :class="$style.ad">
						<MkAd :preferForms="['horizontal', 'horizontal-big']"/>
					</div>
				</div>
				<div v-else-if="note._shouldInsertAd_" :class="{ '_gaps': !noGap }" :data-scroll-anchor="note.id" :data-note-removal-id="note.id">
					<MkNote :class="$style.note" :note="note" :withHardMute="true" :notification="notification" :forceShowReplyTargetNote="forceShowReplyTargetNote"/>
					<div :class="$style.ad">
						<MkAd :preferForms="['horizontal', 'horizontal-big']"/>
					</div>
				</div>
				<MkNote v-else :class="$style.note" :note="note" :withHardMute="true" :data-scroll-anchor="note.id" :data-note-removal-id="note.id" :notification="notification" :forceShowReplyTargetNote="forceShowReplyTargetNote"/>
			</template>
		</div>
	</template>
</MkPagination>
</template>

<script lang="ts" setup generic="T extends IPaginator<Misskey.entities.Note>">
import { shallowRef } from 'vue';
import * as Misskey from 'cherrypick-js';
import type { IPaginator } from '@/utility/paginator.js';
import MkNote from '@/components/MkNote.vue';
import MkPagination from '@/components/MkPagination.vue';
import { i18n } from '@/i18n.js';
import { useGlobalEvent } from '@/events.js';
import { isSeparatorNeeded, getSeparatorInfo } from '@/utility/timeline-date-separate.js';
import { useNoteRemoval } from '@/composables/use-note-removal.js';

const props = withDefaults(defineProps<{
	paginator: T;
	noGap?: boolean;

	direction?: 'up' | 'down' | 'both';
	autoLoad?: boolean;
	pullToRefresh?: boolean;
	withControl?: boolean;
	notification?: boolean;
	forceShowReplyTargetNote?: boolean;

	// 旗鯖fork: 引っ張って更新時のカスタム処理 (TTL の新 seed 再集計用)。MkPagination に中継する。
	onRefresh?: () => Promise<void>;
}>(), {
	autoLoad: true,
	direction: 'down',
	pullToRefresh: true,
	withControl: true,
	notification: false,
	forceShowReplyTargetNote: false,
});

const listEl = shallowRef<HTMLElement | null>(null);
const removal = useNoteRemoval(() => listEl.value);
useGlobalEvent('noteDeleted', noteId => {
	removal.remove(noteId, () => props.paginator.removeItem(noteId));
});

function reload() {
	removal.cancelAll();
	return props.paginator.reload();
}

useGlobalEvent('reloadNotification', reload);

defineExpose({
	reload,
});
</script>

<style lang="scss" module>
.root {
	container-type: inline-size;

	&.noGap {
		background: var(--MI-notes-canvas, var(--MI_THEME-panel));

		.note {
			background: var(--MI-notes-surface, transparent);
			border-bottom: solid 0.5px var(--MI_THEME-divider);
		}

		.ad {
			padding: 8px;
			background-size: auto auto;
			background-image: repeating-linear-gradient(45deg, transparent, transparent 8px, var(--MI_THEME-bg) 8px, var(--MI_THEME-bg) 14px);
			border-bottom: solid 0.5px var(--MI_THEME-divider);
		}
	}

	&:not(.noGap) {
		background: var(--MI-notes-canvas, var(--MI_THEME-bg));

		.note {
			background: var(--MI-notes-surface, var(--MI_THEME-panel));
			border-radius: var(--MI-radius);
		}
	}

	.note {
		-webkit-backdrop-filter: var(--MI-notes-backdrop-filter, none);
		backdrop-filter: var(--MI-notes-backdrop-filter, none);
	}
}

.date {
	display: flex;
	font-size: 85%;
	align-items: center;
	justify-content: center;
	gap: 1em;
	opacity: 0.75;
	padding: 8px 8px;
	margin: 0 auto;

	&.noGap {
		border-bottom: solid 0.5px var(--MI_THEME-divider);
	}
}

.ad:empty {
	display: none;
}
</style>
