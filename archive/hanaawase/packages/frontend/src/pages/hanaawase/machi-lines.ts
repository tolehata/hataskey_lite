// 花常「街の様子」＝入舟町のSNS。投稿・住民ペルソナ・たのみごとのデータ。
// ⚠️独自i18n。本体の locales/*.yml は一切使わない（CONSTRAINTS: パージ容易性）。
// ⚠️文面は執筆・機械検品済み。1投稿=1独立文、テンプレ増殖なし。書き換えるときは同じ規律で。
// ⚠️ここは「データだけ」。出し分けロジックは machi.ts、表示は MachiFeed.vue。
// ⚠️投稿の実体は machi-lines-batchNN*.ts に分けてあり、このファイルが束ねて公開する。
//    住民（MACHI_PERSONAS / MachiPersonaId）の定義はここが唯一の正本。バッチ側では定義しない。

import { MACHI_POSTS_KURASHI } from './machi-lines-batch01-kurashi.js';
import { MACHI_POSTS_BATCH02 } from './machi-lines-batch02.js';
import { HEART_REPLIES_B3, MACHI_THREADS_B3 } from './machi-lines-batch03.js';
import { MACHI_POSTS_BATCH04 } from './machi-lines-batch04.js';
import { MACHI_POSTS_BATCH05 } from './machi-lines-batch05.js';
import { HEART_REPLIES_B6, MACHI_POSTS_BATCH06, MACHI_THREADS_B6 } from './machi-lines-batch06.js';
import { HEART_REPLIES_B7, MACHI_POSTS_BATCH07, MACHI_THREADS_B7 } from './machi-lines-batch07.js';
import { HEART_REPLIES_B8, MACHI_POSTS_BATCH08, MACHI_THREADS_B8 } from './machi-lines-batch08.js';
import { HEART_REPLIES_B9, MACHI_POSTS_BATCH09, MACHI_THREADS_B9 } from './machi-lines-batch09.js';
import { HEART_REPLIES_B10, MACHI_POSTS_BATCH10, MACHI_THREADS_B10 } from './machi-lines-batch10.js';
import { HEART_REPLIES_B11, MACHI_POSTS_BATCH11, MACHI_THREADS_B11 } from './machi-lines-batch11.js';
// ⚠️バッチ12〜14は住民を12/12/11人に分けて並行執筆したもの。
//    各担当は互いの文面を見ていないため、結合前にバッチ相互の10文字一致を検査済み（4件を書き直して0件）。
import { HEART_REPLIES_B12, MACHI_POSTS_BATCH12, MACHI_THREADS_B12 } from './machi-lines-batch12.js';
import { HEART_REPLIES_B13, MACHI_POSTS_BATCH13, MACHI_THREADS_B13 } from './machi-lines-batch13.js';
import { HEART_REPLIES_B14, MACHI_POSTS_BATCH14, MACHI_THREADS_B14 } from './machi-lines-batch14.js';
import { HEART_REPLIES_B15, MACHI_POSTS_BATCH15, MACHI_THREADS_B15 } from './machi-lines-batch15.js';
import { HEART_REPLIES_B16, MACHI_POSTS_BATCH16, MACHI_THREADS_B16 } from './machi-lines-batch16.js';
import { HEART_REPLIES_B17, MACHI_POSTS_BATCH17, MACHI_THREADS_B17 } from './machi-lines-batch17.js';
import { HEART_REPLIES_B18, MACHI_POSTS_BATCH18, MACHI_THREADS_B18 } from './machi-lines-batch18.js';
import { HEART_REPLIES_B19, MACHI_POSTS_BATCH19, MACHI_THREADS_B19 } from './machi-lines-batch19.js';
import { HEART_REPLIES_B20, MACHI_POSTS_BATCH20, MACHI_THREADS_B20 } from './machi-lines-batch20.js';
import { HEART_REPLIES_B21, MACHI_POSTS_BATCH21, MACHI_THREADS_B21 } from './machi-lines-batch21.js';
import { HEART_REPLIES_B22, MACHI_POSTS_BATCH22, MACHI_THREADS_B22 } from './machi-lines-batch22.js';
import { HEART_REPLIES_B23, MACHI_POSTS_BATCH23, MACHI_THREADS_B23 } from './machi-lines-batch23.js';
export { MACHI_REPOST_SCENARIOS } from './machi-lines-reposts.js';
export type { MachiRepostScenario } from './machi-lines-reposts.js';
import { TANOMIGOTO_2 } from './machi-lines-tanomigoto-2.js';
import { TANOMIGOTO_3 } from './machi-lines-tanomigoto-3.js';

// --- 住民 ---------------------------------------------------------------

export type MachiPersonaId =
	| 'wakana' | 'ren' | 'yae' | 'inukai'
	| 'saeko' | 'koharu' | 'daiki' | 'kanako'
	| 'naito' | 'tatsumi' | 'teruko' | 'takumi'
	| 'rieko' | 'kumiai' | 'maki' | 'hiro'
	// バッチ01で足した商店街の面々（gen＝玄 は既存キャストの登録漏れ）
	| 'gen' | 'igarashi' | 'otsubo' | 'sumie' | 'yuta'
	| 'chiaki' | 'kenji_bus' | 'nobue' | 'shioda'
	// バッチ02で足した仕事・学校まわりの面々
	| 'kenji_iron' | 'nanami' | 'souta' | 'mizuki' | 'tsutomu'
	| 'ayano' | 'goro' | 'chie' | 'yuuji' | 'sumire';

