<!--
SPDX-FileCopyrightText: syuilo and misskey-project & noridev and cherrypick-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/cherrypick" label="CherryPick" :keywords="['cherrypick']" icon="ti ti-bulb-filled">
	<div class="_gaps_m">
		<FormSection v-show="showsCategory('advanced', 'post', 'timeline', 'appearance')" first data-settings-section-anchor="owner:cherrypick:function" :data-settings-section-label="i18n.ts._cherrypick.function" data-settings-section-icon="ti ti-bulb" tabindex="-1">
			<template #label><SearchLabel>{{ i18n.ts._cherrypick.function }}</SearchLabel></template>
			<template #description><SearchText>{{ i18n.ts._cherrypick.functionDescription }}</SearchText></template>
			<div class="_gaps_m">
				<SearchMarker v-show="showsCategory('advanced')" :keywords="['nickname', 'enable']">
					<MkPreferenceContainer k="nicknameEnabled">
						<MkSwitch v-model="nicknameEnabled">
							<template #label><SearchLabel>{{ i18n.ts._cherrypick.nickname }}</SearchLabel></template>
							<template #caption><SearchText>{{ i18n.ts._cherrypick.nicknameDescription }}</SearchText></template>
						</MkSwitch>
					</MkPreferenceContainer>
				</SearchMarker>

				<div v-show="showsCategory('post', 'timeline')" class="_gaps_s">
					<SearchMarker v-show="showsCategory('post')" :keywords="['nickname', 'enable']">
						<MkPreferenceContainer k="useEnterToSend">
							<MkSwitch v-model="useEnterToSend">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.useEnterToSend }}</SearchLabel></template>
								<template #caption><SearchText>{{ i18n.ts._cherrypick.useEnterToSendDescription }}</SearchText></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>

					<SearchMarker v-show="showsCategory('post')" :keywords="['post', 'form', 'visibility', 'hotkey']">
						<MkPreferenceContainer k="postFormVisibilityHotkey">
							<MkSwitch v-model="postFormVisibilityHotkey">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.postFormVisibilityHotkey }}</SearchLabel></template>
								<template #caption><SearchText>{{ i18n.ts._cherrypick.postFormVisibilityHotkeyDescription }}</SearchText></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>

					<SearchMarker v-show="showsCategory('timeline')" :keywords="['show', 'renote', 'note', 'confirm', 'popup']">
						<MkPreferenceContainer k="showRenoteConfirmPopup">
							<MkSwitch v-model="showRenoteConfirmPopup">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.showRenoteConfirmPopup }}</SearchLabel></template>
								<template #caption><SearchText>{{ i18n.ts._cherrypick.showRenoteConfirmPopupDescription }}</SearchText></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>

					<SearchMarker v-show="showsCategory('timeline')" :keywords="['expand', 'note', 'click']">
						<MkPreferenceContainer k="expandOnNoteClick">
							<MkSwitch v-model="expandOnNoteClick">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.expandOnNoteClick }}</SearchLabel></template>
								<template #caption><SearchText>{{ i18n.ts._cherrypick.expandOnNoteClickDescription }}</SearchText></template>
							</MkSwitch>
						</MkPreferenceContainer>

						<MkDisableSection :disabled="!expandOnNoteClick">
							<SearchMarker :keywords="['behavior']">
								<MkPreferenceContainer k="expandOnNoteClickBehavior">
									<MkSelect
										v-model="expandOnNoteClickBehavior"
										:items="[
											{ label: i18n.ts._nsfwOpenBehavior.click, value: 'click' },
											{ label: i18n.ts._nsfwOpenBehavior.doubleClick, value: 'doubleClick' },
										]"
										style="margin-left: 44px;"
									>
										<template #label><SearchLabel>{{ i18n.ts._cherrypick.expandOnNoteClickBehavior }}</SearchLabel></template>
									</MkSelect>
								</MkPreferenceContainer>
							</SearchMarker>
						</MkDisableSection>
					</SearchMarker>
				</div>

				<SearchMarker v-show="showsCategory('appearance')" :keywords="['display', 'header', 'navbar', 'scroll']">
					<div>
						<MkPreferenceContainer k="displayHeaderNavBarWhenScroll">
							<MkRadios v-model="displayHeaderNavBarWhenScroll">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.displayHeaderNavBarWhenScroll }}</SearchLabel></template>
								<option value="all">{{ i18n.ts._cherrypick._displayHeaderNavBarWhenScroll.all }}</option>
								<option value="hideHeaderOnly">{{ i18n.ts._cherrypick._displayHeaderNavBarWhenScroll.hideHeaderOnly }}</option>
								<option value="hideHeaderFloatBtn">{{ i18n.ts._cherrypick._displayHeaderNavBarWhenScroll.hideHeaderFloatBtn }}</option>
								<option value="hideFloatBtnOnly">{{ i18n.ts._cherrypick._displayHeaderNavBarWhenScroll.hideFloatBtnOnly }}</option>
								<option value="hideFloatBtnNavBar">{{ i18n.ts._cherrypick._displayHeaderNavBarWhenScroll.hideFloatBtnNavBar }}</option>
								<option value="hide">{{ i18n.ts._cherrypick._displayHeaderNavBarWhenScroll.hide }}</option>
							</MkRadios>
						</MkPreferenceContainer>
					</div>
				</SearchMarker>
			</div>
		</FormSection>

		<SearchMarker v-show="showsCategory('timeline', 'notify', 'appearance', 'post')" :keywords="['patch', 'behavior']">
			<FormSection data-settings-section-anchor="owner:cherrypick:patch" :data-settings-section-label="i18n.ts._cherrypick.patch" data-settings-section-icon="ti ti-bandage" tabindex="-1">
				<template #label><SearchLabel>{{ i18n.ts._cherrypick.patch }}</SearchLabel></template>
				<template #description><SearchText>{{ i18n.ts._cherrypick.patchDescription }}</SearchText></template>
				<div class="_gaps_m">
					<SearchMarker v-show="showsCategory('timeline')" :keywords="['reactable', 'remote', 'reaction', 'react', 'enable']">
						<MkPreferenceContainer k="reactableRemoteReactionEnabled">
							<MkSwitch v-model="reactableRemoteReactionEnabled">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.reactableRemoteReaction }}</SearchLabel></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>

					<SearchMarker v-show="showsCategory('notify')" :keywords="['show', 'follow', 'message', 'enable']">
						<MkPreferenceContainer k="showFollowingMessageInsteadOfButtonEnabled">
							<MkSwitch v-model="showFollowingMessageInsteadOfButtonEnabled">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.showFollowingMessageInsteadOfButton }}</SearchLabel></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>

					<SearchMarker v-show="showsCategory('appearance')" :keywords="['mobile', 'header', 'change']">
						<MkPreferenceContainer k="mobileHeaderChange">
							<MkSwitch v-model="mobileHeaderChange">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.mobileHeaderChange }}</SearchLabel></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>

					<SearchMarker v-show="showsCategory('post')" :keywords="['rename', 'post', 'form', 'nya']">
						<MkPreferenceContainer k="renameTheButtonInPostFormToNya">
							<MkSwitch v-model="renameTheButtonInPostFormToNya">
								<template #label><SearchLabel>{{ i18n.ts._cherrypick.renameTheButtonInPostFormToNya }}</SearchLabel></template>
								<template #caption><SearchText>{{ i18n.ts._cherrypick.renameTheButtonInPostFormToNyaDescription }}</SearchText></template>
							</MkSwitch>
						</MkPreferenceContainer>
					</SearchMarker>
				</div>
			</FormSection>
		</SearchMarker>

		<SearchMarker v-show="presentationCategory == null" :keywords="['behavior', 'lab']">
			<FormSection>
				<template #label><i class="ti ti-flask"/> <SearchLabel>{{ i18n.ts.cherrypickLabs }}</SearchLabel></template>
				<template #description><SearchText>{{ i18n.ts.cherrypickLabsDescription }}</SearchText></template>
				<div class="_gaps_m">
				</div>
			</FormSection>
		</SearchMarker>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { computed, watch } from 'vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkRadios from '@/components/MkRadios.vue';
