# 花常 音源ライセンス台帳

## 効果音

札の交換・消去・着地・特別札・クリアの効果音は、`src/pages/hanaawase/sound.ts` が Web Audio API の発振器から実行時に生成する独自音です。外部の音声素材は使用していないため、第三者素材のクレジットはありません。

## 環境音

3素材とも出典ページの作者名とCC0表記を2026-07-28に再確認しました。CC0は表示義務のないライセンスですが、素材の由来が分かるよう作者と出典を記録しています。

| 用途／ファイル | 作者・作品 | 出典URL | ライセンス | 取得日 | 加工内容 |
|---|---|---|---|---|---|
| 店内 `shop.ogg` | LEGIT Audio「The Shop」 | https://opengameart.org/content/the-shop | CC0 | 2026-07-22 | 配布MP3 `01 - LEGIT Audio - TheShopCollection_convenience_store_drinks_fridge_drone.mp3` を11.4秒・モノラル24kHz・Vorbis約48kbpsへ変換。2026-07-28に付随していたTheora映像ストリームを除去し、Vorbis音声だけを無劣化remux |
| 雨 `rain.ogg` | Ylmir「Rain (loopable)」 | https://opengameart.org/content/rain-loopable | CC0 | 2026-07-22 | 配布OGG `1.ogg` の先頭12秒をモノラル24kHz・Vorbis約48kbpsへ変換 |
| 風 `wind.ogg` | Écrivain「Icy Heights」 | https://opengameart.org/content/icy-heights | CC0 | 2026-07-22 | 配布OGG `wind.ogg` の先頭12秒をモノラル24kHz・Vorbis約48kbpsへ変換 |

環境音は常に1トラックだけを再生します。大霜（12月ボス）は `silent` を指定し、環境音を再生しません。
