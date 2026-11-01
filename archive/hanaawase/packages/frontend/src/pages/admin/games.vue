<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps_m">
			<MkInfo>
				ここは管理者専用です。時刻はすべて日本標準時（JST）で入力します。保存内容と変更者はモデレーションログへ記録されます。
			</MkInfo>

			<section class="_panel gamePanel">
				<header class="gameHeader">
					<div>
						<div class="gameEyebrow">花常（hanaawase）</div>
						<h2 class="gameTitle">イベント開催設定</h2>
					</div>
					<span class="status" :class="`status_${eventStatus}`">{{ eventStatusLabel }}</span>
				</header>

				<div v-if="eventEntry && firstRun" class="_gaps_m gameBody">
					<div class="eventSummary">
						<strong>{{ eventEntry.title }}</strong>
						<span>ID: {{ eventEntry.id }} ／ 素材リビジョン: {{ eventEntry.rev }}</span>
					</div>

					<MkInfo warn>
						終了時刻を過ぎると新しいパズル開始はできなくなります。ただし、すでに遊んでいる盤面は途中で切断しません。
					</MkInfo>

					<div class="dateGrid">
						<MkInput v-model="startInput" type="datetime-local">
							<template #label>開催開始（JST）</template>
							<template #caption>この時刻からイベント入口を表示します。</template>
						</MkInput>
						<MkInput v-model="endInput" type="datetime-local">
							<template #label>開催終了（JST）</template>
							<template #caption>この時刻に新規受付を終了し、資料室へ切り替えます。</template>
						</MkInput>
					</div>

					<MkInput v-model="labelInput">
						<template #label>開催枠の名前</template>
						<template #caption>例: 初回、復刻1回目</template>
					</MkInput>

					<MkInfo v-if="validationError" warn>{{ validationError }}</MkInfo>

					<div class="actions">
						<MkButton primary :disabled="validationError != null" :wait="saving" @click="save">
							<i class="ti ti-device-floppy"></i> 開催設定を保存
						</MkButton>
						<MkButton danger :disabled="!canEndNow" :wait="saving" @click="endNow">
							<i class="ti ti-player-stop-filled"></i> 今すぐ開催終了
						</MkButton>
						<MkButton link to="/admin/modlog">
							<i class="ti ti-list-search"></i> 変更履歴を見る
						</MkButton>
					</div>

					<p v-if="!canEndNow" class="endHint">
						「今すぐ開催終了」は開催中だけ使えます。開催前は開始・終了時刻を編集して保存してください。
					</p>
				</div>

				<MkInfo v-else warn>
					管理対象の花常イベントが登録されていません。設定データを直接作らず、開発担当者へ連絡してください。
				</MkInfo>
			</section>

			<!--
			旗鯖fork: 花常のプレイ状況。⚠️**集計のみ**（利用者の裁定 2026-07-31）。
			⚠️個人を並べない。⚠️ここに「誰が」を足すと、①ランキング禁止に触れ、
			  ②どの物語を読んだかという閲覧履歴を個人と結びつけることになる。
			⚠️backend 側も userId を1度も読まない作りにしてある（stats.ts のコメント参照）。
			-->
			<section class="_panel gamePanel">
				<header class="gameHeader">
					<div>
						<div class="gameEyebrow">花常（hanaawase）</div>
						<h2 class="gameTitle">プレイ状況</h2>
					</div>
					<span class="status status_upcoming">集計のみ</span>
				</header>

				<div class="gameBody _gaps_s">
					<MkInfo>
						個人を特定できる情報は表示しません。⚠️人数と分布だけを出しています。
					</MkInfo>

					<div v-if="statsError" class="endHint">
						集計を取得できませんでした。時間をおいて開き直してください。
					</div>
					<template v-else-if="stats">
						<div class="statGrid">
							<div class="statCell"><dt>遊んだ人</dt><dd>{{ stats.players }}</dd></div>
							<div class="statCell"><dt>今日の盤面</dt><dd>{{ stats.dailyPlayers }}</dd></div>
							<div class="statCell"><dt>イベント参加</dt><dd>{{ stats.eventPlayers }}</dd></div>
							<div class="statCell"><dt>今日の盤面の延べ回数</dt><dd>{{ stats.dailyPlays }}</dd></div>
							<div class="statCell"><dt>最長の連続日数</dt><dd>{{ stats.dailyLongest }}</dd></div>
							<div class="statCell"><dt>星の合計（★1/★2/★3）</dt><dd>{{ stats.starTotals.join(' / ') }}</dd></div>
						</div>

						<div>
							<div class="statLabel">月ごとに到達した人数</div>
							<div class="statBars">
								<div v-for="(count, index) in stats.monthReach" :key="index" class="statBar">
									<span class="statBarLabel">{{ index + 1 }}月</span>
									<span class="statBarTrack"><span class="statBarFill" :style="{ width: barWidth(count) }"></span></span>
									<span class="statBarValue">{{ count }}</span>
								</div>
							</div>
						</div>

						<div>
							<div class="statLabel">読んだ場面の数（人数）</div>
							<div class="statBars">
								<div v-for="(count, index) in stats.storyBuckets" :key="index" class="statBar">
									<span class="statBarLabel">{{ STORY_BUCKET_LABELS[index] }}</span>
									<span class="statBarTrack"><span class="statBarFill" :style="{ width: barWidth(count) }"></span></span>
									<span class="statBarValue">{{ count }}</span>
								</div>
							</div>
						</div>
					</template>
					<div v-else class="endHint">読み込み中です。</div>
				</div>
			</section>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkInput from '@/components/MkInput.vue';
