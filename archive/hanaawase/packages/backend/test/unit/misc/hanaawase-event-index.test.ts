/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import _Ajv from 'ajv';
import { describe, expect, test } from 'vitest';
import {
	DEFAULT_HANAAWASE_EVENT_INDEX,
	parseHanaawaseEventIndex,
} from '@/misc/hanaawase-event-index.js';
import { meta as publicMeta } from '@/server/api/endpoints/games/hanaawase/event-index.js';
import { meta as adminReadMeta } from '@/server/api/endpoints/admin/games/hanaawase/event-index.js';
import {
	meta as adminWriteMeta,
	paramDef as adminWriteParamDef,
} from '@/server/api/endpoints/admin/games/hanaawase/update-event-index.js';

const Ajv = _Ajv.default;

const copyDefault = () => structuredClone(DEFAULT_HANAAWASE_EVENT_INDEX);

describe('Hanaawase event index', () => {
	test('accepts the seeded event schedule', () => {
		expect(parseHanaawaseEventIndex(copyDefault())).toEqual(DEFAULT_HANAAWASE_EVENT_INDEX);
	});

	test('requires an explicit timezone', () => {
		const value = copyDefault();
		value.events[0].runs[0].start = '2026-08-01T00:00';
		expect(parseHanaawaseEventIndex(value)).toBeUndefined();
	});

	test('rejects a run whose end is not after its start', () => {
		const value = copyDefault();
		value.events[0].runs[0].end = value.events[0].runs[0].start;
		value.events[0].archiveFrom = value.events[0].runs[0].end;
		expect(parseHanaawaseEventIndex(value)).toBeUndefined();
	});

	test('rejects overlapping runs', () => {
		const value = copyDefault();
		value.events[0].runs.push({
			start: '2026-08-17T00:00+09:00',
			end: '2026-08-20T00:00+09:00',
			label: '重複',
		});
		expect(parseHanaawaseEventIndex(value)).toBeUndefined();
	});

	test('rejects duplicate event ids', () => {
		const value = copyDefault();
		value.events.push(structuredClone(value.events[0]));
		expect(parseHanaawaseEventIndex(value)).toBeUndefined();
	});

	test('keeps archiveFrom synchronized with the first run end', () => {
		const value = copyDefault();
		value.events[0].archiveFrom = '2026-08-19T00:00+09:00';
		expect(parseHanaawaseEventIndex(value)).toBeUndefined();
	});

	test('exposes public read but protects both management endpoints with admin auth', () => {
		expect(publicMeta.requireCredential).toBe(false);
		expect(adminReadMeta.requireCredential).toBe(true);
		expect(adminReadMeta.requireAdmin).toBe(true);
		expect(adminWriteMeta.requireCredential).toBe(true);
		expect(adminWriteMeta.requireAdmin).toBe(true);
	});

	test('registers all three endpoints in the server endpoint list', () => {
		const source = readFileSync(resolve(import.meta.dirname, '../../../src/server/api/endpoint-list.ts'), 'utf8');
		expect(source).toContain("'games/hanaawase/event-index'");
		expect(source).toContain("'admin/games/hanaawase/event-index'");
		expect(source).toContain("'admin/games/hanaawase/update-event-index'");
	});

	test('compiles the management input schema in the same strict Ajv mode as Endpoint', () => {
		expect(() => new Ajv({ useDefaults: true }).compile(adminWriteParamDef)).not.toThrow();
	});
});
