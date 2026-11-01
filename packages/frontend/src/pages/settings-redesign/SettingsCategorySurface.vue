<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<section :class="$style.surface" :data-settings-bento-category="categoryId" :data-motion-enabled="motionEnabled ? 'true' : 'false'">
	<section v-if="leadingDestinations.length" :class="$style.ownerCard" data-settings-leading-destinations data-settings-section-anchor="ui-shortcuts" data-settings-section-label="Hataskey UI / S" data-settings-section-icon="ti ti-layout" tabindex="-1">
		<h3 :class="$style.cardTitle">Hataskey UI / S</h3>
		<div :class="$style.links">
			<button v-for="destination in leadingDestinations" :key="destination.id" type="button" :class="$style.link" :data-settings-destination-id="destination.id" @click="emit('openDestination', destination.id, $event)">
				<i :class="destination.icon" aria-hidden="true"></i>
				<span :class="$style.linkLabel" :data-brand="destination.brand"><strong>{{ destination.label }}</strong><small :class="$style.linkDescription">{{ destination.description ?? i18n.ts._hata._settingsRedesign.mobile.featureDescription }}</small></span>
				<i class="ti ti-chevron-right" aria-hidden="true"></i>
			</button>
		</div>
	</section>
	<SettingsPreferencesSurface v-if="hasPreferences" :categoryId="categoryId" categoryFlow/>
	<div v-if="owners.length" :class="$style.ownerGrid">
		<section v-for="owner in owners" :key="owner.id" :class="$style.ownerCard" :data-settings-owner="owner.id" :data-settings-section-anchor="`owner:${owner.id}`" :data-settings-section-label="owner.label" :data-settings-section-icon="owner.id === 'palette' ? 'ti ti-palette' : bentoSectionIcon(owner.sectionId)" tabindex="-1">
			<h3 :class="$style.cardTitle">{{ owner.label }}</h3>
			<SettingsSectionExplainer :sectionId="owner.sectionId" :motionEnabled="motionEnabled"/>
			<Suspense>
				<component :is="owner.component" v-bind="owner.presentationProps"/>
				<template #fallback><MkLoading/></template>
			</Suspense>
		</section>
	</div>
	<section v-if="hasHataCustom" :class="$style.ownerCard" data-settings-owner="hata-custom" data-settings-section-anchor="owner:hata-custom" :data-settings-section-label="i18n.ts._hata._customSettings.title" data-settings-section-icon="ti ti-flag" tabindex="-1">
		<SettingsSectionExplainer v-if="hataCustomSection != null" :sectionId="hataCustomSection" :motionEnabled="motionEnabled"/>
		<Suspense><HataCustomSettings :presentationCategory="categoryId"/><template #fallback><MkLoading/></template></Suspense>
	</section>
	<section v-if="hasCherryPick" :class="$style.ownerCard" data-settings-owner="cherrypick" data-settings-section-anchor="owner:cherrypick" data-settings-section-label="CherryPick" data-settings-section-icon="ti ti-cherry" tabindex="-1">
		<SettingsSectionExplainer v-if="cherryPickSection != null" :sectionId="cherryPickSection" :motionEnabled="motionEnabled"/>
		<Suspense><CherryPickSettings :presentationCategory="categoryId"/><template #fallback><MkLoading/></template></Suspense>
	</section>
	<div v-if="destinationSections.length" :class="$style.ownerGrid">
		<section v-for="section in destinationSections" :key="section.sectionId" :class="$style.ownerCard" :data-settings-link-section="section.sectionId" :data-settings-section-anchor="`links:${section.sectionId}`" :data-settings-section-label="section.explain ? section.label : section.destinations.map(destination => destination.label).join('・')" :data-settings-section-icon="section.navigationIcon" tabindex="-1" :data-full-width="destinationSections.length === 1 ? 'true' : undefined">
			<h3 :class="$style.cardTitle">{{ section.label }}</h3>
			<SettingsSectionExplainer v-if="section.explain" :sectionId="section.sectionId" :motionEnabled="motionEnabled"/>
			<div :class="$style.links">
				<MkA v-if="section.sectionId === 'apps.section0'" :class="$style.link" to="/hatagoes?view=settings" data-settings-destination-id="hatagoes-settings">
					<HataAppNavIcon app="hatagoes" :size="24" :monochrome="store.r.darkMode.value"/>
					<span :class="$style.linkLabel" data-brand="HataGoes"><HataAppWordmark app="hatagoes" :onDark="store.r.darkMode.value"/></span>
					<i class="ti ti-chevron-right" aria-hidden="true"></i>
				</MkA>
				<button v-for="destination in section.destinations" :key="destination.id" type="button" :class="$style.link" :data-settings-destination-id="destination.id" @click="emit('openDestination', destination.id, $event)">
					<HataAppNavIcon v-if="destination.app != null" :app="destination.app" :size="24" :monochrome="store.r.darkMode.value"/>
					<img v-else-if="destination.iconImage" :class="$style.linkImage" :src="destination.iconImage" alt="" aria-hidden="true">
					<i v-else :class="destination.icon" aria-hidden="true"></i>
					<span :class="$style.linkLabel" :data-brand="destination.brand"><HataAppWordmark v-if="destination.app != null && destination.label === destination.brand" :app="destination.app" :onDark="store.r.darkMode.value"/><template v-else>{{ destination.label }}</template></span>
					<i class="ti ti-chevron-right" aria-hidden="true"></i>
				</button>
			</div>
		</section>
	</div>
	<section v-if="categoryId === 'advanced' && cacheAction != null" :class="$style.ownerCard" data-settings-action-section="advanced.section3" data-settings-section-anchor="action:cache" :data-settings-section-label="bentoSectionLabel('advanced.section3')" :data-settings-section-icon="bentoSectionIcon('advanced.section3')" tabindex="-1">
		<h3 :class="$style.cardTitle">{{ bentoSectionLabel('advanced.section3') }}</h3>
		<SettingsSectionExplainer sectionId="advanced.section3" :motionEnabled="motionEnabled"/>
		<MkButton :data-settings-search-id="cacheAction.searchId" data-settings-search-destructive="true" @click="emit('runShellAction', cacheAction.id)"><i :class="cacheAction.icon" aria-hidden="true"></i>{{ cacheAction.label }}</MkButton>
	</section>
	<slot name="actions"/>
