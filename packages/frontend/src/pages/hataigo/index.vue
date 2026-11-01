<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div ref="rootEl" class="hataigo" :class="$style.root" :data-dark="store.r.darkMode.value">
	<header :class="$style.header">
		<button type="button" :class="$style.brand" aria-label="HataIgo ホーム" @click="setTab('home')">
			<HataigoLogo :size="26" :monochrome="store.r.darkMode.value"/>
			<span :class="$style.wordmark">Hata<span>Igo</span></span>
		</button>
		<HyNav :class="$style.nav" sliding aria-label="HataIgo" :modelValue="tab" :options="tabs" @update:modelValue="setTab"/>
		<div :class="$style.tools">
			<button type="button" :class="$style.tool" aria-label="遊び方・公開範囲・ソースコード" title="遊び方・公開範囲・ソースコード" @click="openInfo"><i class="ti ti-info-circle" aria-hidden="true"></i></button>
			<button type="button" :class="$style.tool" aria-label="盤と石の設定" title="盤と石の設定" @click="openSettings"><i class="ti ti-settings" aria-hidden="true"></i></button>
			<!-- 単独で開いたときだけ。HataGoes の中では HataGoes 側の閉じるを使う -->
			<button v-if="!embedded" type="button" :class="$style.tool" aria-label="HataIgo を終了" title="HataIgo を終了" @click="exitHataigo"><i class="ti ti-logout-2" aria-hidden="true"></i></button>
		</div>
	</header>
	<main :class="$style.content">
		<p v-if="error" class="ig-alert" role="alert">{{ error }}</p>
		<HataigoRewards :active="paneActive" :refreshKey="rewardRefreshKey"/>
		<Home v-if="tab === 'home'" :active="paneActive" @play="startSolo" @ai="startAi" @online="startOnline" @invite="startInvite" @open="openGame" @navigate="setTab"/>
		<HataigoModeTabs v-if="tab === 'game'" :modelValue="gameMode" :modes="gameModes" label="対局の種類" @update:modelValue="selectMode"/>
		<History v-if="tab === 'records'" :active="paneActive" @replay="requestReplay" @open="openGame"/>
		<KeepAlive>
			<Analysis v-if="(tab === 'game' && gameMode === 'solo') || tab === 'records'" :key="tab" :mode="tab === 'game' ? 'solo' : 'replay'" :initialSize="size" :active="paneActive" :replayRequest="tab === 'records' ? replayRequest ?? undefined : undefined"/>
		</KeepAlive>
		<KeepAlive><AiGame v-if="tab === 'game' && gameMode === 'ai'" :initialSize="size" :active="paneActive" :embedded="embedded" @finished="refreshRewards"/></KeepAlive>
		<KeepAlive><Lobby v-if="tab === 'game' && gameMode === 'online' && !selectedGameId" :initialSize="size" :opponent="lobbyOpponent" :active="paneActive" :embedded="embedded" @open="openGame"/></KeepAlive>
		<KeepAlive :max="1"><OnlineGame v-if="tab === 'game' && gameMode === 'online' && selectedGameId" :key="selectedGameId" :gameId="selectedGameId" :active="paneActive" :embedded="embedded" @exit="selectedGameId = null" @finished="refreshRewards"/></KeepAlive>
		<Collection v-if="tab === 'collection'"/>
	</main>
</div>
</template>

<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from 'vue';
import Home from './home.vue';
import Analysis from './analysis.vue';
import Collection from './collection.vue';
import AiGame from './ai-game.vue';
import Lobby from './lobby.vue';
import OnlineGame from './online-game.vue';
import History from './history.vue';
import type { BoardSize } from '@/utility/hataigo/rules/board.js';
import HataigoRewards from '@/components/hataigo/HataigoRewards.vue';
import HyNav from '@/components/HyNav.vue';
import HataigoLogo from '@/components/hataigo/HataigoLogo.vue';
import HataigoInfo from '@/components/hataigo/HataigoInfo.vue';
import HataigoSettings from '@/components/hataigo/HataigoSettings.vue';
import HataigoModeTabs from '@/components/hataigo/HataigoModeTabs.vue';
import * as os from '@/os.js';
import { hataigoText as text } from '@/utility/hataigo/i18n.js';
import { useHataigoPrefs } from '@/utility/hataigo/prefs.js';
import { scrollToTop } from '@/utility/hataigo/scroll.js';
import { store } from '@/store.js';
import { definePage } from '@/page.js';
import { useRouter } from '@/router.js';
import '@/components/hatady-ui.css';
import '@/components/hataigo/hataigo.css';

defineOptions({ name: 'HataigoIndex' });

