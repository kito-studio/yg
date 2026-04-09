const DB_NM = "YG";
const DB_VERSION = 1;

// ts/db/db_def.ts と同期すること。
const DB_DEF = {
  app_state: "key, vTxt, vJsn, memo, t_c, t_u",
  files: "fId, ext, nm, mime, size, body, bin, memo, t_c, t_u",
  stages:
    "stgId, ord, cat, nm, desc, mode, isLocked, coverFId, bgFId, x, y, w, h, rot, memo, t_c, t_u",
  maps: "mpId, stgId, ord, cat, nm, desc, mode, isLocked, coverFId, bgFId, x, y, w, h, rot, memo, t_c, t_u",
  tasks:
    "tkId, mpId, parentTkId, [mpId+parentTkId], [mpId+layer+ord], [mpId+state], ord, layer, nodeType, cat, nm, desc, state, hpMax, hpNow, progress, enemyNm, dueY, dueM, dueD, requiresApproval, iconFId, beforeFId, afterFId, x, y, w, h, rot, vis, isLocked, memo, t_c, t_u",
  task_links:
    "id, mpId, [srcType+srcId], [dstType+dstId], [srcType+srcId+dstType+dstId], srcType, srcId, dstType, dstId, relType, ord, memo, t_c, t_u",
  approval_tokens:
    "atId, tkId, codeHash, issuedBy, expiresAt, usedAt, st, memo, t_c, t_u",
  defeat_logs:
    "dlId, [objType+objId], objType, objId, result, score, jsn, memo, t_c, t_u",
  map_exports: "mxId, stgId, mpId, ver, nm, jsn, memo, t_c, t_u",
};

function parseSchema(schemaText) {
  return schemaText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIndexToken(token) {
  const compound = token.startsWith("[") && token.endsWith("]");
  const raw = compound ? token.slice(1, -1) : token;
  const keyPath = compound ? raw.split("+").map((k) => k.trim()) : raw;
  const indexName = raw.replace(/\+/g, "__");
  return { indexName, keyPath };
}

function ensureStoreAndIndexes(db, tx, storeName, schemaText) {
  const tokens = parseSchema(schemaText);
  if (tokens.length === 0) {
    return;
  }

  const primaryKey = tokens[0];
  const hasStore = db.objectStoreNames.contains(storeName);
  const store = hasStore
    ? tx.objectStore(storeName)
    : db.createObjectStore(storeName, { keyPath: primaryKey });

  for (const token of tokens.slice(1)) {
    const { indexName, keyPath } = parseIndexToken(token);
    if (store.indexNames.contains(indexName)) {
      continue;
    }
    store.createIndex(indexName, keyPath, { unique: false });
  }
}

function openYGDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NM, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      const tx = req.transaction;
      if (!tx) {
        return;
      }

      for (const [storeName, schema] of Object.entries(DB_DEF)) {
        ensureStoreAndIndexes(db, tx, storeName, schema);
      }
    };

    req.onsuccess = () => {
      resolve(req.result);
    };

    req.onerror = () => {
      reject(req.error || new Error("Failed to open YG database"));
    };
  });
}

async function hasYGDatabase() {
  if (typeof indexedDB.databases !== "function") {
    return null;
  }
  const dbs = await indexedDB.databases();
  return dbs.some((db) => db.name === DB_NM);
}

async function ensureYGDatabase() {
  const existed = await hasYGDatabase();
  const db = await openYGDatabase();
  db.close();

  if (existed === true) {
    console.info("[YG] Database already exists.");
  } else if (existed === false) {
    console.info("[YG] Database created.");
  } else {
    console.info("[YG] Database is ready.");
  }
}

void ensureYGDatabase();
