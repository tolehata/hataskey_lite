<!--
SPDX-FileCopyrightText: Tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<span ref="root" :class="[$style.root, { [$style.motion]: enabled, [$style.compact]: compact }]" aria-hidden="true">
	<span data-new-notes-part="arrow" :class="$style.arrow"><i :class="[icon, $style.rise]"/></span>
	<span v-if="visibleAvatars.length" :class="$style.faces">
		<span v-for="avatar in visibleAvatars" :key="avatar.id" :data-new-notes-face="avatar.id" :class="$style.face">
			<MkAvatar v-if="avatar.user" :class="$style.avatar" :user="avatar.user" :link="false" :preview="false" :indicator="false" :isToastAvatar="true"/>
			<img v-else :class="$style.image" :src="avatar.url" alt="" decoding="async">
		</span>
	</span>
	<span v-if="count !== undefined" data-new-notes-part="count" :class="$style.count"><span ref="countValue" :class="$style.countValue">{{ count }}</span></span>
	<span v-else data-new-notes-part="text" :class="$style.text"><Mfm :text="text" :plain="true" :nowrap="true" :nyaize="false" :author="author ?? undefined" :emojiUrls="emojiUrls"/></span>
</span>
</template>
<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type * as Misskey from 'cherrypick-js';
import type { HataskeyTimelineNewNotesAvatar } from '@/utility/hataskey-timeline-new-notes.js';

