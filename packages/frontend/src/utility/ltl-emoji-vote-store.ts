/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, ref, shallowRef } from 'vue';
import { getLtlEmojiVotePhase, LTL_EMOJI_VOTE_DECLINED_MS, LTL_EMOJI_VOTE_EXIT_MS } from './ltl-emoji-vote-types.js';
import type { LtlEmojiVoteEffect, LtlEmojiVoteResponse, LtlEmojiVoteRound } from './ltl-emoji-vote-types.js';
import { i18n } from '@/i18n.js';

type Dependencies = {
	accountId: string | null;
	getAccountId: () => string | null;
	show: (noteId: string | undefined, signal: AbortSignal) => Promise<LtlEmojiVoteResponse>;
	vote: (roundId: string, emojiId: string, signal: AbortSignal) => Promise<LtlEmojiVoteResponse>;
	monotonicNow: () => number;
	ownerDocument: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
	subscribeReconnect: (callback: () => void) => () => void;
};

type Request = { controller: AbortController; sequence: number; generation: number; noteId?: string; promise: Promise<void> };

/** One account owns one clock, one polling request and one accepted vote across its LTL surfaces. */
export function createLtlEmojiVoteStore(deps: Dependencies) {
	const round = shallowRef<LtlEmojiVoteRound | null>(null);
	const now = ref(0);
	const submitting = ref(false);
	const voteError = ref<string | null>(null);
	const choice = computed(() => round.value?.choice ?? null);
	const subscribers = new Map<symbol, boolean>();
	const playedEffects = new Set<string>();
	const rainOwner = ref<symbol | null>(null);
	const rainStartedAt = ref(0);
	const dismissal = shallowRef<{ kind: 'declined' | 'result'; leavingAt: number } | null>(null);
	const declined = computed(() => dismissal.value?.kind === 'declined');
	let clockAnchor: { server: number; monotonic: number } | null = null;
	let retiredThrough = -Infinity;
	let newestRoundStartedAt = -Infinity;
	let acceptedServerNow = -Infinity;
	let acceptedSequence = 0;
	let sequence = 0;
	let generation = 0;
	let running = false;
	let destroyed = false;
	let needsVoteVerification = false;
	let clockTimer: number | null = null;
	let pollTimer: number | null = null;
	let expiryTimer: number | null = null;
	let idleRetryTimer: number | null = null;
	let idleRetryCount = 0;
	let lastTriggerHint: string | undefined;
	let triggerRetry: { noteId: string; attempt: number } | null = null;
	let triggerRetryTimer: number | null = null;
	let unsubscribeReconnect: (() => void) | null = null;
	let showRequest: Request | null = null;
	let voteRequest: Request | null = null;
	let queuedRefresh = false;
	let queuedNoteId: string | undefined;

	const sameAccount = () => deps.getAccountId() === deps.accountId;
	const hasActiveSubscriber = () => [...subscribers.values()].some(Boolean);
	const canRun = () => !destroyed && sameAccount() && !deps.ownerDocument.hidden && hasActiveSubscriber();

	function clearTimers() {
		if (clockTimer !== null) window.clearInterval(clockTimer);
		if (pollTimer !== null) window.clearTimeout(pollTimer);
		clockTimer = null;
		pollTimer = null;
	}

	function clearTriggerRetry() {
		if (triggerRetryTimer !== null) window.clearTimeout(triggerRetryTimer);
		triggerRetryTimer = null;
		triggerRetry = null;
	}

	function clearExpiryTimer() {
		if (expiryTimer !== null) window.clearTimeout(expiryTimer);
		expiryTimer = null;
	}

	function retireRound(preserveTrigger = false) {
		if (round.value) retiredThrough = Math.max(retiredThrough, round.value.startedAt);
		round.value = null;
		// A computed ref keeps its last value until read, including after unmount.
		void choice.value;
		rainOwner.value = null;
		rainStartedAt.value = 0;
		dismissal.value = null;
		playedEffects.clear();
		needsVoteVerification = false;
		submitting.value = false;
		voteError.value = null;
		clearTimers();
		clearExpiryTimer();
		if (idleRetryTimer !== null) window.clearTimeout(idleRetryTimer);
		idleRetryTimer = null;
		if (!preserveTrigger) {
			clearTriggerRetry();
			lastTriggerHint = undefined;
			queuedRefresh = false;
			queuedNoteId = undefined;
			generation++;
			showRequest?.controller.abort();
			showRequest = null;
			voteRequest?.controller.abort();
			voteRequest = null;
		}
	}

	function retirementTime() {
		return Math.min(round.value?.expiresAt ?? Infinity, dismissal.value?.leavingAt ?? Infinity) + LTL_EMOJI_VOTE_EXIT_MS;
	}

	function tick() {
		if (!sameAccount()) {
			reset();
			return;
		}
		if (clockAnchor) now.value = Math.max(now.value, clockAnchor.server + Math.max(0, deps.monotonicNow() - clockAnchor.monotonic));
		if (round.value && now.value >= retirementTime()) retireRound();
	}

	function scheduleExpiry() {
		clearExpiryTimer();
		if (destroyed || (running && !dismissal.value) || !round.value || !clockAnchor) return;
		// Paused or unmounted LTLs retain the current vote only until it finishes.
		// Local dismissal also uses exact deadlines, without waiting for a 100 ms clock tick.
		const elapsed = Math.max(0, deps.monotonicNow() - clockAnchor.monotonic);
		const currentTime = Math.max(now.value, clockAnchor.server + elapsed);
		const nextDeadline = dismissal.value && currentTime < dismissal.value.leavingAt ? Math.min(dismissal.value.leavingAt, retirementTime()) : retirementTime();
		const remaining = nextDeadline - currentTime;
		expiryTimer = window.setTimeout(() => {
			expiryTimer = null;
			tick();
			scheduleExpiry();
		}, Math.max(0, remaining));
	}

	function syncTimers() {
		if (!running || !round.value) {
			clearTimers();
			return;
		}
		clockTimer ??= window.setInterval(tick, 100);
		if (dismissal.value) {
			scheduleExpiry();
			return;
		}
		if (pollTimer === null && now.value < round.value.expiresAt && !showRequest && !voteRequest) {
			pollTimer = window.setTimeout(() => {
				pollTimer = null;
				void refresh();
			}, 1000);
		}
	}

	function requestIsCurrent(request: Request) {
		return running && canRun() && request.generation === generation && !request.controller.signal.aborted;
	}

	function applyResponse(response: LtlEmojiVoteResponse, request: Request) {
		if (!requestIsCurrent(request) || response.serverNow < acceptedServerNow || request.sequence < acceptedSequence) return false;
		idleRetryCount = 0;
		acceptedServerNow = response.serverNow;
		acceptedSequence = request.sequence;
		tick();
		clockAnchor = { server: Math.max(now.value, response.serverNow), monotonic: deps.monotonicNow() };
		now.value = clockAnchor.server;
		const incoming = response.round;
		if (!incoming) {
			// A server round expires before the 480 ms closing transition ends.
			if (!round.value || now.value < round.value.expiresAt || now.value >= round.value.expiresAt + LTL_EMOJI_VOTE_EXIT_MS) retireRound(!round.value);
		} else if (incoming.startedAt > retiredThrough && incoming.startedAt >= newestRoundStartedAt && now.value < incoming.expiresAt + LTL_EMOJI_VOTE_EXIT_MS) {
			clearTriggerRetry();
			const previous = round.value;
			if (previous?.id !== incoming.id) {
				rainOwner.value = null;
				playedEffects.clear();
				voteError.value = null;
			}
			newestRoundStartedAt = incoming.startedAt;
			// An accepted choice cannot be undone by a concurrent or replicated show response.
			round.value = previous?.id === incoming.id && previous.choice && !incoming.choice ? { ...incoming, choice: previous.choice } : incoming;
			if (previous?.id === incoming.id && previous.phase === 'result' && incoming.phase !== 'result') {
				round.value = { ...round.value, phase: 'result', rankings: previous.rankings, total: previous.total };
			}
		} else if (now.value >= incoming.expiresAt + LTL_EMOJI_VOTE_EXIT_MS) {
			retiredThrough = Math.max(retiredThrough, incoming.startedAt);
		}
		if (needsVoteVerification) {
			needsVoteVerification = false;
			submitting.value = false;
			voteError.value = round.value?.choice ? null : i18n.ts._hata._ltlEmojiVote.voteFailed;
		}
		syncTimers();
		return true;
	}

	function queueRefresh(noteId?: string) {
		queuedRefresh = true;
		if (noteId) queuedNoteId = noteId;
	}

	function drainRefresh() {
		if (!running) return;
		if (queuedRefresh) {
			const noteId = queuedNoteId;
			queuedRefresh = false;
			queuedNoteId = undefined;
			void refresh(noteId);
		} else {
			syncTimers();
		}
	}

	function scheduleTriggerRetry() {
		// REST may expose the saved trigger just before its bounded event-start work
		// completes. Retry only this hinted race, never a normal empty lookup.
		if (!running || round.value || !triggerRetry || triggerRetryTimer !== null || triggerRetry.attempt >= 3) return;
		const delay = [200, 700, 1600][triggerRetry.attempt];
		triggerRetryTimer = window.setTimeout(() => {
			triggerRetryTimer = null;
			if (triggerRetry) triggerRetry.attempt++;
			void refresh();
		}, delay);
	}

	async function refresh(noteId?: string): Promise<void> {
		if (!running || !canRun()) return;
		if (dismissal.value) {
			tick();
			if (dismissal.value) return;
		}
		if (noteId && noteId !== lastTriggerHint) {
			clearTriggerRetry();
			lastTriggerHint = noteId;
			if (!round.value) triggerRetry = { noteId, attempt: 0 };
		}
		if (triggerRetryTimer !== null) window.clearTimeout(triggerRetryTimer);
		triggerRetryTimer = null;
		if (idleRetryTimer !== null) window.clearTimeout(idleRetryTimer);
		idleRetryTimer = null;
		if (noteId) idleRetryCount = 0;
		tick();
		if (voteRequest) {
			queueRefresh(noteId);
			return voteRequest.promise;
		}
		if (showRequest) {
			// A trigger delivered during an initial empty lookup needs its own lookup afterwards.
			if (noteId && noteId !== showRequest.noteId) queueRefresh(noteId);
			return showRequest.promise;
		}
		if (pollTimer !== null) window.clearTimeout(pollTimer);
		pollTimer = null;
		const request: Request = { controller: new AbortController(), sequence: ++sequence, generation, noteId, promise: Promise.resolve() };
		showRequest = request;
		request.promise = (async () => {
			try {
				// noteId is a local trigger hint. Always fetch the current round: an ignored
				// concurrent trigger must not clear the round that is already running.
				const response = await deps.show(undefined, request.controller.signal);
				if (applyResponse(response, request) && !response.round) scheduleTriggerRetry();
			} catch {
				// A failed poll keeps the existing deadline. It cannot extend a finished round.
				// Only failed initial lookups retry while idle; a successful empty lookup stops.
				if (requestIsCurrent(request) && !round.value && idleRetryCount < 2) {
					idleRetryCount++;
					idleRetryTimer = window.setTimeout(() => {
						idleRetryTimer = null;
						void refresh();
					}, 2000);
				}
			} finally {
				if (showRequest === request) {
					showRequest = null;
					drainRefresh();
				}
			}
		})();
		return request.promise;
	}

	async function vote(owner: symbol, emojiId: string): Promise<boolean> {
		tick();
		const current = round.value;
		if (!running || !canRun() || !subscribers.get(owner) || !deps.accountId || !current || dismissal.value || current.choice || submitting.value || now.value >= current.closesAt || !current.candidates.some(emoji => emoji.id === emojiId)) return false;
		// A show that began before this write must never replace its result.
		showRequest?.controller.abort();
		showRequest = null;
		if (pollTimer !== null) window.clearTimeout(pollTimer);
		pollTimer = null;
		submitting.value = true;
		voteError.value = null;
		const request: Request = { controller: new AbortController(), sequence: ++sequence, generation, promise: Promise.resolve() };
		voteRequest = request;
		let accepted = false;
		request.promise = (async () => {
			try {
				const response = await deps.vote(current.id, emojiId, request.controller.signal);
				if (applyResponse(response, request) && response.round?.id === current.id && response.round.choice) {
					rainStartedAt.value = now.value;
					rainOwner.value = subscribers.get(owner) ? owner : null;
					accepted = true;
				}
			} catch {
				if (requestIsCurrent(request)) {
					// The write may have succeeded despite a lost reply; check before allowing another try.
					needsVoteVerification = true;
					voteError.value = i18n.ts._hata._ltlEmojiVote.verifyingVote;
					queueRefresh();
				}
			} finally {
				if (voteRequest === request) {
					voteRequest = null;
					submitting.value = needsVoteVerification;
					drainRefresh();
				}
			}
		})();
		await request.promise;
		return accepted;
	}

	function dismiss(owner: symbol): boolean {
		tick();
		const current = round.value;
		if (!running || !canRun() || !subscribers.get(owner) || !current || dismissal.value || submitting.value) return false;
		const phase = getLtlEmojiVotePhase(current, now.value, rainOwner.value === owner, rainStartedAt.value);
		if (phase !== 'voting' && phase !== 'result') return false;
		// Share the decision across LTL surfaces immediately; retain only the current
		// card for its closing animation, never a vote or a persistent dismissal list.
		retiredThrough = Math.max(retiredThrough, current.startedAt);
		dismissal.value = {
			kind: phase === 'voting' ? 'declined' : 'result',
			leavingAt: Math.min(current.expiresAt, now.value + (phase === 'voting' ? LTL_EMOJI_VOTE_DECLINED_MS : 0)),
		};
		rainOwner.value = null;
		rainStartedAt.value = 0;
		playedEffects.clear();
		voteError.value = null;
		generation++;
		showRequest?.controller.abort();
		showRequest = null;
		queuedRefresh = false;
		queuedNoteId = undefined;
		clearTriggerRetry();
		if (idleRetryTimer !== null) window.clearTimeout(idleRetryTimer);
		idleRetryTimer = null;
		clearTimers();
		syncTimers();
		return true;
	}

	function stop() {
		running = false;
		rainOwner.value = null;
		rainStartedAt.value = 0;
		voteError.value = null;
		generation++;
		clearTimers();
		if (idleRetryTimer !== null) window.clearTimeout(idleRetryTimer);
		idleRetryTimer = null;
		idleRetryCount = 0;
		clearTriggerRetry();
		lastTriggerHint = undefined;
		showRequest?.controller.abort();
		showRequest = null;
		if (voteRequest) needsVoteVerification = true;
		voteRequest?.controller.abort();
		voteRequest = null;
		submitting.value = needsVoteVerification;
		queuedRefresh = false;
		queuedNoteId = undefined;
		unsubscribeReconnect?.();
		unsubscribeReconnect = null;
		scheduleExpiry();
	}

	function syncActivity() {
		if (!sameAccount()) {
			reset();
			return;
		}
		if (!canRun()) {
			if (running) stop();
			return;
		}
		if (running) return;
		running = true;
		clearExpiryTimer();
		tick();
		unsubscribeReconnect = deps.subscribeReconnect(() => { void refresh(); });
		syncTimers();
		void refresh();
	}

	function reset() {
		stop();
		retireRound();
		clockAnchor = null;
		now.value = 0;
		retiredThrough = -Infinity;
		newestRoundStartedAt = -Infinity;
		acceptedServerNow = -Infinity;
		acceptedSequence = 0;
	}

	function subscribe(active = true) {
		const owner = Symbol('ltl-emoji-vote');
		if (subscribers.size === 0) deps.ownerDocument.addEventListener('visibilitychange', syncActivity);
		subscribers.set(owner, active);
		syncActivity();
		const phase = computed(() => {
			if (round.value && dismissal.value) return now.value < dismissal.value.leavingAt ? 'declined' : 'leaving';
			return getLtlEmojiVotePhase(round.value, now.value, rainOwner.value === owner, rainStartedAt.value);
		});
		return {
			round, choice, now, phase, declined, submitting, voteError, refresh,
			vote: (emojiId: string) => vote(owner, emojiId),
			dismiss: () => dismiss(owner),
			claimEffect(kind: LtlEmojiVoteEffect, roundId: string) {
				if (!running || !canRun() || !subscribers.get(owner) || round.value?.id !== roundId) return false;
				if (kind === 'rain' ? rainOwner.value !== owner || phase.value !== 'rain' : phase.value !== 'result') return false;
				const key = `${roundId}:${kind}`;
				if (playedEffects.has(key)) return false;
				playedEffects.add(key);
				return true;
			},
			setActive(value: boolean) {
				if (!subscribers.has(owner)) return;
				if (!value && rainOwner.value === owner) rainOwner.value = null;
				subscribers.set(owner, value);
				syncActivity();
			},
			release() {
				if (!subscribers.delete(owner)) return;
				if (rainOwner.value === owner) rainOwner.value = null;
				if (subscribers.size === 0) deps.ownerDocument.removeEventListener('visibilitychange', syncActivity);
				syncActivity();
			},
		};
	}

	return {
		subscribe,
		reset,
		destroy() {
			destroyed = true;
			reset();
			subscribers.clear();
			deps.ownerDocument.removeEventListener('visibilitychange', syncActivity);
		},
	};
}
