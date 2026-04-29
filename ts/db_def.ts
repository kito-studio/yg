// ここを《📐テータベース設計書》 としても使う
// ✨️共通属性
// 🗒️t_c 作成日時
// 🗒️t_u 更新日時（最終）
// 🗒️**Id そのオブジェクトのId
// 🗒️id 紐づけテーブルのId（接頭詞不要）
// 🗒️nm name 全角
// 🗒️desc 作品の説明文（公式風）
// 🗒️ver バージョン
// 🗒️memo ユーザーが使うメモ。パラメータとか入れない。
// 🗒️cat カテゴリ
// 🗒️ord 順序（小さいほど前）
// 🗒️txt 文字列（改行可）
// 🗒️jsn JSON形式のデータ
// 🗒️pos*(X,Y,Z) positionデータ
// 🗒️rot*(X,Y,Z) rotationデータ
// 🗒️scl*(X,Y,Z) scaleデータ
// 🗒️vis 可視不可視
// 🗒️c*(X,Y) 二次元座標
// 🗒️size サイズ（defaultSize は初期値）
// 🗒️rot 回転

// ✨️方針
// **Id は頭にテーブル名の略称をつけ、長くなりすぎないように１０桁程度に収める❢

// 《☀️DB定義》
export const DB_NM = "YG";
export const DB_VERSION = 1; // 開発中は 1 固定。マイグレーション機構は設けない。

export const DB_DEF = {
  // 🟦 基本キャッシュ
  // キー値キャッシュ（現在モード、最終選択IDなど）
  app_state: "key, vTxt, vJsn, memo, t_c, t_u",

  // 💾 添付ファイル（背景画像/SE/BGM/報酬画像など）
  // fId: ファイルID（拡張子付き推奨）
  files: "fId, ext, nm, mime, size, body, bin, memo, t_c, t_u",

  // 🌍 世界（index.html）
  // mode: edit | run
  // isLocked: 配布マップなど編集不可時に1
  worlds:
    "wId, ord, cat, nm, desc, mode, isLocked, status, progress, mapImgPath, coverFId, bgFId, bgmFId, memo, t_c, t_u",

  // 🗺️ ステージ（index.html）
  // parentStgId: 親ステージID（ルートは null/空）
  // 階層ステージで「世界地図」「ステージ地図」を共通表現する
  // mode: edit | run
  // isLocked: 配布マップなど編集不可時に1
  stages:
    "stgId, wId, parentStgId, [wId+ord], [wId+parentStgId], [parentStgId+ord], ord, cat, nm, desc, mode, isLocked, status, progress, imgPath, mapImgPath, spriteCol, spriteRow, spriteTone, coverFId, bgFId, bgmFId, x, y, w, h, rot, clr, memo, t_c, t_u",

  // ⚔️ タスク（index.html 内のステージ詳細）
  // wId: 所属世界ID
  // stgId: 所属ステージID（世界直下タスクは null/空）
  // state: todo | doing | done | sealed
  // requiresApproval: 第三者承認が必要なタスクに1
  tasks:
    "tkId, wId, stgId, [wId+ord], [wId+state], [wId+stgId], [stgId+ord], [stgId+state], ord, cat, nm, desc, state, hpMax, hpNow, progress, enemyNm, dueY, dueM, dueD, requiresApproval, iconFId, beforeFId, afterFId, spriteCol, spriteRow, spriteTone, x, y, w, h, rot, clr, vis, isLocked, memo, t_c, t_u",

  // ⛓️ 依存関係（同一ステージ内の任意タスク間）
  // relType: blocks | unlocks | recommends
  task_links:
    "tlId, stgId, [stgId+srcId], [stgId+dstId], [stgId+srcId+dstId], srcId, dstId, relType, ord, memo, t_c, t_u",

  // ✅ 承認トークン（拡張機能）
  approval_tokens:
    "atId, tkId, codeHash, issuedBy, expiresAt, usedAt, st, memo, t_c, t_u",

  // ✨ 演出ログ（撃破履歴）
  // objType: task
  defeat_logs:
    "dlId, [objType+objId], objType, objId, result, score, jsn, memo, t_c, t_u",

  // 📦 JSON出力スナップショット
  stage_exports: "sxId, wId, stgId, ver, nm, jsn, memo, t_c, t_u",
};

/**
 * k: テーブル名, v: 主キー属性名
 */
export const PKM = getPrimaryKeyMap();
export function getPrimaryKeyMap(): { [key: string]: string } {
  const primaryKeys: { [key: string]: string } = {};
  for (const [tableName, fields] of Object.entries(DB_DEF)) {
    primaryKeys[tableName] = fields.split(",")[0].trim();
  }
  return primaryKeys;
}

/**
 * 画面ごとの主要テーブル対応（pages.txt ベース）
 */
export const PAGE_TABLES: { [page: string]: string[] } = {
  "index.html": ["worlds", "stages", "tasks", "task_links"],
};

/**
 * MVPで一覧取得時に優先する読み込み順
 */
export const TABLE_ORDER: string[] = [
  "worlds",
  "stages",
  "tasks",
  "task_links",
];