import { definePage } from '@/page.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { copyHanaawaseEventIndex } from './hanaawase-event-index.js';
import type { HanaawaseEventIndex } from './hanaawase-event-index.js';

defineOptions({
	name: 'AdminGames',
});

type ManagementApi = <T>(endpoint: string, data?: Record<string, unknown>) => Promise<T>;
const managementApi = misskeyApi as unknown as ManagementApi;

/*
旗鯖fork: プレイ状況（⚠️集計のみ）。
⚠️`await` で待たない。⚠️集計に失敗しても**イベント設定の画面は開けるようにする**
  （設定を触りたいときに、統計のせいで管理画面ごと開けないのが一番困る）。
*/
type HanaawaseStats = {
	players: number;
	dailyPlayers: number;
	eventPlayers: number;
	monthReach: number[];
	starTotals: number[];
	storyBuckets: number[];
	dailyPlays: number;
	dailyLongest: number;
};
const STORY_BUCKET_LABELS = ['読んでいない', '1〜9', '10〜29', '30〜59', '60以上'];
const stats = ref<HanaawaseStats | null>(null);
const statsError = ref(false);
/** ⚠️棒の幅は「その表の最大値」を基準にする。⚠️0除算しない。 */
function barWidth(count: number): string {
	const rows = stats.value;
	if (!rows) return '0%';
	const max = Math.max(1, ...rows.monthReach, ...rows.storyBuckets);
	return `${Math.round((count / max) * 100)}%`;
}

const eventIndex = ref(await managementApi<HanaawaseEventIndex>('admin/games/hanaawase/event-index'));
const eventEntry = computed(() => eventIndex.value.events.at(0));
const firstRun = computed(() => eventEntry.value?.runs.at(0));
const saving = ref(false);
const clock = ref(Date.now());
let clockTimer: number | undefined;

const jstParts = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Asia/Tokyo',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
});

function toJstInput(value: string | Date): string {
	const parts = jstParts.formatToParts(typeof value === 'string' ? new Date(value) : value);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? '';
	return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function fromJstInput(value: string): string {
	return `${value}:00+09:00`;
}

const startInput = ref(firstRun.value ? toJstInput(firstRun.value.start) : '');
const endInput = ref(firstRun.value ? toJstInput(firstRun.value.end) : '');
const labelInput = ref(firstRun.value?.label ?? '');

const validationError = computed(() => {
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startInput.value)
		|| !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(endInput.value)) {
		return '開始日時と終了日時を両方入力してください。';
	}
	if (labelInput.value.trim().length === 0) return '開催枠の名前を入力してください。';
	if (labelInput.value.length > 64) return '開催枠の名前は64文字以内にしてください。';
	if (Date.parse(fromJstInput(startInput.value)) >= Date.parse(fromJstInput(endInput.value))) {
		return '終了日時は開始日時より後にしてください。';
	}
	return null;
});

const eventStatus = computed<'upcoming' | 'active' | 'ended'>(() => {
	if (!firstRun.value) return 'ended';
	const now = clock.value;
	if (now < Date.parse(firstRun.value.start)) return 'upcoming';
	if (now < Date.parse(firstRun.value.end)) return 'active';
	return 'ended';
});

const eventStatusLabel = computed(() => ({
	upcoming: '開催前',
	active: '開催中',
	ended: '終了',
})[eventStatus.value]);

const canEndNow = computed(() => {
	if (!firstRun.value) return false;
	const now = clock.value;
	return Date.parse(firstRun.value.start) < now && now < Date.parse(firstRun.value.end);
});

function buildIndex(endOverride?: string): HanaawaseEventIndex | undefined {
	if (!eventEntry.value || !firstRun.value || validationError.value != null) return undefined;
	const next = copyHanaawaseEventIndex(eventIndex.value);
	const event = next.events.at(0);
	const run = event?.runs.at(0);
	if (!event || !run) return undefined;
	run.start = fromJstInput(startInput.value);
	run.end = endOverride ?? fromJstInput(endInput.value);
	run.label = labelInput.value.trim();
	event.archiveFrom = run.end;
	return next;
}

