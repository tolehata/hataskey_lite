<!--
SPDX-FileCopyrightText: syuilo and misskey-project / hatacha
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div
	v-if="embedded" ref="embeddedRootEl" :class="$style.embedded" data-embedded-search
	:style="{ '--embedded-search-max-height': `${embeddedMaxHeight}px` }"
	:data-motion="motion" :inert="!active" :aria-hidden="!active" role="search" @keydown="onEmbeddedKeydown"
>
	<div ref="embeddedRowEl" :class="[$style.capsule, $style.embeddedRow]">
		<button type="button" :class="$style.target" :aria-label="i18n.ts._search.searchTarget" :aria-expanded="choice === 'target'" :aria-controls="choiceId" @click="openChoice('target', $event)">
			<i :class="targetIconClass" aria-hidden="true"/><span :class="$style.targetLabel">{{ targetLabel }}</span><i class="ti ti-chevron-down" :class="$style.targetChevron" aria-hidden="true"/>
		</button>
		<input
			ref="queryInputEl" v-model="searchQuery" type="search" :class="$style.queryInput" :placeholder="i18n.ts.search" :aria-label="i18n.ts.search"
			@compositionstart="composing = true" @compositionend="composing = false" @keydown.enter="onEnter"
		/>
		<button v-if="searchQuery !== ''" type="button" :class="$style.clearBtn" :aria-label="i18n.ts.clear" @click="clearQuery"><i class="ti ti-x" aria-hidden="true"/></button>
		<button type="button" :class="$style.searchBtn" :aria-label="i18n.ts.search" @click="executeSearch"><i class="ti ti-search" aria-hidden="true"/></button>
		<button ref="embeddedOptionsBtn" type="button" :class="$style.optionsBtn" :aria-label="i18n.ts.options" :aria-expanded="optionsOpen" :aria-controls="conditionsId" @click="toggleOptions"><i class="ti ti-adjustments-horizontal" aria-hidden="true"/></button>
	</div>
	<div ref="embeddedScrollEl" :class="$style.embeddedScroll">
		<div v-show="choice != null" :id="choiceId" ref="choicePaneEl" :class="$style.choicePane" role="group" :aria-label="choiceTitle" @keydown="onChoiceKeydown">
			<div :class="$style.choiceHeading">
				<button type="button" :class="$style.choiceBack" :aria-label="i18n.ts.goBack" @click="closeChoice()"><i class="ti ti-chevron-left" aria-hidden="true"/></button>
				<strong>{{ choiceTitle }}</strong>
			</div>
			<button v-for="item in choiceItems" :key="String(item.value)" type="button" :class="$style.choiceItem" :aria-pressed="item.value === choiceValue" :data-choice-value="item.value" @click="applyChoice(item.value)">
				<span>{{ item.label }}</span><i v-if="item.value === choiceValue" class="ti ti-check" aria-hidden="true"/>
			</button>
		</div>
		<div v-show="choice == null" ref="embeddedPaneEl">
			<div v-show="optionsOpen" :id="conditionsId" :class="[$style.optionsPanel, $style.embeddedConditions]">
				<div v-show="target === 'note'" class="_gaps_s">
					<div :class="$style.choiceField" role="group" :aria-label="i18n.ts._search.searchScope">
						<span>{{ i18n.ts._search.searchScope }}</span>
						<button type="button" :class="$style.choiceTrigger" :aria-label="i18n.ts._search.searchScope" :aria-expanded="choice === 'noteScope'" :aria-controls="choiceId" @click="openChoice('noteScope', $event)">{{ selectLabel(noteScopeDef, noteScope) }}<i class="ti ti-chevron-down" aria-hidden="true"/></button>
					</div>
					<MkInput v-if="instance.federation !== 'none' && noteScope === 'server'" v-model="hostInput" small :placeholder="i18n.ts._search.serverHostPlaceholder" @enter.prevent="executeSearch">
						<template #label>{{ i18n.ts._search.pleaseEnterServerHost }}</template>
					</MkInput>
					<div v-if="noteScope === 'user'">
						<div :class="$style.userSelectLabel">{{ i18n.ts._search.pleaseSelectUser }}</div>
						<div v-if="user == null" :class="$style.userSelectButtons">
							<MkButton v-if="$i != null" transparent @click="selectSelf">{{ i18n.ts.selectSelf }}</MkButton>
							<MkButton transparent @click="selectUser">{{ i18n.ts.selectUser }}</MkButton>
						</div>
						<div v-else :class="$style.userSelected">
							<MkUserCardMini :user="user"/>
							<button type="button" :class="$style.userRemoveBtn" :aria-label="i18n.ts.clear" @click="removeUser"><i class="ti ti-x" aria-hidden="true"/></button>
						</div>
					</div>
					<MkInput v-model="rangeStartAt" small type="datetime-local"><template #label>{{ i18n.ts._search.postFrom }}</template></MkInput>
					<MkInput v-model="rangeEndAt" small type="datetime-local"><template #label>{{ i18n.ts._search.postTo }}</template></MkInput>
				</div>
				<div v-show="target === 'user' || target === 'event'" class="_gaps_s">
					<div :class="$style.choiceField" role="group" :aria-label="i18n.ts._search.searchScope">
						<span>{{ i18n.ts._search.searchScope }}</span>
						<button type="button" :class="$style.choiceTrigger" :aria-label="i18n.ts._search.searchScope" :aria-expanded="choice === 'origin'" :aria-controls="choiceId" @click="openChoice('origin', $event)">{{ selectLabel(userOriginDef, userOrigin) }}<i class="ti ti-chevron-down" aria-hidden="true"/></button>
					</div>
					<div v-show="target === 'event'" class="_gaps_s">
						<div :class="$style.choiceField" role="group" :aria-label="i18n.ts.sort">
							<span>{{ i18n.ts.sort }}</span>
							<button type="button" :class="$style.choiceTrigger" :aria-label="i18n.ts.sort" :aria-expanded="choice === 'eventSort'" :aria-controls="choiceId" @click="openChoice('eventSort', $event)">{{ selectLabel(eventSortDef, eventSort) }}<i class="ti ti-chevron-down" aria-hidden="true"/></button>
						</div>
						<MkInput v-model="eventStartDate" small type="date"><template #label>{{ i18n.ts._event.startDate }}</template></MkInput>
						<MkInput v-model="eventEndDate" small type="date"><template #label>{{ i18n.ts._event.endDate }}</template></MkInput>
					</div>
				</div>
			</div>
			<div :class="$style.embeddedResults" :aria-label="i18n.ts.searchResult" role="region">
				<p v-if="emptySearchResult" :class="$style.embeddedEmpty">{{ emptyResultText }}</p>
				<template v-if="target === 'note'">
					<MkInfo v-if="!notesSearchAvailable" warn>{{ i18n.ts.notesSearchNotAvailable }}</MkInfo>
					<MkNotesTimeline v-else-if="notePaginator" v-show="!emptySearchResult" :key="`searchNotes:${searchKey}`" :paginator="notePaginator" :pullToRefresh="false" :withControl="false"/>
				</template>
				<template v-else-if="target === 'user'">
					<MkInfo v-if="!usersSearchAvailable" warn>{{ i18n.ts.usersSearchNotAvailable }}</MkInfo>
					<MkUserList v-else-if="userPaginator" v-show="!emptySearchResult" :key="`searchUsers:${searchKey}`" :paginator="userPaginator"/>
				</template>
				<MkNotesTimeline v-else-if="eventPaginator" v-show="!emptySearchResult" :key="`searchEvents:${searchKey}`" :paginator="eventPaginator" :getDate="eventSort === 'startDate' ? note => note.event?.start : undefined" :pullToRefresh="false" :withControl="false"/>
			</div>
		</div>
	</div>
