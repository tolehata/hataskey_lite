<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div ref="rootEl" :class="$style.root" :data-embedded="embedded">
	<section v-if="pendingReplay" role="alert" :class="$style.notice"><p>{{ historyText.loadExternal }}</p><button type="button" @click="acceptReplay">{{ historyText.confirmLoad }}</button><button type="button" @click="pendingReplay = null">{{ historyText.cancelLoad }}</button></section>
	<div v-if="showingBoard" :class="$style.heading">
		<button v-if="mode === 'solo'" type="button" :class="$style.back" @click="openSetup"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i>{{ text.changeSetup }}</button>
		<button type="button" :class="$style.sgfMenu" :disabled="importing" :aria-label="text.sgfMenu" aria-haspopup="menu" @click="openSgfMenu"><i class="ti ti-file-text" aria-hidden="true"></i>SGF<i class="ti ti-chevron-down" aria-hidden="true"></i></button>
	</div>
	<input ref="fileInput" :class="$style.fileInput" type="file" accept=".sgf,application/x-go-sgf,text/plain" @change="readFile">
	<p v-if="error" role="alert" :class="$style.error">{{ error }}</p>
	<!-- 条件の画面：AIと打つ・人と打つと同じ段組み -->
	<section v-if="mode === 'solo' && soloView === 'setup'" :class="$style.setup" :aria-label="text.newBoard">
		<div :class="$style.step">
			<h3 :class="$style.stepLabel"><span>1</span>{{ text.boardStep }}</h3>
			<div :class="$style.ruleRow">
				<span :class="$style.ruleName">{{ text.boardSize }}</span>
				<div :class="$style.segment" role="radiogroup" :aria-label="text.boardSize">
					<button v-for="size in SIZES" :key="size" type="button" role="radio" :aria-checked="newSize === size" @click="newSize = size">{{ size }}{{ text.linesUnit }}</button>
				</div>
			</div>
			<div :class="$style.ruleRow">
				<span :class="$style.ruleName">{{ text.handicap }}</span>
				<div :class="$style.chips" role="radiogroup" :aria-label="text.handicap">
					<button v-for="count in HANDICAPS" :key="count" type="button" role="radio" :aria-checked="newHandicap === count" @click="newHandicap = count">{{ count === 0 ? text.even : `${count}${text.stonesUnit}` }}</button>
				</div>
			</div>
		</div>
		<div :class="$style.step">
			<h3 :class="$style.stepLabel"><span>2</span>{{ text.fromRecordStep }}</h3>
			<button type="button" :class="$style.openRecord" :disabled="importing" @click="fileInput?.click()">
				<span :class="$style.openIcon"><i class="ti ti-file-upload" aria-hidden="true"></i></span>
				<span :class="$style.openText"><b>{{ text.importSgf }}</b><small>{{ text.fromRecordDesc }}</small></span>
				<i class="ti ti-chevron-right" aria-hidden="true"></i>
			</button>
		</div>
		<div :class="$style.setupActions">
			<button v-if="hasBoard" type="button" :class="$style.resume" @click="showBoard"><i class="ti ti-arrow-back-up" aria-hidden="true"></i>{{ text.backToBoard }}</button>
			<button type="button" :class="$style.go" @click="requestReset"><i class="ti ti-player-play" aria-hidden="true"></i>{{ text.newBoard }}</button>
		</div>
	</section>
	<section v-if="confirmReset" :class="$style.confirm" role="alert">
		<p>{{ text.resetConfirm }}</p>
		<button type="button" @click="confirmReset = false">{{ text.cancel }}</button>
		<button type="button" :class="$style.primary" @click="reset">{{ text.confirmReset }}</button>
	</section>
	<template v-if="showingBoard">
		<label v-if="records.length > 1" :class="$style.gameSelect">{{ text.game }}<select v-model.number="selectedGame" @change="changeGame"><option v-for="(game, index) in records" :key="index" :value="index">{{ index + 1 }} · {{ game.size }}{{ text.linesUnit }}</option></select></label>
		<div :class="$style.layout">
			<section :class="$style.boardCard">
				<!-- 手番と操作は盤の上に（AIと打つと同じ並び） -->
				<div v-if="mode === 'solo'" :class="$style.bar">
					<div :class="$style.barStatus" role="status"><span :class="$style.turnStone" :data-color="position.toPlay" aria-hidden="true"></span><b>{{ text.nextTurn }} {{ position.toPlay === 'black' ? text.black : text.white }}</b><span :class="$style.barMeta">{{ text.prisoners }} {{ text.black }} {{ position.prisoners.black }} · {{ text.white }} {{ position.prisoners.white }}</span></div>
					<div :class="$style.soloActions">
						<button type="button" @click="pass"><i class="ti ti-hand-stop" aria-hidden="true"></i>{{ text.pass }}</button>
						<button type="button" :disabled="position.moveNumber === 0" @click="navigate('previous')"><i class="ti ti-arrow-back-up" aria-hidden="true"></i>{{ text.undo }}</button>
						<button type="button" :aria-pressed="review" @click="review = !review"><i class="ti ti-bulb" aria-hidden="true"></i>{{ text.review }}</button>
					</div>
				</div>
				<HataigoBoard
					:class="$style.board"
					:position="position.board"
					:theme="prefs.theme"
					:stones="prefs.stones"
					:labels="prefs.labels"
					:interactive="mode === 'solo'"
					:turn="position.toPlay"
					:placement="prefs.placement"
					:numbers="numbers"
					:numberFrom="Math.max(1, position.moveNumber - 9)"
					:lastMove="position.lastMove"
					:hints="reviewHints"
					:territory="reviewTerritory"
					@place="place"
				/>
				<div :class="$style.transport">
					<button type="button" :title="text.first" :aria-label="text.first" :disabled="position.moveNumber === 0" @click="navigate('first')"><i class="ti ti-player-skip-back" aria-hidden="true"></i></button>
					<button type="button" :title="text.previous" :aria-label="text.previous" :disabled="position.moveNumber === 0" @click="navigate('previous')"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
					<button type="button" :class="$style.play" :title="playing ? text.pause : text.play" :aria-label="playing ? text.pause : text.play" :aria-pressed="playing" :disabled="total === 0" @click="togglePlayback"><i :class="playing ? 'ti ti-player-pause' : 'ti ti-player-play'" aria-hidden="true"></i></button>
					<button type="button" :title="text.next" :aria-label="text.next" :disabled="position.moveNumber === total" @click="navigate('next')"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
					<button type="button" :title="text.last" :aria-label="text.last" :disabled="position.moveNumber === total" @click="navigate('last')"><i class="ti ti-player-skip-forward" aria-hidden="true"></i></button>
				</div>
				<label :class="$style.interval">{{ text.interval }}<select :value="prefs.autoplayInterval" @change="changeInterval"><option v-for="interval in [500, 1000, 1500, 2000, 3000]" :key="interval" :value="interval">{{ interval / 1000 }}{{ text.seconds }}</option></select></label>
			</section>
			<div :class="$style.sidebar">
				<section :class="$style.summary">
					<div :class="$style.summaryTop">
						<div><small>{{ metadata.PB?.[0] || text.black }} / {{ metadata.PW?.[0] || text.white }} · {{ record.size }}{{ text.linesUnit }}</small><output :class="$style.counter" :aria-label="text.moves"><b>{{ position.moveNumber }}</b><span> / {{ total }} {{ text.moveUnit }}</span></output></div>
						<div :class="$style.modeTabs"><button type="button" :aria-pressed="!review" @click="review = false">{{ text.replay }}</button><button type="button" :aria-pressed="review" @click="review = true"><i class="ti ti-bulb" aria-hidden="true"></i>{{ text.review }}</button></div>
					</div>
					<div :class="$style.status" aria-live="polite"><span>{{ text.turn }} · {{ position.toPlay === 'black' ? text.black : text.white }}</span><span>{{ text.prisoners }} · {{ text.black }} {{ position.prisoners.black }} / {{ text.white }} {{ position.prisoners.white }}</span></div>
					<div v-if="review" :class="$style.reviewControls"><button type="button" :disabled="reviewBusy || !active" @click="runReview('candidates')">{{ aiText.review }}</button><button type="button" :disabled="reviewBusy || !active" @click="runReview('hint')">{{ aiText.hint }}</button><button type="button" :disabled="reviewBusy || !active" @click="runReview('estimate')">{{ aiText.estimate }}</button><button v-if="reviewBusy" type="button" @click="cancelReview">{{ aiText.cancel }}</button></div>
					<p v-if="reviewBusy" role="status" :class="$style.muted">{{ aiText.analyzing }} · {{ reviewProgress }} {{ aiText.playouts }}</p>
					<p v-if="reviewError" role="alert" :class="$style.error">{{ reviewError }}</p>
				</section>
				<HataigoEstimate v-if="review" :result="reviewResult" :entries="reviewGraph" :currentMove="position.moveNumber" interactive @jump="jumpEstimate"/>
				<section v-if="review && reviewCandidates.length" :class="$style.variations"><h3>{{ aiText.candidates }}</h3><small>{{ aiText.winRate }}</small><div v-for="(candidate, index) in reviewCandidates" :key="index" :class="$style.candidate"><b>{{ index + 1 }}</b><span>{{ pointLabel(candidate.point) }}</span><span>{{ candidate.winRate === null ? '—' : `${(candidate.winRate * 100).toFixed(1)}%` }}</span><small>{{ candidate.visits }} {{ aiText.visits }}</small></div><p v-if="reviewKind === 'hint' && reviewCandidates[0]?.point === null" :class="$style.muted">{{ aiText.hintPass }}</p><label><input v-model="showReviewOwnership" type="checkbox">{{ aiText.showOwnership }}</label></section>
				<section v-if="branches.length" :class="$style.variations">
					<h3><i class="ti ti-git-branch" aria-hidden="true"></i>{{ text.variations }}</h3>
					<label v-for="branch in branches" :key="branch.parent">{{ branch.number }}{{ text.atMove }}<select :value="branch.selected" @change="chooseBranch(branch.parent, $event)"><option v-for="(node, index) in branch.options" :key="node.id" :value="node.id">{{ index + 1 }} · {{ variationLabel(node) }}</option></select></label>
				</section>
				<section :class="$style.moveCard">
					<h3>{{ text.moves }}</h3>
					<p v-if="moves.length === 0" :class="$style.muted">{{ text.empty }}</p>
					<div v-else :class="$style.moveScroll">
						<table><thead><tr><th scope="col">{{ text.moveUnit }}</th><th scope="col">{{ text.black }}</th><th scope="col">{{ text.white }}</th></tr></thead><tbody><tr v-for="move in visibleMoves" :key="move.id"><th scope="row">{{ move.number }}</th><td><button v-if="move.color === 'black'" type="button" :data-current="move.number === position.moveNumber" :aria-current="move.number === position.moveNumber ? 'step' : undefined" @click="jump(move.id)">{{ pointLabel(move.point) }}</button></td><td><button v-if="move.color === 'white'" type="button" :data-current="move.number === position.moveNumber" :aria-current="move.number === position.moveNumber ? 'step' : undefined" @click="jump(move.id)">{{ pointLabel(move.point) }}</button></td></tr></tbody></table>
					</div>
					<div v-if="moves.length > 100" :class="$style.pages"><button type="button" :disabled="movePage === 0" @click="movePage--">{{ text.previousPage }}</button><span>{{ movePage + 1 }} / {{ Math.ceil(moves.length / 100) }}</span><button type="button" :disabled="(movePage + 1) * 100 >= moves.length" @click="movePage++">{{ text.nextPage }}</button></div>
				</section>
				<section v-if="currentComment" :class="$style.comment"><h3>{{ text.comment }}</h3><p>{{ currentComment }}</p></section>
			</div>
		</div>
	</template>
