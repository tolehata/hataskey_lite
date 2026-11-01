<!--
SPDX-FileCopyrightText: Tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker path="/settings/hata-custom" :label="i18n.ts._hata._customSettings.title" :keywords="['hata', 'custom', 'simple', 'widget', 'timeline', 'font']" icon="ti ti-flag" data-settings-search-group-id="settings.group.src-pages-settings-hata-custom-vue-28qg9w">
	<div class="_gaps_m">
		<!-- 旗鯖fork: 再設計の設定画面に埋め込まれているときは出さない。
             ⚠️左ペインが同じ案内を持つため、二重の見出しになってしまう。 -->
		<MkFeatureBanner v-if="!embeddedInSettingsShell" v-show="presentationCategory == null" :icon="brandedIconUrl('treasureFound', '/client-assets/package_3d.png')" color="#e74040">
			{{ copy.banner }}
		</MkFeatureBanner>

		<!-- 旗鯖fork: 同上。再設計では左ペインがカテゴリの正本。 -->
		<!-- 旗鯖fork: 再設計では左ペインがカテゴリの正本なので、見た目としては出さない。
		     ⚠️ただしDOMからは消さないこと。再設計シェルはこのボタンを探して .click() する
		     ことでカテゴリを切り替えている（index.vue の activateHataCustomCategory）。
		     消すと「フォント」を押しても既定の「Hataskey全体」から動かなくなる。 -->
		<div v-show="presentationCategory == null" :class="[$style.catTabs, embeddedInSettingsShell && $style.catTabsOffscreen]">
			<button v-for="cat in categories" :key="cat.id" :class="[$style.catTab, activeCat === cat.id && $style.catTabOn]" :tabindex="embeddedInSettingsShell ? -1 : undefined" @click="activeCat = cat.id">
				<!-- Hataskey fork: 地震ビューアだけは既存の Tabler アイコンを維持する(ゲーム/地震機能へハタキュを持ち込まない方針のため明示除外)。
                     それ以外は hatakyuAsset があればハタキュイラストを優先して出す。 -->
				<HataAppNavIcon v-if="hataAppForMenuIcon(cat.id, cat.icon)" :app="hataAppForMenuIcon(cat.id, cat.icon)!" :size="24" :monochrome="store.r.darkMode.value"/><i v-else-if="cat.id === 'earthquake' || !cat.hatakyuAsset || !useHatakyuBranding()" :class="cat.icon"></i>
				<MkHatakyuIllustration v-else :asset="cat.hatakyuAsset" :size="24"/>
				{{ cat.label }}
			</button>
		</div>

		<!-- ===== Hataskey全体 ===== -->
		<template v-if="activeCat === 'general'">
			<FormSection v-show="showsCategory('data')" first data-settings-section-anchor="owner:hata-custom:transfer" :data-settings-section-label="generalCopy.transferTitle" data-settings-section-icon="ti ti-arrows-exchange" tabindex="-1">
				<template #label>{{ generalCopy.transferTitle }}</template>
				<div style="font-size:.85em;opacity:.72;margin-bottom:10px;line-height:1.6;">{{ generalCopy.transferDescription }}</div>
				<button class="_buttonPrimary" style="width:100%;padding:12px;font-weight:bold;" @click="openSettingsTransfer">
					<i class="ti ti-arrows-exchange"></i> {{ generalCopy.openTransfer }}
				</button>
			</FormSection>
			<FormSection v-show="showsCategory('data')" data-settings-section-anchor="owner:hata-custom:external-account" :data-settings-section-label="generalCopy.externalAccount" data-settings-section-icon="ti ti-link" tabindex="-1">
				<template #label>{{ generalCopy.externalAccount }}</template>
				<FormLink to="/settings/external-account">
					<template #icon><i class="ti ti-link"></i></template>
					{{ generalCopy.externalAccountSettings }}
					<template #suffix><span v-if="isExternalLinked" :class="$style.linkedBadge"><i class="ti ti-check"></i> {{ generalCopy.linked }}</span></template>
				</FormLink>
			</FormSection>
			<FormSection v-show="showsCategory('appearance')" data-settings-section-anchor="owner:hata-custom:ui-change" :data-settings-section-label="generalCopy.uiChange" data-settings-section-icon="ti ti-wand" tabindex="-1">
				<template #label>{{ generalCopy.uiChange }}</template>
				<button class="_buttonPrimary" style="width:100%;padding:12px;font-weight:bold;" @click="openUiSetup">
					<i class="ti ti-wand"></i> {{ generalCopy.openUiSetup }}
				</button>
			</FormSection>
			<FormSection v-show="showsCategory('timeline')" data-settings-section-anchor="owner:hata-custom:reactions" :data-settings-section-label="generalCopy.reactions" data-settings-section-icon="ti ti-heart-off" tabindex="-1">
				<template #label>{{ generalCopy.reactions }}</template>
				<FormLink to="/settings/hidden-reactions">
					<template #icon><i class="ti ti-eye-off"></i></template>
					{{ generalCopy.hiddenReactionManagement }}
					<template #suffix><span v-if="hiddenReactionCount > 0" :class="$style.countBadge">{{ copyx.hiddenReactionCount({ count: hiddenReactionCount.toString() }) }}</span></template>
				</FormLink>
				<!-- 旗鯖fork(#31): ベータ機能から正式機能へ移動。⚠️端末ローカル設定なので同期されない旨を明記する。 -->
				<MkSwitch v-model="hideMutedReactions" style="margin-top:12px;">
					<template #label>{{ generalCopy.hideMutedReactions }}</template>
					<template #caption>{{ generalCopy.hideMutedReactionsCaptionBeforeIcon }} <i class="ti ti-info-circle"></i> {{ generalCopy.hideMutedReactionsCaptionAfterIcon }}<b>{{ generalCopy.adminReactionsVisible }}</b>{{ generalCopy.deviceOnlyPrefix }}<b>{{ generalCopy.thisDeviceOnly }}</b>{{ generalCopy.deviceOnlySuffix }}</template>
				</MkSwitch>
			</FormSection>
			<FormSection v-show="showsCategory('timeline')" data-settings-section-anchor="owner:hata-custom:timeline" :data-settings-section-label="generalCopy.timeline" data-settings-section-icon="ti ti-arrows-move" tabindex="-1">
				<template #label>{{ generalCopy.timeline }}</template>
				<div style="font-weight:bold;margin-bottom:8px;">{{ generalCopy.animationDirection }}</div>
				<MkRadios v-model="timelineAnimationDirection">
					<option value="top">{{ generalCopy.slideFromTop }}</option>
					<option value="left">{{ generalCopy.slideFromLeft }}</option>
					<option value="right">{{ generalCopy.slideFromRight }}</option>
					<option value="random">{{ generalCopy.random }}</option>
				</MkRadios>
			</FormSection>
			<FormSection v-show="showsCategory('post')" data-settings-section-anchor="owner:hata-custom:post-form" :data-settings-section-label="generalCopy.postForm" data-settings-section-icon="ti ti-forms" tabindex="-1">
				<template #label>{{ generalCopy.postForm }}</template>
				<MkSwitch v-model="showHashtagButtonInPostForm"><template #label>{{ generalCopy.showHashtagButton }}</template></MkSwitch>
				<MkSwitch v-model="showDrawingButtonInPostForm"><template #label>{{ generalCopy.showDrawingButton }}</template></MkSwitch>
			</FormSection>
			<FormSection v-show="showsCategory('notify')" data-settings-section-anchor="owner:hata-custom:login-days" :data-settings-section-label="generalCopy.loginDays" data-settings-section-icon="ti ti-calendar" tabindex="-1">
				<template #label>{{ generalCopy.loginDays }}</template>
				<MkSwitch v-model="showLoginBonusPopup"><template #label>{{ generalCopy.showLoginDaysPopup }}</template></MkSwitch>
			</FormSection>
			<!-- 旗鯖fork: bot ユーザーの投稿をタイムラインから非表示にする + 許可アカウント指定 -->
			<FormSection v-show="showsCategory('timeline')" data-settings-section-anchor="owner:hata-custom:bot-filter" :data-settings-section-label="generalCopy.hideBotPosts" data-settings-section-icon="ti ti-robot-off" tabindex="-1">
				<template #label>{{ generalCopy.hideBotPosts }}</template>
				<MkSwitch v-model="hideBotsInTimeline">
					<template #label>{{ generalCopy.hideBotPostsLabel }}</template>
					<template #caption>{{ generalCopy.hideBotPostsCaptionPrefix }}<b>{{ generalCopy.allowedBotException }}</b>{{ generalCopy.hideBotPostsCaptionSuffix }}</template>
				</MkSwitch>
				<template v-if="hideBotsInTimeline">
					<div :class="$style.botAllowlistHead" style="margin-top:12px;">
						<div style="font-size:.85em;opacity:.7;flex:1;">
							{{ generalCopy.allowedBotAccountsPrefix }} (<b>{{ botAllowlistUsers.length }}</b> {{ generalCopy.itemUnit }})
						</div>
						<button class="_buttonPrimary" :class="$style.botAllowlistAdd" @click="addBotAllowlistUser">
							<i class="ti ti-plus"></i> {{ generalCopy.add }}
						</button>
					</div>
					<div v-if="botAllowlistUsers.length === 0" :class="$style.botAllowlistEmpty">
						<i class="ti ti-user-off" style="margin-right:6px;"></i>{{ generalCopy.noAllowedBots }}
					</div>
					<div v-else :class="$style.botAllowlistList">
						<div v-for="user in botAllowlistUsers" :key="user.id" :class="$style.botAllowlistItem">
							<MkAvatar :class="$style.botAllowlistAvatar" :user="user" link preview/>
							<div :class="$style.botAllowlistName">
								<MkUserName :user="user"/>
								<div :class="$style.botAllowlistAcct">@{{ user.username }}<span v-if="user.host">@{{ user.host }}</span></div>
							</div>
							<button v-tooltip="generalCopy.removeFromList" :class="$style.botAllowlistRemove" @click="removeBotAllowlistUser(user.id)">
								<i class="ti ti-x"></i>
							</button>
						</div>
					</div>
				</template>
			</FormSection>
			<!-- 旗鯖fork: 旧アクセシビリティタブから移動 -->
			<FormSection v-show="presentationCategory == null">
				<template #label>{{ generalCopy.postFormBorder }}</template>
				<MkSwitch v-model="pfvbEnabled">
					<template #label>{{ generalCopy.colorByVisibility }}</template>
					<template #caption>{{ generalCopy.colorByVisibilityCaption }}</template>
				</MkSwitch>
				<template v-if="pfvbEnabled">
					<MkInput v-model="pfvbWidth" type="number" :min="1" :max="12" style="margin-top:10px;">
						<template #label>{{ generalCopy.borderWidth }}</template>
					</MkInput>
					<MkColorInput v-model="pfvbPublic"><template #label>{{ generalCopy.public }}</template></MkColorInput>
					<MkColorInput v-model="pfvbHome"><template #label>{{ generalCopy.home }}</template></MkColorInput>
					<MkColorInput v-model="pfvbFollowers"><template #label>{{ generalCopy.followers }}</template></MkColorInput>
					<MkColorInput v-model="pfvbSpecified"><template #label>{{ generalCopy.direct }}</template></MkColorInput>
				</template>
			</FormSection>
		</template>

		<!-- ===== フォント ===== -->
		<template v-if="activeCat === 'font'">
			<FormSection first>
				<template #label>{{ fontCopy.uiFontSelection }}</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;">
					{{ fontCopy.presetDescriptionLine1 }}
					{{ fontCopy.presetDescriptionLine2 }}
				</div>
				<div :class="$style.fontGrid">
					<button
						v-for="preset in fontPresets"
						:key="preset.id"
						:class="[$style.fontCard, fontId === preset.id && $style.fontCardOn]"
						@click="onFontChange(preset.id)"
					>
						<div :class="$style.fontSample" :style="{ fontFamily: preset.family + ', sans-serif' }">
							{{ fontCopy.samplePrimary }}
						</div>
						<div :class="$style.fontSampleSub" :style="{ fontFamily: preset.family + ', sans-serif' }">
							{{ fontCopy.sampleSecondary }}
						</div>
						<div :class="$style.fontName">{{ fontPresetLabel(preset) }}</div>
						<div :class="$style.fontMeta">
							<span :class="$style.fontLicense"><i class="ti ti-license"></i> {{ preset.license }}</span>
							<span :class="$style.fontAuthor">{{ preset.author }}</span>
						</div>
					</button>

					<!-- システムフォント -->
					<button
						:class="[$style.fontCard, fontId === 'system' && $style.fontCardOn]"
						@click="onFontChange('system')"
					>
						<div :class="$style.fontSample" :style="{ fontFamily: systemFontStack }">{{ fontCopy.samplePrimary }}</div>
						<div :class="$style.fontSampleSub" :style="{ fontFamily: systemFontStack }">{{ fontCopy.sampleSecondary }}</div>
						<div :class="$style.fontName">{{ fontCopy.systemFont }}</div>
						<div :class="$style.fontMeta">
							<span :class="$style.fontLicense">{{ fontCopy.useOsFont }}</span>
						</div>
					</button>
				</div>
			</FormSection>

			<FormSection>
				<template #label>{{ fontCopy.customFont }}</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;">
					{{ fontCopy.customFontDescription }}<br>
					{{ fontCopy.consentRequired }}
				</div>
				<div v-if="fontId === 'custom' && customFontName" :class="$style.customFontStatus">
					<i class="ti ti-typography"></i>
					{{ fontCopy.currentCustomFont }} <strong>{{ customFontName }}</strong>
				</div>
				<div style="display:flex;gap:8px;flex-wrap:wrap;">
					<button class="_buttonPrimary" :disabled="customFontUploading" style="padding:10px 20px;font-weight:bold;" @click="uploadCustomFont">
						<i :class="customFontUploading ? 'ti ti-loader-2 ti-spin' : 'ti ti-upload'"></i>
						{{ customFontUploading ? fontCopy.uploadingFont : fontCopy.uploadFont }}
						<span v-if="customFontUploadProgress != null"> {{ customFontUploadProgress }}%</span>
					</button>
					<button class="_button" :disabled="customFontUploading" style="padding:10px 20px;font-weight:bold;" @click="openDrivePicker">
						<i class="ti ti-cloud-search"></i> {{ fontCopy.selectFromDrive }}
					</button>
					<button class="_buttonGradate" :disabled="customFontUploading" style="padding:10px 20px;" @click="resetToDefault">
						<i class="ti ti-arrow-back"></i> {{ fontCopy.resetDefault }}
					</button>
				</div>
				<div v-if="customFontConsent" :class="$style.consentNote">
					<i class="ti ti-check"></i> {{ fontCopy.consentAccepted }}
				</div>
			</FormSection>
		</template>

		<!-- ===== Hataskey UI ===== -->
		<!-- 旗鯖fork: 旧「Hataskey UI」タブの全設定 (基本/上部・下部ナビバー/サイドメニュー/デッキチュートリアル)
             は Hataskey UI 2 の設定モーダル (MkHatasabaUi2EditWindow) へ統合した。タブ自体を廃止し、
             設定入口は Hataskey UI 2 タブに一本化する。preferences のキーは変更していないため既存設定は保持される。 -->

		<!-- ===== UI =====
             旗鯖fork: Hataskey UI 2 の端末設定をまとめたタブ。 -->
		<template v-if="activeCat === 'glassUi'">
			<FormSection first>
				<template #label>{{ uiCopy.hatasabaUi2Settings }}</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;line-height:1.6;">
					{{ uiCopy.hatasabaUi2DescriptionPrefix }}<b>{{ uiCopy.glassOpacity }}</b>{{ uiCopy.hatasabaUi2DescriptionSuffix }}<br>
					{{ uiCopy.windowPrefix }}<b>{{ uiCopy.livePreview }}</b>{{ uiCopy.windowMiddle }}<b>{{ uiCopy.notSavedUntilSave }}</b>{{ uiCopy.windowSuffix }}
				</div>
				<button class="_buttonPrimary" style="padding:10px 20px;font-weight:bold;" @click="openHatasabaUi2EditWindow">
					<i class="ti ti-sparkles"></i> {{ uiCopy.openHatasabaUi2Settings }}
				</button>
			</FormSection>
			<!-- 旗鯖fork: 横開き折りたたみ端末向けレイアウト。
             ⚠️端末ローカル設定(プロファイル非同期)。折りたたみ端末と通常のスマホで
               同じアカウントを使ったときに片方が壊れるため、同期させてはいけない。 -->
			<FormSection>
				<template #label>{{ uiCopy.foldableSection }}</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;line-height:1.6;">{{ uiCopy.foldableDescription }}</div>
				<MkRadios v-model="foldableLayout">
					<option value="auto">{{ uiCopy.foldableModeAuto }}</option>
					<option value="on">{{ uiCopy.foldableModeOn }}</option>
					<option value="off">{{ uiCopy.foldableModeOff }}</option>
				</MkRadios>
				<div style="font-size:.8em;opacity:.65;margin-top:10px;line-height:1.6;">
					{{ uiCopy.foldableAutoCaption }}<br>
					{{ uiCopy.foldableDeviceOnly }}
				</div>
			</FormSection>
			<!-- Hataskey fork: ハタキュ(オリジナルアイコンブランディング)を使うかどうか。
             ⚠️OFFにすると、変更前と同じ Tabler アイコン / 絵文字 / SVG に戻る。 -->
			<FormSection>
				<template #label>{{ uiCopy.brandingSection }}</template>
				<MkSwitch v-model="useHatakyuIllustrations">
					<template #label>{{ uiCopy.useHatakyu }}</template>
					<template #caption>{{ uiCopy.useHatakyuDescription }}</template>
				</MkSwitch>
			</FormSection>
		</template>

		<!-- ===== ビジュアル (新設) ===== -->
		<template v-if="activeCat === 'visual'">
			<FormSection first>
				<template #label>{{ visualCopy.noteSpacing }}</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;">{{ visualCopy.noteSpacingDescription }}</div>
				<div v-if="isDeckLike" style="font-size:.82em;color:var(--MI_THEME-warn);margin-bottom:10px;padding:8px 10px;border:1px solid var(--MI_THEME-divider);border-radius:8px;background:var(--MI_THEME-panel);">
					<i class="ti ti-info-circle" style="margin-right:4px;"></i>{{ visualCopy.deckSpacingFixed }}
				</div>
				<div :class="$style.spacingOptions">
					<button v-for="opt in spacingOptions" :key="opt.value" :class="[$style.spacingCard, noteSpacing === opt.value && $style.spacingCardOn, isDeckLike && $style.spacingCardDisabled]" :disabled="isDeckLike" @click="!isDeckLike && (noteSpacing = opt.value)">
						<div :class="$style.spacingPreview">
							<div :class="$style.spacingBubble" :style="{ margin: opt.previewMargin }"></div>
							<div :class="$style.spacingBubble" :style="{ margin: opt.previewMargin }"></div>
							<div :class="$style.spacingBubble" :style="{ margin: opt.previewMargin }"></div>
						</div>
						<div :class="$style.spacingLabel">{{ opt.label }}</div>
					</button>
				</div>
				<MkSwitch v-model="classicNoteSpacingDisplay" :disabled="isHatasabaUi || isMisskeyDefaultUi">
					<template #label>{{ visualCopy.useClassicSpacing }}</template>
					<template #caption>{{ visualCopy.useClassicSpacingCaption }}<br><span v-if="isHatasabaUi" style="color: var(--MI_THEME-warn);">{{ visualCopy.hatasabaSpacingLocked }}</span><span v-else-if="isMisskeyDefaultUi" style="color: var(--MI_THEME-warn);">{{ visualCopy.misskeySpacingLocked }}</span></template>
				</MkSwitch>
			</FormSection>
			<FormSection>
				<template #label>{{ visualCopy.mobileDate }}</template>
				<MkSwitch v-model="showTimelineDateOnMobile">
					<template #label>{{ visualCopy.showMobileDate }}</template>
					<template #caption>{{ visualCopy.showMobileDateCaption }}</template>
				</MkSwitch>
			</FormSection>
			<FormSection>
				<template #label>{{ visualCopy.displayEffects }}</template>
				<MkSwitch v-model="glassEffect">
					<template #label>{{ visualCopy.enableGlassEffect }}</template>
					<template #caption>{{ visualCopy.enableGlassEffectCaption }}</template>
				</MkSwitch>
				<MkSwitch v-model="deckNoBannerBg">
					<template #label>{{ visualCopy.disableDeckBannerBlur }}</template>
					<template #caption>{{ visualCopy.disableDeckBannerBlurCaption }}</template>
				</MkSwitch>
				<MkSwitch v-model="showPageHeader">
					<template #label>{{ visualCopy.showExtraPageHeader }}</template>
					<template #caption>{{ visualCopy.showExtraPageHeaderCaption }}</template>
				</MkSwitch>
			</FormSection>
			<FormSection>
				<template #label>{{ visualCopy.deckTimeline }}</template>
				<MkSwitch v-model="deckLatestNoteText">
					<template #label>{{ visualCopy.showLatestNoteText }}</template>
					<template #caption>{{ visualCopy.showLatestNoteTextOff }}<br>{{ visualCopy.showLatestNoteTextOn }}</template>
				</MkSwitch>
				<MkSwitch v-model="showLegacyChannelPostButton">
					<template #label>{{ visualCopy.showLegacyChannelPostButton }}</template>
					<template #caption>{{ visualCopy.legacyChannelPostOff }}<br>{{ visualCopy.legacyChannelPostOn }}</template>
				</MkSwitch>
			</FormSection>
			<FormSection>
				<template #label>{{ visualCopy.widgets }}</template>
				<MkSwitch v-model="widgetBorder">
					<template #label>{{ visualCopy.widgetBorder }}</template>
					<template #caption>{{ visualCopy.widgetBorderCaption }}</template>
				</MkSwitch>
			</FormSection>
		</template>

		<template v-if="activeCat === 'hatask'">
			<FormSection first>
				<template #label>{{ hataskCopy.settings }}</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;line-height:1.6;">{{ hataskCopy.settingsDescription }}</div>
				<button class="_buttonPrimary" style="padding:10px 20px;font-weight:bold;" @click="openHataskSettings"><i class="ti ti-settings"></i> {{ hataskCopy.openSettings }}</button>
			</FormSection>
			<FormSection>
				<template #label>{{ hataskCopy.open }}</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;">{{ hataskCopy.openDescription }}</div>
				<button class="_button" style="padding:10px 20px;" @click="goToHatask"><i class="ti ti-external-link"></i> {{ hataskCopy.open }}</button>
			</FormSection>
		</template>
		<!-- ===== Hatady ===== -->
		<template v-if="activeCat === 'hatady'">
			<FormSection first>
				<template #label>{{ hatadyCopy.settings }}</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;line-height:1.6;">{{ hatadyCopy.settingsDescription }}</div>
				<button class="_buttonPrimary" style="padding:10px 20px;font-weight:bold;" @click="openHatadySettings"><i class="ti ti-palette"></i> {{ hatadyCopy.openSettings }}</button>
			</FormSection>
			<FormSection>
				<template #label>{{ hatadyCopy.open }}</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;">{{ hatadyCopy.openDescription }}</div>
				<button class="_button" style="padding:10px 20px;" @click="goToHatady"><i class="ti ti-external-link"></i> {{ hatadyCopy.open }}</button>
			</FormSection>
		</template>
		<template v-if="activeCat === 'mascot'">
			<FormSection first>
				<template #label>{{ mascotCopy.title }}</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;line-height:1.6;">{{ mascotCopy.description }}</div>
				<button class="_buttonPrimary" style="padding:10px 20px;font-weight:bold;" @click="openMascotSettings"><i class="ti ti-mood-smile"></i> {{ mascotCopy.openSettings }}</button>
			</FormSection>
		</template>

		<!-- ===== 地震ビューア ===== -->
		<template v-if="activeCat === 'earthquake'">
			<FormSection first>
				<template #label>地震ビューアの設定</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;line-height:1.6;">地震・津波情報ビューアの設定です。お住いの都道府県（付近の地震表示用）と取得間隔を変更できます。<b>お住いの都道府県はこの端末にのみ保存され、サーバーには送信されません。</b></div>
				<button class="_buttonPrimary" style="padding:10px 20px;font-weight:bold;" @click="openEarthquakeSettings"><i class="ti ti-settings"></i> 地震ビューアの設定を開く</button>
			</FormSection>
			<FormSection>
				<template #label>地震ビューアを開く</template>
				<div style="font-size:.85em;opacity:.7;margin-bottom:12px;">地震・津波情報の画面を開きます。</div>
				<button class="_button" style="padding:10px 20px;" @click="goToEarthquake"><i class="ti ti-activity"></i> 地震・津波情報を開く</button>
			</FormSection>
		</template>

		<!-- ===== その他 (旧アクセシビリティ) ===== -->
		<!-- 旗鯖fork: タブ再編で、旧アクセシビリティタブの項目はほぼ全て ビジュアル / Hataskey UI 2 /
             Hataskey全体 タブに分散移動した。ここには「他タブに分類しづらい」ものだけを残す。
             現状は天気エフェクトのみ。preferences のキー自体は変更していないので、
             既存ユーザーの設定値は移動後もそのまま保持される (マイグレ不要)。 -->
		<template v-if="activeCat === 'accessibility'">
			<FormSection first>
				<template #label>{{ otherCopy.weatherEffects }}</template>
				<MkSwitch v-model="weatherEffectEnabled">
					<template #label>{{ otherCopy.enableWeatherEffects }}</template>
					<template #caption>{{ otherCopy.weatherEffectsCaption }}</template>
				</MkSwitch>
				<div v-if="weatherEffectEnabled" class="_gaps_s" style="margin-top:10px;">
					<div style="font-weight:bold;margin-bottom:8px;">{{ otherCopy.effectDuration }}</div>
					<MkRadios v-model="weatherEffectDuration">
						<option value="long">{{ otherCopy.durationLong }}</option>
						<option value="short">{{ otherCopy.durationShort }}</option>
					</MkRadios>
					<div style="font-size:.82em;color:var(--MI_THEME-warn);padding:8px 10px;border:1px solid var(--MI_THEME-divider);border-radius:8px;background:var(--MI_THEME-panel);">
						{{ otherCopy.weatherWordNote }}<br>
						{{ otherCopy.greetingNote }}<br>
						{{ otherCopy.safetyNote }}
					</div>
				</div>
			</FormSection>
		</template>
	</div>
</SearchMarker>
</template>

<script lang="ts" setup>
import { computed, inject, ref, watch } from 'vue';
import type { HatakyuAssetKey } from '@/utility/hatakyu-assets.js';
import type { HataFoldableMode } from '@/utility/hatasaba-device-prefs.js';
import type { HataFontId } from '@/scripts/hata-font-manager.js';
import type { SettingsBentoCategoryId } from '@/pages/settings-redesign/settings-bento-catalog.js';
import { settingsSearchV2ContextKey } from '@/utility/settings-search-v2-context.js';
import MkSwitch from '@/components/MkSwitch.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkInput from '@/components/MkInput.vue';
import MkColorInput from '@/components/MkColorInput.vue';
import FormSection from '@/components/form/section.vue';
import FormLink from '@/components/form/link.vue';
import MkFeatureBanner from '@/components/MkFeatureBanner.vue';
import { brandedIconUrl } from '@/utility/hatakyu-assets.js';
import MkHatakyuIllustration from '@/components/MkHatakyuIllustration.vue';
import { useHatakyuBranding } from '@/utility/hatakyu-assets.js';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { ensureSignin } from '@/i.js';
import { useRouter } from '@/router.js';
import { miLocalStorage } from '@/local-storage.js';
import { prefer } from '@/preferences.js';
// 旗鯖fork: getInitialPrefValue は simpleUi タブのナビ初期化ロジックで使っていたが、
//   Hataskey UI 2 設定モーダル (MkHatasabaUi2EditWindow) に移設したためこのファイルからは不要になった。
import { definePage } from '@/page.js';
import { getHiddenReactions, hiddenReactionsVersion } from '@/utility/hidden-reactions.js';
// 旗鯖fork: deckIgnoreWidth / setDeckIgnoreWidth は Hataskey UI 設定モーダル側で消費するのみ。
// 旗鯖fork: 端末ローカルのミュートリアクション非表示と折りたたみ端末レイアウトを使うため import。
import { hideMutedReactionsLocal, setHideMutedReactionsLocal, foldableLayoutMode, setFoldableLayoutMode } from '@/utility/hatasaba-device-prefs.js';
import { HATA_FONT_PRESETS, DEFAULT_HATA_FONT_ID, SYSTEM_HATA_FONT_STACK, applyHataFont, resolveHataFontId } from '@/scripts/hata-font-manager.js';
import { isDirectUploadCustomFontFile, isSupportedCustomFontFile } from '@/utility/hata-font-file.js';
import { chooseDriveFile, uploadFile } from '@/utility/drive.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import HataAppNavIcon from '@/components/HataAppNavIcon.vue';
import { hataAppForMenuIcon } from '@/utility/hata-app-brand.js';
import { store } from '@/store.js';
// 旗鯖fork: applySidebarIconOverride も同上 (サイドバー編集はモーダル側で完結)。
const router = useRouter();
ensureSignin();
/**
 * 旗鯖fork: 再設計の設定画面の中に描かれているか。
 * ⚠️再設計シェルだけが settingsSearchV2ContextKey を provide する。
 *   単独ページとして開かれたときは null になるので、従来どおり全部出す。
 */
const settingsSearchContext = inject(settingsSearchV2ContextKey, null);
const embeddedInSettingsShell = settingsSearchContext != null;
const props = defineProps<{ presentationCategory?: SettingsBentoCategoryId }>();

function showsCategory(...categories: SettingsBentoCategoryId[]): boolean {
	return props.presentationCategory == null || categories.includes(props.presentationCategory);
}

const copy = i18n.ts._hata._customSettings;
const copyx = i18n.tsx._hata._customSettings;
const generalCopy = copy._general;
const fontCopy = copy._font;
const uiCopy = copy._ui;
// Hataskey fork: ハタキュ表示のON/OFF(プロフィール同期)。
const useHatakyuIllustrations = prefer.model('hataBranding.useHatakyu');
const visualCopy = copy._visual;
const hataskCopy = copy._hatask;
const hatadyCopy = copy._hatady;
const mascotCopy = copy._mascot;
const otherCopy = copy._other;

// 旗鯖fork: タブ再編。
//   - Hataskey UI 2 タブ新設 (グラス系設定を集約)
//   - ビジュアルタブ新設 (見た目系を集約)
//   - accessibility タブは「その他」にリネームし、天気エフェクトなど余ったものだけ残す
//   - 見た目に関わらない設定 (postFormVisibilityBorder 等) は general に移動
// preferences のキー自体は変更しないため、既存ユーザーの設定は移動先タブでもそのまま保持される。
// Hataskey fork: 各カテゴリタブにハタキュイラストを割り当てる。
//   ⚠️地震ビューア(earthquake)は地震・津波情報機能に触れるため対象外(icon のみ・テンプレート側でも明示除外)。
const categories: { id: string; icon: string; label: string; hatakyuAsset?: HatakyuAssetKey }[] = [
	{ id: 'general', icon: 'ti ti-flag', label: copy.categoryGeneral, hatakyuAsset: 'wrench' },
	{ id: 'font', icon: 'ti ti-typography', label: copy.categoryFont, hatakyuAsset: 'readingBook' },
	{ id: 'glassUi', icon: 'ti ti-layout-dashboard', label: 'UI', hatakyuAsset: 'computerChat' },
	{ id: 'visual', icon: 'ti ti-palette', label: copy.categoryVisual, hatakyuAsset: 'stargazing' },
	{ id: 'hatask', icon: 'ti ti-checklist', label: 'Hatask', hatakyuAsset: 'checkingTime' },
	{ id: 'hatady', icon: 'ti ti-book-2', label: 'Hatady', hatakyuAsset: 'readingBook' },
	{ id: 'mascot', icon: 'ti ti-mood-smile', label: copy.categoryMascot, hatakyuAsset: 'dogPawUp' },
	{ id: 'earthquake', icon: 'ti ti-activity', label: '地震ビューア' },
	{ id: 'accessibility', icon: 'ti ti-dots', label: copy.categoryOther, hatakyuAsset: 'umbrellaRain' },
];
const activeCat = ref('general');

// The category surface keeps one owner mounted; presentation changes must not
// re-run this page's legacy settings migrations or mount several model owners.
watch(() => props.presentationCategory, category => {
	if (category != null) activeCat.value = 'general';
}, { immediate: true });

// フォントタブに切り替えたらプリロード開始
watch(activeCat, (v) => {
	if (v === 'font') preloadAllFonts();
});

// ===== フォント設定 =====
const savedFontId = prefer.model('hataFont.id');
const fontId = computed({
	get: () => resolveHataFontId(savedFontId.value),
	set: (id: HataFontId) => { savedFontId.value = id; },
});
const customFontUrl = prefer.model('hataFont.customUrl');
const customFontName = prefer.model('hataFont.customName');
const customFontConsent = prefer.model('hataFont.customFontConsent');
const customFontUploading = ref(false);
const customFontUploadProgress = ref<number | null>(null);

const fontPresets = HATA_FONT_PRESETS;
const systemFontStack = SYSTEM_HATA_FONT_STACK;
const fontsPreloaded = ref(false);

// プリセットの表示名を現在のロケールで解決する。
function fontPresetLabel(preset: (typeof HATA_FONT_PRESETS)[number]): string {
	const labels: Partial<Record<HataFontId, string>> = {
		'line-seed-jp': fontCopy.presetLineSeedJp,
		'zen-kaku-antique': fontCopy.presetZenKaku,
		'm-plus-1p': fontCopy.presetMPlus,
		'dotgothic16': fontCopy.presetDotGothic,
		'train-one': fontCopy.presetTrainOne,
		'ibm-plex-sans-jp': fontCopy.presetIbmPlex,
	};
	return labels[preset.id] ?? preset.label;
}

// フォントタブを開いた時にすべてのプリセットフォントをプリロード
function preloadAllFonts() {
	if (fontsPreloaded.value) return;
	for (const preset of HATA_FONT_PRESETS) {
		if (preset.googleFontsQuery) {
			const link = window.document.createElement('link');
			link.rel = 'stylesheet';
			link.href = `https://fonts.googleapis.com/css2?family=${preset.googleFontsQuery}&display=swap`;
			link.dataset.hataPreview = preset.id;
			window.document.head.appendChild(link);
		}
	}
	fontsPreloaded.value = true;
}

function onFontChange(id: HataFontId) {
	fontId.value = id;
	applyHataFont();
}

async function ensureCustomFontConsent(): Promise<boolean> {
	// 免責事項の同意確認
	if (!customFontConsent.value) {
		const { canceled } = await os.confirm({
			type: 'warning',
			title: fontCopy.disclaimerTitle,
			text: [
				fontCopy.disclaimerIntro,
				'',
				fontCopy.disclaimerLicense,
				fontCopy.disclaimerLiability,
				fontCopy.disclaimerQuality,
				'',
				fontCopy.disclaimerConfirm,
			].join('\n'),
		});
		if (canceled) return false;
		customFontConsent.value = true;
		prefer.commit('hataConsent.customFont', true);
		prefer.commit('hataConsent.customFontDate', new Date().toISOString());
		// サーバーに同意を記録
		misskeyApi('hata/consent/update', { type: 'customFont', agree: true }).catch(console.error);
	}
	return true;
}

function showUnsupportedCustomFont(text: string) {
	os.alert({
		type: 'error',
		title: fontCopy.unsupportedFontTitle,
		text,
	});
}

function applyCustomFontFile(file: { name: string; type: string; url: string }): boolean {
	if (!isSupportedCustomFontFile(file)) {
		showUnsupportedCustomFont(fontCopy.unsupportedDriveFontText);
		return false;
	}
	customFontUrl.value = file.url;
	customFontName.value = file.name.replace(/\.(ttf|otf|woff2)$/i, '');
	fontId.value = 'custom';
	applyHataFont();
	return true;
}

async function uploadCustomFont() {
	if (customFontUploading.value || !(await ensureCustomFontConsent())) return;
	const files = await os.chooseFileFromPc({
		multiple: false,
		accept: '.ttf,.otf,font/ttf,font/otf',
	});
	const file = files[0];
	if (file == null) return;
	if (!isDirectUploadCustomFontFile(file)) {
		showUnsupportedCustomFont(fontCopy.unsupportedUploadFontText);
		return;
	}

	customFontUploading.value = true;
	customFontUploadProgress.value = 0;
	try {
		const { filePromise } = uploadFile(file, {
			name: file.name,
			onProgress: ({ total, loaded }) => {
				customFontUploadProgress.value = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null;
			},
		});
		const driveFile = await filePromise;
		applyCustomFontFile(driveFile);
	} catch {
		// uploadFile側で、容量・許可形式・通信エラーに対応する案内を表示する。
	} finally {
		customFontUploading.value = false;
		customFontUploadProgress.value = null;
	}
}

async function openDrivePicker() {
	if (!(await ensureCustomFontConsent())) return;

	// ドライブファイルピッカーを開く
	const files = await chooseDriveFile({ multiple: false }).catch(() => []);
	if (files.length > 0) {
		applyCustomFontFile(files[0]);
	}
}

function resetToDefault() {
	fontId.value = DEFAULT_HATA_FONT_ID;
	customFontUrl.value = '';
	customFontName.value = '';
	applyHataFont();
}

// ===== Hataskey全体 =====
// 旗鯖fork: 投稿フォームのハッシュタグ/お絵かきボタン表示トグルは
// preferences/def.ts 側で prefer キーとして定義されており、MkPostForm も
// `prefer.s.showHashtagButtonInPostForm` / `prefer.s.showDrawingButtonInPostForm`
// を読む。設定 UI 側だけ miLocalStorage (useLSBool) に書き込む実装になっており、
// 書き先と読み先がズレていてトグルが機能していなかったので prefer.model に修正。
const showHashtagButtonInPostForm = prefer.model('showHashtagButtonInPostForm');
const showDrawingButtonInPostForm = prefer.model('showDrawingButtonInPostForm');
const showLoginBonusPopup = prefer.model('showLoginBonusPopup');
// 旗鯖fork(#31): ミュートユーザーのリアクション非表示（端末ローカル）。ベータ機能から正式機能へ移動。
const hideMutedReactions = computed({
	get: () => hideMutedReactionsLocal.value,
	set: (v: boolean) => setHideMutedReactionsLocal(v),
});
// ⚠️OFF→ON の瞬間にミュートリストを取り直す（取りこぼすと「効かない」と見える）。
watch(hideMutedReactions, async (newVal) => {
	if (!newVal) return;
	const { fetchMutedUsers, invalidateMutedUsers } = await import('@/utility/muted-users.js');
	const { invalidateMutedReactions } = await import('@/utility/muted-reactions.js');
	invalidateMutedReactions();
	invalidateMutedUsers();
	fetchMutedUsers();
});
const timelineAnimationDirection = prefer.model('timelineAnimationDirection');
const openUiSetup = async () => {
	if (props.presentationCategory != null && settingsSearchContext != null) {
		settingsSearchContext.navigateToSetting({ route: '/settings/hata-custom', activation: { kind: 'popup', category: 'general', popup: 'ui-setup' } });
		return;
	}
	const { defineAsyncComponent: dac } = await import('vue');
	const { dispose } = os.popup(dac(() => import('@/components/MkUISetup.vue')), {}, { closed: () => dispose() });
};
const openSettingsTransfer = async () => {
	if (props.presentationCategory != null && settingsSearchContext != null) {
		settingsSearchContext.navigateToSetting({ route: '/settings/hata-custom', activation: { kind: 'popup', category: 'general', popup: 'settings-transfer' } });
		return;
	}
	const { defineAsyncComponent: dac } = await import('vue');
	const { dispose } = os.popup(dac(() => import('@/components/MkHataSettingsTransfer.vue')), {}, { closed: () => dispose() });
};
// 旗鯖fork: Hataskの設定を共有コンポーネントで開く(本体とregistry同期)
const openHataskSettings = async () => {
	const { defineAsyncComponent: dac } = await import('vue');
	const { dispose } = os.popup(dac(() => import('@/pages/HataskSettings.vue')), {}, { closed: () => dispose() });
};
const goToHatask = () => { router.push('/hatask'); };

// 旗鯖fork(Hatady): 表示設定(テーマ・言語・同期・チュートリアル再実行)を共有ダイアログで開く。
const openHatadySettings = async () => {
	const { defineAsyncComponent: dac } = await import('vue');
	const { dispose } = os.popup(dac(() => import('@/components/HatadyDisplaySettings.vue')), {}, { closed: () => dispose() });
};
const goToHatady = () => { router.push('/hatady'); };

// 旗鯖fork(#34): 地震ビューア設定を共有ダイアログで開く
const openEarthquakeSettings = async () => {
	const { defineAsyncComponent: dac } = await import('vue');
	const { dispose } = os.popup(dac(() => import('@/components/MkEarthquakeSettings.vue')), {}, { closed: () => dispose() });
};
const goToEarthquake = () => { router.push('/earthquake'); };
// 旗鯖fork: マスコット設定を開く
const openMascotSettings = async () => {
	const { defineAsyncComponent: dac } = await import('vue');
	const { dispose } = os.popup(dac(() => import('@/pages/MkMascotSettings.vue')), {}, { closed: () => dispose() });
};
// 旗鯖fork: Hataskey UI 2 の設定を独立ウィンドウ (MkHatasabaUi2EditWindow) で開く。
//   有効化トグル・吹き出し・背景ぼかし・透過率スライダーを 1 ウィンドウに集約。
//   MkWindow ベースなので開いたまま裏の Hataskey UI をリアルタイム確認可能。
const openHatasabaUi2EditWindow = async () => {
	const { defineAsyncComponent: dac } = await import('vue');
	const { dispose } = os.popup(
		dac(() => import('@/components/MkHatasabaUi2EditWindow.vue')),
		{},
		{ closed: () => dispose() },
	);
};
const isExternalLinked = computed(() => prefer.s['external.enabled'] && prefer.s['external.token'] != null);
const hiddenReactionCount = computed(() => { hiddenReactionsVersion.value; return getHiddenReactions().length; });
// 旗鯖fork: simpleUi タブに直接あった topNav/bottomNav の ref / saveTopNav / saveBottomNav /
//   resetTopNav / resetBottomNav / showTrendingTab / topNavMode / deckIgnoreWidthModel /
//   openSidebarEditDialog / replayDeckTutorial は、Hataskey UI 2 設定モーダル
//   (MkHatasabaUi2EditWindow) に完全移設した。モーダル側でバッファ + 明示保存 + 初期化ボタンで
//   完結するため、このファイルからは削除済み。

const widgetBorder = prefer.model('simpleUi.widgetBorder');
const glassEffect = prefer.model('simpleUi.glassEffect');
const deckNoBannerBg = prefer.model('simpleUi.deckNoBannerBg');
// 旗鯖fork: bot ユーザーの投稿をタイムラインから非表示 + 許可アカウントリスト
const hideBotsInTimeline = prefer.model('simpleUi.hideBotsInTimeline');
const botAllowlist = prefer.model('simpleUi.botAllowlist');
// 表示用: allowlist の userId に対応する user object を並べる (キャッシュを持つ)
const botAllowlistUsers = ref<any[]>([]);

async function refreshBotAllowlistUsers() {
	const ids = (botAllowlist.value as string[]) ?? [];
	if (ids.length === 0) { botAllowlistUsers.value = []; return; }
	try {
		const users = await misskeyApi('users/show', { userIds: ids });
		const botUsersById = new Map(users.filter(user => user.isBot).map(user => [user.id, user]));
		const validBotIds = ids.filter(id => botUsersById.has(id));
		botAllowlistUsers.value = validBotIds.map(id => botUsersById.get(id)!);
		// 旧保存値に通常アカウントや削除済みアカウントがあれば、表示だけでなく保存値からも除く。
		if (validBotIds.length !== ids.length) botAllowlist.value = validBotIds;
	} catch {
		botAllowlistUsers.value = [];
	}
}

if (props.presentationCategory == null) {
	watch(botAllowlist, refreshBotAllowlistUsers, { immediate: true });
} else {
	// The shared owner is also mounted for unrelated categories. Resolve and
	// normalize the allowlist only when its timeline controls are shown.
	let lastRequestedIds: typeof botAllowlist.value | undefined;
	watch([botAllowlist, () => props.presentationCategory], ([ids, category]) => {
		if (category !== 'timeline' || ids === lastRequestedIds) return;
		lastRequestedIds = ids;
		void refreshBotAllowlistUsers();
	}, { immediate: true });
}

async function addBotAllowlistUser() {
	// 選択画面と保存直前の両方で、BOTアカウントだけに限定する。
	const result = await os.selectUser({ botOnly: true });
	if (!result?.isBot) {
		os.alert({ type: 'warning', text: generalCopy.botOnlyWarning });
		return;
	}
	const cur = ((botAllowlist.value as string[]) ?? []).slice();
	if (cur.includes(result.id)) {
		os.alert({ type: 'info', text: generalCopy.alreadyAllowed });
		return;
	}
	cur.push(result.id);
	botAllowlist.value = cur;
}

function removeBotAllowlistUser(id: string) {
	const cur = ((botAllowlist.value as string[]) ?? []).filter(x => x !== id);
	botAllowlist.value = cur;
}

// 旗鯖fork: Hataskey UI 追加ページヘッダー表示
const showPageHeader = prefer.model('simpleUi.showPageHeader');
const noteSpacing = prefer.model('simpleUi.noteSpacing');
// 旗鯖fork(#15): スマホ/狭幅で日付を従来位置(中央インライン)で表示するか。
const showTimelineDateOnMobile = prefer.model('simpleUi.showTimelineDateOnMobile');
// 旗鯖fork: 旧 disableBubbleInDeck / disableBubbleInDefault / disableBubbleInHatasabaNormal トグルは廃止。
//   Hataskey UIデッキの「ノートの簡易表示を無効にする」は Hataskey UI 2 の設定モーダルへ移動。
const classicNoteSpacing = prefer.model('simpleUi.classicNoteSpacing');
// 旗鯖fork: デッキタイムライン最上部インジケータをテキストに戻すオプトイン
const deckLatestNoteText = prefer.model('simpleUi.deckLatestNoteText');
// 旗鯖fork: 従来のチャンネル投稿ボタン (カラムヘッダ右のペン+ボタン + 三点メニュー項目) を表示するか
const showLegacyChannelPostButton = prefer.model('simpleUi.showLegacyChannelPostButton');
// 旗鯖fork: 横開き折りたたみ端末向けレイアウト(端末ローカル・auto/on/off)
const foldableLayout = computed({
	get: () => foldableLayoutMode.value,
	set: (v: HataFoldableMode) => setFoldableLayoutMode(v),
});

// 旗鯖fork: 天気エフェクト(weatherEffect)
const weatherEffectEnabled = prefer.model('weatherEffect.enabled');
// 旗鯖fork: 投稿範囲ごとの投稿フォーム枠色
const pfvbEnabled = prefer.model('postFormVisibilityBorder.enabled');
const pfvbWidth = prefer.model('postFormVisibilityBorder.width');
const pfvbPublic = prefer.model('postFormVisibilityBorder.color.public');
const pfvbHome = prefer.model('postFormVisibilityBorder.color.home');
const pfvbFollowers = prefer.model('postFormVisibilityBorder.color.followers');
const pfvbSpecified = prefer.model('postFormVisibilityBorder.color.specified');
const weatherEffectDuration = prefer.model('weatherEffect.duration');

// 旗鯖fork: 旧「Misskey UIで吹き出し表示を無効にする」トグルは廃止。
//   Misskey(デフォルト)UI は常にクラシック表示(吹き出しなし＋従来の投稿間隔)に固定したため、
//   disableBubbleInDefault と classicNoteSpacing を結合していた旧ロジックは不要。
//   classicNoteSpacing の保存値はそのまま(他モードのため)残し、強制は computed/描画側で行う。

// 旗鯖fork: デッキ表示時はノート間隔を 'compact' に強制ON+UI操作不能化する。
// - 従来デッキ UI (ui=deck) は localStorage で判定、ページ表示中の切替は無いためページマウント時に固定。
// - Hataskey UI デッキ (ui=simple かつ simpleUi.deckMode=ON) は deckMode の切替に追随する。
const currentUi = miLocalStorage.getItem('ui');
const isLegacyDeckUi = currentUi === 'deck';
// 旗鯖fork(#7): Hataskey UI(ui:simple, 通常表示・デッキ表示の両方)では従来Misskey風の投稿間隔を強制するため、
// 「従来のMisskey風の投稿間隔」トグルを操作不可にする。
const isHatasabaUi = currentUi === 'simple';
// 旗鯖fork: Misskey(デフォルト・従来のデッキUIではない)UI。ここでも従来Misskey風の投稿間隔を強制ONにする。
const isMisskeyDefaultUi = currentUi === 'default';
// 旗鯖fork(#7): Hataskey UI(通常表示・デッキ表示の両方) と Misskey(デフォルト)UI では従来Misskey風の
// 投稿間隔を常に適用するため、トグルは常にON表示＋操作不可にする(実際の適用状態と一致させる)。
const classicNoteSpacingDisplay = computed<boolean>({
	get: () => (isHatasabaUi || isMisskeyDefaultUi) ? true : classicNoteSpacing.value,
	set: (v: boolean) => { if (!isHatasabaUi && !isMisskeyDefaultUi) classicNoteSpacing.value = v; },
});
const hatasabaDeckMode = computed(() => prefer.r['simpleUi.deckMode']?.value ?? false);
const isDeckLike = computed(() => isLegacyDeckUi || (currentUi === 'simple' && hatasabaDeckMode.value));
// デッキ時に noteSpacing が変えられても 'compact' に戻す。元の値を保存し、解除時に復元。
const savedNoteSpacing = ref<'compact' | 'moderate' | 'wide' | null>(null);

function enforceDeckSpacing() {
	if (isDeckLike.value) {
		if (noteSpacing.value !== 'compact') {
			savedNoteSpacing.value = noteSpacing.value as 'compact' | 'moderate' | 'wide';
			noteSpacing.value = 'compact';
		}
	} else {
		// デッキ解除時に復元(保存値がある場合のみ)
		if (savedNoteSpacing.value !== null) {
			noteSpacing.value = savedNoteSpacing.value;
			savedNoteSpacing.value = null;
		}
	}
}

// The visual editor owns the legacy spacing migration. Reading a category's
// unrelated controls must not change the user's hidden visual preferences.
if (props.presentationCategory == null) {
	// 起動時と deckMode の切替時に適用
	enforceDeckSpacing();
	watch(isDeckLike, () => { enforceDeckSpacing(); });

	// 旗鯖fork(#15): ノート間隔「詰める(compact)」は廃止。通常表示(非デッキ)で compact のユーザーは moderate へ移行する。
	if (!isDeckLike.value && noteSpacing.value === 'compact') noteSpacing.value = 'moderate';
}

// 旗鯖fork(#15): 「詰める」は選択肢から除外(ほどよく / 広め の2択)。
const spacingOptions = [
	{ value: 'moderate', label: visualCopy.spacingModerate, previewMargin: '5px 0' },
	{ value: 'wide', label: visualCopy.spacingWide, previewMargin: '10px 0' },
] as const;

definePage({ title: copy.title, icon: 'ti ti-flag' });
</script>

<style lang="scss" module>
.linkedBadge { color: var(--MI_THEME-success); font-size: 0.9em; }

/* 旗鯖fork: bot 許可アカウントリスト */
.botAllowlistHead {
    display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.botAllowlistAdd {
    padding: 6px 14px; font-size: .85em; border-radius: 999px; white-space: nowrap;
    > i { margin-right: 4px; }
}
.botAllowlistEmpty {
    padding: 10px 12px; border: 1px dashed var(--MI_THEME-divider); border-radius: 10px;
    font-size: .85em; opacity: .7; text-align: center;
}
.botAllowlistList { display: flex; flex-direction: column; gap: 6px; }
.botAllowlistItem {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px;
    border: 1px solid var(--MI_THEME-divider); border-radius: 10px; background: var(--MI_THEME-panel);
}
.botAllowlistAvatar { flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; }
.botAllowlistName { flex: 1; min-width: 0; overflow: hidden; }
.botAllowlistAcct { font-size: .8em; opacity: .6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.botAllowlistRemove {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border: none; background: transparent; color: var(--MI_THEME-fg);
    border-radius: 999px; cursor: pointer; flex-shrink: 0; opacity: .55;
    transition: background .12s, opacity .12s;
    &:hover { opacity: 1; background: var(--MI_THEME-accentedBg); }
}
.countBadge { opacity: 0.7; font-size: 0.9em; }
/* 旗鯖fork: 再設計に埋め込まれたときの見せ方。
   ⚠️display:none にしない。シェルからの .click() を効かせるため、画面の外へ追い出すだけにする。 */
.catTabsOffscreen { position:absolute; width:1px; height:1px; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; pointer-events:none; }

.catTabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
.catTab {
    padding:8px 16px; border-radius:20px; border:1px solid var(--MI_THEME-divider);
    background:transparent; color:var(--MI_THEME-fg); font-family:inherit; font-size:.85rem;
    font-weight:500; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all .2s;
    &:hover { background:var(--MI_THEME-accentedBg); }
}
.catTabOn { background:var(--MI_THEME-accentedBg); color:var(--MI_THEME-accent); border-color:var(--MI_THEME-accent); font-weight:600; }
.reorderList { display:flex; flex-direction:column; gap:4px; }
.reorderHead { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.resetBtn {
	flex-shrink: 0;
	padding: 4px 12px;
	border-radius: 6px;
	border: 1px solid var(--MI_THEME-divider);
	background: var(--MI_THEME-panel);
	color: var(--MI_THEME-fg);
	font-size: .8rem;
	cursor: pointer;
	transition: background .15s, color .15s;
}
.resetBtn:hover { background: var(--MI_THEME-buttonHoverBg); }
.requiredLabel {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	opacity: .35;
	font-size: .9em;
	flex-shrink: 0;
}
.reorderGroupLabel { font-size:.78rem; font-weight:700; opacity:.6; margin:10px 4px 2px; }
.reorderItem { display:flex; align-items:center; gap:8px; padding:8px 12px; background:var(--MI_THEME-panel); border-radius:10px; border:1px solid var(--MI_THEME-divider); }
.reorderItemHidden { opacity: .45; }
.reorderIcon { font-size:1rem; opacity:.6; width:20px; text-align:center; }
.reorderLabel { flex:1; font-size:.88rem; font-weight:500; }
.reorderBtns { display:flex; gap:2px; }
.reorderBtn {
    width:28px; height:28px; border-radius:6px; border:1px solid var(--MI_THEME-divider);
    background:transparent; color:var(--MI_THEME-fg); font-size:.65rem; cursor:pointer;
    display:flex; align-items:center; justify-content:center; transition:all .15s; font-family:inherit;
    &:hover:not(:disabled) { background:var(--MI_THEME-accentedBg); }
    &:disabled { opacity:.2; cursor:default; }
}
/* 旗鯖fork(Hataskey UI 2): 透過率スライダー行 */
.opacityRow {
    display: flex; align-items: center; gap: 12px; padding: 4px 2px;
}
.opacityRange {
    flex: 1; min-width: 0; accent-color: var(--MI_THEME-accent);
    &:disabled { opacity: .4; cursor: not-allowed; }
}
.opacityValue {
    min-width: 3.2em; text-align: right; font-variant-numeric: tabular-nums;
    font-size: .95em; font-weight: 600; color: var(--MI_THEME-fg);
}
.opacityResetBtn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 999px;
    border: 1px solid var(--MI_THEME-divider); background: var(--MI_THEME-panel);
    color: var(--MI_THEME-fg); cursor: pointer; flex-shrink: 0;
    transition: background .15s, border-color .15s, opacity .15s;
    &:hover:not(:disabled) { background: var(--MI_THEME-accentedBg); border-color: var(--MI_THEME-accent); }
    &:disabled { opacity: .35; cursor: not-allowed; }
}

.spacingOptions { display:flex; gap:8px; flex-wrap:wrap; }
.spacingCard {
    flex:1; min-width:80px; padding:12px 8px 10px; border-radius:12px; border:2px solid var(--MI_THEME-divider);
    background:var(--MI_THEME-panel); cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:8px;
    transition:all .2s; font-family:inherit;
    &:hover { border-color:color-mix(in srgb, var(--MI_THEME-accent) 40%, var(--MI_THEME-divider)); }
}
.spacingCardOn { border-color:var(--MI_THEME-accent); background:var(--MI_THEME-accentedBg); }
/* 旗鯖fork: デッキ表示時の操作不能スタイル */
.spacingCardDisabled { opacity:.5; cursor:not-allowed; pointer-events:none; }
.spacingPreview {
    width:100%; display:flex; flex-direction:column; align-items:stretch;
    background:color-mix(in srgb, var(--MI_THEME-fg) 5%, transparent); border-radius:8px; padding:6px;
    min-height:60px; justify-content:center;
}
.spacingBubble {
    height:10px; border-radius:6px;
    background:color-mix(in srgb, var(--MI_THEME-fg) 15%, transparent);
}
.spacingLabel { font-size:.82rem; font-weight:600; color:var(--MI_THEME-fg); }

/* ===== フォント設定 ===== */
.fontGrid { display: flex; flex-direction: column; gap: 8px; }
.fontCard {
    display: flex; flex-direction: column; gap: 6px; padding: 14px 16px;
    border-radius: 12px; border: 2px solid var(--MI_THEME-divider);
    background: var(--MI_THEME-panel); cursor: pointer; text-align: left;
    transition: all .2s; font-family: inherit;
    &:hover { border-color: color-mix(in srgb, var(--MI_THEME-accent) 40%, var(--MI_THEME-divider)); }
}
.fontCardOn { border-color: var(--MI_THEME-accent); background: var(--MI_THEME-accentedBg); }
.fontSample { font-size: 1.4em; line-height: 1.5; margin-bottom: 2px; }
.fontSampleSub { font-size: 0.92em; line-height: 1.4; opacity: 0.6; margin-bottom: 6px; }
.fontName { font-size: .88rem; font-weight: 600; }
.fontMeta { display: flex; flex-direction: column; gap: 2px; }
.fontLicense { font-size: .72rem; opacity: .5; display: flex; align-items: center; gap: 4px; }
.fontAuthor { font-size: .72rem; opacity: .4; }
.customFontStatus {
    padding: 10px 14px; border-radius: 10px; margin-bottom: 8px;
    background: var(--MI_THEME-accentedBg); font-size: .88rem;
    display: flex; align-items: center; gap: 6px;
}
.consentNote {
    margin-top: 8px; font-size: .82rem; opacity: .6;
    display: flex; align-items: center; gap: 4px; color: var(--MI_THEME-success);
}
</style>
