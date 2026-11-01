<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<article class="welcome-note public-note" role="listitem" :data-note-id="note.id">
	<a class="public-note-avatar" :href="`${PUBLIC_SERVER}/@${encodeURIComponent(note.user.username)}`" target="_blank" rel="noopener noreferrer" :aria-label="note.user.name">
		<img v-if="note.user.avatarUrl && !avatarFailed" :src="note.user.avatarUrl" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="avatarFailed = true"><span v-else aria-hidden="true">{{ note.user.name.slice(0, 1) }}</span>
	</a>
	<div class="welcome-note-body">
		<div class="welcome-note-meta"><strong><Mfm :plain="true" :text="note.user.name"/></strong><span>@{{ note.user.username }}</span><a :href="noteUrl" target="_blank" rel="noopener noreferrer" :aria-label="`${note.user.name}の投稿を開く`"><time :datetime="note.createdAt" :title="note.createdAt">{{ dateLabel }}</time><i class="ti ti-arrow-up-right" aria-hidden="true"></i></a></div>
		<details v-if="note.cw !== null" class="public-note-warning" @toggle="contentOpen = ($event.target as HTMLDetailsElement).open"><summary>{{ note.cw || '内容の注意書き' }}</summary><p v-if="contentOpen"><Mfm :plain="true" :text="note.text"/></p></details>
		<p v-else-if="note.text"><Mfm :plain="true" :text="note.text"/></p>
		<div v-if="note.files.length && (note.cw === null || contentOpen)" class="public-note-files">
			<template v-for="file in note.files" :key="file.id">
				<details v-if="file.isSensitive" class="public-sensitive-file" @toggle="visibleFiles[file.id] = ($event.target as HTMLDetailsElement).open"><summary><i class="ti ti-eye-off" aria-hidden="true"></i> 閲覧注意のファイル</summary><a v-if="visibleFiles[file.id]" :href="file.url" target="_blank" rel="noopener noreferrer"><img v-if="file.type.startsWith('image/')" :src="file.thumbnailUrl || file.url" :alt="file.comment || file.name" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span v-else>{{ file.name }}</span></a></details>
				<a v-else :href="file.url" target="_blank" rel="noopener noreferrer" class="public-file-link"><img v-if="file.type.startsWith('image/') && !failedFiles[file.id]" :src="file.thumbnailUrl || file.url" :alt="file.comment || file.name" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="failedFiles[file.id] = true"><span v-else><i :class="file.type.startsWith('video/') ? 'ti ti-movie' : file.type.startsWith('audio/') ? 'ti ti-music' : 'ti ti-file'" aria-hidden="true"></i>{{ file.name }}</span></a>
			</template>
		</div>
		<div v-if="note.reactions.length" class="welcome-reactions" aria-label="リアクション">
			<span v-for="reaction in note.reactions" :key="reaction.name" class="welcome-reaction" :aria-label="`${reaction.name} ${reaction.count}件`" :title="reaction.name"><img v-if="reaction.image && !failedReactions[reaction.name]" :src="reaction.image" :alt="reaction.name" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="failedReactions[reaction.name] = true"><span v-else aria-hidden="true">{{ reaction.name }}</span><b>{{ reaction.count }}</b></span>
		</div>
	</div>
</article>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { url as PUBLIC_SERVER } from '@@/js/config.js';
import type { WelcomePublicNote as PublicNote } from '@/utility/welcome-public-notes.js';
import Mfm from '@/components/global/MkMfm.js';
const props = defineProps<{ note: PublicNote }>();
const contentOpen = ref(false), avatarFailed = ref(false);
const visibleFiles = reactive<Record<string, boolean>>(Object.create(null)), failedFiles = reactive<Record<string, boolean>>(Object.create(null)), failedReactions = reactive<Record<string, boolean>>(Object.create(null));
const noteUrl = computed(() => `${PUBLIC_SERVER}/notes/${props.note.id}`);
const dateLabel = computed(() => { const d = new Date(props.note.createdAt); return Number.isFinite(d.getTime()) ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '投稿を開く'; });
</script>
