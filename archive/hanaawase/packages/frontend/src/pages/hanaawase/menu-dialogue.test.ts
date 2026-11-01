import { describe, it, expect } from 'vitest';
import { jstHour, timeOfDay } from './daytime';
import { eligibleLines, castingWeights, pickMenuLine } from './menu-dialogue';
import { pickBackdrop, seasonOf } from './backdrop';
import { MENU_LINES } from './menu-lines';

// JSTの指定時でDateを作る（UTC = JST-9h）
function atJst(hour: number, min = 0): Date {
	return new Date(Date.UTC(2026, 0, 15, (hour - 9 + 24) % 24, min));
}

describe('daytime', () => {
	it('jstHour が JST(UTC+9) を返す', () => {
		expect(jstHour(new Date(Date.UTC(2026, 0, 15, 1, 0)))).toBe(10); // 01:00Z = 10:00 JST
		expect(jstHour(new Date(Date.UTC(2026, 0, 15, 16, 0)))).toBe(1); // 16:00Z = 翌01:00 JST
	});
	it('timeOfDay の境界', () => {
		expect(timeOfDay(atJst(5))).toBe('morning');
		expect(timeOfDay(atJst(8, 59))).toBe('morning');
		expect(timeOfDay(atJst(9))).toBe('day');
		expect(timeOfDay(atJst(15, 59))).toBe('day');
		expect(timeOfDay(atJst(16))).toBe('evening');
		expect(timeOfDay(atJst(18, 59))).toBe('evening');
		expect(timeOfDay(atJst(19))).toBe('night');
		expect(timeOfDay(atJst(3))).toBe('night');
	});
});

describe('eligibleLines', () => {
	it('時間帯・当月・進行でフィルタされる', () => {
		const ctx = { now: atJst(2), month: 9, prog: 'mid' as const }; // 夜・長月
		const lines = eligibleLines('wakana', ctx);
		expect(lines.length).toBeGreaterThan(0);
		for (const l of lines) {
			expect(l.char).toBe('wakana');
			expect(l.time === 'any' || l.time === 'night').toBe(true);
			expect(l.month === 'any' || l.month.includes(9)).toBe(true);
			expect(l.prog === undefined || l.prog === 'mid').toBe(true);
		}
	});
	it('early専用の一言は序盤だけ出る', () => {
		const early = eligibleLines('wakana', { now: atJst(12), month: 1, prog: 'early' });
		const late = eligibleLines('wakana', { now: atJst(12), month: 1, prog: 'late' });
		const earlyOnly = MENU_LINES.filter((l) => l.char === 'wakana' && l.prog === 'early');
		expect(earlyOnly.length).toBeGreaterThan(0);
		for (const l of earlyOnly) {
			expect(early.some((x) => x.t === l.t)).toBe(true);
			expect(late.some((x) => x.t === l.t)).toBe(false);
		}
	});
});

describe('castingWeights', () => {
	it('既定で若菜が必ず含まれる', () => {
		const w = castingWeights({ now: atJst(12), month: 1, prog: 'mid' });
		expect(w.some((c) => c.char === 'wakana')).toBe(true);
	});
	it('夕方はレンが顔を出す / 長月は内藤', () => {
		const eve = castingWeights({ now: atJst(17), month: 4, prog: 'mid' });
		expect(eve.some((c) => c.char === 'ren')).toBe(true);
		const kiku = castingWeights({ now: atJst(12), month: 9, prog: 'mid' });
		expect(kiku.some((c) => c.char === 'naito')).toBe(true);
	});
});

describe('pickMenuLine', () => {
	it('同じseed+文脈なら決定的、返り値は妥当', () => {
		const ctx = { now: atJst(12), month: 1, prog: 'mid' as const };
		const a = pickMenuLine(ctx, 12345);
		const b = pickMenuLine(ctx, 12345);
		expect(a).not.toBeNull();
		expect(a!.line.t).toBe(b!.line.t);
		expect(a!.line.char).toBe(a!.char);
	});
	it('exclude で直前と同じ本文を避ける（候補が複数ある場合）', () => {
		const ctx = { now: atJst(12), month: 1, prog: 'mid' as const };
		// 若菜だけに絞るため、まず1本取ってそれをexcludeに
		let seen = new Set<string>();
		for (let seed = 1; seed <= 40; seed++) {
			const p = pickMenuLine(ctx, seed);
			if (p) seen.add(p.line.t);
		}
		expect(seen.size).toBeGreaterThan(1); // 複数の一言が出る
		const first = pickMenuLine(ctx, 7)!;
		const next = pickMenuLine(ctx, 7, first.line.t)!;
		expect(next.line.t).not.toBe(first.line.t);
	});
});

describe('pickBackdrop', () => {
	// ⚠️背景は近未来版(nf_*)へ転換済み。実在するファイルのIDを返すこと
	it('時間帯で店内の朝/昼/夕/夜（近未来版）', () => {
		expect(pickBackdrop({ now: atJst(7), month: 1 }).id).toBe('nf_shop_morning');
		expect(pickBackdrop({ now: atJst(12), month: 1 }).id).toBe('nf_shop_day');
		expect(pickBackdrop({ now: atJst(17), month: 1 }).id).toBe('nf_shop_evening');
		expect(pickBackdrop({ now: atJst(22), month: 1 }).id).toBe('nf_shop_night');
	});
	it('loc と storyBg の優先', () => {
		// 季節専用の絵がある春は、季節一致が優先される
		expect(pickBackdrop({ now: atJst(12), month: 4, loc: 'front' }).id).toBe('front_spring');
		// 夜は季節絵に該当が無いので、季節を持たない近未来版が選ばれる
		expect(pickBackdrop({ now: atJst(22), month: 4, loc: 'front' }).id).toBe('nf_front_night');
		expect(pickBackdrop({ now: atJst(12), month: 1, loc: 'workroom' }).id).toBe('nf_workroom');
		expect(pickBackdrop({ now: atJst(12), month: 1, storyBg: 'shop_night' }).id).toBe('shop_night');
	});
	it('天候一致（夏の雨→front_summer_rain）', () => {
		expect(pickBackdrop({ now: atJst(12), month: 7, loc: 'front', weather: 'rain' }).id).toBe('front_summer_rain');
	});
	it('CSS代替の場所は id=null / css=true（shop_dayに丸めない）', () => {
		const p = pickBackdrop({ now: atJst(12), month: 1, loc: 'street' });
		expect(p.id).toBeNull();
		expect(p.css).toBe(true);
	});
	it('seasonOf', () => {
		expect(seasonOf(4)).toBe('spring');
		expect(seasonOf(7)).toBe('summer');
		expect(seasonOf(10)).toBe('autumn');
		expect(seasonOf(1)).toBe('winter');
	});
});
