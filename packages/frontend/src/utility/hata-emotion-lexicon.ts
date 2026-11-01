/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork(HATAlyze): 感情分析の用語集。
 *
 * ⚠️ここに置くのは「こちらが用意した固定語彙」だけ。利用者の本文から取り出した語を
 *   ここへ書き戻してはいけない。証跡として保存されるラベルはこの表の語に限る、という
 *   前提でプライバシー設計(本文を保存しない)が成り立っている。
 * ⚠️語を足すときは EXCLUDED_CONTEXTS も一緒に見ること。短い語ほど複合語で誤検出する。
 *   例: 「嫌」は「機嫌」、「死」は「必死」、「辛い」は「辛口」。
 * ⚠️この表を変えたら hata-emotion-analysis.ts の LEXICON_VERSION を上げる。
 *   上げないと、違う辞書で出した数値どうしを比較してしまう。
 */

/** 感情の軸。⚠️レーダー表示の頂点数に直結するので、増やすときは画面側も見ること。 */
export const HATA_EMOTION_AXES = ['joy', 'fun', 'affection', 'gratitude', 'anger', 'sadness', 'anxiety', 'fatigue'] as const;
export type HataEmotionAxis = typeof HATA_EMOTION_AXES[number];

/** 軸から極性を決める。⚠️語ごとに極性を持たせない(表が二重管理になるため)。 */
export const HATA_EMOTION_AXIS_POLARITY: Readonly<Record<HataEmotionAxis, 'positive' | 'negative'>> = {
	joy: 'positive',
	fun: 'positive',
	affection: 'positive',
	gratitude: 'positive',
	anger: 'negative',
	sadness: 'negative',
	anxiety: 'negative',
	fatigue: 'negative',
};

export type LexiconEntry = readonly [HataEmotionAxis, number];

/**
 * 感情語の表。重みは 1〜4。
 * 4 = そのひとことで投稿全体の色が決まる / 3 = 強い / 2 = 標準 / 1〜1.5 = 弱い・付随的。
 * ⚠️同じ語が複数の軸に属する場合は、SNSでの最頻の用法を1つだけ選ぶ。
 */
