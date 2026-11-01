<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div :class="$style.root" :data-embedded="embedded">
	<p v-if="error" role="alert" :class="$style.error">{{ error }}</p>

	<section v-if="!summaryOnly" :class="$style.start" :aria-label="text.title">
		<template v-if="!view.matching">
			<div :class="$style.step">
				<h3 :class="$style.stepLabel"><span>1</span>{{ text.opponent }}</h3>
				<div :class="$style.choices" role="radiogroup" :aria-label="text.opponent">
					<button type="button" role="radio" :class="$style.choice" :aria-checked="opponentKind === 'match'" :disabled="view.busy" @click="opponentKind = 'match'">
						<span :class="$style.choiceIcon"><i class="ti ti-swords" aria-hidden="true"></i></span>
						<span :class="$style.choiceText"><b>{{ text.match }}</b><small>{{ text.matchDesc }}</small></span>
						<i :class="[$style.check, opponentKind === 'match' ? 'ti ti-circle-check-filled' : 'ti ti-circle']" aria-hidden="true"></i>
					</button>
					<button type="button" role="radio" :class="$style.choice" :aria-checked="opponentKind === 'invite'" :disabled="view.busy" @click="opponentKind = 'invite'">
						<span :class="$style.choiceIcon"><i class="ti ti-user-plus" aria-hidden="true"></i></span>
						<span :class="$style.choiceText"><b>{{ text.invite }}</b><small>{{ text.inviteDesc }}</small></span>
						<i :class="[$style.check, opponentKind === 'invite' ? 'ti ti-circle-check-filled' : 'ti ti-circle']" aria-hidden="true"></i>
					</button>
				</div>
			</div>

			<div :class="$style.step">
				<h3 :class="$style.stepLabel"><span>2</span>{{ text.rules }}</h3>
				<div :class="$style.ruleRow">
					<span :class="$style.ruleName">{{ text.size }}</span>
					<div :class="$style.segment" role="radiogroup" :aria-label="text.size">
						<button v-for="value in SIZES" :key="value" type="button" role="radio" :aria-checked="size === value" :disabled="view.busy" @click="size = value">{{ value }}{{ text.lines }}</button>
					</div>
				</div>
				<div v-if="opponentKind === 'match'" :class="$style.ruleRow">
					<span></span>
					<label :class="$style.switchRow"><span><span>{{ text.anySize }}</span><small :class="$style.switchHint">{{ text.anySizeHint }}</small></span><input v-model="anySize" type="checkbox" role="switch" :disabled="view.busy"></label>
				</div>
				<div :class="$style.ruleRow">
					<span :class="$style.ruleName">{{ text.clock }}</span>
					<div :class="$style.clocks" role="radiogroup" :aria-label="text.clock">
						<button v-for="clock in clocks" :key="clock.id" type="button" role="radio" :class="$style.clock" :aria-checked="clockKind === clock.id" :disabled="view.busy" @click="clockKind = clock.id">
							<i :class="clock.icon" aria-hidden="true"></i><b>{{ clock.title }}</b><small>{{ clock.desc }}</small>
						</button>
					</div>
				</div>
			</div>

			<div :class="$style.step">
				<h3 :class="$style.stepLabel"><span>3</span>{{ text.visibilityStep }}</h3>
				<label :class="$style.switchRow"><span>{{ text.allowSpectate }}</span><input v-model="allowSpectate" type="checkbox" role="switch" :disabled="view.busy"></label>
				<label :class="$style.switchRow"><span>{{ text.publicAfterEnd }}</span><input v-model="publicAfterEnd" type="checkbox" role="switch" :disabled="view.busy"></label>
				<p :class="$style.hint">{{ text.bothAllow }}</p>
			</div>

			<button type="button" :class="$style.go" :disabled="view.busy || !active" @click="opponentKind === 'match' ? match() : invite()">
				<i :class="opponentKind === 'match' ? 'ti ti-swords' : 'ti ti-user-plus'" aria-hidden="true"></i>{{ opponentKind === 'match' ? text.findOpponent : text.chooseAndInvite }}
			</button>
		</template>

		<div v-else :class="$style.searching" role="status">
			<div :class="$style.searchStones" aria-hidden="true"><i></i><i></i></div>
			<b>{{ text.searching }}</b>
			<span :class="$style.searchMeta">{{ size }}{{ text.lines }}<template v-if="anySize">（{{ text.otherSizes }}）</template> · {{ clockKind === 'byoyomi' ? text.byoyomiTitle : text.correspondenceTitle }} · {{ text.elapsed }} {{ elapsedLabel }}</span>
			<button type="button" :class="$style.ghost" @click="controller.cancelMatch()">{{ text.cancel }}</button>
		</div>
	</section>

	<section v-if="view.invitations.length" :class="$style.list" :aria-label="text.invitations">
		<h3 :class="$style.listTitle">{{ text.invitations }}</h3>
		<article v-for="game in view.invitations" :key="game.id" :class="$style.row">
			<span :class="$style.avatar"><img v-if="game.user1?.avatarUrl" :src="game.user1.avatarUrl" alt=""><template v-else>{{ name(game.user1).slice(0, 1) }}</template></span>
			<span :class="$style.rowText"><b>{{ name(game.user1) }}{{ text.invitedBy }}</b><small>{{ game.settings.size }}{{ text.lines }}</small></span>
			<span :class="$style.rowActions">
				<button type="button" :class="$style.ghost" :disabled="view.busy" @click="controller.respond(game, false)">{{ text.decline }}</button>
				<button type="button" :class="$style.primary" :disabled="view.busy" @click="controller.respond(game, true)">{{ text.accept }}</button>
			</span>
		</article>
	</section>

	<section :class="$style.list" :aria-label="text.ongoing">
		<header :class="$style.listHead">
			<h3 :class="$style.listTitle">{{ text.ongoing }}</h3>
			<button type="button" :class="$style.iconButton" :disabled="view.loading" :aria-label="text.refresh" :title="text.refresh" @click="controller.refresh()"><i class="ti ti-refresh" aria-hidden="true"></i></button>
		</header>
		<p v-if="view.loading && !view.mine.length" role="status" :class="$style.empty">{{ text.loading }}</p>
		<p v-else-if="!view.mine.length" :class="$style.empty">{{ text.noneOngoing }}</p>
		<button v-for="game in view.mine" :key="game.id" type="button" :class="$style.row" @click="emit('open', game.id)">
			<span :class="$style.avatar"><img v-if="opponentOf(game)?.avatarUrl" :src="opponentOf(game)?.avatarUrl ?? ''" alt=""><template v-else>{{ name(opponentOf(game)).slice(0, 1) }}</template></span>
			<span :class="$style.rowText"><b>{{ name(opponentOf(game)) }}</b><small>{{ game.settings.size }}{{ text.lines }} · {{ text[game.phase] }}</small></span>
			<span :class="$style.turnTag" :data-mine="isMyTurn(game)">{{ isMyTurn(game) ? text.yourTurn : text.open }}</span>
		</button>
		<button v-if="view.moreMine" type="button" :class="$style.more" :disabled="view.loading" @click="controller.loadMore(true)">{{ text.more }}</button>
	</section>

	<section v-if="!summaryOnly" :class="$style.list" :aria-label="text.publicGames">
		<h3 :class="$style.listTitle">{{ text.publicGames }}</h3>
		<p v-if="view.loading && !view.publicGames.length" role="status" :class="$style.empty">{{ text.loading }}</p>
		<p v-else-if="!view.publicGames.length" :class="$style.empty">{{ text.nonePublic }}</p>
		<button v-for="game in view.publicGames" :key="game.id" type="button" :class="$style.row" @click="emit('open', game.id)">
			<span :class="$style.avatar"><i class="ti ti-eye" aria-hidden="true"></i></span>
			<span :class="$style.rowText"><b>{{ name(game.user1) }} − {{ name(game.user2) }}</b><small>{{ game.settings.size }}{{ text.lines }} · {{ text[game.phase] }}</small></span>
			<span :class="$style.turnTag">{{ text.watch }}</span>
		</button>
		<button v-if="view.morePublic" type="button" :class="$style.more" :disabled="view.loading" @click="controller.loadMore(false)">{{ text.more }}</button>
	</section>
