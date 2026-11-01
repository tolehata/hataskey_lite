<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<component
	:is="prefer.s.animation ? TransitionGroup : 'div'"
	:enterActiveClass="$style.transition_x_enterActive"
	:leaveActiveClass="$style.transition_x_leaveActive"
	:enterFromClass="$style.transition_x_enterFrom"
	:leaveToClass="$style.transition_x_leaveTo"
	:moveClass="$style.transition_x_move"
	tag="div" :class="$style.root"
>
	<XReaction
		v-for="[reaction, count] in _reactions"
		:key="reaction"
		:reaction="reaction"
		:reactionEmojis="props.reactionEmojis"
		:count="count"
		:isInitial="initialReactions.has(reaction)"
		:noteId="props.noteId"
		:myReaction="props.myReaction"
		:note="props.note"
		:revealMuted="revealMuted"
		@reactionToggled="onMockToggleReaction"
	/>
	<slot v-if="hasMoreReactions" name="more"/>
	<!--
	旗鯖fork(#31): ⚠️ミュートしたユーザーのリアクションを隠したことを、詳細画面でだけ知らせる。
	⚠️一覧(TL)には出さない。⚠️「ここにミュートの人が居る」という印がTLに並ぶと、
	  隠した意味が薄れる（どのノートに誰が反応したかを絞り込めてしまう）。
	⚠️押して初めて中身を出す。既定では出さない。
	-->
	<button
		v-if="props.detailed && mutedHiddenCount > 0"
		type="button"
		:class="[$style.mutedNotice, { [$style.mutedNoticeOn]: revealMuted }]"
		:aria-pressed="revealMuted"
		:title="mutedReactionNotice"
		:aria-label="mutedReactionNotice"
		@click="revealMuted = !revealMuted"
	>
		<i class="ti ti-info-circle"></i>
	</button>
</component>
</template>

<script lang="ts" setup>
import * as Misskey from 'cherrypick-js';
import { computed, inject, watch, ref } from 'vue';
import { TransitionGroup } from 'vue';
import { isSupportedEmoji } from '@@/js/emojilist.js';
import { getEmojiNameFromReaction, isLocalCustomEmojiReaction } from '@@/js/emoji-name.js';
import XReaction from '@/components/MkReactionsViewer.reaction.vue';
import { $i } from '@/i.js';
import { prefer } from '@/preferences.js';
import { customEmojisMap } from '@/custom-emojis.js';
import { checkMuted as isEmojiMuted } from '@/utility/emoji-mute.js';
import { fetchMutedUsers, mutedUsersRevision } from '@/utility/muted-users.js';
// 旗鯖fork(#31): リアクターを共有ストア経由で取る（間引き・キャッシュはストア側の責任）
import { getMutedReactions, mutedReactionsRevision, requestMutedReactions } from '@/utility/muted-reactions.js';
import { hideMutedReactionsLocal } from '@/utility/hatasaba-device-prefs.js';
import { DI } from '@/di.js';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	noteId: Misskey.entities.Note['id'];
	reactions: Misskey.entities.Note['reactions'];
	reactionEmojis: Misskey.entities.Note['reactionEmojis'];
	myReaction: Misskey.entities.Note['myReaction'];
	note: Misskey.entities.Note;
	maxNumber?: number;
	/** 旗鯖fork(#31): 詳細画面か。⚠️true のときだけ「隠しています」の ⓘ を出す。 */
	detailed?: boolean;
}>(), {
	maxNumber: Infinity,
	detailed: false,
});

const mock = inject(DI.mock, false);

const emit = defineEmits<{
	(ev: 'mockUpdateMyReaction', emoji: string, delta: number): void;
}>();

const initialReactions = new Set(Object.keys(props.reactions));

