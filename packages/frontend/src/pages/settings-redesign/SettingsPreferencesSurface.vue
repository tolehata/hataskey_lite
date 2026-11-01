<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section v-if="destination != null && visibleControlGroups.length > 0" class="root" :data-bento-category="categoryId" :data-category-flow="categoryId != null && categoryFlow ? 'true' : undefined" :data-settings-destination-id="destination.id" :data-motion-enabled="motionEnabled ? 'true' : 'false'">
	<header v-if="categoryId == null" class="heading" :class="{ sHero: destination.id === 'hataskey-ui-s' }">
		<!-- 旗鯖fork: カテゴリを移ると文章が左右に滑って入れ替わる。
		     ⚠️key に行き先のidを与えないと差し替わらない。 -->
		<Transition name="settings-heading" :css="motionEnabled" mode="out-in">
			<div :key="destination.id" class="headingText">
				<div v-if="destination.id === 'hataskey-ui-s'" class="sHeroLayout">
					<div class="sHeroCopy">
						<span v-if="ui === 'hataskey3'" class="sBadge">{{ i18n.ts.inUse }}</span>
						<h2><span class="settingsBrand">{{ group.title }}</span></h2>
						<p>{{ group.description }}</p>
						<p class="sImmediate">{{ i18n.ts._hata._settingsRedesign.immediate.uiSImmediate }}</p>
					</div>
					<button type="button" class="sReset" @click="resetUi3ComposerPreferences"><i class="ti ti-restore" aria-hidden="true"></i>{{ i18n.ts.resetToDefaultValue }}</button>
				</div>
				<template v-else>
					<p class="eyebrow">{{ destination.categoryId === 'cherrypick' ? 'CherryPick' : destination.label }}</p>
					<h2>{{ group.title }}</h2>
					<p>{{ group.description }}</p>
				</template>
			</div>
		</Transition>
	</header>
	<section v-for="controlGroup in visibleControlGroups" :key="controlGroup.id" class="preferenceSection" :data-bento-section="categoryId == null ? undefined : controlGroup.id" :data-settings-section-anchor="categoryId == null ? undefined : `preference:${controlGroup.id}`" :data-settings-section-label="categoryId == null ? undefined : controlGroup.label" :data-settings-section-icon="controlGroup.sectionId == null ? undefined : bentoSectionIcon(controlGroup.sectionId)" :tabindex="categoryId == null ? undefined : -1">
		<h3 v-if="categoryId != null" class="sectionTitle">{{ controlGroup.label }}</h3>
		<SettingsSectionExplainer v-if="controlGroup.sectionId != null" :sectionId="controlGroup.sectionId" :motionEnabled="motionEnabled"/>
		<template v-if="isUiSSection(controlGroup.id)">
			<section v-if="destination.id === 'hataskey-ui-s' || categoryId === 'appearance'" class="auxiliary" role="list" :aria-label="group.title">
				<article class="control" role="listitem" :data-settings-search-id="uiSDisplaySizeSearchId">
					<MkRadios :modelValue="hataskeyUiSDisplaySize" @update:modelValue="setHataskeyUiSDisplaySize($event)">
						<template #label>{{ i18n.ts._hata._hataskeyUi3._displaySize.title }}</template>
						<template #caption>{{ i18n.ts._hata._hataskeyUi3._displaySize.caption }}</template>
						<option value="standard">{{ i18n.ts._hata._hataskeyUi3._displaySize.standard }}</option>
						<option value="small">{{ i18n.ts._hata._hataskeyUi3._displaySize.small }}</option>
					</MkRadios>
				</article>
			</section>
			<HataskeyUiSRssSettings v-if="destination.id === 'hataskey-ui-s' || categoryId === 'appearance'" class="embeddedUiSettings" :data-settings-section-anchor="categoryId == null ? undefined : 'preference:ui-s:rss'" :data-settings-section-label="i18n.ts._hata._hataskeyUi3._rss.settings" data-settings-section-icon="ti ti-rss" :tabindex="categoryId == null ? undefined : -1"/>
			<HataskeyUiSBottomNavSettings v-if="destination.id === 'hataskey-ui-s' || categoryId === 'appearance'" class="embeddedUiSettings" :data-settings-section-anchor="categoryId == null ? undefined : 'preference:ui-s:bottom-nav'" :data-settings-section-label="i18n.ts._hata._hataskeyUi3._bottomNav.title" data-settings-section-icon="ti ti-layout-bottombar" :tabindex="categoryId == null ? undefined : -1"/>
		</template>

		<section v-if="showsAuxiliary('lang', controlGroup.id) || showsAuxiliary('overridedDeviceKind', controlGroup.id) || showsAuxiliary('realtimeMode', controlGroup.id)" class="auxiliary" role="list" :aria-label="group.title">
			<article v-if="showsAuxiliary('lang', controlGroup.id)" class="control" role="listitem" :data-settings-search-id="searchIdFor('lang')">
				<MkSelect :modelValue="models.lang.value ?? ''" :items="languageItems" @update:modelValue="models.lang.value = String($event)">
					<template #label>{{ auxiliaryLabel('lang') }}</template>
					<template #caption><span v-for="caption in auxiliaryCaption('lang')" :key="caption" class="captionLine">{{ caption }}</span></template>
				</MkSelect>
			</article>
			<article v-if="showsAuxiliary('overridedDeviceKind', controlGroup.id)" class="control" role="listitem" :data-settings-search-id="searchIdFor('overridedDeviceKind')">
				<MkRadios :modelValue="models.overridedDeviceKind.value" @update:modelValue="writeDeviceKind">
					<template #label>{{ auxiliaryLabel('overridedDeviceKind') }}</template>
					<option :value="null">{{ i18n.ts.auto }}</option>
					<option value="smartphone">{{ i18n.ts.smartphone }}</option>
					<option value="tablet">{{ i18n.ts.tablet }}</option>
					<option value="desktop">{{ i18n.ts.desktop }}</option>
				</MkRadios>
			</article>
			<article v-if="showsAuxiliary('realtimeMode', controlGroup.id)" class="control" role="listitem" :data-settings-search-id="searchIdFor('realtimeMode')">
				<MkSwitch :modelValue="models.realtimeMode.value" @update:modelValue="models.realtimeMode.value = $event">
					<template #label>{{ auxiliaryLabel('realtimeMode') }}</template>
					<template #caption><span v-for="caption in auxiliaryCaption('realtimeMode')" :key="caption" class="captionLine">{{ caption }}</span></template>
				</MkSwitch>
			</article>
		</section>

		<section v-if="showsAuxiliary('useBoldFont', controlGroup.id)" class="auxiliary" role="list" :aria-label="group.title">
			<article class="control" role="listitem" :data-settings-search-id="searchIdFor('useBoldFont')"><MkSwitch :modelValue="models.useBoldFont.value" @update:modelValue="models.useBoldFont.value = $event"><template #label>{{ auxiliaryLabel('useBoldFont') }}</template></MkSwitch></article>
			<article class="control" role="listitem" :data-settings-search-id="searchIdFor('useSystemFont')"><MkSwitch :modelValue="models.useSystemFont.value" @update:modelValue="models.useSystemFont.value = $event"><template #label>{{ auxiliaryLabel('useSystemFont') }}</template></MkSwitch></article>
		</section>

		<div v-if="controlGroup.controls.length" class="controls" role="list" :aria-label="controlGroup.label">
			<article
				v-for="control in controlGroup.controls" :key="control.key" class="control" role="listitem"
				:data-settings-search-id="searchIdFor(control.key)" :data-settings-preference-key="control.key"
				:data-settings-destination-id="control.destinationId" :data-disabled="isDisabled(control) ? 'true' : undefined"
			>
				<div v-if="control.key === 'fontSize'" class="fontSizePreview" :style="{ fontSize: `${Number(read(control.key) ?? 8) + 6}px` }">{{ i18n.ts._mfc.dummy }}</div>
				<div v-if="control.key === 'emojiStyle'" class="emojiPreview"><Mfm :key="String(read(control.key))" text="🍮🍦🍭🍩🍰🍫🍬🥞🍪"/></div>

				<div v-if="ui === 'simple' && (control.key === 'notificationPosition' || control.key === 'notificationStackAxis')">
					<div class="controlLabel">{{ control.label }}</div>
					<p>{{ i18n.ts._hata._notificationToast.automatic }}</p>
					<p v-for="caption in control.caption" :key="caption" class="captionLine">{{ caption }}</p>
				</div>
				<MkSwitch v-else-if="control.key === 'smoothTransitionAnimations'" :modelValue="true" disabled @update:modelValue="noop">
					<template #label><span>{{ control.label }}</span><span class="brand">CherryPick</span></template>
					<template #caption><span class="captionLine">{{ i18n.ts.turnOffToImprovePerformance }}</span><span class="locked"><i class="ti ti-lock" aria-hidden="true"></i> {{ i18n.ts._hata._timelineCustom.alwaysEnabled }}</span></template>
				</MkSwitch>
				<MkSwitch v-else-if="control.kind === 'switch'" :modelValue="Boolean(read(control.key))" :disabled="isDisabled(control)" @update:modelValue="write(control.key, $event)">
					<template #label><span>{{ control.label }}</span><span v-if="control.cherry" class="brand">CherryPick</span></template>
					<template v-if="control.key === 'setFederationAvatarShape'" #caption>
						<span class="captionLine">{{ canSetFederationAvatarShape ? i18n.ts.setFederationAvatarShapeDescription : i18n.ts.cannotBeUsedFunc }}</span>
						<a v-if="!canSetFederationAvatarShape" class="_link" @click="models.learnMoreCantUseSetFederationAvatarShape">{{ i18n.ts.learnMore }}</a>
					</template>
					<template v-else-if="control.key === 'chat.sendOnEnter'" #caption>
						<span class="captionLine"><b>{{ i18n.ts._settings.ifOn }}:</b> {{ i18n.ts._chat.send }}: Enter / {{ i18n.ts._chat.newline }}: Shift + Enter</span>
						<span class="captionLine"><b>{{ i18n.ts._settings.ifOff }}:</b> {{ i18n.ts._chat.send }}: Ctrl + Enter / {{ i18n.ts._chat.newline }}: Enter</span>
					</template>
					<template v-else-if="control.key === 'showFixedPostForm' && ui === 'hataskey3'" #caption><span class="captionLine">{{ i18n.ts._hata._customSettings._general.ui3ComposerUsePosition }}</span></template>
					<template v-else-if="control.caption.length" #caption><span v-for="caption in control.caption" :key="caption" class="captionLine">{{ caption }}</span></template>
				</MkSwitch>
				<MkInput v-else-if="control.kind === 'color'" type="color" :modelValue="String(read(control.key) ?? '')" :disabled="isDisabled(control)" @update:modelValue="write(control.key, $event)">
					<template #label>{{ control.label }}</template>
					<template v-if="control.caption.length" #caption><span v-for="caption in control.caption" :key="caption" class="captionLine">{{ caption }}</span></template>
				</MkInput>
				<MkSelect v-else-if="control.kind === 'select'" :modelValue="String(read(control.key) ?? '')" :items="selectItems(control)" :disabled="isDisabled(control)" @update:modelValue="write(control.key, $event)">
					<template #label><span>{{ control.label }}</span><span v-if="control.cherry" class="brand">CherryPick</span></template>
					<template v-if="control.caption.length" #caption><span v-for="caption in control.caption" :key="caption" class="captionLine">{{ caption }}</span></template>
				</MkSelect>
				<MkRadios v-else-if="control.kind === 'radios'" :modelValue="read(control.key)" :disabled="isDisabled(control)" @update:modelValue="write(control.key, $event)">
					<template #label><span>{{ control.label }}</span><span v-if="control.cherry" class="brand">CherryPick</span></template>
					<option v-for="option in control.options ?? []" :key="option" :value="option">{{ optionLabel(control.key, option) }}</option>
					<template v-if="control.caption.length" #caption><span v-for="caption in control.caption" :key="caption" class="captionLine">{{ caption }}</span></template>
				</MkRadios>
				<MkRange v-else-if="control.kind === 'range'" :modelValue="Number(read(control.key) ?? control.min ?? 1)" :min="control.min ?? 1" :max="control.max ?? 3" :step="1" :disabled="isDisabled(control)" easing :showTicks="control.key === 'pollingInterval'" :textConverter="rangeTextConverter(control.key)" @update:modelValue="write(control.key, $event)">
					<template #label><span>{{ control.label }}</span><span v-if="control.cherry" class="brand">CherryPick</span></template>
					<template v-if="control.caption.length" #caption><span v-for="caption in control.caption" :key="caption" class="captionLine">{{ caption }}</span></template>
					<template v-if="control.key === 'pollingInterval'" #prefix><i class="ti ti-player-play" aria-hidden="true"></i></template>
					<template v-if="control.key === 'pollingInterval'" #suffix><i class="ti ti-player-track-next" aria-hidden="true"></i></template>
				</MkRange>
				<div v-else class="reactionControl">
					<div class="controlLabel"><span>{{ control.label }}</span><span class="brand">CherryPick</span></div>
					<MkCustomEmoji v-if="String(read(control.key)).startsWith(':')" :name="String(read(control.key))" :useOriginalSize="false" :normal="true" :noStyle="true" class="reactionValue"/>
					<MkEmoji v-else-if="read(control.key)" :emoji="String(read(control.key))" :normal="true" :noStyle="true" class="reactionValue"/>
					<div v-else class="reactionValue">{{ i18n.ts.notSet }}</div>
					<div class="actions"><MkButton rounded small inline @click="models.chooseNewReaction"><i class="ti ti-pencil" aria-hidden="true"></i> {{ i18n.ts.edit }}</MkButton><MkButton rounded small inline danger @click="models.resetReaction"><i class="ti ti-reload" aria-hidden="true"></i> {{ i18n.ts.default }}</MkButton></div>
				</div>
				<div v-if="control.key === 'animatedMfm'" class="mfmPreview"><Mfm v-if="Boolean(read('advancedMfm')) && Boolean(read('animatedMfm'))" :key="String(read('emojiStyle'))" text="$[jelly 🍮] $[spin 🍪] $[shake 🍭]"/><Mfm v-else :key="String(read('emojiStyle'))" text="🍮 🍪 🍭"/></div>
				<MkInfo v-if="control.key === 'fontSize' && String(read(control.key)) !== String(models.fontSizeBefore.value)">{{ i18n.ts.reloadToApplySetting2 }} <a class="_link" @click="models.reload">{{ i18n.ts.reload }}</a></MkInfo>
			</article>
		</div>

		<section v-if="showsAuxiliary('dataSaver.media', controlGroup.id)" class="toolbox" :data-settings-destination-id="destination.id">
			<MkInfo>{{ i18n.ts.reloadRequiredToApplySettings }}</MkInfo>
			<div class="actions"><MkButton @click="models.setAllDataSaver(true)">{{ i18n.ts.enableAll }}</MkButton><MkButton @click="models.setAllDataSaver(false)">{{ i18n.ts.disableAll }}</MkButton></div>
			<article v-for="key in dataSaverKeys" :key="key" class="control" :data-settings-search-id="searchIdFor(`dataSaver.${key}`)"><MkSwitch :modelValue="dataSaverValue(key)" :disabled="dataSaverDisabled(key)" @update:modelValue="writeDataSaver(key, $event)"><template #label>{{ auxiliaryLabel(`dataSaver.${key}`) }}</template><template #caption><span v-for="caption in auxiliaryCaption(`dataSaver.${key}`)" :key="caption" class="captionLine">{{ caption }}</span></template></MkSwitch></article>
		</section>

		<section v-if="showsAuxiliary('externalNavigationWarning', controlGroup.id)" class="toolbox">
			<article class="control" :data-settings-search-id="searchIdFor('externalNavigationWarning')"><MkSwitch :modelValue="Boolean(models.externalNavigationWarning.value)" @update:modelValue="models.externalNavigationWarning.value = $event"><template #label><span>{{ auxiliaryLabel('externalNavigationWarning') }}</span><span class="brand">CherryPick</span></template></MkSwitch></article>
			<article class="control" :data-settings-search-id="searchIdFor('trustedDomains')"><MkTextarea :modelValue="models.trustedDomains.value" @update:modelValue="models.trustedDomains.value = $event"><template #label><span>{{ auxiliaryLabel('trustedDomains') }}</span><span class="brand">CherryPick</span></template><template #caption><i class="ti ti-alert-triangle warningIcon" aria-hidden="true"></i><span v-for="caption in auxiliaryCaption('trustedDomains')" :key="caption" class="captionLine">{{ caption }}</span></template></MkTextarea></article>
			<div class="actions"><MkButton primary :disabled="!models.trustedDomainsChanged.value" @click="models.saveTrustedDomains"><i class="ti ti-device-floppy" aria-hidden="true"></i> {{ i18n.ts.save }}</MkButton><MkButton danger :disabled="!prefer.r.trustedDomains.value.length" @click="models.clearTrustedDomains"><i class="ti ti-trash" aria-hidden="true"></i> {{ i18n.ts._externalNavigationWarning.deleteTrustedDomainList }}</MkButton></div>
		</section>

		<section v-if="showsAuxiliary('searchEngine', controlGroup.id)" class="toolbox">
			<article class="control" :data-settings-search-id="searchIdFor('searchEngine')"><MkSelect :modelValue="String(models.searchEngine.value ?? '')" :items="searchEngineItems" @update:modelValue="models.searchEngine.value = $event"><template #label><span>{{ auxiliaryLabel('searchEngine') }}</span><span class="brand">CherryPick</span></template><template #caption><span v-for="caption in auxiliaryCaption('searchEngine')" :key="caption" class="captionLine">{{ caption }}</span></template></MkSelect></article>
			<article v-if="models.searchEngine.value === 'other'" class="control" :data-settings-search-id="searchIdFor('searchEngineUrl')"><MkInput :modelValue="String(models.searchEngineUrl.value ?? '')" @update:modelValue="models.searchEngineUrl.value = $event"><template #label><span>{{ auxiliaryLabel('searchEngineUrl') }}</span><span class="brand">CherryPick</span></template><template #caption><span v-for="caption in auxiliaryCaption('searchEngineUrl')" :key="caption" class="captionLine">{{ caption }}</span></template></MkInput></article>
			<article v-if="models.searchEngine.value === 'other'" class="control" :data-settings-search-id="searchIdFor('searchEngineUrlQuery')"><MkInput :modelValue="String(models.searchEngineUrlQuery.value ?? '')" @update:modelValue="models.searchEngineUrlQuery.value = $event"><template #label><span>{{ auxiliaryLabel('searchEngineUrlQuery') }}</span><span class="brand">CherryPick</span></template><template #caption><span v-for="caption in auxiliaryCaption('searchEngineUrlQuery')" :key="caption" class="captionLine">{{ caption }}</span></template></MkInput></article>
		</section>
		<section v-if="showsAuxiliary('pinnedUserLists', controlGroup.id)" class="toolbox" :data-settings-search-id="searchIdFor('pinnedUserLists')"><h3>{{ auxiliaryLabel('pinnedUserLists') }}</h3><MkButton v-if="!prefer.r.pinnedUserLists.value.length" @click="models.setPinnedList">{{ i18n.ts.add }}</MkButton><MkButton v-else danger @click="models.removePinnedList"><i class="ti ti-trash" aria-hidden="true"></i> {{ i18n.ts.remove }}</MkButton></section>
		<section v-if="showsAuxiliary('testNotification', controlGroup.id)" class="toolbox" :data-settings-search-id="searchIdFor('testNotification')"><h3>{{ i18n.ts.notification }}</h3><MkButton @click="models.testNotification"><i class="ti ti-bell" aria-hidden="true"></i> {{ auxiliaryLabel('testNotification') }}</MkButton></section>
		<section v-if="showsAuxiliary('additionalUnicodeEmojiIndexes', controlGroup.id)" class="toolbox" :data-settings-search-id="searchIdFor('additionalUnicodeEmojiIndexes')"><h3>{{ auxiliaryLabel('additionalUnicodeEmojiIndexes') }}</h3><div class="actions"><template v-for="language in emojiIndexLangs" :key="language"><MkButton v-if="store.r.additionalUnicodeEmojiIndexes.value[language]" danger @click="models.removeEmojiIndex(language)"><i class="ti ti-trash" aria-hidden="true"></i> {{ i18n.ts.remove }} ({{ emojiLanguageName(language) }})</MkButton><MkButton v-else @click="models.downloadEmojiIndex(language)"><i class="ti ti-download" aria-hidden="true"></i> {{ emojiLanguageName(language) }}</MkButton></template></div></section>
	</section>