export const HATA_EMOTION_LEXICON: Readonly<Record<string, LexiconEntry>> = {
	// ---- joy 喜び ----
	'控えめに言って最高': ['joy', 4], '最高': ['joy', 3], '大優勝': ['joy', 3], '優勝': ['joy', 2.5],
	'幸せ': ['joy', 3], '至福': ['joy', 3], '感動': ['joy', 3], '嬉しい': ['joy', 2.5], 'うれしい': ['joy', 2.5],
	'やったー': ['joy', 2.5], 'やった': ['joy', 2], 'きたー': ['joy', 2.5], '歓喜': ['joy', 3],
	'最強': ['joy', 2.5], '神': ['joy', 2.5], '天才': ['joy', 2.5], '完璧': ['joy', 2.5], '絶品': ['joy', 2.5],
	'素晴らしい': ['joy', 2.5], 'すばらしい': ['joy', 2.5], '素敵': ['joy', 2], 'すてき': ['joy', 2],
	'おめでとう': ['joy', 2], 'めでたい': ['joy', 2], '祝': ['joy', 1.5], '達成': ['joy', 2],
	'成功': ['joy', 2], 'できた': ['joy', 1.5], '解決': ['joy', 2], '直った': ['joy', 2], '通った': ['joy', 1.5],
	'合格': ['joy', 3], '受かった': ['joy', 3], '当選': ['joy', 2.5], '届いた': ['joy', 1.5],
	'すごい': ['joy', 1.5], '凄い': ['joy', 1.5], 'すご': ['joy', 1.2], 'えらい': ['joy', 1.5],
	'😊': ['joy', 1.5], '😄': ['joy', 1.5], '😆': ['joy', 1.5], '🎉': ['joy', 2], '✨': ['joy', 1.5],
	'💯': ['joy', 2], '🙌': ['joy', 1.5], '👏': ['joy', 1.5], '🥳': ['joy', 2],

	// ---- fun 楽しさ ----
	'楽しい': ['fun', 2.5], 'たのしい': ['fun', 2.5], '楽しかった': ['fun', 2.5], '楽しみ': ['fun', 2],
	'面白い': ['fun', 2], 'おもしろい': ['fun', 2], 'おもろい': ['fun', 2], '爆笑': ['fun', 2.5],
	'わくわく': ['fun', 2], 'ワクワク': ['fun', 2], 'たのしみ': ['fun', 2], '期待': ['fun', 1.5],
	'夢中': ['fun', 2], 'ハマった': ['fun', 2], 'はまった': ['fun', 2], '沼': ['fun', 1.5],
	'笑った': ['fun', 2], 'ウケる': ['fun', 1.8], 'うける': ['fun', 1.8], 'てぇてぇ': ['fun', 2],
	'最of高': ['fun', 2.5], 'ノリノリ': ['fun', 1.8], '祭り': ['fun', 1.5],
	'😂': ['fun', 2], '🤣': ['fun', 2], '😹': ['fun', 1.8], '🎮': ['fun', 1.2],

	// ---- affection 親愛 ----
	'愛してる': ['affection', 3], '大好き': ['affection', 3], '好きすぎる': ['affection', 3],
	'尊い': ['affection', 3], 'とうとい': ['affection', 2.5], '推し': ['affection', 2],
	'好き': ['affection', 2], 'かわいい': ['affection', 2], '可愛い': ['affection', 2], 'かわよ': ['affection', 2],
	'美しい': ['affection', 2], 'きれい': ['affection', 1.8], '綺麗': ['affection', 1.8],
	'癒される': ['affection', 2], '癒し': ['affection', 2], 'ほっこり': ['affection', 2],
	'安心': ['affection', 1.8], '落ち着く': ['affection', 1.8], '心地よい': ['affection', 2],
	'仲良し': ['affection', 1.8], '大切': ['affection', 1.8], '会いたい': ['affection', 1.5],
	'🥰': ['affection', 2], '❤️': ['affection', 2], '💖': ['affection', 2], '😍': ['affection', 2],
	'🩷': ['affection', 2], '💕': ['affection', 2], '🐾': ['affection', 1.2],

	// ---- gratitude 感謝 ----
	'ありがとう': ['gratitude', 2], 'ありがと': ['gratitude', 1.8], 'ありがたい': ['gratitude', 2],
	'感謝': ['gratitude', 2], '助かった': ['gratitude', 2], '助かる': ['gratitude', 2],
	'おかげ': ['gratitude', 1.8], 'お世話になり': ['gratitude', 1.5], '恩': ['gratitude', 1.5],
	'サンキュー': ['gratitude', 1.8], 'thanks': ['gratitude', 1.8], 'thank you': ['gratitude', 2],
	'感激': ['gratitude', 2.5], '光栄': ['gratitude', 2], '嬉しすぎ': ['gratitude', 2.5],
	'🙏': ['gratitude', 1.8], '🫶': ['gratitude', 1.8],

	// ---- anger 怒り ----
	'ブチギレ': ['anger', 3], 'ぶちぎれ': ['anger', 3], 'ブチ切れ': ['anger', 3], 'キレた': ['anger', 2.5],
	'激怒': ['anger', 3], '腹立つ': ['anger', 2.5], '腹立たしい': ['anger', 2.5], 'ムカつく': ['anger', 2.5],
	'むかつく': ['anger', 2.5], 'イライラ': ['anger', 2], 'いらいら': ['anger', 2], 'イラつく': ['anger', 2],
	'許せない': ['anger', 2.5], 'ふざけるな': ['anger', 2.5], 'いい加減にしろ': ['anger', 2.5],
	'最悪': ['anger', 2.5], '理不尽': ['anger', 2], '不快': ['anger', 2], '納得いかない': ['anger', 2],
	'クソ': ['anger', 2], 'くそ': ['anger', 2], '💢': ['anger', 2], '😡': ['anger', 2], '🤬': ['anger', 2.5],

	// ---- sadness 悲しみ ----
	'消えたい': ['sadness', 4], 'もう限界': ['sadness', 3.5], '絶望': ['sadness', 3], '限界': ['sadness', 2.5],
	'悲しい': ['sadness', 2.5], 'かなしい': ['sadness', 2.5], '哀しい': ['sadness', 2.5],
	'つらい': ['sadness', 2.5], '辛い': ['sadness', 2.5], 'しんどい': ['sadness', 2.5],
	'苦しい': ['sadness', 2.5], 'くるしい': ['sadness', 2.5], '寂しい': ['sadness', 2], 'さみしい': ['sadness', 2],
	'さびしい': ['sadness', 2], '孤独': ['sadness', 2.5], '虚しい': ['sadness', 2.5], 'むなしい': ['sadness', 2.5],
	'落ち込む': ['sadness', 2.5], '凹んだ': ['sadness', 2], 'へこんだ': ['sadness', 2],
	'泣': ['sadness', 1.5], '涙': ['sadness', 1.8], '号泣': ['sadness', 2.5],
	'鬱': ['sadness', 3], '病む': ['sadness', 2.5], '病み': ['sadness', 2.5], '死にたい': ['sadness', 4],
	'詰んだ': ['sadness', 2], '終わった': ['sadness', 1.5], '無理': ['sadness', 2], 'ムリ': ['sadness', 2],
	'むり': ['sadness', 2], '嫌': ['sadness', 1.5], '死': ['sadness', 2], '失敗': ['sadness', 1.8],
	'後悔': ['sadness', 2], 'ごめん': ['sadness', 1.2], '申し訳': ['sadness', 1.2],
	'💔': ['sadness', 2], '😭': ['sadness', 2], '😢': ['sadness', 1.5], '😞': ['sadness', 1.8], '💀': ['sadness', 1.5],

	// ---- anxiety 不安 ----
	'不安': ['anxiety', 2.5], '心配': ['anxiety', 1.8], '怖い': ['anxiety', 2], 'こわい': ['anxiety', 2],
	'恐怖': ['anxiety', 2.5], '緊張': ['anxiety', 1.8], 'ドキドキ': ['anxiety', 1.2],
	'焦る': ['anxiety', 2], 'あせる': ['anxiety', 2], '焦り': ['anxiety', 2], 'やばい': ['anxiety', 1.2],
	'どうしよう': ['anxiety', 2], '大丈夫かな': ['anxiety', 1.8], '不安定': ['anxiety', 2],
	'胃が痛い': ['anxiety', 2], 'そわそわ': ['anxiety', 1.5], '怯え': ['anxiety', 2.5],
	'😰': ['anxiety', 2], '😨': ['anxiety', 2], '😱': ['anxiety', 2], '🥺': ['anxiety', 1.2],

	// ---- fatigue 疲れ ----
	'疲れた': ['fatigue', 2], 'つかれた': ['fatigue', 2], '疲労': ['fatigue', 2], '疲れ': ['fatigue', 1.8],
	'へとへと': ['fatigue', 2.5], 'クタクタ': ['fatigue', 2.5], 'くたくた': ['fatigue', 2.5],
	'眠い': ['fatigue', 1.5], 'ねむい': ['fatigue', 1.5], '寝不足': ['fatigue', 2], '睡眠不足': ['fatigue', 2],
	'体調不良': ['fatigue', 2.5], '体調悪い': ['fatigue', 2.5], '風邪': ['fatigue', 1.8], '頭痛': ['fatigue', 2],
	'だるい': ['fatigue', 2], 'ダルい': ['fatigue', 2], 'しんど': ['fatigue', 2],
	'ストレス': ['fatigue', 2], '燃え尽き': ['fatigue', 2.5], '休みたい': ['fatigue', 2],
	'😪': ['fatigue', 1.5], '😵': ['fatigue', 2], '🥱': ['fatigue', 1.5],

	// ---- joy 喜び(追補) ----
	'めでたし': ['joy', 2], '大成功': ['joy', 3], '快挙': ['joy', 3], '圧勝': ['joy', 2.5],
	'完勝': ['joy', 2.5], '会心': ['joy', 2.5], '大満足': ['joy', 2.5], '満足': ['joy', 2],
	'満点': ['joy', 2.5], '有頂天': ['joy', 3], '上出来': ['joy', 2], '順調': ['joy', 1.5],
	'はかどる': ['joy', 1.8], '捗る': ['joy', 1.8], '報われた': ['joy', 2.5], '実った': ['joy', 2.2],
	'叶った': ['joy', 2.5], '念願': ['joy', 2.2], '悲願': ['joy', 2.2], '一安心': ['joy', 1.8],
	'ほっとした': ['joy', 1.8], 'ホッとした': ['joy', 1.8], '記録更新': ['joy', 2.5], '自己ベスト': ['joy', 2.5],
	'過去最高': ['joy', 2.5], '感無量': ['joy', 3], '胸熱': ['joy', 2.2], 'エモい': ['joy', 1.8],
	'感涙': ['joy', 2.5], '大勝利': ['joy', 3], '見事': ['joy', 2], '立派': ['joy', 1.8],
	'誇らしい': ['joy', 2.5], '自慢': ['joy', 1.5], 'ナイス': ['joy', 1.5], 'ばっちり': ['joy', 1.8],
	'バッチリ': ['joy', 1.8], '大当たり': ['joy', 2.5], '良かった': ['joy', 1.5], 'よかった': ['joy', 1.5],
	'嬉しい限り': ['joy', 2.8], '嬉し涙': ['joy', 2.8], 'やり遂げ': ['joy', 2.2], '完走': ['joy', 2],

	// ---- fun 楽しさ(追補) ----
	'楽しめた': ['fun', 2.2], '面白かった': ['fun', 2], 'おもしろかった': ['fun', 2], '笑える': ['fun', 1.8],
	'大笑い': ['fun', 2.2], 'にやにや': ['fun', 1.5], 'ニヤニヤ': ['fun', 1.5], 'ほのぼの': ['fun', 1.8],
	'気持ちいい': ['fun', 1.8], '気持ちよ': ['fun', 1.8], '快適': ['fun', 1.8], '爽快': ['fun', 2],
	'スカッと': ['fun', 2], 'テンション上が': ['fun', 2], '盛り上が': ['fun', 1.8], '待ち遠しい': ['fun', 2],
	'楽しそう': ['fun', 1.5], 'ゲラゲラ': ['fun', 2], '腹筋崩壊': ['fun', 2.2], 'ツボ': ['fun', 1.5],
	'神回': ['fun', 2.2], '神ゲー': ['fun', 2.2], '沼った': ['fun', 1.8], '中毒性': ['fun', 1.5],
	'やみつき': ['fun', 1.8], '病みつき': ['fun', 1.8], '満喫': ['fun', 2], 'エンジョイ': ['fun', 1.8],
	'はしゃ': ['fun', 1.8], 'わろた': ['fun', 1.8], 'ワロタ': ['fun', 1.8], 'wwww': ['fun', 1.5],
	'笑いが止まら': ['fun', 2.2],

	// ---- affection 親愛(追補) ----
	'愛おしい': ['affection', 3], 'いとおしい': ['affection', 3], '可愛すぎ': ['affection', 2.5], 'かわいすぎ': ['affection', 2.5],
	'尊すぎ': ['affection', 3], '推せる': ['affection', 2.2], '神推し': ['affection', 2.2], '尊み': ['affection', 2.2],
	'大好物': ['affection', 2], '一目惚れ': ['affection', 2.2], 'ときめ': ['affection', 2], 'キュン': ['affection', 2],
	'きゅん': ['affection', 2], '愛でる': ['affection', 2], 'もふもふ': ['affection', 1.8], 'ぬくもり': ['affection', 1.8],
	'優しい': ['affection', 1.8], 'やさしい': ['affection', 1.8], '親切': ['affection', 1.8], '思いやり': ['affection', 2],
	'恋しい': ['affection', 1.8], '愛着': ['affection', 1.8], 'お気に入り': ['affection', 1.5], '相棒': ['affection', 1.5],
	'信頼': ['affection', 1.5], '頼れる': ['affection', 1.8], '安らぐ': ['affection', 2], '和む': ['affection', 1.8],
	'なごむ': ['affection', 1.8], '癒やし': ['affection', 2], '癒やされ': ['affection', 2], '尊敬': ['affection', 1.8],

	// ---- gratitude 感謝(追補) ----
	'感謝しかない': ['gratitude', 2.8], 'ありがとうございます': ['gratitude', 2], 'ありがとうございました': ['gratitude', 2], 'ありがとね': ['gratitude', 1.8],
	'ありがたや': ['gratitude', 2], '多謝': ['gratitude', 2], '御礼': ['gratitude', 1.8], 'お礼': ['gratitude', 1.5],
	'恐縮': ['gratitude', 1.5], '頭が下がる': ['gratitude', 2], '支えられ': ['gratitude', 2], '救われた': ['gratitude', 2.5],
	'感謝感激': ['gratitude', 2.8], 'おかげさま': ['gratitude', 1.8], 'お世話になっ': ['gratitude', 1.5], '恩返し': ['gratitude', 2],
	'恩人': ['gratitude', 2.2], 'ありがたい限り': ['gratitude', 2.5], 'thx': ['gratitude', 1.8], '深謝': ['gratitude', 2],
	'幸甚': ['gratitude', 1.8], '助けてくれ': ['gratitude', 2], '支えてくれ': ['gratitude', 2], '教えてくれ': ['gratitude', 1.8],
	'感謝の気持ち': ['gratitude', 2.2],

	// ---- anger 怒り(追補) ----
	'ムカムカ': ['anger', 2.2], 'むかむか': ['anger', 2.2], '腹が立つ': ['anger', 2.5], '頭にきた': ['anger', 2.5],
	'頭に来た': ['anger', 2.5], '怒り': ['anger', 2.2], '憤り': ['anger', 2.5], '憤慨': ['anger', 2.5],
	'立腹': ['anger', 2.2], '苛立ち': ['anger', 2], 'いらだち': ['anger', 2], '苛々': ['anger', 2],
	'不満': ['anger', 1.8], '不服': ['anger', 1.8], '心外': ['anger', 1.8], '遺憾': ['anger', 1.8],
	'呆れ': ['anger', 1.8], 'あきれ': ['anger', 1.8], 'ふざけんな': ['anger', 2.5], 'ざけんな': ['anger', 2.5],
	'いい加減にして': ['anger', 2.2], '迷惑': ['anger', 1.8], 'うざい': ['anger', 2], 'ウザい': ['anger', 2],
	'うっとうしい': ['anger', 2], 'しつこい': ['anger', 1.8], '最低': ['anger', 2], '許しがたい': ['anger', 2.5],
	'我慢の限界': ['anger', 2.8], 'キレそう': ['anger', 2.2], '暴言': ['anger', 2], '罵倒': ['anger', 2.2],
	'炎上': ['anger', 1.5], 'ろくでもない': ['anger', 2],

	// ---- sadness 悲しみ(追補) ----
	'辛すぎ': ['sadness', 2.8], 'しんどすぎ': ['sadness', 2.8], '泣きたい': ['sadness', 2.5], '涙が止まら': ['sadness', 2.8],
	'涙腺': ['sadness', 1.5], '切ない': ['sadness', 2.2], 'せつない': ['sadness', 2.2], 'やるせない': ['sadness', 2.2],
	'情けない': ['sadness', 2], '惨め': ['sadness', 2.5], 'みじめ': ['sadness', 2.5], '打ちひしが': ['sadness', 3],
	'傷ついた': ['sadness', 2.5], '心が折れ': ['sadness', 2.8], '折れそう': ['sadness', 2.2], 'ショック': ['sadness', 2],
	'ガッカリ': ['sadness', 1.8], 'がっかり': ['sadness', 1.8], '落胆': ['sadness', 2], '残念': ['sadness', 1.5],
	'無念': ['sadness', 2], '悔しい': ['sadness', 2], 'くやしい': ['sadness', 2], '自己嫌悪': ['sadness', 2.5],
	'自責': ['sadness', 2.2], '死にそう': ['sadness', 2.2], 'もうやだ': ['sadness', 2.5], 'もう嫌': ['sadness', 2.5],
	'何もしたくない': ['sadness', 2.8], '憂鬱': ['sadness', 2.5], 'ゆううつ': ['sadness', 2.5], 'どん底': ['sadness', 3],
	'絶望的': ['sadness', 2.8], '報われない': ['sadness', 2.5], 'ひとりぼっち': ['sadness', 2.5], '見捨てられ': ['sadness', 2.5],
	'喪失': ['sadness', 2.2],

	// ---- anxiety 不安(追補) ----
	'不安すぎ': ['anxiety', 2.8], '怖すぎ': ['anxiety', 2.5], 'こわすぎ': ['anxiety', 2.5], '恐ろしい': ['anxiety', 2.5],
	'おびえ': ['anxiety', 2.5], '落ち着かない': ['anxiety', 2], '気が気でない': ['anxiety', 2.2], 'ハラハラ': ['anxiety', 1.8],
	'ひやひや': ['anxiety', 1.8], 'ヒヤヒヤ': ['anxiety', 1.8], '動悸': ['anxiety', 2.2], '息苦し': ['anxiety', 2.2],
	'パニック': ['anxiety', 2.5], '緊張する': ['anxiety', 1.8], '心細い': ['anxiety', 2.2], '自信がない': ['anxiety', 2.2],
	'自信ない': ['anxiety', 2.2], '不安になる': ['anxiety', 2.2], '心配で': ['anxiety', 1.8], '気がかり': ['anxiety', 1.8],
	'気掛かり': ['anxiety', 1.8], '憂慮': ['anxiety', 2], '危機感': ['anxiety', 1.8], 'ビクビク': ['anxiety', 2],
	'びくびく': ['anxiety', 2], '眠れない': ['anxiety', 1.8], '寝付けない': ['anxiety', 1.8], '悪夢': ['anxiety', 2.2],
	'嫌な予感': ['anxiety', 2],

	// ---- fatigue 疲れ(追補) ----
	'疲れきった': ['fatigue', 2.5], '疲れ果て': ['fatigue', 2.8], 'ぐったり': ['fatigue', 2.5], 'ヘトヘト': ['fatigue', 2.5],
	'倦怠': ['fatigue', 2.2], 'だるさ': ['fatigue', 2], '気だるい': ['fatigue', 2], '体が重い': ['fatigue', 2],
	'頭が回らない': ['fatigue', 2.2], '集中できない': ['fatigue', 2], '寝落ち': ['fatigue', 1.5], '寝たい': ['fatigue', 1.8],
	'寝込': ['fatigue', 2.2], '発熱': ['fatigue', 2.2], '高熱': ['fatigue', 2.5], '咳': ['fatigue', 1.5],
	'喉が痛': ['fatigue', 2], '腹痛': ['fatigue', 2], '腰痛': ['fatigue', 2], '肩こり': ['fatigue', 1.8],
	'眼精疲労': ['fatigue', 2], '不調': ['fatigue', 2], '絶不調': ['fatigue', 2.8], '具合が悪': ['fatigue', 2.5],
	'気分が悪': ['fatigue', 2.2], '吐き気': ['fatigue', 2.2], 'めまい': ['fatigue', 2.2], '通院': ['fatigue', 1.5],
	'療養': ['fatigue', 2], '休養': ['fatigue', 1.8], '過労': ['fatigue', 2.5], '徹夜': ['fatigue', 2],
	'オーバーワーク': ['fatigue', 2.2],
};

