/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, test } from 'vitest';

function containsLegacySetting(source: string): boolean {
	return /\bentrancePageStyle\b/.test(source);
}

describe('統一されたログイン入口の設定', () => {
	test('旧設定の検出器がClassic/Simple指定を検出する', () => {
		expect(containsLegacySetting("entrancePageStyle: 'classic'")).toBe(true);
		expect(containsLegacySetting('<MkRadios v-model="entrancePageStyle"/>')).toBe(true);
		expect(containsLegacySetting('showTimelineForVisitor: true')).toBe(false);
	});

	test('管理画面・初期設定・型定義・実際の入口が旧設定を使わない', () => {
		for (const file of ['src/pages/admin/branding.vue', 'src/components/MkServerSetupWizard.vue', 'src/instance.ts', 'src/pages/welcome.vue']) {
			expect(containsLegacySetting(readFileSync(resolve(process.cwd(), file), 'utf8')), file).toBe(false);
		}
		const branding = readFileSync(resolve(process.cwd(), 'src/pages/admin/branding.vue'), 'utf8');
		expect(branding).toContain('showTimelineForVisitor');
		expect(branding).toContain('showActivitiesForVisitor');
		expect(readFileSync(resolve(process.cwd(), 'src/pages/welcome.vue'), 'utf8')).toContain('welcome.entrance.hataskey.vue');
	});

	test('翻訳された設定名も撤去し、登録モード案内を3言語で保持する', () => {
		const directory = resolve(process.cwd(), '../../locales');
		for (const file of readdirSync(directory).filter(name => name.endsWith('.yml'))) {
			const locale = (load(readFileSync(resolve(directory, file), 'utf8')) ?? {}) as { _serverSettings?: Record<string, unknown> };
			expect(locale._serverSettings?.entrancePageStyle, file).toBeUndefined();
		}
		for (const language of ['ja-JP', 'en-US', 'zh-CN']) {
			const locale = load(readFileSync(resolve(directory, `${language}.yml`), 'utf8')) as {
				_hata: { _registrationApplications: Record<string, unknown> };
			};
			for (const key of ['acceptApplications', 'acceptApplicationsDescription', 'openRegistrationConfirm', 'openRegistrationActive', 'managementPaused', 'registrationModeChanged']) {
				expect(locale._hata._registrationApplications[key], `${language}/${key}`).toBeTypeOf('string');
			}
		}
	});
});
