<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: Hatask の設定UIを共有コンポーネント化したもの。
  Hatask本体(pages/hatask.vue)と、旗鯖独自機能の設定(settings/hata-custom.vue)の
  両方から os.popup で開ける。設定データは i/registry(scope=['client','hatask'])に
  保存され、Hatask本体と完全に同期する(同じキーを読み書きするため)。
-->
<template>
<!-- 旗鯖fork: 設定画面の右ペインへ埋め込むときは、窓そのものを枠なしへ差し替える。
     ⚠️窓は position: fixed の重ね表示なので、CSSでペインの中へは収められない。
     ⚠️受け口(#header / 本体 / close())は同じ形なので、中身には手を触れない。 -->
<component :is="embedded ? SettingsEmbeddedWindow : MkModalWindow"
	ref="dialog"
	:width="650"
	:height="900"
	:withOkButton="false"
	:panelClass="embedded ? $style.settingsPalette : $style.settingsWindow"
	:panelTheme="settings.theme || 'akatsuki'"
	:panelMode="previewMode"
	v-bind="embedded ? {} : { fullScreenOnMobile: !!hataGoesHost }"
	@close="dialog?.close()"
	@esc="dialog?.close()"
	@closed="emit('closed')"
>
	<template #header><span class="settingsBrandText">{{ copy.title }}</span></template>

	<div ref="settingsRoot" :class="$style.root" :data-hatask-theme="settings.theme || 'akatsuki'" :data-hatask-mode="previewMode" :aria-busy="loading || settingsSaving">
		<div v-if="loading" :class="$style.loading">{{ copy.loading }}</div>
		<div v-else-if="!settingsLoaded" :class="$style.loadError">
			<p role="alert">{{ plannerCopy.readFailure }}</p>
			<MkButton rounded @click="loadSettings">{{ plannerCopy.retry }}</MkButton>
		</div>
		<template v-else>
			<p v-if="settingsError" :class="$style.settingsError" role="alert">{{ settingsError }}</p>
			<!-- デザインテーマから始め、ほかの設定も同じ画面で続ける。 -->
			<div :class="$style.themePanel" data-hatagoes-setting="theme">
				<div :class="$style.label" style="font-size:1.05rem">{{ copy.designTheme }}</div>
				<div :class="$style.desc" style="margin-bottom:12px">{{ copy.designThemeDescription }}</div>
				<!-- v2: 左右スライドで選択(選択中=中央 / 前後=フェードで両脇) -->
				<div :class="$style.themeCarousel">
					<button type="button" :class="$style.carArrow" :disabled="settingsSaving || themeIndex<=0" @click="slideTheme(-1)" :aria-label="copy.previousTheme"><i class="ti ti-chevron-left"></i></button>
					<div :class="$style.carViewport" data-theme-carousel @touchstart.passive="onThemeTouchStart" @touchend.passive="onThemeTouchEnd">
						<button v-for="(t,i) in v2Themes" :key="t.id" type="button" :class="[$style.themeCard, settings.theme===t.id && $style.themeCardOn]" :style="themeCardStyle(i)" :data-theme-card="t.id" :disabled="settingsSaving" :tabindex="Math.abs(i-themeIndex)>1 ? -1 : 0" :aria-pressed="settings.theme===t.id" @click="setV2Theme(t.id)">
							<HataskThemePreview :theme="t.id" :mode="previewMode"/>
							<div :class="$style.themeName" :style="{ fontFamily:t.head }">{{ t.name }}</div>
							<div :class="$style.themeJp" :data-theme-description="t.id">{{ t.cardDescription ?? t.description }}</div>
							<div :class="[$style.themeCheck, settings.theme===t.id && $style.themeCheckOn]"><i :class="settings.theme===t.id ? 'ti ti-check' : 'ti ti-circle'"></i> {{ settings.theme===t.id ? copy.selected : copy.select }}</div>
						</button>
					</div>
					<button type="button" :class="$style.carArrow" :disabled="settingsSaving || themeIndex>=v2Themes.length-1" @click="slideTheme(1)" :aria-label="copy.nextTheme"><i class="ti ti-chevron-right"></i></button>
				</div>
				<div :class="$style.carDots">
					<button v-for="t in v2Themes" :key="t.id" type="button" :class="[$style.carDot, settings.theme===t.id && $style.carDotOn]" :disabled="settingsSaving" :aria-pressed="settings.theme===t.id" @click="setV2Theme(t.id)" :aria-label="t.name"></button>
				</div>
				<!-- 外観(ライト/ダーク) -->
				<div :class="$style.card" data-hatagoes-setting="appearance">
					<div :class="$style.label">{{ copy.appearance }}</div>
					<div :class="$style.row"><span>{{ autoAppearanceLabel }}</span><button type="button" :class="[$style.sw, settings.autoTheme && $style.swOn]" :disabled="settingsSaving" role="switch" :aria-label="autoAppearanceLabel" :aria-checked="settings.autoTheme" @click="toggle('autoTheme')"></button></div>
					<div v-if="!settings.autoTheme" :class="$style.row"><span>{{ copy.darkMode }}</span><button type="button" :class="[$style.sw, settings.darkMode && $style.swOn]" :disabled="settingsSaving" role="switch" :aria-label="copy.darkMode" :aria-checked="settings.darkMode" @click="toggle('darkMode')"></button></div>
				</div>
				<!-- アニメーション -->
				<div :class="$style.card" data-hatagoes-setting="animation">
					<div :class="$style.label">{{ copy.animation }}</div>
					<div :class="$style.row"><span>{{ copy.animationMotion }}</span><button type="button" :class="[$style.sw, settings.animations!==false && $style.swOn]" :disabled="settingsSaving" role="switch" :aria-label="copy.animationMotion" :aria-checked="settings.animations!==false" @click="toggle('animations')"></button></div>
					<div :class="$style.desc">{{ copy.animationDescription }}</div>
				</div>
			</div>

			<!-- カレンダー -->
			<div :class="$style.card" data-hatagoes-setting="calendar">
				<div :class="$style.label">{{ copy.calendar }}</div>
				<div :class="$style.row"><span>{{ copy.weekStart }}</span>
					<select :class="$style.sel" :value="settings.weekStart" :disabled="settingsSaving" :aria-label="copy.weekStart" @change="onWeekStart($event)"><option value="mon">{{ copy.monday }}</option><option value="sun">{{ copy.sunday }}</option></select>
				</div>
			</div>

			<!-- きもち記録 -->
			<div ref="moodReminderCard" data-hatagoes-setting="moodReminder" :class="[$style.card, moodReminderHighlight && $style.cardHighlight]">
				<div :class="$style.label">{{ copy.moodLog }}</div>
				<div :class="$style.row"><span>{{ copy.moodReminderToggle }}</span><button ref="moodReminderSwitch" type="button" :class="[$style.sw, settings.moodRemind && $style.swOn]" :disabled="settingsSaving" role="switch" :aria-label="copy.moodReminderToggle" :aria-checked="!!settings.moodRemind" @click="toggle('moodRemind')"></button></div>
				<div :class="[$style.desc, $style.lines]">{{ copy.moodReminderDescription }}</div>
				<template v-if="settings.moodRemind">
					<div :class="$style.subLabel">{{ copy.moodReminderTimes }}</div>
					<div :class="$style.chips" role="group" :aria-label="copy.moodReminderTimes">
						<button v-for="time in HATASK_MOOD_REMINDER_TIMES" :key="time" type="button" :class="[$style.chip, moodRemindTimes.includes(time) && $style.chipOn]" :aria-pressed="moodRemindTimes.includes(time)" :disabled="settingsSaving" @click="toggleMoodRemindTime(time)">{{ moodRemindTimeLabel(time) }}</button>
					</div>
					<div v-if="moodRemindTimes.length === 0" :class="$style.warn" role="status"><i class="ti ti-alert-triangle" aria-hidden="true"></i>{{ copy.moodReminderNoTimes }}</div>
					<div :class="$style.row"><span>{{ copy.moodReminderTimeZone }}</span><span :class="$style.value">{{ formatHataskTimeZone(moodRemindTimeZone) }}</span></div>
					<div :class="$style.desc">{{ copy.moodReminderTimeZoneDescription }}</div>
					<template v-if="deviceTimeZone !== moodRemindTimeZone">
						<div :class="[$style.desc, $style.lines]">{{ tx.moodReminderTimeZoneMismatch({ zone: formatHataskTimeZone(deviceTimeZone) }) }}</div>
						<div :class="$style.safetyActions">
							<MkButton rounded small :disabled="settingsSaving" @click="saveSettings({ moodRemindTimeZone: deviceTimeZone })"><i class="ti ti-world" aria-hidden="true"></i> {{ copy.moodReminderUseDeviceTimeZone }}</MkButton>
						</div>
					</template>
					<div v-if="appNotificationsOff" :class="$style.warn" role="status">
						<i class="ti ti-bell-off" aria-hidden="true"></i>
						<div :class="$style.lines">{{ copy.moodReminderAppNotificationsOff }}<br><MkA to="/settings/notifications" :class="$style.link">{{ copy.openNotificationSettings }}</MkA></div>
					</div>
					<div :class="[$style.desc, $style.lines]">{{ tx.moodReminderDelivery({ name: serverName }) }}</div>
				</template>
			</div>

			<!-- データ同期 -->
			<div :class="$style.card" data-hatagoes-setting="sync">
				<div :class="$style.label">{{ copy.dataSync }}</div>
				<div :class="$style.desc">{{ copy.dataSyncDescription }}</div>
					<div v-for="s in syncItems" :key="s.id" :class="$style.row"><span>{{ s.label }}</span><span :class="[$style.sw, $style.swOn]" aria-hidden="true"></span></div>
			</div>

			<!-- 予定 / Todo 専用。既存IDを上書きしないJSON退避と追加統合。 -->
			<div :class="$style.card" data-hatagoes-setting="dataSafety">
				<div :class="$style.label">{{ plannerCopy.dataSafety }}</div>
				<div :class="$style.desc">{{ plannerCopy.mergeOnlyWarning }}</div>
				<div :class="$style.safetyActions">
					<MkButton rounded small :disabled="plannerSafetyBusy" @click="exportPlannerData"><i class="ti ti-download" aria-hidden="true"></i> {{ plannerCopy.export }}</MkButton>
					<MkButton rounded small :disabled="plannerSafetyBusy" @click="plannerImportInput?.click()"><i class="ti ti-file-upload" aria-hidden="true"></i> {{ plannerCopy.import }}</MkButton>
					<input ref="plannerImportInput" :class="$style.hiddenInput" type="file" accept="application/json,.json" @change="importPlannerData">
				</div>
				<div v-if="plannerLastBackup" :class="$style.backupMeta"><i class="ti ti-shield-check" aria-hidden="true"></i>{{ plannerTx.lastBackup({ date: plannerLastBackup }) }}</div>
				<div v-if="plannerSafetyMessage" :class="$style.backupMeta" role="status" aria-live="polite">{{ plannerSafetyMessage }}</div>
			</div>

			<div :class="$style.card" data-hatagoes-setting="recordTransfer">
				<div :class="$style.label">{{ recordCopy.title }}</div>
				<div :class="$style.desc">{{ recordCopy.description }}</div>
				<div :class="$style.safetyActions">
					<MkButton rounded small :disabled="recordBusy" @click="exportRecordData"><i class="ti ti-download" aria-hidden="true"></i> {{ recordCopy.export }}</MkButton>
					<MkButton rounded small :disabled="recordBusy" @click="recordImportInput?.click()"><i class="ti ti-file-upload" aria-hidden="true"></i> {{ recordCopy.import }}</MkButton>
					<input ref="recordImportInput" :class="$style.hiddenInput" type="file" accept="application/json,.json" @change="importRecordData">
				</div>
				<div v-if="recordMessage" :class="$style.backupMeta" role="status" aria-live="polite">{{ recordMessage }}</div>
			</div>

			<!-- 通知 -->
			<div :class="$style.card" data-hatagoes-setting="notifications">
				<div :class="$style.label">{{ copy.notifications }}</div>
				<div :class="$style.row"><span>{{ i18n.ts._hata._hatask._ranking.showAchievementNotice }}</span><button type="button" :class="[$style.sw, settings.showRankingAchievementNotice !== false && $style.swOn]" :disabled="settingsSaving" role="switch" :aria-label="i18n.ts._hata._hatask._ranking.showAchievementNotice" :aria-checked="settings.showRankingAchievementNotice !== false" @click="saveSettings({ showRankingAchievementNotice: settings.showRankingAchievementNotice === false })"></button></div>
				<div :class="$style.row"><span>{{ copy.sendTestNotification }}</span><MkButton rounded small @click="sendTestNotification">{{ copy.sendTest }}</MkButton></div>
				<div :class="$style.desc">{{ copy.pushNotificationDescription }}</div>
			</div>

			<!-- レートリミット -->
			<div :class="$style.card" data-hatagoes-setting="rateLimit">
				<div :class="$style.label">{{ copy.rateLimit }}</div>
				<div :class="$style.rlBox">
					<div :class="$style.rlTitle">{{ copy.apiLimit }}</div>
					<table :class="$style.rlTbl">
						<thead><tr><th>{{ copy.operation }}</th><th>{{ copy.limit }}</th><th>{{ copy.period }}</th></tr></thead>
						<tbody>
							<tr><td>{{ copy.createSchedule }}</td><td>{{ tx.times({ count: 30 }) }}</td><td>{{ tx.hours({ count: 1 }) }}</td></tr>
							<tr><td>{{ copy.mood }}</td><td>{{ tx.times({ count: 20 }) }}</td><td>{{ tx.hours({ count: 1 }) }}</td></tr>
							<tr><td>ToDo</td><td>{{ tx.times({ count: 60 }) }}</td><td>{{ tx.hours({ count: 1 }) }}</td></tr>
							<tr><td>{{ copy.search }}</td><td>{{ tx.times({ count: 30 }) }}</td><td>{{ tx.minutes({ count: 1 }) }}</td></tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- ヘルプ -->
			<div :class="$style.card" data-hatagoes-setting="help">
				<div :class="$style.label">{{ copy.help }}</div>
				<div :class="$style.row"><span>{{ copy.showTutorialAgain }}</span><MkButton rounded small @click="reopenTutorial">{{ copy.show }}</MkButton></div>
				<div :class="$style.desc">{{ copy.tutorialDescription }}</div>
			</div>

			<div :class="$style.note" role="status">{{ settingsSaving ? plannerCopy.saving : copy.savedNote }}</div>
		</template>
	</div>
</component>
</template>

<script lang="ts" setup>
import { ref, shallowRef, computed, nextTick, onMounted, inject, watch } from 'vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import { revealHatagoesSetting } from '@/utility/hatagoes-setting-section.js';
import type { HataskPlannerTheme } from '@/components/hatask/hatask-planner-types.js';
import SettingsEmbeddedWindow from '@/components/SettingsEmbeddedWindow.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useRouter } from '@/router.js';
import * as os from '@/os.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { createHataskPlannerApiStoragePort } from '@/utility/hatask-planner-api.js';
import { createHataskPlannerIntegrity, HATASK_PLANNER_SCOPE, migrateHataskPlannerStorage, normalizeHataskPlannerData, stablePlannerJson, verifyHataskPlannerIntegrity } from '@/utility/hatask-planner-storage.js';
import type { HataskPlannerCollectionKey, HataskPlannerEvent, HataskPlannerRawData, HataskPlannerTemplate } from '@/utility/hatask-planner-storage.js';
import { normalizeHataskPlannerTemplates } from '@/utility/hatask-planner-templates.js';
import { createHataskMoodReminderPatch, formatHataskTimeZone, getHataskDeviceTimeZone, getHataskMoodReminderTimeZone, HATASK_MOOD_REMINDER_TIMES } from '@/utility/hatask-mood-reminder.js';
import { $i } from '@/i.js';
import { instance } from '@/instance.js';
import { host } from '@@/js/config.js';
import { store } from '@/store.js';
import HataskThemePreview from '@/components/hatask/HataskThemePreview.vue';
import { acquireHataskRecordOperation, downloadHataskRecords, exportHataskRecords, finishHataskRecordImport, importHataskRecords, markHataskRecordViewsUnsafe, parseHataskRecordsFile, refreshHataskRecordViews, waitForHataskRecordWrites, HATASK_RECORD_MAX_BYTES } from '@/utility/hatask-record-transfer.js';

const dialogs = useHataGoesDialogs();
const emit = defineEmits<{ (ev:'closed'):void; (ev:'reopenTutorial'):void; (ev:'changed', settings:any):void }>();
/**
 * 旗鯖fork: 窓と埋め込みのどちらでも通る参照の型。
 * ⚠️片方の窓の型に固定すると、埋め込みへ差し替えたときに型が合わなくなる。
 *   実際に使うのは close() だけなので、そこだけを約束する。
 */
type SettingsWindowHandle = { close: () => void };
const dialog = shallowRef<SettingsWindowHandle>();
const router = useRouter();
const copy = i18n.ts._hata._hatask._settings;
const tx = i18n.tsx._hata._hatask._settings;
const plannerCopy = i18n.ts._hata._hatask._planner;
const plannerTx = i18n.tsx._hata._hatask._planner;
const recordCopy = i18n.ts._hata._hatask._records;
const recordTx = i18n.tsx._hata._hatask._records;

// Hatask本体と同じ registry スコープ/キーを使うことでデータを共有・同期する
const SCOPE = ['client', 'hatask'];
const defaultSettings: any = {
	darkMode: false,
	autoTheme: true,
	weekStart: 'mon',
	moodRemind: false,
	theme: 'akatsuki',
	animations: true,
};

// 共通レイアウトの配色と見出しフォントをテーマのプレビューにも使う。
const v2Themes = computed(() => [
	{ id: 'akatsuki', name: copy.themeAkatsuki, description: copy.themeAkatsukiDescription, cardDescription: copy.themeAkatsukiDescription.replace(/^(朝焼けのグラデーションと、)(?=軽やかな3ペイン$)/u, '$1\n'), head: "'Zen Maru Gothic',sans-serif" },
	{ id: 'koke', name: copy.themeKoke, description: copy.themeKokeDescription, head: "'Zen Maru Gothic',sans-serif" },
	{ id:'kisetsu', name:copy.themeKisetsu, description:copy.themeKisetsuDescription, head:"'Shippori Mincho B1','Zen Kaku Gothic New',serif" },
	{ id:'kashin', name:copy.themeKashin, description:copy.themeKashinDescription, head:"'Zen Maru Gothic',sans-serif" },
	{ id:'suri', name:copy.themeSuri, description:copy.themeSuriDescription, head:"'Zen Kaku Gothic Antique',sans-serif" },
	// 旗鯖fork(ハタキュ): プレビューの地色はコルク、紙はクリーム、アクセントは紙に載る青。
	{ id:'hatakyu', name:copy.themeHatakyu, description:copy.themeHatakyuDescription, head:"'Zen Maru Gothic',sans-serif" },
	{ id: 'halloween', name: 'ハロウィン', description: '月明かりと、おばけたちの秋の夜', cardDescription: new Date().getMonth() === 9 ? '10月のおすすめ\n月明かりと、おばけたちの秋の夜' : undefined, head: "'Zen Maru Gothic',sans-serif" },
] satisfies { id: HataskPlannerTheme; name: string; description: string; cardDescription?: string; head: string }[]);
const syncItems = computed(() => [
	{ id: 'schedule', label: copy.syncSchedule },
	{ id: 'mood', label: copy.syncMood },
	{ id: 'todo', label: 'ToDo' },
	{ id: 'meal', label: copy.syncMeal },
	{ id: 'flower', label: copy.syncFlower },
]);

const loading = ref(true);
const settingsLoaded = ref(false);
const settingsSaving = ref(false);
const settingsError = ref('');
const settings = ref<any>({ ...defaultSettings });
// Match Hatask's active theme, including its display-only fallback for empty legacy values.
const isAkatsuki = computed(() => !settings.value.theme || settings.value.theme === 'akatsuki');
const previewMode = computed<'light' | 'dark'>(() => (settings.value.autoTheme ? store.r.darkMode.value : settings.value.darkMode) ? 'dark' : 'light');
const autoAppearanceLabel = computed(() => isAkatsuki.value || settings.value.theme === 'koke' || settings.value.theme === 'halloween' ? copy.autoAppearanceTheme : copy.autoAppearance);
const plannerImportInput = ref<HTMLInputElement|null>(null);
const plannerSafetyBusy = ref(false);
const plannerSafetyMessage = ref('');
const plannerLastBackup = ref('');
const recordImportInput = ref<HTMLInputElement | null>(null);
const recordBusy = ref(false);
const recordMessage = ref('');

async function exportRecordData(): Promise<void> {
	if (recordBusy.value) return;
	const token = acquireHataskRecordOperation();
	if (token == null) { recordMessage.value = recordCopy.operationBusy; return; }
	recordBusy.value = true; recordMessage.value = '';
	try {
		await waitForHataskRecordWrites(token);
		downloadHataskRecords(await exportHataskRecords());
		recordMessage.value = recordCopy.exported;
	} catch (error) {
		console.error('Hatask records export failed:', error);
		recordMessage.value = recordCopy.exportFailed;
	} finally {
		finishHataskRecordImport(token);
		recordBusy.value = false;
	}
}

async function importRecordData(event: Event): Promise<void> {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0]; input.value = '';
	if (!file || recordBusy.value) return;
	recordBusy.value = true; recordMessage.value = '';
	let saved = false;
	let sent = false;
	let token: symbol | null = null;
	try {
		if (file.size > HATASK_RECORD_MAX_BYTES) throw new TypeError('File too large');
		const transfer = parseHataskRecordsFile(await file.text());
		const counts = transfer.data;
		const { canceled } = await dialogs.confirm({ type: 'warning', text: recordTx.mergeWarning({ moods: String(counts.moods.length), meals: String(counts.meals.length), flowers: String(counts.flowers.length) }) });
		if (canceled) return;
		token = acquireHataskRecordOperation();
		if (token == null) { recordMessage.value = recordCopy.operationBusy; return; }
		await waitForHataskRecordWrites(token);
		markHataskRecordViewsUnsafe(token);
		sent = true;
		const result = await importHataskRecords(transfer);
		saved = true;
		await refreshHataskRecordViews(token);
		const total = Object.values(result.added).reduce((sum, count) => sum + count, 0);
		const duplicates = Object.values(result.duplicates).reduce((sum, count) => sum + count, 0);
		const conflicts = Object.values(result.conflicts).reduce((sum, count) => sum + count, 0);
		recordMessage.value = recordTx.imported({ added: String(total), duplicates: String(duplicates), conflicts: String(conflicts) });
	} catch (error) {
		console.error('Hatask records import failed:', error);
		recordMessage.value = saved ? recordCopy.refreshFailed : sent ? recordCopy.unknownState : recordCopy.importFailed;
	} finally {
		if (token != null) finishHataskRecordImport(token);
		recordBusy.value = false;
	}
}
function setV2Theme(id:string) { if (v2Themes.value.some(theme => theme.id === id)) void saveSettings({ theme: id }); }

