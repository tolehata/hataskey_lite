/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, toRaw } from 'vue';
import HatadyComposer from './HatadyComposer.vue';
import HatadyBookForm from './HatadyBookForm.vue';
import HatadyMediaSessionForm from './HatadyMediaSessionForm.vue';
import HatadyActivityCard from './HatadyActivityCard.vue';
import type { Component } from 'vue';
import type { entities } from 'cherrypick-js';
import type { HatadyFormPage, HatadyFormValues } from '@/utility/hatady-form.js';
import type { HatadyActivity, HatadyMediaSessionKind } from '@/utility/hatady-media.js';
import { formField, formValidation } from '@/utility/hatady-form.js';
import { saveHySubject } from '@/utility/hatady-subjects.js';

interface WizardProps {
	modelValue: HatadyFormValues;
	pages: HatadyFormPage[];
	restore: (draft: HatadyFormValues) => HatadyFormValues;
	save: (values: HatadyFormValues) => Promise<unknown>;
}

const fixture = vi.hoisted(() => ({ wizard: null as WizardProps | null, api: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/os.js', () => ({ popup: vi.fn() }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'ja-JP' }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	return { i18n };
});
vi.mock('@/utility/hatady-subjects.js', async () => {
	const { ref } = await import('vue');
	return { hySubjects: ref([]), loadHySubjects: vi.fn(async () => []), saveHySubject: vi.fn(async () => undefined) };
});
vi.mock('@/components/HatadyFormWizard.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: ['modelValue', 'title', 'label', 'icon', 'pages', 'draftId', 'embedded', 'restore', 'save', 'saveLabel', 'summaryTitle'],
		emits: ['update:modelValue', 'done', 'closed', 'back'],
		setup(props) {
			fixture.wizard = props as unknown as WizardProps;
			return () => render('div', { 'data-wizard': '' });
		},
	}) };
});
vi.mock('@/components/HatadyReactions.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkMediaList.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: { mediaList: { type: Array, required: true } },
		setup(props) {
			return () => render('div', { 'data-media-list': props.mediaList.map(file => (file as { id: string }).id).join(',') });
		},
	}) };
});

const cleanups: Array<() => void> = [];
const timestamp = '2026-09-18T01:02:03.456Z';
const image = (id: string) => ({ id, name: `${id}.png`, type: 'image/png', url: `/files/${id}.png`, isSensitive: false }) as entities.DriveFile;
const sessionKinds: HatadyMediaSessionKind[] = ['movie_viewing', 'game_play', 'game_match', 'game_pve', 'game_roguelike'];

async function settle() {
	await Promise.resolve();
	await nextTick();
}

async function mountComponent(component: Component, props: Record<string, unknown>) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(component, props) });
	app.component('MkAvatar', { render: () => null });
	app.component('MkUserName', { render: () => null });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	await settle();
	return host;
}

async function mountForm(component: Component, props: Record<string, unknown>): Promise<WizardProps> {
	fixture.wizard = null;
	await mountComponent(component, props);
	expect(fixture.wizard).not.toBeNull();
	return fixture.wizard!;
}

