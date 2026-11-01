<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section :class="$style.root">
	<header><h3>{{ text.title }}</h3><button v-if="view.policy?.enabled && view.allowed" type="button" @click="toggle">{{ view.visible ? text.hide : text.show }}</button></header>
	<p v-if="!view.allowed">{{ text.unavailable }}</p><p v-else-if="view.policy?.enabled === false">{{ text.disabled }}</p><p v-else-if="!view.policy && !view.error" role="status">{{ text.loading }}</p>
	<template v-if="view.policy?.enabled && view.allowed"><p :class="$style.note">{{ text.room }}。{{ text.retention }}{{ view.policy.retentionDays }}{{ text.days }}</p><p v-if="!view.visible" :class="$style.note">{{ text.hidden }}</p></template>
	<p v-if="view.error" role="alert">{{ view.error === 'POST' ? text.postError : text.error }} <button type="button" @click="retry">{{ text.retry }}</button></p>
	<template v-if="view.enabled">
		<p v-if="view.loading" role="status">{{ text.loading }}</p><button v-if="view.more" type="button" :disabled="view.loading" @click="controller.load(true)">{{ text.more }}</button>
		<p v-if="!view.loading && !view.messages.length" :class="$style.note">{{ text.empty }}</p>
		<ol :class="$style.messages"><li v-for="message in view.messages" :key="message.id"><div><b>{{ message.user?.name || message.user?.username || text.withdrawn }}</b><time :datetime="message.createdAt">{{ time(message.createdAt) }}</time></div><p>{{ message.deleted ? text.deleted : message.text }}</p><div v-if="!message.deleted" :class="$style.actions"><button v-if="message.userId !== null && message.userId !== viewerId" type="button" @click="confirmation = { id: message.id, kind: 'report' }">{{ text.report }}</button><button v-if="moderator" type="button" @click="confirmation = { id: message.id, kind: 'remove' }">{{ text.remove }}</button></div></li></ol>
		<form @submit.prevent="post"><label :for="inputId">{{ text.input }}</label><textarea :id="inputId" :value="view.draft" maxlength="500" :disabled="view.busy" rows="3" @input="draftInput"></textarea><button type="submit" :disabled="view.busy || !view.draft.trim()">{{ text.send }}</button></form>
		<section v-if="confirmation" :class="$style.confirm" role="alert"><p>{{ confirmation.kind === 'report' ? text.reportConfirm : text.removeConfirm }}</p><select v-if="confirmation.kind === 'remove'" v-model="reason"><option value="abuse">{{ text.abuse }}</option><option value="spam">{{ text.spam }}</option><option value="other">{{ text.other }}</option></select><button type="button" :disabled="view.busy" @click="confirm">{{ confirmation.kind === 'report' ? text.confirmReport : text.confirmRemove }}</button><button type="button" @click="confirmation = null">{{ text.cancel }}</button></section>
		<p v-if="view.reported" role="status">{{ text.reported }}</p>
	</template>
</section>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, useId, watch } from 'vue';
import type { DeleteReason } from '@/utility/hataigo/chat.js';
import type { OnlineGame } from '@/utility/hataigo/online/types.js';
import { ChatController, chatText as text } from '@/utility/hataigo/chat.js';
import { createChatTransport } from '@/utility/hataigo/chat-client.js';
import { $i } from '@/i.js';

