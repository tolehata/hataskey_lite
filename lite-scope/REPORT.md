# hataskey Lite 撤去範囲・影響範囲 調査レポート

- 調査日: 2026-11-01
- 対象: `hataskey_lite` master `e414525fa2`（= hataskey hata-13.0）
- 方法: パス名とコード内容の grep で候補を出し（`scan.sh`）、import 文を実ファイルに解決して「残すファイルのうち、消すファイルを import しているもの」を突き合わせた
- 生データ: `lists/` 以下（機能ごとの `*.owned.txt` = 丸ごと削除候補、`*.touch.txt` = 部分修正候補）

## 0. 決定事項（2026-11-01 旗茶くん裁定）

| 論点 | 決定 | 作業への影響 |
|---|---|---|
| 寄付特典の設定（§3-1） | **Hatask と一緒に消す** | `hatask/support`・`admin/hatask/support`・`admin/support.vue`・`HataskSupport*`・`Meta.hataskSupport`・`1789080000000-add-hatask-support.js` も削除対象 |
| お絵かきツール Hatadint（§3-2） | **消す** | `MkDrawingTool*`・`utility/hatadint-*`・`MkPostForm.vue` のお絵かきボタン・設定 `showDrawingButtonInPostForm`（定義は残す）・同意種別 `drawing`・`1788900000000-add-hatadint-consent.js`。ほかに `utility/drive.ts`・`hata-custom.vue`・`hata-settings-transfer.ts` から参照あり |
| DB（§3-3） | **新規サーバー** | 消す機能の独自マイグレーション（§5）は削除し、DROP 用マイグレーションは作らない。⚠️ 削除前に、本家・残す独自マイグレーションが消す表や列に触れていないかを確かめる |

> ⚠️ 数字はすべて grep の実測値。`owned` には**テスト・旧マイグレーション・下記「要判断」項目も入っている**ので、
> 「そのまま全部消せる数」ではなく**候補の上限**として読むこと。

## 1. 規模（実測）

| 機能 | 丸ごと削除候補 | その行数 | 部分修正が要るファイル |
|---|---:|---:|---:|
| Hataskey UI S（`ui = 'hataskey3'`） | 90 | 26,574 | 78 |
| HataGoes | 90 | 12,255 | 82 |
| HataFeed（backend 名は `Feedback*`） | 123 | 14,893 | 144 |
| Hatady | 266 | 48,628 | 213 |
| Hatask | 266 | 51,780 | 227 |
| HataIgo | 137 | 15,611 | 31 |
| 地震・津波 | 17 | 2,607 | 69 |
| ノートチャーム | 32 | 6,253 | 44 |
| プライベートチャンネル | 32 | 2,199 | 78 |
| 外部アカウント連携＋コンカレント連携 | 79 | 19,701 | 69 |
| **合計（重複除く）** | **1,127** | **200,246** | — |

- 「部分修正」の数には locales（5ファイル）と cherrypick-js の自動生成ファイルが入っている
- 参考: frontend/src と backend/src の追跡対象は合計 601,422 行。候補はその約 1/3
- **残すファイルのうち、削除候補を直接 import しているもの: 133 ファイル（import 行 612 本）**
  → 一覧は `lists/_kept_files_importing_deleted.txt`。ここを直さないとビルドが通らない

## 2. 機能ごとの削除範囲

### 2-1. Hataskey UI S
- 本体: `ui/hataskey3.vue`、`components/hataskey3/`（86 ファイル）
- 設定画面: `settings-redesign/HataskeyUiS*`（BottomNav・RSS の設定とテスト）
- HataIntro の `hata-intro/ui-s-content.ts`・`ui-s-scenes.js`
- backend: `endpoints/hata/ui-s-announcement/claim.ts`
- 他から入り込んでいる箇所: `os.ts`（`hk3-composer-menu` を import）、`boot/common.ts`（旧 `hatacording` を `hataskey3` に移す処理）、`boot/main-boot.ts`、`MkUISetup.vue`、`MkMenu.vue`、`MkPopupMenu.vue`、`MkDrawingTool` の呼び出し元 `Hk3Composer.vue`

### 2-2. HataGoes
- 本体: `pages/hatagoes.vue`、`components/hatagoes/`、`utility/hatagoes-*`（41）
- backend: `endpoints/hata/hatagoes/*`、`HatagoesSearchService`、`core/hatagoes-daily.ts`
- ⚠️ **共通部品に入り込んでいる**: `MkModal.vue`・`MkWindow.vue`（`hatagoes-context`・`hatagoes-motion`）、`games.vue`、`drop-and-fusion.vue`、`hata-card-maker.vue`、`hata-emotion-analysis.vue`、`MkDrawingTool.vue`、`ui/simple.vue`（25箇所）
- サイドメニュー・下部ナビの保存値に `hatagoes` が入っている利用者がいる（移行処理が要る。先例: `hatagoes-sidebar-migration.ts`）

