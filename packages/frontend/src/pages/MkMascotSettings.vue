<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork: マスコット機能の設定UI(P3 段階2 / UI改善版)。
  - 未同意なら同意ダイアログ
  - 同意済みなら プレビュー + キャラ + 立ち絵 + 文言(表情をサムネで紐付け) を編集
  - 画像はドライブのURL参照のみ保持。保存は hata/mascot/update でサーバー検証
-->
<template>
<!-- 旗鯖fork: 設定画面の右ペインへ埋め込むときは、窓そのものを枠なしへ差し替える。
     ⚠️窓は position: fixed の重ね表示なので、CSSでペインの中へは収められない。
     ⚠️受け口(#header / 本体 / close())は同じ形なので、中身には手を触れない。 -->
<component :is="embedded ? SettingsEmbeddedWindow : MkModalWindow"
	ref="dialog"
	:width="1240"
	:height="800"
	:withOkButton="consented && canUseMascot"
	:okButtonDisabled="saving || !canSave"
	@ok="save"
	@close="dialog?.close()"
	@closed="emit('closed')"
>
	<template #header>
		<span :class="$style.headerInner">
			<span>{{ copy.settingsTitle }}</span>
			<MkButton v-if="canUseMascot" :class="$style.termsBtn" rounded small @click="showTerms"><i class="ti ti-file-text"></i> {{ copy.termsButton }}</MkButton>
		</span>
	</template>

	<div :class="$style.root">
		<div v-if="loading" :class="$style.loading">{{ copy.loading }}</div>

		<!-- 旗鯖fork: マスコット機能がロールで許可されていないユーザー向けの案内。設定内容は一切出さない。 -->
		<div v-else-if="!canUseMascot" :class="$style.consent">
			<div :class="$style.consentIcon"><i class="ti ti-lock"></i></div>
			<div :class="$style.consentTitle">{{ copy.unavailableTitle }}</div>
			<div :class="$style.consentBody">
				<p>{{ copy.unavailableBody }}</p>
			</div>
		</div>

		<!-- 未同意: 同意ダイアログ -->
		<div v-else-if="!consented" :class="$style.consent">
			<div :class="$style.consentIcon"><i class="ti ti-mood-smile"></i></div>
			<div :class="$style.consentTitle">{{ copy.consentTitle }}</div>
			<div :class="$style.consentBody">
				<p>{{ copy.consentBody }}</p>
				<ul>
					<li v-for="(t, i) in MASCOT_TERMS" :key="i">{{ t }}</li>
				</ul>
			</div>
			<div :class="$style.consentBtns">
				<MkButton @click="dialog?.close()">{{ copy.decline }}</MkButton>
				<MkButton primary gradate @click="agree">{{ copy.agree }}</MkButton>
			</div>
		</div>

		<!-- 同意済み: 編集UI -->
		<template v-else>
			<!-- 旗鯖fork: 保存をブロックしている設定ミスの一覧。解消すると保存ボタンが押せるようになる。 -->
			<div v-if="validationErrors.length > 0" :class="$style.validationCard">
				<div :class="$style.validationHead"><i class="ti ti-alert-triangle"></i> {{ copy.validationSummary }}</div>
				<ul :class="$style.validationList">
					<li v-for="(err, i) in validationErrors" :key="i">{{ err }}</li>
				</ul>
			</div>
			<div :class="$style.layout">
			<!-- 旗鯖fork: モバイルでは名前+削除カードを最上部(キャラ切替より上)に表示 -->
			<div v-if="isMobileLayout && activeChar" :class="$style.card">
				<div :class="$style.label">{{ copy.name }}</div>
				<input :class="$style.inp" :value="activeChar.name" maxlength="30" @input="onName($event)" :placeholder="copy.namePlaceholder" />
				<button v-if="characters.length > 0" :class="$style.delBtn" @click="removeCharacter(activeCharIdx)"><i class="ti ti-trash"></i> {{ copy.deleteCharacter }}</button>
			</div>
			<!-- 旗鯖fork(タスク5): モバイル(縦1列)では最上部にキャラ切替カードを表示 -->
			<div v-if="isMobileLayout" :class="$style.card">
				<div :class="$style.cardHead">
					<span :class="$style.label">{{ copy.characters }}</span>
					<span :class="$style.count">{{ characters.length }} / {{ limits.maxCharacters }}</span>
				</div>
				<div :class="$style.charTabs">
					<button v-for="(c,ci) in characters" :key="c.id" :class="[$style.charTab, activeCharIdx===ci && $style.charTabOn]" @click="selectChar(ci)">
						<img v-if="c.expressions[0]" :src="c.expressions[0].url" :class="$style.charTabThumb" />
						<i v-else class="ti ti-user" :class="$style.charTabThumbIcon"></i>
						<span>{{ c.name || copy.unnamedParenthesized }}</span>
					</button>
					<button v-if="characters.length < limits.maxCharacters" :class="$style.charAdd" @click="addCharacter"><i class="ti ti-plus"></i> {{ copy.add }}</button>
				</div>
				<div :class="$style.ioRow">
					<button :class="$style.ioBtn" :disabled="!activeChar" @click="exportActiveCharacter"><i class="ti ti-download"></i> {{ copy.exportCharacter }}</button>
					<button :class="$style.ioBtn" :disabled="characters.length >= limits.maxCharacters" @click="importCharacterFromFile"><i class="ti ti-upload"></i> {{ copy.importFile }}</button>
				</div>
				<p :class="$style.ioDesc">
					{{ copy.ioDescription1 }}<br>
					{{ copy.ioDescription2 }}<br>
					{{ copy.ioDescription3 }}
				</p>
			</div>
			<!-- ===== プレビュー(吹き出し位置をドラッグで調整) ===== -->
			<div :class="[$style.preview, $style.colPreview]">
				<div ref="previewViewportEl" :class="$style.previewStageWrap">
					<div ref="stageWrapEl" :class="$style.previewStage" :style="{ transform: `scale(${previewScale})` }">
						<template v-if="previewExpression">
							<img :src="previewExpression.url" :style="{ '--htk-motion-i': String(previewExpression.motionIntensity ?? 1) }" :class="[$style.previewImg, previewExpression.motion==='bounce' ? $style.motionBounce : previewExpression.motion==='shake' ? $style.motionShake : previewExpression.motion==='sway' ? $style.motionSway : previewExpression.motion==='spin' ? $style.motionSpin : '']" :alt="previewExpression.label" draggable="false" />
							<!-- 吹き出し(ドラッグで位置調整。位置は表情ごとに保存) -->
							<div
								:class="[$style.previewBubble, bubbleTail==='right' ? $style.tail_right : $style.tail_left, draggingBubble && $style.previewBubbleDragging]"
								:style="bubbleStyle"
								@pointerdown="onBubblePointerDown"
							>
								<span v-if="previewPhraseText">{{ previewPhraseText }}</span>
								<span v-else :class="$style.bubblePlaceholder">{{ copy.phrase }}</span>
								<span :class="$style.bubbleGrip" :title="copy.dragPositionTitle"><i class="ti ti-arrows-move"></i></span>
							</div>
							<!-- ？小吹き出し(疑問トグルON時。ドラッグで位置調整) -->
							<div
								v-if="previewExpression.questionEnabled"
								:class="[$style.qBubble, qTail==='right' ? $style.qtail_right : $style.qtail_left, draggingQBubble && $style.previewBubbleDragging]"
								:style="qBubbleStyle"
								@pointerdown="onQBubblePointerDown"
							><span :class="$style.qMark">?</span><span :class="$style.bubbleGrip" :title="copy.dragPositionTitle"><i class="ti ti-arrows-move"></i></span></div>
							<!-- ！小吹き出し(通知用プレビュー時、exclaimEnabled) -->
							<div
								v-if="(notifyPreviewMode || notify2PreviewMode) && previewExpression.exclaimEnabled"
								:class="[$style.qBubble, eTail==='right' ? $style.qtail_right : $style.qtail_left, draggingEBubble && $style.previewBubbleDragging]"
								:style="eBubbleStyle"
								@pointerdown="onEBubblePointerDown"
							><span :class="$style.qMark">!</span><span :class="$style.bubbleGrip" :title="copy.dragPositionTitle"><i class="ti ti-arrows-move"></i></span></div>
						</template>
						<div v-else :class="$style.previewEmpty">
							<i class="ti ti-photo"></i>
							<span>{{ copy.previewEmpty }}</span>
						</div>
					</div>
				</div>
				<div :class="$style.previewMeta">
					<div v-if="showName && activeChar?.name" :class="$style.previewName">{{ activeChar.name }}</div>
					<div v-if="previewExpression" :class="$style.previewHint">{{ copyx.previewHint({ label: previewExpression.label || copy.unnamed }) }}</div>
					<div v-if="previewExpression" :class="$style.bubbleControls">
						<div :class="$style.bubbleCtrlRow">
							<span :class="$style.bubbleCtrlLabel">{{ copy.bubbleSize }}</span>
							<input type="range" min="0.6" max="1.6" step="0.05" :value="previewExpression.bubbleScale ?? 1" @input="setBubbleScale($event)" :class="$style.bubbleRange" />
						</div>
						<div :class="$style.bubbleCtrlRow">
							<span :class="$style.bubbleCtrlLabel">{{ copy.tailDirection }}</span>
							<div :class="$style.tailToggle">
								<button :class="[$style.tailBtn, bubbleTail==='left' && $style.tailBtnOn]" @click="setBubbleTail('left')">{{ copy.left }}</button>
								<button :class="[$style.tailBtn, bubbleTail==='right' && $style.tailBtnOn]" @click="setBubbleTail('right')">{{ copy.right }}</button>
							</div>
						</div>
						<div :class="$style.qDivider"></div>
						<div :class="$style.bubbleCtrlRow">
							<span :class="$style.bubbleCtrlLabel">{{ copy.questionBubble }}</span>
							<button :class="[$style.sw, previewExpression.questionEnabled && $style.swOn]" @click="toggleQuestion"></button>
						</div>
						<template v-if="previewExpression.questionEnabled">
							<div :class="$style.bubbleCtrlRow">
								<span :class="$style.bubbleCtrlLabel">{{ copy.questionSize }}</span>
								<input type="range" min="0.6" max="1.6" step="0.05" :value="previewExpression.qBubbleScale ?? 1" @input="setQBubbleScale($event)" :class="$style.bubbleRange" />
							</div>
							<div :class="$style.bubbleCtrlRow">
								<span :class="$style.bubbleCtrlLabel">{{ copy.questionTail }}</span>
								<div :class="$style.tailToggle">
									<button :class="[$style.tailBtn, qTail==='left' && $style.tailBtnOn]" @click="setQBubbleTail('left')">{{ copy.left }}</button>
									<button :class="[$style.tailBtn, qTail==='right' && $style.tailBtnOn]" @click="setQBubbleTail('right')">{{ copy.right }}</button>
								</div>
							</div>
							<div :class="$style.qHint">{{ copy.questionDragHint }}</div>
						</template>
					</div>
					<div v-if="(activeChar?.phrases?.length ?? 0) > 0 || activeChar?.notifyExpression || activeChar?.birthdayExpression" :class="$style.previewChipsWrap">
						<div :class="$style.previewChipsLabel"><i class="ti ti-eye"></i> {{ copy.previewPicker }}</div>
						<div :class="$style.previewChips">
							<button
								v-for="(p,pi) in (activeChar?.phrases ?? [])" :key="p.id"
								:class="[$style.previewChip, (!notifyPreviewMode && !notify2PreviewMode && !birthdayPreviewMode && !charBirthdayPreviewMode && previewPhraseIdx===pi) && $style.previewChipOn]"
								@click="selectPreviewPhrase(pi)"
							><i class="ti ti-message-2"></i> {{ p.text || copy.emptyPhrase }}</button>
							<button
								v-if="activeChar?.notifyExpression"
								:class="[$style.previewChip, notifyPreviewMode && $style.previewChipOn]"
								@click="selectNotifyPreview"
							><i class="ti ti-bell"></i> {{ copy.notificationChip }}</button>
							<button
								v-if="activeChar?.notifyExpression2"
								:class="[$style.previewChip, notify2PreviewMode && $style.previewChipOn]"
								@click="selectNotify2Preview"
							><i class="ti ti-bell"></i> {{ copy.notificationSecondChip }}</button>
							<button
								v-if="activeChar?.birthdayExpression"
								:class="[$style.previewChip, birthdayPreviewMode && $style.previewChipOn]"
								@click="selectBirthdayPreview"
							><i class="ti ti-cake"></i> {{ copy.birthdayChip }}</button>
							<button
								v-if="activeChar?.charBirthdayEnabled && activeChar?.charBirthdayExpression"
								:class="[$style.previewChip, charBirthdayPreviewMode && $style.previewChipOn]"
								@click="selectCharBirthdayPreview"
							>{{ copy.characterBirthdayChip }}</button>
						</div>
					</div>
				</div>
			</div>

			<div :class="$style.colSettings">
			<!-- ===== 全体設定 ===== -->
			<div :class="$style.card">
				<div :class="$style.row"><span>{{ copy.showName }}</span><button :class="[$style.sw, showName && $style.swOn]" @click="showName=!showName"></button></div>
			</div>

			<!-- ===== マスコットが伝えること ===== -->
			<div :class="$style.card">
				<div :class="$style.label">{{ copy.thingsToTell }}</div>
				<div :class="$style.desc">{{ copy.thingsToTellDescription }}</div>
				<div :class="$style.row"><span>{{ copy.tellBirthday }}</span><button :class="[$style.sw, displaySettings.tellBirthday && $style.swOn]" @click="toggleDisplay('tellBirthday')"></button></div>
				<div :class="$style.row"><span>{{ copy.tellNotifications }}</span><button :class="[$style.sw, displaySettings.tellNotifications && $style.swOn]" @click="toggleDisplay('tellNotifications')"></button></div>
				<div :class="$style.row"><span>{{ copy.tellRandomPhrases }}</span><button :class="[$style.sw, displaySettings.tellRandomPhrases && $style.swOn]" @click="toggleDisplay('tellRandomPhrases')"></button></div>
				<div :class="$style.row"><span>{{ copy.tellUnreadOnLogin }}</span><button :class="[$style.sw, displaySettings.tellUnreadOnLogin && $style.swOn]" @click="toggleDisplay('tellUnreadOnLogin')"></button></div>
				<div :class="$style.row"><span>{{ copy.tellHataskNotifications }}</span><button :class="[$style.sw, displaySettings.tellHataskNotifications && $style.swOn]" @click="toggleDisplay('tellHataskNotifications')"></button></div>
				<div :class="$style.subDivider"></div>
				<div :class="$style.row"><span>{{ copy.suppressStandardToast }}</span><button :class="[$style.sw, displaySettings.suppressStandardToast && $style.swOn]" @click="toggleDisplay('suppressStandardToast')"></button></div>
				<div :class="$style.desc" style="margin-top:6px;margin-bottom:0">{{ copy.suppressStandardToastDescription }}</div>
					<div :class="$style.subDivider"></div>
					<div :class="$style.row">
						<span>{{ copy.notificationDuration }}</span>
						<span :class="$style.durationCtrl">
							<input type="number" min="1" max="60" :value="displaySettings.notifyDurationSec" @input="setNotifyDuration($event)" :class="$style.durationInput" /> {{ copy.seconds }}
						</span>
					</div>
					<div :class="$style.desc" style="margin-top:6px;margin-bottom:0">{{ copy.notificationDurationDescription }}</div>
					<div :class="$style.subDivider"></div>
					<div :class="$style.row" style="flex-wrap:wrap;gap:6px">
						<span>{{ copy.rotationInterval }}</span>
						<span :class="$style.idlePresets">
							<button :class="[$style.idlePreset, isIdlePreset(3,8) && $style.idlePresetOn]" @click="setIdlePreset(3,8)">{{ copy.frequent }}</button>
							<button :class="[$style.idlePreset, isIdlePreset(5,12) && $style.idlePresetOn]" @click="setIdlePreset(5,12)">{{ copy.standard }}</button>
							<button :class="[$style.idlePreset, isIdlePreset(30,90) && $style.idlePresetOn]" @click="setIdlePreset(30,90)">{{ copy.subtle }}</button>
						</span>
					</div>
					<div :class="$style.row">
						<span :class="$style.idleManualLabel">{{ copy.manualSeconds }}</span>
						<span :class="$style.durationCtrl">
							{{ copy.minimum }} <input type="number" min="5" max="1800" :value="displaySettings.idleMinSec" @input="setIdleMin($event)" :class="$style.durationInput" />
							{{ copy.rangeSeparator }} {{ copy.maximum }} <input type="number" min="5" max="1800" :value="displaySettings.idleMaxSec" @input="setIdleMax($event)" :class="$style.durationInput" />
						</span>
					</div>
					<div :class="$style.desc" style="margin-top:6px;margin-bottom:0">{{ copy.rotationIntervalDescription }}</div>
					<div :class="$style.subDivider"></div>
					<div :class="$style.row"><span>{{ copy.floatingDesktop }}</span><button :class="[$style.sw, displaySettings.floatingEnabledDesktop && $style.swOn]" @click="toggleDisplay('floatingEnabledDesktop')"></button></div>
					<div :class="$style.row"><span>{{ copy.floatingMobile }}</span><button :class="[$style.sw, displaySettings.floatingEnabledMobile && $style.swOn]" @click="toggleDisplay('floatingEnabledMobile')"></button></div>
					<div :class="$style.desc" style="margin-top:6px;margin-bottom:0">{{ copy.floatingDescription }}</div>
					<div :class="$style.subDivider"></div>
					<div :class="$style.row">
						<span>{{ copy.floatingBackdropOpacity }}</span>
						<span :class="$style.durationCtrl">
							<input type="range" min="0" max="1" step="0.05" :value="displaySettings.floatingBackdropOpacity" @input="setBackdropOpacity($event)" />
							<span :class="$style.backdropVal">{{ Math.round((displaySettings.floatingBackdropOpacity ?? 0) * 100) }}%</span>
						</span>
					</div>
					<div :class="$style.row">
						<span>{{ copy.floatingBackdropColor }}</span>
						<input type="color" :value="displaySettings.floatingBackdropColor || '#000000'" @input="setBackdropColor($event)" :class="$style.backdropColor" />
					</div>
					<div :class="$style.desc" style="margin-top:6px;margin-bottom:0">{{ copy.floatingBackdropDescription }}</div>
				</div>

			<!-- 旗鯖fork(タスク5): キャラ切替カードは layout 直下(モバイル)または colSpecial(非モバイル)に移動 -->

			<template v-if="activeChar">
				<!-- 立ち絵 -->
				<div :class="$style.card">
					<div :class="$style.cardHead">
						<span :class="$style.label">{{ copy.expressions }}</span>
						<span :class="$style.count">{{ activeChar.expressions.length }} / {{ limits.maxExpressions }}</span>
					</div>
					<div :class="$style.desc">{{ copy.expressionsDescription }}</div>
					<div v-if="activeChar.expressions.length === 0" :class="$style.empty">{{ copy.noExpressions }}</div>
					<div v-else :class="$style.expGrid">
						<div v-for="(e,ei) in activeChar.expressions" :key="e.id" :class="$style.expItem">
							<img :src="e.url" :class="$style.expImg" :alt="e.label" />
							<input :class="$style.expLabel" :value="e.label" maxlength="30" @input="onExpLabel(ei,$event)" :placeholder="copy.labelPlaceholder" />
							<select :class="$style.expMotion" :value="e.motion ?? 'none'" @change="onExpMotion(ei,$event)">
								<option value="none">{{ copy.motionNone }}</option>
								<option value="bounce">{{ copy.motionBounce }}</option>
								<option value="shake">{{ copy.motionShake }}</option>
								<option value="sway">{{ copy.motionSway }}</option>
								<option value="spin">{{ copy.motionSpin }}</option>
							</select>
							<div v-if="e.motion && e.motion !== 'none' && e.motion !== 'spin'" :class="$style.expIntensity">
								<span :class="$style.expIntensityLabel">{{ copy.strength }}</span>
								<input type="range" min="0.3" max="2" step="0.1" :value="e.motionIntensity ?? 1" @input="onExpIntensity(ei,$event)" :class="$style.expIntensityRange" />
							</div>
							<div :class="$style.colorRow">
								<span :class="$style.colorLabel">{{ copy.textColor }}</span>
								<input type="color" :value="e.textColor || '#000000'" @input="setExpTextColor(ei,$event)" :class="$style.colorInput" />
								<button v-if="e.textColor" :class="$style.colorClear" @click="clearExpTextColor(ei)" :title="copy.restoreDefault"><i class="ti ti-x"></i></button>
							</div>
							<div v-if="e.questionEnabled" :class="$style.colorRow">
								<span :class="$style.colorLabel">{{ copy.questionColor }}</span>
								<input type="color" :value="e.qTextColor || '#000000'" @input="setExpQTextColor(ei,$event)" :class="$style.colorInput" />
								<button v-if="e.qTextColor" :class="$style.colorClear" @click="clearExpQTextColor(ei)" :title="copy.restoreDefault"><i class="ti ti-x"></i></button>
							</div>
							<button :class="$style.expDel" @click="removeExpression(ei)"><i class="ti ti-x"></i></button>
						</div>
					</div>
					<MkButton v-if="activeChar.expressions.length < limits.maxExpressions" rounded @click="addExpression"><i class="ti ti-photo-plus"></i> {{ copy.addExpression }}</MkButton>
				</div>

				<!-- 文言 -->
				<div :class="$style.card">
					<div :class="$style.cardHead">
						<span :class="$style.label">{{ copy.phrases }}</span>
						<span :class="$style.count">{{ activeChar.phrases.length }} / {{ limits.maxPhrases }}</span>
					</div>
					<div :class="$style.desc">{{ copy.phrasesDescription }}</div>
					<div v-if="activeChar.phrases.length === 0" :class="$style.empty">{{ copy.noPhrases }}</div>
					<div v-for="(p,pi) in activeChar.phrases" :key="p.id" :class="$style.phraseCard">
						<div :class="$style.phraseTop">
							<input :class="$style.inp" :value="p.text" maxlength="140" @input="onPhraseText(pi,$event)" :placeholder="copy.phraseInputPlaceholder" />
							<button :class="$style.phraseDel" @click="removePhrase(pi)"><i class="ti ti-trash"></i></button>
						</div>
						<!-- 立ち絵をサムネで選んで紐付け -->
						<div :class="$style.linkRow">
							<span :class="$style.linkLabel">{{ copy.expressionLabel }}</span>
							<button :class="[$style.linkThumb, !p.expressionId && $style.linkThumbOn]" @click="setPhraseExp(pi, null)" :title="copy.noExpression">
								<i class="ti ti-ban"></i>
							</button>
							<button
								v-for="e in activeChar.expressions" :key="e.id"
								:class="[$style.linkThumb, p.expressionId===e.id && $style.linkThumbOn]"
								:title="e.label || copy.unnamedParenthesized"
								@click="setPhraseExp(pi, e.id)"
							>
								<img :src="e.url" :class="$style.linkThumbImg" />
							</button>
							<span v-if="activeChar.expressions.length === 0" :class="$style.linkEmpty">{{ copy.addExpressionsFirst }}</span>
						</div>
					</div>
					<MkButton v-if="activeChar.phrases.length < limits.maxPhrases" rounded @click="addPhrase"><i class="ti ti-plus"></i> {{ copy.addPhrase }}</MkButton>
				</div>

				</template>
				</div><!-- /colSettings(中央) -->

				<div :class="$style.colSpecial">
				<!-- 旗鯖fork: 非モバイルでは名前+削除カードを右列(colSpecial)の一番上に表示 -->
				<div v-if="!isMobileLayout && activeChar" :class="$style.card">
					<div :class="$style.label">{{ copy.name }}</div>
					<input :class="$style.inp" :value="activeChar.name" maxlength="30" @input="onName($event)" :placeholder="copy.namePlaceholder" />
					<button v-if="characters.length > 0" :class="$style.delBtn" @click="removeCharacter(activeCharIdx)"><i class="ti ti-trash"></i> {{ copy.deleteCharacter }}</button>
				</div>
				<!-- 旗鯖fork(タスク5): 非モバイル(横並び)では最右列(colSpecial)の先頭にキャラ切替カードを表示 -->
				<div v-if="!isMobileLayout" :class="$style.card">
					<div :class="$style.cardHead">
						<span :class="$style.label">{{ copy.characters }}</span>
						<span :class="$style.count">{{ characters.length }} / {{ limits.maxCharacters }}</span>
					</div>
					<div :class="$style.charTabs">
						<button v-for="(c,ci) in characters" :key="c.id" :class="[$style.charTab, activeCharIdx===ci && $style.charTabOn]" @click="selectChar(ci)">
							<img v-if="c.expressions[0]" :src="c.expressions[0].url" :class="$style.charTabThumb" />
							<i v-else class="ti ti-user" :class="$style.charTabThumbIcon"></i>
							<span>{{ c.name || copy.unnamedParenthesized }}</span>
						</button>
						<button v-if="characters.length < limits.maxCharacters" :class="$style.charAdd" @click="addCharacter"><i class="ti ti-plus"></i> {{ copy.add }}</button>
					</div>
					<div :class="$style.ioRow">
						<button :class="$style.ioBtn" :disabled="!activeChar" @click="exportActiveCharacter"><i class="ti ti-download"></i> {{ copy.exportCharacter }}</button>
						<button :class="$style.ioBtn" :disabled="characters.length >= limits.maxCharacters" @click="importCharacterFromFile"><i class="ti ti-upload"></i> {{ copy.importFile }}</button>
					</div>
					<p :class="$style.ioDesc">
						{{ copy.ioDescription1 }}<br>
						{{ copy.ioDescription2 }}<br>
						{{ copy.ioDescription3 }}
					</p>
				</div>
				<template v-if="activeChar">
				<!-- ===== 通知用の専用表情 ===== -->
				<div :class="$style.card">
					<div :class="$style.label">{{ copy.notificationExpression }}</div>
					<div :class="$style.desc">{{ copy.notificationExpressionDescription }}</div>
					<template v-if="activeChar.notifyExpression">
						<div :class="$style.expItem" style="max-width:140px;">
							<img :src="activeChar.notifyExpression.url || ''" :class="$style.expImg" />
							<button :class="$style.expDel" @click="clearNotify"><i class="ti ti-x"></i></button>
						</div>
						<input :class="$style.expLabel" :value="activeChar.notifyExpression.label" maxlength="30" @input="onNotifyField('label',$event)" :placeholder="copy.optionalLabelPlaceholder" style="margin-top:8px;" />
						<div :class="$style.desc" style="margin:8px 0 0">{{ copy.notificationPrefaceBefore }}<b>{{ copy.notificationPrefaceTerm }}</b>{{ copy.notificationPrefaceAfter }}</div>
						<input :class="$style.inp" :value="activeChar.notifyExpression.text" maxlength="140" @input="onNotifyField('text',$event)" :placeholder="copy.notificationTextExample" style="margin-top:6px;" />
						<div :class="$style.colorRow" style="margin-top:8px;">
							<span :class="$style.colorLabel">{{ copy.textColor }}</span>
							<input type="color" :value="activeChar.notifyExpression.textColor || '#000000'" @input="setNotifyTextColor($event)" :class="$style.colorInput" />
							<button v-if="activeChar.notifyExpression.textColor" :class="$style.colorClear" @click="clearNotifyTextColor" :title="copy.restoreDefault"><i class="ti ti-x"></i></button>
						</div>
						<div :class="$style.bubbleCtrlRow" style="margin-top:8px;">
							<span :class="$style.bubbleCtrlLabel">{{ copy.motion }}</span>
							<select :class="$style.expMotion" :value="activeChar.notifyExpression.motion" @change="onNotifyField('motion',$event)">
								<option value="none">{{ copy.motionNone }}</option>
								<option value="bounce">{{ copy.motionBounce }}</option>
								<option value="shake">{{ copy.motionShake }}</option>
								<option value="sway">{{ copy.motionSway }}</option>
								<option value="spin">{{ copy.motionSpin }}</option>
							</select>
						</div>
						<div v-if="activeChar.notifyExpression.motion !== 'none' && activeChar.notifyExpression.motion !== 'spin'" :class="$style.bubbleCtrlRow">
							<span :class="$style.bubbleCtrlLabel">{{ copy.motionStrength }}</span>
							<input type="range" min="0.3" max="2" step="0.1" :value="activeChar.notifyExpression.motionIntensity" @input="onNotifyField('motionIntensity',$event)" :class="$style.bubbleRange" />
						</div>
						<div :class="$style.subDivider"></div>
						<div :class="$style.bubbleCtrlRow">
							<span :class="$style.bubbleCtrlLabel">{{ copy.exclaimBubble }}</span>
							<button :class="[$style.sw, activeChar.notifyExpression.exclaimEnabled && $style.swOn]" @click="toggleNotifyExclaim"></button>
						</div>
						<template v-if="activeChar.notifyExpression.exclaimEnabled">
							<div :class="$style.bubbleCtrlRow">
								<span :class="$style.bubbleCtrlLabel">{{ copy.exclaimSize }}</span>
								<input type="range" min="0.6" max="1.6" step="0.05" :value="activeChar.notifyExpression.eBubbleScale" @input="setNotifyEScale($event)" :class="$style.bubbleRange" />
							</div>
							<div :class="$style.bubbleCtrlRow">
								<span :class="$style.bubbleCtrlLabel">{{ copy.exclaimTail }}</span>
								<div :class="$style.tailToggle">
									<button :class="[$style.tailBtn, activeChar.notifyExpression.eBubbleTail==='left' && $style.tailBtnOn]" @click="setNotifyETail('left')">{{ copy.left }}</button>
									<button :class="[$style.tailBtn, activeChar.notifyExpression.eBubbleTail==='right' && $style.tailBtnOn]" @click="setNotifyETail('right')">{{ copy.right }}</button>
								</div>
							</div>
							<div :class="$style.colorRow">
								<span :class="$style.colorLabel">{{ copy.exclaimColor }}</span>
								<input type="color" :value="activeChar.notifyExpression.eTextColor || '#000000'" @input="setNotifyETextColor($event)" :class="$style.colorInput" />
								<button v-if="activeChar.notifyExpression.eTextColor" :class="$style.colorClear" @click="clearNotifyETextColor" :title="copy.restoreDefault"><i class="ti ti-x"></i></button>
							</div>
						</template>
						<div :class="$style.desc" style="margin:4px 0 0">{{ copy.notificationAdjustHint }}</div>
					</template>
					<MkButton v-else rounded @click="chooseNotifyImage"><i class="ti ti-plus"></i> {{ copy.chooseNotificationImage }}</MkButton>
				</div>

				<!-- ===== 通知用の専用表情(2つ目) ===== -->
				<div :class="$style.card">
					<div :class="$style.label">{{ copy.notificationExpressionSecond }}</div>
					<div :class="$style.desc">{{ copy.notificationExpressionSecondDescription }}</div>
					<template v-if="activeChar.notifyExpression2">
						<div :class="$style.expItem" style="max-width:140px;">
							<img :src="activeChar.notifyExpression2.url || ''" :class="$style.expImg" />
							<button :class="$style.expDel" @click="clearNotify2"><i class="ti ti-x"></i></button>
						</div>
						<input :class="$style.expLabel" :value="activeChar.notifyExpression2.label" maxlength="30" @input="onNotify2Field('label',$event)" :placeholder="copy.optionalLabelPlaceholder" style="margin-top:8px;" />
						<div :class="$style.desc" style="margin:8px 0 0">{{ copy.notificationPrefaceBefore }}<b>{{ copy.notificationPrefaceTerm }}</b>{{ copy.notificationPrefaceAfter }}</div>
						<input :class="$style.inp" :value="activeChar.notifyExpression2.text" maxlength="140" @input="onNotify2Field('text',$event)" :placeholder="copy.notificationTextExample" style="margin-top:6px;" />
						<div :class="$style.colorRow" style="margin-top:8px;">
							<span :class="$style.colorLabel">{{ copy.textColor }}</span>
							<input type="color" :value="activeChar.notifyExpression2.textColor || '#000000'" @input="setNotify2TextColor($event)" :class="$style.colorInput" />
							<button v-if="activeChar.notifyExpression2.textColor" :class="$style.colorClear" @click="clearNotify2TextColor" :title="copy.restoreDefault"><i class="ti ti-x"></i></button>
						</div>
						<div :class="$style.bubbleCtrlRow" style="margin-top:8px;">
							<span :class="$style.bubbleCtrlLabel">{{ copy.motion }}</span>
							<select :class="$style.expMotion" :value="activeChar.notifyExpression2.motion" @change="onNotify2Field('motion',$event)">
								<option value="none">{{ copy.motionNone }}</option>
								<option value="bounce">{{ copy.motionBounce }}</option>
								<option value="shake">{{ copy.motionShake }}</option>
								<option value="sway">{{ copy.motionSway }}</option>
								<option value="spin">{{ copy.motionSpin }}</option>
							</select>
						</div>
						<div v-if="activeChar.notifyExpression2.motion !== 'none' && activeChar.notifyExpression2.motion !== 'spin'" :class="$style.bubbleCtrlRow">
							<span :class="$style.bubbleCtrlLabel">{{ copy.motionStrength }}</span>
							<input type="range" min="0.3" max="2" step="0.1" :value="activeChar.notifyExpression2.motionIntensity" @input="onNotify2Field('motionIntensity',$event)" :class="$style.bubbleRange" />
						</div>
						<div :class="$style.subDivider"></div>
						<div :class="$style.bubbleCtrlRow">
							<span :class="$style.bubbleCtrlLabel">{{ copy.exclaimBubble }}</span>
							<button :class="[$style.sw, activeChar.notifyExpression2.exclaimEnabled && $style.swOn]" @click="toggleNotify2Exclaim"></button>
						</div>
						<template v-if="activeChar.notifyExpression2.exclaimEnabled">
							<div :class="$style.bubbleCtrlRow">
								<span :class="$style.bubbleCtrlLabel">{{ copy.exclaimSize }}</span>
								<input type="range" min="0.6" max="1.6" step="0.05" :value="activeChar.notifyExpression2.eBubbleScale" @input="setNotify2EScale($event)" :class="$style.bubbleRange" />
							</div>
							<div :class="$style.bubbleCtrlRow">
								<span :class="$style.bubbleCtrlLabel">{{ copy.exclaimTail }}</span>
								<div :class="$style.tailToggle">
									<button :class="[$style.tailBtn, activeChar.notifyExpression2.eBubbleTail==='left' && $style.tailBtnOn]" @click="setNotify2ETail('left')">{{ copy.left }}</button>
									<button :class="[$style.tailBtn, activeChar.notifyExpression2.eBubbleTail==='right' && $style.tailBtnOn]" @click="setNotify2ETail('right')">{{ copy.right }}</button>
								</div>
							</div>
							<div :class="$style.colorRow">
								<span :class="$style.colorLabel">{{ copy.exclaimColor }}</span>
								<input type="color" :value="activeChar.notifyExpression2.eTextColor || '#000000'" @input="setNotify2ETextColor($event)" :class="$style.colorInput" />
								<button v-if="activeChar.notifyExpression2.eTextColor" :class="$style.colorClear" @click="clearNotify2ETextColor" :title="copy.restoreDefault"><i class="ti ti-x"></i></button>
							</div>
						</template>
						<div :class="$style.desc" style="margin:4px 0 0">{{ copy.notificationSecondAdjustHint }}</div>
					</template>
					<MkButton v-else rounded @click="chooseNotifyImage2"><i class="ti ti-plus"></i> {{ copy.chooseNotificationSecondImage }}</MkButton>
				</div>

				<!-- ===== 誕生日用の専用表情 ===== -->
				<div :class="$style.card">
					<div :class="$style.label">{{ copy.birthdayExpression }}</div>
					<div :class="$style.desc">{{ copy.birthdayExpressionDescription }}</div>
					<template v-if="activeChar.birthdayExpression">
						<div :class="$style.expItem" style="max-width:140px;">
							<img :src="activeChar.birthdayExpression.url || ''" :class="$style.expImg" />
							<button :class="$style.expDel" @click="clearBirthday"><i class="ti ti-x"></i></button>
						</div>
						<input :class="$style.expLabel" :value="activeChar.birthdayExpression.label" maxlength="30" @input="onBirthdayField('label',$event)" :placeholder="copy.optionalLabelPlaceholder" style="margin-top:8px;" />
						<input :class="$style.inp" :value="activeChar.birthdayExpression.text" maxlength="140" @input="onBirthdayField('text',$event)" :placeholder="copy.birthdayPhrasePlaceholder" style="margin-top:8px;" />
						<div :class="$style.colorRow" style="margin-top:8px;">
							<span :class="$style.colorLabel">{{ copy.textColor }}</span>
							<input type="color" :value="activeChar.birthdayExpression.textColor || '#000000'" @input="setBirthdayTextColor($event)" :class="$style.colorInput" />
							<button v-if="activeChar.birthdayExpression.textColor" :class="$style.colorClear" @click="clearBirthdayTextColor" :title="copy.restoreDefault"><i class="ti ti-x"></i></button>
						</div>
						<div :class="$style.bubbleCtrlRow" style="margin-top:8px;">
							<span :class="$style.bubbleCtrlLabel">{{ copy.motion }}</span>
							<select :class="$style.expMotion" :value="activeChar.birthdayExpression.motion" @change="onBirthdayField('motion',$event)">
								<option value="none">{{ copy.motionNone }}</option>
								<option value="bounce">{{ copy.motionBounce }}</option>
								<option value="shake">{{ copy.motionShake }}</option>
								<option value="sway">{{ copy.motionSway }}</option>
								<option value="spin">{{ copy.motionSpin }}</option>
							</select>
						</div>
						<div v-if="activeChar.birthdayExpression.motion !== 'none' && activeChar.birthdayExpression.motion !== 'spin'" :class="$style.bubbleCtrlRow">
							<span :class="$style.bubbleCtrlLabel">{{ copy.motionStrength }}</span>
							<input type="range" min="0.3" max="2" step="0.1" :value="activeChar.birthdayExpression.motionIntensity" @input="onBirthdayField('motionIntensity',$event)" :class="$style.bubbleRange" />
						</div>
						<div :class="$style.desc" style="margin:4px 0 0">{{ copy.birthdayAdjustHint }}</div>
					</template>
					<MkButton v-else rounded @click="chooseBirthdayImage"><i class="ti ti-plus"></i> {{ copy.chooseBirthdayImage }}</MkButton>
				</div>

				<!-- ===== キャラ自身の誕生日 ===== -->
				<div :class="$style.card">
					<div :class="$style.cardHead">
						<span :class="$style.label">{{ copy.characterBirthday }}</span>
						<button :class="[$style.sw, activeChar.charBirthdayEnabled && $style.swOn]" @click="toggleCharBirthday"></button>
					</div>
					<div :class="$style.desc">{{ copy.characterBirthdayDescription }}</div>
					<template v-if="activeChar.charBirthdayEnabled">
						<div :class="$style.bubbleCtrlRow">
							<span :class="$style.bubbleCtrlLabel">{{ copy.birthday }}</span>
							<span :class="$style.durationCtrl">
								<input type="number" min="1" max="12" :value="activeChar.charBirthdayMonth ?? ''" @input="setCharBirthdayMonth($event)" :class="$style.durationInput" /> {{ copy.month }}
								<input type="number" min="1" max="31" :value="activeChar.charBirthdayDay ?? ''" @input="setCharBirthdayDay($event)" :class="$style.durationInput" /> {{ copy.day }}
							</span>
						</div>
						<div :class="$style.subDivider"></div>
						<template v-if="activeChar.charBirthdayExpression">
							<div :class="$style.expItem" style="max-width:140px;">
								<img :src="activeChar.charBirthdayExpression.url || ''" :class="$style.expImg" />
								<button :class="$style.expDel" @click="clearCharBirthday"><i class="ti ti-x"></i></button>
							</div>
							<input :class="$style.expLabel" :value="activeChar.charBirthdayExpression.label" maxlength="30" @input="onCharBirthdayField('label',$event)" :placeholder="copy.optionalLabelPlaceholder" style="margin-top:8px;" />
							<input :class="$style.inp" :value="activeChar.charBirthdayExpression.text" maxlength="140" @input="onCharBirthdayField('text',$event)" :placeholder="copy.characterBirthdayPhraseExample" style="margin-top:8px;" />
							<div :class="$style.bubbleCtrlRow" style="margin-top:8px;">
								<span :class="$style.bubbleCtrlLabel">{{ copy.motion }}</span>
								<select :class="$style.expMotion" :value="activeChar.charBirthdayExpression.motion" @change="onCharBirthdayField('motion',$event)">
									<option value="none">{{ copy.motionNone }}</option>
									<option value="bounce">{{ copy.motionBounce }}</option>
									<option value="shake">{{ copy.motionShake }}</option>
									<option value="sway">{{ copy.motionSway }}</option>
									<option value="spin">{{ copy.motionSpin }}</option>
								</select>
							</div>
							<div v-if="activeChar.charBirthdayExpression.motion !== 'none' && activeChar.charBirthdayExpression.motion !== 'spin'" :class="$style.bubbleCtrlRow">
								<span :class="$style.bubbleCtrlLabel">{{ copy.motionStrength }}</span>
								<input type="range" min="0.3" max="2" step="0.1" :value="activeChar.charBirthdayExpression.motionIntensity" @input="onCharBirthdayField('motionIntensity',$event)" :class="$style.bubbleRange" />
							</div>
							<div :class="$style.colorRow">
								<span :class="$style.colorLabel">{{ copy.textColor }}</span>
								<input type="color" :value="activeChar.charBirthdayExpression.textColor || '#000000'" @input="setCharBirthdayTextColor($event)" :class="$style.colorInput" />
								<button v-if="activeChar.charBirthdayExpression.textColor" :class="$style.colorClear" @click="clearCharBirthdayTextColor" :title="copy.restoreDefault"><i class="ti ti-x"></i></button>
							</div>
							<div :class="$style.desc" style="margin:4px 0 0">{{ copy.characterBirthdayAdjustHint }}</div>
						</template>
						<MkButton v-else rounded @click="chooseCharBirthdayImage"><i class="ti ti-plus"></i> {{ copy.chooseCharacterBirthdayImage }}</MkButton>
					</template>
				</div>
			</template>
			</div><!-- /colSpecial(右) -->
			</div><!-- /layout -->
		</template>
	</div>
</component>
</template>

<script lang="ts" setup>
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from 'vue';
import SettingsEmbeddedWindow from '@/components/SettingsEmbeddedWindow.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkButton from '@/components/MkButton.vue';
import MkMascotImportSelectDialog from '@/components/MkMascotImportSelectDialog.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { chooseDriveFile } from '@/utility/drive.js';
import * as os from '@/os.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { displaySettings, loadDisplaySettings, saveDisplaySettings, loadMascot, type MascotDisplaySettings } from '@/utility/mascot-store.js';

const emit = defineEmits<{ (ev:'closed'):void }>();
/**
 * 旗鯖fork: 窓と埋め込みのどちらでも通る参照の型。
 * ⚠️片方の窓の型に固定すると、埋め込みへ差し替えたときに型が合わなくなる。
 *   実際に使うのは close() だけなので、そこだけを約束する。
 */
type SettingsWindowHandle = { close: () => void };
const dialog = shallowRef<SettingsWindowHandle>();
const copy = i18n.ts._hata._mascotSettings;
const copyx = i18n.tsx._hata._mascotSettings;

// 旗鯖fork(タスク5): キャラ切替カードの描画位置を画面幅で出し分けるための判定。
// CSSレイアウトのブレークポイント(800px)に合わせ、799px以下を「縦1列(モバイル)」とみなす。
// モバイルではキャラ切替カードを最上部(プレビューより前)に、それ以外では最右列(colSpecial)の先頭に置く。
const mobileLayoutQuery = window.matchMedia('(max-width: 799px)');
const isMobileLayout = ref(mobileLayoutQuery.matches);
function onMobileLayoutChange(e: MediaQueryListEvent) { isMobileLayout.value = e.matches; }
onMounted(() => { mobileLayoutQuery.addEventListener('change', onMobileLayoutChange); });
onUnmounted(() => { mobileLayoutQuery.removeEventListener('change', onMobileLayoutChange); });

type Expression = { id: string; label: string; url: string; driveFileId: string | null; bubbleX?: number; bubbleY?: number; bubbleScale?: number; bubbleTail?: 'left' | 'right'; motion?: 'none' | 'bounce' | 'shake' | 'sway' | 'spin'; motionIntensity?: number; questionEnabled?: boolean; qBubbleX?: number; qBubbleY?: number; qBubbleScale?: number; qBubbleTail?: 'left' | 'right'; exclaimEnabled?: boolean; eBubbleX?: number; eBubbleY?: number; eBubbleScale?: number; eBubbleTail?: 'left' | 'right'; textColor?: string | null; qTextColor?: string | null; eTextColor?: string | null };
type Phrase = { id: string; text: string; expressionId: string | null };
type NotifyExpression = { url: string | null; driveFileId: string | null; label: string; text: string; motion: 'none' | 'bounce' | 'shake' | 'sway' | 'spin'; motionIntensity: number; bubbleX: number; bubbleY: number; bubbleScale: number; bubbleTail: 'left' | 'right'; exclaimEnabled: boolean; eBubbleX: number; eBubbleY: number; eBubbleScale: number; eBubbleTail: 'left' | 'right'; textColor?: string | null; eTextColor?: string | null };
type BirthdayExpression = { url: string | null; driveFileId: string | null; label: string; text: string; motion: 'none' | 'bounce' | 'shake' | 'sway' | 'spin'; motionIntensity: number; bubbleX: number; bubbleY: number; bubbleScale: number; bubbleTail: 'left' | 'right'; textColor?: string | null };
type Character = { id: string; name: string; expressions: Expression[]; phrases: Phrase[]; notifyExpression: NotifyExpression | null; notifyExpression2: NotifyExpression | null; birthdayExpression: BirthdayExpression | null; charBirthdayEnabled: boolean; charBirthdayMonth: number | null; charBirthdayDay: number | null; charBirthdayExpression: BirthdayExpression | null };

const loading = ref(true);
const consented = ref(false);
const saving = ref(false);
// 旗鯖fork: マスコット機能の利用可否(ロールポリシー)。未許可なら設定内容を出さない。
const canUseMascot = computed(() => $i?.policies?.canUseMascot === true);
// 旗鯖fork: 利用規約(同意ウィンドウと右上ボタンの両方から参照する)。
const MASCOT_TERMS: string[] = [
	copy.termImageRights,
	copy.termProhibitedImages,
	copy.termDisclaimer,
	copy.termModeration,
];
// 右上ボタンから利用規約をいつでも確認できるようにする。
function showTerms() {
	os.alert({
		type: 'info',
		title: copy.termsTitle,
		text: MASCOT_TERMS.map((t, i) => `${i + 1}. ${t}`).join('\n\n'),
	});
}
const characters = ref<Character[]>([]);
const activeCharIdx = ref(0);
const showName = ref(false);
const limits = ref({ maxCharacters: 3, maxExpressions: 5, maxPhrases: 10 });

// プレビューで今表示している文言のインデックス
const previewPhraseIdx = ref(0);

const activeChar = computed<Character | null>(() => characters.value[activeCharIdx.value] ?? null);

// プレビュー: 選択中の文言と、それに紐づく表情(なければ先頭表情)
const previewPhrase = computed<Phrase | null>(() => activeChar.value?.phrases[previewPhraseIdx.value] ?? null);
const previewPhraseText = computed<string>(() => {
	if (notifyPreviewMode.value && activeChar.value?.notifyExpression) return activeChar.value.notifyExpression.text ?? '';
	if (notify2PreviewMode.value && activeChar.value?.notifyExpression2) return activeChar.value.notifyExpression2.text ?? '';
	if (birthdayPreviewMode.value && activeChar.value?.birthdayExpression) return activeChar.value.birthdayExpression.text ?? '';
	if (charBirthdayPreviewMode.value && activeChar.value?.charBirthdayExpression) return activeChar.value.charBirthdayExpression.text ?? '';
	return previewPhrase.value?.text ?? '';
});
const previewExpression = computed<Expression | null>(() => {
	const c = activeChar.value;
	if (!c) return null;
	// 通知用プレビュー時は通知用表情を返す(Expression互換として扱う)
	if (notifyPreviewMode.value && c.notifyExpression) {
		return { id: '__notify__', ...c.notifyExpression } as unknown as Expression;
	}
	if (notify2PreviewMode.value && c.notifyExpression2) {
		return { id: '__notify2__', ...c.notifyExpression2 } as unknown as Expression;
	}
	if (birthdayPreviewMode.value && c.birthdayExpression) {
		return { id: '__birthday__', ...c.birthdayExpression } as unknown as Expression;
	}
	if (charBirthdayPreviewMode.value && c.charBirthdayExpression) {
		return { id: '__charbirthday__', ...c.charBirthdayExpression } as unknown as Expression;
	}
	const linked = previewPhrase.value?.expressionId;
	if (linked) {
		const found = c.expressions.find(e => e.id === linked);
		if (found) return found;
	}
	return c.expressions[0] ?? null;
});

// ===== 吹き出し位置のドラッグ調整(表情ごとに保存) =====
// TL と同じ 200 × 150 の配置を全体ごと拡大する。文字・画像・余白の比率も揃える。
const previewViewportEl = ref<HTMLElement | null>(null);
const previewScale = ref(1);
const previewResizeObserver = new ResizeObserver(([entry]) => {
	if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
		previewScale.value = Math.min(entry.contentRect.width / 200, entry.contentRect.height / 150);
	}
});
watch(previewViewportEl, (element) => {
	previewResizeObserver.disconnect();
	if (element) previewResizeObserver.observe(element);
}, { flush: 'post' });
onUnmounted(() => { previewResizeObserver.disconnect(); });
const stageWrapEl = ref<HTMLElement | null>(null);
const draggingBubble = ref(false);