</div>
<PageWithHeader v-else ref="searchPage" :actions="headerActions" :class="$style.searchPage" :data-mobile="isMobileSearch">
	<div class="_spacer" style="--MI_SPACER-w: 800px;">
		<div class="_gaps">
			<!-- 画面内の contain/transform に固定位置を引きずられないようにする。 -->
			<Teleport to="body" :disabled="!isMobileSearch || !pageActive">
				<Transition :css="false" @enter="enterSearchBar" @leave="leaveSearchBar" @enterCancelled="cancelSearchMotion" @leaveCancelled="cancelSearchMotion">
					<div
						v-show="searchVisible" :id="searchControlsId" ref="searchControlsEl" :class="$style.searchControls"
						:data-mobile="isMobileSearch" :data-docked="searchDocked" :style="searchPosition"
						:inert="!searchVisible" :aria-hidden="!searchVisible" role="search" @keydown.esc.stop.prevent="closeSearchBar"
					>
						<!-- ===== 旗鯖カプセル型 検索バー ===== -->
						<!-- 入力欄と条件は開閉中も同じインスタンスを保つ。 -->
						<div :class="$style.capsule">
							<!-- 検索対象プルダウン -->
							<button
								ref="targetMenuBtn"
								type="button"
								:class="$style.target"
								:aria-label="i18n.ts._search.searchTarget"
								@click="openTargetMenu"
							>
								<i :class="targetIconClass"/>
								<span :class="$style.targetLabel">{{ targetLabel }}</span>
								<i class="ti ti-chevron-down" :class="$style.targetChevron"/>
							</button>

							<!-- 検索チップ入力 -->
							<input
								ref="queryInputEl"
								v-model="searchQuery"
								type="search"
								:class="$style.queryInput"
								:placeholder="queryPlaceholder"
								:aria-label="i18n.ts.search" :autofocus="true"
								@compositionstart="composing = true" @compositionend="composing = false" @keydown.enter="onEnter"
							/>

							<!-- クリアボタン(クエリがあるときのみ) -->
							<button
								v-if="searchQuery !== ''"
								type="button"
								:class="$style.clearBtn"
								tabindex="-1"
								:aria-label="i18n.ts.clear"
								@click="clearQuery"
							>
								<i class="ti ti-x"/>
							</button>

							<!-- 検索ボタン(テーマカラー) -->
							<button
								type="button"
								:class="$style.searchBtn"
								:aria-label="i18n.ts.search"
								@click="executeSearch"
							>
								<i class="ti ti-search"/>
							</button>

							<!-- オプション(設定)ボタン -->
							<button
								ref="optionsBtn"
								type="button"
								:class="[$style.optionsBtn, { [$style.optionsBtnActive]: optionsOpen }]"
								:aria-label="i18n.ts.options"
								@click="toggleOptions"
							>
								<i class="ti ti-adjustments-horizontal"/>
							</button>
						</div>

						<!-- ===== オプションパネル(展開時) ===== -->
						<div v-if="optionsOpen" :class="$style.optionsPanel" class="_panel">
							<!-- ノート検索オプション -->
							<template v-if="target === 'note'">
								<MkSelect v-model="noteScope" :items="noteScopeDef" small>
									<template #label>{{ i18n.ts._search.searchScope }}</template>
								</MkSelect>

								<div v-if="instance.federation !== 'none' && noteScope === 'server'" :class="$style.subOption">
									<MkInput
										v-model="hostInput"
										:placeholder="i18n.ts._search.serverHostPlaceholder"
										@enter.prevent="executeSearch"
									>
										<template #label>{{ i18n.ts._search.pleaseEnterServerHost }}</template>
										<template #prefix><i class="ti ti-server"/></template>
									</MkInput>
								</div>

								<div v-if="noteScope === 'user'" :class="$style.subOption">
									<div :class="$style.userSelectLabel">{{ i18n.ts._search.pleaseSelectUser }}</div>
									<div v-if="user == null" :class="$style.userSelectButtons">
										<MkButton v-if="$i != null" transparent :class="$style.userSelectButton" @click="selectSelf">
											<div :class="$style.userSelectButtonInner">
												<span><i class="ti ti-plus"/><i class="ti ti-user"/></span>
												<span>{{ i18n.ts.selectSelf }}</span>
											</div>
										</MkButton>
										<MkButton transparent :class="$style.userSelectButton" @click="selectUser">
											<div :class="$style.userSelectButtonInner">
												<span><i class="ti ti-plus"/></span>
												<span>{{ i18n.ts.selectUser }}</span>
											</div>
										</MkButton>
									</div>
									<div v-else :class="$style.userSelected">
										<MkUserCardMini :user="user"/>
										<button type="button" :class="$style.userRemoveBtn" @click="removeUser">
											<i class="ti ti-x"/>
										</button>
									</div>
								</div>

								<!-- 旗鯖fork: 本家 2026.6.0 から取り込み: ノート検索で投稿日時の期間を条件に加えられるように (#16035) -->
								<div :class="$style.subOption">
									<MkInput v-model="rangeStartAt" small style="margin-top: 10px;" type="datetime-local">
										<template #label>{{ i18n.ts._search.postFrom }}</template>
									</MkInput>
									<MkInput v-model="rangeEndAt" small style="margin-top: 10px;" type="datetime-local">
										<template #label>{{ i18n.ts._search.postTo }}</template>
									</MkInput>
								</div>
							</template>

							<!-- ユーザー検索オプション -->
							<template v-else-if="target === 'user'">
								<MkSelect v-model="userOrigin" :items="userOriginDef" small @update:modelValue="executeSearch()">
									<template #label>{{ i18n.ts._search.searchScope }}</template>
								</MkSelect>
							</template>

							<!-- イベント検索オプション(CherryPick独自) -->
							<template v-else-if="target === 'event'">
								<MkSelect v-model="userOrigin" :items="userOriginDef" small @update:modelValue="executeSearch()">
									<template #label>{{ i18n.ts._search.searchScope }}</template>
								</MkSelect>
								<div :class="$style.subOption">
									<MkSelect v-model="eventSort" :items="eventSortDef" small>
										<template #label>{{ i18n.ts.sort }}</template>
									</MkSelect>
									<MkInput v-model="eventStartDate" small style="margin-top: 10px;" type="date">
										<template #label>{{ i18n.ts._event.startDate }}</template>
									</MkInput>
									<MkInput v-model="eventEndDate" small style="margin-top: 10px;" type="date">
										<template #label>{{ i18n.ts._event.endDate }}</template>
									</MkInput>
								</div>
							</template>
						</div>
					</div>
				</Transition>
			</Teleport>

			<!-- ===== 検索結果 ===== -->
			<!-- ノート結果 -->
			<div v-if="target === 'note'">
				<div v-if="!notesSearchAvailable">
					<MkInfo warn>{{ i18n.ts.notesSearchNotAvailable }}</MkInfo>
				</div>
				<MkFoldableSection v-else-if="notePaginator">
					<template #header>{{ i18n.ts.searchResult }}</template>
					<MkNotesTimeline :key="`searchNotes:${searchKey}`" :paginator="notePaginator"/>
				</MkFoldableSection>
			</div>

			<!-- ユーザー結果 -->
			<div v-else-if="target === 'user'">
				<div v-if="!usersSearchAvailable">
					<MkInfo warn>{{ i18n.ts.usersSearchNotAvailable }}</MkInfo>
				</div>
				<MkFoldableSection v-else-if="userPaginator">
					<template #header>{{ i18n.ts.searchResult }}</template>
					<MkUserList :key="`searchUsers:${searchKey}`" :paginator="userPaginator"/>
				</MkFoldableSection>
			</div>

			<!-- イベント結果 -->
			<div v-else-if="target === 'event'">
				<MkFoldableSection v-if="eventPaginator">
					<template #header>{{ i18n.ts.searchResult }}</template>
					<MkNotesTimeline :key="`searchEvents:${searchKey}`" :paginator="eventPaginator" :getDate="eventSort === 'startDate' ? note => note.event?.start : undefined"/>
				</MkFoldableSection>
			</div>
			<div v-if="isMobileSearch && hasSearchResults" :class="$style.resultsClearance" aria-hidden="true"></div>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, inject, markRaw, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, shallowRef, toRef, useId, useTemplateRef, watch } from 'vue';