function syncInputs() {
	const run = eventIndex.value.events.at(0)?.runs.at(0);
	if (!run) return;
	startInput.value = toJstInput(run.start);
	endInput.value = toJstInput(run.end);
	labelInput.value = run.label;
}

async function persist(next: HanaawaseEventIndex, successMessage: string) {
	saving.value = true;
	try {
		eventIndex.value = await os.promiseDialog(managementApi<HanaawaseEventIndex>(
			'admin/games/hanaawase/update-event-index',
			{ eventIndex: next },
		));
		syncInputs();
		os.toast(successMessage, 'ti ti-circle-check');
	} catch {
		// エラー表示は promiseDialog が担当する。入力値は直せるよう保持する。
	} finally {
		saving.value = false;
	}
}

async function save() {
	const next = buildIndex();
	if (!next) return;
	await persist(next, '花常の開催設定を保存しました。');
}

async function endNow() {
	const savedRun = firstRun.value;
	if (!canEndNow.value || !savedRun) return;
	const { canceled } = await os.confirm({
		type: 'warning',
		title: '花常イベントを今すぐ終了しますか？',
		text: '新しいパズル開始を停止し、イベントを資料室へ移します。この操作と変更者は記録されます。',
	});
	if (canceled) return;

	const end = fromJstInput(toJstInput(new Date()));
	if (Date.parse(end) <= Date.parse(savedRun.start)) {
		await os.alert({
			type: 'error',
			text: '開始時刻より前には終了できません。',
		});
		return;
	}

	const next = copyHanaawaseEventIndex(eventIndex.value);
	const event = next.events.at(0);
	const run = event?.runs.at(0);
	if (!event || !run) return;
	run.end = end;
	event.archiveFrom = end;
	await persist(next, '花常イベントを終了しました。');
}

const headerActions = computed(() => []);
const headerTabs = computed(() => []);

onMounted(() => {
	// 旗鯖fork: ⚠️集計は後追いで取る。⚠️失敗しても画面は開いたままにする。
	managementApi<HanaawaseStats>('admin/games/hanaawase/stats')
		.then((res) => { stats.value = res; })
		.catch(() => { statsError.value = true; });

	clockTimer = window.setInterval(() => {
		clock.value = Date.now();
	}, 30_000);
});

onUnmounted(() => {
	if (clockTimer !== undefined) window.clearInterval(clockTimer);
});

definePage(() => ({
	title: 'ゲーム運営',
	icon: 'ti ti-device-gamepad-2',
}));
</script>

<style lang="scss" scoped>
/* 旗鯖fork: プレイ状況（集計のみ）。⚠️数字と棒だけ。個人を出す欄をここに足さないこと。 */
.statGrid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	gap: 10px;
}
.statCell {
	padding: 10px 12px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 8px;

	> dt {
		margin: 0 0 4px;
		font-size: 0.85em;
		opacity: 0.75;
	}
	> dd {
		margin: 0;
		font-size: 1.25em;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
}
.statLabel {
	margin: 4px 0 6px;
	font-size: 0.9em;
	opacity: 0.8;
}
.statBars {
	display: grid;
	gap: 4px;
}
.statBar {
	display: grid;
	grid-template-columns: 5em 1fr 3em;
	align-items: center;
	gap: 8px;
	font-size: 0.85em;
}
.statBarLabel { opacity: 0.75; }
.statBarTrack {
	height: 8px;
	border-radius: 999px;
	background: var(--MI_THEME-divider);
	overflow: hidden;
}
.statBarFill {
	display: block;
	height: 100%;
	border-radius: inherit;
	background: var(--MI_THEME-accent);
}
.statBarValue {
	text-align: right;
	font-variant-numeric: tabular-nums;
}

.gamePanel {
	padding: 24px;
	border-radius: var(--MI-radius);
}

.gameHeader,
.actions {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	flex-wrap: wrap;
}

.gameHeader {
	margin-bottom: 24px;
}

.gameEyebrow,
.eventSummary span,
.endHint {
	color: var(--MI_THEME-fgTransparentWeak);
	font-size: 0.85em;
}

.gameTitle {
	margin: 4px 0 0;
	font-size: 1.35em;
}

.gameBody {
	min-width: 0;
}

.eventSummary {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.dateGrid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
	gap: 16px;
}

.status {
	display: inline-flex;
	align-items: center;
	padding: 6px 12px;
	border-radius: 999px;
	font-weight: 700;
}

.status_upcoming {
	background: var(--MI_THEME-infoBg);
	color: var(--MI_THEME-infoFg);
}

.status_active {
	background: color-mix(in srgb, var(--MI_THEME-accent) 18%, transparent);
	color: var(--MI_THEME-accent);
}

.status_ended {
	background: var(--MI_THEME-buttonBg);
	color: var(--MI_THEME-fgTransparentWeak);
}

.actions {
	justify-content: flex-start;
}

.endHint {
	margin: -4px 0 0;
}
</style>
