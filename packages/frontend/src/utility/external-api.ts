/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { prefer } from '@/preferences.js';
import { isRetiredExternalHost } from '@/utility/external-account-policy.js';

export interface ExternalAccount {
	host: string;
	token: string;
	userId: string;
	username: string;
	avatarUrl: string | null;
}

export interface ExternalCustomEmoji {
	name: string;
	category: string | null;
	url: string;
	aliases: string[];
	localOnly?: boolean;
	isSensitive?: boolean;
}

// ===== セキュリティ: 外部ホスト/エンドポイントの検証 =====

/**
 * RFC 1123 ホスト名 + 任意ポート (1-65535) を許可する正規表現
 * 例: example.com, sub.example.com:8080
 * 拒否: パス, クエリ, スキーム, "@", IP リテラル形式 (一部許可)
 */
const HOST_REGEX = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*(:[1-9][0-9]{0,4})?$/i;

/**
 * SSRF 防止: プライベート/予約 IP・特殊ドメインを拒否
 */
const FORBIDDEN_HOSTNAMES = new Set([
	'localhost', 'localhost.localdomain',
	'broadcasthost', 'ip6-localhost', 'ip6-loopback',
]);

const FORBIDDEN_HOST_PREFIXES = [
	// IPv4
	'127.', '10.', '169.254.', '0.',
	'192.168.',
	// IPv6 ループバック/リンクローカル/ULA (簡易判定)
	'::1', 'fe80:', 'fc00:', 'fd00:', 'fd',
];

/**
 * 外部ホスト名を検証
 * @returns true=許可, false=拒否
 */
export function isValidExternalHost(host: unknown): host is string {
	if (typeof host !== 'string' || host.length === 0 || host.length > 253) return false;
	const lower = host.toLowerCase();

	// 危険文字 (パス区切り、クエリ、スキーム、ユーザー情報、改行) を完全拒否
	// `:` だけは "host:port" として許容するが、複数や前後に他の禁止文字があれば落ちる
	if (/[\/?#@\\\s\u0000-\u001F]/.test(lower)) return false;

	// ホスト名形式 (FQDN+任意ポート) に合致するか
	const onlyHost = lower.split(':')[0];
	if (!HOST_REGEX.test(lower)) {
		// IPv4/IPv6 リテラルもざっくり許容しつつ後続でブロックする
		// 厳密な dotted-quad / IPv6 マッチは省略 (URL コンストラクタで検証する)
	}

	if (FORBIDDEN_HOSTNAMES.has(onlyHost)) return false;
	for (const prefix of FORBIDDEN_HOST_PREFIXES) {
		if (onlyHost.startsWith(prefix)) return false;
	}
	// 172.16.0.0/12
	if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(onlyHost)) return false;

	// URL コンストラクタで最終検証 (https://host/ がパースできるか)
	try {
		const u = new URL(`https://${host}/`);
		if (u.hostname.toLowerCase() !== onlyHost) return false; // ホスト部の改竄を弾く
		if (u.pathname !== '/' || u.search !== '' || u.hash !== '' || u.username !== '' || u.password !== '') return false;
	} catch {
		return false;
	}
	return true;
}

/** 形式が正しく、かつ現在も外部アカウント連携で利用できるホスト。 */
export function isAllowedExternalHost(host: unknown): host is string {
	return isValidExternalHost(host) && !isRetiredExternalHost(host);
}

/**
 * 外部 API エンドポイントパスを検証
 * 許可: notes/create, i/notifications, notifications/mark-all-as-read 等
 * 拒否: 先頭スラッシュ, クエリ, ドット, パス遡及, 改行
 */
const ENDPOINT_REGEX = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/;

export function isValidExternalEndpoint(endpoint: unknown): endpoint is string {
	if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > 100) return false;
	if (!ENDPOINT_REGEX.test(endpoint)) return false;
	if (endpoint.includes('..')) return false;
	return true;
}

/**
 * エラーメッセージ用に外部レスポンスを安全に切り詰め
 * トークン誤露出を防ぎ、ログ汚染を抑える
 */
function sanitizeErrorPayload(text: string): string {
	if (typeof text !== 'string') return '';
	// 改行を削り、長さも制限
	const cleaned = text.replace(/[\r\n\t]+/g, ' ').slice(0, 200);
	// `i:` トークン形式を含んでいたら隠す (念のため)
	return cleaned.replace(/("i"\s*:\s*)"[^"]+"/g, '$1"***"');
}

