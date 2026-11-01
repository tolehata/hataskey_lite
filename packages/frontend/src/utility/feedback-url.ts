/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const defaultFeedbackUrl = 'https://github.com/tolehata/hataskey/issues/new';

const legacyDefaultFeedbackUrls = new Set([
	'https://github.com/tolehata/hataskey/issues',
	'https://github.com/kokonect-link/cherrypick/issues/new',
	'https://code.tolehata.net/hatacha/cherrypick-hata/issues',
	'https://code.tolehata.net/hatacha/cherrypick-hata/issues/new',
]);

/** 旧既定値の完全一致だけ読み替える。非表示(null/空欄)と管理者の独自URLは保持する。 */
export function resolveFeedbackUrl(url: string | null): string | null {
	return url != null && legacyDefaultFeedbackUrls.has(url) ? defaultFeedbackUrl : url;
}
