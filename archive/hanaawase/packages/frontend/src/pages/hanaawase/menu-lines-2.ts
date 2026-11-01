// 花常 メニューセリフ 第二次追加分（200本）。⚠️menu-lines.ts は編集せず、こちらに追記する。
// 結合は呼び出し側で行う（MENU_LINES.concat(MENU_LINES_2) 等）。
//
// ⚠️face は「実ファイルの枚数」が上限。assets/hanaawase/chara/<id>/face_N.webp を実測した結果:
//   wakana 6 / ren 6 / yae 4 / inukai 4 / naito 3 / tatsumi 3 / gen 3
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
// ⚠️感嘆符は快活な人物のみ（BIBLE §1）。若菜・玄・内藤は使わない。八重は通りの向こうからの呼び声だけ。
// ⚠️12月の種明かしに触れない（rare / prog 付きでも同じ）。
// ⚠️方言を混ぜない。
//
// ⚠️レン(ren)の声（2026-07-27改訂。⚠️**「〜っす」は全廃した**。過去稿を真似ると戻るので注意）:
//   一人称は「俺」。男子大学生の陽気なノリ——テンポがよく、軽口を挟み、自分から話題を振る。
//   若菜・年上には砕けた敬語（「〜ですよ」「〜ますって」「〜でしょ」「〜なんですよね」）、
//   同年代（犬飼・同好会）にはため口、独り言は素の口語。性格は変えない（人懐こい・素直・面倒見がいい・
//   技術の話になると早口）。真顔 face5 のときだけ文を短くする。
//   ⚠️禁止: 「〜っす／っすよ／っすか／っすね」「〜んすよ／んすけど」「〜いすか」、
//   流行語・若者言葉（「マジ」「ヤバい」「めっちゃ」「〜的な」）。⚠️声の正本は HANATSUNE-BIBLE.md §5。

import type { MenuLine } from "./menu-lines.js";