defineOptions({ name: 'HataigoChat' });
const emit = defineEmits<{ capability: [enabled: boolean] }>();
const props = withDefaults(defineProps<{ game: OnlineGame; active?: boolean }>(), { active: true });
const revision = ref(0);
const transport = createChatTransport();
const controller = new ChatController(transport, () => { revision.value++; });
const viewerId = transport.viewerId;
// These flags control only the existing server-enforced moderation action.
const moderator = computed(() => transport.current() && !!$i && ($i.isAdmin || $i.isModerator));
const view = computed(() => { void revision.value; return { policy: controller.policy, allowed: controller.allowed, visible: controller.visible, enabled: controller.enabled, loading: controller.loading, busy: controller.busy, messages: controller.messages, draft: controller.draft, more: controller.more, error: controller.error, reported: controller.reported }; });
watch(() => view.value.policy?.enabled, enabled => emit('capability', enabled === true), { immediate: true });
const inputId = `hataigo-chat-${useId()}`;
const confirmation = ref<{ id: string; kind: 'report' | 'remove' } | null>(null);
const reason = ref<DeleteReason>('abuse');
let mounted = false;
let cachedActive = true;
let timer: number | undefined;

function time(value: string): string { return value.replace('T', ' ').slice(0, 19); }

function draftInput(event: Event): void { const input = event.currentTarget; if (input instanceof HTMLTextAreaElement && controller.enabled) { controller.draft = input.value; revision.value++; } }

async function post(): Promise<void> { if (!await controller.post() && controller.enabled && controller.error !== null) { controller.error = 'POST'; revision.value++; } }

async function confirm(): Promise<void> { const choice = confirmation.value; if (choice === null) return; if (choice.kind === 'report') await controller.report(choice.id, window.location.origin); else if (moderator.value) await controller.remove(choice.id, reason.value); confirmation.value = null; }

async function toggle(): Promise<void> { confirmation.value = null; await controller.toggle(); }

function retry(): void { controller.deactivate(); syncActive(); }

function syncActive(): void {
	if (timer !== undefined) { window.clearInterval(timer); timer = undefined; }
	const enabled = mounted && cachedActive && props.active && !window.document.hidden;
	if (!enabled) { controller.deactivate(); confirmation.value = null; return; }
	void controller.update(props.game, true);
	timer = window.setInterval(() => { controller.purge(); if (!transport.current()) { confirmation.value = null; if (timer !== undefined) window.clearInterval(timer); timer = undefined; } }, 1000);
}

watch(() => [props.game, props.active], syncActive);
onMounted(() => { mounted = true; window.document.addEventListener('visibilitychange', syncActive); syncActive(); });
onActivated(() => { cachedActive = true; syncActive(); });
onDeactivated(() => { cachedActive = false; syncActive(); });
onBeforeUnmount(() => { mounted = false; window.document.removeEventListener('visibilitychange', syncActive); syncActive(); });
</script>

<style module lang="scss">
.root { color: var(--hy-ink); min-width: 0; }.root header, .actions { display: flex; gap: 8px; align-items: center; justify-content: space-between; }.root h3 { font-size: 15px; margin: 0; }.root p { font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; white-space: pre-wrap; }.note { color: var(--hy-muted); font-size: 12px !important; }
.root button, .root select { min-height: 44px; border: 1px solid var(--hy-border); border-radius: 999px; padding: 6px 12px; background: var(--hy-surface); color: inherit; cursor: pointer; font: inherit; font-size: 12px; }.root button:disabled { opacity: .55; cursor: default; }.root button:focus-visible, .root textarea:focus-visible { outline: 3px solid var(--hy-accent); outline-offset: 3px; }
.messages { padding: 0; list-style: none; max-height: 350px; overflow-y: auto; }.messages li { padding: 12px 0; border-top: 1px solid var(--hy-border); }.messages b { font-size: 12px; }.messages time { font-size: 10px; color: var(--hy-muted); margin-inline-start: 8px; }.messages p { margin: 6px 0; }.actions { justify-content: end; }.root form { display: grid; gap: 8px; }.root label { font-size: 12px; }.root textarea { width: 100%; box-sizing: border-box; resize: vertical; border: 1px solid var(--hy-border); border-radius: 12px; padding: 10px; background: var(--hy-surface); color: inherit; font: inherit; }.confirm { border: 1px solid var(--hy-accent); border-radius: 14px; background: var(--hy-soft); padding: 12px; margin-top: 12px; }.confirm button + button { margin-inline-start: 6px; }
</style>
