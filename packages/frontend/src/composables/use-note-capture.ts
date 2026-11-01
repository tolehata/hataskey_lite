/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { inject, onUnmounted, reactive, unref, watch } from 'vue';
import { applyUtage, pickUtage, type UtageSnapshot, type UtageEvent } from '@/utility/utage.js';
import type * as Misskey from 'cherrypick-js';
import { EventEmitter } from 'eventemitter3';
import { createVisibilityAwareInterval } from '@@/js/interval.js';
import type { Reactive } from 'vue';
import type { MaybeRef } from 'vue';
import { useStream } from '@/stream.js';
import { $i } from '@/i.js';
import { store } from '@/store.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { prefer } from '@/preferences.js';
import { globalEvents } from '@/events.js';
import { notifyMutedReactionSourceChanged, reactionCountsChanged, shouldRevalidateMutedReactionActors } from '@/utility/muted-reactions.js';

export const noteEvents = new EventEmitter<{
	[ev: `reacted:${string}`]: (ctx: { userId: Misskey.entities.User['id']; reaction: string; emoji?: { name: string; url: string; }; }) => void;
	[ev: `unreacted:${string}`]: (ctx: { userId: Misskey.entities.User['id']; reaction: string; emoji?: { name: string; url: string; }; }) => void;
	[ev: `pollVoted:${string}`]: (ctx: { userId: Misskey.entities.User['id']; choice: string; }) => void;
	// 旗鯖fork: 宴(うたげ)の判定確定をノート単位で受け取る
	[ev: `utageStatusUpdated:${string}`]: (ctx: UtageEvent) => void;
}>();

const fetchEvent = new EventEmitter<{
	[id: string]: Pick<Misskey.entities.Note, 'reactions' | 'reactionEmojis'>;
}>();

const pollingQueue = new Map<string, {
	referenceCount: number;
	lastAddedAt: number;
}>();

function pollingEnqueue(note: Pick<Misskey.entities.Note, 'id' | 'createdAt'>) {
	if (pollingQueue.has(note.id)) {
		const data = pollingQueue.get(note.id)!;
		pollingQueue.set(note.id, {
			...data,
			referenceCount: data.referenceCount + 1,
			lastAddedAt: Date.now(),
		});
	} else {
		pollingQueue.set(note.id, {
			referenceCount: 1,
			lastAddedAt: Date.now(),
		});
	}
}

function pollingDequeue(note: Pick<Misskey.entities.Note, 'id' | 'createdAt'>) {
	const data = pollingQueue.get(note.id);
	if (data == null) return;

	if (data.referenceCount === 1) {
		pollingQueue.delete(note.id);
	} else {
		pollingQueue.set(note.id, {
			...data,
			referenceCount: data.referenceCount - 1,
		});
	}
}

const CAPTURE_MAX = 30;
const MIN_POLLING_INTERVAL = 1000 * 10;
const POLLING_INTERVAL =
	prefer.s.pollingInterval === 1 ? MIN_POLLING_INTERVAL * 1.5 * 1.5 :
	prefer.s.pollingInterval === 2 ? MIN_POLLING_INTERVAL * 1.5 :
	prefer.s.pollingInterval === 3 ? MIN_POLLING_INTERVAL :
	MIN_POLLING_INTERVAL;

// documentが非表示の間はポーリングを停止する
createVisibilityAwareInterval(() => {
	const ids = [...pollingQueue.entries()]
		.filter(([k, v]) => Date.now() - v.lastAddedAt < 1000 * 60 * 5) // 追加されてから一定時間経過したものは省く
		.map(([k, v]) => k)
		.sort((a, b) => (a > b ? -1 : 1)) // 新しいものを優先するためにIDで降順ソート
		.slice(0, CAPTURE_MAX);

	if (ids.length === 0) return;

	// まとめてリクエストするのではなく、個別にHTTPリクエスト投げてCDNにキャッシュさせた方がサーバーの負荷低減には良いかもしれない？
	misskeyApi('notes/show-partial-bulk', {
		noteIds: ids,
	}).then((items) => {
		for (const item of items) {
			fetchEvent.emit(item.id, {
				reactions: item.reactions,
				reactionEmojis: item.reactionEmojis,
			});
		}
	});
}, POLLING_INTERVAL);

