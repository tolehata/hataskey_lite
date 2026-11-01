<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<!--
花常のキャラ図鑑。⚠️backend非依存・本体locale非依存。
進行（storage.ts の Progress）は props で受け取って読むだけ。保存も更新もしない。
⚠️未解放はシルエットと「まだ」だけを出し、名前も出さない（名前自体がネタバレになりうる）。
-->
<template>
<section class="gallery-scope" :data-motion="reducedMotion ? 'reduced' : 'normal'" aria-labelledby="hanaawase-gallery-title">
	<header class="gallery-heading">
		<div>
			<p class="eyebrow">帳面</p>
			<h2 id="hanaawase-gallery-title">{{ detail ? detail.name : "花の名鑑" }}</h2>
		</div>
		<button class="icon-button" type="button" :aria-label="detail ? '名鑑の一覧へ戻る' : 'ホームへ戻る'" @click="goBack">
			<span v-html="ICONS.modori()"></span>
		</button>
	</header>

	<!-- 一覧 -->
	<div v-if="!detail" class="gallery-list">
		<p class="gallery-intro">出会った人が、ここに残ります。</p>
		<p class="gallery-count"><b>{{ openCount }}</b> / {{ GALLERY_CHARS.length }}</p>
		<ul class="gallery-grid">
			<li v-for="card in cards" :key="card.entry.id">
				<button
					v-if="card.unlocked"
					class="card"
					type="button"
					:style="{ '--chara-accent': card.entry.accent }"
					@click="open(card.entry)"
				>
					<span class="card-art">
						<img v-if="card.thumb && shown(card.thumb)" :src="card.thumb" :alt="''" loading="lazy" decoding="async" @error="markFailed(card.thumb)">
						<span v-else class="card-seal">{{ card.entry.name.slice(0, 1) }}</span>
					</span>
					<b>{{ card.entry.name }}</b>
					<small>{{ card.entry.role }}</small>
				</button>
				<div v-else class="card locked" role="img" aria-label="まだ会っていない人">
					<span class="card-art">
						<img v-if="card.thumb && shown(card.thumb)" :src="card.thumb" alt="" aria-hidden="true" loading="lazy" decoding="async" @error="markFailed(card.thumb)">
						<span v-else class="card-seal" aria-hidden="true">?</span>
					</span>
					<b aria-hidden="true">?</b>
					<small>まだ</small>
				</div>
			</li>
		</ul>
	</div>

	<!-- 詳細 -->
	<article v-else class="detail" :style="{ '--chara-accent': detail.accent }">
		<p class="detail-reading">{{ detail.reading }}</p>
		<p class="detail-role">{{ detail.role }}</p>

		<div class="detail-art">
			<figure v-if="detail.hasPose && poseSrc && shown(poseSrc)" class="pose">
				<img :src="poseSrc" :alt="`${detail.name}の立ち絵`" decoding="async" @error="markFailed(poseSrc)">
			</figure>
			<figure v-else class="pose pose-empty" aria-hidden="true">
				<span class="pose-seal">{{ detail.name.slice(0, 1) }}</span>
			</figure>

			<figure v-if="expressionSrc" class="medallion">
				<img :key="expressionSrc" :src="expressionSrc" :alt="`${detail.name}の表情・${faceLabel}`" decoding="async" @error="markFailed(expressionSrc)">
				<figcaption>{{ faceLabel }}</figcaption>
			</figure>
		</div>

		<div v-if="availableFaces.length > 1" class="face-switch" role="group" aria-label="表情の切り替え">
			<button
				v-for="face in availableFaces"
				:key="face.n"
				class="face-chip"
				type="button"
				:aria-pressed="face.n === faceNo"
				:title="face.label"
				@click="faceNo = face.n"
			>
				<img :src="facePath(detail.id, face.n)" :alt="face.label" loading="lazy" decoding="async" @error="markFailed(facePath(detail.id, face.n))">
			</button>
		</div>

		<p class="detail-summary">{{ detail.summary }}</p>

		<dl v-if="detail.facts.length > 0" class="detail-facts">
			<div v-for="fact in detail.facts" :key="fact.label">
				<dt>{{ fact.label }}</dt>
				<dd>{{ fact.value }}</dd>
			</div>
		</dl>

		<section v-if="detail.quotes && detail.quotes.length > 0" class="detail-quotes" aria-label="語録">
			<h3>古帳面から</h3>
			<ul>
				<li v-for="quote in detail.quotes" :key="quote">{{ quote }}</li>
			</ul>
		</section>

		<section v-if="barks.length > 0" class="detail-bark" aria-label="ひとこと">
			<h3>ひとこと</h3>
			<p class="bark-text" aria-live="polite">{{ barkText }}</p>
			<button v-if="barks.length > 1" class="text-button" type="button" @click="nextBark">もうひとこと</button>
		</section>

		<section v-if="stillCards.length > 0" class="detail-stills" aria-label="ひとこま">
			<h3>ひとこま</h3>
			<ul class="still-grid">
				<li v-for="card in stillCards" :key="card.still.file">
					<button v-if="card.unlocked" class="still-tile" type="button" @click="openStill(card.still)">
						<img :src="stillSrc(card.still)" :alt="card.still.title" loading="lazy" decoding="async" @error="markFailed(stillSrc(card.still))">
						<span>{{ card.still.title }}</span>
					</button>
					<div v-else class="still-tile locked" role="img" aria-label="まだ見ていないひとこま">
						<span class="still-lock-mark" aria-hidden="true">?</span>
						<b aria-hidden="true">まだ見ていない</b>
					</div>
				</li>
			</ul>
		</section>
	</article>

	<div v-if="openedStill && detail" class="still-viewer" role="dialog" aria-modal="true" :aria-label="openedStill.title" @click="closeStill">
		<figure @click.stop>
			<img :src="stillSrc(openedStill)" :alt="openedStill.title" decoding="async" @error="closeStill">
			<figcaption>{{ openedStill.title }}</figcaption>
		</figure>
		<button class="still-close" type="button" aria-label="閉じる" @click="closeStill">
			<span v-html="ICONS.modori()"></span>
		</button>
	</div>
