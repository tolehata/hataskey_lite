/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createApp, defineComponent, h, nextTick } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';
import MkExternalNote from './MkExternalNote.vue';

const { popup } = vi.hoisted(() => ({ popup: vi.fn(() => ({ dispose: vi.fn() })) }));
vi.mock('@/os.js', () => ({ popup }));
vi.mock('@@/js/config.js', () => ({ ui: 'default' }));
vi.mock('@/i18n.js', () => ({ i18n: {
	ts: { reaction: 'Reaction', reply: 'Reply', renote: 'Renote', _hata: { _externalTimeline: { _note: { menu: 'Menu' } } } },
	tsx: { _hata: { _externalTimeline: { _note: {} } } },
} }));
vi.mock('@/utility/intl-const.js', () => ({ versatileLang: 'en-US' }));
vi.mock('@/utility/external-api.js', () => ({
	getExternalEmojiUrlMap: async () => ({}),
	getExternalAccount: () => ({ userId: 'viewer' }),
	addExternalRecentReaction: vi.fn(),
	lookupExternalEmojiUrl: () => undefined,
}));
vi.mock('@/components/MkReactionIcon.vue', () => ({ default: defineComponent(() => () => null) }));
vi.mock('@/components/MkMediaList.vue', () => ({ default: defineComponent(() => () => null) }));
vi.mock('@/components/hataskey3/Hk3VisibilityRail.vue', () => ({ default: defineComponent(() => () => null) }));

const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).forEach(run => run()); vi.clearAllMocks(); });

async function mountNote(visualMode: 'legacy' | 'hataskey-normal' | 'hataskey-deck', reactions: Record<string, number> = { '👍': 2 }) {
	const container = window.document.createElement('div');
	window.document.body.append(container);
	const app = createApp({ render: () => h(MkExternalNote, {
		note: { id: 'note1', userId: 'author', user: { id: 'author', username: 'author' }, createdAt: '2026-10-27T00:00:00Z', visibility: 'public', reactions },
		host: 'external.example', token: 'test-token', visualMode,
	}) });
	app.component('Mfm', defineComponent({ inheritAttrs: false, props: ['text'], setup: props => () => h('span', props.text) }));
	app.component('MkTime', defineComponent(() => () => null));
	app.component('MkA', defineComponent({ setup: (_, { slots }) => () => h('a', slots.default?.()) }));
	app.mount(container);
	cleanup.push(() => { app.unmount(); container.remove(); });
	await nextTick();
	return container;
}

const modes = ['legacy', 'hataskey-normal', 'hataskey-deck'] as const;

describe('external note reaction picker anchor', () => {
	test.each(modes)('%s: footer button, icon and count anchor to the footer even when the add button exists', async visualMode => {
		const container = await mountNote(visualMode);
		const footer = container.querySelector<HTMLButtonElement>('button[title="Reaction"]')!;
		expect(container.querySelector('.ti-plus')).not.toBeNull();
		for (const target of [footer, footer.querySelector<HTMLElement>('i')!, footer.querySelector<HTMLElement>('span')!]) {
			target.click();
			expect(popup).toHaveBeenLastCalledWith(expect.anything(), { anchorElement: footer }, expect.anything());
		}
	});

	test.each(modes)('%s: reaction-row plus icon anchors to its own button', async visualMode => {
		const container = await mountNote(visualMode);
		const icon = container.querySelector<HTMLElement>('.ti-plus')!;
		icon.click();
		expect(popup).toHaveBeenLastCalledWith(expect.anything(), { anchorElement: icon.closest('button') }, expect.anything());
	});

	test.each(modes)('%s: footer icon anchors to the footer when the note has no reactions', async visualMode => {
		const container = await mountNote(visualMode, {});
		const footer = container.querySelector<HTMLButtonElement>('button[title="Reaction"]')!;
		expect(container.querySelector('.ti-plus')).toBeNull();
		footer.querySelector<HTMLElement>('i')!.click();
		expect(popup).toHaveBeenLastCalledWith(expect.anything(), { anchorElement: footer }, expect.anything());
	});
});
