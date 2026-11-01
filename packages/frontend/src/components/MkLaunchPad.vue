<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal ref="modal" v-slot="{ type, maxHeight }" :preferType="preferedModalType" :anchor="anchor" :transparentBg="true" :anchorElement="anchorElement" @click="modal?.close()" @closed="emit('closed')" @esc="modal?.close()">
	<div class="szkkfdyq _shadow" :class="{ asDrawer: type === 'drawer', _popup: !prefer.s.useBlurEffect || !prefer.s.useBlurEffectForModal || !prefer.s.removeModalBgColorForBlur, _popupAcrylic: prefer.s.useBlurEffect && prefer.s.useBlurEffectForModal && prefer.s.removeModalBgColorForBlur }" :style="{ maxHeight: maxHeight ? maxHeight + 'px' : '' }">
		<div class="main">
			<template v-for="item in items" :key="item.text">
				<button v-if="item.action" v-click-anime class="_button item" @click="$event => { item.action($event); close(); }">
					<HataAppNavIcon v-if="item.brandApp" :app="item.brandApp" :size="24" :monochrome="onDark" class="icon"/><i v-else class="icon" :class="item.icon"></i>
				<div class="text"><HataAppWordmark v-if="hataAppForMenuLabel(item.id, item.text)" :app="hataAppForMenuLabel(item.id, item.text)!" inheritColor/><template v-else>{{ item.text }}</template></div>
					<span v-if="item.indicate && item.indicateValue" class="_indicateCounter indicatorWithValue">{{ item.indicateValue }}</span>
					<span v-else-if="item.indicate" class="indicator _blink"><i class="_indicatorCircle"></i></span>
				</button>
				<MkA v-else :key="item.text" v-click-anime :to="item.to" class="item" @click.passive="close()">
					<HataAppNavIcon v-if="item.brandApp" :app="item.brandApp" :size="24" :monochrome="onDark" class="icon"/><i v-else class="icon" :class="item.icon"></i>
				<div class="text"><HataAppWordmark v-if="hataAppForMenuLabel(item.id, item.text)" :app="hataAppForMenuLabel(item.id, item.text)!" inheritColor/><template v-else>{{ item.text }}</template></div>
					<span v-if="item.indicate && item.indicateValue" class="_indicateCounter indicatorWithValue">{{ item.indicateValue }}</span>
					<span v-else-if="item.indicate" class="indicator _blink"><i class="_indicatorCircle"></i></span>
				</MkA>
			</template>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { computed, useTemplateRef } from 'vue';
import MkModal from '@/components/MkModal.vue';
import { navbarItemDef } from '@/navbar.js';
import { deviceKind } from '@/utility/device-kind.js';
import { prefer } from '@/preferences.js';
import { miLocalStorage } from '@/local-storage.js';
import { getActiveHataSideStudioMenuIds, hataSideStudioStore, normalizeHataSideStudioMenuId } from '@/utility/hata-side-studio.js';
import HataAppNavIcon from '@/components/HataAppNavIcon.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import { hataAppForMenuIcon, hataAppForMenuLabel } from '@/utility/hata-app-brand.js';
import { store } from '@/store.js';

const props = withDefaults(defineProps<{
	anchorElement?: HTMLElement | null;
	anchor?: { x: string; y: string; };
}>(), {
	anchorElement: null,
	anchor: () => ({ x: 'right', y: 'center' }),
});

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const preferedModalType = (deviceKind === 'desktop' && props.anchorElement != null) ? 'popup' :
	deviceKind === 'smartphone' ? 'drawer' :
	'dialog';

const modal = useTemplateRef('modal');
const onDark = store.r.darkMode;

const menu = prefer.s.menu;