// 旗鯖fork(v2): テーマ選択カルーセル(左右スライド)。選択中を中央・前後をフェードで両脇に。
const themeIndex = computed(() => { const i = v2Themes.value.findIndex(t => t.id === (settings.value.theme || 'akatsuki')); return i < 0 ? 0 : i; });
function themeCardStyle(i:number) {
	const off = i - themeIndex.value;
	const abs = Math.abs(off);
	return {
		transform: `translateX(${off * 76}%) scale(${off === 0 ? 1 : 0.8})`,
		opacity: abs > 1 ? 0 : (off === 0 ? 1 : 0.4),
		zIndex: String(off === 0 ? 3 : 2 - abs),
		pointerEvents: (abs > 1 ? 'none' : 'auto') as any,
		filter: off === 0 ? 'none' : 'saturate(.7)',
	};
}
function slideTheme(dir:number) { const n = themeIndex.value + dir; if (n >= 0 && n < v2Themes.value.length) setV2Theme(v2Themes.value[n].id); }
let _themeTouchX = 0;
function onThemeTouchStart(e:TouchEvent) { _themeTouchX = e.changedTouches[0].clientX; }
function onThemeTouchEnd(e:TouchEvent) { const dx = e.changedTouches[0].clientX - _themeTouchX; if (Math.abs(dx) > 40) slideTheme(dx < 0 ? 1 : -1); }