export interface MachiPersona {
	id: MachiPersonaId;
	/** 表示名。 */
	name: string;
	/** @ハンドル（架空）。 */
	handle: string;
	/** 自己紹介。いまは未使用だがプロフィール表示を足すときのため残す。 */
	bio: string;
	/** 立ち絵のあるキャスト（アバターに縁取りを出す）。 */
	tachie: boolean;
	/** アバターの地色。 */
	color: string;
}

export const MACHI_PERSONAS: readonly MachiPersona[] = [
	{ id: 'wakana', name: '三隅若菜', handle: 'hanatsune_wakana', bio: '花常の二代目。1/7生。', tachie: true, color: '#2f6e4f' },
	{ id: 'ren', name: '大神漣', handle: 'ren_ogami', bio: '工科大・サーバー同好会。配達手伝い。', tachie: true, color: '#5b6675' },
	{ id: 'yae', name: '八重', handle: 'maruhachi_yae', bio: '青果まるはち女将。', tachie: true, color: '#c4383d' },
	{ id: 'inukai', name: '犬飼旬', handle: 'inukai_seika', bio: '浜市場・犬飼生花。柴犬です。', tachie: true, color: '#c9a04e' },
	{ id: 'saeko', name: '月野冴子', handle: 'saeko_minato', bio: '坂の上在住。息子ひとり。', tachie: false, color: '#7b86c8' },
	{ id: 'koharu', name: '小春', handle: 'koharu_bakery', bio: '坂上ベーカリー。朝は早い。', tachie: false, color: '#cf9a2e' },
	{ id: 'daiki', name: '佐々木大輝', handle: 'sasaki_srv', bio: '工科大2年。大神先輩を追う。', tachie: false, color: '#2d4a73' },
	{ id: 'kanako', name: '霜月堂 若女将', handle: 'shimotsukido', bio: '和菓子・霜月堂。', tachie: false, color: '#b5556e' },
	{ id: 'naito', name: '内藤', handle: 'naito_kiku', bio: '菊農家。夜も畑にいる。', tachie: true, color: '#a8823a' },
	{ id: 'tatsumi', name: '辰巳', handle: 'tatsumi_seri', bio: '浜市場の競り人。声はでかい。', tachie: true, color: '#c4383d' },
	{ id: 'teruko', name: '照子', handle: 'teruko_kayoi', bio: '花常の古い常連。供えの花を欠かさない。', tachie: false, color: '#8a7d68' },
	{ id: 'takumi', name: '匠', handle: 'takumi_hs', bio: '入舟高校2年。自転車通学。', tachie: false, color: '#2d4a73' },
	{ id: 'rieko', name: '理恵子', handle: 'rieko_piano', bio: '坂の上でピアノ教室。', tachie: false, color: '#b5556e' },
	{ id: 'kumiai', name: '入舟銀座商店街', handle: 'irifune_ginza', bio: '商店街組合の中の人。', tachie: false, color: '#5a7a52' },
	{ id: 'maki', name: '真希', handle: 'maki_hikkoshi', bio: '先月この町に越してきました。', tachie: false, color: '#7b86c8' },
	{ id: 'hiro', name: '弘之', handle: 'hiro_eigyou', bio: '営業まわりの会社員。花は不慣れ。', tachie: false, color: '#6b6f7a' },

	// --- バッチ01（暮らしと商店街）で加わった住民 ---
	// ⚠️玄は立ち絵と本文のあるサブキャスト。MACHI_PERSONAS から外さない。
	//    3バッチが各々定義していたので、正式な1件はここに置く（重複定義はバッチ側から削除済み）。
	{ id: 'gen', name: '玄', handle: 'kuromatsu_gen', bio: '喫茶くろまつ。豆を挽いている。', tachie: true, color: '#5a4632' },
	{ id: 'igarashi', name: '五十嵐', handle: 'igarashi_kome', bio: '五十嵐米穀店。配達承ります。', tachie: false, color: '#a89b74' },
	{ id: 'otsubo', name: '大坪', handle: 'otsubo_sake', bio: '大坪酒店。冷やも燗も。', tachie: false, color: '#3f5d7a' },
	{ id: 'sumie', name: 'すみ江', handle: 'sumie_souzai', bio: '惣菜のすみ江。夕方が本番。', tachie: false, color: '#c98545' },
	{ id: 'yuta', name: '岡田悠太', handle: 'yuta_okada', bio: '入舟中2年。陸上部。', tachie: false, color: '#3d7ca8' },
	// ⚠️図書館の司書が2人になる衝突を避けて、千秋は公民館の図書室へ寄せた（町立図書館の司書は立花すみれ）。
	{ id: 'chiaki', name: '千秋', handle: 'chiaki_lib', bio: '公民館の図書室。本の世話係。', tachie: false, color: '#6b7f9e' },
	// ⚠️`kenji_bus` と `kenji_iron` は別人。元は両バッチとも id が 'kenji' で衝突していた。
	{ id: 'kenji_bus', name: '健司', handle: 'kenji_bus', bio: '坂上線のバス運転士。始発担当。', tachie: false, color: '#5a6b5e' },
	// ⚠️クリーニングが2軒になる衝突を避けて、信江と千恵は同じ入舟屋の別の持ち場にした。
	{ id: 'nobue', name: '信江', handle: 'nobue_cleaning', bio: 'クリーニング入舟屋。店頭でお預かりします。', tachie: false, color: '#b08fa8' },
	{ id: 'shioda', name: '潮田', handle: 'shioda_barber', bio: 'バーバー潮。三代目。', tachie: false, color: '#7a6a55' },

	// --- バッチ02（仕事・学校・季節）で加わった住民 ---
	{ id: 'kenji_iron', name: '沢口健二', handle: 'sawaguchi_tekko', bio: '川沿いの入舟鉄工所。旋盤ひとすじ。', tachie: false, color: '#6b6f7a' },
	{ id: 'nanami', name: '白石七海', handle: 'nanami_wind', bio: '入舟高校3年。吹奏楽部。', tachie: false, color: '#4f8fa8' },
	{ id: 'souta', name: '三上颯太', handle: 'souta_haitatsu', bio: '軽貨物の配達。町じゅう走ってます。', tachie: false, color: '#3f7d5c' },
	{ id: 'mizuki', name: '早瀬瑞希', handle: 'mizuki_lab', bio: '工科大4年。研究室と就職活動。', tachie: false, color: '#2d4a73' },
	{ id: 'tsutomu', name: '樽井勉', handle: 'tarui_shokuin', bio: '入舟出張所の職員。窓口担当。', tachie: false, color: '#5a6b8a' },
	{ id: 'ayano', name: '岸本綾乃', handle: 'ayano_kokugo', bio: '入舟高校教諭。国語。', tachie: false, color: '#8a6ea8' },
	{ id: 'goro', name: '浜口吾郎', handle: 'hamaguchi_nakagai', bio: '浜市場の仲買。辰巳とは長い付き合い。', tachie: false, color: '#a85c3a' },
	{ id: 'chie', name: '藤井千恵', handle: 'chie_cleaning', bio: 'クリーニング入舟屋の川沿い工場。仕上げ担当。', tachie: false, color: '#7fa8b5' },
	{ id: 'yuuji', name: '森下裕二', handle: 'morishita_denki', bio: '商店街の電器屋。深夜放送の民。', tachie: false, color: '#5a7a52' },
	{ id: 'sumire', name: '立花すみれ', handle: 'sumire_toshokan', bio: '入舟町立図書館の司書。', tachie: false, color: '#8a7d68' },
] as const;

