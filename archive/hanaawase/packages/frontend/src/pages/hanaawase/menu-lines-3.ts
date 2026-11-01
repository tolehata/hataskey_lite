// 花常 メニューセリフ 第三次追加分（150本）。⚠️menu-lines.ts / menu-lines-2.ts は編集せず、こちらに追記する。
// 結合は呼び出し側（menu-dialogue.ts の ALL_MENU_LINES）で行う。
//
// ⚠️face は「実ファイルの枚数」が上限。範囲外を書くと404になる。
//   ⚠️若菜・レンは表情差分の追加作業が進行中でファイルが揃っていないため、face は 1〜6 だけを使う。
//   yae 4 / inukai 4 / tatsumi 3 / gen 3 / naito 3。
//   表情の意味は gallery-data.ts の GALLERY_CHARS[].faces を正とする。
//   wakana: 1澄まし 2にこにこ 3むむっ 4きりっと 5しょんぼり 6きらきら
//   ren:    1通常 2満面の笑み 3照れ 4びっくり 5真顔 6困り笑い
//   yae:    1笑い 2呆れ 3案じ顔 4しみじみ
//   inukai: 1通常 2吠え 3したり顔 4しょげ
//   tatsumi:1大声 2にやり 3真顔
//   gen:    1無表情 2かすかな笑み 3むっつり
//   naito:  1朴訥 2語り 3笑み
//
// ⚠️出演(casting)の制約に噛み合わせること（menu-dialogue.ts castingWeights）。外すと永久に表示されない:
//   yae     … morning / day / evening（night の出演が無い）
//   inukai  … morning のみ
//   tatsumi … morning のみ
//   gen     … evening のみ
//   naito   … 9月・10月のみ（時間帯は不問）
//   wakana / ren … 全時間帯
//
// ⚠️本ファイルの配分方針: 既存333本を実測した結果、night(17) / day(15) / prog(early5 mid8 late10) /
//   11月(6) / 5月(8) / 10月(9) / 4月(9) / 12月(9) が薄かったため、そこを厚くする配分にしてある。
//
// ⚠️感嘆符は快活な人物のみ（BIBLE §1）。若菜・玄・内藤は使わない。八重は通りの向こうからの呼び声だけ。
// ⚠️12月の種明かしに触れない（rare / prog 付きでも同じ）。
// ⚠️方言を混ぜない。⚠️実在の作品名・商品名・商標を出さない。
//
// ⚠️レン(ren)の声（2026-07-27改訂。⚠️**「〜っす」は全廃した**。過去稿を真似ると戻るので注意）:
//   一人称は「俺」。男子大学生の陽気なノリ——テンポがよく、軽口を挟み、自分から話題を振る。
//   若菜・年上には砕けた敬語（「〜ですよ」「〜ますって」「〜でしょ」「〜なんですよね」）、
//   同年代（犬飼・同好会）にはため口、独り言は素の口語。性格は変えない（人懐こい・素直・面倒見がいい・
//   技術の話になると早口）。真顔 face5 のときだけ文を短くする。
//   ⚠️禁止: 「〜っす／っすよ／っすか／っすね」「〜んすよ／んすけど」「〜いすか」、
//   流行語・若者言葉（「マジ」「ヤバい」「めっちゃ」「〜的な」）。⚠️声の正本は HANATSUNE-BIBLE.md §5。

import type { MenuLine } from "./menu-lines.js";

