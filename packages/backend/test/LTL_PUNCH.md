# LTLパンチゲームの実装

ログインしてHataskey通常UI（`simple.vue`）またはUI3のローカルタイムラインを表示している利用者が、共有する拳をクリックして撃退する。デッキ、外部TL、その他のclassic UIには接続していない。タブや画面が非表示になると参加を停止し、復帰時に最新状態へ同期する。

## 発動と共有ルール

- ローカルユーザーによる、public・チャンネル外の新規投稿が対象。同じ拳（🤛、👊、🤜）が3つ以上連続すると発動する。肌色修飾子とvariation selectorを正規化する。混在する拳は連続として数えない。
- 同時に進行するゲームは1回。終了後60秒のクールダウンがあり、投稿者ごとにUTC日付で1日2回まで。拒否された投稿は回数を消費しない。
- 開始から1.2秒でHPを充填し、さらに2秒待機してから36秒間降下する。準備中の攻撃は受け付けない。
- 参加人数はアカウント単位で集計する。クライアントのheartbeatは5秒間隔、参加記録は15秒TTL。同一アカウントの複数タブで人数を増やさない。
- 最大HPは `80 + 20 × max(1, 人数)`。人数変化では残HPの割合を維持する。クリック1回で8ダメージ、同一アカウントの攻撃間隔はタブを跨いで125ms以上。
- active中に参加した全アカウントへ、観戦者を含め、確定した勝敗の実績をサーバーから付与する。成功は `ltlPunchVictory`（「パンチは消えた...」）、失敗は `ltlPunchDefeat`（「TLはパンチされた...」）。client claimの対象外とし、outboxで付与を再試行する。

Redis TIMEで時刻を決め、Luaで状態更新を原子的に処理する。再接続時はsnapshotを取得し、revisionで古い更新を除外する。チャンネルではログインとroleの認可を確認する。発動元ノートや投稿者情報は公開stateに含めない。Redisのゲーム状態は一時的なもので、DB schema変更はない。実績は既存の`UserProfile.achievements`（jsonb）へ保存する。

## 画面の動き

専用navbar slotへ予告・HP・勝敗を表示する。襲来中はノート領域のinert・入力イベント遮断・透明な操作保護面で誤操作を防ぎ、新着はqueueへ保留する。ボタンのdisabled状態は変更せず、通信完了などの通常の状態更新を保つ。投稿欄は操作可能なままにする。絵文字投票、RSS演出、既存TL崩壊の競合を抑止する。空のLTLや読み込み中でも拳を表示し、ノートが現れた時点で保護対象を更新する。

成功時はTLを即座に復元し、拳の粒子をdesktopでは96個、mobileでは64個表示する。動きを控える設定では10個の静止表示へ減らす。成功直後の誤操作防止は380ms。失敗時は5秒間の崩壊演出の後に復元する。「閉じる」はその回の演出をそのブラウザで非表示にし、共有勝敗や実績の資格を変更しない。移動・非表示・unmount時は演出と操作保護を片付ける。

## 確認状況

- SDK declaration compileはexit 0。一時型宣言を参照したbackend TypeScript検査もexit 0。
- 対象6SFCのscript/template compileは成功。実ソースを使うNode assertions（DI mock）15項目（backend 9、frontend pure utility 5、private field除去1）と、Vue＋HappyDOMによる実SFCの準備・成功・失敗・quiet mode・cleanup・空のLTL・通常のボタン状態更新の維持など11項目は成功。いずれもNode v24.19.0で終了コード0。Redis処理の代替実装や実ブラウザーの描画を検証した結果ではない。
- 新規backend 4ファイルとfrontend 4ファイルのESLintは終了コード0。Redis検証スクリプトのNode構文検査も終了コード0。
- frontend全体のvue-tscはexit 2。未変更の`HataskFlowerCare.vue`、`MkUISetup.test.ts`、`pages/settings-redesign/index.vue`に3診断があり、今回変更したファイルに診断はなかった。全体合格とはしていない。
- 標準Vitestはnative rolldown/rollup/slacc依存不足により未実行。ブラウザの描画と実Redis上のLuaは未確認。
- 実Redis検証用に`packages/backend/scripts/test-ltl-punch-redis.mjs`を用意したが未実行。`PUNCH_TEST_REDIS_URL`を明示して実行し、Redisを自動起動しない。

### 2026-09-27 本番ビルド・適用完了

