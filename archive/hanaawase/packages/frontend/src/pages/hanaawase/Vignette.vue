<!--
花常: ビネット（物語）の再生。

⚠️本体非依存。locales / preferences / achievements を参照しない（パージ容易性）。
⚠️Math.random 不使用。
⚠️アニメは transform と opacity のみ。`prefers-reduced-motion` と設定の「動きOFF」で全停止する。
⚠️CSS Modules は使わない（$style[動的] は静的解決されないため）。分岐は data-* 属性で書く。

スキップ（SPEC の設計確定分）:
  1スキップ単位 = 1ビネット。章単位のスキップは作らない。
  「この場面を送る」→ あらすじ付きの確認 →「読む／送る」の対等な2ボタン。
  ⚠️選択肢はスキップしない。スキップは必ず選択肢の手前に着地する。
  ⚠️あらすじを見られるのは再生中＝到達済みの場面だけなので、未読の先はネタバレしない。
-->
<template>
<div
	class="hana-vignette"
	:data-kind="vignette.kind"
	:data-reduced="reduced ? 'on' : 'off'"
	role="region"
	:aria-label="`物語 ${vignette.title}`"
	tabindex="0"
	@keydown="onKeydown"
	@click="onScreenTap"
>
	<!-- ⚠️背景と立ち絵は兄弟。親子にすると Ken Burns の transform が子の基準を壊す（SPEC §9.7.6-3） -->
	<div class="backdrop" :data-css="backdropIsCss ? 'on' : 'off'" :data-bg="backdropId ?? 'none'" aria-hidden="true">
		<img v-if="!backdropIsCss && backdropId" :src="backdropSrc" alt="" @error="onBackdropError">
	</div>

	<header class="bar">
		<p class="title">{{ vignette.title }}</p>
		<div v-if="!ended" class="bar-actions">
			<button class="later" type="button" @click="defer">今回は読まない</button>
			<button class="skip" type="button" aria-label="この場面を送る" @click="askSkip">この場面を送る</button>
		</div>
	</header>

	<!--
	⚠️立ち絵は「枠より奥・枠より上」に置く。grid の2行目（1fr）に置き、下端だけ枠の裏へ潜らせる。
	絶対配置で vh を使うと小窓で破綻するので、寸法は必ず「この器の幅」から決める（SPEC §0.4）。
	-->
	<div v-if="portraitChar && !portraitFailed" class="portrait" :data-speaker="portraitChar" :data-emo="portraitEmo" :data-beat="beat" aria-hidden="true">
		<img :src="portraitSrc" alt="" @error="onPortraitError">
	</div>
	<div v-else-if="portraitMissing" class="portrait silhouette" :data-emo="portraitEmo" :data-beat="beat" aria-hidden="true"><span></span></div>

	<!-- 帳面: 横書き。現在の枝を一度に出し、必要なら縦スクロールで読む -->
	<div v-if="vignette.kind === 'chomen'" ref="chomenBody" class="chomen" role="article" aria-live="polite">
		<p v-for="entry in shown" :key="entry.index" class="chomen-line" :data-blank="entry.line.text === '' ? 'on' : 'off'">{{ entry.line.text }}</p>
	</div>

	<!-- 場面: 会話枠 -->
	<!--
	⚠️ここに `@click="advance"` を戻さないこと。
	⚠️器（`.hana-vignette`）側で受けているので、両方に付けると**1回のタップで2行進む**。
	-->
	<div v-else class="box" role="article" aria-live="polite">
		<p v-if="currentName" class="name" :data-speaker="currentSpeaker">{{ currentName }}</p>
		<p :key="cursor" class="text" :data-kind="currentLine?.kind ?? 'narration'">{{ currentText }}</p>
	</div>

	<div class="foot">
		<!--
		⚠️「どこでもタップで進む」を入れたあとも、送るボタンは残す。
		⚠️消すと「押す場所が無い」画面になり、初見の人が進め方を掴めない。
		-->
		<button v-if="!choice && !ended" class="next" type="button" @click="advance">送る</button>
		<button v-else-if="ended" class="next" type="button" @click="finish">とじる</button>
		<!-- ⚠️案内。⚠️一度タップしたら出さない（毎回出ると読書の邪魔になる） -->
		<p v-if="showTapHint && !choice && !ended" class="tap-hint">画面のどこをタップしても進みます</p>
	</div>

	<!-- 選択肢。⚠️スキップしてもここは飛ばさない -->
	<div v-if="choice" class="choice" role="group" :aria-label="`選択 ${choice.label}`">
		<p class="choice-title">{{ choice.label }}</p>
		<div class="choice-buttons">
			<button v-for="option in choice.options" :key="option.key" type="button" @click="pick(option.key)">{{ option.label }}</button>
		</div>
	</div>

	<!-- スキップ確認。あらすじを見せてから、対等な2ボタン -->
	<div v-if="confirming" class="confirm" role="dialog" aria-modal="true" aria-labelledby="hana-skip-title">
		<div class="confirm-card">
			<h2 id="hana-skip-title">この場面を送りますか</h2>
			<p class="synopsis">{{ vignette.synopsis }}</p>
			<p class="note">送っても、あとから読み返せます。選択肢は送りません。</p>
			<div class="confirm-buttons">
				<button type="button" @click="confirming = false">読む</button>
				<button type="button" @click="doSkip">送る</button>
			</div>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { backdropAt, resolveStep, skipTo, speakerName } from "./story/index.js";
