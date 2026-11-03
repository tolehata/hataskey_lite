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

