<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<fieldset :class="$style.root">
	<legend>{{ label }}<small>{{ i18n.tsx._hata._hatady._imageAttachments.attachmentCount({ count: String(files.length) }) }}</small></legend>
	<div v-if="files.length" :class="$style.images">
		<div v-for="file in files" :key="file.id" :class="$style.image">
			<MkDriveFileThumbnail :file="file" fit="contain" :highlightWhenSensitive="true" :class="$style.thumbnail"/>
			<button type="button" class="hy-icon-button" :class="$style.remove" :aria-label="i18n.tsx._hata._hatady._imageAttachments.remove({ name: file.name })" @click="files = files.filter(item => item.id !== file.id)"><i class="ti ti-x" aria-hidden="true"></i></button>
		</div>
	</div>
	<div :class="$style.actions">
		<button type="button" class="hy-secondary" :disabled="files.length >= 16" @click="add(false)"><i class="ti ti-photo-plus" aria-hidden="true"></i>{{ copy.add }}</button>
		<button type="button" class="hy-secondary" :disabled="files.length >= 16" @click="add(true)"><i class="ti ti-cloud" aria-hidden="true"></i>{{ copy.fromDrive }}</button>
	</div>
	<p v-if="error" role="alert" :class="$style.error">{{ error }}</p>
</fieldset>
</template>

<script setup lang="ts">
import { onScopeDispose, ref } from 'vue';
import type * as Misskey from 'cherrypick-js';
import MkDriveFileThumbnail from '@/components/MkDriveFileThumbnail.vue';
import { useHataGoesPickers } from '@/utility/hatagoes-pickers.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

const copy = i18n.ts._hata._hatady._imageAttachments;
const { selectDriveFiles } = useHataGoesPickers();

const files = defineModel<Misskey.entities.DriveFile[]>({ required: true });
defineProps<{ label: string }>();
const error = ref('');
let active = true;
onScopeDispose(() => { active = false; });

async function add(fromDrive: boolean): Promise<void> {
	error.value = '';
	try {
		let selected: Misskey.entities.DriveFile[];
		if (fromDrive) {
			selected = await selectDriveFiles({ multiple: true });
		} else {
			const picked = await os.chooseFileFromPc({ multiple: true, accept: 'image/*' });
			if (!active || !picked.length) return;
			const images = picked.filter(file => file.type.startsWith('image/'));
			if (images.length !== picked.length) error.value = copy.imageOnlyError;
			const remaining = 16 - files.value.length;
			if (images.length > remaining) error.value = copy.limitError;
			if (!images.length || remaining <= 0) return;
			selected = await os.launchUploader(images.slice(0, remaining));
		}
		if (!active) return;
		const images = selected.filter(file => file.type.startsWith('image/'));
		if (images.length !== selected.length) error.value = copy.imageOnlyError;
		const combined = new Map(files.value.map(file => [file.id, file]));
		for (const file of images) combined.set(file.id, file);
		if (combined.size > 16) error.value = copy.limitError;
		files.value = [...combined.values()].slice(0, 16);
	} catch (reason) {
		if (active && reason != null) error.value = copy.addFailed;
	}
}
</script>

<style lang="scss" module>
.root { min-width: 0; border: 0; margin: 0; padding: 0; }
.root legend { margin-bottom: 10px; padding: 0; font-size: 14px; font-weight: 700; }
.root small { margin-left: 7px; font-size: 12px; font-weight: 400; color: var(--hy-muted); }
.images { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; margin-bottom: 12px; }
.image { position: relative; min-width: 0; }
.thumbnail { width: 100%; aspect-ratio: 1; border-radius: 16px; }
.image .remove { position: absolute; top: 2px; right: 2px; background: var(--hy-surface); color: var(--hy-ink); border: 1px solid var(--hy-border); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.error { margin: 10px 0 0; color: var(--hy-muted); font-size: 13px; line-height: 1.6; }
</style>
