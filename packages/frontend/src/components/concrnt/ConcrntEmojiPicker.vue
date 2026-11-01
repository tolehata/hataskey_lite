<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
旗鯖fork: CTL 用の絵文字ピッカー（外部TLのリアクションピッカーと同じピル型デザイン）。
コンカレントの購読絵文字パックと、旗鯖のカスタム絵文字（連合可能なものだけ）を選べる。
リアクションにも、投稿フォームへの挿入にも使う。
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
	<div :class="[$style.root, isDark ? $style.rootDark : $style.rootLight, { [$style.drawer]: type === 'drawer' }]" :style="{ maxHeight: `${maxHeight ? Math.min(maxHeight, 360) : 360}px` }" role="dialog" :aria-label="mode === 'insert' ? '絵文字を挿入' : 'リアクションを選ぶ'" @click.stop>
		<div :class="$style.searchBox">
			<i class="ti ti-search" :class="$style.searchIcon" aria-hidden="true"></i>
			<input ref="searchEl" v-model="search" :class="$style.searchInput" type="search" placeholder="絵文字名で検索" autocomplete="off" aria-label="絵文字名で検索"/>
			<button v-if="search" class="_button" :class="$style.searchClear" aria-label="検索語を消す" @click="search = ''"><i class="ti ti-x"></i></button>
		</div>
		<div v-if="!search" :class="$style.tabBar">
			<div :class="$style.tabPill" role="tablist" aria-label="絵文字パック">
				<button v-for="item in tabs" :key="item.value" class="_button" role="tab" :aria-selected="tab === item.value" :aria-label="item.label" :title="item.label" :class="[$style.tabBtn, { [$style.tabActive]: tab === item.value }]" @click="tab = item.value">
					<img v-if="item.iconUrl" :src="item.iconUrl" alt="" :class="$style.tabImg" referrerpolicy="no-referrer"/>
					<i v-else :class="item.icon" aria-hidden="true"></i>
				</button>
			</div>
		</div>
		<div :class="$style.content">
			<div v-if="loading && tab !== 'local' && tab !== 'recent'" :class="$style.empty" role="status">絵文字を読み込んでいます…</div>
			<div v-else-if="loadError && tab !== 'local'" :class="$style.empty" role="alert">{{ loadError }}</div>
			<div v-if="!search && currentPackage" :class="$style.packName">{{ currentPackage.name }}</div>
			<div v-if="!visible.length && !loading" :class="$style.empty">{{ search ? '見つかりませんでした' : tab === 'recent' ? 'まだ使った絵文字はありません' : '絵文字がありません' }}</div>
			<div :class="$style.emojiGrid">
				<button v-for="emoji in visible" :key="`${emoji.shortcode}\0${emoji.imageUrl}`" class="_button" :class="$style.emojiBtn" :title="`:${emoji.shortcode}:`" :aria-label="emoji.shortcode" @click="choose(emoji)">
					<img :src="emoji.imageUrl" :alt="emoji.shortcode" :class="$style.emojiImg" loading="lazy" decoding="async" referrerpolicy="no-referrer"/>
				</button>
			</div>
			<button v-if="filtered.length > limit" class="_button" :class="$style.more" @click="limit += 240">さらに表示</button>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { ConcrntEmoji, ConcrntEmojiPackage } from '@/utility/concrnt/types.js';
import MkModal from '@/components/MkModal.vue';
import { customEmojis } from '@/custom-emojis.js';
import { concrntState, runConcrntAction } from '@/utility/concrnt/runtime.js';
import { safeConcrntMediaUrl } from '@/utility/concrnt/content.js';
import { concrntRecentEmojis, loadConcrntEmojiPacks, rememberConcrntEmoji } from '@/utility/concrnt/emoji-cache.js';

const props = withDefaults(defineProps<{
	anchorElement?: HTMLElement | null;
	mode?: 'reaction' | 'insert';
	/** Reactions already visible near the target, offered under "recent". */
	extra?: ConcrntEmoji[];
}>(), { mode: 'reaction', anchorElement: null, extra: () => [] });

const emit = defineEmits<{ done: [emoji: ConcrntEmoji]; closed: [] }>();

const modal = useTemplateRef('modal');
const searchEl = useTemplateRef('searchEl');
const search = ref('');
const limit = ref(240);
const packages = ref<ConcrntEmojiPackage[]>([]);
// One tab per subscribed package, as in world-app; "recent" and this server's emoji around them.
const tabs = computed(() => [
	{ value: 'recent', label: '最近', icon: 'ti ti-clock', iconUrl: undefined as string | undefined },
	...packages.value.map(pack => ({ value: `pack:${pack.url}`, label: pack.name, icon: 'concrnt-icon', iconUrl: pack.iconUrl })),
	{ value: 'local', label: '旗鯖の絵文字', icon: 'ti ti-mood-smile', iconUrl: undefined },
]);
const tab = ref<string>(concrntRecentEmojis.value.length || props.extra.length ? 'recent' : '');
const currentPackage = computed(() => packages.value.find(pack => `pack:${pack.url}` === tab.value));
const allPackEmojis = computed(() => packages.value.flatMap(pack => pack.emojis));
const loading = ref(false);
const loadError = ref('');

/** Only server emojis that are allowed to leave this server, with a public HTTPS URL. */
const localEmojis = computed<ConcrntEmoji[]>(() => customEmojis.value.flatMap(emoji => {
	if (emoji.localOnly || emoji.isSensitive || (emoji.roleIdsThatCanBeUsedThisEmojiAsReaction?.length ?? 0) > 0) return [];
	let url: string | null = null;
	try { url = safeConcrntMediaUrl(new URL(emoji.url, window.location.origin).href); } catch { /* skip */ }
	return url ? [{ shortcode: emoji.name, imageUrl: url }] : [];
}));

