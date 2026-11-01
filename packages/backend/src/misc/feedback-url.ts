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

/** 返却時だけ旧既定値を読み替える。保存値・非表示設定・管理者の独自URLは変更しない。 */
export function resolveFeedbackUrl(url: string | null): string | null {
	return url != null && legacyDefaultFeedbackUrls.has(url) ? defaultFeedbackUrl : url;
}
