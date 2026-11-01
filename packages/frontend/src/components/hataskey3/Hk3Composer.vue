<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
Hataskey UI 3: 画面下の投稿欄。返信・引用・チャンネルの文脈、注釈、投票、添付、公開範囲を扱う。
-->
<template>
<div ref="rootEl" data-hk3-composer-menus :class="$style.root" :data-compact="compact ? 'true' : undefined" :data-deck="deck ? 'true' : undefined" :data-menu="menuPlacement" :data-position="composerPosition" :data-busy="submitting || postDelay.active.value || popupMenuCount > 0 || guideAnchor != null || inlineMenuOpen ? 'true' : undefined" :data-reduced-motion="reducedMotion ? 'true' : undefined" @compositionstart.capture="composing = true" @compositionend.capture="composing = false">
	<div :class="$style.confirmationStage" :style="confirmationStageHeight == null ? undefined : { height: `${confirmationStageHeight}px` }" :data-confirmation="confirmationActive ? 'true' : undefined">
	<div ref="draftLayerEl" :class="$style.draftLayer" :data-inactive="confirmationActive ? 'true' : undefined" :inert="confirmationActive" :aria-hidden="confirmationActive">
	<div :class="$style.ctxWrap" :data-open="context ? 'true' : undefined" :inert="!context" :aria-hidden="!context">
		<div :class="$style.ctxClip">
			<div ref="ctxEl" :class="$style.ctx" :data-kind="shownContext?.kind">
				<div :class="$style.ctxHead">
					<component :is="shownContext?.kind === 'quote' ? Quote : shownContext?.kind === 'channel' ? Tv : Reply" :size="16" :class="$style.ctxIcon"/>
					<b :class="$style.ctxKind">{{ shownContext?.kind === 'quote' ? copy.quote : shownContext?.kind === 'channel' ? copy.channel : copy.reply }}</b>
					<MkAvatar v-if="shownContext?.note" :user="shownContext.note.user" :class="$style.ctxAvatar"/>
					<b :class="$style.ctxName"><MkUserName v-if="shownContext?.note" :user="shownContext.note.user"/><template v-else-if="shownContext?.channel">{{ shownContext.channel.name }}</template></b>
					<button type="button" :class="$style.ctxClear" :title="copy.clearContext" :aria-label="copy.clearContext" @pointerdown="preserveContextInputFocus" @click="clearContext"><X :size="16"/></button>
				</div>
				<span v-if="shownContext?.note && !shownContext.note.isHidden && (shownContext.note.cw != null || shownContext.note.text)" :class="$style.ctxText"><Mfm :text="shownContext.note.cw ?? shownContext.note.text ?? ''" :plain="true" :author="shownContext.note.user" :emojiUrls="shownContext.note.emojis"/></span>
				<span v-else-if="shownContext?.note && !shownContext.note.isHidden && shownContext.note.files?.length" :class="$style.ctxText">{{ copy.attachmentsOnly }}</span>
			</div>
		</div>
	</div>

	<div v-if="!composerChannel && visibility === 'specified'" :class="$style.recipients">
		<span :class="$style.recipientsLabel"><AtSign :size="14"/>{{ copy.recipients }}</span>
		<button v-for="user in visibleUsers" :key="user.id" type="button" :class="$style.recipient" :title="copy.removeRecipient" @click="removeVisibleUser(user)"><MkAvatar :user="user" :class="$style.recipientAvatar"/><MkUserName :user="user"/><X :size="13"/></button>
		<button type="button" :class="$style.recipientAdd" @click="pickMention"><Plus :size="14"/>{{ copy.addRecipient }}</button>
	</div>

	<div :class="$style.cwWrap" :data-open="cwEnabled ? 'true' : undefined" :inert="!cwEnabled" :aria-hidden="!cwEnabled">
		<div :class="$style.cwClip">
			<div :class="$style.cwRow">
				<EyeOff :size="16"/>
				<input ref="cwInputEl" v-model="cwText" maxlength="100" :aria-label="copy.cw" :placeholder="copy.cwPlaceholder" :class="$style.cwInput"/>
			</div>
		</div>
	</div>

	<div v-if="pollEnabled" :class="$style.poll">
		<div v-for="(_, index) in pollChoices" :key="index" :class="$style.pollRow">
			<input v-model="pollChoices[index]" :placeholder="i18n.tsx._hata._hataskeyUi3.pollChoice({ number: (index + 1).toString() })" :class="$style.pollInput"/>
			<button v-if="pollChoices.length > 2" type="button" :class="$style.iconBtn" :title="i18n.ts.remove" @click="pollChoices.splice(index, 1)"><X :size="15"/></button>
		</div>
		<div :class="$style.pollFoot">
			<button v-if="pollChoices.length < 10" type="button" :class="$style.textBtn" @click="pollChoices.push('')"><Plus :size="15"/>{{ copy.addPollChoice }}</button>
			<label :class="$style.check"><input v-model="pollMultiple" type="checkbox"/>{{ copy.pollMultiple }}</label>
			<label :class="$style.check">{{ copy.pollDeadline }}
				<select v-model="pollExpiredAfterUnit" :class="$style.select">
					<option v-if="pollExpiresAt != null" value="original">{{ new Date(pollExpiresAt).toLocaleString(versatileLang) }}</option>
					<option value="infinite">{{ copy.pollNoDeadline }}</option>
					<option value="hour">{{ copy.pollOneHour }}</option>
					<option value="day">{{ copy.pollOneDay }}</option>
					<option value="week">{{ copy.pollOneWeek }}</option>
				</select>
			</label>
		</div>
	</div>

	<MkEventEditor v-if="event" v-model="event" @destroyed="event = null"/>
	<XPostFormAttaches v-model="draftFiles" @detach="removeDraftFile" @changeSensitive="updateDraftFileSensitive" @changeName="updateDraftFileName"/>
	<MkHataPostDelayStatus v-if="postDelay.active.value" :class="$style.delay" :pattern="i18n.ts._hata._postDelay.countdown" :seconds="postDelay.remainingSeconds.value" :progress="postDelay.progress.value" :cancelLabel="i18n.ts._hata._postDelay.cancel" :sendNowLabel="i18n.ts._hata._postDelay.sendNow" @cancel="cancelPostDelay" @sendNow="postDelay.sendNow()"/>

	<div :class="$style.previewWrap" :data-open="previewVisible ? 'true' : undefined" :data-reduced-motion="reducedMotion ? 'true' : undefined" :inert="!previewVisible" :aria-hidden="!previewVisible">
		<div :class="$style.previewClip">
			<!-- Keep the same DOM during reversal; the persistent wrapper owns the motion. -->
			<Transition name="hk3-composer-preview" :css="!reducedMotion" :duration="{ enter: 0, leave: 220 }" @afterLeave="clearPreviewText">
				<section v-if="previewVisible || !reducedMotion" v-show="previewVisible" :class="$style.preview" data-composer-preview>
					<span :class="$style.previewLabel"><Eye :size="13"/>{{ copy.preview }}</span>
					<div :class="$style.previewBody"><Mfm :text="previewText" :author="$i ?? undefined" :nyaize="'respect'"/></div>
				</section>
			</Transition>
		</div>
	</div>

	<div v-if="editingNote" :class="$style.editing">
		<Pencil :size="15"/><b>{{ i18n.ts.edit }}</b>
		<button type="button" :class="$style.ctxClear" :title="i18n.ts.cancel" @click="cancelEditing"><X :size="16"/></button>
	</div>
	<div ref="pillEl" :class="$style.pill" :style="pillStyle" :data-focused="focused ? 'true' : undefined" :data-waiting="postDelay.active.value ? 'true' : undefined">
		<span v-if="postDelay.active.value" :class="$style.delayRail" aria-hidden="true"><span :style="{ transform: `scaleX(${postDelay.progress.value})` }"></span></span>
		<textarea
			ref="inputEl"
			v-model="draftText"
			rows="1"
			:class="$style.input"
			:placeholder="placeholder"
			@input="resizeInput"
			@paste="onPaste"
			@focus="focused = true"
			@blur="focused = false"
			@keydown.ctrl.enter.prevent="submit"
			@keydown.meta.enter.prevent="submit"
		></textarea>
		<div :class="$style.row">
			<button ref="toolsTriggerEl" type="button" :class="$style.iconBtn" :data-active="toolsOpen ? 'true' : undefined" :title="copy.postTools" :aria-expanded="toolsOpen" aria-haspopup="menu" @click="toggleInlineMenu('tools', $event)"><LayoutGrid :size="18"/></button>
			<button ref="attachTriggerEl" type="button" :class="$style.iconBtn" :data-active="attachOpen ? 'true' : undefined" :title="copy.attach" :aria-expanded="attachOpen" aria-haspopup="menu" @click="openAttachmentMenu"><Paperclip :size="18"/></button>
			<button ref="cwTriggerEl" type="button" :class="$style.iconBtn" :data-active="cwEnabled ? 'true' : undefined" :title="copy.cw" :aria-pressed="cwEnabled" @click="toggleCw"><EyeOff :size="18"/></button>
			<template v-if="!compact">
				<span :class="$style.sep"></span>
				<template v-for="(slot, index) in shortcutSlots" :key="index">
					<button v-if="slot" :ref="el => setSlotRef(index, el)" type="button" :class="$style.shortcut" :data-active="slot.active ? 'true' : undefined" :title="slot.label" @click="runTool(slot.id, $event)"><component :is="slot.icon" :size="15"/></button>
					<button v-else :ref="el => setSlotRef(index, el)" type="button" :class="[$style.shortcut, $style.shortcutEmpty]" :title="copy.addShortcut" :aria-label="copy.addShortcut" @click="chooseShortcut(index, $event)"><Plus :size="15"/></button>
				</template>
			</template>
			<button v-if="emojiPosition === 'afterShortcuts'" ref="emojiTriggerEl" type="button" :class="$style.iconBtn" :data-active="emojiOpen ? 'true' : undefined" :title="copy.emoji" :aria-expanded="emojiOpen" @pointerdown="preserveHostedTextFocus" @click="openEmojiPicker"><Smile :size="18"/></button>
			<span :class="$style.spacer"></span>
			<button v-if="emojiPosition === 'beforeVisibility'" ref="emojiTriggerEl" type="button" :class="$style.iconBtn" :data-active="emojiOpen ? 'true' : undefined" :title="copy.emoji" :aria-expanded="emojiOpen" @pointerdown="preserveHostedTextFocus" @click="openEmojiPicker"><Smile :size="18"/></button>
			<div :class="$style.visWrap">
				<button ref="visTriggerEl" type="button" :class="$style.visBtn" :data-open="visMenuOpen ? 'true' : undefined" :title="copy.visibility" :aria-expanded="visMenuOpen" aria-haspopup="menu" :disabled="composerChannel != null" @click="toggleInlineMenu('visibility', $event)">
					<component :is="currentVisibility.icon" :size="15"/><span v-if="!compact" :class="$style.btnLabel">{{ currentVisibility.label }}</span><ChevronUp :size="13" :class="$style.visChevron"/>
				</button>
				</div>
			<button type="button" :class="$style.fedBtn" :data-local="effectiveLocalOnly ? 'true' : undefined" :title="effectiveLocalOnly ? copy.localOnlyTitle : copy.federateTitle" :disabled="composerChannel != null" @click="toggleLocalOnly">
				<component :is="effectiveLocalOnly ? GlobeLock : Rocket" :size="15"/><span v-if="!compact" :class="$style.btnLabel">{{ effectiveLocalOnly ? copy.localOnly : copy.federate }}</span>
			</button>
			<div :class="$style.meter" :title="copy.remaining" :data-over="overLimit ? 'true' : undefined">
				<span :class="$style.meterFill" :style="{ height: `${Math.min(100, characterCount / maxLength * 100)}%` }"></span>
				<span :class="$style.odo">
					<span v-for="(d, i) in odometer" :key="i" :class="$style.odoDigit" :style="{ opacity: d.visible ? 1 : 0 }"><span :class="$style.odoReel" :style="{ transform: `translateY(${-d.value * 14}px)`, transitionDelay: `${(odometer.length - 1 - i) * 40}ms` }"><span v-for="g in 10" :key="g">{{ g - 1 }}</span></span></span>
				</span>
			</div>
			<button type="button" data-hk3-send :class="$style.send" :data-state="sendState" :title="postDelay.active.value ? copy.cancelWait : copy.post" :disabled="!postDelay.active.value && !canSubmit" @click="postDelay.active.value ? cancelPostDelay() : submit()">
				<LoaderCircle v-if="sendState === 'sending'" :size="19" :class="$style.spin"/>
				<Check v-else-if="sendState === 'success'" :size="19"/>
				<span v-else-if="sendState === 'countdown'" :class="$style.sendCount" :style="{ '--hk3-delay-progress': postDelay.progress.value }">
					<Transition :name="reducedMotion ? '' : 'hk3-count'"><span :key="postDelay.remainingSeconds.value" :class="$style.sendDigit">{{ postDelay.remainingSeconds.value }}</span></Transition>
					<X :size="17" :class="$style.sendCancel"/>
				</span>
				<SendHorizontal v-else :size="19"/>
			</button>
		</div>
	</div>
	<Teleport :to="emojiHost?.target.value ?? 'body'" :disabled="!hostedEmojiPanel">
	<div ref="inlineMenuPanelEl" data-composer-menu-panel :class="$style.inlineMenuPanel" :data-hosted="hostedEmojiPanel ? 'true' : undefined" :data-condensed="hostedEmojiCondensed ? 'true' : undefined" :data-reduced-motion="reducedMotion ? 'true' : undefined" :data-open="inlineMenuOpen ? 'true' : undefined" :style="{ height: `${inlineMenuOpen ? inlineMenuHeight : 0}px` }" :inert="!inlineMenuOpen" :aria-hidden="!inlineMenuOpen" @pointerdown="preserveHostedPanelFocus" @compositionstart.capture="composing = true" @compositionend.capture="composing = false">
		<div ref="inlineMenuEl" :class="$style.inlineMenu" :style="{ maxHeight: `${inlineMenuMaxHeight}px` }" :data-composer-menu="inlineMenuKind" :role="inlineMenuKind === 'emoji' ? undefined : 'menu'" :aria-label="inlineMenuLabel" @keydown="onInlineMenuKeydown(inlineMenuKind, $event)">
			<div :key="inlineMenuKind" :class="$style.inlineMenuItems">
				<template v-if="inlineMenuKind === 'tools'">
					<button v-for="tool in tools" :key="tool.id" type="button" role="menuitemcheckbox" :aria-checked="tool.active" :class="$style.toolItem" :data-active="tool.active ? 'true' : undefined" @click="runTool(tool.id, $event)"><component :is="tool.icon" :size="18" :class="$style.menuItemIcon"/><span :class="$style.menuItemLabel">{{ tool.label }}</span></button>
				</template>
				<template v-else-if="inlineMenuKind === 'visibility'">
					<button v-for="v in visibilityOptions" :key="v.value" type="button" role="menuitemradio" :aria-checked="v.value === visibility" :class="$style.visItem" :data-active="v.value === visibility ? 'true' : undefined" @click="setVisibility(v.value)"><span :class="$style.menuItemLabel">{{ v.label }}</span><component :is="v.icon" :size="18" :class="$style.menuItemIcon"/><span :class="$style.menuCheckSlot"><Check v-if="v.value === visibility" :size="15" aria-hidden="true"/></span></button>
				</template>
				<template v-else-if="inlineMenuKind === 'attachment'">
					<div :class="$style.menuHead"><button type="button" :class="$style.menuBack" :title="i18n.ts.close" @click="closeInlineMenu(true)"><ChevronLeft :size="18"/></button><span>{{ copy.attach }}</span></div>
					<button type="button" role="menuitem" :class="$style.attachItem" @click="chooseAttachment('upload')"><i class="ti ti-upload" aria-hidden="true"></i><span>{{ i18n.ts.upload }}</span></button>
					<button type="button" role="menuitem" :class="$style.attachItem" @click="chooseAttachment('drive')"><i class="ti ti-cloud" aria-hidden="true"></i><span>{{ i18n.ts.fromDrive }}</span></button>
					<button type="button" role="menuitem" :class="$style.attachItem" @click="chooseAttachment('url')"><i class="ti ti-link" aria-hidden="true"></i><span>{{ i18n.ts.fromUrl }}</span></button>
				</template>
				<template v-else>
					<div :class="$style.menuHead"><button type="button" :class="$style.menuBack" :title="i18n.ts.close" @click="closeInlineMenu(true)"><ChevronLeft :size="18"/></button><span>{{ copy.emoji }}</span></div>
					<Hk3ComposerEmojiPicker v-if="emojiOpen || retainEmojiForOutro" ref="emojiPickerEl" :hosted="hostedEmojiPanel" :condensed="hostedEmojiCondensed" :maxHeight="Math.max(1, inlineMenuMaxHeight - (hostedEmojiCondensed ? 38 : 54))" @done="onEmojiChosen" @closed="onEmojiPickerClosed"/>
				</template>
			</div>
		</div>
	</div>
	</Teleport>
	<Hk3ShortcutGuide v-if="guideAnchor" :anchor="guideAnchor" :text="copy.shortcutGuide" :okLabel="i18n.ts.ok" @close="guideAnchor = null"/>
	</div>
	<Hk3ComposerConfirmation v-if="shownConfirmation" ref="confirmationEl" :request="shownConfirmation" :active="confirmationActive && confirmationVisible" :busy="confirmationRunPending" :error="confirmationError" :reducedMotion="reducedMotion" @cancel="cancelConfirmation" @confirm="confirmConfirmation" @height="onConfirmationHeight"/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, inject, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { AtSign, CalendarPlus, ChartBar, Check, ChevronLeft, ChevronUp, Code, Eye, EyeOff, Globe, Hash, House, LayoutGrid, LoaderCircle, Lock, Mail, Maximize2, Palette, Paperclip, Pencil, Plus, Quote, Reply, Rocket, GlobeLock, SendHorizontal, Smile, Heart, Tv, X } from '@lucide/vue';