import type * as Misskey from 'cherrypick-js';
import type { MkSelectItem } from '@/components/MkSelect.vue';
import type { PageHeaderItem } from '@/types/page-header.js';
import MkInput from '@/components/MkInput.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkFoldableSection from '@/components/MkFoldableSection.vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import MkUserList from '@/components/MkUserList.vue';
import MkUserCardMini from '@/components/MkUserCardMini.vue';
import { Paginator } from '@/utility/paginator.js';
import { DI } from '@/di.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { $i } from '@/i.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { useRouter } from '@/router.js';
import { definePage } from '@/page.js';
import { notesSearchAvailable, usersSearchAvailable } from '@/utility/check-permissions.js';
import { deviceKind } from '@/utility/device-kind.js';
import { prefer } from '@/preferences.js';
import { host as localHost } from '@@/js/config.js';

const props = withDefaults(defineProps<{
	query?: string;
	userId?: string;
	username?: string;
	host?: string | null;
	type?: 'note' | 'user' | 'event';
	origin?: 'combined' | 'local' | 'remote';
	embedded?: boolean;
	active?: boolean;
	maxHeight?: number;
	motion?: boolean;
}>(), {
	query: '',
	userId: undefined,
	username: undefined,
	host: undefined,
	type: 'note',
	origin: 'combined',
	embedded: false,
	active: true,
	maxHeight: 386,
	motion: true,
});

const emit = defineEmits<{
	height: [height: number];
	close: [];
}>();
defineExpose({ focus });

const router = useRouter();
let searchGeneration = 0;
let focusGeneration = 0;
let disposed = false;

// ===== 検索対象 =====
type SearchTarget = 'note' | 'user' | 'event';
const target = ref<SearchTarget>(toRef(props, 'type').value);

const targetItems: { value: SearchTarget; label: string; icon: string }[] = [
	{ value: 'note', label: i18n.ts.notes, icon: 'ti ti-pencil' },
	{ value: 'user', label: i18n.ts.users, icon: 'ti ti-users' },
	{ value: 'event', label: i18n.ts.events, icon: 'ti ti-calendar' },
];

const targetLabel = computed(() => targetItems.find(t => t.value === target.value)?.label ?? '');
const targetIconClass = computed(() => targetItems.find(t => t.value === target.value)?.icon ?? '');

function openTargetMenu(ev: MouseEvent) {
	const items = targetItems.map(t => ({
		type: 'button' as const,
		text: t.label,
		icon: t.icon,
		active: t.value === target.value,
		action: () => {
			target.value = t.value;
		},
	}));
	os.popupMenu(items, ev.currentTarget ?? ev.target);
}

// ===== 検索クエリ =====
const searchQuery = ref(toRef(props, 'query').value);
const queryInputEl = useTemplateRef('queryInputEl');
const composing = ref(false);

const queryPlaceholder = computed(() => {
	switch (target.value) {
		case 'note': return i18n.ts._search.notePlaceholder;
		case 'user': return i18n.ts._search.userPlaceholder;
		case 'event': return i18n.ts._search.eventPlaceholder;
		default: return i18n.ts.search;
	}
});