async function loadSettings(): Promise<void> {
	loading.value = true;
	settingsLoaded.value = false;
	settingsError.value = '';
	try {
		const value = await misskeyApi('i/registry/get', { key: 'settings', scope: SCOPE });
		if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Hatask settings');
		settings.value = { ...defaultSettings, ...value };
		settingsLoaded.value = true;
	} catch (error) {
		// 未作成だけを初回扱いにする。通信失敗や壊れた値を既定値で上書きしない。
		if ((error as { code?: string } | null)?.code === 'NO_SUCH_KEY') {
			settings.value = { ...defaultSettings };
			settingsLoaded.value = true;
		}
	} finally {
		loading.value = false;
	}
}

onMounted(async () => {
	const [, plannerSnapshot] = await Promise.all([
		loadSettings(),
		loadPlannerSnapshot().catch(() => null),
	]);
	void revealFocusedSetting();
	if(plannerSnapshot){
		const dates=plannerCollectionEntries(plannerSnapshot).map(([,collection])=>collection.latestBackupAt).filter((date):date is string=>typeof date==='string').sort();
		plannerLastBackup.value=dates.length?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(dates[dates.length-1])):'';
	}
});

type PlannerCollectionSnapshot={exists:boolean;updatedAt:string|null;revision:string|null;value:unknown;hash?:string;backupCount?:number;latestBackupAt?:string|null};
type PlannerApiSnapshot={
	version:number;
	collections:Record<HataskPlannerCollectionKey,PlannerCollectionSnapshot>&{templates?:PlannerCollectionSnapshot};
};

