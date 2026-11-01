<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section :class="$style.root">
	<header><h2>{{ text.title }}</h2><button type="button" :disabled="view.loading" @click="controller.refresh()">{{ text.refresh }}</button></header>
	
	<p v-if="error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
	<div v-for="group in groups" :key="group.key" :class="$style.group">
		<h3>{{ text[group.key] }}</h3><p v-if="view.loading" role="status">{{ text.loading }}</p><p v-else-if="!view[group.key].length" :class="$style.note">{{ text.empty }}</p>
		<article v-for="game in view[group.key]" :key="game.id"><div><b>{{ name(game.user1) }} / {{ name(game.user2) }}</b><small>{{ game.settings.size }}路 · {{ date(game.endedAt) }}</small><small v-if="game.state?.result === null && (game.user1Id === null || game.user2Id === null)">{{ text.withdrawalEnded }}</small></div><div :class="$style.actions"><button type="button" :disabled="view.busy" @click="replay(game.id)">{{ text.replay }}</button><button type="button" :disabled="view.busy" @click="download(game.id)">{{ text.download }}</button><button v-if="game.isParticipant && game.publicAfterEnd" type="button" :disabled="view.busy" @click="prepareShare(game.id)">{{ text.share }}</button><button type="button" @click="emit('open', game.id)">対局を開く</button></div></article>
		<button v-if="group.key === 'mine' ? view.moreMine : view.morePublic" type="button" :disabled="view.loading" @click="controller.more(group.key === 'mine')">{{ text.more }}</button>
	</div>
	<section v-if="shareId" :class="$style.confirm" role="alert"><p>{{ text.shareConfirm }}</p><button type="button" :disabled="view.busy" @click="copy">{{ text.copy }}</button><button type="button" @click="shareId = null">{{ text.cancel }}</button></section>
</section>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';
import type { OnlineUser } from '@/utility/hataigo/online/types.js';
import { gameSgf, HistoryController, historyText as text } from '@/utility/hataigo/history.js';
import { createOnlineClient } from '@/utility/hataigo/online/client.js';

defineOptions({ name: 'HataigoHistory' });
const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true });
const emit = defineEmits<{ replay: [request: { id: string; sgf: string }]; 'open': [gameId: string] }>();
const client = createOnlineClient();
const revision = ref(0);
const controller = new HistoryController(client, () => { revision.value++; });
const view = computed(() => { void revision.value; return { mine: controller.mine, public: controller.publicGames, loading: controller.loading, busy: controller.busy, moreMine: controller.moreMine, morePublic: controller.morePublic }; });
const error = computed(() => { void revision.value; return controller.error === null ? null : ['UNAVAILABLE', 'FORBIDDEN', 'NOT_FOUND'].includes(controller.error) ? text.unavailable : text.error; });
const groups = [{ key: 'mine' }, { key: 'public' }] as const;
const shareId = ref<string | null>(null);
const message = ref<string | null>(null);
let mounted = false;
let cachedActive = true;
let accountTimer: number | undefined;

function name(user: OnlineUser | null): string { if (user === null) return '退会した人'; return user.name !== null && user.name !== '' ? user.name : user.username !== '' ? user.username : '退会した人'; }

function date(value: string | null): string { return value === null ? '' : value.slice(0, 10); }

async function replay(id: string): Promise<void> { const game = await controller.fresh(id); if (game === null) return; try { emit('replay', { id: crypto.randomUUID(), sgf: gameSgf(game) }); } catch { controller.error = 'INVALID_RESPONSE'; revision.value++; } }

async function download(id: string): Promise<void> {
	const game = await controller.fresh(id);
	if (game === null) return;
	try { const sgf = gameSgf(game); const address = URL.createObjectURL(new Blob([sgf], { type: 'application/x-go-sgf;charset=utf-8' })); const link = window.document.createElement('a'); link.href = address; link.download = `hataigo-${game.id}.sgf`; link.click(); window.setTimeout(() => URL.revokeObjectURL(address), 0); } catch { controller.error = 'INVALID_RESPONSE'; revision.value++; }
}

async function prepareShare(id: string): Promise<void> { const game = await controller.fresh(id, true); if (game !== null) shareId.value = game.id; }

async function copy(): Promise<void> {
	const id = shareId.value;
	if (id === null) return;
	const game = await controller.fresh(id, true);
	shareId.value = null;
	if (game === null) return;
	try { await window.navigator.clipboard.writeText(`${window.location.origin}/hataigo/${encodeURIComponent(game.id)}`); if (client.isCurrent() && controller.active) message.value = text.copied; } catch { if (client.isCurrent() && controller.active) message.value = text.copyError; }
}

function syncActive(): void {
	if (accountTimer !== undefined) { window.clearInterval(accountTimer); accountTimer = undefined; }
	if (mounted && cachedActive && props.active && !window.document.hidden) { void controller.activate(); accountTimer = window.setInterval(() => { if (!client.isCurrent()) { controller.deactivate(); shareId.value = null; message.value = null; if (accountTimer !== undefined) window.clearInterval(accountTimer); accountTimer = undefined; } }, 1000); } else { controller.deactivate(); shareId.value = null; message.value = null; }
}

watch(() => props.active, syncActive);
onMounted(() => { mounted = true; window.document.addEventListener('visibilitychange', syncActive); syncActive(); });
onActivated(() => { cachedActive = true; syncActive(); });
onDeactivated(() => { cachedActive = false; syncActive(); });
onBeforeUnmount(() => { mounted = false; window.document.removeEventListener('visibilitychange', syncActive); syncActive(); });
</script>

<style module lang="scss">
.root { display: grid; gap: 12px; color: var(--hy-ink); }
.root header, .actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
.root h2 { margin: 0; font-size: 18px; }.root h3 { margin: 0 0 12px; font-size: 15px; }
.group { padding: 16px; border: 1px solid var(--hy-border); border-radius: 24px; background: var(--hy-surface); }
.group article { padding: 12px 0; display: grid; gap: 10px; border-top: 1px solid var(--hy-border); overflow-wrap: anywhere; }
.group small { display: block; color: var(--hy-muted); margin-top: 4px; }.note { font-size: 12px; color: var(--hy-muted); line-height: 1.8; }
.root button { min-height: 44px; padding: 8px 14px; border: 1px solid var(--hy-border); border-radius: 999px; background: var(--hy-surface); color: var(--hy-ink); cursor: pointer; font: inherit; font-size: 13px; }
.root button:disabled { opacity: .55; cursor: default; }.root button:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 3px; }
.actions { justify-content: start; }.confirm { padding: 16px; border: 1px solid var(--hy-accent); border-radius: 18px; background: var(--hy-soft); }.confirm button + button { margin-left: 8px; }
</style>
