/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * 旗鯖fork: 天気エフェクト(weatherEffect) — 木の葉(leaves)。
 *
 * 「新緑」「若葉」「夏」などのワードに反応し、緑の葉がふわふわと舞い落ちる演出。
 * 雪・雨・強風と同じ方針で、TLのDOMには触らず body 直下に position:fixed の canvas を
 * 1枚置く。マネージャからは render/fadeIn/fadeOut/stop で扱う。
 *
 * 強風(windy)が「葉が横に流れる」のに対し、本エフェクトは「葉がゆっくり舞い落ちる」。
 * variant で色味を変える:
 *   - 'fresh'  … 新緑/若葉。明るい黄緑〜緑。
 *   - 'summer' … 夏/青葉。濃い緑〜青緑。
 *
 * 【健康配慮 — 最優先・コードでハードガード】
 *   - 明滅・点滅・コントラストの急変は行わない(動きのみ・輝度は一定)。
 *   - prefers-reduced-motion: reduce のとき描画を止める(動きに敏感な人を守る)。
 *   - document.hidden 時は描画停止。
 *   - 葉の数・透過度に上限を設ける。
 */

export type LeafVariant = 'fresh' | 'summer';

export class LeafEffect {
	// ===== 健康配慮のハードガード定数(安易に変更しないこと) =====
	private static readonly FADE_MS = 2000;       // フェード時間
	private static readonly MAX_LEAVES = 50;      // 葉の同時上限
	private static readonly LEAF_ALPHA = 0.8;     // 葉の最大不透明度
	// =========================================================

	// 葉の色(variantごとの緑系バリエーション)
	private static readonly COLORS: Record<LeafVariant, readonly string[]> = {
		// 新緑: 明るい黄緑〜若葉色
		fresh: ['150,200,90', '170,210,100', '120,190,90', '190,215,110', '140,185,80'],
		// 夏: 濃い緑〜青葉
		summer: ['70,140,60', '90,150,70', '60,120,70', '50,110,55', '80,135,75'],
	};

	private readonly variant: LeafVariant;

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

	private leaves: {
		x: number; y: number;
		size: number;
		fallSpeed: number;      // 落下速度
		drift: number;          // 横方向の基本ドリフト
		sway: number;           // 横揺れ位相
		swaySpeed: number;
		swayAmp: number;
		rot: number;            // 回転角
		rotSpeed: number;       // 回転速度
		color: string;
		alpha: number;
		flip: number;           // 横回転(ひらひら裏返る演出)
		flipSpeed: number;
	}[] = [];

	constructor(opts: { variant?: LeafVariant } = {}) {
		this.variant = opts.variant ?? 'fresh';

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
			transition: `opacity ${LeafEffect.FADE_MS}ms ease`,
		});
		const ctx = canvas.getContext('2d');
		if (ctx == null) throw new Error('Failed to get 2D context for leaves');
		this.canvas = canvas;
		this.ctx = ctx;

		window.document.body.append(canvas);

		this.onWindowResize = () => this.resize();
		window.addEventListener('resize', this.onWindowResize);

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

	private rand(min: number, max: number) {
		return min + Math.random() * (max - min);
	}

	private pick<T>(arr: readonly T[]): T {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	private initLeaves() {
		this.leaves = [];
		const n = Math.min(LeafEffect.MAX_LEAVES, Math.round(this.widthCss / 26));
		for (let i = 0; i < n; i++) {
			this.leaves.push(this.spawnLeaf(true));
		}
	}

	private spawnLeaf(initial: boolean) {
		const colors = LeafEffect.COLORS[this.variant];
		return {
			// initial=true は画面内に散らす。以降は上端の外から登場。
			x: this.rand(0, this.widthCss),
			y: initial ? this.rand(0, this.heightCss) : this.rand(-60, -10),
			size: this.rand(7, 15),
			fallSpeed: this.rand(0.6, 1.6),       // ゆっくり落ちる
			drift: this.rand(-0.5, 0.5),          // ゆるい横流れ
			sway: this.rand(0, Math.PI * 2),
			swaySpeed: this.rand(0.012, 0.035),
			swayAmp: this.rand(0.6, 1.6),
			rot: this.rand(0, Math.PI * 2),
			rotSpeed: this.rand(-0.03, 0.03),
			color: this.pick(colors),
			alpha: this.rand(0.5, 1),
			flip: this.rand(0, Math.PI * 2),
			flipSpeed: this.rand(0.02, 0.06),
		};
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

		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.widthCss, this.heightCss);

		for (const lf of this.leaves) {
			lf.flip += lf.flipSpeed * k;
			lf.sway += lf.swaySpeed * k;
			lf.rot += lf.rotSpeed * k;

			// ゆっくり落下 + 横揺れ + ゆるいドリフト
			lf.y += lf.fallSpeed * k;
			lf.x += (lf.drift + Math.sin(lf.sway) * lf.swayAmp) * k;

			this.drawLeaf(ctx, lf);

			// 下端を抜けたら上からまた登場
			if (lf.y > this.heightCss + 30 || lf.x < -40 || lf.x > this.widthCss + 40) {
				Object.assign(lf, this.spawnLeaf(false));
			}
		}
	};

	private drawLeaf(ctx: CanvasRenderingContext2D, lf: LeafEffect['leaves'][number]) {
		const a = LeafEffect.LEAF_ALPHA * lf.alpha;
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
		window.setTimeout(() => onComplete?.(), LeafEffect.FADE_MS + 50);
	}

	public stop() {
		if (this.destroyed) return;
		this.destroyed = true;
		if (this.raf) window.cancelAnimationFrame(this.raf);
		window.removeEventListener('resize', this.onWindowResize);
		this.canvas.remove();
	}
}
