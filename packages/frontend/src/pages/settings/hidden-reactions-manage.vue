<!--
SPDX-FileCopyrightText: Tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/hidden-reactions" :label="copy.title" :keywords="['reaction', 'hidden', 'hide', 'emoji']" icon="ti ti-eye-off">
	<div class="_gaps_m">
		<FormSection first>
			<template #label>{{ copy.title }}</template>

			<div class="_gaps_s">
				<MkInfo>
					{{ copy.description }}
				</MkInfo>

				<div v-if="groupedHidden.length === 0" :class="$style.empty">
					<i class="ti ti-mood-smile" :class="$style.emptyIcon"></i>
					<p>{{ copy.empty }}</p>
				</div>

				<div v-else class="_gaps_s">
					<div :class="$style.summary">
						{{ i18n.tsx._hata._hiddenReactions.summary({ notes: groupedHidden.length, reactions: totalCount }) }}
					</div>

					<div v-for="group in groupedHidden" :key="group.noteId" :class="$style.noteGroup">
						<div :class="$style.noteHeader">
							<a :class="$style.noteLink" :href="`/notes/${group.noteId}`" @click.prevent="goToNote(group.noteId)">
								<i class="ti ti-note"></i>
								{{ group.noteId }}
							</a>
							<button class="_button" :class="$style.restoreAllButton" @click="restoreNote(group.noteId, group.reactions)">
								<i class="ti ti-eye"></i> {{ copy.restoreAll }}
							</button>
						</div>
						<div :class="$style.reactions">
							<button
								v-for="item in group.reactions"
								:key="item.reaction"
								class="_button"
								:class="$style.reactionChip"
								@click="restoreOne(group.noteId, item.reaction)"
							>
								<MkReactionIcon :reaction="item.reaction" :class="$style.reactionIcon"/>
								<i class="ti ti-x" :class="$style.removeIcon"></i>
							</button>
						</div>
					</div>

					<div :class="$style.actions">
						<MkButton danger @click="clearAll">
							<i class="ti ti-trash"></i> {{ copy.clearAll }}
						</MkButton>
					</div>
				</div>
			</div>
		</FormSection>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import FormSection from '@/components/form/section.vue';
import { definePage } from '@/page.js';
import * as os from '@/os.js';
import { getHiddenReactions, unhideReaction, hiddenReactionsVersion } from '@/utility/hidden-reactions.js';
import { useRouter } from '@/router.js';
import { i18n } from '@/i18n.js';

const copy = i18n.ts._hata._hiddenReactions;

const router = useRouter();

const groupedHidden = computed(() => {
	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	hiddenReactionsVersion.value;

	const all = getHiddenReactions();
	const map = new Map<string, { reaction: string; timestamp: number }[]>();

	for (const item of all) {
		if (!map.has(item.noteId)) {
			map.set(item.noteId, []);
		}
		map.get(item.noteId)!.push({ reaction: item.reaction, timestamp: item.timestamp });
	}

	return Array.from(map.entries())
		.map(([noteId, reactions]) => ({ noteId, reactions }))
		.sort((a, b) => {
			const aMax = Math.max(...a.reactions.map(r => r.timestamp));
			const bMax = Math.max(...b.reactions.map(r => r.timestamp));
			return bMax - aMax;
		});
});

const totalCount = computed(() => {
	return groupedHidden.value.reduce((sum, g) => sum + g.reactions.length, 0);
});

function goToNote(noteId: string) {
	router.pushByPath(`/notes/${noteId}`);
}

function restoreOne(noteId: string, reaction: string) {
	unhideReaction(noteId, reaction);
}

async function restoreNote(noteId: string, reactions: { reaction: string }[]) {
	const { canceled } = await os.confirm({
		type: 'question',
		text: i18n.tsx._hata._hiddenReactions.restoreConfirm({ count: reactions.length }),
	});
	if (canceled) return;

	for (const r of reactions) {
		unhideReaction(noteId, r.reaction);
	}
}

async function clearAll() {
	const { canceled } = await os.confirm({
		type: 'warning',
		text: copy.clearConfirm,
	});
	if (canceled) return;

	localStorage.removeItem('hiddenReactions');
	hiddenReactionsVersion.value++;
	os.success();
}

definePage({
	title: copy.title,
	icon: 'ti ti-eye-off',
});
</script>

<style lang="scss" module>
.empty {
	text-align: center;
	padding: 32px;
	opacity: 0.7;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.emptyIcon {
	font-size: 2em;
	display: block;
	margin-bottom: 8px;
	text-align: center;
}

.summary {
	font-size: 0.9em;
	opacity: 0.7;
	padding: 8px 0;
}

.noteGroup {
	padding: 12px;
	background: var(--MI_THEME-panel);
	border-radius: 8px;
}

.noteHeader {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8px;
}

.noteLink {
	font-size: 0.85em;
	opacity: 0.7;
	display: flex;
	align-items: center;
	gap: 4px;

	&:hover {
		opacity: 1;
	}
}

.restoreAllButton {
	font-size: 0.85em;
	padding: 4px 8px;
	border-radius: 4px;
	color: var(--MI_THEME-accent);

	&:hover {
		background: var(--MI_THEME-accentedBg);
	}
}

.reactions {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}

.reactionChip {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
	background: var(--MI_THEME-buttonBg);
	border-radius: 6px;
	font-size: 1.2em;

	&:hover {
		background: var(--MI_THEME-accentedBg);

		> .removeIcon {
			opacity: 1;
		}
	}
}

.reactionIcon {
	max-width: 28px;
	max-height: 28px;
}

.removeIcon {
	font-size: 0.6em;
	opacity: 0.5;
}

.actions {
	padding-top: 8px;
}
</style>