import type * as Misskey from 'cherrypick-js';
import type { Component } from 'vue';
import type { PostFormProps } from '@/types/post-form.js';
import XPostFormAttaches from '@/components/MkPostFormAttaches.vue';
import MkEventEditor from '@/components/MkEventEditor.vue';
import MkHataPostDelayStatus from '@/components/MkHataPostDelayStatus.vue';
import * as os from '@/os.js';
import { $i, incNotesCount, notesCount } from '@/i.js';
import { i18n } from '@/i18n.js';
import { versatileLang } from '@/utility/intl-const.js';
import { instance } from '@/instance.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { chooseDriveFile, chooseFileFromPcAndUpload, chooseFileFromUrl } from '@/utility/drive.js';
import { mfmFunctionPicker } from '@/utility/mfm-function-picker.js';
import { createPostSendDelayController, postSendDelayEnabled, postSendDelaySeconds } from '@/utility/post-send-delay.js';
import { Autocomplete } from '@/utility/autocomplete.js';
import { deepClone } from '@/utility/clone.js';
import { useHataFormDraft } from '@/utility/hata-form-draft.js';
import { parseHk3ComposerDraft, isMeaningfulHk3ComposerDraft } from './hk3-composer-draft.js';
import type { PollEditorModelValue } from '@/components/MkPollEditor.vue';
import { formatTimeString } from '@/utility/format-time-string.js';
import { getPluginHandlers } from '@/plugin.js';
import { globalEvents } from '@/events.js';
import { claimAchievement } from '@/utility/achievements.js';
import { hk3CanAdoptPostForm, hk3ComposerLink, hk3PostedNote, pushHk3Toast } from './hk3-state.js';
import { HK3_COMPOSER_TOOL_IDS, hk3ComposerToolLabel, normalizeHk3ComposerShortcuts } from './hk3-composer-tools.js';
import type { Hk3ComposerToolId } from './hk3-composer-tools.js';
import Hk3ShortcutGuide from './Hk3ShortcutGuide.vue';
import { hk3PostContextKey } from './hk3-post-context.js';
import type { Hk3PostReceipt } from './hk3-post-context.js';
import { HK3_THEME_CONTEXT } from './hk3-theme.js';
import { registerHk3ComposerMenus, useHk3ComposerMenuReducedMotion } from './hk3-composer-menu.js';
import type { NoteActionConfirmation } from '@/utility/note-action-confirmation.js';
import Hk3ComposerConfirmation from './Hk3ComposerConfirmation.vue';
import { hk3ComposerEmojiHostKey } from './hk3-composer-emoji-host.js';

const props = withDefaults(defineProps<{
	compact?: boolean;
	deck?: boolean;
	draftId?: string;
	// デッキの投稿窓・カラムでは上に開くと枠からはみ出すため、メニューを下へ開く。
	menuPlacement?: 'up' | 'down';
}>(), {
	compact: false,
	deck: false,
	draftId: 'uiS:composer:main',
	menuPlacement: 'up',
});
const emit = defineEmits<{ posted: [] }>();

const composerPosition = computed(() => props.compact && !props.deck ? 'bottom' : prefer.r.hataskeyUi3ComposerPosition.value);

type Visibility = 'public' | 'home' | 'followers' | 'specified';
type Channel = { id: string; name: string; isPrivate?: boolean };
type ComposerContext = { kind: 'reply' | 'quote' | 'channel'; note?: Misskey.entities.Note; channel: Channel | null };
type ToolId = Hk3ComposerToolId;
type SendState = 'idle' | 'countdown' | 'sending' | 'success' | 'failure';

const copy = i18n.ts._hata._hataskeyUi3;
const MkDrawingTool = defineAsyncComponent(() => import('@/components/MkDrawingTool.vue'));
const Hk3ComposerEmojiPicker = defineAsyncComponent(() => import('./Hk3ComposerEmojiPicker.vue'));

const rootEl = shallowRef<HTMLElement | null>(null);
const draftLayerEl = shallowRef<HTMLElement | null>(null);
const confirmationEl = shallowRef<{ focusCancel: () => void; measureHeight: () => number } | null>(null);
const pillEl = shallowRef<HTMLElement | null>(null);
const postContext = inject(hk3PostContextKey, null);
const emojiHost = inject(hk3ComposerEmojiHostKey, null);
const themeContext = inject(HK3_THEME_CONTEXT, undefined);
const popupMenuCount = ref(0);
let unregisterMenus: (() => void) | undefined;
let pendingPostReceipt: Hk3PostReceipt | null = null;
const inputEl = shallowRef<HTMLTextAreaElement | null>(null);
const cwInputEl = shallowRef<HTMLInputElement | null>(null);
const cwTriggerEl = shallowRef<HTMLButtonElement | null>(null);
const inlineMenuEl = shallowRef<HTMLElement | null>(null);
const inlineMenuPanelEl = shallowRef<HTMLElement | null>(null);
const toolsTriggerEl = shallowRef<HTMLButtonElement | null>(null);
const attachTriggerEl = shallowRef<HTMLButtonElement | null>(null);
const emojiTriggerEl = shallowRef<HTMLButtonElement | null>(null);
const visTriggerEl = shallowRef<HTMLButtonElement | null>(null);
const emojiPickerEl = shallowRef<{ focus: (force?: boolean) => void; reset: () => void } | null>(null);
const ctxEl = shallowRef<HTMLElement | null>(null);
const draftText = ref('');
const draftFiles = ref<Misskey.entities.DriveFile[]>([]);
const cwEnabled = ref(false);
const cwText = ref('');
const pollEnabled = ref(false);
const pollChoices = ref(['', '']);
const pollMultiple = ref(false);
const pollExpiresAt = ref<number | null>(null);
const pollExpiredAfterUnit = ref<'original' | 'infinite' | 'hour' | 'day' | 'week'>('infinite');
const event = ref<any | null>(null);
const reactionAcceptance = ref<Misskey.entities.Note['reactionAcceptance']>(null);
const visibility = ref<Visibility>((prefer.s.rememberNoteVisibility ? store.s.visibility : prefer.s.defaultNoteVisibility) as Visibility);
const localOnly = ref<boolean>(prefer.s.rememberNoteVisibility ? store.s.localOnly : prefer.s.defaultNoteLocalOnly);
const visibleUsers = ref<Misskey.entities.UserLite[]>([]);
const context = ref<ComposerContext | null>(null);
// 「編集」で開いたときの元ノート。送信は新規投稿ではなく、このノートの更新になる。
const editingNote = shallowRef<Misskey.entities.Note | null>(null);
const lastContext = ref<ComposerContext | null>(null);
const composerDraft = useHataFormDraft({
	id: props.draftId,
	capture: () => deepClone({
		schemaVersion: 1 as const,
		draftText: draftText.value,
		draftFiles: draftFiles.value,
		cwEnabled: cwEnabled.value,
		cwText: cwText.value,
		pollEnabled: pollEnabled.value,
		pollChoices: pollChoices.value,
		pollMultiple: pollMultiple.value,
		pollExpiresAt: pollExpiresAt.value,
		pollExpiredAfterUnit: pollExpiredAfterUnit.value,
		event: event.value,
		reactionAcceptance: reactionAcceptance.value,
		visibility: visibility.value,
		localOnly: localOnly.value,
		visibleUsers: visibleUsers.value,
		context: context.value,
		editingNote: editingNote.value,
	}),
	restore: (snapshot) => {
		const data = parseHk3ComposerDraft(snapshot);
		draftText.value = data.draftText;
		draftFiles.value = data.draftFiles;
		cwEnabled.value = data.cwEnabled;
		cwText.value = data.cwText;
		pollEnabled.value = data.pollEnabled;
		pollChoices.value = data.pollChoices;
		pollMultiple.value = data.pollMultiple;
		pollExpiresAt.value = data.pollExpiresAt;
		pollExpiredAfterUnit.value = data.pollExpiredAfterUnit;
		event.value = data.event;
		reactionAcceptance.value = data.reactionAcceptance;
		visibility.value = data.visibility;
		localOnly.value = data.localOnly;
		visibleUsers.value = data.visibleUsers;
		context.value = data.context;
		editingNote.value = data.editingNote;
		lastContext.value = data.context;
	},
	isMeaningful: isMeaningfulHk3ComposerDraft,
});
type InlineMenuKind = 'tools' | 'visibility' | 'attachment' | 'emoji';
const inlineMenuOpen = ref(false);
const inlineMenuKind = ref<InlineMenuKind>('tools');
const toolsOpen = computed(() => inlineMenuOpen.value && inlineMenuKind.value === 'tools');
const visMenuOpen = computed(() => inlineMenuOpen.value && inlineMenuKind.value === 'visibility');
const attachOpen = computed(() => inlineMenuOpen.value && inlineMenuKind.value === 'attachment');
const emojiOpen = computed(() => inlineMenuOpen.value && inlineMenuKind.value === 'emoji');
const retainEmojiForOutro = ref(false);
const emojiHostEligible = computed(() => !!(props.compact && !props.deck && emojiHost?.enabled.value && emojiHost.target.value));
const hostedEmojiPanel = computed(() => emojiHostEligible.value && inlineMenuKind.value === 'emoji' && (inlineMenuOpen.value || retainEmojiForOutro.value));
const hostedEmojiCondensed = computed(() => hostedEmojiPanel.value && inlineMenuMaxHeight.value < 200);
let emojiOutroTimer: number | undefined;
const inlineMenuLabel = computed(() => ({ tools: copy.postTools, visibility: copy.visibility, attachment: copy.attach, emoji: copy.emoji })[inlineMenuKind.value]);
const inlineMenuHeight = ref(0);
const inlineMenuMaxHeight = ref(240);
const focused = ref(false);
const composing = ref(false);
const submitting = ref(false);
const pendingAttachments = ref(0);
const activeAttachmentOperations = ref(0);
let unmounted = false;
const sendState = ref<SendState>('idle');
const postDelay = createPostSendDelayController();
const reducedMotion = useHk3ComposerMenuReducedMotion();
const confirmationRequest = shallowRef<NoteActionConfirmation | null>(null);
const shownConfirmation = shallowRef<NoteActionConfirmation | null>(null);
const confirmationActive = computed(() => confirmationRequest.value != null);
const confirmationVisible = ref(false);
const confirmationRunPending = ref(false);
const canConfirm = computed(() => !props.deck && !unmounted && !submitting.value && !postDelay.active.value && pendingAttachments.value === 0 && activeAttachmentOperations.value === 0 && sendState.value === 'idle' && popupMenuCount.value === 0);
const confirmationError = ref<string | null>(null);
const confirmationStageHeight = ref<number | null>(null);
let confirmationCloseTimer: number | undefined;
let confirmationEpoch = 0;
let focusAfterConfirmation = false;
let confirmationPreviousFocus: HTMLElement | null = null;
const previewVisible = computed(() => draftText.value.trim().length > 0 && sendState.value === 'idle');
const previewText = ref('');

