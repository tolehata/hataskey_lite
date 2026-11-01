<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div class="_gaps">
			<MkInfo>{{ i18n.ts._announcement.shouldNotBeUsedToPresentPermanentInfo }}</MkInfo>
			<MkInfo v-if="announcements.length > 5" warn>{{ i18n.ts._announcement.tooManyActiveAnnouncementDescription }}</MkInfo>

			<MkSelect v-model="announcementsStatus" :items="announcementsStatusDef">
				<template #label>{{ i18n.ts.filter }}</template>
			</MkSelect>

			<MkLoading v-if="loading"/>

			<template v-else>
				<MkFolder v-for="announcement in announcements" :key="announcement.id ?? announcement._id" :defaultOpen="announcement.id == null" :isArchived="announcement.id != null && !announcement.isActive">
					<template #label>{{ announcement.title }}</template>
					<template #icon>
						<i v-if="announcement.icon === 'info'" class="ti ti-info-circle"></i>
						<i v-else-if="announcement.icon === 'warning'" class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i>
						<i v-else-if="announcement.icon === 'error'" class="ti ti-circle-x" style="color: var(--MI_THEME-error);"></i>
						<i v-else-if="announcement.icon === 'success'" class="ti ti-check" style="color: var(--MI_THEME-success);"></i>
						<i v-else-if="announcement.icon === 'maintenance'" class="ti ti-tool" style="color: var(--MI_THEME-error);"></i>
					</template>
					<template #caption>
						<span :class="$style.announcementText">{{ announcement.text }}</span>
					</template>
					<template #suffix>
						<span v-if="announcement.autoArchiveAt" :class="$style.autoArchiveAt">
							<i class="ti ti-calendar-time"></i> {{ i18n.ts._announcement.autoArchiveAt }}: <MkTime :key="announcement.autoArchiveAt" :time="announcement.autoArchiveAt" mode="absolute"/>
						</span>
					</template>
					<template #footer>
						<div class="_buttons">
							<MkButton rounded primary @click="save(announcement)"><i class="ti ti-device-floppy"></i> {{ i18n.ts.save }}</MkButton>
							<MkButton v-if="announcement.id != null && announcement.isActive" rounded @click="archive(announcement)"><i class="ti ti-check"></i> {{ i18n.ts._announcement.end }} ({{ i18n.ts.archive }})</MkButton>
							<MkButton v-if="announcement.id != null && !announcement.isActive" rounded @click="unarchive(announcement)"><i class="ti ti-restore"></i> {{ i18n.ts.unarchive }}</MkButton>
							<MkButton v-if="announcement.id != null" rounded danger @click="del(announcement)"><i class="ti ti-trash"></i> {{ i18n.ts.delete }}</MkButton>
						</div>
					</template>

					<div class="_gaps">
						<MkInput v-model="announcement.title">
							<template #label>{{ i18n.ts.title }}</template>
						</MkInput>
						<MkTextarea v-model="announcement.text" mfmAutocomplete :mfmPreview="true">
							<template #label>{{ i18n.ts.text }}</template>
						</MkTextarea>
						<MkInput v-model="announcement.imageUrl" type="url">
							<template #label>{{ i18n.ts.imageUrl }}</template>
						</MkInput>
						<MkInput v-model="announcement.autoArchiveAt" type="datetime-local">
							<template #label>{{ i18n.ts._announcement.autoArchiveAt }}</template>
							<template #caption>{{ i18n.ts._announcement.autoArchiveAtDescription }}</template>
						</MkInput>
						<MkRadios v-model="announcement.icon">
							<template #label>{{ i18n.ts.icon }}</template>
							<option value="info"><i class="ti ti-info-circle"></i></option>
							<option value="warning"><i class="ti ti-alert-triangle" style="color: var(--MI_THEME-warn);"></i></option>
							<option value="error"><i class="ti ti-circle-x" style="color: var(--MI_THEME-error);"></i></option>
							<option value="success"><i class="ti ti-check" style="color: var(--MI_THEME-success);"></i></option>
							<option value="maintenance"><i class="ti ti-tool" style="color: var(--MI_THEME-error);"></i></option>
						</MkRadios>
						<MkInfo v-if="announcement.icon === 'maintenance'">{{ i18n.ts._announcement.maintenanceNote }}</MkInfo>
						<!-- 旗鯖fork: メンテナンス進捗バー(4段階) -->
						<div v-if="announcement.icon === 'maintenance'" :class="$style.progressBlock">
							<MkSwitch :modelValue="!!announcement.progressSteps" @update:modelValue="toggleProgress(announcement, $event)">
								{{ i18n.ts._hata._announcementCustom.showProgress }}
								<template #caption>{{ i18n.ts._hata._announcementCustom.progressCaption }}</template>
							</MkSwitch>
							<div v-if="announcement.progressSteps" :class="$style.progressSteps">
								<div v-for="(label, idx) in announcement.progressSteps" :key="idx" :class="$style.progressStepRow">
									<span :class="$style.progressStepNum">{{ (idx as number) + 1 }}</span>
									<MkInput v-model="announcement.progressSteps[(idx as number)]" :placeholder="i18n.tsx._hata._announcementCustom.stepLabel({ number: (idx as number) + 1 })" style="flex:1;"/>
									<MkSwitch :modelValue="(announcement.progressCompleted ?? [false,false,false,false])[(idx as number)]" @update:modelValue="setProgressCompleted(announcement, (idx as number), $event)">
										{{ i18n.ts._hata._announcementCustom.completed }}
									</MkSwitch>
								</div>
							</div>
						</div>
						<MkRadios v-model="announcement.display">
							<template #label>{{ i18n.ts.display }}</template>
							<option value="normal">{{ i18n.ts.normal }}</option>
							<option value="banner">{{ i18n.ts.banner }}</option>
							<option value="dialog">{{ i18n.ts.dialog }}</option>
						</MkRadios>
						<MkInfo v-if="announcement.display === 'dialog'" warn>{{ i18n.ts._announcement.dialogAnnouncementUxWarn }}</MkInfo>
						<MkSwitch v-model="announcement.forExistingUsers" :helpText="i18n.ts._announcement.forExistingUsersDescription">
							{{ i18n.ts._announcement.forExistingUsers }}
						</MkSwitch>
						<MkSwitch v-model="announcement.silence" :helpText="i18n.ts._announcement.silenceDescription">
							{{ i18n.ts._announcement.silence }}
						</MkSwitch>
						<MkSwitch v-model="announcement.needConfirmationToRead" :helpText="i18n.ts._announcement.needConfirmationToReadDescription">
							{{ i18n.ts._announcement.needConfirmationToRead }}
						</MkSwitch>
						<p v-if="announcement.reads">{{ i18n.tsx.nUsersRead({ n: announcement.reads }) }}</p>
					</div>
				</MkFolder>
				<MkLoading v-if="loadingMore"/>
				<MkButton @click="more()">
					<i class="ti ti-reload"></i> {{ i18n.ts.more }}
				</MkButton>
			</template>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import * as Misskey from 'cherrypick-js';