function plannerCollectionEntries(snapshot:PlannerApiSnapshot):Array<[string,PlannerCollectionSnapshot]>{
	return Object.entries(snapshot.collections).filter((entry):entry is [string,PlannerCollectionSnapshot]=>entry[1]!=null);
}

const plannerStoragePort=createHataskPlannerApiStoragePort((endpoint,params)=>misskeyApi(endpoint as never,params as never));

async function loadPlannerSnapshot():Promise<PlannerApiSnapshot>{
	return await misskeyApi('hatask/planner/get' as never,{} as never) as PlannerApiSnapshot;
}

async function preparePlannerImportStorage():Promise<PlannerApiSnapshot>{
	// 取り込みより先に必ず既存3コレクションを再読込し、移行前原本のshadow作成と
	// 正規化後の完全性検証を完了させる。blocked/failed時は一切取り込まない。
	await plannerStoragePort.refresh();
	const migration=await migrateHataskPlannerStorage(plannerStoragePort,{scope:HATASK_PLANNER_SCOPE});
	if(migration.status!=='noop'&&migration.status!=='migrated'){
		const detail=migration.issues[0]?.detail??migration.stage??'planner migration failed';
		throw new Error(detail);
	}
	return await plannerStoragePort.refresh() as PlannerApiSnapshot;
}

