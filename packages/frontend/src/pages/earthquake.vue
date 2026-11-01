<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(#34): 地震・津波情報メニュー。発表済みの地震情報(551)・津波予報(552)を表示する。
  出典: 気象庁 / P2P地震情報(P2PQuake) / Natural Earth(地図・PD)。緊急地震速報(EEW)は扱わない。
  - 同じ地震(第○報)は安定キーで自動集約し、最終報に近い情報を新しい順に表示する。
  - 左=日本地図 / 右=一覧 / 左上=津波 / 右上=付近の地震 / 上=直近地震の電光掲示板。
  - お住いの都道府県・取得間隔は端末ローカルのみ(サーバー非送信)。
-->
<template>
<MkStickyContainer :class="{ [$style.embedded]: embedded }">
	<template v-if="!embedded" #header><MkPageHeader :actions="headerActions" :title="'地震・津波情報'" :icon="'ti ti-activity'"/></template>
	<MkSpacer :contentMax="1100">
		<div :class="$style.dashCt">
		<div :class="$style.dash">
			<!-- 上: 直近地震の電光掲示板(最新地震が入れ替わったらフェードで差し替え) -->
			<MkEarthquakeTicker :class="$style.tickerSlot" :quakes="rawQuakes" :tsunami="tsunami" mode="full" :accessible="embedded"/>

			<!-- 左上: 津波情報(複数発表時は4行ずつページ送り) -->
			<section :class="[$style.cell, $style.cellTsunami]">
				<div :class="$style.cellHead">
					<i class="ti ti-wave-sine"></i> 津波情報
					<span v-if="tsunamiRows.length" :class="$style.tsunamiCount">{{ tsunamiRows.length }}地域</span>
				</div>
				<div v-if="tsunamiRows.length === 0" :class="$style.empty">現在、発表中の津波情報はありません。</div>
				<template v-else>
					<div :class="$style.tsunamiBox" :style="{ borderColor: tsunamiGradeColor(tsunamiMaxGrade) }">
						<div :class="$style.tsunamiHead" :style="{ background: tsunamiGradeColor(tsunamiMaxGrade) }">{{ tsunamiGradeLabel(tsunamiMaxGrade) }}</div>
						<div :class="$style.tsunamiBody">
							<div v-for="(area, i) in tsunamiPageRows" :key="i" :class="$style.tsunamiArea">
								<span :class="$style.tsunamiGrade" :style="{ color: tsunamiGradeColor(area.grade) }">{{ tsunamiGradeLabel(area.grade) }}</span>{{ area.name }}
							</div>
						</div>
					</div>
					<div v-if="tsunamiPageCount > 1" :class="$style.pager">
						<button :class="$style.pagerBtn" :disabled="tsunamiPage === 0" @click="tsunamiPage--"><i class="ti ti-chevron-left"></i></button>
						<span :class="$style.pagerInfo">{{ tsunamiPage + 1 }} / {{ tsunamiPageCount }}</span>
						<button :class="$style.pagerBtn" :disabled="tsunamiPage >= tsunamiPageCount - 1" @click="tsunamiPage++"><i class="ti ti-chevron-right"></i></button>
					</div>
				</template>
			</section>

			<!-- 右上: 付近の地震 -->
			<section :class="[$style.cell, $style.cellNearby]">
				<div :class="$style.cellHead"><i class="ti ti-map-pin"></i> 付近の地震<span v-if="myPref" :class="$style.prefTag">{{ myPref }}</span><button v-if="embedded" type="button" :class="[$style.headBtn, $style.settingsHeadBtn]" aria-label="地震情報の設定" title="設定" @click="openSettings"><i class="ti ti-settings" aria-hidden="true"></i></button></div>
				<div v-if="!myPref" :class="$style.notice">
					<p>歯車（右上）で<b>お住いの都道府県</b>を指定すると、付近の地震をここに表示します。</p>
					<MkButton small inline @click="openSettings"><i class="ti ti-settings"></i> 都道府県を設定</MkButton>
					<p :class="$style.privacy">※ お住いの都道府県は<b>この端末にのみ保存</b>され、サーバーには送信されません。</p>
				</div>
				<div v-else-if="nearbyQuakes.length === 0" :class="$style.empty">{{ myPref }}で最近観測された地震はありません。</div>
				<div v-for="q in nearbyQuakes" v-else :key="q._key" :class="$style.nearbyItem" @click="selectQuake(q)">
					<span :class="$style.miniBadge" :style="{ background: scaleToColor(maxScaleInPref(q, myPref)), color: scaleTextColor(maxScaleInPref(q, myPref)) }">{{ scaleToLabel(maxScaleInPref(q, myPref)) }}</span>
					<span :class="$style.nearbyInfo">
						<span :class="$style.nearbyHypo">{{ q.earthquake?.hypocenter?.name || '震源調査中' }}</span>
						<span :class="$style.nearbyTime">{{ q.earthquake?.time || q.time }}</span>
					</span>
				</div>
			</section>

			<!-- 左: 日本地図 -->
			<section :class="[$style.cell, $style.cellMap]">
				<!-- 旗鯖fork(#34): リアルタイム接続状況を左上に常時表示 -->
				<div :class="$style.connStatus">
					<span :class="[$style.connDot, streamConnected ? $style.connOn : $style.connOff]"></span>
					<span :class="$style.connLabel">{{ streamConnected ? 'リアルタイム接続中' : '再接続中…' }}</span>
					<span v-if="lastActivity" :class="$style.connMsg">{{ lastActivity.text }}<span :class="$style.connTime">{{ lastActivity.time }}</span></span>
				</div>
				<MkEarthquakeMap
					:quakes="mapQuakes" :tsunami="activeTsunami"
					:selectedId="selectedKey" :zoomQuake="selectedQuake" :defaultQuake="latestQuake"
					@select="onMapSelect" @resetZoom="resetSelection"
				/>
			</section>

			<!-- 右: 地震一覧 -->
			<section :class="[$style.cell, $style.cellList]">
				<div :class="$style.cellHead">
					<i class="ti ti-list"></i> 地震情報
					<span v-if="lastLoadedAt" :class="$style.lastUpdate">最終取得 {{ lastLoadedAt }}</span>
					<button :class="$style.headBtn" :disabled="loading" v-tooltip="'今すぐ更新'" @click="load"><i :class="['ti ti-refresh', loading ? $style.spin : '']"></i></button>
				</div>
				<div v-if="loading && quakes.length === 0" :class="$style.empty">読み込み中…</div>
				<div v-else-if="quakes.length === 0" :class="$style.empty">最近の地震情報はありません。</div>
				<TransitionGroup tag="div" :class="$style.list" name="hfEqList">
					<div
						v-for="q in quakes" :key="q._key"
						:ref="el => setItemRef(q._key, el)"
						:class="[$style.quake, { [$style.quakeSelected]: q._key === selectedKey }]"
						@click="selectQuake(q)"
					>
						<div :class="$style.quakeMain">
							<div :class="$style.scaleBadge" :style="{ background: scaleToColor(q.earthquake?.maxScale ?? -1), color: scaleTextColor(q.earthquake?.maxScale ?? -1) }">
								<span :class="$style.scaleLabel">震度</span>
								<span :class="$style.scaleNum">{{ scaleToLabel(q.earthquake?.maxScale ?? -1) }}</span>
							</div>
							<div :class="$style.quakeInfo">
								<div :class="$style.quakeHypo">{{ q.earthquake?.hypocenter?.name || '震源調査中' }}</div>
								<div :class="$style.quakeMeta">
									<span v-if="q.earthquake?.hypocenter?.magnitude != null && q.earthquake.hypocenter.magnitude >= 0">M{{ q.earthquake.hypocenter.magnitude }}</span>
									<span v-if="q.earthquake?.hypocenter?.depth != null && q.earthquake.hypocenter.depth >= 0">深さ {{ q.earthquake.hypocenter.depth }}km</span>
									<span :class="$style.issueType">{{ issueTypeLabel(q.issue?.type ?? '') }}</span>
									<span v-if="q._reportCount > 1" :class="$style.reportCount">{{ q._reportCount }}報</span>
								</div>
								<div :class="$style.quakeTime">{{ q.earthquake?.time || q.time }}</div>
								<div v-if="domesticTsunamiLabel(q.earthquake?.domesticTsunami ?? '')" :class="$style.domTsunami">
									<i class="ti ti-wave-sine"></i> {{ domesticTsunamiLabel(q.earthquake?.domesticTsunami ?? '') }}
								</div>
								<!-- 旗鯖fork: 選択中のみ、津波情報の発令有無を気象庁の定型文言で明記 -->
								<template v-if="q._key === selectedKey && tsunamiStatus(q)">
									<div v-if="tsunamiStatus(q)?.tone === 'ok'" :class="[$style.tsunamiNote, $style.tsunamiNote_ok]"><i class="ti ti-check"></i> {{ tsunamiStatus(q)?.text }}</div>
									<div v-else-if="tsunamiStatus(q)?.tone === 'warn'" :class="[$style.tsunamiNote, $style.tsunamiNote_warn]"><i class="ti ti-wave-sine"></i> {{ tsunamiStatus(q)?.text }}</div>
									<div v-else :class="[$style.tsunamiNote, $style.tsunamiNote_info]"><i class="ti ti-info-circle"></i> {{ tsunamiStatus(q)?.text }}</div>
								</template>
							</div>
						</div>
						<div v-if="(q._key === selectedKey) && groupedPoints(q).length" :class="$style.points">
							<div v-for="g in groupedPoints(q)" :key="g.scale" :class="$style.pointGroup">
								<span :class="$style.pointScale" :style="{ background: scaleToColor(g.scale), color: scaleTextColor(g.scale) }">震度{{ scaleToLabel(g.scale) }}</span>
								<span :class="$style.pointNames">{{ g.names.join('、') }}</span>
							</div>
						</div>
					</div>
				</TransitionGroup>
			</section>

			<!-- 出典 -->
			<div :class="$style.source">出典: 気象庁 / P2P地震情報（P2PQuake） / 地図: Natural Earth（PD）・国土数値情報（国土交通省）</div>
			<div :class="$style.disclaimer">※ インターネット経由のため、リアルタイム性・到達は保証されません。緊急地震速報(EEW)は扱っていません。</div>
		</div>
		</div>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, nextTick, watch } from 'vue';
import { definePage } from '@/page.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import * as os from '@/os.js';
import MkButton from '@/components/MkButton.vue';
import MkEarthquakeMap from '@/components/MkEarthquakeMap.vue';
import MkEarthquakeSettings from '@/components/MkEarthquakeSettings.vue';
import MkEarthquakePicker from '@/components/MkEarthquakePicker.vue';
import MkEarthquakeTicker from '@/components/MkEarthquakeTicker.vue';
import { useStream } from '@/stream.js';
import { earthquakePref, earthquakePollSec } from '@/utility/hatasaba-device-prefs.js';
import {
	scaleToLabel, scaleToColor, scaleTextColor,
	tsunamiGradeLabel, tsunamiGradeColor, issueTypeLabel, domesticTsunamiLabel,
	dedupeQuakes, quakeAffectsPref, maxScaleInPref, pruneOld,
} from '@/utility/earthquake.js';

withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });

