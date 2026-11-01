<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/avatar-decoration" :label="i18n.ts.avatarDecorations" :keywords="['avatar', 'icon', 'decoration']" icon="ti ti-sparkles">
	<div>
		<div v-if="loadError" class="_gaps_s" role="alert">
			<MkInfo warn>{{ i18n.ts._hataskDecoration.loadFailed }}</MkInfo>
			<MkButton @click="loadDecorations">{{ i18n.ts.retry }}</MkButton>
		</div>
		<div v-if="!loading" class="_gaps">
			<MkInfo>{{ i18n.tsx._profile.avatarDecorationMax({ max: $i.policies.avatarDecorationLimit }) }} ({{ i18n.tsx.remainingN({ n: $i.policies.avatarDecorationLimit - wornCount }) }})</MkInfo>

			<MkAvatar :class="$style.avatar" :user="$i" forceShowDecoration/>

			<div v-if="$i.avatarDecorations.length > 0" v-panel :class="$style.current" class="_gaps_s">
				<div>{{ i18n.ts.inUse }}</div>

				<div :class="$style.decorations">
					<XDecoration
						v-for="(avatarDecoration, i) in $i.avatarDecorations"
						:decoration="avatarDecorations.find(d => d.id === avatarDecoration.id) ?? { id: '', url: '', name: '?', roleIdsThatCanBeUsedThisDecoration: [] }"
						:angle="avatarDecoration.angle"
						:flipH="avatarDecoration.flipH"
						:offsetX="avatarDecoration.offsetX"
						:offsetY="avatarDecoration.offsetY"
						:scale="avatarDecoration.scale"
						:opacity="avatarDecoration.opacity"
						:active="true"
						@click="openAttachedDecoration(i)"
					/>
				</div>

				<MkButton danger @click="detachAllDecorations">{{ i18n.ts.detachAll }}</MkButton>
			</div>

			<div :class="$style.decorations">
				<XDecoration
					v-for="avatarDecoration in avatarDecorations"
					:key="avatarDecoration.id"
					:decoration="avatarDecoration"
					@click="openDecoration(avatarDecoration)"
				/>
			</div>
		</div>
		<div v-else>
			<MkLoading/>
		</div>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import * as Misskey from 'cherrypick-js';
import XDecoration from './avatar-decoration.decoration.vue';
import XDialog from './avatar-decoration.dialog.vue';
import type { DecorationAvailability } from '@/utility/avatar-decoration-availability.js';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { ensureSignin } from '@/i.js';
import MkInfo from '@/components/MkInfo.vue';
import { definePage } from '@/page.js';
import { decorationUnavailableReason, isDecorationWithinPeriod } from '@/utility/avatar-decoration-availability.js';
import { useAvatarDecorationClock } from '@/composables/use-avatar-decoration-clock.js';

const $i = ensureSignin();

const loading = ref(true);
const avatarDecorations = ref<Misskey.entities.GetAvatarDecorationsResponse>([]);
const loadError = ref(false);
let loadPending: Promise<void> | undefined;

function loadDecorations(): Promise<void> {
	if (loadPending) return loadPending;
	loadPending = misskeyApi('get-avatar-decorations').then(decorations => {
		avatarDecorations.value = decorations;
		loadError.value = false;
	}).catch(() => { loadError.value = true; }).finally(() => { loading.value = false; loadPending = undefined; });
	return loadPending;
}

void loadDecorations();
const now = useAvatarDecorationClock(() => [...avatarDecorations.value, ...$i.avatarDecorations], () => { void loadDecorations(); });
const wornCount = computed(() => $i.avatarDecorations.filter(decoration => isDecorationWithinPeriod(decoration, now.value)).length);
onMounted(() => window.addEventListener('focus', loadDecorations));
onUnmounted(() => window.removeEventListener('focus', loadDecorations));

function openAttachedDecoration(index: number) {
	openDecoration(avatarDecorations.value.find(d => d.id === $i.avatarDecorations[index].id) ?? { id: '', url: '', name: '?', roleIdsThatCanBeUsedThisDecoration: [] }, index);
}

async function openDecoration(selected: DecorationAvailability & {
	id: string;
	url: string;
	name: string;
	roleIdsThatCanBeUsedThisDecoration: string[];
}, index?: number) {
	await loadDecorations();
	if (loadError.value) return;
	const avatarDecoration = avatarDecorations.value.find(decoration => decoration.id === selected.id) ?? selected;
	if (index != null && $i.avatarDecorations[index]?.id !== avatarDecoration.id) return;
	if (index == null && decorationUnavailableReason(avatarDecoration, $i.roles.map(role => role.id), Date.now())) return;
	const { dispose } = os.popup(XDialog, {
		decoration: avatarDecoration,
		usingIndex: index ?? null,
	}, {
		'attach': async (payload) => {
			const decoration = {
				id: avatarDecoration.id,
				url: avatarDecoration.url,
				angle: payload.angle,
				flipH: payload.flipH,
				offsetX: payload.offsetX,
				offsetY: payload.offsetY,
				scale: payload.scale,
				opacity: payload.opacity,
			};
			const update = [...$i.avatarDecorations.filter(item => isDecorationWithinPeriod(item, Date.now())), decoration];
			const updated = await os.apiWithDialog('i/update', {
				avatarDecorations: update,
			});
			$i.avatarDecorations = updated.avatarDecorations;
		},
		'update': async (payload) => {
			if (index == null || $i.avatarDecorations[index]?.id !== avatarDecoration.id) return;
			const decoration = {
				id: avatarDecoration.id,
				url: avatarDecoration.url,
				angle: payload.angle,
				flipH: payload.flipH,
				offsetX: payload.offsetX,
				offsetY: payload.offsetY,
				scale: payload.scale,
				opacity: payload.opacity,
			};
			const update = [...$i.avatarDecorations];
			update[index] = decoration;
			const updated = await os.apiWithDialog('i/update', {
				avatarDecorations: update,
			});
			$i.avatarDecorations = updated.avatarDecorations;
		},
		'detach': async () => {
			if (index == null || $i.avatarDecorations[index]?.id !== avatarDecoration.id) return;
			const update = [...$i.avatarDecorations];
			update.splice(index, 1);
			const updated = await os.apiWithDialog('i/update', {
				avatarDecorations: update,
			});
			$i.avatarDecorations = updated.avatarDecorations;
		},
		closed: () => dispose(),
	});
}

function detachAllDecorations() {
	os.confirm({
		type: 'warning',
		text: i18n.ts.areYouSure,
	}).then(async ({ canceled }) => {
		if (canceled) return;
		await os.apiWithDialog('i/update', {
			avatarDecorations: [],
		});
		$i.avatarDecorations = [];
	});
}

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.avatarDecorations,
	icon: 'ti ti-sparkles',
}));
</script>

<style lang="scss" module>
.avatar {
	display: inline-block;
	width: 72px;
	height: 72px;
	margin: 16px auto;
}

.current {
	padding: 16px;
	border-radius: var(--MI-radius);
}

.decorations {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	grid-gap: 12px;
}
</style>
