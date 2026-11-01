/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 通知先を複数の役割（起票者・参加者・スタッフ等）から集め、除外対象を落として一意化する。
 * 同じ利用者が複数の役割を兼ねても、同一イベントの通知は1件だけにする。
 */
export function mergeHataFeedRecipients(
	excludedIds: Iterable<string>,
	...recipientGroups: Iterable<string>[]
): string[] {
	const excluded = new Set(excludedIds);
	const recipients = new Set<string>();
	for (const group of recipientGroups) {
		for (const id of group) {
			if (!excluded.has(id)) recipients.add(id);
		}
	}
	return [...recipients];
}