const stream = useStream();
const rawQuakes = ref<any[]>([]);
const tsunami = ref<any[]>([]);
const loading = ref(true);
const selectedKey = ref<string | null>(null);
// ユーザーが明示的に選択 or 解除した後は、新着で勝手に上書きしない。
const userInteracted = ref(false);
const itemRefs = new Map<string, HTMLElement>();
let pollTimer = 0;
// 最終取得時刻(ヘッダー表示用)。
const lastLoadedAt = ref<string>('');

const myPref = computed(() => earthquakePref.value);

// 同じ地震(第○報)を1件にまとめた一覧(安定キー・新しい順)。
const quakes = computed(() => dedupeQuakes(rawQuakes.value));
const mapQuakes = computed(() => quakes.value.slice(0, 20));
const selectedQuake = computed(() => quakes.value.find(q => q._key === selectedKey.value) ?? null);
const latestQuake = computed(() => quakes.value[0] ?? null);

// 電光掲示板は MkEarthquakeTicker に共通化(generateTickerItems を内部で使用)。

// 付近の地震(自分の都道府県で震度観測・直近5件)。
const nearbyQuakes = computed(() => {
	if (!myPref.value) return [];
	return quakes.value.filter(q => quakeAffectsPref(q, myPref.value)).slice(0, 5);
});

