<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog ref="dialog" :title="i18n.ts.reactionsList" :variant="variant" back @back="requestClose" @close="requestClose" @closed="emit('closed')">
	<div :class="$style.tabs" role="group" :aria-label="i18n.ts.reactionsList">
		<button v-for="tab in tabs" :key="tab.key" type="button" :aria-pressed="selected === tab.key" :aria-label="`${tab.label} ${tab.count}`" :title="`${tab.label} ${tab.count}`" :class="[$style.tab, selected === tab.key && $style.active]" @click="select(tab.key)">
			<MkReactionIcon v-if="tab.key" :reaction="tab.key" :noStyle="true" :class="$style.emoji" aria-hidden="true"/>
			<i v-else class="ti ti-users" aria-hidden="true"></i>
			<span v-if="selected === tab.key">{{ tab.label }}</span><span :class="$style.count">{{ tab.count }}</span>
		</button>
	</div>
	<div :key="selected" :class="$style.content">
		<p v-if="loading && rows.length === 0" role="status" :class="$style.message">{{ i18n.ts._hata._hatady._userList.loading }}</p>
		<p v-else-if="error" role="alert" :class="$style.message">{{ error }}</p>
		<p v-else-if="!loading && rows.length === 0" :class="$style.message">{{ i18n.ts.noUsers }}</p>
		<ul v-if="users.length" :class="$style.users">
			<li v-for="entry in users" :key="entry.user.id" :class="$style.user">
				<MkAvatar :user="entry.user" :class="$style.avatar"/>
				<span :class="$style.identity"><MkUserName :user="entry.user" :nowrap="true"/><small>@{{ entry.user.username }}{{ entry.user.host ? `@${entry.user.host}` : '' }}</small></span>
				<span :class="$style.reactions"><MkReactionIcon v-for="reaction in entry.reactions" :key="reaction" :reaction="reaction" :noStyle="true" :class="$style.emoji"/></span>
			</li>
		</ul>
		<div v-if="error || more" :class="$style.controls"><button type="button" class="hy-secondary" :disabled="loading" @click="loadPage">{{ error ? i18n.ts.retry : i18n.ts.loadMore }}</button></div>
	</div>
</HyDialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import type * as Misskey from 'cherrypick-js';
import { getEmojiName } from '@@/js/emojilist.js';
import HyDialog from '@/components/HyDialog.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import { i18n } from '@/i18n.js';
import { listHatadyReactionPage } from '@/utility/hatady-reaction-details.js';
import type { HatadyReactionRow, HatadyReactionTarget } from '@/utility/hatady-reaction-details.js';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';

const props = withDefaults(defineProps<{ target: HatadyReactionTarget; reactions: Record<string, number>; variant?: HatadySurfaceVariant }>(), { variant: 'hatady' });
const emit = defineEmits<{ closed: [] }>();
const dialog = useTemplateRef('dialog');
const selected = ref('');
const rows = ref<HatadyReactionRow[]>([]);
const loading = ref(false);
const error = ref('');
const more = ref(true);
let generation = 0;

const tabs = computed(() => {
	const reactions = Object.entries(props.reactions).filter(([, count]) => count > 0);
	return [
		{ key: '', label: i18n.ts.all, count: reactions.reduce((sum, [, count]) => sum + count, 0) },
		...reactions.map(([key, count]) => ({ key, label: key.startsWith(':') ? key.replace('@.', '') : getEmojiName(key), count })),
	];
});
const users = computed(() => {
	const grouped = new Map<string, { user: Misskey.entities.UserLite; reactions: string[] }>();
	for (const row of rows.value) {
		let entry = grouped.get(row.user.id);
		if (!entry) { entry = { user: row.user, reactions: [] }; grouped.set(row.user.id, entry); }
		if (!entry.reactions.includes(row.reaction)) entry.reactions.push(row.reaction);
	}
	return [...grouped.values()];
});

function select(reaction: string): void {
	if (selected.value === reaction) return;
	selected.value = reaction;
	generation++;
	rows.value = [];
	error.value = '';
	more.value = true;
	loading.value = false;
	void loadPage();
}

async function loadPage(): Promise<void> {
	if (loading.value || !more.value && !error.value) return;
	const current = generation;
	const reaction = selected.value || undefined;
	const untilId = rows.value.at(-1)?.id;
	loading.value = true;
	error.value = '';
	try {
		const page = await listHatadyReactionPage(props.target, reaction, untilId);
		if (current !== generation) return;
		rows.value = [...rows.value, ...page];
		more.value = page.length === 100;
	} catch {
		if (current === generation) error.value = 'リアクションを読み込めませんでした';
	} finally {
		if (current === generation) loading.value = false;
	}
}

function requestClose(): void { generation++; dialog.value?.close(); }

onMounted(() => { void loadPage(); });
onUnmounted(() => { generation++; });
</script>

<style module>
.tabs { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 18px; padding-bottom: 4px; }
.tab { display: inline-flex; align-items: center; gap: 6px; flex: none; min-height: 40px; padding: 6px 12px; border: 1px solid var(--hy-border); border-radius: 999px; background: var(--hy-soft); color: var(--hy-body); cursor: pointer; }
.active { border-color: var(--hy-accent); color: var(--hy-accent-ink); }
.content { animation: reveal .15s ease-out both; }
@keyframes reveal { from { opacity: 0; } to { opacity: 1; } }
.count { font-variant-numeric: tabular-nums; opacity: .7; }
.emoji { width: 22px; height: 22px; font-size: 22px; }
.message { padding: 20px; text-align: center; color: var(--hy-muted); }
.users { list-style: none; margin: 0; padding: 0; }
.user { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 4px; border-bottom: 1px solid var(--hy-border); }
.avatar { flex: none; width: 36px; height: 36px; border-radius: 50%; }
.identity { display: flex; flex-direction: column; flex: 1; min-width: 0; overflow: hidden; }
.identity small { color: var(--hy-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reactions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; max-width: 40%; }
.controls { padding: 16px 0 4px; text-align: center; }
</style>
