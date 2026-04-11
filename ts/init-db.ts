import { DB_DEF, DB_NM, DB_VERSION } from "../db/db_def";

type SchemaText = string;
type DBDefMap = Record<string, SchemaText>;

type ParsedIndex = {
  indexName: string;
  keyPath: string | string[];
};

function parseSchema(schemaText: SchemaText): string[] {
  return schemaText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIndexToken(token: string): ParsedIndex {
  const compound = token.startsWith("[") && token.endsWith("]");
  const raw = compound ? token.slice(1, -1) : token;
  const keyPath = compound ? raw.split("+").map((k) => k.trim()) : raw;
  const indexName = raw.replace(/\+/g, "__");
  return { indexName, keyPath };
}

function ensureStoreAndIndexes(
  db: IDBDatabase,
  tx: IDBTransaction,
  storeName: string,
  schemaText: SchemaText,
): void {
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

export function openYGDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NM, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      const tx = req.transaction;
      if (!tx) {
        return;
      }

      for (const [storeName, schema] of Object.entries(DB_DEF as DBDefMap)) {
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

function requestToPromise<T = unknown>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error || new Error("IndexedDB request failed"));
  });
}

function waitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error || new Error("IndexedDB transaction aborted"));
    tx.onerror = () =>
      reject(tx.error || new Error("IndexedDB transaction failed"));
  });
}

function buildWorldId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `w_${Date.now()}_${rand}`;
}

async function seedInitialWorldAndStateIfNeeded(
  db: IDBDatabase,
): Promise<void> {
  const tx = db.transaction(["worlds", "app_state"], "readwrite");
  const worldsStore = tx.objectStore("worlds");
  const appStateStore = tx.objectStore("app_state");

  const worldsCount = await requestToPromise<number>(worldsStore.count());
  if (worldsCount > 0) {
    await waitTransaction(tx);
    return;
  }

  const now = Date.now();
  const wId = buildWorldId();

  worldsStore.add({
    wId,
    ord: 1,
    nm: "最初の世界",
    mapImgPath: "f_1775831884728_e6pwb9.jpg",
    mode: "edit",
    isLocked: 0,
    progress: 0,
    t_c: now,
    t_u: now,
  });

  appStateStore.put({
    key: "worlds",
    vTxt: wId,
    t_c: now,
    t_u: now,
  });

  await waitTransaction(tx);
}

async function hasYGDatabase(): Promise<boolean | null> {
  const dbApi = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };

  if (typeof dbApi.databases !== "function") {
    return null;
  }

  const dbs = await dbApi.databases();
  return dbs.some((db) => db.name === DB_NM);
}

export async function ensureYGDatabase(): Promise<void> {
  const existed = await hasYGDatabase();
  const db = await openYGDatabase();

  if (existed === false) {
    await seedInitialWorldAndStateIfNeeded(db);
  }

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
