/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Hatask お花・アイテムデータベース（100種+奇妙アイテム）
 */

import { versatileLang } from '@/utility/intl-const.js';
import { adjectiveTranslations, floraTranslations } from '@/utility/hatask-flora-i18n.js';

export type HataskFlowerSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export interface FloraItem {
  speciesId?: string;
  emoji: string;
  name: string;
  hanakotoba?: string; // 花言葉
  rare?: boolean;
  strange?: boolean; // 奇妙アイテム
  seasons?: HataskFlowerSeason[];
}

export const floraData: FloraItem[] = [
  // === お花（100種類）===
  {emoji:'🌸',name:'サクラソウ',hanakotoba:'初恋'},
  {emoji:'🌹',name:'バラ',hanakotoba:'愛情'},
  {emoji:'🌻',name:'ヒマワリ',hanakotoba:'憧れ'},
  {emoji:'🌷',name:'チューリップ',hanakotoba:'思いやり'},
  {emoji:'💐',name:'ブーケ',hanakotoba:'幸福'},
  {emoji:'🌺',name:'ハイビスカス',hanakotoba:'繊細な美'},
  {emoji:'🪻',name:'ラベンダー',hanakotoba:'沈黙'},
  {emoji:'🌼',name:'マーガレット',hanakotoba:'真実の愛'},
  {emoji:'🪷',name:'ハス',hanakotoba:'清らかな心'},
  {emoji:'🌿',name:'シダ',hanakotoba:'誠実'},
  {emoji:'🍀',name:'クローバー',hanakotoba:'幸運'},
  {emoji:'🌾',name:'ススキ',hanakotoba:'心が通じる'},
  {emoji:'💮',name:'白い花',hanakotoba:'純潔'},
  {emoji:'🏵️',name:'ロゼット',hanakotoba:'栄光'},
  {emoji:'🌱',name:'わかば',hanakotoba:'希望'},
  {emoji:'🪴',name:'鉢植え',hanakotoba:'温かい心'},
  {emoji:'🌵',name:'サボテン',hanakotoba:'忍耐'},
  {emoji:'🎋',name:'たなばた草',hanakotoba:'願い'},
  {emoji:'🎍',name:'門松',hanakotoba:'長寿'},
  {emoji:'🌲',name:'マツ',hanakotoba:'不老長寿'},
  {emoji:'🌳',name:'ケヤキ',hanakotoba:'重厚'},
  {emoji:'🍁',name:'モミジ',hanakotoba:'美しい変化'},
  {emoji:'🍂',name:'おちば',hanakotoba:'物思い'},
  {emoji:'🍃',name:'わかば風',hanakotoba:'新しい門出'},
  {emoji:'🎄',name:'クリスマスツリー',hanakotoba:'不変'},
  {emoji:'☘️',name:'シャムロック',hanakotoba:'愛国心'},
  {emoji:'🌸',name:'ユリ',hanakotoba:'純粋'},
  {emoji:'🌹',name:'ダリア',hanakotoba:'華麗'},
  {emoji:'🌻',name:'コスモス',hanakotoba:'調和'},
  {emoji:'🌷',name:'スズラン',hanakotoba:'再び幸せが訪れる'},
  {emoji:'🌼',name:'タンポポ',hanakotoba:'真心の愛'},
  {emoji:'🌺',name:'アサガオ',hanakotoba:'はかない恋'},
  {emoji:'🪻',name:'アイリス',hanakotoba:'希望'},
  {emoji:'💐',name:'カーネーション',hanakotoba:'母への愛'},
  {emoji:'🌸',name:'ジャスミン',hanakotoba:'優雅'},
  {emoji:'🌹',name:'カメリア',hanakotoba:'理想の愛'},
  {emoji:'🌻',name:'ガーベラ',hanakotoba:'希望'},
  {emoji:'🌷',name:'フリージア',hanakotoba:'あどけなさ'},
  {emoji:'🌼',name:'パンジー',hanakotoba:'もの思い'},
  {emoji:'🌺',name:'ポピー',hanakotoba:'いたわり'},
  {emoji:'🪻',name:'ネモフィラ',hanakotoba:'可憐'},
  {emoji:'💐',name:'スイートピー',hanakotoba:'門出'},
  {emoji:'🌸',name:'梅',hanakotoba:'忍耐'},
  {emoji:'🌹',name:'シャクヤク',hanakotoba:'恥じらい'},
  {emoji:'🌻',name:'マリーゴールド',hanakotoba:'変わらぬ愛'},
  {emoji:'🌷',name:'アネモネ',hanakotoba:'はかない恋'},
  {emoji:'🌼',name:'ミモザ',hanakotoba:'感謝'},
  {emoji:'🌺',name:'プルメリア',hanakotoba:'気品'},
  {emoji:'🪻',name:'リンドウ',hanakotoba:'正義'},
  {emoji:'💐',name:'ストック',hanakotoba:'愛の絆'},
  {emoji:'🌸',name:'ボタン',hanakotoba:'王者の風格'},
  {emoji:'🌹',name:'ツバキ',hanakotoba:'控えめな美しさ'},
  {emoji:'🌻',name:'クレマチス',hanakotoba:'精神の美'},
  {emoji:'🌷',name:'スミレ',hanakotoba:'謙虚'},
  {emoji:'🌼',name:'ヒヤシンス',hanakotoba:'スポーツ'},
  {emoji:'🌺',name:'ブーゲンビリア',hanakotoba:'情熱'},
  {emoji:'🪻',name:'ワスレナグサ',hanakotoba:'真実の愛'},
  {emoji:'💐',name:'キキョウ',hanakotoba:'誠実'},
  {emoji:'🌸',name:'サザンカ',hanakotoba:'困難に打ち勝つ'},
  {emoji:'🌹',name:'ライラック',hanakotoba:'初恋の思い出'},
  {emoji:'🌻',name:'キンモクセイ',hanakotoba:'謙虚'},
  {emoji:'🌷',name:'ナデシコ',hanakotoba:'純愛'},
  {emoji:'🌼',name:'ハナミズキ',hanakotoba:'返礼'},
  {emoji:'🌺',name:'サルビア',hanakotoba:'燃える思い'},
  {emoji:'🪻',name:'アジサイ',hanakotoba:'移り気'},
  {emoji:'💐',name:'シクラメン',hanakotoba:'はにかみ'},
  {emoji:'🌸',name:'ローズマリー',hanakotoba:'思い出'},
  {emoji:'🌹',name:'ガジュマル',hanakotoba:'健康'},
  {emoji:'🌻',name:'グラジオラス',hanakotoba:'勝利'},
  {emoji:'🌷',name:'カトレア',hanakotoba:'優美な貴婦人'},
  {emoji:'🌼',name:'キンレンカ',hanakotoba:'愛国心'},
  {emoji:'🌺',name:'デイジー',hanakotoba:'平和'},
  {emoji:'🪻',name:'ラナンキュラス',hanakotoba:'とても魅力的'},
  {emoji:'💐',name:'トルコキキョウ',hanakotoba:'優美'},
  {emoji:'🌸',name:'オリーブ',hanakotoba:'平和'},
  {emoji:'🌹',name:'ペチュニア',hanakotoba:'心の平安'},
  {emoji:'🌻',name:'ポインセチア',hanakotoba:'祝福'},
  {emoji:'🌷',name:'フジ',hanakotoba:'優しさ'},
  {emoji:'🌼',name:'サクランボ',hanakotoba:'小さな恋人'},
  {emoji:'🌺',name:'エーデルワイス',hanakotoba:'大切な思い出'},
  {emoji:'🪻',name:'ムスカリ',hanakotoba:'明るい未来'},
  {emoji:'💐',name:'カスミソウ',hanakotoba:'清い心'},
  {emoji:'🌸',name:'クチナシ',hanakotoba:'とても嬉しい'},
  {emoji:'🌹',name:'ベゴニア',hanakotoba:'片思い'},
  {emoji:'🌻',name:'ゼラニウム',hanakotoba:'尊敬'},
  {emoji:'🌷',name:'フクジュソウ',hanakotoba:'永久の幸福'},
  {emoji:'🌼',name:'ノースポール',hanakotoba:'誠実'},
  {emoji:'🌺',name:'サフラン',hanakotoba:'喜びの中の不安'},
  {emoji:'🪻',name:'ルリマツリ',hanakotoba:'密かな情熱'},
  {emoji:'💐',name:'レンゲソウ',hanakotoba:'心が和らぐ'},
  {emoji:'🌸',name:'アカシア',hanakotoba:'秘密の恋'},
  {emoji:'🌹',name:'カランコエ',hanakotoba:'幸福を告げる'},
  {emoji:'🌻',name:'ケイトウ',hanakotoba:'おしゃれ'},
  {emoji:'🌷',name:'センニチコウ',hanakotoba:'不朽'},
  {emoji:'🌼',name:'ワレモコウ',hanakotoba:'変化'},
  {emoji:'🌺',name:'ニチニチソウ',hanakotoba:'楽しい思い出'},
  {emoji:'🪻',name:'リコリス',hanakotoba:'再会'},
  {emoji:'💐',name:'スノードロップ',hanakotoba:'希望'},
  {emoji:'🌸',name:'ミツマタ',hanakotoba:'強靭'},
  {emoji:'🌹',name:'ホオズキ',hanakotoba:'偽り'},

  // === 奇妙アイテム（レア） ===
  {emoji:'🫧',name:'シャボン草',hanakotoba:'夢幻',strange:true},
  {emoji:'💠',name:'ダイヤ花',hanakotoba:'永遠',strange:true},
  {emoji:'🪸',name:'サンゴ',hanakotoba:'長寿',strange:true},
  {emoji:'🪼',name:'クラゲ草',hanakotoba:'自由',strange:true},
  {emoji:'🧊',name:'氷花',hanakotoba:'冷静',strange:true},
  {emoji:'❄️',name:'ゆき花',hanakotoba:'純白',strange:true},
  {emoji:'🌈',name:'にじ花',hanakotoba:'夢',strange:true},
  {emoji:'🔮',name:'水晶草',hanakotoba:'神秘',strange:true,rare:true},
  {emoji:'⭐',name:'星の実',hanakotoba:'希望の光',strange:true,rare:true},
  {emoji:'🌙',name:'月下美人',hanakotoba:'はかない美',strange:true},
  {emoji:'☄️',name:'流星花',hanakotoba:'一瞬のきらめき',strange:true,rare:true},
  {emoji:'🍄',name:'ひかりキノコ',hanakotoba:'幻惑',strange:true},
  {emoji:'🪨',name:'いしころ花',hanakotoba:'堅実',strange:true},
  {emoji:'💎',name:'宝石フラワー',hanakotoba:'高貴',strange:true,rare:true},
  {emoji:'🦠',name:'なぞのいきもの',hanakotoba:'進化',strange:true,rare:true},
  {emoji:'👾',name:'ピクセルフラワー',hanakotoba:'デジタル',strange:true,rare:true},
  {emoji:'🎪',name:'サーカスフラワー',hanakotoba:'楽しさ',strange:true},
  {emoji:'🎭',name:'仮面花',hanakotoba:'二面性',strange:true},
  {emoji:'🧬',name:'DNAフラワー',hanakotoba:'生命',strange:true,rare:true},
  {emoji:'🌀',name:'うずまき草',hanakotoba:'混沌',strange:true},
  {emoji:'🫠',name:'とろける花',hanakotoba:'のんびり',strange:true},
  {emoji:'🪹',name:'鳥の巣フラワー',hanakotoba:'家族愛',strange:true},
  {emoji:'🪺',name:'たまご巣',hanakotoba:'誕生',strange:true},
  {emoji:'🧸',name:'ぬいぐるみ花',hanakotoba:'ぬくもり',strange:true},
  {emoji:'🎃',name:'パンプキンフラワー',hanakotoba:'変身',strange:true},

  // === 季節のお花（旬に出やすく、ほかの季節にも咲く）===
  // 抽選上の旬を代表的な開花期に合わせる。実際の開花時期は地域・品種で前後する。
  { speciesId: 'daffodil', emoji: '🌼', name: 'スイセン', seasons: ['spring'] },
  { speciesId: 'spring-starflower', emoji: '💮', name: 'ハナニラ', seasons: ['spring'] },
  { speciesId: 'calanthe-orchid', emoji: '🌷', name: 'エビネ', seasons: ['spring'] },
  { speciesId: 'katakuri', emoji: '🌸', name: 'カタクリ', seasons: ['spring'] },
  { speciesId: 'agapanthus', emoji: '🪻', name: 'アガパンサス', seasons: ['summer'] },
  { speciesId: 'red-hot-poker', emoji: '🌺', name: 'トリトマ', seasons: ['summer'] },
  { speciesId: 'bee-balm', emoji: '🌹', name: 'モナルダ', seasons: ['summer'] },
  { speciesId: 'coneflower', emoji: '🌻', name: 'エキナセア', seasons: ['summer'] },
  { speciesId: 'golden-lace', emoji: '🌼', name: 'オミナエシ', seasons: ['autumn'] },
  { speciesId: 'thoroughwort', emoji: '💐', name: 'フジバカマ', seasons: ['autumn'] },
  { speciesId: 'toad-lily', emoji: '🪻', name: 'ホトトギス', seasons: ['autumn'] },
  { speciesId: 'leopard-plant', emoji: '🌻', name: 'ツワブキ', seasons: ['autumn'] },
  { speciesId: 'wintersweet', emoji: '🌼', name: 'ロウバイ', seasons: ['winter'] },
  { speciesId: 'setsubunso', emoji: '💮', name: 'セツブンソウ', seasons: ['winter'] },
  { speciesId: 'christmas-rose', emoji: '🌸', name: 'クリスマスローズ', seasons: ['winter'] },
  { speciesId: 'winter-heath', emoji: '🪻', name: 'エリカ・カルネア', seasons: ['winter'] },
];

