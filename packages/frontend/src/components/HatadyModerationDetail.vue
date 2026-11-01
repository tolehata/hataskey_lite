<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div :class="$style.root">
	<div :class="$style.meta">
		<i :class="category.icon" aria-hidden="true"></i>{{ category.label }}
		<span :class="$style.status" :data-status="detail.item.review.state"><i :class="status.icon" aria-hidden="true"></i>{{ status.label }}</span>
	</div>
	<h2 ref="heading" :class="$style.title" tabindex="-1">{{ detail.item.title }}</h2>
	<div :class="$style.person">
		<MkAvatar :user="detail.item.actor" :class="$style.avatar" :link="false"/>
		<span><strong>{{ detail.item.actor.name || detail.item.actor.username }}</strong><small>@{{ detail.item.actor.username }}{{ detail.item.actor.host ? `@${detail.item.actor.host}` : '' }}</small></span>
	</div>
	<div :class="$style.meta">
		<time :datetime="detail.item.createdAt">{{ detail.item.category === 'reaction' ? copy.reactionChangedPrefix : '' }}{{ moderationDate(detail.item.createdAt) }}</time>
		<span><i :class="visibility.icon" aria-hidden="true"></i>{{ visibility.label }}</span>
		<span>{{ activity }}</span>
	</div>
	<div v-if="detail.item.emoji" :class="$style.reaction">
		<MkReactionIcon :reaction="detail.item.emoji" :class="$style.emoji"/>
		<div><strong>{{ detail.item.emoji }}</strong><small>{{ i18n.tsx._hata._hatady._moderationView.reactedBy({ name: detail.item.actor.name || detail.item.actor.username }) }}</small></div>
	</div>
	<div :class="$style.content">{{ detail.item.body || copy.noBody }}</div>
	<MkMediaList v-if="detail.item.files?.length" :mediaList="detail.item.files" :user="detail.item.actor"/>
	<dl v-if="detail.fields.length" :class="$style.fields">
		<template v-for="(field, index) in detail.fields" :key="index"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></template>
	</dl>
	<section v-if="relations.length || detail.relatedHasMore" :class="$style.relations" :aria-label="copy.relatedContent">
		<h3>{{ copy.relatedContent }}</h3>
		<button v-for="relation in relations" :key="`${relation.label}:${relation.entry.key}`" type="button" :class="$style.context" @click="emit('select', relation.entry)">
			<span>
				<i :class="moderationCategory(relation.entry.category).icon" aria-hidden="true"></i>
				<small>{{ relation.label }} · {{ moderationCategory(relation.entry.category).label }}</small>
				<strong>{{ relation.entry.title }}</strong>
				<small>{{ relation.entry.actor.name || relation.entry.actor.username }}</small>
			</span>
			<i class="ti ti-chevron-right" aria-hidden="true"></i>
		</button>
		<p v-if="detail.relatedHasMore" :class="$style.hint">{{ copy.relatedPartial }}</p>
	</section>
	<section :class="$style.review" :aria-label="copy.reviewAndMemo">
		<h3>{{ copy.reviewMemo }}</h3>
		<p v-if="detail.item.review.stale" :class="$style.hint">{{ copy.staleHint }}</p>
		<label :class="$style.note">
			<span :class="$style.srOnly">{{ copy.adminMemo }}</span>
			<textarea :value="note" :disabled="busy" maxlength="1000" rows="3" :placeholder="copy.memoPlaceholder" @input="emit('update:note', ($event.target as HTMLTextAreaElement).value)"></textarea>
			<small :class="$style.counter">{{ note.length }} / 1000</small>
		</label>
		<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
		<div :class="$style.actions">
			<button
				v-for="option in moderationStatuses"
				:key="option.value"
				type="button"
				:class="$style.reviewButton"
				:data-complete="option.value === 'reviewed'"
				:aria-pressed="detail.item.review.state === option.value"
				:disabled="busy || note.length > 1000"
				@click="emit('save', option.value)"
			>
				<i :class="option.icon" aria-hidden="true"></i>{{ option.label }}
			</button>
		</div>
		<div :class="$style.noteSave">
			<button type="button" :class="$style.saveLink" :disabled="busy || note.length > 1000" @click="emit('save', detail.item.review.state)">{{ copy.saveMemo }}</button>
			<small v-if="detail.item.review.reviewer">{{ detail.item.review.reviewer.name || detail.item.review.reviewer.username }}<template v-if="detail.item.review.reviewedAt"> · {{ moderationDate(detail.item.review.reviewedAt) }}</template></small>
		</div>
	</section>
	<RecordModerationActions :target="{ product: 'hatady', targetType: detail.item.targetType, targetId: detail.item.targetId }" :busy="busy" @completed="emit('moderated')"/>
</div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { ModerationDetail, ModerationEntry, ModerationStatus } from '@/utility/hatady-moderation.js';
import { moderationActivities, moderationCategory, moderationDate, moderationStatus, moderationStatuses, moderationVisibilities } from '@/utility/hatady-moderation.js';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import MkMediaList from '@/components/MkMediaList.vue';
import RecordModerationActions from '@/components/RecordModerationActions.vue';
import { i18n } from '@/i18n.js';
const copy = i18n.ts._hata._hatady._moderationView;