</section>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ICONS } from "./icons.js";
import {
	GALLERY_CHARS,
	barksFor,
	bustupPath,
	facePath,
	isUnlocked,
	isStillUnlocked,
	posePath,
	stillPath,
	unlockedCount,
} from "./gallery-data.js";
import type { GalleryChar, GalleryProgress, GalleryStill } from "./gallery-data.js";

const props = defineProps<{
	/** storage.ts の Progress をそのまま渡せる。⚠️読むだけ。 */
	progress: GalleryProgress;
	/** 設定の「アニメーション: 控えめ」。未指定でも prefers-reduced-motion は効く。 */
	reducedMotion?: boolean;
}>();

const emit = defineEmits<{
	(ev: "close"): void;
}>();

/** 読み込みに失敗した画像。⚠️素材が未生成でも壊れないよう、静かに隠すために使う。 */
const failed = ref<Set<string>>(new Set());
const markFailed = (src: string) => { failed.value.add(src); };
const shown = (src: string) => !failed.value.has(src);

const detail = ref<GalleryChar | null>(null);
const faceNo = ref(1);
const barkIndex = ref(0);
const openedStill = ref<GalleryStill | null>(null);

const openCount = computed(() => unlockedCount(props.progress));

const cards = computed(() => GALLERY_CHARS.map((entry) => ({
	entry,
	unlocked: isUnlocked(entry, props.progress),
	thumb: entry.faces.length > 0 ? facePath(entry.id, entry.faces[0].n) : "",
})));

const poseSrc = computed(() => (detail.value && detail.value.hasPose ? posePath(detail.value.id) : ""));

/** 表情差分。⚠️キャラごとに枚数が違うので、存在する番号だけを扱う。 */
const availableFaces = computed(() => {
	const entry = detail.value;
	if (!entry) return [];
	return entry.faces.filter((face) => shown(facePath(entry.id, face.n)));
});

const faceLabel = computed(() => {
	const entry = detail.value;
	if (!entry) return "";
	return entry.faces.find((face) => face.n === faceNo.value)?.label ?? "";
});

/** バストアップがあれば大きく見せ、無ければ表情差分をそのまま見せる。 */
const expressionSrc = computed(() => {
	const entry = detail.value;
	if (!entry) return "";
	if (!entry.faces.some((face) => face.n === faceNo.value)) return "";
	if (faceNo.value <= entry.bustupCount) {
		const bustup = bustupPath(entry.id, faceNo.value);
		if (shown(bustup)) return bustup;
	}
	const face = facePath(entry.id, faceNo.value);
	return shown(face) ? face : "";
});