async function load() {
	try {
		const [eq, ts] = await Promise.all([
			misskeyApi('hata/earthquake/history', { limit: 40 }),
			misskeyApi('hata/earthquake/tsunami', { limit: 10 }),
		]);
		// 1日以上前のものは保持しない(キャッシュ肥大化防止)。
		rawQuakes.value = pruneOld((eq as any[]) ?? []);
		tsunami.value = pruneOld((ts as any[]) ?? []);
		lastLoadedAt.value = new Date().toLocaleTimeString('ja-JP');
		setActivity('データを更新しました');
	} catch { /* 取得失敗時は既存表示を維持 */ } finally {
		loading.value = false;
	}
}

// ===== リアルタイム接続状況の表示 =====
const streamConnected = ref(stream.state === 'connected');
const lastActivity = ref<{ text: string; time: string } | null>(null);
function setActivity(text: string) {
	lastActivity.value = { text, time: new Date().toLocaleTimeString('ja-JP') };
}
function onStreamConnected() { streamConnected.value = true; }
function onStreamDisconnected() { streamConnected.value = false; }

// 津波予報(552)は毎回その時点の全状態スナップショット。最新レコードだけ見て、
//   解除済み(cancelled)・エリア無しなら何も表示しない(古い発表レコードが残って出続けるのを防ぐ)。
const activeTsunami = computed(() => {
	const list = tsunami.value.filter(t => t && Array.isArray(t.areas));
	if (list.length === 0) return [];
	const latest = [...list].sort((a, b) => String(b.time ?? '').localeCompare(String(a.time ?? '')))[0];
	return (latest && latest.cancelled !== true && (latest.areas?.length ?? 0) > 0) ? [latest] : [];
});

