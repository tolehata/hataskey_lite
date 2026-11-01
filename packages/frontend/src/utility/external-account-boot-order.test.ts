/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('外部アカウント撤去時の起動順', () => {
	test('端末移行を終えた後に外部通知ストリームを開始する', () => {
		const boot = source('src/boot/main-boot.ts');
		const commonCompleted = boot.indexOf('const { isClientUpdated, isClientMigrated } = await common');
		const streamStarted = boot.indexOf('startExternalNotificationStream();');
		expect(commonCompleted).toBeGreaterThan(-1);
		expect(streamStarted).toBeGreaterThan(commonCompleted);
	});

	test('再接続時にも撤去先を拒否する', () => {
		const stream = source('src/utility/external-notification-stream.ts');
		expect(stream).toContain('import { isAllowedExternalHost } from \'@/utility/external-api.js\';');
		expect(stream).toContain('token != null && isAllowedExternalHost(host)');
	});
});
