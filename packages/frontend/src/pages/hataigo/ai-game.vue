<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div ref="rootEl" :class="$style.root" :data-embedded="embedded">
	<!-- 見出しは上の「対局の種類」のタブが兼ねるので出さない。対局中だけ「新しく打つ」を右に置く -->
	<div v-if="view" :class="$style.heading"><button type="button" @click="requestNewGame"><i class="ti ti-refresh" aria-hidden="true"></i>{{ text.newGame }}</button></div>
	<section v-if="!view" :class="$style.setup" :aria-label="text.settings">
		<div :class="$style.step">
			<h3 :class="$style.stepLabel"><span>1</span>{{ text.boardStep }}</h3>
			<div :class="$style.ruleRow">
				<span :class="$style.ruleName">{{ text.size }}</span>
				<div :class="$style.segment" role="radiogroup" :aria-label="text.size">
					<button v-for="value in SIZES" :key="value" type="button" role="radio" :aria-checked="size === value" @click="size = value">{{ value }}{{ text.linesUnit }}</button>
				</div>
			</div>
			<div :class="$style.ruleRow">
				<span :class="$style.ruleName">{{ text.handicap }}</span>
				<div :class="$style.chips" role="radiogroup" :aria-label="text.handicap">
					<button v-for="value in HANDICAPS" :key="value" type="button" role="radio" :aria-checked="handicap === value" @click="handicap = value">{{ value === 0 ? text.even : `${value}${text.stonesUnit}` }}</button>
				</div>
			</div>
		</div>

		<div :class="$style.step">
			<h3 :class="$style.stepLabel"><span>2</span>{{ text.ownColor }}</h3>
			<div :class="$style.colors" role="radiogroup" :aria-label="text.ownColor">
				<button v-for="color in COLORS" :key="color" type="button" role="radio" :class="$style.colorCard" :aria-checked="ownColor === color" @click="ownColor = color">
					<span :class="$style.colorStone" :data-color="color" aria-hidden="true"></span>
					<span :class="$style.choiceText"><b>{{ color === 'black' ? text.black : text.white }}</b><small>{{ color === 'black' ? text.blackDesc : text.whiteDesc }}</small></span>
				</button>
			</div>
		</div>

		<div :class="$style.step">
			<h3 :class="$style.stepLabel"><span>3</span>{{ text.level }}</h3>
			<div :class="$style.levels" role="radiogroup" :aria-label="text.level">
				<button v-for="option in AI_LEVELS" :key="option.id" type="button" role="radio" :class="$style.levelCard" :aria-checked="level === option.id" @click="level = option.id">
					<span :class="$style.levelBars" aria-hidden="true"><i v-for="bar in 3" :key="bar" :data-on="bar <= levelRank(option.id)"></i></span>
					<b>{{ option.label }}</b>
					<small>{{ levelDescs[option.id] ?? '' }}</small>
				</button>
			</div>
			<p :class="$style.hint">{{ text.strengthNote }}</p>
		</div>

		<button type="button" :class="$style.go" :disabled="!active" @click="start"><i class="ti ti-player-play" aria-hidden="true"></i>{{ text.start }}</button>
	</section>
	<section v-if="confirmNewGame" :class="$style.confirm" role="alert"><p>{{ text.newGameConfirm }}</p><button type="button" @click="confirmNewGame = false">{{ text.cancel }}</button><button type="button" @click="reset">{{ text.resetConfirm }}</button></section>
	<template v-if="view">
		<div :class="$style.layout">
			<section :class="$style.boardCard">
				<!-- 状態と操作は盤の上にまとめる（盤の下だと、スマホでは盤に隠れて見落とす） -->
				<div :class="$style.bar">
					<div :class="$style.status" role="status" :data-tone="statusTone">
						<span :class="$style.statusDot" aria-hidden="true"></span>
						<b>{{ statusLabel }}</b>
						<span v-if="view.busy && view.progress" :class="$style.statusMeta">{{ view.progress.playouts }} / {{ budget.maxPlayouts }}</span>
						<span :class="$style.prisoners">{{ recordText.prisoners }} {{ text.black }} {{ view.state.prisoners.black }} · {{ text.white }} {{ view.state.prisoners.white }}</span>
						<button v-if="view.busy" type="button" :class="$style.small" @click="cancel">{{ text.cancel }}</button>
						<button v-else-if="view.paused && view.state.phase === 'playing'" type="button" :class="$style.small" :disabled="!active" @click="resume">{{ text.resume }}</button>
					</div>
					<!-- 考えていないときも場所は空けておく（出し入れすると盤が上下にずれる） -->
					<div :class="$style.progress" :data-active="view.busy" aria-hidden="true"><i :style="{ width: view.busy ? `${progressRate * 100}%` : '0%' }"></i></div>
					<div v-if="view.state.phase === 'playing'" :class="$style.actions">
						<button type="button" :disabled="!view.canPlay" @click="pass"><i class="ti ti-hand-stop" aria-hidden="true"></i>{{ text.pass }}</button>
						<button type="button" :disabled="view.state.moves.length === 0 || !active" @click="undo"><i class="ti ti-arrow-back-up" aria-hidden="true"></i>{{ text.undo }}</button>
						<button type="button" :disabled="!view.canPlay" @click="analyze('hint')"><i class="ti ti-bulb" aria-hidden="true"></i>{{ text.hint }}</button>
						<button type="button" :disabled="view.busy || !active" @click="analyze('estimate')"><i class="ti ti-scale" aria-hidden="true"></i>{{ text.estimate }}</button>
						<button type="button" :class="$style.warm" :disabled="!active" @click="confirmResign = true"><i class="ti ti-flag" aria-hidden="true"></i>{{ text.resign }}</button>
					</div>
					<p v-if="moveError" :class="$style.error" role="alert">{{ moveError }}</p>
					<p v-if="view.error" :class="$style.error" role="alert">{{ view.error === 'invalidAiMove' ? text.invalidAiMove : text.engineError }}</p>
					<p v-if="hintIsPass" :class="$style.notice">{{ text.hintPass }}</p>
					<section v-if="confirmResign && view.state.phase !== 'finished'" :class="$style.confirm" role="alert"><p>{{ text.resignTitle }}</p><button type="button" @click="confirmResign = false">{{ text.cancel }}</button><button type="button" :class="$style.warm" @click="resign">{{ text.confirmResign }}</button></section>
				</div>
				<HataigoBoard :class="$style.board" :position="view.state.board" :theme="prefs.theme" :stones="prefs.stones" :labels="prefs.labels" :interactive="boardInteractive" :marking="view.state.phase === 'scoring'" :turn="view.state.phase === 'playing' ? ownColor : null" :placement="prefs.placement" :lastMove="lastMove" :hints="hints" :territory="territory" :dead="view.state.scoring.deadStones" :blackAvatar="ownColor === 'black' ? avatar : undefined" :whiteAvatar="ownColor === 'white' ? avatar : undefined" :blackInitial="ownColor === 'black' ? '自' : 'AI'" :whiteInitial="ownColor === 'white' ? '自' : 'AI'" @place="place" @select="selectPoint"/>
				<label v-if="view.analysis" :class="$style.toggle"><input v-model="showOwnership" type="checkbox">{{ text.showOwnership }}</label>
			</section>
			<aside :class="$style.sidebar">
				<template v-if="view.state.phase === 'scoring'">
					<section :class="$style.card"><h3>{{ text.scoringTitle }}</h3><p>{{ text.scoringHelp }}</p><p :class="$style.note">{{ text.scoringDraft }}</p><div :class="$style.cardActions"><button type="button" :disabled="view.busy || !active" @click="analyze('estimate')">{{ text.estimate }}</button><button type="button" :disabled="view.busy" @click="clearMarks">{{ text.clearMarks }}</button></div></section>
					<section v-if="score" :class="$style.card"><table><thead><tr><th></th><th scope="col">{{ text.black }}</th><th scope="col">{{ text.white }}</th></tr></thead><tbody><tr><th scope="row">{{ text.territory }}</th><td>{{ score.black.territory }}</td><td>{{ score.white.territory }}</td></tr><tr><th scope="row">{{ text.dead }}</th><td>{{ score.black.deadStones }}</td><td>{{ score.white.deadStones }}</td></tr><tr><th scope="row">{{ text.prisoners }}</th><td>{{ view.state.prisoners.black }}</td><td>{{ view.state.prisoners.white }}</td></tr><tr><th scope="row">{{ text.komi }}</th><td>0</td><td>{{ score.white.komi }}</td></tr><tr><th scope="row">{{ text.total }}</th><td>{{ score.black.total }}</td><td>{{ score.white.total }}</td></tr></tbody></table><button type="button" :class="$style.primary" :disabled="view.busy || !active" @click="confirmScore">{{ text.confirmScore }}</button></section>
				</template>
				<section v-if="view.state.phase === 'finished'" :class="$style.card" role="status"><h3>{{ text.finished }}</h3><p>{{ resultLabel }}</p><p v-if="saving">{{ text.saving }}</p><p v-else-if="saved">{{ text.saved }}</p><template v-if="storeError"><p :class="$style.error">{{ storeError }}</p><button v-if="completedRecord && !saved" type="button" :disabled="saving" @click="persistResult">{{ text.saveRetry }}</button></template></section>

				<section :class="$style.card" :aria-label="text.thoughtTitle">
					<h3 :class="$style.thoughtTitle" :data-collapsed="!showThought"><i class="ti ti-robot" aria-hidden="true"></i>{{ text.thoughtTitle }}<HataigoHelp :label="text.thoughtTitle" :text="text.thoughtHelp"/><HataigoShowToggle :label="text.thoughtTitle" :shown="showThought" @toggle="toggleThought"/></h3>
					<template v-if="showThought && thought">
						<p :class="$style.thoughtLead">
							<template v-if="thought.live">{{ text.thoughtLive }}</template>
							<template v-else-if="thought.result.move === null">AIは{{ text.thoughtPassed }}</template>
							<template v-else>AIは <b :class="$style.point">{{ pointLabel(thought.result.move) }}</b> {{ text.thoughtPlayed }}</template>
							<small>{{ thought.result.playouts }}{{ text.triesUnit }}</small>
						</p>
						<div :class="$style.thoughtHead" aria-hidden="true"><span>{{ text.candidate }}</span><span>{{ text.aiWinRate }}</span></div>
						<ol :class="$style.thoughtList">
							<li v-for="(candidate, index) in thought.result.candidates" :key="index" :data-chosen="!thought.live && samePoint(candidate.point, thought.result.move)">
								<span :class="$style.candidatePoint">{{ pointLabel(candidate.point) }}</span>
								<span :class="$style.candidateRate"><b>{{ candidate.winRate === null ? '—' : `${Math.round(candidate.winRate * 100)}%` }}</b><small>{{ candidate.visits }}{{ text.visits }}</small></span>
								<span :class="$style.shareBar" :aria-label="`${text.share} ${share(candidate.visits, thought.result.playouts)}%`"><i :style="{ width: `${share(candidate.visits, thought.result.playouts)}%` }"></i></span>
							</li>
						</ol>
					</template>
					<p v-else-if="showThought" :class="$style.note">{{ text.thoughtEmpty }}</p>
				</section>

				<HataigoEstimate :result="view.analysis" :entries="view.graph" :currentMove="view.state.moves.length"/>
			</aside>
		</div>
	</template>
