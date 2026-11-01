<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(Hatady P7): 学習目標(短期/長期)の管理(モーダル)。
  期限(任意)・達成指標(学習時間/記録数/読了数、任意)を設定でき、指標は自動で進捗集計する。
  一覧は hata/hatady/goals、作成/更新/削除は goals/create・update・delete。
-->
<template>
<HyDialog ref="dialog" :title="copy.title" @close="dialog?.close()" @closed="emit('closed')">
	<div class="hatady-scope" :data-hatady-theme="theme" :class="$style.body">
		<!-- ===== 一覧モード ===== -->
		<template v-if="true">
			<button :class="$style.addBtn" @click="openCreate">
				<i class="ti ti-plus"></i>
				{{ copy.add }}
			</button>

			<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
			<div v-if="loading" :class="$style.loading">{{ copy.loading }}</div>
			<div v-else-if="goals.length === 0" :class="$style.empty">
				<i class="ti ti-target-arrow" :class="$style.emptyIcon"></i>
				<div>{{ copy.emptyTitle }}</div>
				<div :class="$style.emptySub">{{ copy.emptyDescription }}</div>
			</div>
			<template v-else>
				<div v-for="term in ['short', 'long'] as const" :key="term">
					<template v-if="goalsByTerm(term).length">
						<div :class="$style.termHead">
							<i :class="['ti', term === 'short' ? 'ti-bolt' : 'ti-mountain']"></i>
							{{ termLabel(term) }}
						</div>
						<div v-for="g in goalsByTerm(term)" :key="g.id" :class="[$style.goalCard, g.done && $style.goalDone]">
							<div :class="$style.goalTop">
								<button
									:class="[$style.checkBtn, g.done && $style.checkOn]"
									:title="copy.toggleDone"
									@click="toggleDone(g)"
								>
									<i :class="['ti', g.done ? 'ti-circle-check-filled' : 'ti-circle']"></i>
								</button>
								<div :class="$style.goalTitleWrap">
									<div :class="$style.goalTitle">{{ g.title }}</div>
									<div v-if="g.description" :class="$style.goalDesc">{{ g.description }}</div>
								</div>
								<button :class="$style.menuBtn" @click="openMenu(g, $event)"><i class="ti ti-dots"></i></button>
							</div>

							<!-- 指標進捗 -->
							<div v-if="g.metricType && g.progress.target != null" :class="$style.progWrap">
								<div :class="$style.progTrack">
									<div :class="$style.progFill" :style="{ width: (g.progress.percent ?? 0) + '%' }"></div>
								</div>
								<div :class="$style.progText">
									<span>
										{{ fmtMetric(g.metricType, g.progress.current) }} /
										{{ fmtMetric(g.metricType, g.progress.target) }}
									</span>
									<span :class="$style.progPct">{{ g.progress.percent ?? 0 }}%</span>
								</div>
							</div>

							<!-- 期限 -->
							<div :class="$style.goalMeta">
								<span v-if="g.targetDate" :class="[$style.due, dueClass(g)]">
									<i class="ti ti-calendar"></i>
									{{ fmtDate(g.targetDate) }}
									<template v-if="!g.done">· {{ dueLabel(g) }}</template>
								</span>
								<span v-else :class="$style.due">
									<i class="ti ti-infinity"></i>
									{{ copy.noDeadline }}
								</span>
								<span v-if="g.done" :class="$style.doneTag">
									<i class="ti ti-check"></i>
									{{ copy.achieved }}
								</span>
							</div>
						</div>
					</template>
				</div>
			</template>
		</template>
	</div>
</HyDialog>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import HyDialog from '@/components/HyDialog.vue';
import { i18n } from '@/i18n.js';
import { hatadyTheme } from '@/utility/hatady-prefs.js';
import { versatileLang } from '@/utility/intl-const.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hatadyDuration } from '@/utility/hatady-ui.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { useHataGoesPopup, useHataGoesPopupMenu } from '@/utility/hatagoes-popup.js';

const dialogs = useHataGoesDialogs();
const popup = useHataGoesPopup();
const popupMenu = useHataGoesPopupMenu();

const emit = defineEmits<{ (ev: 'closed'): void; (ev: 'changed'): void }>();
const dialog = ref<any>(null);
const theme = hatadyTheme;
const copy = i18n.ts._hata._hatady._goals;
const dateFormatter = new Intl.DateTimeFormat(versatileLang, { year: 'numeric', month: 'short', day: 'numeric' });

type Goal = {
	id: string;
	title: string;
	description: string | null;
	termType: 'short' | 'long';
	targetDate: string | null;
	metricType: 'minutes' | 'logs' | 'books' | null;
	metricTarget: number | null;
	done: boolean;
	doneAt: string | null;
	createdAt: string;
	progress: { current: number; target: number | null; percent: number | null };
};

const loading = ref(true);
const error = ref('');
const goals = ref<Goal[]>([]);