</section>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { langs, ui } from '@@/js/config.js';
import { canonicalSearchIdForPreferenceKey, controlsForPreferenceDestination, preferenceControls, parsePreferenceDestination, preferenceAuxiliaryControls, preferenceGroups, uiSDisplaySizeSearchId } from './settings-preferences-catalog.js';
import { bentoPreferenceCategory, bentoPreferencePlacements, bentoSectionIcon, bentoSectionIds, bentoSectionLabel, settingsBentoCategories } from './settings-bento-catalog.js';
import { emojiIndexLangs, createSettingsPreferenceModels } from './settings-preferences-models.js';
import SettingsSectionExplainer from './SettingsSectionExplainer.vue';
import HataskeyUiSRssSettings from './HataskeyUiSRssSettings.vue';
import HataskeyUiSBottomNavSettings from './HataskeyUiSBottomNavSettings.vue';
import type { DataSaverKey } from './settings-preferences-models.js';
import type { PreferenceContainerKey, PreferenceControl, SettingsInventoryKey } from './settings-preferences-catalog.js';
import type { SettingsBentoCategoryId } from './settings-bento-catalog.js';
import type { Hk3ComposerToolId } from '@/components/hataskey3/hk3-composer-tools.js';
import { HK3_COMPOSER_SHORTCUT_NONE, hk3ComposerToolLabel } from '@/components/hataskey3/hk3-composer-tools.js';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkInput from '@/components/MkInput.vue';
import MkRange from '@/components/MkRange.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';
import { getInitialPrefValue } from '@/preferences/manager.js';
import { hataskeyUiSDisplaySize, setHataskeyUiSDisplaySize } from '@/utility/hatasaba-device-prefs.js';
import { store } from '@/store.js';
import * as os from '@/os.js';

