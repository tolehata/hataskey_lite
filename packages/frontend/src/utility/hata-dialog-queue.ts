/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: 起動直後に出る案内ダイアログを1つずつ順番に出すための待ち行列。
 *
 * ⚠️これが無いと、更新ダイアログ・機能の告知・ログイン日数が同時に開いて重なる。
 * ⚠️さらに厄介なのは MkUpdated を閉じると clearCache() がページを再読み込みすること。
 *   同時に開いていた後続のダイアログは**再読み込みで道連れに消える**（利用者報告）。
 *   → 順番に出し、かつ「出した」の記録は**実際に閉じられたときだけ**付ける。
 *     こうしておけば、途中で再読み込みが挟まっても次回の起動で残りが出る。
 */

type DialogOpener = () => Promise<void>;

const queue: DialogOpener[] = [];
let running = false;

async function drain(): Promise<void> {
	if (running) return;
	running = true;
	try {
		while (queue.length > 0) {
			const open = queue.shift()!;
			try {
				await open();
			} catch (err) {
				// ⚠️1つ転んでも残りは出す（案内が丸ごと消える方が損）。
				console.error('[hata] dialog queue: failed to show a dialog', err);
			}
		}
	} finally {
		running = false;
	}
}

/**
 * ダイアログを待ち行列に積む。`open` は「閉じられたら解決する Promise」を返すこと。
 * ⚠️解決しない Promise を渡すと以降のダイアログが永久に出なくなる。
 */
export function enqueueHataDialog(open: DialogOpener): void {
	queue.push(open);
	void drain();
}