// Freeze the outgoing MFM until the wrapper has finished collapsing.
watch([previewVisible, draftText, reducedMotion], ([visible, text, motionOff]) => {
	if (visible) {
		previewText.value = text;
	} else if (motionOff) {
		clearPreviewText();
	}
}, { immediate: true });

function clearPreviewText() {
	if (!previewVisible.value) previewText.value = '';
}

function toggleCw() {
	cwEnabled.value = !cwEnabled.value;
}

watch(cwEnabled, enabled => {
	if (!enabled && window.document.activeElement === cwInputEl.value) cwTriggerEl.value?.focus({ preventScroll: true });
});

// 公開範囲の色設定を共有し、標準表示は輪郭を淡くぼかした光、デッキは内側の枠で描く。送信待ちの間は進捗表示に譲る。
const pillStyle = computed(() => {
	if (postDelay.active.value || !prefer.r['postFormVisibilityBorder.enabled'].value) return undefined;
	const width = prefer.r['postFormVisibilityBorder.width'].value;
	const colorKey = composerChannel.value ? 'public' : visibility.value;
	const color = prefer.r[`postFormVisibilityBorder.color.${colorKey}`].value;
	if (!props.deck) return {
		'--hk3-composer-ring-content': width > 0 ? "''" : 'none',
		'--hk3-composer-ring-color': color,
		'--hk3-composer-ring-width': `${Math.max(0, width)}px`,
	};
	return { borderColor: color, boxShadow: `inset 0 0 0 ${Math.max(0, width - 1)}px ${color}` };
});
let autocomplete: Autocomplete | null = null;

const shownContext = computed(() => context.value ?? lastContext.value);
const composerChannel = computed(() => context.value?.channel ?? null);
const effectiveVisibility = computed<Visibility>(() => composerChannel.value ? 'public' : visibility.value);
const effectiveLocalOnly = computed(() => composerChannel.value ? true : localOnly.value);
const maxLength = computed(() => instance.maxNoteTextLength ?? 3000);
const characterCount = computed(() => Array.from(draftText.value).length);
const overLimit = computed(() => characterCount.value > maxLength.value);
const hasValidContent = computed(() => !overLimit.value && (draftText.value.trim().length > 0 || draftFiles.value.length > 0 || pollEnabled.value || event.value != null));
const canSubmit = computed(() => !confirmationActive.value && !submitting.value && pendingAttachments.value === 0 && hasValidContent.value);
const placeholder = computed(() => {
	if (context.value?.kind === 'reply' && context.value.note) return i18n.tsx._hata._hataskeyUi3.replyTo({ name: context.value.note.user.name || context.value.note.user.username });
	if (context.value?.kind === 'quote') return copy.quotePlaceholder;
	if (composerChannel.value) return i18n.tsx._hata._hataskeyUi3.postToChannel({ name: composerChannel.value.name });
	return copy.whatsHappening;
});

// 残り文字数は桁ごとのリールで表す。先頭のゼロは隠し、変化した桁だけが下位から順に回る。
const odometer = computed(() => {
	const digits = String(maxLength.value).length;
	const text = String(Math.abs(maxLength.value - characterCount.value)).padStart(digits, '0');
	const lead = text.search(/[1-9]/);
	return text.split('').map((ch, i) => ({ value: Number(ch), visible: lead === -1 ? i === digits - 1 : i >= lead }));
});

const visibilityOptions: { value: Visibility; label: string; icon: Component }[] = [
	{ value: 'public', label: i18n.ts._visibility.public, icon: Globe },
	{ value: 'home', label: i18n.ts._visibility.home, icon: House },
	{ value: 'followers', label: i18n.ts._visibility.followers, icon: Lock },
	{ value: 'specified', label: i18n.ts._visibility.specified, icon: Mail },
];
const currentVisibility = computed(() => composerChannel.value
	? { label: copy.channel, icon: Tv }
	: visibilityOptions.find(v => v.value === visibility.value) ?? visibilityOptions[0]);

const TOOL_ICONS: Record<ToolId, Component> = {
	poll: ChartBar, mention: AtSign, hashtag: Hash, event: CalendarPlus, mfm: Code, drawing: Palette, reactionAcceptance: Heart, full: Maximize2,
};
// 投稿機能メニュー用(本体の popupMenu は Tabler アイコン名で描く)。
const TOOL_MENU_ICONS: Record<ToolId, string> = {
	poll: 'ti ti-chart-bar', mention: 'ti ti-at', hashtag: 'ti ti-hash', event: 'ti ti-calendar-plus', mfm: 'ti ti-code', drawing: 'ti ti-palette', reactionAcceptance: 'ti ti-heart', full: 'ti ti-arrows-maximize',
};
const tools = computed(() => HK3_COMPOSER_TOOL_IDS.filter(id => !editingNote.value || (id !== 'poll' && id !== 'full')).map(id => ({ id, label: hk3ComposerToolLabel(id), icon: TOOL_ICONS[id], active: isToolActive(id) })));

// よく使う機能のショートカット2枠。未設定の枠は＋で、押すと機能を選べる。
// 絵文字ボタンの位置。既定はショートカットのすぐ右、設定で公開範囲のすぐ左へ移せる。
const emojiPosition = computed(() => prefer.r.hataskeyUi3ComposerEmojiPosition.value === 'beforeVisibility' ? 'beforeVisibility' : 'afterShortcuts');
const shortcuts = computed(() => normalizeHk3ComposerShortcuts(prefer.r.hataskeyUi3ComposerShortcut1.value, prefer.r.hataskeyUi3ComposerShortcut2.value));
const shortcutSlots = computed(() => shortcuts.value.map(id => id == null ? null : tools.value.find(tool => tool.id === id) ?? null));
const slotEls: (HTMLElement | null)[] = [];
const guideAnchor = shallowRef<HTMLElement | null>(null);
const collapseBlocked = computed(() => submitting.value || postDelay.active.value || pendingAttachments.value > 0 || activeAttachmentOperations.value > 0 || popupMenuCount.value > 0 || guideAnchor.value != null || inlineMenuOpen.value || confirmationActive.value || confirmationRunPending.value || composing.value);

function setSlotRef(index: number, el: unknown) {
	slotEls[index] = el instanceof HTMLElement ? el : null;
}

function chooseShortcut(index: number, ev: MouseEvent) {
	const used = new Set(shortcuts.value.filter((id): id is ToolId => id != null));
	os.popupMenu([
		{ type: 'label', text: copy.chooseShortcut },
		...HK3_COMPOSER_TOOL_IDS.filter(id => !used.has(id) && (!editingNote.value || (id !== 'poll' && id !== 'full'))).map(id => ({
			type: 'button' as const,
			icon: TOOL_MENU_ICONS[id],
			text: hk3ComposerToolLabel(id),
			action: () => { void setShortcut(index, id); },
		})),
	], ev.currentTarget as HTMLElement, { appearance: 'uiS-composer', motionPreset: 'postform' });
}

async function setShortcut(index: number, id: ToolId) {
	prefer.commit(index === 0 ? 'hataskeyUi3ComposerShortcut1' : 'hataskeyUi3ComposerShortcut2', id);
	// 初めて選んだときだけ、変更方法をその枠を起点に案内する(アカウントごとに1回)。
	if (prefer.s.hataskeyUi3ShortcutGuideShown) return;
	prefer.commit('hataskeyUi3ShortcutGuideShown', true);
	await nextTick();
	const anchor = slotEls[index];
	if (anchor && anchor.offsetParent != null) guideAnchor.value = anchor;
}

function isToolActive(id: ToolId): boolean {
	if (id === 'poll') return pollEnabled.value;
	if (id === 'event') return event.value != null;
	if (id === 'reactionAcceptance') return reactionAcceptance.value != null;
	return false;
}

function runTool(id: ToolId, ev: MouseEvent) {
	const anchor = ev.currentTarget as HTMLElement;
	if (toolsOpen.value) closeInlineMenu();
	if (editingNote.value && (id === 'poll' || id === 'full')) return;
	switch (id) {
		case 'poll':
			pollEnabled.value = !pollEnabled.value;
			if (pollChoices.value.length < 2) pollChoices.value = ['', ''];
			break;
		case 'mention': void pickMention(); break;
		case 'hashtag':
			draftText.value += draftText.value && !draftText.value.endsWith(' ') ? ' #' : '#';
			void nextTick(() => inputEl.value?.focus());
			break;
		case 'event':
			event.value = event.value == null ? { title: '', start: Date.now(), end: null, metadata: {} } : null;
			break;
		case 'mfm':
			if (inputEl.value) mfmFunctionPicker(anchor, inputEl.value, draftText);
			break;
		case 'drawing': openDrawingTool(); break;
		case 'reactionAcceptance': void selectReactionAcceptance(); break;
		case 'full': openFullComposer(); break;
	}
}

function resizeInput() {
	const el = inputEl.value;
	if (!el?.isConnected || el.clientWidth === 0) return;
	el.style.height = 'auto';
	const max = props.compact ? 120 : 160;
	el.style.height = `${Math.max(42, Math.min(max, el.scrollHeight))}px`;
	el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
	if (inlineMenuOpen.value) updateInlineMenuViewport();
}

watch(draftText, () => { void nextTick(resizeInput); }, { flush: 'post' });
watch(() => props.compact, () => { void nextTick(resizeInput); });

