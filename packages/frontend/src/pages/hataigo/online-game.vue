<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div :class="$style.root" :data-embedded="embedded">
	<header :class="$style.heading"><button type="button" @click="emit('exit')"><i class="ti ti-arrow-left" aria-hidden="true"></i>{{ text.back }}</button><span v-if="view.game">{{ text[view.game.phase] }} · {{ view.game.settings.size }}{{ text.lines }}</span></header>
	<p v-if="error" :class="$style.error" role="alert">{{ error }} <button type="button" :disabled="!active" @click="retry">{{ text.retry }}</button></p>
	<p v-if="view.loading && !view.game" role="status">{{ text.loading }}</p>
	<template v-if="view.game">
		<p v-if="!view.connected" :class="$style.note" role="status">{{ text.reconnecting }}</p>
		<div :class="$style.layout">
			<section :class="$style.boardCard">
				<div :class="$style.turn"><b>{{ view.game.phase === 'ended' ? text.ended : !view.participant ? text.spectating : view.canPlay ? text.yourTurn : text.opponentTurn }}</b><span>{{ text.prisoners }} · {{ text.black }} {{ view.game.state?.prisoners.black ?? 0 }} / {{ text.white }} {{ view.game.state?.prisoners.white ?? 0 }}</span></div>
				<p v-if="view.busy || view.loading" role="status" :class="$style.note">{{ text.updating }}</p>
				<div v-if="view.game.phase === 'playing' && view.participant" :class="$style.actions"><button type="button" :class="$style.primary" :disabled="!view.canPlay" @click="controller.action({ type: 'pass' })">{{ text.pass }}</button><button type="button" :disabled="!view.canAct" @click="confirmResign = true">{{ text.resign }}</button><button v-if="expiredOpponent" type="button" :disabled="!view.canAct" @click="controller.claimTimeout()">{{ text.claimTimeout }}</button></div>
				<div v-if="confirmResign" :class="$style.confirm" role="alert"><p>{{ text.resignConfirm }}</p><button type="button" @click="confirmResign = false">{{ text.cancel }}</button><button type="button" :disabled="!view.canAct" @click="resign">{{ text.confirmResign }}</button></div>
				<p v-if="!view.participant" :class="$style.note">{{ text.readOnly }}</p>
				<HataigoBoard :class="$style.board" :position="board" :theme="prefs.theme" :stones="prefs.stones" :labels="prefs.labels" :interactive="boardInteractive" :marking="view.game.phase === 'scoring'" :turn="view.canPlay ? myColor : null" :placement="prefs.placement" :lastMove="view.game.state?.moves.at(-1)?.point ?? null" :dead="view.game.state?.scoring.deadStones ?? []" :hints="neutralHints" :territory="territory" :blackAvatar="blackUser?.avatarUrl ?? undefined" :whiteAvatar="whiteUser?.avatarUrl ?? undefined" :blackInitial="name(blackUser).slice(0, 1)" :whiteInitial="name(whiteUser).slice(0, 1)" @place="place" @select="selectPoint"/>
			</section>
			<aside :class="$style.sidebar">
				<section :class="$style.card"><div v-for="color in colors" :key="color" :class="$style.player"><span :class="$style.color" :data-color="color"></span><div><b>{{ name(view.game.black === null ? color === 'black' ? view.game.user1 : view.game.user2 : player(view.game, color)) }}</b><small>{{ view.game.black === null ? text.checking : text[color] }}</small></div><div :class="$style.clock"><b>{{ clocks[color]?.label ?? '—' }}</b><small v-if="clocks[color]?.overtime">× {{ clocks[color]?.periods }} {{ text.periods }}</small></div></div></section>
				<section v-if="view.game.phase === 'waiting'" :class="$style.card">
					<h3>{{ text.settings }}</h3><p :class="$style.note">{{ text.syncNote }}</p><p v-if="settingsChanged" role="status" :class="$style.note">{{ text.settingsChanged }}</p>
					<template v-if="view.game.isInvitation && !view.game.invitationAccepted"><p>{{ view.game.user2Id === viewerId ? text.invitationToYou : text.invitationPending }}</p><div v-if="view.game.user2Id === viewerId" :class="$style.actions"><button type="button" :class="$style.primary" :disabled="!view.canAct" @click="controller.respond(true)">{{ text.accept }}</button><button type="button" :disabled="!view.canAct" @click="controller.respond(false)">{{ text.decline }}</button></div></template>
					<form v-if="draft" :class="$style.form" @submit.prevent="applySettings">
						<label>{{ text.size }}<select v-model.number="draft.size" :disabled="!settingsEditable"><option v-for="size in [9, 13, 19]" :key="size" :value="size">{{ size }}{{ text.lines }}</option></select></label>
						<label>{{ text.handicap }}<select v-model.number="draft.handicap" :disabled="!settingsEditable"><option :value="0">{{ text.even }}</option><option v-for="count in [2, 3, 4, 9]" :key="count" :value="count">{{ count }}{{ text.stones }}</option></select></label>
						<label>{{ text.komi }}<select v-model.number="draft.komi" :disabled="!settingsEditable || draft.handicap !== 0"><option v-for="komi in [6.5, 7.5, 0.5, 0]" :key="komi" :value="komi">{{ komi }}</option></select></label>
						<label>{{ text.clock }}<select v-model="draft.clock" :disabled="!settingsEditable"><option value="fast">{{ text.fast }}</option><option value="standard">{{ text.standard }}</option><option value="correspondence">{{ text.correspondence }}</option></select></label>
						<p :class="$style.note">{{ text.randomColor }}</p>
						<label :class="$style.checkbox"><input v-model="draft.allowSpectate" type="checkbox" :disabled="!settingsEditable">{{ text.allowSpectate }}</label>
						<label :class="$style.checkbox"><input v-model="draft.allowSpectatorChat" type="checkbox" :disabled="!settingsEditable || ((!chatCapable || !draft.allowSpectate) && !draft.allowSpectatorChat)">{{ text.allowSpectatorChat }}</label>
						<label :class="$style.checkbox"><input v-model="draft.publicAfterEnd" type="checkbox" :disabled="!settingsEditable">{{ text.publicAfterEnd }}</label>
						<p :class="$style.note">{{ text.privacyNote }}</p>
						<label :class="$style.checkbox"><input v-model="draft.announcement.enabled" type="checkbox" :disabled="!settingsEditable">{{ text.announce }}</label>
						<label>{{ text.announcementVisibility }}<select v-model="draft.announcement.visibility" :disabled="!settingsEditable || !draft.announcement.enabled"><option value="home">{{ text.home }}</option><option value="followers">{{ text.followers }}</option><option value="public">{{ text.announcePublic }}</option></select></label>
						<label :class="$style.checkbox"><input v-model="draft.announcement.allowName" type="checkbox" :disabled="!settingsEditable">{{ text.allowName }}</label>
						<p :class="$style.note">{{ text.announceNote }}</p><p :class="$style.note">{{ text.announceCopies }}</p>
						<button v-if="view.participant" type="submit" :disabled="!settingsEditable || !dirty">{{ text.apply }}</button>
					</form>
					<p v-if="view.participant" :class="$style.note">{{ otherReady ? text.opponentReady : text.opponentChecking }}</p>
					<div v-if="view.participant" :class="$style.actions"><button type="button" :class="$style.primary" :disabled="!settingsEditable || (!myReady && dirty)" @click="controller.ready(!myReady)">{{ myReady ? text.unready : text.ready }}</button><button type="button" :disabled="!view.canAct" @click="confirmCancel = true">{{ text.cancelGame }}</button></div>
					<div v-if="confirmCancel" :class="$style.confirm" role="alert"><p>{{ text.cancelGameConfirm }}</p><button type="button" @click="confirmCancel = false">{{ text.cancel }}</button><button type="button" :disabled="!view.canAct" @click="cancelGame">{{ text.cancelGame }}</button></div>
				</section>
				<section v-if="view.game.phase === 'scoring'" :class="$style.card"><h3>{{ text.scoringTitle }}</h3><p>{{ text.scoringHelp }}</p><p :class="$style.note">{{ text.approvalNote }}</p><p v-for="color in colors" :key="color">{{ text[color] }} · {{ view.game.state?.scoring.acceptedBy.includes(color) ? text.accepted : text.checking }}</p><div v-if="view.participant" :class="$style.actions"><button type="button" :class="$style.primary" :disabled="!view.canAct || scoreAccepted" @click="controller.action({ type: 'acceptScore' })">{{ text.acceptScore }}</button><button type="button" :disabled="!view.canAct" @click="controller.action({ type: 'setScoring', marks: { deadStones: [], neutralPoints: [] } })">{{ text.clearMarks }}</button><button type="button" :disabled="!view.canAct" @click="controller.action({ type: 'requestResume' })">{{ text.resume }}</button><button type="button" :disabled="!view.canAct" @click="confirmResign = true">{{ text.resign }}</button></div></section>
				<section v-if="score && (view.game.phase === 'scoring' || view.game.phase === 'ended')" :class="$style.card"><table><thead><tr><th></th><th scope="col">{{ text.black }}</th><th scope="col">{{ text.white }}</th></tr></thead><tbody><tr><th scope="row">{{ text.territory }}</th><td>{{ score.black.territory }}</td><td>{{ score.white.territory }}</td></tr><tr><th scope="row">{{ text.dead }}</th><td>{{ score.black.deadStones }}</td><td>{{ score.white.deadStones }}</td></tr><tr><th scope="row">{{ text.prisoners }}</th><td>{{ view.game.state?.prisoners.black }}</td><td>{{ view.game.state?.prisoners.white }}</td></tr><tr><th scope="row">{{ text.komi }}</th><td>0</td><td>{{ score.white.komi }}</td></tr><tr><th scope="row">{{ text.total }}</th><td>{{ score.black.total }}</td><td>{{ score.white.total }}</td></tr></tbody></table></section>
				<section v-if="view.game.phase === 'ended'" :class="$style.card" role="status"><h3>{{ text.ended }}</h3><p>{{ resultLabel }}</p></section>
				<section v-if="view.game.state?.repetition && view.game.phase !== 'ended'" :class="$style.card"><p>{{ text.repetition }}</p><button v-if="view.participant" type="button" :disabled="!view.canAct || noResultAccepted" @click="controller.action({ type: 'acceptNoResult' })">{{ noResultAccepted ? text.noResultAccepted : text.acceptNoResult }}</button></section>
				<section :class="$style.card"><h3>{{ text.effective }}</h3><button v-if="mySlot && view.game.visibility?.[mySlot].allowSpectatorChat && view.game.phase !== 'waiting'" type="button" :disabled="!view.canAct" @click="controller.withdrawChat()">{{ text.withdrawChat }}</button><p>{{ text.allowSpectate }} · {{ view.game.allowSpectate ? text.public : text.private }}</p><p>{{ text.publicAfterEnd }} · {{ view.game.publicAfterEnd ? text.public : text.private }}</p><template v-if="view.participant"><p :class="$style.note">{{ text.announceNote }}</p><p v-if="mySlot && view.game.announcementState?.[mySlot] && text.announcementStatus[view.game.announcementState[mySlot].status]" role="status">{{ text.announcementStatus[view.game.announcementState[mySlot].status] }}</p><button v-if="mySlot && view.game.announcements?.[mySlot].enabled && view.game.phase !== 'waiting'" type="button" :disabled="!view.canAct" @click="controller.stopAnnouncement()">{{ text.stopAnnouncement }}</button><button v-if="mySlot && view.game.announcements?.[mySlot].allowName && view.game.phase !== 'waiting'" type="button" :disabled="!view.canAct" @click="controller.withdrawName()">{{ text.withdrawName }}</button><p :class="$style.note">{{ text.announceCopies }}</p></template></section>
				<section :class="$style.card"><h3>{{ text.spectatorCount }}</h3><p>{{ view.spectators === null ? text.spectatorUnknown : view.spectators }}</p><h3>{{ text.reactions }}</h3><div :class="$style.reactions"><button v-for="reaction in FIXED_REACTIONS" :key="reaction" type="button" :disabled="!view.connected || !active || tickTime < reactionReadyAt" :aria-label="`${text.reactions} ${reaction}`" @click.capture="react(reaction)"><MkEmoji :emoji="reaction" :normal="true"/></button></div><p v-if="recentReaction" :class="$style.reaction" role="status"><MkEmoji :emoji="recentReaction" :normal="true"/></p></section>
				<section :class="$style.card"><HataigoChat :game="view.game" :active="active" @capability="chatCapable = $event"/></section>
			</aside>
		</div>
	</template>