function pollingSubscribe(props: {
	note: Pick<Misskey.entities.Note, 'id' | 'createdAt'>;
	$note: ReactiveNoteData;
}) {
	const { note, $note } = props;

	function onFetched(data: Pick<Misskey.entities.Note, 'reactions' | 'reactionEmojis'>): void {
		const sourceChanged = reactionCountsChanged($note.reactions, data.reactions);
		$note.reactions = data.reactions;
		$note.reactionCount = Object.values(data.reactions).reduce((a, b) => a + b, 0);
		$note.reactionEmojis = data.reactionEmojis;
		// 総数が同じまま種別が入れ替わる場合も、リアクター一覧の旧cacheを再利用しない。
		if (sourceChanged || shouldRevalidateMutedReactionActors(note.id)) notifyMutedReactionSourceChanged(note.id);
	}

	pollingEnqueue(note);
	fetchEvent.on(note.id, onFetched);

	onUnmounted(() => {
		pollingDequeue(note);
		fetchEvent.off(note.id, onFetched);
	});
}

function realtimeSubscribe(props: {
	note: Pick<Misskey.entities.Note, 'id' | 'createdAt' | 'updatedAt' | 'cw' | 'text'>;
}): void {
	const note = props.note;
	const connection = useStream();

	function onStreamNoteUpdated(noteData): void {
		const { type, id, body } = noteData;

		if (id !== note.id) return;

		switch (type) {
			case 'reacted': {
				noteEvents.emit(`reacted:${id}`, {
					userId: body.userId,
					reaction: body.reaction,
					emoji: body.emoji,
				});
				break;
			}

			case 'unreacted': {
				noteEvents.emit(`unreacted:${id}`, {
					userId: body.userId,
					reaction: body.reaction,
					emoji: body.emoji,
				});
				break;
			}

			case 'pollVoted': {
				noteEvents.emit(`pollVoted:${id}`, {
					userId: body.userId,
					choice: body.choice,
				});
				break;
			}

			case 'updated': {
				note.updatedAt = new Date().toISOString();
				note.cw = body.cw;
				note.text = body.text;
				break;
			}

			case 'utageStatusUpdated': {
				// 旗鯖fork: 宴の判定確定 (succeeded/failed) をノート単位で配信
				noteEvents.emit(`utageStatusUpdated:${id}`, body);
				break;
			}

			case 'deleted': {
				globalEvents.emit('noteDeleted', id);
				break;
			}
		}
	}

	function capture(withHandler = false): void {
		connection.send('sr', { id: note.id });
		if (withHandler) connection.on('noteUpdated', onStreamNoteUpdated);
	}

	function decapture(withHandler = false): void {
		connection.send('un', { id: note.id });
		if (withHandler) connection.off('noteUpdated', onStreamNoteUpdated);
	}

	function onStreamConnected() {
		capture(false);
	}

	capture(true);
	connection.on('_connected_', onStreamConnected);

	onUnmounted(() => {
		decapture(true);
		connection.off('_connected_', onStreamConnected);
	});
}

export type ReactiveNoteData = UtageSnapshot & {
	reactions: Misskey.entities.Note['reactions'];
	reactionCount: Misskey.entities.Note['reactionCount'];
	reactionEmojis: Misskey.entities.Note['reactionEmojis'];
	myReaction: Misskey.entities.Note['myReaction'];
	pollChoices: NonNullable<Misskey.entities.Note['poll']>['choices'];
	// 旗鯖fork: 宴(うたげ)の判定状態。サーバーの pack 埋め込み(utageStatus)を初期値とし、
	// utageStatusUpdated イベントで更新する。
};

const noReaction = Symbol();
// A note can appear in several columns. Share only an in-flight request;
// each mounted note owns its subscriptions and applies the returned revision.
const utageRequests = new Map<string, Promise<Misskey.entities.Note>>();
function fetchUtage(noteId: string) {
	const existing = utageRequests.get(noteId);
	if (existing) return existing;
	const request = misskeyApi('notes/show', { noteId }).finally(() => { utageRequests.delete(noteId); });
	utageRequests.set(noteId, request);
	return request;
}