async function verifyAttachments(form: WizardProps, initialFiles: entities.DriveFile[], endpoint: string, target: Record<string, string>) {
	const values = form.modelValue;
	expect(values.files).toEqual(initialFiles);
	expect(toRaw(values.files)).not.toBe(initialFiles);
	const fileFields = form.pages.filter(page => !page.when || page.when(values)).flatMap(page => page.fields).filter(field => field.key === 'files');
	expect(fileFields).toHaveLength(1);
	expect(fileFields[0]).toMatchObject({ type: 'images', maxItems: 16 });

	const oldDraft = form.restore({ body: '以前の下書き', note: '以前の下書き', durationMinutes: 3 });
	expect(oldDraft).not.toHaveProperty('files');
	// HatadyFormWizard merges restored fields into its existing model with Object.assign.
	Object.assign(values, oldDraft);
	expect(values.files).toEqual(initialFiles);
	await form.save(values);
	expect(fixture.api.mock.calls.at(-1)).toEqual([endpoint, expect.objectContaining(target)]);
	expect(fixture.api.mock.calls.at(-1)![1]).not.toHaveProperty('fileIds');

	const draftFiles = [image('draft-b'), image('draft-a')];
	Object.assign(values, form.restore({ files: draftFiles }));
	expect(values.files).toEqual(draftFiles);
	await form.save(values);
	const [savedEndpoint, payload] = fixture.api.mock.calls.at(-1)!;
	expect(savedEndpoint).toBe(endpoint);
	expect(payload).toMatchObject({ ...target, fileIds: ['draft-b', 'draft-a'] });
	expect(payload).not.toHaveProperty('files');
	expect(JSON.stringify(payload)).not.toContain('/files/');

	fixture.api.mockRejectedValueOnce(new Error('offline'));
	await expect(form.save(values)).rejects.toThrow('offline');
	expect(values.files).toEqual(draftFiles);
	expect(initialFiles.map(file => file.id)).toEqual(['existing']);

	Object.assign(values, form.restore({ files: [] }));
	await form.save(values);
	expect(fixture.api.mock.calls.at(-1)).toEqual([endpoint, expect.objectContaining({ ...target, fileIds: [] })]);
}

beforeEach(() => {
	fixture.api.mockReset().mockImplementation(async (endpoint: string, payload: Record<string, unknown>) => {
		if (endpoint.endsWith('/list') || endpoint === 'hata/hatady/books') return [];
		if (endpoint.endsWith('/create') || endpoint.endsWith('/update')) return { id: 'saved', ...payload };
		throw new Error(`Unexpected API: ${endpoint}`);
	});
});

afterEach(() => {
	cleanups.splice(0).forEach(cleanup => cleanup());
});

describe('Hatady exercise duration', () => {
	test.each([
		{ mode: 'create', initialDuration: null },
		{ mode: 'create', initialDuration: 1800 },
		{ mode: 'edit', initialDuration: null },
		{ mode: 'edit', initialDuration: 1800 },
	] as const)('$mode saves without duration after starting with $initialDuration seconds', async ({ mode, initialDuration }) => {
		const source = { id: 'exercise-log', kind: 'exercise', title: '散歩', studiedAt: timestamp, durationSeconds: initialDuration };
		const form = await mountForm(HatadyComposer, mode === 'edit' ? { editLog: source } : { kind: 'exercise' });
		const values = form.modelValue;
		values.title = '散歩';
		if (mode === 'create') values.durationSeconds = initialDuration;
		expect(values.durationSeconds).toBe(initialDuration);
		values.durationSeconds = null;
		const visibleFields = form.pages.filter(page => !page.when || page.when(values)).flatMap(page => page.fields);
		expect(visibleFields.filter(field => field.key === 'durationSeconds')).toHaveLength(1);
		expect(visibleFields.map(field => formValidation(field, values)).filter(error => error != null)).toEqual([]);
		await form.save(values);
		expect(fixture.api).toHaveBeenLastCalledWith(`hata/hatady/logs/${mode === 'edit' ? 'update' : 'create'}`, expect.objectContaining({
			kind: 'exercise', title: '散歩', durationSeconds: null,
			...(mode === 'edit' ? { logId: source.id } : {}),
		}));
		expect(source.durationSeconds).toBe(initialDuration);
	});
});