function clearQuery() {
	if (props.embedded && !props.active) return;
	searchQuery.value = '';
	queryInputEl.value?.focus({ preventScroll: true });
}

function onEnter(event: KeyboardEvent) {
	if (event.isComposing || composing.value || event.keyCode === 229) return;
	event.preventDefault();
	executeSearch();
}

// ===== オプション展開 =====
const optionsOpen = ref(false);

function toggleOptions() {
	if (props.embedded && !props.active) return;
	closeChoice(false);
	optionsOpen.value = !optionsOpen.value;
}

// ===== ノート検索: scope ===== //
const noteSearchableScope = computed(() => instance.noteSearchableScope ?? 'local');

const noteScopeDef = computed<MkSelectItem[]>(() => {
	const items: MkSelectItem[] = [];
	if (instance.federation !== 'none' && noteSearchableScope.value === 'global') {
		items.push({ label: i18n.ts._search.searchScopeAll, value: 'all' });
	}
	items.push({ label: instance.federation === 'none' ? i18n.ts._search.searchScopeAll : i18n.ts._search.searchScopeLocal, value: 'local' });
	if (instance.federation !== 'none' && noteSearchableScope.value === 'global') {
		items.push({ label: i18n.ts._search.searchScopeServer, value: 'server' });
	}
	items.push({ label: i18n.ts._search.searchScopeUser, value: 'user' });
	return items;
});

const hostInput = ref(toRef(props, 'host').value ?? '');
const user = shallowRef<Misskey.entities.UserDetailed | null>(null);

// 旗鯖fork: 本家 2026.6.0 から取り込み: ノート検索で投稿日時の期間を条件に加えられるように (#16035)
const rangeStartAt = ref<string | null>(null);
const rangeEndAt = ref<string | null>(null);

// プロフィール検索ボタン経由で username/userId が指定されたとき、初期化処理
let fetchedUser: Misskey.entities.UserDetailed | null = null;
if (props.userId) {
	fetchedUser = await misskeyApi('users/show', { userId: props.userId }).catch(() => null);
}
if (props.username && fetchedUser == null) {
	fetchedUser = await misskeyApi('users/show', {
		username: props.username,
		...(props.host ? { host: props.host } : {}),
	}).catch(() => null);
}
if (fetchedUser != null) {
	if (!(noteSearchableScope.value === 'local' && fetchedUser.host != null)) {
		user.value = fetchedUser;
	}
}

type NoteScope = 'all' | 'local' | 'server' | 'user';
const preferredNoteScope: NoteScope = (() => {
	if (user.value != null) return 'user';
	if (noteSearchableScope.value === 'local') return 'local';
	if (hostInput.value) return 'server';
	return 'all';
})();
const noteScope = ref<NoteScope>(noteScopeDef.value.some(item => 'value' in item && item.value === preferredNoteScope) ? preferredNoteScope : 'local');
watch(noteScopeDef, items => {
	if (!items.some(item => 'value' in item && item.value === noteScope.value)) noteScope.value = 'local';
}, { flush: 'sync' });

// プロフィール検索経由で来た場合は最初からオプションパネルを開く(ユーザーが見えるように)
if (user.value != null) {
	optionsOpen.value = true;
}

function selectSelf() {
	user.value = $i;
}

function selectUser() {
	os.selectUser({
		includeSelf: true,
		localOnly: instance.noteSearchableScope === 'local',
	}).then(_user => {
		user.value = _user;
	});
}

function removeUser() {
	user.value = null;
}

// ===== ユーザー検索: origin ===== //
const userOriginDef = computed<MkSelectItem[]>(() => [
	{ label: i18n.ts.all, value: 'combined' },
	{ label: i18n.ts.local, value: 'local' },
	{ label: i18n.ts.remote, value: 'remote' },
]);
const userOrigin = ref(toRef(props, 'origin').value);

// ===== イベント検索 ===== //
const eventSortDef = computed<MkSelectItem[]>(() => [
	{ label: i18n.ts._event.startDate, value: 'startDate' },
	{ label: i18n.ts.reverseChronological, value: 'createdAt' },
]);
const eventSort = ref<'startDate' | 'createdAt'>('startDate');
const eventStartDate = ref<string | null>(null);
const eventEndDate = ref<string | null>(null);

// ===== Paginator ===== //
const searchKey = ref(0);
const notePaginator = shallowRef<Paginator<'notes/search'> | null>(null);
const userPaginator = shallowRef<Paginator<'users/search'> | null>(null);
const eventPaginator = shallowRef<Paginator<'notes/events/search'> | null>(null);

// Embedded mode shares the controller and result components with /search.
type ChoiceKind = 'target' | 'noteScope' | 'origin' | 'eventSort';
const choice = ref<ChoiceKind | null>(null);
const choiceId = useId();
const conditionsId = useId();
const embeddedRootEl = useTemplateRef('embeddedRootEl');
const embeddedRowEl = useTemplateRef('embeddedRowEl');
const embeddedPaneEl = useTemplateRef('embeddedPaneEl');
const embeddedScrollEl = useTemplateRef('embeddedScrollEl');
const choicePaneEl = useTemplateRef('choicePaneEl');
const embeddedOptionsBtn = useTemplateRef('embeddedOptionsBtn');
let choiceOpener: HTMLElement | null = null;
let paneScrollTop = 0;
let lastEmbeddedHeight: number | null = null;
const embeddedMaxHeight = computed(() => Number.isFinite(props.maxHeight) ? Math.max(0, props.maxHeight) : 386);
const embeddedActive = computed(() => props.embedded && props.active && pageActive.value && !disposed);
const currentPaginator = computed(() => target.value === 'note' ? notePaginator.value : target.value === 'user' ? userPaginator.value : eventPaginator.value);
const emptySearchResult = computed(() => {
	const paginator = currentPaginator.value;
	return paginator != null && !paginator.fetching.value && !paginator.error.value && paginator.items.value.length === 0;
});
const emptyResultText = computed(() => target.value === 'user' ? i18n.ts.noUsers : i18n.ts.noNotes);

function flatChoices(items: MkSelectItem[]) {
	return items.flatMap(item => item.type === 'group' ? item.items : [item]);
}

function selectLabel(items: MkSelectItem[], value: string) {
	return flatChoices(items).find(item => item.value === value)?.label ?? '';
}

