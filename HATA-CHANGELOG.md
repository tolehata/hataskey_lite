# HATA-CHANGELOG

Hataskey Liteのチェンジログです。  
元になったHataskeyの更新履歴は [tolehata/hataskey の HATA-CHANGELOG.md](https://github.com/tolehata/hataskey/blob/master/HATA-CHANGELOG.md) を参照してください。  
ベースフォーク CherryPick のチェンジログは [CHANGELOG.md](./CHANGELOG.md) を参照してください。

## hata-13.0

Hataskey Liteの最初の版です。Hataskey hata-13.0 から、SNSとして毎日使う機能だけを残しました。

### 残した主な機能

- Hataskey UI（カプセルタブ・Hataskey UIのデッキ）と、従来のデッキ・Misskey標準UI
- HataSideStudio
- ハタキュのイラスト
- HataCardMaker

### 変わったこと

- ログイン画面の機能紹介を、Hataskey Lite専用の紹介1節にまとめました。
- ソフトウェア名の表示を「Hataskey Lite」にしました。
- ソースコードのリポジトリを [tolehata/hataskey_lite](https://github.com/tolehata/hataskey_lite) にしました。不具合の報告先は引き続きHataskeyのIssuesです。
- 新着画面の「Introduce」などの英字見出しが、専用の書体ではなく既定の書体で表示されることがある問題を修正しました。
- スマートフォンの設定画面で、カテゴリが4つのグループを選んだときに一覧の右下に空きができる問題を修正しました。

### 管理者向け

- Hataskey hata-13.0 から、データを引き継いだまま移行できます。移行すると、Hataskey Liteに無い機能のデータは削除され、元に戻せません。手順は [MIGRATION-FROM-HATASKEY.md](./MIGRATION-FROM-HATASKEY.md) を参照してください。
- 新しく立てるサーバーにもそのまま使えます。
