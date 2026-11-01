<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(#34): 地震・津波情報の日本地図。
  - 都道府県GeoJSON(出典: Natural Earth・PD。簡略化版)をSVG描画。
  - 震源に □+最大震度 のマーカーを配置。クリックで選択(右ペインに最終報を表示)。
  - 津波予報のあった都道府県を湾岸色でマーキング。
  - マウスドラッグ/タッチでパン、ホイール/ピンチでズーム。選択地点へは滑らかにズーム。
-->
<template>
<div :class="$style.wrap">
	<div v-if="loading" :class="$style.loading">地図を読み込み中…</div>
	<svg
		v-else ref="svgEl" :viewBox="`0 0 ${W} ${boundsRef.H}`" :class="$style.svg"
		preserveAspectRatio="xMidYMid meet"
		@pointerdown="onPointerDown" @pointermove="onPointerMove"
		@pointerup="onPointerUp" @pointercancel="onPointerUp" @wheel="onWheel"
	>
		<g :transform="transform" :class="{ [$style.animated]: transitionOn }">
			<!-- 津波: 海岸ハロー(下層)。太い色付き枠を県の塗りの「下」に敷くことで、
			     内陸側の枠は隣県の塗りに覆われて消え、海に面した海岸部分だけが色付いて見える。 -->
			<path
				v-for="p in tsunamiPrefPaths" :key="'tw' + p.name" :d="p.d"
				fill="none" :stroke="tsunamiColorOf(p.name)" :stroke-width="strokeW * 3"
				stroke-linejoin="round" stroke-linecap="round" :opacity="0.9"
			/>
			<!-- 都道府県(塗りは常に通常色。津波県も内陸は塗らない) -->
			<path
				v-for="p in prefPaths" :key="p.name" :d="p.d"
				:class="$style.pref" :style="{ strokeWidth: strokeW }"
			/>
			<!-- 旗鯖fork: 市区町村詳細(ズーム時のみ・該当県をオンデマンド読込)。震度があれば色塗り。 -->
			<path
				v-for="c in cityFeatures" :key="c.key" :d="c.d"
				:fill="c.scale >= 10 ? scaleToColor(c.scale) : 'color-mix(in srgb, var(--MI_THEME-fg) 4%, var(--MI_THEME-panel))'"
				:stroke="c.scale >= 10 ? 'rgba(0,0,0,.35)' : 'color-mix(in srgb, var(--MI_THEME-fg) 28%, transparent)'"
				:stroke-width="strokeW * 0.6" stroke-linejoin="round"
			/>
			<!-- 旗鯖fork: 市区町村ごとの震度マーク(重心に震度を表示) -->
			<g v-for="c in cityMarks" :key="'cm' + c.key" :transform="`translate(${c.cx},${c.cy})`" style="pointer-events:none">
				<rect
					:x="-cityMarkSize/2" :y="-cityMarkSize/2" :width="cityMarkSize" :height="cityMarkSize" :rx="cityMarkSize*0.24"
					:fill="scaleToColor(c.scale)" stroke="rgba(255,255,255,.9)" :stroke-width="strokeW*0.45"
				/>
				<text text-anchor="middle" dominant-baseline="central" :font-size="cityMarkSize*0.58" :fill="scaleTextColor(c.scale)" font-weight="900">{{ scaleToLabel(c.scale) }}</text>
			</g>
			<!-- 震源マーカー -->
			<g
				v-for="m in markers" :key="m.id"
				:transform="`translate(${m.x},${m.y})`"
				:class="[$style.marker, { [$style.selected]: m.id === selectedId }]"
				@click="onMarkerClick(m, $event)"
			>
				<rect
					:x="-m.size/2" :y="-m.size/2" :width="m.size" :height="m.size" :rx="m.size*0.16"
					:fill="m.color" :stroke="m.id === selectedId ? '#fff' : 'rgba(0,0,0,.45)'" :stroke-width="m.id === selectedId ? strokeW*2.5 : strokeW"
					:opacity="m.dim ? 0.78 : 1"
				/>
				<text text-anchor="middle" dominant-baseline="central" :font-size="m.size*0.56" :fill="m.textColor" font-weight="900">{{ m.label }}</text>
			</g>
		</g>
	</svg>
	<button v-if="isMoved" :class="$style.resetBtn" @click="resetAll"><i class="ti ti-zoom-out"></i> 全国</button>
</div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, shallowRef, watch, useTemplateRef } from 'vue';
import { scaleToColor, scaleToLabel, scaleTextColor, PREFECTURES, prefNameToCode } from '@/utility/earthquake.js';