</section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, markRaw } from 'vue';
import { bentoDestinationLinkSections, bentoLeadingDestinationIds, bentoPreferenceCategory, bentoSectionIcon, bentoSectionLabel } from './settings-bento-catalog.js';
import { settingsInventoryKeys } from './settings-preferences-catalog.js';
import { settingsDestinations, destinationForId } from './settings-destinations.js';
import SettingsPreferencesSurface from './SettingsPreferencesSurface.vue';
import SettingsSectionExplainer from './SettingsSectionExplainer.vue';
import type { Component } from 'vue';
import type { SettingsBentoCategoryId, SettingsBentoSectionId } from './settings-bento-catalog.js';
import type { SettingsShellActionId } from './settings-shell-actions.js';
import HataAppNavIcon from '@/components/HataAppNavIcon.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import { hataAppForSettingsBrand } from '@/utility/hata-app-brand.js';
import { store } from '@/store.js';
import MkButton from '@/components/MkButton.vue';
import MkA from '@/components/global/MkA.vue';
import { provideMetadataReceiver } from '@/page.js';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	categoryId: SettingsBentoCategoryId;
	motionEnabled?: boolean;
	cacheAction?: { id: SettingsShellActionId; searchId: string; label: string; icon: string };
}>(), { motionEnabled: true, cacheAction: undefined });
const emit = defineEmits<{ openDestination: [id: string, event: MouseEvent]; runShellAction: [id: SettingsShellActionId] }>();
// Embedded owners describe their original page; the category owns the outer title.
provideMetadataReceiver(() => {});
const HataCustomSettings = defineAsyncComponent(() => import('@/pages/settings/hata-custom.vue'));
const CherryPickSettings = defineAsyncComponent(() => import('@/pages/settings/cherrypick.vue'));

