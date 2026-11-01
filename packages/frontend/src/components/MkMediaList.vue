<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :class="$style.root">
	<XBanner v-for="media in medias.nonPreviewable" :key="media.id" :media="media"/>
	<div v-if="count > 0" :class="$style.container">
		<div
			ref="gallery"
			:class="[
				$style.medias,
				count === 1 ? [$style.n1, {
					[$style.n116_9]: singleImageRatio == null && prefer.s.mediaListWithOneImageAppearance === '16_9',
					[$style.n11_1]: singleImageRatio == null && prefer.s.mediaListWithOneImageAppearance === '1_1',
					[$style.n12_3]: singleImageRatio == null && prefer.s.mediaListWithOneImageAppearance === '2_3',
				}] : count === 2 ? $style.n2 : count === 3 ? $style.n3 : count === 4 ? $style.n4 : $style.nMany,
				singleImageRatio != null && $style.fitSingleImage,
			]"
			:style="galleryStyle"
		>
			<template v-for="media in medias.previewable">
				<XAudio
					v-if="media.type.startsWith('audio')"
					:key="`audio:${media.id}`"
					:ref="(comp) => { mediaComponents.set(media.id, comp as InstanceType<typeof XAudio> | null); }"
					:class="$style.media"
					:audio="media"
					@mediaClick="onMediaClick(media)"
				/>
				<XVideo
					v-if="media.type.startsWith('video')"
					:key="`video:${media.id}`"
					:ref="(comp) => { mediaComponents.set(media.id, comp as InstanceType<typeof XVideo> | null); }"
					:class="$style.media"
					:video="media"
					:disableRightClick="disableRightClick"
					@mediaClick="onMediaClick(media)"
				/>
				<XImage
					v-else-if="media.type.startsWith('image')"
					:key="`image:${media.id}`"
					:ref="(comp) => { mediaComponents.set(media.id, comp as InstanceType<typeof XImage> | null); }"
					:marker="`${markerId}:${media.id}`"
					:disableImageLink="true"
					:disableRightClick="disableRightClick"
					:class="$style.media"
					:image="media"
					:raw="raw"
					@mediaClick="onMediaClick(media)"
				/>
			</template>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, markRaw, onUnmounted, useTemplateRef } from 'vue';
import * as Misskey from 'cherrypick-js';
import type { Content } from '@/components/MkLightbox.item.vue';
import type { MediaComponentExposes } from '@/types/media-component.js';
import XBanner from '@/components/MkMediaBanner.vue';
import XAudio from '@/components/MkMediaAudio.vue';
import XImage from '@/components/MkMediaImage.vue';
import XVideo from '@/components/MkMediaVideo.vue';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { isPreviewable, getType } from '@/utility/lightbox.js';
import { genId } from '@/utility/id.js';

const props = defineProps<{
	mediaList: Misskey.entities.DriveFile[];
	user?: Misskey.entities.User | null; // DriveFileのuserはnullになることがある。その場合に使用する所有者情報
	raw?: boolean;
	disableRightClick?: boolean;
	fitSingleImage?: boolean;
}>();

const gallery = useTemplateRef('gallery');
const medias = computed(() => {
	const previewable: Misskey.entities.DriveFile[] = [];
	const nonPreviewable: Misskey.entities.DriveFile[] = [];
	for (const file of props.mediaList) {
		if (isPreviewable(file.type)) {
			previewable.push(file);
		} else {
			nonPreviewable.push(file);
		}
	}

	return {
		previewable,
		nonPreviewable,
	};
});
const mediaComponents = new Map<string, MediaComponentExposes | null>();
const count = computed(() => medias.value.previewable.length);
const markerId = genId();

