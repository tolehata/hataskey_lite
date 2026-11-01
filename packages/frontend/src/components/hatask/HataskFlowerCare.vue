<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div ref="root" :class="$style.root" :data-motion="animations ? 'on' : 'off'">
	<HataskFlowerIntro v-if="intro && state" :animations="animations" @dismiss="dismissIntro"/>
	<section :class="$style.card" data-flower-care :aria-busy="loading">
		<header :class="$style.header"><h3>{{ copy.growingFlower }}</h3><button type="button" :class="$style.help" :aria-label="copy.howToGrow" :title="copy.howToGrow" :aria-expanded="help" @click="help = !help"><i class="ti ti-help" aria-hidden="true"></i></button></header>
		<p v-if="help" :class="$style.note">{{ copy.helpBefore }}<wbr>{{ i18n.tsx._hata._hatask._flowerCare.helpAfter({ duration: duration(state?.rules.pourMinutes ?? 120) }) }}</p>
		<div v-if="!state" :class="$style.status" :role="error ? 'alert' : 'status'">{{ error ? copy.loadFailed : copy.loading }}<button v-if="error" type="button" :disabled="loading" @click="load">{{ i18n.ts._hata._hatask._planner.retry }}</button></div>
		<template v-else>
			<div :class="$style.growing">
				<div :class="$style.ring" role="progressbar" :aria-label="copy.growth" :aria-valuenow="state.flower.progress" :aria-valuemin="0" :aria-valuemax="100"><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="70"/><circle :class="$style.progress" cx="80" cy="80" r="70" :stroke-dashoffset="440 - 440 * state.flower.progress / 100"/></svg><HataskEmoji :emoji="state.flower.emoji" :class="$style.flowerArt"/></div>
				<div :class="$style.flowerCopy"><strong>{{ localizeFloraName(state.flower.name) }}</strong><p v-if="meaning">{{ copy.flowerMeaning }}: {{ localizeHanakotoba(meaning) }}</p><p :class="$style.remaining">{{ remaining }}</p><p>{{ i18n.tsx._hata._hatask._flowerCare.growthTotal({ progress: String(state.flower.progress), duration: duration(state.flower.totalMinutes) }) }}</p></div>
				<button v-if="state.flower.progress >= 100" ref="harvestButton" type="button" :class="$style.harvest" :disabled="busy" @click="openBloom"><i class="ti ti-scissors" aria-hidden="true"></i><span>{{ copy.harvestAndName }}</span></button>
			</div>
			<div :class="$style.care">
				<HataskWateringCan v-model="target" :drops="state.drops" :store="state.store" :pourMinutes="state.rules.pourMinutes" :bloomed="state.flower.progress >= 100" :busy="busy || error" :festivalAvailable="festivalAvailable" :animations="animations" @pour="pour"/>
				<HataskDropSources :today="state.today" :caps="state.caps" :resetAt="state.resetAt" :rules="state.rules" :store="state.store" @hatady="emit('hatady')"/>
				<div v-if="gardenTodos.length" :class="$style.todos">
					<div :class="$style.todoHead"><strong><span :class="$style.brand">Hatask</span> {{ copy.todo }}</strong></div>
					<button v-for="todo in gardenTodos" :key="todo.id" type="button" :class="$style.todo" :aria-pressed="todo.done" :disabled="readOnly || pendingTodo !== null" @click="toggleTodo(todo)">
						<HataskTodoCheck :done="todo.done" :rewarded="reward(todo).granted" :animations="animations"/>
						<span :class="$style.todoCopy"><strong :class="todo.done ? $style.done : undefined">{{ todo.text }}</strong><small v-if="todo.folder">{{ folderName(todo.folder) }}</small></span>
						<span :class="[$style.reward, reward(todo).granted || !reward(todo).why && !todo.done ? $style.eligible : undefined]" :title="rewardTip(todo)" :aria-label="rewardTip(todo)"><i :class="rewardIcon(todo)" aria-hidden="true"></i><span>{{ rewardLabel(todo) }}</span></span>
					</button>
				</div>
			</div>
		</template>
		<p v-if="error && state" :class="$style.status" role="alert">{{ copy.refreshFailed }}<button type="button" :disabled="loading" @click="load">{{ i18n.ts._hata._hatask._planner.retry }}</button></p>
		<p v-if="message" :class="$style.feedback" role="status" aria-live="polite">{{ message }}</p>
	</section>
	<HataskFlowerZukan v-if="state" :zukan="state.zukan" :season="state.flower.season" :busy="busy" :animations="animations" @claim="claim"/>
	<HataskBloomDialog v-if="bloom && bloomFlower && root" ref="bloomDialog" :flower="bloomFlower" :source="harvestButton ?? root" :theme="theme" :mode="mode" :busy="busy" :animations="animations" @harvest="harvest" @closed="bloom = false"/>