const _reactions = ref<[string, number][]>([]);
const hasMoreReactions = ref(false);
/** 旗鯖fork(#31): ⓘ を押して中身を出しているか。⚠️保存しない（画面を離れたら元に戻る）。 */
const revealMuted = ref(false);
/** 旗鯖fork(#31): いま隠している件数。⚠️0 のときは ⓘ を出さない。 */
const mutedHiddenCount = ref(0);
let lastHideMutedEnabled = hideMutedReactionsLocal.value;
const mutedReactionNotice = computed(() => revealMuted.value
	? i18n.ts._hata._reactionVisibility.hideMutedAgain
	: i18n.ts._hata._reactionVisibility.mutedCount.replace('{count}', mutedHiddenCount.value.toString()));

if (props.myReaction && !Object.keys(_reactions.value).includes(props.myReaction)) {
	_reactions.value[props.myReaction] = props.reactions[props.myReaction];
}

function onMockToggleReaction(emoji: string, count: number) {
	if (!mock) return;

	const i = _reactions.value.findIndex((item) => item[0] === emoji);
	if (i < 0) return;

	emit('mockUpdateMyReaction', emoji, (count - _reactions.value[i][1]));
}

function canReact(reaction: string) {
	if (!$i) return false;
	// TODO: CheckPermissions
	return isLocalCustomEmojiReaction(reaction)
		? customEmojisMap.has(getEmojiNameFromReaction(reaction))
		: isSupportedEmoji(reaction);
}

watch([
	() => props.reactions,
	() => props.maxNumber,
	hideMutedReactionsLocal,
	mutedUsersRevision,
	// 旗鯖fork(#31): リアクターの取得が届いたら描き直す／ⓘ で表示を切り替えたら描き直す。
	mutedReactionsRevision,
	revealMuted,
], ([newSource, maxNumber]) => {
	const hideMutedEnabled = hideMutedReactionsLocal.value;
	const justEnabled = hideMutedEnabled && !lastHideMutedEnabled;
	lastHideMutedEnabled = hideMutedEnabled;
	/*
	旗鯖fork(#31): ミュートしたユーザーのリアクションを**チップごと**消す。
	⚠️従来は `reactionAndUserPairCache` だけを見ていたが、⚠️**backend はこの項目を
	  ノート作成時のストリーム配信でしか返さない**ので、実際にはほぼ常に空だった
	  （＝「名前は隠れるがリアクションは出る」状態の原因）。
	⚠️そこで `notes/reactions` から取ったリアクターを正とする。
	  ⚠️取得は共有ストア側で間引く（utility/muted-reactions.ts）。
	⚠️自分のリアクションは隠さない。
	*/
	const mutedDelta: Record<string, number> = {};
	// 表示元と同じreactive mapから算出する。props.note.reactionCountは初期noteの値のまま
	// 残る経路があり、新しいmapと古いcache keyが混ざるとチップが出入りしてしまう。
	const reactionCount = Object.values(newSource).reduce((a, b) => a + b, 0);

	// ⚠️隠す件数は「ⓘ を押しているか」に関係なく数える。
	//   ⚠️押した瞬間に 0 になると ⓘ 自体が消えて、隠す側へ戻せなくなる。
	if (hideMutedEnabled) {
		void fetchMutedUsers();
		// ①正：サーバーから取ったリアクター（自分の投稿かどうかに関係なく効く）
		requestMutedReactions(props.noteId, reactionCount);
		const entry = getMutedReactions(props.noteId, reactionCount);
		// 正確なミュート差分の取得待ちは、直前の安定表示を維持する（初回は空）。
		// rawを一瞬描いてから消すと、折返し行の高さが連続して変わってしまう。
		if (entry == null) {
			// OFF中に描いたrawをON切替後まで持ち越さない。すでにフィルタ済みなら
			// 取得中もその安定表示とⓘ件数をそのまま維持する。
			if (justEnabled) {
				_reactions.value = [];
				hasMoreReactions.value = false;
				mutedHiddenCount.value = 0;
			}
			return;
		}
		for (const [reaction, count] of Object.entries(entry.delta)) {
			if (reaction === props.myReaction) continue;
			mutedDelta[reaction] = count;
		}
	}
	mutedHiddenCount.value = Object.values(mutedDelta).reduce((a, b) => a + b, 0);

	// ミュート絵文字を除外 + ミュートユーザー分を差し引く(0以下になったチップは出さない)
	// ⚠️ⓘ で開いている間は差し引かない＝素の件数をそのまま出す。
	const appliedDelta = revealMuted.value ? {} : mutedDelta;
	const filteredSource: Record<string, number> = {};
	for (const [reaction, count] of Object.entries(newSource)) {
		if (isEmojiMuted(reaction).value) continue;
		const adjusted = count - (appliedDelta[reaction] ?? 0);
		if (adjusted > 0) filteredSource[reaction] = adjusted;
	}

	let newReactions: [string, number][] = [];
	hasMoreReactions.value = Object.keys(filteredSource).length > maxNumber;

	for (let i = 0; i < _reactions.value.length; i++) {
		const reaction = _reactions.value[i][0];
		if (reaction in filteredSource && filteredSource[reaction] !== 0) {
			_reactions.value[i][1] = filteredSource[reaction];
			newReactions.push(_reactions.value[i]);
		}
	}

	const sorted = Object.entries(filteredSource);
	if (prefer.s.showAvailableReactionsFirstInNote) {
		// ソートの比較関数内で評価すると同じ絵文字に対して何度も実行されるため、事前に1回だけ評価しておく
		const canReactCache = new Map<string, boolean>();
		for (const [emoji] of sorted) {
			canReactCache.set(emoji, canReact(emoji));
		}
		sorted.sort(([emojiA, countA], [emojiB, countB]) => {
			const canReactA = canReactCache.get(emojiA)!;
			const canReactB = canReactCache.get(emojiB)!;
			if (canReactA !== canReactB) return canReactA ? -1 : 1;
			return countB - countA;
		});
	} else {
		sorted.sort(([, countA], [, countB]) => countB - countA);
	}

	const newReactionsNames = new Set(newReactions.map(([x]) => x));
	newReactions = [
		...newReactions,
		...sorted.filter(([y], i) => i < maxNumber && !newReactionsNames.has(y)),
	];

	newReactions = newReactions.slice(0, props.maxNumber);

	if (props.myReaction && !newReactions.some(([x]) => x === props.myReaction)) {
		newReactions.push([props.myReaction, filteredSource[props.myReaction]]);
	}

	_reactions.value = newReactions;
}, { immediate: true, deep: true });
</script>

