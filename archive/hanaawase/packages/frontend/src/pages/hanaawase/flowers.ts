/**
 * 花常の盤面図案。design/flowers.js を型付きで移植したもの。
 * ここを画面側の唯一の SVG 正本にし、ゲーム中に図案を描き直さない。
 */
import type { Flower, Special } from "./engine.js";

const INK = "#2b2620";
const round = (value: number) => Math.round(value * 10) / 10;
type Shape =
	| { t: "c"; cx: number; cy: number; r: number; fill?: string }
	| {
			t: "r";
			x: number;
			y: number;
			w: number;
			h: number;
			rx?: number;
			fill?: string;
	  }
	| { t: "p"; pts: string; fill?: string }
	| { t: "l"; d: string; stroke: string; sw?: number }
	| { t?: "d"; d: string; fill?: string };

const petal = (
	cx: number,
	cy: number,
	deg: number,
	r0: number,
	r1: number,
	width: number,
	kind: "point" | "round" | "cleft",
) => {
	const a = ((deg - 90) * Math.PI) / 180;
	const dx = Math.cos(a),
		dy = Math.sin(a),
		px = -dy,
		py = dx;
	const bx = cx + dx * r0,
		by = cy + dy * r0;
	const tx = cx + dx * r1,
		ty = cy + dy * r1;
	const blx = bx + (px * width) / 2,
		bly = by + (py * width) / 2;
	const brx = bx - (px * width) / 2,
		bry = by - (py * width) / 2;
	const mlx = cx + dx * (r1 * 0.6) + (px * width) / 2,
		mly = cy + dy * (r1 * 0.6) + (py * width) / 2;
	const mrx = cx + dx * (r1 * 0.6) - (px * width) / 2,
		mry = cy + dy * (r1 * 0.6) - (py * width) / 2;
	if (kind === "point") return `M${round(blx)} ${round(bly)} Q${round(mlx)} ${round(mly)} ${round(tx)} ${round(ty)} Q${round(mrx)} ${round(mry)} ${round(brx)} ${round(bry)} Z`;
	if (kind === "cleft") {
		const tlx = tx - dx * (r1 * 0.14) + px * (width * 0.16),
			tly = ty - dy * (r1 * 0.14) + py * (width * 0.16);
		const trx = tx - dx * (r1 * 0.14) - px * (width * 0.16),
			try_ = ty - dy * (r1 * 0.14) - py * (width * 0.16);
		const nx = tx - dx * (r1 * 0.3),
			ny = ty - dy * (r1 * 0.3);
		return `M${round(blx)} ${round(bly)} Q${round(mlx)} ${round(mly)} ${round(tlx)} ${round(tly)} Q${round(nx)} ${round(ny)} ${round(trx)} ${round(try_)} Q${round(mrx)} ${round(mry)} ${round(brx)} ${round(bry)} Z`;
	}
	const olx = tx + px * (width * 0.34),
		oly = ty + py * (width * 0.34);
	const orx = tx - px * (width * 0.34),
		ory = ty - py * (width * 0.34);
	return `M${round(blx)} ${round(bly)} C${round(mlx)} ${round(mly)} ${round(olx)} ${round(oly)} ${round(tx)} ${round(ty)} C${round(orx)} ${round(ory)} ${round(mrx)} ${round(mry)} ${round(brx)} ${round(bry)} Z`;
};

const svgEl = (shape: Shape, overrideFill?: string, withStroke = false) => {
	if (shape.t === "l") return `<path d="${shape.d}" fill="none" stroke="${overrideFill ?? shape.stroke}" stroke-width="${shape.sw ?? 2}" stroke-linecap="round"/>`;
	const fill = overrideFill ?? shape.fill ?? "none";
	const stroke = withStroke ? ` stroke="${INK}" stroke-width="2"` : "";
	if (shape.t === "c") return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" fill="${fill}"${stroke}/>`;
	if (shape.t === "r") return `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}"${shape.rx ? ` rx="${shape.rx}"` : ""} fill="${fill}"${stroke}/>`;
	if (shape.t === "p") return `<polygon points="${shape.pts}" fill="${fill}"${stroke}/>`;
	return `<path d="${shape.d}" fill="${fill}"${stroke}/>`;
};

