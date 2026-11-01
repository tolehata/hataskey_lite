/* SPDX-License-Identifier: AGPL-3.0-only */
import { onScopeDispose, watch } from 'vue';
import type { ComputedRef } from 'vue';
import type { entities } from 'cherrypick-js';
import type { HataskeyNotificationToasts } from '@/utility/hataskey-notification-toast.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';
import { useStream } from '@/stream.js';

/** Owned exclusively by the normal Hataskey navbar, with no notification API. */
export function useHataskeyNavbarNotices(context: HataskeyNotificationToasts, active: ComputedRef<boolean>) {
	// A rename is broadcast as delete + add with the same ID, not a new emoji.
	const seenEmojiIds = new Set<string>();

	function remember(id: string) {
		seenEmojiIds.add(id);
		const oldest = seenEmojiIds.values().next().value;
		if (seenEmojiIds.size > 256 && oldest !== undefined) seenEmojiIds.delete(oldest);
	}

	function onEmojiAdded({ emoji }: entities.EmojiAdded) {
		if (emoji.host != null || seenEmojiIds.has(emoji.id)) return;
		remember(emoji.id);
		if (!active.value || !prefer.r.emojiAdditionNotice.value || window.document.hidden) return;
		context.enqueueNavbarNotice({ kind: 'emojiAdded', emoji: { id: emoji.id, name: emoji.name, url: emoji.url } });
	}

	function onEmojiDeleted({ emojis }: entities.EmojiDeleted) {
		for (const emoji of emojis) remember(emoji.id);
		const notice = context.navbarNotice.value;
		if (notice?.kind === 'emojiAdded' && emojis.some(emoji => emoji.id === notice.emoji.id)) {
			context.dismissNavbarNotice('emojiAdded');
		}
	}

	watch(() => active.value && prefer.r.emojiAdditionNotice.value && store.r.realtimeMode.value, (enabled, _previous, onCleanup) => {
		if (!enabled) { context.dismissNavbarNotice('emojiAdded'); return; }
		const stream = useStream();
		stream.on('emojiAdded', onEmojiAdded);
		stream.on('emojiDeleted', onEmojiDeleted);
		onCleanup(() => {
			stream.off('emojiAdded', onEmojiAdded);
			stream.off('emojiDeleted', onEmojiDeleted);
		});
	}, { immediate: true, flush: 'sync' });

	watch(() => active.value && prefer.r.hourlyTimeNotice.value, (enabled, _previous, onCleanup) => {
		if (!enabled) { context.dismissNavbarNotice('hourlyTime'); return; }
		let timer: number | undefined;

		function schedule() {
			window.clearTimeout(timer);
			timer = undefined;
			if (window.document.hidden) {
				context.dismissNavbarNotice('hourlyTime');
				return;
			}
			const now = new Date();
			const nextHour = new Date(now);
			nextHour.setMinutes(60, 0, 0);
			const due = nextHour.getTime();
			timer = window.setTimeout(() => {
				const current = new Date();
				// Suspended/background tabs and clock jumps must not replay an old hour.
				if (active.value && prefer.r.hourlyTimeNotice.value && !window.document.hidden
					&& current.getTime() >= due && current.getTime() - due < 5000 && current.getMinutes() === 0) {
					const time = `${String(current.getHours()).padStart(2, '0')}:00`;
					context.enqueueNavbarNotice({ kind: 'hourlyTime', time });
				}
				schedule();
			}, due - now.getTime());
		}

		schedule();
		window.document.addEventListener('visibilitychange', schedule);
		onCleanup(() => {
			window.clearTimeout(timer);
			window.document.removeEventListener('visibilitychange', schedule);
		});
	}, { immediate: true, flush: 'sync' });

	onScopeDispose(() => context.dismissNavbarNotice());
}
