import { openYGDatabase } from "../init-db";

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
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

export async function getAppStateText(key: string): Promise<string | null> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("app_state", "readonly");
    const store = tx.objectStore("app_state");
    const row = (await requestToPromise(store.get(key))) as
      | { vTxt?: string }
      | undefined;
    const vTxt = row?.vTxt;
    return typeof vTxt === "string" && vTxt.trim().length > 0 ? vTxt : null;
  } finally {
    db.close();
  }
}

export async function setAppStateText(
  key: string,
  vTxt: string | null,
): Promise<void> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("app_state", "readwrite");
    const store = tx.objectStore("app_state");
    const now = Date.now();
    const existing = (await requestToPromise(store.get(key))) as
      | { t_c?: number }
      | undefined;

    await requestToPromise(
      store.put({
        key,
        vTxt,
        t_c: Number(existing?.t_c || now),
        t_u: now,
      }),
    );

    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function fetchAllRows<T = Record<string, unknown>>(
  tableName: string,
): Promise<T[]> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction(tableName, "readonly");
    const store = tx.objectStore(tableName);
    return (await requestToPromise(store.getAll())) as T[];
  } finally {
    db.close();
  }
}

export async function putRow(
  tableName: string,
  row: Record<string, unknown>,
): Promise<void> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction(tableName, "readwrite");
    const store = tx.objectStore(tableName);
    await requestToPromise(store.put(row));
    await transactionDone(tx);
  } finally {
    db.close();
  }
}