/**
 * 外部サーバーのアカウント情報を取得
 * host が無効な場合は null を返す (連携無効として扱う)
 */
export function getExternalAccount(): ExternalAccount | null {
	if (!prefer.s['external.enabled']) return null;

	const host = prefer.s['external.host'];
	const token = prefer.s['external.token'];
	const userId = prefer.s['external.userId'];
	const username = prefer.s['external.username'];
	const avatarUrl = prefer.s['external.avatarUrl'] ?? null;

	if (!host || !token || !userId || !username) return null;
	// host が不正なら連携情報を返さない (誤って攻撃者サーバーへトークン送信する事故を防ぐ)
	if (!isAllowedExternalHost(host)) {
		console.warn('[external-api] external.host has an invalid format, refusing to use it:', host);
		return null;
	}
	if (typeof token !== 'string' || token.length === 0 || token.length > 4096) return null;

	return { host, token, userId, username, avatarUrl };
}

/**
 * 外部サーバーが連携されているかチェック
 */
export function isExternalAccountLinked(): boolean {
	return getExternalAccount() !== null;
}

/**
 * 外部サーバーAPIを呼び出す（JSON）
 */
export async function callExternalApi<T = any>(
	endpoint: string,
	params: Record<string, any> = {},
	account?: ExternalAccount,
): Promise<T> {
	const acc = account ?? getExternalAccount();
	if (!acc) {
		throw new Error('External account not linked');
	}
	if (!isValidExternalEndpoint(endpoint)) {
		throw new Error('Invalid external endpoint');
	}
	// account が呼び出し側から渡された場合も host を検証
	if (!isAllowedExternalHost(acc.host)) {
		throw new Error('Invalid external host');
	}

	const res = await fetch(`https://${acc.host}/api/${endpoint}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			i: acc.token,
			...params,
		}),
		// クッキー・認証情報を一切送らない (token は body のみで送信)
		credentials: 'omit',
		referrerPolicy: 'no-referrer',
	});

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`External API error: ${res.status} - ${sanitizeErrorPayload(errorText)}`);
	}

	const text = await res.text();
	return (text ? JSON.parse(text) : null) as T;
}

/**
 * 外部サーバーAPIを呼び出す（GET, 認証不要）
 */
export async function callExternalApiGet<T = any>(
	endpoint: string,
	host?: string,
): Promise<T> {
	const h = host ?? getExternalAccount()?.host;
	if (!h) {
		throw new Error('External host not available');
	}
	if (!isValidExternalEndpoint(endpoint)) {
		throw new Error('Invalid external endpoint');
	}
	if (!isAllowedExternalHost(h)) {
		throw new Error('Invalid external host');
	}

	const res = await fetch(`https://${h}/api/${endpoint}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({}),
		credentials: 'omit',
		referrerPolicy: 'no-referrer',
	});

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`External API (GET) error: ${res.status} - ${sanitizeErrorPayload(errorText)}`);
	}

	return res.json();
}

// ===== カスタム絵文字キャッシュ（インメモリ + localStorage 永続化） =====
let emojiCache: { host: string; emojis: ExternalCustomEmoji[]; fetchedAt: number } | null = null;
let emojiUrlMapCache: { host: string; map: Record<string, string> } | null = null;
const EMOJI_CACHE_TTL = 30 * 60 * 1000; // 30分
const EMOJI_STORAGE_KEY = 'externalEmojiCache';
const EMOJI_URL_MAP_STORAGE_KEY = 'externalEmojiUrlMapCache';

function restoreEmojiCacheFromStorage(): void {
	try {
		const stored = localStorage.getItem(EMOJI_STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (parsed && isAllowedExternalHost(parsed.host) && Array.isArray(parsed.emojis) && typeof parsed.fetchedAt === 'number') {
				emojiCache = parsed;
			} else {
				// 破損または不正なホスト → 破棄
				localStorage.removeItem(EMOJI_STORAGE_KEY);
			}
		}
		const storedMap = localStorage.getItem(EMOJI_URL_MAP_STORAGE_KEY);
		if (storedMap) {
			const parsed = JSON.parse(storedMap);
			if (parsed && isAllowedExternalHost(parsed.host) && typeof parsed.map === 'object' && parsed.map !== null) {
				emojiUrlMapCache = parsed;
			} else {
				localStorage.removeItem(EMOJI_URL_MAP_STORAGE_KEY);
			}
		}
	} catch {
		// パースエラーは破棄してフォールスルー
		try {
			localStorage.removeItem(EMOJI_STORAGE_KEY);
			localStorage.removeItem(EMOJI_URL_MAP_STORAGE_KEY);
		} catch { /* ignore */ }
	}
}
restoreEmojiCacheFromStorage();

