/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { SeasonalTreeSeason } from './seasonal-tree.js';

export type SeasonalTreeColorRole = 'canopyMid' | 'canopyLight' | 'accent';

export interface SeasonalTreeParticle {
	readonly x: number;
	readonly y: number;
	readonly fall: number;
	readonly duration: number;
	readonly delay: number;
	readonly opacity: number;
	readonly path: string;
	readonly color: SeasonalTreeColorRole;
}

export interface SeasonalTreeGeometry {
	readonly limbs: readonly string[];
	readonly twigs: readonly string[];
	readonly crown: Readonly<{
		mass: string;
		halo: readonly string[];
		back: string;
		mid: string;
		sun: string;
		glints: string;
		frost: string;
	}>;
	readonly turf: string;
	readonly groundFlowers: readonly string[];
	readonly fallen: string;
	readonly particles: readonly SeasonalTreeParticle[];
}

const CLUSTERS: readonly (readonly [number, number, number, number])[] = [
	[160, 173, 20, 17], [181, 144, 24, 21], [204, 118, 23, 20], [235, 100, 24, 19], [264, 85, 24, 18], [294, 81, 24, 18],
	[325, 91, 25, 21], [355, 111, 25, 22], [387, 121, 24, 22], [419, 138, 25, 21], [447, 157, 24, 20], [470, 177, 19, 17],
	[428, 184, 23, 20], [398, 168, 23, 21], [365, 150, 21, 20], [333, 131, 22, 20], [298, 118, 23, 21], [267, 130, 23, 19],
	[233, 145, 24, 21], [206, 166, 24, 20], [177, 190, 19, 18], [216, 191, 23, 17], [249, 177, 23, 20], [278, 159, 22, 20],
	[314, 158, 25, 22], [346, 179, 23, 20], [378, 193, 23, 18], [410, 207, 20, 18], [455, 203, 19, 18], [146, 155, 16, 15],
	[252, 67, 18, 15], [340, 72, 18, 16], [391, 97, 18, 16], [481, 150, 15, 15],
	[107, 121, 15, 11], [139, 75, 15, 13], [200, 43, 14, 14], [267, 29, 15, 13], [340, 32, 15, 13],
	[382, 57, 15, 13], [452, 83, 16, 13], [506, 130, 16, 13], [521, 161, 16, 13], [495, 250, 16, 12],
	[121, 158, 15, 12], [462, 216, 16, 12],
	[151, 111, 24, 20], [178, 86, 23, 19], [221, 73, 24, 19], [293, 54, 23, 19],
	[321, 55, 24, 20], [371, 77, 25, 19], [416, 101, 23, 20], [125, 142, 23, 21],
];

const LIMBS: readonly (readonly [string, number, string, number])[] = [
	['M315 277 C295 249 272 220 236 197 C205 178 174 174 143 179', 9, 'M240 200 C216 167 194 147 162 132 C145 124 128 126 112 123', 5],
	['M309 235 C290 196 268 159 239 136 C208 110 180 104 154 99', 8, 'M240 136 C222 106 214 80 210 55 M204 111 C190 87 166 75 145 72', 4],
	['M316 222 C312 178 306 142 292 112 C278 83 263 69 247 52', 9, 'M293 115 C316 89 331 66 337 43 M276 87 C264 62 268 43 270 31', 4],
	['M319 234 C336 195 352 161 374 132 C397 103 422 94 447 87', 9, 'M374 132 C369 100 371 77 382 56 M408 98 C433 104 455 99 475 105', 4],
	['M321 266 C357 225 388 204 425 182 C451 168 476 160 502 160', 9, 'M425 183 C432 154 443 133 464 123 M468 163 C485 139 504 131 521 128', 4],
	['M313 196 C337 157 348 127 354 93 C357 68 351 48 345 30', 6, 'M351 111 C374 90 392 85 410 81', 3],
	['M307 194 C282 170 260 156 235 151 C203 144 179 150 157 157', 6, 'M225 151 C204 132 184 125 164 126', 3],
	['M318 287 C353 265 386 250 422 245 C449 240 474 245 495 253', 6, 'M415 246 C430 226 450 216 471 212', 3],
];