function plannerRawData(snapshot:PlannerApiSnapshot):HataskPlannerRawData{
	return{todos:snapshot.collections.todos.value,folders:snapshot.collections.folders.value,events:snapshot.collections.events.value};
}

function downloadJson(filename:string,value:unknown):void{
	const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
	const url=URL.createObjectURL(blob);
	const link=window.document.createElement('a');
	link.href=url;link.download=filename;link.click();
	window.setTimeout(()=>URL.revokeObjectURL(url),0);
}

async function exportPlannerData():Promise<void>{
	plannerSafetyBusy.value=true;plannerSafetyMessage.value='';
	try{
		const snapshot=await loadPlannerSnapshot();
		const raw=plannerRawData(snapshot);
		const normalized=normalizeHataskPlannerData(raw);
		const normalizedTemplates=normalizeHataskPlannerTemplates(snapshot.collections.templates?.value??[]);
		if(normalizedTemplates.invalidCount>0)throw new TypeError('Invalid Hatask planner templates');
		const exportedAt=new Date();
		downloadJson(`hatask-planner-${exportedAt.toISOString().slice(0,10)}.json`,{
			format:'hatask-planner-export',version:1,exportedAt:exportedAt.toISOString(),
			data:{...raw,templates:normalizedTemplates.templates},
			integrity:normalized.issues.length===0?createHataskPlannerIntegrity(normalized.data):null,
			issues:normalized.issues,
			server: { version:snapshot.version, collections:Object.fromEntries(plannerCollectionEntries(snapshot).map(([key,value])=>[key,{updatedAt:value.updatedAt,hash:value.hash,backupCount:value.backupCount,latestBackupAt:value.latestBackupAt}])) },
		});
		plannerSafetyMessage.value=plannerCopy.dataExported;
	}catch(error){
		console.error('Hatask planner export failed:',error);
		plannerSafetyMessage.value=plannerCopy.dataExportFailed;
	}finally{plannerSafetyBusy.value=false}
}

function mergePlannerCollection<T extends {id:string}>(current:T[],incoming:T[]):{value:T[];added:number;collisions:number}{
	const currentById=new Map(current.map(item=>[item.id,item]));
	const value=[...current];let added=0;let collisions=0;
	for(const item of incoming){
		const existing=currentById.get(item.id);
		if(existing){if(stablePlannerJson(existing)!==stablePlannerJson(item))collisions++;continue}
		value.push(item);currentById.set(item.id,item);added++;
	}
	return{value,added,collisions};
}

