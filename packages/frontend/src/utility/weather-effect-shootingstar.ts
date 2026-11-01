/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * 旗鯖fork: 天気エフェクト(weatherEffect) — 流れ星(shootingStar)。
 *
 * 「いい夜」「おやすみ」「sleep」などの就寝の挨拶で発動する夜の演出。
 * 雪(WebGL)・雨/日差し/強風(2D Canvas)と同じ方針で、TLのDOMには触らず
 * body 直下に position:fixed の canvas を1枚置く。render/fadeIn/fadeOut/stop で扱う。
 *
 * 演出:
 *   - 画面全体にうっすら暗めの夜空のヴェールをかける(やりすぎない)
 *   - 小さな星がゆっくり瞬く(ゆらぎであって明滅・点滅ではない)
 *   - ときどき流れ星が斜めにスーッと流れ、淡い尾を引いて消える
 *
 * 【健康配慮 — 最優先・コードでハードガード】
 *   - 強い明滅・点滅・閃光は一切行わない。星の瞬きはゆっくりした明暗のみ。
 *   - 流れ星も「スッと現れてフェードして消える」緩やかな動きで、急な閃光にしない。
 *   - 夜空のヴェールは薄く、ノート本文の閲覧を阻害しない。
 *   - prefers-reduced-motion: reduce のとき動きを止める。
 *   - document.hidden 時は描画停止。
 *   - 星・流れ星の数に上限を設ける。
 */

export class ShootingStarEffect {
	// ===== 健康配慮のハードガード定数(安易に変更しないこと) =====
	private static readonly FADE_MS = 2000;            // フェード時間
	private static readonly STAR_COUNT = 70;           // 瞬く星の数
	private static readonly STAR_ALPHA = 0.7;          // 星の最大不透明度
	private static readonly VEIL_ALPHA = 0.18;         // 夜空ヴェールの濃さ(薄め)
	private static readonly MAX_SHOOTING = 7;          // 同時に流れる流れ星の上限
	private static readonly SHOOT_MIN_INTERVAL_MS = 600; // 流れ星の最短間隔
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
	private reducedMotionMql: MediaQueryList;

	private lastShootTs = 0;

	// 瞬く星
	private stars: {
		x: number; y: number; r: number; baseAlpha: number;
		phase: number; phaseSpeed: number;
	}[] = [];

	// 流れ星(短命)
	private shooting: {
		x: number; y: number; vx: number; vy: number;
		len: number; life: number; maxLife: number;
	}[] = [];

