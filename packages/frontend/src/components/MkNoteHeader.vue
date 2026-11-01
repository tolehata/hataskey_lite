<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<header :class="$style.root">
	<div :class="$style.section">
		<div style="display: flex; white-space: nowrap; align-items: baseline;">
			<div v-if="mock" :class="$style.name">
				<MkUserName :user="note.user"/>
			</div>
			<MkA v-else v-user-preview="note.user.id" :class="$style.name" :to="userPage(note.user)" noteClick>
				<MkUserName :user="note.user"/>
			</MkA>
			<!-- 旗鯖fork: 承認制(フォロー許可制)アカウントを示す鍵アイコンはタイムラインのノートヘッダーでは非表示にする -->
			<div v-if="note.user.isBot" :class="$style.userBadge"><i class="ti ti-robot"></i></div>
			<div v-if="note.user.isProxy" :class="$style.userBadge"><i class="ti ti-ghost"></i></div>
			<MkUserRoleBadges :user="note.user"/>
			<div :class="$style.username"><MkAcct :user="note.user"/></div>
		</div>
	</div>
	<div :class="$style.section">
		<!-- 旗鯖fork: 外部サーバーラベル(ticker)を日時の左に配置。
		     旧実装は日時の info ブロックの後ろ(下)に別 div で置かれ、かつ :style に
		     クラス名を渡していた(:class が正)ため、ラベルが日時の下に表示されていた。 -->
		<div v-if="tickerVisible" :class="$style.ticker"><MkInstanceTicker :host="note.user.host" :instance="note.user.instance" @click.stop="showOnRemote"/></div>
		<div :class="$style.info">
			<span v-if="note.updatedAt" style="margin-right: 0.5em;"><i v-tooltip="i18n.tsx.noteUpdatedAt({ date: (new Date(note.updatedAt)).toLocaleDateString(), time: (new Date(note.updatedAt)).toLocaleTimeString() })" class="ti ti-pencil"></i></span>
			<span v-if="note.deleteAt" style="margin-right: 0.5em;"><i v-tooltip="`${i18n.ts.scheduledNoteDelete}: ${(new Date(note.deleteAt)).toLocaleString()}`" class="ti ti-bomb"></i></span>
			<span v-if="note.visibility !== 'public'" style="margin-right: 0.5em;">
				<i v-if="note.visibility === 'home'" v-tooltip="i18n.ts._visibility[note.visibility]" class="ti ti-home"></i>
				<i v-else-if="note.visibility === 'followers'" v-tooltip="i18n.ts._visibility[note.visibility]" class="ti ti-lock"></i>
				<i v-else-if="note.visibility === 'specified'" ref="specified" v-tooltip="i18n.ts._visibility[note.visibility]" class="ti ti-mail"></i>
			</span>
			<span v-if="note.reactionAcceptance != null" style="margin-right: 0.5em;" :class="{ [$style.danger]: ['nonSensitiveOnly', 'nonSensitiveOnlyForLocalLikeOnlyForRemote', 'likeOnly'].includes(<string>note.reactionAcceptance) }" :title="i18n.ts.reactionAcceptance">
				<i v-if="note.reactionAcceptance === 'likeOnlyForRemote'" v-tooltip="i18n.ts.likeOnlyForRemote" class="ti ti-heart-plus"></i>
				<i v-else-if="note.reactionAcceptance === 'nonSensitiveOnly'" v-tooltip="i18n.ts.nonSensitiveOnly" class="ti ti-icons"></i>
				<i v-else-if="note.reactionAcceptance === 'nonSensitiveOnlyForLocalLikeOnlyForRemote'" v-tooltip="i18n.ts.nonSensitiveOnlyForLocalLikeOnlyForRemote" class="ti ti-heart-plus"></i>
				<i v-else-if="note.reactionAcceptance === 'likeOnly'" v-tooltip="i18n.ts.likeOnly" class="ti ti-heart"></i>
			</span>
			<span v-if="note.localOnly" style="margin-right: 0.5em;"><i v-tooltip="i18n.ts._visibility['disableFederation']" class="ti ti-rocket-off"></i></span>
			<span
				v-if="note.deliveryTargets && (note.deliveryTargets.mode === 'include' || note.deliveryTargets.hosts?.length)"
				v-tooltip="deliveryTargetsTooltip(note.deliveryTargets)"
				style="margin-right: 0.5em;"
			>
				<i :class="note.deliveryTargets.mode === 'include' ? 'ti ti-truck' : 'ti ti-truck-filled'"></i>
			</span>
			<span v-if="note.channel" style="margin-right: 0.5em;"><i v-tooltip="note.channel.name" class="ti ti-device-tv"></i></span>
			<div v-if="mock">
				<MkTime :time="note.createdAt" colored/>
			</div>
			<MkA v-else :class="$style.time" :to="notePage(note)">
				<MkTime :time="note.createdAt" :mode="prefer.s.enableAbsoluteTime ? 'absolute' : 'relative'" colored/>
			</MkA>
		</div>
	</div>
