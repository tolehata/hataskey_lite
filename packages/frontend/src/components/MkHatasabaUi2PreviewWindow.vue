<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only

Read-only preview for the permanent Hataskey UI settings surface. The editor
is deliberately supplied by its owner, so this window never creates another
draft or writes a setting while it is open.
-->

<template>
<!-- 旗鯖fork: ⚠️MkModal を素の <div> で包まないこと。
     包むと器が画面いっぱいに広がらず、中身が画面外の下へ落ちる。 -->
<!-- 旗鯖fork: ⚠️必ず body へ逃がすこと。
     設定シェル(.scope の container-type)と _pageContainer(contain) が
     position: fixed の基準を作るため、ここに置いたままだと
     画面中央ではなく「その箱の中」に配置され、左寄り＋余白だらけになる。
     ⚠️preferType は dialog を明示。auto だと PC で
     「押したボタンの近くに出すポップアップ型」が選ばれる。 -->
<Teleport to="body">
<MkModal ref="dialog" preferType="dialog" :zPriority="'middle'" @click="close" @closed="emit('closed')">
	<div :class="$style.sheet" :data-motion-enabled="motionEnabled ? 'true' : 'false'" @click.stop>
			<header :class="$style.sheetHeader">
				<h2><i class="ti ti-eye" aria-hidden="true"></i><span v-if="previewTitle.before">{{ previewTitle.before }}</span><span v-if="previewTitle.brand" class="settingsBrand">{{ previewTitle.brand }}</span><span>{{ previewTitle.after }}</span></h2>
				<button type="button" :class="$style.sheetClose" :aria-label="copy.ui2.preview.close" @click="close"><i class="ti ti-x" aria-hidden="true"></i></button>
			</header>
		<main :class="$style.preview" :aria-label="copy.ui2.preview.dialogLabel">
			<p :class="$style.liveNotice" role="status"><i class="ti ti-sparkles" aria-hidden="true"></i>{{ copy.ui2.preview.liveNotice }}</p>
			<!-- 旗鯖fork: ⚠️手本は MkUISetup.vue の Hataskey UI モック（.phone / .deckWrap）。
			     ⚠️寸法・角丸・色・影をそのまま写すこと。独自の見た目を足さない。 -->
			<section
				:class="$style.appPreview"
				:data-glass="editor.draft.editedGlassUi ? 'on' : 'off'"
				:data-bubble="bubblePreview ? 'on' : 'off'"
				:data-deck="deckPreview ? 'on' : 'off'"
				:style="{ '--preview-opacity': `${editor.draft.editedOpacity}%` }"
				:aria-label="copy.ui2.preview.appPreviewLabel"
			>
				<!-- 列を並べる姿 -->
				<div v-if="deckPreview" :class="$style.deckWrap" :aria-label="copy.ui2.preview.notePreviewLabel">
					<div v-for="column in deckColumns" :key="column.id" :class="$style.deckCol">
						<div :class="$style.deckColHead"><i :class="[column.icon, $style.deckColHeadIcon]"></i><span :class="$style.bar" style="width:26px;opacity:.28"></span></div>
						<span v-for="(width, index) in column.bars" :key="index" :class="$style.bar" :style="{ width, opacity: .16 - index * .015 }"></span>
					</div>
				</div>

				<!-- ふだんの姿 -->
				<div v-else :class="$style.phone" :aria-label="copy.ui2.preview.notePreviewLabel">
					<!-- 上部ピルナビ -->
					<div :class="$style.phonePill" :aria-label="copy.ui2.preview.timelineTabsLabel">
						<template v-for="(item, index) in previewTopNav" :key="item.id">
							<div v-if="index === 0" :class="$style.phonePillActive"><i :class="item.icon"></i></div>
							<i v-else :class="[item.icon, $style.phonePillIcon]"></i>
						</template>
						<i v-if="editor.draft.editedShowTrendingTab" :class="['ti ti-flame', $style.phonePillIcon]"></i>
					</div>

					<!-- ノート -->
					<div v-for="note in previewNotes" :key="note.id" :class="$style.phoneNote">
						<div :class="[$style.phoneAvatar, note.id === 'a' ? $style.phoneAvatarA : $style.phoneAvatarB]"></div>
						<div :class="$style.noteBody">
							<div :class="$style.noteHead"><span :class="$style.bar" style="width:32px;opacity:.5"></span><span :class="$style.bar" style="width:20px;opacity:.22"></span><span :class="[$style.bar, $style.barPush]" style="width:15px;opacity:.15"></span></div>
							<div :class="$style.noteLines">
								<span v-for="(width, index) in note.lines" :key="index" :class="$style.bar" :style="{ width, opacity: .2 - index * .04 }"></span>
							</div>
							<div :class="$style.noteActions"><i class="ti ti-arrow-back-up"></i><i class="ti ti-repeat"></i><i class="ti ti-mood-smile"></i><i class="ti ti-quote"></i><i class="ti ti-dots"></i></div>
						</div>
					</div>

					<!-- 下部ナビ + 投稿ボタン -->
					<div :class="$style.phoneBottom">
						<div :class="$style.phoneNav" :aria-label="copy.ui2.preview.bottomNavLabel">
							<template v-for="(item, index) in previewBottomNav" :key="item.id">
								<div v-if="index === 2" :class="$style.phoneNavActive"><i :class="item.icon"></i></div>
								<i v-else :class="item.icon"></i>
							</template>
						</div>
						<div :class="$style.phoneFab"><i class="ti ti-pencil"></i></div>
					</div>
				</div>
			</section>
			<footer :class="$style.footer"><span>{{ copy.ui2.preview.footerNotice }}</span><button type="button" @click="close"><i class="ti ti-x" aria-hidden="true"></i>{{ copy.ui2.preview.close }}</button></footer>
	</main>
	</div>
