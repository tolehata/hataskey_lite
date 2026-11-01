<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<span :class="$style.root" data-favorite-saved-animation :data-motion="motion" aria-hidden="true">
	<span :class="$style.note"><i class="ti ti-file-description" :class="$style.noteIcon"></i></span>
	<span :class="$style.folder">
		<i class="ti ti-folder-filled" :class="$style.folderIcon"></i>
		<i class="ti ti-check" :class="$style.complete"></i>
	</span>
</span>
</template>

<script setup lang="ts">
defineProps<{ motion: boolean }>();
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

.note {
	position: absolute;
	top: 2px;
	left: 8px;
	z-index: 1;
	width: 20px;
	height: 23px;
	border-radius: 3px;
	background: var(--MI_THEME-panel);
	color: var(--hata-toast-fg, var(--MI_THEME-fg));
	opacity: 0;
	transform: translate(17px, 17px) scale(.65);
}

// The filled foreground conceals the note as it enters the folder.
.folder {
	position: absolute;
	// Center the folder in the 44px canvas to align with the message.
	top: 6px;
	left: 17px;
	z-index: 2;
	width: 34px;
	height: 32px;
	color: var(--MI_THEME-accent);
	transform-origin: center bottom;
}

.root .noteIcon,
.root .folderIcon {
	display: grid;
	place-items: center;
	width: 100%;
	height: 100%;
	line-height: 1;
}

.noteIcon { font-size: 20px; }
.folderIcon { font-size: 34px; }

.root .complete {
	position: absolute;
	top: 13px;
	left: 10px;
	display: grid;
	place-items: center;
	width: 14px;
	height: 14px;
	font-size: 14px;
	line-height: 1;
	color: var(--MI_THEME-fgOnAccent);
}

.root .noteIcon::before,
.root .folderIcon::before,
.root .complete::before {
	font-size: 100%;
}

@media (prefers-reduced-motion: no-preference) {
	.root[data-motion='true'] .note {
		animation: fileNote .9s cubic-bezier(.22, 1, .36, 1) 1 both;
	}

	.root[data-motion='true'] .folder {
		animation: receiveNote .9s cubic-bezier(.22, 1, .36, 1) 1 both;
	}

	.root[data-motion='true'] .complete {
		animation: confirmSaved .9s ease-out 1 both;
	}
}

@keyframes fileNote {
	0% {
		opacity: 0;
		transform: translate(-5px, -3px) rotate(-18deg) scale(.94);
	}
	16% {
		opacity: 1;
		transform: translate(-2px, -1px) rotate(-14deg) scale(.94);
	}
	40% {
		opacity: 1;
		transform: translate(8px, 1px) rotate(-5deg) scale(.9);
	}
	66% {
		opacity: 1;
		transform: translate(17px, 17px) scale(.65);
	}
	76%, 100% {
		opacity: 0;
		transform: translate(17px, 17px) scale(.65);
	}
}

@keyframes receiveNote {
	0%, 42%, 100% { transform: none; }
	65% { transform: translateY(2px) scale(1.06, .93); }
	82% { transform: translateY(-1px) scale(.98, 1.04); }
}

@keyframes confirmSaved {
	0%, 70% { opacity: 0; transform: scale(.7); }
	100% { opacity: 1; transform: none; }
}
</style>
