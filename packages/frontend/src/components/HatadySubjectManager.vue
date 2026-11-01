<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(Hatady): 分野(subject)の管理モーダル。
  分野の一覧表示・色指定(プリセット＋カスタム)・削除(別分野への付け替え)・追加を行う。
  色は本人のクライアント内でのみ反映される個人設定。
  PC/タブレット/スマホを問わず見やすいよう、1列リスト＋折り返しで構成し、既存の Hatady テーマに調和させる。
-->
<template>
<HyDialog ref="dialog" :title="copy.title" @close="dialog?.close()" @closed="emit('closed')">
	<div class="hatady-scope" :data-hatady-theme="theme" :class="$style.body">
		<button class="hy-primary" @click="openEditor()">
			<i class="ti ti-plus"></i>
			{{ copy.add }}
		</button>
		<div v-if="loading" :class="$style.loading">{{ copy.loading }}</div>
		<div v-else-if="subjects.length === 0" :class="$style.empty">{{ copy.empty }}</div>
		<div v-else :class="$style.list">
			<div v-for="s in subjects" :key="s.name" :class="$style.item">
				<div :class="$style.itemMain">
					<span :class="$style.swatch" :style="{ background: pal(s.name).accent }"></span>
					<div :class="$style.itemInfo">
						<div :class="$style.itemName">{{ s.name }}</div>
						<div :class="$style.itemMeta">
							{{ s.logCount }}{{ copy.countSuffix }}
							<span v-if="s.color" :class="$style.customTag">
								<i class="ti ti-brush"></i>
								{{ copy.customColor }}
							</span>
						</div>
					</div>
					<button :class="[$style.iconBtn, false && $style.iconBtnOn]" :title="i18n.ts._hata._hatady._subjects.edit" @click="openEditor(s)">
						<i class="ti ti-pencil"></i>
					</button>
					<button
						:class="[$style.iconBtn, $style.danger]"
						:title="copy.delete"
						:disabled="busy"
						@click="removeSubject(s)"
					>
						<i class="ti ti-trash"></i>
					</button>
				</div>
			</div>
		</div>
	</div>
</HyDialog>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef, onMounted } from 'vue';
import type { HySubjectRow } from '@/utility/hatady-subjects.js';
import HyDialog from '@/components/HyDialog.vue';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import { i18n } from '@/i18n.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { hySubjectPalette } from '@/utility/hatady.js';
import { hySubjects, loadHySubjects, deleteHySubject } from '@/utility/hatady-subjects.js';
import { hatadyTheme } from '@/utility/hatady-prefs.js';

const dialogs = useHataGoesDialogs();
const popup = useHataGoesPopup();

const emit = defineEmits<{ (ev: 'changed'): void; (ev: 'closed'): void }>();
const dialog = useTemplateRef('dialog');
const theme = hatadyTheme;
const copy = i18n.ts._hata._hatady._subjectManager;

const subjects = hySubjects;
const loading = ref(true);
const busy = ref(false);

function pal(name: string) {
	return hySubjectPalette(name);
}

async function openEditor(subject?: HySubjectRow) {
	const { dispose } = popup(
		(await import('@/components/HatadySubjectEditor.vue')).default,
		{ subject },
		{ done: () => emit('changed'), closed: () => dispose() },
	);
}

async function removeSubject(s: HySubjectRow) {
	if (busy.value) return;
	const others = subjects.value.filter((x) => x.name !== s.name);
	let reassignTo: string | null = null;

	if (s.logCount > 0 && others.length > 0) {
		// 付け替え先を選ばせる(この分野が付いたログを別分野へ移す)。
		const sel = await dialogs.select({
			title: i18n.tsx._hata._hatady._subjectManager.deleteTitle({ name: s.name }),
			text: i18n.tsx._hata._hatady._subjectManager.reassignPrompt({ count: s.logCount.toString() }),
			items: others.map((x) => ({
				value: x.name,
				label: `${x.name}${x.logCount > 0 ? i18n.tsx._hata._hatady._subjectManager.itemCount({ count: x.logCount.toString() }) : ''}`,
			})),
		});
		if (sel.canceled || sel.result == null) return;
		reassignTo = String(sel.result);
	} else {
		// 付け替え先が無い or ログ0件 → 確認のみ(ログはそのまま残り、色は自動に戻る)。
		const c = await dialogs.confirm({
			type: 'warning',
			title: i18n.tsx._hata._hatady._subjectManager.deleteTitle({ name: s.name }),
			text:
				s.logCount > 0
					? i18n.tsx._hata._hatady._subjectManager.keepLogsPrompt({ count: s.logCount.toString() })
					: copy.deleteConfirm,
		});
		if (c.canceled) return;
	}

	busy.value = true;
	try {
		await deleteHySubject(s.name, reassignTo);
		if (reassignTo != null) {
			hatadyNotify(i18n.ts._hata._hatady._subjects.updated);
		}
		emit('changed');
	} catch {
		hatadyNotify(i18n.ts._hata._hatady._subjects.updateFailed);
	} finally {
		busy.value = false;
	}
}