</header>
</template>

<script lang="ts" setup>
import { inject } from 'vue';
import * as Misskey from 'cherrypick-js';
import { i18n } from '@/i18n.js';
import { notePage } from '@@/js/note.js';
import { userPage } from '@/filters/user.js';
import { DI } from '@/di.js';
import { prefer } from '@/preferences.js';
import { useRouter } from '@/router.js';
import MkInstanceTicker from '@/components/MkInstanceTicker.vue';
import MkUserRoleBadges from '@/components/MkUserRoleBadges.vue';

const props = withDefaults(defineProps<{
	note: Misskey.entities.Note;
	showTicker?: boolean;
	deliveryTargets?: {
		mode: 'include' | 'exclude';
		hosts: string[];
	} | null;
}>(), { showTicker: true });

const mock = inject(DI.mock, false);

const tickerVisible = props.showTicker && ((prefer.s.instanceTicker === 'always') || (prefer.s.instanceTicker === 'remote' && props.note.user.instance));
const router = useRouter();

function deliveryTargetsTooltip(targets: Misskey.entities.Note['deliveryTargets']): string {
	if (!targets) return '';
	const title = i18n.ts._deliveryTargetControl[targets.mode === 'include' ? 'deliveryTargetsInclude' : 'deliveryTargetsExclude'];
	const hosts = targets.hosts ?? [];
	const details = hosts.length > 0
		? hosts.map((hostName, index) => targets.names?.[index] ? `${targets.names[index]} (${hostName})` : hostName).join('\n')
		: i18n.ts.none;
	return `${title}:\n${details}`;
}

function showOnRemote() {
	if (props.note.user.instance === undefined) router.pushByPath(notePage(props.note));
	else window.open(props.note.url ?? props.note.uri, '_blank', 'noopener');
}
</script>

<style lang="scss" module>
.root {
	display: flex;
}

.section {
	align-items: flex-start;
	white-space: nowrap;
	flex-direction: column;
	overflow: hidden;

	&:last-child {
		display: flex;
		flex-direction: row;
		align-items: center;
		margin-left: auto;
		padding-left: 10px;
		overflow: clip;
		gap: 0.5em;
	}
}

.ticker {
	/* 旗鯖fork: 外部サーバーラベルをノートカードの右下隅に配置。
	   MkNote の .root (position: relative) を基準に絶対配置する。 */
	position: absolute;
	right: 12px;
	bottom: 8px;
	z-index: 2;
	flex-shrink: 0;
	overflow: hidden;
	display: flex;
	align-items: center;
	pointer-events: auto;

	> :global(*) {
		margin-top: 0;
	}
}

.name {
	flex-shrink: 1;
	display: block;
	margin: 0 .5em 0 0;
	padding: 0;
	overflow: hidden;
  overflow-wrap: anywhere;
	font-size: 1em;
	font-weight: bold;
	text-decoration: none;
	text-overflow: ellipsis;
	max-width: 300px;

  &::-webkit-scrollbar {
    display: none;
  }

	&:hover {
		color: var(--MI_THEME-nameHover);
		text-decoration: none;
	}
}

.userBadge {
	margin: 0 .5em 0 0;
}

.isBot {
	flex-shrink: 0;
	align-self: center;
	margin: 0 .5em 0 0;
	padding: 1px 6px;
	font-size: 80%;
	border: solid 0.5px var(--MI_THEME-divider);
	border-radius: 3px;
}

.username {
	flex-shrink: 9999999;
	margin: 0 .5em 0 0;
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: .95em;
  max-width: 300px;

  &::-webkit-scrollbar {
    display: none;
  }
}

.info {
	flex-shrink: 0;
	margin-left: auto;
	font-size: 0.9em;
}

.time {
	text-decoration: none;

	&:hover {
		text-decoration: none;
	}
}

.danger {
	color: var(--MI_THEME-accent);
}

@container (max-width: 500px) {
	.name, .username {
		max-width: 200px;
	}
}
</style>
