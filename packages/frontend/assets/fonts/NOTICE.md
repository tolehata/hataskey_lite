# Bundled fonts — attribution & licenses

旗鯖fork(Hatask v2 リデザイン)で自己ホストしているフォント一覧。すべて **SIL Open Font License 1.1** で配布されており、商用可・改変可・埋め込み可。既存フォントのライセンス全文は `OFL.txt`、LINE Seed JP は `LINE-Seed-JP-OFL.txt` に同梱している。Zen Kaku Gothic Newの著作権表示とライセンス全文は、個別の `Zen-Kaku-Gothic-New-OFL.txt` にも収録している。

LINE Seed JP 以外は [Google Fonts](https://fonts.google.com/) 由来。ArchivoはGoogle Fontsの配信WOFF2を直接取得し、その他の既存WOFF2は [Fontsource](https://fontsource.org/)（`cdn.jsdelivr.net/fontsource`）から取得している。LINE Seed JP は [LINE公式リリース](https://github.com/line/seed/releases/tag/v20260828)から取得した。いずれも自己ホストし、実行時に外部CDNへは接続しない。

| ファイル接頭辞 | フォント | 用途 | 権利表記 |
|---|---|---|---|
| `zkgn-*` | Zen Kaku Gothic New | 本文・共通ベース | Copyright 2022 The Zen Kaku Gothic Project Authors（`Zen-Kaku-Gothic-New-OFL.txt`） |
| `shippori-*` | Shippori Mincho B1 | 季テーマ 見出し/数字 | Copyright the Shippori Mincho Project Authors |
| `zmg-*` | Zen Maru Gothic | 花信テーマ 見出し/数字 | Copyright the Zen Maru Gothic Project Authors |
| `zkga-*` | Zen Kaku Gothic Antique | 刷テーマ 見出し/本文 | Copyright the Zen Kaku Gothic Antique Project Authors |
| `bebas-neue-*` | Bebas Neue | ラテンのラベル/装飾のみ | Copyright the Bebas Neue Project Authors |
| `archivo-*-wght.woff2` | Archivo | 暁テーマの数字・時刻・件数 | Copyright 2020 The Archivo Project Authors（`Archivo-OFL.txt`） |
| `lineseedjp-*` | LINE Seed JP | 既定UIフォント | © LY Corporation（`LINE-Seed-JP-OFL.txt`） |

ロゴ用の `Righteous`（`../Righteous-Regular.woff2`）も SIL OFL 1.1（`Righteous-OFL.txt`）。

## Archivo

- ライセンス: **SIL Open Font License 1.1**。Hatask本体のAGPL-3.0-onlyへ付け替えず、独立したフォント資産として同梱する
- 著作権表示: Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo)
- 著作権表示・ライセンス全文: [Archivo-OFL.txt](./Archivo-OFL.txt)。配信先は `/client-assets/fonts/Archivo-OFL.txt`
- 上流: [Archivo Project](https://github.com/Omnibus-Type/Archivo)、[Google Fonts](https://fonts.google.com/specimen/Archivo)
- 取得日: 2026-09-05。Google Fonts配信のv25、normal、幅100%、可変ウェイト100–900を使用する
- [取得元CSS](https://fonts.googleapis.com/css2?family=Archivo:wght@100..900&display=swap)のlatin / latin-ext / vietnameseを同梱。フォントの再加工・変換・追加サブセット化は行っていない
- ライセンスの取得元: [google/fonts の固定版](https://github.com/google/fonts/blob/6c70c829f09ea345d3590406693220ea35c6553f/ofl/archivo/OFL.txt)
- 同梱と自己ホストの条件: [SIL公式FAQ 1.2・1.3・2.1](https://openfontlicense.org/ofl-faq/)。フォントのOFLと本体のAGPLによるソース提供義務をそれぞれ維持する

| 同梱ファイル | Google Fonts配信元 | SHA-256 |
|---|---|---|
| `archivo-latin-wght.woff2` | [latin](https://fonts.gstatic.com/s/archivo/v25/k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLydOxI.woff2) | `8f704806dbedeaaeca334b11ec348bc3ac3a439d6431544b3afb54f534ee4967` |
| `archivo-latin-ext-wght.woff2` | [latin-ext](https://fonts.gstatic.com/s/archivo/v25/k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLyTOxK-vA.woff2) | `ff4f17d21930e36d6d93baba663e624cb767afc3feebf7adaebd82242638de05` |
| `archivo-vietnamese-wght.woff2` | [vietnamese](https://fonts.gstatic.com/s/archivo/v25/k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLySOxK-vA.woff2) | `5a621c5598a31392555104ccdc41a46c3104f1cc22666024a8afb881ca9adaab` |

## LINE Seed JP

- 権利表記: © LY Corporation
- ライセンス: SIL Open Font License 1.1。原本全文を [LINE-Seed-JP-OFL.txt](./LINE-Seed-JP-OFL.txt) に同梱（SHA-256: `2e877cb9d5c82b6f0e0c5da509eb905ae8e299467da73c32f7b80bb9ce51ab62`）
- 上流: [line/seed の v20260828 リリース](https://github.com/line/seed/releases/tag/v20260828)（コミット [`0564884c67ebdb3b31e90e2106c2d061f953b6a0`](https://github.com/line/seed/commit/0564884c67ebdb3b31e90e2106c2d061f953b6a0)）。取得日: 2026-09-24
- 配布元: [seed-v20260828.zip](https://github.com/line/seed/releases/download/v20260828/seed-v20260828.zip)（SHA-256: `58dee0e2b140c3b3d4769b34059fa7150aee7d3c8326358bd87c0879ef98a5b7`）内の `LINESeedJP/fonts/webfonts/` と `OFL.txt`。WOFF2 は変換・再サブセット化せず同梱
- 同リリースの4ウェイトはすべてバージョン1.016。このリリースで `halt` / `palt` / `vhal` / `vpal` による意図しない漢字字形の置換が修正された

| 同梱ファイル | ZIP内の原本 | ウェイト | SHA-256 |
|---|---|---:|---|
| `lineseedjp-400.woff2` | `LINESeedJP-Regular.woff2` | 400 | `f091a95d2bdbc7a3a9bab67b70f9ba0582b864b05d29756f8e26fa5b5b4aab55` |
| `lineseedjp-700.woff2` | `LINESeedJP-Bold.woff2` | 700 | `d9e9a3c01a7f818e398e9ec8bb57f8525c4be8e18b51ec2e341b4a733adeae20` |
| `lineseedjp-800.woff2` | `LINESeedJP-ExtraBold.woff2` | 800 | `380046de03fc13dae84b9b79e3b48e27e13e4ed3dee73d1cc1f290fe35953c48` |

## Zen Kaku Gothic New

- 対象ファイル: `zkgn-jp-400.woff2`、`zkgn-jp-500.woff2`、`zkgn-jp-700.woff2`、`zkgn-latin-400.woff2`、`zkgn-latin-500.woff2`、`zkgn-latin-700.woff2`
- ライセンス: SIL Open Font License 1.1
- 著作権表示: Copyright 2022 The Zen Kaku Gothic Project Authors
- 同梱WOFF2の内部表記: Copyright 2022 The Zen Project Authors（<https://github.com/googlefonts/zen-kakugothic>）
- 同梱WOFF2のライセンスURL: <https://scripts.sil.org/OFL>
- 上流: <https://github.com/googlefonts/zen-kakugothic>
- ライセンス全文: `Zen-Kaku-Gothic-New-OFL.txt`

Tabler Icons（`ti ti-*`, MIT License）はリポジトリ既存の `@tabler/icons-webfont` を流用しており、新規追加はしていない。
