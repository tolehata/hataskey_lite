/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * 旗鯖fork: 天気エフェクト(weatherEffect) — 雨。
 *
 * 雪(本家由来の WeatherEffect, WebGL)とは別に、雨は 2D Canvas で自前実装する。
 * 理由: 「地面でのバウンド」「窓を伝う雫の垂れ下がり」は 2D Canvas の方が素直に書ける。
 *
 * 雪と同じ方針で、TLのDOMには一切触らず body 直下に position:fixed の canvas を1枚置く。
 * マネージャからは雪と同じ render() / fadeIn() / fadeOut() / stop() で扱えるようにする。
 *
 * 【健康配慮 — 最優先・コードでハードガード】
 *   - 強い明滅・点滅・コントラストの急変は行わない(雷は実装しない)。
 *   - 地面の飛沫は低頻度・低コントラスト・小サイズに抑える(チカチカさせない)。
 *   - 窓の雫はゆっくりした動きのみ(明滅とは無縁)。
 *   - prefers-reduced-motion: reduce のとき描画しない。
 *   - document.hidden(タブ非アクティブ)時は描画停止。
 *   - 透過度・粒子数に上限を設ける。
 */

export class RainEffect {
	// ===== 健康配慮のハードガード定数(安易に変更しないこと) =====
	private static readonly MAX_DROPS = 500;        // 降る雨の粒の上限(土砂降り対応で引き上げ)
	private static readonly MAX_TRICKLES = 14;      // 窓の雫の同時上限
	private static readonly MAX_SPLASHES = 40;      // 飛沫の同時上限
	private static readonly FADE_MS = 2000;         // フェード時間(滑らかに)
	private static readonly RAIN_ALPHA = 0.7;       // 降る雨の最大不透明度
	private static readonly TRICKLE_ALPHA = 0.22;   // 窓の雫の最大不透明度
	private static readonly SPLASH_ALPHA = 0.18;    // 飛沫の最大不透明度(最も控えめ)
	// =========================================================

	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private raf = 0;
	private destroyed = false;
	private lastTs = 0;

	private widthCss = 0;
	private heightCss = 0;
	private dpr = 1;

	private onWindowResize: () => void;

	// 旗鯖fork: マウスで雨を弾くための座標(未取得時は-1)。
	private mouseX = -1;
	private mouseY = -1;
	private onMouseMove: (e: MouseEvent) => void;

	// 旗鯖fork: 水が当たる/伝うUI要素の矩形(複数)。
	// PCのノートボタン と モバイル下部メニューの両方を対象にする。
	private targetRects: DOMRect[] = [];
	private rectTimer = 0;
	// ボタン上を伝う雫
	private btnTrickles: { x: number; y: number; speed: number; r: number; alpha: number; wobble: number; bottomY: number }[] = [];
	private reducedMotionMql: MediaQueryList;

	// 降る雨
	private drops: {
		x: number; y: number; len: number; speed: number; alpha: number;
		drift: number;     // 横方向の基本速度(粒ごとに左右ランダム = 風向きの個体差)
		swayPhase: number; // 揺らぎの位相
		swaySpeed: number; // 揺らぎの速さ
		swayAmp: number;   // 揺らぎの強さ(横方向の振れ幅)
		width: number;     // 線の太さ(手前=太い/奥=細い。奥行き表現)
	}[] = [];

	// 地面/着地点の飛沫(短命)
	private splashes: {
		x: number; y: number; vx: number; vy: number; life: number; maxLife: number;
	}[] = [];

	// 窓を伝う雫(ゆっくり垂れ下がる)
	private trickles: {
		x: number; y: number; r: number; speed: number; wobble: number;
		alpha: number; trail: number; // trail = 軌跡の濃さ
	}[] = [];

	private heavy: boolean;

