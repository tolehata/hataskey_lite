<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
	MkTrendingTimeline.vue (旗鯖fork 独自実装)

	トレンドタイムライン (TTL) 専用のフロントコンポーネント。

	===== 仕様 =====

	- 過去 7 日間のリアクション/リノートが多いノートを Top 100 から
	  seed で固定シャッフルした順序で表示
	- offsetMode の Paginator で 20 件ずつページング
	- 引っ張って更新で新しい seed を生成して reload (再集計+シャッフル)
	- 30 秒ごとに /api/notes/trending/check-new をポーリングし、
	  新規ランクインがあれば「N 件の新しいトレンドノートがあります」バー表示

	===== 設計 =====

	- MkStreamingNotesTimeline と同じ data-* 属性 (bubble/glass-bg/hatasaba-normal/
	  classic-spacing/spacing) をノートの「実際の flex 親コンテナ」に付与するため、
	  MkNotesTimeline は使わず MkPagination + MkNote のループをインライン展開する。
	  MkNotesTimeline 経由だとその内部の .root div に属性が届かず、
	  `[data-classic-spacing="on"] > div` などの直下セレクタが機能せず、
	  ノート間隔が広いまま + 通常表示の一体化スタイルが効かない。
	- Streaming は使わない (TTL はスナップショット形式のため)
-->

<template>
<div :class="$style.root">
	<!-- 新規ランクイン通知バー -->
	<div v-if="!newNotesInNavbar && newCount > 0" :class="$style.newBanner" @click="reloadWithNewSeed">
		<i class="ti ti-flame"></i>
		<span>{{ i18n.tsx._trending.newNotesAvailable({ n: newCount }) }}</span>
	</div>

	<!-- 旗鯖fork: pagination をインライン展開。ノートリストの直接の flex 親 (.notes) に
	     MkStreamingNotesTimeline と同じ data-* 属性を付けることで、グローバル CSS の
	     直下セレクタ (`> div`) や `article > div` などが両方効くようにする。 -->
	<MkPagination :paginator="paginator" :withControl="false" :onRefresh="reloadWithNewSeed">
		<template #empty><MkResult type="empty" :text="i18n.ts.noNotes"/></template>
		<template #default="{ items }">
			<div
				:class="[$style.notes, '_gaps']"
				:data-bubble="bubbleEnabled ? 'on' : undefined"
				:data-glass-bg="props.glassBg ? 'on' : undefined"
				:data-hatasaba-normal="isHatasabaNormal ? 'on' : undefined"
				:data-classic-spacing="classicSpacingEnabled ? 'on' : undefined"
				:data-spacing="noteSpacingValue"
			>
				<MkNote v-for="note in items" :key="note.id" :note="note" :withHardMute="true"/>
			</div>
		</template>
	</MkPagination>
</div>
</template>

<script lang="ts" setup>
import { markRaw, ref, computed, onMounted, onUnmounted } from 'vue';
import MkPagination from '@/components/MkPagination.vue';
import MkNote from '@/components/MkNote.vue';
// MkResult は components/global 配下で自動登録されているので import 不要 (favorites.vue と同様)。
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { Paginator } from '@/utility/paginator.js';
import { prefer } from '@/preferences.js';
import { miLocalStorage } from '@/local-storage.js';
import { useHataskeyTimelineNewNotes } from '@/utility/hataskey-timeline-new-notes.js';

const props = withDefaults(defineProps<{
	// 旗鯖fork: 通常表示タイムラインの背景ぼかしが敷かれている時、simple.vue から true が渡る。
	// MkStreamingNotesTimeline と同じ data-glass-bg を出してノートカード面を半透明化する。
	glassBg?: boolean;
	newNotesNavbarKey?: string;
}>(), {
	glassBg: false,
});

const POLL_INTERVAL_MS = 30 * 1000; // 30 秒ごとに新規ランクインをチェック

