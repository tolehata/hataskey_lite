<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog ref="dialog" :title="action === 'history' || result ? copy.history : action === 'delete' ? copy.deleteTitle : copy.warnTitle" :theme="target.product === 'hatask' ? mode === 'dark' ? 'espresso' : 'paper' : undefined" centerTitle scrollHint :busy="saving" @close="dialog?.close()" @closed="emit('closed')">
	<div :class="$style.body">
		<p v-if="loading" role="status">{{ copy.loading }}</p>
		<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
		<template v-if="result">
			<p role="status">{{ result.action === 'delete' ? copy.deletedSuccess : copy.warnedSuccess }}</p>
			<p v-if="result.action === 'delete' && result.warningId">{{ copy.extraWarningSuccess }}</p>
			<p :class="$style.hint">{{ copy.operationId }}：{{ result.operationId }}</p>
		</template>
		<template v-if="action === 'history' || result">
			<p v-if="!loading && !history.length">{{ copy.noHistory }}</p>
			<article v-for="entry in history" :key="entry.operationId" :class="$style.history">
				<h3>{{ entry.action === 'delete' ? copy.deleteRecord : copy.warnSent }}</h3>
				<dl><dt>{{ copy.targetUser }}</dt><dd>{{ entry.targetName }} @{{ entry.targetUsername }}</dd><dt>{{ copy.moderator }}</dt><dd>{{ entry.moderatorName }} @{{ entry.moderatorUsername }}</dd><dt>{{ copy.performedAt }}</dt><dd>{{ date(entry.performedAt) }}</dd><dt>{{ copy.recordId }}</dt><dd>{{ entry.targetId }}</dd><dt>{{ entry.action === 'delete' ? copy.deletionReason : copy.actionReason }}</dt><dd>{{ entry.reason }}</dd><dt>{{ copy.warning }}</dt><dd>{{ entry.warningId ? copy.savedForUser : copy.none }}</dd></dl>
			</article>
			<p :class="$style.hint">{{ copy.historyHint }}</p>
		</template>
		<form v-else-if="preview && !denied" @submit.prevent="submit">
			<h3>{{ preview.title }}</h3><p>@{{ preview.username }}<template v-if="preview.name"> · {{ preview.name }}</template></p>
			<p :class="$style.hint">{{ copy.recordId }}：{{ target.targetId }}</p>
			<div v-if="action === 'delete'" :class="$style.impact"><strong>{{ copy.deleteImpact }}</strong><ul><li v-for="(item, index) in preview.impact" :key="index">{{ recordModerationImpactLabel(item.label) }}：{{ countItems(item.count) }}</li></ul><p>{{ recordModerationRetained(preview.retained) }}</p><strong>{{ copy.irreversible }}</strong></div>
			<p v-else :class="$style.hint">{{ copy.warnWithoutDelete }}</p>
			<label :class="$style.field"><span>{{ action === 'delete' ? copy.deletionReason : copy.actionReason }} <b :class="$style.required">{{ copy.required }}</b></span><textarea v-model="reason" required maxlength="1000" rows="4" :disabled="saving || uncertain" :placeholder="copy.reasonPlaceholder"></textarea><small>{{ copy.internalOnly }} · {{ reason.length }} / 1000</small></label>
			<label v-if="action === 'delete'" :class="$style.check"><input v-model="withWarning" type="checkbox" :disabled="saving || uncertain">{{ copy.warnUser }}</label>
			<template v-if="action === 'warn' || withWarning">
				<label :class="$style.field"><span>{{ copy.warningMessage }} <b :class="$style.required">{{ copy.required }}</b></span><textarea v-model="warning" required maxlength="2000" rows="5" :disabled="saving || uncertain" :placeholder="copy.warningPlaceholder"></textarea><small>@{{ preview.username }} {{ copy.sentToUser }} · {{ warning.length }} / 2000</small></label>
				<div :class="$style.preview"><strong>{{ copy.userPreview }}</strong><p>{{ warning || copy.previewPlaceholder }}</p><small>{{ action === 'delete' ? copy.deletedContext : copy.warnedContext }}{{ copy.previewSuffix }}</small></div>
			</template>
			<label :class="$style.check"><input v-model="confirmed" type="checkbox" :disabled="saving || uncertain">{{ copy.confirmed }}</label>
			<div :class="$style.actions"><button type="button" class="hy-secondary" :disabled="saving" @click="dialog?.close()">{{ copy.close }}</button><button type="submit" :class="action === 'delete' ? $style.delete : 'hy-primary'" :disabled="!canSubmit">{{ saving ? copy.processing : uncertain ? copy.checkSameResult : action === 'delete' ? withWarning ? copy.deleteAndWarn : copy.deleteRecordAction : copy.sendWarning }}</button></div>
		</form>
		<button v-if="!saving && !result && !denied && (!preview || conflict)" type="button" class="hy-secondary" @click="load">{{ copy.checkLatest }}</button>
	</div>
</HyDialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { Endpoints } from 'cherrypick-js';
import type { RecordModerationTarget, RecordModerationResult } from '@/utility/record-moderation.js';
import HyDialog from '@/components/HyDialog.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { recordModerationImpactLabel, recordModerationRetained } from '@/utility/record-moderation-display.js';
const copy = i18n.ts._hata._recordModeration;
const countItems = (count: number) => i18n.tsx._hata._recordModeration.itemCount({ count });
const props = defineProps<{ target: RecordModerationTarget; action: 'delete' | 'warn' | 'history'; mode?: 'light' | 'dark' }>();
const emit = defineEmits<{ closed: []; done: [result: RecordModerationResult] }>();
const dialog = useTemplateRef('dialog');
const preview = ref<Endpoints['admin/record-moderation/preview']['res'] | null>(null);
const history = ref<Endpoints['admin/record-moderation/history']['res']>([]);
const result = ref<RecordModerationResult | null>(null);
const reason = ref(''), warning = ref(''), withWarning = ref(true), confirmed = ref(false);
const loading = ref(false), saving = ref(false), error = ref(''), denied = ref(false), conflict = ref(false), uncertain = ref(false);
const account = $i?.id;
let alive = true, generation = 0;
let pending: Endpoints['admin/record-moderation/execute']['req'] | null = null;
const allowed = () => alive && $i?.id === account && !!($i?.isAdmin || $i?.isModerator) && !denied.value;
const canSubmit = computed(() => allowed() && !saving.value && !loading.value && !conflict.value && !!preview.value && (uncertain.value || !!reason.value.trim() && reason.value.length <= 1000 && confirmed.value && (!(props.action === 'warn' || withWarning.value) || !!warning.value.trim() && warning.value.length <= 2000)));
const date = (value: string) => new Date(value).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });

function revoke() { denied.value = true; loading.value = false; generation++; preview.value = null; history.value = []; result.value = null; pending = null; reason.value = warning.value = ''; error.value = copy.accessDenied; }

function handleError(cause: unknown) {
	const code = (cause as { code?: string })?.code;
	if (code === 'INVALID_RECORD_MODERATION' || code === 'INVALID_PARAM') { uncertain.value = false; pending = null; error.value = copy.invalidInput; return; }
	if (['RECORD_MODERATION_ACCESS_DENIED', 'ROLE_PERMISSION_DENIED', 'PERMISSION_DENIED', 'ACCESS_DENIED', 'AUTHENTICATION_FAILED'].includes(code ?? '')) { revoke(); return; }
	if (code === 'RECORD_MODERATION_CONFLICT' || code === 'NO_SUCH_MODERATION_RECORD') {
		conflict.value = true; confirmed.value = false; uncertain.value = false; pending = null;
		error.value = code === 'NO_SUCH_MODERATION_RECORD' ? copy.alreadyDeleted : copy.conflict;
	} else error.value = copy.uncertainResult;
}

async function load() {
	if (!allowed()) { revoke(); return; }
	const current = ++generation;
	loading.value = true; error.value = ''; confirmed.value = false;
	try {
		if (props.action === 'history' || result.value) {
			const response = await misskeyApi('admin/record-moderation/history', props.target);
			if (allowed() && current === generation) history.value = response;
		} else {
			const response = await misskeyApi('admin/record-moderation/preview', props.target);
			if (allowed() && current === generation) { preview.value = response; conflict.value = false; uncertain.value = false; pending = null; }
		}
	} catch (cause) { if (allowed() && current === generation) handleError(cause); } finally { if (alive && current === generation) loading.value = false; }
}

async function submit() {
	if (!canSubmit.value || !preview.value || props.action === 'history') return;
	if (!pending) pending = { ...props.target, action: props.action, reason: reason.value.trim(), warning: props.action === 'warn' || withWarning.value ? warning.value.trim() : null, version: preview.value.version, requestId: crypto.randomUUID() };
	saving.value = true; error.value = '';
	try {
		const response = await misskeyApi('admin/record-moderation/execute', pending);
		if (!allowed()) return;
		result.value = response; pending = null; uncertain.value = false;
		emit('done', response);
		await load();
	} catch (cause) {
		if (allowed()) { uncertain.value = true; handleError(cause); }
	} finally { saving.value = false; }
}

watch(() => [$i?.id, $i?.isAdmin, $i?.isModerator], () => { if (!allowed()) revoke(); });
onMounted(load);
onBeforeUnmount(() => { alive = false; generation++; pending = null; });
</script>
<style module>
.body { padding: 24px; color: var(--hy-ink); overflow-wrap: anywhere; }
.body h3 { margin: 0 0 8px; font-size: 17px; }
.hint { color: var(--hy-muted); font-size: 12px; }
.field { display: grid; gap: 8px; margin: 20px 0; font-size: 13px; }
.field textarea { box-sizing: border-box; width: 100%; min-width: 0; padding: 12px; resize: vertical; border: 1px solid var(--hy-border); border-radius: 12px; background: var(--hy-surface); color: var(--hy-ink); font: inherit; font-size: 16px; }
.required { color: var(--MI_THEME-error); font-size: 11px; }
.impact, .preview { padding: 16px; margin: 18px 0; background: var(--hy-warm); border-radius: 14px; font-size: 13px; }
.preview p, .history dd { white-space: pre-wrap; }
.check { display: flex; align-items: flex-start; gap: 10px; margin-top: 18px; font-size: 13px; }
.check input { margin-top: 4px; width: 18px; height: 18px; flex-shrink: 0; }
.actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
.delete { background: var(--MI_THEME-error); color: var(--MI_THEME-fgOnAccent); border: 0; border-radius: 999px; min-height: 44px; padding: 10px 20px; font: inherit; cursor: pointer; }
.actions button:disabled { opacity: .5; cursor: default; }
.history { margin: 20px 0; padding: 16px; border: 1px solid var(--hy-border); border-radius: 14px; }
.history dl { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 8px 12px; font-size: 12px; }
.history dt { color: var(--hy-muted); }
.history dd { margin: 0; overflow-wrap: anywhere; }
</style>