const props = withDefaults(defineProps<{
	avatars?: ReadonlyArray<HataskeyTimelineNewNotesAvatar>;
	count?: number;
	text?: string;
	author?: Misskey.entities.UserLite | null;
	emojiUrls?: Record<string, string>;
	icon?: string;
	motion: boolean;
	compact?: boolean;
}>(), { avatars: () => [], text: '', author: null, emojiUrls: () => ({}), icon: 'ti ti-arrow-up', compact: false });
const root = ref<HTMLElement>();
const countValue = ref<HTMLElement>();
const reduced = ref(false);
const enabled = computed(() => props.motion && !reduced.value);
const visibleAvatars = computed(() => {
	const seen = new Set<string>();
	return props.avatars.filter(avatar => {
		if (seen.has(avatar.id)) return false;
		seen.add(avatar.id);
		return true;
	}).slice(0, 3);
});
const animations = new Set<Animation>();
const ghosts = new Set<HTMLElement>();
const ghostAnimations = new Set<Animation>();
let revision = 0;
let media: MediaQueryList | undefined;
const easing = 'cubic-bezier(.22,1,.36,1)';
function cleanup(preserveGhosts = false) {
	animations.forEach(animation => animation.cancel());
	animations.clear();
	if (preserveGhosts) return;
	ghostAnimations.forEach(animation => animation.cancel());
	ghostAnimations.clear();
	ghosts.forEach(ghost => ghost.remove());
	ghosts.clear();
}
function animate(element: HTMLElement, frames: Keyframe[], duration: number, done?: () => void) {
	if (!enabled.value || !element.animate) return;
	const animation = element.animate(frames, { duration, easing });
	const collection = ghosts.has(element) ? ghostAnimations : animations;
	collection.add(animation);
	animation.finished.catch(() => {}).then(() => {
		collection.delete(animation);
		done?.();
	});
}
function elements() {
	return [...(root.value?.querySelectorAll<HTMLElement>('[data-new-notes-face], [data-new-notes-part]') ?? [])];
}
function key(element: HTMLElement) {
	return element.dataset.newNotesFace !== undefined ? `face:${element.dataset.newNotesFace}` : `part:${element.dataset.newNotesPart}`;
}
// Read the rendered geometry before cancelling interrupted effects. Vue retains
// keyed avatar DOM; only departing visual copies are managed outside Vue.
watch(() => [visibleAvatars.value, props.count, props.text], async (_, previous) => {
	const currentRevision = ++revision;
	const before = new Map(elements().map(element => [key(element), {
		rect: element.getBoundingClientRect(), opacity: getComputedStyle(element).opacity, element,
	}]));
	cleanup(true);
	await nextTick();
	if (currentRevision !== revision || !enabled.value || !root.value) return;
	const remaining = new Set<string>();
	for (const element of elements()) {
		const id = key(element);
		remaining.add(id);
		const from = before.get(id);
		const to = element.getBoundingClientRect();
		const face = id.startsWith('face:');
		const x = from ? from.rect.left + from.rect.width / 2 - to.left - to.width / 2 : face ? -14 : 0;
		const y = from ? from.rect.top + from.rect.height / 2 - to.top - to.height / 2 : 0;
		const scale = face ? from ? from.rect.width / (to.width || 26) : 0.3 : 1;
		animate(element, [
			{ transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity: from?.opacity ?? (face ? 0 : 1) },
			{ transform: 'translate(0, 0) scale(1)', opacity: 1 },
		], 520);
	}
	const origin = root.value.getBoundingClientRect();
	for (const [id, from] of before) {
		if (!id.startsWith('face:') || remaining.has(id)) continue;
		const ghost = from.element.cloneNode(true) as HTMLElement;
		ghost.removeAttribute('data-new-notes-face');
		ghost.setAttribute('data-new-notes-ghost', '');
		Object.assign(ghost.style, { position: 'absolute', margin: '0', left: `${from.rect.left - origin.left}px`, top: `${from.rect.top - origin.top}px`, width: `${from.rect.width}px`, height: `${from.rect.height}px`, pointerEvents: 'none' });
		root.value.append(ghost);
		ghosts.add(ghost);
		animate(ghost, [{ opacity: from.opacity, transform: 'translateX(0) scale(1)' }, { opacity: 0, transform: 'translateX(12px) scale(.65)' }], 300, () => { ghost.remove(); ghosts.delete(ghost); });
	}
	if (props.count !== undefined && props.count !== previous[1] && countValue.value) {
		animate(countValue.value, [{ transform: 'translateY(8px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], 380);
	}
}, { flush: 'pre' });
watch(enabled, value => { if (!value) { ++revision; cleanup(); } }, { flush: 'sync' });
function updateReduced() { reduced.value = media?.matches ?? false; }
onMounted(() => {
	media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
	updateReduced();
	media?.addEventListener('change', updateReduced);
});
onUnmounted(() => { ++revision; cleanup(); media?.removeEventListener('change', updateReduced); });
</script>
<style lang="scss" module>
.root { position: relative; display: inline-flex; align-items: center; justify-content: center; min-width: 0; gap: 10px; color: var(--hata-new-notes-fg, var(--MI_THEME-fgOnAccent)); }
.arrow { display: inline-flex; width: 20px; height: 20px; overflow: hidden; flex-shrink: 0; font-size: 20px; }
.rise { display: inline-block; width: 20px; height: 20px; line-height: 20px; }
.compact { .arrow, .rise { width: 18px; height: 18px; font-size: 18px; line-height: 18px; } }
.faces { display: inline-flex; align-items: center; flex-shrink: 0; }
.face { display: inline-block; position: relative; width: 26px; height: 26px; box-sizing: border-box; border: 2px solid var(--hata-new-notes-accent, var(--MI_THEME-accent)); flex-shrink: 0; margin-left: -6px; &:first-child { margin-left: 0; } }
.avatar { width: 100%; height: 100%; border-radius: 0 !important; > :global(img:first-child), > :global(div:first-child) { border-radius: 0 !important; } }
.image { width: 100%; height: 100%; object-fit: cover; border-radius: 0; }
.count { display: inline-flex; margin-left: 8px; min-width: 12px; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.countValue { display: inline-block; }
.text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.motion .rise { animation: rise 1.1s cubic-bezier(.45,0,.55,1) infinite; }
@keyframes rise { 0% { transform: translateY(70%); opacity: 0; } 35%, 65% { opacity: 1; } 100% { transform: translateY(-70%); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .motion .rise { animation: none; } }
</style>
