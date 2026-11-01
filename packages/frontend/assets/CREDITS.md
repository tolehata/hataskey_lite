# 素材クレジット

## HataFeed・Hatask・Hatady・HataGoes・Hataskey Appのアイコンとモーション

4アプリと、HataIgoを含むHataskey Appの独自アイコン・ロゴの図形、独自のモーション・アニメーション（SVG・CSS・JavaScript）は [AGPL-3.0-only](../../../LICENSE) で配布します。本番の実装は [HataFeatureIcon.vue](../src/components/HataFeatureIcon.vue)、[HataAppLogo.vue](../src/components/HataAppLogo.vue)、[HataAppNavIcon.vue](../src/components/HataAppNavIcon.vue)、[HataAppWordmark.vue](../src/components/HataAppWordmark.vue)、[HatagoesMergeMotion.vue](../src/components/hatagoes/motion/HatagoesMergeMotion.vue)、[HatagoesStoryMotion.vue](../src/components/hatagoes/motion/HatagoesStoryMotion.vue)、[hatagoes-story-artwork.js](../src/components/hatagoes/motion/hatagoes-story-artwork.js) を参照してください。

ロゴ用のRighteousと、モーションで使用するZen Kaku Gothic New・Zen Maru Gothicを含むフォント資産はSIL OFL 1.1です。詳細は[フォントのNOTICE](./fonts/NOTICE.md)を参照してください。Tabler Iconsやその他の第三者素材も、それぞれのライセンス条件に従います。

## LTLパンチの拳

LTLパンチの拳のSVG画像は [Twemoji](https://github.com/discord/twemoji) に由来します。Twemoji graphics © Twitter, Inc. and other contributors（Jason Sofonia & Justine De Cairesを含む）。画像は [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)（[法文・免責事項](https://creativecommons.org/licenses/by/4.0/legalcode.en)）、TwemojiのプログラムコードはMITライセンスです。

拳の表示にはCSSで拡大・回転・移動・透過・影を適用しています。SVG原本は変更していません。この使用は制作者や管理者がHataskeyを公認・推奨することを意味しません。対象は🤛（`1f91b.svg`）、👊（`1f44a.svg`）、🤜（`1f91c.svg`）の3画像です。既存依存`@discordapp/twemoji 16.0.1`の`dist/svg/`に含まれる原本を使用しています。

## HataIgo

HataIgo の独自アイコン・ロゴ、盤・石の図形と質感（SVG・CSS・JavaScript）は、既存の独自アイコンと同じ [AGPL-3.0-only](../../../LICENSE) で配布します。Copyright Tolehata and hatasaba-project。HataGoesの一覧アイコンは、上記の共通コンポーネント `HataFeatureIcon.vue` に実装しています。写真のテクスチャや他の囲碁ソフトの素材は使用していません。利用者のアバター画像の権利は、それぞれの権利者に帰属します。この表記によってアバターを AGPL に変更するものではありません。

操作ボタンなどのアイコンには既存依存 `@tabler/icons-webfont 3.35.0` の [Tabler Icons](https://github.com/tabler/tabler-icons)（MIT License, Copyright (c) 2020-2025 Paweł Kuna）を使用しています。HataIgo 自身は Lucide / Feather のアイコンを取り込んでいません。同梱フォントは [フォントの NOTICE](./fonts/NOTICE.md) を参照してください。

絵文字表示は利用者の共通設定に従います。Twemoji を選ぶときは上記の Twemoji graphics（CC BY 4.0）を、Fluent Emoji を選ぶときは既存の `fluent-emojis` サブモジュール（[Microsoft Fluent Emoji](https://github.com/misskey-dev/emojis)、MIT License、Copyright Microsoft Corporation）を使います。どちらも自己ホストです。Fluent Emoji の同梱ライセンスは [`fluent-emojis/LICENSE`](../../../fluent-emojis/LICENSE) にあります。native 設定、または画像が見つからない場合はシステムフォント表示へフォールバックします。

リアクションの 👏（`1f44f.svg`）・😮（`1f62e.svg`）・🤔（`1f914.svg`）・😂（`1f602.svg`）・🔥（`1f525.svg`）・🙏（`1f64f.svg`）は、既存依存 `@discordapp/twemoji 16.0.1` の `dist/svg/` に含まれる [Twemoji](https://github.com/discord/twemoji) の原本です。Twemoji graphics © Twitter, Inc. and other contributors（Jason Sofonia & Justine De Caires を含む）。画像は [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)（[法文・免責事項](https://creativecommons.org/licenses/by/4.0/legalcode.en)）、プログラムコードは MIT ライセンスです。SVG 原本は変更せず、表示サイズのみ CSS で調整します。制作者や管理者による Hataskey の公認・推奨を意味しません。