</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import HataskEmoji from '@/components/HataskEmoji.vue';
import HataskWateringCan from './HataskWateringCan.vue';
import HataskDropSources from './HataskDropSources.vue';
import HataskFlowerIntro from './HataskFlowerIntro.vue';
import HataskTodoCheck from './HataskTodoCheck.vue';
import HataskBloomDialog from './HataskBloomDialog.vue';
import type { BloomFlower } from './HataskBloomDialog.vue';
import HataskFlowerZukan from './HataskFlowerZukan.vue';
import type { HataskPlannerTodo, HataskPlannerFolder } from '@/utility/hatask-planner-storage.js';
import type { HataskDropReward, HataskFlowerState, HataskFlowerSeason } from '@/utility/hatask-flower-v2.js';
import { HATASK_FLOWER_STATE_EVENT, getHataskFlowerState, pourHataskFlower, harvestHataskFlower, claimHataskFlowerSeed } from '@/utility/hatask-flower-v2.js';
import { enqueuePageStatusToast } from '@/utility/hataskey-notification-toast.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
// 旗鯖fork: 咲いたお花の名前欄に「きらめくコスモス」のような名前を自動で入れる。
import { generateFlowerNickname, localizeFloraName, localizeHanakotoba } from '@/utility/hatask-flora.js';

