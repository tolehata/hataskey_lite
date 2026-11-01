/* SPDX-License-Identifier: AGPL-3.0-only */
import fs from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { settingsControlSearchIndexV2 } from '../vite.config.js';
import { collectSettingsSearchDescriptorsV2, readSettingsRoutesV2 } from './vite-plugin-create-settings-search-index-v2.js';

describe('dedicated note charm settings route', () => {
	test('routes all charm controls to their dedicated page with retained policy focus', async () => {
		const target = settingsControlSearchIndexV2.targetFilePaths.find(value => typeof value !== 'string' && value.filePath === 'src/components/MkNoteCharmSettings.vue');
		if (target == null || typeof target === 'string') throw new Error('Missing charm target');
		expect(target.routeOverride).toBe('/settings/note-charm');
		const routes = readSettingsRoutesV2(await fs.readFile('src/router.definition.ts', 'utf8'));
		expect(routes.get('note-charm')).toBe('/settings/note-charm');
		const source = await fs.readFile(target.filePath, 'utf8');
		const descriptors = collectSettingsSearchDescriptorsV2(target.filePath, source, routes, target);
		const controls = descriptors.filter(item => item.searchable && !item.isGroup);
		expect(controls.length).toBeGreaterThan(3);
		for (const control of controls) expect(control.route).toBe('/settings/note-charm');
		const shell = await fs.readFile('src/pages/settings-redesign/index.vue', 'utf8');
		expect(shell).toContain("if (currentPath.value === '/settings/note-charm') return 'profile';");
		expect(descriptors.find(item => item.stableId === 'settings.group.note-charm-pattern')).toMatchObject({ focusId: 'settings.group.note-charm-settings', unmet: [{ kind: 'policy', id: 'note-charm-role-and-ui', behavior: 'explain' }] });
	});

	test('profile links once to the unchanged reusable editor on its own page', async () => {
		const profile = await fs.readFile('src/pages/settings/profile.vue', 'utf8');
		expect(profile).not.toContain('<MkNoteCharmSettings');
		expect(profile.match(/to="\/settings\/note-charm"/g)).toHaveLength(1);
		const charmButton = profile.match(/<MkButton\b[^>]*\bto="\/settings\/note-charm"[^>]*>/)?.[0];
		expect(charmButton).toBeDefined();
		for (const prop of ['primary', 'rounded', 'link']) expect(charmButton).toMatch(new RegExp(`\\s${prop}(?:\\s|>)`));
		const page = await fs.readFile('src/pages/settings/note-charm.vue', 'utf8');
		expect(page.match(/<MkNoteCharmSettings/g)).toHaveLength(1);
		expect(page).toContain('path="/settings/note-charm"');
		expect(page).toContain('title: i18n.ts._noteCharm.title');
	});
});