watch(context, (next, prev) => {
	if (next) lastContext.value = next;
	hk3ComposerLink.value = next?.note && next.kind !== 'channel' ? { kind: next.kind, noteId: next.note.id } : null;
	if (next && prev && next !== prev && ctxEl.value?.animate && prefer.s.animation && !reducedMotion.value) {
		ctxEl.value.animate([{ transform: 'translateY(10px)', opacity: 0.3 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
	}
});

function preserveContextInputFocus(ev: PointerEvent) {
	if (ev.button === 0 && (window.document.activeElement === inputEl.value || window.document.activeElement === cwInputEl.value)) ev.preventDefault();
}

function clearContext() {
	const focusedInContext = ctxEl.value?.contains(window.document.activeElement);
	cancelPostReceipt();
	context.value = null;
	if (focusedInContext) inputEl.value?.focus({ preventScroll: true });
}

function mentionUser(user: Misskey.entities.UserLite) {
	const mention = `@${user.username}${user.host ? `@${user.host}` : ''}`;
	if (!draftText.value.includes(mention)) draftText.value = `${draftText.value}${draftText.value ? ' ' : ''}${mention} `;
	if (visibility.value === 'specified' && !visibleUsers.value.some(u => u.id === user.id)) visibleUsers.value.push(user);
}

async function pickMention() {
	try {
		const user = await os.selectUser({ includeSelf: true, localOnly: localOnly.value });
		if (visibility.value === 'specified' && !visibleUsers.value.some(u => u.id === user.id)) visibleUsers.value.push(user);
		else mentionUser(user);
	} catch { /* 選択の取り消し */ }
}

function removeVisibleUser(user: Misskey.entities.UserLite) {
	visibleUsers.value = visibleUsers.value.filter(u => u.id !== user.id);
}

function setVisibility(value: Visibility) {
	visibility.value = value;
	if (visMenuOpen.value) closeInlineMenu();
	persistRememberedVisibility();
}

function toggleLocalOnly() {
	if (composerChannel.value) return;
	localOnly.value = !localOnly.value;
	persistRememberedVisibility();
}

function persistRememberedVisibility() {
	if (!prefer.s.rememberNoteVisibility || composerChannel.value) return;
	store.set('visibility', visibility.value);
	store.set('localOnly', localOnly.value);
}

let emojiSelection = { start: 0, end: 0, generation: 0 };
let hostedFocusOnOpen: HTMLInputElement | HTMLTextAreaElement | null = null;
let keyboardEmojiOpen = false;

function openEmojiPicker(ev: MouseEvent) {
	if (composing.value) return;
	if (emojiOpen.value) {
		closeInlineMenu(hostedEmojiPanel.value && !!(window.document.activeElement && inlineMenuPanelEl.value?.contains(window.document.activeElement)));
		return;
	}
	hostedFocusOnOpen = emojiHostEligible.value && isFocusedTextControl(window.document.activeElement) ? window.document.activeElement : null;
	keyboardEmojiOpen = ev.detail === 0;
	const input = inputEl.value;
	emojiSelection = {
		start: input?.selectionStart ?? draftText.value.length,
		end: input?.selectionEnd ?? draftText.value.length,
		generation: draftGeneration,
	};
	toggleInlineMenu('emoji', ev);
}

function onEmojiChosen(emoji: string) {
	if (!emojiOpen.value || composing.value || unmounted || emojiSelection.generation !== draftGeneration) return;
	const hostedAtPick = hostedEmojiPanel.value;
	const input = inputEl.value;
	let { start, end } = emojiSelection;
	// A user-moved selection wins; a stale DOM value after rapid picks does not.
	if (input && input.value === draftText.value) {
		start = input.selectionStart;
		end = input.selectionEnd;
	}
	draftText.value = `${draftText.value.slice(0, start)}${emoji}${draftText.value.slice(end)}`;
	const caret = start + emoji.length;
	emojiSelection = { start: caret, end: caret, generation: draftGeneration };
	void nextTick(() => {
		if (unmounted || emojiSelection.generation !== draftGeneration || emojiSelection.start !== caret) return;
		if (!hostedAtPick) inputEl.value?.focus({ preventScroll: true });
		inputEl.value?.setSelectionRange(caret, caret);
	});
}

function isFocusedTextControl(element: Element | null): element is HTMLInputElement | HTMLTextAreaElement {
	return element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement;
}

function preserveHostedTextFocus(ev: PointerEvent) {
	if (emojiHostEligible.value && isFocusedTextControl(window.document.activeElement)) ev.preventDefault();
}

function preserveHostedPanelFocus(ev: PointerEvent) {
	if (!hostedEmojiPanel.value || !isFocusedTextControl(window.document.activeElement)) return;
	const target = ev.target;
	if (target instanceof Element && target.closest('button, summary')) ev.preventDefault();
}

function canAttach() {
	return !unmounted && !submitting.value && !postDelay.active.value && sendState.value === 'idle';
}

function appendDraftFiles(files: Misskey.entities.DriveFile[]) {
	const known = new Set(draftFiles.value.map(file => file.id));
	let overflow = false;
	for (const file of files) {
		if (known.has(file.id)) continue;
		if (draftFiles.value.length >= 16) {
			overflow = true;
			continue;
		}
		known.add(file.id);
		draftFiles.value.push(file);
	}
	if (overflow) void os.alert({ type: 'warning', text: i18n.ts._hata._drawingTool.attachmentLimit });
}

async function addFiles(loader: () => Promise<Misskey.entities.DriveFile[]>, generation = draftGeneration, blockSubmit = false) {
	if (!canAttach() || generation !== draftGeneration) return;
	if (draftFiles.value.length >= 16) {
		void os.alert({ type: 'warning', text: i18n.ts._hata._drawingTool.attachmentLimit });
		return;
	}
	// Clipboard uploader settles on cancel; existing menu pickers may remain pending.
	activeAttachmentOperations.value++;
	if (blockSubmit) pendingAttachments.value++;
	try {
		const files = await loader();
		if (generation === draftGeneration && canAttach()) appendDraftFiles(files);
	} catch { /* 選択・アップロードの取り消し、アップローダー側で通知済みの失敗 */
	} finally {
		activeAttachmentOperations.value--;
		if (blockSubmit && generation === draftGeneration) pendingAttachments.value--;
	}
}

function onPaste(ev: ClipboardEvent) {
	if (!ev.clipboardData) return;
	const files: { file: File; index: number }[] = [];
	Array.from(ev.clipboardData.items ?? []).forEach((item, index) => {
		if (item.kind !== 'file') return;
		const file = item.getAsFile();
		if (file) files.push({ file, index });
	});
	if (files.length === 0) {
		Array.from(ev.clipboardData.files ?? []).forEach((file, index) => files.push({ file, index }));
	}
	if (files.length === 0) return;
	ev.preventDefault();
	if (!canAttach()) return;
	const pastedFiles = files.map(({ file, index }) => {
		const dot = file.name.lastIndexOf('.');
		const ext = dot >= 0 ? file.name.slice(dot) : '';
		const name = formatTimeString(new Date(file.lastModified), 'yyyy-MM-dd HH-mm-ss [{{number}}]').replace(/{{number}}/g, `${index + 1}`) + ext;
		return new File([file], name, { type: file.type });
	});
	void addFiles(() => os.launchUploader(pastedFiles), draftGeneration, true);
}

let attachmentMenuGeneration = 0;

function openAttachmentMenu(ev: MouseEvent) {
	if (attachOpen.value) { closeInlineMenu(); return; }
	if (!canAttach()) return;
	attachmentMenuGeneration = draftGeneration;
	toggleInlineMenu('attachment', ev);
}

function chooseAttachment(source: 'upload' | 'drive' | 'url') {
	if (!attachOpen.value || !canAttach() || attachmentMenuGeneration !== draftGeneration) return;
	const generation = attachmentMenuGeneration;
	closeInlineMenu(true);
	if (source === 'upload') void addFiles(() => chooseFileFromPcAndUpload({ multiple: true }), generation);
	else if (source === 'drive') void addFiles(() => chooseDriveFile({ multiple: true }), generation);
	else void addFiles(async () => [await chooseFileFromUrl()], generation);
}

function removeDraftFile(id: string) { draftFiles.value = draftFiles.value.filter(file => file.id !== id); }

function updateDraftFileSensitive(file: Misskey.entities.DriveFile, isSensitive: boolean) {
	const target = draftFiles.value.find(item => item.id === file.id);
	if (target) target.isSensitive = isSensitive;
}

function updateDraftFileName(file: Misskey.entities.DriveFile, name: string) {
	const target = draftFiles.value.find(item => item.id === file.id);
	if (target) target.name = name;
}

function openDrawingTool() {
	if (!canAttach()) return;
	const generation = draftGeneration;
	const { dispose } = os.popup(MkDrawingTool, { canAttach: true }, {
		done: (file: Misskey.entities.DriveFile) => {
			if (generation === draftGeneration && canAttach()) appendDraftFiles([file]);
		},
		closed: () => dispose(),
	});
}

async function selectReactionAcceptance() {
	const selected = await os.select({
		title: i18n.ts.reactionAcceptance,
		items: [
			{ value: null, label: i18n.ts.all },
			{ value: 'likeOnlyForRemote' as const, label: i18n.ts.likeOnlyForRemote },
			{ value: 'nonSensitiveOnly' as const, label: i18n.ts.nonSensitiveOnly },
			{ value: 'nonSensitiveOnlyForLocalLikeOnlyForRemote' as const, label: i18n.ts.nonSensitiveOnlyForLocalLikeOnlyForRemote },
			{ value: 'likeOnly' as const, label: i18n.ts.likeOnly },
		],
		default: reactionAcceptance.value ?? null,
	});
	if (!selected.canceled) reactionAcceptance.value = selected.result;
}

// A successful full-form post must never erase a newer UI S draft, even if
// the user changes a value and later restores it while the dialog is open.
let fullComposerDraftRevision = 0;
watch([
	draftText, draftFiles, cwEnabled, cwText, pollEnabled, pollChoices,
	pollMultiple, pollExpiresAt, pollExpiredAfterUnit, event, reactionAcceptance,
	visibility, localOnly, visibleUsers, context, editingNote,
], () => { fullComposerDraftRevision++; }, { deep: true, flush: 'sync' });

function currentPoll(choices = pollChoices.value): PollEditorModelValue | null {
	if (!pollEnabled.value) return null;
	return {
		choices,
		multiple: pollMultiple.value,
		expiresAt: pollExpiredAfterUnit.value === 'original' ? pollExpiresAt.value : null,
		expiredAfter: { original: null, infinite: null, hour: 3_600_000, day: 86_400_000, week: 604_800_000 }[pollExpiredAfterUnit.value],
	};
}

function openFullComposer() {
	const revision = fullComposerDraftRevision;
	const generation = draftGeneration;
	void os.postDirect(deepClone({
		restoreDraft: false,
		initialText: draftText.value,
		initialPoll: currentPoll(),
		initialEvent: event.value,
		initialReactionAcceptance: reactionAcceptance.value,
		initialCw: cwEnabled.value ? cwText.value : undefined,
		initialFiles: draftFiles.value,
		initialVisibility: effectiveVisibility.value,
		initialLocalOnly: effectiveLocalOnly.value,
		initialVisibleUsers: visibleUsers.value as Misskey.entities.UserDetailed[],
		reply: context.value?.kind === 'reply' ? context.value.note : undefined,
		renote: context.value?.kind === 'quote' ? context.value.note : undefined,
		channel: composerChannel.value as Misskey.entities.Channel | null ?? undefined,
	}), () => {
		if (!unmounted && generation === draftGeneration && revision === fullComposerDraftRevision) clearComposer();
	});
}

function clearComposer() {
	invalidateDraft();
	draftText.value = '';
	draftFiles.value = [];
	cwEnabled.value = false;
	cwText.value = '';
	pollEnabled.value = false;
	pollChoices.value = ['', ''];
	pollMultiple.value = false;
	pollExpiresAt.value = null;
	pollExpiredAfterUnit.value = 'infinite';
	event.value = null;
	reactionAcceptance.value = null;
	context.value = null;
	lastContext.value = null;
	editingNote.value = null;
	if (visibility.value === 'specified') visibleUsers.value = [];
	composerDraft.clearDraft({ resume: true });
}

let draftGeneration = 0;

function invalidateDraft() {
	draftGeneration++;
	closeInlineMenu();
	pendingAttachments.value = 0;
	postDelay.cancel();
	cancelPostReceipt();
}

function cancelPostReceipt(receipt: Hk3PostReceipt | null = pendingPostReceipt) {
	if (pendingPostReceipt === receipt) pendingPostReceipt = null;
	try {
		receipt?.cancel();
	} catch (error) {
		console.error('Hataskey UI 3 post context cancel failed', error);
	}
}

/** 「削除して編集」「編集」: 元ノートの内容を投稿欄に戻す。 */
function restoreFromNote(init: Misskey.entities.Note, channel: Channel | null, updateMode: boolean) {
	const generation = draftGeneration;
	draftText.value = init.text ?? '';
	cwEnabled.value = init.cw != null;
	cwText.value = init.cw ?? '';
	if (!channel) {
		visibility.value = init.visibility as Visibility;
		localOnly.value = init.localOnly ?? false;
	}
	draftFiles.value = [...(init.files ?? [])];
	// 編集では投票を変えられないため、削除して編集のときだけ戻す。
	if (init.poll && !updateMode) {
		pollEnabled.value = true;
		pollChoices.value = init.poll.choices.map(choice => choice.text);
		pollMultiple.value = init.poll.multiple;
		const originalExpiry = init.poll.expiresAt ? new Date(init.poll.expiresAt).getTime() : null;
		pollExpiresAt.value = originalExpiry != null && originalExpiry > Date.now() ? originalExpiry : null;
		pollExpiredAfterUnit.value = pollExpiresAt.value == null ? 'infinite' : 'original';
	}
	const initEvent = (init as Misskey.entities.Note & { event?: { title: string; start: string | number; end: string | number | null; metadata: unknown } | null }).event;
	if (initEvent) {
		event.value = {
			title: initEvent.title,
			start: typeof initEvent.start === 'string' ? new Date(initEvent.start).getTime() : initEvent.start,
			end: typeof initEvent.end === 'string' ? new Date(initEvent.end).getTime() : initEvent.end,
			metadata: initEvent.metadata,
		};
	}
	reactionAcceptance.value = init.reactionAcceptance;
	visibleUsers.value = [];
	if (init.visibility === 'specified' && init.visibleUserIds?.length) {
		void misskeyApi('users/show', { userIds: init.visibleUserIds }).then(users => {
			if (generation === draftGeneration) visibleUsers.value = users;
		}).catch(error => {
			if (generation !== draftGeneration) return;
			console.error('Hataskey UI 3 recipients load failed', error);
			void os.alert({ type: 'error', text: i18n.ts._hata._externalTimeline._userPopup.loadFailed });
		});
	}
	editingNote.value = updateMode ? init : null;
	void nextTick(resizeInput);
}

function cancelEditing() {
	clearComposer();
}

function isAnnoyingMfm(text: string): boolean {
	return text.includes('$[x2') || text.includes('$[x3') || text.includes('$[x4') || text.includes('$[scale') || text.includes('$[position');
}

async function validateDraft(): Promise<boolean> {
	if (!hasValidContent.value) return false;
	if (!composerChannel.value && visibility.value === 'specified' && visibleUsers.value.length === 0) {
		await os.alert({ type: 'warning', text: copy.recipientRequired });
		return false;
	}
	if (pollEnabled.value && pollChoices.value.map(value => value.trim()).filter(Boolean).length < 2) {
		await os.alert({ type: 'warning', text: copy.pollNeedsTwo });
		return false;
	}
	if (cwEnabled.value && cwText.value.trim() === '') {
		await os.alert({ type: 'warning', text: copy.cwRequired });
		return false;
	}
	return true;
}

async function confirmWarnings(): Promise<boolean> {
	if (prefer.s.showNoAltTextWarning && draftFiles.value.some(file => file.comment == null || file.comment.length === 0)) {
		const confirm = await os.actions({
			type: 'warning',
			text: copy.noAltText,
			actions: [
				{ value: 'post' as const, text: copy.postAnyway },
				{ value: 'cancel' as const, text: i18n.ts.goBack, primary: true },
			],
		});
		if (confirm.canceled || confirm.result === 'cancel') return false;
	}
	const warningText = cwEnabled.value ? cwText.value : draftText.value;
	if (effectiveVisibility.value === 'public' && isAnnoyingMfm(warningText)) {
		const confirm = await os.actions({
			type: 'warning',
			text: i18n.ts.thisPostMayBeAnnoying,
			actions: [
				{ value: 'home' as const, text: i18n.ts.thisPostMayBeAnnoyingHome },
				{ value: 'post' as const, text: i18n.ts.thisPostMayBeAnnoyingIgnore },
				{ value: 'cancel' as const, text: i18n.ts.thisPostMayBeAnnoyingCancel },
			],
		});
		if (confirm.canceled || confirm.result === 'cancel') return false;
		if (confirm.result === 'home') visibility.value = 'home';
	}
	return true;
}

function wait(ms: number) {
	return new Promise<void>(resolve => window.setTimeout(resolve, prefer.s.animation ? ms : 0));
}

function cancelPostDelay() {
	postDelay.cancel();
	sendState.value = 'idle';
}

async function submit() {
	if (!canSubmit.value || sendState.value !== 'idle') return;
	closeInlineMenu();
	submitting.value = true;
	try {
		await submitDraft();
	} finally {
		submitting.value = false;
		sendState.value = 'idle';
	}
}

async function submitDraft() {
	const generation = draftGeneration;
	if (!await validateDraft()) return;
	if (unmounted || generation !== draftGeneration || pendingAttachments.value > 0) return;
	if (!await confirmWarnings()) return;
	if (unmounted || generation !== draftGeneration || pendingAttachments.value > 0) return;
	// The warning dialog can outlive edits to the body, poll, CW or recipients.
	if (!await validateDraft()) return;
	if (unmounted || generation !== draftGeneration || pendingAttachments.value > 0) return;

	// Warnings may change the draft. Capture exactly what this submission will send.
	const submittedRevision = fullComposerDraftRevision;
	const submittedGeneration = draftGeneration;
	const submittedContext = deepClone(context.value as any) as typeof context.value;
	const editing = deepClone(editingNote.value as any) as typeof editingNote.value;
	const submittedFiles = deepClone(draftFiles.value as any) as Misskey.entities.DriveFile[];
	const choices = pollChoices.value.map(value => value.trim()).filter(Boolean);
	let postData: Record<string, any> | null = deepClone({
		text: draftText.value === '' ? null : draftText.value,
		fileIds: submittedFiles.length > 0 ? submittedFiles.map(file => file.id) : undefined,
		visibility: effectiveVisibility.value,
		visibleUserIds: !composerChannel.value && visibility.value === 'specified' ? visibleUsers.value.map(user => user.id) : undefined,
		localOnly: effectiveLocalOnly.value,
		cw: cwEnabled.value ? cwText.value : null,
		channelId: composerChannel.value?.id,
		replyId: submittedContext?.kind === 'reply' ? submittedContext.note?.id : undefined,
		renoteId: submittedContext?.kind === 'quote' ? submittedContext.note?.id : undefined,
		poll: currentPoll(choices) ?? undefined,
		event: event.value,
		reactionAcceptance: reactionAcceptance.value,
	});
	const submittedDraftIsCurrent = () => !unmounted && submittedGeneration === draftGeneration && submittedRevision === fullComposerDraftRevision;

	for (const interruptor of getPluginHandlers('note_post_interruptor')) {
		try {
			postData = await interruptor.handler(deepClone(postData)) as Record<string, any> | null;
		} catch (error) {
			console.error('Hataskey UI 3 plugin interruptor failed', error);
		}
	}
	if (unmounted || generation !== draftGeneration || pendingAttachments.value > 0) return;
	if (postData == null || typeof postData !== 'object') {
		await os.alert({ type: 'error', text: copy.pluginInvalidPost });
		return;
	}

	if (postSendDelayEnabled.value && !editing) {
		sendState.value = 'countdown';
		if (!await postDelay.begin(postSendDelaySeconds.value)) {
			sendState.value = 'idle';
			return;
		}
	}
	if (unmounted || generation !== draftGeneration || pendingAttachments.value > 0) return;

	sendState.value = 'sending';
	try {
		if (editing) {
			const fileIds = Array.isArray(postData.fileIds) ? postData.fileIds : submittedFiles.map(file => file.id);
			const originalPoll = editing.poll ? {
				choices: editing.poll.choices.map(choice => choice.text),
				multiple: editing.poll.multiple,
				// 期限切れの投票も、選択肢を変えなければ更新サービス側で維持される。
				expiresAt: editing.poll.expiresAt && new Date(editing.poll.expiresAt).getTime() > Date.now() ? new Date(editing.poll.expiresAt).getTime() : null,
				expiredAfter: null,
			} : null;
			await misskeyApi('notes/update', {
				noteId: editing.id,
				text: postData.text ?? '',
				cw: postData.cw ?? null,
				fileIds: fileIds.length > 0 || editing.files?.length ? fileIds : undefined,
				poll: originalPoll,
				event: postData.event ?? null,
				disableRightClick: editing.disableRightClick ?? false,
			} as any);
			if (unmounted || submittedGeneration !== draftGeneration) return;
			sendState.value = 'success';
			pushHk3Toast({ icon: 'pencil', text: i18n.ts.noteEdited });
			if (submittedDraftIsCurrent()) {
				clearComposer();
				emit('posted');
			}
			await wait(900);
			return;
		}
		try {
			pendingPostReceipt = postContext?.begin() ?? null;
		} catch (error) {
			console.error('Hataskey UI 3 post context begin failed', error);
		}
		const result = await misskeyApi('notes/create', postData as any);
		const created = result?.createdNote;
		if (created) {
			globalEvents.emit('notePosted', created);
			const receipt = pendingPostReceipt;
			pendingPostReceipt = null;
			if (receipt && !unmounted && generation === draftGeneration) {
				try {
					// 下書きを消す前に、現在の投稿欄を演出の起点として測る。
					receipt.complete(created, (pillEl.value ?? rootEl.value)?.getBoundingClientRect() ?? null);
				} catch (error) {
					console.error('Hataskey UI 3 post context complete failed', error);
					cancelPostReceipt(receipt);
					if (!unmounted && generation === draftGeneration) hk3PostedNote.value = created;
				}
			} else {
				cancelPostReceipt(receipt);
				if (!unmounted && generation === draftGeneration) hk3PostedNote.value = created;
			}
		} else {
			cancelPostReceipt();
		}
		if (unmounted || generation !== draftGeneration) return;
		persistRememberedVisibility();
		incNotesCount();
		if (notesCount === 1) claimAchievement('notes1');
		const posted = String(postData.text ?? '').toLowerCase();
		if ((posted.includes('love') || posted.includes('❤')) && (posted.includes('cherrypick') || posted.includes('hataskey'))) claimAchievement('iLoveCherryPick');
		if (submittedContext?.kind === 'quote' && submittedContext.note?.userId === $i?.id && posted.length > 0) claimAchievement('selfQuote');
		const now = new Date();
		if (now.getHours() <= 3) claimAchievement('postedAtLateNight');
		if (now.getMinutes() === 0 && now.getSeconds() === 0) claimAchievement('postedAt0min0sec');
		sendState.value = 'success';
		pushHk3Toast({
			icon: submittedContext?.kind === 'reply' ? 'reply' : submittedContext?.kind === 'quote' ? 'quote' : 'send',
			text: (submittedContext?.kind === 'reply' ? copy.replied : submittedContext?.kind === 'quote' ? copy.quoted : copy.posted) + (postData.localOnly && !postData.channelId ? copy.localOnlySuffix : ''),
		});
		if (submittedDraftIsCurrent()) {
			clearComposer();
			emit('posted');
		}
		await wait(900);
	} catch (error) {
		cancelPostReceipt();
		if (unmounted || generation !== draftGeneration) return;
		console.error('Hataskey UI 3 post failed', error);
		sendState.value = 'failure';
		await os.alert({ type: 'error', text: copy.postFailed });
	}
}

/** MkNote・ノート詳細などからの返信・引用要求を、この投稿欄で受け取る。 */
function adopt(request: PostFormProps): boolean {
	if (!hk3CanAdoptPostForm(request)) return false;
	if (editingNote.value && !request.initialNote) return false;
	if (confirmationActive.value) focusAfterConfirmation = true;
	if (request.initialNote) clearComposer();
	else invalidateDraft();

	const channel = (request.channel !== undefined ? request.channel : request.reply?.channel ?? null) as Channel | null;
	if (request.reply) context.value = { kind: 'reply', note: request.reply, channel };
	else if (request.renote) context.value = { kind: 'quote', note: request.renote, channel };
	else if (channel) context.value = { kind: 'channel', channel };

	if (request.initialNote) restoreFromNote(request.initialNote, channel, request.updateMode === true);

	if (request.initialText) draftText.value = draftText.value.trim().length === 0 ? request.initialText : `${draftText.value} ${request.initialText}`;
	if (request.initialCw !== undefined) {
		cwEnabled.value = true;
		cwText.value = request.initialCw;
	}
	if (request.initialFiles?.length) {
		appendDraftFiles(request.initialFiles);
	}
	if (!channel && request.initialVisibility) visibility.value = request.initialVisibility as Visibility;
	if (!channel && request.initialLocalOnly !== undefined) localOnly.value = request.initialLocalOnly;
	if (request.initialVisibleUsers?.length) visibleUsers.value = [...request.initialVisibleUsers];
	if (request.specified) {
		visibility.value = 'specified';
		if (!visibleUsers.value.some(user => user.id === request.specified!.id)) visibleUsers.value.push(request.specified);
	}
	if (!channel && request.reply) {
		// Match the standard form: inherit a restricted reply audience without
		// widening an already more restrictive draft or explicit initial value.
		if (request.reply.visibility === 'home' && visibility.value === 'public') visibility.value = 'home';
		if (request.reply.visibility === 'followers' && (visibility.value === 'public' || visibility.value === 'home')) visibility.value = 'followers';
		if (request.reply.localOnly) localOnly.value = true;
	}
	if (request.mention && !request.reply && !request.renote && !channel) mentionUser(request.mention);
	focus();
	return true;
}

function focus() {
	postContext?.reveal?.();
	if (confirmationActive.value) { focusAfterConfirmation = true; return; }
	void nextTick(() => {
		if (confirmationActive.value) return;
		inputEl.value?.focus({ preventScroll: true });
		resizeInput();
	});
}

function openConfirmation(request: NoteActionConfirmation): boolean {
	postContext?.reveal?.();
	if (confirmationActive.value || confirmationRunPending.value) return true;
	if (!canConfirm.value) return false;
	window.clearTimeout(confirmationCloseTimer);
	confirmationEpoch++;
	const epoch = confirmationEpoch;
	confirmationPreviousFocus = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
	confirmationStageHeight.value = draftLayerEl.value?.offsetHeight ?? null;
	closeInlineMenu();
	guideAnchor.value = null;
	confirmationError.value = null;
	confirmationVisible.value = false;
	shownConfirmation.value = request;
	confirmationRequest.value = request;
	void nextTick(async () => {
		if (epoch !== confirmationEpoch || confirmationRequest.value !== request) return;
		confirmationStageHeight.value = confirmationEl.value?.measureHeight() ?? confirmationStageHeight.value;
		confirmationVisible.value = true;
		await nextTick();
		if (epoch !== confirmationEpoch || confirmationRequest.value !== request) return;
		confirmationEl.value?.focusCancel();
	});
	return true;
}

function onConfirmationHeight(height: number) {
	if (confirmationActive.value && height > 0 && confirmationStageHeight.value !== height) confirmationStageHeight.value = height;
}

function cancelConfirmation(): void {
	if (!confirmationActive.value) return;
	const needsFocus = focusAfterConfirmation;
	const previousFocus = confirmationPreviousFocus;
	focusAfterConfirmation = false;
	confirmationPreviousFocus = null;
	confirmationEpoch++;
	confirmationRequest.value = null;
	confirmationVisible.value = false;
	confirmationError.value = null;
	void nextTick(() => {
		if (confirmationActive.value || unmounted) return;
		confirmationStageHeight.value = draftLayerEl.value?.offsetHeight ?? null;
		if (needsFocus) {
			inputEl.value?.focus({ preventScroll: true });
			resizeInput();
		} else if (previousFocus?.isConnected && !previousFocus.closest('[inert]') && !previousFocus.matches(':disabled')) {
			previousFocus.focus({ preventScroll: true });
		} else {
			inputEl.value?.focus({ preventScroll: true });
		}
	});
	window.clearTimeout(confirmationCloseTimer);
	confirmationCloseTimer = window.setTimeout(() => {
		if (confirmationActive.value) return;
		shownConfirmation.value = null;
		confirmationStageHeight.value = null;
	}, reducedMotion.value ? 0 : 440);
}

async function confirmConfirmation(): Promise<void> {
	const request = confirmationRequest.value;
	if (!request || confirmationRunPending.value) return;
	confirmationRunPending.value = true;
	confirmationError.value = null;
	const epoch = confirmationEpoch;
	try {
		await request.run();
		if (!unmounted && epoch === confirmationEpoch && confirmationRequest.value === request) cancelConfirmation();
	} catch (error) {
		if (!unmounted && epoch === confirmationEpoch && confirmationRequest.value === request) {
			confirmationError.value = error instanceof Error && error.message ? error.message : i18n.ts.unableToProcess;
		}
	} finally {
		confirmationRunPending.value = false;
	}
}

function onDocumentPointerDown(ev: PointerEvent) {
	if (!inlineMenuOpen.value) return;
	const target = ev.target as Node | null;
	if (target && (rootEl.value?.contains(target) || inlineMenuPanelEl.value?.contains(target) || emojiHost?.target.value?.contains(target))) return;
	closeInlineMenu();
}

function closeInlineMenu(restoreFocus = false) {
	if (!inlineMenuOpen.value) return;
	const kind = inlineMenuKind.value;
	const hosted = kind === 'emoji' && hostedEmojiPanel.value;
	const focusedSearch = hosted && !!(window.document.activeElement && inlineMenuPanelEl.value?.contains(window.document.activeElement));
	if (kind === 'emoji' && emojiPickerEl.value && !reducedMotion.value && !unmounted) {
		retainEmojiForOutro.value = true;
		window.clearTimeout(emojiOutroTimer);
		emojiOutroTimer = window.setTimeout(() => { retainEmojiForOutro.value = false; }, 330);
	}
	inlineMenuOpen.value = false;
	if (restoreFocus) {
		if (focusedSearch && window.document.activeElement instanceof HTMLInputElement) inputEl.value?.focus({ preventScroll: true });
		else ({ tools: toolsTriggerEl, visibility: visTriggerEl, attachment: attachTriggerEl, emoji: emojiTriggerEl })[kind].value?.focus({ preventScroll: true });
	}
}

function onEmojiPickerClosed() {
	if (!composing.value) closeInlineMenu(true);
}

function toggleInlineMenu(kind: InlineMenuKind, ev: MouseEvent) {
	if (inlineMenuOpen.value && inlineMenuKind.value === kind) { closeInlineMenu(); return; }
	window.clearTimeout(emojiOutroTimer);
	retainEmojiForOutro.value = false;
	inlineMenuKind.value = kind;
	inlineMenuOpen.value = true;
	updateInlineMenuViewport();
	if (ev.detail === 0 && kind !== 'emoji') {
		void nextTick(() => inlineMenuEl.value?.querySelector<HTMLButtonElement>('[role^="menuitem"]')?.focus({ preventScroll: true }));
	}
}

watch([emojiPickerEl, emojiOpen], ([picker, open]) => {
	if (!picker || !open) return;
	picker.reset();
	if (!hostedEmojiPanel.value || keyboardEmojiOpen) picker.focus(hostedEmojiPanel.value && keyboardEmojiOpen);
	else if (hostedFocusOnOpen?.isConnected && window.document.activeElement !== hostedFocusOnOpen) hostedFocusOnOpen.focus({ preventScroll: true });
	hostedFocusOnOpen = null;
}, { flush: 'post' });

watch(hostedEmojiPanel, hosted => {
	if (emojiHost) emojiHost.open.value = hosted;
	void nextTick(updateInlineMenuViewport);
}, { immediate: true });

watch(emojiHostEligible, eligible => {
	if (eligible || !emojiOpen.value) return;
	closeInlineMenu();
	window.clearTimeout(emojiOutroTimer);
	retainEmojiForOutro.value = false;
}, { flush: 'sync' });

function onInlineMenuKeydown(kind: InlineMenuKind, ev: KeyboardEvent) {
	if (composing.value || ev.isComposing || ev.key === 'Process' || ev.keyCode === 229) return;
	if (ev.key === 'Escape') {
		ev.preventDefault();
		ev.stopPropagation();
		closeInlineMenu(true);
		return;
	}
	if (kind === 'emoji') return;
	if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(ev.key)) return;
	ev.preventDefault();
	ev.stopPropagation();
	const buttons = Array.from((ev.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)'));
	if (buttons.length === 0) return;
	const current = buttons.indexOf(window.document.activeElement as HTMLButtonElement);
	const index = ev.key === 'Home' ? 0 : ev.key === 'End' ? buttons.length - 1
		: (current + (ev.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
	const next = buttons[index];
	next?.focus({ preventScroll: true });
	next?.scrollIntoView?.({ block: 'nearest' });
}

function measureInlineMenu() {
	inlineMenuHeight.value = inlineMenuEl.value?.offsetHeight ?? 0;
}

function updateInlineMenuViewport() {
	const viewport = window.visualViewport;
	const viewportHeight = viewport?.height ?? window.innerHeight;
	const panelHeight = hostedEmojiPanel.value ? 0 : inlineMenuPanelEl.value?.offsetHeight ?? 0;
	const composerBaseHeight = (rootEl.value?.offsetHeight ?? 0) - panelHeight;
	const rect = rootEl.value?.getBoundingClientRect();
	const viewportTop = viewport?.offsetTop ?? 0;
	if (hostedEmojiPanel.value) {
		const targetTop = emojiHost?.target.value?.getBoundingClientRect().top ?? viewportTop;
		const composerTop = rect?.top ?? viewportTop + viewportHeight;
		inlineMenuMaxHeight.value = Math.max(0, Math.min(480, Math.min(composerTop, viewportTop + viewportHeight) - Math.max(targetTop, viewportTop) - 8));
		void nextTick(measureInlineMenu);
		return;
	}
	const spaceAtPanel = rect == null ? viewportHeight : props.deck || composerPosition.value !== 'bottom'
		? viewportTop + viewportHeight - (rect.bottom - panelHeight) - 16
		: rect.top + panelHeight - viewportTop - 16;
	// The mobile dock reserves 150px and adds 14px when measuring composer height.
	const dockBudget = props.compact && !props.deck ? viewportHeight - composerBaseHeight - 164 : Infinity;
	const available = props.deck
		? Math.max(0, viewportHeight - composerBaseHeight - 76)
		: Math.max(0, Math.min(viewportHeight - composerBaseHeight - 24, spaceAtPanel, dockBudget));
	inlineMenuMaxHeight.value = Math.min(inlineMenuKind.value === 'emoji' ? 480 : 240, available);
	void nextTick(measureInlineMenu);
}

watch([inlineMenuKind, inlineMenuOpen], () => { void nextTick(measureInlineMenu); });

let menuResizeObserver: ResizeObserver | null = null;
let lastInputWidth: number | null = null;
let viewportMeasureFrame = 0;

function scheduleInlineMenuViewport() {
	updateInlineMenuViewport();
	void nextTick(() => {
		if (unmounted || viewportMeasureFrame) return;
		viewportMeasureFrame = window.requestAnimationFrame(() => {
			viewportMeasureFrame = 0;
			if (!unmounted) updateInlineMenuViewport();
		});
	});
}

onMounted(() => {
	if (rootEl.value) unregisterMenus = registerHk3ComposerMenus(rootEl.value, popupMenuCount, themeContext);
	if (inputEl.value) autocomplete = new Autocomplete(inputEl.value, draftText);
	resizeInput();
	updateInlineMenuViewport();
	window.document.addEventListener('pointerdown', onDocumentPointerDown, true);
	window.addEventListener('resize', scheduleInlineMenuViewport, { passive: true });
	window.visualViewport?.addEventListener('resize', scheduleInlineMenuViewport, { passive: true });
	window.visualViewport?.addEventListener('scroll', scheduleInlineMenuViewport, { passive: true });
	if (typeof ResizeObserver !== 'undefined') {
		menuResizeObserver = new ResizeObserver(entries => {
			for (const entry of entries) {
				if (entry.target === inlineMenuEl.value) measureInlineMenu();
				if (entry.target === rootEl.value || entry.target === emojiHost?.target.value || entry.target === emojiHost?.target.value?.parentElement) updateInlineMenuViewport();
				if (entry.target !== inputEl.value) continue;
				const width = entry.contentRect.width;
				if (width === lastInputWidth) continue;
				lastInputWidth = width;
				if (width > 0) resizeInput();
			}
		});
		if (inlineMenuEl.value) menuResizeObserver.observe(inlineMenuEl.value);
		if (inputEl.value) menuResizeObserver.observe(inputEl.value);
		if (rootEl.value) menuResizeObserver.observe(rootEl.value);
		if (emojiHost?.target.value) menuResizeObserver.observe(emojiHost.target.value);
		if (emojiHost?.target.value?.parentElement) menuResizeObserver.observe(emojiHost.target.value.parentElement);
	}
});

watch(() => emojiHost?.target.value, (target, previous) => {
	if (previous) menuResizeObserver?.unobserve(previous);
	if (previous?.parentElement) menuResizeObserver?.unobserve(previous.parentElement);
	if (target) menuResizeObserver?.observe(target);
	if (target?.parentElement) menuResizeObserver?.observe(target.parentElement);
	updateInlineMenuViewport();
});

onBeforeUnmount(() => {
	window.clearTimeout(confirmationCloseTimer);
	confirmationEpoch++;
	unregisterMenus?.();
	unmounted = true;
	if (emojiHost) emojiHost.open.value = false;
	invalidateDraft();
	window.clearTimeout(emojiOutroTimer);
	window.cancelAnimationFrame(viewportMeasureFrame);
	autocomplete?.detach();
	autocomplete = null;
	postDelay.cancel();
	hk3ComposerLink.value = null;
	window.document.removeEventListener('pointerdown', onDocumentPointerDown, true);
	window.removeEventListener('resize', scheduleInlineMenuViewport);
	window.visualViewport?.removeEventListener('resize', scheduleInlineMenuViewport);
	window.visualViewport?.removeEventListener('scroll', scheduleInlineMenuViewport);
	menuResizeObserver?.disconnect();
});

defineExpose({ adopt, focus, openConfirmation, cancelConfirmation, confirmationActive, canConfirm, collapseBlocked });
</script>

<style lang="scss" module>
.root {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: calc(8px * var(--hk3-ui-scale, 1));
	padding: calc(12px * var(--hk3-ui-scale, 1)) calc(20px * var(--hk3-ui-scale, 1)) calc(16px * var(--hk3-ui-scale, 1));
	border-top: 2px solid var(--hk3-divider);
	background: var(--hk3-bg);
	color: var(--hk3-text);

	&[data-compact] { padding: calc(8px * var(--hk3-ui-scale, 1)) calc(10px * var(--hk3-ui-scale, 1)) calc(10px * var(--hk3-ui-scale, 1)); }

	&:not([data-deck]) {
		opacity: var(--hk3-composer-reveal-opacity, 1);
		transform: translateY(var(--hk3-composer-reveal-offset, 0px));
		transition: opacity 180ms ease, transform 280ms cubic-bezier(.22, 1, .36, 1);
		&[data-reduced-motion] { transition: none; }

		border-top: 0;
		background: transparent;
	}
	&:not([data-compact]):not([data-deck]) {
		box-sizing: border-box;
		width: 100%;
		max-width: var(--hk3-timeline-note-width, 800px);
		margin-inline: auto;
	}
}

.confirmationStage { position: relative; min-width: 0; transition: height 440ms cubic-bezier(.22, 1, .36, 1); }
.draftLayer { display: flex; flex-direction: column; gap: calc(8px * var(--hk3-ui-scale, 1)); min-width: 0; transition: opacity 190ms ease, transform 400ms cubic-bezier(.22, 1, .36, 1); }
.draftLayer[data-inactive] { position: absolute; inset: 0 0 auto; opacity: 0; transform: translateY(-14px); pointer-events: none; }
.root[data-position="top"] { --hk3-confirm-enter-offset: -14px; }
.root[data-position="top"] .draftLayer[data-inactive] { transform: translateY(14px); }
.root[data-reduced-motion] .confirmationStage, .root[data-reduced-motion] .draftLayer { transition: none; }
@media (prefers-reduced-motion: reduce) { .confirmationStage, .draftLayer { transition: none; } }

.inlineMenuPanel {
	min-height: 0;
	overflow: hidden;
	margin-top: -8px;
	transition: height 330ms cubic-bezier(.22, 1, .36, 1), margin 330ms cubic-bezier(.22, 1, .36, 1);
	&[data-open] { margin-top: 0; }

	.root[data-position="bottom"]:not([data-deck]) & {
		order: -1;
		margin-top: 0;
		margin-bottom: -8px;
		&[data-open] { margin-bottom: 0; }
	}

	.root[data-reduced-motion] &, &[data-reduced-motion] { transition: none; }

	&[data-hosted] {
		position: relative;
		width: 100%;
		margin: 0;
		box-sizing: border-box;
		background: transparent;
		border: 0;
		box-shadow: none;
	}
	&[data-hosted]:not([data-open]) { margin: 0; }
}

.inlineMenu {
	display: flex;
	flex-direction: column;
	gap: 2px;
	width: 100%;
	padding: calc(6px * var(--hk3-ui-scale, 1));
	box-sizing: border-box;
	background: transparent;
	overflow-y: auto;
	overscroll-behavior: contain;
	opacity: 0;
	transform: translateY(6px);
	transition: opacity 220ms ease, transform 330ms cubic-bezier(.22, 1, .36, 1);

	.inlineMenuPanel[data-open] & { opacity: 1; transform: translateY(0); }
	.root[data-reduced-motion] &, .inlineMenuPanel[data-reduced-motion] & { transition: none; }
	.inlineMenuPanel[data-condensed] & { padding: 0 4px 2px; gap: 0; }
}

.inlineMenuItems {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
	animation: hk3MenuItemsIn 220ms cubic-bezier(.22, 1, .36, 1) both;
	.root[data-reduced-motion] &, .inlineMenuPanel[data-reduced-motion] & { animation: none; }
	.inlineMenuPanel[data-condensed] & { gap: 0; }
}

.menuHead {
	display: flex;
	align-items: center;
	gap: calc(8px * var(--hk3-ui-scale, 1));
	min-height: 40px;
	color: var(--hk3-text);
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	.inlineMenuPanel[data-condensed] & { min-height: 36px; height: 36px; }
}

.menuBack {
	display: grid;
	place-items: center;
	width: 36px;
	height: 36px;
	border: 0;
	border-radius: 10px;
	background: transparent;
	color: inherit;
	cursor: pointer;
	&:hover { background: color-mix(in srgb, var(--hk3-accent) 11%, transparent); }
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: -2px; }
}

.attachItem {
	display: flex;
	align-items: center;
	gap: calc(12px * var(--hk3-ui-scale, 1));
	width: 100%;
	min-height: 42px;
	padding: 0 calc(10px * var(--hk3-ui-scale, 1));
	border: 0;
	border-radius: 10px;
	background: transparent;
	color: var(--hk3-text);
	font: inherit;
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	text-align: left;
	cursor: pointer;
	i { width: 18px; color: var(--hk3-text); text-align: center; }
	&:hover { background: color-mix(in srgb, var(--hk3-accent) 11%, transparent); color: var(--hk3-accent-800); }
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: -2px; }
}

@keyframes hk3MenuItemsIn {
	from { opacity: 0; transform: translateY(5px); }
	to { opacity: 1; transform: translateY(0); }
}

.toolItem, .visItem {
	position: relative;
	display: grid;
	grid-template-columns: minmax(0, 1fr) 20px;
	align-items: center;
	gap: calc(12px * var(--hk3-ui-scale, 1));
	width: 100%;
	min-height: 44px;
	padding: 0 calc(12px * var(--hk3-ui-scale, 1)) 0 calc(36px * var(--hk3-ui-scale, 1));
	box-sizing: border-box;
	border: 0;
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	text-align: right;
	border-radius: 12px;
	flex-shrink: 0;
	transition: background-color 180ms ease;

	svg { flex-shrink: 0; }
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: -2px; }

	&[data-active] { background: color-mix(in srgb, var(--hk3-accent) 8%, transparent); }
	&:hover { background: color-mix(in srgb, var(--hk3-accent) 11%, transparent); }
	&[data-active] .menuItemIcon, &:hover .menuItemIcon { color: var(--hk3-accent-800); }
}

.toolItem {
	height: max(44px, calc(46px * var(--hk3-ui-scale, 1)));
	grid-template-columns: 20px minmax(0, 1fr);
	padding: 0 calc(12px * var(--hk3-ui-scale, 1));
	text-align: left;
}
.visItem { height: 44px; grid-template-columns: minmax(0, 1fr) 20px 15px; padding: 0 calc(12px * var(--hk3-ui-scale, 1)); }

.menuItemLabel {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.menuItemIcon { justify-self: center; }
.menuCheckSlot { display: grid; place-items: center; width: 15px; height: 15px; color: var(--hk3-accent-800); }

.ctxWrap {
	display: grid;
	grid-template-rows: 0fr;
	margin-bottom: -8px;
	transition: grid-template-rows 440ms cubic-bezier(0.22, 1, 0.36, 1), margin-bottom 440ms cubic-bezier(0.22, 1, 0.36, 1);

	&[data-open] { grid-template-rows: 1fr; margin-bottom: 0; }
}

.ctxClip {
	overflow: hidden;
	min-height: 0;
}

.ctx {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
	min-height: 58px;
	box-sizing: border-box;
	padding: calc(7px * var(--hk3-ui-scale, 1)) calc(57px * var(--hk3-ui-scale, 1)) calc(7px * var(--hk3-ui-scale, 1)) calc(12px * var(--hk3-ui-scale, 1));
	border: 1px solid color-mix(in srgb, var(--hk3-accent) 16%, var(--hk3-divider));
	border-radius: 17px;
	background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), transparent);
	-webkit-backdrop-filter: blur(16px) saturate(1.1);
	backdrop-filter: blur(16px) saturate(1.1);
	box-shadow: 0 4px 18px color-mix(in srgb, var(--hk3-accent) 7%, transparent);
	opacity: 0;
	transform: translateY(14px);
	transition: opacity 280ms ease, transform 440ms cubic-bezier(0.22, 1, 0.36, 1);

	.ctxWrap[data-open] & { opacity: 1; transform: translateY(0); }
}

.ctxHead {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 2px calc(8px * var(--hk3-ui-scale, 1));
	min-width: 0;
}

.ctxIcon { color: var(--hk3-accent-700); flex: none; }
.ctxKind { font-size: calc(12px * var(--hk3-ui-scale, 1)); color: var(--hk3-accent-800); flex: none; }

.ctxAvatar {
	width: 22px;
	height: 22px;
	margin-left: 4px;
	flex: none;
}

.ctxName {
	flex: 1 1 6ch;
	min-width: 0;
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.ctxClear {
	width: 30px;
	height: 30px;
	border: 0;
	border-radius: 50%;
	background: color-mix(in srgb, var(--hk3-accent) 8%, transparent);
	color: var(--hk3-accent-800);
	cursor: pointer;
	display: grid;
	place-items: center;

	&:hover { background: color-mix(in srgb, var(--hk3-accent) 16%, transparent); }
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: 2px; }
}

.ctx .ctxClear {
	position: absolute;
	top: 0;
	bottom: 0;
	right: 9px;
	margin-block: auto;
	width: 44px;
	height: 44px;
}

.ctxText {
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	line-height: 1.5;
	color: var(--hk3-text);
	padding: 0 calc(4px * var(--hk3-ui-scale, 1)) 2px calc(24px * var(--hk3-ui-scale, 1));
	min-width: 0;
	overflow-wrap: anywhere;
	display: -webkit-box;
	-webkit-line-clamp: 1;
	-webkit-box-orient: vertical;
	overflow: hidden;

	.ctx[data-kind="quote"] & {
		-webkit-line-clamp: 2;
	}
}

.recipients {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(6px * var(--hk3-ui-scale, 1));
}

.recipientsLabel {
	display: inline-flex;
	align-items: center;
	gap: calc(4px * var(--hk3-ui-scale, 1));
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	color: var(--hk3-neutral-700);
}

.recipient, .recipientAdd {
	display: inline-flex;
	align-items: center;
	gap: calc(6px * var(--hk3-ui-scale, 1));
	height: 30px;
	padding: 0 calc(8px * var(--hk3-ui-scale, 1));
	border: 1px solid var(--hk3-divider);
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	font-size: calc(12px * var(--hk3-ui-scale, 1));

	&:hover { border-color: var(--hk3-accent); }
}

.recipientAvatar {
	width: 20px;
	height: 20px;
	border-radius: 0 !important;
	:global(img) { border-radius: 0 !important; }
}

.cwWrap {
	display: grid;
	grid-template-rows: 0fr;
	margin-bottom: -8px;
	opacity: 0;
	transition: grid-template-rows 330ms cubic-bezier(.22, 1, .36, 1), margin-bottom 330ms cubic-bezier(.22, 1, .36, 1), opacity 220ms ease;

	&[data-open] { grid-template-rows: 1fr; margin-bottom: 0; opacity: 1; }
	.root[data-reduced-motion] & { transition: none; }
}

.cwClip { min-height: 0; overflow: hidden; }

.cwRow {
	display: flex;
	align-items: center;
	gap: calc(10px * var(--hk3-ui-scale, 1));
	padding: 0 calc(10px * var(--hk3-ui-scale, 1));
	border: 1px solid var(--hk3-divider);
	border-radius: 12px;
	background: var(--hk3-surface);
	color: var(--hk3-neutral-700);
}

.cwInput, .pollInput {
	flex: 1;
	min-width: 0;
	height: 36px;
	border: 0;
	background: transparent;
	color: var(--hk3-text);
	font: inherit;
	font-size: calc(14px * var(--hk3-ui-scale, 1));
	outline: none;
}

.cwInput::placeholder { font-style: italic; }

.poll {
	display: flex;
	flex-direction: column;
	gap: calc(4px * var(--hk3-ui-scale, 1));
	padding: calc(8px * var(--hk3-ui-scale, 1)) calc(10px * var(--hk3-ui-scale, 1));
	border: 1px solid var(--hk3-divider);
	background: var(--hk3-surface);
}

.pollRow {
	display: flex;
	align-items: center;
	gap: calc(4px * var(--hk3-ui-scale, 1));
	border-bottom: 1px solid var(--hk3-divider);
}

.pollFoot {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: calc(12px * var(--hk3-ui-scale, 1));
	padding-top: calc(4px * var(--hk3-ui-scale, 1));
}

.check {
	display: inline-flex;
	align-items: center;
	gap: calc(6px * var(--hk3-ui-scale, 1));
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	font-weight: 700;
}

.select {
	height: 28px;
	border: 1px solid var(--hk3-divider);
	background: var(--hk3-bg);
	color: var(--hk3-text);
	font: inherit;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
}

.textBtn {
	display: inline-flex;
	align-items: center;
	gap: calc(4px * var(--hk3-ui-scale, 1));
	height: 28px;
	padding: 0 calc(8px * var(--hk3-ui-scale, 1));
	border: 1px solid var(--hk3-divider);
	background: transparent;
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	font-weight: 700;

	&:hover { border-color: var(--hk3-accent); }
}

.previewWrap {
	display: grid;
	grid-template-rows: 0fr;
	min-width: 0;
	margin-bottom: -8px; // Cancel the root's extra gap while closed.
	opacity: 0;
	transition: grid-template-rows 220ms ease, margin-bottom 220ms ease, opacity 180ms ease;

	&[data-open] { grid-template-rows: 1fr; margin-bottom: 0; opacity: 1; }
	&[data-reduced-motion] { transition: none; }
}

.previewClip {
	min-height: 0;
	min-width: 0;
	overflow: hidden;
}

.preview {
	display: flex;
	flex-direction: column;
	min-width: 0;
	gap: calc(4px * var(--hk3-ui-scale, 1));
	padding: calc(8px * var(--hk3-ui-scale, 1)) calc(12px * var(--hk3-ui-scale, 1));
	background: var(--hk3-surface);
	max-height: 120px;
	overflow: auto;

	.root[data-compact] & { max-height: min(120px, 20dvh); }

	.root:not([data-deck]) & {
		background: color-mix(in srgb, var(--hk3-surface) var(--hk3-glass-soft-alpha, 30%), transparent);
		color: var(--hk3-text);
	}
}

.previewLabel {
	display: flex;
	align-items: center;
	gap: calc(6px * var(--hk3-ui-scale, 1));
	font-size: calc(11px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	color: var(--hk3-neutral-700);
}

.previewBody {
	font-size: calc(14px * var(--hk3-ui-scale, 1));
	line-height: 1.6;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}

.pill {
	display: grid;
	gap: calc(6px * var(--hk3-ui-scale, 1));
	padding: calc(8px * var(--hk3-ui-scale, 1)) calc(8px * var(--hk3-ui-scale, 1)) calc(8px * var(--hk3-ui-scale, 1)) calc(12px * var(--hk3-ui-scale, 1));
	border: 1px solid var(--hk3-divider);
	background: var(--hk3-bg);
	transition: border-color 200ms ease, box-shadow 200ms ease;

	&[data-focused] { border-color: var(--hk3-accent); box-shadow: var(--hk3-shadow-md); }

	.root:not([data-deck]) & {
		border: 0;
		box-shadow: none;
		background: transparent;
		isolation: isolate;

		// 背景だけを背面でぼかし、入力やボタンの輪郭を保ったまま周囲へなじませる。
		&::after {
			content: '';
			position: absolute;
			inset: 0;
			z-index: -2;
			border-radius: inherit;
			pointer-events: none;
			background: color-mix(in srgb, var(--hk3-bg) var(--hk3-glass-soft-alpha, 30%), transparent);
			filter: blur(8px);
		}

		&:not([data-waiting])::before {
			content: var(--hk3-composer-ring-content, none);
			position: absolute;
			inset: 0;
			z-index: -1;
			border-radius: inherit;
			pointer-events: none;
			// 中央を塗らず、設定幅の輪郭だけをぼかして文字に重なる光を抑える。
			box-shadow: inset 0 0 0 var(--hk3-composer-ring-width, 0px) var(--hk3-composer-ring-color);
			filter: blur(6px);
			opacity: 0.75;
		}
	}
}

.input {
	width: 100%;
	min-height: 42px;
	max-height: 160px;
	height: 42px;
	padding: calc(10px * var(--hk3-ui-scale, 1)) 0 calc(6px * var(--hk3-ui-scale, 1));
	border: 0;
	background: transparent;
	resize: none;
	font: inherit;
	font-size: calc(15px * var(--hk3-ui-scale, 1));
	line-height: 1.55;
	color: var(--hk3-text);
	outline: none;
	box-sizing: border-box;

	&::placeholder { color: var(--hk3-neutral-600); }
	.root[data-compact] & { max-height: 120px; }
}

.row {
	display: flex;
	align-items: center;
	gap: calc(4px * var(--hk3-ui-scale, 1));
	min-width: 0;
}

.iconBtn {
	width: 36px;
	height: 36px;
	flex: none;
	border: 0;
	background: transparent;
	color: var(--hk3-neutral-800);
	cursor: pointer;
	display: grid;
	place-items: center;

	&[data-active] { background: var(--hk3-accent-100); color: var(--hk3-accent-800); }
	&:hover { background: var(--hk3-accent-100); color: var(--hk3-accent-800); }
	.root[data-compact] & { width: 32px; }
}

.sep {
	width: 1px;
	height: 20px;
	margin: 0 4px;
	background: var(--hk3-divider);
	flex: none;
}

.shortcut {
	width: 30px;
	height: 30px;
	flex: none;
	border: 1px solid var(--hk3-divider);
	background: transparent;
	color: var(--hk3-neutral-800);
	cursor: pointer;
	display: grid;
	place-items: center;

	&[data-active] { background: var(--hk3-accent-100); color: var(--hk3-accent-800); border-color: var(--hk3-accent); }
	&:hover { border-color: var(--hk3-accent); }
}

.shortcut + .shortcut { margin-left: 4px; }

.shortcutEmpty {
	border-style: dashed;
	color: var(--hk3-accent-700);

	&:hover { border-style: solid; background: var(--hk3-accent-100); }
}

.spacer { flex: 1; min-width: 0; }

.visWrap { position: relative; flex: none; }

.visBtn, .fedBtn, .meter, .send {
	background: var(--hk3-bg);
	background-image: linear-gradient(var(--hk3-composer-control-tint, transparent), var(--hk3-composer-control-tint, transparent));
	border-radius: 10px;

	@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
		background-color: var(--hk3-glass-control, color-mix(in srgb, var(--hk3-bg) 28%, transparent));
		-webkit-backdrop-filter: blur(20px) saturate(1.15);
		backdrop-filter: blur(20px) saturate(1.15);
	}
}

.visBtn, .fedBtn, .send {
	&:focus-visible { outline: 2px solid var(--hk3-accent); outline-offset: 2px; }
}

.visBtn, .fedBtn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: calc(6px * var(--hk3-ui-scale, 1));
	height: 32px;
	padding: 0 calc(10px * var(--hk3-ui-scale, 1));
	flex: none;
	border: 1px solid transparent;
	color: var(--hk3-text);
	cursor: pointer;
	font: inherit;
	font-size: calc(12px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	white-space: nowrap;
	transition: background 200ms ease, color 200ms ease;

	&:hover:not(:disabled) {
		--hk3-composer-control-tint: color-mix(in srgb, var(--hk3-accent) var(--hk3-glass-control-tint-alpha, 12%), transparent);
		color: var(--hk3-accent-800);
	}
	&:disabled { opacity: 0.45; cursor: default; }
	.root[data-compact] & { padding: 0 calc(7px * var(--hk3-ui-scale, 1)); }
}

.visBtn[data-open] {
	--hk3-composer-control-tint: color-mix(in srgb, var(--hk3-accent) var(--hk3-glass-control-tint-alpha, 12%), transparent);
	color: var(--hk3-accent-800);
}
.visChevron { color: var(--hk3-neutral-700); }

.fedBtn[data-local] {
	--hk3-composer-control-tint: color-mix(in srgb, var(--hk3-text) 8%, transparent);
	color: var(--hk3-text);

	&:hover:not(:disabled) {
		--hk3-composer-control-tint: color-mix(in srgb, var(--hk3-text) var(--hk3-glass-control-tint-alpha, 12%), transparent);
		color: var(--hk3-text);
	}
}

.meter {
	position: relative;
	width: 46px;
	height: 32px;
	flex: none;
	border: 1px solid transparent;
	display: grid;
	place-items: center;
	overflow: hidden;
	box-sizing: border-box;
	color: var(--hk3-text);

	&[data-over] { color: color-mix(in srgb, var(--MI_THEME-error, var(--hk3-accent)) 65%, var(--hk3-text)); }
	.root[data-compact] & { width: 40px; }
}

.meterFill {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	background: color-mix(in srgb, var(--hk3-accent) var(--hk3-glass-control-tint-alpha, 12%), transparent);
	transition: height 200ms ease;

	.meter[data-over] & { background: color-mix(in srgb, var(--MI_THEME-error, var(--hk3-accent)) calc(var(--hk3-glass-soft-alpha, 30%) / 2), transparent); }
}

.odo {
	position: relative;
	display: flex;
	height: 14px;
	font-size: calc(11px * var(--hk3-ui-scale, 1));
	font-weight: 700;
	line-height: 14px;
	font-variant-numeric: tabular-nums;
}

.odoDigit {
	display: block;
	width: 7px;
	height: 14px;
	overflow: hidden;
	transition: opacity 300ms ease;
}

.odoReel {
	display: flex;
	flex-direction: column;
	transition: transform 460ms cubic-bezier(0.22, 1, 0.36, 1);

	span { display: block; height: 14px; text-align: center; }
}

.send {
	position: relative;
	--hk3-composer-control-tint: color-mix(in srgb, var(--hk3-accent) var(--hk3-glass-control-tint-alpha, 12%), transparent);
	background-image: linear-gradient(145deg, rgb(255 255 255 / 4%), transparent 45%), linear-gradient(135deg, var(--hk3-composer-control-tint), color-mix(in srgb, var(--hk3-composer-control-tint) 50%, transparent));
	width: 44px;
	height: 40px;
	flex: none;
	border: 0;
	border-radius: 12px;
	color: var(--hk3-accent-800);
	cursor: pointer;
	display: grid;
	place-items: center;
	transition: background 220ms ease, box-shadow 220ms ease;

	&::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		padding: 1px;
		pointer-events: none;
		background: linear-gradient(135deg, color-mix(in srgb, currentColor 40%, transparent), color-mix(in srgb, currentColor 8%, transparent) 48%, color-mix(in srgb, currentColor 28%, transparent));
		-webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
		mask-composite: exclude;
		filter: blur(0.5px);
	}

	&[data-state="success"] {
		--hk3-composer-control-tint: color-mix(in srgb, var(--hk3-text) var(--hk3-glass-control-tint-alpha, 12%), transparent);
		color: var(--hk3-text);
	}
	&[data-state="failure"] {
		--hk3-composer-control-tint: color-mix(in srgb, var(--MI_THEME-error, var(--hk3-accent)) var(--hk3-glass-control-tint-alpha, 12%), transparent);
		color: color-mix(in srgb, var(--MI_THEME-error, var(--hk3-accent)) 35%, var(--hk3-text));
	}
	&:hover:not(:disabled) { box-shadow: inset 0 0 12px color-mix(in srgb, currentColor 12%, transparent); }
	&:disabled { opacity: 0.45; cursor: default; }
	&[data-state="sending"]:disabled { opacity: 0.85; }
}