const props = defineProps<{ todos: HataskPlannerTodo[]; folders: HataskPlannerFolder[]; animations: boolean; theme: string; mode: 'light' | 'dark'; readOnly: boolean; completeTodo: (id: string, done: boolean) => Promise<void> }>();
const emit = defineEmits<{ state: [state: HataskFlowerState]; harvested: [state: HataskFlowerState]; hatady: [] }>();
const copy = i18n.ts._hata._hatask._flowerCare;
const root = ref<HTMLElement | null>(null);
const harvestButton = ref<HTMLButtonElement | null>(null);
const bloomDialog = ref<InstanceType<typeof HataskBloomDialog> | null>(null);
const bloomFlower = ref<BloomFlower | null>(null);
const state = ref<HataskFlowerState | null>(null);
const loading = ref(false), busy = ref(false), error = ref(false), intro = ref(false), help = ref(false), bloom = ref(false);
const target = ref<'self' | 'festival'>('self');
const message = ref('');
const pendingTodo = ref<string | null>(null);
let disposed = false, active = true, timer: number | undefined, bloomTimer: number | undefined, lastBloomId = '';
const scope = ['client', 'hatask'];
const meaning = computed(() => state.value?.flower.hanakotoba ?? state.value?.zukan.catalog.find(item => item.id === state.value?.flower.speciesId)?.hanakotoba ?? '');
const gardenTodos = computed(() => props.todos.filter(todo => todo.archivedAt == null).sort((a, b) => Number(a.done) - Number(b.done) || a.position - b.position).slice(0, 6));
const festivalAvailable = computed(() => !!state.value && !state.value.festival.bloomedAt && Date.parse(state.value.festival.endsAt) > Date.now());
const remaining = computed(() => !state.value ? '' : state.value.flower.progress >= 100 ? copy.bloomed : i18n.tsx._hata._hatask._flowerCare.bloomsIn({ duration: duration(state.value.flower.targetMinutes - state.value.flower.totalMinutes) }));
function duration(minutes: number): string { const value = Math.max(0, Math.ceil(minutes)); return value < 60 ? i18n.tsx._hata._hatask._flowerCare.minutes({ minutes: String(value) }) : value % 60 ? i18n.tsx._hata._hatask._flowerCare.hoursMinutes({ hours: String(Math.floor(value / 60)), minutes: i18n.tsx._hata._hatask._flowerCare.minutes({ minutes: String(value % 60) }) }) : i18n.tsx._hata._hatask._flowerCare.hoursOnly({ hours: String(Math.floor(value / 60)) }); }
function notify(text: string, icon = 'ti ti-droplet-filled') { message.value = enqueuePageStatusToast(text, icon) ? '' : text; }
function receive(next: HataskFlowerState) { if (disposed) return; state.value = next; error.value = false; emit('state', next); }
function onState(event: Event) { receive((event as CustomEvent<HataskFlowerState>).detail); }
async function load() { if (loading.value || disposed || !active) return; loading.value = true; try { receive(await getHataskFlowerState()); } catch { if (!disposed) error.value = true; } finally { loading.value = false; } }
function resume() { if (!document.hidden) void load(); }
function openBloom() { if (active && state.value?.flower.progress === 100 && !busy.value) { lastBloomId = state.value.flower.id; bloomFlower.value = { ...state.value.flower, memory: [...state.value.flower.memory], meaning: meaning.value, nickname: generateFlowerNickname(state.value.flower.name) }; bloom.value = true; } }
watch(() => state.value?.flower, flower => {
	window.clearTimeout(bloomTimer);
	if (active && flower?.progress === 100 && flower.id !== lastBloomId) bloomTimer = window.setTimeout(() => { if (!disposed && active && !document.hidden) openBloom(); }, props.animations ? 700 : 0);
});
async function pour() {
	if (busy.value || !state.value) return;
	busy.value = true;
	const destination = festivalAvailable.value ? target.value : 'self';
	try { receive(await pourHataskFlower(destination)); notify(destination === 'self' ? copy.wateredFlower : copy.wateredGarden); }
	catch { notify(copy.waterFailed, 'ti ti-droplet-off'); }
	finally { busy.value = false; }
}
async function harvest(nickname: string) {
	if (busy.value || !bloomFlower.value?.id) return;
	busy.value = true;
	try { const next = await harvestHataskFlower(bloomFlower.value.id, nickname.trim() || bloomFlower.value.name); receive(next); emit('harvested', next); busy.value = false; await nextTick(); bloomDialog.value?.close(); notify(copy.harvested, 'ti ti-sparkles'); }
	catch { notify(copy.harvestFailed, 'ti ti-hourglass'); }
	finally { busy.value = false; }
}
async function claim(season: HataskFlowerSeason) { if (busy.value) return; busy.value = true; try { receive(await claimHataskFlowerSeed(season)); notify(copy.seedReceived, 'ti ti-gift'); } catch { notify(copy.seedFailed, 'ti ti-hourglass'); } finally { busy.value = false; } }
function folderName(id: string) { return props.folders.find(folder => folder.id === id)?.name ?? ''; }
function reward(todo: HataskPlannerTodo): HataskDropReward { return state.value?.todoRewards?.[todo.id] ?? { granted: false, why: 'unknown' }; }
function rewardTip(todo: HataskPlannerTodo): string {
	const value = reward(todo);
	if (value.granted) return copy.rewardReceived;
	if (!value.why && !todo.done) return copy.rewardOnCompletion;
	switch (value.why) {
		case 'young': return i18n.tsx._hata._hatask._flowerCare.rewardTooYoung({ minutes: String(state.value?.rules.todoMinAgeMinutes ?? 30), remaining: value.left ? i18n.tsx._hata._hatask._flowerCare.rewardRemaining({ minutes: String(value.left) }) : '' });
		case 'short': return copy.rewardTooShort;
		case 'dup': return copy.rewardDuplicate;
		case 'rewarded': return copy.rewardReceived;
		case 'cap': return copy.rewardCap;
		case 'gap': return i18n.tsx._hata._hatask._flowerCare.rewardGap({ minutes: String(Math.ceil((state.value?.rules.hatadyGapSeconds ?? 60) / 60)) });
		case 'store':
		case 'full': return copy.rewardStoreFull;
		default: return copy.rewardIneligible;
	}
}
function rewardIcon(todo: HataskPlannerTodo): string { const value = reward(todo); return `ti ti-${value.granted ? 'droplet-check' : value.why === 'young' && !todo.done ? 'hourglass' : !value.why && !todo.done ? 'droplet-filled' : 'droplet-off'}`; }
function rewardLabel(todo: HataskPlannerTodo): string { const value = reward(todo); return todo.done || value.granted ? '' : value.why === 'young' ? `${value.left ?? 0}m` : !value.why ? '+1' : ''; }
async function toggleTodo(todo: HataskPlannerTodo) {
	if (pendingTodo.value || props.readOnly) return;
	pendingTodo.value = todo.id;
	const done = !todo.done;
	try { await props.completeTodo(todo.id, done); await load(); }
	catch { notify(copy.todoSaveFailed, 'ti ti-hourglass'); }
	finally { pendingTodo.value = null; }
}
async function dismissIntro() { intro.value = false; try { await misskeyApi('i/registry/set', { scope, key: 'flowerV2IntroSeen', value: true }); } catch { /* Showing the introduction again is safe. */ } }
onMounted(() => {
	window.addEventListener(HATASK_FLOWER_STATE_EVENT, onState);
	document.addEventListener('visibilitychange', resume);
	void load();
	void misskeyApi('i/registry/get', { scope, key: 'flowerV2IntroSeen' }).then((value: unknown) => { if (!disposed) intro.value = value !== true; }).catch(error => { if (!disposed && error?.code === 'NO_SUCH_KEY') intro.value = true; });
	timer = window.setInterval(resume, 60_000);
});
onActivated(() => { active = true; void load(); });
onDeactivated(() => {
	active = false;
	window.clearTimeout(bloomTimer);
	// Removing the modal also releases its focus trap, including during a request.
	bloom.value = false;
	bloomFlower.value = null;
});
onBeforeUnmount(() => { disposed = true; window.clearInterval(timer); window.clearTimeout(bloomTimer); window.removeEventListener(HATASK_FLOWER_STATE_EVENT, onState); document.removeEventListener('visibilitychange', resume); });
defineExpose({ openBloom, refresh: load });
</script>

