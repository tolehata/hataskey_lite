/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { resolve } from 'node:path';
import { compileScript, compileStyleAsync, parse } from '@vue/compiler-sfc';
import { describe, expect, test } from 'vitest';
import source from './MkNotification.vue?raw';

const link = '/admin/registration-applications';
const iconElement = source.match(/<div v-else-if="([^"]+)" :class="\[\$style\.icon, \$style\.icon_registrationApplication\]">([\s\S]*?)<\/div>/u);

describe('registration application standard notification', () => {
	test('app通知の固定管理リンクだけを、言語に依存しない参加申請アイコンで表す', () => {
		expect(iconElement).not.toBeNull();
		const matches = new Function('notification', `return (${iconElement![1]});`) as (notification: Record<string, unknown>) => boolean;
		expect(matches({ type: 'app', link, icon: null, header: 'A new application' })).toBe(true);
		expect(matches({ type: 'app', link, icon: null, header: '新しい参加申請' })).toBe(true);
		for (const notification of [
			{ type: 'hataFeed', link, icon: null },
			{ type: 'app', link: '/hatask?notice=calendar', icon: null },
			{ type: 'app', link: `${link}?other=true`, icon: null },
			{ type: 'app', link: `https://example.test${link}`, icon: null },
			{ type: 'app', link, icon: 'https://example.test/app.png' },
		]) expect(matches(notification)).toBe(false);
		expect(iconElement![2]).toContain('class="ti ti-user-plus" aria-hidden="true"');
	});

	test('既存app本文の管理リンクを使い、新しい通知typeや操作を追加しない', () => {
		expect(source).toContain('<MkA v-if="notification.link" :to="notification.link" :class="$style.appLink">');
		expect(source).toContain("notification.type === 'app' || notification.type === 'hataFeed'");
		expect(iconElement![1]).not.toContain('header');
		expect(iconElement![2]).not.toContain('<button');
	});

	test('実テンプレートとSCSSをコンパイルし、参加申請アイコンへテーマ色を結線する', async () => {
		const filename = resolve(process.cwd(), 'src/components/MkNotification.vue');
		const parsed = parse(source, { filename });
		expect(parsed.errors).toEqual([]);
		expect(() => compileScript(parsed.descriptor, { id: 'mk-notification-registration', inlineTemplate: true })).not.toThrow();
		const style = await compileStyleAsync({
			source: parsed.descriptor.styles[0]!.content,
			filename,
			id: 'mk-notification-registration',
			preprocessLang: 'scss',
			modules: true,
		});
		expect(style.errors).toEqual([]);
		expect(style.modules?.icon_registrationApplication).toBeTruthy();
		const iconStyle = source.match(/\.icon_registrationApplication\s*\{([^}]+)\}/u)![1];
		expect(iconStyle).toContain('place-items: center;');
		expect(iconStyle).toContain('background: var(--MI_THEME-accent);');
		expect(iconStyle).toContain('color: var(--MI_THEME-fgOnAccent);');
	});
});
