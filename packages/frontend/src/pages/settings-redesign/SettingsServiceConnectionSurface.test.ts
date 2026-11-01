/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileScript, parse } from '@vue/compiler-sfc';
import { describe, expect, test } from 'vitest';

const sourcePath = resolve(process.cwd(), 'src/pages/settings-redesign/SettingsServiceConnectionSurface.vue');

describe('SettingsServiceConnectionSurface source contract', () => {
	test('SFCが構文上有効で、旧Paginatorに存在しないdisposeを呼ばない', async () => {
		const source = await readFile(sourcePath, 'utf8');
		const parsed = parse(source, { filename: sourcePath });
		expect(parsed.errors).toEqual([]);
		expect(() => compileScript(parsed.descriptor, { id: 'settings-service-connection-surface' })).not.toThrow();
		expect(source).not.toContain('webhooks.dispose()');
	});

	test('既存のアクセストークン発行フローと管理導線を保持する', async () => {
		const source = await readFile(sourcePath, 'utf8');

		expect(source).toContain('import * as os from \'@/os.js\'');
		expect(source).toContain('import { misskeyApi } from \'@/utility/misskey-api.js\'');
		expect(source).toContain('import { copyToClipboard } from \'@/utility/copy-to-clipboard.js\'');
		expect(source).toContain('import(\'@/components/MkTokenGenerateWindow.vue\').then(x => x.default)');
		expect(source).toContain('misskeyApi(\'miauth/gen-token\'');
		expect(source).toContain('closed: () => dispose()');
		expect(source).toContain('copyToClipboard(token)');
		expect(source).toContain('to="/settings/apps"');
		expect(source).toContain('to="/api-console"');
		expect(source).toContain('<MkButton primary rounded :class="$style.actionButton" @click="generateToken">');
	});

	test('Webhookを一覧・作成・編集でき、空状態でも作成操作を残す', async () => {
		const source = await readFile(sourcePath, 'utf8');

		expect(source).toContain('new Paginator(\'i/webhooks/list\'');
		expect(source).toContain('noPaging: true');
		expect(source.match(/to="\/settings\/webhook\/new"/gu)).toHaveLength(2);
		expect(source).toContain('`/settings/webhook/edit/${webhook.id}`');
		expect(source).toContain('{{ i18n.ts.nothing }}');
		expect(source).toContain('{{ i18n.ts._webhookSettings.createWebhook }}');
		expect(source).toContain('webhook.latestSentAt != null');
		expect(source).toContain('webhook.active === false');
		expect(source).toContain('[200, 201, 204].includes(webhook.latestStatus)');
	});

	test('テーマtoken・44px操作・reduced motionを使い、黒直書きやblurを持たない', async () => {
		const source = await readFile(sourcePath, 'utf8');

		expect(source).toContain('min-height: 44px');
		expect(source).toContain('color-mix(in srgb, var(--MI_THEME-panel)');
		expect(source).toContain('@media (prefers-reduced-motion: reduce)');
		expect(source).not.toMatch(/#000|black|backdrop-filter/i);
	});
});