</div>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, shallowRef, watch } from 'vue';
import type { Color, Point } from '@/utility/hataigo/rules/board.js';
import type { FixedReaction } from '@/utility/hataigo/online/presentation.js';
import type { Announcement, OnlineSettings, OnlineUser } from '@/utility/hataigo/online/types.js';
import HataigoBoard from '@/components/hataigo/HataigoBoard.vue';
import HataigoChat from '@/components/hataigo/HataigoChat.vue';
import MkEmoji from '@/components/global/MkEmoji.vue';
import { createOnlineClient } from '@/utility/hataigo/online/client.js';
import { OnlineGameController } from '@/utility/hataigo/online/controller.js';
import { clockPreset, clockView, FIXED_REACTIONS, ownColor, participantSlot, player, presetName } from '@/utility/hataigo/online/presentation.js';
import { onlineErrorText, onlineText as text } from '@/utility/hataigo/online-text.js';
import { useHataigoPrefs } from '@/utility/hataigo/prefs.js';
import { createGame } from '@/utility/hataigo/rules/game.js';
import { scoreJapanese } from '@/utility/hataigo/rules/score.js';

defineOptions({ name: 'HataigoOnlineGame' });
const props = withDefaults(defineProps<{ gameId: string; active?: boolean; embedded?: boolean }>(), { active: true, embedded: false });
const emit = defineEmits<{ exit: []; finished: [] }>();
const { prefs } = useHataigoPrefs();
const client = createOnlineClient();
const viewerId = client.viewerId;
const revision = ref(0);
const colors: Color[] = ['black', 'white'];
const holder = shallowRef<OnlineGameController>();

