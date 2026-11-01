<!--
花常のイベントホーム。⚠️本体locale・本体ダイアログ・寄付/ロール情報へ依存しない。
-->
<template>
<section
	class="event-home"
	:style="{ '--evt': event.home.accent }"
	:data-motion="reducedMotion ? 'reduced' : 'normal'"
	aria-labelledby="event-title"
>
	<Transition name="event-bg-fade">
		<img
			v-if="backgroundAvailable"
			:key="`${event.index.id}:${tab}:${tabBackground}`"
			class="event-bg"
			:src="asset(tabBackground)"
			alt=""
			aria-hidden="true"
			@error="markBackgroundFailed(tabBackground)"
		>
	</Transition>
	<span class="event-scrim" aria-hidden="true"></span>

	<header class="event-head">
		<button class="event-back" type="button" aria-label="花常のホームへ戻る" @click="$emit('close')">←</button>
		<button
			ref="infoButton"
			class="event-help"
			type="button"
			aria-label="イベントの説明を開く"
			aria-haspopup="dialog"
			:aria-expanded="infoOpen"
			@click="openInfo"
		>
			?
		</button>
		<p class="event-season">{{ event.definition.season }}</p>
		<div class="event-logo" aria-hidden="true">
			<img
				v-if="event.definition.logo && !logoFailed"
				class="event-logo-image"
				:src="asset(event.definition.logo)"
				alt=""
				@error="logoFailed = true"
			>
			<template v-else>
				<span class="event-logo-words">
					<span v-for="(line, index) in logoLines" :key="index" class="event-logo-line">{{ line }}</span>
				</span>
				<span v-if="event.index.id === 'mago-no-inuma'" class="event-seal">
					<svg viewBox="0 0 48 48" focusable="false">
						<circle cx="24" cy="24" r="21"></circle>
						<g transform="translate(24 24)">
							<path v-for="turn in 5" :key="turn" d="M0,-4 C-5,-8 -8,-15 0,-17 C8,-15 5,-8 0,-4 Z" :transform="`rotate(${(turn - 1) * 72})`"></path>
							<circle cx="0" cy="0" r="3"></circle>
						</g>
					</svg>
				</span>
			</template>
		</div>
		<h1 id="event-title">{{ event.definition.title }}</h1>
		<p class="event-subtitle">{{ event.definition.subtitle }}</p>
		<p class="event-time">{{ statusLine }}</p>
	</header>

	<div class="event-cast">
		<img v-if="!charaFailed" :src="asset(event.home.chara)" alt="" @error="charaFailed = true">
		<span v-else class="event-silhouette" aria-hidden="true"></span>
		<p><b>{{ event.definition.chara.name }}</b><span>{{ charaLine }}</span></p>
	</div>

	<nav class="event-tabs" aria-label="イベントの目次">
		<button type="button" :aria-pressed="tab === 'stages'" @click="tab = 'stages'">花仕事</button>
		<button type="button" :aria-pressed="tab === 'exchange'" @click="tab = 'exchange'">交換所</button>
		<button type="button" :aria-pressed="tab === 'story'" @click="tab = 'story'">物語</button>
	</nav>

	<Transition name="event-panel-fade" mode="out-in">
		<section v-if="tab === 'stages'" key="stages" class="event-panel" aria-labelledby="event-stages-title">
			<div class="panel-heading">
				<div><p>手を動かす</p><h2 id="event-stages-title">花仕事</h2></div>
				<p class="point-balance"><b>{{ balance }}</b><span>{{ event.definition.points.name }}</span></p>
			</div>
			<p v-if="!active" class="event-quiet">{{ state === 'upcoming' ? '開催時間になると、ここから花仕事を始められます。' : '開催時間は終了しました。物語の記録は残ります。' }}</p>
			<ol class="event-stage-list">
				<li v-for="(stage, index) in revealedStages" :key="stage.id">
					<button type="button" :disabled="!active" @click="$emit('start', stage)">
						<span class="stage-number">第{{ KANJI[index + 1] }}局</span>
						<b>{{ stage.title }}</b>
						<small>{{ flowerName(stage.flower) }}を{{ stage.goalNeed }}枚・{{ stage.moves }}手</small>
						<em v-if="cleared(stage.id)">済</em>
						<span v-else-if="active">始める</span>
					</button>
				</li>
			</ol>
		</section>

		<section v-else-if="tab === 'exchange'" key="exchange" class="event-panel" aria-labelledby="event-exchange-title">
			<div class="panel-heading">
				<div><p>受け取る</p><h2 id="event-exchange-title">交換所</h2></div>
				<p class="point-balance"><b>{{ balance }}</b><span>{{ event.definition.points.name }}</span></p>
			</div>
			<p class="event-quiet">必要な数は開催時間の途中で変わりません。受け取った品は、ほかの方へ渡せません。</p>
			<ul class="exchange-list">
				<li v-for="item in event.definition.exchange" :key="item.itemId">
					<div>
						<b>{{ item.name }}</b>
						<small>{{ item.cost }}札・{{ exchanged(item.itemId) }} / {{ item.limit }}</small>
					</div>
					<button
						type="button"
						:disabled="!canExchange(item)"
						@click="$emit('exchange', item)"
					>{{ exchanged(item.itemId) >= item.limit ? '受取済' : toolCount(item.itemId) === 5 ? '所持上限' : '受け取る' }}</button>
				</li>
			</ul>
		</section>

		<section v-else key="story" class="event-panel" aria-labelledby="event-story-title">
			<div class="panel-heading">
				<div><p>読み返す</p><h2 id="event-story-title">物語</h2></div>
			</div>
			<p v-if="readableStories.length === 0" class="event-quiet">まだ、読んだ場面はありません。</p>
			<ol v-else class="event-story-list">
				<li v-for="story in readableStories" :key="story.id">
					<button type="button" @click="$emit('replay', story)">
						<b>{{ story.title }}</b><span>読む</span>
					</button>
				</li>
			</ol>
		</section>
	</Transition>

	<div
		v-if="infoOpen"
		class="event-info-backdrop"
		@click.self="closeInfo"
		@keydown="handleInfoKeydown"
	>
		<section
			class="event-info"
			role="dialog"
			aria-modal="true"
			aria-labelledby="event-info-title"
			aria-describedby="event-info-body"
		>
			<header>
				<div>
					<p>催しの案内</p>
					<h2 id="event-info-title">{{ event.definition.title }}</h2>
				</div>
				<button ref="infoClose" type="button" aria-label="イベントの説明を閉じる" @click="closeInfo">×</button>
			</header>
			<div id="event-info-body" class="event-info-body">
				<p class="event-info-subtitle">{{ event.definition.subtitle }}</p>
				<h3>開催時間</h3>
				<p class="full-time">{{ fullTime }}</p>
				<h3>イベントについて</h3>
				<p v-for="line in event.definition.notice" :key="line">{{ line }}</p>
			</div>
		</section>
	</div>
