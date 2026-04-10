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

  // 🗺️ ステージ（top.html）
  // mode: edit | run
  // isLocked: 配布マップなど編集不可時に1
  stages:
    "stgId, ord, cat, nm, desc, mode, isLocked, coverFId, bgFId, x, y, w, h, rot, clr, memo, t_c, t_u",

  // 🗺️ マップ（maps.html）
  maps: "mpId, stgId, ord, cat, nm, desc, mode, isLocked, coverFId, bgFId, x, y, w, h, rot, clr, memo, t_c, t_u",

  // ⚔️ タスク（map.html）
  // parentTkId: 親タスクID（ルートは null/空）
  // layer: 階層の深さ（ルート=0, 子=1, 孫=2...）
  // nodeType: stage_goal | milestone | task など用途分類
  // state: todo | doing | done | sealed
  // requiresApproval: 第三者承認が必要なタスクに1
  tasks:
    "tkId, mpId, parentTkId, [mpId+parentTkId], [mpId+layer+ord], [mpId+state], ord, layer, nodeType, cat, nm, desc, state, hpMax, hpNow, progress, enemyNm, dueY, dueM, dueD, requiresApproval, iconFId, beforeFId, afterFId, x, y, w, h, rot, clr, vis, isLocked, memo, t_c, t_u",

  // ⛓️ 依存関係（同一tasks内の任意ノード間）
  // srcType/dstType: task 固定（将来拡張用に保持）
  // relType: blocks | unlocks | recommends
  task_links:
    "id, mpId, [srcType+srcId], [dstType+dstId], [srcType+srcId+dstType+dstId], srcType, srcId, dstType, dstId, relType, ord, memo, t_c, t_u",

  // ✅ 承認トークン（拡張機能）
  approval_tokens:
    "atId, tkId, codeHash, issuedBy, expiresAt, usedAt, st, memo, t_c, t_u",

  // ✨ 演出ログ（撃破履歴）
  // objType: task
  defeat_logs:
    "dlId, [objType+objId], objType, objId, result, score, jsn, memo, t_c, t_u",

  // 📦 JSON出力スナップショット
  map_exports: "mxId, stgId, mpId, ver, nm, jsn, memo, t_c, t_u",
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
  "top.html": ["stages"],
  "maps.html": ["stages", "maps"],
  "map.html": ["maps", "tasks", "task_links"],
};

/**
 * MVPで一覧取得時に優先する読み込み順
 */
export const TABLE_ORDER: string[] = ["stages", "maps", "tasks", "task_links"];
