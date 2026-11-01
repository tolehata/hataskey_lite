/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';

const fixture = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: fixture.api }));
vi.mock('@/os.js', () => ({ popup: vi.fn(), popupMenu: vi.fn() }));
vi.mock('@/components/hataskey3/hk3-composer-menu.js', () => ({ captureHk3ComposerMenu: vi.fn() }));
vi.mock('@/utility/hatady.js', () => ({ HY_BANNER_PRESETS: [] }));
vi.mock('@/utility/hatady-ui.js', () => ({
	hatadyDuration: () => '30分', hatadyNotify: vi.fn(), HATADY_RECORD_TAGS: [], HATADY_ACTIVITY_CHOICES: [],
}));
vi.mock('@/utility/hatady-prefs.js', async () => ({
	hatadyTheme: (await import('vue')).ref('paper'), hatadyTzOffset: () => 540,
}));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	const i18n = createTestHataskI18n();
	i18n.locale._hata._hatady._profile.notFound = '読込できません';
	return { i18n };
});
vi.mock('@/components/HyDialog.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: { title: String },
		setup(props, { slots }) { return () => render('section', { 'data-dialog': props.title }, slots.default?.()); },
	}) };
});
vi.mock('@/components/HatadyActivityCard.vue', async () => {
	const { defineComponent, h: render } = await import('vue');
	return { default: defineComponent({
		props: { activity: Object }, emits: ['deleted'],
		setup(props, { emit }) {
			return () => render('button', { 'data-record': props.activity?.id, onClick: () => emit('deleted') }, props.activity?.study.title);
		},
	}) };
});
vi.mock('@/components/HatadyProfileDesign.vue', () => ({ default: {
	props: ['design'], emits: ['saved', 'closed'],
	template: '<div data-profile-design-editor :data-palette="design.palette"><button data-design-save @click="$emit(\'saved\', { palette: \'violet\' })">保存</button><button data-design-close @click="$emit(\'closed\')">閉じる</button></div>',
} }));
vi.mock('@/components/HyBookCover.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/HyMediaCover.vue', () => ({ default: { render: () => null } }));
import HatadyProfile from './HatadyProfile.vue';

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });

async function settle() {
	for (let i = 0; i < 6; i++) { await nextTick(); await Promise.resolve(); }
}

async function mountHeaderProfile(inline = true, isMe = true, preview = false) {
	const profile = {
		user: { id: 'viewer', username: 'viewer' }, isMe, activities: [], books: [],
		followingCount: 0, followersCount: 0, totalSeconds: 0,
		design: { hidden: ['traits', 'shelf', 'work'] },
	};
	fixture.api.mockReset().mockImplementation(async (endpoint: string) => endpoint === 'hata/hatady/users/show' ? profile : []);
	const host = window.document.createElement('div');
	const header = window.document.createElement('nav');
	window.document.body.append(host, header);
	const target = ref<HTMLElement | null>(header);
	const active = ref(true);
	const app = createApp({ render: () => h(HatadyProfile, { inline, active: active.value, headerActionsTarget: target.value, previewData: preview ? profile : undefined }) });
	app.component('MkAvatar', { render: () => null });
	app.component('MkUserName', { render: () => null });
	app.mount(host);
	let mounted = true;
	const unmount = () => {
		if (mounted) app.unmount();
		mounted = false;
		host.remove();
		header.remove();
	};
	cleanups.push(unmount);
	await settle();
	return { host, header, target, active, unmount };
}