</MkModal>
</Teleport>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { HatasabaUi2Draft } from '@/composables/use-hatasaba-ui2-draft.js';
import MkModal from '@/components/MkModal.vue';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	editor: HatasabaUi2Draft;
	motionEnabled?: boolean;
}>(), {
	motionEnabled: true,
});
const emit = defineEmits<{ closed: [] }>();
const dialog = useTemplateRef('dialog');
const copy = i18n.ts._hata._settingsRedesign;
const previewBrand = 'Hataskey UI';
const previewTitle = computed(() => {
	const title = copy.ui2.preview.title;
	const index = title.indexOf(previewBrand);
	if (index < 0) return { before: '', brand: '', after: title };
	return {
		before: title.slice(0, index),
		brand: previewBrand,
		after: title.slice(index + previewBrand.length),
	};
});
// ⚠️デッキは「画面幅に関係なく出す」設定のときだけ。上部メニューは別の姿なので混ぜない。
const deckPreview = computed(() => props.editor.draft.editedDeckIgnoreWidth);
// ⚠️デッキで吹き出しを切る設定があるので、ここで最終形を決める。
const bubblePreview = computed(() => props.editor.draft.editedGlassUiBubble
	&& !(deckPreview.value && props.editor.draft.editedDisableBubbleInHatasabaDeck));
