<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span :class="$style.root" data-note-action-animation :data-action="action" :data-motion="motion" aria-hidden="true">
	<span :class="$style.paperWindow"><span :class="$style.paper"><FileText :class="$style.paperIcon" :size="action === 'favorite' || action === 'delete' ? 19 : 25" :stroke-width="1.8"/></span></span>
	<span v-if="action === 'clip'" :class="$style.clip"><Paperclip :size="27" :stroke-width="2.7"/></span>
	<span v-if="action === 'favorite'" :class="$style.folder"><Folder :size="32" :stroke-width="2.2"/></span>
	<span v-if="action === 'edit'" :class="$style.pencil"><Pencil :size="25" :stroke-width="2.4"/></span>
	<span v-if="action === 'delete'" :class="$style.trash">
		<Trash2 :class="$style.trashBody" :size="30" :stroke-width="2.2"/>
		<Trash2 :class="$style.trashLid" :size="30" :stroke-width="2.2"/>
	</span>
	<span :class="$style.check"><Check :size="12" :stroke-width="3"/></span>
</span>
</template>

<script setup lang="ts">
import { Check, FileText, Folder, Paperclip, Pencil, Trash2 } from '@lucide/vue';

defineProps<{
	action: 'favorite' | 'clip' | 'edit' | 'delete';
	motion: boolean;
}>();
</script>

<style module lang="scss">
.root {
	position: relative;
	display: inline-block;
	flex: none;
	width: 56px;
	height: 44px;
	overflow: hidden;
	isolation: isolate;
	pointer-events: none;
}

// The favorite/delete window ends at y22, level with the folder mouth and
// trash lid. That clip conceals the paper through the hollow trash body.
// Layers: paper 1, receiving tool 2, completion check 4.
.paperWindow {
	position: absolute;
	inset: 0;
	z-index: 1;
	overflow: visible;
}

.paper {
	position: absolute;
	top: 7px;
	left: 13px;
	display: grid;
	place-items: center;
	width: 25px;
	height: 30px;
	color: var(--hata-toast-fg, var(--MI_THEME-fg));
	transform-origin: center center;
}

.paperIcon { display: block; }

.root[data-action='favorite'] .paperWindow,
.root[data-action='delete'] .paperWindow {
	inset: auto;
	top: 0;
	left: 19px;
	width: 27px;
	height: 22px;
	overflow: hidden;
}

.root[data-action='delete'] .paperWindow { left: 21.5px; }

.root[data-action='favorite'] .paper,
.root[data-action='delete'] .paper {
	top: 0;
	left: 3px;
	width: 20px;
	height: 22px;
	opacity: 0;
}

.clip,
.folder,
.pencil,
.trash {
	position: absolute;
	z-index: 2;
	display: grid;
	place-items: center;
	color: var(--MI_THEME-accent);
}

.clip {
	top: 1px;
	left: 25px;
	width: 28px;
	height: 30px;
	transform-origin: 50% 85%;
	transform: rotate(-19deg);
}

.folder {
	top: 12px;
	left: 16px;
	width: 32px;
	height: 30px;
	> svg { fill: var(--MI_THEME-accentedBg); }
}

.pencil {
	top: 3px;
	left: 26px;
	width: 26px;
	height: 26px;
	transform-origin: 35% 75%;
}

.trash {
	top: 13px;
	left: 19px;
	width: 31px;
	height: 30px;
	color: var(--hata-toast-fg, var(--MI_THEME-fg));
}

// Lucide trash-2 at 30px: its lid ends near local y9; the body starts there.
.trashBody,
.trashLid {
	position: absolute;
	top: 0;
	left: 0;
}

.trashBody {
	z-index: 1;
	clip-path: inset(9px 0 0 0);
}

.trashLid {
	z-index: 2;
	clip-path: inset(0 0 21px 0);
	transform-origin: 24px 8px;
}

.check {
	position: absolute;
	right: 0;
	bottom: 2px;
	z-index: 4;
	display: grid;
	place-items: center;
	width: 17px;
	height: 17px;
	border-radius: 50%;
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);
}

.root :is(.paper, .clip, .folder, .pencil, .trash, .check) > svg {
	display: block;
	flex: none;
	line-height: 1;
}

@media (prefers-reduced-motion: no-preference) {
	.root[data-motion='true'] .paper { animation: paperEnter .9s cubic-bezier(.22, 1, .36, 1) both; }
	.root[data-motion='true'] .clip { animation: clipOn .9s cubic-bezier(.22, 1, .36, 1) both; }
	.root[data-motion='true'] .check { animation: confirm .9s ease-out both; }
	.root[data-motion='true'][data-action='favorite'] .paper { animation-name: paperStore; }
	.root[data-motion='true'][data-action='favorite'] .folder { animation: folderReceive .9s cubic-bezier(.22, 1, .36, 1) both; }
	.root[data-motion='true'][data-action='edit'] .paper { animation-name: paperEdit; }
	.root[data-motion='true'][data-action='edit'] .pencil { animation: pencilWrite .9s cubic-bezier(.22, 1, .36, 1) both; }
	.root[data-motion='true'][data-action='delete'] .paper { animation-name: paperStore; animation-duration: 1.05s; }
	.root[data-motion='true'][data-action='delete'] .trashLid { animation: trashLidOpen 1.05s cubic-bezier(.22, 1, .36, 1) both; }
	.root[data-motion='true'][data-action='delete'] .check { animation: confirmLate 1.05s ease-out both; }
}

@keyframes paperEnter {
	0% { opacity: 0; transform: translate(-8px, 5px) rotate(-12deg) scale(.9); }
	22% { opacity: 1; transform: none; }
	100% { opacity: 1; transform: none; }
}

@keyframes clipOn {
	0%, 20% { opacity: 0; transform: translate(5px, -15px) rotate(-35deg) scale(.85); }
	44% { opacity: 1; transform: translate(1px, -4px) rotate(-24deg); }
	68% { opacity: 1; transform: translate(-1px, 2px) rotate(-10deg) scale(1.08, .92); }
	83% { opacity: 1; transform: translateY(-1px) rotate(-21deg) scale(.99, 1.03); }
	100% { opacity: 1; transform: rotate(-19deg); }
}

@keyframes paperStore {
	0% { opacity: 0; transform: translateY(-3px); }
	17%, 40% { opacity: 1; transform: none; }
	75% { opacity: 1; transform: translateY(22px); }
	78%, 100% { opacity: 0; transform: translateY(22px); }
}

@keyframes folderReceive {
	0%, 77%, 100% { transform: none; }
	87% { transform: translateY(1px) scale(1.02, .98); }
	94% { transform: translateY(-1px); }
}

@keyframes paperEdit {
	0%, 100% { opacity: 1; transform: none; }
	50% { opacity: 1; transform: translateY(2px); }
}

@keyframes pencilWrite {
	0%, 16% { opacity: 0; transform: translate(8px, -7px) rotate(10deg); }
	35% { opacity: 1; transform: translate(3px, -2px) rotate(-9deg); }
	55% { opacity: 1; transform: translate(-3px, 3px) rotate(6deg); }
	72%, 100% { opacity: 1; transform: none; }
}

@keyframes trashLidOpen {
	0% { transform: none; }
	22%, 80% { transform: translate(5px, -3px) rotate(65deg); }
	90%, 100% { transform: none; }
}

@keyframes confirm {
	0%, 80% { opacity: 0; transform: scale(.65); }
	100% { opacity: 1; transform: none; }
}

@keyframes confirmLate {
	0%, 92% { opacity: 0; transform: scale(.65); }
	100% { opacity: 1; transform: none; }
}
</style>
