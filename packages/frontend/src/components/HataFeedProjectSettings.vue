<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<section :class="$style.section" aria-label="プロジェクト設定">
	<h2 :class="$style.title">プロジェクト</h2>
	<p v-if="loading" role="status">読み込んでいます</p>
	<p v-else-if="!available && !error">HataFeed を利用できません</p>
	<template v-else-if="available">
		<label :class="$style.selector"><span>対象のプロジェクト</span><select v-model="selectedId" :disabled="busy" aria-label="対象のプロジェクト"><option value="">{{ officialProject?.name ?? 'Hataskey' }}</option><option v-for="project in otherProjects" :key="project.id" :value="project.id">{{ project.name }}{{ project.suspended ? copy.suspendedSuffix : '' }}</option></select></label>
		<div :class="$style.actions">
			<button v-if="canExport" type="button" class="hy-secondary" :disabled="exportOpen || busy" @click="openExport"><i class="ti ti-download" aria-hidden="true"></i>エクスポート</button>
			<button v-if="isStaff && currentProject" type="button" class="hy-secondary" :disabled="busy" @click="run(editProject)"><i class="ti ti-pencil" aria-hidden="true"></i>プロジェクトを編集</button>
			<button v-if="isStaff" type="button" class="hy-secondary" :disabled="busy" @click="run(createProject)"><i class="ti ti-plus" aria-hidden="true"></i>{{ copy.addProject }}</button>
			<template v-if="isStaff && currentProject && !currentProject.isOfficial">
				<button type="button" class="hy-secondary" :disabled="busy" @click="run(toggleSuspendProject)"><i :class="currentProject.suspended ? 'ti ti-player-play' : 'ti ti-player-pause'" aria-hidden="true"></i>{{ currentProject.suspended ? copy.resumeProject : copy.suspendProject }}</button>
				<button type="button" class="hy-secondary" :class="$style.danger" :disabled="busy" @click="run(removeProject)"><i class="ti ti-trash" aria-hidden="true"></i>{{ copy.deleteProjectTitle }}</button>
			</template>
		</div>
	</template>
	<p v-if="error" role="alert">{{ error }}<button v-if="!available" type="button" class="hy-secondary" @click="load">再読み込み</button></p>
</section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { hataFeedNotify, hataFeedProjectId } from '@/utility/hatafeed-ui.js';

const dialogs = useHataGoesDialogs();
const popup = useHataGoesPopup();

type Project = { id: string; name: string; ownerId: string | null; isOfficial: boolean; suspended: boolean; description: string; genre: string | null; url: string | null; color: string | null };
const emit = defineEmits<{ changed: [] }>();
const copy = i18n.ts._hata._hatafeed._home;
const copyx = i18n.tsx._hata._hatafeed._home;
const projects = ref<Project[]>([]);
const selectedId = ref(hataFeedProjectId.value ?? '');
const available = ref(false);
const isStaff = ref(false);
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const exportOpen = ref(false);
const officialProject = computed(() => projects.value.find(project => project.isOfficial));
const otherProjects = computed(() => projects.value.filter(project => !project.isOfficial));
const currentProject = computed(() => selectedId.value ? otherProjects.value.find(project => project.id === selectedId.value) : officialProject.value);
const canExport = computed(() => available.value && !!$i && (isStaff.value || (!!selectedId.value && currentProject.value?.ownerId === $i.id)));
const colors = [
	{ value: '', label: copy.colorDefault },
	{ value: '#3b9eff', label: copy.colorBlue },
	{ value: '#41b883', label: copy.colorGreen },
	{ value: '#e6a23c', label: copy.colorOrange },
	{ value: '#f56c6c', label: copy.colorRed },
	{ value: '#9b6cf5', label: copy.colorPurple },
	{ value: '#ff8fc3', label: copy.colorPink },
	{ value: '#36c5d1', label: copy.colorCyan },
];

async function loadProjects() {
	projects.value = await misskeyApi('hata/feedback/projects', {}) as Project[];
	if (selectedId.value && !otherProjects.value.some(project => project.id === selectedId.value)) selectedId.value = '';
}

