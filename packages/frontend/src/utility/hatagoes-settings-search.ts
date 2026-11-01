/* SPDX-License-Identifier: AGPL-3.0-only */
import type { HatagoesApp } from './hatagoes-catalog.js';

export type HatagoesSettingHit = { app: HatagoesApp; section: string; label: string; keywords: readonly string[] };

/** Every section maps to an existing setting target in its owning app. */
export const HATAGOES_SETTING_INDEX = [
	{ app: 'hatask', section: 'theme', label: 'デザインテーマ', keywords: ['テーマ', 'あかつき', 'こけ', 'きせつ', 'かしん', 'すり', 'ハタキュ'] },
	{ app: 'hatask', section: 'appearance', label: '外観・明暗', keywords: ['自動', 'ライト', 'ダークモード', '見た目'] },
	{ app: 'hatask', section: 'animation', label: 'アニメーション', keywords: ['動き', 'モーション'] },
	{ app: 'hatask', section: 'calendar', label: 'カレンダー', keywords: ['週の始まり', '月曜日', '日曜日'] },
	{ app: 'hatask', section: 'moodReminder', label: 'きもちの通知', keywords: ['きもち記録', 'リマインダー', '通知時刻', 'タイムゾーン'] },
	{ app: 'hatask', section: 'sync', label: 'データ同期', keywords: ['同期', '共有'] },
	{ app: 'hatask', section: 'dataSafety', label: 'データの安全性', keywords: ['バックアップ', '復元', '統合'] },
	{ app: 'hatask', section: 'notifications', label: 'Hataskの通知', keywords: ['実績通知', 'テスト通知', 'プッシュ通知'] },
	{ app: 'hatask', section: 'rateLimit', label: '利用制限', keywords: ['API', 'レート制限', '回数'] },
	{ app: 'hatask', section: 'help', label: 'ヘルプ', keywords: ['チュートリアル', '使い方'] },
	{ app: 'hatady', section: 'theme', label: 'Hatadyのテーマ', keywords: ['見た目', '外観', 'デザイン'] },
	{ app: 'hatady', section: 'manage', label: 'Hatadyの管理', keywords: ['教科', 'チュートリアル', '書き出し', 'エクスポート'] },
	{ app: 'hatady', section: 'sync', label: 'Hatadyの同期', keywords: ['データ共有', 'クラウド'] },
	{ app: 'hatafeed', section: 'theme', label: 'HataFeedのテーマ', keywords: ['見た目', 'ライト', 'ダーク', 'ペーパー', 'エスプレッソ'] },
	{ app: 'hatafeed', section: 'leaves', label: '若葉アニメーション', keywords: ['葉', '動き', 'アニメ'] },
	{ app: 'hatafeed', section: 'projects', label: 'プロジェクト設定', keywords: ['プロジェクト', '切り替え', '管理'] },
	{ app: 'hatafeed', section: 'tutorials', label: 'HataFeedの使い方', keywords: ['チュートリアル', '新着情報'] },
] as const satisfies readonly HatagoesSettingHit[];

export function searchHatagoesSettings(query: string, availableApps: readonly HatagoesApp[]): HatagoesSettingHit[] {
	const term = query.trim().toLocaleLowerCase();
	if (!term) return [];
	return HATAGOES_SETTING_INDEX.filter(item => availableApps.includes(item.app)
		&& [item.label, item.app, item.section, ...item.keywords].some(value => value.toLocaleLowerCase().includes(term)));
}
