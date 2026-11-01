/**
 * 花常の操作アイコン。ゲーム内では Tabler を使わず、すべて 64x64 の独自 SVG を返す。
 * 線画は currentColor、面塗りは花常の共通パレットを用いる。
 */
const INK = '#2b2620';

const svg = (content: string) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="display:block;overflow:visible" aria-hidden="true">${content}</svg>`;
const stroke = (paths: string) => svg(`<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`);
const filled = (content: string, shadow = '') => svg(`${shadow ? `<g transform="translate(1.3 2.1)" opacity=".55">${shadow}</g>` : ''}<g stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</g>`);
const path = (d: string) => `<path d="${d}"/>`;

// 花ピース（design/flowers.js）の桜と同じ、先端に切れ込みのある5弁。
const sakuraPetal = (deg: number) => {
	const a = (deg - 90) * Math.PI / 180;
	const dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
	const r = (value: number) => Math.round(value * 10) / 10;
	const cx = 32, cy = 33, r0 = 4, r1 = 28, w = 21;
	const bx = cx + dx * r0, by = cy + dy * r0;
	const tx = cx + dx * r1, ty = cy + dy * r1;
	const blx = bx + px * w / 2, bly = by + py * w / 2;
	const brx = bx - px * w / 2, bry = by - py * w / 2;
	const mlx = cx + dx * (r1 * 0.6) + px * w / 2, mly = cy + dy * (r1 * 0.6) + py * w / 2;
	const mrx = cx + dx * (r1 * 0.6) - px * w / 2, mry = cy + dy * (r1 * 0.6) - py * w / 2;
	const tlx = tx - dx * (r1 * 0.14) + px * (w * 0.16), tly = ty - dy * (r1 * 0.14) + py * (w * 0.16);
	const trx = tx - dx * (r1 * 0.14) - px * (w * 0.16), try_ = ty - dy * (r1 * 0.14) - py * (w * 0.16);
	const nx = tx - dx * (r1 * 0.30), ny = ty - dy * (r1 * 0.30);
	return `M${r(blx)} ${r(bly)} Q${r(mlx)} ${r(mly)} ${r(tlx)} ${r(tly)} Q${r(nx)} ${r(ny)} ${r(trx)} ${r(try_)} Q${r(mrx)} ${r(mry)} ${r(brx)} ${r(bry)} Z`;
};

const sakura = () => filled(
	[0, 72, 144, 216, 288].map((deg) => `<path d="${sakuraPetal(deg)}" fill="#f2a7b8"/>`).join('') + '<circle cx="32" cy="33" r="5" fill="#b3556e"/>',
	[0, 72, 144, 216, 288].map((deg) => `<path d="${sakuraPetal(deg)}" fill="#c77d90"/>`).join(''),
);

export const ICONS = {
	// 操作・ナビ
	kaeshi: () => stroke(path('M24 18 L40 32 L24 46')),
	modoru: () => stroke(path('M45 32 H20 M28 20 L16 32 L28 44')),
	modori: () => stroke(path('M45 19 C33 18 20 23 20 35 V42 M20 42 L12 34 M20 42 L28 34')),
	haguruma: () => stroke('<circle cx="32" cy="32" r="17"/><circle cx="32" cy="32" r="7"/><path d="M32 8 V15 M32 49 V56 M8 32 H15 M49 32 H56 M15 15 L20 20 M44 44 L49 49 M49 15 L44 20 M20 44 L15 49"/>'),
	noki: () => stroke(`${path('M9 30 L32 13 L55 30 M15 30 V48 H49 V30 M24 30 V42 M32 30 V42 M40 30 V42')}`),
	soroban: () => stroke(`${path('M10 32 H54')}<circle cx="20" cy="25" r="6"/><circle cx="33" cy="39" r="6"/><circle cx="46" cy="25" r="6"/>`),
	tomoe: () => stroke(`${path('M33 11 C51 12 57 33 45 45 C35 55 18 49 17 35 C16 25 25 20 31 24 C37 28 34 37 28 37')} ${path('M31 53 C13 52 7 31 19 19 C29 9 46 15 47 29 C48 39 39 44 33 40 C27 36 30 27 36 27')}`),
	yasumi: () => stroke(`${path('M24 17 V47 M40 17 V47')}`),
	sumi: () => stroke(path('M15 34 L27 46 L50 18')),
	ebijou: () => stroke(`${path('M20 29 V23 C20 10 44 10 44 23 V29')}<path d="M15 29 H49 V49 H15 Z M32 36 V42"/>`),
	furoshiki: () => stroke(`${path('M14 27 L32 17 L50 27 L45 49 H19 Z M28 20 C23 10 13 14 19 25 M36 20 C41 10 51 14 45 25')}`),
	contrast: () => svg('<circle cx="32" cy="32" r="21" fill="#f4efe3" stroke="currentColor" stroke-width="4"/><path d="M32 11 A21 21 0 0 0 32 53 Z" fill="currentColor"/>'),

	// ゲーム・道具
	sakura,
	sakuraOutline: () => stroke([0, 72, 144, 216, 288].map((deg) => path(sakuraPetal(deg))).join('') + '<circle cx="32" cy="33" r="5"/>'),
	hasami: () => filled('<path d="M22 12 C12 22 16 42 32 54 C48 42 52 22 42 12 C36 16 35 25 32 31 C29 25 28 16 22 12 Z" fill="#c9a04e"/><path d="M32 31 L18 45 M32 31 L46 45" fill="none"/>', '<path d="M22 12 C12 22 16 42 32 54 C48 42 52 22 42 12 C36 16 35 25 32 31 C29 25 28 16 22 12 Z" fill="#9a7838"/>'),
	ayatori: () => filled('<path d="M14 19 C24 19 28 45 40 45 C48 45 50 31 50 21 M50 19 C40 19 36 45 24 45 C16 45 14 31 14 21" fill="none" stroke="#2d4a73" stroke-width="5"/>'),
	uchimizu: () => filled('<path d="M14 17 H39 L45 26 H20 Z M39 17 V11 H47 V22 M31 32 C27 38 25 41 25 45 A6 6 0 0 0 37 45 C37 41 35 38 31 32 M45 37 C42 41 41 44 41 47 A5 5 0 0 0 51 47 C51 44 49 41 45 37 M55 31 C52 35 51 38 51 41 A4 4 0 0 0 59 41 C59 38 58 35 55 31" fill="#7b86c8"/>', '<path d="M14 17 H39 L45 26 H20 Z" fill="#4d579a"/>'),
	tsuyu: () => filled('<path d="M32 10 C25 21 18 29 18 39 A14 14 0 0 0 46 39 C46 29 39 21 32 10 Z" fill="#7b86c8"/><path d="M23 39 C23 33 27 28 32 22" fill="none" stroke="#f4efe3" stroke-width="2"/>', '<path d="M32 10 C25 21 18 29 18 39 A14 14 0 0 0 46 39 C46 29 39 21 32 10 Z" fill="#4d579a"/>'),

	// メタ画面
	chousei: () => stroke(`${path('M12 18 H26 M38 18 H52 M12 32 H39 M51 32 H52 M12 46 H18 M30 46 H52')}<circle cx="32" cy="18" r="6"/><circle cx="45" cy="32" r="6"/><circle cx="24" cy="46" r="6"/>`),
	choumen: () => stroke(`${path('M17 12 H45 V52 H17 Z M23 16 V48 M27 19 H39 M27 28 H39 M27 37 H39')}<circle cx="22" cy="21" r="1"/><circle cx="22" cy="29" r="1"/><circle cx="22" cy="37" r="1"/><circle cx="22" cy="45" r="1"/>`),
	himekuri: () => stroke(`${path('M14 16 H50 V51 H14 Z M14 27 H50 M23 11 V21 M41 11 V21 M23 37 L30 44 L42 32')}`),
	fumi: () => stroke(`${path('M13 29 H51 L42 45 H22 Z M19 25 L29 17 L45 27 M28 17 L35 25')}`),
	takekago: () => stroke(`${path('M14 25 H50 L45 49 H19 Z M14 25 C19 14 45 14 50 25 M20 32 H44 M22 40 H42 M25 25 L29 49 M39 25 L35 49')}`),
	tanzakuShiori: () => stroke(`${path('M22 10 H42 V54 L32 46 L22 54 Z M32 10 V5')}`),
	fude: () => stroke(`${path('M18 48 L39 15 L49 21 L28 54 Z M39 15 L45 9 L55 15 L49 21 M18 48 L13 55 L28 54')}`),
	makimono: () => stroke(`${path('M18 18 C9 18 9 30 18 30 H43 C52 30 52 42 43 42 H18 M18 18 V42 M43 18 V42')}`),
	toumyou: () => filled('<path d="M19 43 H45 L49 52 H15 Z" fill="#c9a04e"/><path d="M32 11 C23 23 27 35 32 39 C37 35 41 23 32 11 Z" fill="#c4383d"/><path d="M32 19 V43" fill="none"/>', '<path d="M19 43 H45 L49 52 H15 Z" fill="#9a7838"/>'),
	chizu: () => stroke(`${path('M12 18 L26 13 L39 18 L52 13 V46 L39 51 L26 46 L12 51 Z M26 13 V46 M39 18 V51')}`),
	ha: () => stroke(`${path('M15 49 C18 20 43 11 53 14 C50 35 38 51 15 49 M17 48 C28 39 38 29 49 18')}`),
	yunomi: () => filled('<path d="M17 20 H47 L43 48 C40 55 24 55 21 48 Z" fill="#f4efe3"/><path d="M20 28 H44" fill="none" stroke="#2d4a73" stroke-width="2"/>', '<path d="M17 20 H47 L43 48 C40 55 24 55 21 48 Z" fill="#cfc6b0"/>'),
	marumegane: () => stroke(`<circle cx="21" cy="32" r="11"/><circle cx="43" cy="32" r="11"/>${path('M28 26 L36 26 M10 28 L3 25 M54 28 L61 25')}`),
} as const;

export type HanaIconName = keyof typeof ICONS;
