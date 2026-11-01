/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// 旗鯖fork: 元の本家版は React JSX (.tsx) で書かれていたが、バックエンドの tsconfig には
//   "jsx" 設定が無く、React ランタイムも依存に入っていない。Scalar の埋め込み HTML は
//   外部依存のない静的テンプレートで十分なので、文字列リテラルで返すよう .ts 化した。
export function ApiDocPage(): string {
	return `<!DOCTYPE html>
<html>
	<head>
		<meta charset="UTF-8" />
		<title>Misskey API</title>
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<style>body { margin: 0; padding: 0; }</style>
	</head>
	<body>
		<script id="api-reference" data-url="/api.json"></script>
		<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
	</body>
</html>`;
}