const PERSONA_INDEX: Record<string, MachiPersona> = Object.fromEntries(
	MACHI_PERSONAS.map((p) => [p.id, p]),
);

/** ペルソナを引く。未知のidでも落とさない（データ差し替え耐性）。 */
export function personaOf(id: string): MachiPersona {
	return PERSONA_INDEX[id] ?? { id: 'wakana', name: '?', handle: 'unknown', bio: '', tachie: false, color: '#8a7d68' };
}

// --- 投稿 ---------------------------------------------------------------

export interface MachiPost {
	/** 投稿者。 */
	p: MachiPersonaId;
	/** 本文。⚠️中央揃えにしない＝人間味を残す側のテキスト。 */
	t: string;
	/** その投稿に付きやすい絵文字のあたり。⚠️初期値ではない（新着は必ず0から）。 */
	e?: readonly string[];
}

/** 最初期の48本。⚠️追加分はバッチ別ファイルにあり、下の MACHI_POSTS で束ねる。 */
const MACHI_POSTS_BASE: readonly MachiPost[] = [
	{ p: 'wakana', t: '店を開けた。水仙が浅水で機嫌よさそうにしてる。', e: ['🌼', '🌱'] },
	{ p: 'wakana', t: '見切り籠に名前をつけたら急に可愛く見えてきた。今日のうちに飾る花。', e: ['🪴', '😊'] },
	{ p: 'wakana', t: '初売りの荷ほどき中。松の匂いで指先まで正月になる。', e: ['🎍'] },
	{ p: 'wakana', t: '値札より先に名前を覚えろ、ってばあちゃんの声がする。まだ半分あやしい。', e: ['😌'] },
	{ p: 'wakana', t: '向日葵の水は朝も昼も夕も替える。夏はこれが仕事の本体。', e: ['☀️', '💦'] },
	{ p: 'wakana', t: '閉店。今日はよく捌けた。棚を磨いてから帰る。', e: ['🧹', '✨'] },
	{ p: 'wakana', t: '店先で猫が寝てる。今日の看板娘。', e: ['🐈'] },
	{ p: 'wakana', t: '紫陽花は水が下がりやすい。切り口に明礬。地味だけど効く。', e: ['💧'] },
	{ p: 'wakana', t: '今日の分だけ、静かに店じまい。おやすみ入舟町。', e: ['🌙', '😴'] },
	{ p: 'ren', t: '配達完了! 坂の上まで軽トラで往復、これがいい運動になるんだよな。', e: ['🚚'] },
	{ p: 'ren', t: '深夜のログ調査より花の水替えのほうが性に合うかもしれん。', e: ['💻', '🌸'] },
	{ p: 'ren', t: '花常さんの結んだ花束、なぜかほどけない。あの結び目、どういう仕組みなんだ。', e: ['🎀'] },
	{ p: 'ren', t: 'レポートの締切、花の締切より甘く見てた。詰んだ。', e: ['😇'] },
	{ p: 'ren', t: '犬飼さんに、犬と一緒にするなと怒られた。いや、俺は狼なんだけどな。', e: ['🐺', '😂'] },
	{ p: 'ren', t: '坂の上から見ると、町で花常の灯りだけ一番あったかい。', e: ['🏮', '🥹'] },
	{ p: 'yae', t: '若菜ちゃん、また朝ごはん抜いてる。うちのバナナ置いといたからね。', e: ['🍌', '😤'] },
	{ p: 'yae', t: '常ちゃんの孫があんなに立派に店をやって。感慨深いわ。', e: ['🥲'] },
	{ p: 'yae', t: 'トマトは今日が当たり年。花のついでに寄ってって。', e: ['🍅'] },
	{ p: 'yae', t: '坂の上の奥さんが花常の花を褒めてたよ。ちゃんと伝えとく。', e: ['😊'] },
	{ p: 'yae', t: '若菜ちゃん、無理は禁物よ。町の母より。', e: ['💗'] },
	{ p: 'inukai', t: '今朝のセリ、いい枝が入った。花常さん向けに取っといたぞ。', e: ['🌿'] },
	{ p: 'inukai', t: 'レンのやつ、市場に慣れてきた。荷運びは戦力だ。', e: ['💪'] },
	{ p: 'inukai', t: '柴犬だっつの。犬っころ扱いすんな。', e: ['🐕', '😆'] },
	{ p: 'inukai', t: '菊の季節。内藤さんとこの電照が今年も見事だ。', e: ['🌼'] },
	{ p: 'inukai', t: '辰巳さんの競り声、今日も浜に響いてる。', e: ['📣'] },
	{ p: 'saeko', t: '坂の下の花屋さん、若い子が継いだのね。応援したい。', e: ['🌷'] },
	{ p: 'saeko', t: '今日の夕飯はまるはちのトマトでミネストローネ。', e: ['🍲'] },
	{ p: 'saeko', t: '雨の日はなんだか花が欲しくなる。不思議ね。', e: ['☔', '🌹'] },
	{ p: 'saeko', t: '息子が初任給で花を買ってきた。柄にもなく。', e: ['💐', '🥲'] },
	{ p: 'saeko', t: '雨上がりの虹、坂の上からよく見える。', e: ['🌈'] },
	{ p: 'koharu', t: '今朝の食パン、焼き上がりました。花常さんにも一斤とどけよう。', e: ['🍞'] },
	{ p: 'koharu', t: '向かいの花屋さん、店先の水仙がいい香り。朝の楽しみ。', e: ['🌼'] },
	{ p: 'koharu', t: 'クロワッサンが湿気に負けた。梅雨め。', e: ['🥐', '😮‍💨'] },
	{ p: 'koharu', t: 'あんぱんの新作、桜あん。春のあいだだけ。', e: ['🌸'] },
	{ p: 'koharu', t: '明日は早起き。松市の朝は町じゅうが動く。', e: ['🎍'] },
	{ p: 'daiki', t: '大神先輩、また花屋でバイトすか。単位、大丈夫すか。', e: ['💻', '😅'] },
	{ p: 'daiki', t: '工科大の学祭、看板の花を花常さんに相談中。', e: ['🌸'] },
	{ p: 'daiki', t: 'サーバーが落ちた。台風の夜は決まって何かが起きる。', e: ['⚡'] },
	{ p: 'daiki', t: 'レポート徹夜明け、朝の商店街が眩しい。', e: ['🌅'] },
	{ p: 'kanako', t: '上生菓子、今月は『寒椿』。花常さんの椿を写しました。', e: ['🌺', '🍵'] },
	{ p: 'kanako', t: '霜月堂です。ひな祭りの菱餅、予約を承り中。', e: ['🎎'] },
	{ p: 'kanako', t: 'くろまつのマスターに豆をいただいた。無口だけど優しい人。', e: ['☕'] },
	{ p: 'kanako', t: '七夕の練り切り、笹の緑がいちばん難しい。', e: ['🎋'] },
	{ p: 'wakana', t: '梅の枝は蕾のかたさで選ぶ、らしい。まだ手が覚えてない。', e: ['🌸'] },
	{ p: 'ren', t: '雨の配達はカッパで行く。誕生日が近いのは、まあ内緒で。', e: ['☔', '🎂'] },
	{ p: 'inukai', t: '盆の仏花、今年も忙しくなる。気合入れていくぞ。', e: ['🙏'] },
	{ p: 'saeko', t: '息子の卒業式、花束は花常さんにお願いしようかしら。', e: ['🎓'] },
	{ p: 'ren', t: 'センセイに一輪もらった日のこと、まだ覚えてる。', e: ['🌼', '🥹'] },
] as const;