</section>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from "vue";
import { FLOWER_SVGS } from "./flowers.js";
import {
	currentRun,
	eventAssetPath,
	eventBalance,
	eventRunFullTime,
	eventState,
	revealedEventStages,
} from "./events.js";
import type {
	EventExchangeItem,
	EventStage,
	LoadedEvent,
} from "./events.js";
import type { Flower } from "./engine.js";
import type { EventProgress } from "./storage.js";
import type { Vignette } from "./story/index.js";

const props = defineProps<{
	event: LoadedEvent;
	progress: EventProgress;
	tools: Readonly<{ hasami: number; tenaoshi: number; uchimizu: number }>;
	now: number;
	lineIndex: number;
	reducedMotion?: boolean;
}>();

defineEmits<{
	(event: "close"): void;
	(event: "start", stage: EventStage): void;
	(event: "exchange", item: EventExchangeItem): void;
	(event: "replay", story: Vignette): void;
}>();

const tab = ref<"stages" | "exchange" | "story">("stages");
const failedBackgrounds = ref<string[]>([]);
const charaFailed = ref(false);
const logoFailed = ref(false);
const infoOpen = ref(false);
const infoButton = ref<HTMLButtonElement | null>(null);
const infoClose = ref<HTMLButtonElement | null>(null);
const KANJI = ["", "一", "二", "三", "四", "五", "六"] as const;
const logoLines = computed(() => {
	const title = props.event.definition.title;
	if (props.event.index.id === "mago-no-inuma") return ["孫の居ぬ間に", "なんとやら"];
	if ([...title].length <= 6) return [title];
	const letters = [...title];
	const middle = Math.ceil(letters.length / 2);
	return [letters.slice(0, middle).join(""), letters.slice(middle).join("")];
});
const state = computed(() => eventState(props.event.index, props.now));
const active = computed(() => state.value === "active");
const balance = computed(() => eventBalance(props.event.definition, props.progress));
const cleared = (id: string) => props.progress.stagesCleared.includes(id);
const revealedStages = computed(() =>
	revealedEventStages(props.event.definition.stages, props.progress.stagesCleared));