const props = defineProps<{ destinationId?: string; categoryId?: SettingsBentoCategoryId; categoryFlow?: boolean }>();
const models = createSettingsPreferenceModels();
const destination = computed(() => parsePreferenceDestination(props.destinationId ?? (props.categoryId != null ? 'display-general' : '')));
const group = computed(() => {
	const category = settingsBentoCategories.find(item => item.id === props.categoryId);
	return category != null ? { title: category.label, description: category.description } : destination.value == null ? { title: i18n.ts.preferences, description: i18n.ts.preferences } : preferenceGroups[destination.value.id];
});
const visibleControls = computed(() => props.categoryId != null ? preferenceControls.filter(control => bentoPreferenceCategory(control.key) === props.categoryId) : destination.value == null ? [] : controlsForPreferenceDestination(destination.value.id));
const visibleMountedControls = computed(() => visibleControls.value.filter(control => !control.key.startsWith('hataskeyUi3Rss') && isControlMounted(control)));
const visibleControlGroups = computed(() => {
	if (props.categoryId == null) return destination.value == null ? [] : [{ id: destination.value.id, sectionId: undefined, label: group.value.title, controls: visibleMountedControls.value }];
	return bentoSectionIds.filter(id => id.startsWith(`${props.categoryId}.`)).map(id => ({
		id, sectionId: id, label: bentoSectionLabel(id), controls: visibleMountedControls.value.filter(control => bentoPreferencePlacements[control.key] === id),
	})).filter(section => section.controls.length > 0 || preferenceAuxiliaryControls.some(control => bentoPreferencePlacements[control.key] === section.id));
});

