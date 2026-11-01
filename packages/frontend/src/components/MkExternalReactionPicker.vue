<!--
SPDX-FileCopyrightText: Tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
外部サーバー専用リアクションピッカー
- ピル型グラスモーフィズムデザイン（シンプルTLナビバーと統一）
- 外部サーバーのカスタム絵文字を emojis API から取得して表示
- Unicode絵文字も選択可能
- カテゴリ別表示・検索機能付き
-->

<template>
<MkModal
	ref="modal"
	v-slot="{ type, maxHeight }"
	:zPriority="'middle'"
	:preferType="'popup'"
	:transparentBg="true"
	:anchorElement="anchorElement"
	@click="close()"
	@closed="emit('closed')"
>
	<div :class="[$style.root, isDark ? $style.rootDark : $style.rootLight, { [$style.drawer]: type === 'drawer' }]" :style="{ maxHeight: maxHeight ? Math.min(maxHeight, 320) + 'px' : '320px' }" @click.stop>
		<!-- 検索バー -->
		<div :class="$style.searchBox">
			<i class="ti ti-search" :class="$style.searchIcon"></i>
			<input
				ref="searchEl"
				v-model="searchQuery"
				:class="$style.searchInput"
				type="search"
				:placeholder="copy.searchPlaceholder"
				autocomplete="off"
			/>
			<button v-if="searchQuery" :class="$style.searchClear" class="_button" @click="searchQuery = ''">
				<i class="ti ti-x"></i>
			</button>
		</div>

		<!-- タブ切り替え（ピル型） -->
		<div :class="$style.tabBar">
			<div :class="$style.tabPill">
				<button
					:class="[$style.tabBtn, { [$style.tabActive]: activeTab === 'recent' }]"
					@click="activeTab = 'recent'"
				>
					<i class="ti ti-clock"></i>
				</button>
				<button
					:class="[$style.tabBtn, { [$style.tabActive]: activeTab === 'favorites' }]"
					@click="activeTab = 'favorites'"
				>
					<i class="ti ti-star"></i>
				</button>
				<button
					:class="[$style.tabBtn, { [$style.tabActive]: activeTab === 'custom' }]"
					@click="activeTab = 'custom'"
				>
					<i class="ti ti-fish"></i>
				</button>
				<button
					:class="[$style.tabBtn, { [$style.tabActive]: activeTab === 'unicode' }]"
					@click="activeTab = 'unicode'"
				>
					<i class="ti ti-mood-smile"></i>
				</button>
			</div>
		</div>

		<!-- よく使うタブ -->
		<div v-if="activeTab === 'recent'" :class="$style.content">
			<div v-if="recentReactions.length === 0" :class="$style.empty">
				{{ copy.noRecentReactions }}
			</div>
			<div v-else :class="$style.emojiGrid">
				<button
					v-for="emoji in recentReactions"
					:key="emoji"
					:class="$style.emojiBtn"
					class="_button"
					:title="emoji"
					@click="selectEmoji(emoji)"
					@contextmenu.prevent="addFavorite(emoji)"
				>
					<template v-if="emoji.startsWith(':')">
						<img v-if="getCustomEmojiUrl(emoji)" :src="getCustomEmojiUrl(emoji)" :alt="emoji" :class="$style.emojiImg" loading="lazy"/>
						<span v-else :class="$style.unresolvedEmoji" :title="copyx.unresolvedEmoji({ emoji })">{{ emoji }}</span>
					</template>
					<span v-else :class="$style.unicodeEmoji">{{ emoji }}</span>
				</button>
			</div>
		</div>

		<!-- お気に入りタブ -->
		<div v-else-if="activeTab === 'favorites'" :class="$style.content">
			<div v-if="favoriteEmojis.length === 0" :class="$style.empty">
				{{ copy.noFavorites }}<br/>{{ copy.favoriteInstructions }}
			</div>
			<div v-else :class="$style.emojiGrid">
				<button
					v-for="emoji in favoriteEmojis"
					:key="emoji"
					:class="$style.emojiBtn"
					class="_button"
					:title="emoji"
					@click="selectEmoji(emoji)"
					@contextmenu.prevent="removeFavorite(emoji)"
				>
					<template v-if="emoji.startsWith(':')">
						<img v-if="getCustomEmojiUrl(emoji)" :src="getCustomEmojiUrl(emoji)" :alt="emoji" :class="$style.emojiImg" loading="lazy"/>
						<span v-else :class="$style.unresolvedEmoji" :title="copyx.unresolvedEmoji({ emoji })">{{ emoji }}</span>
					</template>
					<span v-else :class="$style.unicodeEmoji">{{ emoji }}</span>
				</button>
			</div>
		</div>

		<!-- 外部絵文字タブ -->
		<div v-if="activeTab === 'custom'" :class="$style.content">
			<div v-if="loadingEmojis" :class="$style.loading">
				<MkLoading :inline="true"/>
			</div>

			<div v-else-if="filteredCustomEmojis.length === 0" :class="$style.empty">
				{{ searchQuery ? copy.notFound : copy.noCustomEmojis }}
			</div>

			<template v-else>
				<!-- カテゴリ別表示（検索時はフラット） -->
				<template v-if="!searchQuery">
					<div v-for="cat in categorizedEmojis" :key="cat.name" :class="$style.category">
						<button
							:class="[$style.categoryHeader, { [$style.categoryHeaderOpen]: openCategories.has(cat.name) }]"
							class="_button"
							@click="toggleCategory(cat.name)"
						>
							<i class="ti ti-chevron-right" :class="$style.categoryChevron"></i>
							<span :class="$style.categoryHeaderLabel">{{ cat.name || copy.uncategorized }}</span>
							<span :class="$style.categoryHeaderCount">{{ formatCount(cat.emojis.length) }}</span>
						</button>
						<div v-if="openCategories.has(cat.name)" :class="$style.emojiGrid">
							<button
								v-for="emoji in cat.emojis"
								:key="emoji.name"
								:class="$style.emojiBtn"
								class="_button"
								:title="':' + emoji.name + ':'"
								@click="selectEmoji(':' + emoji.name + ':')"
							>
								<img :src="emoji.url" :alt="emoji.name" :class="$style.emojiImg" loading="lazy"/>
							</button>
						</div>
					</div>
				</template>
				<template v-else>
					<div :class="$style.emojiGrid">
						<button
							v-for="emoji in filteredCustomEmojis"
							:key="emoji.name"
							:class="$style.emojiBtn"
							class="_button"
							:title="':' + emoji.name + ':'"
							@click="selectEmoji(':' + emoji.name + ':')"
						>
							<img :src="emoji.url" :alt="emoji.name" :class="$style.emojiImg" loading="lazy"/>
						</button>
					</div>
				</template>
			</template>
		</div>

		<!-- Unicode絵文字タブ -->
		<div v-else-if="activeTab === 'unicode'" :class="$style.content">
			<template v-if="!searchQuery">
				<div v-for="group in unicodeEmojiGroups" :key="group.name" :class="$style.category">
					<button
						:class="[$style.categoryHeader, { [$style.categoryHeaderOpen]: openUnicodeCategories.has(group.name) }]"
						class="_button"
						@click="toggleUnicodeCategory(group.name)"
					>
						<i class="ti ti-chevron-right" :class="$style.categoryChevron"></i>
						<span :class="$style.categoryHeaderLabel">{{ group.label }}</span>
						<span :class="$style.categoryHeaderCount">{{ formatCount(group.emojis.length) }}</span>
					</button>
					<div v-if="openUnicodeCategories.has(group.name)" :class="$style.emojiGrid">
						<button
							v-for="emoji in group.emojis"
							:key="emoji"
							:class="$style.emojiBtn"
							class="_button"
							@click="selectEmoji(emoji)"
						>
							<span :class="$style.unicodeEmoji">{{ emoji }}</span>
						</button>
					</div>
				</div>
			</template>
			<template v-else>
				<div :class="$style.emojiGrid">
					<button
						v-for="emoji in allUnicodeEmojis"
						:key="emoji"
						:class="$style.emojiBtn"
						class="_button"
						@click="selectEmoji(emoji)"
					>
						<span :class="$style.unicodeEmoji">{{ emoji }}</span>
					</button>
				</div>
			</template>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, useTemplateRef, nextTick, watch } from 'vue';