async function load() {
	loading.value = true;
	try {
		goals.value = await misskeyApi('hata/hatady/goals', {});
		error.value = '';
	} catch {
		error.value = copy.loadFailed;
	} finally {
		loading.value = false;
	}
}

load();

function goalsByTerm(term: 'short' | 'long'): Goal[] {
	return goals.value.filter((g) => g.termType === term);
}

function termLabel(term: 'short' | 'long'): string {
	return term === 'short' ? copy.shortTerm : copy.longTerm;
}

function openCreate() {
	openEditor();
}

function openEdit(g: Goal) {
	openEditor(g);
}

async function openEditor(goal?: Goal) {
	const { dispose } = popup(
		(await import('@/components/HatadyGoalEditor.vue')).default,
		{ goal },
		{
			done: async () => {
				await load();
				emit('changed');
			},
			closed: () => dispose(),
		},
	);
}

function openMenu(g: Goal, ev: MouseEvent) {
	popupMenu(
		[
			{ text: copy.edit, icon: 'ti ti-pencil', action: () => openEdit(g) },
			{ text: copy.delete, icon: 'ti ti-trash', danger: true, action: () => remove(g) },
		],
		(ev.currentTarget ?? ev.target) as HTMLElement,
	);
}

async function toggleDone(g: Goal) {
	// 指標つき目標は自動判定のため、手動切替は指標なし目標を主対象にするが、どちらも許可(手動オーバーライド)。
	try {
		await misskeyApi('hata/hatady/goals/update', { goalId: g.id, done: !g.done });
		await load();
		emit('changed');
	} catch {
		dialogs.alert({ type: 'error', text: copy.saveFailed });
	}
}

async function remove(g: Goal) {
	const { canceled } = await dialogs.confirm({
		type: 'warning',
		text: i18n.tsx._hata._hatady._goals.confirmDelete({ title: g.title }),
	});
	if (canceled) return;
	try {
		await misskeyApi('hata/hatady/goals/delete', { goalId: g.id });
		await load();
		emit('changed');
	} catch {
		dialogs.alert({ type: 'error', text: copy.saveFailed });
	}
}

function fmtDate(iso: string): string {
	return dateFormatter.format(new Date(iso));
}

function daysLeft(iso: string): number {
	const target = new Date(iso);
	target.setHours(23, 59, 59, 999);
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function dueClass(g: Goal): string {
	if (g.done || !g.targetDate) return '';
	const dl = daysLeft(g.targetDate);
	if (dl < 0) return 'dueOver';
	if (dl <= 3) return 'dueSoon';
	return '';
}

function dueLabel(g: Goal): string {
	if (!g.targetDate) return '';
	const dl = daysLeft(g.targetDate);
	if (dl < 0) return i18n.tsx._hata._hatady._goals.overdue({ days: (-dl).toString() });
	if (dl === 0) return copy.dueToday;
	return i18n.tsx._hata._hatady._goals.daysLeft({ days: dl.toString() });
}

function fmtMetric(m: string | null, v: number): string {
	if (m === 'minutes') {
		return hatadyDuration(Math.round(v * 60));
	}
	if (m === 'logs') return i18n.tsx._hata._hatady._goals.logCount({ count: v.toString() });
	if (m === 'books') return i18n.tsx._hata._hatady._goals.bookCount({ count: v.toString() });
	return v.toString();
}
</script>

<style lang="scss" module>
.body {
	padding: 18px 20px 22px;
	background: var(--hy-bg);
	color: var(--hy-body);
	font-family: 'Noto Sans JP', 'Hiragino Sans', system-ui, sans-serif;
	min-height: 100%;
	box-sizing: border-box;
}
.loading {
	text-align: center;
	color: var(--hy-muted);
	padding: 40px 0;
	font-size: 13px;
}

/* 追加ボタン */
.addBtn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	width: 100%;
	background: var(--hy-accent);
	color: #fff;
	border: none;
	border-radius: 11px;
	padding: 11px;
	font-size: 13px;
	font-weight: 800;
	cursor: pointer;
	font-family: var(--hy-heading);
	margin-bottom: 16px;
}
.addBtn:hover {
	filter: brightness(1.05);
}

/* 空 */
.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	color: var(--hy-muted);
	padding: 30px 10px;
}
.emptyIcon {
	font-size: 34px;
	opacity: 0.5;
	margin-bottom: 10px;
}
.emptySub {
	font-size: 12px;
	margin-top: 6px;
}

/* 種別見出し */
.termHead {
	display: flex;
	align-items: center;
	gap: 6px;
	font-family: var(--hy-heading);
	font-weight: 800;
	font-size: 12.5px;
	color: var(--hy-ink);
	margin: 6px 0 10px;
}
.termHead i {
	color: var(--hy-accent);
}