</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, ref, shallowRef, useTemplateRef, watch } from 'vue';
import type { AiRecord } from '@/utility/hataigo/ai-records.js';
import type { BoardSize, Color, Point } from '@/utility/hataigo/rules/board.js';
import HataigoBoard from '@/components/hataigo/HataigoBoard.vue';
import HataigoEstimate from '@/components/hataigo/HataigoEstimate.vue';
import HataigoHelp from '@/components/hataigo/HataigoHelp.vue';
import HataigoShowToggle from '@/components/hataigo/HataigoShowToggle.vue';
import { $i } from '@/i.js';
import { AiGameSession, ownershipMarks } from '@/utility/hataigo/ai-game.js';
import { useAiRecords } from '@/utility/hataigo/ai-records.js';
import { createEngineClient } from '@/utility/hataigo/engine/client.js';
import { AI_LEVELS, getLevelBudget } from '@/utility/hataigo/engine/levels.js';
import { aiText as text, recordText } from '@/utility/hataigo/i18n.js';
import { useHataigoPrefs } from '@/utility/hataigo/prefs.js';
import { toDisplayPoint } from '@/utility/hataigo/rules/board.js';
import { scrollToTop } from '@/utility/hataigo/scroll.js';

defineOptions({ name: 'HataigoAiGame' });
const emit = defineEmits<{ finished: [] }>();
const props = withDefaults(defineProps<{ initialSize?: BoardSize; active?: boolean; embedded?: boolean }>(), { initialSize: 19, active: true, embedded: false });
const { prefs, save: savePrefs } = useHataigoPrefs();
// 押したらすぐ畳む。保存は裏で（失敗しても今の画面の見え方は押したとおり）
const thoughtOverride = ref<boolean | null>(null);
const showThought = computed(() => thoughtOverride.value ?? prefs.showThought !== false);
const store = useAiRecords();
const storeError = store.error;