const choiceTitle = computed(() => choice.value === 'target' ? i18n.ts._search.searchTarget : choice.value === 'eventSort' ? i18n.ts.sort : i18n.ts._search.searchScope);
const choiceItems = computed(() => {
	switch (choice.value) {
		case 'target': return targetItems;
		case 'noteScope': return flatChoices(noteScopeDef.value);
		case 'origin': return flatChoices(userOriginDef.value);
		case 'eventSort': return flatChoices(eventSortDef.value);
		default: return [];
	}
});
const choiceValue = computed(() => {
	switch (choice.value) {
		case 'target': return target.value;
		case 'noteScope': return noteScope.value;
		case 'origin': return userOrigin.value;
		case 'eventSort': return eventSort.value;
		default: return null;
	}
});

function revealChoice(button: HTMLElement) {
	const scroller = embeddedScrollEl.value;
	if (!scroller || !embeddedActive.value) return;
	const bounds = scroller.getBoundingClientRect();
	const item = button.getBoundingClientRect();
	if (item.top < bounds.top) scroller.scrollTop -= bounds.top - item.top;
	else if (item.bottom > bounds.bottom) scroller.scrollTop += item.bottom - bounds.bottom;
}

function openChoice(kind: ChoiceKind, event: MouseEvent) {
	if (!embeddedActive.value) return;
	if (choice.value === kind) { closeChoice(); return; }
	if (choice.value == null) paneScrollTop = embeddedScrollEl.value?.scrollTop ?? 0;
	choiceOpener = event.currentTarget as HTMLElement;
	choice.value = kind;
	const generation = ++focusGeneration;
	void nextTick(() => {
		if (!embeddedActive.value || generation !== focusGeneration) return;
		const selected = choicePaneEl.value?.querySelector<HTMLElement>('[aria-pressed="true"]');
		selected?.focus({ preventScroll: true });
		if (selected) revealChoice(selected);
	});
}

function closeChoice(restoreFocus = true) {
	if (choice.value == null) return;
	choice.value = null;
	const opener = choiceOpener;
	const generation = ++focusGeneration;
	void nextTick(() => {
		if (!embeddedActive.value || generation !== focusGeneration) return;
		if (embeddedScrollEl.value) embeddedScrollEl.value.scrollTop = paneScrollTop;
		if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
	});
}

function applyChoice(value: string | number | null) {
	if (!embeddedActive.value || !choiceItems.value.some(item => item.value === value)) return;
	const changed = value !== choiceValue.value;
	const kind = choice.value;
	if (kind === 'target') target.value = value as SearchTarget;
	else if (kind === 'noteScope') noteScope.value = value as typeof noteScope.value;
	else if (kind === 'origin') userOrigin.value = value as typeof userOrigin.value;
	else if (kind === 'eventSort') eventSort.value = value as typeof eventSort.value;
	closeChoice();
	if (kind === 'origin' && changed) void executeSearch();
}