const previewTopNav = computed(() => {
	const visible = props.editor.draft.editedTopNav.filter(item => item.visible !== false).slice(0, 4);
	return visible.length > 0 ? visible : [
		{ id: 'home', icon: 'ti ti-home', label: copy.ui2.preview.home },
		{ id: 'local', icon: 'ti ti-planet', label: copy.ui2.preview.local },
	];
});
/** ⚠️下部ナビは5つまで。手本のモックが5つ並びなので合わせる。 */
const previewBottomNav = computed(() => {
	const visible = props.editor.draft.editedBottomNav.filter(item => item.visible !== false).slice(0, 5);
	return visible.length >= 3 ? visible : [
		{ id: 'menu', icon: 'ti ti-menu-2' },
		{ id: 'search', icon: 'ti ti-search' },
		{ id: 'home', icon: 'ti ti-home' },
		{ id: 'notifications', icon: 'ti ti-bell' },
		{ id: 'widgets', icon: 'ti ti-eye' },
	];
});
/** ⚠️中身は骨組みの棒だけ。文字を置かない（訳の無い言語で空欄になるため）。 */
const previewNotes = [
	{ id: 'a', lines: ['100%', '64%'] },
	{ id: 'b', lines: ['90%'] },
] as const;
const deckColumns = [
	{ id: 'home', icon: 'ti ti-home', bars: ['100%', '70%', '90%', '55%'] },
	{ id: 'local', icon: 'ti ti-world', bars: ['80%', '100%', '60%', '85%'] },
	{ id: 'notifications', icon: 'ti ti-bell', bars: ['70%', '90%', '50%'] },
] as const;

function close(): void {
	dialog.value?.close();
}
</script>

<style lang="scss" module>
.sheet {
	/* ⚠️モバイルで画面からはみ出さないこと。幅も高さも画面を上限にする。 */
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	inline-size: min(680px, calc(100dvw - 24px));
	/* ⚠️高さは中身なり。上限だけ画面に合わせる。
	   固定の高さを与えると、中身が短いときに下へ大きな空白ができる。 */
	/* ⚠️高さは中身なり。上限だけ画面に合わせる。
	   ⚠️align-self を付けないと、器の flex に引き伸ばされて
	   中身の下に大きな余白ができる。 */
	block-size: auto;
	align-self: center;
	/* ⚠️器は flex(row) で justify-content が normal(左詰め)。
	   これが無いと画面の左端に寄る。中央へ寄せるための指定。 */
	margin-inline: auto;
	max-block-size: calc(100dvh - 24px);
	border-radius: var(--MI-radius);
	/* 旗鯖fork: ⚠️必ず不透明にすること。透けると背景の設定画面が見えて読みづらい。 */
	background: var(--MI_THEME-panel);
	/* ⚠️角丸からはみ出した子の背景を切る。ここが無いと角だけ下地が覗く。 */
	overflow: hidden;
	box-shadow: 0 18px 48px color-mix(in srgb, var(--MI_THEME-fg) 22%, transparent);
	container-type: inline-size;
}
.sheetHeader {
	position: sticky;
	inset-block-start: 0;
	z-index: 1;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 12px 14px;
	border-block-end: 1px solid var(--MI_THEME-divider);
	background: var(--MI_THEME-panel);
}
.sheetHeader h2 { display: flex; align-items: center; gap: .4em; margin: 0; font-size: 1rem; }
.sheetClose {
	display: grid;
	width: 40px;
	height: 40px;
	flex: none;
	place-items: center;
	/* ⚠️ボタン既定の枠と字面を打ち消す。 */
	appearance: none;
	border: 0;
	border-radius: 50%;
	background: transparent;
	color: var(--MI_THEME-fg);
	cursor: pointer;
	font: inherit;
	font-size: 1.1rem;
}
.sheetClose:hover { background: var(--MI_THEME-buttonHoverBg); }
.sheet[data-motion-enabled='false'] :deep(*) { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
/* 旗鯖fork: ⚠️下地はここで敷く。透明だと背景の設定画面が透けて読みづらい。
   ⚠️align-content: start を付けないと、中身が短いときに
   grid が余った高さを配り、最後の行の下に大きな空白が残る。 */
.preview { display: grid; align-content: start; gap: 12px; padding: 16px 16px 14px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); }
.liveNotice { display: flex; align-items: flex-start; gap: 7px; margin: 0; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 30%, var(--MI_THEME-divider)); border-radius: 14px; background: color-mix(in srgb, var(--MI_THEME-accentedBg) 62%, var(--MI_THEME-panel)); font-size: .8rem; line-height: 1.55; }
.liveNotice > i { color: var(--MI_THEME-accent); font-size: 1rem; }
/* 旗鯖fork: ここから下は MkUISetup.vue の Hataskey UI モックを写したもの。
   ⚠️寸法・角丸・色・影は手本の値をそのまま使うこと。
   ⚠️独自の見た目を足すと、設定選択画面のモックと食い違って
   「どちらが本当の Hataskey UI か」が分からなくなる。 */