// ドラッグ・スライダーの書き込み先。通知用プレビュー時は notifyExpression、
// それ以外は expressions 内の実体オブジェクトを返す(どちらも bubble系フィールドを持つ)。
function targetExpr(): any | null {
	const c = activeChar.value;
	if (!c) return null;
	if (notifyPreviewMode.value) return c.notifyExpression ?? null;
	if (notify2PreviewMode.value) return c.notifyExpression2 ?? null;
	if (birthdayPreviewMode.value) return c.birthdayExpression ?? null;
	if (charBirthdayPreviewMode.value) return c.charBirthdayExpression ?? null;
	const e = previewExpression.value;
	if (!e) return null;
	return c.expressions.find(x => x.id === e.id) ?? null;
}

// 現在の表情の吹き出し位置(0〜1)。未設定はデフォルト(上中央寄り)。
const bubbleStyle = computed(() => {
	const e = previewExpression.value;
	const x = (e?.bubbleX ?? 0.5);
	const y = (e?.bubbleY ?? 0.1);
	const scale = (typeof e?.bubbleScale === 'number' ? e.bubbleScale : 1);
	const s: Record<string, string> = {
		left: (x * 100) + '%',
		top: (y * 100) + '%',
		fontSize: (0.85 * scale) + 'rem',
	};
	if (e?.textColor) s.color = e.textColor;
	return s;
});
const bubbleTail = computed<'left' | 'right'>(() => (previewExpression.value?.bubbleTail === 'right' ? 'right' : 'left'));