describe('Hatady subject and finished date inputs', () => {
	test('ensures a study subject without sending a color change and accepts 128 characters', async () => {
		const form = await mountForm(HatadyComposer, { kind: 'study' });
		const field = form.pages.flatMap(page => page.fields).find(item => item.key === 'subject')!;
		expect(field.maxlength).toBe(128);
		form.modelValue.title = '学習';
		form.modelValue.subject = 'あ'.repeat(128);
		await form.save(form.modelValue);
		await settle();
		expect(saveHySubject).toHaveBeenCalledWith('あ'.repeat(128));
		expect(formValidation(field, form.modelValue)).toBeNull();
		form.modelValue.subject = 'あ'.repeat(129);
		expect(formValidation(field, form.modelValue)).not.toBeNull();
	});

	test('omits an untouched date for a newly finished book and on savedBookId retry', async () => {
		const form = await mountForm(HatadyBookForm, {});
		const values = form.modelValue;
		values.title = '読了した本'; values.status = 'finished';
		expect(values.finishedAt).toBeUndefined();
		expect(JSON.stringify(values)).not.toContain('finishedAt');
		await form.save(values);
		const create = fixture.api.mock.calls.find(([endpoint]) => endpoint === 'hata/hatady/books/create')![1];
		expect(create).not.toHaveProperty('finishedAt');
		expect(values.savedBookId).toBe('saved');
		await form.save(values);
		const retry = fixture.api.mock.calls.findLast(([endpoint]) => endpoint === 'hata/hatady/books/update')![1];
		expect(retry).not.toHaveProperty('finishedAt');
	});

	test('keeps explicit empty dates from a finished book or an old draft, and preserves an unchanged timestamp', async () => {
		const source = { id: 'book1', title: '本', status: 'finished', finishedAt: null, bookmarks: [], memos: [] };
		const editor = await mountForm(HatadyBookForm, { editBook: source });
		expect(editor.modelValue.finishedAt).toBe('');
		editor.modelValue.title = '改題';
		await editor.save(editor.modelValue);
		const updated = fixture.api.mock.calls.findLast(([endpoint]) => endpoint === 'hata/hatady/books/update')![1];
		expect(updated.finishedAt).toBeNull();
		const fresh = await mountForm(HatadyBookForm, {});
		Object.assign(fresh.modelValue, fresh.restore({ finishedAt: '' }));
		fresh.modelValue.title = '旧下書き';
		await fresh.save(fresh.modelValue);
		const legacy = fixture.api.mock.calls.findLast(([endpoint]) => endpoint === 'hata/hatady/books/create')![1];
		expect(legacy.finishedAt).toBeNull();
		const dated = await mountForm(HatadyBookForm, { editBook: { ...source, finishedAt: timestamp } });
		dated.modelValue.title = '日付維持';
		await dated.save(dated.modelValue);
		const withDate = fixture.api.mock.calls.findLast(([endpoint]) => endpoint === 'hata/hatady/books/update')![1];
		expect(withDate.finishedAt).toBe(timestamp);
	});
});

