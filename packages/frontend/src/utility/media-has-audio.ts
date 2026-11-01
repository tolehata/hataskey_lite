/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

type AudioDetectableMedia = HTMLMediaElement & {
	audioTracks?: { length: number };
	mozHasAudio?: boolean;
	webkitAudioDecodedByteCount?: number;
};

/** 再生して判定できなかった場合は、音声なしと区別して null を返す。 */
export default async function hasAudio(media: HTMLMediaElement, signal?: AbortSignal): Promise<boolean | null> {
	if (signal?.aborted) return null;

	const cloned = media.cloneNode() as AudioDetectableMedia;
	const listeners = new AbortController();
	let timeout: number | undefined;

	try {
		cloned.muted = (cloned as typeof cloned & Partial<HTMLVideoElement>).playsInline = true;
		return await new Promise<boolean | null>(resolve => {
			const unknown = () => resolve(null);
			const options = { signal: listeners.signal };
			cloned.addEventListener('playing', () => {
				resolve(Boolean(cloned.audioTracks?.length) || cloned.mozHasAudio === true || Boolean(cloned.webkitAudioDecodedByteCount));
			}, options);
			cloned.addEventListener('error', unknown, options);
			cloned.addEventListener('abort', unknown, options);
			signal?.addEventListener('abort', unknown, options);
			// 通信が止まった場合や、ブラウザが再生要求を保留した場合も判定を終える。
			timeout = window.setTimeout(unknown, 10_000);
			cloned.play().catch(unknown);
		});
	} catch {
		return null;
	} finally {
		listeners.abort();
		window.clearTimeout(timeout);
		cloned.pause();
		cloned.removeAttribute('src');
		cloned.load();
		cloned.remove();
	}
}
