/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** The 48 species from the supplied Hatask flower v2 design. */
export const HATASK_FLOWER_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type HataskFlowerSeason = typeof HATASK_FLOWER_SEASONS[number];

export type HataskCatalogFlower = { id: string; season: HataskFlowerSeason; emoji: string; name: string; hanakotoba: string; rare: boolean };

export const HATASK_FLOWER_CATALOG: readonly HataskCatalogFlower[] = [
	{ id: 'sp1', season: 'spring', emoji: '🌸', name: 'サクラソウ', hanakotoba: '初恋', rare: false },
	{ id: 'sp2', season: 'spring', emoji: '🌷', name: 'チューリップ', hanakotoba: '思いやり', rare: false },
	{ id: 'sp3', season: 'spring', emoji: '💐', name: 'スイートピー', hanakotoba: '門出', rare: false },
	{ id: 'sp4', season: 'spring', emoji: '🪻', name: 'ネモフィラ', hanakotoba: '可憐', rare: false },
	{ id: 'sp5', season: 'spring', emoji: '🌷', name: 'フリージア', hanakotoba: 'あどけなさ', rare: false },
	{ id: 'sp6', season: 'spring', emoji: '🌼', name: 'タンポポ', hanakotoba: '真心の愛', rare: false },
	{ id: 'sp7', season: 'spring', emoji: '🌷', name: 'スズラン', hanakotoba: '再び幸せが訪れる', rare: true },
	{ id: 'sp8', season: 'spring', emoji: '🌸', name: '梅', hanakotoba: '忍耐', rare: false },
	{ id: 'sp9', season: 'spring', emoji: '🌷', name: 'フジ', hanakotoba: '優しさ', rare: false },
	{ id: 'sp10', season: 'spring', emoji: '🪻', name: 'ムスカリ', hanakotoba: '明るい未来', rare: false },
	{ id: 'sp11', season: 'spring', emoji: '🪻', name: 'ラナンキュラス', hanakotoba: 'とても魅力的', rare: false },
	{ id: 'sp12', season: 'spring', emoji: '💐', name: 'レンゲソウ', hanakotoba: '心が和らぐ', rare: false },
	{ id: 'su1', season: 'summer', emoji: '🌻', name: 'ヒマワリ', hanakotoba: '憧れ', rare: false },
	{ id: 'su2', season: 'summer', emoji: '🌺', name: 'ハイビスカス', hanakotoba: '繊細な美', rare: false },
	{ id: 'su3', season: 'summer', emoji: '🌺', name: 'アサガオ', hanakotoba: 'はかない恋', rare: false },
	{ id: 'su4', season: 'summer', emoji: '🪷', name: 'ハス', hanakotoba: '清らかな心', rare: true },
	{ id: 'su5', season: 'summer', emoji: '🪻', name: 'ラベンダー', hanakotoba: '沈黙', rare: false },
	{ id: 'su6', season: 'summer', emoji: '🎋', name: 'たなばた草', hanakotoba: '願い', rare: false },
	{ id: 'su7', season: 'summer', emoji: '🪻', name: 'アジサイ', hanakotoba: '移り気', rare: false },
	{ id: 'su8', season: 'summer', emoji: '🌺', name: 'プルメリア', hanakotoba: '気品', rare: false },
	{ id: 'su9', season: 'summer', emoji: '🌺', name: 'ブーゲンビリア', hanakotoba: '情熱', rare: false },
	{ id: 'su10', season: 'summer', emoji: '🌺', name: 'サルビア', hanakotoba: '燃える思い', rare: false },
	{ id: 'su11', season: 'summer', emoji: '🌹', name: 'ペチュニア', hanakotoba: '心の平安', rare: false },
	{ id: 'su12', season: 'summer', emoji: '🌻', name: 'ゼラニウム', hanakotoba: '尊敬', rare: false },
	{ id: 'au1', season: 'autumn', emoji: '🌻', name: 'コスモス', hanakotoba: '調和', rare: false },
	{ id: 'au2', season: 'autumn', emoji: '🍁', name: 'モミジ', hanakotoba: '美しい変化', rare: false },
	{ id: 'au3', season: 'autumn', emoji: '🌾', name: 'ススキ', hanakotoba: '心が通じる', rare: false },
	{ id: 'au4', season: 'autumn', emoji: '🌻', name: 'キンモクセイ', hanakotoba: '謙虚', rare: false },
	{ id: 'au5', season: 'autumn', emoji: '🍂', name: 'おちば', hanakotoba: '物思い', rare: false },
	{ id: 'au6', season: 'autumn', emoji: '🌹', name: 'ダリア', hanakotoba: '華麗', rare: true },
	{ id: 'au7', season: 'autumn', emoji: '🌻', name: 'ケイトウ', hanakotoba: 'おしゃれ', rare: false },
	{ id: 'au8', season: 'autumn', emoji: '🪻', name: 'リンドウ', hanakotoba: '正義', rare: false },
	{ id: 'au9', season: 'autumn', emoji: '💐', name: 'キキョウ', hanakotoba: '誠実', rare: false },
	{ id: 'au10', season: 'autumn', emoji: '🌼', name: 'ワレモコウ', hanakotoba: '変化', rare: false },
	{ id: 'au11', season: 'autumn', emoji: '🌷', name: 'センニチコウ', hanakotoba: '不朽', rare: true },
	{ id: 'au12', season: 'autumn', emoji: '🌸', name: 'サザンカ', hanakotoba: '困難に打ち勝つ', rare: false },
	{ id: 'wi1', season: 'winter', emoji: '🌹', name: 'ツバキ', hanakotoba: '控えめな美しさ', rare: false },
	{ id: 'wi2', season: 'winter', emoji: '💐', name: 'シクラメン', hanakotoba: 'はにかみ', rare: false },
	{ id: 'wi3', season: 'winter', emoji: '🌻', name: 'ポインセチア', hanakotoba: '祝福', rare: false },
	{ id: 'wi4', season: 'winter', emoji: '🎄', name: 'クリスマスツリー', hanakotoba: '不変', rare: false },
	{ id: 'wi5', season: 'winter', emoji: '🎍', name: '門松', hanakotoba: '長寿', rare: false },
	{ id: 'wi6', season: 'winter', emoji: '🌷', name: 'フクジュソウ', hanakotoba: '永久の幸福', rare: true },
	{ id: 'wi7', season: 'winter', emoji: '🌼', name: 'ノースポール', hanakotoba: '誠実', rare: false },
	{ id: 'wi8', season: 'winter', emoji: '🌲', name: 'マツ', hanakotoba: '不老長寿', rare: false },
	{ id: 'wi9', season: 'winter', emoji: '🌹', name: 'カメリア', hanakotoba: '理想の愛', rare: false },
	{ id: 'wi10', season: 'winter', emoji: '💐', name: 'ストック', hanakotoba: '愛の絆', rare: false },
	{ id: 'wi11', season: 'winter', emoji: '🌹', name: 'カランコエ', hanakotoba: '幸福を告げる', rare: false },
	{ id: 'wi12', season: 'winter', emoji: '🌺', name: 'エーデルワイス', hanakotoba: '大切な思い出', rare: false },
];