async function importPlannerData(event:Event):Promise<void>{
	const input=event.target as HTMLInputElement;
	const file=input.files?.[0];
	input.value='';
	if(!file)return;
	plannerSafetyBusy.value=true;plannerSafetyMessage.value='';
	try{
		const parsed=JSON.parse(await file.text()) as {data?:unknown};
		const source=(parsed&&typeof parsed==='object'&&parsed.data!=null?parsed.data:parsed) as HataskPlannerRawData&{templates?:unknown};
		const incoming=normalizeHataskPlannerData(source);
		if(incoming.issues.length)throw new TypeError(incoming.issues[0].message);
		const incomingTemplates=normalizeHataskPlannerTemplates(source.templates??[]);if(incomingTemplates.invalidCount>0)throw new TypeError('Invalid Hatask planner templates');
		const {canceled}=await dialogs.confirm({type:'warning',text:plannerCopy.mergeOnlyWarning});
		if(canceled)return;

		const before=await preparePlannerImportStorage();
		const current=normalizeHataskPlannerData(plannerRawData(before));
		if(current.issues.length)throw new TypeError(current.issues[0].message);
		const currentTemplates=normalizeHataskPlannerTemplates(before.collections.templates?.value??[]);if(currentTemplates.invalidCount>0)throw new TypeError('Invalid stored Hatask planner templates');
		// インポートした公開予定のserverEventIdは所有確認前に操作へ使わない。原値は別名で保持する。
		const safeIncomingEvents:HataskPlannerEvent[]=incoming.data.events.map((eventItem):HataskPlannerEvent=>{
			if(eventItem.visibility!=='public'&&!eventItem.publicSyncState)return eventItem;
			const item={
				...eventItem,
				...(eventItem.serverEventId?{importedServerEventId:eventItem.serverEventId}:{}),
				...(eventItem.publicSyncState?{importedPublicSyncState:eventItem.publicSyncState}:{}),
				publicSyncState:'unlinked' as const,
			};
			delete item.serverEventId;delete item.serverEventRevision;delete item.pendingVisibility;
			return item;
		});
			const merges={
				todos:mergePlannerCollection(current.data.todos,incoming.data.todos),
				folders:mergePlannerCollection(current.data.folders,incoming.data.folders),
				events:mergePlannerCollection(current.data.events,safeIncomingEvents),
				templates:mergePlannerCollection<HataskPlannerTemplate>(currentTemplates.templates,incomingTemplates.templates),
			};
			let added=0;let collisions=0;
			const changes=(['todos','folders','events','templates'] as const).flatMap(key=>{
				added+=merges[key].added;collisions+=merges[key].collisions;
				const expectedRevision=key==='templates'
					? before.collections.templates?.revision??null
					: before.collections[key].revision;
				return merges[key].added===0?[]:[{collection:key,expectedRevision,value:merges[key].value}];
			});
			if(added===0){plannerSafetyMessage.value=plannerCopy.dataNoChanges;return}
			// 全revisionの照合後に1 transactionで反映し、途中適用を作らない。
			await misskeyApi('hatask/planner/commit-batch' as never,{changes} as never);
			const after=await loadPlannerSnapshot();
			const expectedData={todos:merges.todos.value,folders:merges.folders.value,events:merges.events.value};
			const verification=verifyHataskPlannerIntegrity(createHataskPlannerIntegrity(expectedData),plannerRawData(after));
			if(!verification.ok)throw new Error(verification.issues[0]?.detail??'planner import verification failed');
			const afterTemplates=normalizeHataskPlannerTemplates(after.collections.templates?.value??[]);if(afterTemplates.invalidCount>0||stablePlannerJson(afterTemplates.templates)!==stablePlannerJson(merges.templates.value))throw new Error('planner template import verification failed');
		plannerSafetyMessage.value=plannerTx.dataImported({count:String(added),collisions:String(collisions)});
	}catch(error){
		console.error('Hatask planner import failed:',error);
		plannerSafetyMessage.value=plannerCopy.dataImportFailed;
	}finally{plannerSafetyBusy.value=false}
}

async function saveSettings(patch: Record<string, unknown>): Promise<void> {
	if (!settingsLoaded.value || settingsSaving.value) return;
	const nextSettings = { ...settings.value, ...createHataskMoodReminderPatch(settings.value, patch) };
	settingsSaving.value = true;
	settingsError.value = '';
	try {
		await misskeyApi('i/registry/set', { key: 'settings', value: nextSettings, scope: SCOPE });
		settings.value = nextSettings;
		// 保存できた値だけを親へ通知する。失敗時は最後に取得・保存できた選択を保つ。
		emit('changed', { ...nextSettings });
	} catch {
		settingsError.value = copy.saveFailure;
	} finally {
		settingsSaving.value = false;
	}
}

function toggle(key:string) { void saveSettings({ [key]: !settings.value[key] }); }

// 保存済みの時刻選択。未保存の旧設定はサーバーと同じ既定(昼・寝る前)として表示する。
const moodRemindTimes = computed<string[]>(() => settings.value.moodRemindTimes === undefined
	? ['昼 12:00', '寝る前 23:00']
	: Array.isArray(settings.value.moodRemindTimes) ? settings.value.moodRemindTimes : []);
const moodRemindTimeZone = computed(() => getHataskMoodReminderTimeZone(settings.value));
const deviceTimeZone = getHataskDeviceTimeZone();
const serverName = instance.name ?? host;
// 受信設定で「連携アプリからの通知」を切ると、サーバーはリマインドを作らない。
const appNotificationsOff = computed(() => ($i?.notificationRecieveConfig as Record<string, { type?: string } | undefined> | undefined)?.app?.type === 'never');
const moodRemindTimeLabels: Record<string, string> = {
	'朝 8:00': i18n.ts._hata._hatask._main.moodReminderMorning,
	'昼 12:00': i18n.ts._hata._hatask._main.moodReminderNoon,
	'夜 20:00': i18n.ts._hata._hatask._main.moodReminderEvening,
	'寝る前 23:00': i18n.ts._hata._hatask._main.moodReminderBedtime,
};
function moodRemindTimeLabel(time: string): string { return moodRemindTimeLabels[time] ?? time; }
function toggleMoodRemindTime(time: string): void {
	const times = moodRemindTimes.value;
	// 表示順を保ったまま保存する。
	void saveSettings({ moodRemindTimes: HATASK_MOOD_REMINDER_TIMES.filter(t => t === time ? !times.includes(t) : times.includes(t)) });
}
function onWeekStart(ev:Event) {
	const select = ev.target as HTMLSelectElement;
	const value = select.value;
	select.value = settings.value.weekStart;
	if (value === 'mon' || value === 'sun') void saveSettings({ weekStart: value });
}

// 旗鯖fork(#37): チュートリアル再表示。
//   Hatask本体内で開いた場合は親(hatask.vue)が emit を受けて reopenTutorial を実行する。
//   旗鯖独自設定から開いた場合は Hatask へ遷移してから手動で再表示してもらう必要がある。
function reopenTutorial() {
	emit('reopenTutorial');
	dialog.value?.close();
	// Hatask以外のページから開いた場合は遷移する(イベントを誰も拾わない場合のフォールバック)
	if (!router.currentRoute.value.path.startsWith('/hatask')) {
		router.push('/hatask');
	}
}