const GRADE_ORDER: Record<string, number> = { MajorWarning: 3, Warning: 2, Watch: 1, Unknown: 0 };

// 津波予報の全予報区を1リストに集約し、段階の強い順に並べる(4行ずつページ送り)。
const TSUNAMI_PER_PAGE = 4;
const tsunamiPage = ref(0);
const tsunamiRows = computed<{ grade: string; name: string }[]>(() => {
	const rows: { grade: string; name: string }[] = [];
	for (const t of activeTsunami.value) {
		for (const a of (t.areas ?? [])) rows.push({ grade: a.grade, name: a.name });
	}
	rows.sort((a, b) => (GRADE_ORDER[b.grade] ?? 0) - (GRADE_ORDER[a.grade] ?? 0));
	return rows;
});
const tsunamiMaxGrade = computed(() => tsunamiRows.value[0]?.grade ?? 'Watch');
const tsunamiPageCount = computed(() => Math.max(1, Math.ceil(tsunamiRows.value.length / TSUNAMI_PER_PAGE)));
const tsunamiPageRows = computed(() => tsunamiRows.value.slice(tsunamiPage.value * TSUNAMI_PER_PAGE, tsunamiPage.value * TSUNAMI_PER_PAGE + TSUNAMI_PER_PAGE));
watch(tsunamiPageCount, (n) => { if (tsunamiPage.value >= n) tsunamiPage.value = Math.max(0, n - 1); });