import MkModal from '@/components/MkModal.vue';
import { getExternalCustomEmojis, getExternalFavoriteEmojis, addExternalFavoriteEmoji, removeExternalFavoriteEmoji, getExternalRecentReactions, getExternalFavoriteEmojisDetailed, getExternalRecentReactionsDetailed, lookupExternalEmojiUrl, getExternalAccount, setExternalEmojiUrlMapForHost } from '@/utility/external-api.js';
import type { ExternalCustomEmoji } from '@/utility/external-api.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';

const props = withDefaults(defineProps<{
	anchorElement?: HTMLElement | null;
}>(), {
	anchorElement: null,
});

const emit = defineEmits<{
	(ev: 'done', reaction: string, emojiUrl?: string): void;
	(ev: 'closed'): void;
}>();

const modal = useTemplateRef('modal');
const copy = i18n.ts._hata._externalTimeline._reactionPicker;
const copyx = i18n.tsx._hata._externalTimeline._reactionPicker;
const numberFormatter = new Intl.NumberFormat(versatileLang);
const formatCount = (value: number): string => numberFormatter.format(value);
const searchEl = useTemplateRef('searchEl');
const searchQuery = ref('');
const activeTab = ref<'recent' | 'favorites' | 'custom' | 'unicode'>('recent');
const customEmojis = ref<ExternalCustomEmoji[]>([]);
const loadingEmojis = ref(true);
const favoriteEmojis = ref<string[]>([]);
const recentReactions = ref<string[]>([]);

