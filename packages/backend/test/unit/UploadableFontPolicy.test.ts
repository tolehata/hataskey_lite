/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fileTypeFromBuffer } from 'file-type';
import { describe, expect, test, vi } from 'vitest';
import { FILE_TYPE_BROWSERSAFE } from '@/const.js';
import { DEFAULT_POLICIES } from '@/core/RoleService.js';
import { AddFontUploadableFileTypes1788300000000 } from '../../migration/1788300000000-add-font-uploadable-file-types.js';

describe('フォントファイルの既定アップロード許可', () => {
	test('file-type の TTF/OTF 判定と同じ MIME タイプを許可する', async () => {
		const ttf = Buffer.alloc(4100);
		Buffer.from([0x00, 0x01, 0x00, 0x00, 0x00]).copy(ttf);
		const otf = Buffer.alloc(4100);
		Buffer.from([0x4f, 0x54, 0x54, 0x4f, 0x00]).copy(otf);

		expect(await fileTypeFromBuffer(ttf)).toEqual({ ext: 'ttf', mime: 'font/ttf' });
		expect(await fileTypeFromBuffer(otf)).toEqual({ ext: 'otf', mime: 'font/otf' });
		expect(DEFAULT_POLICIES.uploadableFileTypes).toContain('font/ttf');
		expect(DEFAULT_POLICIES.uploadableFileTypes).toContain('font/otf');
		expect(DEFAULT_POLICIES.uploadableFileTypes).not.toContain('font/*');
		expect(FILE_TYPE_BROWSERSAFE).toContain('font/ttf');
		expect(FILE_TYPE_BROWSERSAFE).toContain('font/otf');
	});

	test('移行は従来の既定リストにだけ2種類を追加する', async () => {
		const query = vi.fn();
		await new AddFontUploadableFileTypes1788300000000().up({ query });

		expect(query).toHaveBeenCalledOnce();
		const sql = String(query.mock.calls[0][0]);
		expect(sql).toContain('"font/ttf", "font/otf"');
		expect(sql).toContain('WHERE "policies"->\'uploadableFileTypes\' = \'["text/*", "application/json", "image/*", "video/*", "audio/*"]\'::jsonb');
	});

	test('巻き戻しも新しい既定リストと一致する場合だけを対象にする', async () => {
		const query = vi.fn();
		await new AddFontUploadableFileTypes1788300000000().down({ query });

		expect(query).toHaveBeenCalledOnce();
		const sql = String(query.mock.calls[0][0]);
		expect(sql).toContain('WHERE "policies"->\'uploadableFileTypes\' = \'["text/*", "application/json", "image/*", "video/*", "audio/*", "font/ttf", "font/otf"]\'::jsonb');
	});
});