const build = (shapes: Shape[], shadow: string, extra = "") => {
	const back = shapes.filter((shape) => shape.t !== "l");
	const shadowShapes = back.map((shape) => svgEl(shape, shadow)).join("");
	const mainShapes = shapes
		.map((shape) => svgEl(shape, undefined, true))
		.join("");
	return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="display:block;overflow:visible" aria-hidden="true"><g transform="translate(1.3,2.1)" opacity="0.55">${shadowShapes}</g><g stroke-linejoin="round" stroke-linecap="round">${mainShapes}</g>${extra}</svg>`;
};

const matsu = build(
	[
		{ t: "r", x: 29, y: 42, w: 6, h: 16, fill: "#6b4a2e" },
		{ t: "p", pts: "32,32 12,52 52,52", fill: "#2f6e4f" },
		{ t: "p", pts: "32,20 17,40 47,40", fill: "#2f6e4f" },
		{ t: "p", pts: "32,9 21,27 43,27", fill: "#2f6e4f" },
	],
	"#1c4230",
);
const ume = build(
	[
		...[0, 72, 144, 216, 288].map((deg) => ({
			d: petal(32, 33, deg, 5, 27, 20, "round"),
			fill: "#c4383d",
		})),
		{ t: "c" as const, cx: 32, cy: 33, r: 6, fill: "#f2d98c" },
	],
	"#8f272b",
);
const sakura = build(
	[
		...[0, 72, 144, 216, 288].map((deg) => ({
			d: petal(32, 33, deg, 4, 28, 21, "cleft"),
			fill: "#f2a7b8",
		})),
		{ t: "c" as const, cx: 32, cy: 33, r: 5, fill: "#b3556e" },
	],
	"#c77d90",
);
const floret = (x: number, y: number, size: number): Shape[] => [
	...[0, 90, 180, 270].map((deg) => ({
		d: petal(x, y, deg, 1.5 * size, 8 * size, 8 * size, "round"),
		fill: "#7b86c8",
	})),
	{ t: "c", cx: x, cy: y, r: 2.4 * size, fill: "#f4efe3" },
];
const ajisai = build(
	[
		...floret(32, 20, 1),
		...floret(20, 34, 1),
		...floret(44, 34, 1),
		...floret(32, 46, 1),
	],
	"#4d579a",
);
const himawari = build(
	[
		...Array.from({ length: 14 }, (_, index) => ({
			d: petal(32, 32, index * (360 / 14), 12, 30, 8, "point"),
			fill: "#f2b135",
		})),
		{ t: "c" as const, cx: 32, cy: 32, r: 12, fill: "#7a4a26" },
	],
	"#c98a1f",
);
const kiku = build(
	[
		...Array.from({ length: 18 }, (_, index) => ({
			d: petal(32, 32, index * 20, 8, 30, 5, "point"),
			fill: "#f4efe3",
		})),
		...Array.from({ length: 12 }, (_, index) => ({
			d: petal(32, 32, index * 30 + 15, 5, 20, 5, "point"),
			fill: "#f4efe3",
		})),
		{ t: "c" as const, cx: 32, cy: 32, r: 7, fill: "#c9a04e" },
	],
	"#cfc6b0",
);
const tanzaku = build(
	[
		{ t: "r", x: 20, y: 6, w: 24, h: 52, fill: "#f4efe3" },
		{ t: "r", x: 20, y: 6, w: 24, h: 9, fill: "#c4383d" },
		{ t: "l", d: "M32 22 L32 50", stroke: INK, sw: 2 },
		{ t: "l", d: "M27 45 L32 51 L37 45", stroke: INK, sw: 2 },
	],
	"#cfc6b0",
);
const mari = build(
	[
		{ t: "c", cx: 32, cy: 32, r: 24, fill: "#c4383d" },
		{ d: "M32 8 A24 24 0 0 1 53 44 L32 32 Z", fill: "#2d4a73" },
		{ d: "M53 44 A24 24 0 0 1 11 44 L32 32 Z", fill: "#c9a04e" },
		{
			t: "l",
			d: "M32 8 L32 32 M53 44 L32 32 M11 44 L32 32",
			stroke: INK,
			sw: 1.6,
		},
		{ t: "c", cx: 32, cy: 32, r: 3, fill: "#f4efe3" },
	],
	"#8f272b",
);
const tsuki = build(
	[
		{ t: "c", cx: 32, cy: 32, r: 24, fill: "#e8d9a8" },
		{ d: "M12 38 Q26 33 40 38 Q52 42 54 38", fill: "none" },
		{ t: "l", d: "M13 37 Q27 31 41 37 Q51 41 53 37", stroke: INK, sw: 3 },
	],
	"#c9b988",
);
const petalOne = (fill: string, kind: "point" | "round" | "cleft") =>
	`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="display:block;overflow:visible" aria-hidden="true"><path d="${petal(32, 40, 0, 2, 34, 20, kind)}" fill="${fill}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></svg>`;

export const FLOWER_SVGS: Record<
	Flower,
	{ name: string; color: string; svg: string; petal: string }
> = {
	matsu: {
		name: "松",
		color: "#2f6e4f",
		svg: matsu,
		petal: petalOne("#2f6e4f", "point"),
	},
	ume: {
		name: "梅",
		color: "#c4383d",
		svg: ume,
		petal: petalOne("#c4383d", "round"),
	},
	sakura: {
		name: "桜",
		color: "#f2a7b8",
		svg: sakura,
		petal: petalOne("#f2a7b8", "cleft"),
	},
	ajisai: {
		name: "紫陽花",
		color: "#7b86c8",
		svg: ajisai,
		petal: petalOne("#7b86c8", "round"),
	},
	himawari: {
		name: "向日葵",
		color: "#f2b135",
		svg: himawari,
		petal: petalOne("#f2b135", "point"),
	},
	kiku: {
		name: "菊",
		color: "#f4efe3",
		svg: kiku,
		petal: petalOne("#f4efe3", "point"),
	},
};
export const SPECIAL_SVGS: Record<Special, { name: string; svg: string }> = {
	tanzaku: { name: "短冊", svg: tanzaku },
	mari: { name: "鞠", svg: mari },
	tsuki: { name: "月", svg: tsuki },
};