/** 絵文字ショートコード。名前に含まれていれば拾う(部分一致)。 */
export const POSITIVE_SHORTCODES: readonly string[] = [
	'uresshi', 'ureshii', 'yatta', 'kawaii', 'kawaee', 'sugoi', 'suki', 'daisuki', 'tanoshi', 'iine',
	'yorokobi', 'omedetou', 'arigatou', 'arigato', 'kansha', 'happy', 'love', 'good', 'nice', 'great',
	'cool', 'cute', 'heart', 'yay', 'joy', 'laugh', 'smile', 'ganbare', 'kita', 'tensai', 'saikou',
	'gj', 'gg', 'wakuwaku', 'wktk', 'flower', 'star', 'sparkle', 'clap', 'victory', 'thumbsup',
	'praise', 'congrats', 'welcome', 'peace', 'blob_hearts', 'blobcat_love', 'yoshi', 'tanoshii',
	'ohayo', 'otsukare_positive', 'sasuga', 'kami', 'perfect', 'win', 'party', 'cheer', 'hug',
	'blobcat_happy', 'blobcat_thumbsup', 'ureshi', 'natsukashi', 'sugee', 'yatte', 'igyo', 'meibun',
	'kanpai', 'otanjoubi', 'birthday', 'gift', 'shiawase', 'anshin', 'iyasare', 'mofu', 'kawa',
	'tanoshisou', 'wai', 'excited', 'proud', 'relief', 'best', 'fav', 'like', 'yes',
];
// :gg: は否定語リストにも見えるが Good Game の用法として肯定側だけに固定する。
export const NEGATIVE_SHORTCODES: readonly string[] = [
	'kanashii', 'tsurai', 'shindoi', 'tsukareta', 'iya', 'dame', 'muri', 'shinitai', 'fuan', 'shinpai',
	'kowai', 'stress', 'iraira', 'ikari', 'gakkari', 'zannen', 'itai', 'byouki', 'pien', 'sad',
	'tired', 'angry', 'hate', 'cry', 'pain', 'sick', 'fail', 'bad', 'awful', 'terrible', 'lonely',
	'anxious', 'depressed', 'frustrated', 'broken', 'dead', 'rip', 'gomen', 'sumimasen',
	'nemui', 'darui', 'hetohero', 'kuyashii', 'sabishii', 'namida', 'ochikomi', 'yandere_sad',
	'komaru', 'komatta', 'shonbori', 'gakkuri', 'hekomu', 'utsu', 'genkai', 'mendoi', 'mendokusai',
	'kowa', 'osoroshii', 'fuannna', 'nayami', 'shikushiku', 'gomennasai', 'shippai', 'zetsubou',
	'worried', 'upset', 'exhausted', 'burnout', 'sorry', 'ill', 'hurt', 'alone',
];

