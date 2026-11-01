/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';

const fixture = vi.hoisted(() => {
	const editor = {
		hasChanges: false,
		draft: {},
		save: vi.fn(),
		discard: vi.fn(async () => true),
		restoreLivePreviewToSnapshot: vi.fn(),
	};
	return { editor, useDraft: vi.fn(() => editor), previewEditor: null as unknown };
});

vi.mock('@/preferences.js', () => ({ prefer: { r: { animation: { value: true } } } }));
vi.mock('@/composables/use-hatasaba-ui2-draft.js', () => ({ useHatasabaUi2Draft: fixture.useDraft }));
vi.mock('@/components/HatasabaUi2SettingsBody.vue', () => ({
	default: defineComponent({
		emits: ['preview'],
		template: '<button type="button" data-open-preview @click="$emit(\'preview\')">プレビューを開く</button>',
	}),
}));
vi.mock('@/components/HatasabaUi2ImmediateSettings.vue', () => ({ default: defineComponent({ template: '<section data-immediate-companion/>' }) }));
vi.mock('@/components/MkHatasabaUi2PreviewWindow.vue', () => ({
	default: defineComponent({
		props: { editor: { type: Object, required: true } },
		emits: ['closed'],
		setup(props, { emit }) {
			fixture.previewEditor = props.editor;
			return () => h('section', { 'data-preview-editor': props.editor === fixture.editor ? 'same' : 'different' }, [
				h('button', { type: 'button', 'data-close-preview': '', onClick: () => emit('closed') }, '閉じる'),
			]);
		},
	}),
}));

import HatasabaUi2SettingsSurface from './HatasabaUi2SettingsSurface.vue';

describe('HatasabaUi2SettingsSurface preview integration', () => {
	test('opens a real preview with its sole editor object and closes without persistence', async () => {
		const matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
		Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
		const app = createApp(defineComponent({ setup: () => () => h(HatasabaUi2SettingsSurface, { motionEnabled: false }) }));
		const container = window.document.createElement('div');
		window.document.body.append(container);
		app.mount(container);

		expect(fixture.useDraft).toHaveBeenCalledTimes(1);
		(container.querySelector('[data-open-preview]') as HTMLButtonElement).click();
		await nextTick();
		expect(container.querySelector('[data-preview-editor]')?.getAttribute('data-preview-editor')).toBe('same');
		expect(fixture.previewEditor).toBe(fixture.editor);
		expect(fixture.editor.save).not.toHaveBeenCalled();
		(container.querySelector('[data-close-preview]') as HTMLButtonElement).click();
		await nextTick();
		expect(container.querySelector('[data-preview-editor]')).toBeNull();
		expect(fixture.editor.save).not.toHaveBeenCalled();
		expect(fixture.editor.restoreLivePreviewToSnapshot).not.toHaveBeenCalled();

		app.unmount();
		container.remove();
	});
});