// === 名前の上フレーズ（200種類）===
export const nameAdjectives = [
  'きらめく','ふわふわの','ちいさな','おおきな','ゆめみる','はなやかな','しずかな','にぎやかな','たのしい','やさしい',
  'げんきな','のんびり','ぽかぽか','きらきら','ふんわり','さわやかな','あたたかい','つめたい','まぶしい','ひそやかな',
  'どきどきの','わくわくの','そよかぜの','あめあがりの','ゆうやけの','あさつゆの','ほしぞらの','にじいろの','こもれびの','なみだの',
  'まほうの','ひみつの','おとぎの','ゆきどけの','はるかぜの','なつぞらの','あきかぜの','ふゆぞらの','つきあかりの','ほたるの',
  'うみかぜの','やまおくの','もりのなかの','はなびらの','しずくの','そらとぶ','ねむりの','めざめの','おどる','うたう',
  'ささやく','ほほえむ','かがやく','ゆらめく','はじける','とけあう','ひびきあう','みちびく','つむぐ','おりなす',
  'ときめく','いろづく','かおる','そよぐ','なびく','ゆれる','ひかる','またたく','きざむ','むすぶ',
  'やわらかな','つよい','しなやかな','ほがらかな','すなおな','いとおしい','なつかしい','あたらしい','ちいさい','おおきい',
  'ながい','まるい','とおい','ちかい','あかるい','くらい','はやい','おそい','あつい','さむい',
  'あまい','にがい','すっぱい','しょっぱい','からい','うまい','おいしい','かわいい','うつくしい','すてきな',
  'ふしぎな','おかしな','へんてこな','とくべつな','たいせつな','たからの','むてきの','さいこうの','さいしょの','さいごの',
  'はじまりの','おわりの','いちばんの','まんなかの','そばの','むこうの','あちらの','こちらの','どこかの','だれかの',
  'きのうの','きょうの','あしたの','いつかの','いまの','ずっとの','ときどきの','いつもの','めったにない','ひさしぶりの',
  'もふもふの','ぷにぷにの','つるつるの','さらさらの','ごつごつの','ぬくぬくの','ひんやりの','じんわりの','ほっこりの','しっとりの',
  'きっぱりの','はっきりの','ぼんやりの','こっそりの','ゆっくりの','すばやい','どっしりの','かろやかな','しっかりの','おだやかな',
  'エモい','チルな','エモーショナルな','ドラマチックな','ファンタジーの','ミラクルの','マジカルな','スペシャルな','プレミアムな','レジェンドの',
  'アンティークの','ビンテージの','モダンな','クラシカルな','ロマンチックな','ミステリアスな','エレガントな','ポップな','キュートな','クールな',
  'おひさまの','おつきさまの','おほしさまの','あめのひの','ゆきのひの','かぜのひの','はれのひの','くもりのひの','にじのひの','あらしのひの',
  '100ねんまえの','1000ねんごの','じかんをこえた','うちゅうの','ほしのかけらの','うみのそこの','くものうえの','やまのてっぺんの','たにぞこの','ちへいせんの',
  'でんせつの','しんわの','ものがたりの','おとぎばなしの','むかしむかしの','みらいの','げんざいの','えいえんの','しゅんかんの','とわの',
];

