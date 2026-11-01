/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 申請テーブルを含むSQLは、位置引数も直接埋め込まれた値も出力しない。
 * テーブル名の検出は整形・切り詰めより先に行い、引用符・スキーマ・大小文字に依存しない。
 * 他のSQLは同じ値を返し、既存のログ設定と日時の整形を維持する。
 */
export function redactRegistrationApplicationSql(query: string, parameters?: unknown[]): {
	query: string;
	parameters: unknown[] | undefined;
} {
	if (/\bregistration_application\b/i.test(query)) {
		return { query: '[REDACTED registration_application SQL]', parameters: undefined };
	}
	return { query, parameters };
}