### 2-3. HataFeed
- frontend: `HataFeed*`・`Hf*`・`hatafeed*`
- backend: `endpoints/hata/feedback/*`、モデル `Feedback*` 9個、`FeedbackService`・`FeedbackEmojiService`、`misc/feedback-*`
- ほかに入り込んでいる箇所: `NotificationService`、`MkNotification.vue`、`sw/create-notification.ts`・`hata-custom-notification-copy.ts`、`admin/roles*.vue`、`vite.config.ts`
- ⚠️ `Meta.feedbackUrl`（不具合報告の URL）は本家由来の項目なので**残す**

### 2-4. Hatady
- frontend: `components/hatady/`、`Hatady*`、`Hy*`（Hatady の UI 部品）、`utility/hatady-*`、`pages/hatady.vue`、`MkHatadyTimeline`
- backend: `endpoints/hata/hatady/*`、モデル 16個、Service 6個、ストリーム `hatady-timeline`
- cherrypick-js: 手書きの `src/hata-media.ts`、`consts.ts`
- ⚠️ 「記録モデレーション」（`RecordModerationService`・`RecordModerationDialog`・`misc/record-moderation.ts`）は**対象が Hatady と Hatask だけ**なので、一緒に撤去できる

### 2-5. Hatask
- frontend: `components/hatask/`、`utility/hatask-*`、`pages/hatask.vue`・`HataskSettings.vue`、`WidgetHataskFlowers`、`HataSideStudioFlowers`
- 感情分析（Hatalyze）: `pages/hata-emotion-analysis.vue`、`utility/hata-emotion-analysis*`、`endpoints/hata/hatask/emotion-analysis`、ロールポリシー `canUseHatalyze`
- backend: `endpoints/hatask/*`（予定・お花・プランナー・ランキング・レシピ・記録・支援）、`endpoints/admin/hatask/*`、モデル 8個、キュー処理 2個（お花・気分リマインダー）
- ⚠️ **ほかに入り込んでいる箇所**: `RegistryApiService`（お花v2・プランナー・`hatagoes-daily`）、`i/registry/*` 7本、`AvatarDecorationService`（お花図鑑の達成報酬デコ）、`Meta.ts`（`hataskFlowerRules`・`hataskSupport`）
- ⚠️ **「支援」は Hatask の名前を借りた、サーバー全体の寄付特典の仕組み**（下の 3-1）

### 2-6. HataIgo
- `pages/hataigo/`、`components/hataigo/`、`utility/hataigo/`（独自 i18n）、`endpoints/hataigo/*`、Service 3個、モデル 2個、ストリーム `hataigo`・`hataigo-game`
- ほかに入り込んでいる箇所は少ない: `games.vue`、`GlobalEventService`、`ChannelsService`、`CleanProcessorService`、`DeleteAccount*`、`vite.config.ts`、`assets/CREDITS.md`
- locales は使っていない（ゲーム内に閉じた i18n）

### 2-7. 地震・津波
- `pages/earthquake.vue`、`MkEarthquake*` 5個、`HataSideStudioEarthquake`、`WidgetEarthquake`、`ui/deck/earthquake-column.vue`、`utility/earthquake.ts`
- backend: `EarthquakeService`、`EarthquakeNotification`、`endpoints/hata/earthquake/*`、通知種別 `earthquake`
- ほかに入り込んでいる箇所: `deck.ts`（カラム種別）、`navbar.ts`、`local-storage.ts`、`preferences/def.ts`、`hata-custom.vue`、`hatasaba-device-prefs.ts`、`sw`、`assets/geo/*`（地図データ。ほかに使う所が無ければ一緒に消す）

### 2-8. ノートチャーム
- `MkNoteCharm*`、`utility/note-charm-*`、`composables/use-note-charm-context`、`note-charm.scss`、`backend/misc/note-charm.ts`
- ほかに入り込んでいる箇所: `MkNote.vue`・`MkNoteDetailed.vue`・`simple.vue`・`universal.vue`、`get-note-menu.ts`、`User.ts`・`UserEntityService`・`json-schema/user.ts`、`i/update.ts`、ロールポリシー `canUseNoteCharm`、同意種別 `noteCharm`、`admin/consent-manager.vue`