// The size picker is a local setting; host prop updates never erase a game.
function getInitialSize(): BoardSize { return props.initialSize; }

const size = ref<BoardSize>(getInitialSize());
const handicap = ref(0);
const ownColor = ref<Color>('black');
const level = ref('balanced');
const SIZES = [9, 13, 19] as const;
const HANDICAPS = [0, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const COLORS = ['black', 'white'] as const;
const levelDescs: Record<string, string> = { quick: text.quickDesc, balanced: text.balancedDesc, patient: text.patientDesc };
const session = shallowRef<AiGameSession | null>(null);
const revision = ref(0);
const rootEl = useTemplateRef('rootEl');
// 条件の画面 ⇄ 対局の画面を替えたら先頭から見せる
watch(session, () => { void nextTick(() => scrollToTop(rootEl.value)); });
const view = computed(() => {
	void revision.value;
	const game = session.value;
	return game === null ? null : { state: game.state, busy: game.busy, paused: game.paused, error: game.error, purpose: game.purpose, analysis: game.analysis, progress: game.progress, canPlay: game.canPlay, graph: game.graph };
});
const showOwnership = ref(false);
const showHint = ref(false);
const confirmResign = ref(false);
const confirmNewGame = ref(false);
const moveError = ref<string | null>(null);
const saving = ref(false);
const saved = ref(false);
const completedRecord = shallowRef<AiRecord | null>(null);
const avatar = $i?.avatarUrl ?? undefined;
const boardInteractive = computed(() => props.active && view.value !== null && !view.value.busy && (view.value.state.phase === 'scoring' || view.value.canPlay));
const lastMove = computed(() => view.value?.state.moves.at(-1)?.point ?? null);
const candidates = computed(() => [...(view.value?.analysis?.candidates ?? [])].sort((a, b) => b.visits - a.visits).slice(0, 3));
const hintIsPass = computed(() => showHint.value && view.value?.analysis !== null && candidates.value[0]?.point === null);
const hints = computed(() => {
	if (view.value?.state.phase === 'scoring') return view.value.state.scoring.neutralPoints.map(point => ({ point, kind: 'failure' as const }));
	const point = showHint.value ? candidates.value[0]?.point : null;
	return point ? [{ point, label: '1' }] : [];
});
const territory = computed(() => {
	if (view.value === null) return { black: [], white: [] };
	if (showOwnership.value) return ownershipMarks(view.value.state, view.value.analysis);
	if (view.value.state.phase === 'scoring') return session.value?.score.territory ?? { black: [], white: [] };
	return { black: [], white: [] };
});
const score = computed(() => view.value?.state.phase === 'scoring' ? session.value?.score : undefined);
const budget = computed(() => getLevelBudget(session.value?.options.level ?? level.value, session.value?.options.size ?? size.value));
const progressRate = computed(() => Math.min(1, (view.value?.progress?.playouts ?? 0) / Math.max(1, budget.value.maxPlayouts)));
const statusTone = computed(() => {
	const current = view.value;
	if (current === null) return 'idle';
	if (current.busy) return 'busy';
	if (current.state.phase !== 'playing') return 'idle';
	return current.canPlay ? 'turn' : 'idle';
});
const statusLabel = computed(() => {
	const current = view.value;
	if (current === null) return '';
	if (current.busy) return current.purpose === 'ai' ? text.thinking : text.analyzing;
	if (current.state.phase === 'scoring') return text.scoringTitle;
	if (current.state.phase === 'finished') return text.finished;
	if (current.paused) return text.paused;
	return current.state.toPlay === ownColor.value ? text.yourTurn : text.aiTurn;
});
/** 考えている最中はその途中経過を、打ったあとはその手を決めたときの読みを出す */
const thought = computed(() => {
	void revision.value;
	const game = session.value;
	if (game === null) return null;
	if (game.busy && game.purpose === 'ai' && game.progress !== null && game.progress.candidates.length > 0) return { live: true, result: game.progress };
	return game.lastAiThought === null ? null : { live: false, result: game.lastAiThought.result };
});
const resultLabel = computed(() => {
	const result = view.value?.state.result;
	if (!result) return '';
	const winner = result.winner === 'draw' ? text.draw : `${result.winner === 'black' ? text.black : text.white}${text.winner}`;
	return `${winner} · ${result.reason === 'resign' ? text.resignReason : `${text.scoreReason} ${result.score?.margin ?? 0}${text.points}`}`;
});

watch(() => view.value?.state.phase, phase => { if (phase === 'finished') { completedRecord.value ??= session.value?.finishedRecord(new Date().toISOString()) ?? null; void persistResult(); } });
watch(() => props.active, active => { if (active) session.value?.activate(); else session.value?.deactivate(); });
onActivated(() => { if (props.active) session.value?.activate(); });
onDeactivated(() => session.value?.deactivate());
onBeforeUnmount(() => session.value?.deactivate());

function start(): void {
	if (!props.active) return;
	completedRecord.value = null;
	saving.value = false;
	saved.value = false;
	moveError.value = null;
	session.value = new AiGameSession({ id: crypto.randomUUID(), size: size.value, handicap: handicap.value, ownColor: ownColor.value, level: level.value }, createEngineClient, () => { revision.value++; });
	void session.value.resume();
}

function requestNewGame(): void {
	if (session.value?.state.phase === 'finished') reset();
	else confirmNewGame.value = true;
}

function reset(): void {
	session.value?.deactivate();
	session.value = null;
	confirmNewGame.value = false;
	confirmResign.value = false;
	showOwnership.value = false;
	showHint.value = false;
	moveError.value = null;
}

async function play(point: Point | null): Promise<void> {
	showHint.value = false;
	showOwnership.value = false;
	const result = await session.value?.play(point);
	if (result && !result.ok) moveError.value = result.reason in text ? text[result.reason as keyof typeof text] : text.notYourTurn;
	else moveError.value = null;
}

function place(x: number, y: number): void {
	if (view.value?.state.phase === 'playing') void play({ x, y });
}

function pass(): void { void play(null); }

function selectPoint(point: Point): void { if (view.value?.state.phase === 'scoring') session.value?.mark(point); }

function clearMarks(): void { session.value?.clearMarks(); }

function confirmScore(): void { session.value?.confirmScore(); }

function cancel(): void { session.value?.cancel(); }

function resume(): void { void session.value?.resume(); }

function undo(): void { session.value?.undo(); showHint.value = false; showOwnership.value = false; moveError.value = null; }

function resign(): void { confirmResign.value = false; session.value?.resign(); }

async function analyze(kind: 'hint' | 'estimate'): Promise<void> {
	showHint.value = kind === 'hint';
	showOwnership.value = kind === 'estimate';
	await session.value?.analyze(kind);
}

function toggleThought(): void {
	const next = !showThought.value;
	thoughtOverride.value = next;
	void savePrefs({ showThought: next });
}

function levelRank(id: string): number { return Math.max(1, AI_LEVELS.findIndex(option => option.id === id) + 1); }

function pointLabel(point: Point | null): string { return point === null ? text.pass : toDisplayPoint(point, session.value?.options.size ?? size.value); }

function samePoint(a: Point | null, b: Point | null): boolean { return a === null || b === null ? a === b : a.x === b.x && a.y === b.y; }

function share(visits: number, playouts: number): number { return playouts > 0 ? Math.round(visits / playouts * 100) : 0; }

async function persistResult(): Promise<void> {
	const record = completedRecord.value;
	if (record === null || saving.value || saved.value) return;
	saving.value = true;
	try {
		const result = await store.save(record);
		if (completedRecord.value?.id === record.id) { saved.value = result; if (result) emit('finished'); }
	} finally { if (completedRecord.value?.id === record.id) saving.value = false; }
}
</script>

<style module lang="scss">
.root { min-width: 0; container-type: inline-size; color: var(--hy-ink); }
.heading { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
.root h3 { margin: 0 0 12px; font-size: 15px; }
.root button, .root select { min-height: 44px; border: 1px solid var(--hy-border); border-radius: 999px; padding: 8px 14px; background: var(--hy-surface); color: inherit; font: inherit; font-size: 13px; }
.root button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; }
.root button:hover:enabled { background: var(--hy-soft); }
.root button:disabled { opacity: .45; cursor: default; }
.root button:focus-visible, .root select:focus-visible, .root input:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
.root .primary { background: var(--hy-accent); color: #fff; border-color: transparent; }
.root .primary:hover:enabled { background: var(--hy-accent); filter: brightness(1.08); }
.root .warm { background: var(--hy-warm, #f6e3cf); color: #7a4a1a; border-color: transparent; }
.root .warm:hover:enabled { background: var(--hy-warm, #f6e3cf); filter: brightness(.97); }
.root label { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 13px; }
.card, .boardCard { padding: 16px; background: var(--hy-surface); border: 1px solid var(--hy-border); border-radius: 24px; box-shadow: var(--hy-shadow); min-width: 0; }

/* 開始画面：人と打つ（ロビー）と同じ段組み */
.setup { max-width: 760px; margin-inline: auto; display: grid; gap: 4px; padding: 8px; background: var(--hy-surface); border: 1px solid var(--hy-border); border-radius: 28px; box-shadow: var(--hy-shadow); }
.step { display: grid; gap: 10px; padding: 14px 12px; }
.step + .step { border-top: 1px solid var(--hy-border); }
.root .stepLabel { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; font-weight: 700; color: var(--hy-muted); }
.stepLabel span { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; background: var(--hy-soft); color: var(--hy-accent); font-size: 11px; font-variant-numeric: tabular-nums; }
.ruleRow { display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: 10px; }
.ruleName { font-size: 13px; color: var(--hy-muted); }
.segment { display: inline-flex; justify-self: start; gap: 2px; padding: 3px; border-radius: 999px; background: var(--hy-bg); }
.root .segment button { all: unset; box-sizing: border-box; min-width: 64px; min-height: 40px; padding: 0 16px; display: grid; place-items: center; border-radius: 999px; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; cursor: pointer; }
.root .segment button[aria-checked='true'] { background: var(--hy-surface); color: var(--hy-accent); box-shadow: 0 1px 3px rgb(0 0 0 / 14%); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.root .chips button { all: unset; box-sizing: border-box; min-width: 48px; min-height: 40px; padding: 0 12px; display: grid; place-items: center; border-radius: 999px; background: var(--hy-bg); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; cursor: pointer; }
.root .chips button[aria-checked='true'] { background: var(--hy-accent); color: var(--hy-on-accent, #fff); }
.colors { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.root .colorCard, .root .levelCard { all: unset; box-sizing: border-box; min-width: 0; border-radius: 20px; background: var(--hy-bg); cursor: pointer; box-shadow: inset 0 0 0 1px transparent; transition: box-shadow .15s ease, background .15s ease; }
.root .colorCard { display: flex; align-items: center; gap: 12px; padding: 14px; }
.root .colorCard:hover, .root .levelCard:hover { background: var(--hy-soft); }
.root .colorCard[aria-checked='true'], .root .levelCard[aria-checked='true'] { background: var(--hy-soft); box-shadow: inset 0 0 0 2px var(--hy-accent); }
.colorStone { flex: none; width: 36px; height: 36px; border-radius: 50%; }
.colorStone[data-color='black'] { background: radial-gradient(circle at 35% 30%, #5a5450, #141210 70%); }
.colorStone[data-color='white'] { background: radial-gradient(circle at 35% 30%, #fff, #ddd6cc 75%); box-shadow: inset 0 0 0 1px rgb(0 0 0 / 18%); }
.choiceText { min-width: 0; display: grid; gap: 2px; }
.choiceText b { font-size: 15px; }
.choiceText small { font-size: 12px; color: var(--hy-muted); }
.levels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.root .levelCard { display: grid; gap: 6px; padding: 14px; }
.levelCard b { font-size: 14px; }
.levelCard small { font-size: 12px; color: var(--hy-muted); }
.levelBars { display: flex; align-items: flex-end; gap: 3px; height: 16px; }
.levelBars i { width: 6px; border-radius: 2px; background: var(--hy-border); }
.levelBars i:nth-child(1) { height: 6px; }
.levelBars i:nth-child(2) { height: 11px; }
.levelBars i:nth-child(3) { height: 16px; }
.levelBars i[data-on='true'] { background: var(--hy-accent); }
.hint { margin: 0; font-size: 12px; color: var(--hy-muted); }
.root .go { all: unset; box-sizing: border-box; margin: 6px 4px 4px; min-height: 52px; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 999px; background: var(--hy-accent); color: var(--hy-on-accent, #fff); font-size: 16px; font-weight: 700; cursor: pointer; }
.root .go:hover:enabled { filter: brightness(1.06); }
.root .go:disabled { opacity: .5; cursor: default; }
.root .go:focus-visible, .root .colorCard:focus-visible, .root .levelCard:focus-visible, .root .chips button:focus-visible, .root .segment button:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
@container (max-width: 520px) {
	.ruleRow { grid-template-columns: minmax(0, 1fr); gap: 6px; }
	.levels { grid-template-columns: minmax(0, 1fr); }
	.root .levelCard { grid-template-columns: auto auto minmax(0, 1fr); align-items: center; gap: 10px; }
}
.note { color: var(--hy-muted); font-size: 12px; line-height: 1.8; margin: 8px 0 0; }
.error { margin: 0; color: var(--MI_THEME-error, #b23c43); font-size: 13px; line-height: 1.7; }
.notice { margin: 0; font-size: 13px; color: var(--hy-accent); }
.confirm { border: 1px solid var(--hy-accent); background: var(--hy-soft); border-radius: 20px; padding: 12px; }
.confirm p { margin: 0 0 10px; }
.confirm button + button { margin-inline-start: 8px; }
.layout { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr); align-items: start; gap: 14px; }
.boardCard { display: flex; flex-direction: column; gap: 12px; }

/* 盤の上の操作帯：状態 → 進み具合 → ボタン → その場のお知らせ */
.bar { display: grid; gap: 10px; }
/* 状態の行は高さを固定して折り返さない（考え始めて要素が増えても盤が動かないように） */
.status { box-sizing: border-box; height: 48px; display: flex; align-items: center; flex-wrap: nowrap; gap: 10px; padding: 6px 6px 6px 14px; border-radius: 16px; background: var(--hy-bg); overflow: hidden; }
.status > b { flex: none; font-size: 14px; white-space: nowrap; }
.status > * { flex-shrink: 0; }
.status .prisoners { flex: 1 1 auto; min-width: 0; text-align: end; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.statusDot { width: 10px; height: 10px; border-radius: 50%; background: var(--hy-border); }
.status[data-tone='turn'] { background: var(--hy-soft); }
.status[data-tone='turn'] .statusDot { background: var(--hy-accent); }
.status[data-tone='busy'] .statusDot { background: var(--hy-accent); animation: hataigoPulse 1.2s ease-in-out infinite; }
@keyframes hataigoPulse { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
@media (prefers-reduced-motion: reduce) { .status[data-tone='busy'] .statusDot { animation: none; } }
.statusMeta { font-size: 12px; color: var(--hy-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.prisoners { margin-inline-start: auto; font-size: 12px; color: var(--hy-muted); font-variant-numeric: tabular-nums; }
.root .small { min-height: 36px; padding: 4px 12px; font-size: 12px; }
.progress { height: 4px; border-radius: 999px; background: transparent; overflow: hidden; transition: background .2s ease; }
.progress[data-active='true'] { background: var(--hy-bg); }
.progress i { display: block; height: 100%; border-radius: inherit; background: var(--hy-accent); transition: width .2s linear; }
.actions { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.actions button { padding-inline: 6px; white-space: nowrap; }
.toggle { color: var(--hy-muted); }

.sidebar { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.card p { line-height: 1.8; font-size: 13px; }
.cardActions { display: flex; flex-wrap: wrap; gap: 8px; }
.card table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-variant-numeric: tabular-nums; font-size: 13px; }
.card th, .card td { text-align: end; padding: 7px 6px; border-bottom: 1px solid var(--hy-border); }
.card th:first-child { text-align: start; font-weight: 400; color: var(--hy-muted); }

/* AI の読み */
.thoughtTitle { display: flex; align-items: center; gap: 8px; }
.root .thoughtTitle[data-collapsed='true'] { margin-bottom: 0; }
.thoughtTitle i { color: var(--hy-accent); font-size: 18px; }
/* 1行＝手と勝率。読んだ割合は行の下の細い線1本だけ。選んだ手は行の色で示す */
.root .thoughtLead { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 6px; margin: 0 0 12px; font-size: 15px; line-height: 1.6; }
.thoughtLead small { margin-inline-start: auto; font-size: 12px; color: var(--hy-muted); font-variant-numeric: tabular-nums; }
.point { display: inline-block; min-width: 2.4em; padding: 0 8px; border-radius: 8px; background: var(--hy-soft); color: var(--hy-accent); text-align: center; font-variant-numeric: tabular-nums; }
.thoughtHead { display: flex; justify-content: space-between; padding: 0 12px 4px; font-size: 11px; color: var(--hy-muted); }
.thoughtList { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.thoughtList li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; row-gap: 6px; padding: 10px 12px 8px; border-radius: 12px; }
.thoughtList li[data-chosen='true'] { background: var(--hy-soft); }
.candidatePoint { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.thoughtList li[data-chosen='true'] .candidatePoint { color: var(--hy-accent); }
.candidateRate { display: flex; align-items: baseline; gap: 6px; font-variant-numeric: tabular-nums; }
.candidateRate b { font-size: 15px; }
.candidateRate small { min-width: 3em; text-align: end; font-size: 11px; color: var(--hy-muted); }
.shareBar { grid-column: 1 / -1; height: 3px; border-radius: 999px; background: var(--hy-bg); overflow: hidden; }
.thoughtList li[data-chosen='true'] .shareBar { background: color-mix(in srgb, var(--hy-accent) 18%, transparent); }
.shareBar i { display: block; height: 100%; border-radius: inherit; background: var(--hy-accent); opacity: .7; }

@container (max-width: 720px) { .layout { grid-template-columns: minmax(0, 1fr); } .boardCard { padding: 8px; } }
@container (max-width: 480px) {
	/* スマホでは碁盤を画面の端まで広げ、交点の間隔を少しでも稼ぐ。ボタンや文字は内側に残す */
	.boardCard { margin-inline: -12px; padding: 8px 0; border-inline: 0; border-radius: 0; box-shadow: none; --hataigo-gutter: 12px; }
	.boardCard > :not(.board) { margin-inline: 12px; }
	.actions { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
	.actions button { flex-direction: column; gap: 2px; min-height: 52px; padding: 4px 2px; border-radius: 14px; font-size: 11px; }
	.actions button i { font-size: 18px; }
}
</style>