</div>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import type { BoardSize } from '@/utility/hataigo/rules/board.js';
import type { MatchOptions, OnlineGame, OnlineUser } from '@/utility/hataigo/online/types.js';
import { createOnlineClient } from '@/utility/hataigo/online/client.js';
import { OnlineLobbyController } from '@/utility/hataigo/online/controller.js';
import { onlineErrorText, onlineText as text } from '@/utility/hataigo/online-text.js';
import * as os from '@/os.js';

defineOptions({ name: 'HataigoLobby' });
const props = withDefaults(defineProps<{ initialSize?: BoardSize; active?: boolean; embedded?: boolean; summaryOnly?: boolean; opponent?: 'match' | 'invite' }>(), { initialSize: 19, active: true, embedded: false, summaryOnly: false, opponent: 'match' });
const emit = defineEmits<{ 'open': [gameId: string] }>();

const SIZES = [9, 13, 19] as const;
const clocks = [
	{ id: 'byoyomi', title: text.byoyomiTitle, desc: text.byoyomiDesc, icon: 'ti ti-clock' },
	{ id: 'correspondence', title: text.correspondenceTitle, desc: text.correspondenceDesc, icon: 'ti ti-coffee' },
] as const;

function getInitialSize(): BoardSize { return props.initialSize; }

