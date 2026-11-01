# ゆっくり歌の練習

大きな歌詞を見ながら、音声を一節ずつ繰り返して練習する静的サイトです。HTML・CSS・JavaScriptで動作し、ビルドは不要です。

公開サイト: https://hokang-lee.github.io/song-practice/

## 機能

- 4曲の選択、最後に選んだ曲の記憶
- 再生・一時停止・速度変更・歌詞の行から頭出し・行の反復再生
- 再生中の歌詞の強調、文字サイズ変更
- 音声の読み込み中に選んだ行の頭出し予約
- ページが非表示になった際の一時停止（スクロールでは停止しません）
- MP3・M4A・WAV・MP4などのローカルファイルを使用（MP4は音声のみ再生）
- 自作曲の音源・曲名・時刻付き歌詞を端末内に保存、再読み込み

## 起動

リポジトリを取得し、ルートで次を実行します（Python 3が必要です）。

```sh
git clone https://github.com/Hokang-Lee/song-practice.git
cd song-practice
python -m http.server 8000 --directory dist --bind 127.0.0.1
```

http://127.0.0.1:8000/ をブラウザで開いてください。保存機能のため、HTMLの直接起動ではなくHTTPでの起動を推奨します。本番はHTTPSで配信してください。

## 構成

| ファイル | 用途 |
| --- | --- |
| `dist/index.html` | 画面 |
| `dist/style.css` | 空色を基調とした配色・レイアウト |
| `dist/app.js` | 再生、歌詞同期、曲選択 |
| `dist/library.js` | IndexedDBによる端末保存 |
| `dist/song.js` | 最初の曲の定義 |
| `dist/songs.js` | 収録曲一覧・時刻付き歌詞 |
| `dist/audio/*.m4a` | 公開サイトで使う4曲の音声 |
| `.openai/hosting.json` | 既存Sitesの公開先IDと静的ファイル設定（認証情報なし） |
| `check.cjs` | 再生・歌詞・曲切替の自動チェック |
| `check-library.cjs` | 端末保存のブラウザチェック |

## 曲の追加・修正

`dist/audio/` に音声を置き、`dist/songs.js` の配列へ曲名・音声パス・歌詞を追加します。歌詞は次の形式です。

```text
[00:15]最初の歌詞
[00:22]次の歌詞
[00:28.5]その次の歌詞
```

時刻は昇順・重複不可です。各行は次の行の開始直前まで、最後の行は音声の最後まで繰り返します。現時点で歌詞時刻の自動推定はサイト本体には組み込んでいません。

## 端末保存

曲の入力欄の「この端末に保存」で、音源も歌詞と一緒にIndexedDBへ保存します。保存のたびに新しい記録を追加します。外部送信・端末間同期は行いません。

保存内容は同じ端末・ブラウザ・サイトのURLでのみ利用できます。ブラウザのデータ削除や容量管理で失われる場合があるため、元の音源と歌詞は保管してください。公開曲を更新しても、端末保存済みのコピーは自動更新されません。

## 確認

Node.js 20以上で基本チェックを実行できます（追加ライブラリ不要）。

```sh
node check.cjs
```

端末保存のブラウザチェックにはPlaywrightを使います。

```sh
npm install
npx playwright install chromium
npm run test:browser
```

既存のChrome/Edgeを使う場合は、環境変数 `PLAYWRIGHT_EXECUTABLE_PATH` に実行ファイルのパスを指定できます。

## 公開とGitHub管理

`main` にプッシュすると `.github/workflows/pages.yml` が基本チェックを実行し、成功した場合に `dist/` をGitHub Pagesへ自動公開します。Actions画面から手動実行もできます。公開状況はGitHubのActionsタブで確認してください。

GitHubの Settings → Pages → Build and deployment の Source は `GitHub Actions` を使用します。認証にはワークフローの組み込みトークンを使い、個人トークンの登録は不要です。

旧SitesのURLとは別の保存領域になるため、旧サイトで端末保存した自作曲や選択状態は自動移行されません。必要な曲は元の音源と歌詞を使って新サイトで保存してください。`.openai/hosting.json` は旧Sitesの識別情報として保持していますが、GitHub Pagesの公開には使いません。

元のMP4、音声認識モデル、解析用ライブラリ、一時ファイル、端末内の利用者データは、このリポジトリには含めません。
