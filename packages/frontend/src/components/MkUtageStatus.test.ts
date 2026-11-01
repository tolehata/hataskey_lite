/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, reactive, ref } from 'vue';
import MkUtageStatus from './MkUtageStatus.vue';
import MkUtageNumber from './MkUtageNumber.vue';
import type { UtageSnapshot } from '@/utility/utage.js';
import { prefer } from '@/preferences.js';

vi.mock('@/preferences.js', async () => ({ prefer: { r: { animation: (await import('vue')).ref(true) } } }));
vi.mock('@/i18n.js', () => ({ i18n: {
	ts: { _hata: { _utage: { people: '人', remaining: '残り', waiting: '結果確認中', revival: '復活チャンス', revived: '復活成功', revivalFailed: '復活失敗', accepted: '応援済み', authorExcluded: '自分のリアクションは対象外' } } },
	tsx: { _hata: { _utage: { progress: ({ count, target }: { count: number; target: number }) => `${count} / ${target} 人` } } },
} }));
const cleanups: (() => void)[] = [];
const animations: { frames: Keyframe[]; cancel: ReturnType<typeof vi.fn>; finish: () => void }[] = [];
let media: MediaQueryList;
let hidden = false;
beforeEach(() => {
	vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-22T00:00:00Z'));
	prefer.r.animation.value = true; hidden = false; animations.length = 0;
	media = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList;
	vi.spyOn(window, 'matchMedia').mockReturnValue(media);
	vi.spyOn(window.document, 'hidden', 'get').mockImplementation(() => hidden);
	vi.spyOn(window.document, 'visibilityState', 'get').mockImplementation(() => hidden ? 'hidden' : 'visible');
	vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
	vi.stubGlobal('Animation', class {});
	Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: vi.fn((frames: Keyframe[]) => {
		let finish!: () => void;
		const finished = new Promise<void>(resolve => { finish = resolve; });
		const animation = { frames, cancel: vi.fn(), finish, finished };
		animations.push(animation); return animation;
	}) });
});
afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
	vi.clearAllTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
	delete (Element.prototype as { animate?: unknown }).animate;
});

function mount(render: () => ReturnType<typeof h>) {
	const host = window.document.createElement('div'); window.document.body.append(host);
	const app = createApp({ setup: () => render }); app.mount(host);
	const unmount = () => { app.unmount(); host.remove(); };
	cleanups.push(unmount); return host;
}

describe('復活状態の表示', () => {
	test('サーバー時計を基準にし、0秒でも失敗を捏造しない', async () => {
		const note = reactive<UtageSnapshot>({ utageStatus: 'reviving', utageServerNow: '2026-09-22T01:00:00Z', utageMyParticipation: 'accepted', utageRevival: { startedAt: '2026-09-22T01:00:00Z', expiresAt: '2026-09-22T01:00:02Z', targetCount: 6, reactionCount: 2 } });
		const host = mount(() => h(MkUtageStatus, { note }));
		expect(host.textContent).toContain('残り0:02'); expect(host.textContent).toContain('応援済み');
		expect(host.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('2 / 6 人');
		await vi.advanceTimersByTimeAsync(2500); await nextTick();
		expect(host.textContent).toContain('結果確認中'); expect(host.textContent).toContain('0:00');
		expect(host.textContent).not.toMatch(/残り|受付終了|復活失敗|応援済み/);
		expect(note.utageStatus).toBe('reviving');
		note.utageStatus = 'succeeded'; await nextTick();
		expect(host.textContent).toContain('復活成功'); expect(host.textContent).not.toContain('0:00');
	});
});
describe('人数の上下スライド', () => {
	test('初期表示は静止し、増加は上方向・減少は下方向、連打でも旧数字を残さない', async () => {
		const value = ref(2); const host = mount(() => h(MkUtageNumber, { value: value.value }));
		expect(animations).toHaveLength(0);
		value.value = 3; await nextTick();
		expect(animations[0].frames.at(-1)?.transform).toBe('translateY(-100%)');
		expect(animations[1].frames[0].transform).toBe('translateY(100%)');
		value.value = 1; await nextTick();
		expect(animations[0].cancel).toHaveBeenCalledOnce();
		expect(animations[2].frames.at(-1)?.transform).toBe('translateY(100%)');
		expect(animations[3].frames[0].transform).toBe('translateY(-100%)');
		animations[0].finish(); animations[1].finish(); await nextTick();
		expect(host.firstElementChild?.children).toHaveLength(2);
		animations[2].finish(); animations[3].finish(); await nextTick(); await nextTick();
		expect(host.textContent).toBe('1'); expect(host.firstElementChild?.children).toHaveLength(1);
	});
	test.each(['設定', 'OS', '非表示'] as const)('%sで進行中の数字を直ちに最新値へ戻す', async reason => {
		const value = ref(2); const host = mount(() => h(MkUtageNumber, { value: value.value }));
		value.value = 3; await nextTick(); expect(animations).toHaveLength(2);
		if (reason === '設定') prefer.r.animation.value = false;
		if (reason === 'OS') media.dispatchEvent(new Event('change'));
		if (reason === '非表示') { hidden = true; window.document.dispatchEvent(new Event('visibilitychange')); }
		await nextTick(); expect(host.textContent).toBe('3'); expect(animations[0].cancel).toHaveBeenCalledOnce();
	});
});
