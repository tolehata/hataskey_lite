<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<MkModal ref="modal" preferType="dialog" :returnFocusTo="returnFocusTo" @click="finish(false)" @esc="finish(false)" @closed="emit('closed')">
	<section class="hatady-scope hatafeed-scope" :data-hatady-theme="hataFeedTheme" :class="$style.prompt" role="alertdialog" aria-modal="true" :aria-labelledby="titleId" :aria-describedby="descriptionId">
		<h2 :id="titleId">入力した内容をどうする？</h2><p :id="descriptionId">編集中の内容は、このウィンドウに残っています</p>
		<p v-if="error" role="alert">{{ error }}</p>
		<div :class="$style.actions"><button type="button" class="hy-primary" @click="leave(true)">端末に下書きを保存して閉じる</button><button type="button" class="hy-secondary" @click="leave(false)">保存せず閉じる</button><button type="button" class="hy-secondary" @click="finish(false)">編集に戻る</button></div>
	</section>
</MkModal>
</template>
<script setup lang="ts">
import { ref, useId, useTemplateRef } from 'vue';
import MkModal from '@/components/MkModal.vue';
import { hataFeedTheme } from '@/utility/hatasaba-device-prefs.js';
import '@/components/hatafeed-ui.css';
const props = defineProps<{ save: () => boolean; discard: () => boolean; returnFocusTo: HTMLElement | null }>();
const emit = defineEmits<{ done: [leave: boolean]; closed: [] }>();
const modal = useTemplateRef('modal');
const titleId = useId();
const descriptionId = useId();
const error = ref('');
let finished = false;

function finish(leave: boolean) { if (finished) return; finished = true; emit('done', leave); modal.value?.close(); }

function leave(save: boolean) {
	try {
		if (!(save ? props.save() : props.discard())) { error.value = '下書きを保存・削除できませんでした。編集に戻って再試行してください'; return; }
		finish(true);
	} catch { error.value = '下書きを更新できませんでした'; }
}
</script>
<style module>
.prompt { box-sizing: border-box; margin: auto; width: 430px; max-width: 100%; max-height: 100%; overflow-y: auto; padding: 26px; text-align: center; color: var(--hy-ink); background: var(--hy-surface); border: 1px solid var(--hy-border); border-radius: 24px; box-shadow: var(--hy-shadow); }
.prompt h2 { margin: 0 0 14px; font-size: 20px; }
.prompt p { color: var(--hy-muted); font-size: 13px; }
.actions { display: grid; gap: 10px; margin-top: 22px; }
</style>
