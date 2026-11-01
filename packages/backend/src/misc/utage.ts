/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as mfm from 'mfc-js';

const UTAGE_REGEX = /宴|うたげ|ぅたげ|utage/i;
const VISIBLE_FUNCTIONS = new Set(['x2', 'x3', 'x4', 'font']);

type UtageNote = {
	text?: string | null;
	cw?: string | null;
	visibility: string;
	userHost?: string | null;
	channelId?: string | null;
};

// 色・移動・縮小などは隣の語にも重ねられるため、子孫だけでなく可視欄全体を対象外にする。
// 未知の関数も許可せず、表示が変わるMFMの追加で判定をすり抜けないようにする。
function canHideContent(nodes: mfm.MfmNode[], inQuote = false): boolean {
	return nodes.some(node => {
		if (node.type === 'small' || node.type === 'mathInline' || node.type === 'mathBlock') return true;
		if (node.type === 'fn' && !VISIBLE_FUNCTIONS.has(node.props.name)) return true;
		if (node.type === 'quote' && inQuote) return true;
		return node.children != null && canHideContent(node.children, inQuote || node.type === 'quote');
	});
}

function containsUtageWord(nodes: mfm.MfmNode[]): boolean {
	return nodes.some(node => {
		switch (node.type) {
			case 'text': return UTAGE_REGEX.test(node.props.text);
			// 宴のカスタム絵文字による従来の参加は維持する。
			case 'emojiCode': return UTAGE_REGEX.test(node.props.name);
			case 'inlineCode': return UTAGE_REGEX.test(node.props.code);
			case 'hashtag': return UTAGE_REGEX.test(node.props.hashtag);
			case 'bold':
			case 'italic':
			case 'strike':
			case 'center':
			case 'plain':
			case 'quote':
			case 'link':
			case 'fn':
				return containsUtageWord(node.children);
			// URL・リンク先・関数の引数・コード言語等のメタデータは対象外。
			// blockCodeは省データ設定で、searchは入力欄の幅で語が隠れるため対象外。
			default: return false;
		}
	});
}

/** LTL上で、開く操作をせずに見える宴の宣言だけを参加対象とする。 */
export function isUtageEligible(note: UtageNote): boolean {
	if (note.userHost != null || note.visibility !== 'public' || note.channelId != null) return false;
	// 空のCWも本文を隠す。CWがある場合は本文に含まれる語で開始しない。
	const visibleText = note.cw ?? note.text;
	if (!visibleText || !UTAGE_REGEX.test(visibleText)) return false;
	const nodes = mfm.parse(visibleText);
	return !canHideContent(nodes) && containsUtageWord(nodes);
}