function isUiSSection(sectionId: string): boolean {
	return props.categoryId == null || sectionId === 'appearance.section2';
}

function showsAuxiliary(key: SettingsInventoryKey, sectionId: string): boolean {
	return props.categoryId != null ? bentoPreferencePlacements[key] === sectionId : preferenceAuxiliaryControls.some(control => control.key === key && control.destinationId === destination.value?.id);
}

const dataSaverKeys: readonly DataSaverKey[] = ['media', 'avatar', 'disableUrlPreview', 'urlPreviewThumbnail', 'code'];
const languageItems = langs.map(item => ({ label: item[1], value: item[0] }));
const searchEngineItems = ['Google', 'Bing', 'Yahoo', 'Baidu', 'NAVER', 'Daum', 'DuckDuckGo'].map(value => ({ label: value, value: value.toLowerCase() })).concat([{ label: i18n.ts.other, value: 'other' }]);
const motionEnabled = computed(() => Boolean(prefer.r.animation.value));
const canSetFederationAvatarShape = computed(() => Boolean($i?.policies.canSetFederationAvatarShape));

function searchIdFor(key: string): string { return canonicalSearchIdForPreferenceKey(key); }

function read(key: PreferenceContainerKey): unknown { return models.controls[key].value; }

function write(key: PreferenceContainerKey, value: unknown): void { models.controls[key].value = value; }