async function load() {
	loading.value = true;
	error.value = '';
	try {
		const access = await misskeyApi('hata/feedback/available', {});
		available.value = access.available;
		isStaff.value = access.isStaff;
		if (access.available) await loadProjects();
	} catch {
		available.value = false;
		error.value = 'プロジェクトを読み込めませんでした';
	} finally {
		loading.value = false;
	}
}

async function run(action: () => Promise<void>) {
	if (!available.value || !isStaff.value || busy.value) return;
	busy.value = true;
	error.value = '';
	try { await action(); } catch { error.value = 'プロジェクトを更新できませんでした'; } finally { busy.value = false; }
}

async function edited() {
	await loadProjects();
	emit('changed');
	hataFeedNotify('プロジェクトを更新しました');
}

async function createProject() {
	const { canceled, result } = await dialogs.form(copy.addProject, {
		name: { type: 'string', label: copy.name, required: true },
		genre: { type: 'string', label: copy.genreExample },
		description: { type: 'string', label: copy.description, multiline: true },
		url: { type: 'string', label: copy.repositoryUrl },
		color: { type: 'enum', label: copy.themeColor, enum: colors, default: '' },
	});
	if (canceled) return;
	await misskeyApi('hata/feedback/projects/create', { name: result.name, genre: result.genre || null, description: result.description ?? '', url: result.url || null, color: result.color || null });
	await edited();
}

async function editProject() {
	const project = currentProject.value;
	if (!project) return;
	const { canceled, result } = await dialogs.form(copy.editProject, {
		name: { type: 'string', label: copy.name, required: true, default: project.name },
		genre: { type: 'string', label: copy.genreExample, default: project.genre ?? '' },
		description: { type: 'string', label: copy.description, multiline: true, default: project.description ?? '' },
		url: { type: 'string', label: copy.repositoryUrl, default: project.url ?? '' },
		color: { type: 'enum', label: copy.themeColor, enum: colors, default: project.color ?? '' },
	});
	if (canceled) return;
	await misskeyApi('hata/feedback/projects/update', { projectId: project.id, name: result.name, genre: result.genre || null, description: result.description ?? '', url: result.url || null, color: result.color || null });
	await edited();
}

async function removeProject() {
	const project = currentProject.value;
	if (!project || project.isOfficial) return;
	const { canceled } = await dialogs.confirm({ type: 'warning', title: copy.deleteProjectTitle, text: copyx.deleteProjectText({ name: project.name }) });
	if (canceled) return;
	await misskeyApi('hata/feedback/projects/delete', { projectId: project.id });
	await edited();
}

async function toggleSuspendProject() {
	const project = currentProject.value;
	if (!project || project.isOfficial) return;
	if (!project.suspended) {
		const { canceled } = await dialogs.confirm({ type: 'warning', title: copy.suspendProjectTitle, text: copyx.suspendProjectText({ name: project.name }) });
		if (canceled) return;
	}
	await misskeyApi('hata/feedback/projects/update', { projectId: project.id, suspended: !project.suspended });
	await edited();
}

async function openExport() {
	if (!canExport.value || exportOpen.value) return;
	exportOpen.value = true;
	error.value = '';
	const projectId = selectedId.value || null;
	const projectName = currentProject.value?.name ?? 'Hataskey';
	try {
		const { dispose } = popup((await import('@/components/HataFeedExportWindow.vue')).default, { projectId, projectName }, {
			closed: () => { exportOpen.value = false; dispose(); },
		});
	} catch {
		exportOpen.value = false;
		error.value = copy.exportOpenFailedText;
	}
}

onMounted(load);
</script>

<style module>
.section { display: grid; gap: 16px; padding-top: 20px; border-top: 1px solid var(--hy-border); }
.title { margin: 0; font-size: 18px; }
.selector { display: grid; gap: 8px; min-width: 0; }
.selector > select { width: 100%; min-width: 0; min-height: 44px; padding: 8px 12px; box-sizing: border-box; border: 1px solid var(--hy-border); border-radius: 14px; background: var(--hy-surface); color: var(--hy-ink); font: inherit; text-align: center; }
.actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; }
.actions > .danger { color: var(--MI_THEME-error); }
</style>