function onChoiceKeydown(event: KeyboardEvent) {
	if (!embeddedActive.value || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
	const buttons = Array.from(choicePaneEl.value?.querySelectorAll<HTMLElement>('[data-choice-value]') ?? []);
	const index = buttons.indexOf(event.target as HTMLElement);
	if (index < 0) return;
	event.preventDefault();
	const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
	buttons[next].focus({ preventScroll: true });
	revealChoice(buttons[next]);
}

function onEmbeddedKeydown(event: KeyboardEvent) {
	if (!embeddedActive.value || event.key !== 'Escape' || event.isComposing || composing.value) return;
	event.preventDefault();
	event.stopPropagation();
	if (choice.value != null) closeChoice();
	else if (optionsOpen.value) {
		optionsOpen.value = false;
		embeddedOptionsBtn.value?.focus({ preventScroll: true });
	} else emit('close');
}

function focus() {
	if (!embeddedActive.value) return;
	const generation = ++focusGeneration;
	void nextTick(() => {
		if (!embeddedActive.value || generation !== focusGeneration) return;
		const selected = choice.value == null ? null : choicePaneEl.value?.querySelector<HTMLElement>('[aria-pressed="true"]');
		(selected ?? queryInputEl.value)?.focus({ preventScroll: true });
	});
}

function measureEmbeddedHeight() {
	if (disposed || !embeddedActive.value || !embeddedRowEl.value) return;
	// The panes are unconstrained children of the scrollport: never measure its old animated height.
	const pane = choice.value == null ? embeddedPaneEl.value : choicePaneEl.value;
	const height = Math.min(embeddedMaxHeight.value, Math.ceil(embeddedRowEl.value.offsetHeight + (pane?.offsetHeight ?? 0)));
	if (height !== lastEmbeddedHeight) {
		lastEmbeddedHeight = height;
		emit('height', height);
	}
}

// モバイルの検索欄は、検索後に既存ヘッダーの右端へ収納する。
const searchPage = useTemplateRef<{ $el: HTMLElement }>('searchPage');
const searchControlsEl = useTemplateRef('searchControlsEl');
const searchControlsId = useId();
const searchActionId = useId();
const inWindow = inject<boolean>('inWindow', false);
const contained = inject(DI.pageControlsContained, computed(() => false));
const compactWidth = ref(window.innerWidth <= 600);
const isMobileSearch = computed(() => !props.embedded && !inWindow && !contained.value && (deviceKind === 'smartphone' || compactWidth.value));
const hasSearchResults = computed(() => Boolean(target.value === 'note' ? notePaginator.value : target.value === 'user' ? userPaginator.value : eventPaginator.value));
const searchOpen = ref(true);
const searchDocked = ref(false);
const pageActive = ref(true);
const searchVisible = computed(() => pageActive.value && (!isMobileSearch.value || searchOpen.value));
const searchPosition = ref<Record<string, string>>({});
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let searchMotion: Animation | null = null;
let motionGeneration = 0;

function searchActionElement() {
	return window.document.getElementById(searchActionId);
}

function positionSearchBar() {
	if (props.embedded) return;
	const page = searchPage.value?.$el;
	const anchor = searchActionElement();
	if (!page || !pageActive.value) return;
	const bounds = page.getBoundingClientRect();
	const button = anchor?.getBoundingClientRect();
	searchPosition.value = {
		...(button ? { '--search-dock-top': `${button.bottom + 8}px` } : {}),
		'--search-dock-left': `${Math.max(0, bounds.left) + 12}px`,
		'--search-dock-width': `${Math.max(0, Math.min(bounds.right, window.innerWidth) - Math.max(0, bounds.left) - 24)}px`,
	};
}

function cancelSearchMotion() {
	motionGeneration++;
	searchMotion?.cancel();
	searchMotion = null;
}

async function animateSearchBar(element: Element, done: () => void, opening: boolean) {
	cancelSearchMotion();
	const generation = motionGeneration;
	const bar = element as HTMLElement;
	const finish = () => {
		if (generation !== motionGeneration) return;
		searchMotion = null;
		if (!opening) searchDocked.value = true;
		done();
	};
	// 初回の検索ではこの更新でヘッダーのボタンが描画される。
	await nextTick();
	if (generation !== motionGeneration) return;
	const anchor = searchActionElement();
	if (!pageActive.value || !isMobileSearch.value || !prefer.r.animation.value || reducedMotion.matches || !anchor || typeof bar.animate !== 'function') {
		finish();
		return;
	}
	const bounds = bar.getBoundingClientRect();
	const button = anchor.getBoundingClientRect();
	if (!bounds.width || !bounds.height) {
		finish();
		return;
	}
	const stored = {
		transform: `translate(${button.left - bounds.left}px, ${button.top - bounds.top}px) scale(${button.width / bounds.width}, ${button.height / bounds.height})`,
		opacity: 0,
	};
	const expanded = { transform: 'none', opacity: 1 };
	searchMotion = bar.animate(opening ? [stored, expanded] : [expanded, stored], {
		duration: opening ? 300 : 240,
		easing: 'cubic-bezier(.22, 1, .36, 1)',
	});
	searchMotion.finished.then(finish, finish);
}

function enterSearchBar(element: Element, done: () => void) {
	void animateSearchBar(element, done, true);
}

function leaveSearchBar(element: Element, done: () => void) {
	void animateSearchBar(element, done, false);
}

function focusSearchControl() {
	if (!isMobileSearch.value || !pageActive.value || disposed) return;
	if (searchOpen.value) {
		if (searchControlsEl.value) searchControlsEl.value.scrollTop = 0;
		queryInputEl.value?.focus({ preventScroll: true });
	} else {
		searchActionElement()?.focus({ preventScroll: true });
	}
}

async function closeSearchBar() {
	if (!isMobileSearch.value || (!hasSearchResults.value && !searchDocked.value)) return;
	queryInputEl.value?.blur();
	searchOpen.value = false;
	await nextTick();
	focusSearchControl();
}

async function toggleSearchBar() {
	if (searchOpen.value) {
		await closeSearchBar();
		return;
	}
	searchDocked.value = true;
	positionSearchBar();
	searchOpen.value = true;
	await nextTick();
	focusSearchControl();
}

const resizeObserver = props.embedded ? null : new ResizeObserver(entries => {
	const width = entries[0]?.contentRect.width;
	if (width) compactWidth.value = width <= 600;
	positionSearchBar();
});
const embeddedResizeObserver = props.embedded ? new ResizeObserver(measureEmbeddedHeight) : null;

onMounted(() => {
	if (props.embedded) {
		for (const element of [embeddedRowEl.value, embeddedPaneEl.value, choicePaneEl.value]) {
			if (element) embeddedResizeObserver?.observe(element);
		}
		measureEmbeddedHeight();
		return;
	}
	if (searchPage.value) resizeObserver?.observe(searchPage.value.$el);
	positionSearchBar();
	window.addEventListener('resize', positionSearchBar);
	window.visualViewport?.addEventListener('resize', positionSearchBar);
});

onActivated(() => {
	pageActive.value = true;
	void nextTick(props.embedded ? measureEmbeddedHeight : positionSearchBar);
});

onDeactivated(() => {
	searchGeneration++;
	focusGeneration++;
	queryInputEl.value?.blur();
	cancelSearchMotion();
	pageActive.value = false;
	searchOpen.value = !hasSearchResults.value;
});

onUnmounted(() => {
	disposed = true;
	searchGeneration++;
	focusGeneration++;
	cancelSearchMotion();
	resizeObserver?.disconnect();
	embeddedResizeObserver?.disconnect();
	window.removeEventListener('resize', positionSearchBar);
	window.visualViewport?.removeEventListener('resize', positionSearchBar);
});

watch(() => props.active, active => {
	if (!props.embedded || active) return;
	searchGeneration++;
	focusGeneration++;
	lastEmbeddedHeight = null;
	// Do not steal focus from a user lookup dialog; only blur an input owned by this panel.
	if (embeddedRootEl.value?.contains(window.document.activeElement)) (window.document.activeElement as HTMLElement)?.blur();
}, { flush: 'sync' });

watch([() => props.active, embeddedMaxHeight, choice, optionsOpen, target, hasSearchResults, emptySearchResult], () => {
	measureEmbeddedHeight();
}, { flush: 'post' });

watch(isMobileSearch, mobile => {
	searchOpen.value = !mobile || !hasSearchResults.value;
	searchDocked.value = mobile && hasSearchResults.value;
});

const fixHostIfLocal = (hostStr: string | null | undefined) => {
	if (!hostStr || hostStr === localHost) return '.';
	return hostStr;
};

async function executeSearch() {
	if (disposed || !pageActive.value || (props.embedded && !props.active)) return;
	const query = searchQuery.value.toString().trim();
	if (!query && target.value !== 'event') return;
	const generation = ++searchGeneration;
	const current = () => !disposed && pageActive.value && (!props.embedded || props.active) && generation === searchGeneration;

	// ===== AP lookup / @mention / #tag のショートカット ===== //
	if (query.startsWith('https://') && !query.includes(' ')) {
		const confirm = await os.confirm({ type: 'info', text: i18n.ts.lookupConfirm });
		if (!current()) return;
		if (!confirm.canceled) {
			const promise = misskeyApi('ap/show', { uri: query });
			os.promiseDialog(promise, null, null, i18n.ts.fetchingAsApObject);
			const res = await promise;
			if (!current()) return;
			if (res.type === 'User') {
				router.push('/@:acct/:page?', {
					params: { acct: `${res.object.username}@${res.object.host}` },
				});
			} else if (res.type === 'Note') {
				router.push('/notes/:noteId/:initialTab?', {
					params: { noteId: res.object.id },
				});
			}
			return;
		}
	}

	if (query.length > 1 && !query.includes(' ')) {
		if (query.startsWith('@')) {
			const confirm = await os.confirm({ type: 'info', text: i18n.ts.lookupConfirm });
			if (!current()) return;
			if (!confirm.canceled) {
				router.pushByPath(`/${query}`);
				return;
			}
		}
		if (query.startsWith('#')) {
			const confirm = await os.confirm({ type: 'info', text: i18n.ts.openTagPageConfirm });
			if (!current()) return;
			if (!confirm.canceled) {
				router.push('/tags/:tag', { params: { tag: query.substring(1) } });
				return;
			}
		}
	}

	// ===== 対象別の検索 ===== //
	if ((target.value === 'note' && !notesSearchAvailable) || (target.value === 'user' && !usersSearchAvailable)) return;
	if (target.value === 'note') {
		const params: any = { query };
		if (noteScope.value === 'user') {
			if (user.value == null) return;
			params.host = fixHostIfLocal(user.value.host);
			params.userId = user.value.id;
		} else if (instance.federation !== 'none' && noteScope.value === 'server') {
			let trimmedHost = hostInput.value?.trim();
			if (!trimmedHost) return;
			if (trimmedHost.startsWith('https://') || trimmedHost.startsWith('http://')) {
				try { trimmedHost = new URL(trimmedHost).host; } catch (err) { /* empty */ }
			}
			params.host = fixHostIfLocal(trimmedHost);
		} else if (instance.federation === 'none' || noteScope.value === 'local') {
			params.host = '.';
		}
		// 旗鯖fork: 本家 2026.6.0 から取り込み: ノート検索で投稿日時の期間を条件に加えられるように (#16035)
		if (rangeStartAt.value) params.rangeStartAt = new Date(rangeStartAt.value).getTime();
		if (rangeEndAt.value) params.rangeEndAt = new Date(rangeEndAt.value).getTime();
		notePaginator.value = markRaw(new Paginator('notes/search', { limit: 10, params }));
	} else if (target.value === 'user') {
		userPaginator.value = markRaw(new Paginator('users/search', {
			limit: 10,
			offsetMode: true,
			params: {
				query,
				origin: instance.federation === 'none' ? 'local' : userOrigin.value,
			},
		}));
	} else if (target.value === 'event') {
		eventPaginator.value = markRaw(new Paginator('notes/events/search', {
			limit: 10,
			offsetMode: true,
			params: {
				query: query || undefined,
				sortBy: eventSort.value,
				sinceDate: eventStartDate.value ? (new Date(eventStartDate.value)).getTime() : undefined,
				untilDate: eventEndDate.value ? (new Date(eventEndDate.value)).getTime() + 1000 * 3600 * 24 : undefined,
				origin: userOrigin.value,
			},
		}));
	}

	searchKey.value++;
	if (!props.embedded) void closeSearchBar();
}

// 対象が変わったときに、結果はリセット(混乱回避)
watch(target, () => {
	searchGeneration++;
	notePaginator.value = null;
	userPaginator.value = null;
	eventPaginator.value = null;
	searchOpen.value = true;
});

const headerActions = computed<PageHeaderItem[]>(() => isMobileSearch.value && (hasSearchResults.value || searchDocked.value) ? [{
	id: searchActionId,
	text: i18n.ts.search,
	icon: 'ti ti-search',
	controls: searchControlsId,
	expanded: searchOpen.value,
	highlighted: searchOpen.value,
	handler: toggleSearchBar,
}] : []);

if (!props.embedded) {
	definePage(() => ({
		title: i18n.ts.search,
		icon: 'ti ti-search',
	}));
}
</script>

<style lang="scss" module>
:global(html[data-hk3-ui]) .searchPage,
:global(html[data-hk3-ui]) .embedded {
	--MI-notes-canvas: transparent;
	--MI-notes-surface: var(--hk3-glass-note, color-mix(in srgb, var(--MI_THEME-panel) 70%, transparent));
	--MI-notes-backdrop-filter: var(--MI-blur, blur(20px)) saturate(1.3);
}

:global(html[data-hk3-ui]) .embedded {
	// The dock already supplies the glass backdrop; avoid stacking two dense panels.
	--MI-notes-surface: var(--hk3-glass-soft, color-mix(in srgb, var(--MI_THEME-panel) 30%, transparent));
}

.searchPage[data-mobile='true'] {
	scroll-padding-bottom: var(--MI-minBottomSpacingMobile);
}

.searchControls {
	display: flex;
	flex-direction: column;
	gap: var(--MI-margin);
	transform-origin: top left;
}

.searchControls[data-mobile='true'] {
	position: fixed;
	left: var(--search-dock-left, 12px);
	width: var(--search-dock-width, calc(100% - 24px));
	bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
	z-index: 100;
	max-height: calc(100dvh - 180px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
	padding: 4px;
	box-sizing: border-box;
	overflow-y: auto;
	scrollbar-width: thin;
	border-radius: 32px;
}

.searchControls[data-mobile='true'][data-docked='true'] {
	top: var(--search-dock-top);
	left: var(--search-dock-left);
	width: var(--search-dock-width);
	right: auto;
	bottom: auto;
	max-height: calc(100dvh - var(--search-dock-top) - var(--MI-minBottomSpacingMobile) - 16px);
}

.searchControls[data-mobile='true'] .capsule {
	box-shadow: 0 4px 16px var(--MI_THEME-shadow);
}

.searchControls[data-mobile='true'] .targetLabel {
	display: none;
}

.searchControls[data-mobile='true'] .queryInput {
	font-size: 16px;
}

.searchControls[data-mobile='true'] .target,
.searchControls[data-mobile='true'] .searchBtn,
.searchControls[data-mobile='true'] .clearBtn,
.searchControls[data-mobile='true'] .optionsBtn {
	min-width: 44px;
	min-height: 44px;
	flex-shrink: 0;
}

.resultsClearance {
	flex-shrink: 0;
	height: var(--MI-minBottomSpacingMobile, calc(80px + env(safe-area-inset-bottom, 0px)));
}

/* ===== カプセル型検索バー ===== */
.capsule {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 6px 6px 6px 12px;
	background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 999px;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	transition: border-color 0.15s, box-shadow 0.15s;
}

.capsule:focus-within {
	border-color: var(--MI_THEME-accent);
	box-shadow: 0 0 0 3px color(from var(--MI_THEME-accent) srgb r g b / 0.15);
}

/* 検索対象プルダウン */
.target {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 10px;
	background: transparent;
	border: none;
	border-radius: 999px;
	font-size: 14px;
	color: var(--MI_THEME-fg);
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.1s;
}

.target:hover {
	background: color(from var(--MI_THEME-fg) srgb r g b / 0.06);
}

.targetLabel {
	font-weight: 500;
}

.targetChevron {
	font-size: 0.75em;
	opacity: 0.6;
}

/* 入力欄 */
.queryInput {
	flex: 1;
	min-width: 0;
	padding: 8px 4px;
	background: transparent;
	border: none;
	outline: none;
	color: var(--MI_THEME-fg);
	font-size: 15px;
	font-family: inherit;
}

.queryInput::placeholder {
	color: var(--MI_THEME-fgMuted, color(from var(--MI_THEME-fg) srgb r g b / 0.5));
}

/* クリアボタン */
.clearBtn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	background: transparent;
	border: none;
	border-radius: 50%;
	color: var(--MI_THEME-fg);
	opacity: 0.55;
	cursor: pointer;
	transition: opacity 0.1s, background 0.1s;
}

.clearBtn:hover {
	opacity: 1;
	background: color(from var(--MI_THEME-fg) srgb r g b / 0.08);
}

/* 検索ボタン(テーマカラー) */
.searchBtn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	background: var(--MI_THEME-accent);
	border: none;
	border-radius: 50%;
	color: var(--MI_THEME-fgOnAccent, #fff);
	cursor: pointer;
	transition: filter 0.1s, transform 0.05s;
}

.searchBtn:hover {
	filter: brightness(1.08);
}

.searchBtn:active {
	transform: scale(0.96);
}

/* オプションボタン */
.optionsBtn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	background: transparent;
	border: none;
	border-radius: 50%;
	color: var(--MI_THEME-fg);
	opacity: 0.7;
	cursor: pointer;
	transition: opacity 0.1s, background 0.1s;
}

