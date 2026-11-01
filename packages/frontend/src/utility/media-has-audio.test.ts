/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import hasAudio from './media-has-audio.js';

function fixture() {
	const media = window.document.createElement('video');
	media.src = '/audio-probe.mp4';
	const cloned = media.cloneNode() as HTMLVideoElement;
	const cloneNode = vi.spyOn(media, 'cloneNode').mockReturnValue(cloned);
	const play = vi.spyOn(cloned, 'play').mockResolvedValue(undefined);
	const pause = vi.spyOn(cloned, 'pause').mockImplementation(() => {});
	const load = vi.spyOn(cloned, 'load').mockImplementation(() => {});
	const remove = vi.spyOn(cloned, 'remove');
	return { media, cloned, cloneNode, play, pause, load, remove };
}

function expectCleaned(probe: ReturnType<typeof fixture>) {
	expect(probe.pause).toHaveBeenCalledOnce();
	expect(probe.cloned.hasAttribute('src')).toBe(false);
	expect(probe.load).toHaveBeenCalledOnce();
	expect(probe.remove).toHaveBeenCalledOnce();
	expect(vi.getTimerCount()).toBe(0);
	// 判定用の複製だけを操作し、表示中の動画には触れない。
	expect(probe.media.getAttribute('src')).toBe('/audio-probe.mp4');
	expect(probe.media.muted).toBe(false);
	expect(probe.media.loop).toBe(false);
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('動画の音声トラック判定', () => {
	test.each([
		['audioTracks', { length: 1 }],
		['mozHasAudio', true],
		['webkitAudioDecodedByteCount', 128],
	] as const)('%s で音声ありを判定し、複製の再生を停止する', async (property, value) => {
		const probe = fixture();
		Object.defineProperty(probe.cloned, property, { value });
		const result = hasAudio(probe.media);
		expect(probe.cloned.muted).toBe(true);
		expect(probe.cloned.playsInline).toBe(true);
		probe.cloned.dispatchEvent(new Event('playing'));
		await expect(result).resolves.toBe(true);
		expectCleaned(probe);
	});

	test('再生に成功し音声トラックがなければ false を返す', async () => {
		const probe = fixture();
		Object.defineProperty(probe.cloned, 'mozHasAudio', { value: false });
		const result = hasAudio(probe.media);
		probe.cloned.dispatchEvent(new Event('playing'));
		await expect(result).resolves.toBe(false);
		expectCleaned(probe);
	});

	test('再生開始が拒否された場合は音声なしと判定せず後始末する', async () => {
		const probe = fixture();
		probe.play.mockRejectedValue(new DOMException('Unsupported media', 'NotSupportedError'));
		await expect(hasAudio(probe.media)).resolves.toBeNull();
		expectCleaned(probe);
	});

	test.each(['error', 'abort'])('%s イベントで判定を中止する', async type => {
		const probe = fixture();
		const result = hasAudio(probe.media);
		probe.cloned.dispatchEvent(new Event(type));
		await expect(result).resolves.toBeNull();
		expectCleaned(probe);
	});

	test('呼出元の中断で未完了の再生を停止し、遅れて来た拒否も処理する', async () => {
		const probe = fixture();
		let rejectPlay!: (reason: Error) => void;
		probe.play.mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectPlay = reject; }));
		const audioTracks = vi.fn(() => ({ length: 1 }));
		Object.defineProperty(probe.cloned, 'audioTracks', { get: audioTracks });
		const controller = new AbortController();
		const result = hasAudio(probe.media, controller.signal);
		controller.abort();
		await expect(result).resolves.toBeNull();
		rejectPlay(new DOMException('Playback aborted', 'AbortError'));
		probe.cloned.dispatchEvent(new Event('playing'));
		await Promise.resolve();
		expect(audioTracks).not.toHaveBeenCalled();
		expectCleaned(probe);
	});

	test('既に中断されていれば複製も再生も始めない', async () => {
		const probe = fixture();
		const controller = new AbortController();
		controller.abort();
		await expect(hasAudio(probe.media, controller.signal)).resolves.toBeNull();
		expect(probe.cloneNode).not.toHaveBeenCalled();
		expect(probe.play).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('再生要求が保留されても10秒で判定を終える', async () => {
		const probe = fixture();
		probe.play.mockImplementation(() => new Promise<void>(() => {}));
		const settled = vi.fn();
		const result = hasAudio(probe.media).then(settled);
		await vi.advanceTimersByTimeAsync(9_999);
		expect(settled).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		await result;
		expect(settled).toHaveBeenCalledWith(null);
		expectCleaned(probe);
	});
});
