<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div :class="$style.root" inert>
	<div :class="$style.stage" :style="stageStyle">
		<MkNote :class="$style.note" :note="sampleNote" :mock="true" :charmPreview="charm"/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type * as Misskey from 'cherrypick-js';
import MkNote from '@/components/MkNote.vue';
import { i18n } from '@/i18n.js';
import { CHARM_MAX_SIZE, charmGeometry } from '@/utility/note-charm-physics.js';

defineProps<{ charm: { url: string; size: number; pattern: 'cutout' | 'clear' | 'dots' | 'stripes' | 'check'; color: string } | null }>();

// The outside decoration belongs to the preview scene, not the note's box.
// Keep this envelope stable while the image is resized or removed.
// The alpha-cropped artwork can be up to 96px tall, plus its hole and edge.
const maximumCharm = charmGeometry(CHARM_MAX_SIZE, 3, 110);
const stageStyle = {
	'--note-charm-preview-gutter': `${Math.ceil(maximumCharm.railWidth) + 8}px`,
	'--note-charm-preview-min-height': `${Math.ceil(maximumCharm.height) + 64}px`,
};

const sampleNote = computed<Misskey.entities.Note>(() => ({
	id: 'note-charm-preview',
	createdAt: new Date().toISOString(),
	userId: 'note-charm-preview-user',
	user: {
		id: 'note-charm-preview-user', name: 'サンプルユーザー', username: 'sampleuser', host: null,
		avatarUrl: '/client-assets/dummy.png', avatarBlurhash: null, avatarDecorations: [],
		noteCharm: null,
		isBot: false, isCat: false, isLocked: false, emojis: {}, onlineStatus: 'unknown', badgeRoles: [],
	},
	text: i18n.ts._noteCharm.sampleText,
	cw: null, visibility: 'public', localOnly: false, reactionAcceptance: null,
	renoteCount: 0, repliesCount: 0, reactionCount: 0, reactions: {}, reactionEmojis: {},
	fileIds: [], files: [], replyId: null, renoteId: null, hasDeliveryTargets: false,
}));
</script>

<style lang="scss" module>
.root {
	min-width: 0;
	container-type: inline-size;
}

.stage {
	box-sizing: border-box;
	min-width: 0;
	min-height: var(--note-charm-preview-min-height);
	padding: 8px var(--note-charm-preview-gutter) 8px 1px;
}

.note {
	min-width: 0;
	outline: 1px solid var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
	background: var(--MI_THEME-panel);
}
</style>