const exchanged = (itemId: string) => props.progress.exchanged[itemId] ?? 0;
const asset = (file: string) => eventAssetPath(props.event.index.id, file, props.event.index.rev);
const flowerName = (flower: Flower) => FLOWER_SVGS[flower].name;
const tabBackgrounds = computed(() => {
	const files = [
		props.event.home.bg,
		...Object.values(props.event.definition.backgrounds).map((background) => background.file),
	].filter((file, index, all) => all.indexOf(file) === index);
	return {
		stages: files[0] ?? props.event.home.bg,
		exchange: files[1] ?? files[0] ?? props.event.home.bg,
		story: files[2] ?? files[1] ?? files[0] ?? props.event.home.bg,
	};
});
const tabBackground = computed(() => tabBackgrounds.value[tab.value]);
const backgroundAvailable = computed(() => !failedBackgrounds.value.includes(tabBackground.value));
const markBackgroundFailed = (file: string) => {
	if (!failedBackgrounds.value.includes(file)) failedBackgrounds.value = [...failedBackgrounds.value, file];
};

const toolCount = (itemId: string) => itemId === "hasami" || itemId === "tenaoshi" || itemId === "uchimizu"
	? props.tools[itemId]
	: undefined;
const canExchange = (item: EventExchangeItem) => {
	const count = toolCount(item.itemId);
	return active.value && exchanged(item.itemId) < item.limit && balance.value >= item.cost
		&& (count === undefined || count < 5);
};

const readableStories = computed(() =>
	props.event.stories.filter((story) => props.progress.storySeen.includes(story.id)));

const run = computed(() => currentRun(props.event.index, props.now));
const jstParts = (iso: string) => {
	const parts = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "numeric",
		day: "numeric",
		weekday: "short",
		hour: "numeric",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(iso));
	const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
	return {
		year: get("year"),
		month: get("month"),
		day: get("day"),
		weekday: get("weekday"),
		hour: get("hour"),
		minute: get("minute"),
	};
};
const shortDate = (iso: string) => {
	const date = jstParts(iso);
	return `${date.month}月${date.day}日`;
};
const statusLine = computed(() => {
	const selected = run.value;
	if (!selected) return "開催時間 終了しました";
	if (state.value === "upcoming") return `開催時間 ${shortDate(selected.start)}から`;
	if (state.value === "ended") return "開催時間 終了しました";
	const end = jstParts(selected.end);
	const now = jstParts(new Date(props.now).toISOString());
	if (end.year === now.year && end.month === now.month && end.day === now.day) return "開催時間 本日まで";
	const startDay = Date.UTC(Number(now.year), Number(now.month) - 1, Number(now.day));
	const endDay = Date.UTC(Number(end.year), Number(end.month) - 1, Number(end.day));
	return `開催時間 のこり ${Math.max(1, Math.ceil((endDay - startDay) / 86_400_000))}日`;
});
const fullTime = computed(() => {
	const selected = run.value ?? [...props.event.index.runs]
		.sort((a, b) => Date.parse(b.end) - Date.parse(a.end))[0];
	if (!selected) return "これまでの開催時間はありません。";
	return eventRunFullTime(selected, state.value === "ended");
});