/** 単独投稿の全部。⚠️数はここから数える（この配列の length が実数）。 */
export const MACHI_POSTS: readonly MachiPost[] = [
	...MACHI_POSTS_BASE,
	...MACHI_POSTS_KURASHI,
	...MACHI_POSTS_BATCH02,
	...MACHI_POSTS_BATCH04,
	...MACHI_POSTS_BATCH05,
	...MACHI_POSTS_BATCH06,
	...MACHI_POSTS_BATCH07,
	...MACHI_POSTS_BATCH08,
	...MACHI_POSTS_BATCH09,
	...MACHI_POSTS_BATCH10,
	...MACHI_POSTS_BATCH11,
	...MACHI_POSTS_BATCH12,
	...MACHI_POSTS_BATCH13,
	...MACHI_POSTS_BATCH14,
	...MACHI_POSTS_BATCH15,
	...MACHI_POSTS_BATCH16,
	...MACHI_POSTS_BATCH17,
	...MACHI_POSTS_BATCH18,
	...MACHI_POSTS_BATCH19,
	...MACHI_POSTS_BATCH20,
	...MACHI_POSTS_BATCH21,
	...MACHI_POSTS_BATCH22,
	...MACHI_POSTS_BATCH23,
];

// --- 会話（返信を線でつないで見せるまとまり） -----------------------------

