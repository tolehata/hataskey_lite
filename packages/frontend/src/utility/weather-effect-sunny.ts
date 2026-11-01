/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * 旗鯖fork: 天気エフェクト(weatherEffect) — 日差し(sunny)。
 *
 * 雪(WebGL)・雨(2D Canvas)と同じ方針で、TLのDOMには触らず body 直下に
 * position:fixed の canvas を1枚置く。マネージャからは render/fadeIn/fadeOut/stop で扱う。
 *
 * 「降る」演出ではなく「光が射す」演出:
 *   - 画面の隅から差し込む暖色のレンズフレア(放射状グラデ)
 *   - ゆっくり伸び縮みする淡い光芒(光のすじ)
 *   - ふわふわ漂う小さな光の粒(レンズゴースト/ダスト)
 *
 * 【健康配慮 — 最優先・コードでハードガード】
 *   - 明滅・点滅・コントラストの急変は絶対に行わない。
 *   - 脈動は超低速・低振幅のみ(明滅と呼べない緩やかさ)。
 *   - prefers-reduced-motion: reduce のとき動きを止める(静止した淡い光のみ or 何も出さない)。
 *   - document.hidden 時は描画停止。
 *   - 透過度は低く抑える。
 */

export class SunnyEffect {
	// ===== 健康配慮のハードガード定数(安易に変更しないこと) =====
	private static readonly FADE_MS = 2000;          // フェード時間
	private static readonly GLOW_ALPHA = 0.62;       // レンズフレア中心の最大不透明度
	private static readonly RAY_ALPHA = 0.38;        // 光芒の最大不透明度
	private static readonly DUST_ALPHA = 0.72;       // 光の粒の最大不透明度
	private static readonly DUST_COUNT = 44;         // 漂う光の粒の数
	private static readonly PULSE_PERIOD_MS = 9000;  // 脈動の周期(約9秒 = 明滅とは無縁の緩やかさ)
	private static readonly PULSE_AMP = 0.12;        // 脈動の振幅(±12%のみ。急変させない)
	private static readonly RAY_COUNT = 7;           // 光芒(すじ)の本数
	private static readonly GHOST_COUNT = 5;         // レンズゴースト(対角線上に並ぶ光の輪)の数
	// =========================================================

	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private raf = 0;
	private destroyed = false;
	private lastTs = 0;
	private elapsed = 0;

	private widthCss = 0;
	private heightCss = 0;
	private dpr = 1;

	private onWindowResize: () => void;
	private reducedMotionMql: MediaQueryList;

	// 旗鯖fork: マウス座標(ポインタの影を落とすため)。未取得時は画面中央。
	private mouseX = -1;
	private mouseY = -1;
	private onMouseMove: (e: MouseEvent) => void;
	// 旗鯖fork: マウス影は canvas ではなく body直下のdiv要素で実装する。
	// (canvasに描くと clearRect で消える/薄い/スタッキングの影響を受ける等で安定しないため)
	private shadowEl: HTMLDivElement;

	// 漂う光の粒
	private dust: {
		x: number; y: number; r: number; vx: number; vy: number;
		phase: number; phaseSpeed: number; alpha: number;
	}[] = [];

	// 光芒(すじ)の基準角度
	private rays: { angle: number; width: number; lenScale: number }[] = [];

