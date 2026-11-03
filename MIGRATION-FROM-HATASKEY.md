# HataskeyからHataskey Liteへの移行

Hataskeyで動いているサーバーを、データを引き継いだままHataskey Liteに切り替える手順です。

> [!WARNING]
> 移行すると、Hataskey Liteに無い機能のデータは**削除され、元に戻せません**。
> 必ず移行前にバックアップを取ってください。Hataskeyに戻すときは、そのバックアップから復元します。

## 前提

- Docker Compose で動かしていること（`compose_example.yml` を元にした `compose.yml` で、`web` をソースからビルドしている構成）
- Hataskeyのソースを git で取得していること（`git clone https://github.com/tolehata/hataskey.git` など）

コマンドはすべて、Hataskeyのソースのディレクトリ（`compose.yml` がある場所）で実行します。

## 対象

- 移行元: **Hataskey hata-13.0**（hata-12.9 もデータベースの形は同じなので移行できます）
- それ以外の版や、Hataskey・Hataskey Liteのどちらにも無いマイグレーションが適用済みのデータベースでは、移行は**何も変更せずに止まります**（下の「止まったとき」）。

## 移行で起きること

データベースの移行は、Hataskey Liteのマイグレーション `LiteMigrateFromHataskey1793100000000` が行います。
新しく立てたHataskey Liteのデータベースと同じ形にそろえます。

### 削除されるもの

| 対象 | 内容 |
|---|---|
| 機能ごとの表（49） | Hatask・Hatady・HataIgo・フィードバックセンター・地震通知・宴・記録の見守り・プライベートチャンネルの招待とメンバー |
| 共有の表の列 | ユーザー・プロフィール・サーバー設定・チャンネル・アバターデコレーションに後から足された列（同意の記録、マスコット、ノートの飾り、Hataskの花、支援者の印など） |
| プライベートチャンネル | チャンネルと、その中の投稿。投稿者の投稿数も減らします（これらの投稿は連合していないので、他のサーバーには影響しません） |
| 実績 | 宴・LTLパンチ・Hatady/Hataskの歓迎の実績（25種類） |
| アバターデコレーション | Hataskの報酬専用だったもの。付けている人からも外します |
| ロールのポリシー | Liteに無い機能のポリシー（14項目） |
| ユーザーごとの保存領域（registry） | Hatask・HataIgo・Hatady・マスコット・HataFeed・HataGoes・Hatalyze・UIのお知らせの領域 |
| マイグレーションの記録 | Hataskeyだけにあった54本の記録 |

### 変わるもの

- アップロードできるファイルの種類に、Hataskeyで足したフォント（ttf・otf）が入っている場合は、Liteの既定（フォントなし）に戻します。管理者が別の設定にしていた場合は変えません。
- ソースコードのリポジトリのURLが、初期値のままなら `tolehata/hataskey_lite` に変わります。
- 期間限定のアバターデコレーション（Hataskeyで公開期間を設定したもの）は、期間の設定が消えて常に使えるようになります。

### そのまま残るもの

ユーザー・投稿・フォロー・ドライブのファイル・カスタム絵文字・通常のチャンネル・アンテナ・リスト・クリップ・お気に入り・ロール・サーバー設定など、Hataskey Liteにもある機能のデータはそのまま残ります。

## 手順

止まる時間を短くするため、ソースの切り替えとイメージのビルドはHataskeyを動かしたまま行い、止めるのはバックアップと起動のあいだだけにします。

### 1. 利用者への告知

移行の前に、次のことを利用者に知らせてください。

- 移行の日時と、止まる時間の目安
- Hataskey Liteに無い機能（Hatask・Hatady・HataIgo・フィードバックセンター・プライベートチャンネルなど）のデータが消えること。必要なものは移行前に各自で控えてもらう
- 移行後は、ブラウザーやアプリで開き直してもらうこと

### 2. 移行元の版を確かめる

```bash
git describe --tags
```

`hata-13.0` と表示されれば、そのまま進めます。古い版のときは、先にHataskeyを hata-13.0 に更新して、普段どおり起動・マイグレーションまで済ませてから移行してください。

### 3. ソースをHataskey Liteに切り替える

#### A. リモートを切り替えて更新する（おすすめ）

Hataskeyを取得しているリモート（ふつうは `origin`）の向き先を、Hataskey Liteに変えます。

```bash
git status
git remote set-url origin https://github.com/tolehata/hataskey_lite.git
git fetch origin
git checkout -B master origin/master
git branch --set-upstream-to=origin/master master
git submodule update --init --recursive
```

- ⚠️HataskeyとHataskey Liteは、**git の履歴がつながっていません**。`git pull` では切り替えられません（`refusing to merge unrelated histories` で止まり、何も変わりません）。必ず上の `git checkout -B` を使ってください。
- 最初の `git status` で変更が出る場合は、先に退避してください（`git stash` など）。退避しないと切り替えが止まります。
- `compose.yml`・`.config/`・`files/`・`db/`・`redis/` は git の管理外なので、切り替えてもそのまま残ります。
- SSHで取得している場合は、URLを `git@github.com:tolehata/hataskey_lite.git` にします。
- Hataskeyの上に自分で手を加えたコミットがある場合、それは切り替え後のブランチには入りません。必要なものは切り替え後に入れ直してください。自分のフォークで、Hataskeyを `upstream` などの別名のリモートから取り込んでいる場合は、上の `origin` をそのリモート名に読み替えます。
- 切り替えたあとは、普段どおり `git pull` で更新できます。

#### B. 別の場所に取得し直す

Hataskeyのディレクトリはそのまま残し、Hataskey Liteを新しく取得します。データを移すので、**手順5でHataskeyを止めてから**、手順6の前に次を行います。