### 2-9. プライベートチャンネル
- backend: `ChannelMember`・`ChannelInvitation`、`channels/{add-member,remove-member,members,join,show-password,invitations/*}`、`misc/private-channel-*`
- frontend: `MkPrivateChannelMembersDialog`、`utility/private-channel-*`
- ⚠️ **閲覧判定が本体の奥まで入っている**: `ChannelService`・`NoteEntityService`・`QueryService`・`NoteCreateService`・`ApInboxService`・`ClientServerService`・ストリーム `main`/`antenna`・`notes/show`・Webhook・RSS・OGP
- 列: `channel.isPrivate`・`channel.password`・`channel.moderatorUserIds`（副管理者）、ロールポリシー `canMakePrivateChannel`

### 2-10. 外部アカウント連携＋コンカレント連携
- **frontend だけ**で完結している（backend に残るのは同意種別 `externalTl` のみ）
- `components/concrnt/`・`utility/concrnt/`・`assets/concrnt/`、`utility/external-*`、`MkExternal*`、`pages/concrnt.vue`・`external-notifications.vue`・`settings/external-account.vue`、`ui/deck/external-notifications-column.vue`、`WidgetExternalNotifications`
- ⚠️ 本体に深く入っている: `simple.vue`（66箇所）、`hatasaba-deck.vue`（33）、`timeline.vue`、`deck/tl-column.vue`、`MkPostForm.vue`（外部への投稿・リアクション）、`accounts.ts`・`signout.ts`（サインアウト時の消去）、`boot/common.ts`、`MkHataskeyNotificationToasts`

## 3. 要判断（調べて見つかった、指示に無かった絡み）

### 3-1. 寄付特典の設定（`hatask/support`・`admin/support.vue`・`Meta.hataskSupport`）
- 中身は「寄付するとロールで機能制限が緩む」サーバー全体の仕組み。特典の対象は `driveCapacityMb`・マスコット・お気に入りフォルダ・`rateLimitFactor` など、Hatask と関係ない項目が大半
- Hatask と一緒に消すか、名前を変えて残すかで作業が変わる
- 残す場合も、特典の項目から `canMakePrivateChannel`・`canUseNoteCharm`・`hatadyBookLimit`・`canUseHatadySync` は外す

### 3-2. お絵かきツール Hatadint（`MkDrawingTool.vue`・`utility/hatadint-*`）
- 名前は Hatady 系に見えるけど、**通常の投稿フォーム（`MkPostForm.vue`）から使われている**。同意種別は `drawing`
- 残すなら `hatagoes-context` への依存だけ外せば済む。⚠️ `lists/hatady.owned.txt` には hatadint の 7 ファイルが入っているので、残す場合はそこから外すこと

### 3-3. DB の扱い（Lite が新規サーバーか、既存 DB を引き継ぐか）
- 撤去でいらなくなるテーブル（実測 38個）:
  - Hatady 16 / Hatask 8（`hatask_drop_wallet` を含む）/ Feedback 9 / HataIgo 2 / プライベートチャンネル 2 / 地震 1
  - ほかに記録モデレーション用の表（`1790035300000-record-moderation.js`）
- 列: `meta.hataskFlowerRules`・`meta.hataskSupport`、`channel.isPrivate`・`password`・`moderatorUserIds`、`user_profile` のチャーム設定と同意（`noteCharm`・`externalTl`）
- 名前で拾った独自マイグレーションは 46本（一覧は §5。名前に support・external などを含む本家由来の 9本は除外済み）
- **新規サーバーなら**: 独自マイグレーションを消して、最初から作らない形にできる（本家の後続マイグレーションが独自の表に依存していないかの確認は要る）
- **既存 DB を引き継ぐなら**: 旧マイグレーションは残し、DROP するマイグレーションを1本足す。⚠️ その場合プライベートチャンネルは、**列を消す前に投稿を削除するか非公開のまま退避しないと、閉じた投稿が公開チャンネルの投稿として見えてしまう**

