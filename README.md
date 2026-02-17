# GLOBIS Schedule Extractor + Google Calendar PoC

このPoCは、`https://vc.globis.ac.jp/my/*` 上で「初回開講日セルのカレンダーアイコン」をクリックしたときに、以下を Chrome DevTools Console に出力します。

- クリックされた行のテーブル情報（科目、開講期、開催場所、クラス、講師、初回開講日、曜日、時間）
- クリック前後に発生した関連ネットワーク（fetch/XHR）のURL・ステータス・レスポンス先頭
- 開いたモーダル/ダイアログに含まれる日付・時刻テキスト候補
- 抽出したスケジュールの構造化結果 `[{date,start,end,timezone,dayNo}]`
- ユーザー確認後、Googleカレンダーへ予定作成（PoC）

## Google OAuth 設定（必須）

1. Google Cloud Console で OAuth クライアント（Chrome 拡張）を作成
2. 拡張機能IDを固定化して、そのIDでOAuthクライアントを紐付け
3. `manifest.json` の `oauth2.client_id` を実値に置き換える
4. スコープは `https://www.googleapis.com/auth/calendar.events`

## 使い方

1. Chromeで `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選択
4. GLOBISの対象ページを開く（または再読み込み）
5. DevTools Console を開く
6. 初回開講日のカレンダーアイコンをクリック
7. `[GLOBIS PoC]` で始まるログを確認

## 補足

- クリック後に「Googleカレンダーに n 件作成しますか？」ダイアログが表示されます。
- OAuth未設定時は作成に失敗し、コンソールにエラーを表示します。
- 実運用に向けては、重複作成回避（既存イベント照合）を追加してください。