function saveEmojiCacheToStorage(): void {
	try { if (emojiCache) localStorage.setItem(EMOJI_STORAGE_KEY, JSON.stringify(emojiCache)); } catch { /* ignore */ }
}
function saveEmojiUrlMapCacheToStorage(): void {
	try { if (emojiUrlMapCache) localStorage.setItem(EMOJI_URL_MAP_STORAGE_KEY, JSON.stringify(emojiUrlMapCache)); } catch { /* ignore */ }
}

/**
 * 外部サーバーのカスタム絵文字一覧を取得（キャッシュ付き）
 * Misskey/Shrimpia の /api/emojis レスポンス形式に対応:
 *   - { emojis: [...] } (標準 Misskey)
 *   - [...] (直接配列)
 *   - { emojis: { name: url, ... } } (オブジェクト形式)
 */
export async function getExternalCustomEmojis(forceRefresh = false): Promise<ExternalCustomEmoji[]> {
	const acc = getExternalAccount();
	if (!acc) return [];

	const now = Date.now();

	if (
		!forceRefresh &&
		emojiCache &&
		emojiCache.host === acc.host &&
		(now - emojiCache.fetchedAt) < EMOJI_CACHE_TTL
	) {
		return emojiCache.emojis;
	}

	try {
		if (!isAllowedExternalHost(acc.host)) {
			throw new Error('Invalid external host');
		}
		const res = await fetch(`https://${acc.host}/api/emojis`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
			credentials: 'omit',
			referrerPolicy: 'no-referrer',
		});

		if (!res.ok) {
			throw new Error(`emojis API error: ${res.status}`);
		}

		const data = await res.json();
		let emojis: ExternalCustomEmoji[] = [];

		if (Array.isArray(data)) {
			// 直接配列形式
			emojis = data;
		} else if (data && Array.isArray(data.emojis)) {
			// 標準 { emojis: [...] } 形式
			emojis = data.emojis;
		} else if (data && typeof data.emojis === 'object' && data.emojis !== null) {
			// オブジェクト形式 { emojis: { name: url, ... } }
			emojis = Object.entries(data.emojis).map(([name, url]) => ({
				name,
				url: url as string,
				category: null,
				aliases: [],
			}));
		}

		// 絵文字レコードの最低限のフィルタリング
		// (外部サーバーが返す任意の値を盲目的に信用しない)
		emojis = emojis.filter(e =>
			e && typeof e === 'object'
			&& typeof e.name === 'string' && e.name.length > 0 && e.name.length <= 100
			&& typeof e.url === 'string' && e.url.length > 0 && e.url.length <= 2048
			// javascript:, data:, vbscript: などの危険スキームを排除
			&& !/^\s*(javascript|data|vbscript|file):/i.test(e.url),
		);

		// 絵文字の URL が相対パスの場合は絶対URLに変換
		for (const emoji of emojis) {
			if (emoji.url && !/^https?:\/\//i.test(emoji.url)) {
				emoji.url = `https://${acc.host}${emoji.url.startsWith('/') ? '' : '/'}${emoji.url}`;
			}
		}

		emojiCache = {
			host: acc.host,
			emojis,
			fetchedAt: now,
		};

		// URLマップキャッシュも更新
		emojiUrlMapCache = null;

		// localStorage にも永続化
		saveEmojiCacheToStorage();
		try { localStorage.removeItem(EMOJI_URL_MAP_STORAGE_KEY); } catch { /* ignore */ }

		console.log(`[external-api] Loaded ${emojis.length} custom emojis from ${acc.host}`);
		return emojis;
	} catch (err) {
		console.error('[external-api] Failed to fetch custom emojis:', err);
		// キャッシュがあれば古くても返す
		if (emojiCache && emojiCache.host === acc.host) {
			return emojiCache.emojis;
		}
		return [];
	}
}

/**
 * 外部サーバーの絵文字名→URL マッピングを取得（キャッシュ付き）
 * MkMfmの emojiUrls に渡すためのマップ
 * エイリアスも含めて登録する
 */
