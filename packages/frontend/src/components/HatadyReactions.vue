<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(Hatady 1d/1g): 学習ログ / コメントのリアクション表示 + 操作。
  リアクションは hataskey 共通の絵文字ピッカー(reactionPicker)で任意に選べる(要件⑤・♡固定でない)。
  1ユーザー1対象1リアクション。ピルをクリックで付与/取消。カスタム絵文字は MkReactionIcon で描画。
-->
<template>
<span :class="$style.root">
	<HatadyReactionPill
		v-for="(count, emoji) in reactionsLocal"
		:key="emoji"
		:target="target"
		:reaction="String(emoji)"
		:count="count"
		:pressed="myReactionLocal === emoji"
		:actionLabel="myReactionLocal === emoji ? copy.remove : copy.add"
		:variant="variant"
		:disabled="busy"
		:class="[$style.pill, myReactionLocal === emoji && $style.pillOn]"
		@activate="toggle(String(emoji))"
	/>
	<button
		ref="addEl"
		:disabled="busy"
		:class="$style.add"
		:title="copy.add"
		:aria-label="copy.add"
		@click="openPicker"
	>
		<i class="ti ti-mood-plus"></i>
	</button>
</span>
</template>

<script lang="ts" setup>
import { ref, watch, useTemplateRef } from 'vue';
import HatadyReactionPill from '@/components/HatadyReactionPill.vue';
import { i18n } from '@/i18n.js';
import { useHataGoesEmojiPickers } from '@/utility/hatagoes-emoji-pickers.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import { invalidateHatadyReactionUsers } from '@/utility/hatady-reaction-details.js';
import type { HatadyReactionTarget } from '@/utility/hatady-reaction-details.js';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';

const copy = i18n.ts._hata._hatady._reactions;
const { showReactionPicker } = useHataGoesEmojiPickers();

const props = withDefaults(defineProps<{
	target: HatadyReactionTarget;
	reactions: Record<string, number>;
	myReaction: string | null;
	variant?: HatadySurfaceVariant;
}>(), { variant: 'hatady' });

const emit = defineEmits<{
	(ev: 'changed', v: { reactions: Record<string, number>; myReaction: string | null }): void;
}>();

// 楽観的更新用のローカル状態。
const reactionsLocal = ref<Record<string, number>>({ ...props.reactions });
const myReactionLocal = ref<string | null>(props.myReaction);
const addEl = useTemplateRef('addEl');

function apply(reactions: Record<string, number>, mine: string | null) {
	// 0 件になった絵文字は消す。
	for (const k of Object.keys(reactions)) if (reactions[k] <= 0) delete reactions[k];
	reactionsLocal.value = reactions;
	myReactionLocal.value = mine;
	emit('changed', { reactions: { ...reactions }, myReaction: mine });
}

function localApplyReact(emoji: string) {
	const r = { ...reactionsLocal.value };
	const prev = myReactionLocal.value;
	if (prev) r[prev] = (r[prev] ?? 1) - 1; // 既存を1減らす
	r[emoji] = (r[emoji] ?? 0) + 1;
	apply(r, emoji);
}

function localApplyUnreact() {
	const r = { ...reactionsLocal.value };
	const prev = myReactionLocal.value;
	if (prev) r[prev] = (r[prev] ?? 1) - 1;
	apply(r, null);
}

const busy = ref(false);
watch(
	() => [props.reactions, props.myReaction],
	() => {
		if (!busy.value) {
			reactionsLocal.value = { ...props.reactions };
			myReactionLocal.value = props.myReaction;
		}
	},
	{ deep: true },
);

async function toggle(emoji: string) {
	if (busy.value) return;
	busy.value = true;
	const remove = myReactionLocal.value === emoji;
	try {
		const media = !!(props.target.sessionId || props.target.mediaCommentId);
		const payload = media
			? {
				targetType: props.target.mediaCommentId ? 'comment' : 'session',
				targetId: props.target.mediaCommentId || props.target.sessionId,
			}
			: cleanTarget();
		await (misskeyApi as any)(`hata/hatady/${media ? 'media/' : ''}reactions/${remove ? 'delete' : 'create'}`, {
			...payload,
			...(!remove ? { reaction: emoji } : {}),
		});
		invalidateHatadyReactionUsers(props.target);
		if (remove) localApplyUnreact();
		else localApplyReact(emoji);
	} catch {
		hatadyNotify(copy.updateFailed);
	} finally {
		busy.value = false;
	}
}

function openPicker() {
	if (!busy.value) showReactionPicker(addEl.value ?? null, null, (reaction) => {
		void toggle(reaction);
	});
}

// null のキーを送らない(ajv 対策)。
function cleanTarget(): Record<string, string> {
	const t: Record<string, string> = {};
	if (props.target.commentId) t.commentId = props.target.commentId;
	else if (props.target.logId) t.logId = props.target.logId;
	return t;
}
</script>

<style lang="scss" module>
.root {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	flex-wrap: wrap;
}
.pill {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	min-height: 44px;
	padding: 5px 12px;
	border-radius: 999px;
	background: var(--hy-chip-bg);
	border: 1.5px solid transparent;
	font-size: 12px;
	font-weight: 700;
	color: var(--hy-body);
	cursor: pointer;
	transition: all 0.12s;
}
.pill:hover {
	border-color: var(--hy-border);
}
.pillOn {
	background: color-mix(in srgb, var(--hy-accent) 18%, transparent);
	border-color: var(--hy-accent);
	color: var(--hy-accent-ink);
}
.add {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 44px;
	height: 44px;
	border-radius: 999px;
	background: var(--hy-chip-bg);
	border: 1px solid var(--hy-border);
	color: var(--hy-body);
	cursor: pointer;
	transition: all 0.12s;
}
.add:hover {
	background: var(--hy-accent);
	color: #fff;
	border-color: transparent;
}
</style>