function makeController(): OnlineGameController { return new OnlineGameController(props.gameId, client, () => { revision.value++; }, () => performance.now()); }

holder.value = makeController();
const controller = computed(() => holder.value as OnlineGameController);
const view = computed(() => { void revision.value; const selected = controller.value; return { game: selected.game, canPlay: selected.canPlay, canAct: selected.canAct, participant: selected.participant, busy: selected.busy, loading: selected.loading, connected: selected.connected, spectators: selected.spectators, reaction: selected.reaction }; });
const error = computed(() => { void revision.value; return onlineErrorText(controller.value.error); });
const tickTime = ref(performance.now());
const reactionReadyAt = ref(0);
const confirmResign = ref(false);
const confirmCancel = ref(false);
const settingsChanged = ref(false);
const chatCapable = ref(false);
type Draft = { size: OnlineSettings['size']; handicap: OnlineSettings['handicap']; komi: number; clock: string; allowSpectate: boolean; allowSpectatorChat: boolean; publicAfterEnd: boolean; announcement: Announcement };
const draft = ref<Draft | null>(null);
const mySlot = computed(() => view.value.game === null ? null : participantSlot(view.value.game, viewerId));
const myColor = computed(() => view.value.game === null ? null : ownColor(view.value.game, viewerId));
const myReady = computed(() => view.value.game !== null && (mySlot.value === 'user1' ? view.value.game.user1Ready : mySlot.value === 'user2' && view.value.game.user2Ready));
const otherReady = computed(() => view.value.game !== null && (mySlot.value === 'user1' ? view.value.game.user2Ready : mySlot.value === 'user2' && view.value.game.user1Ready));
const board = computed(() => view.value.game?.state?.board ?? createGame(view.value.game === null ? {} : view.value.game.settings).board);
const blackUser = computed(() => view.value.game === null ? null : player(view.value.game, 'black'));
const whiteUser = computed(() => view.value.game === null ? null : player(view.value.game, 'white'));
const settingsEditable = computed(() => view.value.canAct && view.value.game?.phase === 'waiting' && view.value.game.invitationAccepted);
const boardInteractive = computed(() => view.value.canAct && (view.value.canPlay || view.value.game?.phase === 'scoring'));
const neutralHints = computed(() => (view.value.game?.state?.scoring.neutralPoints ?? []).map(point => ({ point, kind: 'failure' as const })));
const score = computed(() => { const state = view.value.game?.state; if (state == null) return null; try { return scoreJapanese(state.board, state.scoring, state.prisoners, state.komi); } catch { return null; } });
const territory = computed(() => view.value.game?.phase === 'scoring' || view.value.game?.state?.result?.reason === 'score' ? score.value?.territory : undefined);
const clocks = computed(() => { void tickTime.value; const game = view.value.game; const now = controller.value.serverTime(); return { black: game === null ? null : clockView(game, 'black', now), white: game === null ? null : clockView(game, 'white', now) }; });
const expiredOpponent = computed(() => myColor.value !== null && clocks.value[myColor.value === 'black' ? 'white' : 'black']?.expired === true);
const recentReaction = computed(() => view.value.reaction !== null && tickTime.value - view.value.reaction.at < 4000 ? view.value.reaction.value : null);
const scoreAccepted = computed(() => myColor.value !== null && view.value.game?.state?.scoring.acceptedBy.includes(myColor.value));
const noResultAccepted = computed(() => myColor.value !== null && view.value.game?.state?.noResultAcceptedBy.includes(myColor.value));
const dirty = computed(() => {
	const game = view.value.game;
	const local = draft.value;
	const slot = mySlot.value;
	if (game === null || local === null || slot === null) return false;
	const vote = game.visibility?.[slot];
	if (vote === undefined) return true;
	return local.size !== game.settings.size || local.handicap !== game.settings.handicap || (local.handicap === 0 ? local.komi : 0) !== game.settings.komi || local.clock !== presetName(game.settings.clock) || local.allowSpectate !== vote.allowSpectate || local.allowSpectatorChat !== vote.allowSpectatorChat || local.publicAfterEnd !== vote.publicAfterEnd || JSON.stringify(local.announcement) !== JSON.stringify(game.announcements?.[slot]);
});
const resultLabel = computed(() => { const result = view.value.game?.state?.result; if (result == null) return view.value.game?.phase === 'ended' && (view.value.game.user1Id === null || view.value.game.user2Id === null) ? text.withdrawalEnded : text.canceledGame; if (result.reason === 'noResult') return text.noResult; const winner = result.winner === 'draw' ? text.draw : `${result.winner === 'black' ? text.black : text.white}${text.winner}`; const reason = result.reason === 'score' ? `${result.score?.margin ?? 0}${text.points} · ${text.scoreReason}` : result.reason === 'timeout' ? text.timeoutReason : text.resignReason; return `${winner} · ${reason}`; });
let settingsSignature = '';
const notifiedEnds = new Set<string>();
watch(() => view.value.game, game => { if (game?.phase === 'ended' && game.isParticipant && game.state?.result != null && !notifiedEnds.has(game.id)) { notifiedEnds.add(game.id); emit('finished'); } });
let mounted = false;
let cachedActive = true;
let timer: number | undefined;
let ticks = 0;