const TWIGS = [
	'M126 127 Q100 115 87 118 M145 72 Q129 62 115 64 M210 55 Q205 35 199 24 M270 31 Q277 17 289 12',
	'M337 43 Q342 25 350 18 M345 30 Q338 17 325 11 M382 56 Q389 34 404 24 M447 87 Q465 68 481 66',
	'M475 105 Q492 99 508 105 M521 128 Q534 116 546 119 M502 160 Q519 157 534 166 M471 212 Q490 208 508 214',
	'M495 253 Q510 254 525 264 M157 157 Q136 153 123 160 M164 126 Q147 113 132 112 M87 118 Q73 113 61 118',
] as const;

export const SEASONAL_TREE_TRUNK = 'M299 346 Q307 342 308 329 C311 302 313 286 310 268 C307 243 303 218 302 197 C301 179 304 165 307 153 Q313 169 316 181 C321 199 326 217 327 243 C329 267 329 300 326 329 Q327 341 339 346 Q327 344 319 344 Q309 344 299 346Z';
export const SEASONAL_TREE_BARK = 'M312 332 C314 294 312 272 306 237 M319 311 C321 285 321 262 316 237 M307 307 C307 286 305 269 304 252 M306 211 Q305 191 306 174 M314 216 Q313 192 309 175 M303 344 Q308 341 311 337 M322 340 Q328 342 334 345';
export const SEASONAL_TREE_FROST = 'M295 216 Q303 226 307 241 M351 157 Q362 136 370 120 M402 197 Q416 188 430 182';

const round = (n: number): number => Math.round(n * 10) / 10;

function random(seed: number): () => number {
	let current = seed;
	return () => { current = (1664525 * current + 1013904223) >>> 0; return current / 4294967296; };
}

function leafPath(cx: number, cy: number, w: number, h: number, angle: number): string {
	const a = angle * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
	const point = (x: number, y: number): string => `${round(cx + x * co - y * si)} ${round(cy + x * si + y * co)}`;
	return `M${point(0, -h)} Q${point(w * .86, -h * .32)} ${point(w * .48, h * .17)} Q${point(w * .18, h * .78)} ${point(0, h)} Q${point(-w * .33, h * .38)} ${point(-w * .65, -h * .24)} Q${point(-w * .35, -h * .75)} ${point(0, -h)}Z`;
}

function blossomPath(cx: number, cy: number, radius: number, angle: number): string {
	const r = radius * 1.6;
	const point = (a: number, multiple: number): string => `${round(cx + Math.cos(a * Math.PI / 180) * r * multiple)} ${round(cy + Math.sin(a * Math.PI / 180) * r * multiple)}`;
	let path = `M${point(angle - 36, .48)}`;
	for (let j = 0; j < 5; j++) path += ` Q${point(angle + j * 72, 1.72)} ${point(angle + j * 72 + 36, .48)}`;
	return path + 'Z';
}

