/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

function source(fileName: string): string {
	return fs.readFileSync(path.join(process.cwd(), 'src/utility', fileName), 'utf8');
}

describe('iOS PWAの絵文字ピッカー', () => {
	for (const fileName of ['reaction-picker.ts', 'emoji-picker.ts']) {
		test(`${fileName}はタップ経路で同期的にダイアログを開く`, () => {
			const code = source(fileName);

			expect(code).toContain('import MkEmojiPickerDialog from \'@/components/MkEmojiPickerDialog.vue\';');
			expect(code).toContain('launcher: typeof popup = popup');
			expect(code).toContain('launcher(MkEmojiPickerDialog, {');
			expect(code.slice(code.indexOf('public show('))).not.toMatch(/\bawait\b/);
			expect(code).not.toMatch(/import\s*\{[^}]*defineAsyncComponent/);
			expect(code).not.toMatch(/defineAsyncComponent\s*\(/);
			expect(code).not.toContain('import(\'@/components/MkEmojiPickerDialog.vue\')');
			expect(code).not.toContain('manualShowing');
		});
	}

	test('リアクションごとに対象ノートとアンカーを独立したrefへ保持する', () => {
		const code = source('reaction-picker.ts');

		expect(code).toContain('const anchorRef = shallowRef(anchorElement);');
		expect(code).toContain('const targetNoteRef = ref(targetNote);');
		expect(code).toContain('closed: () => {');
		expect(code).toContain('dispose();');
	});
});