const props = defineProps<{
	quakes: any[];
	tsunami: any[];
	selectedId: string | null;
	zoomQuake: any | null;
	// 旗鯖fork: 未選択時のデフォルトで市区町村レベルの震度マップを描画する地震(通常は最新地震)。ズームはしない。
	defaultQuake?: any | null;
}>();

const emit = defineEmits<{ (e: 'select', id: string, ev: Event): void; (e: 'resetZoom'): void }>();

const GEO_URL = '/client-assets/geo/japan-prefectures.geojson';
const loading = ref(true);
const geo = shallowRef<any>(null);
const svgEl = useTemplateRef<SVGSVGElement>('svgEl');

const W = 1000;
// 投影は「主要4島＋沖縄本島」中心の固定枠にする。
//   GeoJSONの実extentは与那国(lon122.9)や小笠原(lat24.7)まで広がり、本州が右上に押し込まれて
//   震源が大きくズレて見えるため、固定枠で本州を中央に綺麗に収める。
const FIXED = { minLon: 126.5, maxLon: 146.5, minLat: 26.0, maxLat: 46.0 };
function makeBounds() {
	const { minLon, maxLon, minLat, maxLat } = FIXED;
	const kx = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
	const sx = W / ((maxLon - minLon) * kx);
	return { minLon, maxLon, minLat, maxLat, kx, sx, H: (maxLat - minLat) * sx };
}
const boundsRef = ref(makeBounds());
function px(lon: number) { const b = boundsRef.value; return (lon - b.minLon) * b.kx * b.sx; }
function py(lat: number) { const b = boundsRef.value; return (b.maxLat - lat) * b.sx; }
function H() { return boundsRef.value.H; }

const prefPaths = computed<{ name: string; d: string }[]>(() => {
	if (!geo.value) return [];
	const out: { name: string; d: string }[] = [];
	for (const f of geo.value.features) {
		let d = '';
		for (const poly of f.geometry.coordinates) {
			for (const ring of poly) {
				for (let i = 0; i < ring.length; i++) {
					d += (i === 0 ? 'M' : 'L') + px(ring[i][0]).toFixed(1) + ',' + py(ring[i][1]).toFixed(1);
				}
				d += 'Z';
			}
		}
		out.push({ name: f.properties.name, d });
	}
	return out;
});

function validEpicenter(q: any): boolean {
	const h = q?.earthquake?.hypocenter;
	if (!h) return false;
	const lat = h.latitude, lon = h.longitude;
	return typeof lat === 'number' && typeof lon === 'number' && lat >= 20 && lat <= 50 && lon >= 120 && lon <= 150;
}

// ===== ビューポート(パン/ズーム) =====
const view = ref({ scale: 1, tx: 0, ty: 0 });
const transitionOn = ref(false);
const transform = computed(() => `translate(${view.value.tx},${view.value.ty}) scale(${view.value.scale})`);
const invScale = computed(() => 1 / view.value.scale);
const strokeW = computed(() => 2.6 * invScale.value);
const cityMarkSize = computed(() => 22 * invScale.value);
const isMoved = computed(() => view.value.scale !== 1 || view.value.tx !== 0 || view.value.ty !== 0);