import FormSection from '@/components/form/section.vue';
import { prefer } from '@/preferences.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { suggestReload } from '@/utility/reload-suggest.js';
import MkDisableSection from '@/components/MkDisableSection.vue';
import MkPreferenceContainer from '@/components/MkPreferenceContainer.vue';
import type { SettingsBentoCategoryId } from '@/pages/settings-redesign/settings-bento-catalog.js';

const props = defineProps<{ presentationCategory?: SettingsBentoCategoryId }>();

function showsCategory(...categories: SettingsBentoCategoryId[]): boolean {
	return props.presentationCategory == null || categories.includes(props.presentationCategory);
}

const nicknameEnabled = prefer.model('nicknameEnabled');
const useEnterToSend = prefer.model('useEnterToSend');
const postFormVisibilityHotkey = prefer.model('postFormVisibilityHotkey');
const showRenoteConfirmPopup = prefer.model('showRenoteConfirmPopup');
const expandOnNoteClick = prefer.model('expandOnNoteClick');
const expandOnNoteClickBehavior = prefer.model('expandOnNoteClickBehavior');
const displayHeaderNavBarWhenScroll = prefer.model('displayHeaderNavBarWhenScroll');
const reactableRemoteReactionEnabled = prefer.model('reactableRemoteReactionEnabled');
const showFollowingMessageInsteadOfButtonEnabled = prefer.model('showFollowingMessageInsteadOfButtonEnabled');
const mobileHeaderChange = prefer.model('mobileHeaderChange');
const renameTheButtonInPostFormToNya = prefer.model('renameTheButtonInPostFormToNya');
// 旗鯖fork: UI セクション(enableWidgetsArea) および Friendly UI 関連は UI から完全廃止
// (preferences/def.ts 側のキー定義は既存ユーザーの保存済み設定値との整合のため残してある)

watch([
	renameTheButtonInPostFormToNya,
], async () => {
	await prefer.commit('renameTheButtonInPostFormToNyaManualSet', true);
});

watch([
	expandOnNoteClick,
	reactableRemoteReactionEnabled,
	mobileHeaderChange,
	renameTheButtonInPostFormToNya,
], () => {
	suggestReload();
});

const headerActions = computed(() => []);

const headerTabs = computed(() => []);

definePage(() => ({
	title: 'CherryPick',
	icon: 'ti ti-bulb-filled',
}));
</script>
