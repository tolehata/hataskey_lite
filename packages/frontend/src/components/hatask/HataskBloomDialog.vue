<!-- SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only -->
<template>
	<Teleport to="body">
	<MkModal ref="modal" class="hatask-bloom-modal" :data-flower-motion="animations ? 'on' : 'off'" :motionPreset="hataGoesHost || animations ? undefined : 'none'" preferType="dialog" zPriority="middle" :returnFocusTo="source" @click="close" @esc="onEscape" @opened="onOpened" @closed="onClosed"><section class="panel" :style="themeStyle" :data-theme="theme" :data-mode="mode" role="dialog" aria-modal="true" :aria-labelledby="titleId" @keydown.stop @keydown.esc.stop.prevent="close"><div class="art"><HataskEmoji :emoji="flower.emoji" class="emoji"/><span v-if="flower.rare" class="rare"><i class="ti ti-sparkles" aria-hidden="true"></i>レアなお花</span></div><small class="eyebrow">咲きました</small><h2 :id="titleId">{{ flower.name }}</h2><p v-if="flower.meaning || flower.variety" class="flower-info"><span v-if="flower.meaning">花言葉「{{ flower.meaning }}」</span><span v-if="flower.meaning && flower.variety"> · </span>{{ flower.variety }}</p><p v-if="flower.rank != null" class="rank"><i class="ti ti-users" aria-hidden="true"></i>はたすきーで{{ flower.rank }}人目の{{ flower.name }}</p><div v-if="flower.memory?.length" class="memories"><small>この花を育てていたあいだに終えたこと</small><ul><li v-for="(memory, index) in flower.memory.slice(0, 6)" :key="index"><i class="ti ti-check" aria-hidden="true"></i>{{ memory }}</li></ul></div><div class="name"><label :for="nameId">名前をつける</label><div class="name-row"><input :id="nameId" ref="nameInput" v-model="nickname" maxlength="80" :disabled="busy || closing" autocomplete="off"/><button type="button" class="reroll" title="別の名前にする" aria-label="別の名前にする" :disabled="busy || closing" @click="rerollName"><i class="ti ti-dice-5" aria-hidden="true"></i></button></div></div><div class="actions"><button type="button" class="harvest" :disabled="busy || closing" @click="emit('harvest', nickname.trim())"><i class="ti ti-scissors" aria-hidden="true"></i>収穫して図鑑にのせる</button><button type="button" class="later" :disabled="busy || closing" @click="close">あとで</button></div></section></MkModal>
	</Teleport>
