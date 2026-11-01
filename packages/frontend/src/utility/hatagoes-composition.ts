/* SPDX-License-Identifier: AGPL-3.0-only */

export const HATAGOES_MERGE_DURATION = 14;
export const HATAGOES_MERGE_STILL_TIME = 13.4;
export const HATAGOES_MERGE_CUES = { Three: 0, Gather: 3.2, Merge: 6, Reveal: 8.6, Hold: 12 } as const;

type ClockOptions = {
	duration: number;
	loop: boolean;
	endAt?: number;
	onFrame: (seconds: number) => void;
	onComplete?: () => void;
};

export function createHatagoesCompositionClock(options: ClockOptions) {
	let elapsed = 0;
	let running = false;
	let visible = true;
	let frame: number | undefined;
	let lastStamp: number | undefined;
	const end = () => options.loop ? options.duration : (options.endAt ?? options.duration);
	const render = () => options.onFrame(elapsed);
	const cancel = () => {
		if (frame !== undefined) cancelAnimationFrame(frame);
		frame = undefined;
		lastStamp = undefined;
	};
	const tick = (stamp: number) => {
		frame = undefined;
		if (!running || !visible) return;
		if (lastStamp !== undefined) elapsed += Math.max(0, (stamp - lastStamp) / 1000);
		lastStamp = stamp;
		let completed = false;
		if (elapsed >= end()) {
			if (options.loop) elapsed %= options.duration;
			else {
				elapsed = end();
				running = false;
				completed = true;
			}
		}
		render();
		if (completed) options.onComplete?.();
		schedule();
	};
	const schedule = () => {
		if (running && visible && frame === undefined) frame = requestAnimationFrame(tick);
	};
	return {
		get time() { return elapsed; },
		get playing() { return running; },
		play() { if (elapsed >= end() && !options.loop) elapsed = 0; running = true; schedule(); },
		pause() { running = false; cancel(); },
		replay() { cancel(); elapsed = 0; render(); running = true; schedule(); },
		seek(seconds: number) { elapsed = Math.max(0, Math.min(end(), seconds)); lastStamp = undefined; render(); },
		setVisible(next: boolean) { visible = next; if (visible) schedule(); else cancel(); },
		destroy() { running = false; cancel(); },
	};
}