/** 感情語の強さを増す語。⚠️1投稿あたり3語までしか効かせない(青天井にしない)。 */
export const INTENSIFIERS: readonly string[] = [
	'めっちゃ', 'めちゃ', 'めちゃくちゃ', '超', 'ちょう', 'ガチ', 'がち', 'マジ', 'まじ',
	'本当に', 'ほんと', 'ほんとに', 'すごく', 'すっごく', 'とても', 'かなり', '相当', '激', '鬼',
	'死ぬほど', '限界まで', '最of', 'クソ', 'バカ', '無限に', 'めっさ',
];

/** 感情語の強さを弱める語。⚠️強調と同時に出たときは弱める側を後に掛ける。 */
export const DIMINISHERS: readonly string[] = [
	'ちょっと', '少し', 'すこし', 'やや', '若干', '多少', 'そこそこ', 'まあまあ', 'ほんの', '気持ち',
];

/** 話題の分類。⚠️小文字化して部分一致で見るので、英字は小文字で書く。 */
export const TOPICS: Readonly<Record<string, readonly string[]>> = {
	'技術・開発': ['コード', 'プログラム', '開発', 'バグ', 'エラー', 'サーバー', 'docker', 'api', 'git', 'typescript', 'javascript', 'vue', 'react', 'css', 'html', 'python', 'rust', 'sql', 'linux', 'debug', 'deploy', 'commit', 'build', 'node', 'リファクタ', '実装', 'テスト通', 'マージ', 'プルリク', 'ビルド', 'デプロイ', 'ライブラリ', 'フレームワーク', '設計', 'アルゴリズム', 'データベース', 'クラウド', 'インフラ', 'ci', 'cd', 'ai', 'llm', '型', 'コンパイル', 'ランタイム', '例外', 'ログ', '監視', 'キャッシュ', 'セキュリティ', '認証', 'oss'],
	'ゲーム': ['ゲーム', 'minecraft', 'マイクラ', 'テトリス', 'スプラ', 'splatoon', 'ポケモン', 'switch', 'ps5', 'steam', 'rpg', 'game', 'gaming', 'ガチャ', 'レイド', 'ランクマ', '実況', '原神', 'apex', 'fps', '対戦', 'クリア', '周回', 'ソシャゲ', 'インディー', 'マルチ', 'ソロ', '協力プレイ', 'アップデート', 'イベント走', 'スコアタ', '実績'],
	'Hataskey・SNS': ['misskey', 'mastodon', 'fediverse', 'activitypub', '連合', 'タイムライン', 'tl', 'フォロー', 'フォロワー', 'リアクション', 'ノート', 'cherrypick', 'hataskey', '旗鯖', 'リノート', '鯖', 'インスタンス', 'カスタム絵文字', 'ふぁぼ', 'sns', 'twitter', 'bluesky', 'アンテナ', 'チャンネル', 'ドライブ', 'モデレート', 'ブロック', 'ミュート', '通報', 'デッキ'],
	'日常・生活': ['ごはん', 'ご飯', '食べ', '飲み', '寝', '起き', '朝', '昼', '夜', '天気', '雨', '暑い', '寒い', '散歩', '買い物', '料理', '電車', '掃除', '洗濯', 'コンビニ', 'スーパー', 'カフェ', 'コーヒー', '風呂', '通勤', '通学', '休日', '弁当', 'おやつ', '自炊', '外食', '洗い物', 'ゴミ出し', '布団', '目覚まし', '二度寝'],
	'音楽・動画': ['音楽', '曲', '歌', 'ライブ', 'youtube', '動画', '配信', 'mv', 'アルバム', 'spotify', 'ボカロ', '作曲', 'ギター', 'ピアノ', 'アニメ', '映画', 'ドラマ', '声優', 'サブスク', 'プレイリスト', 'バンド', 'ドラム', 'ベース', '作詞', '歌詞', 'カラオケ', 'ラジオ', 'ポッドキャスト', '劇場', '舞台'],
	'学業・仕事': ['勉強', '試験', 'テスト', 'レポート', '論文', '授業', 'ゼミ', '大学', '単位', '法律', '民法', '仕事', '出社', '会議', '残業', '案件', '納期', '上司', '就活', '転職', 'バイト', '資格', '面接', '履歴書', 'research', 'ゼミ発表', '課題', '締切', 'シフト', '有給', '在宅', 'リモート'],
	'端末・機器': ['スマホ', 'iphone', 'android', 'oppo', 'xiaomi', 'pixel', 'galaxy', 'watch', 'pc', 'mac', 'sim', 'esim', 'キーボード', 'イヤホン', 'モニター', 'タブレット', '充電', 'バッテリー', '自作pc', 'ガジェット', 'マウス', 'ケーブル', 'ストレージ', 'ssd', 'メモリ', 'cpu', 'gpu', 'ルーター', 'wifi', '回線'],
	'創作・デザイン': ['絵', 'イラスト', '描', 'デザイン', '創作', 'キャラ', '漫画', 'vrchat', 'vrm', '3d', 'unity', 'blender', '小説', '執筆', 'フォント', '配色', 'ロゴ', '同人', '一次創作', '二次創作', '模写', 'ラフ', '線画', '塗り', 'レイヤー', 'クリスタ', 'photoshop', 'figma', '装丁', '入稿'],
	'心身の調子': ['メンタル', '体調', '調子', '疲', 'ストレス', '不安', '睡眠', '眠', '頭痛', '病院', '回復', '通院', '薬', 'カウンセリング', '休養', '静養', '花粉', '生活リズム', '運動', 'ストレッチ', '瞑想', '気分転換', '休息', '診断'],
	'お金・買い物': ['値段', '価格', '円', '安い', '高い', 'セール', '購入', '買った', '課金', '節約', '家計', '給料', '支払', 'ふるさと納税', 'ポイント', 'クーポン', '送料', '予約', '定期', 'サブスク料金', '請求', '税', '還元', '中古'],
	'旅行・外出': ['旅行', '旅', '観光', '温泉', 'ホテル', '飛行機', '新幹線', 'ドライブ', 'キャンプ', '登山', '海', '祭り', 'イベント', '遠征', '帰省', '聖地巡礼', '空港', '駅', '宿', '土産', '絶景', '散策', '水族館', '動物園'],
};

