/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * 旗鯖fork: 天気エフェクト(weatherEffect) — 強風(windy)。
 *
 * 雪(WebGL)・雨・日差し(2D Canvas)と同じ方針で、TLのDOMには触らず body 直下に
 * position:fixed の canvas を1枚置く。マネージャからは render/fadeIn/fadeOut/stop で扱う。
 *
 * 演出: 葉っぱが画面の右から左へ流れていく。
 *   - 葉ごとにサイズ・色(緑〜黄〜茶)・速度・回転をランダム化
 *   - 流れながらくるくる回転し、上下にゆらゆら波打つ
 *   - たまに突風が吹いて全体が少し加速する(動きの変化のみ。明滅・点滅はしない)
 *
 * 【健康配慮 — 最優先・コードでハードガード】
 *   - 明滅・点滅・コントラストの急変は行わない。突風は「動きの加速」だけで、輝度は変えない。
 *   - prefers-reduced-motion: reduce のとき描画を止める(動きに敏感な人を守る)。
 *   - document.hidden 時は描画停止。
 *   - 葉の数・透過度に上限を設ける。
 */

export class WindyEffect {
	// ===== 健康配慮のハードガード定数(安易に変更しないこと) =====
	private static readonly FADE_MS = 2000;       // フェード時間
	private static readonly MAX_LEAVES = 60;      // 葉の同時上限
	private static readonly LEAF_ALPHA = 0.85;    // 葉の最大不透明度
	private static readonly GUST_MIN_INTERVAL_MS = 4000; // 突風の最短間隔(頻発させない)
	// =========================================================

	// 葉の色(緑〜黄〜茶のバリエーション)
	private static readonly LEAF_COLORS = [
		'120,150,70',   // 緑
		'150,170,80',   // 黄緑
		'190,170,70',   // 黄
		'200,150,60',   // 山吹
		'170,110,50',   // 茶
		'140,90,50',    // 焦げ茶
	];

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

	// 突風の状態
	private gust = 1;            // 現在の風の強さ倍率(1=平常)
	private gustTarget = 1;      // 目標倍率
	private lastGustTs = 0;

	private leaves: {
		x: number; y: number;
		size: number;
		speed: number;          // 横方向(左向き)の基本速度
		sway: number;           // 上下の揺れ位相
		swaySpeed: number;
		swayAmp: number;
		rot: number;            // 現在の回転角
		rotSpeed: number;       // 回転速度
		color: string;
		alpha: number;
		flip: number;           // 葉の見かけの厚み(横回転で平たく見える演出)
		flipSpeed: number;
		stuck: boolean;         // UI要素の縁に引っかかっているか
		stuckTimer: number;     // 引っかかってからの経過(ms)。一定時間で解放
		stuckMax: number;       // この葉が引っかかっていられる時間(ms)
	}[] = [];