	constructor() {
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
			transition: `opacity ${ShootingStarEffect.FADE_MS}ms ease`,
		});
		const ctx = canvas.getContext('2d');
		if (ctx == null) throw new Error('Failed to get 2D context for shooting star');
		this.canvas = canvas;
		this.ctx = ctx;

		window.document.body.append(canvas);

		this.onWindowResize = () => this.resize();
		window.addEventListener('resize', this.onWindowResize);

		this.reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');

		this.resize();
		this.initStars();
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

	private rand(min: number, max: number) {
		return min + Math.random() * (max - min);
	}

	private initStars() {
		this.stars = [];
		const n = Math.min(ShootingStarEffect.STAR_COUNT, Math.round((this.widthCss * this.heightCss) / 16000));
		for (let i = 0; i < n; i++) {
			this.stars.push({
				x: this.rand(0, this.widthCss),
				y: this.rand(0, this.heightCss * 0.85), // 上寄りに散らす(夜空)
				r: this.rand(0.5, 1.8),
				baseAlpha: this.rand(0.3, 1),
				phase: this.rand(0, Math.PI * 2),
				phaseSpeed: this.rand(0.01, 0.04), // ゆっくり瞬く
			});
		}
	}

	private maybeSpawnShooting(ts: number) {
		if (this.shooting.length >= ShootingStarEffect.MAX_SHOOTING) return;
		if (ts - this.lastShootTs < ShootingStarEffect.SHOOT_MIN_INTERVAL_MS) return;
		// 確率を上げて流れ星を増やす(0.02→0.06)
		if (Math.random() > 0.06) return;
		this.lastShootTs = ts;
		// 右上〜上から左下へ斜めに流れる
		const startX = this.rand(this.widthCss * 0.3, this.widthCss * 1.05);
		const startY = this.rand(-20, this.heightCss * 0.4);
		const speed = this.rand(8, 14);
		const angle = this.rand(Math.PI * 0.62, Math.PI * 0.78); // 左下方向
		this.shooting.push({
			x: startX,
			y: startY,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			len: this.rand(100, 200),
			life: 0,
			maxLife: this.rand(55, 90),
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

		if (document.hidden) { this.lastTs = ts; return; }

		const dt = this.lastTs === 0 ? 16 : Math.min(ts - this.lastTs, 50);
		this.lastTs = ts;
		const k = dt / 16.67;
		const motion = !this.reducedMotion;

		const ctx = this.ctx;
		const w = this.widthCss;
		const h = this.heightCss;
		ctx.clearRect(0, 0, w, h);

		// ---- 夜空のヴェール(上が濃く、下へ薄く) ----
		const veil = ctx.createLinearGradient(0, 0, 0, h);
		const va = ShootingStarEffect.VEIL_ALPHA;
		veil.addColorStop(0, `rgba(20,26,54,${va})`);
		veil.addColorStop(0.6, `rgba(24,28,52,${va * 0.6})`);
		veil.addColorStop(1, 'rgba(24,28,52,0)');
		ctx.fillStyle = veil;
		ctx.fillRect(0, 0, w, h);

		// ---- 瞬く星 ----
		for (const s of this.stars) {
			if (motion) s.phase += s.phaseSpeed * k;
			// ゆっくりした明暗(0.55〜1.0倍)。点滅ではなく緩やかな瞬き。
			const twinkle = motion ? (0.78 + Math.sin(s.phase) * 0.22) : 0.85;
			const a = ShootingStarEffect.STAR_ALPHA * s.baseAlpha * twinkle;
			ctx.fillStyle = `rgba(255,250,235,${a})`;
			ctx.beginPath();
			ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
			ctx.fill();
			// 明るい星には小さなにじみ(十字の光芒)を添える
			if (s.r > 1.2) {
				ctx.strokeStyle = `rgba(255,250,235,${a * 0.4})`;
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				ctx.moveTo(s.x - s.r * 2.5, s.y); ctx.lineTo(s.x + s.r * 2.5, s.y);
				ctx.moveTo(s.x, s.y - s.r * 2.5); ctx.lineTo(s.x, s.y + s.r * 2.5);
				ctx.stroke();
			}
		}

		// ---- 流れ星 ----
		if (motion) this.maybeSpawnShooting(ts);
		ctx.lineCap = 'round';
		for (let i = this.shooting.length - 1; i >= 0; i--) {
			const sh = this.shooting[i];
			sh.life += k;
			sh.x += sh.vx * k;
			sh.y += sh.vy * k;
			const t = sh.life / sh.maxLife; // 0→1
			if (t >= 1 || sh.x < -150 || sh.y > h + 50) { this.shooting.splice(i, 1); continue; }
			// 出現〜消滅で明るさをなめらかに(急な閃光にしない): 0→ピーク→0
			const bright = Math.sin(Math.min(t, 1) * Math.PI);
			// 尾を引く(進行方向の逆へグラデの線)
			const tailX = sh.x - sh.vx * (sh.len / Math.hypot(sh.vx, sh.vy));
			const tailY = sh.y - sh.vy * (sh.len / Math.hypot(sh.vx, sh.vy));
			const grad = ctx.createLinearGradient(sh.x, sh.y, tailX, tailY);
			grad.addColorStop(0, `rgba(255,252,240,${0.85 * bright})`);
			grad.addColorStop(0.4, `rgba(200,215,255,${0.4 * bright})`);
			grad.addColorStop(1, 'rgba(200,215,255,0)');
			ctx.strokeStyle = grad;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(sh.x, sh.y);
			ctx.lineTo(tailX, tailY);
			ctx.stroke();
			// 先頭の輝き(グロー付きで大きめに)
			const headGrad = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, 6);
			headGrad.addColorStop(0, `rgba(255,255,250,${0.95 * bright})`);
			headGrad.addColorStop(0.5, `rgba(220,230,255,${0.5 * bright})`);
			headGrad.addColorStop(1, 'rgba(220,230,255,0)');
			ctx.fillStyle = headGrad;
			ctx.beginPath();
			ctx.arc(sh.x, sh.y, 6, 0, Math.PI * 2);
			ctx.fill();
			// 中心の白い芯
			ctx.fillStyle = `rgba(255,255,250,${0.95 * bright})`;
			ctx.beginPath();
			ctx.arc(sh.x, sh.y, 2.4, 0, Math.PI * 2);
			ctx.fill();
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
		window.setTimeout(() => onComplete?.(), ShootingStarEffect.FADE_MS + 50);
	}

	public stop() {
		if (this.destroyed) return;
		this.destroyed = true;
		if (this.raf) window.cancelAnimationFrame(this.raf);
		window.removeEventListener('resize', this.onWindowResize);
		this.canvas.remove();
	}
}