const ui3ComposerResetKeys = [
	'hataskeyUi3ComposerShortcut1', 'hataskeyUi3ComposerShortcut2',
	'hataskeyUi3ComposerEmojiPosition', 'hataskeyUi3ComposerPosition',
] as const;

async function resetUi3ComposerPreferences(): Promise<void> {
	const { canceled } = await os.confirm({
		type: 'warning',
		title: i18n.ts.resetToDefaultValue,
		text: `${group.value.title}: ${i18n.ts.areYouSure}`,
	});
	if (canceled) return;
	for (const key of ui3ComposerResetKeys) write(key, getInitialPrefValue(key));
	setHataskeyUiSDisplaySize('standard');
}

function noop(): void { /* the forced-on control intentionally has no setter */ }

function writeDeviceKind(value: unknown): void { models.overridedDeviceKind.value = value === '' ? null : value; }

function auxiliaryForKey(key: string) { const control = preferenceAuxiliaryControls.find(item => item.key === key); if (control == null) throw new Error(`[settings-preferences] missing auxiliary control: ${key}`); return control; }

function auxiliaryLabel(key: string): string { return auxiliaryForKey(key).label; }

function auxiliaryCaption(key: string): readonly string[] { return auxiliaryForKey(key).caption; }

function optionLabel(key: PreferenceContainerKey, value: string): string {
	if (key === 'hataskeyUi3GlassDensity') return value === 'dense' ? i18n.ts._hata._customSettings._general.ui3GlassDensityDense : i18n.ts._hata._customSettings._general.ui3GlassDensityLight;
	if (key === 'hataskeyUi3ComposerShortcut1' || key === 'hataskeyUi3ComposerShortcut2') return value === HK3_COMPOSER_SHORTCUT_NONE ? i18n.ts._hata._customSettings._general.ui3ComposerShortcutNone : hk3ComposerToolLabel(value as Hk3ComposerToolId);
	if (key === 'hataskeyUi3ComposerEmojiPosition') return value === 'beforeVisibility' ? i18n.ts._hata._customSettings._general.ui3ComposerEmojiBeforeVisibility : i18n.ts._hata._customSettings._general.ui3ComposerEmojiAfterShortcuts;
	if (key === 'hataskeyUi3ComposerPosition') return value === 'top' ? i18n.ts._hata._customSettings._general.ui3ComposerPositionTop : i18n.ts._hata._customSettings._general.ui3ComposerPositionBottom;
	if (key === 'contextMenu') return ({ app: i18n.ts._contextMenu.app, appWithShift: i18n.ts._contextMenu.appWithShift, native: i18n.ts._contextMenu.native }[value as 'app' | 'appWithShift' | 'native']);
	if (key === 'instanceTicker') return ({ none: i18n.ts._instanceTicker.none, remote: i18n.ts._instanceTicker.remote, always: i18n.ts._instanceTicker.always }[value as 'none' | 'remote' | 'always']);
	if (key === 'showingAnimatedImages') return i18n.ts._showingAnimatedImages[value as 'always' | 'interaction' | 'inactive'];
	if (key === 'hemisphere') return i18n.ts._hemisphere[value as 'N' | 'S'];
	if (key === 'mediaListWithOneImageAppearance' && value !== 'expand') return value === '16_9' ? i18n.tsx.limitTo({ x: '16:9' }) : value === '1_1' ? i18n.tsx.limitTo({ x: '1:1' }) : i18n.tsx.limitTo({ x: '2:3' });
	const values: Partial<Record<string, string>> = { native: i18n.ts.native, fluentEmoji: 'Fluent Emoji', twemoji: 'Twemoji', none: i18n.ts.auto, public: i18n.ts._visibility.public, home: i18n.ts._visibility.home, followers: i18n.ts._visibility.followers, specified: i18n.ts._visibility.specified, respect: i18n.ts._displayOfSensitiveMedia.respect, ignore: i18n.ts._displayOfSensitiveMedia.ignore, force: i18n.ts._displayOfSensitiveMedia.force, click: i18n.ts._nsfwOpenBehavior.click, doubleClick: i18n.ts._nsfwOpenBehavior.doubleClick, leftTop: i18n.ts.leftTop, rightTop: i18n.ts.rightTop, leftBottom: i18n.ts.leftBottom, rightBottom: i18n.ts.rightBottom, vertical: i18n.ts.vertical, horizontal: i18n.ts.horizontal, small: i18n.ts.small, medium: i18n.ts.medium, large: i18n.ts.large, expand: i18n.ts.default, auto: i18n.ts.auto, popup: i18n.ts.popup, drawer: i18n.ts.drawer };
	if (key === 'newNoteReceivedNotificationBehavior') return i18n.ts._newNoteReceivedNotificationBehavior[value as 'default' | 'count' | 'none'];
	if (key === 'serverDisconnectedBehavior') return i18n.ts._serverDisconnectedBehavior[value as 'reload' | 'dialog' | 'quiet' | 'none'];
	if (key === 'requireRefreshBehavior') return i18n.ts._requireRefreshBehavior[value as 'dialog' | 'quiet'];
	const label = values[value];
	if (label == null) throw new Error(`[settings-preferences] missing option label: ${key}.${value}`);
	return label;
}

