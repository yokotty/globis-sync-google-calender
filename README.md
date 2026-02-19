# GLOBIS Google Calendar Sync (Chrome Extension)

GLOBIS Virtual Campus（`https://vc.globis.ac.jp/my/*`）上の予定情報を読み取り、Google カレンダーへ登録する Chrome 拡張です。

## 機能

- Google OAuth（`chrome.identity`）でユーザーの Google アカウントに認可
- Google Calendar API で予定を作成
- `globisKey` による重複チェック（既存予定があればスキップ）
- 投稿本文中の URL（Zoom / Teams など）をカレンダーに反映
  - 説明欄: `関連URL: ...`
  - `event.source.url`

## 対応ページ

1. 申込・履修（クラス一覧）
- 「初回開講日」のカレンダーアイコンをクリック
- 開講スケジュールモーダル下部に `Googleカレンダーにスケジュール登録` を表示
- Day1..N をまとめて登録

2. 所属クラス > クラス詳細
- 各 Day の「授業に参加」行に `Googleカレンダー登録` を表示（1件登録）
- ページ下部に `Googleカレンダーに一括登録` を表示（全 Day 登録）

3. 申込み済イベントページ
- 各イベントの「開催日時」行に `Googleカレンダー登録` を表示（1件登録）

4. 勉強会・懇親会（サイドカード）
- 各カードに `Googleカレンダー登録` を表示（1件登録）

5. 投稿イベント（参加/不参加ボタンがある投稿）
- 「開催日時」行に `Googleカレンダー登録` を表示（1件登録）

## タイトル規則

- クラス Day: `（科目） （開催場所） （クラス） DayN`
  - 例: `(MBA)人材マネジメント 東京 Aクラス Day4`
- 単発イベント: `（イベント名）`
- 勉強会・懇親会 / 投稿イベント: `（講義名） （投稿タイトル） ...`
  - 例: `(MBA)人材マネジメント Day4 勉強会 Zoom`

## 時刻の扱い

- タイムゾーン: `JST -> Asia/Tokyo`
- 終了時刻がない投稿イベントは 1 時間固定で補完

## Google OAuth 設定

`manifest.json` の設定:

- `permissions`: `identity`
- `host_permissions`: `https://www.googleapis.com/*`
- `oauth2.client_id`: Chrome 拡張用 OAuth クライアント ID
- `oauth2.scopes`: `https://www.googleapis.com/auth/calendar.events`

現在の `client_id`:
- `989370473965-8usmc90m8ttts3b1qlfi9he955sgkn2q.apps.googleusercontent.com`

## インストール（開発版）

1. `chrome://extensions` を開く
2. 「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」でこのリポジトリを選択
4. GLOBIS VC 対象ページを再読み込み

## 動作確認

1. 対象ページで `Googleカレンダー登録`（または一括登録リンク）をクリック
2. 初回のみ Google の認可画面で許可
3. Google カレンダーに予定が作成されることを確認
4. 同じ予定を再登録した場合、重複はスキップされることを確認

## テスト

```bash
node --test tests/*.test.js
```

主なテスト対象:
- スケジュール文字列パース
- 投稿イベント日時パース（終了時刻なし補完含む）
- カレンダーペイロード生成
- 重複検知 URL と判定

## ファイル構成（主要）

- `manifest.json`: 拡張定義 / OAuth 設定
- `content.js`: DOM 解析 / 登録リンク注入 / background 連携
- `background.js`: OAuth / Calendar API 呼び出し
- `schedule_parser.js`: クラススケジュール文字列パーサー
- `community_parser.js`: 投稿・勉強会日時パーサー
- `calendar_payload.js`: Calendar API 向け event body 生成
- `calendar_dedupe.js`: 重複検知ヘルパー

## プライバシー

- `PRIVACY_POLICY.md` を参照