```bash
git clone --recursive https://github.com/tolehata/hataskey_lite.git ../hataskey_lite
sudo mv compose.yml files db redis ../hataskey_lite/
cp .config/default.yml .config/docker.env ../hataskey_lite/.config/
cd ../hataskey_lite
```

- `db/` と `redis/` はコンテナの中のユーザーの持ち物なので、`sudo` が要ります。コピーではなく移動してください（コピーすると持ち主が変わり、データベースが起動しなくなることがあります）。
- `.config/` は丸ごと移動できません（取得したHataskey Liteにも `.config/` があり、移動先が空でないため失敗します）。自分で置いた設定ファイルだけを写してください。上の2つのほかに置いているもの（検索エンジン用の設定など）があれば、それも写します。
- ディレクトリ名が変わると、Docker Compose のプロジェクト名も変わり、コンテナの名前が変わります。以降の手順は新しいディレクトリで行ってください。
- B の場合は、手順4のビルドもHataskeyを止めたあとに新しいディレクトリで行うことになります。

### 4. イメージをビルドする（Hataskeyは動かしたまま）

```bash
docker compose build web
```

動いているHataskeyのコンテナは、作ったときのイメージで動き続けます。ソースを切り替えても、コンテナを作り直すまでは影響しません。

### 5. Hataskeyを止めてバックアップを取る

```bash
docker compose stop web
docker compose exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > hataskey-before-lite.dump
head -c 5 hataskey-before-lite.dump; echo
```

- ⚠️`-T` を外さないでください。外すと端末の変換が入り、バックアップのファイルが壊れます。最後の行で `PGDMP` と表示されれば正しく取れています。
- あわせて `files/`（ドライブのファイル）と `.config/` も控えておきます。
- バックアップのファイルは、git の管理外の場所に移しておくと安全です。

### 6. Hataskey Liteを起動する

```bash
docker compose up -d --force-recreate
docker compose logs -f web
```

起動時にマイグレーションが走ります。ログに次の行が出たら移行は終わりです（`Ctrl+C` でログの表示を抜けます）。

```text
Migration LiteMigrateFromHataskey1793100000000 has been executed successfully.
```

- ⚠️`.config/default.yml` の `url` は変えないでください。変えると、他のサーバーから同じサーバーとして扱われなくなります。

### 7. 確かめる

データベースに、Hataskeyだけの表が残っていないことを確かめます。

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA' <<'SQL'
select count(*) from information_schema.tables where table_schema = 'public' and table_name ~ '^(hatask|hatady|hataigo|feedback|utage|record_moderation|earthquake|channel_member|channel_invitation)';
SQL
```

結果が `0` なら、撤去した機能の表は残っていません（移行前のHataskeyでは `49` になります）。
そのあと、ブラウザーでログインし、タイムライン・通知・自分の実績が表示されることを確かめてください。

### 8. 後片付け（任意）

宴の判定待ちだったジョブが、Redisのジョブキューに残っていることがあります。Hataskey Liteは読まないので放っておいても動作に影響はありませんが、消す場合は次のようにします（`<prefix>` は `.config/default.yml` の `redisForJobQueue.prefix`、未設定なら `redis.prefix`、それも未設定ならサーバーのホスト名です）。

```bash
docker compose exec redis sh -c "redis-cli --scan --pattern '<prefix>:queue:utageResolve:*' | xargs -r redis-cli del"
```

Redisに残っている通知のうち、Hataskey Liteに無い機能の通知と、削除した実績の獲得通知は表示されません。

## 止まったとき

次のメッセージで止まった場合、データベースは**何も変更されていません**（マイグレーションは全体が1つのトランザクションで、途中で止まると最初からやり直しになります）。

```text
hataskey Lite: hata-13.0 にも Lite にも無いマイグレーションが適用済みのため、移行を中止しました（何も変更していません）。
```

メッセージの最後に、知らないマイグレーションの名前が並びます。下の「Hataskeyに戻すとき」の手順でソースだけHataskeyに戻し（データベースの復元は要りません）、hata-13.0 に更新してから、もう一度移行してください。

## Hataskeyに戻すとき

Hataskey Liteの移行は元に戻せません（`pnpm revert` も止まります）。ソースをHataskeyに戻し、手順5で取ったバックアップからデータベースを復元します。

```bash
git remote set-url origin https://github.com/tolehata/hataskey.git
git fetch origin --tags
git checkout -B master hata-13.0
git branch --set-upstream-to=origin/master master
git submodule update --init --recursive
docker compose build web
```

データベースを作り直してから復元します（`web` を止めておかないと作り直せません）。

```bash
docker compose stop web
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < hataskey-before-lite.dump
docker compose up -d --force-recreate
```

手順3を B で行った場合は、git の操作とビルドは要りません。Hataskey Liteのディレクトリで `docker compose down` してから、`compose.yml`・`files`・`db`・`redis` をHataskeyのディレクトリへ `sudo mv` で戻し（`.config/` の設定ファイルはHataskeyのディレクトリに残っています）、Hataskeyのディレクトリで上の「データベースを作り直してから復元」を行います。

## 本番の前にリハーサルする

本番のデータベースを複製した別の環境で、先に一度移行してみることをおすすめします。

1. 本番のバックアップを、別のPostgreSQLに復元する
2. そのデータベースに向けたHataskey Liteでマイグレーションを走らせる
3. 空のデータベースに新しく立てたHataskey Liteと、表・列・索引・制約の一覧を比べる

開発時のリハーサルでは、手順3の比較で差は制約の書き方3件だけでした（`pg_dump` で複製したときに、PostgreSQLが式を書き直すことで生じる表記の違いで、意味は同じです）。