function getInitialOpponent(): 'match' | 'invite' { return props.opponent; }

const size = ref<BoardSize>(getInitialSize());
const opponentKind = ref<'match' | 'invite'>(getInitialOpponent());
const clockKind = ref<'byoyomi' | 'correspondence'>('byoyomi');
const anySize = ref(false);
const allowSpectate = ref(false);
const publicAfterEnd = ref(false);
const revision = ref(0);
const client = createOnlineClient();
const controller = new OnlineLobbyController(client, gameId => emit('open', gameId), () => { revision.value++; });
const view = computed(() => { void revision.value; return { mine: controller.mine, publicGames: controller.publicGames, invitations: controller.invitations, matching: controller.matching, busy: controller.busy, loading: controller.loading, moreMine: controller.moreMine, morePublic: controller.morePublic }; });
const error = computed(() => { void revision.value; return onlineErrorText(controller.error); });
const searchStartedAt = ref<number | null>(null);
const now = ref(Date.now());
const elapsedLabel = computed(() => {
	const seconds = searchStartedAt.value === null ? 0 : Math.max(0, Math.floor((now.value - searchStartedAt.value) / 1000));
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
});
let mounted = false;
let cachedActive = true;
let timer: number | undefined;
let clockTimer: number | undefined;
let ticks = 0;

watch(() => props.opponent, value => { opponentKind.value = value; });
watch(() => view.value.matching, matching => {
	if (clockTimer !== undefined) { window.clearInterval(clockTimer); clockTimer = undefined; }
	searchStartedAt.value = matching ? Date.now() : null;
	now.value = Date.now();
	if (matching) clockTimer = window.setInterval(() => { now.value = Date.now(); }, 1000);
});

function options(): MatchOptions { return { size: size.value, clockKind: clockKind.value, allowSpectate: allowSpectate.value, allowSpectatorChat: false, publicAfterEnd: publicAfterEnd.value }; }

/** 招待は相手と路数を決めて申し込むので、路数を問わないのはフリーマッチだけ */
function matchOptions(): MatchOptions { return { ...options(), anySize: anySize.value }; }

function name(user: OnlineUser | null): string { if (user === null) return text.deletedUser; return user.name !== null && user.name !== '' ? user.name : user.username !== '' ? user.username : text.deletedUser; }

function opponentOf(game: OnlineGame): OnlineUser | null { return game.user1Id === client.viewerId ? game.user2 : game.user1; }

function isMyTurn(game: OnlineGame): boolean { return game.phase === 'playing' && game.myColor !== null && game.state?.toPlay === game.myColor; }

function match(): void { void controller.match(matchOptions()); }

async function invite(): Promise<void> {
	try {
		const user = await os.selectUser({ includeSelf: false, localOnly: true });
		if (controller.active && props.active && client.isCurrent()) await controller.invite(user.id, options());
	} catch { /* Closing the existing user picker does not change the lobby. */ }
}

function syncActive(): void {
	const enabled = mounted && cachedActive && props.active && !window.document.hidden;
	if (timer !== undefined) { window.clearInterval(timer); timer = undefined; }
	if (!enabled) { void controller.deactivate(); return; }
	void controller.activate();
	timer = window.setInterval(() => {
		if (!client.isCurrent()) { if (timer !== undefined) window.clearInterval(timer); timer = undefined; void controller.deactivate(); return; }
		if (controller.matching) void controller.heartbeat();
		if (++ticks % 3 === 0 && !controller.busy) void controller.refresh();
	}, 5000);
}

