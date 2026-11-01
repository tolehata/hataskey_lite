/*
 * 旗鯖fork: 地震・津波情報サービス。
 *   P2P地震情報 API(P2PQuake / 出典: 気象庁) から「発表済みの情報」を取得・配信する。
 *   - 地震情報(code 551) と 津波予報(code 552) を扱う。緊急地震速報(EEW)は扱わない。
 *   - REST 代理取得(ページ表示用・30秒キャッシュ)。
 *   - WebSocket を1本だけ常時接続し、新着を検知してユーザーへプッシュ通知(フェーズ4)。
 *     ※ 通知のためマルチプロセス構成では重複配信に注意(単一インスタンス前提)。
 */
import { Injectable, Inject, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { EarthquakeNotificationsRepository } from '@/models/_.js';
import { NotificationService } from '@/core/NotificationService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { bindThis } from '@/decorators.js';
import Logger from '@/logger.js';
import { LoggerService } from '@/core/LoggerService.js';

const P2PQUAKE_HISTORY_URL = 'https://api.p2pquake.net/v2/history';
const P2PQUAKE_WS_URL = 'wss://api.p2pquake.net/v2/ws';
const CODE_EARTHQUAKE = 551; // 発表済み地震情報
const CODE_TSUNAMI = 552;    // 津波予報
const CACHE_TTL_MS = 30 * 1000;
const MAX_LIMIT = 50;
const UA = 'Hataskey-earthquake/1.0 (+P2PQuake)';
// 旗鯖fork: 通知しきい値の許容値(P2PQuake の scale 値) — 1/2/3/4/5弱/5強/6弱/6強/7。
//   JSON Schema 型側で enum 制約を付けられないため、ここで検証する。
const ALLOWED_THRESHOLDS = new Set<number>([10, 20, 30, 40, 45, 50, 55, 60, 70]);
const DEFAULT_THRESHOLD = 40;

interface CodeCache { at: number; limit: number; data: unknown[]; }

// scale(P2PQuake) → 震度ラベル。
function scaleLabel(scale: number): string {
	switch (scale) {
		case 10: return '1'; case 20: return '2'; case 30: return '3'; case 40: return '4';
		case 45: return '5弱'; case 50: return '5強'; case 55: return '6弱'; case 60: return '6強'; case 70: return '7';
		default: return '?';
	}
}

@Injectable()
export class EarthquakeService implements OnApplicationBootstrap, OnApplicationShutdown {
	private logger: Logger;
	private caches = new Map<number, CodeCache>();
	private inflights = new Map<number, Promise<unknown[]>>();
	// 通知の重複防止(地震=earthquake.time / 津波=id)。挿入順で上限管理。
	private notified = new Set<string>();
	private notifiedOrder: string[] = [];
	private ws: WebSocket | null = null;
	private wsReconnectAttempts = 0;
	private wsTimer: ReturnType<typeof setTimeout> | null = null;
	private destroyed = false;

	constructor(
		@Inject(DI.earthquakeNotificationsRepository)
		private earthquakeNotificationsRepository: EarthquakeNotificationsRepository,

		private notificationService: NotificationService,
		private globalEventService: GlobalEventService,
		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('earthquake');
	}

	@bindThis
	public onApplicationBootstrap(): void {
		if (process.env.NODE_ENV === 'test') return;
		this.connectWs();
	}

	@bindThis
	public onApplicationShutdown(): void {
		this.destroyed = true;
		if (this.wsTimer) clearTimeout(this.wsTimer);
		try { this.ws?.close(); } catch { /* ignore */ }
	}

	//#region REST(ページ表示用)
	@bindThis
	public getRecent(limit = 20): Promise<unknown[]> {
		return this.getRecentByCode(CODE_EARTHQUAKE, limit);
	}

	@bindThis
	public getRecentTsunami(limit = 20): Promise<unknown[]> {
		return this.getRecentByCode(CODE_TSUNAMI, limit);
	}

	@bindThis
	private async getRecentByCode(code: number, limit: number): Promise<unknown[]> {
		const lim = Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
		const now = Date.now();
		const cache = this.caches.get(code);
		if (cache != null && (now - cache.at) < CACHE_TTL_MS && cache.limit >= lim) {
			return cache.data.slice(0, lim);
		}
		const existing = this.inflights.get(code);
		if (existing != null) return (await existing).slice(0, lim);

		const p = this.fetchFromP2PQuake(code, Math.max(lim, 20));
		this.inflights.set(code, p);
		try {
			const data = await p;
			this.caches.set(code, { at: Date.now(), limit: Math.max(lim, 20), data });
			return data.slice(0, lim);
		} catch (err) {
			this.logger.warn(`failed to fetch P2PQuake (code ${code}): ` + String(err));
			const stale = this.caches.get(code);
			return stale != null ? stale.data.slice(0, lim) : [];
		} finally {
			this.inflights.delete(code);
		}
	}

	@bindThis
	private async fetchFromP2PQuake(code: number, limit: number): Promise<unknown[]> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 8000);
		try {
			const res = await fetch(`${P2PQUAKE_HISTORY_URL}?codes=${code}&limit=${limit}`, {
				method: 'GET',
				headers: { 'Accept': 'application/json', 'User-Agent': UA },
				signal: controller.signal,
			});
			if (!res.ok) throw new Error(`P2PQuake responded ${res.status}`);
			const json = await res.json();
			return Array.isArray(json) ? json : [];
		} finally {
			clearTimeout(timer);
		}
	}
	//#endregion

	//#region 通知設定(ユーザーごと)
	@bindThis
	public async getSettings(userId: string): Promise<{ enabled: boolean; mode: string; threshold: number; pref: string | null }> {
		const row = await this.earthquakeNotificationsRepository.findOneBy({ userId });
		return {
			enabled: row?.enabled ?? false,
			mode: row?.mode ?? 'intensity',
			threshold: row?.threshold ?? 40,
			pref: row?.pref ?? null,
		};
	}

	@bindThis
	public async updateSettings(userId: string, patch: { enabled?: boolean; mode?: string; threshold?: number; pref?: string | null }): Promise<void> {
		// 旗鯖fork: paramDef 側で enum を付けられないため、ここで許容値外を弾く。
		if (patch.threshold !== undefined && !ALLOWED_THRESHOLDS.has(patch.threshold)) {
			throw new Error(`invalid threshold: ${patch.threshold}`);
		}
		const cur = await this.earthquakeNotificationsRepository.findOneBy({ userId });
		const next = {
			userId,
			enabled: patch.enabled ?? cur?.enabled ?? false,
			mode: patch.mode ?? cur?.mode ?? 'intensity',
			threshold: patch.threshold ?? cur?.threshold ?? DEFAULT_THRESHOLD,
			// 都道府県は「通知が有効」かつ「居住地モード」のときだけ保存する(プライバシー)。
			//   通知OFF・別モードに変えた場合は必ず null にしてサーバーから削除する。
			pref: null as string | null,
		};
		if (next.enabled && next.mode === 'pref') next.pref = patch.pref ?? cur?.pref ?? null;
		if (cur) await this.earthquakeNotificationsRepository.update({ userId }, next);
		else await this.earthquakeNotificationsRepository.insert(next);
	}
	//#endregion

	//#region WebSocket購読＋通知配信
	@bindThis
	private connectWs(): void {
		if (this.destroyed) return;
		try {
			const ws = new WebSocket(P2PQUAKE_WS_URL);
			this.ws = ws;
			ws.addEventListener('open', () => {
				this.wsReconnectAttempts = 0;
				this.logger.info('P2PQuake WebSocket connected');
			});
			ws.addEventListener('message', (ev: MessageEvent) => {
				this.onWsMessage(typeof ev.data === 'string' ? ev.data : '');
			});
			ws.addEventListener('error', () => { /* close で再接続 */ });
			ws.addEventListener('close', () => {
				this.ws = null;
				this.scheduleReconnect();
			});
		} catch (err) {
			this.logger.warn('WebSocket connect failed: ' + String(err));
			this.scheduleReconnect();
		}
	}

	@bindThis
	private scheduleReconnect(): void {
		if (this.destroyed) return;
		this.wsReconnectAttempts++;
		// 指数バックオフ(最大60秒)。
		const delay = Math.min(60000, 1000 * Math.pow(2, Math.min(6, this.wsReconnectAttempts)));
		if (this.wsTimer) clearTimeout(this.wsTimer);
		this.wsTimer = setTimeout(() => this.connectWs(), delay);
	}

	@bindThis
	private onWsMessage(raw: string): void {
		if (!raw) return;
		// 旗鯖fork: P2PQuake は 551/552 以外(555: エリアピア / 556: EEW / 561: 緊急地震速報設定 等)も流す。
		//   JSON.parse は割と重いので、生文字列で「"code":551」または「"code":552」(空白挿入版も含む)を
		//   含むかを先に検査し、含まなければ即 return する。
		//   - 誤検知方向の安全策: 文字列値中に "551"/"552" が偶然含まれても、後段の data?.code チェックで弾く。
		//   - 取りこぼし方向の安全策: 空白あり版もカバー。P2PQuake が将来 pretty-print に変わったら本最適化は無効化する。
		if (
			raw.indexOf('"code":551') < 0 && raw.indexOf('"code": 551') < 0 &&
			raw.indexOf('"code":552') < 0 && raw.indexOf('"code": 552') < 0
		) {
			return;
		}
		let data: any;
		try { data = JSON.parse(raw); } catch { return; }
		if (data?.code !== CODE_EARTHQUAKE && data?.code !== CODE_TSUNAMI) return;

		// REST キャッシュを無効化(ポーリング中のクライアントも次回取得で最新になる)。
		this.caches.delete(data.code);
		// 全クライアントへリアルタイム配信(開いている地震ページ/カラムが即座に更新される)。
		this.globalEventService.publishBroadcastStream('earthquakeEvent', { code: data.code, item: data });

		if (data.code === CODE_EARTHQUAKE) this.dispatchEarthquake(data).catch(() => {});
		else this.dispatchTsunami(data).catch(() => {});
	}

	private markNotified(key: string): boolean {
		if (this.notified.has(key)) return false;
		this.notified.add(key);
		this.notifiedOrder.push(key);
		if (this.notifiedOrder.length > 500) {
			const old = this.notifiedOrder.shift();
			if (old) this.notified.delete(old);
		}
		return true;
	}

	@bindThis
	private async dispatchEarthquake(q: any): Promise<void> {
		// 注意: 同じ地震の第1報(震度速報)では maxScale が未確定(-1)で来ることがあり、
		//   後続報(各地の震度等)で確定値に更新される。重複防止キーを「最初に観測した時点」で
		//   立ててしまうと、第1報がしきい値未満や震度不明だった場合に、後続報の確定値で
		//   しきい値を超えても通知が発火しなくなる。
		// → 重複防止は「ユーザーごとに通知条件を満たした時点」で立てる(同一地震×同一ユーザーで1回)。
		const maxScale: number = q.earthquake?.maxScale ?? -1;
		if (maxScale < 10) return; // 震度不明はスキップ(キーを立てない)
		const hypo: string = q.earthquake?.hypocenter?.name ?? '';

		// 都道府県ごとの最大震度。
		const prefMax = new Map<string, number>();
		for (const p of (q.points ?? [])) {
			if (typeof p.scale !== 'number' || p.scale < 10 || !p.pref) continue;
			if ((prefMax.get(p.pref) ?? -1) < p.scale) prefMax.set(p.pref, p.scale);
		}

		const baseKey = 'eq:' + (q.earthquake?.time ?? q.id ?? '');
		const settings = await this.earthquakeNotificationsRepository.findBy({ enabled: true });
		for (const s of settings) {
			let body: string | null = null;
			if (s.mode === 'intensity') {
				if (maxScale >= s.threshold) {
					body = `地震がありました（最大震度${scaleLabel(maxScale)}${hypo ? '・' + hypo : ''}）`;
				}
			} else if (s.mode === 'pref' && s.pref) {
				const ps = prefMax.get(s.pref);
				if (ps != null && ps >= 10) {
					body = `お住まいの${s.pref}で地震がありました（震度${scaleLabel(ps)}）`;
				}
			}
			if (!body) continue;
			// 同一地震 × 同一ユーザーで1回だけ(後続報の確定値で条件達成した場合も通知できる)。
			if (!this.markNotified(baseKey + ':' + s.userId)) continue;
			this.notify(s.userId, body);
		}
	}

	@bindThis
	private async dispatchTsunami(t: any): Promise<void> {
		if (t.cancelled === true) {
			const key = 'ts-cancel:' + (t.id ?? t.time ?? 'unknown');
			if (!this.markNotified(key)) return;
			const settings = await this.earthquakeNotificationsRepository.findBy({ enabled: true });
			for (const s of settings) {
				// 警報等の発表だけでなく、気象庁が解除した事実も同じ経路で伝える。
				this.notify(s.userId, '気象庁から津波警報・注意報の解除が発表されました。');
			}
			return;
		}
		if (!Array.isArray(t.areas) || t.areas.length === 0) return;
		const key = 'ts:' + (t.id ?? t.time ?? '');
		if (!this.markNotified(key)) return;

		// 通知文言は気象庁の発表区分(MajorWarning/Warning/Watch)をそのまま伝達する
		//   (気象業務法23条の独自警報化リスク回避のため、独自の避難指示などは付けない)。
		const order: Record<string, number> = { MajorWarning: 3, Warning: 2, Watch: 1 };
		let maxGrade = 'Watch'; let mn = 0;
		for (const a of (t.areas ?? [])) {
			const n = order[a.grade] ?? 0;
			if (n > mn) { mn = n; maxGrade = a.grade; }
		}
		const label = maxGrade === 'MajorWarning' ? '大津波警報' : (maxGrade === 'Warning' ? '津波警報' : '津波注意報');
		const body = `気象庁から${label}が発表されました。`;

		// 津波は重要情報のため、有効なユーザー全員に通知。
		const settings = await this.earthquakeNotificationsRepository.findBy({ enabled: true });
		for (const s of settings) {
			this.notify(s.userId, body);
		}
	}

	@bindThis
	private notify(userId: string, body: string): void {
		this.notificationService.createNotification(userId, 'earthquake', {
			// OS通知だけを見ても「旗鯖独自の予測」ではなく、気象庁発表済み情報の
			// 伝達だと分かるよう出典を明示する（P2P地震情報 API 経由）。
			customBody: `${body}\n出典: 気象庁 / P2P地震情報`,
			customHeader: '地震・津波情報（気象庁発表）',
			customIcon: null,
			customLink: '/earthquake',
		});
	}
	//#endregion
}
