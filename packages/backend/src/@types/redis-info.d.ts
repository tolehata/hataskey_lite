/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

declare module 'redis-info' {
	// redis-info は `INFO` コマンドの生テキストを `key:value` の辞書へパースするだけで、
	// フィールドの網羅的な型定義は提供していない(実体は Record<string, string>)。
	function parse(info: string): Record<string, string>;

	export { parse };
}