describe('Hatady record attachments', () => {
	test('image validation accepts the empty and 16-image boundaries and rejects 17 images', () => {
		const field = formField('files', '画像', { type: 'images', maxItems: 16 });
		const files = Array.from({ length: 16 }, (_, index) => image(`image-${index}`));
		expect(formValidation(field, { files: [] })).toBeNull();
		expect(formValidation(field, { files })).toBeNull();
		expect(formValidation(field, { files: [...files, image('seventeenth')] })).not.toBeNull();
	});

	test('image validation rejects non-image attachments and malformed restored values', () => {
		const field = formField('files', '画像', { type: 'images', maxItems: 16 });
		for (const files of [
			[{ ...image('movie'), type: 'video/mp4' }],
			[{ ...image('document'), type: 'application/pdf' }],
			[{ type: 'image/png' }],
			'image-id',
		]) expect(formValidation(field, { files })).not.toBeNull();
	});

	test.each(['study', 'exercise', 'work'] as const)('%s keeps existing and restored images through edit, failure, and explicit removal', async kind => {
		const files = [image('existing')];
		const form = await mountForm(HatadyComposer, { editLog: { id: 'log', kind, title: '記録', subject: '分野', studiedAt: timestamp, files, details: {} } });
		await verifyAttachments(form, files, 'hata/hatady/logs/update', { logId: 'log', kind });
	});

	test.each(sessionKinds)('%s keeps existing and restored images through edit, failure, and explicit removal', async kind => {
		const files = [image('existing')];
		const form = await mountForm(HatadyMediaSessionForm, {
			work: { id: 'work', title: '作品', kind: kind === 'movie_viewing' ? 'movie' : 'game' },
			editSession: { id: 'session', workId: 'work', kind, occurredAt: timestamp, files, details: {} },
		});
		await verifyAttachments(form, files, 'hata/hatady/media/sessions/update', { sessionId: 'session' });
	});

	test.each(['log', 'session'] as const)('%s body-only edits keep missing Drive references, while reordered images are sent explicitly', async target => {
		const files = [image('visible-a'), image('visible-b')];
		const source = { id: target, fileIds: ['deleted-image', 'visible-a', 'visible-b'], files };
		const form = target === 'log'
			? await mountForm(HatadyComposer, { editLog: { ...source, title: '記録', subject: '分野', studiedAt: timestamp } })
			: await mountForm(HatadyMediaSessionForm, { work: null, editSession: { ...source, kind: 'movie_viewing', occurredAt: timestamp } });
		const bodyKey = target === 'log' ? 'body' : 'note';
		form.modelValue[bodyKey] = '本文だけを編集';
		await form.save(form.modelValue);
		const payload = fixture.api.mock.calls.at(-1)![1];
		expect(payload[bodyKey]).toBe('本文だけを編集');
		// Omitting this patch leaves the server's deleted-image reference intact.
		expect(payload).not.toHaveProperty('fileIds');
		expect(source.fileIds).toEqual(['deleted-image', 'visible-a', 'visible-b']);

		form.modelValue.files = [...form.modelValue.files].reverse();
		await form.save(form.modelValue);
		expect(fixture.api.mock.calls.at(-1)![1].fileIds).toEqual(['visible-b', 'visible-a']);
		expect(source.files.map(file => file.id)).toEqual(['visible-a', 'visible-b']);
	});

	test('new records start without attachments and send restored image IDs to the existing create APIs', async () => {
		for (const [component, props, endpoint] of [
			[HatadyComposer, { kind: 'study' }, 'hata/hatady/logs/create'],
			[HatadyMediaSessionForm, { work: { id: 'work', title: '作品', kind: 'movie' } }, 'hata/hatady/media/sessions/create'],
		] as const) {
			const form = await mountForm(component, props);
			expect(form.modelValue.files).toEqual([]);
			Object.assign(form.modelValue, form.restore({ title: '新しい記録', subject: '分野', files: [image('draft')] }));
			await form.save(form.modelValue);
			expect(fixture.api.mock.calls.at(-1)).toEqual([endpoint, expect.objectContaining({ fileIds: ['draft'] })]);
			expect(fixture.api.mock.calls.at(-1)![1]).not.toHaveProperty('files');
		}
	});

	test.each(['study', 'movie_viewing'] as const)('%s keeps attached images inside the closed spoiler section', async type => {
		const activity: HatadyActivity = { id: 'activity', type, occurredAt: timestamp, visibility: 'private', isMine: true };
		const files = [image('private-image')];
		if (type === 'study') activity.study = { id: 'log', title: '記録', files, details: { spoiler: true } };
		else activity.media = { work: null, session: { id: 'session', workId: null, kind: type, occurredAt: timestamp, createdAt: timestamp, updatedAt: timestamp, visibility: 'private', files, noteSpoiler: true } };
		const host = await mountComponent(HatadyActivityCard, { activity, showActions: false, showAuthor: false });
		const media = host.querySelector('[data-media-list="private-image"]')!;
		expect(media).not.toBeNull();
		const spoiler = media.closest('details');
		expect(spoiler).not.toBeNull();
		expect(spoiler!.open).toBe(false);
		expect(host.querySelectorAll('[data-media-list]')).toHaveLength(1);
	});
});