	// 旗鯖fork: 葉が引っかかる対象UI要素の矩形(雨の水垂れと同じ要素)。
	private targetRects: DOMRect[] = [];
	private rectTimer = 0;

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
			transition: `opacity ${WindyEffect.FADE_MS}ms ease`,
		});
		const ctx = canvas.getContext('2d');
		if (ctx == null) throw new Error('Failed to get 2D context for windy');
		this.canvas = canvas;
		this.ctx = ctx;

		window.document.body.append(canvas);

		this.onWindowResize = () => this.resize();
		window.addEventListener('resize', this.onWindowResize);

		// 旗鯖fork: 葉が引っかかる対象(サイドメニュー/下部バー/投稿フォーム)の位置を定期取得。
		this.updateTargetRects();
		this.rectTimer = window.setInterval(() => this.updateTargetRects(), 500);

		this.reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');

		this.resize();
		this.initLeaves();
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

	// 旗鯖fork: 葉が引っかかる対象UI要素の矩形を取得(雨の水垂れと同じ要素)。
	private updateTargetRects() {
		const rects: DOMRect[] = [];
		try {
			const selectors = ['[data-cy-open-post-form]', '[data-htk-weather-footer]', '[data-htk-weather-postform]'];
			for (const sel of selectors) {
				const els = Array.from(window.document.querySelectorAll(sel));
				for (const el of els) {
					const r = el.getBoundingClientRect();
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

	private pick<T>(arr: readonly T[]): T {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	private initLeaves() {
		this.leaves = [];
		const n = Math.min(WindyEffect.MAX_LEAVES, Math.round(this.widthCss / 18));
		for (let i = 0; i < n; i++) {
			this.leaves.push(this.spawnLeaf(true));
		}
	}

	private spawnLeaf(initial: boolean) {
		return {
			// initial=true は画面内に散らす。以降は右端の外から登場。
			x: initial ? this.rand(0, this.widthCss) : this.widthCss + this.rand(10, 80),
			y: this.rand(-20, this.heightCss),
			size: this.rand(7, 16),
			speed: this.rand(2.5, 5.5),
			sway: this.rand(0, Math.PI * 2),
			swaySpeed: this.rand(0.02, 0.06),
			swayAmp: this.rand(0.4, 1.4),
			rot: this.rand(0, Math.PI * 2),
			rotSpeed: this.rand(-0.06, 0.06),
			color: this.pick(WindyEffect.LEAF_COLORS),
			alpha: this.rand(0.5, 1),
			flip: this.rand(0, Math.PI * 2),
			flipSpeed: this.rand(0.04, 0.1),
			stuck: false,
			stuckTimer: 0,
			stuckMax: this.rand(1500, 4000), // 1.5〜4秒引っかかってから解放
		};
	}

	private maybeGust(ts: number) {
		// 一定間隔以上空けてから、低確率で突風を起こす(動きの加速のみ)
		if (ts - this.lastGustTs < WindyEffect.GUST_MIN_INTERVAL_MS) return;
		if (Math.random() < 0.004) {
			this.gustTarget = this.rand(1.4, 2.0);
			this.lastGustTs = ts;
		} else if (Math.random() < 0.01) {
			this.gustTarget = 1; // 平常に戻す
		}
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
		if (this.reducedMotion) {
			this.ctx.clearRect(0, 0, this.widthCss, this.heightCss);
			this.lastTs = ts;
			return;
		}

		const dt = this.lastTs === 0 ? 16 : Math.min(ts - this.lastTs, 50);
		this.lastTs = ts;
		const k = dt / 16.67;

		// 突風の倍率をなめらかに目標へ寄せる(急変させない)
		this.maybeGust(ts);
		this.gust += (this.gustTarget - this.gust) * 0.02 * k;

		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.widthCss, this.heightCss);

		const targets = this.targetRects;
		for (const lf of this.leaves) {
			lf.flip += lf.flipSpeed * k;

			if (lf.stuck) {
				// ---- 引っかかり中: その場でくるくる回りながら揺れる ----
				lf.stuckTimer += dt;
				lf.sway += lf.swaySpeed * 1.5 * k;          // 揺れは少し速く
				lf.rot += (0.04 + lf.rotSpeed * 0.5) * k;   // くるくる回る
				// その場で小さく揺れる(引っかかってプルプルする感じ)
				lf.x += Math.sin(lf.sway * 1.3) * 0.4 * k;
				lf.y += Math.sin(lf.sway) * 0.5 * k;

				this.drawLeaf(ctx, lf);

				// 一定時間経過、または対象が消えたら解放してまた流れ出す
				const stillOnTarget = targets.some(r =>
					lf.x >= r.left - 8 && lf.x <= r.right + 8 && lf.y >= r.top - 8 && lf.y <= r.bottom + 8);
				if (lf.stuckTimer >= lf.stuckMax || !stillOnTarget) {
					lf.stuck = false;
					lf.speed = this.rand(3, 6); // 解放時は少し勢いをつけて飛ぶ
				}
				continue;
			}

			// ---- 通常: 右から左へ流れる ----
			lf.sway += lf.swaySpeed * k;
			lf.rot += lf.rotSpeed * this.gust * k;

			// 右から左へ流れる + 上下の揺れ
			lf.x -= lf.speed * this.gust * k;
			lf.y += Math.sin(lf.sway) * lf.swayAmp * k;

			// 旗鯖fork: 対象UI要素の縁に当たったら引っかかる。
			// 葉が要素の領域に入ったら、低確率で捕まる(全部は捕まらず、すり抜ける葉もある)。
			for (const r of targets) {
				const inside = lf.x >= r.left && lf.x <= r.right && lf.y >= r.top && lf.y <= r.bottom;
				if (inside && Math.random() < 0.08) {
					lf.stuck = true;
					lf.stuckTimer = 0;
					break;
				}
			}

			this.drawLeaf(ctx, lf);

			// 画面左端を抜けたら右からまた登場
			if (lf.x < -30 || lf.y > this.heightCss + 30 || lf.y < -60) {
				Object.assign(lf, this.spawnLeaf(false));
			}
		}
	};

	private drawLeaf(ctx: CanvasRenderingContext2D, lf: WindyEffect['leaves'][number]) {
		const a = WindyEffect.LEAF_ALPHA * lf.alpha;
		// flip(横回転)で横幅を縮め、ひらひら裏返る様子を表現
		const widthScale = 0.35 + Math.abs(Math.cos(lf.flip)) * 0.65;

		ctx.save();
		ctx.translate(lf.x, lf.y);
		ctx.rotate(lf.rot);
		ctx.scale(widthScale, 1);
		ctx.fillStyle = `rgba(${lf.color},${a})`;

		// 葉の形(2つの円弧で木の葉型を描く)
		const s = lf.size;
		ctx.beginPath();
		ctx.moveTo(0, -s);
		ctx.quadraticCurveTo(s * 0.8, -s * 0.2, 0, s);
		ctx.quadraticCurveTo(-s * 0.8, -s * 0.2, 0, -s);
		ctx.closePath();
		ctx.fill();

		// 葉脈(中央の線)を少し濃い色で
		ctx.strokeStyle = `rgba(${lf.color},${a * 0.5})`;
		ctx.lineWidth = 0.6;
		ctx.beginPath();
		ctx.moveTo(0, -s);
		ctx.lineTo(0, s);
		ctx.stroke();

		ctx.restore();
	}

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
		window.setTimeout(() => onComplete?.(), WindyEffect.FADE_MS + 50);
	}

	public stop() {
		if (this.destroyed) return;
		this.destroyed = true;
		if (this.raf) window.cancelAnimationFrame(this.raf);
		if (this.rectTimer) window.clearInterval(this.rectTimer);
		window.removeEventListener('resize', this.onWindowResize);
		this.canvas.remove();
	}
}
