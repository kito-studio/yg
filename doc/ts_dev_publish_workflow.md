# YGトップページ TS開発/公開ワークフロー

このドキュメントは、YGトップページの開発と公開をAI/開発者が同じ手順で扱うための運用定義です。

## 目的

- 開発時は TypeScript を使う。
- 公開時は JavaScript に変換した成果物を使う。
- AI が誤って公開用ファイルを直接編集しないようにする。

## 正本ファイル（Source of Truth）

- 開発用HTML: `yg/index_ts.html`
- 公開用HTML: `yg/index.html`
- 開発用TS: `yg/ts/top-page.ts`, `yg/ts/init-db.ts`
- 公開用JS: `yg/js/top-page.js`, `yg/js/init-db.js`

## AI作業ルール

1. 機能追加・仕様変更は `yg/index_ts.html` と `yg/ts/*` を編集する。
2. `yg/index.html` と `yg/js/*` は公開反映（同期）以外では直接編集しない。
3. 公開反映が必要なタイミングでのみ、下記「公開反映手順」を実施する。

## 公開反映手順（TS => JS）

### 1. TSをJSへ変換

プロジェクトルートで実行:

```powershell
npx esbuild yg/ts/top-page.ts --bundle --format=esm --target=es2022 --outfile=yg/js/top-page.js
npx esbuild yg/ts/init-db.ts --bundle --format=esm --target=es2022 --outfile=yg/js/init-db.js
```

### 2. 開発用HTMLを公開用HTMLへ同期

`index_ts.html` を `index.html` に同期し、`./ts/top-page.ts` 参照を `./js/top-page.js` に置換する。

PowerShell例:

```powershell
$src = Get-Content yg/index_ts.html -Raw
$dist = $src.Replace('./ts/top-page.ts', './js/top-page.js')
Set-Content yg/index.html $dist -Encoding UTF8
```

### 3. 反映確認

- `yg/index.html` が `./js/top-page.js` を参照していること。
- `yg/js/top-page.js` が最新のTS変更を含んでいること。
- 必要に応じてブラウザで `yg/index.html` を開き動作確認すること。

## 備考

- 将来 `yg/ts` 配下のエントリが増えた場合は、この手順に変換対象を追記する。
- 自動化する場合は、同内容の npm script を追加してこのドキュメントを更新する。