import type { ApiWithDialogCustomErrors } from '@/os.js';
import MkButton from '@/components/MkButton.vue';
import MkInput from '@/components/MkInput.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkRadios from '@/components/MkRadios.vue';
import MkInfo from '@/components/MkInfo.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkFolder from '@/components/MkFolder.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import { genId } from '@/utility/id.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import { formatDateTimeString } from '@/utility/format-time-string.js';

const {
	model: announcementsStatus,
	def: announcementsStatusDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.active, value: 'active' },
		{ label: i18n.ts.archived, value: 'archived' },
	],
	initialValue: 'active',
});

const loading = ref(true);
const loadingMore = ref(false);

const createAnnouncementErrors: ApiWithDialogCustomErrors = {
	'2a892bd5-487d-46a2-a5fe-3d85ad51defe': {
		title: i18n.ts._announcement.autoArchiveAt,
		text: i18n.ts._announcement.autoArchiveAtMustBeInFuture,
	},
};

type EditableAnnouncement = Omit<Misskey.entities.AdminAnnouncementsListResponse[number], 'id' | 'createdAt' | 'updatedAt' | 'reads' | 'isActive' | 'autoArchiveAt'> & {
	id: string | null;
	_id?: string;
	isActive?: Misskey.entities.AdminAnnouncementsListResponse[number]['isActive'];
	reads?: Misskey.entities.AdminAnnouncementsListResponse[number]['reads'];
	autoArchiveAt: string;
	originalAutoArchiveAt: Misskey.entities.AdminAnnouncementsListResponse[number]['autoArchiveAt'];
};

const announcements = ref<EditableAnnouncement[]>([]);

function toEditableAnnouncement(announcement: Misskey.entities.AdminAnnouncementsListResponse[number]): EditableAnnouncement {
	return {
		...announcement,
		autoArchiveAt: announcement.autoArchiveAt ? formatDateTimeString(new Date(announcement.autoArchiveAt), 'yyyy-MM-ddTHH:mm') : '',
		originalAutoArchiveAt: announcement.autoArchiveAt,
	};
}

function toAutoArchiveAt(value: string, originalValue: Misskey.entities.AdminAnnouncementsListResponse[number]['autoArchiveAt']): number | null {
	if (originalValue != null && value === formatDateTimeString(new Date(originalValue), 'yyyy-MM-ddTHH:mm')) {
		return new Date(originalValue).getTime();
	}

	return value === '' ? null : new Date(value).getTime();
}

watch(announcementsStatus, (to) => {
	loading.value = true;
	misskeyApi('admin/announcements/list', {
		status: to,
	}).then(announcementResponse => {
		announcements.value = announcementResponse.map(toEditableAnnouncement);
		loading.value = false;
	});
}, { immediate: true });

function add() {
	announcements.value.unshift({
		_id: genId(),
		id: null,
		title: 'New announcement',
		text: '',
		imageUrl: null,
		icon: 'info',
		display: 'normal',
		forExistingUsers: false,
		silence: false,
		needConfirmationToRead: false,
		// 旗鯖fork: メンテ進捗バー (icon === 'maintenance' のときのみ使用)
		progressSteps: null,
		progressCompleted: null,
		autoArchiveAt: '',
		originalAutoArchiveAt: null,
		userId: null,
	});
}

