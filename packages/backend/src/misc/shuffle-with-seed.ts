/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * シード固定の Fisher-Yates シャッフル
 *
 * 同じ seed を渡せば同じ順序が再現される。
 * TTL API のページング (seed 方式) で使用する。
 *
 * セキュリティ用途ではない (順序が予測可能でも害なし)。
 * 軽量で高速な PRNG として Mulberry32 を使用。
 *
 * @param array シャッフル対象の配列 (非破壊、コピーを返す)
 * @param seed 32 ビット整数のシード値
 * @returns シャッフルされた新しい配列
 */
export function shuffleWithSeed<T>(array: readonly T[], seed: number): T[] {
	const result = [...array];
	const rng = mulberry32(seed);
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/**
 * Mulberry32 PRNG
 *
 * 32 ビット整数のシードから [0, 1) の擬似乱数を生成する。
 * 軽量 (5 行) かつ十分な品質の乱数性を持つ。
 *
 * 出典: https://stackoverflow.com/a/47593316 (パブリックドメイン)
 */
function mulberry32(seed: number): () => number {
	let state = seed | 0;
	return function () {
		state = (state + 0x6D2B79F5) | 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * 32 ビット整数の乱数 seed を生成する。
 * Math.random() を使用 (暗号学的乱数は不要)。
 */
export function generateSeed(): number {
	return Math.floor(Math.random() * 0x7FFFFFFF);
}
