/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const onlineText = {
	title: '人と打つ', match: 'フリーマッチ', invite: '招待する', inviteNote: 'フォロー中の、このサーバーの人を招待できます。',
	opponent: '相手', rules: 'ルール', visibilityStep: '公開', matchDesc: '同じ条件の人と組みます', inviteDesc: 'フォロー中の人を選びます',
	findOpponent: '相手を探す', chooseAndInvite: '相手を選んで招待', searching: '相手を探しています', searchingFor: '条件', elapsed: '経過',
	anySize: 'ほかの路数の人とも組む', anySizeHint: '見つかった相手の路数ではじまります。はじまる前なら二人で変えられます', otherSizes: 'ほかの路数も',
	byoyomiTitle: '秒読み', byoyomiDesc: '20分＋30秒×5', correspondenceTitle: 'のんびり', correspondenceDesc: '1手24時間', bothAllow: '二人とも許可したときだけ公開されます',
	size: '路数', lines: '路', clock: '持ち時間', byoyomi: '早碁・標準（秒読み）', fast: '早碁 · 5分＋30秒×3', standard: '標準 · 20分＋30秒×5', correspondence: 'のんびり · 1手24時間',
	matching: '同じ条件の相手を探しています…', cancel: 'やめる', refresh: '更新', retry: 'もう一度', more: 'もっと見る',
	invitations: '届いた招待', noInvitations: '招待は届いていません', accept: '受ける', decline: '断る', invitedBy: 'さんから',
	ongoing: '進行中の対局', noneOngoing: '進行中の対局はありません', publicGames: '観戦できる対局', nonePublic: 'いま観戦できる対局はありません',
	'open': '開く', watch: '観戦する', back: '一覧へ', deletedUser: '退会した人', waiting: '準備中', playing: '対局中', scoring: '整地中', ended: '終局',
	loading: '読み込み中…', updating: '反映を待っています…', reconnecting: 'つなぎ直しています…（時計は進んでいます）',
	settings: '条件を決める', syncNote: '条件は二人で共有しています。どちらかが変えると、準備OKはいったん外れます。', settingsChanged: '条件が変わりました。もう一度確かめてください。',
	handicap: '置石', even: '互先', stones: '子', komi: 'コミ', randomColor: '黒白ははじまるときに決まります。置石があるときは白から。',
	apply: 'この条件にする', ready: '準備OK', unready: '準備OKをやめる', checking: '確認中', opponentReady: '相手は準備OK', opponentChecking: '相手が確認しています',
	invitationPending: '返事を待っています…', invitationToYou: 'この招待を受けますか？', cancelGame: '待ち合わせをやめる', cancelGameConfirm: '待ち合わせをやめますか？',
	allowSpectate: '観戦を許可', publicAfterEnd: '終わったあと棋譜を公開', privacyNote: 'はじめは非公開。二人とも許可したものだけ公開されます。',
	allowSpectatorChat: '観戦チャットを許可', withdrawChat: '観戦チャットの許可をやめる',
	private: '非公開', public: '公開', effective: 'いまの公開範囲', chat: '観戦チャット', chatPending: 'このサーバーでは観戦チャットを使えません',
	announce: 'はじまったらノートで知らせる', allowName: '相手のノートに自分の名前が出てもいい', announceNote: 'このサーバーの中だけに投稿します。', announceCopies: '投稿したあとで取り消しても、すでに届いたぶんは消せません。', announcementVisibility: 'ノートの公開範囲', home: 'ホーム', followers: 'フォロワー', announcePublic: 'パブリック', withdrawName: '名前を出すのをやめる',
	yourTurn: 'あなたの番', opponentTurn: '相手の番', spectating: '観戦中', spectatorCount: '観戦', spectatorUnknown: '観戦 …',
	black: '黒', white: '白', pass: 'パス', resign: '投了', confirmResign: '投了する', resignConfirm: '投了しますか？',
	clockNote: '', periods: '回', claimTimeout: '時間切れを知らせる',
	scoringTitle: '二人で数える', scoringHelp: '死んでいる石を押すと、つながった石ごと印が付きます。どちらの地でもない空きは、押してダメの印を付けます。',
	approvalNote: '同じ印のまま二人とも「確認」すると決まります。', acceptScore: '確認', accepted: '確認済み', clearMarks: '印を全部外す', resume: '対局にもどる',
	territory: '地', dead: '死石', prisoners: 'アゲハマ', total: '合計', winner: '勝ち', draw: '引き分け', points: '目', resignReason: '投了', timeoutReason: '時間切れ', scoreReason: '数えて決着', noResult: '無勝負', canceledGame: 'この待ち合わせは終わりました', withdrawalEnded: '相手の退会で終了（勝敗なし）',
	repetition: '同じ形がくり返されています。二人がよければ無勝負にできます。', acceptNoResult: '無勝負にする', noResultAccepted: '無勝負に同意しました',
	reactions: 'リアクション', reactionSent: '送りました', readOnly: '観戦中は盤にさわれません',
	stopAnnouncement: 'ノートの投稿をやめる', announcementStatus: { none: '', pending: 'ノートを投稿しています…', sent: 'ノートを投稿しました', cancelled: 'ノートの投稿をやめました' },
	errors: {
		UNAVAILABLE: 'この対局は見られません',
		STALE_REVISION: '盤が更新されました。もう一度どうぞ',
		INVALID_STATE: 'いまはできない操作です', INVALID_SETTINGS: '条件を確かめてください', INVALID_ACTION: 'そこには打てません',
		RATE_LIMIT: '少し待ってからどうぞ', MATCH_BUSY: 'もう待ち合わせ中です', BLOCKED: 'この人とは対局できません', NOT_FOLLOWING: 'フォロー中の人を選んでください', NOT_LOCAL: 'このサーバーの人を選んでください', LIMIT: '同時に打てる対局の数がいっぱいです',
		NETWORK: 'つながりませんでした。盤はそのままです', INVALID_RESPONSE: '対局の情報を読めませんでした',
		occupied: 'そこにはもう石があります', suicide: 'そこは打てない場所です', ko: 'コウなので、すぐには取り返せません', outOfBoard: '盤の中を押してください', notYourTurn: '相手の番です',
	},
} as const;

export function onlineErrorText(code: string | null): string | null {
	if (code === null) return null;
	return code in onlineText.errors ? onlineText.errors[code as keyof typeof onlineText.errors] : onlineText.errors.NETWORK;
}
