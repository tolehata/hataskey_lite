<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(新デッキ): クリップ/お気に入りタブ用の薄いカラム。
  MkStreamingNotesTimeline は WebSocket ストリーミング前提で clips/notes や i/favorites には
  使えないため、Paginator + MkNote で描画する。favorites は要素が {note}[] なので unwrap する。
-->
<template>
<MkFavoriteFolders v-if="endpoint === 'i/favorites'" ref="favoritesRef" deck/>
<div v-else :class="$style.root">
	<div :class="[$style.notes, '_gaps']" :data-deck-ui="'on'">
		<MkPagination v-if="paginator" :key="paginatorKey" :paginator="paginator">
			<template #empty>
				<div :class="$style.empty"><i class="ti ti-note-off"></i> {{ i18n.ts.noNotes }}</div>
			</template>
			<template #default="{ items }">
				<MkNote
					v-for="item in items"
					:key="item.id"
					:note="unwrap(item)"
					:class="$style.note"
				/>
			</template>
		</MkPagination>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, markRaw, shallowRef, watch, useTemplateRef } from 'vue';
import MkFavoriteFolders from '@/components/MkFavoriteFolders.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkNote from '@/components/MkNote.vue';
import { Paginator } from '@/utility/paginator.js';
import { i18n } from '@/i18n.js';

const props = defineProps<{
	endpoint: 'clips/notes' | 'i/favorites';
	clipId?: string;
}>();

const favoritesRef = useTemplateRef('favoritesRef');

type DeckPaginator = Paginator<'clips/notes'> | Paginator<'i/favorites'>;
const paginator = shallowRef<DeckPaginator | null>(null);
const paginatorKey = shallowRef(0);

function build() {
	if (props.endpoint === 'clips/notes') {
		if (!props.clipId) { paginator.value = null; return; }
		paginator.value = markRaw(new Paginator('clips/notes', {
			limit: 20,
			computedParams: computed(() => ({ clipId: props.clipId! })),
		}));
	} else {
		paginator.value = null;
	}
	paginatorKey.value++;
}

watch(() => [props.endpoint, props.clipId], build, { immediate: true });

// i/favorites は要素が NoteFavorite ({ id, note, ...})、clips/notes は Note を直接返す。
function unwrap(item: any) {
	return item && typeof item === 'object' && 'note' in item ? item.note : item;
}

// 旗鯖fork: hatasaba-deck.vue の三点メニュー / カラムヘッダのリロードボタンから呼ばれる。
//   paginator を作り直して初期ページを再取得する (build() が paginatorKey を increment し
//   MkPagination の :key に反映されるので、内部状態も含めて全リセットされる)。
async function reload(): Promise<void> {
	if (props.endpoint === 'i/favorites') {
		await favoritesRef.value?.reload();
	} else {
		build();
	}
}

function manageFolder(anchor?: EventTarget | null) { favoritesRef.value?.manageFolder(anchor); }

defineExpose({ reload, manageFolder });
</script>

<style lang="scss" module>
/* 旗鯖fork: MkStreamingNotesTimeline と同じくコンテナクエリスコープを与える。
   これが無いと MkNote 側の @container クエリが親コンテナ幅に反応できず、詰まった
   見た目のブレークポイントで描画され「一回り大きく」見えてしまう。 */
.root {
	height: 100%;
	overflow-y: auto;
}
.notes {
	container-type: inline-size;
	background: var(--MI_THEME-bg);
	min-height: 100%;
}
/* 旗鯖fork(Hataskey UI 2): グラス表示時はコンテナ塗りを透明化して、デッキ背景ぼかしを
   透かす。ここで bg を付けたままだと MkNote の透過が意味を成さず不透明に見える。 */
:global(html.hataGlassUi) .notes {
	background: transparent;
}
.empty {
	padding: 24px 12px;
	text-align: center;
	opacity: 0.6;
	font-size: 0.9em;
}
/* 旗鯖fork: 明示的な background/border-radius は付けない
   (glass 系グローバル CSS と競合し、透過が効かなくなる)。
   MkNote 側の .root/.article が持つデフォルトスタイルにレイアウトを任せる。 */
.note { }
</style>