export const MENU_LINES_3: MenuLine[] = [
	// ================================ 若菜 34本 ================================
	// 薄かった night(8) / day(6) を厚めに。prog は8本。感嘆符ゼロ。
	{ char:"wakana", t:"戸締まりの順は、奥から表へ。祖母の順のまま。", time:"night", month:"any", face:1 },
	{ char:"wakana", t:"売上より先に、名前の並びを見るようになった。", time:"night", month:"any", face:4, prog:"late" },
	{ char:"wakana", t:"霜月の夜は、店を閉めても指の先が冷えたまま。", time:"night", month:[11], face:5 },
	{ char:"wakana", t:"計算が合わない。三度目で、桁を落としていたと気づく。", time:"night", month:"any", face:3 },
	{ char:"wakana", t:"母の日が終わると、二階へ上がる足がやけに重い。", time:"night", month:[5], face:5 },
	{ char:"wakana", t:"灯りを消す前の一瞬だけ、店が知らない場所に見える。", time:"night", month:"any", face:6, rare:true },
	{ char:"wakana", t:"大晦日までの段取りを、寝る前に三度は繰り返す。", time:"night", month:[12], face:4 },
	{ char:"wakana", t:"一日ぶんの水音が、耳の奥にまだ残っている。", time:"night", month:"any", face:2, prog:"mid" },
	{ char:"wakana", t:"昼の客は、買うものを決めてから入ってくる。", time:"day", month:"any", face:1 },
	{ char:"wakana", t:"白い菊は、光を吸わずに返す。見ていて飽きない。", time:"day", month:[10], face:6 },
	{ char:"wakana", t:"包み方を聞かれて、答えに詰まった。手は動くのに。", time:"day", month:"any", face:3, prog:"early" },
	{ char:"wakana", t:"鉢物は土の重さを先に伝える。持ち帰る人の腕のために。", time:"day", month:[4], face:4 },
	{ char:"wakana", t:"常連の顔より先に、註文の癖を覚えてしまう。", time:"day", month:"any", face:2 },
	{ char:"wakana", t:"髪飾りを選ぶ親子は、たいてい三人で入ってくる。", time:"day", month:[11], face:1 },
	{ char:"wakana", t:"閉店の札を裏返す手が、日によって速い。", time:"evening", month:"any", face:5 },
	{ char:"wakana", t:"赤ばかり見た日は、緑が目に沁みる。", time:"evening", month:[5], face:2, prog:"mid" },
	{ char:"wakana", t:"落ちた葉を集めると、桶ひとつぶんになる。", time:"evening", month:"any", face:4 },
	{ char:"wakana", t:"梱包の針金で指を切った。絆創膏はもう三枚目。", time:"evening", month:[12], face:3 },
	{ char:"wakana", t:"西日が水面に当たると、桶の底まで見える。", time:"evening", month:"any", face:6, rare:true },
	{ char:"wakana", t:"戸の建て付けが悪い。押しながら引くと、うまく開く。", time:"morning", month:"any", face:1 },
	{ char:"wakana", t:"菊を下ろす日は、荷台に新聞を厚く敷いておく。", time:"morning", month:[10], face:4 },
	{ char:"wakana", t:"起きる時間には慣れた。起きたあとの段取りが、まだ。", time:"morning", month:"any", face:3, prog:"early" },
	{ char:"wakana", t:"四月の通りは、知らない顔が急に増える。", time:"morning", month:[4], face:2 },
	{ char:"wakana", t:"霜が降りた朝は、表の桶を先に見に行く。", time:"morning", month:[11], face:5 },
	{ char:"wakana", t:"註文の電話を受けながら、手が勝手に紙を裁っている。", time:"any", month:"any", face:4, prog:"mid" },
	{ char:"wakana", t:"蝋梅と梅は、香りで見分ける。目では紛らわしい。", time:"any", month:[2], face:1 },
	{ char:"wakana", t:"祖母の前掛けは、洗わずに畳んだままにしてある。", time:"any", month:"any", face:5, rare:true },
	{ char:"wakana", t:"五月は、赤の濃さを三段階に分けて仕入れる。", time:"any", month:[5], face:4 },
	{ char:"wakana", t:"花首を揃えて並べると、通りから足が止まる。", time:"any", month:[10], face:2 },
	{ char:"wakana", t:"小さい髪飾りほど、仕上げに時間がかかる。", time:"any", month:[11], face:3 },
	{ char:"wakana", t:"正月の荷が入ると、店が一度だけ広く見える。", time:"any", month:[12], face:6 },
	{ char:"wakana", t:"断ることが、少しだけ上手くなった気がする。", time:"any", month:"any", face:3, prog:"late" },
	{ char:"wakana", t:"盆のあいだは水を二度替える。それだけで保ちが違う。", time:"any", month:[8], face:1 },
	{ char:"wakana", t:"註文票の裏に、客の好みを書き足す癖がついた。", time:"any", month:"any", face:2, prog:"late" },

	// ================================ レン 30本 ================================
	// night(8) を最多に。⚠️face5(真顔)の行は必ず短文（BIBLE §5）。face6 は既存で30本と多いので抑える。
	{ char:"ren", t:"終電はまだありますよ。心配しないでください。", time:"night", month:"any", face:1 },
	{ char:"ren", t:"……戸締まり、見てきます。", time:"night", month:"any", face:5 },
	{ char:"ren", t:"夜通しやる市があるって、噂でしか聞いたことがなかったんですよ。", time:"night", month:[12], face:4 },
	{ char:"ren", t:"この時間の通り、うちの町より静かなんですよね。向こうは山なのに、おかしな話で。", time:"night", month:"any", face:3, prog:"mid" },
	{ char:"ren", t:"送り火、坂の上からも見えるんですよ。今年はちゃんと間に合いました。", time:"night", month:[8], face:1 },
	{ char:"ren", t:"遅くなったぶん、明日の朝の水やりは俺がやりますよ。", time:"night", month:"any", face:2 },
	{ char:"ren", t:"夜の坂、落ち葉でよく滑るんですよ。二回ほど派手に転びかけました。", time:"night", month:[11], face:6 },
	{ char:"ren", t:"……もう少しだけ、いてもいいですか。", time:"night", month:"any", face:5, prog:"late", rare:true },
	{ char:"ren", t:"後期の試験、来週からなんです。花のほうがよほど頭に入るのに。", time:"day", month:[1], face:6 },
	{ char:"ren", t:"五月の配達、行き先が同じ方角にまとまってて助かります。", time:"day", month:[5], face:2 },
	{ char:"ren", t:"レジの音、小さくしておきました。前のは毎回びくっとするんで。", time:"day", month:"any", face:4 },
	{ char:"ren", t:"十月の午後って、影が急に長くなりますよね。", time:"day", month:[10], face:1 },
	{ char:"ren", t:"昼に店番してると、思ったより話しかけられるんですよね。", time:"day", month:"any", face:3 },
	{ char:"ren", t:"帰りに寄っただけですよ。……まあ、手は空いてますけど。", time:"evening", month:"any", face:2 },
	{ char:"ren", t:"花見帰りの人が、そのまま店に入ってくるんですね。", time:"evening", month:[4], face:1 },
	{ char:"ren", t:"掃き掃除、なぜか俺のほうが遅いんですよ。腕は長いはずなのに。", time:"evening", month:"any", face:6 },
	{ char:"ren", t:"窓辺に一本置くと、部屋の空気が変わるんですよね。不思議なもので。", time:"evening", month:[11], face:3, prog:"mid" },
	{ char:"ren", t:"届け先で訊かれた花の名前、今日はすらすら出ました。", time:"evening", month:"any", face:4, prog:"late" },
	{ char:"ren", t:"朝いちの荷下ろしは、握力から先に消えていくんですよ。", time:"morning", month:"any", face:6 },
	{ char:"ren", t:"卒業の朝は、市場の駐車場まで埋まってました!", time:"morning", month:[3], face:4 },
	{ char:"ren", t:"始発の車内で花の匂いをさせてるの、たぶん俺だけです。", time:"morning", month:"any", face:1 },
	{ char:"ren", t:"松の荷、犬飼さんが荷台まで運んでくれました。これで貸し一つですね。", time:"morning", month:[12], face:2 },
	{ char:"ren", t:"この尻尾、乾かすと倍に膨らむんです。言っても誰も信じてくれなくて。", time:"any", month:"any", face:3 },
	{ char:"ren", t:"重いほうは俺が持つんで、軽いほうをお願いします。", time:"any", month:"any", face:1 },
	{ char:"ren", t:"同好会の連中、俺がここで働いてると思ってます。違うんですけどね。", time:"any", month:"any", face:6 },
	{ char:"ren", t:"六月生まれなんで、誕生日はいつも雨模様です。それにも慣れました。", time:"any", month:[6], face:3 },
	{ char:"ren", t:"領収書の判子、押す場所でいつも迷うんですよ。", time:"any", month:"any", face:4 },
	{ char:"ren", t:"この店の段取り、今なら人に説明できます。", time:"any", month:"any", face:2, prog:"late" },
	{ char:"ren", t:"……邪魔だったら言ってください。", time:"any", month:"any", face:5, prog:"early" },
	{ char:"ren", t:"彼岸の荷は量が読めないんですよね。多めに積んでおきます。", time:"any", month:[9], face:1 },

	// ================================ 八重 20本 ================================
	// ⚠️night は書かない（出演が無い）。感嘆符は呼び声1本だけ。
	{ char:"yae", t:"昼を抜くと、夕方に効いてくるのよ。私が言うんだから間違いないの。", time:"day", month:"any", face:3 },
	{ char:"yae", t:"母の日はね、うちの前まで行列がはみ出してくるの。", time:"day", month:[5], face:2 },
	{ char:"yae", t:"節分が過ぎるとね、日が伸びるのが分かるのよ。", time:"day", month:[2], face:1 },
	{ char:"yae", t:"菊の匂いがすると、ああ秋だと思うのよ。毎年ね。", time:"day", month:[10], face:4 },
	{ char:"yae", t:"近ごろ、あんたに用のある人が増えたわねえ。", time:"day", month:"any", face:4, prog:"mid" },
	{ char:"yae", t:"うちはもう仕舞うわ。表の電気だけ点けとくからね。", time:"evening", month:"any", face:1 },
	{ char:"yae", t:"日が落ちるのが早いこと。坂を下りる子は帰したの。", time:"evening", month:[11], face:3 },
	{ char:"yae", t:"この時間の通りの音はね、四十年変わらないのよ。", time:"evening", month:"any", face:4, rare:true },
	{ char:"yae", t:"花見の帰りに寄る人がいるでしょう。うちにも寄ってほしいものだわ。", time:"evening", month:[4], face:2 },
	{ char:"yae", t:"若菜ちゃん、シャッター! 上げといたからね!", time:"morning", month:"any", face:1 },
	{ char:"yae", t:"年の瀬の朝はね、うちも六時じゃ間に合わないの。", time:"morning", month:[12], face:2 },
	{ char:"yae", t:"早い時間はね、店の人しか歩いていないのよ。", time:"morning", month:"any", face:4 },
	{ char:"yae", t:"この時季、あんたの店の灯りが誰より早いのよ。", time:"morning", month:[3], face:3 },
	{ char:"yae", t:"初詣の帰りの人が、まだ通るのよ。松の内のあいだはね。", time:"any", month:[1], face:1 },
	{ char:"yae", t:"うちの台に並べてもいいのよ。花のひとつやふたつ。", time:"any", month:"any", face:1, prog:"early" },
	{ char:"yae", t:"彼岸はね、うちも供物で棚が埋まってしまうの。", time:"any", month:[9], face:3 },
	{ char:"yae", t:"常ちゃんはね、水仕事の手をしていたわ。あんたと同じ。", time:"any", month:"any", face:4 },
	{ char:"yae", t:"西瓜は切って出すのが早いの。丸のままじゃ誰も持てないわ。", time:"any", month:[7], face:1 },
	{ char:"yae", t:"柿はね、渋いのを見分けるのが商売なの。花より難しいわよ。", time:"any", month:[11], face:2 },
	{ char:"yae", t:"この通りに、あんたの店があるのが当たり前になったわね。", time:"any", month:"any", face:4, prog:"late" },

	// ================================ 犬飼 16本 ================================
	// ⚠️出演は morning のみ。感嘆符可。
	{ char:"inukai", t:"こっち来て! いいのが一箱だけ残ってる!", time:"morning", month:"any", face:2 },
	{ char:"inukai", t:"今朝は霧が濃くてな。場内の端まで見えねえよ。", time:"morning", month:"any", face:1 },
	{ char:"inukai", t:"母の日の週は、うちは寝袋持ち込みだ! 冗談じゃなくな!", time:"morning", month:[5], face:2 },
	{ char:"inukai", t:"枝ものの季節だ。持ち方を覚えりゃ、腰は痛めねえよ。", time:"morning", month:[11], face:3 },
	{ char:"inukai", t:"内藤さんとこのは、箱を開けた瞬間に分かるんだよな。", time:"morning", month:[10], face:1 },
	{ char:"inukai", t:"そんな端から見てても、いいのは残らねえぞ。", time:"morning", month:"any", face:4, prog:"early" },
	{ char:"inukai", t:"犬扱いすんなって言ったろ! ……ま、慣れたけどよ。", time:"any", month:"any", face:2 },
	{ char:"inukai", t:"箱の底に保冷剤、入れといたから。言わなくても分かるだろ。", time:"any", month:"any", face:1 },
	{ char:"inukai", t:"目利きは鼻じゃなくて手だよ。触りゃ水の上がりが分かる。", time:"any", month:"any", face:3 },
	{ char:"inukai", t:"年末は寝る暇ねえけど、稼ぎ時だからな! 文句は言わねえ!", time:"any", month:[12], face:2 },
	{ char:"inukai", t:"四月は新しい顔が増えるよ。うちの若えのも入ったしな。", time:"any", month:[4], face:1 },
	{ char:"inukai", t:"この前の荷、揃いが悪かったろ。あれは俺の目が曇ってた。", time:"any", month:"any", face:4 },
	{ char:"inukai", t:"七五三の頃はな、切り花より鉢が動くんだ。意外だろ。", time:"any", month:[11], face:1 },
	{ char:"inukai", t:"最近、若菜さんが選んだ箱に俺が納得してんだよな。", time:"any", month:"any", face:3, prog:"mid" },
	{ char:"inukai", t:"母の日の翌日は、市場が嘘みたいに静かになるんだ。", time:"any", month:[5], face:4 },
	{ char:"inukai", t:"もう俺の出る幕じゃねえな。……ちょっと寂しいけどよ。", time:"any", month:"any", face:2, prog:"late" },

	// ================================ 辰巳 16本 ================================
	// ⚠️出演は morning のみ。売り声＝感嘆符が人物そのもの（BIBLE §1 適用範囲1）。
	{ char:"tatsumi", t:"手ぇ挙げるなら迷うな! 迷った札は通らねえぞ!", time:"morning", month:"any", face:1 },
	{ char:"tatsumi", t:"後ろがつかえてんだ! 決めるか下がるかしろ!", time:"morning", month:"any", face:1 },
	{ char:"tatsumi", t:"菊の山だぞ! 今日は端から端まで菊だ!", time:"morning", month:[10], face:1 },
	{ char:"tatsumi", t:"松だ松だ! 一年でいちばん値が動く日だぞ!", time:"morning", month:[12], face:1 },
	{ char:"tatsumi", t:"その顔、いいのを見つけたな。隠しても分かるぞ。", time:"morning", month:"any", face:2 },
	{ char:"tatsumi", t:"母の日の前は数で勝負だ! 迷ってる暇はねえ!", time:"morning", month:[5], face:1 },
	{ char:"tatsumi", t:"取れなくていい。今日は見てるだけでも来い。", time:"morning", month:"any", face:3, prog:"early" },
	{ char:"tatsumi", t:"値がつくのは花じゃねえ。花を見る目のほうだ。", time:"any", month:"any", face:3 },
	{ char:"tatsumi", t:"常サンは、俺の声を一度もうるさいと言わなかったな。", time:"any", month:"any", face:2 },
	{ char:"tatsumi", t:"春の荷は化けるぞ。日持ちを頭に入れて買え。", time:"any", month:[4], face:3 },
	{ char:"tatsumi", t:"早く来た者が損したためしはねえ! 覚えとけ!", time:"any", month:"any", face:1 },
	{ char:"tatsumi", t:"枝ものは重さで選べ。目より腕のほうが正直だ。", time:"any", month:[11], face:2 },
	{ char:"tatsumi", t:"手の上がり方が変わったな。誰も教えてねえのに。", time:"any", month:"any", face:3, prog:"mid" },
	{ char:"tatsumi", t:"盆の菊は数がものを言う! 半端に買うんじゃねえ!", time:"any", month:[8], face:1 },
	{ char:"tatsumi", t:"常サンの席は、まだ誰も座らねえよ。", time:"any", month:"any", face:2, rare:true },
	{ char:"tatsumi", t:"菊は箱で決まる。開けてから泣くやつが毎年いる。", time:"any", month:[10], face:3 },

	// ================================ 玄 16本 ================================
	// ⚠️出演は evening のみ。ほぼ喋らない人物なので断片で置く。感嘆符は使わない。
	{ char:"gen", t:"……閉めるのは、まだ先だ。", time:"evening", month:"any", face:1 },
	{ char:"gen", t:"客が二人。今日は多いほうだ。", time:"evening", month:"any", face:3 },
	{ char:"gen", t:"……日が短い。早く帰れ。", time:"evening", month:[11], face:1 },
	{ char:"gen", t:"その包み、器用になったな。", time:"evening", month:"any", face:2 },
	{ char:"gen", t:"……座る時間くらい、ある。", time:"evening", month:[5], face:1 },
	{ char:"gen", t:"顔つきが、疲れてる。", time:"evening", month:"any", face:3, prog:"mid" },
	{ char:"gen", t:"……深煎りにした。今日は。", time:"any", month:[1,2], face:1 },
	{ char:"gen", t:"掃除は、店より先に手だ。", time:"any", month:"any", face:3 },
	{ char:"gen", t:"……いい匂いを持ってきたな。", time:"any", month:"any", face:2 },
	{ char:"gen", t:"菊の頃だ。……早いな。", time:"any", month:[10], face:1 },
	{ char:"gen", t:"湯冷ましも、置いてある。", time:"any", month:"any", face:1 },
	{ char:"gen", t:"……釣りは、取っとけ。", time:"any", month:"any", face:3 },
	{ char:"gen", t:"花見には、行かん。", time:"any", month:[4], face:2 },
	{ char:"gen", t:"皿は、そのままでいい。", time:"any", month:"any", face:1 },
	{ char:"gen", t:"……頼めるようになったな。", time:"any", month:"any", face:2, prog:"late" },
	{ char:"gen", t:"碁笥だけ、拭いてある。", time:"any", month:"any", face:3, rare:true },

	// ================================ 内藤 18本 ================================
	// ⚠️出演は9月・10月のみ（時間帯は不問）。感嘆符は使わない。方言を混ぜない。
	{ char:"naito", t:"朝の見回りは、露で足が濡れる。長靴が要る。", time:"morning", month:"any", face:1 },
	{ char:"naito", t:"昼はな、畑がいちばん静かだ。人も花も休んどる。", time:"day", month:"any", face:2 },
	{ char:"naito", t:"日が落ちる前に、明かりの点検をひと通り。", time:"evening", month:[10], face:1 },
	{ char:"naito", t:"この時間は、畑のほうが明るいくらいでな。", time:"night", month:"any", face:2 },
	{ char:"naito", t:"息子は工場へ勤めに出た。それでいいと思っとる。", time:"any", month:"any", face:3 },
	{ char:"naito", t:"土は正直でな。前の年の手入れが、そのまま出る。", time:"any", month:"any", face:1 },
	{ char:"naito", t:"鋏は年に二度研ぐ。研ぎ屋がもう一軒しかない。", time:"any", month:"any", face:1 },
	{ char:"naito", t:"彼岸の前は、三時から切りはじめる。それでも足りん。", time:"any", month:[9], face:2 },
	{ char:"naito", t:"嵐のあとは、倒れた列から起こしていく。一本ずつな。", time:"any", month:[9], face:1 },
	{ char:"naito", t:"十月の菊は、切ったあとの匂いが濃い。", time:"any", month:[10], face:3 },
	{ char:"naito", t:"うちのは市場より先に近所へ回る。昔からの決まりでな。", time:"any", month:[10], face:1 },
	{ char:"naito", t:"花の話を長くしても、嫌な顔をせんな、あんたは。", time:"any", month:"any", face:2, prog:"mid" },
	{ char:"naito", t:"電球はな、一つ切れると列ごと暗くなる。すぐ替える。", time:"any", month:"any", face:1 },
	{ char:"naito", t:"若い者が畑へ来ると、こっちが余計に喋ってしまう。", time:"any", month:"any", face:3 },
	{ char:"naito", t:"運ぶときは寝かせる。立てると首が疲れるでな。", time:"any", month:"any", face:1 },
	{ char:"naito", t:"常さんは、明かりの下で長いこと立っていた。", time:"any", month:"any", face:2, rare:true },
	{ char:"naito", t:"急がんでいい。菊は待ってくれる花だ。", time:"any", month:"any", face:1, prog:"early" },
	{ char:"naito", t:"あんたの束ね方は、もう人に見せられる。", time:"any", month:"any", face:3, prog:"late" },
];