export async function getExternalEmojiUrlMap(): Promise<Record<string, string>> {
	const acc = getExternalAccount();
	if (!acc) return {};

	// キャッシュがあればそのまま返す
	if (emojiUrlMapCache && emojiUrlMapCache.host === acc.host) {
		return emojiUrlMapCache.map;
	}

	const emojis = await getExternalCustomEmojis();
	const map: Record<string, string> = {};
	for (const emoji of emojis) {
		if (emoji.name && emoji.url) {
			map[emoji.name] = emoji.url;
			// エイリアスも登録
			if (emoji.aliases && Array.isArray(emoji.aliases)) {
				for (const alias of emoji.aliases) {
					if (alias && !map[alias]) {
						map[alias] = emoji.url;
					}
				}
			}
		}
	}

	emojiUrlMapCache = { host: acc.host, map };
	saveEmojiUrlMapCacheToStorage();
	return map;
}

/**
 * 外部サーバーの絵文字キャッシュを事前読み込み
 * MkExternalTimeline のマウント時に呼び出し、
 * 個々の MkExternalNote が onMounted で取得する前にキャッシュを温めておく
 */
export async function preloadExternalEmojiMap(): Promise<void> {
	try {
		await getExternalEmojiUrlMap();
	} catch (err) {
		console.error('[external-api] Failed to preload emoji map:', err);
	}
}

/**
 * カスタム絵文字キャッシュをクリア
 */
export function clearExternalEmojiMemoryCache(): void {
	emojiCache = null;
	emojiUrlMapCache = null;
}

export function clearExternalEmojiCache(): void {
	clearExternalEmojiMemoryCache();
	try {
		localStorage.removeItem(EMOJI_STORAGE_KEY);
		localStorage.removeItem(EMOJI_URL_MAP_STORAGE_KEY);
		// 複数ホスト対応の絵文字URLマップキャッシュも削除(旗鯖fork)
		localStorage.removeItem(EXT_EMOJI_URL_MAP_KEY);
	} catch { /* ignore */ }
}

/**
 * 外部サーバーにファイルをアップロード（multipart/form-data）
 */
export async function uploadFileToExternal(
	file: File | Blob,
	options?: {
		name?: string;
		folderId?: string;
		isSensitive?: boolean;
		force?: boolean;
		comment?: string;
	},
	account?: ExternalAccount,
): Promise<any> {
	const acc = account ?? getExternalAccount();
	if (!acc) {
		throw new Error('External account not linked');
	}
	if (!isAllowedExternalHost(acc.host)) {
		throw new Error('Invalid external host');
	}

	const formData = new FormData();
	formData.append('i', acc.token);
	formData.append('file', file, options?.name);

	if (options?.name) formData.append('name', options.name);
	if (options?.folderId) formData.append('folderId', options.folderId);
	if (options?.isSensitive !== undefined) formData.append('isSensitive', String(options.isSensitive));
	if (options?.force !== undefined) formData.append('force', String(options.force));
	if (options?.comment) formData.append('comment', options.comment);

	const res = await fetch(`https://${acc.host}/api/drive/files/create`, {
		method: 'POST',
		body: formData,
		credentials: 'omit',
		referrerPolicy: 'no-referrer',
	});

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`External file upload error: ${res.status} - ${sanitizeErrorPayload(errorText)}`);
	}

	return res.json();
}

/**
 * 自鯖のドライブファイルを外部サーバーにアップロード
 * ファイルをfetchしてからアップロードする
 *
 * SECURITY: driveFile.url は自鯖から提供された値のはずだが、
 * 念の為スキーム検証してから fetch する (クライアントサイドの不変条件保護)
 */
