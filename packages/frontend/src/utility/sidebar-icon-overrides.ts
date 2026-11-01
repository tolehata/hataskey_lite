/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// 旗鯖fork: 既存ユーザーの simpleUi.sidebar 保存値にはアイコンが焼き込まれているため、
// def.ts のデフォルト変更だけでは過去から使ってるユーザーに新アイコンが反映されない。
// 表示時に id ベースで強制 override することで、保存値を壊さずに新アイコンへ追従させる。
// サイドバー本体 (ui/simple.vue) と設定UI (settings/hata-custom.vue) の両方で参照することで、
// 「サイドバー側だけ新アイコン・設定UI側は旧アイコンのまま」という不整合を防ぐ。
export const SIDEBAR_ICON_OVERRIDES: Record<string, string> = {};

export function applySidebarIconOverride(item: { id: string; icon: string }): string {
	return SIDEBAR_ICON_OVERRIDES[item.id] ?? item.icon;
}