</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, shallowRef, useTemplateRef, watch } from 'vue';
import type { SearchResult } from '@/utility/hataigo/engine/client.js';
import type { LocalRecord, RecordNode } from '@/utility/hataigo/record.js';
import type { BoardSize, Point } from '@/utility/hataigo/rules/board.js';
import type { MenuItem } from '@/types/menu.js';
import HataigoBoard from '@/components/hataigo/HataigoBoard.vue';
import HataigoEstimate from '@/components/hataigo/HataigoEstimate.vue';
import { ownershipMarks } from '@/utility/hataigo/ai-game.js';
import { createEngineClient } from '@/utility/hataigo/engine/client.js';
import { getLevelBudget } from '@/utility/hataigo/engine/levels.js';
import { aiText, recordText as text } from '@/utility/hataigo/i18n.js';
import { useHataigoPrefs } from '@/utility/hataigo/prefs.js';
import { createRecord, exportRecord, importRecord, RecordPlayback } from '@/utility/hataigo/record.js';
import { toDisplayPoint } from '@/utility/hataigo/rules/board.js';
import { historyText } from '@/utility/hataigo/history.js';
import { DEFAULT_SGF_LIMITS } from '@/utility/hataigo/rules/sgf.js';
import { scrollToTop } from '@/utility/hataigo/scroll.js';
import * as os from '@/os.js';