.spin { animation: hk3Spin 0.8s linear infinite; }

.editing {
	display: flex;
	align-items: center;
	gap: calc(8px * var(--hk3-ui-scale, 1));
	height: 34px;
	padding: 0 calc(4px * var(--hk3-ui-scale, 1)) 0 calc(12px * var(--hk3-ui-scale, 1));
	border: 1px solid var(--hk3-accent);
	background: var(--hk3-accent-100);
	color: var(--hk3-accent-800);
	font-size: calc(13px * var(--hk3-ui-scale, 1));

	> b { flex: 1; min-width: 0; }
}

// 送信待ち: ボタンに残り秒数と進み具合の輪、ホバーで取り消しの×を出す。
.sendCount {
	position: relative;
	display: grid;
	place-items: center;
	width: 28px;
	height: 28px;
	border-radius: 50%;
	color: var(--hk3-bg);
	background: conic-gradient(var(--hk3-bg) calc(var(--hk3-delay-progress) * 360deg), color-mix(in srgb, var(--hk3-bg) var(--hk3-glass-soft-alpha, 30%), transparent) 0);
	overflow: hidden;

	&::before {
		content: '';
		position: absolute;
		inset: 2px;
		border-radius: 50%;
		background: var(--hk3-accent);
	}
}

.sendDigit, .sendCancel {
	position: relative;
	grid-area: 1 / 1;
	font-size: calc(13px * var(--hk3-ui-scale, 1));
	font-weight: 800;
	font-variant-numeric: tabular-nums;
	line-height: 1;
}

