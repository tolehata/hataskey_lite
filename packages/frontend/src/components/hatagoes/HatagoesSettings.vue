<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section ref="settingsEl" :class="$style.settings">
	<header :class="$style.header"><h1>HataGoes 設定</h1><p>ホームの見た目と、よく使う画面を整えます。</p></header>
	<p v-if="!ready" :class="$style.status">設定を読み込んでいます。</p>
	<p v-if="error" :class="$style.error" role="alert">設定を取得・保存できませんでした。<button type="button" @click="emit('retry')">再試行</button></p>
	<section v-if="matches('ホーム専用テーマ', 'テーマ', '見た目', '明暗', 'ダークモード', 'ハロウィン', 'halloween')" :class="[$style.panel, $style.themePanel]" aria-label="ホーム専用テーマ">
		<div :class="$style.panelHeader"><div><h2>ホーム専用テーマ</h2><p>HataGoes のホームだけに適用されます。</p></div><i class="ti ti-palette" aria-hidden="true"></i></div>
		<div :class="$style.carousel" role="group" aria-label="ホームのデザインテーマ" @keydown.left.prevent="moveTheme(-1)" @keydown.right.prevent="moveTheme(1)">
			<button type="button" :class="$style.arrow" aria-label="前のテーマ" :disabled="!ready || saving || themeIndex === 0" @click="moveTheme(-1)"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
			<div :class="$style.viewport" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd" @touchcancel="touchStart = null" @click.capture="guardSwipeClick">
				<button v-for="(id, index) in HATAGOES_THEMES" :key="id" type="button" :class="$style.themeCard" :data-theme="id" :style="{ '--offset': `${(index - themeIndex) * 78}%`, '--scale': index === themeIndex ? 1 : 0.8, zIndex: index === themeIndex ? 3 : 2 }" :aria-label="`${themeNames[id]} テーマ`" :aria-pressed="theme.theme === id" :aria-hidden="Math.abs(index - themeIndex) > 1" :tabindex="Math.abs(index - themeIndex) > 1 ? -1 : 0" :disabled="!ready || saving" @click="chooseTheme(id)">
					<HataskThemePreview :theme="id" :mode="previewMode" :class="$style.preview"/>
					<strong>{{ themeNames[id] }}</strong><small><template v-if="id === 'halloween' && isOctober">10月のおすすめ · </template>{{ themeDescriptions[id] }}</small>
					<span :class="$style.selection"><i :class="theme.theme === id ? 'ti ti-check' : 'ti ti-circle'" aria-hidden="true"></i>{{ theme.theme === id ? '選択中' : '選ぶ' }}</span>
				</button>
			</div>
			<button type="button" :class="$style.arrow" aria-label="次のテーマ" :disabled="!ready || saving || themeIndex === HATAGOES_THEMES.length - 1" @click="moveTheme(1)"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
		</div>
		<div :class="$style.dots" role="group" aria-label="テーマ一覧"><button v-for="id in HATAGOES_THEMES" :key="id" type="button" :aria-label="`${themeNames[id]} テーマへ移動`" :aria-pressed="theme.theme === id" :disabled="!ready || saving" @click="chooseTheme(id)"><i aria-hidden="true"></i></button></div>
		<div :class="$style.rows">
			<label :class="$style.settingRow"><span><b>端末の設定に合わせる</b><small>オフにすると明暗を手動で切り替えられます。</small></span><input type="checkbox" :class="$style.switchInput" :checked="theme.autoTheme" :disabled="!ready || saving" @change="emit('save', 'theme', { ...theme, autoTheme: !theme.autoTheme })"/><span :class="$style.switch" aria-hidden="true"></span></label>
			<label v-if="!theme.autoTheme" :class="$style.settingRow"><span><b>ダークモード</b></span><input type="checkbox" :class="$style.switchInput" :checked="theme.darkMode" :disabled="!ready || saving" @change="emit('save', 'theme', { ...theme, darkMode: !theme.darkMode })"/><span :class="$style.switch" aria-hidden="true"></span></label>
		</div>
	</section>
	<div :class="$style.searchBox"><i class="ti ti-search" aria-hidden="true"></i><label for="hatagoes-settings-search">設定を検索</label><input id="hatagoes-settings-search" v-model="search" type="search" placeholder="設定やアプリ名で検索"/></div>
	<section v-if="searchHits.length" aria-label="設定の検索結果" :class="$style.panel"><h2>各アプリの設定項目</h2><div :class="$style.rows"><button v-for="hit in searchHits" :key="`${hit.app}:${hit.section}`" type="button" :class="$style.navRow" @click="emit('appSettings', hit.app, hit.section)"><span><HataAppLogo :app="hit.app" :size="16" :monochrome="monochrome"/> <HataAppWordmark :app="hit.app" :onDark="monochrome"/> › {{ hit.label }}</span><i class="ti ti-chevron-right" aria-hidden="true"></i></button></div></section>
	<p v-if="!hasResults" :class="$style.status">一致する設定はありません。</p>
	<TransitionGroup name="hg-setting" tag="div" :class="$style.sections">
		<section v-if="appPins && matches('Appピン', 'アプリピン', 'お気に入り', 'hatask app', 'hataskey app', '＋メニュー')" key="app-pins" :class="$style.panel"><div :class="$style.panelHeader"><div><h2>＋メニューに表示する項目（最大8件）</h2><p>＋ボタンから開く記録・アプリのショートカットを選びます。</p></div><i class="ti ti-apps" aria-hidden="true"></i></div><div :class="$style.rows"><button type="button" :class="$style.navRow" :disabled="!ready || saving" @click="emit('editAppPins')"><span>＋メニューの項目を編集<small>{{ appPins.length }}/8 件</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button></div></section>
		<section v-if="matches('ホームのカード', 'カード', '並べ替え', '非表示', 'きょうの記録')" key="cards" :class="$style.panel">
			<div :class="$style.panelHeader"><div><h2>ホームのカード（{{ HATAGOES_HOME_CARDS_V3.length }}件）</h2><p>実際の配置に近い形で並べ替えられます。</p></div><i class="ti ti-layout-grid" aria-hidden="true"></i></div>
			<div :class="$style.previewMode" role="group" aria-label="配置プレビューの画面幅"><button type="button" :aria-pressed="cardPreviewMode === 'desktop'" @click="chooseCardPreviewMode('desktop')">PC</button><button type="button" :aria-pressed="cardPreviewMode === 'mobile'" @click="chooseCardPreviewMode('mobile')">スマホ</button></div>
			<div :class="$style.cardOrderTools"><p :class="$style.previewNote">配置イメージ · 内容はサンプルです。{{ cardPreviewMode === 'mobile' ? 'スマホでは矢印で順番を変えられます。' : 'ハンドルをドラッグ、または矢印で順番を変えられます。' }}</p><button type="button" :class="$style.resetOrder" :disabled="!readyToEdit || isDefaultCardOrder" @click="resetCardOrder"><i class="ti ti-restore" aria-hidden="true"></i>並び順をリセット</button></div>
			<p :class="$style.previewNote">表示・非表示はそのままです。</p>
			<p v-if="cardPreviewMode === 'mobile'" :class="$style.previewNote">モバイルでは5つの記録を「きょうの記録」にまとめます。個別カードはPCプレビューで設定できます。</p>
			<p v-if="draggedCardId" :class="$style.dragStatus" role="status" aria-live="polite">{{ dragTargetId ? `「${cardName(draggedCardId)}」を「${cardName(dragTargetId)}」の前へ` : `「${cardName(draggedCardId)}」を移動中` }}</p>
			<div ref="cardPreviewEl" :class="$style.cardPreview" :data-preview-mode="cardPreviewMode" :data-half-pair="mobileHalfPair" :data-flower-pair="mobileFlowerPair" aria-label="現在のホームの並び" @dragover.prevent.self="clearCardDragTarget" @drop.prevent="cancelCardDrag">
				<svg v-if="draggedCardId && dragTargetId && dragPath" :class="$style.dragTrail" :viewBox="`0 0 ${dragTrailSize.width} ${dragTrailSize.height}`" aria-hidden="true"><defs><marker id="hatagoes-card-drag-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M 0 0 L 9 4.5 L 0 9 z" fill="currentColor"/></marker></defs><path :d="dragPath" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 5" marker-end="url(#hatagoes-card-drag-arrow)"/></svg>
				<div v-if="cardPreviewMode === 'desktop'" :class="$style.previewLauncher" data-preview-launcher><strong><i class="ti ti-apps" aria-hidden="true"></i>Favorite App</strong><div aria-hidden="true"><span v-for="(icon, index) in previewLauncherIcons" :key="index"><i :class="icon"></i></span></div><small>すべての App</small></div>
				<template v-for="card in previewCards" :key="card.id">
				<article :class="[$style.previewCard, draggedCardId === card.id && $style.dragSource, dragTargetId === card.id && $style.dragTarget]" :data-card="card.id" :title="cardInfo[card.id].description" @dragover.prevent="previewCardDragOver(card.id)" @drop.prevent.stop="dropCard(card.id)">
					<div :class="$style.previewCardHead"><button type="button" :class="$style.dragHandle" :draggable="ready && !saving" :disabled="!ready || saving" :aria-label="`${cardName(card.id)}をドラッグして並べ替え`" @dragstart="startCardDrag(card.id, $event)" @dragend="cancelCardDrag"><i class="ti ti-grip-vertical" aria-hidden="true"></i></button><i :class="cardInfo[card.id].icon" aria-hidden="true"></i><strong>{{ cardName(card.id) }}</strong><label :class="$style.cardVisibility"><input type="checkbox" :checked="true" :disabled="!ready || saving" :aria-label="`${cardName(card.id)}を表示`" @change="toggleCard(card.id)"/><span>表示</span></label></div>
					<div v-if="cardPreviewMode === 'mobile' && card.id === 'daily'" :class="$style.previewDailyRows" aria-label="きょうの記録にまとめる項目"><div v-for="item in previewRituals" :key="item.label"><i :class="item.icon" aria-hidden="true"></i><span>{{ item.label }}</span><i class="ti ti-chevron-down" aria-hidden="true"></i></div></div>
					<div v-else :class="$style.previewSketch" aria-hidden="true"><span></span><span></span></div>
					<div :class="$style.previewActions"><button type="button" :disabled="!ready || saving || !canMoveVisible(card.id, -1)" :aria-label="`${cardName(card.id)}を前へ`" @click="moveVisibleCard(card.id, -1)"><i class="ti ti-arrow-left" aria-hidden="true"></i></button><button type="button" :disabled="!ready || saving || !canMoveVisible(card.id, 1)" :aria-label="`${cardName(card.id)}を後へ`" @click="moveVisibleCard(card.id, 1)"><i class="ti ti-arrow-right" aria-hidden="true"></i></button></div>
				</article>
				</template>
				<p v-if="!previewCards.length" :class="$style.previewEmpty">表示するカードはありません</p>
				<div v-if="cardPreviewMode === 'mobile'" :class="[$style.previewLauncher, $style.previewLauncherMobile]" data-preview-launcher><strong><i class="ti ti-apps" aria-hidden="true"></i>Favorite App</strong><div aria-hidden="true"><span v-for="(icon, index) in previewLauncherIcons.slice(0, 7)" :key="index"><i :class="icon"></i></span><span><i class="ti ti-layout-grid"></i></span></div></div>
			</div>
			<div v-if="hiddenCards.length" :class="$style.hiddenCards"><h3>非表示のカード</h3><div><label v-for="card in hiddenCards" :key="card.id"><input type="checkbox" :checked="false" :disabled="!ready || saving" :aria-label="`${cardName(card.id)}を表示`" @change="toggleCard(card.id)"/><i :class="cardInfo[card.id].icon" aria-hidden="true"></i>{{ cardName(card.id) }}を戻す</label></div></div>
		</section>
		<section v-if="visibleSettingsApps.length" key="app-settings" :class="$style.panel"><h2>各アプリの設定</h2><div :class="$style.rows"><button v-for="app in visibleSettingsApps" :key="app" type="button" :class="$style.navRow" @click="emit('appSettings', app)"><span :class="$style.appWordmark"><HataAppLogo :app="app" :size="16" :monochrome="monochrome"/><HataAppWordmark :app="app" :onDark="monochrome"/></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button></div></section>
		<section v-if="matches('アカウント', 'プロフィール', 'account', 'profile')" key="account" :class="$style.panel"><h2>アカウント</h2><div :class="$style.rows"><button type="button" :class="$style.navRow" @click="emit('navigate', '/settings/profile')"><span>プロフィールとアカウント設定を開く</span><i class="ti ti-chevron-right" aria-hidden="true"></i></button></div></section>
		<section v-if="matches('通知設定', '通知配信', 'プッシュ通知', 'notification')" key="notifications" :class="$style.panel"><h2>通知設定</h2><div :class="$style.rows"><button v-if="allowedApps.includes('hatask')" type="button" :class="$style.navRow" @click="emit('appSettings', 'hatask', 'moodReminder')"><span><HataAppWordmark app="hatask" :onDark="monochrome"/> きもち通知の時間</span><i class="ti ti-chevron-right" aria-hidden="true"></i></button><button v-if="allowedApps.includes('hatask')" type="button" :class="$style.navRow" @click="emit('appSettings', 'hatask', 'notifications')"><span><HataAppWordmark app="hatask" :onDark="monochrome"/> 実績・テスト通知</span><i class="ti ti-chevron-right" aria-hidden="true"></i></button><button type="button" :class="$style.navRow" @click="emit('navigate', '/settings/notifications')"><span>アカウント全体の通知配信設定を開く</span><i class="ti ti-chevron-right" aria-hidden="true"></i></button></div><p :class="$style.note"><HataAppWordmark app="hatady" :onDark="monochrome"/>・<HataAppWordmark app="hatafeed" :onDark="monochrome"/> の通知一覧は各アプリから確認できます。</p></section>
	</TransitionGroup>
	<p :class="$style.footerNote">変更は自動で保存されます</p>
</section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { HatagoesApp, HatagoesCatalogEntry } from '@/utility/hatagoes-catalog.js';
import type { HatagoesCard, HatagoesCardV3, HatagoesHomeTheme, HatagoesTheme } from '@/utility/hatagoes-preferences.js';
import { HATAGOES_HOME_CARDS_V3, HATAGOES_THEMES, normalizeHatagoesCardsV3 } from '@/utility/hatagoes-preferences.js';
import { searchHatagoesSettings } from '@/utility/hatagoes-settings-search.js';
import { store } from '@/store.js';
import HataskThemePreview from '@/components/hatask/HataskThemePreview.vue';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';

const props = defineProps<{ pins: string[]; appPins?: string[]; availableApps?: readonly HatagoesApp[]; cards: HatagoesCard[]; cardsV3?: HatagoesCardV3[]; theme: HatagoesHomeTheme; ready: boolean; saving: boolean; error: boolean; screens: readonly HatagoesCatalogEntry[]; monochrome?: boolean }>();
const emit = defineEmits<{ save: [key: 'pins' | 'cardsV3' | 'theme', value: unknown]; retry: []; appSettings: [app: HatagoesApp, section?: string]; editAppPins: []; navigate: [path: string] }>();
const themeNames = { akatsuki: '暁', koke: '苔', kisetsu: '季', kashin: '花信', suri: '刷', hatakyu: 'ハタキュ', halloween: 'ハロウィン' };
const themeDescriptions = { akatsuki: '夜明けのやわらかな光', koke: '森の静けさと深い緑', kisetsu: '和紙と墨の、移ろう四季', kashin: '花の便りのような明るさ', suri: '活版印刷の力強さ', hatakyu: 'コルクボードとメモ', halloween: 'かぼちゃ色と夜の紫' };
const isOctober = new Date().getMonth() === 9;
const appNames = { hatask: 'Hatask', hatady: 'Hatady', hatafeed: 'HataFeed' };
const cardName = (id: HatagoesCardV3['id']) => HATAGOES_HOME_CARDS_V3.find(card => card.id === id)?.label;
const settingCards = computed(() => normalizeHatagoesCardsV3(props.cardsV3, props.cards));
const ritualCardIds: HatagoesCardV3['id'][] = ['mood', 'meal', 'todo', 'flower', 'reading'];
const mobileDaily = computed(() => cardPreviewMode.value === 'mobile' && settingCards.value.some(card => card.id === 'daily' && !card.hidden));
const hiddenCards = computed(() => settingCards.value.filter(card => card.hidden && (!mobileDaily.value || !ritualCardIds.includes(card.id))));
const settingsEl = ref<HTMLElement | null>(null);
const cardPreviewMode = ref<'desktop' | 'mobile'>('desktop');
let cardPreviewModeTouched = false;
let cardResizeObserver: ResizeObserver | null = null;

function syncCardPreviewMode(): void {
	if (cardPreviewModeTouched) return;
	const width = settingsEl.value?.clientWidth || window.innerWidth;
	cardPreviewMode.value = width <= 540 ? 'mobile' : 'desktop';
}

function chooseCardPreviewMode(mode: 'desktop' | 'mobile'): void { cancelCardDrag(); cardPreviewModeTouched = true; cardPreviewMode.value = mode; }

onMounted(() => {
	syncCardPreviewMode();
	if (typeof ResizeObserver !== 'undefined' && settingsEl.value) {
		cardResizeObserver = new ResizeObserver(syncCardPreviewMode);
		cardResizeObserver.observe(settingsEl.value);
	}
	window.addEventListener('resize', syncCardPreviewMode);
});
onUnmounted(() => { cardResizeObserver?.disconnect(); window.removeEventListener('resize', syncCardPreviewMode); });
const draggedCardId = ref<HatagoesCardV3['id'] | null>(null);
const dragTargetId = ref<HatagoesCardV3['id'] | null>(null);
const dragPath = ref('');
const dragTrailSize = ref({ width: 1, height: 1 });
const cardPreviewEl = ref<HTMLElement | null>(null);
const defaultCardIds = HATAGOES_HOME_CARDS_V3.map(card => card.id).join(',');
const isDefaultCardOrder = computed(() => settingCards.value.map(card => card.id).join(',') === defaultCardIds);
const mobileDefaultIds: HatagoesCardV3['id'][] = ['daily', 'schedule', 'todo', 'mood', 'flower', 'reading', 'meal', 'issues'];
const orderedCards = computed(() => cardPreviewMode.value === 'mobile' && settingCards.value.map(card => card.id).join(',') === defaultCardIds
	? [...settingCards.value].sort((a, b) => mobileDefaultIds.indexOf(a.id) - mobileDefaultIds.indexOf(b.id)) : settingCards.value);
const previewCards = computed(() => orderedCards.value.filter(card => !card.hidden && (!mobileDaily.value || !ritualCardIds.includes(card.id))));
const mobileHalfPair = computed(() => {
	if (!mobileDaily.value) return false;
	const visible = previewCards.value.map(card => card.id);
	return visible.includes('schedule') && visible.includes('issues') && Math.abs(visible.indexOf('schedule') - visible.indexOf('issues')) === 1;
});
const mobileFlowerPair = computed(() => {
	if (cardPreviewMode.value !== 'mobile' || mobileDaily.value) return false;
	const visible = previewCards.value.map(card => card.id);
	return visible.includes('flower') && visible.includes('reading') && Math.abs(visible.indexOf('flower') - visible.indexOf('reading')) === 1;
});
const cardInfo: Record<HatagoesCardV3['id'], { icon: string; description: string; compact?: boolean; wide?: boolean }> = {
	daily: { icon: 'ti ti-chart-donut-3', description: '今日の5つの記録', wide: true }, schedule: { icon: 'ti ti-calendar-event', description: 'いまの予定と次の予定' }, flower: { icon: 'ti ti-flower', description: 'おはなの成長', compact: true }, todo: { icon: 'ti ti-checkbox', description: '優先度の高いToDo' }, mood: { icon: 'ti ti-mood-smile', description: '今日のきもち', compact: true }, meal: { icon: 'ti ti-soup', description: '今日のごはん', compact: true }, reading: { icon: 'ti ti-book-2', description: '読みかけの本', compact: true }, issues: { icon: 'ti ti-message-report', description: '自分のイシューを優先' },
};
const previewRituals = [{ label: 'きもち', icon: 'ti ti-mood-smile' }, { label: 'ごはん', icon: 'ti ti-soup' }, { label: 'ToDo', icon: 'ti ti-checkbox' }, { label: '水やり', icon: 'ti ti-droplet' }, { label: '読書', icon: 'ti ti-book-2' }];
const previewLauncherIcons = ['ti ti-calendar-event', 'ti ti-checkbox', 'ti ti-mood-smile', 'ti ti-soup', 'ti ti-flower', 'ti ti-book-2', 'ti ti-message-report', 'ti ti-trophy', 'ti ti-palette', 'ti ti-bell', 'ti ti-user', 'ti ti-settings'];
const search = ref('');
const themeIndex = computed(() => Math.max(0, HATAGOES_THEMES.indexOf(props.theme.theme)));
const previewMode = computed(() => (props.theme.autoTheme ? store.r.darkMode.value : props.theme.darkMode) ? 'dark' : 'light');
const allowedApps = computed(() => (['hatask', 'hatady', 'hatafeed'] as const).filter(app =>
	props.availableApps ? props.availableApps.includes(app) : props.screens.some(screen => screen.app === app)));
const visibleSettingsApps = computed(() => allowedApps.value.filter(app => matches(appNames[app], `${app} 設定`, 'アプリ設定')));
const searchHits = computed(() => searchHatagoesSettings(search.value, allowedApps.value));
const hasResults = computed(() => (!!props.appPins && matches('Appピン', 'アプリピン', 'お気に入り', 'hatask app', 'hataskey app', '＋メニュー'))
	|| matches('ホームのカード', 'カード', '並べ替え', '非表示', 'きょうの記録')
	|| matches('ホーム専用テーマ', 'テーマ', '見た目', '明暗', 'ダークモード', 'ハロウィン', 'halloween')
	|| matches('アカウント', 'プロフィール', 'account', 'profile')
	|| matches('通知設定', '通知配信', 'プッシュ通知', 'notification')
	|| visibleSettingsApps.value.length > 0 || searchHits.value.length > 0);
let touchStart: { x: number; y: number } | null = null;
let swipeUntil = 0;

function matches(...terms: string[]) {
	const query = search.value.trim().toLocaleLowerCase();
	return !query || terms.some(term => term.toLocaleLowerCase().includes(query));
}

function chooseTheme(id: HatagoesTheme) {
	if (!props.ready || props.saving || id === props.theme.theme) return;
	emit('save', 'theme', { ...props.theme, theme: id });
}

function moveTheme(delta: number) {
	const id = HATAGOES_THEMES[themeIndex.value + delta];
	if (id) chooseTheme(id);
}

function onTouchStart(event: TouchEvent) {
	const touch = event.touches[0];
	touchStart = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
}

function onTouchEnd(event: TouchEvent) {
	const start = touchStart, touch = event.changedTouches[0];
	touchStart = null;
	if (!start || !touch) return;
	const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
	if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { swipeUntil = performance.now() + 400; moveTheme(dx < 0 ? 1 : -1); }
}

function guardSwipeClick(event: MouseEvent) {
	if (performance.now() >= swipeUntil) return;
	event.preventDefault();
	event.stopPropagation();
}

function canMoveVisible(id: HatagoesCardV3['id'], delta: number): boolean {
	const index = previewCards.value.findIndex(card => card.id === id);
	return index >= 0 && previewCards.value[index + delta] != null;
}

function moveVisibleCard(id: HatagoesCardV3['id'], delta: number): void {
	if (!readyToEdit.value || !canMoveVisible(id, delta)) return;
	const adjacent = previewCards.value[previewCards.value.findIndex(card => card.id === id) + delta];
	const copy = [...(mobileDaily.value ? settingCards.value : orderedCards.value)];
	const from = copy.findIndex(card => card.id === id), to = copy.findIndex(card => card.id === adjacent.id);
	[copy[from], copy[to]] = [copy[to], copy[from]];
	emit('save', 'cardsV3', copy);
}

const readyToEdit = computed(() => props.ready && !props.saving);

function resetCardOrder(): void {
	if (!readyToEdit.value || isDefaultCardOrder.value) return;
	const hidden = new Map(settingCards.value.map(card => [card.id, card.hidden]));
	emit('save', 'cardsV3', HATAGOES_HOME_CARDS_V3.map(card => ({ id: card.id, hidden: hidden.get(card.id) ?? false })));
}

function clearCardDragTarget(): void { dragTargetId.value = null; dragPath.value = ''; }

function cancelCardDrag(): void { draggedCardId.value = null; clearCardDragTarget(); }

function previewCardDragOver(targetId: HatagoesCardV3['id']): void {
	const id = draggedCardId.value, preview = cardPreviewEl.value;
	if (!readyToEdit.value || !id || id === targetId || !preview) { clearCardDragTarget(); return; }
	const source = preview.querySelector<HTMLElement>(`[data-card="${id}"]`);
	const target = preview.querySelector<HTMLElement>(`[data-card="${targetId}"]`);
	if (!source || !target) { clearCardDragTarget(); return; }
	dragTargetId.value = targetId;
	const area = preview.getBoundingClientRect(), from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
	const x1 = from.left - area.left + from.width / 2, y1 = from.top - area.top + from.height / 2;
	const x2 = to.left - area.left + Math.min(20, to.width / 4), y2 = to.top - area.top + Math.min(16, to.height / 4);
	const bend = Math.max(18, Math.abs(x2 - x1) / 3);
	dragTrailSize.value = { width: Math.max(1, area.width), height: Math.max(1, area.height) };
	dragPath.value = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

function startCardDrag(id: HatagoesCardV3['id'], event: DragEvent): void {
	if (!readyToEdit.value) { event.preventDefault(); return; }
	draggedCardId.value = id;
	clearCardDragTarget();
	event.dataTransfer?.setData('text/plain', id);
	if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function dropCard(targetId: HatagoesCardV3['id']): void {
	const id = draggedCardId.value;
	cancelCardDrag();
	if (!readyToEdit.value || !id || id === targetId) return;
	const copy = [...(mobileDaily.value ? settingCards.value : orderedCards.value)];
	const from = copy.findIndex(card => card.id === id);
	if (from < 0 || copy[from].hidden) return;
	const [card] = copy.splice(from, 1);
	const to = copy.findIndex(item => item.id === targetId);
	if (to < 0) return;
	copy.splice(to, 0, card);
	if (copy.every((item, index) => item.id === settingCards.value[index]?.id)) return;
	emit('save', 'cardsV3', copy);
}

function toggleCard(id: string) { if (readyToEdit.value) emit('save', 'cardsV3', settingCards.value.map(card => card.id === id ? { ...card, hidden: !card.hidden } : card)); }

</script>

<style module>
.settings { --s-bg: var(--bg, var(--MI_THEME-bg)); --s-surface: var(--surface, var(--MI_THEME-panel)); --s-fg: var(--fg, var(--MI_THEME-fg)); --s-muted: var(--fg-2, var(--MI_THEME-fgTransparentWeak, var(--MI_THEME-fg))); --s-accent: var(--accent, var(--MI_THEME-accent)); --s-rule: var(--rule, var(--MI_THEME-divider)); container-type: inline-size; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; width: 100%; max-width: 650px; margin: auto; padding: 20px 14px 28px; color: var(--s-fg); font-size: 13px; }
.settings button, .settings input, .settings select { font: inherit; }
.appWordmark { display: inline-flex; align-items: center; gap: 6px; font-family: 'Righteous', system-ui, sans-serif; font-weight: 400; font-synthesis: none; }
.settings button { color: inherit; cursor: pointer; }
.settings button:disabled, .settings select:disabled { opacity: .4; cursor: default; }
.settings :is(button, select, input):focus-visible { outline: 2px solid var(--s-accent); outline-offset: 2px; }
.header { padding: 2px 4px 4px; }
.header h1 { margin: 0; font-size: 20px; line-height: 1.35; }
.header p, .panelHeader p { margin: 4px 0 0; color: var(--s-muted); font-size: 12px; line-height: 1.6; }
.panel { box-sizing: border-box; min-width: 0; padding: 16px; border: 1px solid var(--s-rule); border-radius: 20px; background: var(--s-surface); box-shadow: 0 3px 12px rgb(0 0 0 / 4%); }
.panel h2 { margin: 0; font-size: 16px; line-height: 1.5; }
.panelHeader { display: flex; align-items: start; gap: 12px; }
.panelHeader > div { flex: 1; }
.panelHeader > i { font-size: 19px; color: var(--s-accent); }
.carousel { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: center; margin: 10px -6px 0; }
.arrow { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 1px solid var(--s-rule); border-radius: 50%; background: var(--s-surface); color: var(--s-muted); font-size: 18px; }
.viewport { position: relative; height: 262px; min-width: 0; overflow: hidden; touch-action: pan-y; }
.themeCard { position: absolute; top: 8px; left: 50%; display: flex; flex-direction: column; align-items: stretch; gap: 7px; box-sizing: border-box; width: 186px; height: 244px; padding: 10px; border: 2px solid var(--s-rule); border-radius: 20px; background: var(--s-surface); text-align: center; transform: translateX(calc(-50% + var(--offset))) scale(var(--scale)); opacity: .45; transition: transform .35s ease, opacity .25s ease, border-color .2s ease; }
.themeCard[aria-pressed='true'] { border-color: var(--s-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--s-accent) 14%, transparent); opacity: 1; }
.themeCard[aria-hidden='true'] { visibility: hidden; pointer-events: none; }
.preview { width: 100%; height: 112px; flex: none; }
.themeCard strong { font-size: 16px; line-height: 1.2; }
.themeCard small { min-height: 32px; color: var(--s-muted); font-size: 11px; line-height: 1.45; }
.selection { display: flex; justify-content: center; align-items: center; gap: 4px; font-size: 12px; color: var(--s-muted); }
.themeCard[aria-pressed='true'] .selection { color: var(--s-accent); font-weight: 700; }
.dots { display: flex; justify-content: center; gap: 0; margin: -3px 0 10px; }
.dots button { display: grid; place-items: center; width: 30px; height: 28px; padding: 0; border: 0; background: transparent; }
.dots i { width: 7px; height: 7px; border-radius: 99px; background: var(--s-rule); transition: width .25s, background .25s; }
.dots [aria-pressed='true'] i { width: 22px; background: var(--s-accent); }
.rows { display: flex; flex-direction: column; }
.settingRow, .navRow { position: relative; display: flex; align-items: center; gap: 12px; box-sizing: border-box; min-height: 52px; padding: 9px 2px; border: 0; border-top: 1px solid var(--s-rule); background: transparent; text-align: left; }
.settingRow > span:first-child, .navRow > span { flex: 1; min-width: 0; }
.settingRow b { font-size: 13px; }
.settingRow small, .navRow small, .addRow small { display: block; margin-top: 3px; color: var(--s-muted); font-size: 11px; font-weight: 400; }
.switchInput { position: absolute; width: 44px; height: 26px; margin-left: auto; opacity: 0; }
.switchInput:focus-visible + .switch { outline: 2px solid var(--s-accent); outline-offset: 2px; }
.switch { flex: none; width: 44px; height: 26px; border-radius: 99px; background: var(--s-rule); position: relative; }
.switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: white; box-shadow: 0 1px 3px rgb(0 0 0 / 20%); transition: transform .2s; }
.switchInput:checked + .switch { background: var(--s-accent); }
.switchInput:checked + .switch::after { transform: translateX(18px); }
.navRow { width: 100%; font-weight: 600; }
.navRow > i { color: var(--s-muted); }
.navRow:hover:not(:disabled) { color: var(--s-accent); }
.searchBox { display: flex; align-items: center; gap: 9px; min-height: 46px; box-sizing: border-box; padding: 0 12px; border: 1px solid var(--s-rule); border-radius: 14px; background: var(--s-surface); }
.searchBox:focus-within { border-color: var(--s-accent); box-shadow: 0 0 0 2px var(--s-accent); }
.searchBox > i { color: var(--s-muted); font-size: 18px; }
.searchBox label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.searchBox input { flex: 1; min-width: 0; height: 44px; border: 0; outline: 0; background: transparent; color: var(--s-fg); }
.settings .searchBox input:focus-visible { outline: none; }
.sections { display: flex; flex-direction: column; gap: 12px; }
.orderList { display: flex; flex-direction: column; gap: 6px; margin: 14px 0 0; padding: 0; list-style: none; }
.orderList li { display: flex; align-items: center; gap: 8px; min-height: 46px; padding: 4px 6px 4px 10px; border: 1px solid var(--s-rule); border-radius: 12px; background: var(--s-bg); }
.number { color: var(--s-muted); font-size: 11px; font-weight: 700; }
.itemName { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; font-weight: 600; }
.itemName input { accent-color: var(--s-accent); }
.itemActions { display: flex; gap: 2px; }
.itemActions button { display: grid; place-items: center; width: 30px; height: 32px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--s-muted); font-size: 17px; }
.itemActions button:hover:not(:disabled) { background: var(--s-surface); color: var(--s-accent); }
.previewMode { display: inline-flex; gap: 3px; margin-top: 14px; padding: 3px; border: 1px solid var(--s-rule); border-radius: 999px; background: var(--s-bg); }
.previewMode button { min-height: 36px; padding: 0 16px; border: 0; border-radius: 999px; background: transparent; font-weight: 700; }
.previewMode button[aria-pressed='true'] { background: var(--s-accent); color: var(--on-accent, #fff); }
.cardOrderTools { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.cardOrderTools .previewNote { margin: 0; flex: 1; min-width: 180px; }
.resetOrder { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; padding: 6px 12px; border: 1px solid var(--s-rule); border-radius: 999px; background: var(--s-surface); font-size: 11px !important; font-weight: 700 !important; }
.resetOrder i { color: var(--s-accent); font-size: 16px; }
.dragStatus { margin: 8px 0 0; color: var(--s-accent); font-size: 12px; font-weight: 700; }
.previewNote { margin: 8px 0 0; color: var(--s-muted); font-size: 11px; }
.cardPreview { position: relative; isolation: isolate; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-flow: row; grid-auto-rows: minmax(58px, auto); gap: 7px; min-height: 80px; margin-top: 10px; padding: 10px; border: 1px solid var(--s-rule); border-radius: 14px; background: var(--s-bg); }
.dragTrail { position: absolute; inset: 0; z-index: 3; width: 100%; height: 100%; overflow: visible; color: var(--s-accent); pointer-events: none; filter: drop-shadow(0 1px 2px var(--s-bg)); }
.previewLauncher { display: flex; align-items: center; gap: 6px; grid-column: span 12; min-width: 0; padding: 6px; border: 1px solid var(--s-rule); border-radius: 10px; background: var(--s-surface); }
.previewLauncher strong { display: flex; align-items: center; gap: 4px; flex: 0 0 84px; font: 400 10px/1.2 Righteous, var(--htk-font-head, sans-serif); }
.previewLauncher strong i { color: var(--s-accent); font-size: 14px; }
.previewLauncher > div { display: grid; flex: 1; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 2px; min-width: 0; }
.previewLauncher > div span { display: grid; place-items: center; min-width: 0; min-height: 26px; border-radius: 7px; background: color-mix(in srgb, var(--s-accent) 10%, var(--s-surface)); color: var(--s-accent); font-size: 13px; }
.previewLauncher small { flex: none; padding: 4px 6px; border: 1px solid var(--s-rule); border-radius: 999px; font-size: 9px; font-weight: 800; }
.previewLauncherMobile { display: block; }
.previewLauncherMobile strong { margin-bottom: 5px; }
.previewLauncherMobile > div { display: flex; gap: 6px; overflow-x: auto; }
.previewLauncherMobile > div span { flex: 0 0 34px; min-height: 34px; font-size: 16px; }
.previewLauncherMobile > div span:last-child { border: 1px dashed var(--s-rule); background: transparent; }
.previewCard { position: relative; display: flex; flex-direction: column; min-width: 0; grid-column: span 4; padding: 6px; border: 1px solid var(--s-rule); border-radius: 10px; background: var(--s-surface); color: var(--s-fg); }
.dragSource { border-style: dashed; border-color: var(--s-accent); opacity: .48; }
.dragTarget { outline: 2px solid var(--s-accent); outline-offset: -2px; box-shadow: 0 0 0 3px color-mix(in srgb, var(--s-accent) 20%, transparent); }
.dragTarget::before { content: ''; position: absolute; z-index: 2; top: 4px; bottom: 4px; left: -4px; width: 4px; border-radius: 999px; background: var(--s-accent); }
.cardPreview[data-preview-mode='mobile'] .dragTarget::before { top: -4px; right: 4px; bottom: auto; left: 4px; width: auto; height: 4px; }
.previewCard[data-card='daily'] { grid-column: span 5; grid-row: span 2; }
.previewCard[data-card='schedule'], .previewCard[data-card='todo'], .previewCard[data-card='mood'], .previewCard[data-card='meal'], .previewCard[data-card='reading'] { grid-column: span 4; }
.previewCard[data-card='flower'] { grid-column: span 3; grid-row: span 2; }
.previewCard[data-card='issues'] { grid-column: span 5; }
.cardPreview[data-preview-mode='mobile'] .previewCard { grid-column: span 12; grid-row: auto; }
.cardPreview[data-half-pair='true'] .previewCard[data-card='schedule'], .cardPreview[data-half-pair='true'] .previewCard[data-card='issues'] { grid-column: span 6; }
.cardPreview[data-flower-pair='true'] .previewCard[data-card='flower'], .cardPreview[data-flower-pair='true'] .previewCard[data-card='reading'] { grid-column: span 6; }
.previewCardHead { display: flex; align-items: center; gap: 3px; min-width: 0; }
.previewCardHead > i { color: var(--s-accent); font-size: 15px; }
.previewCardHead strong { order: 1; flex: 0 0 100%; min-width: 0; font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
.dragHandle { display: grid; place-items: center; flex: none; width: 28px; height: 30px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--s-muted); cursor: grab !important; }
.dragHandle:disabled { cursor: default !important; }
.cardVisibility { display: inline-flex; align-items: center; gap: 3px; flex: none; margin-left: auto; color: var(--s-muted); font-size: 10px; cursor: pointer; }
.cardVisibility input, .hiddenCards input { margin: 0; accent-color: var(--s-accent); }
.previewSketch { display: flex; flex: 1; flex-direction: column; justify-content: center; gap: 5px; min-height: 20px; padding: 7px 4px; }
.previewSketch span { display: block; width: 76%; height: 5px; border-radius: 99px; background: color-mix(in srgb, var(--s-accent) 15%, var(--s-surface)); }
.previewSketch span + span { width: 48%; }
.previewCard[data-card='daily'] .previewSketch span:first-child, .previewCard[data-card='flower'] .previewSketch span:first-child { width: 34px; height: 34px; border-radius: 50%; background: conic-gradient(var(--s-accent) 0 62%, var(--s-rule) 62% 100%); }
.previewCard[data-card='daily'] .previewSketch span:first-child::after, .previewCard[data-card='flower'] .previewSketch span:first-child::after { content: ''; display: block; width: 25px; height: 25px; margin: 4.5px; border-radius: 50%; background: var(--s-surface); }
.previewDailyRows { display: flex; flex-direction: column; padding: 6px 4px; }
.previewDailyRows > div { display: flex; align-items: center; gap: 6px; min-height: 30px; border-top: 1px solid var(--s-rule); font-size: 11px; }
.previewDailyRows span { flex: 1; }
.previewDailyRows i { color: var(--s-accent); }
.previewActions { display: flex; justify-content: flex-end; gap: 2px; }
.previewActions button { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 7px; background: var(--s-bg); color: var(--s-muted); }
.previewActions button:hover:not(:disabled) { color: var(--s-accent); }
.previewEmpty { grid-column: 1 / -1; align-self: center; color: var(--s-muted); font-size: 11px; text-align: center; }
.hiddenCards { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--s-rule); }
.hiddenCards h3 { margin: 0 0 8px; font-size: 12px; }
.hiddenCards > div { display: flex; flex-wrap: wrap; gap: 6px; }
.hiddenCards label { display: inline-flex; align-items: center; gap: 5px; min-height: 36px; padding: 3px 9px; border: 1px solid var(--s-rule); border-radius: 999px; background: var(--s-bg); font-size: 11px; cursor: pointer; }
.hiddenCards i { color: var(--s-accent); }
@container (max-width: 430px) { .cardPreview { gap: 5px; padding: 6px; } .previewCard { padding: 4px; } .previewCardHead { flex-wrap: wrap; } .previewCardHead strong { font-size: 10px; } .previewSketch { min-height: 12px; padding: 3px; } .previewActions button { width: 28px; } }
.addRow { display: flex; align-items: center; gap: 12px; justify-content: space-between; margin-top: 12px; }
.addRow > span { font-weight: 600; }
.addRow select { min-width: 0; max-width: 60%; min-height: 38px; padding: 0 10px; border: 1px solid var(--s-rule); border-radius: 10px; background: var(--s-surface); color: var(--s-fg); }
.note, .footerNote, .status { color: var(--s-muted); font-size: 12px; line-height: 1.6; }
.note { margin: 10px 0 0; }
.footerNote { margin: 4px 0 0; text-align: center; }
.error { padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, #c23b3b 10%, var(--s-surface)); color: #c23b3b; }
.error button { margin-left: 8px; border: 0; background: transparent; text-decoration: underline; }
:global(.hg-setting-move), :global(.hg-setting-enter-active), :global(.hg-setting-leave-active) { transition: opacity 180ms ease, transform 180ms ease; }
:global(.hg-setting-enter-from), :global(.hg-setting-leave-to) { opacity: 0; transform: translateY(6px); }
@media (max-width: 380px) { .settings { padding-inline: 10px; } .panel { padding: 14px; } .carousel { margin-inline: -10px; } .themeCard { width: 172px; } }
@container (max-width: 380px) { .panel { padding: 14px; } .carousel { margin-inline: -10px; } .themeCard { width: 172px; } .addRow { align-items: stretch; flex-direction: column; } .addRow select { max-width: 100%; } }
</style>
