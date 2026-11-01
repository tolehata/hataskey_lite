/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const read = (path: string) => readFileSync(`${process.cwd()}/src/${path}`, 'utf8');

describe('Hataskey UI deck clock isolation', () => {
	test('秒更新をデッキ本体から隔離し、カラム群を毎秒再描画しない', () => {
		const deck = read('ui/_common_/hatasaba-deck.vue');
		const clock = read('ui/_common_/hatasaba-deck-clock.vue');

		expect(deck).toContain('<HatasabaDeckClock v-if="showClock"');
		expect(deck).toContain("import HatasabaDeckClock from '@/ui/_common_/hatasaba-deck-clock.vue';");
		expect(deck).not.toContain('const now = ref(new Date())');
		expect(deck).not.toContain('clockTimer');
		expect(deck).toContain('const columnPropsCache = new Map');
		expect(deck).toContain('if (cached?.signature === signature) return cached.value;');
		expect(deck).toContain('const value = buildColumnProps(tab);');
		expect(clock).toContain('data-hatasaba-deck-clock');
		expect(clock).toContain('window.setInterval');
		expect(clock).toContain('window.clearInterval');
	});
});