import type { Choice, ChoiceKey, ChoiceRecord, Line, Vignette } from "./story/index.js";
import { bustupPath } from "./menu-dialogue.js";
import { bgPath } from "./backdrop.js";
import { eventAssetPath } from "./events.js";

const props = withDefaults(defineProps<{
	vignette: Vignette;
	choices: ChoiceRecord;
	/** ゲーム設定の動き。"reduced" で演出を止める。 */
	motion?: "normal" | "reduced";
	/** イベント本文のときだけ渡す限定キャラ・背景の所在。 */
	eventAssets?: Readonly<{
		id: string;
		rev: number;
		faces: string;
		backgrounds: Readonly<Record<string, Readonly<{ file: string; fallback: string }>>>;
	}>;
}>(), { motion: "normal" });

const emit = defineEmits<{
	(event: "choose", payload: { choiceId: string; key: ChoiceKey }): void;
	(event: "finish", vignetteId: string): void;
	/** 今回だけ未読のまま保留する。保存しないので次セッションでは再提示できる。 */
	(event: "defer"): void;
}>();

/**
 * 既存の本文タグに対応する背景の決定的な差分。
 * 新しい本文タグを増やさず、場面IDから同じ絵を選ぶ。Math.random は使わない。
 * ここにあるIDは bg/<id>.webp を実在させること。失敗時だけ下のCSS代替へ戻る。
 */
const BACKDROP_VARIANTS: Readonly<Record<string, readonly string[]>> = {
	shop_day: ["shop_day", "nf_shop_rain_day"],
	shop_evening: ["shop_evening", "nf_shop_rain_evening"],
	workroom: ["workroom", "nf_workroom_morning", "nf_workroom_night"],
	front_spring: ["front_spring", "nf_front_spring_rain"],
	front_summer: ["front_summer", "nf_front_summer_rain"],
	front_autumn: ["front_autumn", "nf_front_autumn_rain"],
	front_winter: ["front_winter", "nf_front_winter_snow"],
	market: ["nf_market_dawn", "nf_market_auction", "nf_market_winter", "nf_market_summer", "nf_market_rain"],
	street: ["nf_street_morning", "nf_street_evening", "nf_street_night", "nf_street_rain", "nf_street_snow"],
	indoor_other: ["nf_station_morning", "nf_station_snow", "nf_cafe_day", "nf_cafe_evening", "nf_library_day", "nf_union_office_day", "nf_home_evening"],
	outskirt: ["nf_hillside_spring", "nf_hillside_summer", "nf_hillside_autumn", "nf_hillside_winter", "nf_hillside_night"],
};

/** face の実ファイル数。範囲外パスを組み立てない（404防止）。 */
const FACE_COUNT = {
	wakana: 21,
	ren: 21,
	yae: 4,
	inukai: 4,
	naito: 3,
	tatsumi: 3,
	gen: 3,
	amamiya: 3,
	haruno: 3,
} as const;
type PortraitChar = keyof typeof FACE_COUNT;
type ShownPortraitChar = PortraitChar | "evt";

/** 本文の表示名を、素材を持つサブキャストだけへ対応付ける。通行人や声だけの人物は出さない。 */
const SUB_PORTRAITS: readonly { readonly id: Exclude<PortraitChar, "wakana" | "ren">; readonly names: readonly string[] }[] = [
	{ id: "yae", names: ["八重"] },
	{ id: "inukai", names: ["犬飼"] },
	{ id: "naito", names: ["内藤"] },
	{ id: "tatsumi", names: ["辰巳"] },
	{ id: "gen", names: ["玄"] },
	{ id: "amamiya", names: ["雨宮"] },
	{ id: "haruno", names: ["春野"] },
];

function stableIndex(source: string, size: number): number {
	let hash = 2166136261;
	for (let i = 0; i < source.length; i++) {
		hash ^= source.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) % size;
}