// 旗鯖fork(#37): Hatask本体から移植したテスト通知
async function sendTestNotification() {
	try { await misskeyApi('notifications/test-notification', {}); os.toast(copy.testNotificationSent); }
	catch { os.toast(copy.testNotificationFailed); }
}

const props = defineProps<{
	/** 旗鯖fork: true なら窓の枠を持たず、設定画面の右ペインの中身として描く。 */
	embedded?: boolean;
	/** 開いた直後に表示・強調する設定項目(きもち画面のリマインドボタンから)。 */
	focus?: 'moodReminder';
	initialSection?: string;
}>();
const hataGoesHost = inject(HATA_GOES_HOST, null);
const settingsRoot = ref<HTMLElement>();
watch([() => props.initialSection, settingsLoaded], async ([section, loaded]) => {
	if (!section || !loaded) return;
	await nextTick();
	revealHatagoesSetting(settingsRoot.value, section);
}, { immediate: true, flush: 'post' });

const moodReminderCard = shallowRef<HTMLElement>();
const moodReminderSwitch = shallowRef<HTMLButtonElement>();
const moodReminderHighlight = ref(false);

function userScrollableAncestor(el: HTMLElement): HTMLElement | null {
	for (let node = el.parentElement; node; node = node.parentElement) {
		const { overflowY } = getComputedStyle(node);
		if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
	}
	return null;
}

async function revealFocusedSetting(): Promise<void> {
	if (props.focus !== 'moodReminder' || !settingsLoaded.value) return;
	await nextTick();
	const card = moodReminderCard.value;
	const scroller = card ? userScrollableAncestor(card) : null;
	if (card && scroller) {
		// scrollIntoView は overflow:hidden の窓枠まで動かし、上下の操作部(閉じるボタン等)が
		// 画面外に取り残されるため、利用者がスクロールできる本文だけを動かす。
		const top = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12;
		scroller.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
	}
	moodReminderSwitch.value?.focus({ preventScroll: true });
	moodReminderHighlight.value = true;
	window.setTimeout(() => { moodReminderHighlight.value = false; }, 1600);
}
</script>