function clampScale(s: number) { return Math.min(14, Math.max(1, s)); }
function zoomAround(vbX: number, vbY: number, newScale: number) {
	const s = view.value.scale;
	const gx = (vbX - view.value.tx) / s;
	const gy = (vbY - view.value.ty) / s;
	view.value = { scale: newScale, tx: vbX - gx * newScale, ty: vbY - gy * newScale };
}
function zoomToView(x: number, y: number, targetScale: number) {
	transitionOn.value = true;
	view.value = { scale: targetScale, tx: W / 2 - x * targetScale, ty: H() / 2 - y * targetScale };
}
function resetAll() {
	transitionOn.value = true;
	view.value = { scale: 1, tx: 0, ty: 0 };
	emit('resetZoom');
}

// pointer(マウス/タッチ統一)
const pointers = new Map<number, { x: number; y: number }>();
let lastPan: { x: number; y: number } | null = null;
let lastPinch = 0;
let panMoved = false;

function clientToVb(cx: number, cy: number) {
	const rect = svgEl.value!.getBoundingClientRect();
	return { x: (cx - rect.left) / rect.width * W, y: (cy - rect.top) / rect.height * H() };
}
function onPointerDown(e: PointerEvent) {
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	transitionOn.value = false;
	panMoved = false;
	if (pointers.size === 1) lastPan = { x: e.clientX, y: e.clientY };
	else if (pointers.size === 2) lastPinch = pinchDist();
}
function onPointerMove(e: PointerEvent) {
	if (!pointers.has(e.pointerId)) return;
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	if (!svgEl.value) return;
	const ratio = W / svgEl.value.getBoundingClientRect().width;
	if (pointers.size >= 2) {
		const d = pinchDist();
		if (lastPinch > 0) {
			const mid = pinchMid();
			const vb = clientToVb(mid.x, mid.y);
			zoomAround(vb.x, vb.y, clampScale(view.value.scale * d / lastPinch));
			panMoved = true;
		}
		lastPinch = d;
	} else if (lastPan) {
		const dx = (e.clientX - lastPan.x) * ratio;
		const dy = (e.clientY - lastPan.y) * ratio;
		if (Math.abs(e.clientX - lastPan.x) + Math.abs(e.clientY - lastPan.y) > 3) panMoved = true;
		view.value = { ...view.value, tx: view.value.tx + dx, ty: view.value.ty + dy };
		lastPan = { x: e.clientX, y: e.clientY };
	}
}
function onPointerUp(e: PointerEvent) {
	pointers.delete(e.pointerId);
	if (pointers.size < 2) lastPinch = 0;
	const rest = [...pointers.values()];
	lastPan = rest.length === 1 ? { x: rest[0].x, y: rest[0].y } : null;
}
function pinchDist() {
	const p = [...pointers.values()];
	if (p.length < 2) return 0;
	return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
}
function pinchMid() {
	const p = [...pointers.values()];
	return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
}
function onWheel(e: WheelEvent) {
	e.preventDefault();
	if (!svgEl.value) return;
	transitionOn.value = false;
	const vb = clientToVb(e.clientX, e.clientY);
	const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
	zoomAround(vb.x, vb.y, clampScale(view.value.scale * factor));
}

function onMarkerClick(m: any, ev: Event) {
	if (panMoved) return; // ドラッグ後のクリックは無視
	emit('select', m.id, ev);
}

const markers = computed(() => {
	const list: any[] = [];
	props.quakes.forEach((q, idx) => {
		if (!validEpicenter(q)) return;
		const h = q.earthquake.hypocenter;
		const scale = q.earthquake?.maxScale ?? -1;
		list.push({
			id: q._key ?? q.id,
			x: px(h.longitude), y: py(h.latitude),
			color: scaleToColor(scale),
			textColor: scaleTextColor(scale),
			label: scaleToLabel(scale),
			size: (40 + Math.max(0, scale - 10) * 0.6) * invScale.value,
			dim: idx > 0 && (q._key ?? q.id) !== props.selectedId,
		});
	});
	list.sort((a, b) => (a.id === props.selectedId ? 1 : 0) - (b.id === props.selectedId ? 1 : 0));
	return list;
});