test('hosted profile removes its heading and opens design editing from the navigation row', async () => {
	const { host, header, target, active, unmount } = await mountHeaderProfile();
	expect(host.querySelector('h1')).toBeNull();
	expect(host.querySelector('button[aria-label="デザインを編集"]')).toBeNull();
	const edit = header.querySelector<HTMLButtonElement>('button[aria-label="デザインを編集"]');
	expect(edit).not.toBeNull();
	expect(edit?.textContent.trim()).toBe('');
	expect(edit?.title).toBe('デザインを編集');
	expect(edit?.querySelector('i[aria-hidden=true]')).not.toBeNull();
	edit!.click();
	await settle();
	const editor = window.document.querySelector('[data-profile-design-editor]');
	expect(editor?.parentElement).toBe(window.document.body);
	expect(host.contains(editor)).toBe(false);
	editor?.querySelector<HTMLButtonElement>('[data-design-save]')?.click();
	await settle();
	expect(editor?.getAttribute('data-palette')).toBe('violet');
	editor?.querySelector<HTMLButtonElement>('[data-design-close]')?.click();
	await settle();
	expect(window.document.querySelector('[data-profile-design-editor]')).toBeNull();
	edit!.click();
	await settle();
	expect(window.document.querySelector('[data-profile-design-editor]')?.parentElement).toBe(window.document.body);
	active.value = false;
	await settle();
	expect(header.querySelector('button')).toBeNull();
	active.value = true;
	await settle();
	expect(header.querySelectorAll('button')).toHaveLength(1);
	target.value = null;
	await settle();
	expect(header.querySelector('button')).toBeNull();
	expect(host.querySelector('h1')?.textContent).toBe('プロフィール');
	expect(host.querySelector('button[aria-label="デザインを編集"]')).not.toBeNull();
	target.value = header;
	await settle();
	expect(host.querySelector('h1')).toBeNull();
	unmount();
	expect(header.querySelector('button')).toBeNull();
	expect(window.document.querySelector('[data-profile-design-editor]')).toBeNull();
});

test('other users, popup profiles and previews do not expose a hosted edit control', async () => {
	const other = await mountHeaderProfile(true, false);
	expect(other.header.querySelector('button')).toBeNull();
	other.unmount();
	const popup = await mountHeaderProfile(false);
	expect(popup.header.querySelector('button')).toBeNull();
	expect(popup.host.querySelector('h1')?.textContent).toBe('プロフィール');
	expect(popup.host.querySelector('button[aria-label="デザインを編集"]')).not.toBeNull();
	popup.unmount();
	const preview = await mountHeaderProfile(true, true, true);
	expect(preview.header.querySelector('button')).toBeNull();
	expect(preview.host.querySelector('button[aria-label="デザインを編集"]')).toBeNull();
});

test('a profile response started before deletion cannot restore the record after the newer reload fails', async () => {
	const activity = {
		id: 'log-one', type: 'study', isMine: true, occurredAt: new Date().toISOString(),
		study: { id: 'log-one', title: '削除した記録', userId: 'viewer' },
	};
	const profile = {
		user: { id: 'viewer', username: 'viewer' }, isMe: true, activities: [activity], books: [],
		followingCount: 0, followersCount: 0, totalSeconds: 1800,
		design: { hidden: ['traits', 'shelf', 'work'] },
	};
	// Keep the pre-deletion server snapshot separate from the component's local removal.
	const staleProfile = structuredClone(profile);
	let resolveOld!: (value: typeof profile) => void;
	const oldResponse = new Promise<typeof profile>(resolve => { resolveOld = resolve; });
	let reads = 0;
	fixture.api.mockReset().mockImplementation((endpoint: string) => {
		if (endpoint === 'hata/hatady/media/works/list') return Promise.resolve([]);
		if (endpoint !== 'hata/hatady/users/show') throw new Error(`Unexpected API: ${endpoint}`);
		reads++;
		if (reads === 1) return Promise.resolve(profile);
		if (reads === 2) return oldResponse;
		return Promise.reject(new Error('Latest reload failed'));
	});
	const userId = ref<string | undefined>(undefined);
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(HatadyProfile, { inline: true, userId: userId.value }) });
	app.component('MkAvatar', { render: () => null });
	app.component('MkUserName', { render: () => null });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	await settle();
	expect(host.textContent).toContain('削除した記録');
	host.querySelector<HTMLButtonElement>('button[data-recorded="true"]')!.click();
	await settle();
	// The day popup stays available while the profile's next response is pending.
	userId.value = 'viewer';
	await settle();
	expect(reads).toBe(2);
	const deleteButton = host.querySelector<HTMLButtonElement>('button[data-record="log-one"]');
	expect(deleteButton).not.toBeNull();
	deleteButton!.click();
	await settle();
	expect(reads).toBe(3);
	expect(host.textContent).toContain('読込できません');
	expect(host.textContent).not.toContain('削除した記録');
	resolveOld(staleProfile);
	await settle();
	expect(host.textContent).toContain('読込できません');
	expect(host.querySelector('[data-record="log-one"]')).toBeNull();
	expect(host.textContent).not.toContain('削除した記録');
});
