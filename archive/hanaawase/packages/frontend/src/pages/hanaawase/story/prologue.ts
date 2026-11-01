/**
 * 花常 本文 序章「二冊目」
 * 原稿から転記した実行時シナリオデータ。
 *
 * ⚠️本文はそのまま移してある。要約・書き換え・表情タグの付け替えを禁止する（SPEC §9.7.15）。
 * ⚠️表情【①〜⑥】は本文に人間が割り当て済み。推測で足さない。
 */

import type { Vignette } from "./types.js";

const bunguten: Vignette = {
	id: "p-00-bunguten",
	kind: "scene",
	month: 0,
	title: "一月五日、駅前",
	trigger: { at: "month-open", month: 1 },
	synopsis: "若菜が駅前の文具店で、店の帳面を買う。糸綴じの、いちばん厚いものを選ぶ。",
	lines: [
		{ kind: "narration", bg: "indoor_other", text: "駅前の通りは、商店街より二度ほど暖かい。バスの排気と、パン屋の熱と、人の数のぶんだ。" },
		{ kind: "narration", text: "文具店は間口が狭くて、奥に長い。入り口に回転式のボールペン棚、その先が便箋と封筒、いちばん奥の壁いっぱいに帳面が積んである。大学ノート、事務用の伝票、罫の広いもの狭いもの。若菜は軽トラの鍵を握ったまま、その棚の前に立っていた。" },
		{ kind: "narration", text: "指で背を押して、厚みを見る。三冊目で手が止まって、また戻した。" },
		{ kind: "say", speaker: "sub", name: "店主", text: "事務用ですか" },
		{ kind: "say", speaker: "wakana", emo: 1, text: "帳面です。店の" },
		{ kind: "say", speaker: "sub", name: "店主", text: "ああ、花常さんの。お宅、前はうちの糸綴じを使ってらしたよ。伝票と一緒に" },
		{ kind: "say", speaker: "wakana", emo: 8, text: "糸綴じ" },
		{ kind: "say", speaker: "sub", name: "店主", text: "これ。開いたら開いたままでいる。片手が空くでしょう" },
		{ kind: "narration", text: "差し出された一冊は、若草色の表紙だった。角が丸く落としてある。勘定台の上に置いた形を思い浮かべながら、若菜は表紙を開いた。背がぱたりと平らになって、頁が起き上がってこない。" },
		{ kind: "say", speaker: "wakana", emo: 4, text: "厚いのは、ありますか" },
		{ kind: "say", speaker: "sub", name: "店主", text: "あるよ。同じ綴じで、倍。ただし重い" },
		{ kind: "say", speaker: "wakana", emo: 16, text: "重いほうで" },
		{ kind: "say", speaker: "sub", name: "店主", text: "一年、保つよ" },
		{ kind: "say", speaker: "wakana", emo: 18, text: "一年、書ければ" },
		{ kind: "narration", text: "包む紙の音がしている間、若菜は店の時計を見上げていた。荷台の水仙が待っている。" },
	],
};