watch(() => view.value.game, game => {
	if (game === null) { draft.value = null; return; }
	const signature = JSON.stringify({ settings: game.settings, visibility: game.visibility, announcements: game.announcements });
	if (settingsSignature !== '' && settingsSignature !== signature && game.phase === 'waiting') settingsChanged.value = true;
	settingsSignature = signature;
	const slot = participantSlot(game, viewerId);
	const vote = slot === null ? null : game.visibility?.[slot];
	draft.value = { size: game.settings.size, handicap: game.settings.handicap, komi: game.settings.komi, clock: presetName(game.settings.clock), allowSpectate: vote?.allowSpectate ?? false, allowSpectatorChat: vote?.allowSpectatorChat ?? false, publicAfterEnd: vote?.publicAfterEnd ?? false, announcement: slot === null ? { enabled: false, visibility: 'home', allowName: false } : { ...(game.announcements?.[slot] ?? { enabled: false, visibility: 'home', allowName: false }) } };
});

function name(user: OnlineUser | null): string {
	if (user === null) return text.deletedUser;
	if (user.name !== null && user.name.length > 0) return user.name;
	return user.username.length > 0 ? user.username : text.deletedUser;
}

function place(x: number, y: number): void { if (view.value.game?.phase === 'playing') void controller.value.play({ x, y }); }