/* 目標カード */
.goalCard {
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 13px;
	padding: 13px 14px;
	margin-bottom: 10px;
}
.goalDone {
	opacity: 0.72;
}
.goalTop {
	display: flex;
	align-items: flex-start;
	gap: 10px;
}
.checkBtn {
	flex-shrink: 0;
	border: none;
	background: none;
	color: var(--hy-muted);
	font-size: 22px;
	cursor: pointer;
	line-height: 1;
	padding: 0;
	margin-top: 1px;
}
.checkOn {
	color: #5a9a5a;
}
.goalTitleWrap {
	flex: 1;
	min-width: 0;
}
.goalTitle {
	font-family: var(--hy-heading);
	font-weight: 800;
	font-size: 14.5px;
	color: var(--hy-ink);
}
.goalDone .goalTitle {
	text-decoration: line-through;
}
.goalDesc {
	font-size: 11.5px;
	color: var(--hy-muted);
	margin-top: 2px;
	white-space: pre-wrap;
}
.menuBtn {
	flex-shrink: 0;
	border: none;
	background: none;
	color: var(--hy-muted);
	cursor: pointer;
	padding: 2px 4px;
	font-size: 16px;
}

/* 進捗 */
.progWrap {
	margin-top: 11px;
}
.progTrack {
	height: 9px;
	border-radius: 999px;
	background: var(--hy-border);
	overflow: hidden;
}
.progFill {
	height: 100%;
	border-radius: 999px;
	background: linear-gradient(90deg, #f0b46a, #d9824a);
	transition: width 0.5s cubic-bezier(0.34, 1.2, 0.64, 1);
}
.progText {
	display: flex;
	justify-content: space-between;
	font-size: 11px;
	color: var(--hy-muted);
	margin-top: 5px;
}
.progPct {
	font-weight: 800;
	color: var(--hy-accent-ink);
}

/* メタ */
.goalMeta {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
	margin-top: 10px;
}
.due {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 11px;
	color: var(--hy-muted);
}
.due.dueSoon {
	color: #c07a2a;
	font-weight: 700;
}
.due.dueOver {
	color: #c0563a;
	font-weight: 700;
}
.doneTag {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	font-size: 11px;
	color: #5a9a5a;
	font-weight: 700;
}

/* フォーム */
.formHead {
	display: flex;
	align-items: center;
	gap: 10px;
	font-family: var(--hy-heading);
	font-weight: 800;
	font-size: 15px;
	color: var(--hy-ink);
	margin-bottom: 16px;
}
.backBtn {
	border: 1px solid var(--hy-border);
	background: var(--hy-surface);
	border-radius: 8px;
	width: 30px;
	height: 30px;
	color: var(--hy-ink);
	cursor: pointer;
}
.field {
	display: block;
	margin-bottom: 14px;
}
.label {
	display: block;
	font-size: 12px;
	font-weight: 700;
	color: var(--hy-ink);
	margin-bottom: 6px;
}
.req {
	color: var(--hy-accent);
}
.input,
.textarea {
	width: 100%;
	box-sizing: border-box;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 10px;
	padding: 9px 12px;
	font-size: 13.5px;
	color: var(--hy-ink);
	font-family: inherit;
}
.input:focus,
.textarea:focus {
	border-color: var(--hy-accent);
	outline: none;
}
.textarea {
	resize: vertical;
}
.segRow {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}
.seg {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	padding: 6px 13px;
	font-size: 12px;
	font-weight: 700;
	color: var(--hy-muted);
	cursor: pointer;
	font-family: var(--hy-heading);
}
.seg:hover {
	border-color: var(--hy-accent);
}
.segOn {
	background: var(--hy-accent);
	border-color: var(--hy-accent);
	color: #fff;
}
.metricHint {
	display: flex;
	align-items: flex-start;
	gap: 6px;
	font-size: 11px;
	color: var(--hy-muted);
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 9px;
	padding: 8px 10px;
	margin-bottom: 14px;
}
.metricHint i {
	color: var(--hy-accent);
	margin-top: 1px;
}
.formActions {
	display: flex;
	gap: 10px;
	margin-top: 6px;
}
.cancelBtn {
	flex: 1;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 11px;
	padding: 11px;
	font-size: 13px;
	font-weight: 700;
	color: var(--hy-ink);
	cursor: pointer;
	font-family: var(--hy-heading);
}
.saveBtn {
	flex: 2;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	background: var(--hy-accent);
	color: #fff;
	border: none;
	border-radius: 11px;
	padding: 11px;
	font-size: 13px;
	font-weight: 800;
	cursor: pointer;
	font-family: var(--hy-heading);
}
.saveBtn:not(:disabled):hover {
	filter: brightness(1.05);
}
.saveBtn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
.spin {
	animation: hy-goal-spin 0.8s linear infinite;
}
@keyframes hy-goal-spin {
	to {
		transform: rotate(360deg);
	}
}
.body {
	padding: 0;
	background: var(--hy-surface);
	min-height: 0;
}
.goalCard {
	border-radius: 22px;
	padding: 20px;
}
.addBtn,
.checkBtn,
.menuBtn {
	min-height: 44px;
}
.progFill {
	background: var(--hy-accent);
}
</style>