const props = withDefaults(defineProps<{ embedded?: boolean; requestedTab?: string; paneActive?: boolean; gameId?: string }>(), { embedded: false, requestedTab: 'home', paneActive: true, gameId: undefined });
const router = useRouter();
const emit = defineEmits<{ tabChange: [tab: string] }>();
const tabs = [
	{ value: 'home', label: text.home, icon: 'ti ti-home' },
	{ value: 'game', label: text.game, icon: 'ti ti-swords' },
	{ value: 'records', label: text.records, icon: 'ti ti-notebook' },
	{ value: 'collection', label: text.collection, icon: 'ti ti-palette' },
];
const tab = ref('home');
const size = ref<BoardSize>(19);
type GameMode = 'solo' | 'ai' | 'online';
const gameModes: { id: GameMode; label: string; desc: string; icon: string }[] = [
	{ id: 'solo', label: 'ひとりで並べる', desc: '検討・棋譜の読み込み', icon: 'ti ti-grid-dots' },
	{ id: 'ai', label: 'AIと打つ', desc: '置石も自由', icon: 'ti ti-robot' },
	{ id: 'online', label: '人と打つ', desc: 'フリーマッチ・招待', icon: 'ti ti-users' },
];
const gameMode = ref<GameMode>('solo');
const lobbyOpponent = ref<'match' | 'invite'>('match');
const selectedGameId = ref<string | null>(null);
const rootEl = useTemplateRef('rootEl');

// タブ・対局の種類・対局の画面を替えたら先頭から見せる（各画面の中の切り替えは各画面が scrollToTop を呼ぶ）
function toTop(): void { void nextTick(() => scrollToTop(rootEl.value)); }

watch([tab, gameMode, selectedGameId], toTop);
const rewardRefreshKey = ref(0);
const replayRequest = ref<{ id: string; sgf: string } | null>(null);
const { error } = useHataigoPrefs();

// HataGoes のペインの中に描くと、ペインより手前の層（ヘッダー・ドック）に隠れる。os.popup でルートに出す
function openInfo(): void { const { dispose } = os.popup(HataigoInfo, {}, { closed: () => dispose() }); }

function openSettings(): void { const { dispose } = os.popup(HataigoSettings, {}, { closed: () => dispose() }); }

function exitHataigo(): void { router.push('/'); }

function refreshRewards(): void { rewardRefreshKey.value++; }

function requestReplay(request: { id: string; sgf: string }): void { replayRequest.value = request; }

function setTab(value: string): void {
	if (!tabs.some(item => item.value === value)) return;
	tab.value = value;
	if (props.embedded) emit('tabChange', value);
}

function startSolo(value: BoardSize): void {
	gameMode.value = 'solo';
	size.value = value;
	setTab('game');
}

function startAi(value: BoardSize): void {
	gameMode.value = 'ai';
	size.value = value;
	setTab('game');
}

function selectMode(mode: GameMode): void {
	// 対局中の画面から「人と打つ」を押し直したら、ロビーに戻す
	if (mode === 'online' && gameMode.value === 'online') selectedGameId.value = null;
	gameMode.value = mode;
}

function startInvite(value: BoardSize): void {
	startOnline(value);
	lobbyOpponent.value = 'invite';
}

function startOnline(value: BoardSize): void {
	lobbyOpponent.value = 'match';
	size.value = value;
	gameMode.value = 'online';
	selectedGameId.value = null;
	setTab('game');
}

function openGame(id: string): void {
	selectedGameId.value = id;
	gameMode.value = 'online';
	setTab('game');
}

watch(() => props.requestedTab, value => setTab(value), { immediate: true });
watch(() => props.gameId, id => { if (id) openGame(id); }, { immediate: true });
definePage(() => ({ title: 'HataIgo', icon: 'ti ti-circles', needWideArea: true }));
</script>

<style module>
/* HyNav の狭幅用の詰め方は `hatady` という名前のコンテナで効く（Hatady と同じ形に揃える） */
.root { width: 100%; container: hatady / inline-size; }
.header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; padding: 16px 24px; }
.brand { justify-self: start; display: inline-flex; align-items: center; gap: 10px; min-height: 44px; border: 0; border-radius: 999px; background: transparent; color: var(--hy-ink); padding: 6px 8px; cursor: pointer; }
.wordmark { font: 400 21px/1 'HataAppRighteous', sans-serif; }
.wordmark > span { color: var(--hy-accent); }
.nav { max-width: 100%; min-width: 0; }
.tools { justify-self: end; display: flex; align-items: center; }
/* HataGoes の右上と同じ形：枠も背景もなし、44px の押せる幅、アイコン 20px、ホバーでアクセント色を薄く */
.root .tool { all: unset; box-sizing: border-box; min-width: 44px; min-height: 44px; padding: 8px 12px; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; color: var(--hy-ink); cursor: pointer; transition: background-color 140ms ease; }
.root .tool > i { font-size: 20px; }
.root .tool:hover { background: color-mix(in srgb, var(--hy-accent) 10%, transparent); }
.root .tool:focus-visible { outline: 2px solid var(--hy-accent); outline-offset: 2px; }
.content { max-width: 1400px; margin: 0 auto; padding: 0 24px 24px; display: grid; gap: 14px; }
@container (max-width: 760px) {
	.header { grid-template-columns: 1fr auto; gap: 10px; padding: 12px; }
	.nav { grid-column: 1 / -1; grid-row: 2; justify-self: center; }
	.content { padding: 0 12px 16px; }
}
</style>
