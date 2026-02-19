# GLOBIS Google Calendar Sync (Chrome Extension PoC)

GLOBIS Virtual Campus（`https://vc.globis.ac.jp/my/*`）で、表示中の予定を Google カレンダーへ登録する Chrome 拡張です。

## 対応ページ

1. 申込・履修（クラス一覧）
- 「初回開講日」のカレンダーアイコンをクリック後、開講スケジュールモーダル下部に
  `Googleカレンダーにスケジュール登録` を表示
- クリックで Day1..N をまとめて登録

2. 所属クラス > クラス詳細
- 各 Day の「授業に参加」 > 「開催日時」欄の下に
  `Googleカレンダー登録` を表示（その Day 1件を登録）
- ページ下部に `Googleカレンダーに一括登録` を表示（全 Day を登録）

3. 申込み済イベントページ
- 各イベントの「開催日時」欄の下に
  `Googleカレンダー登録` を表示（そのイベント 1件を登録）

## タイトル形式

- クラス詳細（Day）
  - `（科目） （開催場所） （クラス） DayN`
  - 例: `(MBA)人材マネジメント 東京 Aクラス Day4`
- イベント（単発）
  - `（イベント名）`

## Google OAuth 設定（必須）

`manifest.json` に OAuth クライアントIDとスコープを設定します。

- `oauth2.client_id`: Chrome 拡張用 OAuth クライアントID
- `oauth2.scopes`: `https://www.googleapis.com/auth/calendar.events`

現在の設定値:
- `989370473965-8usmc90m8ttts3b1qlfi9he955sgkn2q.apps.googleusercontent.com`

## セットアップ

1. Chromeで `chrome://extensions` を開く
2. 「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選択
4. 対象ページを再読み込み

## 動作確認

1. 対象ページで登録リンクをクリック
2. 初回のみ Google 認可画面で許可
3. 登録後、Google カレンダー側に予定が作成されることを確認

## 開発メモ

- 予定作成は `background.js` で Google Calendar API `events.insert` を呼び出し
- OAuth は `chrome.identity.getAuthToken` を使用
- タイムゾーンは `JST -> Asia/Tokyo` で変換

## テスト

```bash
node --test tests/*.test.js
```

## 既知の制約

- 重複登録防止（既存イベント照合）は未実装
- ページDOM変更時はセレクタ調整が必要になる可能性あり