.sendCancel { opacity: 0; transition: opacity 140ms ease; }
.send:hover .sendCancel, .send:focus-visible .sendCancel { opacity: 1; }
.send:hover .sendDigit, .send:focus-visible .sendDigit { opacity: 0; }

:global(.hk3-count-enter-active), :global(.hk3-count-leave-active) { transition: opacity 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1); }
:global(.hk3-count-enter-from) { opacity: 0; transform: translateY(70%); }
:global(.hk3-count-leave-to) { opacity: 0; transform: translateY(-70%); }

.pill { position: relative; }

.pill[data-waiting] { border-color: var(--hk3-accent); }

.delayRail {
	position: absolute;
	left: -1px;
	right: -1px;
	top: -1px;
	height: 3px;
	overflow: hidden;
	background: color-mix(in srgb, var(--hk3-accent) 22%, transparent);
	pointer-events: none;

	> span {
		display: block;
		height: 100%;
		background: var(--hk3-accent);
		transform-origin: left center;
		transition: transform 120ms linear;
	}
}

// 送信待ちの案内は UI3 の角のない面に揃える。
.delay {
	padding: calc(8px * var(--hk3-ui-scale, 1)) calc(10px * var(--hk3-ui-scale, 1)) calc(8px * var(--hk3-ui-scale, 1)) calc(12px * var(--hk3-ui-scale, 1));
	border: 1px solid var(--hk3-accent);
	background: var(--hk3-surface);
	color: var(--hk3-text);
	font-size: calc(13px * var(--hk3-ui-scale, 1));

	:global(button) { border-radius: 0 !important; }
}

