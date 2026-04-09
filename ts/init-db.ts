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

function openYGDatabase(): Promise<IDBDatabase> {
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

async function ensureYGDatabase(): Promise<void> {
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