const barks = computed(() => (detail.value ? barksFor(detail.value.id) : []));
// ⚠️Math.random は使わない。表示は index の巡回だけで決める。
const barkText = computed(() => (barks.value.length === 0 ? "" : barks.value[barkIndex.value % barks.value.length]));
const nextBark = () => { barkIndex.value = (barkIndex.value + 1) % Math.max(1, barks.value.length); };

const stillSrc = (still: GalleryStill) => (detail.value ? stillPath(detail.value.id, still.file) : "");
/**
 * ひとこまは gallery-data.ts の月対応表で解放する。
 * ⚠️未解放も「まだ見ていない」と分かる札で残すが、題と画像は出さない。
 * ⚠️画像の読み込み失敗は、解放判定とは別に従来どおり静かに隠す。
 */
const stillCards = computed(() => {
	const entry = detail.value;
	if (!entry) return [];
	return entry.stills
		.map((still) => ({ still, unlocked: isStillUnlocked(still, props.progress) }))
		.filter((card) => !card.unlocked || shown(stillPath(entry.id, card.still.file)));
});

function open(entry: GalleryChar) {
	if (!isUnlocked(entry, props.progress)) return; // 念のため。未解放は開かない。
	detail.value = entry;
	faceNo.value = entry.faces[0]?.n ?? 1;
	barkIndex.value = 0;
	openedStill.value = null;
}

function goBack() {
	if (openedStill.value) { openedStill.value = null; return; }
	if (detail.value) { detail.value = null; return; }
	emit("close");
}

const openStill = (still: GalleryStill) => { openedStill.value = still; };
const closeStill = () => { openedStill.value = null; };

function onKeydown(event: KeyboardEvent) {
	if (event.key !== "Escape") return;
	if (!openedStill.value && !detail.value) return;
	event.preventDefault();
	goBack();
}

// 詳細を開き直したときに、消えた表情番号へ取り残されないようにする。
watch(availableFaces, (list) => {
	if (list.length === 0) return;
	if (!list.some((face) => face.n === faceNo.value)) faceNo.value = list[0].n;
});

onMounted(() => { window.addEventListener("keydown", onKeydown); });
onUnmounted(() => { window.removeEventListener("keydown", onKeydown); });
</script>

<style lang="scss" scoped>
/*
 * ⚠️色は花常の視覚言語（墨・生成り・金）。index.vue の .hanaawase-scope が定義する
 * --bg / --panel / --ink / --sub / --line / --accent を継承し、単体で置かれたときだけ
 * フォールバックが効く。フォールバック側はライト/ダークの両方を用意する。
 */
.gallery-scope {
	--fb-bg: #2b2620;
	--fb-panel: #3a332b;
	--fb-ink: #f4efe3;
	--fb-sub: #b0a692;
	--fb-line: #4a4238;
	--fb-accent: #c9a04e;
	--g-bg: var(--bg, var(--fb-bg));
	--g-panel: var(--panel, var(--fb-panel));
	--g-ink: var(--ink, var(--fb-ink));
	--g-sub: var(--sub, var(--fb-sub));
	--g-line: var(--line, var(--fb-line));
	--g-accent: var(--accent, var(--fb-accent));
	--chara-accent: var(--g-accent);
	/*
	旗鯖fork: ⚠️キャラの差し色を**文字色にそのまま使わない**。暗い面に載せると最悪 1.89:1（茶系 #6d5a45）で読めない。
	⚠️地の文字色と半々に混ぜた `--chara-ink` を文字専用に用意する（実測: 10色すべてで最悪 5.14:1）。
	⚠️罫・印の輪郭は装飾なので `--chara-accent` のままでよい（文字だけを差し替える）。
	*/
	--chara-ink: color-mix(in srgb, var(--chara-accent) 50%, var(--g-ink));

	container-type: inline-size;
	color: var(--g-ink);
}

/*
⚠️一覧の `.card` と詳細の `.still-tile` は `width: 100%` にpaddingとborderを持つ。
content-boxのままだと列幅の外へ14〜18pxはみ出し、隣の項目へ重なるため、名鑑内はborder-boxで統一する。
*/
.gallery-scope,
.gallery-scope *,
.gallery-scope *::before,
.gallery-scope *::after { box-sizing: border-box; }

@media (prefers-color-scheme: light) {
	.gallery-scope {
		--fb-bg: #f3ece0;
		--fb-panel: #fbf7ee;
		--fb-ink: #2b2620;
		--fb-sub: #6d6353;
		--fb-line: #d9cfba;
		--fb-accent: #9a7838;
	}
}

