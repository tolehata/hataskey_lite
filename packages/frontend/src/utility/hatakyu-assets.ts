/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Hataskey fork: ハタキュアセットの中央レジストリ。
 *
 * ⚠️画面ごとに raw な URL を書かず、必ずこのレジストリの key を経由する。
 *   実体は packages/frontend/assets/hatakyu/ に置き、/client-assets/hatakyu/ で配信される。
 * ⚠️このファイルは対応表(Hataskey_ハタキュアセット対応表.csv)から生成した内容と一致させること。
 *   canonical 名を変えるときは、実ファイル・この表・利用箇所を同時に直す。
 *   アセットの権利・ライセンス条件は assets/hatakyu/NOTICE.md を正本とする。
 *
 * status は対応表の区分をそのまま持つ:
 *   'active'   … 今回の統合で実際に使う
 *   'reserved' … 将来用に登録だけする(使い切りを目的に無理へ差し込まない)
 */

import { prefer } from '@/preferences.js';

export const HATAKYU_ASSET_BASE = '/client-assets/hatakyu' as const;

export type HatakyuAssetStatus = 'active' | 'reserved';

export type HatakyuAssetDef = {
	/** 配信ファイル名(ASCII kebab-case)。 */
	file: string;
	status: HatakyuAssetStatus;
};

export const HATAKYU_ASSETS = {
	/** デフォルト「ありません」 */
	bored: { file: 'bored.png', status: 'active' },
	/** アカウント削除確認ダイアログ */
	bowDeep: { file: 'bow-deep.png', status: 'active' },
	/** 謝意・クレジット用候補 */
	bowRespectful: { file: 'bow-respectful.png', status: 'reserved' },
	/** 完了/謝意用候補 */
	bowSimple: { file: 'bow-simple.png', status: 'reserved' },
	/** サウンド設定、会話/フィードバック候補 */
	chatting: { file: 'chatting.png', status: 'active' },
	/** Hatask、予定/時刻関連 */
	checkingTime: { file: 'checking-time.png', status: 'active' },
	/** Hataskの食事記録・食事系の空状態/案内 */
	chefCooking: { file: 'chef-cooking.png', status: 'active' },
	/** 天気エフェクト説明候補 */
	coldShivering: { file: 'cold-shivering.png', status: 'reserved' },
	/** サービス連携、UIカテゴリ */
	computerChat: { file: 'computer-chat.png', status: 'active' },
	/** マスコット設定カテゴリ */
	dogPawUp: { file: 'dog-paw-up.png', status: 'active' },
	/** オンボーディング/開始演出候補 */
	dogRunning: { file: 'dog-running.png', status: 'reserved' },
	/** 遷移/移動の案内候補 */
	dogSidewalk: { file: 'dog-sidewalk.png', status: 'reserved' },
	/** 絵文字パレット/リアクション */
	heartHands: { file: 'heart-hands.png', status: 'active' },
	/** Hataskeyプロジェクトメンバーのアセットブランディング表示 */
	heartHug: { file: 'heart-hug.png', status: 'active' },
	/** 支援/フィードバック候補 */
	heartHugAlt: { file: 'heart-hug-alt.png', status: 'reserved' },
	/** 天気エフェクト説明候補 */
	hotSun: { file: 'hot-sun.png', status: 'reserved' },
	/** 大きなブランド付き待機状態、削除/整理開始後の案内 */
	loadingWait: { file: 'loading-wait.png', status: 'active' },
	/** notFound、Hataskの予定/項目なし候補 */
	lookingFor: { file: 'looking-for.png', status: 'active' },
	/** 認証失敗/パスキー未発見候補 */
	lostKey: { file: 'lost-key.png', status: 'reserved' },
	/** 活動なし/休憩候補 */
	lyingDown: { file: 'lying-down.png', status: 'reserved' },
	/** デフォルト「問題が発生しました」 */
	overwhelmed: { file: 'overwhelmed.png', status: 'active' },
	/** ドライブ、アカウント整理、エクスポート */
	packingBox: { file: 'packing-box.png', status: 'active' },
	/** 設定「その他」 */
	questioning: { file: 'questioning.png', status: 'active' },
	/** Hatask/HataFeedのランキング・集計候補 */
	rankingView: { file: 'ranking-view.png', status: 'reserved' },
	/** Hatady、フォント設定 */
	readingBook: { file: 'reading-book.png', status: 'active' },
	/** デフォルト「ブロックされています」、ミュートとブロック */
	refusing: { file: 'refusing.png', status: 'active' },
	/** メール設定、HataFeedの空状態 */
	reviewingDocuments: { file: 'reviewing-documents.png', status: 'active' },
	/** 検索結果なし、Hatady/HataFeed検索 */
	searching: { file: 'searching.png', status: 'active' },
	/** セキュリティ、HataFeed利用不可 */
	showingId: { file: 'showing-id.png', status: 'active' },
	/** プライバシー設定 */
	showingKey: { file: 'showing-key.png', status: 'active' },
	/** テーマ/ビジュアル設定 */
	stargazing: { file: 'stargazing.png', status: 'active' },
	/** 予期しない事象の案内候補 */
	surprised: { file: 'surprised.png', status: 'active' },
	/** 「今回の更新内容」ヘッダー、Hataskey独自機能入口 */
	treasureFound: { file: 'treasure-found.png', status: 'active' },
	/** Hataskey独自設定の「その他/天気エフェクト」 */
	umbrellaRain: { file: 'umbrella-rain.png', status: 'active' },
	/** アカウントデータ・インポート */
	unpackingBox: { file: 'unpacking-box.png', status: 'active' },
	/** 休止・オフライン・季節案内候補 */
	vacation: { file: 'vacation.png', status: 'reserved' },
	/** Hataskのお庭/花育成 */
	wateringFlower: { file: 'watering-flower.png', status: 'active' },
	/** 通知カテゴリ、未設定時のデフォルトサーバーアイコン */
	waving: { file: 'waving.png', status: 'active' },
	/** 設定・環境設定・Hataskey全体 */
	wrench: { file: 'wrench.png', status: 'active' },
	/** プラグイン、Hataskey独自機能バナー候補 */
	wrenchAlt: { file: 'wrench-alt.png', status: 'active' },
} as const satisfies Record<string, HatakyuAssetDef>;

export type HatakyuAssetKey = keyof typeof HATAKYU_ASSETS;

/** レジストリの key から配信URLを作る。⚠️URLの組み立てはここに一本化する。 */
export function hatakyuAssetUrl(key: HatakyuAssetKey): string {
	return `${HATAKYU_ASSET_BASE}/${HATAKYU_ASSETS[key].file}`;
}

/**
 * ハタキュ表示が利用者設定で有効か。
 * ⚠️テンプレート内で呼べば、設定の切替に自動で追従する(reactive ref を読むため)。
 */
export function useHatakyuBranding(): boolean {
	return prefer.r['hataBranding.useHatakyu'].value;
}

/**
 * 有効ならハタキュ画像、無効なら従来画像のURLを返す。
 * ⚠️従来画像のURLは呼び出し側が「元々何だったか」を明示するために渡す(復元先を失わないため)。
 */
export function brandedIconUrl(key: HatakyuAssetKey, fallbackUrl: string): string {
	return useHatakyuBranding() ? hatakyuAssetUrl(key) : fallbackUrl;
}
