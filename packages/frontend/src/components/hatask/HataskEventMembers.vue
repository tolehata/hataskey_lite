<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section :class="$style.root" :aria-label="copy.memberVisibility">
	<p>{{ copy.memberVisibilityHelp }}</p>
	<ul :class="$style.members">
		<li v-for="id in model" :key="id">
			<span>{{ names[id] || id }}</span>
			<button type="button" :disabled="disabled || busy" :aria-label="`${i18n.ts.remove}: ${names[id] || id}`" @click="model = model.filter(member => member !== id)"><i class="ti ti-x" aria-hidden="true"></i></button>
		</li>
	</ul>
	<button type="button" :disabled="disabled || busy || model.length >= 100" @click="addMember"><i class="ti ti-user-plus" aria-hidden="true"></i> {{ copy.addEventMember }}</button>
	<div :class="$style.templates">
		<label><span>{{ copy.memberTemplates }}</span><select v-model="selectedTemplate" :disabled="disabled || busy || !templatesReady" @change="applyTemplate"><option value="">{{ copy.chooseMemberTemplate }}</option><option v-for="template in memberTemplates" :key="template.id" :value="template.id">{{ template.name }}</option></select></label>
		<button type="button" :disabled="disabled || busy || !templatesReady || !model.length" @click="saveTemplate">{{ copy.saveMemberTemplate }}</button>
		<button v-if="selectedTemplate" type="button" :disabled="disabled || busy || !templatesReady" @click="removeTemplate">{{ i18n.ts.delete }}</button>
	</div>
	<p v-if="error" role="alert">{{ error }}</p>
</section>
</template>

<script lang="ts" setup>
import { useHataGoesPickers } from '@/utility/hatagoes-pickers.js';
import { computed, ref, watch } from 'vue';
import type { HataskPlannerTemplate } from '@/utility/hatask-planner-storage.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';

const pickers = useHataGoesPickers();
const dialogs = useHataGoesDialogs();
const props = defineProps<{
	disabled: boolean;
	templatesReady: boolean;
	templates: HataskPlannerTemplate[];
	save: (name: string, ids: string[]) => Promise<void>;
	remove: (id: string) => Promise<void>;
}>();
const model = defineModel<string[]>({ required: true });
const copy = i18n.ts._hata._hatask._planner;
const names = ref<Record<string, string>>({});
const busy = ref(false);
const error = ref('');
const selectedTemplate = ref('');
const memberTemplates = computed(() => props.templates.filter(template => template.kind === 'members' && template.archivedAt == null));
watch(model, async ids => {
	const missing = ids.filter(id => !names.value[id]);
	if (!missing.length) return;
	try {
		const users = await misskeyApi('users/show', { userIds: missing });
		for (const user of users) names.value[user.id] = user.name ? `${user.name} (@${user.username})` : `@${user.username}`;
	} catch { /* Keep IDs removable even if a member can no longer be resolved. */ }
}, { immediate: true, deep: true });

async function addMember(): Promise<void> {
	if (props.disabled || busy.value || model.value.length >= 100) return;
	const user = await pickers.selectUser({ localOnly: true, includeSelf: false });
	if (!user) return;
	if (model.value.includes(user.id)) return;
	names.value[user.id] = user.name ? `${user.name} (@${user.username})` : `@${user.username}`;
	model.value = [...model.value, user.id];
}

function applyTemplate(): void {
	const template = memberTemplates.value.find(item => item.id === selectedTemplate.value);
	if (!template || props.disabled) return;
	model.value = [...new Set(template.payload.visibleUserIds as string[])];
}

async function saveTemplate(): Promise<void> {
	const { canceled, result } = await dialogs.inputText({ title: copy.saveMemberTemplate, minLength: 1, maxLength: 80 });
	if (canceled || !result.trim() || props.disabled) return;
	busy.value = true;
	error.value = '';
	try { await props.save(result.trim(), [...model.value]); } catch { error.value = copy.memberTemplateSaveFailed; } finally { busy.value = false; }
}

async function removeTemplate(): Promise<void> {
	const id = selectedTemplate.value;
	const { canceled } = await dialogs.confirm({ type: 'warning', text: copy.deleteMemberTemplate });
	if (canceled || props.disabled) return;
	busy.value = true;
	error.value = '';
	try { await props.remove(id); selectedTemplate.value = ''; } catch { error.value = copy.memberTemplateSaveFailed; } finally { busy.value = false; }
}
</script>

<style lang="scss" module>
.root {
	container-type: inline-size;
	display: grid;
	gap: 10px;
	padding: 12px;
	border: 1px solid var(--rule);
	border-radius: var(--radius-sm, 12px);
	background: var(--surface);
	color: var(--fg);
	font-size: .8rem;
	p { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
	button, select { min-height: 44px; border: 1px solid var(--rule); border-radius: 8px; background: var(--surface); color: var(--fg); font: inherit; padding: 6px 10px; }
	button { cursor: pointer; }
	button:disabled, select:disabled { opacity: .5; cursor: default; }
	button:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
}
.members {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin: 0;
	padding: 0;
	list-style: none;
	li { display: flex; align-items: center; max-width: 100%; gap: 6px; padding-left: 10px; border-radius: 8px; background: var(--fill-2); }
	span { overflow-wrap: anywhere; min-width: 0; }
	button { flex-shrink: 0; width: 44px; }
}
.templates { display: flex; flex-wrap: wrap; align-items: end; gap: 8px; label { flex: 1 1 160px; min-width: 0; display: grid; gap: 4px; } select { width: 100%; min-width: 0; } }
</style>