// アコーディオン状態（カテゴリプルダウン化）
// 開いているカテゴリ名のセット。
const openCategories = ref<Set<string>>(new Set());
// Unicode は最初のグループだけ初期展開（操作のヒントになる）
const openUnicodeCategories = ref<Set<string>>(new Set(['faces']));

function toggleCategory(name: string) {
	if (openCategories.value.has(name)) {
		openCategories.value.delete(name);
	} else {
		openCategories.value.add(name);
	}
	// reactiveに変更を伝える
	openCategories.value = new Set(openCategories.value);
}

function toggleUnicodeCategory(name: string) {
	if (openUnicodeCategories.value.has(name)) {
		openUnicodeCategories.value.delete(name);
	} else {
		openUnicodeCategories.value.add(name);
	}
	openUnicodeCategories.value = new Set(openUnicodeCategories.value);
}

// ===== テーマ判定 =====
const isDark = ref(true);
function detectDark() {
	const cs = window.getComputedStyle(document.documentElement);
	let bg = cs.getPropertyValue('--MI_THEME-bg').trim() || cs.backgroundColor;
	let r = 0, g = 0, b = 0;
	const m = bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
	if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
	else if (bg.startsWith('#')) { const h = bg.replace('#',''); if (h.length>=6) { r=parseInt(h.substring(0,2),16); g=parseInt(h.substring(2,4),16); b=parseInt(h.substring(4,6),16); }}
	isDark.value = (r*299+g*587+b*114)/1000 < 128;
}