<style lang="scss" module>
.root { display: grid; gap: 18px; min-width: 0; container-type: inline-size; line-break: strict; overflow-wrap: anywhere; }
.card { min-width: 0; padding: 14px 18px 16px; border: var(--card-border, 1px solid var(--rule)); border-radius: 24px; box-shadow: var(--shadow); background: var(--surface); }
.header { display:flex; align-items:center; gap:4px; min-height:44px; margin-bottom:4px; }
.header h3 { flex:1; margin:0; font:700 13px/1.5 var(--htk-font-head); color:var(--fg-2); }
.help { display:grid; place-items:center; flex:none; width:44px; min-height:44px; padding:0; border:0; border-radius:10px; background:transparent; color:var(--fg-2); font:inherit; font-size:20px; cursor:pointer; }
.root button:disabled {opacity:.55;cursor:default;}
.root button:hover:not(:disabled) {filter:brightness(.96);}
.root :focus-visible {outline:2px solid var(--accent);outline-offset:3px;}
.growing {display:grid;grid-template-columns:110px minmax(0,1fr);align-items:center;gap:8px 22px;}
.ring {position:relative;grid-row:1 / span 2;width:110px;height:110px;display:grid;place-items:center;}
.ring svg {position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:var(--rule);stroke-width:4;}
.ring .progress {stroke:var(--accent);stroke-linecap:round;stroke-dasharray:440;transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset .6s cubic-bezier(.2,0,0,1);}
.flowerArt {width:42px;height:42px;font-size:42px;} .flowerCopy {min-width:0;} .flowerCopy strong {font:700 21px/1.4 var(--htk-font-head);} .flowerCopy p {margin:4px 0 0;color:var(--fg-2);font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums;} .flowerCopy .remaining {margin-top:8px;color:var(--fg);font-size:14px;font-weight:700;}
.harvest {grid-column:2;justify-self:start;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 20px;border:0;border-radius:999px;background:var(--accent-ink);color:var(--on-accent);font:800 14px/1.5 var(--htk-font-body);cursor:pointer;} .harvest i {flex:none;font-size:18px;}
.care {display:grid;gap:12px;min-width:0;margin-top:16px;padding-top:14px;border-top:1px solid var(--rule);}
.todos {border:1px solid var(--rule);border-radius:16px;padding:4px 14px;background:color-mix(in srgb,var(--masthead) 50%,transparent);}
.todoHead {display:flex;align-items:center;gap:4px;padding:4px 0 2px;} .todoHead strong {flex:1;font-size:13px;}.brand {font-family:Righteous,sans-serif;font-weight:400;letter-spacing:.01em;}
.todo {width:100%;display:flex;align-items:center;gap:11px;padding:9px 0;border:0;border-top:1px solid var(--rule);background:transparent;color:var(--fg);font:inherit;text-align:start;cursor:pointer;}
.todoCopy {flex:1;min-width:0;} .todoCopy strong {font-size:13px;font-weight:700;line-height:1.5;} .todoCopy small {display:block;color:var(--fg-2);font-size:11px;font-weight:800;}
.done {color:var(--fg-3,var(--fg-2));text-decoration:line-through;}
.reward {display:inline-flex;align-items:center;gap:3px;flex:none;font:800 11px Archivo,sans-serif;font-variant-numeric:tabular-nums;color:var(--fg-3,var(--fg-2));white-space:nowrap;} .reward i {font-size:15px;} .eligible {color:#4a8fd6;}
.status,.feedback,.note {margin:8px 0;font-size:13px;line-height:1.7;}.status button {min-height:44px;margin:4px;padding:6px 14px;border:1px solid var(--rule);border-radius:999px;color:var(--fg);background:var(--masthead);font:inherit;}
.root[data-motion='off'] * {animation:none!important;transition:none!important;}
@container(max-width:350px){.card{padding-inline:14px;}.growing{column-gap:12px;grid-template-columns:90px minmax(0,1fr);}.ring{width:90px;height:90px;}.harvest{grid-column:1/-1;justify-self:stretch;justify-content:center;}.todos{padding-inline:10px;}}
@media(prefers-reduced-motion:reduce){.root *{animation:none!important;transition:none!important;}}
</style>