function subPortraitOf(name: string | undefined): PortraitChar | undefined {
	if (!name) return undefined;
	return SUB_PORTRAITS.find((entry) => entry.names.some((prefix) => name.startsWith(prefix)))?.id;
}

const localChoices = ref<Record<string, ChoiceKey>>({ ...props.choices });
const cursor = ref(0);
const choice = ref<Choice>();
const ended = ref(false);
const confirming = ref(false);
const skipping = ref(false);
const beat = ref(0);
const shown = ref<{ index: number; line: Line }[]>([]);
const eventBackdropFailed = ref(false);
const regularBackdropFailed = ref(false);
const portraitFailedSrc = ref("");
const chomenBody = ref<HTMLElement>();
const systemReduced = ref(false);
let mediaQuery: MediaQueryList | undefined;
const onMediaChange = () => { systemReduced.value = mediaQuery?.matches === true; };

const reduced = computed(() => props.motion === "reduced" || systemReduced.value);
const currentLine = computed<Line | undefined>(() => shown.value[shown.value.length - 1]?.line);
const currentText = computed(() => currentLine.value?.text ?? "");
const currentSpeaker = computed(() => (currentLine.value?.kind === "say" ? currentLine.value.speaker : "narration"));
const currentName = computed(() => (currentLine.value ? speakerName(currentLine.value) : undefined));

const portraitChar = computed<ShownPortraitChar | undefined>(() => {
	const line = currentLine.value;
	if (line?.kind !== "say") return undefined;
	if (line.speaker === "wakana" || line.speaker === "ren") return line.speaker;
	if (line.speaker === "evt") return "evt";
	return subPortraitOf(line.name);
});
const portraitEmo = computed(() => {
	const raw = currentLine.value?.kind === "say" ? currentLine.value.emo ?? 1 : 1;
	const count = portraitChar.value === "evt" ? 6 : portraitChar.value ? FACE_COUNT[portraitChar.value] : 1;
	return Math.min(count, Math.max(1, Math.round(raw)));
});
const portraitSrc = computed(() => {
	const char = portraitChar.value;
	if (!char) return "";
	if (char === "evt") {
		const assets = props.eventAssets;
		if (!assets) return "";
		return eventAssetPath(assets.id, assets.faces.replace("{n}", String(portraitEmo.value)), assets.rev);
	}
	if (char === "wakana" || char === "ren") return bustupPath(char, portraitEmo.value);
	return `/client-assets/hanaawase/chara/${char}/face_${portraitEmo.value}.webp`;
});
const portraitFailed = computed(() => portraitSrc.value !== "" && portraitFailedSrc.value === portraitSrc.value);
/** 読み込みに失敗したときの簡易シルエット（通常は範囲検査により発生しない）。 */
const portraitMissing = computed(() =>
	portraitChar.value !== undefined && (portraitFailed.value || (portraitChar.value === "evt" && portraitSrc.value === "")));

const backdropId = computed(() => backdropAt(props.vignette, shown.value[shown.value.length - 1]?.index ?? 0));
const eventBackdrop = computed(() => {
	const raw = backdropId.value;
	if (!raw?.startsWith("evt:")) return undefined;
	return props.eventAssets?.backgrounds[raw.slice(4)];
});
const regularBackdropBase = computed(() => eventBackdrop.value?.fallback
	?? (backdropId.value?.startsWith("evt:") ? undefined : backdropId.value));
const selectedBackdropId = computed(() => {
	const base = regularBackdropBase.value;
	if (!base) return undefined;
	const variants = BACKDROP_VARIANTS[base];
	if (!variants || variants.length === 0) return base;
	return variants[stableIndex(`${props.vignette.id}:${base}`, variants.length)]!;
});
const useEventBackdrop = computed(() => eventBackdrop.value !== undefined
	&& props.eventAssets !== undefined && !eventBackdropFailed.value);
const backdropIsCss = computed(() => !useEventBackdrop.value
	&& (regularBackdropFailed.value || selectedBackdropId.value === undefined));
const backdropSrc = computed(() => {
	const assets = props.eventAssets;
	const event = eventBackdrop.value;
	if (useEventBackdrop.value && assets && event) return eventAssetPath(assets.id, event.file, assets.rev);
	return selectedBackdropId.value ? bgPath(selectedBackdropId.value) : "";
});

function apply(step: ReturnType<typeof resolveStep>) {
	if (step.kind === "end") {
		choice.value = undefined;
		ended.value = true;
		return;
	}
	if (step.kind === "choice") {
		choice.value = step.choice;
		cursor.value = step.index;
		return;
	}
	choice.value = undefined;
	cursor.value = step.index;
	// 帳面は revealDiary が枝ごとにまとめて出す。場面は1行ずつ差し替える。
	if (props.vignette.kind === "chomen") shown.value = [...shown.value, { index: step.index, line: step.line }];
	else shown.value = [{ index: step.index, line: step.line }];
	// ⚠️同じ表情が続くとCSSアニメが再発火しないので、行ごとに値を入れ替える
	beat.value = beat.value === 0 ? 1 : 0;
}

