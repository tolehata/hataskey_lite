/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createApp, h, nextTick, ref } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/components/MkNote.vue', () => ({ default: { props: ['note', 'mock', 'charmPreview'], template: '<article :data-note="JSON.stringify(note)" :data-mock="mock" :data-charm="JSON.stringify(charmPreview)"/>' } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { _noteCharm: { sampleText: 'ノートのプレビュー' } } } }));
import MkNoteCharmPreview from './MkNoteCharmPreview.vue';

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach(fn => fn()));
describe('実ノートを使う設定プレビュー', () => {
	test('独立したサンプルユーザーを実ノートのmockへ渡し、幅変更は同じインスタンスに反映する', async () => {
		const charm = ref({ url: 'https://example.test/charm.png', size: 76, pattern: 'cutout' as const, color: '#123456' });
		const target = window.document.createElement('div'); window.document.body.append(target);
		const app = createApp({ render: () => h(MkNoteCharmPreview, { charm: charm.value }) }); app.mount(target); cleanup.push(() => { app.unmount(); target.remove(); });
		const note = target.querySelector('article')!;
		expect(note.getAttribute('data-mock')).toBe('true'); expect(note.closest('[inert]')).not.toBeNull();
		const sample = JSON.parse(note.getAttribute('data-note')!); expect(sample.user.name).toBe('サンプルユーザー'); expect(sample.user.username).toBe('sampleuser'); expect(sample.text).toBe('ノートのプレビュー');
		charm.value = { ...charm.value, size: 96 }; await nextTick();
		expect(target.querySelector('article')).toBe(note); expect(JSON.parse(note.getAttribute('data-charm')!).size).toBe(96);
	});

	test('the preview reserves the complete charm envelope without resizing the note as the slider changes', async () => {
		const charm = ref<{ url: string; size: number; pattern: 'cutout'; color: string } | null>({ url: '/charm.png', size: 48, pattern: 'cutout', color: '#123456' });
		const target = window.document.createElement('div');
		window.document.body.append(target);
		const app = createApp({ render: () => h(MkNoteCharmPreview, { charm: charm.value }) });
		app.mount(target);
		cleanup.push(() => { app.unmount(); target.remove(); });
		const note = target.querySelector('article')!;
		const scene = note.parentElement!;
		const gutter = Number.parseFloat(scene.style.getPropertyValue('--note-charm-preview-gutter'));
		const minimumHeight = Number.parseFloat(scene.style.getPropertyValue('--note-charm-preview-min-height'));
		// The A design uses a 110px rail, with space for its shadow.
		expect(gutter).toBeGreaterThanOrEqual(118);
		expect(gutter).toBeLessThanOrEqual(120);
		// Include the tallest alpha-cropped art (110px), chain, anchor and insets.
		expect(minimumHeight).toBeGreaterThanOrEqual(244);
		expect(minimumHeight).toBeLessThanOrEqual(252);
		const original = scene.getAttribute('style');
		for (const size of [60, 64, 96]) {
			charm.value = { ...charm.value!, size };
			await nextTick();
			expect(note.parentElement).toBe(scene);
			expect(scene.getAttribute('style')).toBe(original);
		}
		charm.value = null;
		await nextTick();
		expect(scene.getAttribute('style')).toBe(original);
	});
});