// Each source page remains its single save/validation owner. Editors are never
// cloned by section and their existing save buttons, permissions and dialogs stay intact.
const ownerComponents = {
	profile: markRaw(defineAsyncComponent(() => import('@/pages/settings/profile.vue'))),
	privacy: markRaw(defineAsyncComponent(() => import('@/pages/settings/privacy.vue'))),
	email: markRaw(defineAsyncComponent(() => import('@/pages/settings/email.vue'))),
	security: markRaw(defineAsyncComponent(() => import('@/pages/settings/security.vue'))),
	theme: markRaw(defineAsyncComponent(() => import('@/pages/settings/theme.vue'))),
	palette: markRaw(defineAsyncComponent(() => import('@/pages/settings/emoji-palette.vue'))),
	notifications: markRaw(defineAsyncComponent(() => import('@/pages/settings/notifications.vue'))),
	sounds: markRaw(defineAsyncComponent(() => import('@/pages/settings/sounds.vue'))),
	mute: markRaw(defineAsyncComponent(() => import('@/pages/settings/mute-block.vue'))),
	drive: markRaw(defineAsyncComponent(() => import('@/pages/settings/drive.vue'))),
	profiles: markRaw(defineAsyncComponent(() => import('@/pages/settings/profiles.vue'))),
	export: markRaw(defineAsyncComponent(() => import('@/pages/settings/account-data.vue'))),
};
type OwnerId = keyof typeof ownerComponents;
const ownerDestinations: Record<OwnerId, string> = {
	profile: 'account-profile', privacy: 'account-privacy', email: 'account-email', security: 'account-security',
	theme: 'display-theme', palette: 'display-emoji', notifications: 'notifications-page', sounds: 'notifications-sounds',
	mute: 'account-mute', drive: 'account-drive', profiles: 'account-profiles', export: 'account-export',
};
const ownerCategories: Partial<Record<SettingsBentoCategoryId, readonly OwnerId[]>> = {
	profile: ['profile'], privacy: ['privacy'], security: ['email', 'security'], appearance: ['theme'],
	post: ['palette'], notify: ['notifications', 'sounds'], mute: ['mute'], drive: ['drive'], data: ['profiles', 'export'],
};
const ownerSections: Record<OwnerId, SettingsBentoSectionId> = {
	profile: 'profile.section0', privacy: 'privacy.section0', email: 'security.section0', security: 'security.section1',
	theme: 'appearance.section0', palette: 'post.section4', notifications: 'notify.section0', sounds: 'notify.section3',
	mute: 'mute.section0', drive: 'drive.section0', profiles: 'data.section0', export: 'data.section2',
};
const ownersWithInlineExplanations: readonly OwnerId[] = ['profile', 'privacy', 'security', 'palette', 'notifications', 'mute', 'drive'];
const owners = computed(() => (ownerCategories[props.categoryId] ?? []).map(id => ({
	id, sectionId: ownerSections[id], component: ownerComponents[id] as Component,
	label: settingsDestinations.find(destination => destination.id === ownerDestinations[id])?.label ?? '',
	presentationProps: ownersWithInlineExplanations.includes(id) ? { presentationCategory: props.categoryId, motionEnabled: props.motionEnabled } : {},
})));
const hasPreferences = computed(() => settingsInventoryKeys.some(key => bentoPreferenceCategory(key) === props.categoryId));
const hataCustomSections: Partial<Record<SettingsBentoCategoryId, SettingsBentoSectionId>> = { data: 'data.section1', appearance: 'appearance.section2', timeline: 'timeline.section0', post: 'post.section2', notify: 'notify.section1' };
const cherryPickSections: Partial<Record<SettingsBentoCategoryId, SettingsBentoSectionId>> = { advanced: 'advanced.section0', appearance: 'appearance.section3', timeline: 'timeline.section4', post: 'post.section0', notify: 'notify.section1' };
const hataCustomSection = computed(() => hataCustomSections[props.categoryId]);
const cherryPickSection = computed(() => cherryPickSections[props.categoryId]);
const hasHataCustom = computed(() => ['data', 'appearance', 'timeline', 'post', 'notify'].includes(props.categoryId));
const hasCherryPick = computed(() => ['advanced', 'appearance', 'timeline', 'post', 'notify'].includes(props.categoryId));
// These detail links share a topic with an inline form, but are separate capsule destinations.
const linkSectionIcons: Partial<Record<SettingsBentoSectionId, string>> = {
	'appearance.section1': 'ti ti-letter-case',
	'appearance.section2': 'ti ti-settings',
	'timeline.section0': 'ti ti-list',
	'timeline.section4': 'ti ti-mood-off',
	'drive.section0': 'ti ti-brush',
	'data.section1': 'ti ti-package',
};
const categoryDestinationSections = computed(() => bentoDestinationLinkSections.filter(section => section.sectionId.startsWith(`${props.categoryId}.`)).map(section => ({
	...section, label: bentoSectionLabel(section.sectionId), navigationIcon: linkSectionIcons[section.sectionId] ?? bentoSectionIcon(section.sectionId),
	destinations: section.destinationIds.map(id => {
		const destination = destinationForId(id);
		if (destination == null) throw new Error(`[settings-bento] unknown destination: ${id}`);
		return { ...destination, app: hataAppForSettingsBrand(destination.brand) };
	}),
})));
const leadingDestinations = computed(() => categoryDestinationSections.value.flatMap(section => section.destinations).filter(destination => bentoLeadingDestinationIds.includes(destination.id)));
const destinationSections = computed(() => categoryDestinationSections.value.map(section => ({
	...section, destinations: section.destinations.filter(destination => !bentoLeadingDestinationIds.includes(destination.id)),
})).filter(section => section.destinations.length > 0));

