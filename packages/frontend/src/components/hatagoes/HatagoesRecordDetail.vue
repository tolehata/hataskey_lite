<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<MkWindow ref="window" :initialWidth="540" :initialHeight="600" canResize @closed="emit('closed')">
	<template #header>{{ title }}</template>
	<article :class="$style.body">
		<h2>{{ text('emoji') }} {{ title }}</h2>
		<p v-if="kind === 'flower' && owner">{{ owner }}</p>
		<img v-if="photoUrl" :src="photoUrl" :alt="title" :class="$style.photo">
		<dl><template v-for="field in fields" :key="field.label"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></template></dl>
		<template v-if="kind === 'event' && responses.length">
			<h3>参加回答</h3><ul><li v-for="(response, index) in responses" :key="index">@{{ response.username }} · {{ statusLabel(response.status) }}</li></ul>
		</template>
		<div :class="$style.actions">
			<button v-if="kind === 'cookingRecord' && text('recipeId')" type="button" @click="emit('related', 'recipe', text('recipeId'))">レシピを開く</button>
			<button v-if="kind === 'cookingRecord' && text('hatadyLogId')" type="button" @click="emit('related', 'log', text('hatadyLogId'))">Hatady の記録を開く</button>
			<button type="button" @click="window?.close()">{{ i18n.ts.close }}</button>
		</div>
	</article>
</MkWindow>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import MkWindow from '@/components/MkWindow.vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{ kind: 'event' | 'flower' | 'cookingRecord'; item: Record<string, unknown> }>();
const emit = defineEmits<{ closed: []; related: [kind: 'recipe' | 'log', id: string] }>();
const window = useTemplateRef('window');

function text(key: string): string { const value = props.item[key]; return typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }

const title = computed(() => text(props.kind === 'flower' ? 'name' : 'title'));
const owner = computed(() => {
	const user = props.item.user as { name?: string; username?: string } | undefined;
	return user?.name || (user?.username ? `@${user.username}` : '');
});
const photoUrl = computed(() => {
	const photo = props.item.photo as { url?: string | null; thumbnailUrl?: string | null } | undefined;
	return photo?.url || photo?.thumbnailUrl || '';
});
const responses = computed(() => Array.isArray(props.item.rsvpResponses) ? props.item.rsvpResponses as { username: string; status: string }[] : []);

function statusLabel(status: string): string { return ({ yes: '参加', no: '不参加', maybe: '未定', going: '参加', declined: '不参加' } as Record<string, string>)[status] ?? status; }

const fields = computed(() => {
	const rows: { label: string; value: string }[] = [];
	const add = (label: string, value: unknown) => { if (value !== null && value !== undefined && value !== '') rows.push({ label, value: String(value) }); };
	const date = (key: string) => { const value = text(key); const parsed = new Date(value); return value && Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value; };
	if (props.kind === 'flower') {
		add('花ことば', text('hanakotoba')); add('収穫日時', date('harvestedAt'));
	} else if (props.kind === 'event') {
		add('日付', [text('date'), text('dateEnd')].filter(Boolean).join(' ～ '));
		add('時刻', props.item.allDay ? '終日' : [text('timeStart'), text('timeEnd')].filter(Boolean).join(' ～ '));
		add('作成者', text('username') ? `@${text('username')}` : '');
		add('参加回答', props.item.rsvp ? props.item.rsvpClosed ? '受付終了' : '受付中' : 'なし');
	} else {
		add('調理日時', date('cookedAt')); add('食事', ({ breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' } as Record<string, string>)[text('mealSlot')] ?? text('mealSlot'));
		add('調理時間', props.item.durationSeconds == null ? '' : `${Number(props.item.durationSeconds) / 60} 分`);
		add('人数', props.item.servings); add('費用', props.item.cost); add('メモ', text('memo')); add('記録日時', date('createdAt'));
	}
	add('公開範囲', ({ public: '公開', followers: 'フォロワー', specified: '指定した相手', private: '自分のみ' } as Record<string, string>)[text('visibility')] ?? text('visibility'));
	return rows;
});
</script>

<style module>
.body { padding: 24px; overflow-wrap: anywhere; }
.body h2 { margin-top: 0; }
.body dl { display: grid; gap: 8px 20px; grid-template-columns: auto 1fr; }
.body dd { margin: 0; white-space: pre-wrap; }
.photo { display: block; max-width: 100%; max-height: 320px; object-fit: contain; }
.actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
.actions button { padding: 8px 12px; border-radius: 8px; background: var(--MI_THEME-buttonBg); }
</style>