function selectItems(control: PreferenceControl) { return (control.options ?? []).map(value => ({ label: optionLabel(control.key, value), value })); }

function rangeTextConverter(key: PreferenceContainerKey) { return key === 'pollingInterval' ? (value: number) => value === 1 ? i18n.ts.low : value === 2 ? i18n.ts.middle : value === 3 ? i18n.ts.high : '' : undefined; }

function isDisabled(control: PreferenceControl): boolean {
	const key = control.key;
	if (key.startsWith('postFormVisibilityBorder.') && key !== 'postFormVisibilityBorder.enabled') return !read('postFormVisibilityBorder.enabled');
	if (key === 'showFixedPostForm') return ui === 'hataskey3';
	if (key === 'pollingInterval') return models.realtimeMode.value;
	if (key === 'enableMarkByDate') return Boolean(read('enableAbsoluteTime'));
	if (key === 'enableQuickAddMfmFunction' || key === 'animatedMfm') return !read('advancedMfm');
	if (key === 'defaultNoteVisibility' || key === 'defaultNoteLocalOnly') return Boolean(read('rememberNoteVisibility'));
	if (key === 'forceRenoteVisibilitySelection') return Boolean(read('renoteVisibilitySelection'));
	if (key === 'showingAnimatedImages') return Boolean(read('disableShowingAnimatedImages'));
	if (key === 'setFederationAvatarShape') return !canSetFederationAvatarShape.value;
	return false;
}

