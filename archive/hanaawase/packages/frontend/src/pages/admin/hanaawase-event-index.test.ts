/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { isProxy, reactive } from 'vue';
import { describe, expect, test } from 'vitest';
import { copyHanaawaseEventIndex } from './hanaawase-event-index.js';
import type { HanaawaseEventIndex } from './hanaawase-event-index.js';

describe('Hanaawase event management index', () => {
	test('copies a Vue Proxy into a detached plain object that can be sent to the API', () => {
		const source = reactive<HanaawaseEventIndex>({
			v: 1,
			events: [{
				id: 'mago-no-inuma',
				title: '孫の居ぬ間になんとやら',
				rev: 1,
				runs: [{
					start: '2026-08-01T00:00+09:00',
					end: '2026-08-18T00:00+09:00',
					label: '初回',
				}],
				archiveFrom: '2026-08-18T00:00+09:00',
			}],
		});

		expect(isProxy(source)).toBe(true);
		expect(() => structuredClone(source)).toThrow();

		const copy = copyHanaawaseEventIndex(source);

		expect(isProxy(copy)).toBe(false);
		expect(isProxy(copy.events[0])).toBe(false);
		expect(isProxy(copy.events[0].runs[0])).toBe(false);
		expect(() => structuredClone(copy)).not.toThrow();
		expect(copy).toEqual(source);

		copy.events[0].runs[0].label = '変更後';
		expect(source.events[0].runs[0].label).toBe('初回');
	});
});
