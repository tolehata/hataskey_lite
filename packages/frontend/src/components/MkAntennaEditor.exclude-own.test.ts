/* SPDX-License-Identifier: AGPL-3.0-only */
import { createApp, h, nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MkAntennaEditor from './MkAntennaEditor.vue';

const api = vi.hoisted(() => vi.fn());
vi.mock('@/os.js', () => ({ apiWithDialog: api }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn(async () => []) }));
vi.mock('@/preferences.js', () => ({ prefer: { s: {} } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	name: 'Name', users: 'Users', save: 'Save', delete: 'Delete', antennaExcludeBots: 'Exclude bots',
	antennaExcludeOwnNotes: 'Exclude my notes', withReplies: 'Replies', localOnly: 'Local',
	caseSensitive: 'Case sensitive', withFileAntenna: 'Files', excludeNotesInSensitiveChannel: 'Sensitive',
	_antennaSources: { all: 'All', users: 'Users', userList: 'List', userBlacklist: 'Blacklist' },
} } }));
vi.mock('@/components/MkInput.vue', () => ({ default: { template: '<div><slot name="label"/></div>' } }));
vi.mock('@/components/MkTextarea.vue', () => ({ default: { template: '<div><slot name="label"/></div>' } }));
vi.mock('@/components/MkSelect.vue', () => ({ default: { template: '<div><slot name="label"/></div>' } }));

let cleanup: (() => void) | undefined;
beforeEach(() => { api.mockReset().mockImplementation(async (_endpoint, params) => params); });
afterEach(() => { cleanup?.(); cleanup = undefined; });

async function mount(settings: { id?: string; excludeOwnNotes?: boolean } = {}) {
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(MkAntennaEditor, { antenna: { name: 'Antenna', keywords: [['keyword']], ...settings } }) });
	app.directive('tooltip', {});
	app.mount(host);
	cleanup = () => { app.unmount(); host.remove(); };
	await nextTick();
	const label = [...host.querySelectorAll('label')].find(element => element.textContent.trim() === 'Exclude my notes');
	const input = label ? host.querySelector<HTMLInputElement>(`input[id="${label.htmlFor}"]`) : null;
	if (!input) throw new Error('Missing own-note exclusion switch');
	return { host, input };
}

describe('antenna own-note exclusion editor', () => {
	test('starts off for a new antenna and submits the checked value on create', async () => {
		const { host, input } = await mount();
		expect(input.checked).toBe(false);
		input.click(); await nextTick();
		const save = [...host.querySelectorAll('button')].find(button => button.textContent.trim() === 'Save');
		if (!save) throw new Error('Missing save button');
		save.click(); await nextTick();
		expect(api).toHaveBeenCalledWith('antennas/create', expect.objectContaining({ excludeOwnNotes: true }));
	});

	test.each([undefined, false, true])('restores and submits the stored value %s on update', async value => {
		const { host, input } = await mount({ id: 'antenna1', ...(value === undefined ? {} : { excludeOwnNotes: value }) });
		expect(input.checked).toBe(value ?? false);
		const save = [...host.querySelectorAll('button')].find(button => button.textContent.trim() === 'Save');
		if (!save) throw new Error('Missing save button');
		save.click(); await nextTick();
		expect(api).toHaveBeenCalledWith('antennas/update', expect.objectContaining({ antennaId: 'antenna1', excludeOwnNotes: value ?? false }));
	});
});
