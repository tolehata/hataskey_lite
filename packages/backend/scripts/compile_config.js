/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// 旗鯖fork: 本家 Misskey は最近 .config/*.yml を起動時に毎回 yaml.load せず、
// ビルド時に JSON に変換 (compile_config.js) → 起動時は JSON だけ読む、という最適化を入れた。
// (理由は js-yaml の起動時依存を削る + コード実行脆弱性回避)
//
// 旗鯖 fork は config.ts:loadConfig() が依然として YAML を直接 yaml.load しているため
// このスクリプトは no-op で OK。package.json scripts の `pnpm compile-config &&` 接頭辞を
// 互換維持するためだけに存在する。
//
// 将来 YAML→JSON コンパイル方式に追従する場合は、本家 #16929 (24bd150967) を参照。

console.log('compile-config: no-op (Hata fork uses YAML directly)');