	constructor(options: { heavy?: boolean } = {}) {
		this.heavy = options.heavy === true;
		const canvas = window.document.createElement('canvas');
		Object.assign(canvas.style, {
			position: 'fixed',
			top: '0',
			left: '0',
			width: '100vw',
			height: '100vh',
			background: 'transparent',
			'pointer-events': 'none',
			'z-index': '2147483647',
			opacity: '0',
			transition: `opacity ${RainEffect.FADE_MS}ms ease`,
		});
		const ctx = canvas.getContext('2d');
		if (ctx == null) throw new Error('Failed to get 2D context for rain');
		this.canvas = canvas;
		this.ctx = ctx;

		window.document.body.append(canvas);

		this.onWindowResize = () => this.resize();
		window.addEventListener('resize', this.onWindowResize);

		// 旗鯖fork: マウス座標を追跡(雨を弾くため)。
		this.onMouseMove = (e: MouseEvent) => {
			this.mouseX = e.clientX;
			this.mouseY = e.clientY;
		};
		window.addEventListener('mousemove', this.onMouseMove, { passive: true });

		// 旗鯖fork: ノートボタンの位置を定期取得(スクロール/レイアウト変化に追従)。
		// 重い getBoundingClientRect を毎フレームやらず、500msごとに更新する。
		this.updateNoteBtnRect();
		this.rectTimer = window.setInterval(() => this.updateNoteBtnRect(), 500);

		this.reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');

		this.resize();
		this.initDrops();
	}

	private get reducedMotion(): boolean {
		return this.reducedMotionMql.matches;
	}

	private resize() {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		this.widthCss = vw;
		this.heightCss = vh;
		this.dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.canvas.width = Math.max(1, Math.round(vw * this.dpr));
		this.canvas.height = Math.max(1, Math.round(vh * this.dpr));
		this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
	}