export async function uploadDriveFileToExternal(
	driveFile: { id: string; url: string; name: string; type: string; isSensitive: boolean; comment?: string | null },
	account?: ExternalAccount,
): Promise<any> {
	// 自鯖のファイルをfetch
	if (typeof driveFile.url !== 'string' || !/^https?:\/\//i.test(driveFile.url)) {
		throw new Error('Invalid drive file URL');
	}
	const response = await fetch(driveFile.url, {
		credentials: 'omit',
		referrerPolicy: 'no-referrer',
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch file: ${response.status}`);
	}

	const blob = await response.blob();

	// 外部サーバーにアップロード
	return uploadFileToExternal(blob, {
		name: driveFile.name,
		isSensitive: driveFile.isSensitive,
		comment: driveFile.comment ?? undefined,
	}, account);
}

/**
 * 複数のドライブファイルを外部サーバーにアップロード
 */
export async function uploadDriveFilesToExternal(
	driveFiles: Array<{ id: string; url: string; name: string; type: string; isSensitive: boolean; comment?: string | null }>,
	account?: ExternalAccount,
): Promise<string[]> {
	const uploadedFileIds: string[] = [];

	for (const file of driveFiles) {
		const uploaded = await uploadDriveFileToExternal(file, account);
		uploadedFileIds.push(uploaded.id);
	}

	return uploadedFileIds;
}

/**
 * 外部サーバーにノートを投稿
 */
export async function postToExternal(params: {
	text?: string | null;
	cw?: string | null;
	visibility?: string;
	localOnly?: boolean;
	replyId?: string;
	renoteId?: string;
	fileIds?: string[];
	poll?: any;
}): Promise<{ createdNote: any }> {
	return callExternalApi('notes/create', {
		text: params.text,
		cw: params.cw,
		visibility: params.visibility ?? 'public',
		localOnly: params.localOnly ?? false,
		replyId: params.replyId,
		renoteId: params.renoteId,
		fileIds: params.fileIds,
		poll: params.poll,
	});
}

/**
 * 外部サーバーにリアクションを追加
 */
export async function addExternalReaction(noteId: string, reaction: string): Promise<void> {
	await callExternalApi('notes/reactions/create', {
		noteId,
		reaction,
	});
}

/**
 * 外部サーバーのリアクションを削除
 */
export async function removeExternalReaction(noteId: string): Promise<void> {
	await callExternalApi('notes/reactions/delete', {
		noteId,
	});
}

/**
 * 外部サーバーでリノート
 */
export async function renoteToExternal(noteId: string): Promise<{ createdNote: any }> {
	return callExternalApi('notes/create', {
		renoteId: noteId,
	});
}

// ===== グローバル状態: 外部TL閲覧中フラグ =====
import { ref } from 'vue';

/**
 * 現在外部TL（OHTL/OLTL）を閲覧中かどうか。
 * timeline.vue で set され、os.post() をラップする箇所で参照される。
 */
export const isViewingExternalTL = ref(false);

// ===== 外部TL用 お気に入り絵文字 =====
const EXT_FAV_EMOJIS_KEY = 'externalFavoriteEmojis';

/**
 * リアクション/絵文字文字列の妥当性チェック
 * 許可: Unicode 絵文字 (1〜32文字), :name: 形式, :name@host: 形式
 * 拒否: タグ文字, NULL, 制御文字, 過長文字列
 */
function isValidEmojiString(s: unknown): s is string {
	if (typeof s !== 'string') return false;
	if (s.length === 0 || s.length > 100) return false;
	// 制御文字・タグ・改行・引用符を含むものは拒否
	if (/[\u0000-\u001F<>"'`\\]/.test(s)) return false;
	// :name: 形式 / :name@host: 形式 / 単純な絵文字 (記号 + 修飾子)
	if (/^:[a-z0-9_+\-]+(@[a-z0-9.\-]+)?:$/i.test(s)) return true;
	// 一般的な Unicode 絵文字 (タグ・引用符を含まないこと自体で大半はカバー済み)
	return true;
}

/**
 * 外部TL用お気に入り絵文字リストを取得(後方互換: 旧 string[] / 新 EmojiEntry[])
 *
 * 戻り値は常に旧形式 string[](リアクション文字列のみ)。
 * URL情報が必要な場合は getExternalFavoriteEmojisDetailed() を使う。
 */
export function getExternalFavoriteEmojis(): string[] {
	const detailed = getExternalFavoriteEmojisDetailed();
	return detailed.map(e => e.reaction).filter(isValidEmojiString);
}

/**
 * 外部TL用お気に入り絵文字リストを保存(旧形式互換)
 *
 * 旧 string[] からの呼び出しでは host/url 情報なしで保存される。
 * 旧呼び出し側は徐々に setExternalFavoriteEmojiDetailed() に移行を推奨。
 */
export function setExternalFavoriteEmojis(emojis: string[]): void {
	const entries: ExternalEmojiEntry[] = (Array.isArray(emojis) ? emojis : [])
		.filter(isValidEmojiString)
		.slice(0, 50)
		.map(reaction => ({ reaction, host: null, url: null }));
	try {
		localStorage.setItem(EXT_FAV_EMOJIS_KEY, JSON.stringify(entries));
	} catch { /* quota error 等を無視 */ }
}