function unique(items: ConcrntEmoji[]): ConcrntEmoji[] {
	return [...new Map(items.map(emoji => [`${emoji.shortcode}\0${emoji.imageUrl}`, emoji])).values()];
}

const filtered = computed(() => {
	const query = search.value.trim().toLowerCase().replace(/^:|:$/g, '');
	if (query) return unique([...allPackEmojis.value, ...localEmojis.value, ...props.extra.filter(emoji => emoji.shortcode)]).filter(emoji => emoji.shortcode.toLowerCase().includes(query));
	if (tab.value === 'recent') return unique([...concrntRecentEmojis.value, ...props.extra.filter(emoji => emoji.shortcode)]);
	if (tab.value === 'local') return localEmojis.value;
	return currentPackage.value?.emojis ?? [];
});
const visible = computed(() => filtered.value.slice(0, limit.value));

watch([search, tab], () => { limit.value = 240; });

function choose(emoji: ConcrntEmoji): void {
	rememberConcrntEmoji(emoji);
	emit('done', emoji);
	modal.value?.close();
}

function close(): void { modal.value?.close(); }

const isDark = ref(true);

function detectDark(): void {
	const style = window.getComputedStyle(window.document.documentElement);
	const bg = style.getPropertyValue('--MI_THEME-bg').trim() || style.backgroundColor;
	let r = 0, g = 0, b = 0;
	const rgb = bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
	if (rgb) { r = +rgb[1]; g = +rgb[2]; b = +rgb[3]; } else if (/^#[0-9a-f]{6}/i.test(bg)) { r = parseInt(bg.slice(1, 3), 16); g = parseInt(bg.slice(3, 5), 16); b = parseInt(bg.slice(5, 7), 16); }
	isDark.value = (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

onMounted(async () => {
	detectDark();
	searchEl.value?.focus({ preventScroll: true });
	if (concrntState.status !== 'connected') { if (!tab.value) tab.value = 'local'; return; }
	loading.value = true;
	try {
		packages.value = await loadConcrntEmojiPacks(() => runConcrntAction(client => client.getEmojiPackages()));
		if (!tab.value) tab.value = packages.value[0] ? `pack:${packages.value[0].url}` : 'local';
	} catch {
		loadError.value = 'コンカレントの絵文字パックを取得できませんでした。旗鯖の絵文字は選べます。';
		if (!tab.value) tab.value = 'local';
	} finally {
		loading.value = false;
	}
});
</script>

<style lang="scss" module>
.root {
	width: 300px;
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
	flex-shrink: 0;
	margin: 12px 12px 4px;
	padding: 8px 12px;
	border-radius: 9999px;
}

.rootDark .searchBox { background: rgba(255, 255, 255, .06); }
.rootLight .searchBox { background: rgba(0, 0, 0, .04); }

.searchIcon {
	margin-right: 8px;
	font-size: .85em;
	opacity: .4;
}

.searchInput {
	flex: 1;
	min-width: 0;
	border: none;
	background: transparent;
	color: inherit;
	font-size: 16px;
	outline: none;

	&::placeholder {
		color: inherit;
		opacity: .35;
	}
}

.searchClear {
	padding: 2px 4px;
	color: inherit;
	opacity: .4;

	&:hover { opacity: 1; }
}

.tabBar {
	display: flex;
	flex-shrink: 0;
	justify-content: center;
	padding: 4px 12px 8px;
}

.tabPill {
	display: flex;
	align-items: center;
	gap: 2px;
	max-width: 100%;
	overflow-x: auto;
	scrollbar-width: none;
	padding: 3px 4px;
	border-radius: 9999px;
}

.rootDark .tabPill { background: rgba(255, 255, 255, .06); }
.rootLight .tabPill { background: rgba(0, 0, 0, .04); }

.tabBtn {
	flex: none;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 38px;
	height: 38px;
	border-radius: 50%;
	color: inherit;
	opacity: .4;
	transition: all .2s;
}

.tabImg {
	width: 22px;
	height: 22px;
	object-fit: contain;
}

.packName {
	padding: 0 4px 4px;
	font-size: .75em;
	font-weight: 700;
	opacity: .55;
}

.tabActive {
	color: var(--MI_THEME-accent);
	opacity: 1;
}

.rootDark .tabActive { background: rgba(255, 255, 255, .1); }
.rootLight .tabActive { background: rgba(0, 0, 0, .06); }

.content {
	flex: 1;
	overflow-y: auto;
	overscroll-behavior: contain;
	padding: 0 12px 12px;
}

.empty {
	padding: 20px;
	font-size: .85em;
	text-align: center;
	opacity: .5;
}

.emojiGrid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
	gap: 2px;
	padding: 2px 4px 6px;
}

.emojiBtn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	border-radius: 8px;
	color: inherit;
	transition: background .15s, transform .1s;

	&:hover { transform: scale(1.1); }
	&:active { transform: scale(.9); }
	&:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: -2px; }
}

.rootDark .emojiBtn:hover { background: rgba(255, 255, 255, .08); }
.rootLight .emojiBtn:hover { background: rgba(0, 0, 0, .05); }

.emojiImg {
	width: 28px;
	height: 28px;
	object-fit: contain;
}

.more {
	display: block;
	width: 100%;
	padding: 10px;
	border-radius: 10px;
	color: var(--MI_THEME-accent);
	font-size: .85em;
}
</style>