	// 旗鯖fork: 水が当たる対象UI要素の矩形を取得する(複数)。
	//  - PCのノートボタン: [data-cy-open-post-form]
	//  - モバイル下部メニュー: [data-htk-weather-footer]
	// 画面に見えているものだけを対象にする。
	private updateNoteBtnRect() {
		const rects: DOMRect[] = [];
		try {
			const selectors = ['[data-cy-open-post-form]', '[data-htk-weather-footer]', '[data-htk-weather-postform]'];
			for (const sel of selectors) {
				// 同じUIに複数のノートボタンが存在しうる(サイド/上部/折りたたみ等)ので全部拾う。
				const els = Array.from(window.document.querySelectorAll(sel));
				for (const el of els) {
					const r = el.getBoundingClientRect();
					// 画面外・サイズ0は除外(=今表示されているものだけ対象)
					if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > this.heightCss || r.right < 0 || r.left > this.widthCss) continue;
					rects.push(r);
				}
			}
		} catch {
			// 取得失敗時は空のまま
		}
		this.targetRects = rects;
	}

	private rand(min: number, max: number) {
		return min + Math.random() * (max - min);
	}

	private initDrops() {
		this.drops = [];
		// 土砂降りは密度を上げる。ただしスマホ(狭い画面)では多すぎるので控えめにする。
		const isNarrow = this.widthCss < 700;
		const divisor = this.heavy
			? (isNarrow ? 3.0 : 1.8)  // 大雨: 広い画面は密、スマホは控えめ
			: (isNarrow ? 4.0 : 3.0); // 通常雨もスマホは少し控えめ
		const n = Math.min(RainEffect.MAX_DROPS, Math.round(this.widthCss / divisor));
		for (let i = 0; i < n; i++) {
			this.drops.push(this.spawnDrop(true));
		}
	}

	private spawnDrop(initial: boolean) {
		const h = this.heavy;
		// 奥行き: 0=最奥(細く遅く薄い) 〜 1=最手前(太く速く濃い)。
		// これにより雨に立体感(レイヤー感)が出て「雨らしく」なる。
		const depth = Math.random();
		const lenBase = h ? this.rand(22, 44) : this.rand(14, 30);
		return {
			x: this.rand(0, this.widthCss),
			y: initial ? this.rand(0, this.heightCss) : this.rand(-this.heightCss * 0.3, 0),
			// 手前ほど長い
			len: lenBase * (0.6 + depth * 0.7),
			// 手前ほど速い
			speed: (h ? this.rand(18, 28) : this.rand(11, 18)) * (0.55 + depth * 0.6),
			// 手前ほど濃い。奥もうっすら見える程度は確保。
			alpha: (0.45 + depth * 0.55) * this.rand(0.8, 1),
			// 横方向の基本速度。土砂降りは風が強く一方向に流れやすい(右下に強く傾く)。
			drift: h ? this.rand(-2.6, -0.6) : this.rand(-1.4, 1.4),
			// 落下中の揺らぎ(奥の粒ほどゆらゆらしやすい)
			swayPhase: this.rand(0, Math.PI * 2),
			swaySpeed: this.rand(0.04, 0.1),
			swayAmp: (h ? this.rand(0.1, 0.4) : this.rand(0.2, 0.8)) * (1.3 - depth * 0.6),
			// 手前ほど太い。最小でも見える太さを確保(細すぎ防止)。
			width: 1.3 + depth * (h ? 1.9 : 1.6),
		};
	}

	private spawnSplash(x: number) {
		if (this.splashes.length >= RainEffect.MAX_SPLASHES) return;
		// 着地点から左右に小さく跳ねる飛沫を2〜3個
		const count = Math.floor(this.rand(2, 4));
		for (let i = 0; i < count; i++) {
			this.splashes.push({
				x,
				y: this.heightCss - this.rand(0, 2),
				vx: this.rand(-1.2, 1.2),
				vy: this.rand(-2.5, -1),
				life: 0,
				maxLife: this.rand(12, 22),
			});
		}
	}

	// 旗鯖fork: ノートボタンの上面に当たった雨を、ボタン上で伝う雫として生成。
	private spawnBtnTrickle(x: number, btn: DOMRect) {
		if (this.btnTrickles.length >= 24) return;
		this.btnTrickles.push({
			x,
			y: btn.top,
			speed: this.rand(0.2, 0.6),
			r: this.rand(1.2, 2.6),
			alpha: this.rand(0.5, 1),
			wobble: this.rand(-0.2, 0.2),
			bottomY: btn.bottom, // この雫が消える位置(対象要素の下端)
		});
	}

	private maybeSpawnTrickle() {
		if (this.trickles.length >= RainEffect.MAX_TRICKLES) return;
		// 低確率で窓に新しい雫が付着する
		if (Math.random() > 0.012) return;
		this.trickles.push({
			x: this.rand(this.widthCss * 0.05, this.widthCss * 0.95),
			y: this.rand(0, this.heightCss * 0.4),
			r: this.rand(1.5, 3.5),
			speed: 0,
			wobble: this.rand(-0.3, 0.3),
			alpha: this.rand(0.5, 1),
			trail: this.rand(0.3, 0.7),
		});
	}

	public render() {
		this.lastTs = 0;
		if (this.raf) window.cancelAnimationFrame(this.raf);
		this.raf = window.requestAnimationFrame(this.update);
		return this;
	}

	private update = (ts: number) => {
		if (this.destroyed) return;
		this.raf = window.requestAnimationFrame(this.update);

		// タブ非アクティブ時は描画しない
		if (document.hidden) { this.lastTs = ts; return; }
		// reduced-motion 時は静止(描画しない=何も動かない)
		if (this.reducedMotion) {
			this.ctx.clearRect(0, 0, this.widthCss, this.heightCss);
			this.lastTs = ts;
			return;
		}

		const dt = this.lastTs === 0 ? 16 : Math.min(ts - this.lastTs, 50);
		this.lastTs = ts;
		const k = dt / 16.67; // 60fps正規化

		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.widthCss, this.heightCss);

		// ---- 降る雨 ----
		ctx.lineCap = 'round';
		const targets = this.targetRects;
		for (const d of this.drops) {
			// この粒の今フレームの横移動量 = 風向き(drift) + 揺らぎ(sin)
			d.swayPhase += d.swaySpeed * k;
			let horiz = (d.drift + Math.sin(d.swayPhase) * d.swayAmp) * k;

			// 旗鯖fork: マウスで雨を弾く。ポインタ近くの粒を外向きに押しのける。
			if (this.mouseX >= 0) {
				const dx = d.x - this.mouseX;
				const dy = d.y - this.mouseY;
				const distSq = dx * dx + dy * dy;
				const radius = 70;
				if (distSq < radius * radius) {
					const dlen = Math.sqrt(distSq) || 1;
					const force = (1 - dlen / radius) * 6;
					horiz += (dx / dlen) * force * k;
					d.y += (dy / dlen) * force * k * 0.5;
				}
			}

			// 線(奥行きに応じた太さ・濃さ)
			ctx.lineWidth = d.width;
			ctx.strokeStyle = `rgba(174,194,224,${RainEffect.RAIN_ALPHA * d.alpha})`;
			ctx.beginPath();
			ctx.moveTo(d.x, d.y);
			ctx.lineTo(d.x - horiz * 3, d.y - d.len);
			ctx.stroke();

			// 旗鯖fork: 先端(下端)に水滴の丸みを足して「雨粒」感を出す。
			// 手前の粒(太い)ほどはっきり、奥はほぼ見えない。
			if (d.width > 1.5) {
				ctx.fillStyle = `rgba(196,212,236,${RainEffect.RAIN_ALPHA * d.alpha * 0.9})`;
				ctx.beginPath();
				ctx.arc(d.x, d.y, d.width * 0.7, 0, Math.PI * 2);
				ctx.fill();
			}

			const prevY = d.y;
			d.y += d.speed * k;
			d.x += horiz;
			// 横に流れすぎたら反対側へ回り込ませる(画面外に溜まらないように)
			if (d.x < -20) d.x = this.widthCss + 20;
			if (d.x > this.widthCss + 20) d.x = -20;

			// 旗鯖fork: 対象UI要素(ノートボタン/モバイルフッター)の上面に当たったら水を伝わせる。
			// 高速で落下する雨粒が薄い帯をすり抜けないよう、「移動前→移動後でボタン上面(top)を
			// またいだか」で判定する。横はボタンの幅内であればOK。
			let landed = false;
			for (const rect of targets) {
				if (d.x >= rect.left && d.x <= rect.right &&
					prevY <= rect.bottom && d.y >= rect.top && prevY < d.y) {
					// ボタンの上面付近に水を落とす(実際の着地点はtop)
					this.spawnBtnTrickle(d.x, rect);
					Object.assign(d, this.spawnDrop(false));
					landed = true;
					break;
				}
			}
			if (landed) continue;

			if (d.y > this.heightCss) {
				// 地面で跳ねる
				this.spawnSplash(d.x);
				Object.assign(d, this.spawnDrop(false));
			}
		}

		// ---- 地面の飛沫 ----
		for (let i = this.splashes.length - 1; i >= 0; i--) {
			const s = this.splashes[i];
			s.life += k;
			s.x += s.vx * k;
			s.y += s.vy * k;
			s.vy += 0.18 * k; // 重力で落ちる
			const t = 1 - s.life / s.maxLife;
			if (t <= 0) { this.splashes.splice(i, 1); continue; }
			ctx.fillStyle = `rgba(174,194,224,${RainEffect.SPLASH_ALPHA * t})`;
			ctx.beginPath();
			ctx.arc(s.x, s.y, 1.1, 0, Math.PI * 2);
			ctx.fill();
		}

		// ---- 窓を伝う雫 ----
		this.maybeSpawnTrickle();
		for (let i = this.trickles.length - 1; i >= 0; i--) {
			const tr = this.trickles[i];
			// 雫は溜まってから滑り落ちる: 速度が遅いうちは微増、閾値を超えると加速
			tr.speed += this.rand(0, 0.05) * k;
			// たまに一気に滑り出す
			if (Math.random() < 0.01) tr.speed += this.rand(0.5, 1.5);
			tr.speed = Math.min(tr.speed, 4.5);
			tr.y += tr.speed * k;
			tr.x += tr.wobble * tr.speed * 0.15 * k; // 滑りながら少し横に揺れる

			// 軌跡(細い筋)を残す
			ctx.strokeStyle = `rgba(174,194,224,${RainEffect.TRICKLE_ALPHA * tr.alpha * tr.trail * 0.5})`;
			ctx.lineWidth = tr.r * 0.5;
			ctx.beginPath();
			ctx.moveTo(tr.x, tr.y);
			ctx.lineTo(tr.x - tr.wobble * tr.speed * 0.15 * k, tr.y - tr.speed * k - 2);
			ctx.stroke();

			// 雫本体
			ctx.fillStyle = `rgba(190,208,232,${RainEffect.TRICKLE_ALPHA * tr.alpha})`;
			ctx.beginPath();
			ctx.ellipse(tr.x, tr.y, tr.r * 0.8, tr.r * 1.15, 0, 0, Math.PI * 2);
			ctx.fill();

			if (tr.y > this.heightCss + 5) {
				this.trickles.splice(i, 1);
			}
		}

		// ---- 対象UI要素(ノートボタン/モバイルフッター)を伝う雫 ----
		if (targets.length > 0) {
			for (let i = this.btnTrickles.length - 1; i >= 0; i--) {
				const bt = this.btnTrickles[i];
				// 重力でゆっくり加速しながら上面〜下へ伝う
				bt.speed += this.rand(0, 0.04) * k;
				if (Math.random() < 0.02) bt.speed += this.rand(0.3, 0.8); // たまに滑り出す
				bt.speed = Math.min(bt.speed, 3.5);
				bt.y += bt.speed * k;
				bt.x += bt.wobble * bt.speed * 0.2 * k;

				// 軌跡(細い筋)。背景に埋もれないよう彩度を落とし濃いめに。
				ctx.strokeStyle = `rgba(120,135,150,${Math.min(0.55, bt.alpha * 0.5)})`;
				ctx.lineWidth = bt.r * 0.5;
				ctx.beginPath();
				ctx.moveTo(bt.x, bt.y);
				ctx.lineTo(bt.x, bt.y - bt.speed * k - 2);
				ctx.stroke();

				// 雫本体。背景色に埋もれないよう彩度を落とし(グレー寄り)、濃いめに描く。
				ctx.fillStyle = `rgba(110,125,140,${Math.min(0.7, bt.alpha * 0.7)})`;
				ctx.beginPath();
				ctx.ellipse(bt.x, bt.y, bt.r * 0.8, bt.r * 1.2, 0, 0, Math.PI * 2);
				ctx.fill();
				// 小さなハイライト(水滴の艶)。これで背景が明るくても暗くても水滴と分かる。
				ctx.fillStyle = `rgba(245,248,252,${Math.min(0.6, bt.alpha * 0.6)})`;
				ctx.beginPath();
				ctx.arc(bt.x - bt.r * 0.3, bt.y - bt.r * 0.4, bt.r * 0.3, 0, Math.PI * 2);
				ctx.fill();

				// その雫の対象要素の下端を少し過ぎたら消す
				if (bt.y > bt.bottomY + 8) {
					this.btnTrickles.splice(i, 1);
				}
			}
		} else {
			// 対象が見つからない時は溜まった雫を破棄
			if (this.btnTrickles.length > 0) this.btnTrickles.length = 0;
		}
	};

	public fadeIn() {
		if (this.destroyed) return;
		window.requestAnimationFrame(() => {
			if (this.destroyed) return;
			this.canvas.style.opacity = '1';
		});
	}

	public fadeOut(onComplete?: () => void) {
		if (this.destroyed) { onComplete?.(); return; }
		this.canvas.style.opacity = '0';
		window.setTimeout(() => onComplete?.(), RainEffect.FADE_MS + 50);
	}

	public stop() {
		if (this.destroyed) return;
		this.destroyed = true;
		if (this.raf) window.cancelAnimationFrame(this.raf);
		if (this.rectTimer) window.clearInterval(this.rectTimer);
		window.removeEventListener('resize', this.onWindowResize);
		window.removeEventListener('mousemove', this.onMouseMove);
		this.canvas.remove();
	}
}