const singleImageRatio = computed(() => {
	if (!props.fitSingleImage || props.mediaList.length !== 1) return null;
	const image = props.mediaList[0];
	if (!image.type.startsWith('image/') || !isPreviewable(image.type)) return null;
	const { width, height } = image.properties;
	if (typeof width !== 'number' || typeof height !== 'number' || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
	const ratio = width / height;
	return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
});

const galleryStyle = computed(() => {
	if (singleImageRatio.value != null) return { '--media-ratio': singleImageRatio.value.toString() };
	if (props.mediaList.length !== 1) return undefined;
	const { width, height } = props.mediaList[0].properties;
	if (!width || !height) return undefined;
	const ratio = width / height;
	switch (prefer.s.mediaListWithOneImageAppearance) {
		case '16_9': return { aspectRatio: `${Math.max(16 / 9, ratio)} / 1` };
		case '1_1': return { aspectRatio: `${Math.max(1, ratio)} / 1` };
		case '2_3': return { aspectRatio: `${Math.max(2 / 3, ratio)} / 1` };
		default: return undefined;
	}
});

onUnmounted(() => {
	mediaComponents.clear();
});

function onMediaClick(file: Misskey.entities.DriveFile) {
	if (prefer.s.imageNewTab) {
		window.open(file.url, '_blank');
		return;
	}
	openGallery(file.id);
}

async function openGallery(id?: string) {
	if (id == null) {
		const firstImage = medias.value.previewable[0];
		if (firstImage == null) return;
		id = firstImage.id;
	}

	const getElementByMarker = (marker: string) => {
		if (gallery.value == null) return null;
		const found = gallery.value.querySelector(`[data-marker="${marker}"]`) as HTMLElement | null;
		if (found == null) return null;
		return markRaw(found);
	};

	const contents = medias.value.previewable.map<Content>(media => ({
		id: media.id,
		type: getType(media.type),
		url: media.url,
		thumbnailUrl: media.thumbnailUrl,
		width: media.properties.width,
		height: media.properties.height,
		filename: media.name,
		file: media,
		sourceElement: getElementByMarker(`${markerId}:${media.id}`),
		disableRightClick: props.disableRightClick,
	}));

	const initiallyRevealedContentIds = contents
		.filter(content => mediaComponents.get(content.id)?.isRevealed() === true)
		.map(content => content.id);

	const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkLightbox.vue').then(x => x.default), {
		defaultIndex: contents.findIndex(conten => conten.id === id),
		contents: contents,
		initiallyRevealedContentIds,
		user: props.user,
	}, {
		closed: () => dispose(),
	});
}

defineExpose({
	openGallery,
});
</script>

<style lang="scss" module>
.container {
	position: relative;
	width: 100%;
}

.medias {
	display: grid;
	grid-gap: 8px;

	height: 100%;
	width: 100%;

	&.n1 {
		grid-template-rows: 1fr;

		// default but fallback (expand)
		min-height: 64px;
		max-height: clamp(
			64px,
			50cqh,
			min(360px, 50vh)
		);

		&.n116_9 {
			min-height: initial;
			max-height: initial;
			aspect-ratio: 16 / 9; // fallback
		}

		&.n11_1{
			min-height: initial;
			max-height: initial;
			aspect-ratio: 1 / 1; // fallback
		}

		&.n12_3 {
			min-height: initial;
			max-height: initial;
			aspect-ratio: 2 / 3; // fallback
		}
	}

	&.fitSingleImage {
		width: min(100%, calc(clamp(64px, 50cqh, min(360px, 50vh)) * var(--media-ratio)));
		height: auto;
		min-height: 0;
		max-height: clamp(64px, 50cqh, min(360px, 50vh));
		aspect-ratio: var(--media-ratio);
	}

	&.n2 {
		aspect-ratio: 16/9;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr;
	}

	&.n3 {
		aspect-ratio: 16/9;
		grid-template-columns: 1fr 0.5fr;
		grid-template-rows: 1fr 1fr;

		> .media:nth-child(1) {
			grid-row: 1 / 3;
		}

		> .media:nth-child(3) {
			grid-column: 2 / 3;
			grid-row: 2 / 3;
		}
	}

	&.n4 {
		aspect-ratio: 16/9;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
	}

	&.nMany {
		grid-template-columns: 1fr 1fr;

		> .media {
			aspect-ratio: 16/9;
		}
	}
}

.media {
	overflow: hidden; // clipにするとバグる
	border-radius: 8px;
	cursor: zoom-in;
}
</style>