	// レンズゴースト(光源から画面中心を通る対角線上に並ぶ光の輪)
	private ghosts: { t: number; r: number; alpha: number; hue: 'warm' | 'cool' }[] = [];

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
			transition: `opacity ${SunnyEffect.FADE_MS}ms ease`,
		});
		const ctx = canvas.getContext('2d');
		if (ctx == null) throw new Error('Failed to get 2D context for sunny');
		this.canvas = canvas;
		this.ctx = ctx;

		window.document.body.append(canvas);

		// 旗鯖fork: マウス影用のdivを作成(body直下・canvasより少し手前)。
		// 楕円のグラデ背景＋blurで、柔らかい影をマウスに追従させる。
		const shadowEl = window.document.createElement('div');
		Object.assign(shadowEl.style, {
			position: 'fixed',
			left: '0',
			top: '0',
			width: '64px',
			height: '26px',
			// 左端(=ポインタ側)が濃く、右へ伸びて透明になる楕円グラデ
			background: 'radial-gradient(ellipse 70% 50% at 8% 50%, rgba(40,34,24,0.45), rgba(40,34,24,0.24) 40%, rgba(40,34,24,0) 72%)',
			'pointer-events': 'none',
			'z-index': '2147483647',
			filter: 'blur(3px)',
			opacity: '0',
			transition: 'opacity 150ms ease, filter 150ms ease',
			'transform-origin': '0% 50%',
			'will-change': 'transform, left, top',
		});
		this.shadowEl = shadowEl;
		window.document.body.append(shadowEl);

		this.onWindowResize = () => this.resize();
		window.addEventListener('resize', this.onWindowResize);

		// 旗鯖fork: マウス座標を追跡し、影の位置・向きを更新する。
		this.onMouseMove = (e: MouseEvent) => {
			this.mouseX = e.clientX;
			this.mouseY = e.clientY;
			this.updateShadow();
		};
		window.addEventListener('mousemove', this.onMouseMove, { passive: true });

		this.reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');

		this.resize();
		this.initElements();
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

	private initElements() {
		// 漂う光の粒
		this.dust = [];
		for (let i = 0; i < SunnyEffect.DUST_COUNT; i++) {
			this.dust.push({
				x: this.rand(0, this.widthCss),
				y: this.rand(0, this.heightCss),
				r: this.rand(0.8, 2.6),
				vx: this.rand(-0.15, 0.15),
				vy: this.rand(-0.2, -0.05), // ふわっと上に漂う
				phase: this.rand(0, Math.PI * 2),
				phaseSpeed: this.rand(0.005, 0.02),
				alpha: this.rand(0.3, 1),
			});
		}
		// 光芒(光源=右上の隅から放射状に伸びるすじ)
		this.rays = [];
		for (let i = 0; i < SunnyEffect.RAY_COUNT; i++) {
			this.rays.push({
				angle: this.rand(Math.PI * 0.5, Math.PI * 0.92), // 画面外右上の光源から下〜左下へ広がる帯
				width: this.rand(0.04, 0.12),
				lenScale: this.rand(0.7, 1.1),
			});
		}
		// レンズゴースト: 光源から画面中心を通る対角線上に、t=0(光源)〜1.4(反対側)で配置。
		this.ghosts = [];
		for (let i = 0; i < SunnyEffect.GHOST_COUNT; i++) {
			this.ghosts.push({
				t: this.rand(0.2, 1.3),
				r: this.rand(6, 26),
				alpha: this.rand(0.04, 0.12), // ゴーストは淡く
				hue: Math.random() < 0.5 ? 'warm' : 'cool',
			});
		}
	}

	// 光源の位置(右上の隅やや外側)
	private get sunX() { return this.widthCss * 0.82; }
	// 光が集まる収束点(中心)が画面内に見えないよう、画面上端より外(マイナス)に置く。
	// これで「画面外の上から光が射し込む」自然な見た目になる。
	private get sunY() { return -this.heightCss * 0.18; }

	// 旗鯖fork: マウス影divの位置と向きを更新する。
	// 光源(右上)からポインタへ向かう方向に影を伸ばす(=ポインタの後ろ=左下に影が出る)。
	private updateShadow() {
		if (this.destroyed) return;
		// reduced-motion時は影を出さない(動きに敏感な人を守る)
		if (this.reducedMotion) { this.shadowEl.style.opacity = '0'; return; }
		if (this.mouseX < 0 || this.mouseY < 0) return;

		// 光源→ポインタ方向の角度。影はこの向きに(ポインタの後ろへ)伸びる。
		const mdx = this.mouseX - this.sunX;
		const mdy = this.mouseY - this.sunY;
		const angleDeg = Math.atan2(mdy, mdx) * 180 / Math.PI;

		// 光源からの距離に応じて影を減衰させる(近い=濃い/くっきり、遠い=薄い/ぼやける)。
		// 画面の対角線長で正規化する。
		const dist = Math.hypot(mdx, mdy);
		const diag = Math.hypot(this.widthCss, this.heightCss) || 1;
		const norm = Math.min(dist / diag, 1);            // 0(光源直下)〜1(最遠)
		const strength = 1 - norm * 0.85;                  // 遠いほど弱く(最遠でも15%は残す)
		const blurPx = 3 + norm * 6;                       // 遠いほどぼやける(3〜9px)

		// transform-origin は左端・縦中央(0% 50%)。そこをポインタ位置に合わせ、回転させる。
		const h = 26;
		this.shadowEl.style.left = `${this.mouseX}px`;
		this.shadowEl.style.top = `${this.mouseY - h / 2}px`;
		this.shadowEl.style.transform = `rotate(${angleDeg}deg)`;
		this.shadowEl.style.filter = `blur(${blurPx.toFixed(1)}px)`;
		this.shadowEl.style.opacity = strength.toFixed(3);
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
		this.elapsed += dt;

		const ctx = this.ctx;
		const w = this.widthCss;
		const h = this.heightCss;
		ctx.clearRect(0, 0, w, h);

		// reduced-motion: 動かさず、静止した淡い光だけを出す(脈動も粒の移動もしない)
		const motion = !this.reducedMotion;

		// 脈動係数(超低速・低振幅。明滅ではない緩やかな"ゆらめき")。
		// 周期の異なる複数の遅い波を重ねて、単調なsinより自然な揺らぎにする。
		// すべて数秒〜十数秒周期なので点滅・明滅にはならない(健康配慮の絶対ライン)。
		const e = this.elapsed;
		const pulse = motion
			? 1
				+ Math.sin((e / SunnyEffect.PULSE_PERIOD_MS) * Math.PI * 2) * SunnyEffect.PULSE_AMP
				+ Math.sin((e / 5200) * Math.PI * 2 + 1.3) * (SunnyEffect.PULSE_AMP * 0.5)
				+ Math.sin((e / 13000) * Math.PI * 2 + 0.7) * (SunnyEffect.PULSE_AMP * 0.35)
			: 1;
		// 光芒の角度を全体でゆっくり揺らす量(ラジアン)。陽光がゆらめく感じ。
		const rayWaver = motion
			? Math.sin((e / 7000) * Math.PI * 2) * 0.05 + Math.sin((e / 11000) * Math.PI * 2 + 2.1) * 0.03
			: 0;

		const sx = this.sunX;
		const sy = this.sunY;
		const maxR = Math.max(w, h) * 0.85;

		// ---- レンズフレア本体(放射状グラデ) ----
		const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, maxR);
		const ga = SunnyEffect.GLOW_ALPHA * pulse;
		glow.addColorStop(0, `rgba(255,205,110,${ga})`);
		glow.addColorStop(0.25, `rgba(255,190,90,${ga * 0.5})`);
		glow.addColorStop(0.6, `rgba(255,180,80,${ga * 0.15})`);
		glow.addColorStop(1, 'rgba(255,180,80,0)');
		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, w, h);

		// ---- 光芒(光のすじ) ----
		ctx.save();
		ctx.translate(sx, sy);
		let rayIdx = 0;
		for (const ray of this.rays) {
			const len = maxR * ray.lenScale;
			// 光芒ごとに少し位相をずらして角度を揺らす(全部が同じ動きにならないように)
			const waver = rayWaver * (1 + (rayIdx % 3) * 0.4);
			const a0 = ray.angle + waver;
			const a1 = ray.angle + ray.width + waver;
			const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
			const ra = SunnyEffect.RAY_ALPHA * pulse * ray.lenScale;
			grad.addColorStop(0, `rgba(255,200,100,${ra})`);
			grad.addColorStop(1, 'rgba(255,200,100,0)');
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.arc(0, 0, len, a0, a1);
			ctx.closePath();
			ctx.fill();
			rayIdx++;
		}
		ctx.restore();

		// ---- レンズゴースト(光源→画面中心の対角線上に並ぶ光の輪) ----
		// 光源(sx,sy)から画面中心(w/2,h/2)へ伸びるベクトル上に、輪を点在させる。
		const cxp = w / 2;
		const cyp = h / 2;
		const vecX = cxp - sx;
		const vecY = cyp - sy;
		for (const ghost of this.ghosts) {
			const gx = sx + vecX * ghost.t * 2; // t=0.5で中心、それ以上で反対側へ
			const gy = sy + vecY * ghost.t * 2;
			const ga2 = ghost.alpha * pulse;
			const gr = ghost.r;
			const ring = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
			const col = ghost.hue === 'warm' ? '255,228,180' : '200,225,255';
			ring.addColorStop(0, `rgba(${col},${ga2})`);
			ring.addColorStop(0.7, `rgba(${col},${ga2 * 0.3})`);
			ring.addColorStop(1, `rgba(${col},0)`);
			ctx.fillStyle = ring;
			ctx.beginPath();
			ctx.arc(gx, gy, gr, 0, Math.PI * 2);
			ctx.fill();
		}

		// ---- 漂う光の粒 ----
		for (const p of this.dust) {
			if (motion) {
				p.phase += p.phaseSpeed * k;
				p.x += p.vx * k;
				p.y += p.vy * k;
				// 画面外に出たら反対側から再登場
				if (p.y < -5) { p.y = h + 5; p.x = this.rand(0, w); }
				if (p.x < -5) p.x = w + 5;
				if (p.x > w + 5) p.x = -5;
			}
			// 粒の明るさは位置(光源に近いほど明るい)でゆるく変化。明滅ではなく分布。
			const dx = p.x - sx;
			const dy = p.y - sy;
			const dist = Math.sqrt(dx * dx + dy * dy) / maxR;
			const proximity = Math.max(0, 1 - dist);
			const twinkle = motion ? (0.7 + Math.sin(p.phase) * 0.3) : 0.85; // ゆるい明暗(高速点滅にはしない)
			const a = SunnyEffect.DUST_ALPHA * p.alpha * proximity * twinkle * pulse;
			if (a <= 0.01) continue;
			ctx.fillStyle = `rgba(255,248,225,${a})`;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
			ctx.fill();
		}

		// マウス影は body直下のdiv(this.shadowEl)で描画する(updateShadow)。
		// canvasに描くと clearRect で毎フレーム消える・薄い・座標がずれる等で
		// 安定しなかったため、DOM要素方式に変更した。
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
		this.shadowEl.style.opacity = '0';
		window.setTimeout(() => onComplete?.(), SunnyEffect.FADE_MS + 50);
	}

	public stop() {
		if (this.destroyed) return;
		this.destroyed = true;
		if (this.raf) window.cancelAnimationFrame(this.raf);
		window.removeEventListener('resize', this.onWindowResize);
		window.removeEventListener('mousemove', this.onMouseMove);
		this.shadowEl.remove();
		this.canvas.remove();
	}
}