// ===== Unicode絵文字（コンパクト版） =====
const unicodeEmojiGroups = [
	{ name: 'faces', label: copy.unicodeFaces, emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😋','😛','😜','🤪','🤔','🫡','😏','😒','🙄','😬','😌','😔','😴','🤮','🥵','🥶','🥴','🤯','🥳','😎','🤓','😟','😮','😲','😳','🥺','🥹','😨','😰','😢','😭','😱','😤','😡','🤬','😈','💀','💩','🤡','👻','👽','🤖'] },
	{ name: 'hands', label: copy.unicodeHands, emojis: ['👋','🤚','✋','👌','🤌','🤏','✌','🤞','🤟','🤘','🤙','👈','👉','👆','👇','👍','👎','✊','👊','👏','🙌','🫶','👐','🤝','🙏'] },
	{ name: 'hearts', label: copy.unicodeHearts, emojis: ['❤','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤‍🔥','💕','💞','💓','💗','💖','💘','💝','⭐','✨','⚡','🔥','💥','🎉','💯','💢','💫','💦','👀','🌈','☀','🌙'] },
	{ name: 'animals', label: copy.unicodeAnimals, emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦉','🐝','🦋','🐌','🐞','🐙','🦑','🐬','🐳','🦈','🐊','🐘','🦒','🐇','🦔'] },
	{ name: 'food', label: copy.unicodeFood, emojis: ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🍑','🍍','🍅','🥑','🥦','🍞','🧀','🍳','🍔','🍟','🍕','🌮','🍝','🍜','🍣','🍱','🍤','🍙','🍡','🍧','🍰','🎂','🍮','🍩','🍪','🍫','🍿','☕','🍵','🧃','🍺','🍷'] },
	{ name: 'objects', label: copy.unicodeObjects, emojis: ['📱','💻','🖥','⌨','🎮','🎧','📷','🔋','💡','🔧','🔨','💊','🧸','🎁','🎈','✉','📌','✂','📝','🔍','🔒'] },
];

const allUnicodeEmojis = computed(() => unicodeEmojiGroups.flatMap(g => g.emojis));

// ===== フィルタリング =====
const filteredCustomEmojis = computed(() => {
	if (!searchQuery.value) return customEmojis.value;
	const q = searchQuery.value.toLowerCase();
	return customEmojis.value.filter(e =>
		e.name.toLowerCase().includes(q) ||
		(e.aliases && e.aliases.some(a => a.toLowerCase().includes(q))) ||
		(e.category && e.category.toLowerCase().includes(q)),
	);
});

const categorizedEmojis = computed(() => {
	const catMap = new Map<string, ExternalCustomEmoji[]>();
	for (const emoji of customEmojis.value) {
		const cat = emoji.category || '';
		if (!catMap.has(cat)) catMap.set(cat, []);
		catMap.get(cat)!.push(emoji);
	}
	return Array.from(catMap.entries())
		.sort((a, b) => {
			if (!a[0] && b[0]) return 1;
			if (a[0] && !b[0]) return -1;
			return a[0].localeCompare(b[0]);
		})
		.map(([name, emojis]) => ({ name, emojis }));
});

// ===== お気に入り管理 =====
//
// host/url を付与して保存することで、別の外部サーバー使用時にも復元可能にする(API不要)。
// Unicode絵文字や URL 不明のものは host=null, url=null で保存(従来挙動と同じ)。
function normalizeExternalEmojiHost(host: string | null | undefined, currentHost: string | null): string | null {
	return host === '.' ? currentHost : (host ?? null);
}

function addFavorite(emoji: string) {
	const meta = resolveEmojiMeta(emoji);
	addExternalFavoriteEmoji(emoji, meta.host, meta.url);
	favoriteEmojis.value = getExternalFavoriteEmojis();
	os.toast(copy.favoriteAdded);
}

function removeFavorite(emoji: string) {
	removeExternalFavoriteEmoji(emoji);
	favoriteEmojis.value = getExternalFavoriteEmojis();
	os.toast(copy.favoriteRemoved);
}

/**
 * リアクション文字列から host と url を推測する補助関数
 * - :name: 形式 → 現在の外部サーバーのhost + customEmojis[name].url
 * - :name@.: 形式 → 現在の外部サーバーのhostへ正規化
 * - :name@host: 形式 → host + 既知マップ参照
 * - Unicode → host=null, url=null
 */
function resolveEmojiMeta(reaction: string): { host: string | null; url: string | null } {
	const match = reaction.match(/^:([^:]+?)(?:@([^:]+))?:$/);
	if (!match) return { host: null, url: null }; // Unicode

	const name = match[1];
	const explicitHost = match[2] ?? null;
	const acc = getExternalAccount();
	const currentHost = acc?.host ?? null;
	const targetHost = normalizeExternalEmojiHost(explicitHost, currentHost) ?? currentHost;

	// 探索順: explicitHost指定 → 現サーバー
	if (targetHost) {
		const emoji = customEmojis.value.find(e => e.name === name);
		return {
			host: targetHost,
			url: lookupExternalEmojiUrl(targetHost, name) ?? (targetHost === currentHost ? emoji?.url ?? null : null),
		};
	}
	return { host: null, url: null };
}

// ===== 履歴/お気に入りエントリの索引(URL高速ルックアップ用) =====
const favoriteEntriesIndex = computed(() => {
	const idx = new Map<string, { host: string | null; url: string | null }>();
	for (const e of getExternalFavoriteEmojisDetailed()) {
		idx.set(e.reaction, { host: e.host, url: e.url });
	}
	return idx;
});

const recentEntriesIndex = computed(() => {
	const idx = new Map<string, { host: string | null; url: string | null }>();
	for (const e of getExternalRecentReactionsDetailed()) {
		idx.set(e.reaction, { host: e.host, url: e.url });
	}
	return idx;
});

// ===== カスタム絵文字URL取得(お気に入り・最近使った用、3段階フォールバック) =====
//
// 1. 履歴/お気に入りに保存された URL を最優先(API呼び出し0、別サーバーで使った絵文字も復元可能)
// 2. ホストごとの絵文字URLマップ(複数サーバー対応、24h TTL、最大10ホストLRU)
// 3. 現在のカスタム絵文字一覧から検索(カスタムタブ開いた時にのみ取得済)
//
// すべて空振りなら '' を返し、呼び出し側で エラー画像へのフォールバック処理を実装する。
function getCustomEmojiUrl(reaction: string): string {
	const match = reaction.match(/^:([^:]+?)(?:@([^:]+))?:$/);
	if (!match) return '';
	const name = match[1];
	const explicitHost = match[2] ?? null; // :name@host: 形式の場合

	// レイヤー1: 履歴/お気に入りに保存された URL
	const favEntry = favoriteEntriesIndex.value.get(reaction);
	if (favEntry?.url) return favEntry.url;

	const recEntry = recentEntriesIndex.value.get(reaction);
	if (recEntry?.url) return recEntry.url;

	// レイヤー2: ホストごとの絵文字URLマップから引く(API呼ばずに別ホストの絵文字を解決)
	// ホストの優先順: explicitHost(:name@host: 形式) → 履歴/お気に入りに保存されたhost
	const currentHost = getExternalAccount()?.host ?? null;
	const candidateHost = normalizeExternalEmojiHost(explicitHost ?? favEntry?.host ?? recEntry?.host, currentHost);
	if (candidateHost) {
		const fromMap = lookupExternalEmojiUrl(candidateHost, name);
		if (fromMap) return fromMap;
	}

	// レイヤー3: 現サーバー(カスタムタブで取得済みのもの)から探す
	const emoji = customEmojis.value.find(e => e.name === name);
	return emoji?.url ?? '';
}

// ===== アクション =====
function selectEmoji(reaction: string) {
	emit('done', reaction, getCustomEmojiUrl(reaction) || undefined);
	modal.value?.close();
}

function close() {
	modal.value?.close();
}

// ===== 遅延読込: カスタム絵文字一覧を必要なときだけ取得 =====
let customEmojisLoadStarted = false;

async function ensureCustomEmojisLoaded() {
	if (customEmojisLoadStarted) return;
	if (customEmojis.value.length > 0) return; // 既に読み込み済み
	customEmojisLoadStarted = true;
	loadingEmojis.value = true;
	try {
		customEmojis.value = await getExternalCustomEmojis();
		// 起動時に最初のカテゴリのみ自動展開
		if (customEmojis.value.length > 0 && categorizedEmojis.value.length > 0 && openCategories.value.size === 0) {
			openCategories.value = new Set([categorizedEmojis.value[0].name]);
		}
		// 取得した絵文字一覧を name→URL マップとして永続キャッシュ(複数ホスト対応、24h TTL、LRU)
		const acc = getExternalAccount();
		if (acc?.host && customEmojis.value.length > 0) {
			const map: Record<string, string> = {};
			for (const e of customEmojis.value) {
				if (e.name && e.url) map[e.name] = e.url;
			}
			setExternalEmojiUrlMapForHost(acc.host, map);
		}
	} catch (err) {
		console.error('[ExternalReactionPicker] Failed to load emojis:', err);
		customEmojisLoadStarted = false; // 失敗したら再試行可能に
	} finally {
		loadingEmojis.value = false;
	}
}

// カスタムタブが選択されたら、未取得ならその時に取得を開始
watch(activeTab, async (tab) => {
	if (tab === 'custom') {
		await ensureCustomEmojisLoaded();
	}
});

// 検索開始時もカスタム絵文字が必要(ヒット対象なので)
watch(searchQuery, async (q) => {
	if (q && q.trim().length > 0) {
		await ensureCustomEmojisLoaded();
	}
});

// ===== 初期化 =====
onMounted(async () => {
	detectDark();

	// お気に入り・履歴を読み込み(localStorageのみ、API呼ばない)
	favoriteEmojis.value = getExternalFavoriteEmojis();
	recentReactions.value = getExternalRecentReactions();

	// デフォルトタブ: 履歴があれば履歴 → お気に入り → カスタム
	if (recentReactions.value.length > 0) {
		activeTab.value = 'recent';
	} else if (favoriteEmojis.value.length > 0) {
		activeTab.value = 'favorites';
	} else {
		// 履歴もお気に入りも無い場合はカスタムタブを初期表示し、その場で取得
		activeTab.value = 'custom';
		await ensureCustomEmojisLoaded();
	}

	// 初回表示時のヒント
	const hintShown = localStorage.getItem('externalReactionPickerHintShown');
	if (!hintShown) {
		localStorage.setItem('externalReactionPickerHintShown', 'true');
		os.toast(copy.favoriteHint);
	}

	await nextTick();
	searchEl.value?.focus();
});
</script>

<style lang="scss" module>
.root {
	width: 290px;
	max-width: 95vw;
	display: flex;
	flex-direction: column;
	border-radius: 20px;
	overflow: hidden;
	backdrop-filter: blur(24px) saturate(1.4);
	-webkit-backdrop-filter: blur(24px) saturate(1.4);
}

.rootDark {
	background: rgba(30, 30, 30, .82);
	box-shadow: 0 8px 40px rgba(0, 0, 0, .25), 0 0 0 .5px rgba(255, 255, 255, .08) inset;
	color: rgba(255, 255, 255, .85);
}

.rootLight {
	background: rgba(245, 245, 245, .82);
	box-shadow: 0 8px 40px rgba(0, 0, 0, .08), 0 0 0 .5px rgba(0, 0, 0, .06) inset;
	color: rgba(0, 0, 0, .8);
}

.drawer {
	width: 100%;
	max-width: 100%;
	border-radius: 24px 24px 0 0;
}

.searchBox {
	display: flex;
	align-items: center;
	margin: 12px 12px 4px;
	padding: 8px 12px;
	border-radius: 9999px;
	flex-shrink: 0;
}

.rootDark .searchBox {
	background: rgba(255, 255, 255, .06);
}

.rootLight .searchBox {
	background: rgba(0, 0, 0, .04);
}

.searchIcon {
	opacity: 0.4;
	margin-right: 8px;
	font-size: 0.85em;
}

.searchInput {
	flex: 1;
	border: none;
	background: transparent;
	color: inherit;
	font-size: 0.85em;
	outline: none;

	&::placeholder {
		color: inherit;
		opacity: 0.35;
	}
}

.searchClear {
	padding: 2px 4px;
	opacity: 0.4;
	color: inherit;
	&:hover { opacity: 1; }
}

// ===== タブ（ピル型、ナビバーと同じデザイン） =====
.tabBar {
	display: flex;
	justify-content: center;
	padding: 4px 12px 8px;
	flex-shrink: 0;
}

.tabPill {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 3px 4px;
	border-radius: 9999px;
}

.rootDark .tabPill {
	background: rgba(255, 255, 255, .06);
}

.rootLight .tabPill {
	background: rgba(0, 0, 0, .04);
}

.tabBtn {
	width: 38px;
	height: 38px;
	border-radius: 50%;
	background: transparent;
	border: none;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1em;
	transition: all .2s;
	color: inherit;
	opacity: .4;
}

.tabActive {
	opacity: 1;
	color: var(--MI_THEME-accent);
}

.rootDark .tabActive {
	background: rgba(255, 255, 255, .1);
}

.rootLight .tabActive {
	background: rgba(0, 0, 0, .06);
}

.content {
	flex: 1;
	overflow-y: auto;
	padding: 0 12px 12px;
	overscroll-behavior: contain;
}

.loading {
	padding: 24px;
	text-align: center;
}

.empty {
	padding: 24px;
	text-align: center;
	opacity: 0.4;
	font-size: 0.85em;
}

.category {
	margin-bottom: 4px;
}

// アコーディオンヘッダー（カテゴリプルダウン）
.categoryHeader {
	display: flex;
	align-items: center;
	width: 100%;
	padding: 8px 10px;
	border-radius: 10px;
	font-size: 0.78em;
	font-weight: 600;
	color: inherit;
	background: transparent;
	cursor: pointer;
	transition: background .15s;
	margin-bottom: 2px;
}

.rootDark .categoryHeader:hover {
	background: rgba(255, 255, 255, .06);
}

.rootLight .categoryHeader:hover {
	background: rgba(0, 0, 0, .04);
}

.categoryChevron {
	font-size: 0.85em;
	margin-right: 6px;
	transition: transform .2s;
	opacity: .6;
}

.categoryHeaderOpen .categoryChevron {
	transform: rotate(90deg);
	opacity: 1;
}

.categoryHeaderLabel {
	flex: 1;
	text-align: left;
}

.categoryHeaderCount {
	font-size: 0.85em;
	opacity: .4;
	font-weight: 500;
	padding-left: 6px;
}

// 検索時のフラット表示用 (現在は未使用だが念の為残す)
.categoryLabel {
	font-size: 0.72em;
	font-weight: bold;
	opacity: 0.4;
	padding: 3px 4px 4px;
}

.rootDark .categoryLabel {
	background: rgba(30, 30, 30, .9);
}

.rootLight .categoryLabel {
	background: rgba(245, 245, 245, .9);
}

.emojiGrid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
	gap: 2px;
	padding: 2px 4px 6px;
}

.emojiBtn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border-radius: 8px;
	cursor: pointer;
	transition: background 0.15s, transform 0.1s;
	color: inherit;

	&:hover {
		transform: scale(1.1);
	}

	&:active {
		transform: scale(0.9);
	}
}

.rootDark .emojiBtn:hover {
	background: rgba(255, 255, 255, .08);
}

.rootLight .emojiBtn:hover {
	background: rgba(0, 0, 0, .05);
}

.emojiImg {
	width: 26px;
	height: 26px;
	object-fit: contain;
}

.unicodeEmoji {
	font-size: 1.25em;
	line-height: 1;
}

/* 旗鯖fork: 履歴/お気に入りに保存された絵文字のURLが解決できなかった場合のフォールバック表示 */
/* 「壊れた画像」アイコンの代わりに、絵文字コードを半透明テキストとして表示 */
.unresolvedEmoji {
	display: inline-block;
	font-size: 0.65em;
	line-height: 1.05;
	max-width: 32px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	opacity: 0.55;
	font-family: monospace;
	letter-spacing: -0.05em;
}
</style>