const tsunamiPrefs = computed<Map<string, string>>(() => {
	const m = new Map<string, string>();
	const order: Record<string, number> = { MajorWarning: 3, Warning: 2, Watch: 1 };
	for (const t of props.tsunami) {
		if (!t || t.cancelled === true) continue;
		for (const a of (t.areas ?? [])) {
			for (const pref of PREFECTURES) {
				if (typeof a.name === 'string' && a.name.includes(pref)) {
					const cur = m.get(pref);
					if (cur == null || (order[a.grade] ?? 0) > (order[cur] ?? 0)) m.set(pref, a.grade);
				}
			}
		}
	}
	return m;
});
function tsunamiColorOf(pref: string): string {
	const g = tsunamiPrefs.value.get(pref);
	if (g === 'MajorWarning') return '#ad02ad';
	if (g === 'Warning') return '#ff2800';
	return '#e8a000';
}
// 津波対象県のパスだけ(海岸ハロー描画用)。
const tsunamiPrefPaths = computed(() => prefPaths.value.filter(p => tsunamiPrefs.value.has(p.name)));

// 選択地震が変わったら、その震源へ滑らかにズーム。
watch(() => props.zoomQuake, (q) => {
	if (q && validEpicenter(q)) {
		zoomToView(px(q.earthquake.hypocenter.longitude), py(q.earthquake.hypocenter.latitude), 5);
	} else {
		// 選択解除されたら全国表示へ戻す。
		transitionOn.value = true;
		view.value = { scale: 1, tx: 0, ty: 0 };
	}
	loadCitiesFor(q ?? props.defaultQuake ?? null);
});
// 旗鯖fork: defaultQuake(最新地震)が変わったときも、選択中でなければ市区町村震度を更新する。
watch(() => props.defaultQuake, (q) => {
	if (props.zoomQuake) return;
	loadCitiesFor(q ?? null);
});

// ===== 市区町村詳細(ズーム時のみ・該当都道府県をオンデマンド読込) =====
const CITY_BASE = '/client-assets/geo/cities/';
const cityCache = new Map<string, any>();
const cityFeatures = shallowRef<{ key: string; d: string; scale: number; cx: number; cy: number }[]>([]);
// 震度を観測した市区町村のみ、重心に震度マークを出す。
const cityMarks = computed(() => cityFeatures.value.filter(c => c.scale >= 10));

async function fetchCity(code: string): Promise<any> {
	if (cityCache.has(code)) return cityCache.get(code);
	try {
		const res = await fetch(CITY_BASE + code + '.geojson');
		const json = await res.json();
		cityCache.set(code, json);
		return json;
	} catch { cityCache.set(code, null); return null; }
}