watch(() => props.active, syncActive);
onMounted(() => { mounted = true; window.document.addEventListener('visibilitychange', syncActive); syncActive(); });
onActivated(() => { cachedActive = true; syncActive(); });
onDeactivated(() => { cachedActive = false; syncActive(); });
onBeforeUnmount(() => { mounted = false; if (clockTimer !== undefined) window.clearInterval(clockTimer); window.document.removeEventListener('visibilitychange', syncActive); syncActive(); });
</script>

<style module lang="scss">
.root { min-width: 0; color: var(--hy-ink); display: grid; gap: 14px; container-type: inline-size; }
.root button { font: inherit; color: inherit; }
.root button:focus-visible, .root input:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 2px; }
.error { margin: 0; padding: 12px 16px; border-radius: 16px; color: var(--MI_THEME-error, #b23c43); background: var(--hy-surface); border: 1px solid currentColor; line-height: 1.7; }

.start { display: grid; gap: 4px; padding: 8px; background: var(--hy-surface); border: 1px solid var(--hy-border); border-radius: 28px; box-shadow: var(--hy-shadow); }
.step { display: grid; gap: 10px; padding: 14px 12px; }
.step + .step { border-top: 1px solid var(--hy-border); }
.stepLabel { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; font-weight: 700; color: var(--hy-muted); }
.stepLabel span { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; background: var(--hy-soft); color: var(--hy-accent); font-size: 11px; font-variant-numeric: tabular-nums; }

.choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.root .choice { all: unset; box-sizing: border-box; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 20px; background: var(--hy-bg); cursor: pointer; box-shadow: inset 0 0 0 1px transparent; transition: box-shadow .15s ease, background .15s ease; }
.root .choice:hover:enabled { background: var(--hy-soft); }
.root .choice[aria-checked='true'] { background: var(--hy-soft); box-shadow: inset 0 0 0 2px var(--hy-accent); }
.root .choice:disabled { cursor: default; opacity: .55; }
.choiceIcon { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; background: var(--hy-surface); color: var(--hy-accent); font-size: 22px; }
.choice[aria-checked='true'] .choiceIcon { background: var(--hy-accent); color: var(--hy-on-accent, #fff); }
.choiceText { flex: 1; min-width: 0; display: grid; gap: 2px; }
.choiceText b { font-size: 15px; }
.choiceText small { font-size: 12px; color: var(--hy-muted); line-height: 1.5; }
.check { flex: none; font-size: 20px; color: var(--hy-border); }
.choice[aria-checked='true'] .check { color: var(--hy-accent); }

.ruleRow { display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: 10px; }
.ruleName { font-size: 13px; color: var(--hy-muted); }
.segment { display: inline-flex; justify-self: start; gap: 2px; padding: 3px; border-radius: 999px; background: var(--hy-bg); }
.root .segment button { all: unset; box-sizing: border-box; min-width: 64px; min-height: 40px; padding: 0 16px; display: grid; place-items: center; border-radius: 999px; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; cursor: pointer; }
.root .segment button[aria-checked='true'] { background: var(--hy-surface); color: var(--hy-accent); box-shadow: 0 1px 3px rgb(0 0 0 / 14%); }
.root .segment button:disabled { cursor: default; opacity: .55; }
.clocks { display: grid; grid-template-columns: repeat(2, minmax(0, 220px)); gap: 8px; }
.root .clock { all: unset; box-sizing: border-box; min-width: 0; display: grid; grid-template-columns: 22px minmax(0, 1fr); column-gap: 8px; align-items: center; padding: 10px 14px; border-radius: 16px; background: var(--hy-bg); cursor: pointer; }
.clock i { grid-row: 1 / 3; font-size: 20px; color: var(--hy-muted); }
.clock b { font-size: 14px; }
.clock small { font-size: 12px; color: var(--hy-muted); font-variant-numeric: tabular-nums; }
.root .clock[aria-checked='true'] { background: var(--hy-soft); box-shadow: inset 0 0 0 2px var(--hy-accent); }
.clock[aria-checked='true'] i, .clock[aria-checked='true'] b { color: var(--hy-accent); }
.root .clock:disabled { cursor: default; opacity: .55; }

.switchRow { min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 14px; cursor: pointer; }
.switchRow > span { display: grid; gap: 2px; }
.switchHint { font-size: 12px; color: var(--hy-muted); line-height: 1.5; }
.switchRow input { appearance: none; flex: none; position: relative; width: 44px; height: 26px; margin: 0; border-radius: 999px; background: var(--hy-border); cursor: pointer; transition: background .15s ease; }
.switchRow input::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 30%); transition: transform .15s ease; }
.switchRow input:checked { background: var(--hy-accent); }
.switchRow input:checked::after { transform: translateX(18px); }
.switchRow input:disabled { opacity: .55; cursor: default; }
.hint { margin: 0; font-size: 12px; color: var(--hy-muted); }

.root .go { all: unset; box-sizing: border-box; margin: 6px 4px 4px; min-height: 52px; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 999px; background: var(--hy-accent); color: var(--hy-on-accent, #fff); font-size: 16px; font-weight: 700; cursor: pointer; }
.root .go:hover:enabled { filter: brightness(1.06); }
.root .go:disabled { opacity: .5; cursor: default; }
.root .go:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 3px; }

.searching { display: grid; justify-items: center; gap: 10px; padding: 36px 16px 24px; text-align: center; }
.searching > b { font-size: 17px; }
.searchMeta { font-size: 13px; color: var(--hy-muted); font-variant-numeric: tabular-nums; }
.searchStones { position: relative; width: 72px; height: 36px; }
.searchStones i { position: absolute; top: 4px; width: 28px; height: 28px; border-radius: 50%; animation: hataigoSeek 1.6s ease-in-out infinite; }
.searchStones i:first-child { left: 4px; background: radial-gradient(circle at 35% 30%, #5a5450, #141210 70%); }
.searchStones i:last-child { right: 4px; background: radial-gradient(circle at 35% 30%, #fff, #ddd6cc 75%); box-shadow: inset 0 0 0 1px rgb(0 0 0 / 18%); animation-delay: .8s; }
@keyframes hataigoSeek { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@media (prefers-reduced-motion: reduce) { .searchStones i { animation: none; } }

.list { display: grid; gap: 2px; padding: 8px; background: var(--hy-surface); border: 1px solid var(--hy-border); border-radius: 24px; box-shadow: var(--hy-shadow); }
.listHead { display: flex; align-items: center; justify-content: space-between; }
.listTitle { margin: 0; padding: 8px 10px; font-size: 14px; }
.empty { margin: 0; padding: 4px 10px 10px; font-size: 13px; color: var(--hy-muted); }
.root .row { all: unset; box-sizing: border-box; min-width: 0; min-height: 60px; display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 16px; }
.root button.row { cursor: pointer; }
.root button.row:hover { background: var(--hy-bg); }
.avatar { flex: none; width: 40px; height: 40px; display: grid; place-items: center; overflow: hidden; border-radius: 50%; background: var(--hy-soft); color: var(--hy-accent); font-weight: 700; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.rowText { flex: 1; min-width: 0; display: grid; gap: 2px; }
.rowText b { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rowText small { font-size: 12px; color: var(--hy-muted); }
.turnTag { flex: none; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--hy-muted); background: var(--hy-bg); }
.turnTag[data-mine='true'] { color: var(--hy-on-accent, #fff); background: var(--hy-accent); }
.rowActions { display: flex; gap: 6px; }
.root .primary, .root .ghost, .root .more { min-height: 40px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--hy-border); background: var(--hy-surface); font-size: 13px; font-weight: 700; cursor: pointer; }
.root .primary { border-color: transparent; background: var(--hy-accent); color: var(--hy-on-accent, #fff); }
.root .more { justify-self: center; margin: 4px; }
.root .primary:disabled, .root .ghost:disabled, .root .more:disabled { opacity: .5; cursor: default; }
.root .iconButton { width: 40px; height: 40px; display: grid; place-items: center; border: 0; border-radius: 50%; background: transparent; color: var(--hy-muted); font-size: 18px; cursor: pointer; }
.root .iconButton:hover:enabled { background: var(--hy-bg); color: var(--hy-ink); }

@container (max-width: 520px) {
	.choices { grid-template-columns: minmax(0, 1fr); }
	.ruleRow { grid-template-columns: minmax(0, 1fr); gap: 6px; }
	.clocks { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