const kaitenZenya: Vignette = {
	id: "p-00-kaiten-zenya",
	kind: "scene",
	month: 0,
	title: "一月五日、開店前夜",
	trigger: { at: "month-open", month: 1 },
	synopsis: "開店前夜の店。仕込みを終えた若菜のところへ、隣の八百屋の八重さんが大根を持って顔を出す。若菜は祖母の帳面を引き出しから出す。",
	choices: [
		{
			id: "B-00",
			label: "祖母の帳面",
			options: [
				{ key: "A", label: "少しだけ、読んでみる" },
				{ key: "B", label: "閉じたままにしておく" },
			],
		},
	],
	lines: [
		{ kind: "narration", bg: "shop_night", text: "入舟銀座の夜は早い。" },
		{ kind: "narration", text: "八時を回れば、通りに残る明かりは、酒屋の自販機と、街灯が三本。アーケードのない商店街の空は素通しで、今夜は雲が低かった。昼のラジオが言っていた。夜から、雪。" },
		{ kind: "narration", text: "その並びの真ん中あたりに、一軒だけ、シャッターが半分で止まっている店がある。" },
		{ kind: "narration", text: "半分だけ下ろしたシャッターの内側で、三隅若菜は、電気も半分だけ点けていた。天井の蛍光灯は消して、作業場の裸電球と、花の冷蔵ケースの白い灯りだけ。ケースの光が土間に長く伸びて、空の花桶の影を、柵みたいに並べている。" },
		{ kind: "narration", text: "奥の水場で、水仙の桶がかすかに鳴っていた。夕方の市場で仕入れた五十本。水は浅く張った。今度は間違えていない。若菜は袖をまくって指を入れ、深さをもう一度確かめた。水は指の第二関節で止まった。よし、と声には出さずに言う。一月の水は、指の骨まで冷える。" },
		{ kind: "narration", text: "店の中は、冬の花屋の匂いがした。水と、切り口の青さと、灯油。息を吐くと、電球の下でだけ白く見えた。" },
		{ kind: "narration", text: "それから若菜は勘定台の前に立ち、いちばん深い引き出しを開けた。" },
		{ kind: "narration", text: "紺の布張りの帳面。角が擦り切れて、下の厚紙が覗いている。よく使われた帳面がそうなるように、小口が波打って、閉じていても膨らんでいる。表紙には何も書いていない。書かなくても、誰の物か分かる人しか、この店には来なかったからだ。" },
		{ kind: "narration", text: "開くと、数字が並んでいた。仕入れの本数、値、売れた数。桁の位置が几帳面に揃っている。ボールペンではなく、鉛筆。ところどころ、数字の列の脇に、それよりずっと小さな字が現れる。日付もなく、前置きもなく、二行か三行。" },
		{ kind: "narration", text: "——と、シャッターが外から、こんこん、と鳴った。" },
		{ kind: "say", speaker: "wakana", emo: 8, text: "はいっ" },
		{ kind: "narration", text: "若菜は紺の帳面を、とっさに引き出しへ戻した。半分のシャッターの下から、長靴と、見慣れた前掛けの裾が覗いている。" },
		{ kind: "say", speaker: "sub", name: "八重", text: "若菜ちゃん、まだいたね。灯り見えたから" },
		{ kind: "say", speaker: "wakana", emo: 10, text: "八重さん。すみません、こんな時間に音を" },
		{ kind: "say", speaker: "sub", name: "八重", text: "音なんか誰も気にしないよ、こんな通りで" },
		{ kind: "narration", text: "腰をかがめて入ってきた八重さんは、新聞紙の包みを勘定台に置いた。包みはずっしりと重く、新聞紙の角に土がついていた。" },
		{ kind: "say", speaker: "sub", name: "八重", text: "大根。余りもん。明日から、だろ" },
		{ kind: "say", speaker: "wakana", emo: 1, text: "はい。六日から、と思って" },
		{ kind: "say", speaker: "sub", name: "八重", text: "初売りにね、常ちゃんはいつも甘酒出してたけど——あんたはやらなくていいからね。あれはあの人の道楽だから" },
		{ kind: "say", speaker: "wakana", emo: 13, text: "甘酒。そうだったんですか" },
		{ kind: "say", speaker: "sub", name: "八重", text: "真似しなくていいって言ってんの" },
		{ kind: "say", speaker: "wakana", emo: 17, text: "……はい" },
		{ kind: "say", speaker: "sub", name: "八重", text: "返事が硬い" },
		{ kind: "say", speaker: "wakana", emo: 3, text: "はい、と言いました" },
		{ kind: "say", speaker: "sub", name: "八重", text: "そこじゃないんだけどね" },
		{ kind: "narration", text: "八重さんは笑って、店の中をぐるりと見た。花桶の影と、水仙の白と、半分の電気。" },
		{ kind: "say", speaker: "sub", name: "八重", text: "水仙、浅いね" },
		{ kind: "say", speaker: "wakana", emo: 4, text: "球根の花なので。深いと、腐ります" },
		{ kind: "say", speaker: "sub", name: "八重", text: "へえ。うちは大根を寝かせるだけだからね" },
		{ kind: "narration", text: "それから何か言いかけて、やめて、別のことを言った。" },
		{ kind: "say", speaker: "sub", name: "八重", text: "困ったら、うち来な。葉物余ってるから" },
		{ kind: "say", speaker: "wakana", emo: 9, text: "はい。……ありがとうございます" },
		{ kind: "narration", text: "長靴の音が遠ざかって、通りがまた静かになった。" },
		{ kind: "narration", text: "若菜は勘定台に戻る。引き出しを開けて、紺の帳面を出し直す。さっき開いた頁が、そのまま開いた。数字の脇の、小さな字。" },
		// ◆選択 B-00「祖母の帳面」(軸: なし)
		{ kind: "narration", when: { choice: "B-00", is: "A" }, text: "若菜は、開いた頁の、いちばん上の行に目を落とした。" },
		{ kind: "narration", when: { choice: "B-00", is: "A" }, text: "「一月四日。晴れ。松三十、千両二十」——数字だった。次の行も、その次も、まずは数字だった。小さな字の書き込みは、数字の隙間にしか、ない。" },
		{ kind: "narration", when: { choice: "B-00", is: "A" }, text: "三行だけ読んで、若菜は帳面を閉じた。" },
		{ kind: "narration", when: { choice: "B-00", is: "A" }, text: "最初から全部読んでしまうのは、違う気がした。この帳面は、たぶん、一年かけて読むものだ。" },
		{ kind: "narration", when: { choice: "B-00", is: "B" }, text: "若菜は、開いた頁を、そのまま静かに閉じた。" },
		{ kind: "narration", when: { choice: "B-00", is: "B" }, text: "読むのは、まだやめておく。" },
		{ kind: "narration", when: { choice: "B-00", is: "B" }, text: "読み始めたら、比べてしまう。比べたら、明日の手が止まる。明日は、手を止めない日だ。" },
		// 【合流】
		{ kind: "narration", text: "灯油ストーブが、こん、と鳴った。若菜は鞄から、夕方の帳面を出した。若草色の、重いほう。勘定台の上で紺と並べると、まだ何も知らない色をしている。" },
		{ kind: "narration", text: "ガラス戸の外で、白いものがひとつ、街灯を横切った。" },
		{ kind: "narration", text: "一頁目を開いて、ボールペンの尻を、こつ、と勘定台に立てた。" },
	],
};

