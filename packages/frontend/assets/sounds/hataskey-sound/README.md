# hataskey-sound

Hataskey向けの7種類のオリジナルUIサウンド「こもれび」です。木琴のような柔らかな音色で統一し、新着ノートと通知は落ち着いた響き、リアクションは短く上品な響きにしています。このディレクトリ内の音源（WAV）とREADMEを [MIT License](LICENSE) で提供します。プロジェクト全体のAGPLライセンスとは別の、独立した音源セットです。利用・改変・再配布・商用利用時はMITの著作権表示と許諾文を保持してください。

MITライセンスの付与は、著作権の成立や排他的権利を保証するものではありません。

| ファイル / 設定値 | 用途 | 長さ |
| --- | --- | --- |
| `note.wav` / `hataskey-sound/note` | 新着ノート | 1.30秒 |
| `noteMy.wav` / `hataskey-sound/noteMy` | ノート投稿 | 0.58秒 |
| `notification.wav` / `hataskey-sound/notification` | 通知 | 1.52秒 |
| `reaction.wav` / `hataskey-sound/reaction` | リアクション | 0.42秒 |
| `noteEdited.wav` / `hataskey-sound/noteEdited` | ノート編集 | 0.48秒 |
| `noteSchedulePost.wav` / `hataskey-sound/noteSchedulePost` | 予約登録 | 0.76秒 |
| `chatMessage.wav` / `hataskey-sound/chatMessage` | チャット | 0.64秒 |

上記7用途の既定音に `hataskey-sound/<event>` を採用しています。新規設定時や音設定をリセットした際に適用されます。保存済みの設定は初期同期後に旧既定音と一致する用途だけ一度更新し、独自に選んだ音・無音・音量は維持します。アプリの音設定から個別に選択することもできます。生成していない用途の音は従来のサウンドを使用します。

すべて48 kHz・16 bit・モノラルPCM WAVです。