const lineTags = computed(() => {
	const tags = new Set<string>();
	if (props.progress.stagesCleared.length === 0 && props.progress.storySeen.length === 0) tags.add("初回");
	if (balance.value >= 10) tags.add("点あり");
	if (props.event.definition.stages.every((stage) => cleared(stage.id))) tags.add("全踏破");
	if (props.event.definition.exchange.every((item) => exchanged(item.itemId) >= item.limit)) tags.add("交換済");
	const selected = run.value;
	if (state.value === "active" && selected) {
		const start = Date.parse(selected.start);
		const end = Date.parse(selected.end);
		const ratio = (props.now - start) / Math.max(1, end - start);
		if (end - props.now <= 3 * 86_400_000) tags.add("終盤");
		else if (ratio < 0.4) tags.add("序盤");
		else tags.add("中盤");
	}
	if (props.lineIndex % 20 === 19) tags.add("rare");
	return tags;
});
const charaLine = computed(() => {
	const all = props.event.definition.chara.lines;
	const eligible = all.filter((line) => line.tags.some((tag) => lineTags.value.has(tag)));
	const pool = eligible.length > 0 ? eligible : all;
	return pool[props.lineIndex % Math.max(1, pool.length)]?.text ?? props.event.home.line;
});

const openInfo = async () => {
	infoOpen.value = true;
	await nextTick();
	infoClose.value?.focus();
};

const closeInfo = async () => {
	if (!infoOpen.value) return;
	infoOpen.value = false;
	await nextTick();
	infoButton.value?.focus();
};

const handleInfoKeydown = (event: KeyboardEvent) => {
	if (event.key === "Escape") {
		event.preventDefault();
		void closeInfo();
		return;
	}
	// このダイアログで操作できるのは閉じるボタンだけ。Tabで背面へ抜けないようにする。
	if (event.key === "Tab") {
		event.preventDefault();
		infoClose.value?.focus();
	}
};

watch(() => props.event.index.id, () => {
	tab.value = "stages";
	failedBackgrounds.value = [];
	charaFailed.value = false;
	logoFailed.value = false;
	infoOpen.value = false;
});
</script>

