<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyTutorial
	:kind="kind" :pages="getHataFeedTutorialPages(kind, isStaff)" :theme="hataFeedTheme"
	:title="kind === 'update' ? copy.updatedTitle : copy.title"
	:finishLabel="copy.finish" :anchorElement="anchorElement" :cancelSignal="cancelSignal"
	@done="emit('done')" @closed="emit('closed')"
>
	<template #headerAction><i class="ti ti-book" aria-hidden="true"></i></template>
	<template #example="{ page }"><HataFeedTutorialExample :page="page.id" :kind="kind" :isStaff="isStaff"/></template>
</HyTutorial>
</template>
<script setup lang="ts">
import type { HataFeedTutorialKind } from '@/utility/hatafeed-tutorial-content.js';
import HyTutorial from '@/components/HyTutorial.vue';
import HataFeedTutorialExample from '@/components/HataFeedTutorialExample.vue';
import { getHataFeedTutorialPages } from '@/utility/hatafeed-tutorial-content.js';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import { i18n } from '@/i18n.js';

const copy = i18n.ts._hata._hatafeed._tutorial;
withDefaults(defineProps<{ kind?: HataFeedTutorialKind; isStaff?: boolean; anchorElement?: HTMLElement | null; cancelSignal?: AbortSignal }>(), { kind: 'initial', isStaff: false, anchorElement: null });
const emit = defineEmits<{ done: []; closed: [] }>();
</script>
