// 花常: 時間帯ユーティリティ（JST固定・本体のタイムゾーンに依存しない）。
// daily.ts のJST日付と揃える思想。純関数なのでテスト可能。

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

/** 与えられた時刻の JST(UTC+9) の「時」(0-23) を返す。 */
export function jstHour(now: Date): number {
	const minutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 540; // +9h
	return Math.floor(((minutes % 1440) + 1440) % 1440 / 60);
}

/** JSTの時刻から時間帯を判定する。朝5-9 / 昼9-16 / 夕16-19 / 夜それ以外。 */
export function timeOfDay(now: Date): TimeOfDay {
	const h = jstHour(now);
	if (h >= 5 && h < 9) return 'morning';
	if (h >= 9 && h < 16) return 'day';
	if (h >= 16 && h < 19) return 'evening';
	return 'night';
}