.optionsBtn:hover {
	opacity: 1;
	background: color(from var(--MI_THEME-fg) srgb r g b / 0.08);
}

.optionsBtnActive {
	background: color(from var(--MI_THEME-accent) srgb r g b / 0.15);
	color: var(--MI_THEME-accent);
	opacity: 1;
}

/* ===== オプションパネル ===== */
.optionsPanel {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 16px;
	border-radius: var(--MI-radius);
}

.subOption {
	background: color(from var(--MI_THEME-fg) srgb r g b / 0.04);
	border-radius: var(--MI-radius);
	padding: var(--MI-margin);
}

.userSelectLabel {
	font-size: 0.85em;
	padding: 0 0 8px;
	user-select: none;
}

.userSelectButtons {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}

.userSelectButton {
	width: 100%;
	height: 100%;
	padding: 12px;
	border: 2px dashed color(from var(--MI_THEME-fg) srgb r g b / 0.4);
}

.userSelectButtonInner {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
}

.userSelected {
	display: grid;
	grid-template-columns: 1fr auto;
	align-items: center;
	gap: 8px;
}

.userRemoveBtn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	background: transparent;
	border: none;
	border-radius: 50%;
	color: var(--MI_THEME-error, #ff2a2a);
	cursor: pointer;
	transition: background 0.1s;
}