<style lang="scss" module>
.transition_x_move,
.transition_x_enterActive,
.transition_x_leaveActive {
	transition: opacity 0.2s cubic-bezier(0,.5,.5,1), transform 0.2s cubic-bezier(0,.5,.5,1) !important;
}
.transition_x_enterFrom,
.transition_x_leaveTo {
	opacity: 0;
	transform: scale(0.7);
}
.transition_x_leaveActive {
	position: absolute;
}

/*
旗鯖fork(#31): 「ミュートしたぶんを隠しています」の ⓘ。
⚠️チップと同じ高さに揃える（行が段違いにならないように）。
⚠️既定は控えめな色。押して開いている間だけアクセント色にして、状態が見て分かるようにする。
*/
.mutedNotice {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 38px;
	width: 32px;
	margin: 2px;
	padding: 0;
	border: none;
	border-radius: 6px;
	background: var(--MI_THEME-buttonBg);
	color: var(--MI_THEME-fgTransparentWeak);
	cursor: pointer;
	font-size: 1.1em;
	line-height: 1;
}
.mutedNotice:hover,
.mutedNotice:focus-visible {
	background: var(--MI_THEME-buttonHoverBg);
	color: var(--MI_THEME-fg);
}
.mutedNoticeOn {
	background: color-mix(in srgb, var(--MI_THEME-accent) 16%, transparent);
	color: var(--MI_THEME-accent);
}

.root {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 4px;

	&:empty {
		display: none;
	}
}
</style>