export interface MachiThread {
	root: MachiPost;
	replies: readonly MachiPost[];
}

const MACHI_THREADS_BASE: readonly MachiThread[] = [
	{
		root: { p: 'ren', t: '花常さんの花束、どうやってもほどけません。企業秘密ですか。', e: ['🎀'] },
		replies: [
			{ p: 'wakana', t: '秘密。……というほどでもないけど。', e: ['😌'] },
		],
	},
	{
		root: { p: 'yae', t: '若菜ちゃん、今日もお店の灯り遅くまで点いてたわね。', e: ['🏮'] },
		replies: [
			{ p: 'wakana', t: '棚を磨いてたら遅くなった。売れない日は磨く日、だから。', e: ['✨'] },
			{ p: 'saeko', t: 'その言葉、なんだかいいわね。', e: ['🥹'] },
		],
	},
] as const;

/** 会話ひとまとまりの全部。⚠️組数は length、本数は root 1 + replies の合計。 */
export const MACHI_THREADS: readonly MachiThread[] = [
	...MACHI_THREADS_BASE,
	...MACHI_THREADS_B3,
	...MACHI_THREADS_B6,
	...MACHI_THREADS_B7,
	...MACHI_THREADS_B8,
	...MACHI_THREADS_B9,
	...MACHI_THREADS_B10,
	...MACHI_THREADS_B11,
	...MACHI_THREADS_B12,
	...MACHI_THREADS_B13,
	...MACHI_THREADS_B14,
	...MACHI_THREADS_B15,
	...MACHI_THREADS_B16,
	...MACHI_THREADS_B17,
	...MACHI_THREADS_B18,
	...MACHI_THREADS_B19,
	...MACHI_THREADS_B20,
	...MACHI_THREADS_B21,
	...MACHI_THREADS_B22,
	...MACHI_THREADS_B23,
];

// --- ♡を押したときの反応（空リプ） ---------------------------------------

// ⚠️これは返信ではない。宛先を書かない独立した投稿＝「空リプ」としてTLに流す。
// だから文面も「誰かに返している」風にせず、ひとりごとの温度で書く。
const HEART_REPLIES_BASE: readonly string[] = [
	'ありがとう。今日はいい日になりそう。',
	'見ててくれる人がいるんだね。',
	'こういうの、ちょっと照れるな。',
	'励みになります。ほんとに。',
	'気づいてくれて嬉しい。',
	'ひとつ増えた。数えてないけど、数えてる。',
	'こんな話でよければ、いくらでも。',
	'今の、届いたんだ。',
	'こういう小さいのが、案外うれしいの。',
	'誰かが読んでる。それだけで店が明るい。',
	'うん。今日はもう一頑張りできる。',
	'ちょうど手が止まってたところ。ありがとう。',
	'この町、悪くないでしょう。',
	'たまにはこういうのも書いてみるもんだ。',
	'見返してにやにやしてる。内緒で。',
	'ひとりごとのつもりだったのに。',
	'写真も撮っておけばよかったな。',
	'また来てくださいね。花はいつでもあります。',
	'夜中に見ると、余計にしみる。',
	'そっちも、よい一日を。',
] as const;