defineOptions({ name: 'HataigoAnalysis' });
const props = withDefaults(defineProps<{ mode?: 'solo' | 'replay'; embedded?: boolean; initialSize?: BoardSize; active?: boolean; replayRequest?: { id: string; sgf: string } }>(), { mode: 'solo', embedded: false, initialSize: 19, active: true, replayRequest: undefined });
const { prefs, save } = useHataigoPrefs();

// initialSize seeds this record once. Later prop changes must preserve unsaved moves.
function createInitialRecord(): LocalRecord {
	return createRecord({ size: props.initialSize });
}

const records = shallowRef<LocalRecord[]>([createInitialRecord()]);
const selectedGame = ref(0);
const revision = ref(0);
const record = computed(() => records.value[selectedGame.value]);
const current = computed(() => { void revision.value; return record.value.current; });
const position = computed(() => current.value.position);
const metadata = computed(() => record.value.node(1).properties);
const moves = computed(() => { void revision.value; return record.value.moves; });
const total = computed(() => { void revision.value; return record.value.total; });
const numbers = computed(() => { void revision.value; return record.value.recentNumbers(); });
const branches = computed(() => { void revision.value; return record.value.branches; });
const currentComment = computed(() => current.value.properties.C?.[0] ?? '');
const newSize = ref<BoardSize>(record.value.size);
const newHandicap = ref(0);
const SIZES = [9, 13, 19] as const;
const HANDICAPS = [0, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const confirmReset = ref(false);
// ひとりで並べるは「条件の画面」と「盤の画面」を行き来する（スマホで条件と盤を縦に並べると盤までスクロールが要るため）。
// 盤の記録は画面を替えても残る。棋譜（再生）は常に盤の画面。
const soloView = ref<'setup' | 'board'>('setup');
const hasBoard = ref(false);
const showingBoard = computed(() => props.mode === 'replay' || soloView.value === 'board');
const rootEl = useTemplateRef('rootEl');
watch(soloView, () => { void nextTick(() => scrollToTop(rootEl.value)); });
const review = ref(false);
const includeComments = ref(false);
const error = ref<string | null>(null);
const importing = ref(false);
const pendingReplay = shallowRef<{ id: string; sgf: string } | null>(null);
watch(() => props.replayRequest, request => { if (request !== undefined) pendingReplay.value = { ...request }; }, { immediate: true });
const fileInput = ref<HTMLInputElement | null>(null);
const playing = ref(false);
const movePage = ref(0);
const visibleMoves = computed(() => moves.value.slice(movePage.value * 100, (movePage.value + 1) * 100));
const reviewBusy = ref(false);
const reviewError = ref<string | null>(null);
const reviewProgress = ref(0);
const reviewRevision = ref(0);
const reviewKind = ref<'candidates' | 'hint' | 'estimate'>('candidates');
const showReviewOwnership = ref(false);
const reviewCache = new WeakMap<LocalRecord, Map<number, SearchResult>>();
const reviewResult = computed(() => { void reviewRevision.value; return reviewCache.get(record.value)?.get(current.value.id) ?? null; });
const reviewCandidates = computed(() => [...(reviewResult.value?.candidates ?? [])].sort((a, b) => b.visits - a.visits).slice(0, 3));
const reviewHints = computed(() => review.value ? reviewCandidates.value.slice(0, reviewKind.value === 'hint' ? 1 : 3).flatMap((candidate, index) => candidate.point === null ? [] : [{ point: candidate.point, label: String(index + 1) }]) : []);
const reviewTerritory = computed(() => review.value && showReviewOwnership.value ? ownershipMarks(position.value, reviewResult.value) : { black: [], white: [] });
const reviewGraph = computed(() => {
	void revision.value;
	void reviewRevision.value;
	const entries = new Map<number, number | null>();
	const cache = reviewCache.get(record.value);
	for (const node of record.value.line) {
		const result = cache?.get(node.id);
		if (result !== undefined) entries.set(node.position.moveNumber, result.estimatedMargin);
	}
	return [...entries].map(([move, margin]) => ({ move, margin }));
});
let reviewClient: ReturnType<typeof createEngineClient> | undefined;
let reviewGeneration = 0;
let importGeneration = 0;
let disposed = false;

function isCurrentReview(generation: number): boolean {
	return generation === reviewGeneration && !disposed && props.active;
}

const downloadTimers = new Map<number, string>();

const playback = new RecordPlayback({
	advance: () => {
		const moved = record.value.next();
		revision.value++;
		return moved && record.value.current.position.moveNumber < record.value.total;
	},
	interval: () => prefs.autoplayInterval,
	schedule: (callback, delay) => window.setTimeout(callback, delay),
	cancel: handle => window.clearTimeout(Number(handle)),
	changed: active => { playing.value = active; },
});

watch(() => position.value.moveNumber, number => { movePage.value = Math.floor(Math.max(0, number - 1) / 100); });
watch(() => props.mode, () => { playback.stop(); disposeReview(); review.value = false; });
watch(() => props.active, active => { if (!active) { playback.stop(); disposeReview(); } });
watch(review, enabled => { if (!enabled) disposeReview(); });
watch(() => prefs.autoplayInterval, () => {
	const restart = playback.playing;
	playback.stop();
	if (restart) playback.start();
});

function pointLabel(point: Point | null): string {
	return point === null ? text.pass : toDisplayPoint(point, record.value.size);
}

function variationLabel(node: RecordNode): string {
	return node.move === null ? text.setup : `${node.move.color === 'black' ? text.black : text.white} ${pointLabel(node.move.point)}`;
}

function navigate(action: 'first' | 'previous' | 'next' | 'last'): void {
	playback.stop();
	cancelReview();
	record.value[action]();
	revision.value++;
	error.value = null;
}

function jump(id: number): void {
	playback.stop();
	cancelReview();
	record.value.jump(id);
	revision.value++;
	error.value = null;
}

function chooseBranch(parent: number, event: Event): void {
	playback.stop();
	cancelReview();
	record.value.chooseVariation(parent, Number((event.target as HTMLSelectElement).value));
	revision.value++;
	error.value = null;
}

function applyMove(point: Point | null): void {
	playback.stop();
	cancelReview();
	const result = record.value.play(point);
	if (!result.ok) {
		error.value = result.reason === 'notYourTurn' ? text.invalidRecord : text[result.reason];
		return;
	}
	error.value = null;
	revision.value++;
}

function place(x: number, y: number): void {
	if (props.mode === 'solo') applyMove({ x, y });
}

function pass(): void {
	applyMove(null);
}

function requestReset(): void {
	playback.stop();
	if (record.value.total === 0 && records.value.length === 1) reset();
	else confirmReset.value = true;
}

function reset(): void {
	playback.stop();
	disposeReview();
	importGeneration++;
	importing.value = false;
	const replacement = createRecord({ size: newSize.value, handicap: newHandicap.value });
	records.value = records.value.map((item, index) => index === selectedGame.value ? replacement : item);
	includeComments.value = false;
	confirmReset.value = false;
	error.value = null;
	movePage.value = 0;
	revision.value++;
	showBoard();
}

function showBoard(): void {
	soloView.value = 'board';
	hasBoard.value = true;
}

/** 盤の画面から条件の画面へ。いまの盤はそのまま残し、条件の初期値は今の盤に合わせる */
function openSetup(): void {
	playback.stop();
	cancelReview();
	newSize.value = record.value.size;
	newHandicap.value = record.value.handicap >= 2 && record.value.handicap <= 9 ? record.value.handicap : 0;
	confirmReset.value = false;
	soloView.value = 'setup';
}

function changeGame(): void {
	playback.stop();
	disposeReview();
	newSize.value = record.value.size;
	newHandicap.value = record.value.handicap >= 2 && record.value.handicap <= 9 ? record.value.handicap : 0;
	includeComments.value = false;
	error.value = null;
	revision.value++;
}

function togglePlayback(): void {
	if (!props.active) return;
	cancelReview();
	if (playback.playing) playback.stop();
	else {
		if (position.value.moveNumber === total.value) { record.value.first(); revision.value++; }
		playback.start();
	}
}

function changeInterval(event: Event): void {
	void save({ autoplayInterval: Number((event.target as HTMLSelectElement).value) });
}

async function readFile(event: Event): Promise<void> {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	if (file === undefined) return;
	playback.stop();
	disposeReview();
	const generation = ++importGeneration;
	importing.value = true;
	error.value = null;
	try {
		if (file.size > DEFAULT_SGF_LIMITS.maxBytes) { error.value = text.limitExceeded; return; }
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (disposed || generation !== importGeneration) return;
		const result = importRecord(bytes);
		if (!result.ok) {
			error.value = result.error.code === 'illegalMove' ? text.invalidRecord : result.error.code === 'unsupportedEncoding' ? text.unsupportedEncoding : result.error.code === 'limitExceeded' ? text.limitExceeded : text.invalidSgf;
			return;
		}
		records.value = result.records;
		selectedGame.value = 0;
		newSize.value = result.records[0].size;
		newHandicap.value = result.records[0].handicap >= 2 && result.records[0].handicap <= 9 ? result.records[0].handicap : 0;
		includeComments.value = false;
		confirmReset.value = false;
		movePage.value = 0;
		revision.value++;
		showBoard();
	} catch {
		if (!disposed && generation === importGeneration) error.value = text.fileError;
	} finally {
		input.value = '';
		if (generation === importGeneration) importing.value = false;
	}
}

/** SGF の操作は1つのボタンにまとめる。保存は盤を開いているときだけ */
function openSgfMenu(event: MouseEvent): void {
	const items: MenuItem[] = [{ text: text.importSgf, icon: 'ti ti-upload', action: () => fileInput.value?.click() }];
	if (showingBoard.value) {
		items.push({ type: 'divider' });
		items.push({ text: text.exportSgf, icon: 'ti ti-download', action: download });
		items.push({ type: 'switch', text: text.includeComments, icon: 'ti ti-message', ref: includeComments });
	}
	os.popupMenu(items, event.currentTarget as HTMLElement);
}

function download(): void {
	const result = exportRecord(records.value, includeComments.value);
	if (!result.ok) { error.value = text.exportError; return; }
	const url = URL.createObjectURL(new Blob([result.value], { type: 'application/x-go-sgf;charset=utf-8' }));
	const anchor = window.document.createElement('a');
	anchor.href = url;
	anchor.download = 'hataigo.sgf';
	anchor.click();
	const handle = window.setTimeout(() => { URL.revokeObjectURL(url); downloadTimers.delete(handle); }, 0);
	downloadTimers.set(handle, url);
}

function cancelReview(): void {
	reviewGeneration++;
	reviewClient?.cancel();
	reviewBusy.value = false;
	reviewError.value = null;
}

function disposeReview(): void {
	cancelReview();
	reviewClient?.dispose();
	reviewClient = undefined;
}

function jumpEstimate(move: number): void {
	playback.stop();
	cancelReview();
	record.value.jumpToMove(move);
	revision.value++;
}

async function runReview(kind: 'candidates' | 'hint' | 'estimate'): Promise<void> {
	if (!props.active || disposed || reviewBusy.value) return;
	playback.stop();
	const generation = ++reviewGeneration;
	const game = record.value;
	const node = current.value;
	reviewKind.value = kind;
	showReviewOwnership.value = kind === 'estimate';
	reviewBusy.value = true;
	reviewProgress.value = 0;
	reviewError.value = null;
	try {
		reviewClient ??= createEngineClient();
		const path = game.moves.filter(move => move.number <= node.position.moveNumber);
		let consecutivePasses = 0;
		for (const move of path.slice(-2).reverse()) { if (move.point !== null) break; consecutivePasses++; }
		const result = await reviewClient.search({
			board: node.position.board, toPlay: node.position.toPlay, previousBoard: node.position.previousBoard,
			komi: game.komi, prisoners: node.position.prisoners, consecutivePasses,
			budget: getLevelBudget('balanced', game.size),
		}, { onProgress: snapshot => { if (generation === reviewGeneration) reviewProgress.value = snapshot.playouts; } });
		if (!isCurrentReview(generation)) return;
		let cache = reviewCache.get(game);
		if (cache === undefined) { cache = new Map(); reviewCache.set(game, cache); }
		cache.set(node.id, result);
		reviewRevision.value++;
	} catch (cause) {
		if (generation === reviewGeneration && !(cause instanceof Error && cause.name === 'AbortError')) reviewError.value = aiText.engineError;
	} finally { if (generation === reviewGeneration) reviewBusy.value = false; }
}

onBeforeUnmount(() => {
	disposed = true;
	importGeneration++;
	playback.stop();
	disposeReview();
	for (const [handle, url] of downloadTimers) { window.clearTimeout(handle); URL.revokeObjectURL(url); }
	downloadTimers.clear();
});
onDeactivated(() => { playback.stop(); disposeReview(); });

function acceptReplay(): void {
	const request = pendingReplay.value;
	if (request === null) return;
	playback.stop();
	disposeReview();
	importGeneration++;
	const result = importRecord(request.sgf);
	if (!result.ok) { error.value = text.invalidSgf; return; }
	records.value = result.records;
	selectedGame.value = 0;
	newSize.value = result.records[0].size;
	newHandicap.value = result.records[0].handicap;
	includeComments.value = false;
	confirmReset.value = false;
	movePage.value = 0;
	error.value = null;
	pendingReplay.value = null;
	revision.value++;
	showBoard();
}
</script>

<style module lang="scss">
.notice { padding: 16px; border: 1px solid var(--hy-accent); border-radius: 18px; background: var(--hy-soft); margin-bottom: 12px; }
.notice p { font-size: 13px; line-height: 1.8; }
.notice button + button { margin-inline-start: 8px; }
.root { min-width: 0; container-type: inline-size; color: var(--hy-ink); }
.heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; }
.root button, .root select { min-height: 44px; border: 1px solid var(--hy-border); border-radius: 999px; padding: 8px 14px; background: var(--hy-surface); color: inherit; font: inherit; font-size: 13px; }
.root button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; }
.root button:hover:enabled { background: var(--hy-soft); }
.root button:disabled { cursor: default; opacity: .45; }
.root button:focus-visible, .root select:focus-visible, .root input:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
.root label { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 13px; }
.root select { max-width: 100%; }
.fileActions, .pages { display: flex; gap: 8px; flex-wrap: wrap; }
.fileInput { display: none; }
.muted { margin: 0 0 12px; color: var(--hy-muted); font-size: 12px; line-height: 1.7; }
.error { border-radius: 16px; padding: 12px 16px; color: var(--MI_THEME-error, #b23c43); background: var(--hy-surface); border: 1px solid currentColor; }
/* 新しい盤の条件：人と打つ・AIと打つと同じ部品 */
/* 条件の画面：AIと打つ・人と打つ（ロビー）と同じ段組み */
.setup { max-width: 760px; display: grid; gap: 4px; padding: 8px; margin: 0 auto 12px; background: var(--hy-surface); border: 1px solid var(--hy-border); border-radius: 28px; box-shadow: var(--hy-shadow); }
.step { display: grid; gap: 10px; padding: 14px 12px; }
.step + .step { border-top: 1px solid var(--hy-border); }
.root .stepLabel { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; font-weight: 700; color: var(--hy-muted); }
.stepLabel span { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; background: var(--hy-soft); color: var(--hy-accent); font-size: 11px; font-variant-numeric: tabular-nums; }
.ruleRow { display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: 10px; min-width: 0; }
.ruleName { font-size: 13px; color: var(--hy-muted); white-space: nowrap; }
.segment { display: inline-flex; justify-self: start; gap: 2px; padding: 3px; border-radius: 999px; background: var(--hy-bg); }
.root .segment button { all: unset; box-sizing: border-box; min-width: 64px; min-height: 40px; padding: 0 16px; display: grid; place-items: center; border-radius: 999px; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; cursor: pointer; }
.root .segment button[aria-checked='true'] { background: var(--hy-surface); color: var(--hy-accent); box-shadow: 0 1px 3px rgb(0 0 0 / 14%); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.root .chips button { all: unset; box-sizing: border-box; min-width: 48px; min-height: 40px; padding: 0 12px; display: grid; place-items: center; border-radius: 999px; background: var(--hy-bg); font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; cursor: pointer; }
.root .chips button[aria-checked='true'] { background: var(--hy-accent); color: var(--hy-on-accent, #fff); }
.root .openRecord { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 20px; background: var(--hy-bg); cursor: pointer; }
.root .openRecord:hover:enabled { background: var(--hy-soft); }
.root .openRecord:disabled { opacity: .5; cursor: default; }
.root .openRecord > i { font-size: 18px; color: var(--hy-muted); }
.openIcon { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; background: var(--hy-surface); color: var(--hy-accent); font-size: 22px; }
.openText { flex: 1; min-width: 0; display: grid; gap: 2px; }
.openText b { font-size: 15px; }
.openText small { font-size: 12px; color: var(--hy-muted); line-height: 1.5; }
.setupActions { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; margin: 6px 4px 4px; }
.setupActions:has(> :nth-child(2)) { grid-template-columns: auto minmax(0, 1fr); }
.root .go { all: unset; box-sizing: border-box; min-height: 52px; padding: 0 22px; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 999px; background: var(--hy-accent); color: var(--hy-on-accent, #fff); font-size: 16px; font-weight: 700; cursor: pointer; }
.root .go:hover { filter: brightness(1.06); }
.root .resume { min-height: 52px; padding: 0 18px; font-size: 14px; font-weight: 700; }
.root .back { min-height: 44px; padding: 0 14px 0 10px; font-weight: 700; }
.root .back > i { font-size: 18px; color: var(--hy-accent); }
.root .segment button:focus-visible, .root .chips button:focus-visible, .root .go:focus-visible, .root .openRecord:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
@container (max-width: 520px) {
	.ruleRow { grid-template-columns: minmax(0, 1fr); gap: 6px; }
	.setupActions:has(> :nth-child(2)) { grid-template-columns: minmax(0, 1fr); }
}
/* 盤の画面の操作帯：AIと打つと同じ「状態の行＋アイコン付きボタンの格子」 */
.bar { display: grid; gap: 10px; }
.barStatus { box-sizing: border-box; height: 48px; display: flex; align-items: center; flex-wrap: nowrap; gap: 10px; padding: 6px 14px; border-radius: 16px; background: var(--hy-soft); overflow: hidden; }
.barStatus b { flex: none; font-size: 14px; white-space: nowrap; }
.barMeta { flex: 1 1 auto; min-width: 0; text-align: end; font-size: 12px; color: var(--hy-muted); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.turnStone { flex: none; width: 14px; height: 14px; border-radius: 50%; }
.turnStone[data-color='black'] { background: #141210; }
.turnStone[data-color='white'] { background: #faf7f4; box-shadow: inset 0 0 0 1px rgb(0 0 0 / 30%); }
.soloActions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.soloActions button { padding-inline: 6px; white-space: nowrap; }
.root .soloActions button[aria-pressed='true'] { background: var(--hy-soft); color: var(--hy-accent); border-color: var(--hy-accent); }
.confirm { padding: 14px 16px; margin-bottom: 12px; border: 1px solid var(--hy-accent); background: var(--hy-soft); border-radius: 20px; }
.confirm p { margin: 0 0 10px; }
.confirm button + button { margin-inline-start: 8px; }
.gameSelect { margin-bottom: 12px; }
.layout { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(260px, 1fr); align-items: start; gap: 14px; }
.boardCard, .summary, .variations, .moveCard, .comment { min-width: 0; background: var(--hy-surface); border: 1px solid var(--hy-border); border-radius: 24px; box-shadow: var(--hy-shadow); padding: 16px; }
.boardCard { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.boardCard > :first-child { width: 100%; max-width: 606px; }
.transport { display: flex; gap: 4px; border: 1px solid var(--hy-border); border-radius: 999px; padding: 5px; }
.transport button { width: 44px; padding: 0; border: 0; }
.transport .play { width: 64px; background: var(--hy-accent); color: #fff; }
.transport .play:hover:enabled, .root .primary:hover:enabled { background: var(--hy-accent); filter: brightness(1.08); }
.root .primary { background: var(--hy-accent); color: #fff; border-color: transparent; }
.interval { color: var(--hy-muted); }
.sidebar { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.summaryTop { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
.summary small { color: var(--hy-muted); font-size: 11px; overflow-wrap: anywhere; }
.counter { display: block; margin: 4px 0; font-variant-numeric: tabular-nums; }
.counter b { font-size: 30px; color: var(--hy-accent); font-weight: 500; }
.counter span { color: var(--hy-muted); font-size: 13px; }
.modeTabs { display: flex; padding: 3px; border-radius: 999px; background: var(--hy-bg); }
.modeTabs button { min-height: 36px; padding: 6px 12px; border: 0; background: transparent; }
.modeTabs button[aria-pressed="true"] { background: var(--hy-surface); box-shadow: var(--hy-shadow); }
.status { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-size: 12px; color: var(--hy-muted); }
.summary .muted { margin: 12px 0 0; }
.root h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 14px; }
.variations label + label { margin-top: 8px; }
.moveCard { padding: 14px 10px; }
.moveCard h3 { padding-inline: 8px; }
.moveScroll { max-height: 360px; overflow: auto; }
.moveScroll table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 13px; font-variant-numeric: tabular-nums; }
.moveScroll th { text-align: start; font-weight: 400; color: var(--hy-muted); padding: 6px 8px; }
.moveScroll th:first-child { width: 38px; }
.moveScroll thead th { position: sticky; top: 0; background: var(--hy-surface); font-size: 11px; }
.moveScroll td { padding: 2px; }
.moveScroll td button { width: 100%; min-height: 36px; border: 0; border-radius: 12px; justify-content: start; padding: 7px 10px; }
.moveScroll button[data-current="true"] { background: var(--hy-soft); color: var(--hy-accent); font-weight: 700; }
.pages { align-items: center; justify-content: space-between; margin-top: 8px; font-size: 11px; }
.pages button { padding-inline: 10px; }
.comment p { max-height: 200px; overflow: auto; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.7; font-size: 13px; }
/* 見出しは上のタブが兼ねるので出さない。SGF は常に右端 */
.root .sgfMenu { margin-inline-start: auto; min-height: 44px; padding: 0 12px 0 14px; font-weight: 700; }
.root .sgfMenu > i:last-child { font-size: 14px; color: var(--hy-muted); }
.reviewControls { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.candidate { display: grid; grid-template-columns: 24px 1fr 1fr; gap: 8px; align-items: center; padding: 10px 0; border-top: 1px solid var(--hy-border); font-size: 13px; font-variant-numeric: tabular-nums; }
.candidate b { color: var(--hy-accent); }
.candidate small { grid-column: 2 / -1; color: var(--hy-muted); }
@container (max-width: 720px) {
	.layout { grid-template-columns: minmax(0, 1fr); }
	.boardCard { padding: 8px; border-radius: 24px; }
	.heading h2 { font-size: 18px; }
	.fileActions { gap: 6px; }
	.fileActions button { padding-inline: 11px; font-size: 12px; }
	.setup { gap: 8px; padding: 12px; }
}
@container (max-width: 480px) {
	/* スマホでは碁盤を画面の端まで広げ、交点の間隔を少しでも稼ぐ。ボタンや文字は内側に残す */
	.boardCard { margin-inline: -12px; padding: 8px 0; border-inline: 0; border-radius: 0; box-shadow: none; --hataigo-gutter: 12px; }
	.boardCard > :not(.board) { margin-inline: 12px; }
}
</style>