// 旗鯖fork: その地震に伴う津波情報の状態を、気象庁が発表する定型文言に合わせて返す。
//   電文の文言を改変せず、そのまま伝達するため(気象業務法23条の独自警報リスク回避)。
//   text=表示文 / tone=色味('warn'は注意/警報・'info'は調査中等・'ok'は心配なし)。
//   注意: 地震情報(551)の domesticTsunami は気象庁が津波情報の発表に動いた段階で
//     'Watch'/'Warning' になるが、実際の津波予報(552)電文がまだ届いていないことがある。
//     この場合「警報が発表されました」と先走って表示すると、ユーザーに「どこ？」「いつ？」と
//     誤解を与え情報の不正確さに繋がるため、552が届くまでは「確認中」を表示する。
function tsunamiStatus(q: any): { text: string; tone: 'warn' | 'info' | 'ok' } | null {
	const v = q?.earthquake?.domesticTsunami;
	switch (v) {
		case 'Warning':
		case 'Watch': {
			// P2PQuakeの仕様: Watch=津波注意報 / Warning=津波予報(種類不明)。
			//   ※ Warning は警報と断定できないため、独自警報化を避けるため「津波情報」と汎用表記する。
			// 詳細電文(552)が届いていれば、その areas[].grade から実際の最大区分(大津波警報/警報/注意報)を表示する。
			const eqTime = Date.parse(q.earthquake?.time ?? '') || 0;
			const matched = tsunami.value.find(t => {
				if (!t || t.cancelled === true) return false;
				const tt = Date.parse(t.time ?? t.issue?.time ?? '') || 0;
				return tt >= eqTime - 60_000;
			});
			if (matched && Array.isArray(matched.areas) && matched.areas.length > 0) {
				const order: Record<string, number> = { MajorWarning: 3, Warning: 2, Watch: 1 };
				let maxGrade = 'Watch'; let mn = -1;
				for (const a of matched.areas) {
					const n = order[a.grade] ?? 0;
					if (n > mn) { mn = n; maxGrade = a.grade; }
				}
				const label = maxGrade === 'MajorWarning' ? '大津波警報' : (maxGrade === 'Warning' ? '津波警報' : '津波注意報');
				return { text: `この地震で${label}が発表されました。`, tone: 'warn' };
			}
			// 詳細電文未着: Watchなら「津波注意報」と確定可、Warningは種別不明のため汎用の「津波情報」。
			const label = v === 'Watch' ? '津波注意報' : '津波情報';
			return { text: `この地震で${label}が発表されました。対象地域の詳細を確認中です。`, tone: 'warn' };
		}
		case 'Checking': return { text: '津波の有無について現在調査中です。', tone: 'info' };
		case 'NonEffective': return { text: '若干の海面変動があるかもしれませんが、被害の心配はありません。', tone: 'info' };
		case 'None': return { text: 'この地震による津波の心配はありません。', tone: 'ok' };
		case 'Unknown':
		default: return null; // 不明は表示しない(誤情報を出さない)
	}
}

function groupedPoints(q: any): { scale: number; names: string[] }[] {
	const map = new Map<number, string[]>();
	for (const p of (q.points ?? [])) {
		if (typeof p.scale !== 'number' || p.scale < 10) continue;
		const arr = map.get(p.scale) ?? [];
		arr.push(p.addr ?? p.pref ?? '');
		map.set(p.scale, arr);
	}
	return [...map.entries()].map(([scale, names]) => ({ scale, names: names.filter(Boolean) })).sort((a, b) => b.scale - a.scale);
}

function setItemRef(key: string, el: any) {
	if (el) itemRefs.set(key, el as HTMLElement);
	else itemRefs.delete(key);
}

