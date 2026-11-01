/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 旗鯖fork: 詳細画面でしばらく何も変えていないとき、見出しの場所に
 * 「設定はここから探せる」ことをそっと知らせるための時計。
 *
 * ⚠️画面の都合（Vue）から切り離してある。ここが動くことは試験で示せるが、
 *   画面へ繋ぎ忘れると何も起きない。繋ぎ込みは別途 contract 試験で見張ること。
 *   （実際、最初の実装は「繋いだつもり」で一度も数え始めていなかった）
 *
 * ⚠️しつこくしないための決まりが2つある。どちらも「もう知っている人へ
 *   同じ案内を出し続けない」ためのもので、外すと急にうるさくなる。
 *
 *   1. 案内を見たあとに実際に検索を使った人には、**その滞在のあいだは**
 *      もう出さない。用は足りているので、繰り返す意味がない。
 *   2. 設定から出て入り直したときは出してよいが、待ち時間を20秒延ばす。
 *      延ばせるのは読み込み直すまでに3回まで（15→35→55→75秒）。
 */
export type SearchHintController = {
	/** いまの見え方。true のあいだ見出しの代わりに案内を出す */
	readonly visible: () => boolean;
	/** いまの待ち時間（ミリ秒）。延長のぶんを含む */
	readonly idleMs: () => number;
	/** 数え直す（画面が変わった／設定をいじった） */
	restart: () => void;
	/**
	 * 検索を使った。
	 * ⚠️案内を見たあとに使った場合だけ効かせること。案内を見ていない人が
	 *   たまたま検索しただけで黙らせてしまうと、案内が一度も届かない。
	 */
	noteSearchUsed: () => void;
	/** 設定から出た（＝次に入り直したときは、また出してよい） */
	noteLeftSettings: () => void;
	/**
	 * 片付ける（画面から離れるとき）。
	 * ⚠️永久停止にしないこと。keep-alive で戻ってきたときに二度と
	 *   動かなくなる。ここは「いま数えているのをやめる」だけ。
	 */
	stop: () => void;
};

export type SearchHintOptions = {
	idleMs: number;
	visibleMs: number;
	/** 出してよい場面か（狭い幅の詳細画面だけ、など） */
	eligible: () => boolean;
	/** 見え方が変わったときに呼ばれる */
	onChange: (visible: boolean) => void;
	/** 入り直すたびに延ばす量。既定20秒 */
	extensionMs?: number;
	/** 読み込み直すまでに延ばせる回数。既定3回 */
	maxExtensions?: number;
	setTimer?: (fn: () => void, ms: number) => number;
	clearTimer?: (id: number) => void;
};

export function createSearchHintController(options: SearchHintOptions): SearchHintController {
	const setTimer = options.setTimer ?? ((fn, ms) => window.setTimeout(fn, ms) as unknown as number);
	const clearTimer = options.clearTimer ?? ((id) => window.clearTimeout(id));
	const extensionMs = options.extensionMs ?? 20000;
	const maxExtensions = options.maxExtensions ?? 3;

	let timer: number | null = null;
	let visible = false;

	/** この滞在のあいだ、もう出さない */
	let mutedForThisVisit = false;
	/** この滞在で一度でも出したか（＝検索の抑止を効かせてよいか） */
	let shownInThisVisit = false;
	/** 出たときに延長すべきか */
	let extensionPending = false;
	/** 読み込み直すまでに延ばした回数 */
	let extensions = 0;

	function currentIdleMs() {
		return options.idleMs + (extensionMs * extensions);
	}

	function setVisible(next: boolean) {
		if (visible === next) return;
		visible = next;
		options.onChange(next);
	}

	function stopTimer() {
		if (timer != null) clearTimer(timer);
		timer = null;
	}

	function restart() {
		stopTimer();
		// ⚠️出ている最中に数え直しが来たら、すぐ見出しへ戻す。
		//   いま何の画面かが読めない時間を延ばさないこと。
		setVisible(false);
		if (mutedForThisVisit || !options.eligible()) return;
		timer = setTimer(() => {
			// ⚠️出す直前にもう一度確かめる。待っているあいだに画面が広くなって
			//   いることがあり、そのときは検索窓が見えているので出す必要がない。
			if (mutedForThisVisit || !options.eligible()) return;
			shownInThisVisit = true;
			setVisible(true);
			timer = setTimer(() => {
				setVisible(false);
				// ⚠️戻したら、また待ち直す。続けざまに出さない。
				restart();
			}, options.visibleMs);
		}, currentIdleMs());
	}

	return {
		visible: () => visible,
		idleMs: currentIdleMs,
		restart,
		noteSearchUsed: () => {
			// ⚠️案内を見ていない人の検索では黙らせない。
			if (!shownInThisVisit) return;
			mutedForThisVisit = true;
			extensionPending = true;
			stopTimer();
			setVisible(false);
		},
		noteLeftSettings: () => {
			if (extensionPending && extensions < maxExtensions) extensions += 1;
			extensionPending = false;
			mutedForThisVisit = false;
			shownInThisVisit = false;
			stopTimer();
			setVisible(false);
		},
		stop: () => {
			stopTimer();
			setVisible(false);
		},
	};
}