// 旗鯖fork: メンテ進捗バーのON/OFFと完了状態を切り替えるヘルパー
function toggleProgress(announcement: any, enabled: boolean) {
	if (enabled) {
		announcement.progressSteps = ['', '', '', ''];
		announcement.progressCompleted = [false, false, false, false];
	} else {
		announcement.progressSteps = null;
		announcement.progressCompleted = null;
	}
}
function setProgressCompleted(announcement: any, idx: number, completed: boolean) {
	if (!announcement.progressCompleted) {
		announcement.progressCompleted = [false, false, false, false];
	}
	announcement.progressCompleted[idx] = completed;
}

function del(announcement) {
	os.confirm({
		type: 'warning',
		text: i18n.tsx.deleteAreYouSure({ x: announcement.title }),
	}).then(({ canceled }) => {
		if (canceled) return;
		announcements.value = announcements.value.filter(x => x !== announcement);
		misskeyApi('admin/announcements/delete', announcement);
	});
}

async function archive(announcement: (typeof announcements)['value'][number]) {
	if (announcement.id == null) return;
	const { _id, id, autoArchiveAt, originalAutoArchiveAt, ...data } = announcement; // APIに不要な項目を消す
	await os.apiWithDialog('admin/announcements/update', {
		...data,
		id,
		isActive: false,
		autoArchiveAt: toAutoArchiveAt(autoArchiveAt, originalAutoArchiveAt),
	});
	refresh();
}

async function unarchive(announcement: (typeof announcements)['value'][number]) {
	if (announcement.id == null) return;
	const { _id, id, autoArchiveAt, originalAutoArchiveAt, ...data } = announcement; // APIに不要な項目を消す
	const autoArchiveAtMs = toAutoArchiveAt(autoArchiveAt, originalAutoArchiveAt);
	await os.apiWithDialog('admin/announcements/update', {
		...data,
		id,
		isActive: true,
		autoArchiveAt: autoArchiveAtMs != null && autoArchiveAtMs <= Date.now() ? null : autoArchiveAtMs,
	});
	refresh();
}

async function save(announcement: (typeof announcements)['value'][number]) {
	const { _id, id, isActive, reads, autoArchiveAt, originalAutoArchiveAt, ...data } = announcement; // APIに不要な項目を消す
	const autoArchiveAtMs = toAutoArchiveAt(autoArchiveAt, originalAutoArchiveAt);
	if (id == null) {
		if (autoArchiveAtMs != null && (Number.isNaN(autoArchiveAtMs) || autoArchiveAtMs <= Date.now())) {
			await os.alert({
				type: 'error',
				title: i18n.ts._announcement.autoArchiveAt,
				text: i18n.ts._announcement.autoArchiveAtMustBeInFuture,
			});
			return;
		}

		await os.apiWithDialog('admin/announcements/create', {
			...data,
			autoArchiveAt: autoArchiveAtMs,
		}, undefined, createAnnouncementErrors);
		refresh();
	} else {
		await os.apiWithDialog('admin/announcements/update', {
			...data,
			id,
			isActive,
			autoArchiveAt: autoArchiveAtMs,
		});
	}
}

function more() {
	loadingMore.value = true;
	misskeyApi('admin/announcements/list', {
		status: announcementsStatus.value,
		untilId: announcements.value.reduce((acc, announcement) => announcement.id != null ? announcement : acc).id ?? undefined,
	}).then(announcementResponse => {
		announcements.value = announcements.value.concat(announcementResponse.map(toEditableAnnouncement));
		loadingMore.value = false;
	});
}

function refresh() {
	loading.value = true;
	misskeyApi('admin/announcements/list', {
		status: announcementsStatus.value,
	}).then(announcementResponse => {
		announcements.value = announcementResponse.map(toEditableAnnouncement);
		loading.value = false;
	});
}

const headerActions = computed(() => [{
	asFullButton: true,
	icon: 'ti ti-plus',
	text: i18n.ts.add,
	handler: add,
	disabled: announcementsStatus.value === 'archived',
}]);

const headerTabs = computed(() => []);

definePage(() => ({
	title: i18n.ts.announcements,
	icon: 'ti ti-speakerphone',
}));
</script>

<style lang="scss" module>
/* 旗鯖fork: メンテナンス進捗バー設定UI */
.progressBlock {
	margin: 10px 0;
	padding: 12px;
	border-radius: 10px;
	background: var(--MI_THEME-bg);
	border: 1px solid var(--MI_THEME-divider);
}
.progressSteps {
	margin-top: 10px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.progressStepRow {
	display: flex;
	align-items: center;
	gap: 10px;
}
.progressStepNum {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border-radius: 50%;
	background: var(--MI_THEME-accent);
	color: var(--MI_THEME-fgOnAccent);
	font-weight: 700;
	font-size: 0.85em;
	flex-shrink: 0;
}

.announcementText {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.autoArchiveAt {
	white-space: nowrap;
}
</style>