.gallery-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.eyebrow { margin: 0 0 2px; color: var(--g-sub); font-size: 12px; }
.gallery-heading h2 { margin: 0; font-family: serif; font-size: 26px; letter-spacing: .1em; }
.icon-button { width: 38px; height: 38px; flex: none; padding: 8px; border: 1px solid var(--g-line); border-radius: 50%; color: var(--g-ink); background: var(--g-panel); cursor: pointer; }
.icon-button span { display: block; }

.gallery-intro { margin: 0 0 4px; color: var(--g-sub); font-size: 13px; }
.gallery-count { margin: 0 0 14px; color: var(--g-sub); font-size: 12px; }
.gallery-count b { color: var(--g-accent); font-size: 15px; }

.gallery-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.gallery-grid > li, .still-grid > li { min-width: 0; }
.card {
	display: grid;
	width: 100%;
	gap: 4px;
	padding: 10px 8px 12px;
	border: 1px solid var(--g-line);
	border-radius: 14px;
	color: var(--g-ink);
	/* 和紙の地。二層の淡い斑と紙目の縦線。 */
	background:
		radial-gradient(circle at 24% 18%, rgb(255 255 255 / 5%), transparent 58%),
		repeating-linear-gradient(105deg, rgb(255 255 255 / 3%) 0 1px, transparent 1px 4px),
		var(--g-panel);
	font: inherit;
	text-align: center;
}
.card b { font-family: serif; font-size: 14px; }
.card small { color: var(--g-sub); font-size: 10px; line-height: 1.4; }
button.card { cursor: pointer; transition: transform .18s ease, box-shadow .18s ease; }
button.card:hover, button.card:focus-visible { transform: translateY(-2px); box-shadow: 0 6px 16px rgb(0 0 0 / 22%); }
button.card:focus-visible { outline: 2px solid var(--chara-accent); outline-offset: 2px; }

.card-art { position: relative; display: grid; overflow: hidden; width: 100%; aspect-ratio: 1; place-items: center; border-radius: 10px; background: rgb(0 0 0 / 14%); }
.card-art img { width: 100%; height: 100%; object-fit: contain; }
.card-seal { display: grid; width: 62%; aspect-ratio: 1; place-items: center; border: 1px solid var(--chara-accent); border-radius: 50%; color: var(--chara-ink); font-family: serif; font-size: 20px; }

.card.locked { color: var(--g-sub); }
.card.locked .card-art img { filter: brightness(0) opacity(.34); }
.card.locked b { color: var(--g-line); }

/* --- 詳細 --- */
.detail-reading { margin: 0; color: var(--g-sub); font-size: 12px; letter-spacing: .08em; }
.detail-role { margin: 2px 0 14px; color: var(--chara-ink); font-family: serif; font-size: 14px; }

.detail-art { position: relative; display: flex; align-items: flex-end; gap: 12px; padding: 12px; border: 1px solid var(--g-line); border-radius: 16px; background: linear-gradient(180deg, rgb(0 0 0 / 10%), transparent 46%), var(--g-panel); }
.pose { flex: 1 1 58%; margin: 0; }
.pose img { display: block; width: 100%; max-height: 320px; object-fit: contain; }
.pose-empty { display: grid; min-height: 190px; place-items: center; }
.pose-seal { display: grid; width: 96px; aspect-ratio: 1; place-items: center; border: 1px solid var(--chara-accent); border-radius: 50%; color: var(--chara-ink); font-family: serif; font-size: 34px; }
.medallion { flex: 0 0 38%; margin: 0 0 6px; text-align: center; }
.medallion img { display: block; width: 100%; aspect-ratio: 1; border: 1px solid var(--chara-accent); border-radius: 50%; object-fit: cover; background: rgb(0 0 0 / 16%); animation: hana-gallery-face 220ms ease-out; }
.medallion figcaption { margin-top: 6px; color: var(--g-sub); font-size: 11px; }

.face-switch { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 4px; }
.face-chip { width: 46px; height: 46px; padding: 2px; border: 1px solid var(--g-line); border-radius: 12px; background: rgb(0 0 0 / 14%); cursor: pointer; transition: transform .16s ease, border-color .16s ease; }
.face-chip img { display: block; width: 100%; height: 100%; object-fit: contain; }
.face-chip:hover { transform: translateY(-2px); }
.face-chip[aria-pressed="true"] { border-color: var(--chara-accent); box-shadow: inset 0 0 0 1px var(--chara-accent); }