function selectQuake(q: any) {
	userInteracted.value = true;
	// 既に選択中のものを再度クリックしたら折りたたむ(選択解除＝地図も全国へ戻す)。
	if (selectedKey.value === q._key) {
		selectedKey.value = null;
		return;
	}
	selectedKey.value = q._key;
	nextTick(() => { itemRefs.get(q._key)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
}
function onMapSelect(key: string) {
	const q = quakes.value.find(x => x._key === key);
	if (!q) return;
	// 同じ地点(近接)で複数の地震がある場合は、どの地震かを選べるメニューを出す。
	const h = q.earthquake?.hypocenter;
	const near = (h && typeof h.latitude === 'number')
		? quakes.value.filter(x => {
			const hh = x.earthquake?.hypocenter;
			return hh && typeof hh.latitude === 'number'
				&& Math.abs(hh.latitude - h.latitude) < 0.35 && Math.abs(hh.longitude - h.longitude) < 0.35;
		})
		: [q];
	if (near.length > 1) {
		const { dispose } = os.popup(MkEarthquakePicker, { quakes: near }, {
			pick: (key: string) => { const x = quakes.value.find(z => z._key === key); if (x) selectQuake(x); },
			closed: () => dispose(),
		});
	} else {
		selectQuake(q);
	}
}
function resetSelection() {
	selectedKey.value = null;
	// 「全国」ボタンで戻したら自動追従モードに戻す(新着で最新地震を再度自動展開)。
	userInteracted.value = false;
}

// 旗鯖fork: ユーザーが操作する前 or 全国に戻した後は、最新地震を自動で選択して詳細展開＋地図ズーム。
watch(latestQuake, (q) => {
	if (userInteracted.value) return;
	if (q && selectedKey.value !== q._key) selectedKey.value = q._key;
}, { immediate: true });

function openSettings() {
	const { dispose } = os.popup(MkEarthquakeSettings, {}, { closed: () => dispose() });
}

const headerActions = computed(() => [
	{ icon: 'ti ti-settings', text: '設定', handler: openSettings },
	{ icon: 'ti ti-refresh', text: '更新', handler: () => { load(); } },
]);

function startPolling() {
	if (pollTimer) window.clearInterval(pollTimer);
	pollTimer = window.setInterval(load, Math.max(5, earthquakePollSec.value) * 1000);
}
watch(earthquakePollSec, startPolling);

// 旗鯖fork(#34): サーバーWS→ストリーミングで新着を即時反映(ポーリングはフォールバック)。
function onEqEvent(ev: { code: number; item: any }) {
	if (ev.code === 551) rawQuakes.value = pruneOld([ev.item, ...rawQuakes.value]).slice(0, 60);
	else if (ev.code === 552) tsunami.value = pruneOld([ev.item, ...tsunami.value]).slice(0, 20);
	setActivity(ev.code === 552 ? '津波情報を受信しました' : 'データを受信しました');
}

onMounted(() => {
	load();
	startPolling();
	stream.on('earthquakeEvent', onEqEvent);
	stream.on('_connected_', onStreamConnected);
	stream.on('_disconnected_', onStreamDisconnected);
});
onUnmounted(() => {
	if (pollTimer) window.clearInterval(pollTimer);
	stream.off('earthquakeEvent', onEqEvent);
	stream.off('_connected_', onStreamConnected);
	stream.off('_disconnected_', onStreamDisconnected);
});

definePage(() => ({ title: '地震・津波情報', icon: 'ti ti-activity' }));
</script>

<style lang="scss" module>
/* ウィンドウ表示など、ビューポートでなく実際の幅で折り返すためコンテナクエリを使う */
.dashCt { container-type: inline-size; }
.dash {
	display: grid;
	grid-template-columns: 1fr 1fr;
	grid-template-areas: "ticker ticker" "tsunami nearby" "map list" "source source" "disclaimer disclaimer";
	gap: 12px;
}
@container (max-width: 850px) {
	.dash { grid-template-columns: 1fr; grid-template-areas: "ticker" "tsunami" "nearby" "map" "list" "source" "disclaimer"; gap: 10px; }
}

/* 電光掲示板 */
/* 共通電光掲示板(MkEarthquakeTicker)を grid-area: ticker にマップ */
.tickerSlot { grid-area: ticker; }

.cellTsunami { grid-area: tsunami; }
.cellNearby { grid-area: nearby; }
/* 旗鯖fork: PC表示で地図がスクロールせず全体収まるよう、ビューポート高さに合わせる(min-heightを固定しすぎない)。 */
.cellMap { grid-area: map; height: clamp(360px, 62dvh, 720px); padding: 6px; position: relative; }

/* リアルタイム接続状況(地図左上・常時表示) */
.connStatus {
	position: absolute; top: 10px; left: 10px; z-index: 5; pointer-events: none;
	display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
	background: color-mix(in srgb, var(--MI_THEME-panel) 72%, transparent);
	border: 1px solid color-mix(in srgb, var(--MI_THEME-fg) 8%, transparent); border-radius: 999px;
	padding: 4px 11px; font-size: .72em; max-width: calc(100% - 20px);
	backdrop-filter: blur(8px); box-shadow: 0 2px 8px rgba(0,0,0,.06);
}
.connDot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.connOn { background: #22c55e; box-shadow: 0 0 5px #22c55e; animation: hataEqPulse 2s ease-in-out infinite; }
.connOff { background: #ef4444; }
@keyframes hataEqPulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
.connLabel { font-weight: 700; }
.connMsg { opacity: .75; }
.connTime { margin-left: 5px; opacity: .8; font-variant-numeric: tabular-nums; }
/* (.cellListの高さは下方で再定義) */
.source { grid-area: source; text-align: center; font-size: .76em; opacity: .55; padding: 4px 0 2px; }
.disclaimer { grid-area: disclaimer; text-align: center; font-size: .72em; opacity: .5; padding: 0 8px 4px; line-height: 1.5; }
@container (max-width: 850px) { .cellMap { height: clamp(280px, 50dvh, 500px); } }

.cell { background: var(--MI_THEME-panel); border: 1px solid color-mix(in srgb, var(--MI_THEME-fg) 7%, transparent); border-radius: 14px; padding: 14px 16px; box-shadow: 0 1px 2px rgba(0,0,0,.03); }
.cellHead { font-weight: 700; font-size: .82em; margin-bottom: 11px; display: flex; align-items: center; gap: 7px; letter-spacing: .03em; opacity: .9; }
.lastUpdate { margin-left: auto; font-size: .85em; font-weight: 600; opacity: .55; font-variant-numeric: tabular-nums; }
.headBtn { width: 26px; height: 26px; border-radius: 7px; border: none; background: transparent; color: var(--MI_THEME-fg); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 1em; }
.settingsHeadBtn { margin-left: auto; }
.headBtn:hover:not(:disabled) { background: var(--MI_THEME-buttonHoverBg); color: var(--MI_THEME-accent); }
.headBtn:disabled { opacity: .4; cursor: default; }
.spin { animation: hataEqSpin .9s linear infinite; }
@keyframes hataEqSpin { to { transform: rotate(360deg); } }
.cellHead > i:first-child { color: var(--MI_THEME-accent); font-size: 1.05em; }
.prefTag { margin-left: auto; font-size: .82em; font-weight: 700; background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); padding: 1px 9px; border-radius: 999px; letter-spacing: 0; }
.empty { opacity: .5; font-size: .86em; padding: 10px 0; text-align: center; }

.notice p { margin: 0 0 8px; font-size: .88em; }
.privacy { opacity: .7; font-size: .8em !important; }

.tsunamiCount { margin-left: auto; font-size: .8em; font-weight: 700; opacity: .6; }
.pager { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 8px; }
.pagerBtn { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--MI_THEME-divider); background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.pagerBtn:hover:not(:disabled) { background: var(--MI_THEME-buttonHoverBg); }
.pagerBtn:disabled { opacity: .35; cursor: default; }
.pagerInfo { font-size: .85em; font-weight: 700; min-width: 48px; text-align: center; }
.tsunamiBox { border: 2px solid; border-radius: 10px; overflow: hidden; margin-bottom: 8px; }
.tsunamiHead { color: #fff; font-weight: 800; padding: 5px 12px; text-shadow: 0 1px 2px rgba(0,0,0,.25); }
.tsunamiBody { padding: 6px 12px; display: flex; flex-direction: column; gap: 3px; }
.tsunamiArea { font-size: .86em; }
.tsunamiGrade { font-weight: 700; margin-right: 6px; }

.nearbyItem { display: flex; gap: 10px; align-items: center; padding: 6px 4px; border-radius: 8px; cursor: pointer; }
.nearbyItem:hover { background: var(--MI_THEME-buttonHoverBg); }
.miniBadge { flex-shrink: 0; width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: .95em; box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.nearbyInfo { display: flex; flex-direction: column; min-width: 0; }
.nearbyHypo { font-weight: 700; font-size: .9em; }
.nearbyTime { font-size: .76em; opacity: .6; }

/* 地図と縦並びを揃えるため一覧も同じ高さに合わせて、内側でスクロール。 */
.cellList { grid-area: list; display: flex; flex-direction: column; height: clamp(360px, 62dvh, 720px); }
.list { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 7px; overflow-y: auto; scrollbar-width: thin; padding-right: 2px; }
@container (max-width: 850px) { .cellList { height: auto; } .list { max-height: none; } }
.quake { background: var(--MI_THEME-bg); border: 1px solid color-mix(in srgb, var(--MI_THEME-fg) 6%, transparent); border-radius: 12px; padding: 11px 13px; cursor: pointer; transition: transform .15s, box-shadow .15s, border-color .15s, background .15s; }
.quake:hover { border-color: color-mix(in srgb, var(--MI_THEME-accent) 55%, transparent); transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,.06); }
.quakeSelected { border-color: var(--MI_THEME-accent); background: var(--MI_THEME-accentedBg); }
.quakeMain { display: flex; gap: 12px; align-items: center; }
.scaleBadge { flex-shrink: 0; width: 52px; height: 52px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; box-shadow: 0 1px 4px rgba(0,0,0,.18); }
.scaleLabel { font-size: .6em; font-weight: 700; opacity: .9; }
.scaleNum { font-size: 1.5em; font-weight: 900; }
.quakeInfo { min-width: 0; flex: 1; }
.quakeHypo { font-weight: 800; font-size: 1.02em; }
.quakeMeta { display: flex; gap: 10px; flex-wrap: wrap; font-size: .82em; margin-top: 2px; opacity: .85; }
.issueType { opacity: .7; }
.reportCount { background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); padding: 0 6px; border-radius: 6px; font-weight: 700; }
.quakeTime { font-size: .78em; opacity: .6; margin-top: 2px; }
.domTsunami { font-size: .8em; color: var(--MI_THEME-warn); font-weight: 700; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; }
.tsunamiNote { display: inline-flex; align-items: center; gap: 5px; margin-top: 6px; padding: 4px 10px; border-radius: 8px; font-size: .78em; font-weight: 700; }
.tsunamiNote_ok { background: color-mix(in srgb, var(--MI_THEME-success, #22c55e) 14%, transparent); color: var(--MI_THEME-success, #16a34a); }
.tsunamiNote_warn { background: color-mix(in srgb, var(--MI_THEME-warn, #f59e0b) 18%, transparent); color: var(--MI_THEME-warn, #d97706); }
.tsunamiNote_info { background: color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent); color: var(--MI_THEME-accent); }

.points { margin-top: 10px; border-top: 1px solid var(--MI_THEME-divider); padding-top: 8px; }
.pointGroup { display: flex; gap: 8px; align-items: flex-start; margin-top: 6px; font-size: .84em; }
.pointScale { flex-shrink: 0; padding: 1px 8px; border-radius: 6px; font-weight: 700; font-size: .92em; }
.pointNames { line-height: 1.5; }

@container (max-width: 850px) {
	.cell { padding: 10px 12px; }
	.scaleBadge { width: 46px; height: 46px; }
	.scaleNum { font-size: 1.3em; }
}
/* HataGoes earthquake keeps the original bulletin values and alert colors. */
.embedded {
	--MI_THEME-bg: #fff;
	--MI_THEME-panel: #fff;
	--MI_THEME-fg: #111;
	--MI_THEME-divider: #111;
	--MI_THEME-accent: #111;
	--MI_THEME-accentedBg: #eee;
	--MI_THEME-buttonBg: #eee;
	--MI_THEME-buttonHoverBg: #eee;
	background: #fff;
	color: #111;
	font-size: 15px;
	font-weight: 700;
	font-variant-numeric: tabular-nums;
	.cell, .quake { border: 2px solid #111; box-shadow: none; }
	.quakeSelected { background: #eee; }
	.cellHead, .quakeMeta, .quakeTime, .nearbyTime, .source, .disclaimer,
	.pointGroup, .pointScale, .empty, .tsunamiArea, .tsunamiNote, .domTsunami,
	.connStatus, .pagerInfo, .tsunamiCount, .prefTag, .lastUpdate, .reportCount,
	.notice p, .privacy, .scaleLabel { font-size: 15px !important; opacity: 1; }
	.cellHead > i:first-child { color: #111; }
	.quakeHypo, .nearbyHypo { font-size: 18px; }
	.scaleNum, .miniBadge { font-size: 30px; }
	.scaleBadge { min-width: 64px; min-height: 64px; }
	.miniBadge { min-width: 48px; min-height: 48px; }
	.connStatus { background: #fff; border: 2px solid #111; backdrop-filter: none; box-shadow: none; }
	.connMsg, .connTime, .issueType { opacity: 1; }
	.source, .disclaimer { line-height: 1.7; }
}

</style>

<style lang="scss">
/* 旗鯖fork(#34): 電光掲示板・一覧のフェード入れ替え(グローバル遷移クラス) */
.hfEqFade-enter-active, .hfEqFade-leave-active { transition: opacity .35s ease; }
.hfEqFade-enter-from, .hfEqFade-leave-to { opacity: 0; }
.hfEqList-move, .hfEqList-enter-active, .hfEqList-leave-active { transition: opacity .35s ease, transform .35s ease; }
.hfEqList-enter-from, .hfEqList-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