/*
旗鯖fork: 「もっと」からは、サイドバーに出ている項目を省く（同じものを二度出さないため）。
⚠️本家は `prefer.s.menu`（＝本家UIのサイドバー）だけで判断するが、Hataskey UI が読むのは
  `simpleUi.sidebar` の方で、`menu` は画面のどこにも描かれない。
  そのため `menu` にだけ入っている項目（実測でマスコットの1件）は、
  **サイドバーにも「もっと」にも出ない＝UIから辿れない**状態になっていた（利用者報告）。
⚠️Hataskey UI のときは「両方に入っているもの」だけを省く。こうすると:
  - マスコットは「もっと」に出る（今回の修正点）
  - 両方にある項目（通知・チャット等）は従来どおり省かれる
  - Hataskey UI 側にしか無い項目（ドライブ・Hatady 等）も従来どおり「もっと」に残る
⚠️サイドバーで非表示にした項目（visible === false）は「辿れない」ので省かない。

HataSideStudio導入後は、Studioから追加できるnavbarItemDef項目に限ってactive profileを正本にする。
旧simpleUi.sidebarに残っていてもStudioから外した項目は「もっと！」へ戻し、Studioへ追加した項目は
拡大/縮小のどちら側に置かれていても重複表示しない。Studio対象外の項目は上記の従来判定を維持する。
*/
const hiddenFromLaunchPad = computed(() => {
	if (miLocalStorage.getItem('ui') === 'hataskey3') {
		const shownInStudio = getActiveHataSideStudioMenuIds(hataSideStudioStore.value);
		return Object.keys(navbarItemDef).filter(id => shownInStudio.has(normalizeHataSideStudioMenuId(id)));
	}
	if (miLocalStorage.getItem('ui') !== 'simple') return menu;
	const sidebar = prefer.s['simpleUi.sidebar'] as { id: string; visible?: boolean }[] | undefined;
	const shownInSidebar = new Set((sidebar ?? []).filter(t => t.visible !== false).map(t => t.id));
	const legacyHidden = menu.filter(k => shownInSidebar.has(k));

	// HataSideStudioで追加できる「もっと！」由来項目は、旧simpleUi.sidebarではなく
	// active profileへの所属だけを表示元の正本にする。これによりStudioへ追加した瞬間に
	// 「もっと！」から消え、Studioから外した瞬間に同じモーダル内へ戻る。
	const studioCatalogIds = new Set(Object.keys(navbarItemDef).filter(id => id !== 'more' && id !== 'whatsNew'));
	const shownInStudio = getActiveHataSideStudioMenuIds(hataSideStudioStore.value);

	return [
		...legacyHidden.filter(id => !studioCatalogIds.has(id)),
		...Object.keys(navbarItemDef).filter(id => shownInStudio.has(normalizeHataSideStudioMenuId(id))),
	];
});

const items = computed(() => Object.keys(navbarItemDef).filter(k => !hiddenFromLaunchPad.value.includes(k)).map(k => ({ id: k, def: navbarItemDef[k] })).filter(({ def }) => def.show ?? true).map(({ id, def }) => ({
	id,
	type: def.to ? 'link' : 'button',
	text: def.title,
	icon: def.icon,
	brandApp: hataAppForMenuIcon(id),
	to: def.to,
	action: def.action,
	indicate: def.indicated,
	indicateValue: def.indicateValue,
})));

function close() {
	modal.value?.close();
}
</script>

<style lang="scss" scoped>
.szkkfdyq {
	max-height: 100%;
	width: min(460px, 100vw);
	margin: auto;
	padding: 24px;
	box-sizing: border-box;
	overflow: auto;
	overscroll-behavior: contain;
	text-align: left;
	border-radius: 16px;

	&.asDrawer {
		width: 100%;
		padding: 16px 16px max(env(safe-area-inset-bottom, 0px), 16px) 16px;
		border-radius: 24px;
		border-bottom-right-radius: 0;
		border-bottom-left-radius: 0;
		text-align: center;
	}

	> .main {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));

		> .item {
			position: relative;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			vertical-align: bottom;
			height: 100px;
			border-radius: 10px;
			padding: 10px;
			box-sizing: border-box;

			&:hover {
				color: var(--MI_THEME-accent);
				background: var(--MI_THEME-accentedBg);
				text-decoration: none;
			}

			> .icon {
				font-size: 24px;
				height: 24px;
			}

			> .text {
				margin-top: 12px;
				font-size: 0.8em;
				line-height: 1.5em;
				text-align: center;
			}

			> .indicatorWithValue {
				position: absolute;
				top: 32px;
				left: 16px;

				@media (max-width: 500px) {
					top: 16px;
					left: 8px;
				}
			}

			> .indicator {
				position: absolute;
				top: 32px;
				left: 16px;
				color: var(--MI_THEME-indicator);
				font-size: 8px;

				@media (max-width: 500px) {
					top: 16px;
					left: 16px;
				}
			}
		}
	}
}
</style>