async function loadCitiesFor(q: any) {
	if (!q || !validEpicenter(q)) { cityFeatures.value = []; return; }
	// 震度を観測した都道府県(強い順・最大6県)＋addr→最大震度。
	const prefMax = new Map<string, number>();
	const addrScale = new Map<string, number>();
	for (const p of (q.points ?? [])) {
		if (typeof p.scale !== 'number' || p.scale < 10) continue;
		if (p.pref && (prefMax.get(p.pref) ?? -1) < p.scale) prefMax.set(p.pref, p.scale);
		if (p.addr && (addrScale.get(p.addr) ?? -1) < p.scale) addrScale.set(p.addr, p.scale);
	}
	const prefs = [...prefMax.keys()].sort((a, b) => (prefMax.get(b) ?? 0) - (prefMax.get(a) ?? 0)).slice(0, 6);
	if (prefs.length === 0) { cityFeatures.value = []; return; }

	const myKey = q._key;
	const geos = await Promise.all(prefs.map(pref => {
		const code = prefNameToCode(pref);
		return code ? fetchCity(code) : Promise.resolve(null);
	}));
	// 対象が変わっていたら破棄(選択 or デフォルトのどちらでも判定)。
	const currentKey = props.zoomQuake?._key ?? props.defaultQuake?._key ?? null;
	if (currentKey !== myKey) return;

	const out: { key: string; d: string; scale: number; cx: number; cy: number }[] = [];
	for (const g of geos) {
		if (!g) continue;
		for (const f of g.features) {
			const nm = f.properties.name as string;
			// P2PQuakeのaddrとマッチ(完全一致→部分一致)して震度を引く。
			let scale = addrScale.get(nm) ?? -1;
			if (scale < 10 && nm) {
				for (const [addr, s] of addrScale) {
					if (addr && (nm.includes(addr) || addr.includes(nm)) && s > scale) scale = s;
				}
			}
			let d = '';
			let sx = 0, sy = 0, cnt = 0;
			for (const poly of f.geometry.coordinates) {
				for (const ring of poly) {
					for (let i = 0; i < ring.length; i++) {
						const X = px(ring[i][0]); const Y = py(ring[i][1]);
						d += (i === 0 ? 'M' : 'L') + X.toFixed(1) + ',' + Y.toFixed(1);
						sx += X; sy += Y; cnt++;
					}
					d += 'Z';
				}
			}
			out.push({ key: (f.properties.code ?? nm) + '', d, scale, cx: cnt ? sx / cnt : 0, cy: cnt ? sy / cnt : 0 });
		}
	}
	cityFeatures.value = out;
}

async function loadGeo() {
	try {
		const res = await fetch(GEO_URL);
		const json = await res.json();
		geo.value = json;
	} catch { /* 失敗時は地図なし */ } finally {
		loading.value = false;
	}
}
onMounted(async () => {
	await loadGeo();
	// 初期表示時に選択中の地震 or デフォルト地震があれば市区町村震度を読み込む。
	const initQuake = props.zoomQuake ?? props.defaultQuake ?? null;
	if (initQuake) loadCitiesFor(initQuake);
});
</script>

<style lang="scss" module>
/* 海(背景)を薄い青にして陸地と区別。両モードで効くよう bg に青を少量ミックス。 */
.wrap { position: relative; width: 100%; height: 100%; min-height: 280px; border-radius: 8px; overflow: hidden; background: color-mix(in srgb, #3d8bd4 14%, var(--MI_THEME-bg)); }
.loading { display: flex; align-items: center; justify-content: center; height: 100%; min-height: 280px; opacity: .5; }
.svg { width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; user-select: none; }
.svg:active { cursor: grabbing; }
.animated { transition: transform .45s cubic-bezier(.22,.61,.36,1); }

/* 陸地: パネル寄りの明確な塗り。境界線はテーマ文字色ベースで両モードとも視認できる色に。 */
.pref {
	fill: color-mix(in srgb, var(--MI_THEME-fg) 6%, var(--MI_THEME-panel));
	stroke: color-mix(in srgb, var(--MI_THEME-fg) 55%, transparent);
	transition: fill .2s;
}

.marker { cursor: pointer; }
.marker:hover rect { stroke: var(--MI_THEME-accent); }
.selected { filter: drop-shadow(0 0 4px rgba(0,0,0,.5)); }

.resetBtn {
	position: absolute; top: 8px; right: 8px;
	background: var(--MI_THEME-panel); color: var(--MI_THEME-fg);
	border: 1px solid var(--MI_THEME-divider); border-radius: 8px;
	padding: 4px 10px; font-size: .82em; cursor: pointer;
	display: inline-flex; align-items: center; gap: 4px;
}
.resetBtn:hover { background: var(--MI_THEME-buttonHoverBg); }
</style>
