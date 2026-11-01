/* SPDX-License-Identifier: AGPL-3.0-only */
import fs from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { compileTemplate, parse } from 'vue/compiler-sfc';
import { settingsControlSearchIndexV2 } from '../vite.config.js';
import pluginCreateSettingsSearchIndexV2, {
	collectSettingsDescriptorReachabilityAuditV2,
	collectSettingsSearchDescriptorsV2,
	collectSettingsTransitiveControlAuditV2,
	injectSettingsSearchIdsV2,
	readSettingsRoutesV2,
} from './vite-plugin-create-settings-search-index-v2.js';

const sourceFile = 'src/components/concrnt/ConcrntSettings.vue';
const target = settingsControlSearchIndexV2.targetFilePaths.find(value => typeof value !== 'string' && value.filePath === sourceFile);
if (target == null || typeof target === 'string') throw new Error('Missing production Concrnt settings search target');
const rootId = 'settings.group.concrnt-connection-settings';

async function inventory(file = sourceFile) {
	const source = await fs.readFile(file, 'utf8');
	const routes = readSettingsRoutesV2(await fs.readFile('src/router.definition.ts', 'utf8'));
	return { source, routes, descriptors: collectSettingsSearchDescriptorsV2(file, source, routes, file === sourceFile ? target : {}) };
}

describe('external connection settings search contracts', () => {
	test('registers the independent settings component with its actual device contract', async () => {
		expect(target).toMatchObject({ routeOverride: '/settings/concrnt', persistence: 'device', saveMode: 'immediate', availability: 'all', owner: 'hatasaba', applicableUi: 'all' });
		const audit = await collectSettingsTransitiveControlAuditV2(process.cwd(), ['src/pages/settings/concrnt.vue', sourceFile]);
		expect(audit.find(entry => entry.sourceFile === sourceFile)?.disposition).toBe('registered-target');
		await expect(collectSettingsTransitiveControlAuditV2(process.cwd(), ['src/pages/settings/concrnt.vue']))
			.rejects.toThrow(`unregistered transitive setting control: ${sourceFile}`);
	});

	test('keeps authentication drafts out of search while preserving the saved setting controls', async () => {
		const { descriptors } = await inventory();
		const drafts = descriptors.filter(entry => ['domainDraft', 'secretDraft', 'saveDraft'].includes(entry.modelExpression ?? ''));
		expect(drafts).toHaveLength(4);
		expect(drafts.every(entry => !entry.searchable && entry.intentionallyExcluded && entry.exclusionReason)).toBe(true);
		const saved = descriptors.filter(entry => entry.searchable && !entry.isGroup);
		expect(saved, JSON.stringify(descriptors.map(entry => ({ label: entry.labelExpression ?? entry.label, searchable: entry.searchable, reason: entry.exclusionReason, storage: entry.storageRefs })))).toHaveLength(6);
		expect(new Set(saved.flatMap(entry => entry.storageRefs?.flatMap(ref => ref.kind === 'indexeddb' ? ref.fields : []) ?? [])))
			.toEqual(new Set(['settings.enabled', 'settings.save', 'settings.profile', 'settings.notifications', 'settings.popups']));
		for (const descriptor of saved) {
			expect(descriptor).toMatchObject({ persistence: 'device', owner: 'hatasaba', applicableUi: 'all', route: '/settings/concrnt' });
			expect(descriptor.semanticGroupId ?? descriptor.sourceSemanticGroupId).toBe('settings.semantic.feature.concrnt-linking');
			expect(descriptor.storageRefs).toEqual([expect.objectContaining({ kind: 'indexeddb', database: 'HataskeyConcrnt', store: 'private', key: '${encodeURIComponent(owner)}:connection' })]);
		}
		const storage = await fs.readFile('src/utility/concrnt/storage.ts', 'utf8');
		expect(storage).toContain("createStore('HataskeyConcrnt', 'private')");
		expect(storage).toContain('`${this.prefix(owner)}connection`');
		expect(storage).toContain('`${encodeURIComponent(owner)}:`');
		expect(await fs.readFile('src/utility/concrnt/runtime.ts', 'utf8')).toContain("getConcrntStorage().saveConnection(account, next.save === 'device' ? value : null, next)");
	});

	test('focuses the always-mounted settings host without activating a wizard or hidden capsule', async () => {
		const { source, routes, descriptors } = await inventory();
		const root = descriptors.find(entry => entry.stableId === rootId);
		expect(root).toMatchObject({ isGroup: true, searchable: true, conditions: [] });
		const saved = descriptors.filter(entry => entry.searchable && !entry.isGroup);
		for (const descriptor of saved) {
			expect(descriptor.conditions.length).toBeGreaterThan(0);
			expect(descriptor).toMatchObject({ focusId: rootId, focusHostConditions: [], unmet: [{ kind: 'runtime-data', id: 'concrnt-account-and-section', behavior: 'explain' }] });
			expect(descriptor.activation).toBeUndefined();
		}
		expect(collectSettingsDescriptorReachabilityAuditV2(descriptors).filter(entry => entry.disposition === 'parent-static-group')).toHaveLength(6);
		const injected = injectSettingsSearchIdsV2(sourceFile, source, routes, target).code;
		expect(injected.match(/<div[^>]*data-settings-search-id="settings\.group\.concrnt-connection-settings"/gu)).toHaveLength(1);
		const parsed = parse(injected);
		expect(parsed.errors).toEqual([]);
		expect(compileTemplate({ source: parsed.descriptor.template?.content ?? '', filename: sourceFile, id: 'concrnt-search-contract' }).errors).toEqual([]);
	});

	test('keeps the existing external switches on exact preference keys without borrowing the consent API', async () => {
		const { descriptors } = await inventory('src/pages/settings/external-account.vue');
		for (const key of ['external.enabled', 'external.enableOHTL', 'external.enableOLTL', 'external.disableNotificationToast']) {
			const descriptor = descriptors.find(entry => entry.searchable && !entry.isGroup && entry.storageRefs?.some(ref => ref.kind === 'pref' && ref.key === key));
			expect(descriptor, key).toBeDefined();
			expect(descriptor?.storageRefs).toEqual([{ kind: 'pref', key }]);
			expect(descriptor?.preferenceKeys).toEqual([key]);
			expect(descriptor?.persistence).toBe('profile');
		}
		expect(descriptors.find(entry => entry.modelExpression === 'selectedHost')).toMatchObject({ searchable: false, intentionallyExcluded: true });
		expect(() => collectSettingsDescriptorReachabilityAuditV2(descriptors)).not.toThrow();
	});

	test('generates the production index with count, storage and reachability audits enabled', async () => {
		const plugin = pluginCreateSettingsSearchIndexV2(settingsControlSearchIndexV2);
		if (typeof plugin.load !== 'function') throw new Error('Missing settings search loader');
		const result = await plugin.load.call({} as never, '\0search-index-v2:settings');
		expect(typeof result).toBe('string');
		expect(result).toContain(rootId);
	});
});