function selectPoint(point: Point): void { if (view.value.game?.phase === 'scoring') void controller.value.mark(point); }

function resign(): void { confirmResign.value = false; void controller.value.action({ type: 'resign' }); }

function cancelGame(): void { confirmCancel.value = false; void controller.value.cancelGame(); }

function retry(): void { controller.value.deactivate(); if (props.active && cachedActive && !window.document.hidden) void controller.value.activate(); }

function applySettings(): void {
	const local = draft.value;
	if (local === null) return;
	settingsChanged.value = false;
	void controller.value.settings({ size: local.size, handicap: local.handicap, komi: local.handicap === 0 ? local.komi : 0, rules: 'japanese', clock: clockPreset(local.clock), allowSpectate: local.allowSpectate, publicAfterEnd: local.publicAfterEnd, allowSpectatorChat: local.allowSpectatorChat, announcement: { ...local.announcement } });
}

async function react(value: FixedReaction): Promise<void> { if (await controller.value.react(value)) reactionReadyAt.value = performance.now() + 3000; }

function syncActive(): void {
	const enabled = mounted && cachedActive && props.active && !window.document.hidden;
	if (timer !== undefined) { window.clearInterval(timer); timer = undefined; }
	if (!enabled) { controller.value.deactivate(); return; }
	void controller.value.activate();
	timer = window.setInterval(() => { tickTime.value = performance.now(); if (!client.isCurrent()) { if (timer !== undefined) window.clearInterval(timer); timer = undefined; controller.value.deactivate(); } else if (++ticks % 15 === 0) void controller.value.verify(); }, 1000);
}