if (floraTranslations.length !== floraData.length || adjectiveTranslations.length !== nameAdjectives.length) {
  throw new Error('Hatask flora translations are not aligned with the canonical Japanese data.');
}

/** 日本時間の暦で季節を決め、端末のタイムゾーンによる抽選のずれを防ぐ。 */
export function getHataskFlowerSeason(date = new Date()): HataskFlowerSeason {
  const month = new Date(date.getTime() + 9 * 60 * 60 * 1000).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/** レア抽選の確率は固定し、通常グループ内だけで旬の花を3倍出やすくする。 */
export function getHataskFloraWeight(item: FloraItem, season: HataskFlowerSeason): number {
  return !item.rare && item.seasons?.includes(season) ? 3 : 1;
}

const rareFlora = floraData.filter((item) => item.rare);
const ordinaryFlora = floraData.filter((item) => !item.rare);

export function pickRandomFlora(date = new Date(), rng: () => number = Math.random): FloraItem {
  let sample = 0;
  try {
    sample = Number(rng());
  } catch {
    sample = 0;
  }
  if (!Number.isFinite(sample)) sample = 0;
  sample = Math.max(0, Math.min(1 - Number.EPSILON, sample));

  // レア全体で1%。通常品種が増えてもこの確率を変えない。
  if (sample >= 0.99) {
    return rareFlora[Math.min(rareFlora.length - 1, Math.floor((sample - 0.99) / 0.01 * rareFlora.length))];
  }

  const season = getHataskFlowerSeason(date);
  const totalWeight = ordinaryFlora.reduce((sum, item) => sum + getHataskFloraWeight(item, season), 0);
  let remainingWeight = sample / 0.99 * totalWeight;
  for (const item of ordinaryFlora) {
    remainingWeight -= getHataskFloraWeight(item, season);
    if (remainingWeight < 0) return item;
  }
  return ordinaryFlora[ordinaryFlora.length - 1];
}

export function generateFlowerName(flora: FloraItem): string {
  return generateFlowerNickname(flora.name);
}

/**
 * 旗鯖fork: 咲いたお花の名前欄に入れる「きらめくコスモス」のような名前を作る。
 * 上フレーズだけを抽選し、花の名前は渡された品種名をそのまま使う。
 * avoid を渡すと、引き直しで同じ名前が続かないよう別の上フレーズを選ぶ。
 */
export function generateFlowerNickname(flowerName: string, rng: () => number = Math.random, avoid?: string): string {
  let sample = Number(rng());
  if (!Number.isFinite(sample)) sample = 0;
  let index = Math.min(nameAdjectives.length - 1, Math.max(0, Math.floor(sample * nameAdjectives.length)));
  if (`${nameAdjectives[index]}${flowerName}` === avoid) index = (index + 1) % nameAdjectives.length;
  return `${nameAdjectives[index]}${flowerName}`;
}

export type HataskContentLanguage = 'ja' | 'en' | 'zh' | 'zhTW';

function activeContentLocale(): string {
  // 起動時に選ばれた言語は <html lang> が正本。言語を端末へ明示保存していない場合、
  // versatileLang だけを見ると既定の en-US と食い違うことがある。
  if (typeof window !== 'undefined') {
    const documentLocale = window.document.documentElement.lang.trim();
    if (documentLocale !== '') return documentLocale;
  }
  return versatileLang;
}

function resolveContentLanguage(locale?: string): HataskContentLanguage {
  const normalized = (locale ?? activeContentLocale()).toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hant') || normalized.startsWith('zh-hk')) return 'zhTW';
  if (normalized.startsWith('zh')) return 'zh';
  return 'ja';
}

const floraNameIndex = new Map(floraData.map((item, index) => [item.name, index]));
const floraNamesByLength = [...floraData]
  .map((item) => item.name)
  .sort((a, b) => b.length - a.length);
const adjectivesByLength = [...nameAdjectives]
  .map((item, index) => ({ item, index }))
  .sort((a, b) => b.item.length - a.item.length);

/** 改名後は品種IDを使い、旧データは絵文字と生成可能な名前の両方で照合する。 */
export function findHataskFlora(value: { speciesId?: unknown; emoji?: unknown; name?: unknown }): FloraItem | undefined {
  if (typeof value.speciesId === 'string') {
    const identified = floraData.find((item) => item.speciesId === value.speciesId);
    if (identified != null) return identified;
  }
  if (typeof value.emoji !== 'string') return undefined;

  const candidates = floraData.filter((item) => item.emoji === value.emoji);
  if (typeof value.name === 'string') {
    const name = value.name;
    const named = candidates.find((item) => name.endsWith(item.name) && splitAdjectives(name.slice(0, -item.name.length)) != null);
    if (named != null) return named;
  }

  // 同じ絵文字を使う別品種へ、改名した花を勝手に割り当てない。
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function isRareHataskFlower(value: { speciesId?: unknown; emoji?: unknown; name?: unknown }): boolean {
  return findHataskFlora(value)?.rare === true;
}

const hanakotobaIndex = new Map<string, number>();
for (const [index, item] of floraData.entries()) {
  if (item.hanakotoba != null && !hanakotobaIndex.has(item.hanakotoba)) hanakotobaIndex.set(item.hanakotoba, index);
}

export function localizeFloraName(sourceName: string, locale?: string): string {
  const language = resolveContentLanguage(locale);
  if (language === 'ja') return sourceName;

  const exactIndex = floraNameIndex.get(sourceName);
  if (exactIndex != null) return floraTranslations[exactIndex]?.[language].name ?? sourceName;

  for (const floraName of floraNamesByLength) {
    if (!sourceName.endsWith(floraName)) continue;
    const prefix = sourceName.slice(0, -floraName.length);
    const itemIndex = floraNameIndex.get(floraName);
    if (itemIndex == null) continue;
    const prefixIndexes = splitAdjectives(prefix);
    if (prefixIndexes == null) continue;
    const adjectives = prefixIndexes.map((index) => adjectiveTranslations[index]?.[language]);
    const translatedName = floraTranslations[itemIndex]?.[language].name;
    if (adjectives.some((adjective) => adjective == null) || translatedName == null) return sourceName;
    return language === 'en' ? `${adjectives.join(' ')} ${translatedName}` : `${adjectives.join('')}${translatedName}`;
  }

  return sourceName;
}

function splitAdjectives(source: string): number[] | null {
  if (source === '') return [];
  const memo = new Map<number, number[] | null>();
  const visit = (offset: number): number[] | null => {
    if (offset === source.length) return [];
    if (memo.has(offset)) return memo.get(offset) ?? null;
    for (const adjective of adjectivesByLength) {
      if (!source.startsWith(adjective.item, offset)) continue;
      const rest = visit(offset + adjective.item.length);
      if (rest != null) {
        const result = [adjective.index, ...rest];
        memo.set(offset, result);
        return result;
      }
    }
    memo.set(offset, null);
    return null;
  };
  return visit(0);
}

export function localizeHanakotoba(source: string, locale?: string): string {
  const language = resolveContentLanguage(locale);
  if (language === 'ja') return source;
  const index = hanakotobaIndex.get(source);
	return index == null ? source : (floraTranslations[index]?.[language].hanakotoba ?? source);
}