.appPreview {
	display: grid;
	place-items: center;
	padding: 18px 12px;
	border: 1px solid color-mix(in srgb, var(--MI_THEME-divider) 72%, transparent);
	border-radius: 20px;
	/* ⚠️手本と同じ濃色の下地。ここが明るいとモックの白い面が沈む。 */
	background: linear-gradient(160deg, #1b2338, #131a2b);
}

/* ===== スマホ風モック（手本: .phone） ===== */
.phone {
	box-sizing: border-box;
	display: flex;
	width: 152px;
	height: 238px;
	flex-direction: column;
	gap: 7px;
	overflow: hidden;
	padding: 10px 9px;
	border: 1px solid rgba(255, 255, 255, .6);
	border-radius: 26px;
	background: linear-gradient(180deg, #eef2fa, #e2e8f4);
	box-shadow: 0 14px 30px rgba(15, 22, 45, .4), inset 0 1px 0 rgba(255, 255, 255, .8);
}
.phonePill {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	padding: 5px 7px;
	border: 1px solid rgba(255, 255, 255, .85);
	border-radius: 999px;
	background: rgba(255, 255, 255, .75);
	box-shadow: 0 3px 8px rgba(20, 30, 60, .1);
}
.phonePillIcon { font-size: 10px; color: #9aa3b8; }
.phonePillActive {
	display: flex;
	align-items: center;
	gap: 3px;
	padding: 3px 6px;
	border-radius: 999px;
	background: color-mix(in srgb, var(--MI_THEME-accent) 15%, #fff);

	> i { font-size: 10px; color: var(--MI_THEME-accent); }
}
.phoneNote {
	display: flex;
	gap: 7px;
	padding: 8px;
	border: 1px solid rgba(255, 255, 255, .73);
	border-radius: 15px;
	background: rgba(255, 255, 255, .63);
	box-shadow: 0 2px 6px rgba(20, 30, 60, .06);
}
.phoneAvatar { width: 22px; height: 22px; flex: none; border-radius: 7px; }
.phoneAvatarA { background: linear-gradient(150deg, var(--MI_THEME-accent), color-mix(in srgb, var(--MI_THEME-accent) 30%, #2fb8a6)); }
.phoneAvatarB { background: linear-gradient(150deg, color-mix(in srgb, var(--MI_THEME-accent) 70%, #7a5ad0), #2fb8a6); }
.noteBody { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4px; }
.noteHead { display: flex; align-items: center; gap: 4px; }
.noteLines { display: flex; flex-direction: column; gap: 4px; }
.noteActions {
	display: flex;
	align-items: center;
	gap: 9px;
	margin-top: 2px;
	color: rgba(38, 52, 86, .38);

	> i { font-size: 9px; }
}
/* 骨組みの棒。⚠️濃色＝ノート本文、白＝デッキ側。手本と同じ使い分け。 */
.bar { display: block; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, 1); }
.phone .bar { background: rgba(38, 52, 86, 1); }
.noteHead .bar { height: 5px; border-radius: 3px; }
.barPush { margin-left: auto; }
.phoneBottom { display: flex; align-items: center; gap: 6px; margin-top: auto; }
.phoneNav {
	display: flex;
	flex: 1;
	align-items: center;
	justify-content: space-around;
	padding: 6px 5px;
	border: 1px solid rgba(255, 255, 255, .85);
	border-radius: 999px;
	background: rgba(255, 255, 255, .75);
	box-shadow: 0 4px 10px rgba(20, 30, 60, .12);

	> i { font-size: 12px; color: #9aa3b8; }
}
.phoneNavActive {
	display: flex;
	width: 22px;
	height: 22px;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: color-mix(in srgb, var(--MI_THEME-accent) 17%, #fff);

	> i { font-size: 12px; color: var(--MI_THEME-accent); }
}
.phoneFab {
	display: flex;
	width: 33px;
	height: 33px;
	flex: none;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: var(--MI_THEME-accent);
	box-shadow: 0 4px 12px color-mix(in srgb, var(--MI_THEME-accent) 50%, transparent);

	> i { font-size: 14px; color: #fff; }
}

/* ===== デッキ風モック（手本: .deckWrap） ===== */
.deckWrap { display: flex; width: 220px; height: 196px; gap: 6px; }
.deckCol {
	box-sizing: border-box;
	display: flex;
	min-width: 0;
	flex: 1;
	flex-direction: column;
	gap: 5px;
	overflow: hidden;
	padding: 6px;
	border: 1px solid rgba(255, 255, 255, .1);
	border-radius: 11px;
	background: rgba(20, 26, 16, .9);
}
.deckColHead {
	display: flex;
	align-items: center;
	gap: 4px;
	padding-bottom: 4px;
	border-bottom: 1px solid rgba(255, 255, 255, .09);
}
.deckColHeadIcon { font-size: 9px; color: color-mix(in srgb, var(--MI_THEME-accent) 70%, #fff); }

/* ===== 設定の反映 ===== */
/* ⚠️すりガラスの透過率は、面の下地の濃さで示す（手本の白い面を薄くする）。
   ⚠️`--preview-opacity` は `55%` のような**百分率**が入る。
   ⚠️`/ 100` で割らないこと。百分率をさらに100で割ると 0.55% になり、
   面がほぼ透明になって**透過率の変更が見た目に出ない**（実測: alpha 0.004）。
   ⚠️百分率のまま掛けること。 */
.appPreview[data-glass='on'] .phonePill,
.appPreview[data-glass='on'] .phoneNote,
.appPreview[data-glass='on'] .phoneNav { background: rgb(255 255 255 / calc(var(--preview-opacity) * .85)); }
/* ⚠️すりガラスを切ったときは、手本どおりの不透明な面に戻す。 */
.appPreview[data-glass='off'] .phonePill,
.appPreview[data-glass='off'] .phoneNav { background: rgba(255, 255, 255, .95); }
.appPreview[data-glass='off'] .phoneNote { background: rgba(255, 255, 255, .9); }
/* ⚠️吹き出しは本文の棒だけを包む。ノート全体を包むと実物と形が違う。 */
.appPreview[data-bubble='on'] .noteLines {
	padding: 5px 7px;
	border-radius: 11px;
	background: color-mix(in srgb, var(--MI_THEME-accent) 16%, transparent);
}

.footer { display: flex; min-height: 44px; align-items: center; justify-content: space-between; gap: 10px; color: var(--MI_THEME-fgTransparentWeak); font-size: .75rem; }
.footer button { display: inline-flex; min-block-size: 44px; align-items: center; gap: 6px; border: 1px solid var(--MI_THEME-divider); border-radius: 999px; padding: 8px 14px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); cursor: pointer; font: inherit; font-size: .8rem; font-weight: 700; }
.footer button:hover { border-color: var(--MI_THEME-accent); background: var(--MI_THEME-accentedBg); }
.footer button:focus-visible { outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 54%, transparent); outline-offset: 3px; }
@container (max-width: 500px) { .preview { padding: 12px; } .appPreview { padding: 14px 8px; } .footer { align-items: stretch; flex-direction: column; } .footer button { justify-content: center; } }
@media (prefers-reduced-motion: reduce) { .sheet :deep(*) { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
</style>