/*
旗鯖fork: ⚠️**画面のどこをタップしても進む**（利用者の指示）。
⚠️器（`.hana-vignette`）でまとめて受ける。⚠️会話枠にも `@click` を付けると**1回で2行進む**ので付けない。
⚠️ボタン・リンク・入力の上は素通しする。ここを抜くと「今回は読まない」や選択肢が
  押した瞬間に本文も1行進んでしまう（＝押し間違いに見える）。
⚠️`advance()` 側が選択肢・確認シート・終端を見ているので、判定はそちらに任せる。
*/
const TAP_HINT_KEY = "hanaawase:tapHintSeen";
const showTapHint = ref(window.sessionStorage.getItem(TAP_HINT_KEY) !== "1");

function onScreenTap(ev: MouseEvent) {
	const target = ev.target as HTMLElement | null;
	// ⚠️操作要素の上は素通し（そこ自身の @click に任せる）
	if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;
	// ⚠️文章を選択しようとしただけのときは進めない（読み返しの邪魔になる）
	if (window.getSelection()?.toString()) return;
	if (showTapHint.value) {
		showTapHint.value = false;
		window.sessionStorage.setItem(TAP_HINT_KEY, "1");
	}
	advance();
}

function advance() {
	if (choice.value || confirming.value) return;
	if (ended.value) { finish(); return; }
	if (props.vignette.kind === "chomen") {
		revealDiary(cursor.value + (shown.value.length === 0 ? 0 : 1));
		return;
	}
	if (skipping.value) { applySkip(cursor.value); return; }
	apply(resolveStep(props.vignette, localChoices.value, cursor.value + (shown.value.length === 0 ? 0 : 1)));
}

/** 帳面は可視の枝を一括表示する。1クリックごとに1行を積み増さない。 */
function revealDiary(from: number) {
	const entries: { index: number; line: Line }[] = [];
	let next = Math.max(0, from);
	while (true) {
		const step = resolveStep(props.vignette, localChoices.value, next);
		if (step.kind === "line") {
			entries.push({ index: step.index, line: step.line });
			cursor.value = step.index;
			next = step.index + 1;
			continue;
		}
		choice.value = step.kind === "choice" ? step.choice : undefined;
		if (step.kind === "choice") cursor.value = step.index;
		ended.value = step.kind === "end";
		break;
	}
	shown.value = [...shown.value, ...entries];
	beat.value = beat.value === 0 ? 1 : 0;
}

function askSkip() {
	if (ended.value) return;
	confirming.value = true;
}

function doSkip() {
	confirming.value = false;
	skipping.value = true;
	applySkip(cursor.value + (shown.value.length === 0 ? 0 : 1));
}

/** スキップだけは末尾へ着いた時点で完了する。選択肢なら apply が従来どおりそこで止める。 */
function applySkip(from: number) {
	const step = skipTo(props.vignette, localChoices.value, from);
	apply(step);
	if (step.kind === "end") finish();
}

function defer() {
	if (ended.value) return;
	confirming.value = false;
	emit("defer");
}

function pick(key: ChoiceKey) {
	const picked = choice.value;
	if (!picked) return;
	localChoices.value = { ...localChoices.value, [picked.id]: key };
	emit("choose", { choiceId: picked.id, key });
	choice.value = undefined;
	// 選択の直後は、選んだ枝の最初の行から再開する
	const from = cursor.value;
	if (props.vignette.kind === "chomen") {
		revealDiary(from);
		return;
	}
	if (skipping.value) applySkip(from);
	else apply(resolveStep(props.vignette, localChoices.value, from));
}

function finish() {
	emit("finish", props.vignette.id);
}

function onKeydown(event: KeyboardEvent) {
	if (confirming.value) {
		if (event.key === "Escape") { confirming.value = false; event.preventDefault(); }
		return;
	}
	if (event.key === "Enter" || event.key === " " || event.key === "ArrowRight") {
		if (choice.value) return;
		event.preventDefault();
		advance();
	}
}

function start() {
	cursor.value = 0;
	choice.value = undefined;
	ended.value = false;
	skipping.value = false;
	confirming.value = false;
	shown.value = [];
	eventBackdropFailed.value = false;
	regularBackdropFailed.value = false;
	portraitFailedSrc.value = "";
	if (props.vignette.kind === "chomen") {
		revealDiary(0);
		return;
	}
	apply(resolveStep(props.vignette, localChoices.value, 0));
}