/** 空リプの全部。 */
export const HEART_REPLIES: readonly string[] = [
	...HEART_REPLIES_BASE,
	...HEART_REPLIES_B3,
	...HEART_REPLIES_B6,
	...HEART_REPLIES_B7,
	...HEART_REPLIES_B8,
	...HEART_REPLIES_B9,
	...HEART_REPLIES_B10,
	...HEART_REPLIES_B11,
	...HEART_REPLIES_B12,
	...HEART_REPLIES_B13,
	...HEART_REPLIES_B14,
	...HEART_REPLIES_B15,
	...HEART_REPLIES_B16,
	...HEART_REPLIES_B17,
	...HEART_REPLIES_B18,
	...HEART_REPLIES_B19,
	...HEART_REPLIES_B20,
	...HEART_REPLIES_B21,
	...HEART_REPLIES_B22,
	...HEART_REPLIES_B23,
];

/** 町の人が押していく絵文字。投稿ごとの e が尽きたらここから選ぶ。 */
export const AMBIENT_EMOJI: readonly string[] = [
	'🌸', '👍', '😊', '🌼', '✨', '❤️', '🍵', '🙏', '🌿', '😆',
	'🌷', '☕', '🍡', '🌱', '🐈', '🏮', '🥹', '🎋', '🌾', '💐',
	'🪴', '😌', '🍂', '🌙', '🍀', '👏', '🫶', '🍁',
] as const;

/** 自分が押す♡の絵文字。 */
export const HEART_EMOJI = '❤️';

// --- たのみごと ---------------------------------------------------------

export interface Tanomigoto {
	id: string;
	title: string;
	/** 依頼者。 */
	by: MachiPersonaId;
	/** 軽い達成条件（既存engineの語彙で書く）。 */
	goal: string;
	/** TLに流れる依頼文。 */
	ask: string;
	/** 引き受けたときに依頼者が漏らす一言。 */
	wip: string;
	/** 達成したときの一言。 */
	done: string;
	/** 未達だったときの一言。 */
	fail: string;
	/** その依頼の花に合わせた花びらの色。 */
	petal: string;
}