</script>

<style lang="scss" module>
.surface { min-width: 0; columns: 340px 2; column-gap: 16px; container-type: inline-size; }
/* Keep the form owners intact while allowing their cards to share the category flow. */
.ownerGrid { display: contents; }
.ownerCard { box-sizing: border-box; break-inside: avoid; min-width: 0; margin: 0 0 16px; padding: 18px 20px; border: 1px solid var(--MI_THEME-divider); border-radius: 20px; background: var(--MI_THEME-panel); overflow-wrap: break-word; }
/* Full editors keep their own responsive layout, without an unused parallel column. */
.ownerCard[data-settings-owner], .ownerCard[data-settings-leading-destinations], .ownerCard[data-settings-action-section], .ownerCard[data-full-width='true'] { column-span: all; }
.cardTitle { margin: 0 0 14px; font-size: 1.06em; line-height: 1.5; }
.links { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)); gap: 12px; }
.link { box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; min-height: 64px; padding: 16px 18px; border: 1px solid var(--MI_THEME-divider); border-radius: 16px; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); font: inherit; text-align: start; cursor: pointer; }
.linkLabel { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.linkDescription { display: block; margin-top: 4px; color: var(--MI_THEME-fgMuted); font-size: .85em; font-weight: normal; }
.linkImage { width: 24px; height: 24px; object-fit: contain; }
.link > i:first-child { color: var(--MI_THEME-accent); font-size: 1.3em; }
.link:focus-visible { outline: 2px solid var(--MI_THEME-accent); outline-offset: 3px; }
@media (hover: hover) { .link:hover { background: var(--MI_THEME-panelHighlight); } }
@container (max-width: 600px) { .ownerCard { padding: 18px 14px; border-radius: 18px; }.links { gap: 14px; } }
</style>