export const MENU_LINES_2: MenuLine[] = [
	// ================================ 若菜 28本 ================================
	// 店の物理・道具・前職との差。感嘆符ゼロ。face6(きらきら)は既存で未使用のため1本だけ置く。
	{ char:"wakana", t:"冷蔵ケースの音が、夜だけ大きく聞こえる。", time:"night", month:"any", face:1 },
	{ char:"wakana", t:"階段が急で、荷を持って上がると必ず一度止まる。", time:"night", month:"any", face:3 },
	{ char:"wakana", t:"二階の窓は、通りの端まで見える。閉める前に、一度だけ開ける。", time:"night", month:"any", face:5, rare:true },
	{ char:"wakana", t:"送り火の夜は早く閉めていいと、祖母の帳面にある。", time:"night", month:[8], face:5 },
	{ char:"wakana", t:"表の看板を裏返すのを、今日は忘れなかった。", time:"morning", month:"any", face:2 },
	{ char:"wakana", t:"軽トラの荷台、まだ祖母の積み方を真似ている。", time:"morning", month:"any", face:4 },
	{ char:"wakana", t:"辰巳さんは教えてくれない。見ているだけ。それが教えなのだと思う。", time:"morning", month:"any", face:3 },
	{ char:"wakana", t:"手が冷たいと花は長く保つ。人には向かない仕事だ。", time:"morning", month:[1,2], face:1 },
	{ char:"wakana", t:"値札の字は、太いほうがよく売れるらしい。試している。", time:"day", month:"any", face:4 },
	{ char:"wakana", t:"客が帰ったあとの、床の水の跡を拭く。", time:"day", month:"any", face:1 },
	{ char:"wakana", t:"電話が鳴りやまない日は、声のほうが先に潰れる。", time:"day", month:[5], face:3 },
	{ char:"wakana", t:"お礼を言われる回数だけは、前の店より多い。", time:"evening", month:"any", face:2 },
	{ char:"wakana", t:"夕方の光が、勘定台の角だけ白くする。", time:"evening", month:"any", face:1 },
	{ char:"wakana", t:"くろまつの隣の席は、いつも空いている。", time:"evening", month:"any", face:5 },
	{ char:"wakana", t:"前の店では、花に名前で呼びかけたりしなかった。", time:"any", month:"any", face:3 },
	{ char:"wakana", t:"型どおりに束ねると、型どおりの顔で買われていく。", time:"any", month:"any", face:3 },
	{ char:"wakana", t:"包み紙が残り少ない。同じ柄は、もう作られていない。", time:"any", month:"any", face:5 },
	{ char:"wakana", t:"八重さんは、私が断るまで置いていく。", time:"any", month:"any", face:2 },
	{ char:"wakana", t:"祖母の字は、急いだ日ほど大きい。", time:"any", month:"any", face:1, rare:true },
	{ char:"wakana", t:"成人の日の花は、写真に写る前提で作る。", time:"any", month:[1], face:4 },
	{ char:"wakana", t:"枝ぶりのいいのが一本だけ入った。今日はもう、それでいい。", time:"any", month:[2], face:6 },
	{ char:"wakana", t:"桃の枝は、まっすぐ立たない。立たせようともしない。", time:"any", month:[3], face:4 },
	{ char:"wakana", t:"入学の鉢は、置き場所を先に聞く。", time:"any", month:[4], face:4 },
	{ char:"wakana", t:"トタンの庇は、雨の音を丸くする。", time:"any", month:[6], face:1 },
	{ char:"wakana", t:"七夕の笹は、売れるより先に飾られていく。", time:"any", month:[7], face:1 },
	{ char:"wakana", t:"台風の前の日は、花より縄を買いに行く。", time:"any", month:[9], face:4 },
	{ char:"wakana", t:"七五三の髪飾りは、注文の半分が当日になる。", time:"any", month:[11], face:3 },
	{ char:"wakana", t:"松の値をつけるのが、いちばん怖い。", time:"any", month:[12], face:5 },

	// ================================ レン 30本 ================================
	// 身体（耳・尻尾）／大学／機械／他キャラとの関係。⚠️face5(真顔)は必ず短文（BIBLE §5）。
	{ char:"ren", t:"堂本さんから電話が来ました。サーバーが落ちたとかで。……俺のせいじゃない、はずです。", time:"any", month:"any", face:6 },
	{ char:"ren", t:"同好会の部室、窓がないんですよ。花を置いても育たないんで諦めました。", time:"any", month:"any", face:6 },
	{ char:"ren", t:"レジの中、埃がひどかったんで。掃除しておきましたよ!", time:"any", month:"any", face:2 },
	{ char:"ren", t:"注文フォーム、また手を入れました。今度は電話番号も拾えますよ。", time:"any", month:"any", face:4 },
	{ char:"ren", t:"尻尾、店が狭いとどうしてもぶつけるんですよ。すみません。", time:"any", month:"any", face:6 },
	{ char:"ren", t:"耳、風の向きで勝手に動くんですよね。自分では止められないんです。", time:"any", month:"any", face:3 },
	{ char:"ren", t:"犬飼さん、階段だけは敵わないって言ってました。本人には内緒でお願いします。", time:"any", month:"any", face:2 },
	{ char:"ren", t:"八重さんにまた野菜をもらいました。俺、どうにも断れなくて。", time:"any", month:"any", face:6 },
	{ char:"ren", t:"麦茶の瓶、洗って残してあります。花を挿すのにちょうどいいと聞いたんで。", time:"any", month:"any", face:1 },
	{ char:"ren", t:"水切りって、水の中で切るんですね。最初はまるで飲み込めませんでした。", time:"any", month:"any", face:3 },
	{ char:"ren", t:"包み紙の角を合わせるところだけで、十回はやり直しました。", time:"any", month:"any", face:6 },
	{ char:"ren", t:"この店の配線、そこそこ古いですね。今度まとめて見ておきます。", time:"any", month:"any", face:4 },
	{ char:"ren", t:"母に花の名前を聞かれて、全部答えられました。自分でも驚きましたよ!", time:"any", month:"any", face:4, rare:true },
	{ char:"ren", t:"辰巳さんの声、市場の端まで届くんですよ。あれは物理的におかしい!", time:"morning", month:"any", face:4 },
	{ char:"ren", t:"朝の市場、まず氷の匂いがするんですよ。花より先にそっちが来ます。", time:"morning", month:"any", face:1 },
	{ char:"ren", t:"始発、乗ってる人がみんな寝てます。まあ、俺も寝てますけど。", time:"morning", month:"any", face:6 },
	{ char:"ren", t:"あの坂、自転車で下るとブレーキが焼けるんですよ。歩いたほうが早いくらいで。", time:"day", month:"any", face:6 },
	{ char:"ren", t:"講義は前の席に座るようにしてます。後ろだと耳が余計なものまで拾うんで。", time:"day", month:"any", face:6 },
	{ char:"ren", t:"くろまつの珈琲、苦いのに後から甘いんですよね。あれ、どうなってるんだろう。", time:"evening", month:"any", face:3 },
	{ char:"ren", t:"配達、全部終わりました。判子もきっちりもらってきましたよ。", time:"evening", month:"any", face:2 },
	{ char:"ren", t:"店の灯りを落とすの、いつも若菜さんですよね。俺がやりましょうか。", time:"night", month:"any", face:1 },
	{ char:"ren", t:"課題、あと一つです。……いや、三つでした。", time:"night", month:"any", face:6 },
	{ char:"ren", t:"正月は実家に帰りませんでした。松の配達が立て込んでたんで。", time:"any", month:[1], face:1 },
	{ char:"ren", t:"節分の豆を部室で撒いたら、片付けで半日つぶれました。", time:"any", month:[2], face:6 },
	{ char:"ren", t:"新歓の花、去年は誰も買わなかったんですよ。今年は俺が買います。", time:"any", month:[4], face:2 },
	{ char:"ren", t:"母の日の配達、坂を三往復しました。足がもう笑ってます。", time:"any", month:[5], face:6 },
	{ char:"ren", t:"雨の日、耳が濡れると重たいんですよ。じわじわ効いてきます。", time:"any", month:[6], face:6 },
	{ char:"ren", t:"笹を担いで歩くと、完全に不審者ですよ。危うく声をかけられるところでした。", time:"any", month:[7], face:6 },
	{ char:"ren", t:"仏花の新聞、斜めに巻くやつ、やっと手が覚えました!", time:"any", month:[8], face:2, prog:"late" },
	{ char:"ren", t:"野分が来るらしいですね。……店、見に寄ります。", time:"any", month:[9], face:5, prog:"mid" },

	// ================================ 八重 34本 ================================
	// ⚠️出演は morning/day/evening のみ（night は書かない）。感嘆符は呼び声1本だけ。
	{ char:"yae", t:"また前掛けが濡れてるよ。乾いたのに替えてきなさい。", time:"any", month:"any", face:3 },
	{ char:"yae", t:"うちの人参、形は悪いけど味は請け合うからね。", time:"any", month:"any", face:1 },
	{ char:"yae", t:"林檎はね、花のそばに置いちゃ駄目。あんたに教わったんだけどね。", time:"any", month:"any", face:2 },
	{ char:"yae", t:"常ちゃんはね、負けるまで碁をやめない人だったよ。", time:"any", month:"any", face:4 },
	{ char:"yae", t:"あんたの店の前だけ、通りが濡れてるの。水を使う商売だねえ。", time:"any", month:"any", face:4 },
	{ char:"yae", t:"無理して笑わなくていいのよ。私は隣にいるだけだからね。", time:"any", month:"any", face:3, prog:"early" },
	{ char:"yae", t:"お客さんの顔を、一年で覚えたねえ。大したもんだよ。", time:"any", month:"any", face:4, prog:"late" },
	{ char:"yae", t:"常ちゃんとね、一度だけ本気で喧嘩したの。何でだったかしらねえ。", time:"any", month:"any", face:4, rare:true },
	{ char:"yae", t:"この通りの店はね、閉めるとき誰にも言わないのよ。", time:"any", month:"any", face:4, rare:true },
	{ char:"yae", t:"若菜ちゃん、荷! そこ置いとくからね!", time:"morning", month:"any", face:1 },
	{ char:"yae", t:"朝はね、大根から並べるの。決めてるのよ。", time:"morning", month:"any", face:1 },
	{ char:"yae", t:"うちは六時、あんたは五時半。うちのほうが楽だわ。", time:"morning", month:"any", face:2 },
	{ char:"yae", t:"昼はうちも暇なの。だから見てるのよ、あんたの店を。", time:"day", month:"any", face:1 },
	{ char:"yae", t:"お昼、食べた? 食べてないでしょう。", time:"day", month:"any", face:3 },
	{ char:"yae", t:"店番、代わってあげようか。……冗談よ。", time:"day", month:"any", face:2 },
	{ char:"yae", t:"そろそろ表の桶、しまう時間じゃないの。", time:"evening", month:"any", face:3 },
	{ char:"yae", t:"売れ残りはうちも同じ。恥ずかしいもんじゃないよ。", time:"evening", month:"any", face:4 },
	{ char:"yae", t:"灯りが点いてると、通りが違って見えるねえ。", time:"evening", month:"any", face:4 },
	{ char:"yae", t:"帰りに寄って。芋、蒸かしすぎちゃったの。", time:"evening", month:"any", face:1 },
	{ char:"yae", t:"初売りの餅、うちの分も持ってっていいからね。", time:"any", month:[1], face:1 },
	{ char:"yae", t:"七草はね、うちで買いなさい。安くしとくから。", time:"any", month:[1], face:2 },
	{ char:"yae", t:"節分の豆、まだ残ってるのよ。誰か撒いてくれないかしらね。", time:"any", month:[2], face:2 },
	{ char:"yae", t:"梅が出はじめたのね。通りの匂いで分かるわ。", time:"any", month:[2], face:4 },
	{ char:"yae", t:"卒業の子が、うちで蜜柑を買っていったよ。花のついでにね。", time:"any", month:[3], face:1 },
	{ char:"yae", t:"新入生が通るようになったねえ。荷物が大きいからすぐ分かる。", time:"any", month:[4], face:1 },
	{ char:"yae", t:"筍、いる? 皮ごと持ってくと台所が大変よ。", time:"any", month:[4], face:1 },
	{ char:"yae", t:"母の日の三日前は、あんたの顔を見ないようにしてるの。", time:"any", month:[5], face:2 },
	{ char:"yae", t:"雨が続くと、うちの葉物がすぐ駄目になるの。", time:"any", month:[6], face:3 },
	{ char:"yae", t:"傘、貸すよ。返さなくていいから。", time:"any", month:[6], face:1 },
	{ char:"yae", t:"冷やし飴、作りすぎたのよ。表に置いとくわね。", time:"any", month:[7], face:1 },
	{ char:"yae", t:"盆の三日は、うちも休まないの。あんたと同じ。", time:"any", month:[8], face:4 },
	{ char:"yae", t:"台風の前はね、うちは早じまい。あんたも無理しないの。", time:"any", month:[9], face:3 },
	{ char:"yae", t:"柚子はね、香りが落ちる前に使いなさい。", time:"any", month:[11,12], face:1 },
	{ char:"yae", t:"年の瀬はね、この通りが一年でいちばん明るいの。", time:"evening", month:[12], face:4 },

	// ================================ 犬飼 30本 ================================
	// ⚠️出演は morning のみ。感嘆符可。柴犬・仲卸・レンとの掛け合い。
	{ char:"inukai", t:"その箱、俺が積むよ。若菜さん、腰やるって!", time:"morning", month:"any", face:2 },
	{ char:"inukai", t:"今日の入りは上々。ま、俺が選んだからな。", time:"morning", month:"any", face:3 },
	{ char:"inukai", t:"早いな! もう来てんのか!", time:"morning", month:"any", face:2 },
	{ char:"inukai", t:"うちの店とは、親父の代からの付き合いなんだってさ。", time:"any", month:"any", face:1 },
	{ char:"inukai", t:"枝ものはな、根元を見りゃ分かる。辰巳さんに叩き込まれた。", time:"any", month:"any", face:3 },
	{ char:"inukai", t:"常さんには、ずいぶん怒られたよ。荷の積み方でな。", time:"any", month:"any", face:4 },
	{ char:"inukai", t:"尻尾は関係ねえだろ、仕入れの腕に。", time:"any", month:"any", face:2 },
	{ char:"inukai", t:"鼻がいいから値の付く前に分かんの。……嘘だけど。", time:"any", month:"any", face:3 },
	{ char:"inukai", t:"レンのやつ、荷の持ち方だけは上手くなったな。", time:"any", month:"any", face:1 },
	{ char:"inukai", t:"あいつと運搬勝負すると、階段で必ず負ける。悔しいわ。", time:"any", month:"any", face:4 },
	{ char:"inukai", t:"今日は水を多めに張っといた。帰り着くまで保つよ。", time:"morning", month:"any", face:1 },
	{ char:"inukai", t:"うちの箱、返却よろしくな。数が合わないと親父がうるさい。", time:"any", month:"any", face:1 },
	{ char:"inukai", t:"軽トラの荷台、俺が積んどく。あれ古いから癖があんだよな。", time:"morning", month:"any", face:1 },
	{ char:"inukai", t:"若菜さん、目が肥えてきたな。前は値札しか見てなかったろ。", time:"any", month:"any", face:3, prog:"mid" },
	{ char:"inukai", t:"一年やった顔してるよ、最近。", time:"any", month:"any", face:1, prog:"late" },
	{ char:"inukai", t:"去年の暮れは、花常の木札が一度も上がらなかった。", time:"morning", month:"any", face:4, rare:true },
	{ char:"inukai", t:"初市は場内が人で埋まる。はぐれるなよ!", time:"morning", month:[1], face:2 },
	{ char:"inukai", t:"梅は持てば分かる。重いのが詰まってるやつだ。", time:"any", month:[2], face:3 },
	{ char:"inukai", t:"節分の日は市場でも豆を撒くんだぜ。誰も本気にしてないけど。", time:"any", month:[2], face:1 },
	{ char:"inukai", t:"桜は割れるからな。積むとき下に入れんなよ!", time:"morning", month:[3], face:2 },
	{ char:"inukai", t:"卒業の週は戦場だよ。うちも寝てない。", time:"any", month:[3], face:4 },
	{ char:"inukai", t:"チューリップは開くのが早い。今日中に売り切れ!", time:"morning", month:[4], face:2 },
	{ char:"inukai", t:"母の日の前は、うちの倉庫が赤一色になる。", time:"any", month:[5], face:1 },
	{ char:"inukai", t:"紫陽花はうちのが県内でいちばんいい。断言するぜ。", time:"any", month:[6], face:3 },
	{ char:"inukai", t:"雨の日は荷が重くなる。箱が水を吸うんだよ。", time:"any", month:[6], face:4 },
	{ char:"inukai", t:"向日葵は寝かせるな。首が曲がって戻らねえぞ!", time:"morning", month:[7], face:2 },
	{ char:"inukai", t:"夏場は氷、多めに入れとくよ。うちのサービスな。", time:"any", month:[7,8], face:1 },
	{ char:"inukai", t:"盆前は仏花の菊が飛ぶように出る。うちも品切れ寸前だ。", time:"any", month:[8], face:1 },
	{ char:"inukai", t:"りんどうは色で選べ。濃いのが今年は当たりだ。", time:"any", month:[9], face:3 },
	{ char:"inukai", t:"仮装じゃねえって何度言えば分かるんだ。地毛だよ、地毛!", time:"any", month:[10], face:2 },

	// ================================ 辰巳 28本 ================================
	// ⚠️出演は morning のみ。売り声＝感嘆符が人物そのもの（BIBLE §1 適用範囲1）。
	{ char:"tatsumi", t:"木札はしっかり握っとけ! 落としたら終いだぞ!", time:"morning", month:"any", face:1 },
	{ char:"tatsumi", t:"声が小さい! 買う気があるように見えねえぞ!", time:"morning", month:"any", face:1 },
	{ char:"tatsumi", t:"今日の相場か? 見てりゃ分かる。", time:"morning", month:"any", face:3 },
	{ char:"tatsumi", t:"常サンは値を張らなかった。張らずに、いいのを取ってった。", time:"any", month:"any", face:3 },
	{ char:"tatsumi", t:"手が上がるのが半拍遅い。直すのはそこだけだ。", time:"any", month:"any", face:3 },
	{ char:"tatsumi", t:"せこは覚えたか? 覚えなくても困らんが、覚えると早い。", time:"morning", month:"any", face:2 },
	{ char:"tatsumi", t:"俺の声が枯れる日は、市場が閉まる日だ!", time:"morning", month:"any", face:1 },
	{ char:"tatsumi", t:"買えなかった花のことは、帰りの電車で忘れろ!", time:"morning", month:"any", face:1 },
	{ char:"tatsumi", t:"隣を見るな! 花を見ろ!", time:"morning", month:"any", face:1 },
	{ char:"tatsumi", t:"ああいう若えのが増えると、市場は続くんだ。", time:"any", month:"any", face:3 },
	{ char:"tatsumi", t:"狼の坊主、声だけはでかくなったな。", time:"morning", month:"any", face:2 },
	{ char:"tatsumi", t:"犬飼んとこの倅は、目はいいが口が減らねえ!", time:"morning", month:"any", face:2 },
	{ char:"tatsumi", t:"買参の札は、汚れてるほうが信用される。妙な世界だろ。", time:"any", month:"any", face:2 },
	{ char:"tatsumi", t:"最初の一年はな、負けて覚えるもんだ。", time:"any", month:"any", face:3, prog:"early" },
	{ char:"tatsumi", t:"今日は競り負けなかったな。……見てたぞ。", time:"any", month:"any", face:2, prog:"mid" },
	{ char:"tatsumi", t:"そろそろ、俺が教えることはねえかもしれん。", time:"any", month:"any", face:3, prog:"late" },
	{ char:"tatsumi", t:"常サンの木札、まだ棚に掛かってる。誰も外さねえんだ。", time:"morning", month:"any", face:3, rare:true },
	{ char:"tatsumi", t:"……いい枝を取ったな。それだけだ。", time:"any", month:"any", face:3, rare:true },
	{ char:"tatsumi", t:"初市だぞ! 一年の値がここで決まる!", time:"morning", month:[1], face:1 },
	{ char:"tatsumi", t:"梅市は目より手だ。持ってみろ!", time:"morning", month:[2], face:1 },
	{ char:"tatsumi", t:"卒業前の週は寝る暇がねえ! 早く来い、早く!", time:"morning", month:[3], face:1 },
	{ char:"tatsumi", t:"嵐の日は荷が化ける。安く出るぞ、狙え!", time:"morning", month:[3], face:2 },
	{ char:"tatsumi", t:"四月は素人が来る。値が荒れるぞ、落ち着け!", time:"morning", month:[4], face:1 },
	{ char:"tatsumi", t:"芍薬は蕾で買え! 開いたのは明日には終いだ!", time:"morning", month:[5], face:1 },
	{ char:"tatsumi", t:"雨の日の場内は滑る。足元を見ろ!", time:"morning", month:[6], face:1 },
	{ char:"tatsumi", t:"夏の荷は待ってくれん。積んだらすぐ帰れ!", time:"morning", month:[7,8], face:1 },
	{ char:"tatsumi", t:"野分が来るぞ。今日は早仕舞いだ!", time:"morning", month:[9], face:1 },
	{ char:"tatsumi", t:"枝もんが動きだしたぞ! 冬は目が試される!", time:"morning", month:[11], face:1 },

	// ================================ 内藤 28本 ================================
	// ⚠️出演は9月・10月のみ。感嘆符は使わない。方言を混ぜない（老人語の範囲に留める）。
	{ char:"naito", t:"菊は夜のうちに育つ。人が寝ているあいだにな。", time:"any", month:"any", face:1 },
	{ char:"naito", t:"電気の代が、いちばんの経費だ。笑うだろう。", time:"any", month:"any", face:3 },
	{ char:"naito", t:"畑をひと回りするのに、四十分かかる。", time:"any", month:"any", face:1 },
	{ char:"naito", t:"花は正直だ。手を抜いた列は、すぐ分かる。", time:"any", month:"any", face:2 },
	{ char:"naito", t:"うちの畑は、暗くなってからが本番でな。", time:"evening", month:"any", face:2 },
	{ char:"naito", t:"夜になると、わざわざ見に来る人がいる。断りはしない。", time:"night", month:"any", face:2 },
	{ char:"naito", t:"朝は畑の明かりを落とす。切り替わる音がする。", time:"morning", month:"any", face:1 },
	{ char:"naito", t:"この手はもう、鋏の形に固まってしまった。", time:"any", month:"any", face:3 },
	{ char:"naito", t:"常さんは、若い頃にうちの畑へ来た。夜だった。", time:"any", month:"any", face:2 },
	{ char:"naito", t:"菊は仏さんの花だと言われる。まあ、そうでもある。", time:"any", month:"any", face:1 },
	{ char:"naito", t:"白は難しい。汚れが全部出るからな。", time:"any", month:"any", face:1 },
	{ char:"naito", t:"輪菊と小菊では、育て方がまるで違う。", time:"any", month:"any", face:1 },
	{ char:"naito", t:"水は根にやる。葉にかけると病気を呼ぶ。", time:"any", month:"any", face:1 },
	{ char:"naito", t:"摘蕾はな、捨てる作業だ。残す作業ではない。", time:"any", month:"any", face:2 },
	{ char:"naito", t:"五十年やって、まだ毎年ちがう顔をする。", time:"any", month:"any", face:3 },
	{ char:"naito", t:"あんたの祖母さんは、菊の話を最後まで聞く人だった。", time:"any", month:"any", face:2 },
	{ char:"naito", t:"顔つきが変わったな。去年の秋とは違う。", time:"any", month:"any", face:3, prog:"late" },
	{ char:"naito", t:"常さんは値切らなかった。一度も。", time:"any", month:"any", face:2, rare:true },
	{ char:"naito", t:"この畑を継ぐ者は、いない。それでも今年も植えた。", time:"any", month:"any", face:3, rare:true },
	{ char:"naito", t:"早生の菊が動きだした。九月は気の抜けん月だ。", time:"any", month:[9], face:1 },
	{ char:"naito", t:"彼岸の菊は量がいる。数えるのが仕事になる。", time:"any", month:[9], face:1 },
	{ char:"naito", t:"台風の前は、支柱を全部見て回る。一日仕事だ。", time:"any", month:[9], face:2 },
	{ char:"naito", t:"りんどうはうちでは作らない。あれは高いところの花だ。", time:"any", month:[9], face:1 },
	{ char:"naito", t:"畑の隅に、向日葵を一列だけ植えてある。理由は忘れた。", time:"any", month:[9,10], face:3 },
	{ char:"naito", t:"見回りのとき、ラジオはつけない。虫の音がよく聞こえる。", time:"night", month:[9,10], face:2 },
	{ char:"naito", t:"今年は花首が揃った。並べると気持ちがいい。", time:"any", month:[10], face:3 },
	{ char:"naito", t:"菊の香りは、手を洗っても三日は残る。", time:"any", month:[10], face:1 },
	{ char:"naito", t:"冷えると花が締まる。寒いのは悪いことばかりでもない。", time:"any", month:[10], face:1 },

	// ================================ 玄 22本 ================================
	// ⚠️出演は evening のみ。ほぼ喋らない人物なので断片で置く。感嘆符は使わない。
	{ char:"gen", t:"……浅いのと、深いの。", time:"any", month:"any", face:1 },
	{ char:"gen", t:"……座れ。", time:"evening", month:"any", face:1 },
	{ char:"gen", t:"挽きたてだ。", time:"any", month:"any", face:1 },
	{ char:"gen", t:"……手が荒れてる。", time:"any", month:"any", face:3 },
	{ char:"gen", t:"碁盤は、しまってある。", time:"any", month:"any", face:3 },
	{ char:"gen", t:"……その花で、いい。", time:"any", month:"any", face:2 },
	{ char:"gen", t:"湯が沸いた。", time:"any", month:"any", face:1 },
	{ char:"gen", t:"……飲んでけ。", time:"evening", month:"any", face:1 },
	{ char:"gen", t:"看板は、まだ出してある。", time:"evening", month:"any", face:1 },
	{ char:"gen", t:"……常は、砂糖を入れなかった。", time:"any", month:"any", face:2 },
	{ char:"gen", t:"豆は、切らしてない。", time:"any", month:"any", face:1 },
	{ char:"gen", t:"……無理はするな。", time:"any", month:"any", face:3 },
	{ char:"gen", t:"水を一杯。先に。", time:"any", month:"any", face:1 },
	{ char:"gen", t:"……砂糖は、そこ。", time:"any", month:"any", face:1 },
	{ char:"gen", t:"扉が重いだろう。直す。", time:"evening", month:"any", face:3 },
	{ char:"gen", t:"……似てきたな。", time:"any", month:"any", face:2, prog:"late" },
	{ char:"gen", t:"雨だ。傘は、そこに。", time:"evening", month:[6], face:1 },
	{ char:"gen", t:"……寒い。豆は多めに。", time:"any", month:[12,1,2], face:1 },
	{ char:"gen", t:"暑いな。冷やしたのが、ある。", time:"any", month:[7,8], face:1 },
	{ char:"gen", t:"……年が明ける。", time:"evening", month:[12], face:1 },
	{ char:"gen", t:"……花は、要る。", time:"any", month:"any", face:2, rare:true },
	{ char:"gen", t:"碁石の音がしない。それだけだ。", time:"evening", month:"any", face:3, rare:true },
];
