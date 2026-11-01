/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import { normalizeHataskPlannerTemplates } from './hatask-planner-templates.js';

describe('normalizeHataskPlannerTemplates', () => {
	test('未知フィールドを維持し、不正行と重複IDを保存対象へ混ぜない', () => {
		const result = normalizeHataskPlannerTemplates([
			{ id: 'one', kind: 'todo', name: '朝支度', payload: { text: '支度' }, future: true },
			{ id: 'one', kind: 'event', name: '重複', payload: {} },
			{ id: 'bad', kind: 'unknown', name: '不正', payload: {} },
		]);
		expect(result.invalidCount).toBe(2);
		expect(result.templates).toHaveLength(1);
		expect(result.templates[0]).toMatchObject({ id: 'one', future: true, position: 0, archivedAt: null });
	});
});
