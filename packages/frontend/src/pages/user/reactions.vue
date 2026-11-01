<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div style="--MI_SPACER-w: 700px;">
	<MkPagination v-slot="{items}" :paginator="paginator" withControl>
		<!-- 旗鯖fork: `_panel _margin` に加え htkReactionItem クラスを付けて、Hataskey UI 2 モードで
		     ノート下に余分な panel 塗りが残る「ゴミ」を透過化するためのフックにする。 -->
		<div v-for="item in items" :key="item.id" :to="`/clips/${item.id}`" class="_panel _margin htkReactionItem">
			<div :class="$style.header">
				<MkAvatar :class="$style.avatar" :user="user"/>
				<MkReactionIcon :class="$style.reaction" :reaction="item.type" :noStyle="true"/>
				<MkTime :time="item.createdAt" :class="$style.createdAt"/>
			</div>
			<MkNote :key="item.id" :note="item.note"/>
		</div>
	</MkPagination>
</div>
</template>

<script lang="ts" setup>
import { computed, markRaw } from 'vue';
import * as Misskey from 'cherrypick-js';
import MkPagination from '@/components/MkPagination.vue';
import MkNote from '@/components/MkNote.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import { Paginator } from '@/utility/paginator.js';

const props = defineProps<{
	user: Misskey.entities.User;
}>();

const paginator = markRaw(new Paginator('users/reactions', {
	limit: 20,
	computedParams: computed(() => ({
		userId: props.user.id,
	})),
}));

defineExpose({ reload: () => paginator.reload() });
</script>

<style lang="scss" module>
.header {
	display: flex;
	align-items: center;
	padding: 8px 16px;
	margin-bottom: 8px;
	border-bottom: solid 2px var(--MI_THEME-divider);
}

.avatar {
	width: 24px;
	height: 24px;
	margin-right: 8px;
}

.reaction {
	width: 32px;
	height: 32px;
}

.createdAt {
	margin-left: auto;
}
</style>

<!-- 旗鯖fork(Hataskey UI 2): 各リアクションアイテムは `_panel _margin` (パネル塗り + 下マージン)
     で囲まれているが、Hataskey UI 2 で内包する MkNote が半透明化するため、ノートより下の
     パネル塗り部分が「余白のゴミ」として目立つ。glass モードでは wrapper のパネル塗り/角丸を
     透明化し、ボーダーだけ残して「ノート単体」に見えるようにする。 -->
<style lang="scss">
html.hataGlassUi ._panel.htkReactionItem {
	background: transparent !important;
	box-shadow: none !important;
	border-radius: 0 !important;
	padding-bottom: 0 !important;
	/* ヘッダ (アバター+リアクション+時刻) の下線は _margin (下マージン) と併せて
	   自然な仕切りとして働くのでそのまま残す。 */
}
</style>
