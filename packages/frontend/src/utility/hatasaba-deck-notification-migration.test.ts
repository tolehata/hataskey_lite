/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import * as ts from 'typescript';
import { describe, expect, test, vi } from 'vitest';

const filename = 'src/ui/_common_/hatasaba-deck.vue';
const { descriptor } = parse(readFileSync(resolve(process.cwd(), filename), 'utf8'), { filename });
if (!descriptor.scriptSetup) throw new Error('Missing deck script setup');
const script = ts.createSourceFile(`${filename}.ts`, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const functions = ['legacyColumnToSlot', 'migrateV2IfNeeded'].map(name => {
	const node = script.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
	if (!node) throw new Error(`Missing deck migration function: ${name}`);
	return node.getText(script);
}).join('\n');
const compiled = ts.transpileModule(`${functions}\nmigrateV2IfNeeded;`, {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function fixture(values: Record<string, unknown> = {}) {
	const initialValues: Record<string, unknown> = {
		'simpleUi.deckProfilesV2': [],
		'simpleUi.deckActiveProfileV2': '',
		'simpleUi.deckProfiles': [],
		'simpleUi.deckColumns': [],
		'simpleUi.deckLayout': 'row',
		...values,
	};
	const r = Object.fromEntries(Object.entries(initialValues).map(([key, value]) => [key, { value }]));
	const commit = vi.fn((key: string, value: unknown) => {
		// Match the preference store's JSON serialization without touching storage.
		r[key].value = JSON.parse(JSON.stringify(value));
	});
	let serial = 0;
	const migrate = runInNewContext(compiled, {
		prefer: { r, commit },
		genId: (prefix: string) => `${prefix}-${++serial}`,
	}, { timeout: 1000 }) as () => void;
	return { migrate, commit, value: (key: string) => r[key].value };
}

describe('旗鯖デッキの旧設定からV2への移行', () => {
	test('旧プロファイルの通知フィルタと既存のカラム設定を引き継ぐ', () => {
		const legacy = [{
			id: 'profile-1', name: '通知用', layout: 'grid2',
			columns: [{
				id: 'notifications', type: 'notifications', width: 420, height: 560,
				name: '通知', sourceId: 'source-1', withRenotes: false,
				borderColor: '#336699', fullWidth: true, fullHeight: false,
				excludeBots: true, excludeTypes: ['reaction'], notificationFilterKnownTypes: ['reaction', 'mention'],
				notificationFilterDetails: { includeBrands: ['hatady'], includeHataskApp: false, excludeHatadySubtypes: ['reaction'], knownHatadySubtypes: ['reaction'] },
			}, { id: 'local', type: 'local', width: 380 }],
		}];
		const original = JSON.stringify(legacy);
		const current = fixture({ 'simpleUi.deckProfiles': legacy });
		current.migrate();
		expect(current.value('simpleUi.deckProfilesV2')).toEqual([{
			id: 'profile-1', name: '通知用', layout: 'grid2',
			slots: [{
				id: expect.any(String), width: 420, height: 560, fullWidth: true, fullHeight: false,
				frames: [{
					id: expect.any(String), borderColor: '#336699',
					tabs: [{
						id: 'notifications', type: 'notifications', name: '通知', sourceId: 'source-1', withRenotes: false,
						excludeBots: true, excludeTypes: ['reaction'], notificationFilterKnownTypes: ['reaction', 'mention'],
						notificationFilterDetails: { includeBrands: ['hatady'], includeHataskApp: false, excludeHatadySubtypes: ['reaction'], knownHatadySubtypes: ['reaction'] },
					}],
				}],
			}, {
				id: expect.any(String), width: 380, height: 460,
				frames: [{ id: expect.any(String), borderColor: null, tabs: [{ id: 'local', type: 'local' }] }],
			}],
		}]);
		expect(current.value('simpleUi.deckActiveProfileV2')).toBe('profile-1');
		expect(JSON.stringify(legacy)).toBe(original);
	});

	test.each([true, false, undefined])('旧単一構成のBot除外値をそのまま引き継ぐ（%s）', excludeBots => {
		const current = fixture({
			'simpleUi.deckColumns': [{ id: 'notifications', type: 'notifications', width: 340, excludeBots }],
			'simpleUi.deckLayout': 'stack',
		});
		current.migrate();
		expect(current.value('simpleUi.deckProfilesV2')).toEqual([{
			id: 'default', name: 'デフォルト', layout: 'stack',
			slots: [{
				id: expect.any(String), width: 340, height: 460,
				frames: [{
					id: expect.any(String), borderColor: null,
					tabs: [{ id: 'notifications', type: 'notifications', ...(excludeBots === undefined ? {} : { excludeBots }) }],
				}],
			}],
		}]);
	});

	test('移行済みのV2と選択中プロファイルを旧データで上書きしない', () => {
		const existing = [{
			id: 'saved', name: '保存済み', layout: 'row',
			slots: [{
				id: 'slot', width: 360,
				frames: [{ id: 'frame', tabs: [{ id: 'notifications', type: 'notifications', excludeBots: false }] }],
			}],
		}];
		const current = fixture({
			'simpleUi.deckProfilesV2': existing,
			'simpleUi.deckActiveProfileV2': 'saved',
			'simpleUi.deckColumns': [{ id: 'old', type: 'notifications', width: 340, excludeBots: true }],
		});
		current.migrate();
		expect(current.commit).not.toHaveBeenCalled();
		expect(current.value('simpleUi.deckProfilesV2')).toBe(existing);
		expect(current.value('simpleUi.deckActiveProfileV2')).toBe('saved');
	});
});

test('通知詳細の変更だけでもカラムpropsを再計算し、無関係な描画では参照を保つ', () => {
	const selected = script.statements.filter(statement =>
		(ts.isFunctionDeclaration(statement) && ['buildColumnProps', 'columnProps'].includes(statement.name?.text ?? '')) ||
		(ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'columnPropsCache')),
	).map(statement => statement.getText(script)).join('\n');
	const code = ts.transpileModule(`${selected}\ncolumnProps;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
	const columnProps = runInNewContext(code, {
		NOTE_SRC: {},
		externalReady: { value: false }, externalHost: { value: '' }, externalToken: { value: '' },
		resolveNotificationFilter: () => ({ excludeTypes: [] }),
		resolveNotificationFilterDetails: (details: Record<string, unknown>) => ({
			includeBrands: details.includeBrands ?? null,
			includeHataskApp: details.includeHataskApp ?? true,
			excludeHatadySubtypes: details.excludeHatadySubtypes ?? [],
		}),
		hasConfiguredNotificationFilter: () => false,
	}, { timeout: 1000 }) as (tab: Record<string, unknown>, frame: Record<string, unknown>) => Record<string, unknown>;
	const tab = { id: 'notifications', type: 'notifications', notificationFilterDetails: { includeBrands: ['hatady'], includeHataskApp: false, excludeHatadySubtypes: ['reaction'] } };
	const frame = { id: 'frame' };
	const first = columnProps(tab, frame);
	expect(first).toMatchObject({ includeBrands: ['hatady'], includeHataskApp: false, excludeHatadySubtypes: ['reaction'] });
	expect(columnProps(tab, frame)).toBe(first);
	tab.notificationFilterDetails = { includeBrands: ['hataFeed'], includeHataskApp: true, excludeHatadySubtypes: [] };
	const updated = columnProps(tab, frame);
	expect(updated).not.toBe(first);
	expect(updated).toMatchObject({ includeBrands: ['hataFeed'], includeHataskApp: true, excludeHatadySubtypes: [] });
});

test('プロファイル複製で通知詳細を引き継ぎ、複製元とは独立させる', async () => {
	const node = script.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'duplicateProfile');
	if (!node) throw new Error('Missing profile duplication function');
	const code = ts.transpileModule(`${node.getText(script)}\nduplicateProfile;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
	const details = { includeBrands: ['hatady'] };
	const source = { id: 'profile', name: '通知用', layout: 'row', slots: [{ id: 'slot', width: 380, frames: [{ id: 'frame', tabs: [{ id: 'tab', type: 'notifications', notificationFilterDetails: details }] }] }] };
	const commitProfiles = vi.fn((_profiles: unknown[]) => {});
	let serial = 0;
	const duplicateProfile = runInNewContext(code, {
		activeProfile: { value: source }, profiles: { value: [source] },
		genId: (prefix: string) => `${prefix}-${++serial}`,
		deepClone: (value: unknown) => value == null ? value : JSON.parse(JSON.stringify(value)),
		copy: { copiedProfileName: '{name} copy' }, commitProfiles,
		prefer: { commit: vi.fn() },
	}, { timeout: 1000 }) as () => Promise<void>;
	await duplicateProfile();
	const clonedProfile = commitProfiles.mock.calls[0][0][1] as typeof source;
	const cloned = clonedProfile.slots[0].frames[0].tabs[0].notificationFilterDetails;
	expect(cloned).toEqual(details);
	expect(cloned).not.toBe(details);
});