// ⚠️成否はシステム（盤面の結果）が決める。手動の完了/失敗ボタンは置かない。
// ⚠️物語本文は design/TANOMIGOTO-STORY-01-09.md と -18-25.md にある（q10〜q17は未ファイル化）。
//    ここに置くのは、その依頼がSNSに顔を出すときの短い4行だけ。
const TANOMIGOTO_BASE: readonly Tanomigoto[] = [
	{
		id: 'q01', title: '卒業式の花束', by: 'saeko', goal: '明るい色の花を12そろえる', petal: '#f2a7b8',
		ask: '息子の卒業式の花束、どこかいいお花屋さん知らないかしら。',
		wip: '花常さんが受けてくれたって。当日が楽しみ。',
		done: '素敵な花束をありがとう。息子、柄にもなく照れてた。',
		fail: '今回は間に合わなかったか……また今度お願いするわね。',
	},
	{
		id: 'q02', title: '朝の配達を手伝って', by: 'koharu', goal: '手数を5つ残してクリア', petal: '#f4efe3',
		ask: '向かいの花屋さん、朝の配達を手伝える人いないかな。',
		wip: '大神くんが手伝ってくれることに。ほんと助かる。',
		done: '配達ばっちり。お礼に焼きたて一斤どうぞ。',
		fail: '今日は都合つかなかったか。無理しないでね。',
	},
	{
		id: 'q03', title: '松市の荷さばき', by: 'inukai', goal: '松を16そろえる', petal: '#2f6e4f',
		ask: '松市の荷、猫の手も借りたい。誰か浜まで来れるか。',
		wip: '花常さんが来てくれるって。心強い。',
		done: '大量の松、無事さばけた。恩に着る。',
		fail: '間に合わずか……来年こそ頼むぞ。',
	},
	{
		id: 'q04', title: '母の日に贈る一束', by: 'hiro', goal: '赤い花を10そろえる', petal: '#c4383d',
		ask: '母の日、実家に花を贈りたいんだが……何を選べばいいのか。',
		wip: '花屋さんに相談したら、任せてって。頼もしい。',
		done: '母から電話が来た。柄にもなく声が弾んでたよ。',
		fail: '結局あたふたして贈りそびれた。来年は早めに動く。',
	},
	{
		id: 'q05', title: 'お見舞いの淡い花', by: 'teruko', goal: '香りの強くない花を8そろえる', petal: '#b3a7d6',
		ask: '見舞いに持っていく花を。派手すぎず、香りの強くないのがいいの。',
		wip: '花常さんが見立ててくれるそう。安心してお任せできる。',
		done: '白を少し混ぜてくれてね。喜んでもらえたわ。',
		fail: '見繕いが間に合わず、手ぶらで行くことになったの。',
	},
	{
		id: 'q06', title: '学祭の看板を彩る花', by: 'daiki', goal: '3連鎖を1回決める', petal: '#f2b135',
		ask: '工科大の学祭、看板まわりを花で飾りたいんすけど相談できます?',
		wip: '花常さんが一緒に考えてくれることに。学祭が捗る。',
		done: '看板、めちゃくちゃ映えた。写真撮りまくったっす。',
		fail: '準備が回らず、花は来年の宿題になったっす。',
	},
	{
		id: 'q07', title: '七五三の髪に挿す花', by: 'maki', goal: '桜色の花を6そろえる', petal: '#f2d98c',
		ask: '娘の七五三、髪に小さな花を挿してあげたくて。相談できますか。',
		wip: '花屋さんが小ぶりのを選んでくれるって。越してきてよかった。',
		done: '娘が鏡の前で何度もくるくる回ってました。ありがとう。',
		fail: '支度がばたばたで、花までは手が回らなかったです。',
	},
	{
		id: 'q08', title: 'お盆の仏花', by: 'teruko', goal: '菊を12そろえる', petal: '#f4efe3',
		ask: 'お盆の仏花、今年もお願いできるかしら。毎年の分。',
		wip: '今年も花常さんに。この時季が来ると気が引き締まるわ。',
		done: 'きれいに整えてくれてね。仏壇が明るくなった。',
		fail: '取りに行けずじまい。年寄りの足はままならないわね。',
	},
	{
		id: 'q09', title: '喫茶の卓に一輪', by: 'kanako', goal: '1局を最後までクリア', petal: '#efe7d6',
		ask: 'くろまつの店主へ、カウンターに置く一輪を贈りたくて。無口な人だから。',
		wip: '花常さんが選んでくれるそう。マスター、気づくかしら。',
		done: '翌日、卓にちゃんと飾ってあった。……豆、って言われた。照れ隠しね。',
		fail: '渡しそびれてしまった。また折を見て。',
	},
	{
		id: 'q10', title: '敬老の日、祖母へ', by: 'takumi', goal: '紫の花を8そろえる', petal: '#7b6bb8',
		ask: 'ばあちゃんに敬老の日の花あげたいんすけど、何がいいすか。予算少なめで。',
		wip: '花屋のお姉さんが予算内で見繕ってくれるって。助かる。',
		done: 'ばあちゃん、玄関に飾って近所に自慢してた。恥ずいけど嬉しい。',
		fail: '部活で忙しくて、結局間に合わなかったっす。',
	},
	{
		id: 'q11', title: '七夕の笹を分けて', by: 'rieko', goal: '緑の花を10そろえる', petal: '#5a7a52',
		ask: '教室の子たちと七夕をするので、笹と飾りの花を少し分けてもらえますか。',
		wip: '花常さんが用意してくれるとのこと。子どもたち大喜び。',
		done: '短冊がいっぱい下がって、賑やかな七夕になりました。',
		fail: '梅雨が長引いて、今年の七夕は見送りに。',
	},
	{
		id: 'q12', title: '結婚記念日、内緒で', by: 'hiro', goal: '手数を8つ残してクリア', petal: '#c4383d',
		ask: '妻に内緒で記念日の花を用意したい。バレない受け取り方ってあります?',
		wip: '花屋さんが会社帰りに寄れる時間で調整してくれた。抜かりない。',
		done: '妻が絶句してた。いい意味で。たまにはやるもんだな。',
		fail: 'そわそわしてたら妻に勘づかれた。サプライズは難しい。',
	},
	{
		id: 'q13', title: '発表会のブーケ', by: 'rieko', goal: '5連鎖を1回決める', petal: '#f0a8bc',
		ask: 'ピアノの発表会、生徒に渡す小さなブーケをいくつかお願いしたいです。',
		wip: '花常さんがまとめて用意してくれることに。当日が楽しみ。',
		done: '子どもたちが両手で抱えて帰りました。いい一日でした。',
		fail: '数がそろわず、今年は一部の子だけに。来年こそ全員に。',
	},
	{
		id: 'q14', title: '越してきた店先の緑', by: 'maki', goal: '1局を最後までクリア', petal: '#5a7a52',
		ask: '先月越してきました。店先に置く育てやすい緑を相談したいです。',
		wip: '花屋さんが水やりの手のかからない鉢を見立ててくれるらしい。心強い。',
		done: '店先が一気に馴染みました。この町、好きになれそう。',
		fail: '引っ越しの片付けに追われて、緑はもう少し先に。',
	},
	{
		id: 'q15', title: '開店祝いのスタンド', by: 'kumiai', goal: '手数を3つ残してクリア', petal: '#c9a04e',
		ask: '商店街に新しい店が入ります。開店祝いのスタンド花、花常さんにお願いできますか。',
		wip: '花常さんが引き受けてくれました。商店街の顔になりそう。',
		done: '立派なスタンドで新店も大喜び。商店街の格が上がりました。',
		fail: '日取りが合わず、今回は別の形でお祝いを。',
	},
	{
		id: 'q16', title: '雨の日の水仙を一輪', by: 'saeko', goal: '季節外れの花を1つ消す', petal: '#f7f3e6',
		ask: '雨の日はなぜか花が欲しくなるの。水仙を一輪、寄っていってもいい?',
		wip: '花常さんが浅水で活けたのを取り置いてくれるって。',
		done: '一輪だけで、部屋がちゃんと部屋になった。不思議ね。',
		fail: '雨脚が強くて店まで行けなかったわ。また晴れたら。',
	},
	{
		id: 'q17', title: '畑の菊を店へ', by: 'naito', goal: '菊を16そろえる', petal: '#f4efe3',
		ask: '今年の菊はよう締まった。花常に何鉢か届けたいが、誰か運べるか。',
		wip: 'レンが軽トラで来てくれるとな。夜も起きとる菊の出番だ。',
		done: '店にきれいに並んだと聞いた。光の花、というやつだ。',
		fail: '畑がぬかるんで運び出せなんだ。次の晴れ間に。',
	},
	{
		id: 'q18', title: '福引の景品に花を', by: 'kumiai', goal: '点を200以上とる', petal: '#c9a04e',
		ask: '年末の福引、景品に花の商品券を入れたいんです。ご相談できますか。',
		wip: '花常さんが快諾。福引の目玉がひとつ増えました。',
		done: '一等の花束が大好評。来場者が例年より多かったです。',
		fail: '準備が押して、花の景品は次回に持ち越しに。',
	},
	{
		id: 'q19', title: '新入生を迎える花', by: 'daiki', goal: '桜色の花を10そろえる', petal: '#f2a7b8',
		ask: '新歓の受付に飾る花、明るいのが欲しいっす。相談いいすか。',
		wip: '花常さんが春らしい色で見立ててくれるという。新入生に映える。',
		done: '受付が華やいで、新入生の食いつきもよかったっす。',
		fail: '予算会議が長引いて、花は据え置きになったっす。',
	},
	{
		id: 'q20', title: '友だちへの誕生日', by: 'takumi', goal: '3連鎖を1回決める', petal: '#e9899e',
		ask: '友だちの誕生日に花って重いすかね……初めてで勝手がわからんす。',
		wip: '花屋のお姉さんが『重くない一輪』を勧めてくれた。挑戦してみる。',
		done: '普通に喜ばれた。花、意外とありなんだな。世界変わったわ。',
		fail: '渡す勇気が出ずポケットで枯らした。次はちゃんと渡す。',
	},
	{
		id: 'q21', title: '毎月のお供え', by: 'teruko', goal: '白い花を8そろえる', petal: '#f4efe3',
		ask: '毎月一日に供える花を、続けてお願いしたいの。細く長くね。',
		wip: '今月も花常さんに。この習いだけは絶やしたくないの。',
		done: '月初めの花、いつも通り整えてくれてありがとう。落ち着くわ。',
		fail: '今月は体がついていかず、お供えを欠かしてしまった。',
	},
	{
		id: 'q22', title: '雨宿りついでの一輪', by: 'hiro', goal: '1局を最後までクリア', petal: '#b3a7d6',
		ask: '急な雨で花屋さんの軒を借りてます。ついでに一輪、なんて無粋ですか。',
		wip: '無粋じゃないと言ってもらえた。花屋の軒、居心地がいい。',
		done: '雨宿りのはずが一輪連れて帰った。悪くない寄り道だった。',
		fail: '雨がやんで、そそくさと帰ってしまった。次は買おう。',
	},
	{
		id: 'q23', title: '送別会の花束', by: 'hiro', goal: '手数を5つ残してクリア', petal: '#c4383d',
		ask: '異動する先輩への送別の花束、外さない一束をお願いしたい。',
		wip: '花常さんが先輩の雰囲気に合わせて組んでくれるとのこと。',
		done: '先輩が言葉に詰まってた。いい送り出しになったよ。',
		fail: '幹事仕事が重なって、花の手配が抜けてしまった。反省。',
	},
	{
		id: 'q24', title: '初デートに持つ花', by: 'takumi', goal: '梅を12そろえる', petal: '#e9899e',
		ask: 'こ、今度その、初めて出かけるんすけど……花って持ってくの、変すか。',
		wip: '『一輪なら気軽でいい』ってお姉さんが。ハードル下がった。',
		done: '手渡したら笑ってくれた。持ってってよかった。心臓に悪いけど。',
		fail: '緊張で花のことなんて頭から飛んでた。次があれば、次こそ。',
	},
	{
		id: 'q25', title: '年の瀬に松を一対', by: 'tatsumi', goal: '松を16そろえる', petal: '#2f6e4f',
		ask: '年の瀬だ。うちの店先にも松を一対、見繕ってくれるか。花常の見立てで。',
		wip: '花常が選んでくれるとよ。年神さんも迷わず来るだろう。',
		done: '立派な松がついた。これで気持ちよく年を越せる。世話んなった。',
		fail: '仕入れが立て込んで受け取れずじまい。来年は早う頼む。',
	},
] as const;

// ⚠️追加ぶんは別ファイル。1ファイルが肥大しないように分けている（投稿の batch と同じ作法）。
export const TANOMIGOTO: readonly Tanomigoto[] = [
	...TANOMIGOTO_BASE,
	...TANOMIGOTO_2,
	...TANOMIGOTO_3,
];

/** ⓘ に出すフィクション注記。⚠️中央揃え・語尾が孤立しない短文で書く。 */
export const MACHI_INFO_NOTE: readonly string[] = [
	'流れる投稿はすべて演出（フィクション）です。',
	'実在の人物・団体とは関係ありません。',
	'雰囲気づくりのため自動で表示しています。',
] as const;