// 旗鯖fork: MkStreamingNotesTimeline と同じロジックで、Hataskey UI (ui='simple') / デッキ判定と
// 派生 computed (bubbleEnabled / classicSpacingEnabled / noteSpacingValue / isHatasabaNormal) を出す。
const currentUi = miLocalStorage.getItem('ui');
const isDeckUi = currentUi === 'deck';
const isDefaultUi = currentUi === 'default';
const isHatasabaDeck = computed(() => currentUi === 'simple' && (prefer.r['simpleUi.deckMode']?.value ?? false));
const isHatasabaNormal = computed(() => currentUi === 'simple' && !(prefer.r['simpleUi.deckMode']?.value ?? false));
const bubbleEnabled = computed(() => {
	// 旗鯖fork: 従来デッキUI / Misskey(デフォルト)UI は常にクラシック表示(吹き出しなし)に固定。
	if (isDeckUi) return false;
	if (isDefaultUi) return false;
	// Hataskey UI デッキの「ノートの簡易表示を無効にする」(ON=吹き出しOFF)。キー・挙動は従来どおり。
	if (isHatasabaDeck.value && prefer.r['simpleUi.disableBubbleInHatasabaDeck']?.value) return false;
	// Hataskey UI 通常モードは常に吹き出し表示。
	return true;
});
const isHatasaba = currentUi === 'simple';
const classicSpacingEnabled = computed(() => {
	if (isHatasaba || isDefaultUi) return true;
	return prefer.r['simpleUi.classicNoteSpacing']?.value ?? false;
});
const noteSpacingValue = computed(() => {
	if (isDeckUi) return 'wide';
	const v = prefer.r['simpleUi.noteSpacing']?.value ?? 'moderate';
	const deckMode = prefer.r['simpleUi.deckMode']?.value ?? false;
	if (currentUi === 'simple' && !deckMode && v === 'compact') return 'moderate';
	return v;
});

// seed はクライアント側で生成・保持 (同じ seed で同じシャッフル順を再現)
function generateSeed(): number {
	return Math.floor(Math.random() * 0x7FFFFFFF) + 1;
}
const currentSeed = ref<number>(generateSeed());
const newCount = ref<number>(0);
const newNotesInNavbar = useHataskeyTimelineNewNotes(() => props.newNotesNavbarKey, () => newCount.value > 0 ? {
	text: i18n.tsx._trending.newNotesAvailable({ n: newCount.value }),
	icon: 'ti ti-flame',
	show: reloadWithNewSeed,
} : null);

const knownNoteIds = ref<Set<string>>(new Set());
let pollTimer: ReturnType<typeof setInterval> | null = null;

// offsetMode の Paginator (explore.featured.vue と同じパターン)
// 注: notes/trending は旗鯖fork 独自エンドポイントのため、cherrypick-js の autogen 型定義に
//     まだ含まれていない。pnpm build で型再生成するまでは型制約を満たさないため、
//     ここでは endpoint 名を型キャストして Paginator に渡す (vite build は型チェックしないので実行時は問題なし)。
const paginator = markRaw(new Paginator('notes/trending' as 'notes/featured', {
	limit: 20,
	offsetMode: true,
	params: () => ({
		seed: currentSeed.value,
	}) as never,
}));

/**
 * 引っ張って更新 / 新規ランクインバー押下時:
 * 新しい seed を生成して再集計+シャッフルし直す
 *
 * 外部影響: なし (Redis 再集計のみ、ActivityPub fetch は発生しない)
 */
async function reloadWithNewSeed() {
	currentSeed.value = generateSeed();
	newCount.value = 0;
	await paginator.reload();
	await refreshKnownIds();
}

/**
 * 現在の Top 100 のノート ID を取得して保持する (新規ランクイン検出の基準用)
 */
async function refreshKnownIds() {
	try {
		const res = await (misskeyApi as any)('notes/trending/check-new', {}) as { topNoteIds: string[]; newCount: number };
		knownNoteIds.value = new Set(res.topNoteIds);
	} catch {
		// 失敗しても致命的ではない
	}
}

/**
 * 30 秒ごとのポーリング: 新規ランクイン件数を取得
 * 軽量 API (Redis 読み取りのみ、DB 触らない)
 */
async function pollNewNotes() {
	try {
		const res = await (misskeyApi as any)('notes/trending/check-new', {
			knownIds: Array.from(knownNoteIds.value),
		}) as { topNoteIds: string[]; newCount: number };
		newCount.value = res.newCount;
	} catch {
		// ポーリングエラーは無視 (次回リトライ)
	}
}

onMounted(async () => {
	await refreshKnownIds();
	pollTimer = setInterval(pollNewNotes, POLL_INTERVAL_MS);
});

onUnmounted(() => {
	if (pollTimer != null) clearInterval(pollTimer);
});

defineExpose({
	reload: reloadWithNewSeed,
});
</script>

<style lang="scss" module>
.root {
	position: relative;
}

/* MkStreamingNotesTimeline の .notes と同じ役割: 実際の flex 親コンテナ。
   ここに data-* 属性を付けることで、`[data-classic-spacing="on"] > div` などの
   直下セレクタを含む一連のグローバル CSS が正しく発火する。 */
.notes {
	container-type: inline-size;
}

.newBanner {
	position: sticky;
	top: 0;
	z-index: 10;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 10px 16px;
	margin-bottom: var(--MI-margin);
	background: var(--MI_THEME-accent);
	color: #fff;
	font-size: 0.9em;
	font-weight: 600;
	border-radius: var(--MI-radius);
	cursor: pointer;
	transition: opacity 0.2s;

	&:hover {
		opacity: 0.85;
	}

	> i {
		font-size: 1.1em;
	}
}
</style>
