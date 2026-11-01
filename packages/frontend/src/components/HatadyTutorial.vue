<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyTutorial
	:kind="kind" :pages="getHatadyTutorialPages(kind)"
	:title="kind === 'update' ? copy.titleUpdate : copy.titleInitial"
	:finishLabel="copy.finish" :completeOnDismiss="kind === 'initial'"
	:anchorElement="anchorElement" :cancelSignal="cancelSignal"
	@done="emit('done')" @closing="onClosing" @closed="emit('closed')"
>
	<template #headerAction>
		<button type="button" class="hy-icon-button" :aria-label="copy.chooseTheme" :disabled="savingTheme" @click="chooseTheme"><i class="ti ti-palette" aria-hidden="true"></i></button>
	</template>
	<template #example="{ page }"><HatadyTutorialExample :kind="kind" :page="page.id"/></template>
</HyTutorial>
</template>
<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import type { HatadyTutorialKind } from '@/utility/hatady-tutorial-content.js';
import type { HatadyTheme } from '@/utility/hatady-prefs.js';
import HyTutorial from '@/components/HyTutorial.vue';
import HatadyTutorialExample from '@/components/HatadyTutorialExample.vue';
import { getHatadyTutorialPages } from '@/utility/hatady-tutorial-content.js';
import { hatadyTheme, saveHatadyDisplay } from '@/utility/hatady-prefs.js';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import { useHataGoesPopupMenu } from '@/utility/hatagoes-popup.js';
import { i18n } from '@/i18n.js';

const copy = i18n.ts._hata._hatady._tutorial;

const popupMenu = useHataGoesPopupMenu();

withDefaults(defineProps<{ kind?: HatadyTutorialKind; anchorElement?: HTMLElement | null; cancelSignal?: AbortSignal }>(), { kind: 'initial', anchorElement: null });
const emit = defineEmits<{ done: []; closed: [] }>();
const savingTheme = ref(false);
let closing = false;

function onClosing() { closing = true; }

onUnmounted(onClosing);

async function chooseTheme(event: MouseEvent): Promise<void> {
	const options: { value: HatadyTheme; label: string }[] = [
		{ value: 'light', label: copy.themeLight },
		{ value: 'dark', label: copy.themeDark },
		{ value: 'paper', label: copy.themePaper },
		{ value: 'espresso', label: copy.themeEspresso },
		{ value: 'hataskey', label: copy.themeHataskey },
	];
	await popupMenu(
		options.map((option) => ({
			text: option.label,
			icon: hatadyTheme.value === option.value ? 'ti ti-check' : undefined,
			action: async () => {
				if (closing || savingTheme.value) return;
				savingTheme.value = true;
				try {
					await saveHatadyDisplay(option.value);
				} catch {
					hatadyNotify(copy.themeSaveFailed);
				} finally {
					savingTheme.value = false;
				}
			},
		})),
		event.currentTarget as HTMLElement,
	);
}

</script>