onMounted(async () => {
	loading.value = true;
	try {
		await loadHySubjects();
	} finally {
		loading.value = false;
	}
});
</script>

<style lang="scss" module>
.body {
	padding: 18px 20px 22px;
	background: var(--hy-bg);
	color: var(--hy-body);
	font-family: 'Noto Sans JP', 'Hiragino Sans', system-ui, sans-serif;
	min-height: 100%;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	gap: 14px;
}
.intro {
	display: flex;
	gap: 8px;
	font-size: 12px;
	line-height: 1.6;
	color: var(--hy-muted);
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 10px;
	padding: 10px 12px;
}
.intro > i {
	flex-shrink: 0;
	color: var(--hy-accent);
	margin-top: 1px;
}

.addRow {
	display: flex;
	gap: 8px;
}
.addInput {
	flex: 1;
	min-width: 0;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 10px;
	padding: 10px 13px;
	font-size: 14px;
	color: var(--hy-ink);
	font-family: inherit;
	outline: none;
}
.addInput:focus {
	border-color: var(--hy-accent);
}
.addBtn {
	flex: 0 0 auto;
	display: inline-flex;
	align-items: center;
	gap: 5px;
	background: var(--hy-accent);
	color: #fff;
	border: none;
	border-radius: 999px;
	padding: 9px 18px;
	font-size: 13px;
	font-weight: 700;
	cursor: pointer;
	font-family: var(--hy-heading);
}
.addBtn:disabled {
	opacity: 0.45;
	cursor: not-allowed;
}

.loading,
.empty {
	font-size: 13px;
	color: var(--hy-muted);
	text-align: center;
	padding: 24px 0;
}

.list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.item {
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 12px;
	padding: 11px 13px;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.itemMain {
	display: flex;
	align-items: center;
	gap: 11px;
}
.swatch {
	flex: 0 0 auto;
	width: 26px;
	height: 26px;
	border-radius: 8px;
	box-shadow:
		0 0 0 1px var(--hy-border),
		inset 0 1px 2px rgba(255, 255, 255, 0.3);
}
.itemInfo {
	flex: 1;
	min-width: 0;
}
.itemName {
	font-family: var(--hy-heading);
	font-weight: 700;
	font-size: 14px;
	color: var(--hy-ink);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.itemMeta {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 2px;
	font-size: 11px;
	color: var(--hy-muted);
}
.customTag {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	color: var(--hy-accent-ink);
	font-weight: 700;
}
.iconBtn {
	flex: 0 0 auto;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 34px;
	height: 34px;
	border-radius: 9px;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	color: var(--hy-body);
	cursor: pointer;
	font-size: 16px;
}
.iconBtn:hover:not(:disabled) {
	border-color: var(--hy-accent);
	color: var(--hy-accent);
}
.iconBtn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
.iconBtnOn {
	border-color: var(--hy-accent);
	color: var(--hy-accent);
	background: var(--hy-chip-bg);
}
.danger:hover:not(:disabled) {
	border-color: #c0563a;
	color: #c0563a;
}

/* 色エディタ */
.editor {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding-top: 2px;
	border-top: 1px dashed var(--hy-border);
}
.swatchRow {
	display: flex;
	flex-wrap: wrap;
	gap: 7px;
	padding-top: 8px;
}
.presetSwatch {
	width: 26px;
	height: 26px;
	border-radius: 999px;
	cursor: pointer;
	padding: 0;
	border: 2px solid var(--hy-surface);
	box-shadow: 0 0 0 1px var(--hy-border);
}
.presetOn {
	box-shadow: 0 0 0 2px var(--hy-ink);
}
.editorRow {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
}
.colorInput {
	flex: 1 1 160px;
	min-width: 140px;
}
.editorSpacer {
	flex: 1;
}
.textBtn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	padding: 7px 14px;
	font-size: 12px;
	font-weight: 700;
	color: var(--hy-body);
	cursor: pointer;
	font-family: var(--hy-heading);
}
.textBtn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
.saveBtn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	background: var(--hy-accent);
	color: #fff;
	border: none;
	border-radius: 999px;
	padding: 7px 16px;
	font-size: 12px;
	font-weight: 700;
	cursor: pointer;
	font-family: var(--hy-heading);
}
.saveBtn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

@media (max-width: 500px) {
	.body {
		padding: 14px 14px 18px;
	}
	.colorInput {
		flex-basis: 100%;
	}
	.editorSpacer {
		display: none;
	}
}
.body {
	padding: 0;
	background: var(--hy-surface);
	min-height: 0;
}
.item {
	border-radius: 20px;
	padding: 18px;
}
.iconBtn {
	min-height: 44px;
	min-width: 44px;
}
</style>
