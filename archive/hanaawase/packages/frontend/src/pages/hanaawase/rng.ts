/** 再現可能な盤面生成用PRNG。ゲームロジックから標準乱数への直接依存を排除する。 */
export type Rng = () => number;

export const mulberry32 = (seed: number): Rng => {
	let state = seed | 0;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
};

/** 文字列シードを mulberry32 に渡せる32bit整数へ畳み込む。 */
export const seedFromText = (text: string): number => {
	let value = 2166136261;
	for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
	return value >>> 0;
};
