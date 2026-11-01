/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 * 旗鯖fork: Hatady(学習・読書記録ツール)共通の定義とヘルパー。
 *   - 分野(subject)の色パレット。既知分野は固定色、未知分野はタイトルハッシュで安定割当。
 *   - タグ(得意/苦手/興味/映画/ゲーム)の定義。
 *   - 本の自動表紙(タイトルから決定的にグラデーションを生成)。
 *   - デザイン言語は hataskey 本体と独立(暖色クラフト紙)。色は Hatady 内で完結する。
 */

import { ref } from 'vue';
import { i18n } from '@/i18n.js';

// 分野の配色。accent=左ボーダー/ドット, bg=淡色チップ背景, fg=チップ文字, strongBg=タグ濃色。
export interface HyPalette {
	accent: string;
	bg: string;
	fg: string;
}

// 旗鯖fork: 本人が指定した分野色の上書きマップ(分野名 → HEX)。
//   本人のクライアント内でのみ反映(他ユーザーの表示には影響しない)。
//   hatady 表示時に hata/hatady/subjects から読み込んでセットする(loadHySubjects)。
//   ref にすることで、色変更が pal() を使う各テンプレートへリアクティブに伝播する。
export const hySubjectColorOverrides = ref<Record<string, string>>({});
export function setHySubjectColorOverrides(map: Record<string, string>): void {
	hySubjectColorOverrides.value = map;
}
// 任意の HEX からチップ配色(accent/bg/fg)を導出。既存の淡色チップの見た目に合わせる。
export function deriveHySubjectPalette(hex: string): HyPalette {
	return {
		accent: hex,
		bg: `color-mix(in srgb, ${hex} 18%, #ffffff)`,
		fg: hex,
	};
}
export const HY_SUBJECT_PALETTES: HyPalette[] = [
	{ accent: '#517f4f', bg: '#e2ece0', fg: '#4e7d4a' }, // green
	{ accent: '#bd6a3d', bg: '#f6e2d4', fg: '#bd6a3d' }, // orange
	{ accent: '#45688f', bg: '#e3ebf3', fg: '#45688f' }, // blue
	{ accent: '#8a5a91', bg: '#ece0ec', fg: '#8a5a91' }, // purple
	{ accent: '#a97e2e', bg: '#f7e7c6', fg: '#a97e2e' }, // amber
	{ accent: '#3f8a8a', bg: '#d9efee', fg: '#2f7a7a' }, // teal
];

// 既知の分野 → パレット索引(デザイン案の色を踏襲)。未知の分野はハッシュで割り当てる。
const KNOWN_SUBJECTS: Record<string, number> = {
	プログラミング: 0,
	読書: 3,
	英語: 1,
	数学: 2,
	歴史: 4,
	哲学: 4,
	統計: 2,
	Programming: 0,
	Reading: 3,
	English: 1,
	Math: 2,
	History: 4,
};

// 文字列ハッシュ(分野名・タイトル等から安定した数値を得る)。
function hashString(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
	return Math.abs(h);
}

// 分野名 → パレット。既知は固定、未知はハッシュで安定割当。
export function hySubjectPalette(subject: string | null | undefined): HyPalette {
	const key = (subject ?? '').trim();
	if (key.length === 0) return HY_SUBJECT_PALETTES[0];
	// 旗鯖fork: 本人が指定した色があれば最優先(自動割当より優先)。
	const override = hySubjectColorOverrides.value[key];
	if (override) return deriveHySubjectPalette(override);
	if (key in KNOWN_SUBJECTS) return HY_SUBJECT_PALETTES[KNOWN_SUBJECTS[key]];
	return HY_SUBJECT_PALETTES[hashString(key) % HY_SUBJECT_PALETTES.length];
}