function taperedPath(source: string, rootWidth: number): string {
	const tokens = source.match(/[MC]|-?\d+(?:\.\d+)?/g) ?? [];
	let i = 0, points: [number, number][] = [], result = '';
	const finish = (): void => {
		if (points.length < 2) return;
		const left: string[] = [], right: string[] = [];
		for (let k = 0; k < points.length; k++) {
			const a = points[Math.max(0, k - 1)], b = points[Math.min(points.length - 1, k + 1)];
			const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
			const width = (rootWidth * (1 - k / (points.length - 1)) + .72 * k / (points.length - 1)) * .5;
			const nx = -dy / length * width, ny = dx / length * width;
			left.push(`${round(points[k][0] + nx)} ${round(points[k][1] + ny)}`);
			right.push(`${round(points[k][0] - nx)} ${round(points[k][1] - ny)}`);
		}
		result += `M${left.join(' L')} L${right.reverse().join(' L')}Z`;
		points = [];
	};
	while (i < tokens.length) {
		const command = tokens[i++];
		if (command === 'M') { finish(); points.push([Number(tokens[i++]), Number(tokens[i++])]); } else if (command === 'C') {
			const start = points[points.length - 1];
			const a: [number, number] = [Number(tokens[i++]), Number(tokens[i++])];
			const b: [number, number] = [Number(tokens[i++]), Number(tokens[i++])];
			const end: [number, number] = [Number(tokens[i++]), Number(tokens[i++])];
			for (let step = 1; step <= 10; step++) {
				const t = step / 10, u = 1 - t;
				points.push([u * u * u * start[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * end[0], u * u * u * start[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * end[1]]);
			}
		}
	}
	finish();
	return result;
}

function makeCrown(season: SeasonalTreeSeason): SeasonalTreeGeometry['crown'] {
	if (season === 'winter') return { mass: '', halo: [], back: '', mid: '', sun: '', glints: '', frost: SEASONAL_TREE_FROST };
	const seasonIndex = ['spring', 'summer', 'autumn', 'winter'].indexOf(season);
	const rand = random(1307 + seasonIndex * 9901);
	const halo: string[] = [];
	let back = '', mid = '', sun = '', glints = '', mass = '';
	for (let i = 0; i < CLUSTERS.length; i++) {
		const [cx, cy, baseRx, baseRy] = CLUSTERS[i];
		const rx = baseRx * (i >= 34 && i < 50 ? 1.3 : 1), ry = baseRy * (i >= 34 && i < 50 ? 1.2 : 1);
		if (i % 5 !== 0) {
			const wobble: [number, number][] = [];
			for (let k = 0; k < 15; k++) {const a = k * Math.PI * 2 / 15, scale = .76 + rand() * .39; wobble.push([round(cx + Math.cos(a) * rx * 1.16 * scale), round(cy + Math.sin(a) * ry * 1.13 * scale)]);}
			const midpoint = (a: [number, number], b: [number, number]): string => `${round((a[0] + b[0]) / 2)} ${round((a[1] + b[1]) / 2)}`;
			mass += `M${midpoint(wobble[wobble.length - 1], wobble[0])}`;
			for (let k = 0; k < wobble.length; k++)mass += ` Q${wobble[k].join(' ')} ${midpoint(wobble[k], wobble[(k + 1) % wobble.length])}`;
			mass += 'Z';
		}
		for (let j = 0; j < (season === 'spring' ? 27 : 43); j++) {
			const theta = rand() * Math.PI * 2, radial = Math.sqrt(rand());
			const x = cx + Math.cos(theta) * rx * radial * 1.34, y = cy + Math.sin(theta) * ry * radial * 1.31;
			const size = (.67 + rand() * .7) * (season === 'spring' ? 2.2 : 4.1), angle = rand() * 90 - 45;
			const shape = season === 'spring' ? blossomPath(x, y, size, angle) : leafPath(x, y, size * .65, size, angle);
			const light = (x - 108) / 425 * .57 + (247 - y) / 230 * .43 + (rand() - .5) * .20;
			if (light > .65)sun += shape; else if (light < .36)back += shape; else mid += shape;
			if (j % (season === 'spring' ? 5 : 8) === 0 && light > (season === 'spring' ? .38 : .52))glints += season === 'spring' ? blossomPath(x + 2.5, y - 2, size * .56, angle) : leafPath(x + 2, y - 2, size * .31, size * .53, angle);
		}
		if (i % 6 === 0)halo.push(`M${round(cx - rx * .78)} ${round(cy + ry * .28)} Q${cx} ${round(cy + ry * .72)} ${round(cx + rx * .58)} ${round(cy - ry * .25)}`);
	}
	return { mass, halo, back, mid, sun, glints, frost: '' };
}

function makeTurf(): string {
	const rand = random(711); let path = '';
	for (let i = 0; i < 37; i++) {const x = 10 + rand() * 620, y = 321 + rand() * 91, h = 2 + rand() * 4; path += `M${round(x)} ${round(y)} l${round(2 + rand() * 3)} ${round(-h)} M${round(x + 6)} ${round(y + 1)} l${round(2 + rand() * 3)} ${round(-h * .5)} `;}
	return path;
}

function makeParticles(season: SeasonalTreeSeason): SeasonalTreeParticle[] {
	const counts: Record<SeasonalTreeSeason, number> = { spring: 15, summer: 5, autumn: 16, winter: 14 };
	const rand = random(821 + ['spring', 'summer', 'autumn', 'winter'].indexOf(season) * 38);
	const particles: SeasonalTreeParticle[] = [];
	for (let i = 0; i < counts[season]; i++) {
		const x = 75 + rand() * 440, y = season === 'winter' ? -18 + rand() * 110 : 64 + rand() * 185;
		const fall = 190 + rand() * 190, duration = 6.8 + rand() * 5.4, delay = -rand() * duration, opacity = .5 + rand() * .35;
		let path:string, color:SeasonalTreeColorRole;
		if (season === 'winter') {const r = 1.4 + rand() * 1.2; path = `M0 ${round(-r)} L${round(r)} 0 L0 ${round(r)} L${round(-r)} 0Z`; color = 'canopyLight';} else if (season === 'spring') {const r = 2.1 + rand() * 2; path = `M0 ${round(-r)} Q${round(r * 1.35)} ${round(-r * .9)} ${round(r * .7)} ${round(r * .45)} Q0 ${round(r * 1.5)} ${round(-r * .7)} ${round(r * .3)} Q${round(-r * 1.25)} ${round(-r * .5)} 0 ${round(-r)}Z`; color = i % 3 === 0 ? 'accent' : i % 3 === 1 ? 'canopyLight' : 'canopyMid';} else {const r = season === 'autumn' ? 3.8 + rand() * 2.1 : 2.2 + rand() * 1.3; path = leafPath(0, 0, r * .67, r, rand() * 100 - 50); color = i % 3 === 0 ? 'accent' : i % 3 === 1 ? 'canopyMid' : 'canopyLight';}
		particles.push({ x: round(x), y: round(y), fall: round(fall), duration: round(duration), delay: round(delay), opacity: round(opacity), path, color });
	}
	return particles;
}

const cache = new Map<SeasonalTreeSeason, SeasonalTreeGeometry>();

/** The path strings are generated once for each season and never depend on clock, palette, or wind. */
export function getSeasonalTreeGeometry(season: SeasonalTreeSeason): SeasonalTreeGeometry {
	const cached = cache.get(season);
	if (cached) return cached;
	const limbs = LIMBS.flatMap(([major, width, minor, small]) => [taperedPath(major, width), taperedPath(minor, small)]);
	const groundFlowers = season === 'spring' ? [73, 194, 399, 529].map((x, i) => blossomPath(x, [347, 363, 368, 347][i], 2.2, 0)) : [];
	let fallen = '';
	if (season === 'spring' || season === 'autumn') for (const [x, y, a] of [[98, 346, 21], [155, 362, -36], [206, 377, 8], [276, 358, -28], [367, 384, 35], [435, 351, -13], [513, 374, 25], [578, 336, -18]])fallen += leafPath(x, y, season === 'spring' ? 1.8 : 3, season === 'spring' ? 2.5 : 4, a);
	const crown = makeCrown(season);
	const geometry: SeasonalTreeGeometry = Object.freeze({
		limbs: Object.freeze(limbs),
		twigs: TWIGS,
		crown: Object.freeze({ ...crown, halo: Object.freeze(crown.halo) }),
		turf: makeTurf(),
		groundFlowers: Object.freeze(groundFlowers),
		fallen,
		particles: Object.freeze(makeParticles(season).map(particle => Object.freeze(particle))),
	});
	cache.set(season, geometry);
	return geometry;
}
