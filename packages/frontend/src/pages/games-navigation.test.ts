/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const cwd = process.cwd();
const gamesSource = readFileSync(`${cwd}/src/pages/games.vue`, 'utf8');
const desktopHeaderSource = readFileSync(`${cwd}/src/components/global/MkPageHeader.vue`, 'utf8');
const mobileHeaderSource = readFileSync(`${cwd}/src/components/global/CPPageHeader.vue`, 'utf8');
const routerSource = readFileSync(`${cwd}/src/router.definition.ts`, 'utf8');

describe('Hataskey Games の戻る導線', () => {
	test('PC・モバイルとも履歴上のゲームではなくホームへ戻る', () => {
		expect(gamesSource).toContain('<PageWithHeader backPath="/">');
		for (const source of [desktopHeaderSource, mobileHeaderSource]) {
			expect(source).toContain('backPath?: string;');
			expect(source).toMatch(/if \(props\.backPath\) \{\s*router\.pushByPath\(props\.backPath\);\s*return;\s*\}/);
		}
	});

	test('保管した花常への入口を外し、ほかのゲームへの導線は維持する', () => {
		expect(gamesSource).not.toContain('/hanaawase');
		expect(routerSource).not.toContain('/hanaawase');
		for (const route of ['/games', '/bubble-game', '/reversi']) {
			expect(routerSource).toContain(`path: '${route}'`);
			if (route !== '/games') expect(gamesSource).toContain(`to="${route}"`);
		}
	});

	test('廃止したつみつみタワー・絵文字叩き・エモジシュートへの導線を残さない', () => {
		for (const route of ['/stacking-game', '/whack-emoji', '/emoji-shoot']) {
			expect(routerSource).not.toContain(`path: '${route}`);
			expect(gamesSource).not.toContain(`to="${route}`);
		}
	});

	test('HataGoes 内では対象外のバブルとリバーシだけを隠す', () => {
		expect(gamesSource).toContain("inject(HATA_GOES_HOST, null) != null");
		for (const route of ['/bubble-game', '/reversi']) {
			expect(gamesSource).toMatch(new RegExp(`<div v-if="!inHataGoes" class="_panel" :class="\\$style.link">\\s*<MkA to="${route}"`));
		}
	});
});
