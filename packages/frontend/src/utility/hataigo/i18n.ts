// SPDX-FileCopyrightText: Tolehata and hatasaba-project
// SPDX-License-Identifier: AGPL-3.0-only

export const hataigoText = {
	home: 'ホーム', game: '対局', records: '棋譜', collection: 'コレクション',
	play: '対局する', solo: 'ひとりで並べる', ai: 'AIと打つ', online: 'フリーマッチ', invite: '招待する',
	preparing: '準備中', settings: '盤と石の設定', labels: '座標を表示', autoplayInterval: '棋譜の自動再生',
	stoneStyle: '石', boardTheme: '盤', selected: '使用中', available: '使える', locked: 'まだ',
	ongoing: '進行中の対局', invitations: '招待', statistics: '成績',
	noGames: '進行中の対局はありません', noInvites: '招待はありません', wins: '勝ち', losses: '負け', solved: '解いた問題',
} as const;

export const themeLabels = {
	fuji: { name: '藤（ふじ）', condition: 'はじめから' },
	kaya: { name: '榧（かや）', condition: 'はじめて勝つ' },
	seiji: { name: '青磁（せいじ）', condition: '9路で10勝' },
	sakura: { name: '桜', condition: 'ちがう5人に勝つ' },
	sumi: { name: '墨', condition: '19路ではじめて勝つ' },
	yoru: { name: '夜', condition: '30局打ち終える' },
} as const;

export const stoneLabels = {
	real: { name: '本格', description: '蛤と黒石の質感' },
	flat: { name: 'フラット', description: 'くっきり平ら' },
	avatar: { name: 'アバター', description: 'アイコンで打つ' },
} as const;

export const recordText = {
	soloTitle: 'ひとりで並べる', replayTitle: '棋譜', nextTurn: '次は', changeSetup: '条件を変える', backToBoard: '盤にもどる', boardStep: '盤', fromRecordStep: '棋譜から始める', fromRecordDesc: '手元の SGF を開くと、その棋譜を並べ直せます', sgfMenu: 'SGF（開く・保存）',
	boardSize: '路数', handicap: '置石', even: '互先', stonesUnit: '子', linesUnit: '路', newBoard: 'この盤ではじめる',
	reset: '最初から', pass: 'パス', undo: '1手戻す', importSgf: 'SGFを開く', exportSgf: 'SGFで保存', includeComments: 'コメントも保存',
	first: '最初へ', previous: '1手戻る', play: '自動再生', pause: '止める', next: '1手進む', last: '最後へ', interval: '再生の速さ', seconds: '秒',
	moveUnit: '手', black: '黒', white: '白', turn: '次は', prisoners: 'アゲハマ', variations: '変化', variation: '変化', atMove: '手目から',
	setup: '配置', moves: '手順', replay: '再生', review: '検討', preparing: '検討はまだ使えません', comment: 'コメント',
	empty: 'まだ1手もありません。盤を押して並べるか、SGFを開いてください。', fileError: 'このSGFは開けませんでした', exportError: 'SGFを保存できませんでした',
	invalidRecord: '盤に並べられない手がふくまれています', unsupportedEncoding: 'UTF-8 のSGFだけ開けます',
	limitExceeded: 'SGFが大きすぎます', invalidSgf: 'SGFの形式が正しくありません',
	occupied: 'そこにはもう石があります', suicide: 'そこは打てない場所です', ko: 'コウなので、すぐには取り返せません', outOfBoard: '盤の中を押してください',
	game: '局', previousPage: '前へ', nextPage: '次へ', resetConfirm: '並べた手を消して、最初からにしますか？', cancel: 'やめる', confirmReset: '最初からにする',
} as const;

export const aiText = {
	title: 'AIと打つ', settings: '対局の条件', size: '路数', handicap: '置石', even: '互先', stonesUnit: '子', linesUnit: '路',
	ownColor: 'あなたは', black: '黒', white: '白', draw: '引き分け', level: 'AIの考える量', start: 'はじめる', newGame: '新しく打つ',
	strengthNote: '考える量が多いほど強く、待ち時間も長くなります。',
	boardStep: '盤', blackDesc: '先に打つ', whiteDesc: '後から打つ', quickDesc: 'すぐ打ち返す', balancedDesc: '少し待って打つ', patientDesc: 'じっくり読む',
	thinking: 'AIが考えています', analyzing: '形勢を見ています', cancel: 'やめる', retry: 'もう一度', resume: '続ける',
	paused: 'ひと休み中です。', yourTurn: 'あなたの番', aiTurn: 'AIの番',
	pass: 'パス', undo: '待った', hint: 'ヒント', estimate: '形勢判断', resign: '投了', resignTitle: '投了しますか？', confirmResign: '投了する',
	engineError: 'AIから返事がありません。盤はそのままです', invalidAiMove: 'AIの手を置けませんでした。盤はそのままです',
	estimateTitle: '形勢', estimateUnknown: 'まだわかりません', estimateHelp: '形勢は、ここまでの読みから見た目安です。グラフは、上が黒よし、下が白よしです。',
	points: '目', playouts: '回読んだ結果', candidates: 'AIの候補', winRate: '勝率（目安）', visits: '回', noCandidates: '候補はまだありません',
	graphLabel: '手ごとの形勢。上が黒よし、下が白よし', graphMove: '手目へ', showOwnership: '地の目安を盤に出す', hintPass: 'ここはパスがよさそうです',
	scoringTitle: '数える前に確かめる', scoringHelp: '死んでいる石を押すと、つながった石ごと印が付きます。どちらの地でもない空きは、押してダメの印を付けます。',
	scoringDraft: '色は目安です。印を確かめてから決めてください。',
	clearMarks: '印を全部外す', confirmScore: 'これで決める', territory: '地', dead: '死石', prisoners: 'アゲハマ', komi: 'コミ', total: '合計',
	finished: 'おつかれさまでした', winner: '勝ち', scoreReason: '数えて決着', resignReason: '投了',
	saved: '成績に記録しました', saving: '記録しています…', saveRetry: 'もう一度記録する',
	loadRecordsError: 'AI戦の成績を読み込めませんでした', partialRecordsError: '一部のAI戦の成績を読み込めませんでした',
	saveRecordsError: '成績を記録できませんでした', invalidRecord: 'AI戦の成績が読み取れませんでした',
	occupied: 'そこにはもう石があります', suicide: 'そこは打てない場所です', ko: 'コウなので、すぐには取り返せません', outOfBoard: '盤の中を押してください', notYourTurn: 'AIの番です。少し待ってね',
	thoughtTitle: 'AIの読み', thoughtLive: 'いま有力な手', thoughtPlayed: 'に打ちました', thoughtPassed: 'パスしました', triesUnit: '回 試し打ち', candidate: '候補', thoughtHelp: '下の線の長さは、その手を読んだ回数の割合です。AIは、いちばん多く読んだ手を選びます。勝率は、試し打ちの結果から見た目安です。', thoughtEmpty: 'AIが打つと、比べた手がここに出ます', tries: '試し打ち', aiWinRate: 'AIの勝率', share: '読んだ割合', lead: '形勢',
	newGameConfirm: '今の対局をやめて、新しく打ちますか？', resetConfirm: '新しく打つ', review: '検討する', hintNote: '数字は候補の順番です', seconds: '秒',
} as const;