.detail-summary { margin: 14px 0; font-size: 14px; line-height: 1.9; }
.detail-facts { display: grid; gap: 0; margin: 0 0 18px; }
.detail-facts > div { display: flex; gap: 12px; padding: 9px 2px; border-bottom: 1px solid var(--g-line); }
.detail-facts dt { flex: 0 0 68px; color: var(--g-sub); font-size: 12px; }
.detail-facts dd { margin: 0; font-size: 13px; line-height: 1.7; }

.detail-quotes, .detail-bark, .detail-stills { margin: 0 0 18px; }
.detail-quotes h3, .detail-bark h3, .detail-stills h3 { margin: 0 0 8px; color: var(--g-sub); font-family: serif; font-size: 13px; font-weight: 400; letter-spacing: .12em; }
.detail-quotes ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.detail-quotes li { padding: 10px 12px; border-left: 2px solid var(--chara-accent); border-radius: 0 10px 10px 0; background: rgb(0 0 0 / 12%); font-family: serif; font-size: 14px; }
.bark-text { min-height: 3.4em; margin: 0 0 6px; padding: 12px 14px; border: 1px solid var(--g-line); border-radius: 14px; background: rgb(0 0 0 / 12%); font-family: serif; font-size: 14px; line-height: 1.8; }
.text-button { border: 0; color: var(--g-sub); background: transparent; font: inherit; font-size: 12px; cursor: pointer; }
.text-button:hover, .text-button:focus-visible { color: var(--g-ink); }

.still-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
.still-tile { display: grid; width: 100%; gap: 5px; padding: 6px; border: 1px solid var(--g-line); border-radius: 12px; color: var(--g-sub); background: var(--g-panel); font: inherit; cursor: pointer; transition: transform .16s ease; }
.still-tile:hover { transform: translateY(-2px); }
.still-tile img { display: block; width: 100%; aspect-ratio: 16 / 10; border-radius: 8px; object-fit: cover; }
.still-tile span { font-size: 11px; }
.still-tile.locked { min-height: 116px; place-content: center; justify-items: center; color: var(--g-sub); background: linear-gradient(145deg, rgb(255 255 255 / 4%), rgb(0 0 0 / 11%)), var(--g-panel); cursor: default; }
.still-tile.locked:hover { transform: none; }
.still-tile.locked .still-lock-mark { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid var(--g-line); border-radius: 50%; color: var(--g-ink); font-family: serif; font-size: 18px; }
.still-tile.locked b { font-size: 11px; font-weight: 400; letter-spacing: .08em; }

.still-viewer { position: fixed; inset: 0; z-index: 40; display: grid; padding: 20px; place-items: center; background: rgb(18 15 12 / 82%); }
.still-viewer figure { max-width: min(880px, 92vw); margin: 0; text-align: center; }
.still-viewer img { display: block; width: 100%; max-height: 76vh; border: 1px solid var(--chara-accent); border-radius: 14px; object-fit: contain; }
.still-viewer figcaption { margin-top: 10px; color: #f4efe3; font-family: serif; font-size: 13px; }
.still-close { position: absolute; top: 16px; right: 16px; width: 40px; height: 40px; padding: 9px; border: 1px solid #4a4238; border-radius: 50%; color: #f4efe3; background: #3a332b; cursor: pointer; }
.still-close span { display: block; }

/* ⚠️アニメは transform と opacity のみ。 */
@keyframes hana-gallery-face {
	0% { opacity: 0; transform: scale(.94); }
	100% { opacity: 1; transform: scale(1); }
}

.gallery-scope[data-motion="reduced"] .medallion img { animation: none; }
.gallery-scope[data-motion="reduced"] button.card,
.gallery-scope[data-motion="reduced"] .face-chip,
.gallery-scope[data-motion="reduced"] .still-tile { transition: none; }
.gallery-scope[data-motion="reduced"] button.card:hover,
.gallery-scope[data-motion="reduced"] .face-chip:hover,
.gallery-scope[data-motion="reduced"] .still-tile:hover { transform: none; }

@media (prefers-reduced-motion: reduce) {
	.medallion img { animation: none; }
	button.card, .face-chip, .still-tile { transition: none; }
	button.card:hover, .face-chip:hover, .still-tile:hover { transform: none; }
}

/* ⚠️画面幅ではなく、Misskeyの小窓内で名鑑に実際に与えられた幅を見る。 */
@container (max-width: 420px) {
	.gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.detail-art { flex-direction: column; align-items: center; }
	.pose, .medallion { flex: none; width: 100%; }
	.medallion { max-width: 190px; }
}
</style>