watch(() => props.vignette.id, start);
watch(() => props.choices, (next) => { localChoices.value = { ...next, ...localChoices.value }; });
watch(backdropId, () => {
	eventBackdropFailed.value = false;
	regularBackdropFailed.value = false;
});
watch(shown, async () => {
	if (props.vignette.kind !== "chomen") return;
	await nextTick();
	// 横書きの帳面は、枝を追加したときだけ最新位置へ寄せる。
	if (chomenBody.value) chomenBody.value.scrollTop = chomenBody.value.scrollHeight;
});

function onPortraitError() {
	portraitFailedSrc.value = portraitSrc.value;
}

function onBackdropError() {
	if (useEventBackdrop.value) eventBackdropFailed.value = true;
	else regularBackdropFailed.value = true;
}

onMounted(() => {
	if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
		mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		systemReduced.value = mediaQuery.matches;
		mediaQuery.addEventListener("change", onMediaChange);
	}
	start();
});
onUnmounted(() => mediaQuery?.removeEventListener("change", onMediaChange));
</script>

<style lang="scss" scoped>
/*
⚠️配色は花常だけで閉じる。本体テーマの変数（--MI_THEME-*）は1つも使わない。
  混ぜていた頃は、利用者のテーマがライトだと .box が白くなり、そこへ暗地前提の --ink（クリーム）が
  乗って「白地に白」＝本文が1文字も読めない事故になっていた。
  値は index.vue の .hanaawase-scope と同じ（そちらが定義済みなら継承、単体で置かれても既定値で成立する）。
⚠️寸法に vh / vw を使わない。ウィンドウモードでは vh は「窓の高さ」ではなく「画面の高さ」なので、
  小さな窓の中で必ずはみ出す。高さは必ず「この器の幅」（＝窓幅に追従する）から決める。
*/
.hana-vignette {
	--v-bg: var(--bg, #2b2620);
	--v-panel: var(--panel, #3a332b);
	--v-paper: var(--paper, #332c24);
	--v-ink: var(--ink, #f4efe3);
	/* 地の文用。--ink をわずかに落として台詞と差をつける（opacity を使わず値で持つ＝実測できる） */
	--v-ink-soft: #e3ddcf;
	--v-sub: var(--sub, #b0a692);
	--v-line: var(--line, #4a4238);
	--v-accent: var(--accent, #c9a04e);
	--v-ai-ink: var(--ai-ink, #8fa8c8);
	--v-scrim: rgb(23 20 16 / 82%);
	--v-mincho: var(--mincho, "Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP", serif);
	/*
	立ち絵が枠の裏へ潜る量。⚠️枠の天の余白（padding-top 28px ＋ 枠線 1px）より小さく保つこと。
	そうすると「立ち絵の下端 < 本文の1行目の上端」が寸法として成立し、
	重ね順（枠 z-index 2 / 立ち絵 z-index 1）に頼らなくても本文に被らない。現状の余裕は 29 - 22 = 7px。
	*/
	--v-dip: 22px;

	position: relative;
	display: grid;
	/* 1:見出し 2:立ち絵(余白を吸う) 3:枠 4:足もと */
	grid-template-columns: minmax(0, 1fr);
	/*
	⚠️2行目は `1fr` ではなく `minmax(0, 1fr)`。
	`1fr` の自動最小寸法に立ち絵の高さが採用されると、固定高の器よりgrid全体が高くなり、
	会話枠と足もとが下端の外へ押し出される。0まで縮められる余白として定義する。
	*/
	grid-template-rows: auto minmax(0, 1fr) auto auto;
	/*
	⚠️高さは「中身」ではなく「この器の幅」から決める。
	  立ち絵の有無で背が伸び縮みしていた（立ち絵がその aspect-ratio で高さを作り、無い場面は
	  min-height まで縮んでいた）ため、場面が変わるたびに器が跳ねていた。
	⚠️vh は使わない（画面の高さ基準なので小窓ではみ出す）。比率は @container で器の幅から切り替える。
	⚠️**下限（min-height）ではなく固定（height）で持つ。**
	  min-height だと台詞の長い場面だけ器が伸びて、⚠️**行ごとに背が変わりページのスクロールが要る**
	  （利用者の報告）。長い台詞は器を伸ばさず、**会話枠の中だけをスクロール**させる（下の .box を参照）。
	  cqw ＝ 器の幅の1%（index.vue の .story-shell の container-type が拠り所）。
	*/
	/*
	⚠️狭幅ではカード幅の175%を基準にして、スマホの縦方向を会話と操作へ使う。
	下限520pxは極端に細い器でも会話枠を残すため、上限780pxはタブレット直前で
	カードが際限なく縦長になるのを防ぐため。どちらも画面高ではなく器の幅だけで決まる。
	*/
	height: clamp(520px, 175cqw, 780px);
	overflow: hidden;
	color: var(--v-ink);
	background: var(--v-bg);
	color-scheme: dark;
	text-align: center;
	word-break: keep-all;
	overflow-wrap: anywhere;
	outline: none;
}

.backdrop {
	position: absolute;
	inset: 0;
	z-index: 0;
	background: linear-gradient(160deg, #2b2620 0%, #4a4238 42%, #d8cfbe 100%);

	/* ⚠️display: block を落とすと img が行ボックス扱いになり、器の下に約4px はみ出す（実測） */
	img { display: block; width: 100%; height: 100%; object-fit: cover; }
}
/* ⚠️PNGの無い場所はCSSで環境を描く。shop_day に丸めない（SPEC §9.7.55） */
.backdrop[data-css="on"]::after {
	content: "";
	position: absolute;
	inset: 0;
	background-image: repeating-linear-gradient(90deg, rgba(255, 255, 255, .06) 0 1px, transparent 1px 26px);
}
.backdrop[data-bg="market"] { background: linear-gradient(180deg, #1d232b 0%, #3c4652 60%, #b9c3cc 100%); }
.backdrop[data-bg="street"] { background: linear-gradient(180deg, #2b2620 0%, #554d42 55%, #cfc6b5 100%); }
.backdrop[data-bg="indoor_other"] { background: linear-gradient(180deg, #241d17 0%, #5a4634 60%, #c9b294 100%); }
.backdrop[data-bg="outskirt"] { background: linear-gradient(180deg, #191f1a 0%, #3f4a3a 55%, #c6cbb5 100%); }

/*
⚠️立ち絵は grid の2行目（1fr）に置く。絶対配置をやめたので、
  「立ち絵の下端 = 枠の上端より --v-dip だけ下」が寸法として確定する。
  枠は不透明・z-index 2、立ち絵は z-index 1 なので、潜った分は必ず枠の裏に隠れる＝本文に被らない。
*/
.portrait {
	position: relative;
	z-index: 1;
	grid-row: 2;
	grid-column: 1;
	align-self: end;
	justify-self: end;
	/*
	⚠️立ち絵は「高さ」で決める。幅で決めると立ち絵の高さが器の高さを押し広げてしまい、
	  立ち絵の有無で器が伸び縮みする（それが今回の不具合だった）。
	  高さを先に決めれば、この行(1fr)の余りに収まるだけになり、器の高さに影響しない。
	*/
	height: min(100%, 420px);
	min-height: 0;
	max-height: 100%;
	width: auto;
	aspect-ratio: 1 / 1;
	margin: 0 4% calc(var(--v-dip) * -1) 0;
	pointer-events: none;

	img { width: 100%; height: 100%; object-fit: contain; object-position: bottom center; display: block; }
}
.portrait.silhouette span {
	display: block;
	width: 100%;
	height: 100%;
	border-radius: 40% 40% 12% 12%;
	background: rgb(23 20 16 / 45%);
}

.bar {
	position: relative;
	z-index: 2;
	grid-row: 1;
	grid-column: 1;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	/* ⚠️天は 14px 空ける。親 .sheet の絵巻の軸（8px）の下に題が潜らないようにするため */
	padding: 14px 12px 10px;
}
/* ⚠️題は背景画像の上に乗る。地（丸ピル）を必ず敷く。背景が真っ白でも 9.1:1 を割らない */
.title {
	margin: 0;
	padding: 5px 13px;
	border-radius: 999px;
	background: var(--v-scrim);
	color: var(--v-ink);
	font-family: var(--v-mincho);
	font-size: 14px;
	letter-spacing: .12em;
}
.skip, .later, .next {
	border: 1px solid var(--v-line);
	border-radius: 999px;
	padding: 6px 14px;
	background: var(--v-panel);
	color: var(--v-ink);
	cursor: pointer;
	font-size: 13px;
}
.bar-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.skip:hover, .later:hover, .next:hover,
.skip:focus-visible, .later:focus-visible, .next:focus-visible { border-color: var(--v-accent); background: rgb(201 160 78 / 16%); }

/* ⚠️不透明。半透明にすると立ち絵が枠を透けて見え、文字の後ろが濁って読めなくなる */
.box {
	position: relative;
	z-index: 2;
	grid-row: 3;
	grid-column: 1;
	width: min(900px, calc(100% - 24px));
	margin: 0 auto;
	/* ⚠️天は 28px。--v-dip(22px) ＋ 枠線1px より大きく取ることで、
	   名前の無い地の文でも「立ち絵の下端 < 本文の上端」が成立する（余裕 7px）。 */
	padding: 28px 16px 16px;
	border: 1px solid var(--v-line);
	border-radius: 12px;
	background: var(--v-panel);
	box-shadow: 0 6px 20px rgb(0 0 0 / 32%);
	cursor: pointer;
	/*
	⚠️器の高さを固定したので、長い台詞は**この枠の中だけ**を送る。
	⚠️`min-height` で最低の背を確保しつつ、`overflow-y: auto` で溢れ分を枠内に閉じ込める。
	⚠️これを外すと、台詞の長さで器が伸びてページ全体のスクロールが復活する。
	⚠️`min-height: 6.5em`（下限）と `max-height: 100%`（上限）を**両方**持たせること。
	  片方だけにすると、短い台詞で枠が痩せるか、長い台詞で器からはみ出すかのどちらかになる。
	*/
	min-height: 6.5em;
	max-height: 100%;
	overflow-y: auto;
	overscroll-behavior: contain;
}
.name { margin: 0 0 6px; font-size: 13px; letter-spacing: .08em; font-family: var(--v-mincho); color: var(--v-accent); }
.name[data-speaker="ren"] { color: var(--v-ai-ink); }
.name[data-speaker="sub"] { color: var(--v-sub); }
.text {
	/* ⚠️色は必ず自分で持つ。継承に任せると器の背景次第で「白地に白」になる */
	color: var(--v-ink);
	max-width: 34em;
	margin: 0 auto;
	line-height: 1.9;
	font-family: var(--v-mincho);
	white-space: pre-wrap;
	animation: hana-line-in 260ms ease both;
}
.text[data-kind="narration"] { color: var(--v-ink-soft); }

.chomen {
	position: relative;
	z-index: 2;
	grid-row: 3;
	grid-column: 1;
	overflow-x: hidden;
	overflow-y: auto;
	width: min(900px, calc(100% - 24px));
	margin: 0 auto;
	/* ⚠️.box と同じ理由で天を 28px 取る（立ち絵が 22px 潜っても最初の行に掛からない） */
	padding: 28px 16px 16px;
	border: 1px solid var(--v-line);
	border-radius: 12px;
	color: var(--v-ink);
	background: var(--v-paper);
	box-shadow: 0 6px 20px rgb(0 0 0 / 32%);
	/* ⚠️帳面は横書き。全文を一行ずつ横に積む操作をやめ、必要なら縦へスクロールして読む。 */
	writing-mode: horizontal-tb;
	font-family: var(--v-mincho);
	line-height: 1.9;
	text-align: left;
	/* ⚠️vh は使わない。上限も器の幅に連動させ、小窓ではみ出さない。 */
	max-height: min(360px, 58cqw);
}
.chomen-line { max-width: 34em; margin: 0 auto; padding: .1em 0; animation: hana-line-in 260ms ease both; white-space: pre-wrap; }
.chomen-line[data-blank="on"] { min-height: 1.2em; }

.foot {
	position: relative;
	z-index: 2;
	grid-row: 4;
	grid-column: 1;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 10px;
	padding: 10px 12px;
}
/*
旗鯖fork: 「どこでもタップで進む」の案内。⚠️**一度タップしたら出さない**（読書の邪魔になるため）。
⚠️送るボタンより先に置いて、視線の流れ（案内→ボタン）を保つ。
⚠️`order: -1` ではなく DOM 順で並べたいので、foot 内の並びは template 側の順に従う。
*/
.tap-hint {
	order: -1;
	margin: 0;
	margin-right: auto;
	color: var(--v-sub);
	font-size: 12px;
	line-height: 1.5;
	/* ⚠️案内自体がタップの的にならないよう素通しさせる（押しても本文が進む） */
	pointer-events: none;
}

/*
⚠️中身が器より高くなっても上が切れないように、grid の place-items ではなく
  「flex ＋ 端の auto マージン」で中央に置く（はみ出したときは素直にスクロールする）。
  あらすじが切れると「送るかどうか」を判断できなくなるため。
*/
.choice, .confirm {
	position: absolute;
	inset: 0;
	z-index: 3;
	display: flex;
	flex-direction: column;
	align-items: center;
	overflow-y: auto;
	padding: 16px;
	background: rgb(23 20 16 / 78%);
}
.choice > :first-child, .confirm > :first-child { margin-top: auto; }
.choice > :last-child, .confirm > :last-child { margin-bottom: auto; }
.choice-title, .confirm-card h2 { margin: 0 0 12px; color: var(--v-ink); font-family: var(--v-mincho); font-size: 16px; letter-spacing: .1em; }
.choice-buttons, .confirm-buttons { display: grid; gap: 10px; }
.confirm-buttons { grid-template-columns: 1fr 1fr; }
.choice-buttons button, .confirm-buttons button {
	/* ⚠️「読む」と「送る」は対等。片方を目立たせない */
	border: 1px solid var(--v-line);
	border-radius: 12px;
	padding: 12px 16px;
	background: var(--v-panel);
	color: var(--v-ink);
	font-family: inherit;
	font-size: 14px;
	cursor: pointer;
}
.choice-buttons button:hover, .confirm-buttons button:hover,
.choice-buttons button:focus-visible, .confirm-buttons button:focus-visible { border-color: var(--v-accent); background: rgb(201 160 78 / 16%); }
/* ⚠️あらすじは「送るかどうか」の判断材料。カードは不透明・本文は --v-ink（12.0:1）で置く */
.confirm-card {
	max-width: 30em;
	padding: 18px;
	border: 1px solid var(--v-line);
	border-radius: 12px;
	color: var(--v-ink);
	background: var(--v-paper);
	box-shadow: 0 14px 34px rgb(0 0 0 / 40%);
}
.synopsis { margin: 0 0 8px; color: var(--v-ink); line-height: 1.8; font-family: var(--v-mincho); }
.note { margin: 0 0 14px; font-size: 12px; color: var(--v-sub); line-height: 1.7; }

/* ⚠️transform と opacity のみ */
@keyframes hana-line-in {
	from { opacity: 0; transform: translateY(6px); }
	to { opacity: 1; transform: translateY(0); }
}
@keyframes hana-beat {
	0% { transform: translateY(0); }
	45% { transform: translateY(-6px); }
	100% { transform: translateY(0); }
}
@keyframes hana-smile {
	0% { transform: translateY(0) scale(1); }
	42% { transform: translateY(-8px) scale(1.025); }
	100% { transform: translateY(0) scale(1); }
}
@keyframes hana-ponder {
	0% { transform: translateY(0) rotate(0); }
	45% { transform: translateY(-2px) rotate(-2deg); }
	100% { transform: translateY(0) rotate(0); }
}
@keyframes hana-surprise {
	0% { transform: translateY(0) scale(1); }
	34% { transform: translateY(-13px) scale(1.04); }
	70% { transform: translateY(-3px) scale(.99); }
	100% { transform: translateY(0) scale(1); }
}
@keyframes hana-focus {
	0% { transform: translateY(-4px) scale(1.015); }
	100% { transform: translateY(0) scale(1); }
}
/* 発話バウンド。data-beat が行ごとに 0/1 で入れ替わるので、同じ表情が続いても再発火する */
.hana-vignette[data-reduced="off"] .portrait[data-beat="0"],
.hana-vignette[data-reduced="off"] .portrait[data-beat="1"] { animation: hana-beat 260ms ease; }
/* 表情番号に応じた芝居。transform と opacity だけで、驚きは跳ね、思案は傾き、集中は静かに収まる。 */
.hana-vignette[data-reduced="off"] .portrait[data-emo="2"],
.hana-vignette[data-reduced="off"] .portrait[data-emo="6"] { animation: hana-smile 360ms cubic-bezier(.25, 1.45, .55, 1); }
.hana-vignette[data-reduced="off"] .portrait[data-emo="3"] { animation: hana-ponder 320ms ease; }
.hana-vignette[data-reduced="off"] .portrait[data-emo="4"] { animation: hana-surprise 360ms cubic-bezier(.2, 1.35, .45, 1); }
.hana-vignette[data-reduced="off"] .portrait[data-emo="5"] { animation: hana-focus 260ms ease-out; }

.hana-vignette[data-reduced="on"] .text,
.hana-vignette[data-reduced="on"] .chomen-line,
.hana-vignette[data-reduced="on"] .portrait { animation: none; }

@media (prefers-reduced-motion: reduce) {
	.text, .chomen-line, .portrait { animation: none !important; }
}

/*
場面の縦横比。⚠️@media ではなく @container を使う（拠り所は index.vue の .story-shell の container-type）。
⚠️@media は「画面の幅」で切り替わるので、広い画面に開いた小さな窓の中で横長のまま潰れる。
  @container なら「この器の幅」で切り替わるので、窓の中でも正しく縦長のままになる。
狭いとき clamp(520px, 175cqw, 780px)（スマホの縦方向を使い切る）／
広いとき 77cqw（≒13:10。1100px 幅なら約847px＝PCで下が余らない）。
*/
@container (min-width: 720px) {
	.hana-vignette { height: max(360px, 77cqw); }
}
</style>