watch(() => props.gameId, () => { controller.value.deactivate(); holder.value = makeController(); settingsSignature = ''; confirmResign.value = false; confirmCancel.value = false; syncActive(); });
watch(() => props.active, syncActive);
onMounted(() => { mounted = true; window.document.addEventListener('visibilitychange', syncActive); syncActive(); });
onActivated(() => { cachedActive = true; syncActive(); });
onDeactivated(() => { cachedActive = false; syncActive(); });
onBeforeUnmount(() => { mounted = false; window.document.removeEventListener('visibilitychange', syncActive); syncActive(); });
</script>

<style module lang="scss">
.root { min-width: 0; container-type: inline-size; color: var(--hy-ink); }
.heading, .turn, .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.heading { justify-content: space-between; margin-bottom: 12px; font-size: 13px; }
.root h3 { margin: 0 0 12px; font-size: 15px; }
.root button, .root select { min-height: 44px; padding: 8px 14px; border: 1px solid var(--hy-border); border-radius: 999px; background: var(--hy-surface); color: inherit; font: inherit; font-size: 13px; }
.root button { cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
.root button:hover:enabled { background: var(--hy-soft); }
.root button:disabled { opacity: .45; cursor: default; }
.root button:focus-visible, .root select:focus-visible, .root input:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
.root .primary { background: var(--hy-accent); border-color: transparent; color: #fff; }
.root .primary:hover:enabled { background: var(--hy-accent); filter: brightness(1.08); }
.layout { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr); gap: 14px; align-items: start; }
.boardCard, .card { min-width: 0; border: 1px solid var(--hy-border); background: var(--hy-surface); border-radius: 24px; box-shadow: var(--hy-shadow); padding: 16px; }
.boardCard { display: grid; gap: 12px; }
.turn { justify-content: space-between; font-size: 12px; color: var(--hy-muted); }
.turn b { color: var(--hy-accent); }
.sidebar { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.player { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 0; }
.player + .player { border-top: 1px solid var(--hy-border); }
.player b { overflow-wrap: anywhere; font-size: 14px; }
.player small { display: block; font-size: 11px; color: var(--hy-muted); }
.color { width: 14px; height: 14px; border-radius: 50%; background: #221d19; }
.color[data-color="white"] { background: #faf7f4; box-shadow: inset 0 0 0 1.5px #221d19; }
.clock { text-align: end; font-variant-numeric: tabular-nums; }
.clock b { font-size: 22px; }
.note { color: var(--hy-muted); font-size: 12px; line-height: 1.8; margin: 10px 0; }
.error { color: var(--MI_THEME-error, #b23c43); line-height: 1.8; }
.form { display: grid; gap: 10px; }
.form label { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; }
.form select { min-width: 0; max-width: 75%; }
.root .checkbox { display: flex; align-items: center; justify-content: start; gap: 8px; min-height: 44px; font-size: 13px; }
.checkbox input { width: 18px; height: 18px; accent-color: var(--hy-accent); }
.card p { line-height: 1.8; font-size: 13px; }
.confirm { padding: 12px; background: var(--hy-soft); border: 1px solid var(--hy-accent); border-radius: 18px; }
.confirm p { margin: 0 0 10px; }
.confirm button + button { margin-inline-start: 8px; }
.card table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.card th, .card td { padding: 7px 5px; text-align: end; border-bottom: 1px solid var(--hy-border); }
.card th:first-child { text-align: start; color: var(--hy-muted); font-weight: 400; }
.reactions { display: flex; flex-wrap: wrap; gap: 6px; }
.reactions button { width: 44px; padding: 0; font-size: 20px; }
.reaction { text-align: center; font-size: 32px !important; }
@container (max-width: 720px) { .layout { grid-template-columns: minmax(0, 1fr); } .boardCard { padding: 8px; } }
@container (max-width: 480px) {
	/* スマホでは碁盤を画面の端まで広げ、交点の間隔を少しでも稼ぐ。ボタンや文字は内側に残す */
	.boardCard { margin-inline: -12px; padding: 8px 0; border-inline: 0; border-radius: 0; box-shadow: none; --hataigo-gutter: 12px; }
	.boardCard > :not(.board) { margin-inline: 12px; }
}
</style>