</template>
<script setup lang="ts">
import { inject, nextTick, onMounted, ref, useId, watch } from 'vue';
import HataskEmoji from '@/components/HataskEmoji.vue';
import MkModal from '@/components/MkModal.vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import { generateFlowerNickname } from '@/utility/hatask-flora.js';
export type BloomFlower = { id?: string; name: string; emoji: string; meaning?: string; variety?: string; rare?: boolean; rank?: number | null; memory?: string[]; nickname?: string };
const props = withDefaults(defineProps<{ flower: BloomFlower; source: HTMLElement; theme?: string; mode?: 'light' | 'dark'; busy?: boolean; animations?: boolean }>(), { busy: false, animations: true, mode: 'light' });
const hataGoesHost = inject(HATA_GOES_HOST, null);
const emit = defineEmits<{ harvest: [nickname: string]; closed: [] }>();
const modal = ref<InstanceType<typeof MkModal> | null>(null);
const nameInput = ref<HTMLInputElement | null>(null);
const nickname = ref(props.flower.nickname ?? '');
const closing = ref(false);
const titleId = `hatask-bloom-${useId()}`;
const nameId = `${titleId}-name`;
const themeStyle = ref<Record<string, string>>({});
let didClose = false;
const tokens = ['--bg','--surface','--masthead','--fg','--fg-2','--fg-3','--accent','--accent-ink','--on-accent','--fill','--fill-2','--rule','--shadow','--htk-font-body','--htk-font-head'] as const;
function inheritTheme() { const styles = window.getComputedStyle(props.source); const inherited: Record<string, string> = { fontFamily: styles.fontFamily }; for (const token of tokens) { const value = styles.getPropertyValue(token).trim(); if (value) inherited[token] = value; } themeStyle.value = inherited; }
function close() { if (closing.value || props.busy) return; closing.value = true; modal.value?.close(); }
function onEscape(event: KeyboardEvent) { event.preventDefault(); event.stopPropagation(); close(); }
function onOpened() { void nextTick(() => nameInput.value?.focus({ preventScroll: true })); }
function onClosed() { if (didClose) return; didClose = true; emit('closed'); }
// 旗鯖fork: 自動で入った名前が気に入らなければ、上フレーズだけを引き直せる。
function rerollName() { nickname.value = generateFlowerNickname(props.flower.name, Math.random, nickname.value); nameInput.value?.focus({ preventScroll: true }); }
onMounted(inheritTheme);
watch(() => props.flower.id, () => { nickname.value = props.flower.nickname ?? ''; });
defineExpose({ close });
</script>
<style scoped>
.panel{box-sizing:border-box;flex-shrink:0;width:min(440px,calc(100vw - 32px));max-width:100%;max-height:calc(100dvh - var(--MI-fixed-top-inset, 0px) - 64px);margin:auto;overflow:auto;padding:24px 22px 20px;border:1px solid var(--rule);border-radius:28px;background:var(--masthead);color:var(--fg);box-shadow:0 26px 50px -24px rgba(0,0,0,.55),var(--shadow);font-family:var(--htk-font-body,inherit);overflow-wrap:anywhere}.art{position:relative;display:grid;place-items:center;height:150px;margin:-6px -6px 6px;border-radius:22px;background:radial-gradient(circle at 50% 55%,#fff6ca 0,rgba(255,246,202,0) 62%),linear-gradient(150deg,#f5ead5,#e5dfc0)}.emoji{width:96px;height:96px;font-size:96px;filter:drop-shadow(2px 3px 2px rgba(48,39,25,.2))}.rare{position:absolute;top:12px;right:12px;display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;background:#fff;color:#866012;font-size:12px;font-weight:700}.eyebrow{color:var(--accent-ink);font-size:12px;font-weight:800;letter-spacing:.1em}h2{margin:2px 0;font:700 24px/1.35 var(--htk-font-head,inherit)}.flower-info{margin:0;color:var(--fg-2);font-size:13px}.rank{display:flex;align-items:center;gap:8px;margin:10px 0 0;padding:8px 12px;border-radius:12px;background:var(--fill);font-size:12px}.rank i{flex:none;color:var(--accent-ink);font-size:16px}.memories{margin-top:12px}.memories small{display:block;margin-bottom:4px;color:var(--fg-2);font-size:11px;font-weight:800;letter-spacing:.06em}.memories ul{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}.memories li{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:3px 10px;border:1px solid var(--rule);border-radius:999px;font-size:12px;overflow-wrap:anywhere}.memories li i{flex:none;color:var(--accent-ink);font-size:12px}.name{display:grid;gap:6px;margin-top:14px;font-size:12px;font-weight:700}.name input{box-sizing:border-box;width:100%;min-width:0;min-height:44px;padding:8px 14px;border:1px solid var(--rule);border-radius:999px;background:var(--surface);color:var(--fg);font:inherit;font-size:14px}.name-row{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:8px}.reroll{display:grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid var(--rule);border-radius:50%;background:var(--surface);color:var(--fg);font-size:20px;cursor:pointer}.reroll:disabled{opacity:.55;cursor:default}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.actions button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:8px 18px;border-radius:999px;font:800 15px var(--htk-font-body,inherit);cursor:pointer}.actions button:disabled{opacity:.55;cursor:default}.harvest{flex:1;border:0;background:var(--accent);color:var(--on-accent);box-shadow:var(--shadow)}.harvest i{font-size:18px}.later{border:1px solid var(--rule);background:transparent;color:var(--fg)}.panel :focus-visible{outline:2px solid var(--accent);outline-offset:2px}@media(max-width:500px){.panel{max-height:calc(100dvh - var(--MI-fixed-top-inset, 0px) - 32px)}}@media(max-width:380px){.panel{padding:18px 16px}.actions .harvest{flex-basis:100%}.actions .later{flex:1}}@media(prefers-reduced-motion:reduce){.emoji{animation:none}}
</style>
