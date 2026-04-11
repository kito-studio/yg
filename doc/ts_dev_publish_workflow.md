# YGトップページ TS開発/公開ワークフロー

このドキュメントは、YGトップページを Cloudflare ビルド前提で運用するための定義です。

## 目的

- GitHub はソース保管場所として扱う。
- 変換済み JS をリポジトリ管理しない。
- HTML と TS を正本として Cloudflare 側でビルドする。

## 正本ファイル（Source of Truth）

- HTML: `yg/index.html`, `yg/maps.html`, `yg/map.html`, `yg/db_maint.html`, `yg/settings.html`
- TypeScript: `yg/ts/top-page.ts`, `yg/ts/stage-page.ts`, `yg/ts/map-page.ts`, `yg/ts/db-maint.ts`, `yg/ts/db-backup.ts`, `yg/ts/settings.ts`, `yg/ts/i18n.ts`, `yg/ts/init-db.ts`, `yg/ts/data/yg-idb.ts`, `yg/ts/state/selection.ts`, `yg/ts/ui/common-header.ts`, `yg/ts/ui/common-dialog.ts`, `yg/ts/ui/entity-edit-dialog.ts`

## AI作業ルール

1. 機能追加・仕様変更は `yg/*.html` と `yg/ts/*` を直接編集する。
2. `yg/js/*` のような変換成果物は新規作成しない。
3. 公開時の TS => JS 手動変換手順は実施しない。

## 確認手順

1. `yg/index.html` が `./ts/top-page.ts` を参照していること。
2. `yg/maps.html` が `./ts/stage-page.ts` を参照していること。
3. `yg/map.html` が `./ts/map-page.ts` を参照していること。
4. `yg/db_maint.html` が `./ts/db-maint.ts` を参照していること。
5. `yg/settings.html` が `./ts/settings.ts` を参照していること。
6. 必要に応じてローカルで `npm run build` / `npm run typecheck` を実行すること。

## 備考

- Cloudflare のビルド設定変更時は、このドキュメントを先に更新する。