function isControlMounted(control: PreferenceControl): boolean {
	if (control.key === 'instanceTicker' && instance.federation === 'none') return false;
	if (control.key === 'removeModalBgColorForBlur' && !(Boolean(read('useBlurEffect')) && Boolean(read('useBlurEffectForModal')))) return false;
	return !((control.key === 'chat.sendOnEnter' || control.key === 'chat.showSenderName') && $i?.policies.chatAvailability === 'unavailable');
}

function dataSaverValue(key: DataSaverKey): boolean { return models.dataSaver.value[key]; }

function writeDataSaver(key: DataSaverKey, value: boolean): void { models.dataSaver.value = { ...models.dataSaver.value, [key]: value }; }

function dataSaverDisabled(key: DataSaverKey): boolean { return key === 'disableUrlPreview' ? !instance.enableUrlPreview : key === 'urlPreviewThumbnail' ? !instance.enableUrlPreview || models.dataSaver.value.disableUrlPreview : false; }

function emojiLanguageName(language: typeof emojiIndexLangs[number]): string { return langs.find(item => item[0] === language)?.[1] ?? (language === 'ja-JP_hira' ? 'ひらがな' : language); }
</script>

<style lang="scss" scoped>
.root { display: grid; gap: 16px; min-width: 0; line-break: strict; word-break: normal; overflow-wrap: break-word; text-wrap: pretty; }
.sectionTitle { margin: 0 0 12px; font-size: 1rem; line-height: 1.5; }
.root[data-bento-category] { display: block; columns: 340px 2; column-gap: 16px; }
.root[data-category-flow='true'] { display: contents; }
.preferenceSection { display: grid; gap: 14px; min-width: 0; }
.root[data-bento-category] > .preferenceSection { box-sizing: border-box; break-inside: avoid; margin: 0 0 16px; border: 1px solid var(--MI_THEME-divider); border-radius: 18px; padding: 18px 20px; background: var(--MI_THEME-panel); }
.root[data-bento-category] .embeddedUiSettings { margin: 0; padding: 14px 0 0; border: 0; border-top: 1px solid var(--MI_THEME-divider); border-radius: 0; background: transparent; }
.root[data-bento-category] .toolbox { padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.heading, .toolbox { border: 1px solid color-mix(in srgb, var(--MI_THEME-divider) 76%, transparent); border-radius: 16px; background: var(--MI_THEME-panel); box-shadow: 0 1px 0 color-mix(in srgb, var(--MI_THEME-bg) 18%, transparent); }
.heading { padding: 20px; }.heading h2 { margin: 0; font-size: 1.35rem; line-height: 1.35; }.heading p { margin: 8px 0 0; color: var(--MI_THEME-fgTransparentWeak); }
.sHero { padding: clamp(20px, 6%, 32px); border-radius: 24px; background: var(--MI_THEME-panel); box-shadow: 0 2px 10px color-mix(in srgb, var(--MI_THEME-shadow) 5%, transparent); container-type: inline-size; }
.sHeroLayout { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 20px 24px; min-width: 0; }
.sHeroCopy { flex: 1 1 250px; min-width: 0; }
.sHero h2 { margin: 12px 0 0; color: var(--MI_THEME-accent); font-size: clamp(1.8rem, 8cqi, 2.25rem); line-height: 1.18; }
.sHero h2 .settingsBrand { white-space: normal; overflow-wrap: anywhere; }
.sHero p { max-width: 60ch; line-height: 1.6; }
.sHero .sImmediate { margin-top: 12px; color: var(--MI_THEME-accent); font-size: .8rem; font-weight: 700; }
.sBadge { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 12px; border-radius: 999px; background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); font-size: .72rem; font-weight: 800; }
.sReset { display: inline-flex; flex: 0 1 auto; align-items: center; justify-content: center; gap: 7px; max-width: 100%; min-height: 44px; padding: 9px 18px; border: 1px solid color-mix(in srgb, var(--MI_THEME-accent) 42%, var(--MI_THEME-divider)); border-radius: 999px; background: transparent; color: var(--MI_THEME-accent); font: inherit; font-weight: 700; cursor: pointer; }
.sReset:hover, .sReset:focus-visible { background: var(--MI_THEME-accentedBg); }
/* 旗鯖fork: 見出しの入れ替え。⚠️mode="out-in" なので、出ていく側と入る側は重ならない。 */
.settings-heading-enter-active, .settings-heading-leave-active { transition: opacity .22s ease, transform .26s cubic-bezier(.2, .9, .2, 1); }
.settings-heading-enter-from { opacity: 0; transform: translateX(14px); }
.settings-heading-leave-to { opacity: 0; transform: translateX(-14px); }
@media (prefers-reduced-motion: reduce) {
	.settings-heading-enter-active, .settings-heading-leave-active { transition: none; }
}
.eyebrow { margin: 0 0 6px !important; color: var(--MI_THEME-accent); font-size: .82rem; font-weight: 750; letter-spacing: .02em; }.controls, .auxiliary { display: grid; gap: 10px; }
.control {
	min-width: 0;
	border: 0;
	border-radius: 0;
	padding: 12px 4px;
	background: transparent;
	box-shadow: none;
	transition: border-color .16s ease, box-shadow .16s ease, background-color .16s ease;
}
.control + .control { border-block-start: 1px solid color-mix(in srgb, var(--MI_THEME-divider) 42%, transparent); }
.control:focus-within {
	border-color: transparent;
	border-radius: 12px;
	background: color-mix(in srgb, var(--MI_THEME-accent) 6%, transparent);
	box-shadow: none;
}
.control[data-disabled='true'] { opacity: .68; }
.toolbox { display: grid; gap: 12px; padding: 16px; }
.actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; }
.control :deep(button), .control :deep(input), .control :deep(textarea), .actions :deep(button) { min-height: 44px; }
.captionLine, .locked { display: block; }.captionLine + .captionLine { margin-top: 4px; }.brand { margin-inline-start: 8px; color: var(--MI_THEME-accent); font-size: .78em; font-weight: 700; letter-spacing: .02em; white-space: nowrap; }.locked { margin-top: 4px; opacity: .72; font-size: .85em; }.warningIcon { margin-inline-end: 5px; color: var(--MI_THEME-warn); }.fontSizePreview, .emojiPreview, .mfmPreview { margin: 0 0 10px; min-height: 1.5em; overflow-wrap: normal; }.fontSizePreview { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--MI_THEME-accent) 8%, var(--MI_THEME-panel)); line-height: 1.5; }.emojiPreview, .mfmPreview { font-size: 1.45em; }.reactionControl { display: grid; gap: 10px; }.controlLabel { display: flex; align-items: center; font-weight: 700; }.reactionValue { min-height: 3em; font-size: 1.1em; }
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
	.root[data-motion-enabled='true'] .control:hover {
		border-color: transparent;
		background: color-mix(in srgb, var(--MI_THEME-accent) 6%, transparent);
	}
}
@media (prefers-reduced-motion: no-preference) { .root[data-motion-enabled='true'] > :is(.heading, .controls, .auxiliary, .toolbox) { animation: surface-enter .2s cubic-bezier(.2, .8, .2, 1) both; }.root[data-motion-enabled='true'] > .toolbox { animation-duration: .16s; } }
@keyframes surface-enter { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .root *, .root *::before, .root *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
</style>