.userRemoveBtn:hover {
	background: color(from var(--MI_THEME-error, #ff2a2a) srgb r g b / 0.1);
}

.embedded {
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
	max-height: var(--embedded-search-max-height);
	overflow: hidden;
	border-radius: inherit;
	color: var(--MI_THEME-fg);

	.capsule,
	.capsule:focus-within {
		background: none;
		border: 0;
		box-shadow: none;
	}

	.target {
		gap: 4px;
		padding: 0 3px;
		min-height: 44px;
		font-size: 12px;
		flex-shrink: 0;
	}

	.queryInput {
		width: 0;
		font-size: 16px;
	}

	.searchBtn,
	.optionsBtn,
	.clearBtn {
		width: 38px;
		height: 44px;
		flex-shrink: 0;
		border-radius: 12px;
		background: none;
		color: var(--MI_THEME-accent);
	}

	.optionsBtn[aria-expanded='true'] {
		background: color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent);
	}

	button:focus-visible {
		outline: 2px solid var(--MI_THEME-accent);
		outline-offset: -2px;
	}
}

.embeddedRow {
	box-sizing: border-box;
	min-height: 59px;
	flex-shrink: 0;
	gap: 2px;
	padding: 6px 6px 3px;
}

.embeddedScroll {
	min-height: 0;
	overflow: auto;
	overscroll-behavior: contain;
	scrollbar-width: thin;

	> div {
		display: flow-root;
	}
}

.embeddedConditions {
	padding: 8px 12px 12px;
	border-top: 1px solid var(--MI_THEME-divider);
	border-radius: 0;
}

.embeddedResults {
	display: flow-root;
}

.embeddedEmpty {
	margin: 0;
	padding: 24px 12px;
	text-align: center;
	font-size: 13px;
	color: var(--MI_THEME-fgOnPanel);
}

.choicePane {
	box-sizing: border-box;
	padding: 3px 10px 10px;
	border-top: 1px solid var(--MI_THEME-divider);
}

.choiceHeading {
	display: grid;
	grid-template-columns: 34px minmax(0, 1fr) 34px;
	align-items: center;
	gap: 8px;
	min-height: 40px;

	strong {
		text-align: center;
		font-size: 12px;
	}
}

.choiceBack,
.choiceItem,
.choiceTrigger {
	font: inherit;
	color: inherit;
	border: 0;
	background: none;
	cursor: pointer;
}

.choiceBack {
	width: 34px;
	min-height: 34px;
	padding: 0;
	border-radius: 10px;
	color: var(--MI_THEME-accent);
}

.choiceItem {
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
	width: 100%;
	min-height: 44px;
	margin-top: 3px;
	padding: 8px 12px;
	border-radius: 12px;
	font-size: 13px;
	text-align: start;

	&:hover,
	&[aria-pressed='true'] {
		background: color-mix(in srgb, var(--MI_THEME-accent) 10%, transparent);
	}

	&[aria-pressed='true'] {
		color: var(--MI_THEME-accent);
	}
}

.choiceField {
	display: grid;
	gap: 4px;
	font-size: 12px;
}

.choiceTrigger {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	min-height: 34px;
	padding: 0 8px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 8px;
	text-align: start;
}

.embedded[data-motion='false'] :deep(*) {
	transition: none !important;
	animation: none !important;
	scroll-behavior: auto !important;
}

@media (prefers-reduced-motion: reduce) {
	.embedded :deep(*) {
		transition: none !important;
		animation: none !important;
		scroll-behavior: auto !important;
	}
}
</style>