const chomen0105: Vignette = {
	id: "p-00-chomen-0105",
	kind: "chomen",
	month: 0,
	title: "一月五日",
	trigger: { at: "month-open", month: 1 },
	synopsis: "開店前夜の帳面。仕入れと釣り銭を書き並べ、いちばん厚い帳面を買った理由を書く。",
	lines: [
		{ kind: "diary", text: "一月五日。晴れ。夜から雪の予報。" },
		{ kind: "diary", text: "明日、店を開ける。" },
		{ kind: "diary", text: "仕入れ。松三十、千両二十、水仙五十。釣り銭、両替済み。値札、書き直し三枚。" },
		{ kind: "diary", text: "ストーブの灯油、残り半分。" },
		{ kind: "diary", text: "八重さんに大根を貰った。" },
		{ kind: "diary", text: "書いているうちに、降ってきた。" },
		{ kind: "diary", text: "" },
		{ kind: "diary", text: "祖母は初売りに甘酒を出していたらしい。知らないことが、まだ店のあちこちにある。" },
		{ kind: "diary", text: "祖母の帳面を出した。仕入れの数字のあいだに、小さな字で、その日のことが書いてある。" },
		{ kind: "diary", when: { choice: "B-00", is: "A" }, text: "三行だけ読んだ。数字だった。祖母の帳面も、まずは数字なのだった。少し、安心した。" },
		{ kind: "diary", when: { choice: "B-00", is: "B" }, text: "まだ読んでいない。読まないでいられるうちは、読まないでおく。" },
		{ kind: "diary", text: "私は数字だけつけることにする。" },
		{ kind: "diary", text: "……と書くために、いちばん厚い帳面を買った。" },
		{ kind: "diary", text: "もう負けている気がする。" },
	],
};

/** 序章。⚠️並び順が再生順。 */
export const PROLOGUE: readonly Vignette[] = [bunguten, kaitenZenya, chomen0105];