/**
 * お気に入り絵文字を追加(先頭に追加、重複は移動)。
 * host/url が判明している場合は付与して保存することで、別サーバー切替時も復元可能。
 */
export function addExternalFavoriteEmoji(emoji: string, host: string | null = null, url: string | null = null): void {
	if (!isValidEmojiString(emoji)) return;
	const list = getExternalFavoriteEmojisDetailed().filter(e => e.reaction !== emoji);
	list.unshift({ reaction: emoji, host, url });
	try {
		localStorage.setItem(EXT_FAV_EMOJIS_KEY, JSON.stringify(list.slice(0, 50)));
	} catch { /* ignore */ }
}

/**
 * お気に入り絵文字を削除
 */
export function removeExternalFavoriteEmoji(emoji: string): void {
	if (!isValidEmojiString(emoji)) return;
	const list = getExternalFavoriteEmojisDetailed().filter(e => e.reaction !== emoji);
	try {
		localStorage.setItem(EXT_FAV_EMOJIS_KEY, JSON.stringify(list));
	} catch { /* ignore */ }
}

// ===== 外部TL よく使うリアクション履歴 =====
const EXT_RECENT_REACTIONS_KEY = 'externalRecentReactions';

/**
 * よく使うリアクション履歴を取得(後方互換ラッパー、戻り値は string[])
 */
export function getExternalRecentReactions(): string[] {
	const detailed = getExternalRecentReactionsDetailed();
	return detailed.map(e => e.reaction).filter(isValidEmojiString);
}

/**
 * よく使うリアクション履歴に追加(先頭に追加、重複は移動、最大30件)
 * host/url が判明している場合は付与して保存し、再表示時のAPIリクエストを削減する。
 */
export function addExternalRecentReaction(reaction: string, host: string | null = null, url: string | null = null): void {
	if (!isValidEmojiString(reaction)) return;
	const list = getExternalRecentReactionsDetailed().filter(e => e.reaction !== reaction);
	list.unshift({ reaction, host, url, addedAt: Date.now() });
	try {
		localStorage.setItem(EXT_RECENT_REACTIONS_KEY, JSON.stringify(list.slice(0, 30)));
	} catch { /* ignore */ }
}

// ===== 構造化された履歴/お気に入りのアクセサ =====

/**
 * 外部TL履歴/お気に入りのエントリ型
 *
 * - reaction: ':name:' / ':name@host:' / Unicode絵文字いずれか
 * - host: カスタム絵文字を取得した外部サーバーのホスト名(Unicodeなら null)
 * - url: 取得時の画像URL(永続URL想定、なければ null)
 * - addedAt: 履歴のみ。お気に入りでは省略
 */
export interface ExternalEmojiEntry {
	reaction: string;
	host: string | null;
	url: string | null;
	addedAt?: number;
}

/**
 * お気に入り絵文字を構造化形式で取得(旧 string[] からの自動マイグレーション付き)
 */
export function getExternalFavoriteEmojisDetailed(): ExternalEmojiEntry[] {
	try {
		const stored = localStorage.getItem(EXT_FAV_EMOJIS_KEY);
		if (!stored) return [];
		const parsed = JSON.parse(stored);
		if (!Array.isArray(parsed)) return [];

		// 旧形式 string[] からの移行: 文字列要素を Entry に変換
		const migrated: ExternalEmojiEntry[] = parsed.map(item => {
			if (typeof item === 'string') {
				return { reaction: item, host: null, url: null };
			}
			if (item && typeof item === 'object' && typeof item.reaction === 'string') {
				return {
					reaction: item.reaction,
					host: typeof item.host === 'string' ? item.host : null,
					url: typeof item.url === 'string' ? item.url : null,
				};
			}
			return null;
		}).filter((e): e is ExternalEmojiEntry => e !== null && isValidEmojiString(e.reaction));

		return migrated;
	} catch {
		return [];
	}
}

/**
 * 履歴(最近使ったリアクション)を構造化形式で取得
 */