@keyframes hk3Spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
	.root:not([data-deck]) { transition: none; }
	.previewWrap { transition: none; }
	.ctxWrap, .ctx, .cwWrap, .inlineMenuPanel, .inlineMenu, .odoReel, .odoDigit { transition: none !important; }
	.inlineMenuItems { animation: none; }
	.spin { animation: none; }
	.delayRail > span, .sendCancel { transition: none; }
}

.root[data-reduced-motion] {
	.ctxWrap, .ctx { transition: none; }
}

// デッキの投稿窓(560px)のような狭い置き場所でも、送信ボタンが枠からはみ出さないよう段階的に詰める。
.pill { container-type: inline-size; }

@container (max-width: 600px) {
	.btnLabel { display: none; }
	.visBtn, .fedBtn { padding: 0 calc(7px * var(--hk3-ui-scale, 1)); }
	.iconBtn { width: 32px; }
}

@container (max-width: 420px) {
	.sep, .shortcut { display: none; }
}

// デッキのカラム(幅300px前後)でも、送信ボタンまで枠内に収める。
@container (max-width: 360px) {
	.row { gap: 2px; }
	.iconBtn { width: 30px; height: 32px; }
	.visBtn, .fedBtn { padding: 0 calc(6px * var(--hk3-ui-scale, 1)); gap: 3px; }
	.visChevron { display: none; }
	.meter { width: 38px; }
	.send { width: 38px; height: 36px; }
}

@container (max-width: 300px) {
	.meter { display: none; }
}

// compact の小さめ表示は fine pointer の仮想画面でも入力を 16px に保つ。
:global(html[data-hk3-size='small']) .root[data-compact] .input,
:global(html[data-hk3-size='small']) .root[data-compact] .cwInput,
:global(html[data-hk3-size='small']) .root[data-compact] .pollInput { font-size: 16px; }

// The mobile dock owns the shared inset; avoid stacking a second frame's padding.
.root[data-compact]:not([data-deck]) {
	padding: 0;
	.pill { padding: 0; }
}

// Mobile dock: a plain 44 × 40 send target.
.root[data-compact]:not([data-deck]) .send {
	width: 44px;
	height: 40px;
	background: color-mix(in srgb, var(--hk3-text) 5%, transparent);
	background-image: none;
	-webkit-backdrop-filter: none;
	backdrop-filter: none;
	border-radius: 12px;
	box-shadow: none;

	&::before { content: none; }
	&:hover:not(:disabled) { background: color-mix(in srgb, var(--hk3-text) 9%, transparent); box-shadow: none; }
	&:active:not(:disabled) { background: color-mix(in srgb, var(--hk3-text) 13%, transparent); }
}
</style>