<style lang="scss" scoped>
.event-home {
	--e-bg: #29241f;
	--e-panel: #39312a;
	--e-ink: #f4efe3;
	--e-sub: #c4b9a6;
	--e-line: #5a5045;
	position: relative;
	display: grid;
	min-height: 620px;
	overflow: hidden;
	border: 1px solid var(--e-line);
	border-radius: 18px;
	color: var(--e-ink);
	background: var(--e-bg);
	font-family: "Hiragino Mincho ProN", "Yu Mincho", YuMincho, serif;
}
.event-home > :not(.event-bg, .event-scrim) { position: relative; z-index: 1; }
.event-bg, .event-scrim { position: absolute; inset: 0; width: 100%; height: 100%; }
.event-bg { object-fit: cover; opacity: .42; }
.event-bg-fade-enter-active, .event-bg-fade-leave-active { transition: opacity 360ms ease; }
.event-bg-fade-enter-from, .event-bg-fade-leave-to { opacity: 0; }
.event-scrim { background: linear-gradient(180deg, rgb(25 21 18 / 44%), var(--e-bg) 56%); }
.event-head { padding: 24px 62px 10px; text-align: center; }
.event-back, .event-help { position: absolute; top: 16px; width: 38px; height: 38px; border: 1px solid var(--e-line); border-radius: 50%; color: var(--e-ink); background: rgb(41 36 31 / 84%); cursor: pointer; }
.event-back { left: 16px; }
.event-help { right: 16px; font: 700 18px/1 sans-serif; }
.event-back:focus-visible, .event-help:focus-visible, .event-info button:focus-visible { outline: 3px solid color-mix(in srgb, var(--evt), white 40%); outline-offset: 2px; }
.event-season { margin: 0 0 6px; color: var(--e-sub); font-size: 12px; letter-spacing: .22em; }
.event-logo { display: flex; min-height: 74px; align-items: center; justify-content: center; gap: 10px; color: var(--evt); filter: drop-shadow(0 1px 0 rgb(0 0 0 / 70%)); }
.event-logo-image { display: block; width: min(86%, 360px); max-height: 74px; object-fit: contain; }
.event-logo-words { display: grid; gap: 0; }
.event-logo-line { display: block; padding: 2px 10px; border-block: 1px solid color-mix(in srgb, var(--evt), white 15%); font-size: 21px; font-weight: 700; line-height: 1.35; letter-spacing: .15em; text-indent: .15em; }
.event-logo-line + .event-logo-line { justify-self: end; margin-top: 4px; font-size: 19px; }
.event-seal { display: block; width: 44px; height: 44px; flex: 0 0 44px; }
.event-seal svg { display: block; width: 100%; height: 100%; overflow: visible; }
.event-seal circle:first-child { fill: color-mix(in srgb, var(--evt), transparent 76%); stroke: var(--evt); stroke-width: 2; }
.event-seal path { fill: color-mix(in srgb, var(--evt), white 8%); stroke: color-mix(in srgb, var(--evt), white 28%); stroke-width: 1; }
.event-seal g circle { fill: color-mix(in srgb, var(--evt), white 55%); }
.event-head h1 { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.event-subtitle { margin: 4px 0; font-size: 13px; letter-spacing: .1em; }
.event-time { margin: 6px 0 0; color: var(--e-sub); font-family: sans-serif; font-size: 12px; }
.event-cast { display: grid; min-height: 190px; grid-template-columns: minmax(120px, 42%) 1fr; align-items: end; padding: 0 18px; }
.event-cast > img { width: 100%; max-height: 230px; align-self: end; object-fit: contain; object-position: bottom; }
.event-silhouette { width: 120px; height: 170px; justify-self: center; border-radius: 60% 60% 20% 20%; background: rgb(0 0 0 / 25%); }
.event-cast p { align-self: center; margin: 0 0 14px -12px; padding: 12px 14px; border: 1px solid var(--e-line); border-radius: 16px 16px 16px 3px; background: rgb(41 36 31 / 92%); }
.event-cast p b, .event-cast p span { display: block; }
.event-cast p b { margin-bottom: 4px; color: color-mix(in srgb, var(--evt), white 42%); font-size: 12px; }
.event-cast p span { line-height: 1.7; }
.event-tabs { display: grid; grid-template-columns: repeat(3, 1fr); margin: 0 18px; border-block: 1px solid var(--e-line); }
.event-tabs button { padding: 11px 6px; border: 0; color: var(--e-sub); background: transparent; font: inherit; cursor: pointer; }
.event-tabs button[aria-pressed="true"] { color: var(--e-ink); box-shadow: inset 0 -2px var(--evt); }
.event-panel { padding: 18px; background: rgb(41 36 31 / 90%); }
.event-panel-fade-enter-active, .event-panel-fade-leave-active { transition: opacity 180ms ease; }
.event-panel-fade-enter-from, .event-panel-fade-leave-to { opacity: 0; }
.panel-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.panel-heading p, .panel-heading h2 { margin: 0; }
.panel-heading > div > p { color: var(--e-sub); font-size: 11px; letter-spacing: .15em; }
.panel-heading h2 { font-size: 18px; }
.point-balance { text-align: right; }
.point-balance b, .point-balance span { display: block; }
.point-balance b { color: color-mix(in srgb, var(--evt), white 45%); font: 24px/1 sans-serif; }
.point-balance span { margin-top: 3px; color: var(--e-sub); font-size: 10px; }
.event-quiet { margin: 8px 0 14px; color: var(--e-sub); font-size: 12px; line-height: 1.7; }
.event-stage-list, .exchange-list, .event-story-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.event-stage-list button, .event-story-list button { position: relative; display: grid; width: 100%; grid-template-columns: auto 1fr auto; align-items: center; gap: 9px; padding: 11px 12px; border: 1px solid var(--e-line); border-radius: 12px; color: var(--e-ink); background: rgb(54 47 40 / 92%); text-align: left; cursor: pointer; }
.event-stage-list button:disabled { color: var(--e-sub); cursor: default; opacity: .75; }
.event-stage-list button b { font-size: 14px; }
.event-stage-list button small { grid-column: 2; color: var(--e-sub); font-family: sans-serif; font-size: 10px; }
.event-stage-list button em, .event-stage-list button > span:last-child { grid-column: 3; grid-row: 1 / 3; color: color-mix(in srgb, var(--evt), white 45%); font-size: 11px; font-style: normal; }
.stage-number { grid-row: 1 / 3; color: var(--e-sub); font-size: 10px; }
.exchange-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid var(--e-line); border-radius: 12px; background: rgb(54 47 40 / 92%); }
.exchange-list b, .exchange-list small { display: block; }
.exchange-list small { margin-top: 3px; color: var(--e-sub); font: 10px sans-serif; }
.exchange-list button { border: 1px solid var(--evt); border-radius: 999px; padding: 7px 10px; color: var(--e-ink); background: color-mix(in srgb, var(--evt), transparent 78%); font: inherit; font-size: 11px; cursor: pointer; }
.exchange-list button:disabled { border-color: var(--e-line); color: var(--e-sub); background: transparent; cursor: default; }
.event-story-list button { grid-template-columns: 1fr auto; }
.event-story-list button span { color: color-mix(in srgb, var(--evt), white 45%); font-size: 11px; }
.event-home > .event-info-backdrop { position: absolute; z-index: 10; }
.event-info-backdrop { inset: 0; display: grid; place-items: center; padding: 16px; background: rgb(18 15 13 / 74%); }
.event-info { width: min(100%, 460px); max-height: calc(100% - 32px); overflow-y: auto; border: 1px solid color-mix(in srgb, var(--evt), var(--e-line) 60%); border-radius: 16px; color: var(--e-ink); background: var(--e-panel); box-shadow: 0 18px 60px rgb(0 0 0 / 45%); font: 13px/1.8 sans-serif; }
.event-info > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid var(--e-line); }
.event-info > header p, .event-info > header h2 { margin: 0; }
.event-info > header p { color: var(--e-sub); font-size: 10px; letter-spacing: .16em; }
.event-info > header h2 { margin-top: 2px; font: 700 18px/1.45 "Hiragino Mincho ProN", "Yu Mincho", YuMincho, serif; }
.event-info > header button { width: 38px; height: 38px; flex: 0 0 38px; border: 1px solid var(--e-line); border-radius: 50%; color: var(--e-ink); background: rgb(41 36 31 / 90%); font-size: 20px; cursor: pointer; }
.event-info-body { padding: 16px 18px 20px; }
.event-info-body h3 { margin: 18px 0 4px; color: color-mix(in srgb, var(--evt), white 42%); font: 700 13px/1.5 "Hiragino Mincho ProN", "Yu Mincho", YuMincho, serif; }
.event-info-body h3:first-of-type { margin-top: 14px; }
.event-info-body p { margin: 7px 0 0; color: var(--e-sub); }
.event-info-subtitle { color: var(--e-ink) !important; }
.full-time { white-space: pre-line; }
.event-home[data-motion="reduced"] *, .event-home[data-motion="reduced"] *::before, .event-home[data-motion="reduced"] *::after { scroll-behavior: auto !important; animation: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) {
	.event-home *, .event-home *::before, .event-home *::after { scroll-behavior: auto !important; animation: none !important; transition: none !important; }
}
</style>
