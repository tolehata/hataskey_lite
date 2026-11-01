/* SPDX-License-Identifier: AGPL-3.0-only */

/** Keep hover controls hidden while any movement animation still owns a note. */
export function createHk3NoteMoving() {
	const notes = new Map<HTMLElement, { count: number; previous: string | null }>();
	const animations = new Map<Animation, HTMLElement>();

	function release(animation: Animation) {
		const note = animations.get(animation);
		if (!note) return;
		animations.delete(animation);
		const state = notes.get(note)!;
		if (--state.count > 0) return;
		notes.delete(note);
		if (state.previous == null) note.removeAttribute('data-hk3-note-moving');
		else note.setAttribute('data-hk3-note-moving', state.previous);
	}

	function track(note: HTMLElement, animation: Animation, untilCanceled = false): Animation {
		if (animations.has(animation)) return animation;
		const state = notes.get(note);
		if (state) state.count++;
		else notes.set(note, { count: 1, previous: note.getAttribute('data-hk3-note-moving') });
		note.setAttribute('data-hk3-note-moving', '');
		animations.set(animation, note);
		void animation.finished.then(() => {
			// fill: forwards keeps the clip in place after finish; its owner cancels it after the list updates.
			if (!untilCanceled) release(animation);
		}, () => release(animation));
		return animation;
	}

	function cancel(animation: Animation) {
		try { animation.cancel(); } finally { release(animation); }
	}

	function cancelAll() {
		for (const animation of [...animations.keys()]) cancel(animation);
	}

	return { track, cancel, cancelAll };
}
