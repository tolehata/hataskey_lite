/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const CUSTOM_FONT_MIME_BY_EXTENSION = {
	ttf: new Set(['font/ttf', 'application/x-font-ttf', 'application/octet-stream', '']),
	otf: new Set(['font/otf', 'application/x-font-opentype', 'application/vnd.ms-opentype', 'application/octet-stream', '']),
	woff2: new Set(['font/woff2', 'application/font-woff2', 'application/octet-stream', '']),
} as const;

export type CustomFontFileLike = {
	name: string;
	type: string;
};

function customFontExtension(name: string): keyof typeof CUSTOM_FONT_MIME_BY_EXTENSION | null {
	const match = name.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
	if (match == null) return null;
	const extension = match[1];
	return extension === 'ttf' || extension === 'otf' || extension === 'woff2' ? extension : null;
}

/** ドライブで選べる既存形式。拡張子だけでなく、サーバーが検出したMIMEも一致させる。 */
export function isSupportedCustomFontFile(file: CustomFontFileLike): boolean {
	const extension = customFontExtension(file.name);
	if (extension == null) return false;
	return (CUSTOM_FONT_MIME_BY_EXTENSION[extension] as ReadonlySet<string>).has(file.type);
}

/** 既定ポリシーで新しく直接アップロードできる形式。内容はサーバー側でも再検出する。 */
export function isDirectUploadCustomFontFile(file: CustomFontFileLike): boolean {
	const extension = customFontExtension(file.name);
	if (extension !== 'ttf' && extension !== 'otf') return false;
	return (CUSTOM_FONT_MIME_BY_EXTENSION[extension] as ReadonlySet<string>).has(file.type);
}
