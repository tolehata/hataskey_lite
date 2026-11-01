<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only

Existing Hataskey UI-adjacent settings which intentionally persist immediately.
They sit below the buffered UI2 editor only on the permanent settings surface;
the floating editor remains exactly the legacy buffered popup.
-->

<template>
	<section :class="$style.surface" :data-motion-enabled="motionEnabled ? 'true' : 'false'" aria-labelledby="hatasaba-ui2-immediate-title" data-settings-related-host="settings.group.hatasaba-ui2-immediate">
		<header :class="$style.intro">
			<p :class="$style.eyebrow"><span class="settingsBrand">Hataskey UI</span></p>
			<h2 id="hatasaba-ui2-immediate-title">{{ redesignCopy.immediate.title }}</h2>
			<p>{{ redesignCopy.immediate.description }}</p>
		</header>

		<section id="hatasaba-ui2-foldable" :class="$style.group" tabindex="-1" data-settings-search-key="hatasaba-ui2-immediate-foldable" data-settings-search-group-id="settings.group.hatasaba-ui2-immediate-foldable" data-settings-related-host="settings.group.hatasaba-ui2-immediate-foldable" aria-labelledby="hatasaba-ui2-foldable-title">
			<div :class="$style.groupHeader"><h3 id="hatasaba-ui2-foldable-title">{{ copy.foldableSection }}</h3><span :class="$style.status"><i class="ti ti-device-mobile" aria-hidden="true"></i>{{ redesignCopy.immediate.deviceImmediate }}</span></div>
			<p :class="$style.description">{{ copy.foldableDescription }}</p>
			<MkRadios v-model="foldableLayout" data-settings-search-key="hatasaba-ui2-foldable-layout">
				<template #label><span :class="$style.srOnly">{{ copy.foldableSection }}</span></template>
				<option value="auto">{{ copy.foldableModeAuto }}</option>
				<option value="on">{{ copy.foldableModeOn }}</option>
				<option value="off">{{ copy.foldableModeOff }}</option>
			</MkRadios>
			<p :class="$style.caption">{{ copy.foldableAutoCaption }}<br>{{ copy.foldableDeviceOnly }}</p>
		</section>

		<section id="hatasaba-ui2-branding" :class="$style.group" tabindex="-1" data-settings-search-key="hatasaba-ui2-immediate-branding" data-settings-search-group-id="settings.group.hatasaba-ui2-immediate-branding" data-settings-related-host="settings.group.hatasaba-ui2-immediate-branding" aria-labelledby="hatasaba-ui2-branding-title">
			<div :class="$style.groupHeader"><h3 id="hatasaba-ui2-branding-title">{{ copy.brandingSection }}</h3><span :class="$style.status"><i class="ti ti-cloud" aria-hidden="true"></i>{{ redesignCopy.immediate.profileImmediate }}</span></div>
			<MkSwitch v-model="useHatakyuIllustrations" data-settings-search-key="hatasaba-ui2-branding-hatakyu"><template #label>{{ copy.useHatakyu }}</template><template #caption>{{ copy.useHatakyuDescription }}</template></MkSwitch>
		</section>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MkRadios from '@/components/MkRadios.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { foldableLayoutMode, setFoldableLayoutMode } from '@/utility/hatasaba-device-prefs.js';
import type { HataFoldableMode } from '@/utility/hatasaba-device-prefs.js';

withDefaults(defineProps<{ motionEnabled?: boolean }>(), { motionEnabled: true });
const copy = i18n.ts._hata._customSettings._ui;
const redesignCopy = i18n.ts._hata._settingsRedesign;
// Profile-synchronised setting: intentionally immediate and separate from the UI2 draft.
const useHatakyuIllustrations = prefer.model('hataBranding.useHatakyu');
// Device-only setting: preserve the old source's exact setter and storage contract.
const foldableLayout = computed({
	get: () => foldableLayoutMode.value,
	set: (value: HataFoldableMode) => setFoldableLayoutMode(value),
});
</script>

<style lang="scss" module>
.surface { display: grid; gap: 12px; margin-top: 16px; color: var(--MI_THEME-fg); }
.intro, .group { border: 1px solid color-mix(in srgb, var(--MI_THEME-divider) 72%, transparent); border-radius: 22px; background: var(--MI_THEME-panel); box-shadow: 0 2px 10px color-mix(in srgb, var(--MI_THEME-shadow) 5%, transparent); }
.intro { padding: 18px 20px; }
.eyebrow { margin: 0 0 4px; color: var(--MI_THEME-accent); font-size: .7rem; font-weight: 800; letter-spacing: .08em; }
/* 旗鯖fork: ⚠️素の要素セレクタはアプリ全体へ漏れる。必ず親クラスの下へ。 */
.surface h2, .surface h3 { margin: 0; line-height: 1.3; } .surface h2 { font-size: 1rem; } .surface h3 { font-size: .94rem; }
.intro > p:last-child, .description, .caption { margin: 8px 0 0; color: var(--MI_THEME-fgTransparentWeak); font-size: .84rem; line-height: 1.65; text-wrap: pretty; }
.group { padding: 18px 20px; scroll-margin-block: 96px; }
/* 旗鯖fork: ⚠️outline-offset を正にしないこと。
   この節は器の幅いっぱいなので、外側に描くと左右がはみ出して切られる。 */
.group:focus { outline: 3px solid color-mix(in srgb, var(--MI_THEME-accent) 54%, transparent); outline-offset: -3px; border-radius: 16px; }
.groupHeader { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.status { display: inline-flex; min-block-size: 24px; flex: none; align-items: center; gap: 5px; border-radius: 999px; padding: 3px 9px; background: var(--MI_THEME-accentedBg); color: var(--MI_THEME-accent); font-size: .68rem; font-weight: 800; line-height: 1.3; }
.group :deep(.novjtcto > .body) { gap: 8px; }
.group :deep(.novjtcto > .body > *) { min-block-size: 44px; }
.caption { font-size: .78rem; }
.srOnly { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
.surface[data-motion-enabled='false'] :deep(*) { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
@container (max-width: 520px) { .intro, .group { border-radius: 22px; padding: 16px; } .groupHeader { align-items: flex-start; flex-direction: column; } .status { min-block-size: 24px; } }
@media (prefers-reduced-motion: reduce) { .surface :deep(*) { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
</style>