/**
 * 誤検出の除外。指定した語が近く(前後4文字)にあれば、その一致を数えない。
 * ⚠️短い語を辞書に足すときは、必ずここも足すか検討すること。
 */
export const EXCLUDED_CONTEXTS: Readonly<Record<string, readonly string[]>> = {
	'死': ['必死', '死角', '死守', '決死', '致死', '死語', '死蔵', '瀕死', '不死', '死屍', '死因', '死亡事故', '死球', '死線', '死闘', '生死', '死ぬほど'],
	'嫌': ['機嫌', '嫌気', '嫌疑', '嫌悪感は', 'ご機嫌'],
	'泣': ['泣き所', '泣き寝入り', '号泣じゃない'],
	'辛い': ['辛口', '辛味', '辛子', '香辛料'],
	'痛い': ['痛快', '頭痛薬', '鎮痛'],
	'好き': ['好奇心', '好機', '好都合', '好条件', '好影響'],
	'いい': ['言いた', '言い方', '言い分', '言い訳', '言い換', 'という', 'ている', 'ていた', 'ない', 'がいい加減'],
	'良い': ['良い加減にしろ'],
	'w': ['www.', 'http', 'who', 'what', 'where', 'when', 'which', 'with', 'was', 'were', 'will', 'would', 'we', 'www'],
	'草': ['草原', '草花', '雑草', '草木', '草案', '薬草', '草稿'],
	'笑': ['笑止', '笑納', '苦笑', '失笑', '爆笑もの', '笑い事じゃ'],
	'終わった': ['が終わった', 'を終わった', '終わったら', '終わったので', '終わったから'],
	'神': ['神社', '神奈川', '神戸', '神経', '精神', '神話', '神主', '神父'],
	'限界': ['限界集落', '限界突破'],
	'祭り': ['祭りだった'],
	'涙': ['涙腺崩壊じゃ'],
	'無理': ['無理なく', '無理せず', '無理のない'],
	'クソ': ['クソゲーが好き'],
	'やばい': ['やばいくらい良'],
	// ---- 追補分の誤検出対策 ----
	'ツボ': ['ツボ押', 'ツボマッサ', 'ツボを押'],
	'炎上': ['炎上商法', '炎上マーケ'],
	'自慢': ['自慢じゃない', '自慢話を聞か'],
	'良かった': ['良かったのに'],
	'よかった': ['よかったのに'],
	'満足': ['満足に'],
	'信頼': ['信頼性', '信頼できな'],
	'見事': ['見事に失敗', '見事に外れ'],
	'wwww': ['http', 'www.'],
	'怒り': ['怒りっぽさ'],
	'不調': ['不調法'],
};

/** 否定表現。⚠️正規表現なので、語を足すときは既存の選択肢に足す形にする。 */
export const NEGATION_RULES = [
	{ label: '肯定語の否定', regex: /(?:楽し|嬉し|好き|良|いい|素敵|最高|幸せ|面白|かわい|きれい|美し|すご|神|天才|安心|癒)(?:く|じゃ|では|で)(?:ない|なかった|ありません|なさそう)/u, positiveDelta: -2, negativeDelta: 1.5 },
	{ label: '否定語の否定', regex: /(?:辛|悲し|嫌|苦し|怖|寂し|不安|心配|疲れ|しんど)(?:く|じゃ|では|で)(?:ない|なかった|ありません|なさそう)/u, positiveDelta: 1.5, negativeDelta: -2 },
] as const;
