import { DB_DEF, DB_NM } from "../db/db_def";
import { ensureYGDatabase, openYGDatabase } from "./init-db";

type BlobPack = {
  __blob: true;
  type: string;
  data: string;
};

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    };
    tx.onabort = () => {
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    };
  });
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function serializeRow(
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (value instanceof Blob) {
      const ab = await value.arrayBuffer();
      out[key] = {
        __blob: true,
        type: value.type || "application/octet-stream",
        data: arrayBufferToBase64(ab),
      } satisfies BlobPack;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function deserializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (
      value &&
      typeof value === "object" &&
      (value as { __blob?: boolean }).__blob === true &&
      typeof (value as { data?: unknown }).data === "string"
    ) {
      const blobInfo = value as BlobPack;
      out[key] = new Blob([base64ToArrayBuffer(blobInfo.data)], {
        type: blobInfo.type || "application/octet-stream",
      });
      continue;
    }
    out[key] = value;
  }
  return out;
}

export async function downloadYGBackupJson(): Promise<void> {
  await ensureYGDatabase();
  const db = await openYGDatabase();

  try {
    const tableNames = Object.keys(DB_DEF);
    const tables: Record<string, Record<string, unknown>[]> = {};

    for (const tableName of tableNames) {
      const tx = db.transaction(tableName, "readonly");
      const store = tx.objectStore(tableName);
      const rows = (await requestToPromise(store.getAll())) as Record<
        string,
        unknown
      >[];

      const serialized: Record<string, unknown>[] = [];
      for (const row of rows) {
        serialized.push(await serializeRow(row));
      }
      tables[tableName] = serialized;
    }

    const backup = {
      $schema: "yg-backup/v1",
      exportedAt: new Date().toISOString(),
      dbName: DB_NM,
      tables,
    };

    const text = JSON.stringify(backup);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .replace("Z", "");
    a.href = url;
    a.download = `yg-backup-${ts}.json`;
    a.style.display = "none";
    document.body.append(a);
    a.click();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  } finally {
    db.close();
  }
}

export async function restoreYGBackupFromFile(file: File): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text) as {
    $schema?: string;
    dbName?: string;
    tables?: Record<string, Record<string, unknown>[]>;
  };

  if (!parsed || typeof parsed !== "object" || !parsed.tables) {
    throw new Error("バックアップ形式が不正です。");
  }

  if (parsed.dbName && parsed.dbName !== DB_NM) {
    throw new Error("YG用バックアップではありません。");
  }

  await ensureYGDatabase();
  const db = await openYGDatabase();

  try {
    const validTableNames = Object.keys(DB_DEF);
    const tx = db.transaction(validTableNames, "readwrite");

    for (const tableName of validTableNames) {
      const store = tx.objectStore(tableName);
      await requestToPromise(store.clear());

      const srcRows = Array.isArray(parsed.tables[tableName])
        ? parsed.tables[tableName]
        : [];
      for (const row of srcRows) {
        await requestToPromise(store.put(deserializeRow(row)));
      }
    }

    await transactionDone(tx);
  } finally {
    db.close();
  }
}
