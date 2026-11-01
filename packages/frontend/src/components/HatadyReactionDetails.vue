<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<MkTooltip
	:class="[variant !== 'ui' && 'hatady-scope', $style.tooltip]"
	:data-hatady-theme="theme"
	:data-hatady-variant="variant"
	:showing="showing"
	:anchorElement="anchorElement"
	:maxWidth="280"
	role="tooltip"
	@closed="emit('closed')"
>
	<div :class="$style.heading">
		<MkReactionIcon :reaction="reaction" :class="$style.emoji" :noStyle="true"/>
		<span v-if="reactionName" :class="$style.name">{{ reactionName }}</span>
		<strong :class="$style.count">{{ i18n.tsx._hata._hatady._reactions.peopleCount({ count: String(count) }) }}</strong>
	</div>
	<ul :class="$style.users">
		<li v-for="user in users" :key="user.id">
			<MkAvatar :user="user" :class="$style.avatar"/>
			<span :class="$style.userDetails">
				<span :class="$style.userName"><MkUserName :user="user" :nowrap="true"/></span>
				<span :class="$style.acct">@{{ user.username }}{{ user.host ? `@${user.host}` : '' }}</span>
			</span>
		</li>
	</ul>
	<p v-if="count > users.length" :class="$style.more">{{ i18n.tsx._hata._hatady._reactions.morePeople({ count: String(count - users.length) }) }}</p>
</MkTooltip>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type * as Misskey from 'cherrypick-js';
import { getEmojiName } from '@@/js/emojilist.js';
import MkTooltip from '@/components/MkTooltip.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import { hatadyTheme } from '@/utility/hatady-prefs.js';
import { i18n } from '@/i18n.js';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';

const theme = hatadyTheme;
const props = defineProps<{
	showing: boolean;
	anchorElement: HTMLElement;
	reaction: string;
	users: Misskey.entities.UserLite[];
	count: number;
	variant: HatadySurfaceVariant;
}>();
const emit = defineEmits<{ (ev: 'closed'): void }>();
const reactionName = computed(() => {
	if (props.reaction.startsWith(':')) return props.reaction.replace('@.', '');
	const name = getEmojiName(props.reaction);
	return name === props.reaction ? '' : name;
});
</script>

<style lang="scss" module>
.tooltip {
	width: min(280px, calc(100vw - 32px));
	box-sizing: border-box;
	padding: 10px 12px;
	pointer-events: none;
}
.tooltip[data-hatady-variant='hatady'] {
	background: var(--hy-surface);
	color: var(--hy-body);
	border: 1px solid var(--hy-border);
	border-radius: 18px;
	box-shadow: 0 18px 50px #0b242b33;
}
.tooltip[data-hatady-variant='uis'] {
	background: color-mix(in srgb, var(--MI_THEME-panel) 80%, transparent);
	color: var(--MI_THEME-fg);
	border: 1px solid color-mix(in srgb, var(--MI_THEME-fg) 14%, transparent);
	border-radius: 16px;
	backdrop-filter: blur(22px) saturate(1.15);
}
.tooltip[data-hatady-variant='ui'] {
	border-radius: 10px;
}
.heading {
	display: flex;
	align-items: center;
	gap: 8px;
	padding-bottom: 8px;
	border-bottom: 1px solid var(--MI_THEME-divider);
}
.tooltip[data-hatady-variant='hatady'] .heading { border-color: var(--hy-border); }
.tooltip[data-hatady-variant='uis'] .heading { border-color: color-mix(in srgb, var(--MI_THEME-fg) 14%, transparent); }
.emoji {
	flex: none;
	width: 28px;
	height: 28px;
	font-size: 28px;
}
.name {
	flex: 1;
	min-width: 0;
	font-size: 11px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	opacity: 0.7;
}
.count {
	flex: none;
	margin-left: auto;
	font-size: 12px;
	white-space: nowrap;
}
.users {
	list-style: none;
	margin: 6px 0 0;
	padding: 0;
	display: grid;
	gap: 4px;
	text-align: left;
}
.users li {
	display: flex;
	align-items: center;
	gap: 8px;
	min-height: 32px;
}
.avatar {
	flex: none;
	width: 28px;
	height: 28px;
	border-radius: 50%;
}
.tooltip[data-hatady-variant='uis'] .avatar { border-radius: 0; }
.userDetails {
	display: block;
	flex: 1;
	min-width: 0;
}
.userName {
	display: block;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.acct {
	display: block;
	min-width: 0;
	font-size: 11px;
	opacity: 0.7;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.more {
	margin: 6px 0 0;
	text-align: right;
	opacity: 0.7;
}
</style>
