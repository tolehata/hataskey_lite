/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import type { DataSource } from 'typeorm';
import type Logger from '@/logger.js';
import Chart from '@/core/chart/core.js';
import { ChartManagementService } from '@/core/chart/ChartManagementService.js';
import { sqlStringEscape } from '@/misc/sql-string-escape.js';

const schema = {
	value: { range: 'small' },
	unique: { range: 'small', uniqueIncrement: true },
} as const;

class RangeChart extends Chart<typeof schema> {
	constructor(db: DataSource) {
		super(db, async () => () => {}, { info: () => {} } as unknown as Logger, 'rangeTest', schema);
	}

	protected async tickMajor() { return { value: 40000 }; }
	protected async tickMinor() { return { value: -40000 }; }

	public add(value: number, unique?: string) {
		this.commit({ value, ...(unique == null ? {} : { unique: [unique] }) });
	}
}

type Update = Record<string, number | (() => string)>;

function createChart() {
	const updates: Update[] = [];
	let failOnce = false;
	const repository = {
		extend() { return this; },
		createQueryBuilder() {
			let value: Update;
			return {
				update() { return this; },
				set(next: Update) { value = next; return this; },
				where() { return this; },
				async execute() {
					updates.push(value);
					if (failOnce) {
						failOnce = false;
						throw new Error('write failed');
					}
				},
			};
		},
	};
	const db = { getRepository: () => repository } as unknown as DataSource;
	const chart = new RangeChart(db);
	Object.defineProperty(chart, 'claimCurrentLog', {
		configurable: true,
		value: async (_group: string | null, span: 'hour' | 'day') => ({
			id: span === 'hour' ? 1 : 2,
			group: null,
			date: 0,
			___value: 32766,
			___unique: 0,
			unique_temp___unique: [],
		}),
	});
	return { chart, updates, failNext: () => { failOnce = true; } };
}

describe('Misskey 2026.9.1 chart fixes', () => {
	test('quotes unique values as SQL array elements', async () => {
		const { chart, updates } = createChart();
		const key = `a'b\\c,{x}"`;
		assert.equal(sqlStringEscape(key), `'a''b\\c,{x}"'`);
		chart.add(1, key);
		await chart.save();
		assert.equal(updates.length, 2);
		for (const update of updates) {
			assert.equal((update.unique_temp___unique as () => string)(), `array_cat("unique_temp___unique", ARRAY['a''b\\c,{x}"']::varchar[])`);
		}
	});

	test('clamps smallint increments and tick values at both bounds', async () => {
		const { chart, updates } = createChart();
		chart.add(4);
		await chart.save();
		assert.equal((updates[0].___value as () => string)(), 'LEAST("___value"::bigint + 4, 32767)');
		chart.add(-70000);
		await chart.save();
		assert.equal((updates[2].___value as () => string)(), 'GREATEST("___value"::bigint - 70000, -32768)');
		await chart.tick(true);
		await chart.tick(false);
		assert.equal(updates[4].___value, 32767);
		assert.equal(updates[6].___value, -32768);
	});

	test('discards a failed buffer and accepts the next save', async () => {
		const { chart, updates, failNext } = createChart();
		chart.add(1);
		failNext();
		await assert.rejects(chart.save(), /write failed/);
		chart.add(2);
		await chart.save();
		assert.equal((updates.at(-1)?.___value as () => string)(), 'LEAST("___value"::bigint + 2, 32767)');
	});

	test('continues saving other charts after one fails', async () => {
		const calls: string[] = [];
		const failing = { save: async () => { calls.push('first'); throw new Error('write failed'); } };
		const succeeding = { save: async () => { calls.push('second'); } };
		const logger = { logger: { error: () => calls.push('logged') } };
		const manager = Reflect.construct(ChartManagementService, [failing, succeeding, ...Array(10).fill(succeeding), logger]) as ChartManagementService;
		await (manager as unknown as { saveAll: () => Promise<void> }).saveAll();
		assert.deepEqual(calls.slice(0, 3), ['first', 'logged', 'second']);
	});
});
