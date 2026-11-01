<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<h2 class="welcome-section-title welcome-hatady-heading" data-no-split="" data-symbol-heading="" aria-label="学びも、趣味も、日々のことも。自分のペースで、残していく。" data-aria-en="Learning, hobbies, everyday life. Keep a record at your own pace.">
	<span v-for="copy in copies" :key="copy.lang" class="symbol-copy" :data-symbol-lang="copy.lang" aria-hidden="true">
		<span v-for="(word, index) in copy.words" :key="word" class="symbol-phrase"><span class="symbol-swap welcome-hatady-symbol" :data-motif="motifs[index]" :style="{ '--symbol-delay': `${index * .72 + .1}s` }"><span class="symbol-icon" aria-hidden="true">
			<svg v-if="index === 0" class="welcome-book" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8C12 5 7 5 3 6v20c4-1 9-1 13 2 4-3 9-3 13-2V6c-4-1-9-1-13 2v20"/><path d="M7 11c2-.2 4 .1 6 1M7 16c2-.2 4 .1 6 1M20 12c2-.9 4-1.2 6-1"/><path class="welcome-book-page" d="M16 8c4-3 9-3 13-2v20c-4-1-9-1-13 2Z"/></svg>
			<svg v-else-if="index === 1" class="welcome-runner" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><g class="welcome-runner-body"><circle cx="20" cy="5" r="2.5"/><path d="m17 10-4 10"/><path class="welcome-runner-arm-back" d="m17 10-6 2-3 5"/><path class="welcome-runner-arm-front" d="m17 10 4 6 6-1"/><path class="welcome-runner-leg-back" d="m13 20-4 5-6-2"/><path class="welcome-runner-leg-front" d="m13 20 7 2-2 7"/></g><path class="welcome-runner-ground" d="M5 30h5m5 0h8"/></svg>
			<svg v-else class="welcome-calendar" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="24" height="23" rx="3"/><path d="M10 3v6M22 3v6M4 12h24"/><path d="M10 17h3m6 0h3m-12 5h3m6 0h3"/><g class="welcome-calendar-page welcome-calendar-page-back"><path d="M5 12h22v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z"/><path d="M12 17h8m-8 5h5"/></g><g class="welcome-calendar-page welcome-calendar-page-front"><path d="M5 12h22v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z"/><path d="M12 17h5m-5 5h8"/></g></svg>
		</span><span class="symbol-text" :data-symbol-last="index === 2 ? '' : undefined">{{ word }}</span></span>{{ copy.suffixes[index] }}</span><br>{{ copy.end }}
	</span>
</h2>
</template>
<script setup lang="ts">
const motifs = ['book', 'runner', 'calendar'];
const copies = [
	{ lang: 'ja', words: ['学び', '趣味', '日々'], suffixes: ['も、', 'も、', 'のことも。'], end: '自分のペースで、残していく。' },
	{ lang: 'en', words: ['Learning', 'hobbies', 'everyday life'], suffixes: [', ', ', ', '.'], end: 'Keep a record at your own pace.' },
];
</script>