const props = defineProps<{ detail: ModerationDetail; note: string; busy?: boolean; error?: string }>();
const emit = defineEmits<{
	(event: 'moderated'): void;
	(event: 'update:note', value: string): void;
	(event: 'save', state: ModerationStatus): void;
	(event: 'select', entry: ModerationEntry): void;
}>();
const heading = useTemplateRef('heading');
const category = computed(() => moderationCategory(props.detail.item.category));
const status = computed(() => moderationStatus(props.detail.item.review.state));
const visibility = computed(() => moderationVisibilities[props.detail.item.visibility]);
const activity = computed(() => moderationActivities.find(item => item.value === props.detail.item.activity)?.label ?? '');
const relations = computed(() => [
	...props.detail.ancestors.map(entry => ({ entry, label: entry.key === props.detail.item.parentKey ? copy.target : copy.relatedSource })),
	...props.detail.related.map(entry => ({ entry, label: copy.postedHere })),
]);
defineExpose({ focusHeading: () => heading.value?.focus({ preventScroll: true }) });
</script>

<style module>
.root { min-width: 0; overflow-wrap: anywhere; color: var(--hy-ink); }
.srOnly { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.root h3 { margin: 0; font-size: 14px; }
.title { margin: 10px 0 14px; font-size: 20px; line-height: 1.55; overflow-wrap: anywhere; }
.title:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 3px; border-radius: 5px; }
.meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 9px; min-width: 0; color: var(--hy-muted); font-size: 12px; line-height: 1.5; }
.meta > span { display: inline-flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; }
.meta time { font-variant-numeric: tabular-nums; }
.status { padding: 5px 8px; border-radius: 999px; color: var(--hy-ink); background: var(--hy-cool); white-space: nowrap; }
.status[data-status='flagged'] { background: var(--hy-warm); }
.status[data-status='reviewed'] { background: var(--hy-soft); }
.person { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; min-width: 0; }
.avatar { flex: none; width: 36px; height: 36px; }
.person > span { display: grid; gap: 2px; min-width: 0; }
.person strong { font-size: 14px; }
.person small { font-size: 12px; color: var(--hy-muted); }
.reaction { display: flex; align-items: center; gap: 14px; padding: 14px; margin: 16px 0; background: var(--hy-soft); border-radius: 18px; }
.reaction > div { display: grid; gap: 5px; min-width: 0; }
.reaction strong { font-size: 15px; }
.reaction small { font-size: 12px; color: var(--hy-muted); }
.reaction .emoji { flex: none; width: 48px; height: 48px; object-fit: contain; font-size: 36px; }
.content { margin: 14px 0; font-size: 14px; line-height: 1.85; white-space: pre-wrap; overflow-wrap: anywhere; }
.fields { display: grid; grid-template-columns: minmax(70px,.4fr) minmax(0,1fr); gap: 9px 14px; margin: 16px 0; font-size: 13px; line-height: 1.65; }
.fields dt { color: var(--hy-muted); }
.fields dd { margin: 0; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.relations { display: grid; gap: 8px; margin: 18px 0; padding-top: 16px; border-top: 1px solid var(--hy-border); }
.context { display: flex; align-items: center; justify-content: space-between; gap: 9px; min-width: 44px; min-height: 44px; max-width: 100%; border: 0; padding: 9px 12px; border-radius: 13px; background: var(--hy-soft); color: var(--hy-ink); text-align: left; font-size: 13px; white-space: normal; overflow-wrap: anywhere; cursor: pointer; }
.context > span { display: grid; grid-template-columns: 20px minmax(0,1fr); align-items: center; gap: 3px 8px; min-width: 0; }
.context > span > i { font-size: 18px; }
.context > span > :is(strong,small) { grid-column: 2; min-width: 0; }
.context small { font-size: 12px; color: var(--hy-muted); }
.context > i { flex: none; font-size: 17px; color: var(--hy-muted); }
.review { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--hy-border); }
.hint { margin: 10px 0 0; font-size: 13px; line-height: 1.7; color: var(--hy-muted); }
.note { position: relative; display: block; margin-top: 10px; }
.note textarea { display: block; box-sizing: border-box; width: 100%; min-width: 0; min-height: 120px; padding: 11px 13px 34px; resize: vertical; border: 1px solid var(--hy-border); border-radius: 14px; background: var(--hy-bg); color: var(--hy-ink); font-size: 16px; line-height: 1.65; }
.note textarea::placeholder { color: var(--hy-muted); opacity: 1; }
.counter { position: absolute; right: 13px; bottom: 9px; font-size: 12px; color: var(--hy-muted); pointer-events: none; font-variant-numeric: tabular-nums; }
.actions { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.root .reviewButton { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 44px; min-height: 44px; max-width: 100%; padding: 10px 14px; border: 0; border-radius: 999px; background: var(--hy-soft); color: var(--hy-ink); font-size: 13px; font-weight: 700; cursor: pointer; }
.root .reviewButton[data-complete='true'] { background: var(--hy-accent); color: var(--hy-on-accent); }
.reviewButton[aria-pressed='true'] { outline: 2px solid var(--hy-accent); outline-offset: 2px; }
.reviewButton:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 4px; }
.noteSave { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px 10px; margin-top: 8px; }
.noteSave small { color: var(--hy-muted); font-size: 12px; line-height: 1.6; }
.root .saveLink { min-height: 44px; padding: 5px 10px; border: 0; border-radius: 12px; background: transparent; color: var(--hy-accent); font-size: 13px; cursor: pointer; }
@media (hover: hover) { .context:hover { box-shadow: inset 0 0 0 1px var(--hy-accent); } .saveLink:hover { background: var(--hy-soft); } }
</style>