<style lang="scss" module>
.settingsWindow, .settingsPalette, .root {
	--MI_THEME-bg: var(--bg);
	--MI_THEME-panel: var(--surface);
	--MI_THEME-windowHeader: var(--surface);
	--MI_THEME-fg: var(--fg);
	--MI_THEME-fgMuted: var(--fg-2);
	--MI_THEME-divider: var(--rule);
	--MI_THEME-accent: var(--accent-ink, var(--accent));
	--MI_THEME-buttonBg: var(--surface);
	--MI_THEME-buttonHoverBg: color-mix(in srgb, var(--accent) 10%, var(--surface));
	color: var(--fg);
	background: var(--bg);
}
.settingsWindow { border-radius: 18px; }
.settingsWindow > :first-child { display:grid; grid-template-columns:46px minmax(0,1fr) 46px; align-items:center; }
.settingsWindow > :first-child > span { grid-column:2; padding:0; text-align:center; }
.settingsWindow > :first-child > button { grid-column:1; grid-row:1; color:var(--fg); }
.settingsWindow[data-hatask-theme='akatsuki'], .settingsPalette[data-hatask-theme='akatsuki'], .root[data-hatask-theme='akatsuki'] {
	--bg:#fff3ec; --surface:rgba(255,255,255,.82); --fg:#2b1f2c; --fg-2:#6a5566;
	--rule:rgba(80,50,70,.18); --accent:#e0567a; --accent-ink:#b02e56;
	color-scheme:light;
}
.settingsWindow[data-hatask-theme='akatsuki'][data-hatask-mode='dark'], .settingsPalette[data-hatask-theme='akatsuki'][data-hatask-mode='dark'], .root[data-hatask-theme='akatsuki'][data-hatask-mode='dark'] {
	--bg:#150f1b; --surface:#302539; --fg:#f6ecf3; --fg-2:#c8b5c6;
	--rule:rgba(255,255,255,.18); --accent:#ff7fa3; --accent-ink:#ff7fa3;
	color-scheme:dark;
}
.root { container-type:inline-size; display:flex; flex-direction:column; gap:14px; padding:18px 20px 22px; }
.loadError { display:grid; justify-items:center; gap:12px; padding:24px 0; text-align:center; }
.settingsError { margin:0; padding:12px 14px; border:1px solid var(--MI_THEME-divider); border-radius:12px; color:var(--MI_THEME-fg); background:var(--MI_THEME-panel); font-size:.85rem; line-height:1.6; }
.root[aria-busy='true'] button:disabled, .root[aria-busy='true'] select:disabled { cursor:wait; opacity:.5; }
.loading { padding:40px 0; display:flex; justify-content:center; }
.card { background: var(--MI_THEME-panel); border:1px solid var(--MI_THEME-divider); border-radius:14px; padding:14px 16px; scroll-margin-top:12px; transition:border-color .3s, box-shadow .3s; }
.cardHighlight { border-color:var(--MI_THEME-accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--MI_THEME-accent) 25%, transparent); }
.label { font-size:.95rem; font-weight:700; margin-bottom:10px; }
.desc { font-size:.8rem; opacity:.65; line-height:1.6; margin-top:4px; }
.note { font-size:.8rem; opacity:.6; text-align:center; padding:4px 0 2px; }
.safetyActions { display:flex; flex-wrap:wrap; justify-content:center; gap:10px; margin-top:12px; }
.hiddenInput { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.backupMeta { display:flex; align-items:flex-start; justify-content:center; gap:6px; margin-top:10px; color:var(--MI_THEME-fg); font-size:.78rem; line-height:1.55; text-align:center; overflow-wrap:anywhere; }
.row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 0; font-size:.9rem; }
.value { font-size:.82rem; opacity:.8; text-align:right; overflow-wrap:anywhere; }
.subLabel { font-size:.85rem; font-weight:600; margin-top:12px; }
.chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
.chip { min-height:44px; padding:8px 14px; border:1px solid var(--MI_THEME-divider); border-radius:999px; background:var(--MI_THEME-bg); color:var(--MI_THEME-fg); font:inherit; font-size:.82rem; cursor:pointer; }
.chip:disabled { opacity:.5; cursor:default; }
.chip:focus-visible { outline:3px solid var(--MI_THEME-accent); outline-offset:2px; }
.chipOn { background:var(--MI_THEME-accent); border-color:var(--MI_THEME-accent); color:var(--MI_THEME-fgOnAccent); }
.warn { display:flex; align-items:flex-start; gap:6px; margin-top:8px; padding:8px 10px; border-radius:8px; background:var(--MI_THEME-infoWarnBg); color:var(--MI_THEME-infoWarnFg); font-size:.8rem; line-height:1.55; }
.warn > i { margin-top:3px; }
.link { color:var(--MI_THEME-link); }
/* 文言中の改行(\n)を段落の区切りとして表示する。 */
.lines { white-space:pre-line; }
.sel { background: var(--MI_THEME-bg); color: var(--MI_THEME-fg); border:1px solid var(--MI_THEME-divider); border-radius:8px; padding:6px 10px; font-family:inherit; }
.bgPicker { display:flex; gap:14px; flex-wrap:wrap; }
.bgOpt { width:48px; height:48px; border-radius:12px; cursor:pointer; border:2px solid transparent; transition:border-color .15s, transform .15s; }
.bgOpt:hover { transform:translateY(-2px); }
.bgOptOn { border-color: var(--MI_THEME-accent); }
.bgLabel { font-size:.72rem; opacity:.7; margin-top:4px; }
/* トグルスイッチ。見た目は24px、操作領域は44pxを確保する。 */
.sw { width:48px; height:44px; padding:0; background:transparent; border:0; border-radius:22px; cursor:pointer; position:relative; flex-shrink:0; }
.sw::before { content:''; position:absolute; width:44px; height:24px; top:10px; left:2px; box-sizing:border-box; background:var(--MI_THEME-divider); border:1px solid var(--MI_THEME-divider); border-radius:12px; transition:background .2s,border-color .2s; }
.sw::after { content:''; position:absolute; width:18px; height:18px; background:#fff; border-radius:50%; top:13px; left:5px; transition:left .2s cubic-bezier(0.34,1.56,0.64,1); box-shadow:0 1px 3px rgba(0,0,0,.2); }
.swOn::before { background:var(--MI_THEME-accent); border-color:var(--MI_THEME-accent); }
.swOn::after { left:25px; }
.sw:not(button) { cursor:default; }
.sw:focus-visible { outline:3px solid var(--MI_THEME-accent); outline-offset:2px; }
/* 旗鯖fork(#37): レートリミット表 */
.rlBox { background: var(--MI_THEME-bg); border:1px solid var(--MI_THEME-divider); border-radius:10px; padding:10px 14px; }
.rlTitle { font-size:.82rem; font-weight:700; margin-bottom:6px; opacity:.8; }
.rlTbl { width:100%; border-collapse:collapse; font-size:.82rem; }
.rlTbl th, .rlTbl td { padding:4px 8px; text-align:left; border-bottom:1px solid var(--MI_THEME-divider); }
.rlTbl thead th { opacity:.7; font-weight:600; }
.rlTbl tbody tr:last-child td { border-bottom:none; }

/* 旗鯖fork(v2): デザインテーマ */
.subLabel { font-size:.78rem; font-weight:700; opacity:.6; margin:14px 0 8px; }

/* デザインテーマ選択パネル */
.themePanel { display:flex; flex-direction:column; gap:14px; }
/* v2: テーマ選択カルーセル(左右スライド) */
.themeCarousel { display:flex; align-items:center; gap:6px; margin:2px 0; }
/* All cards share one grid cell: translated cards still reserve their content height. */
.carViewport { position:relative; flex:1; min-width:0; display:grid; grid-template-columns:minmax(0,1fr); align-items:start; justify-items:center; padding:8px; overflow:hidden; touch-action:pan-y; }
.carArrow { flex:0 0 auto; width:38px; height:38px; border-radius:999px; border:1px solid var(--MI_THEME-divider); background: var(--MI_THEME-buttonBg); color: var(--MI_THEME-fg); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:1.25rem; transition:all .15s; &:hover:not(:disabled){ background: var(--MI_THEME-buttonHoverBg); border-color: var(--MI_THEME-accent); } &:disabled{ opacity:.32; cursor:not-allowed; } }
.themeCard { grid-area:1 / 1; box-sizing:border-box; width:min(200px,100%); min-width:0; margin:0; display:flex; flex-direction:column; align-items:stretch; gap:6px; padding:10px 10px 12px; background: var(--MI_THEME-panel); border:2px solid var(--MI_THEME-divider); border-radius:14px; cursor:pointer; font-family:inherit; text-align:center; transition:transform .38s cubic-bezier(.4,0,.2,1), opacity .38s, filter .38s, border-color .2s; will-change:transform,opacity; }
.themeCardOn { border-color: var(--MI_THEME-accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--MI_THEME-accent) 22%, transparent); }
.carDots { display:flex; justify-content:center; flex-wrap:wrap; gap:0; margin-top:0; }
.carDot { width:44px; height:44px; display:grid; place-items:center; border-radius:999px; border:none; background:transparent; cursor:pointer; padding:0; }
.carDot::after { content:''; width:8px; height:8px; border-radius:999px; background:var(--MI_THEME-divider); transition:width .25s,background-color .25s; }
.carDotOn::after { background:var(--MI_THEME-accent); width:22px; }
.carDot:focus-visible, .themeCard:focus-visible { outline:3px solid var(--MI_THEME-accent); outline-offset:2px; }
.themeName { font-size:1.15rem; font-weight:800; margin-top:2px; }
.themeJp { font-size:.72rem; line-height:1.6; opacity:.65; white-space:pre-line; overflow-wrap:anywhere; }
.themeCheck { display:inline-flex; align-items:center; justify-content:center; gap:4px; font-size:.76rem; font-weight:700; opacity:.6; margin-top:2px; > i { font-size:1em; } }
.themeCheckOn { opacity:1; color: var(--MI_THEME-accent); }

@container (max-width:520px) {
	.themeCard { width:min(192px,100%); }
	.carArrow { width:34px; height:34px; }
}
@media (prefers-reduced-motion:reduce) {
	.themeCard, .carArrow, .carDot::after, .sw::before, .sw::after { transition:none; }
}
</style>
<style lang="scss" src="../components/hatask/hatask-themes.scss"></style>
