<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="concrnt-list-selector">
	<button ref="trigger" class="list-trigger" type="button" :disabled="disabled" aria-haspopup="dialog" :aria-expanded="open" :aria-controls="open ? id : undefined" @click="toggle"><i class="ti ti-list" aria-hidden="true"></i><span><strong>{{ selectedName }}</strong><small>CTLのリストを選択</small></span><i class="ti ti-selector" aria-hidden="true"></i></button>
	<Teleport to="body">
		<div v-if="open" :id="id" ref="panel" class="concrnt-list-popup" :style="position" role="dialog" aria-label="CTLのリストを選択" :aria-busy="loading" tabindex="-1" @keydown="keydown">
			<div v-if="loading" class="picker-state" role="status">リストを取得しています…</div>
			<div v-else-if="error" class="picker-state" role="alert"><span>{{ error }}</span><button class="list-item" type="button" @click="emit('refresh')">もう一度取得する</button></div>
			<template v-else>
				<button class="list-item" type="button" :aria-pressed="!modelValue" :data-active="!modelValue || undefined" @click="select('')"><i class="concrnt-icon"></i><span>ホーム<small>先頭のピン留めリストを使用<br>（未設定時は自分のホーム）</small></span><i v-if="!modelValue" class="ti ti-check"></i></button>
				<p v-if="!lists.length" class="picker-state">選択できるリストがありません。</p>
				<button v-for="list in lists" :key="list.uri" class="list-item" type="button" :data-active="modelValue === list.uri || undefined" :aria-pressed="modelValue === list.uri" @click="select(list.uri)"><i class="ti ti-list" aria-hidden="true"></i><span>{{ list.name }}<small>{{ list.timelines.length }}件のタイムライン{{ list.excludeSelf ? '・自分のホームを除く' : '' }}</small></span><i v-if="list.pinned" class="ti ti-pin" title="ピン留め"></i><i v-if="modelValue === list.uri" class="ti ti-check"></i></button>
				<button class="list-item picker-manage" type="button" @click="emit('refresh')"><i class="ti ti-refresh"></i><span>一覧を更新</span></button>
			</template>
			<button class="list-item" type="button" @click="close(true)"><i class="ti ti-x"></i><span>閉じる</span></button>
		</div>
	</Teleport>
</div>
</template>
<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import type { ConcrntList } from '@/utility/concrnt/types.js';
const props = defineProps<{ modelValue: string; lists: ConcrntList[]; loading?: boolean; error?: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; refresh: [] }>();
const id = useId();
const trigger = ref<HTMLButtonElement>();
const panel = ref<HTMLDivElement>();
const open = ref(false);
const position = ref<Record<string, string>>({});
const selectedName = computed(() => props.modelValue ? props.lists.find(list => list.uri === props.modelValue)?.name ?? '選択したリストを確認してください' : 'ホーム');

function place(): void {
	const rect = trigger.value?.getBoundingClientRect();
	if (!rect) return;
	const width = Math.min(320, window.innerWidth - 24);
	const height = Math.min(420, window.innerHeight - 24);
	const top = rect.bottom + 6 + height <= window.innerHeight ? rect.bottom + 6 : Math.max(12, Math.min(rect.top - height - 6, window.innerHeight - height - 12));
	position.value = { width: `${width}px`, left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`, top: `${top}px`, maxHeight: `${Math.max(100, window.innerHeight - top - 12)}px` };
}

function focusSelected(): void { (panel.value?.querySelector<HTMLElement>('[data-active]') ?? panel.value?.querySelector<HTMLElement>('button') ?? panel.value)?.focus(); }

async function toggle(): Promise<void> { if (open.value) return close(true); open.value = true; emit('refresh'); place(); await nextTick(); if (open.value) focusSelected(); }

function close(restore = false): void { open.value = false; if (restore) trigger.value?.focus(); }

function select(value: string): void { emit('update:modelValue', value); close(true); }

function outside(event: Event): void { if (!panel.value?.contains(event.target as Node) && !trigger.value?.contains(event.target as Node)) close(); }

function keydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
	if (event.key === 'Tab') { close(true); return; }
	if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
	const items = Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []);
	if (!items.length) return;
	event.preventDefault();
	const current = items.indexOf(window.document.activeElement as HTMLElement);
	const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
	items[index].focus();
}

watch(() => props.loading, async loading => { if (!loading && open.value) { await nextTick(); if (open.value) focusSelected(); } });
watch(() => props.disabled, disabled => { if (disabled) close(); });
watch(open, value => {
	window.document.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
	if (value) { window.document.addEventListener('pointerdown', outside, true); window.addEventListener('resize', place); window.addEventListener('scroll', place, true); }
});
onBeforeUnmount(() => { window.document.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); });
</script>
<style scoped>
/* Reuse the list/antenna chooser's item size, selected check, focus and keyboard behavior. */
.concrnt-list-selector { flex: 1; min-width: 0; }
/* Hataskey UI のピル型（タイムラインのツールバーに並ぶ）。 */
.list-trigger { display: flex; align-items: center; gap: 8px; box-sizing: border-box; width: 100%; min-height: 40px; padding: 4px 14px; border: 0; border-radius: 999px; color: var(--MI_THEME-fg); background: color-mix(in srgb, var(--MI_THEME-panel) 86%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--MI_THEME-divider) 70%, transparent); backdrop-filter: blur(12px); font: inherit; text-align: start; cursor: pointer; }
.list-trigger:hover:not(:disabled) { background: var(--MI_THEME-buttonHoverBg); }
.list-trigger:disabled { opacity: .6; cursor: default; }
.list-trigger > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list-trigger small { margin-left: 8px; color: var(--MI_THEME-fgTransparentWeak); font-size: 11px; }
.concrnt-list-popup { position: fixed; z-index: 3000; box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain; padding: 8px; border: 1px solid var(--MI_THEME-divider); border-radius: 16px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); box-shadow: 0 8px 28px rgb(0 0 0 / 18%); }
.list-item { display: flex; align-items: center; gap: 10px; box-sizing: border-box; width: 100%; min-height: 44px; padding: 10px 12px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.list-item > span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.list-item small { display: block; margin-top: 4px; color: var(--MI_THEME-fgTransparentWeak); font-size: 11px; }
.list-item[data-active], .list-item:hover, .list-item:focus-visible { background: color-mix(in srgb, var(--MI_THEME-accent) 14%, transparent); color: var(--MI_THEME-accent); }
.list-trigger:focus-visible, .list-item:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: -3px; }
.picker-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px 12px; text-align: center; font-size: 13px; }
.picker-manage { margin-top: 4px; border-top: 1px solid var(--MI_THEME-divider); }
</style>