### 3-4. 残すけど中身を削る必要があるもの（主要機能側）
- **HataIntro**（`hata-intro/`）: 消す機能の章（HataGoes・UI S・Hatask・Hatady・HataFeed・地震・外部連携）の削除と、目次・テストの更新
- **HataSideStudio**: 地震・お花・外部通知・HataGoes のウィジェットの削除
- **ウェルカム画面**（`welcome.entrance.hataskey.*`）: Hatask・Hatady・HataFeed の紹介プレビューが大きく入っている（hatask 149箇所）
- **設定画面**: `hata-custom.vue`、`settings-redesign/*`、設定検索の索引（`lib/vite-plugin-create-settings-search-index-v2.ts` に直書き）、`hata-settings-transfer.ts`（書き出し・読み込み）
- **通知**: `notification-brand.ts`・`notification-filter.ts`・`MkNotification.vue`・`sw`、backend の `NotificationService`・`NotificationEntityService`・`Notification.ts`（種別 `hatady`、`hatask*` 5種、`earthquake`）
- **今回の更新内容**（`hata-whats-new`）、`hata-feature-icon.ts`・`hata-app-brand.ts`・`HataAppLogo.vue`

## 4. 撤去で事故になりやすい点

1. **設定キーを `preferences/def.ts` から消すと、保存済みの設定プロファイルの読み込みで壊れる**（`manager.ts` が `PREF_DEF[k].default` をそのまま参照する）。hataskey にも「読まなくなったキーは定義だけ残す」先例がある（`simpleUi.directProfile`）
2. **端末に `ui = 'hataskey3'` が保存されている利用者**: `main-boot.ts` の default で simple に落ちるけど、`boot/common.ts` の `hatacording → hataskey3` の移行は `simple` 行きに直す
3. **DB に残る通知**: 消した種別（`hatady`・`hatask*`・`earthquake`）の通知行が残っていると、通知を詰めて返す処理で落ちる恐れがある。種別を消すなら、行を消すマイグレーションか読み飛ばしが要る
4. **サイドメニュー・下部ナビ・デッキのカラム**に、消した項目（hatagoes・earthquake・externalNotifications・concrnt）が保存されている利用者向けに、読み飛ばしか移行が要る
5. **cherrypick-js**: `autogen/*` と `etc/cherrypick-js.api.md` は手で直さず、backend から `api.json` を作り直して生成する
6. **locales**: ja-JP.yml の `_hatady`（約1,800行）・`_hatask`（約1,500行）・`_hatafeed`（約800行）・`_externalAccount`（約670行）・`_privateChannels` の節と、`index.d.ts` の型。en-US・zh-CN・zh-TW にも同じ節がある
7. **検証環境**: このリポジトリにも `node_modules` が無いので、型検査・テストは docker 越しに回す（CLAUDE.md の手順）

## 5. 名前で拾った独自マイグレーション

```
1762100000000-add-hatask-events.js
1783000000000-add-feedback-center.js            1783100000000-add-feedback-issue-number.js
1783200000000-private-channel.js                 1783300000000-private-channel-no-external-renote.js
1783400000000-feedback-issue-code.js             1783500000000-feedback-project-color.js
1783600000000-feedback-project-suspended.js      1783700000000-feedback-comment-thread-mark.js
1783800000000-feedback-project-genre.js          1784000000000-earthquake-notification.js
1785000000000-add-hatady.js … 1787600000000-add-hatady-goal.js（Hatady 12本）
1787900000000-private-channel-invitation.js      1788100000000-add-hatady-media.js
1788200000000-add-hatask-emotion-analysis.js     1788400000000-add-hatask-flowers.js
1788800000000-add-hatask-ranking.js              1788900000000-add-hatadint-consent.js（← 3-2）
1788990000000-add-hatask-event-members.js        1789080000000-add-hatask-support.js（← 3-1）
1789170000000-extend-hatady-records.js           1789250000000-add-hatady-moderation-review.js
1789260000000-add-hatask-record-review.js        1789500000000-add-hatady-record-attachments.js
1790035200000-feedback-emoji-changes.js          1790035300000-record-moderation.js
1790035500000-hatask-recipes.js                  1790290000000-hatask-flower-v2.js
1790380100000-hatask-recipe-reference-links.js   1790380200000-expand-hatady-log-subject.js
1790380300000-feedback-issue-integrity.js        1790380400000-hatask-avatar-decoration-rewards.js
1792425600000-hataigo.js                         1792886400000-note-charm.js
1793059200000-note-charm-consent.js
```

## 6. 調査の限界

- 拾い方は**名前と文字列の一致**。命名規則から外れたファイル（例: 特定機能のためだけにある汎用名の部品）は漏れている可能性がある。削除後の型検査で拾うのが確実
- import の解決は `@/` と相対パスだけ。`defineAsyncComponent` の文字列や、ルーター定義の動的 import は文字列一致の側（`*.touch.txt`）にだけ出る
- 削除候補の中に、残す機能から呼ばれている部品が混ざっている可能性がある（Hatadint のように）。§3 の判断が出たら一覧を確定させる
