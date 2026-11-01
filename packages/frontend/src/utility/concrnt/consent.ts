/* SPDX-License-Identifier: AGPL-3.0-only */

// 旗鯖fork: コンカレント連携の使用同意。外部アカウント連携(外部TL)と同じ免責事項・同じ同意記録を使う。
//   同意前は接続先の確認・サブキーの検証・保存済み接続の再開を含め、コンカレントへ何も送らない。

import { prefer } from '@/preferences.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';

export function hasConcrntConsent(): boolean {
	return prefer.s['hataConsent.externalTl'] === true;
}

/**
 * 接続先ごとに免責事項を示し、同意したときだけ true を返す。同意は外部TLと同じ項目へ記録する。
 * 入力したドメインは表示前に正規化する（形式が不正なら invalid-input で投げる。通信はしない）。
 */
export async function requestConcrntConsent(input: string): Promise<boolean> {
	const { normalizeConcrntDomain } = await import('./protocol.js');
	const host = normalizeConcrntDomain(input);
	const copy = i18n.ts._hata._externalAccount;
	const { canceled, result } = await os.actions({
		type: 'warning',
		title: copy.externalDisclaimerTitle,
		text: i18n.tsx._hata._externalAccount.externalDisclaimer({ host }),
		actions: [
			{ value: 'ok', text: copy.understoodStart, primary: true },
			{ value: 'cancel', text: copy.notNow },
		],
	});
	if (canceled || result === 'cancel') return false;
	prefer.commit('hataConsent.externalTl', true);
	prefer.commit('hataConsent.externalTlDate', new Date().toISOString());
	misskeyApi('hata/consent/update', { type: 'externalTl', agree: true }).catch(console.error);
	return true;
}