macOS 27.0 / arm64、Docker Engine 29.8、Node 26.4.0、pnpm 11.25.0で、04:41–04:43 JSTに全サービスの適用と配信検査が完了した。`BUILDX_NO_DEFAULT_ATTESTATIONS=1 docker compose up -d --build --force-recreate`は終了コード0、空き容量guardも0（`/tmp/hata-punch-compose-verified.log`）。

- db・redis・webの全3サービスがhealthy。稼働imageとbuild imageのIDは`cd7354b5f3ccbbf0416645e9af927d3099c05ccb0d76eb10bdc934fe5f37bc41`で一致した。pending migrationはない。事前にsource/containerのmigrationファイル464件のhash一致を確認し、今回の新規DB migrationはない。
- 配信smokeは42 checksすべてPASS、終了コード0（`/tmp/hata-punch-deploy-smoke-result.log`）。`/`、`/settings`、`/settings/preferences`、`/settings/connect`は200。HTMLのCLIENT_ENTRYは1件、manifest一致は1件、CSSは21本すべて200。entryの素体・ja-JP版、simple UIから到達するパンチchunk 1件の素体・ja-JP版も200。backend生成物・DI・stream登録と、拳のTwemoji 3本の200を確認した。Mac側curlでも`/healthz`を含む5 routesが200。
- 初回はTwemojiの静的URLがVueのimportへ変換され、`UNRESOLVED_IMPORT`で失敗した。`MkLtlPunch.vue`をruntime bindingへ修正。`compileTemplate`の`includeAbsolute: true`検査は終了コード0で、修正前の陽性対照ではimport 1件、修正後は0件、runtime URL保持を確認した。
- その後のpnpm buildは成功したが、image unpackingの`read-only file system`と空き容量16 GiB→1.1 GiBで適用に失敗した。当時は旧サービスにも接続できなかった。承認後、通常再起動のtimeoutを経て公式CLIのforce stopが終了コード0で成功。start後にユーザー自身がcacheをクリアし、Dockerと3サービスが復旧した。再試行はpnpm build成功後、runner copy中の空き容量6,199,536 KiBでguardが終了コード130により停止した。これらは最終成功前の失敗記録である。
- 横スワイプ設定のbuildエラーは、保存証拠不足と件数`expected 522, got 523`の2段階で発生した。`preferences.vue`のdevice/profileモデルを分離し、検索generatorへ端末保存キー`hatasabaTabSwipeEnabled`と`setTabSwipeEnabled`経路を登録した。`vite.config.ts`と既存generator testの件数基準も更新し、関連4ファイルを修正した。実本番plugin全体の検証は523件、manual shell actionを除く構成と実テスト構成は520件で終了コード0。device switchだけをメモリ内で撤去すると522件になり、増加1件が`deviceHorizontalSwipe`だけであることを確認した。検査guardは維持した。
- 承認後に旧backup image 5個を削除して終了コード0。最新backup 3個を保持し、現在稼働中のimage、DB、files、volumesを維持した（対象refsは`/tmp/hata-punch-image-cleanup-plan.md`）。古いcacheの`until=2h` pruneは0 B、package cachemountの限定pruneは別途1.447 GBを回収した。Mac空き容量は15 GiB→image削除後23 GiB→適用後9.7 GiB。
- 最終build前のbuildx cacheは13.06 GB（shared 13.03 GB / private 29.5 MB）、適用後は26.98 GB（shared 13.02 GB / private 13.95 GB / reclaimable 26.74 GB）で、total差は+13.92 GB。適用後のdocker system dfはimages 14.12 GB / reclaimable 10.09 GB、build cache 26.98 GB / reclaimable 13.81 GB、volumes 2.736 GB。現時点のcacheは保持している。

base image・apt・pnpm取得に伴うnetwork利用はログで確認済み。sourceのcommit操作は実施していない。42 checksは配信・登録の確認であり、ブラウザ操作、実プレイ、既存UI機能、実Redis上の勝敗テストは未実施である。

## 素材とライセンス

拳は既存の`@discordapp/twemoji 16.0.1`のSVGを`/twemoji`から表示する。追加素材・依存の取得はなく、元SVGは変更しない。拡大・回転・移動・透明度・影を演出として適用し、About画面に著作者、[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)、[source](https://github.com/discord/twemoji)、表示変更を記載する。独自プログラムはAGPL-3.0-only、graphicsはCC BY 4.0。

素材の帰属記録は[素材クレジット](../../frontend/assets/CREDITS.md)を参照。これはFTO（第三者権利を侵害せず実施できること）の保証ではない。