export function useNoteCapture(props: {
	note: Misskey.entities.Note;
	parentNote: Misskey.entities.Note | null;
	mock?: boolean;
}): {
		$note: Reactive<ReactiveNoteData>;
		subscribe: () => void;
	} {
	const { note, parentNote, mock } = props;
	// Hataskey UI 3 は画面内のLIVE切替を独立して持つため、
	// 本体UIの realtimeMode がオフでも表示中ノートの標準更新経路を利用する。
	// 既存UIでは未提供のまま false となり、従来挙動を変えない。
	const forceRealtimeCapture = inject<MaybeRef<boolean>>('forceNoteRealtimeCapture', false);

	const $note = reactive<ReactiveNoteData>({
		reactions: Object.entries(note.reactions).reduce((acc, [name, count]) => {
			// Normalize reactions
			const normalizedName = name.replace(/^:(\w+):$/, ':$1@.:');
			if (acc[normalizedName] == null) {
				acc[normalizedName] = count;
			} else {
				acc[normalizedName] += count;
			}
			return acc;
		}, {} as Misskey.entities.Note['reactions']),
		reactionCount: note.reactionCount,
		reactionEmojis: note.reactionEmojis,
		myReaction: note.myReaction,
		pollChoices: note.poll?.choices ?? [],
		...pickUtage(note),
	});

	let utageDisposed = false;
	let utageLoading = false;
	let utageLastFetch = 0;
	async function refreshUtage(force = false) {
		if (mock || utageDisposed || utageLoading || window.document.hidden || !['running', 'reviving'].includes($note.utageStatus ?? '')) return;
		const delay = $note.utageStatus === 'reviving' ? 5000 : 30000;
		if (!force && Date.now() - utageLastFetch < delay) return;
		utageLoading = true;
		utageLastFetch = Date.now();
		try {
			const fresh = await fetchUtage(note.id);
			if (!utageDisposed) { applyUtage($note, fresh, true); applyUtage(note, fresh, true); }
		} catch { /* Retry on the next visible tick; the server owns the final result. */ }
		finally { utageLoading = false; }
	}
	const utageVisibility = () => { if (!window.document.hidden) void refreshUtage(true); };
	watch(() => $note.utageStatus, (status, _, cleanup) => {
		if (mock || (status !== 'running' && status !== 'reviving')) return;
		const stopTimer = createVisibilityAwareInterval(() => { void refreshUtage(); }, 5000);
		window.document.addEventListener('visibilitychange', utageVisibility);
		cleanup(() => { stopTimer(); window.document.removeEventListener('visibilitychange', utageVisibility); });
	}, { immediate: true });
	watch(() => [note.utageRevision, note.utageStatus], () => applyUtage($note, note, true));
	watch(() => $note.myReaction, () => { void refreshUtage(true); });

	noteEvents.on(`reacted:${note.id}`, onReacted);
	noteEvents.on(`unreacted:${note.id}`, onUnreacted);
	noteEvents.on(`pollVoted:${note.id}`, onPollVoted);
	noteEvents.on(`utageStatusUpdated:${note.id}`, onUtageStatusUpdated);

	// 操作がダブっていないかどうかを簡易的に記録するためのMap
	const reactionUserMap = new Map<Misskey.entities.User['id'], string | typeof noReaction>();
	let latestPollVotedKey: string | null = null;

	function onReacted(ctx: { userId: Misskey.entities.User['id']; reaction: string; emoji?: { name: string; url: string; }; }): void {
		let normalizedName = ctx.reaction.replace(/^:(\w+):$/, ':$1@.:');
		normalizedName = normalizedName.match('\u200d') ? normalizedName : normalizedName.replace(/\ufe0f/g, '');
		if (reactionUserMap.has(ctx.userId) && reactionUserMap.get(ctx.userId) === normalizedName) return;
		reactionUserMap.set(ctx.userId, normalizedName);

		if (ctx.emoji && !(ctx.emoji.name in $note.reactionEmojis)) {
			$note.reactionEmojis[ctx.emoji.name] = ctx.emoji.url;
		}

		const currentCount = $note.reactions[normalizedName] || 0;

		$note.reactions[normalizedName] = currentCount + 1;
		$note.reactionCount += 1;
		notifyMutedReactionSourceChanged(note.id);

		if ($i && (ctx.userId === $i.id)) {
			$note.myReaction = normalizedName;
		}
	}

	function onUnreacted(ctx: { userId: Misskey.entities.User['id']; reaction: string; emoji?: { name: string; url: string; }; }): void {
		let normalizedName = ctx.reaction.replace(/^:(\w+):$/, ':$1@.:');
		normalizedName = normalizedName.match('\u200d') ? normalizedName : normalizedName.replace(/\ufe0f/g, '');

		// 取消済み、または別のリアクションへ変更済みなら、遅れて届いた古い取消を反映しない。
		// 初回読み込み直後はMapに記録がないため、最初の取消は通常どおり処理する。
		const latestReaction = reactionUserMap.get(ctx.userId);
		if (latestReaction != null && latestReaction !== normalizedName) return;
		reactionUserMap.set(ctx.userId, noReaction);

		const currentCount = $note.reactions[normalizedName] || 0;

		$note.reactions[normalizedName] = Math.max(0, currentCount - 1);
		$note.reactionCount = Math.max(0, $note.reactionCount - 1);
		if ($note.reactions[normalizedName] === 0) delete $note.reactions[normalizedName];
		notifyMutedReactionSourceChanged(note.id);

		if ($i && (ctx.userId === $i.id)) {
			$note.myReaction = null;
		}
	}

	function onPollVoted(ctx: { userId: Misskey.entities.User['id']; choice: string; }): void {
		const newPollVotedKey = `${ctx.userId}:${ctx.choice}`;
		if (newPollVotedKey === latestPollVotedKey) return;
		latestPollVotedKey = newPollVotedKey;

		const choices = [...$note.pollChoices];
		choices[ctx.choice] = {
			...choices[ctx.choice],
			votes: choices[ctx.choice].votes + 1,
			...($i && (ctx.userId === $i.id) ? {
				isVoted: true,
			} : {}),
		};

		$note.pollChoices = choices;
	}

	// Revision順で更新し、一度確定した結果は覆さない。
	function onUtageStatusUpdated(ctx: UtageEvent): void {
		if (applyUtage($note, ctx)) {
			applyUtage(note, ctx);
			if ($note.utageStatus === 'reviving' && !$note.utageMyParticipation) void refreshUtage(true);
		}
	}

	function subscribe() {
		if (mock) {
			// モックモードでは購読しない
			return;
		}

		if ($i && (store.s.realtimeMode || unref(forceRealtimeCapture))) {
			realtimeSubscribe({
				note,
			});
		} else {
			pollingSubscribe({
				note,
				$note,
			});
		}
	}

	onUnmounted(() => {
		utageDisposed = true;
		noteEvents.off(`reacted:${note.id}`, onReacted);
		noteEvents.off(`unreacted:${note.id}`, onUnreacted);
		noteEvents.off(`pollVoted:${note.id}`, onPollVoted);
		noteEvents.off(`utageStatusUpdated:${note.id}`, onUtageStatusUpdated);
	});

	// 投稿からある程度経過している(=タイムラインを遡って表示した)ノートは、イベントが発生する可能性が低いためそもそも購読しない
	// ただし「リノートされたばかりの過去のノート」(= parentNoteが存在し、かつparentNoteの投稿日時が最近)はイベント発生が考えられるため購読する
	// TODO: デバイスとサーバーの時計がズレていると不具合の元になるため、ズレを検知して警告を表示するなどのケアが必要かもしれない
	if (!unref(forceRealtimeCapture) && parentNote == null) {
		if ((Date.now() - new Date(note.createdAt).getTime()) > 1000 * 60 * 5) { // 5min
			// リノートで表示されているノートでもないし、投稿からある程度経過しているので自動で購読しない
			return {
				$note,
				subscribe: () => {
					subscribe();
				},
			};
		}
	} else if (!unref(forceRealtimeCapture) && parentNote != null) {
		if ((Date.now() - new Date(parentNote.createdAt).getTime()) > 1000 * 60 * 5) { // 5min
			// リノートで表示されているノートだが、リノートされてからある程度経過しているので自動で購読しない
			return {
				$note,
				subscribe: () => {
					subscribe();
				},
			};
		}
	}

	subscribe();

	return {
		$note,
		subscribe: () => {
			// すでに購読しているので何もしない
		},
	};
}