function setBubbleScale(ev: Event) {
	const target = targetExpr();
	if (!target) return;
	const v = parseFloat((ev.target as HTMLInputElement).value);
	target.bubbleScale = Math.min(1.6, Math.max(0.6, v));
}
function setBubbleTail(tail: 'left' | 'right') {
	const target = targetExpr();
	if (target) target.bubbleTail = tail;
}

// ===== ？小吹き出し =====
const draggingQBubble = ref(false);
const qBubbleStyle = computed(() => {
	const e = previewExpression.value;
	const x = (e?.qBubbleX ?? 0.7);
	const y = (e?.qBubbleY ?? 0.05);
	const scale = (typeof e?.qBubbleScale === 'number' ? e.qBubbleScale : 1);
	const s: Record<string, string> = { left: (x * 100) + '%', top: (y * 100) + '%', fontSize: (0.85 * scale) + 'rem' };
	if (e?.qTextColor) s.color = e.qTextColor;
	return s;
});
const qTail = computed<'left' | 'right'>(() => (previewExpression.value?.qBubbleTail === 'right' ? 'right' : 'left'));
function setQBubbleScale(ev: Event) {
	const target = targetExpr();
	if (!target) return;
	const v = parseFloat((ev.target as HTMLInputElement).value);
	target.qBubbleScale = Math.min(1.6, Math.max(0.6, v));
}
function setQBubbleTail(tail: 'left' | 'right') {
	const target = targetExpr();
	if (target) target.qBubbleTail = tail;
}
function toggleQuestion() {
	const target = targetExpr();
	if (target) target.questionEnabled = !target.questionEnabled;
}
function onQBubblePointerDown(ev: PointerEvent) {
	const e = previewExpression.value;
	const wrap = stageWrapEl.value;
	if (!e || !wrap) return;
	ev.preventDefault();
	draggingQBubble.value = true;
	(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
	const move = (mv: PointerEvent) => {
		const rect = wrap.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		const x = Math.min(1, Math.max(0, (mv.clientX - rect.left) / rect.width));
		const y = Math.min(1, Math.max(0, (mv.clientY - rect.top) / rect.height));
		const target = targetExpr();
		if (target) { target.qBubbleX = Math.round(x * 1000) / 1000; target.qBubbleY = Math.round(y * 1000) / 1000; }
	};
	const up = () => {
		draggingQBubble.value = false;
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', up);
	};
	window.addEventListener('pointermove', move);
	window.addEventListener('pointerup', up);
}

// ===== ！小吹き出し(通知用) =====
const draggingEBubble = ref(false);
const eBubbleStyle = computed(() => {
	const e = previewExpression.value as any;
	const x = (typeof e?.eBubbleX === 'number' ? e.eBubbleX : 0.7);
	const y = (typeof e?.eBubbleY === 'number' ? e.eBubbleY : 0.05);
	const scale = (typeof e?.eBubbleScale === 'number' ? e.eBubbleScale : 1);
	const s: Record<string, string> = { left: (x * 100) + '%', top: (y * 100) + '%', fontSize: (0.85 * scale) + 'rem' };
	if (e?.eTextColor) s.color = e.eTextColor;
	return s;
});
const eTail = computed<'left' | 'right'>(() => ((previewExpression.value as any)?.eBubbleTail === 'right' ? 'right' : 'left'));
function onEBubblePointerDown(ev: PointerEvent) {
	const wrap = stageWrapEl.value;
	if (!wrap) return;
	ev.preventDefault();
	draggingEBubble.value = true;
	(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
	const move = (mv: PointerEvent) => {
		const rect = wrap.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		const x = Math.min(1, Math.max(0, (mv.clientX - rect.left) / rect.width));
		const y = Math.min(1, Math.max(0, (mv.clientY - rect.top) / rect.height));
		const target = targetExpr();
		if (target) { target.eBubbleX = Math.round(x * 1000) / 1000; target.eBubbleY = Math.round(y * 1000) / 1000; }
	};
	const up = () => {
		draggingEBubble.value = false;
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', up);
	};
	window.addEventListener('pointermove', move);
	window.addEventListener('pointerup', up);
}

function onBubblePointerDown(ev: PointerEvent) {
	const e = previewExpression.value;
	const wrap = stageWrapEl.value;
	if (!e || !wrap) return;
	ev.preventDefault();
	draggingBubble.value = true;
	(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);

	const move = (mv: PointerEvent) => {
		const rect = wrap.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		const x = Math.min(1, Math.max(0, (mv.clientX - rect.left) / rect.width));
		const y = Math.min(1, Math.max(0, (mv.clientY - rect.top) / rect.height));
		// 現在表情に書き込む(キャラ配列内の実体を更新)
		const target = targetExpr();
		if (target) { target.bubbleX = Math.round(x * 1000) / 1000; target.bubbleY = Math.round(y * 1000) / 1000; }
	};
	const up = () => {
		draggingBubble.value = false;
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', up);
	};
	window.addEventListener('pointermove', move);
	window.addEventListener('pointerup', up);
}

// キャラ切替や文言削除で範囲外になったらプレビューをリセット
watch([activeCharIdx, () => activeChar.value?.phrases.length], () => {
	const len = activeChar.value?.phrases.length ?? 0;
	if (previewPhraseIdx.value >= len) previewPhraseIdx.value = Math.max(0, len - 1);
});

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

onMounted(async () => {
	await loadDisplaySettings();
	try {
		const res = await misskeyApi('hata/mascot/get', {});
		consented.value = res.consented === true;
		limits.value = {
			maxCharacters: res.limits?.maxCharacters ?? 3,
			maxExpressions: res.limits?.maxExpressions ?? 5,
			maxPhrases: res.limits?.maxPhrases ?? 10,
		};
		const data = res.data ?? {};
		characters.value = Array.isArray(data.characters) ? data.characters.map((c:any) => ({
			id: c.id ?? genId(),
			name: c.name ?? '',
			expressions: Array.isArray(c.expressions) ? c.expressions.map((e:any) => ({ id: e.id ?? genId(), label: e.label ?? '', url: e.url ?? '', driveFileId: e.driveFileId ?? null, bubbleX: typeof e.bubbleX === 'number' ? e.bubbleX : 0.5, bubbleY: typeof e.bubbleY === 'number' ? e.bubbleY : 0.1, bubbleScale: typeof e.bubbleScale === 'number' ? e.bubbleScale : 1, bubbleTail: e.bubbleTail === 'right' ? 'right' : 'left', motion: e.motion ?? 'none', motionIntensity: typeof e.motionIntensity === 'number' ? e.motionIntensity : 1, questionEnabled: e.questionEnabled === true, qBubbleX: typeof e.qBubbleX === 'number' ? e.qBubbleX : 0.7, qBubbleY: typeof e.qBubbleY === 'number' ? e.qBubbleY : 0.05, qBubbleScale: typeof e.qBubbleScale === 'number' ? e.qBubbleScale : 1, qBubbleTail: e.qBubbleTail === 'right' ? 'right' : 'left', textColor: e.textColor ?? null, qTextColor: e.qTextColor ?? null })) : [],
			phrases: Array.isArray(c.phrases) ? c.phrases.map((p:any) => ({ id: p.id ?? genId(), text: p.text ?? '', expressionId: p.expressionId ?? null })) : [],
			notifyExpression: c.notifyExpression ? {
				url: c.notifyExpression.url ?? null,
				driveFileId: c.notifyExpression.driveFileId ?? null,
				label: c.notifyExpression.label ?? '',
				text: c.notifyExpression.text ?? '',
				motion: c.notifyExpression.motion ?? 'none',
				motionIntensity: typeof c.notifyExpression.motionIntensity === 'number' ? c.notifyExpression.motionIntensity : 1,
				bubbleX: typeof c.notifyExpression.bubbleX === 'number' ? c.notifyExpression.bubbleX : 0.5,
				bubbleY: typeof c.notifyExpression.bubbleY === 'number' ? c.notifyExpression.bubbleY : 0.1,
				bubbleScale: typeof c.notifyExpression.bubbleScale === 'number' ? c.notifyExpression.bubbleScale : 1,
				bubbleTail: c.notifyExpression.bubbleTail === 'right' ? 'right' : 'left',
				exclaimEnabled: c.notifyExpression.exclaimEnabled === true,
				eBubbleX: typeof c.notifyExpression.eBubbleX === 'number' ? c.notifyExpression.eBubbleX : 0.7,
				eBubbleY: typeof c.notifyExpression.eBubbleY === 'number' ? c.notifyExpression.eBubbleY : 0.05,
				eBubbleScale: typeof c.notifyExpression.eBubbleScale === 'number' ? c.notifyExpression.eBubbleScale : 1,
				eBubbleTail: c.notifyExpression.eBubbleTail === 'right' ? 'right' : 'left',
				textColor: c.notifyExpression.textColor ?? null,
				eTextColor: c.notifyExpression.eTextColor ?? null,
			} : null,
			notifyExpression2: c.notifyExpression2 ? {
				url: c.notifyExpression2.url ?? null,
				driveFileId: c.notifyExpression2.driveFileId ?? null,
				label: c.notifyExpression2.label ?? '',
				text: c.notifyExpression2.text ?? '',
				motion: c.notifyExpression2.motion ?? 'none',
				motionIntensity: typeof c.notifyExpression2.motionIntensity === 'number' ? c.notifyExpression2.motionIntensity : 1,
				bubbleX: typeof c.notifyExpression2.bubbleX === 'number' ? c.notifyExpression2.bubbleX : 0.5,
				bubbleY: typeof c.notifyExpression2.bubbleY === 'number' ? c.notifyExpression2.bubbleY : 0.1,
				bubbleScale: typeof c.notifyExpression2.bubbleScale === 'number' ? c.notifyExpression2.bubbleScale : 1,
				bubbleTail: c.notifyExpression2.bubbleTail === 'right' ? 'right' : 'left',
				exclaimEnabled: c.notifyExpression2.exclaimEnabled === true,
				eBubbleX: typeof c.notifyExpression2.eBubbleX === 'number' ? c.notifyExpression2.eBubbleX : 0.7,
				eBubbleY: typeof c.notifyExpression2.eBubbleY === 'number' ? c.notifyExpression2.eBubbleY : 0.05,
				eBubbleScale: typeof c.notifyExpression2.eBubbleScale === 'number' ? c.notifyExpression2.eBubbleScale : 1,
				eBubbleTail: c.notifyExpression2.eBubbleTail === 'right' ? 'right' : 'left',
				textColor: c.notifyExpression2.textColor ?? null,
				eTextColor: c.notifyExpression2.eTextColor ?? null,
			} : null,
			birthdayExpression: c.birthdayExpression ? {
				url: c.birthdayExpression.url ?? null,
				driveFileId: c.birthdayExpression.driveFileId ?? null,
				label: c.birthdayExpression.label ?? '',
				text: c.birthdayExpression.text ?? '',
				motion: c.birthdayExpression.motion ?? 'none',
				motionIntensity: typeof c.birthdayExpression.motionIntensity === 'number' ? c.birthdayExpression.motionIntensity : 1,
				bubbleX: typeof c.birthdayExpression.bubbleX === 'number' ? c.birthdayExpression.bubbleX : 0.5,
				bubbleY: typeof c.birthdayExpression.bubbleY === 'number' ? c.birthdayExpression.bubbleY : 0.1,
				bubbleScale: typeof c.birthdayExpression.bubbleScale === 'number' ? c.birthdayExpression.bubbleScale : 1,
				bubbleTail: c.birthdayExpression.bubbleTail === 'right' ? 'right' : 'left',
				textColor: c.birthdayExpression.textColor ?? null,
			} : null,
			charBirthdayEnabled: c.charBirthdayEnabled === true,
			charBirthdayMonth: typeof c.charBirthdayMonth === 'number' ? c.charBirthdayMonth : null,
			charBirthdayDay: typeof c.charBirthdayDay === 'number' ? c.charBirthdayDay : null,
			charBirthdayExpression: c.charBirthdayExpression ? {
				url: c.charBirthdayExpression.url ?? null,
				driveFileId: c.charBirthdayExpression.driveFileId ?? null,
				label: c.charBirthdayExpression.label ?? '',
				text: c.charBirthdayExpression.text ?? '',
				motion: c.charBirthdayExpression.motion ?? 'none',
				motionIntensity: typeof c.charBirthdayExpression.motionIntensity === 'number' ? c.charBirthdayExpression.motionIntensity : 1,
				bubbleX: typeof c.charBirthdayExpression.bubbleX === 'number' ? c.charBirthdayExpression.bubbleX : 0.5,
				bubbleY: typeof c.charBirthdayExpression.bubbleY === 'number' ? c.charBirthdayExpression.bubbleY : 0.1,
				bubbleScale: typeof c.charBirthdayExpression.bubbleScale === 'number' ? c.charBirthdayExpression.bubbleScale : 1,
				bubbleTail: c.charBirthdayExpression.bubbleTail === 'right' ? 'right' : 'left',
				textColor: c.charBirthdayExpression.textColor ?? null,
			} : null,
		})) : [];
		showName.value = data.showName === true;
		const ai = characters.value.findIndex(c => c.id === data.activeCharacterId);
		activeCharIdx.value = ai >= 0 ? ai : 0;
	} catch (err) {
		os.alert({ type: 'error', text: copy.fetchFailed });
	} finally {
		loading.value = false;
	}
});

async function agree() {
	try {
		await misskeyApi('hata/consent/update', { type: 'mascot', agree: true });
		consented.value = true;
		if (characters.value.length === 0) addCharacter();
	} catch {
		os.alert({ type: 'error', text: copy.consentRecordFailed });
	}
}

function selectChar(ci:number) { activeCharIdx.value = ci; previewPhraseIdx.value = 0; }

function addCharacter() {
	if (characters.value.length >= limits.value.maxCharacters) return;
	characters.value.push({ id: genId(), name: '', expressions: [], phrases: [], notifyExpression: null, notifyExpression2: null, birthdayExpression: null, charBirthdayEnabled: false, charBirthdayMonth: null, charBirthdayDay: null, charBirthdayExpression: null });
	activeCharIdx.value = characters.value.length - 1;
	previewPhraseIdx.value = 0;
}
async function removeCharacter(idx:number) {
	const { canceled } = await os.confirm({ type: 'warning', text: copy.confirmDeleteCharacter });
	if (canceled) return;
	characters.value.splice(idx, 1);
	if (activeCharIdx.value >= characters.value.length) activeCharIdx.value = Math.max(0, characters.value.length - 1);
}
function onName(ev:Event) { if (activeChar.value) activeChar.value.name = (ev.target as HTMLInputElement).value; }

async function addExpression() {
	const c = activeChar.value;
	if (!c || c.expressions.length >= limits.value.maxExpressions) return;
	const files = await chooseDriveFile({ multiple: false }).catch(() => []);
	if (files.length === 0) return;
	const f = files[0];
	if (!f.type || !f.type.startsWith('image/')) {
		os.alert({ type: 'warning', text: copy.chooseImageFile });
		return;
	}
	// フロントでも事前にサイズを弾く(サーバーでも検証される)
	if (typeof f.size === 'number' && f.size > 500 * 1024) {
		os.alert({ type: 'warning', text: copy.imageTooLarge500kb });
		return;
	}
	c.expressions.push({ id: genId(), label: '', url: f.url, driveFileId: f.id, bubbleX: 0.5, bubbleY: 0.1, bubbleScale: 1, bubbleTail: 'left', motion: 'none', motionIntensity: 1, questionEnabled: false, qBubbleX: 0.7, qBubbleY: 0.05, qBubbleScale: 1, qBubbleTail: 'left', textColor: null, qTextColor: null });
}
function onExpLabel(ei:number, ev:Event) { const c = activeChar.value; if (c) c.expressions[ei].label = (ev.target as HTMLInputElement).value; }
// 文字色(表情ごと)。空/未指定はテーマ既定色。
function setExpTextColor(ei:number, ev:Event) { const c = activeChar.value; if (c) c.expressions[ei].textColor = (ev.target as HTMLInputElement).value; }
function setExpQTextColor(ei:number, ev:Event) { const c = activeChar.value; if (c) c.expressions[ei].qTextColor = (ev.target as HTMLInputElement).value; }
function clearExpTextColor(ei:number) { const c = activeChar.value; if (c) c.expressions[ei].textColor = null; }
function clearExpQTextColor(ei:number) { const c = activeChar.value; if (c) c.expressions[ei].qTextColor = null; }
function setNotifyTextColor(ev:Event) { const c = activeChar.value; if (c && c.notifyExpression) c.notifyExpression.textColor = (ev.target as HTMLInputElement).value; }
function setNotifyETextColor(ev:Event) { const c = activeChar.value; if (c && c.notifyExpression) c.notifyExpression.eTextColor = (ev.target as HTMLInputElement).value; }
function clearNotifyTextColor() { const c = activeChar.value; if (c && c.notifyExpression) c.notifyExpression.textColor = null; }
function clearNotifyETextColor() { const c = activeChar.value; if (c && c.notifyExpression) c.notifyExpression.eTextColor = null; }
function setBirthdayTextColor(ev:Event) { const c = activeChar.value; if (c && c.birthdayExpression) c.birthdayExpression.textColor = (ev.target as HTMLInputElement).value; }
function clearBirthdayTextColor() { const c = activeChar.value; if (c && c.birthdayExpression) c.birthdayExpression.textColor = null; }
function onExpMotion(ei:number, ev:Event) { const c = activeChar.value; if (c) c.expressions[ei].motion = (ev.target as HTMLSelectElement).value as any; }
function onExpIntensity(ei:number, ev:Event) { const c = activeChar.value; if (c) c.expressions[ei].motionIntensity = Math.min(2, Math.max(0.3, parseFloat((ev.target as HTMLInputElement).value))); }
function removeExpression(ei:number) {
	const c = activeChar.value; if (!c) return;
	const removed = c.expressions[ei];
	c.expressions.splice(ei, 1);
	c.phrases.forEach(p => { if (p.expressionId === removed.id) p.expressionId = null; });
}

function addPhrase() { const c = activeChar.value; if (!c || c.phrases.length >= limits.value.maxPhrases) return; c.phrases.push({ id: genId(), text: '', expressionId: null }); }
function onPhraseText(pi:number, ev:Event) { const c = activeChar.value; if (c) c.phrases[pi].text = (ev.target as HTMLInputElement).value; }
function setPhraseExp(pi:number, expId:string|null) { const c = activeChar.value; if (c) c.phrases[pi].expressionId = expId; }
function removePhrase(pi:number) { const c = activeChar.value; if (c) c.phrases.splice(pi, 1); }

// ===== 通知用の専用表情 =====
const notifyPreviewMode = ref(false);
const notify2PreviewMode = ref(false);
const birthdayPreviewMode = ref(false);
const charBirthdayPreviewMode = ref(false);
async function chooseNotifyImage() {
	const c = activeChar.value;
	if (!c) return;
	const files = await chooseDriveFile({ multiple: false }).catch(() => []);
	if (files.length === 0) return;
	const f = files[0];
	if (!f.type || !f.type.startsWith('image/')) { os.alert({ type: 'warning', text: copy.chooseImageFile }); return; }
	if (typeof f.size === 'number' && f.size > 500 * 1024) { os.alert({ type: 'warning', text: copy.imageTooLarge500kb }); return; }
	c.notifyExpression = {
		url: f.url, driveFileId: f.id, label: '', text: '',
		motion: 'none', motionIntensity: 1,
		bubbleX: 0.5, bubbleY: 0.1, bubbleScale: 1, bubbleTail: 'left',
		exclaimEnabled: false, eBubbleX: 0.7, eBubbleY: 0.05, eBubbleScale: 1, eBubbleTail: 'left',
		textColor: null, eTextColor: null,
	};
	notifyPreviewMode.value = true;
}
function clearNotify() { const c = activeChar.value; if (c) { c.notifyExpression = null; notifyPreviewMode.value = false; } }
function onNotifyField(key: string, ev: Event) {
	const c = activeChar.value;
	if (!c || !c.notifyExpression) return;
	const t = ev.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
	if (key === 'motionIntensity') { (c.notifyExpression as any)[key] = Math.min(2, Math.max(0.3, parseFloat(t.value))); }
	else { (c.notifyExpression as any)[key] = t.value; }
}
function toggleNotifyExclaim() { const c = activeChar.value; if (c && c.notifyExpression) c.notifyExpression.exclaimEnabled = !c.notifyExpression.exclaimEnabled; }
function setNotifyEScale(ev: Event) { const c = activeChar.value; if (c && c.notifyExpression) c.notifyExpression.eBubbleScale = Math.min(1.6, Math.max(0.6, parseFloat((ev.target as HTMLInputElement).value))); }
function setNotifyETail(tail: 'left' | 'right') { const c = activeChar.value; if (c && c.notifyExpression) c.notifyExpression.eBubbleTail = tail; }
// ===== 通知用表情(2つ目) =====
async function chooseNotifyImage2() {
	const c = activeChar.value;
	if (!c) return;
	const files = await chooseDriveFile({ multiple: false }).catch(() => []);
	if (files.length === 0) return;
	const f = files[0];
	if (!f.type || !f.type.startsWith('image/')) { os.alert({ type: 'warning', text: copy.chooseImageFile }); return; }
	if (typeof f.size === 'number' && f.size > 500 * 1024) { os.alert({ type: 'warning', text: copy.imageTooLarge500kb }); return; }
	c.notifyExpression2 = {
		url: f.url, driveFileId: f.id, label: '', text: '',
		motion: 'none', motionIntensity: 1,
		bubbleX: 0.5, bubbleY: 0.1, bubbleScale: 1, bubbleTail: 'left',
		exclaimEnabled: false, eBubbleX: 0.7, eBubbleY: 0.05, eBubbleScale: 1, eBubbleTail: 'left',
		textColor: null, eTextColor: null,
	};
	notify2PreviewMode.value = true;
	notifyPreviewMode.value = false; birthdayPreviewMode.value = false; charBirthdayPreviewMode.value = false;
}
function clearNotify2() { const c = activeChar.value; if (c) { c.notifyExpression2 = null; notify2PreviewMode.value = false; } }
function onNotify2Field(key: string, ev: Event) {
	const c = activeChar.value;
	if (!c || !c.notifyExpression2) return;
	const t = ev.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
	if (key === 'motionIntensity') { (c.notifyExpression2 as any)[key] = Math.min(2, Math.max(0.3, parseFloat(t.value))); }
	else { (c.notifyExpression2 as any)[key] = t.value; }
}
function setNotify2TextColor(ev:Event) { const c = activeChar.value; if (c && c.notifyExpression2) c.notifyExpression2.textColor = (ev.target as HTMLInputElement).value; }
function setNotify2ETextColor(ev:Event) { const c = activeChar.value; if (c && c.notifyExpression2) c.notifyExpression2.eTextColor = (ev.target as HTMLInputElement).value; }
function clearNotify2TextColor() { const c = activeChar.value; if (c && c.notifyExpression2) c.notifyExpression2.textColor = null; }
function clearNotify2ETextColor() { const c = activeChar.value; if (c && c.notifyExpression2) c.notifyExpression2.eTextColor = null; }
function toggleNotify2Exclaim() { const c = activeChar.value; if (c && c.notifyExpression2) c.notifyExpression2.exclaimEnabled = !c.notifyExpression2.exclaimEnabled; }
function setNotify2EScale(ev: Event) { const c = activeChar.value; if (c && c.notifyExpression2) c.notifyExpression2.eBubbleScale = Math.min(1.6, Math.max(0.6, parseFloat((ev.target as HTMLInputElement).value))); }
function setNotify2ETail(tail: 'left' | 'right') { const c = activeChar.value; if (c && c.notifyExpression2) c.notifyExpression2.eBubbleTail = tail; }
function selectNotify2Preview() { notifyPreviewMode.value = false; birthdayPreviewMode.value = false; charBirthdayPreviewMode.value = false; notify2PreviewMode.value = true; }
function selectNotifyPreview() { notify2PreviewMode.value = false; birthdayPreviewMode.value = false; charBirthdayPreviewMode.value = false; notifyPreviewMode.value = true; }
function selectPreviewPhrase(pi: number) { notifyPreviewMode.value = false; notify2PreviewMode.value = false; birthdayPreviewMode.value = false; charBirthdayPreviewMode.value = false; previewPhraseIdx.value = pi; }

// ===== 誕生日用の専用表情(！なし) =====
async function chooseBirthdayImage() {
	const c = activeChar.value;
	if (!c) return;
	const files = await chooseDriveFile({ multiple: false }).catch(() => []);
	if (files.length === 0) return;
	const f = files[0];
	if (!f.type || !f.type.startsWith('image/')) { os.alert({ type: 'warning', text: copy.chooseImageFile }); return; }
	if (typeof f.size === 'number' && f.size > 500 * 1024) { os.alert({ type: 'warning', text: copy.imageTooLarge500kb }); return; }
	c.birthdayExpression = {
		url: f.url, driveFileId: f.id, label: '', text: '',
		motion: 'none', motionIntensity: 1,
		bubbleX: 0.5, bubbleY: 0.1, bubbleScale: 1, bubbleTail: 'left',
		textColor: null,
	};
	notifyPreviewMode.value = false;
	birthdayPreviewMode.value = true;
}
function clearBirthday() { const c = activeChar.value; if (c) { c.birthdayExpression = null; birthdayPreviewMode.value = false; } }
function onBirthdayField(key: string, ev: Event) {
	const c = activeChar.value;
	if (!c || !c.birthdayExpression) return;
	const t = ev.target as HTMLInputElement | HTMLSelectElement;
	if (key === 'motionIntensity') { (c.birthdayExpression as any)[key] = Math.min(2, Math.max(0.3, parseFloat(t.value))); }
	else { (c.birthdayExpression as any)[key] = t.value; }
}
function selectBirthdayPreview() { notifyPreviewMode.value = false; notify2PreviewMode.value = false; charBirthdayPreviewMode.value = false; birthdayPreviewMode.value = true; }

// ===== キャラ自身の誕生日 =====
function toggleCharBirthday() { const c = activeChar.value; if (c) c.charBirthdayEnabled = !c.charBirthdayEnabled; }
function setCharBirthdayMonth(ev: Event) { const c = activeChar.value; if (!c) return; const v = parseInt((ev.target as HTMLInputElement).value, 10); c.charBirthdayMonth = (Number.isFinite(v) && v >= 1 && v <= 12) ? v : null; }
function setCharBirthdayDay(ev: Event) { const c = activeChar.value; if (!c) return; const v = parseInt((ev.target as HTMLInputElement).value, 10); c.charBirthdayDay = (Number.isFinite(v) && v >= 1 && v <= 31) ? v : null; }
async function chooseCharBirthdayImage() {
	const c = activeChar.value;
	if (!c) return;
	const files = await chooseDriveFile({ multiple: false }).catch(() => []);
	if (files.length === 0) return;
	const f = files[0];
	if (!f.type || !f.type.startsWith('image/')) { os.alert({ type: 'warning', text: copy.chooseImageFile }); return; }
	if (typeof f.size === 'number' && f.size > 500 * 1024) { os.alert({ type: 'warning', text: copy.imageTooLarge500kb }); return; }
	c.charBirthdayExpression = {
		url: f.url, driveFileId: f.id, label: '', text: '',
		motion: 'none', motionIntensity: 1,
		bubbleX: 0.5, bubbleY: 0.1, bubbleScale: 1, bubbleTail: 'left',
		textColor: null,
	};
	notifyPreviewMode.value = false;
	birthdayPreviewMode.value = false;
	charBirthdayPreviewMode.value = true;
}
function clearCharBirthday() { const c = activeChar.value; if (c) { c.charBirthdayExpression = null; charBirthdayPreviewMode.value = false; } }
function onCharBirthdayField(key: string, ev: Event) {
	const c = activeChar.value;
	if (!c || !c.charBirthdayExpression) return;
	const t = ev.target as HTMLInputElement | HTMLSelectElement;
	if (key === 'motionIntensity') { (c.charBirthdayExpression as any)[key] = Math.min(2, Math.max(0.3, parseFloat(t.value))); }
	else { (c.charBirthdayExpression as any)[key] = t.value; }
}
function setCharBirthdayTextColor(ev:Event) { const c = activeChar.value; if (c && c.charBirthdayExpression) c.charBirthdayExpression.textColor = (ev.target as HTMLInputElement).value; }
function clearCharBirthdayTextColor() { const c = activeChar.value; if (c && c.charBirthdayExpression) c.charBirthdayExpression.textColor = null; }
function selectCharBirthdayPreview() { notifyPreviewMode.value = false; notify2PreviewMode.value = false; birthdayPreviewMode.value = false; charBirthdayPreviewMode.value = true; }

function toggleDisplay(key: keyof MascotDisplaySettings) {
	const next = { ...displaySettings.value, [key]: !displaySettings.value[key] };
	saveDisplaySettings(next);
}
function setNotifyDuration(ev: Event) {
	const v = parseInt((ev.target as HTMLInputElement).value, 10);
	const sec = Number.isFinite(v) ? Math.min(60, Math.max(1, v)) : 3;
	saveDisplaySettings({ ...displaySettings.value, notifyDurationSec: sec });
}
function clampIdle(v: number, fallback: number): number {
	return Number.isFinite(v) ? Math.min(1800, Math.max(5, Math.round(v))) : fallback;
}
function setIdlePreset(min: number, max: number) {
	saveDisplaySettings({ ...displaySettings.value, idleMinSec: min, idleMaxSec: max });
}
function isIdlePreset(min: number, max: number): boolean {
	return displaySettings.value.idleMinSec === min && displaySettings.value.idleMaxSec === max;
}
function setIdleMin(ev: Event) {
	const v = clampIdle(parseInt((ev.target as HTMLInputElement).value, 10), 5);
	saveDisplaySettings({ ...displaySettings.value, idleMinSec: v });
}
function setIdleMax(ev: Event) {
	const v = clampIdle(parseInt((ev.target as HTMLInputElement).value, 10), 12);
	saveDisplaySettings({ ...displaySettings.value, idleMaxSec: v });
}
function setBackdropOpacity(ev: Event) {
	const v = parseFloat((ev.target as HTMLInputElement).value);
	const o = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.25;
	saveDisplaySettings({ ...displaySettings.value, floatingBackdropOpacity: o });
}
function setBackdropColor(ev: Event) {
	const v = (ev.target as HTMLInputElement).value;
	const color = /^#[0-9a-f]{6}$/i.test(v) ? v : '#000000';
	saveDisplaySettings({ ...displaySettings.value, floatingBackdropColor: color });
}

// 旗鯖fork: 保存前バリデーション。マスコットを動かす上で支障が出る設定ミスを検出する。
// エラーが1件でもあれば保存ボタンをグレアウトし、理由を画面に表示する。
function hasImage(x: { url?: string | null; driveFileId?: string | null } | null | undefined): boolean {
	return !!(x && ((typeof x.url === 'string' && x.url !== '') || (typeof x.driveFileId === 'string' && x.driveFileId !== '')));
}
const validationErrors = computed<string[]>(() => {
	const errors: string[] = [];
	// 旗鯖fork: 読み込み中は characters.value が空配列のため for ループが回らず errors=[] となり
	// canSave=true で保存ボタンが押せてしまう (= 空データを backend に送って保存失敗 or 空保存) という
	// race condition を防ぐ。読み込み完了するまで保存ボタンを無効化する。
	if (loading.value) {
		errors.push(copy.loadingValidation);
		return errors;
	}
	// 旗鯖fork: キャラクターが 0 体だと立ち絵の検証ループが回らず canSave=true になり
	// 「マスコット未設定で保存できる→フローティング ON だけが立って通知が消える」原因に。
	// 最低 1 体のキャラクターを要求する。
	if (characters.value.length === 0) {
		errors.push(copy.addCharacterRequired);
		return errors;
	}
	for (const c of characters.value) {
		const who = c.name && c.name !== '' ? copyx.quotedName({ name: c.name }) : copy.unnamedCharacter;
		// 表情が1つも無い
		if (c.expressions.length === 0) {
			errors.push(copyx.characterNoExpression({ character: who }));
		}
		// 各表情に画像実体が無い
		for (const e of c.expressions) {
			if (!hasImage(e)) {
				const label = e.label && e.label !== '' ? copyx.quotedName({ name: e.label }) : copy.untitled;
				errors.push(copyx.expressionMissingImage({ character: who, expression: label }));
			}
		}
		// 通知用表情: 設定枠があるのに画像が無い
		if (c.notifyExpression != null && !hasImage(c.notifyExpression)) {
			errors.push(copyx.notificationImageMissing({ character: who }));
		}
		if (c.notifyExpression2 != null && !hasImage(c.notifyExpression2)) {
			errors.push(copyx.notificationSecondImageMissing({ character: who }));
		}
		// 誕生日表示
		if (c.birthdayExpression != null && !hasImage(c.birthdayExpression)) {
			errors.push(copyx.birthdayImageMissing({ character: who }));
		}
		// キャラ誕生日: 有効なのに月日が未入力
		if (c.charBirthdayEnabled) {
			if (c.charBirthdayMonth == null || c.charBirthdayDay == null) {
				errors.push(copyx.characterBirthdayDateMissing({ character: who }));
			}
			if (c.charBirthdayExpression != null && !hasImage(c.charBirthdayExpression)) {
				errors.push(copyx.characterBirthdayImageMissing({ character: who }));
			}
		}
	}
	return errors;
});
const canSave = computed<boolean>(() => validationErrors.value.length === 0);

async function save() {
	// 旗鯖fork: 保険。UI上はボタンをグレアウトしているが、万一すり抜けても設定ミスは保存させない。
	if (!canSave.value) {
		os.alert({ type: 'error', text: validationErrors.value[0] ?? copy.invalidSettings });
		return;
	}
	saving.value = true;
	try {
		await misskeyApi('hata/mascot/update', {
			characters: characters.value.map(c => ({
				id: c.id,
				name: c.name,
				expressions: c.expressions.map(e => ({ id: e.id, label: e.label, url: e.url, driveFileId: e.driveFileId, bubbleX: e.bubbleX, bubbleY: e.bubbleY, bubbleScale: e.bubbleScale, bubbleTail: e.bubbleTail, motion: e.motion, motionIntensity: e.motionIntensity, questionEnabled: e.questionEnabled, qBubbleX: e.qBubbleX, qBubbleY: e.qBubbleY, qBubbleScale: e.qBubbleScale, qBubbleTail: e.qBubbleTail, textColor: e.textColor ?? null, qTextColor: e.qTextColor ?? null })),
				phrases: c.phrases.map(p => ({ id: p.id, text: p.text, expressionId: p.expressionId })),
				notifyExpression: c.notifyExpression && (c.notifyExpression.url || c.notifyExpression.driveFileId) ? c.notifyExpression : null,
				notifyExpression2: c.notifyExpression2 && (c.notifyExpression2.url || c.notifyExpression2.driveFileId) ? c.notifyExpression2 : null,
				birthdayExpression: c.birthdayExpression && (c.birthdayExpression.url || c.birthdayExpression.driveFileId) ? c.birthdayExpression : null,
				charBirthdayEnabled: c.charBirthdayEnabled,
				charBirthdayMonth: c.charBirthdayMonth,
				charBirthdayDay: c.charBirthdayDay,
				charBirthdayExpression: c.charBirthdayExpression && (c.charBirthdayExpression.url || c.charBirthdayExpression.driveFileId) ? c.charBirthdayExpression : null,
			})),
			activeCharacterId: activeChar.value?.id ?? null,
			showName: showName.value,
		});
		await loadMascot(true);
		os.toast(copy.saved);
	} catch (err:any) {
		const code = err?.code ?? err?.id;
		os.alert({ type: 'error', text: code ? copyx.saveFailedWithCode({ code }) : copy.saveFailed });
	} finally {
		saving.value = false;
	}
}

// ===== .hmtk インポート/エクスポート =====
// 1キャラ単位で書き出し/読み込みする。Driveは経由せずローカルのDL/ファイル選択で完結するため
// CORS は一切発生しない。画像はDriveのURL文字列のみ記録する(同一サーバー前提)。
const HMTK_FORMAT = 'hmtk';
const HMTK_VERSION = 1;
type HmtkFile = {
	format: typeof HMTK_FORMAT;
	version: number;
	exportedAt: number;
	character: Character;
	floating: {
		floatingX: number; floatingY: number;
		floatingBackdropOpacity: number; floatingBackdropColor: string;
		floatingEnabledDesktop: boolean; floatingEnabledMobile: boolean;
		idleMinSec: number; idleMaxSec: number;
	};
	showName: boolean;
};

// 色文字列を #rgb / #rrggbb のみ許容(それ以外は null)。サーバーの sanitizeColor と整合させる。
function sanitizeColorOrNull(v: unknown): string | null {
	if (typeof v !== 'string') return null;
	return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : null;
}
// インポートされた画像URLを検証する。表示時に <img src> として使われるため、
// javascript:/data:/vbscript:/file: などの危険スキームや、文字列でない値を弾く。
// 許可するのは http(s) の絶対URL と、ドライブが返す '/' 始まりの相対パスのみ。
// 不正・空の場合は '' を返す(画像なし扱い。インポートが失敗するのではなく、その画像だけ無効化される)。
function sanitizeImageUrl(v: unknown): string {
	if (typeof v !== 'string') return '';
	const s = v.trim();
	if (s === '' || s.length > 2048) return '';
	// 相対パス(ドライブの /files/... 等)は許可
	if (s.startsWith('/') && !s.startsWith('//')) return s;
	try {
		const u = new URL(s);
		return (u.protocol === 'http:' || u.protocol === 'https:') ? s : '';
	} catch {
		// 絶対URLとしてパースできない(スキーム無しの裸文字列など)は弾く
		return '';
	}
}
// driveFileId は表示時に url のフォールバックキーになるだけだが、無制限の文字列を保持する必要はない。
// 文字列でなければ null、長すぎるものも null に矯正する。
function sanitizeDriveFileId(v: unknown): string | null {
	if (typeof v !== 'string') return null;
	const s = v.trim();
	return (s !== '' && s.length <= 256) ? s : null;
}
function clampNum(v: unknown, min: number, max: number, fallback: number): number {
	const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
	return Math.min(max, Math.max(min, n));
}
function asMotion(v: unknown): 'none' | 'bounce' | 'shake' | 'sway' | 'spin' {
	return (v === 'bounce' || v === 'shake' || v === 'sway' || v === 'spin') ? v : 'none';
}
function asTail(v: unknown): 'left' | 'right' {
	return v === 'right' ? 'right' : 'left';
}

// インポートしたキャラを内部の Character 型に正規化する(未知フィールド除去・型矯正・id振り直し)。
// keepExprKeys/keepPhraseKeys が渡されたら、その元index(文字列)に該当する表情/文言だけを採用する。
// 表情の id は振り直すが、文言→表情の紐付け(expressionId)は旧id→新idの対応表で復元する。
function normalizeImportedCharacter(raw: any, keepExprKeys?: string[], keepPhraseKeys?: string[]): Character {
	const rawExprs: any[] = Array.isArray(raw?.expressions) ? raw.expressions : [];
	const rawPhrases: any[] = Array.isArray(raw?.phrases) ? raw.phrases : [];

	// 採用する元indexの集合(未指定なら先頭から上限ぶん)。
	const exprKeep = keepExprKeys ?? rawExprs.slice(0, limits.value.maxExpressions).map((_, i) => String(i));
	const phraseKeep = keepPhraseKeys ?? rawPhrases.slice(0, limits.value.maxPhrases).map((_, i) => String(i));
	const exprKeepSet = new Set(exprKeep);
	const phraseKeepSet = new Set(phraseKeep);

	// 旧expressionId -> 新id の対応表(紐付け復元用)。採用された表情のみ登録する。
	const idMap = new Map<string, string>();
	const expressions: Expression[] = [];
	rawExprs.forEach((e: any, i: number) => {
		if (!exprKeepSet.has(String(i))) return;
		if (expressions.length >= limits.value.maxExpressions) return;
		const newId = genId();
		if (typeof e?.id === 'string') idMap.set(e.id, newId);
		expressions.push({
			id: newId, label: typeof e?.label === 'string' ? e.label : '', url: sanitizeImageUrl(e?.url), driveFileId: sanitizeDriveFileId(e?.driveFileId),
			bubbleX: clampNum(e?.bubbleX, 0, 1, 0.5), bubbleY: clampNum(e?.bubbleY, 0, 1, 0.1), bubbleScale: clampNum(e?.bubbleScale, 0.1, 5, 1), bubbleTail: asTail(e?.bubbleTail),
			motion: asMotion(e?.motion), motionIntensity: clampNum(e?.motionIntensity, 0, 5, 1),
			questionEnabled: e?.questionEnabled === true, qBubbleX: clampNum(e?.qBubbleX, 0, 1, 0.7), qBubbleY: clampNum(e?.qBubbleY, 0, 1, 0.05), qBubbleScale: clampNum(e?.qBubbleScale, 0.1, 5, 1), qBubbleTail: asTail(e?.qBubbleTail),
			textColor: sanitizeColorOrNull(e?.textColor), qTextColor: sanitizeColorOrNull(e?.qTextColor),
		});
	});

	// 文言は採用分だけ。expressionId は対応表で張り直す。対象表情が破棄された場合は null に落とす。
	const phrases: Phrase[] = [];
	rawPhrases.forEach((p: any, i: number) => {
		if (!phraseKeepSet.has(String(i))) return;
		if (phrases.length >= limits.value.maxPhrases) return;
		const mapped = typeof p?.expressionId === 'string' ? (idMap.get(p.expressionId) ?? null) : null;
		phrases.push({ id: genId(), text: typeof p?.text === 'string' ? p.text : '', expressionId: mapped });
	});

	const normNotify = (n: any): NotifyExpression | null => {
		if (!n) return null;
		const url = sanitizeImageUrl(n.url);
		const driveFileId = sanitizeDriveFileId(n.driveFileId);
		// サニタイズの結果、有効な画像参照が一つも残らなければ通知表情は保持しない(既存の意図を維持)
		if (url === '' && driveFileId === null) return null;
		return {
			url: url !== '' ? url : null, driveFileId,
			label: typeof n.label === 'string' ? n.label : '', text: typeof n.text === 'string' ? n.text : '',
			motion: asMotion(n.motion), motionIntensity: clampNum(n.motionIntensity, 0, 5, 1),
			bubbleX: clampNum(n.bubbleX, 0, 1, 0.5), bubbleY: clampNum(n.bubbleY, 0, 1, 0.1), bubbleScale: clampNum(n.bubbleScale, 0.1, 5, 1), bubbleTail: asTail(n.bubbleTail),
			exclaimEnabled: n.exclaimEnabled === true, eBubbleX: clampNum(n.eBubbleX, 0, 1, 0.7), eBubbleY: clampNum(n.eBubbleY, 0, 1, 0.05), eBubbleScale: clampNum(n.eBubbleScale, 0.1, 5, 1), eBubbleTail: asTail(n.eBubbleTail),
			textColor: sanitizeColorOrNull(n.textColor), eTextColor: sanitizeColorOrNull(n.eTextColor),
		};
	};
	const normBirthday = (b: any): BirthdayExpression | null => {
		if (!b) return null;
		const url = sanitizeImageUrl(b.url);
		const driveFileId = sanitizeDriveFileId(b.driveFileId);
		if (url === '' && driveFileId === null) return null;
		return {
			url: url !== '' ? url : null, driveFileId,
			label: typeof b.label === 'string' ? b.label : '', text: typeof b.text === 'string' ? b.text : '',
			motion: asMotion(b.motion), motionIntensity: clampNum(b.motionIntensity, 0, 5, 1),
			bubbleX: clampNum(b.bubbleX, 0, 1, 0.5), bubbleY: clampNum(b.bubbleY, 0, 1, 0.1), bubbleScale: clampNum(b.bubbleScale, 0.1, 5, 1), bubbleTail: asTail(b.bubbleTail),
			textColor: sanitizeColorOrNull(b.textColor),
		};
	};
	const bMonth = typeof raw?.charBirthdayMonth === 'number' ? Math.min(12, Math.max(1, Math.round(raw.charBirthdayMonth))) : null;
	const bDay = typeof raw?.charBirthdayDay === 'number' ? Math.min(31, Math.max(1, Math.round(raw.charBirthdayDay))) : null;
	return {
		id: genId(),
		name: typeof raw?.name === 'string' ? raw.name.slice(0, 50) : '',
		expressions, phrases,
		notifyExpression: normNotify(raw?.notifyExpression),
		notifyExpression2: normNotify(raw?.notifyExpression2),
		birthdayExpression: normBirthday(raw?.birthdayExpression),
		charBirthdayEnabled: raw?.charBirthdayEnabled === true,
		charBirthdayMonth: bMonth, charBirthdayDay: bDay,
		charBirthdayExpression: normBirthday(raw?.charBirthdayExpression),
	};
}

// 現在アクティブなキャラを .hmtk としてローカルにダウンロードする。
function exportActiveCharacter() {
	const c = activeChar.value;
	if (!c) { os.alert({ type: 'warning', text: copy.noCharacterToExport }); return; }
	const ds = displaySettings.value;
	const payload: HmtkFile = {
		format: HMTK_FORMAT,
		version: HMTK_VERSION,
		exportedAt: Date.now(),
		character: JSON.parse(JSON.stringify(c)),
		floating: {
			floatingX: ds.floatingX, floatingY: ds.floatingY,
			floatingBackdropOpacity: ds.floatingBackdropOpacity, floatingBackdropColor: ds.floatingBackdropColor,
			floatingEnabledDesktop: ds.floatingEnabledDesktop, floatingEnabledMobile: ds.floatingEnabledMobile,
			idleMinSec: ds.idleMinSec, idleMaxSec: ds.idleMaxSec,
		},
		showName: showName.value,
	};
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	const safeName = (c.name || 'mascot').replace(/[\\/:*?"<>|\s]/g, '_').slice(0, 40);
	a.href = url;
	a.download = `${safeName}.hmtk`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	os.toast(copy.exported);
}

// ローカルの .hmtk を選んでキャラとして新規追加し、floating/showName も復元する。
async function importCharacterFromFile() {
	if (characters.value.length >= limits.value.maxCharacters) {
		os.alert({ type: 'warning', text: copyx.characterLimitReached({ limit: limits.value.maxCharacters }) });
		return;
	}
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.hmtk,application/json';
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) return;
		if (file.size > 1024 * 1024) { os.alert({ type: 'error', text: copy.fileTooLarge1mb }); return; }
		try {
			const text = await file.text();
			const data = JSON.parse(text) as Partial<HmtkFile>;
			if (data?.format !== HMTK_FORMAT || !data?.character) {
				os.alert({ type: 'error', text: copy.invalidHmtk });
				return;
			}
			if (typeof data.version === 'number' && data.version > HMTK_VERSION) {
				const go = await os.confirm({ type: 'warning', text: copy.newerVersionConfirm });
				if (go.canceled) return;
			}

			// 読み込み先ロールの上限を超える場合は、残す表情/文言を選ばせる。
			const rawExprs: any[] = Array.isArray(data.character.expressions) ? data.character.expressions : [];
			const rawPhrases: any[] = Array.isArray(data.character.phrases) ? data.character.phrases : [];
			const exprOver = rawExprs.length > limits.value.maxExpressions;
			const phraseOver = rawPhrases.length > limits.value.maxPhrases;

			let keepExprKeys: string[] | undefined;
			let keepPhraseKeys: string[] | undefined;
			if (exprOver || phraseOver) {
				const result = await new Promise<{ canceled: true } | { canceled: false; expressionIds: string[]; phraseIds: string[] }>((resolve) => {
					os.popup(MkMascotImportSelectDialog, {
						expressions: rawExprs.map((e: any, i: number) => ({ key: String(i), label: typeof e?.label === 'string' ? e.label : '', url: typeof e?.url === 'string' ? e.url : '' })),
						phrases: rawPhrases.map((p: any, i: number) => ({ key: String(i), text: typeof p?.text === 'string' ? p.text : '' })),
						maxExpressions: limits.value.maxExpressions,
						maxPhrases: limits.value.maxPhrases,
					}, {
						done: (r: { canceled: true } | { canceled: false; expressionIds: string[]; phraseIds: string[] }) => resolve(r),
					});
				});
				if (result.canceled) return;
				keepExprKeys = result.expressionIds;
				keepPhraseKeys = result.phraseIds;
			}

			const imported = normalizeImportedCharacter(data.character, keepExprKeys, keepPhraseKeys);
			characters.value.push(imported);
			activeCharIdx.value = characters.value.length - 1;

			// floating / showName も復元する(端末共通設定なので保存する)
			if (data.floating) {
				const f = data.floating;
				const next: MascotDisplaySettings = {
					...displaySettings.value,
					floatingX: clampNum(f.floatingX, -100000, 100000, displaySettings.value.floatingX),
					floatingY: clampNum(f.floatingY, -100000, 100000, displaySettings.value.floatingY),
					floatingBackdropOpacity: clampNum(f.floatingBackdropOpacity, 0, 1, displaySettings.value.floatingBackdropOpacity),
					floatingBackdropColor: sanitizeColorOrNull(f.floatingBackdropColor) ?? displaySettings.value.floatingBackdropColor,
					floatingEnabledDesktop: typeof f.floatingEnabledDesktop === 'boolean' ? f.floatingEnabledDesktop : displaySettings.value.floatingEnabledDesktop,
					floatingEnabledMobile: typeof f.floatingEnabledMobile === 'boolean' ? f.floatingEnabledMobile : displaySettings.value.floatingEnabledMobile,
					idleMinSec: clampNum(f.idleMinSec, 5, 1800, displaySettings.value.idleMinSec),
					idleMaxSec: clampNum(f.idleMaxSec, 5, 1800, displaySettings.value.idleMaxSec),
				};
				await saveDisplaySettings(next);
			}
			if (typeof data.showName === 'boolean') showName.value = data.showName;

			os.toast(copy.importedReview);
		} catch {
			os.alert({ type: 'error', text: copy.importFailed });
		}
	};
	input.click();
}

/** 旗鯖fork: true なら窓の枠を持たず、設定画面の右ペインの中身として描く。 */
defineProps<{ embedded?: boolean }>();
</script>

<style lang="scss" module>
.root { display:flex; flex-direction:column; gap:14px; padding:18px 20px 22px; }
/* 旗鯖fork: ヘッダー内のタイトルと利用規約ボタンの配置。タイトル左・ボタン右。
   親(.title)が pointer-events:none のため、ボタン側で auto に戻す。 */
.headerInner { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding-right:16px; box-sizing:border-box; }
/* 旗鯖fork: 規約ボタンは MkButton 本体で形を作るため、ここでは配置の補正だけに留める。
   親(.title)が pointer-events:none のため、ボタン側で auto に戻す必要がある。 */
.termsBtn { pointer-events:auto; white-space:nowrap; }
.loading { padding:40px 0; text-align:center; opacity:.6; }
/* 旗鯖fork: 同意ウィンドウ / 利用不可の案内。中央揃え・中央寄せで表示する。 */
.consent { display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; padding:24px 20px; max-width:560px; margin:0 auto; }
.consentIcon { font-size:2.4rem; opacity:.85; }
.consentTitle { font-size:1.1rem; font-weight:700; }
.consentBody { text-align:left; font-size:.88rem; line-height:1.7; opacity:.9; }
.consentBody ul { margin:8px 0 0; padding-left:1.3em; }
.consentBtns { display:flex; justify-content:center; gap:12px; flex-wrap:wrap; margin-top:8px; }
.card { background: var(--MI_THEME-panel); border:1px solid var(--MI_THEME-divider); border-radius:14px; padding:14px 16px; }
.validationCard { background: var(--MI_THEME-infoWarnBg, rgba(226,86,109,.1)); border:1px solid var(--MI_THEME-error, #e2566d); border-radius:12px; padding:12px 16px; }
.validationHead { display:flex; align-items:center; gap:6px; font-weight:700; font-size:.9rem; color: var(--MI_THEME-error, #e2566d); margin-bottom:6px; }
.validationList { margin:0; padding-left:1.4em; font-size:.83rem; line-height:1.7; }
.cardHead { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.label { font-size:.95rem; font-weight:700; }
.count { font-size:.8rem; opacity:.6; font-variant-numeric:tabular-nums; }
.desc { font-size:.8rem; opacity:.65; line-height:1.6; margin-bottom:10px; }
.empty { font-size:.83rem; opacity:.55; text-align:center; padding:14px; border:1px dashed var(--MI_THEME-divider); border-radius:10px; margin-bottom:10px; }
.row { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:.9rem; padding:7px 0; }
.row + .row { border-top:1px solid var(--MI_THEME-divider); }
/* レスポンシブ: 狭い→縦1列 / 中→プレビュー+設定の2列 / 広い→プレビュー+基本+特殊の3列 */
.layout { display:flex; flex-direction:column; gap:14px; }
.colPreview { flex:none; }
.colSettings { display:flex; flex-direction:column; gap:14px; }
.colSpecial { display:flex; flex-direction:column; gap:14px; }
@media (min-width: 800px) {
	.layout { flex-direction:row; flex-wrap:wrap; align-items:flex-start; }
	.colPreview { position:sticky; top:8px; width:420px; flex:none; }
	.colSettings { flex:1 1 320px; min-width:300px; }
	.colSpecial { flex:1 1 100%; min-width:300px; }
}
@media (min-width: 1200px) {
	.layout { flex-wrap:nowrap; }
	.colPreview { width:420px; }
	.colSettings { flex:1 1 0; min-width:300px; }
	.colSpecial { flex:1 1 0; min-width:300px; }
}
.inp { width:100%; box-sizing:border-box; background: var(--MI_THEME-bg); color: var(--MI_THEME-fg); border:1px solid var(--MI_THEME-divider); border-radius:8px; padding:8px 12px; font-family:inherit; font-size:.9rem; }
.footer { display:flex; justify-content:flex-end; gap:8px; padding-top:4px; }

/* ===== プレビュー ===== */
.preview { display:flex; flex-direction:column; gap:14px; background:linear-gradient(135deg, var(--MI_THEME-panel), var(--MI_THEME-bg)); border:1px solid var(--MI_THEME-divider); border-radius:16px; padding:16px; }
.previewStageWrap { position:relative; width:100%; aspect-ratio:4/3; max-height:440px; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:12px; }
.previewStage { position:relative; width:200px; height:150px; flex:none; display:flex; align-items:center; justify-content:center; }
.previewImg { max-width:55%; max-height:80%; object-fit:contain; filter:drop-shadow(0 4px 12px rgba(0,0,0,.25)); user-select:none; -webkit-user-drag:none; }
.previewEmpty { width:100%; height:100%; display:flex; flex-direction:column; gap:8px; align-items:center; justify-content:center; border:1px dashed var(--MI_THEME-divider); border-radius:12px; opacity:.5; font-size:.75rem; text-align:center; i{ font-size:1.8rem; } }
.previewMeta { display:flex; flex-direction:column; gap:8px; }
.previewName { font-weight:700; font-size:.9rem; }
/* 吹き出し: 立ち絵の上に絶対配置。left/topはbubbleStyleで指定、transformで中心合わせ */
.previewBubble { position:absolute; transform:translate(-50%,-50%); width:max-content; max-width:200px; background: var(--MI_THEME-panel); color:var(--MI_THEME-fg); border:1px solid var(--MI_THEME-divider); border-radius:14px; padding:6px 10px; font-size:.85rem; line-height:1.4; text-align:center; white-space:pre-line; word-break:break-word; cursor:grab; box-shadow:0 2px 8px rgba(0,0,0,.25); touch-action:none; }
.previewBubble:active { cursor:grabbing; }
/* しっぽ(三角形)。左右で位置を切り替え。本体と同じ背景+枠線で繋げて見せる */
.previewBubble::after { content:''; position:absolute; top:50%; width:0; height:0; border-style:solid; }
.tail_left::after { right:100%; transform:translateY(-50%); border-width:8px 12px 8px 0; border-color:transparent var(--MI_THEME-panel) transparent transparent; margin-right:-2px; }
.tail_right::after { left:100%; transform:translateY(-50%); border-width:8px 0 8px 12px; border-color:transparent transparent transparent var(--MI_THEME-panel); margin-left:-2px; }
.bubbleControls { display:flex; flex-direction:column; gap:8px; margin-top:4px; }
.bubbleCtrlRow { display:flex; align-items:center; gap:12px; }
.colorRow { display:flex; align-items:center; gap:8px; margin-top:6px; }
.colorLabel { font-size:.78rem; opacity:.75; min-width:3.5em; }
.durationCtrl { display:flex; align-items:center; gap:6px; font-size:.85rem; }
.durationInput { width:54px; box-sizing:border-box; background: var(--MI_THEME-bg); color: var(--MI_THEME-fg); border:1px solid var(--MI_THEME-divider); border-radius:6px; padding:4px 8px; font-family:inherit; font-size:.85rem; text-align:right; }
.backdropVal { min-width:42px; text-align:right; opacity:.8; }
.backdropColor { width:42px; height:28px; padding:0; border:1px solid var(--MI_THEME-divider); border-radius:6px; background:none; cursor:pointer; }
.idlePresets { display:flex; gap:6px; }
.idlePreset { padding:4px 12px; border:1px solid var(--MI_THEME-divider); border-radius:999px; background:var(--MI_THEME-bg); color:var(--MI_THEME-fg); cursor:pointer; font-size:.85rem; }
.idlePreset:hover { background:var(--MI_THEME-buttonHoverBg); }
.idlePresetOn { background:var(--MI_THEME-accentedBg); border-color:var(--MI_THEME-accent); color:var(--MI_THEME-accent); font-weight:700; }
.idleManualLabel { opacity:.85; }
.colorInput { width:36px; height:24px; padding:0; border:1px solid var(--MI_THEME-divider); border-radius:6px; background:none; cursor:pointer; }
.colorClear { width:24px; height:24px; display:flex; align-items:center; justify-content:center; border:1px solid var(--MI_THEME-divider); border-radius:6px; background:var(--MI_THEME-bg); color:var(--MI_THEME-fg); cursor:pointer; font-size:.7rem; }
.bubbleCtrlLabel { font-size:.78rem; opacity:.7; min-width:84px; }
.bubbleRange { flex:1; accent-color: var(--MI_THEME-accent); }
.tailToggle { display:flex; gap:4px; }
.tailBtn { padding:4px 14px; border-radius:8px; border:1px solid var(--MI_THEME-divider); background: var(--MI_THEME-bg); color: var(--MI_THEME-fg); cursor:pointer; font-size:.8rem; }
.tailBtnOn { background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); border-color: var(--MI_THEME-accent); }
.previewBubbleDragging { outline:2px solid var(--MI_THEME-accent); opacity:.9; }
/* ？小吹き出し */
.qBubble { position:absolute; transform:translate(-50%,-50%); min-width:1.6em; height:1.6em; display:flex; align-items:center; justify-content:center; background: var(--MI_THEME-panel); border:1px solid var(--MI_THEME-divider); border-radius:50%; font-weight:700; color: var(--MI_THEME-accent); cursor:grab; box-shadow:0 2px 8px rgba(0,0,0,.2); touch-action:none; }
.qMark { line-height:1; }
.qBubble:active { cursor:grabbing; }
.qBubble::after { content:''; position:absolute; top:60%; width:0; height:0; border-style:solid; }
.qtail_left::after { right:100%; transform:translateY(-50%); border-width:6px 9px 6px 0; border-color:transparent var(--MI_THEME-panel) transparent transparent; margin-right:-2px; }
.qtail_right::after { left:100%; transform:translateY(-50%); border-width:6px 0 6px 9px; border-color:transparent transparent transparent var(--MI_THEME-panel); margin-left:-2px; }
.qDivider { height:1px; background: var(--MI_THEME-divider); opacity:.5; margin:2px 0; }
.qHint { font-size:.7rem; opacity:.5; }
.bubblePlaceholder { opacity:.45; }
.bubbleGrip { position:absolute; right:-8px; bottom:-8px; width:20px; height:20px; border-radius:999px; background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); display:flex; align-items:center; justify-content:center; font-size:.6rem; }
.previewHint { font-size:.72rem; opacity:.55; }
.previewChipsWrap { display:flex; flex-direction:column; gap:6px; margin-top:10px; padding-top:10px; border-top:1px solid var(--MI_THEME-divider); }
.previewChipsLabel { font-size:.78rem; opacity:.7; display:flex; align-items:center; gap:5px; }
.previewChips { display:flex; flex-wrap:wrap; gap:6px; }
.previewChip { display:inline-flex; align-items:center; gap:5px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:7px 14px; border-radius:10px; border:1px solid var(--MI_THEME-divider); background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); cursor:pointer; font-size:.8rem; transition:background .15s, border-color .15s; }
.previewChip:hover { border-color: var(--MI_THEME-accent); }
.previewChipOn { background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); border-color: var(--MI_THEME-accent); }

/* ===== キャラタブ ===== */
.charTabs { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
.charTab { display:flex; align-items:center; gap:6px; padding:5px 12px 5px 6px; border-radius:999px; border:1px solid var(--MI_THEME-divider); background: var(--MI_THEME-bg); color: var(--MI_THEME-fg); cursor:pointer; font-size:.85rem; }
.charTabOn { background: var(--MI_THEME-accent); color: var(--MI_THEME-fgOnAccent); border-color: var(--MI_THEME-accent); }
.charTabThumb { width:24px; height:24px; border-radius:50%; object-fit:cover; }
.charTabThumbIcon { width:24px; height:24px; display:flex; align-items:center; justify-content:center; opacity:.5; }
.charAdd { display:flex; align-items:center; gap:4px; padding:6px 12px; border-radius:999px; border:1px dashed var(--MI_THEME-divider); background:none; color: var(--MI_THEME-fg); cursor:pointer; font-size:.82rem; }
.ioRow { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
.ioBtn { display:flex; align-items:center; gap:5px; padding:7px 13px; border-radius:8px; border:1px solid var(--MI_THEME-divider); background:none; color: var(--MI_THEME-fg); cursor:pointer; font-size:.82rem; }
.ioBtn:disabled { opacity:.4; cursor:not-allowed; }
.ioDesc { font-size:.75rem; opacity:.6; line-height:1.6; margin:8px 0 0; }
.delBtn { margin-top:10px; background:none; border:1px solid var(--MI_THEME-divider); color: var(--MI_THEME-error, #e2566d); border-radius:8px; padding:6px 12px; font-size:.8rem; cursor:pointer; }

/* ===== 立ち絵グリッド ===== */
.expGrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:10px; margin-bottom:10px; }
.expItem { position:relative; display:flex; flex-direction:column; gap:6px; padding:8px; background: var(--MI_THEME-bg); border:1px solid var(--MI_THEME-divider); border-radius:10px; }
.expImg { width:100%; aspect-ratio:1; object-fit:contain; border-radius:6px; background: var(--MI_THEME-panelHighlight, rgba(128,128,128,.1)); }
.expLabel { width:100%; box-sizing:border-box; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); border:1px solid var(--MI_THEME-divider); border-radius:6px; padding:4px 8px; font-size:.78rem; font-family:inherit; }
.expMotion { width:100%; box-sizing:border-box; background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); border:1px solid var(--MI_THEME-divider); border-radius:6px; padding:4px 8px; font-size:.74rem; font-family:inherit; }
.expIntensity { display:flex; align-items:center; gap:6px; }
.expIntensityLabel { font-size:.7rem; opacity:.6; flex-shrink:0; }
.expIntensityRange { flex:1; min-width:0; accent-color: var(--MI_THEME-accent); }
/* 立ち絵の動き */
.motionBounce { animation: htkMascotBounce 1s ease-in-out infinite; }
.motionShake { animation: htkMascotShake .35s linear infinite; }
.motionSway { animation: htkMascotSway 2s ease-in-out infinite; }
.motionSpin { animation: htkMascotSpin 3s linear infinite; }
:global {
	@keyframes htkMascotBounce { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(calc(-8% * var(--htk-motion-i, 1))); } }
	@keyframes htkMascotShake { 0%,100%{ transform:translateX(0); } 25%{ transform:translateX(calc(-4px * var(--htk-motion-i, 1))); } 75%{ transform:translateX(calc(4px * var(--htk-motion-i, 1))); } }
	@keyframes htkMascotSway { 0%,100%{ transform:rotate(calc(-4deg * var(--htk-motion-i, 1))); } 50%{ transform:rotate(calc(4deg * var(--htk-motion-i, 1))); } }
	@keyframes htkMascotSpin { from{ transform:rotate(0); } to{ transform:rotate(360deg); } }
}
.expDel { position:absolute; top:4px; right:4px; width:22px; height:22px; border-radius:999px; border:none; background:rgba(0,0,0,.5); color:#fff; cursor:pointer; font-size:.7rem; display:flex; align-items:center; justify-content:center; }

/* ===== 文言カード ===== */
.phraseCard { background: var(--MI_THEME-bg); border:1px solid var(--MI_THEME-divider); border-radius:12px; padding:12px; margin-bottom:10px; }
.phraseTop { display:flex; gap:8px; align-items:center; }
.phraseTop .inp { flex:1; }
.phraseDel { width:36px; height:36px; flex-shrink:0; border-radius:8px; border:1px solid var(--MI_THEME-divider); background:none; color: var(--MI_THEME-error, #e2566d); cursor:pointer; }
.linkRow { display:flex; align-items:center; gap:6px; margin-top:10px; flex-wrap:wrap; }
.linkLabel { font-size:.78rem; opacity:.7; margin-right:2px; }
.linkThumb { width:40px; height:40px; border-radius:8px; border:2px solid var(--MI_THEME-divider); background: var(--MI_THEME-panel); color: var(--MI_THEME-fg); cursor:pointer; padding:0; overflow:hidden; display:flex; align-items:center; justify-content:center; opacity:.7; }
.linkThumbOn { border-color: var(--MI_THEME-accent); opacity:1; box-shadow:0 0 0 2px var(--MI_THEME-accent) inset; }
.linkThumbImg { width:100%; height:100%; object-fit:cover; }
.linkEmpty { font-size:.76rem; opacity:.5; }

/* ===== スイッチ ===== */
.sw { width:44px; height:24px; background: var(--MI_THEME-divider); border-radius:12px; cursor:pointer; position:relative; transition:background .3s; border:1px solid var(--MI_THEME-divider); flex-shrink:0; }
.sw::after { content:''; position:absolute; width:18px; height:18px; background:#fff; border-radius:50%; top:2px; left:2px; transition:left .25s cubic-bezier(0.34,1.56,0.64,1); box-shadow:0 1px 3px rgba(0,0,0,.2); }
.swOn { background: var(--MI_THEME-accent); border-color: var(--MI_THEME-accent); }
.swOn::after { left:22px; }
.subDivider { height:1px; background: var(--MI_THEME-divider); margin:10px 0; opacity:.6; }
</style>