export function getExternalRecentReactionsDetailed(): ExternalEmojiEntry[] {
	try {
		const stored = localStorage.getItem(EXT_RECENT_REACTIONS_KEY);
		if (!stored) return [];
		const parsed = JSON.parse(stored);
		if (!Array.isArray(parsed)) return [];

		const migrated: ExternalEmojiEntry[] = parsed.map(item => {
			if (typeof item === 'string') {
				return { reaction: item, host: null, url: null };
			}
			if (item && typeof item === 'object' && typeof item.reaction === 'string') {
				return {
					reaction: item.reaction,
					host: typeof item.host === 'string' ? item.host : null,
					url: typeof item.url === 'string' ? item.url : null,
					addedAt: typeof item.addedAt === 'number' ? item.addedAt : undefined,
				};
			}
			return null;
		}).filter((e): e is ExternalEmojiEntry => e !== null && isValidEmojiString(e.reaction));

		return migrated;
	} catch {
		return [];
	}
}

// ===== ホストごとカスタム絵文字URLマップ(LRU管理、TTL付き) =====
const EXT_EMOJI_URL_MAP_KEY = 'externalEmojiUrlMap';
const EXT_EMOJI_URL_MAP_TTL = 24 * 60 * 60 * 1000; // 24時間
const EXT_EMOJI_URL_MAP_MAX_HOSTS = 10; // 最大保持ホスト数(LRU)

interface ExternalEmojiUrlMapEntry {
	fetchedAt: number;
	lastAccessedAt: number;
	emojis: Record<string, string>; // name → url
}

type ExternalEmojiUrlMap = Record<string, ExternalEmojiUrlMapEntry>;

/**
 * 全ホスト分の絵文字URLマップを読み込む
 */
function loadEmojiUrlMap(): ExternalEmojiUrlMap {
	try {
		const stored = localStorage.getItem(EXT_EMOJI_URL_MAP_KEY);
		if (!stored) return {};
		const parsed = JSON.parse(stored);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		return parsed as ExternalEmojiUrlMap;
	} catch {
		return {};
	}
}

/**
 * 全ホスト分の絵文字URLマップを保存(LRU処理含む)
 */
function saveEmojiUrlMap(map: ExternalEmojiUrlMap): void {
	// LRU: lastAccessedAt が古い順にソートし、上限を超えたら削除
	const entries = Object.entries(map);
	if (entries.length > EXT_EMOJI_URL_MAP_MAX_HOSTS) {
		entries.sort((a, b) => b[1].lastAccessedAt - a[1].lastAccessedAt);
		const kept = Object.fromEntries(entries.slice(0, EXT_EMOJI_URL_MAP_MAX_HOSTS));
		try {
			localStorage.setItem(EXT_EMOJI_URL_MAP_KEY, JSON.stringify(kept));
		} catch { /* ignore */ }
		return;
	}
	try {
		localStorage.setItem(EXT_EMOJI_URL_MAP_KEY, JSON.stringify(map));
	} catch { /* quota error 等を無視 */ }
}

/**
 * 指定ホストの絵文字URLマップを取得(TTL有効なら返す、切れていれば null)
 *
 * 取得成功時は lastAccessedAt を更新する(LRU管理用)。
 */
export function getExternalEmojiUrlMapForHost(host: string): Record<string, string> | null {
	if (!host) return null;
	const map = loadEmojiUrlMap();
	const entry = map[host];
	if (!entry) return null;
	const now = Date.now();
	if (now - entry.fetchedAt >= EXT_EMOJI_URL_MAP_TTL) {
		// TTL切れ。クリーンアップは setExternalEmojiUrlMapForHost 側に任せる
		return null;
	}
	// アクセス時刻を更新(LRU)
	entry.lastAccessedAt = now;
	map[host] = entry;
	saveEmojiUrlMap(map);
	return entry.emojis;
}

/**
 * 指定ホストの絵文字URLマップを保存
 *
 * /api/emojis 取得直後に呼ばれる想定。LRUで最大ホスト数を超えると古いものから削除。
 */
export function setExternalEmojiUrlMapForHost(host: string, emojis: Record<string, string>): void {
	if (!host || !emojis) return;
	const map = loadEmojiUrlMap();
	const now = Date.now();
	map[host] = {
		fetchedAt: now,
		lastAccessedAt: now,
		emojis,
	};
	saveEmojiUrlMap(map);
}

/**
 * 指定ホストの絵文字URLマップから単一絵文字のURLを引く(API呼ばずに)
 * 見つからなければ null
 */
export function lookupExternalEmojiUrl(host: string | null, name: string): string | null {
	if (!host || !name) return null;
	const map = getExternalEmojiUrlMapForHost(host);
	if (!map) return null;
	return map[name] ?? null;
}