// タグ。key はサーバー保存値、表示名は hyTagLabel() で現在の locale から解決する。
// movie/game は作品種別そのものではなく、学習ログから関連する媒体へ目印を付けるためのタグ。
export type HyTag = 'strength' | 'weak' | 'interest' | 'movie' | 'game';
export const HY_TAGS: { key: HyTag; icon: string; bg: string; fg: string }[] = [
	{ key: 'strength', icon: 'ti-star-filled', bg: '#dcecd5', fg: '#4e7d4a' },
	{ key: 'weak', icon: 'ti-flame', bg: '#f1ddd5', fg: '#b5644a' },
	{ key: 'interest', icon: 'ti-bulb', bg: '#f7e7c6', fg: '#a97e2e' },
	{ key: 'movie', icon: 'ti-movie', bg: '#e3ebf3', fg: '#45688f' },
	{ key: 'game', icon: 'ti-device-gamepad-2', bg: '#ece0ec', fg: '#7a4f91' },
];
export function hyTag(key: string | null | undefined): typeof HY_TAGS[number] | null {
	return HY_TAGS.find(t => t.key === key) ?? null;
}
export function hyTagLabel(key: string | null | undefined): string {
	switch (key) {
		case 'strength': return i18n.ts._hata._hatady._tags.strength;
		case 'weak': return i18n.ts._hata._hatady._tags.weak;
		case 'interest': return i18n.ts._hata._hatady._tags.interest;
		case 'movie': return i18n.ts._hata._hatady._tags.movie;
		case 'game': return i18n.ts._hata._hatady._tags.game;
		default: return '';
	}
}

// 本の自動表紙: タイトルから決定的に2色のグラデーションを生成する(外部API不使用)。
//   落ち着いた本の背表紙らしい暖色〜寒色のセットから、タイトルハッシュで安定選択する。
export const HY_COVER_SETS: [string, string][] = [
	['#5a8a6a', '#3f6e4f'], // green
	['#b57f4a', '#8a5a2e'], // brown
	['#45688f', '#2f4a6b'], // blue
	['#8a5a91', '#5f3a66'], // purple
	['#c07a4a', '#9a5730'], // amber
	['#4f7f7c', '#356561'], // teal
	['#8f5a5a', '#6b3a3a'], // rust
];
// タイトルハッシュで安定選択。colorIndex が指定されていればそれを優先する(表紙の色を手動で選べる)。
// しおりの色プリセット。key を保存し、hyBookmarkColor(key) で実色に解決する。
export const HY_BOOKMARK_COLORS: { key: string; color: string }[] = [
	{ key: 'red', color: '#d9534f' },
	{ key: 'orange', color: '#e08a3c' },
	{ key: 'yellow', color: '#e0b93c' },
	{ key: 'green', color: '#5a9a5a' },
	{ key: 'blue', color: '#4a7fb0' },
	{ key: 'purple', color: '#8a5a91' },
	{ key: 'pink', color: '#cf6f95' },
];
export function hyBookmarkColor(key: string | null | undefined): string {
	return HY_BOOKMARK_COLORS.find(c => c.key === key)?.color ?? HY_BOOKMARK_COLORS[1].color;
}

// プロフィールのバナー色プリセット(1c)。key を保存し、from→to のグラデーションで描画する。
export const HY_BANNER_PRESETS: { key: string; from: string; to: string }[] = [
	{ key: 'orange', from: '#e79b5e', to: '#d9824a' }, // 既定
	{ key: 'green', from: '#7ba97f', to: '#4e7d4a' },
	{ key: 'blue', from: '#6a86b0', to: '#455f8a' },
	{ key: 'purple', from: '#a07bb0', to: '#7a4f91' },
	{ key: 'rose', from: '#d98aa0', to: '#b5647d' },
	{ key: 'teal', from: '#5fb0aa', to: '#357a74' },
	{ key: 'graphite', from: '#6d6459', to: '#463f37' },
];
export function hyBannerGradient(key: string | null | undefined): string {
	const p = HY_BANNER_PRESETS.find(x => x.key === key) ?? HY_BANNER_PRESETS[0];
	return `linear-gradient(120deg, ${p.from}, ${p.to})`;
}

export function hyCoverGradient(title: string | null | undefined, colorIndex?: number | null): string {
	const idx = (colorIndex != null && colorIndex >= 0)
		? colorIndex % HY_COVER_SETS.length
		: hashString(title ?? '') % HY_COVER_SETS.length;
	const set = HY_COVER_SETS[idx];
	return `linear-gradient(135deg, ${set[0]}, ${set[1]})`;
}
