import { DB_DEF } from "../ts/db_def";
import { downloadYGBackupJson, restoreYGBackupFromFile } from "./db-backup";
import { applyI18n, t } from "./i18n";
import { ensureYGDatabase, openYGDatabase } from "./init-db";

const tableSelect = document.getElementById(
  "db_table_select",
) as HTMLSelectElement | null;
const refreshBtn = document.getElementById(
  "db_refresh_table_btn",
) as HTMLButtonElement | null;
const clearBtn = document.getElementById(
  "db_clear_table_btn",
) as HTMLButtonElement | null;
const bulkDeleteBtn = document.getElementById(
  "db_bulk_delete_btn",
) as HTMLButtonElement | null;
const exportBtn = document.getElementById(
  "db_export_btn",
) as HTMLButtonElement | null;
const importBtn = document.getElementById(
  "db_import_btn",
) as HTMLButtonElement | null;
const importInput = document.getElementById(
  "db_import_input",
) as HTMLInputElement | null;
const recordCountEl = document.getElementById(
  "db_record_count",
) as HTMLElement | null;
const usageEl = document.getElementById("db_table_usage") as HTMLElement | null;
const grid = document.getElementById("db_maint_grid") as HTMLElement | null;

const selectedByTable = new Map<string, Set<string>>();
const keyByToken = new Map<string, Map<string, unknown>>();

void initDbMaint();

async function initDbMaint(): Promise<void> {
  if (!tableSelect || !grid) {
    return;
  }

  applyI18n(document);

  await ensureYGDatabase();

  const tableNames = Object.keys(DB_DEF);
  for (const tableName of tableNames) {
    const opt = document.createElement("option");
    opt.value = tableName;
    opt.textContent = tableName;
    tableSelect.append(opt);
  }

  const initialTable = tableNames[0] || "";
  if (initialTable) {
    tableSelect.value = initialTable;
    await renderTable(initialTable);
  }

  tableSelect.addEventListener("change", () => {
    const tableName = tableSelect.value;
    void renderTable(tableName);
  });

  refreshBtn?.addEventListener("click", () => {
    if (!tableSelect.value) {
      return;
    }
    void renderTable(tableSelect.value);
  });

  clearBtn?.addEventListener("click", () => {
    if (!tableSelect.value) {
      return;
    }
    const ok = window.confirm(
      t("confirm_clear_table", { table: tableSelect.value }),
    );
    if (!ok) {
      return;
    }
    void clearTable(tableSelect.value);
  });

  bulkDeleteBtn?.addEventListener("click", () => {
    if (!tableSelect.value) {
      return;
    }
    void deleteSelectedRows(tableSelect.value);
  });

  exportBtn?.addEventListener("click", () => {
    void downloadYGBackupJson();
  });

  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => {
      importInput.click();
    });

    importInput.addEventListener("change", () => {
      const file = importInput.files?.[0];
      if (!file) {
        return;
      }
      void (async () => {
        try {
          await restoreYGBackupFromFile(file);
          window.alert(t("restore_success"));
          if (tableSelect.value) {
            await renderTable(tableSelect.value);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : t("restore_failed");
          window.alert(message);
        }
      })();
      importInput.value = "";
    });
  }
}

async function renderTable(tableName: string): Promise<void> {
  if (!grid) {
    return;
  }

  const rows = await fetchAllRows(tableName);
  const pk = getPk(tableName);
  const columns = buildColumns(tableName, rows);

  const tokenMap = new Map<string, unknown>();
  keyByToken.set(tableName, tokenMap);

  const table = document.createElement("table");
  table.className = "db_maint_table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  const selectHead = document.createElement("th");
  selectHead.className = "db_select_col";
  selectHead.textContent = t("select_header");
  headRow.append(selectHead);

  const delHead = document.createElement("th");
  delHead.className = "db_del_col";
  delHead.textContent = t("delete_header");
  headRow.append(delHead);

  for (const col of columns) {
    const th = document.createElement("th");
    th.textContent = col;
    headRow.append(th);
  }

  thead.append(headRow);
  table.append(thead);

  const selected = getSelectedSet(tableName);

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    const pkValue = row[pk];
    const token = encodeKeyToken(pkValue);
    tokenMap.set(token, pkValue);

    const selectCell = document.createElement("td");
    selectCell.className = "db_select_col";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selected.has(token);
    cb.addEventListener("change", () => {
      if (cb.checked) {
        selected.add(token);
      } else {
        selected.delete(token);
      }
      syncBulkDeleteButton(tableName);
    });
    selectCell.append(cb);
    tr.append(selectCell);

    const delCell = document.createElement("td");
    delCell.className = "db_del_col";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "×";
    delBtn.title = t("row_delete_title");
    delBtn.addEventListener("click", () => {
      const ok = window.confirm(
        t("confirm_delete_row", { pk: String(pkValue) }),
      );
      if (!ok) {
        return;
      }
      void deleteRow(tableName, pkValue);
    });
    delCell.append(delBtn);
    tr.append(delCell);

    for (const col of columns) {
      const td = document.createElement("td");
      const value = row[col];
      const display = document.createElement("span");
      display.className = "db_cell_display";
      display.textContent = formatCellValue(value);
      td.append(display);

      if (col !== pk) {
        td.addEventListener("dblclick", () => {
          openCellEditor(td, tableName, row, col);
        });
      }

      tr.append(td);
    }

    tbody.append(tr);
  }

  table.append(tbody);
  grid.innerHTML = "";
  grid.append(table);

  if (recordCountEl) {
    recordCountEl.textContent = t("record_count", { count: rows.length });
  }
  if (usageEl) {
    usageEl.textContent = t("usage_text", {
      size: formatBytes(estimateRowsBytes(rows)),
    });
  }

  syncBulkDeleteButton(tableName);
}

function openCellEditor(
  td: HTMLTableCellElement,
  tableName: string,
  row: Record<string, unknown>,
  columnName: string,
): void {
  const current = row[columnName];
  if (current instanceof Blob) {
    return;
  }

  const input = document.createElement("textarea");
  input.className = "db_cell_input";
  input.value = toEditorText(current);
  td.innerHTML = "";
  td.append(input);
  input.focus();

  const commit = async () => {
    const nextValue = parseEditedValue(current, input.value);
    row[columnName] = nextValue;
    await saveRow(tableName, row);
    await renderTable(tableName);
  };

  const cancel = () => {
    void renderTable(tableName);
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void commit();
    }
  });

  input.addEventListener("blur", () => {
    void commit();
  });
}

async function fetchAllRows(
  tableName: string,
): Promise<Record<string, unknown>[]> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction(tableName, "readonly");
    const store = tx.objectStore(tableName);
    return (await requestToPromise(store.getAll())) as Record<
      string,
      unknown
    >[];
  } finally {
    db.close();
  }
}

async function saveRow(
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

async function deleteRow(tableName: string, pkValue: unknown): Promise<void> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction(tableName, "readwrite");
    const store = tx.objectStore(tableName);
    await requestToPromise(store.delete(pkValue as IDBValidKey));
    await transactionDone(tx);
  } finally {
    db.close();
  }

  const set = getSelectedSet(tableName);
  set.delete(encodeKeyToken(pkValue));
  await renderTable(tableName);
}

async function clearTable(tableName: string): Promise<void> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction(tableName, "readwrite");
    const store = tx.objectStore(tableName);
    await requestToPromise(store.clear());
    await transactionDone(tx);
  } finally {
    db.close();
  }

  getSelectedSet(tableName).clear();
  await renderTable(tableName);
}

async function deleteSelectedRows(tableName: string): Promise<void> {
  const set = getSelectedSet(tableName);
  if (set.size === 0) {
    return;
  }

  const ok = window.confirm(t("confirm_delete_selected", { count: set.size }));
  if (!ok) {
    return;
  }

  const map = keyByToken.get(tableName) || new Map<string, unknown>();
  const db = await openYGDatabase();

  try {
    const tx = db.transaction(tableName, "readwrite");
    const store = tx.objectStore(tableName);
    for (const token of set) {
      if (!map.has(token)) {
        continue;
      }
      await requestToPromise(store.delete(map.get(token) as IDBValidKey));
    }
    await transactionDone(tx);
  } finally {
    db.close();
  }

  set.clear();
  await renderTable(tableName);
}

function getPk(tableName: string): string {
  const schema = (DB_DEF as Record<string, string>)[tableName] || "";
  return schema.split(",")[0].trim();
}

function getSchemaColumns(tableName: string): string[] {
  const schema = (DB_DEF as Record<string, string>)[tableName] || "";
  if (!schema) {
    return [];
  }

  return schema
    .split(",")
    .map((part) => part.trim())
    .filter((part) => !part.includes("[") && !part.includes("]"));
}

function buildColumns(
  tableName: string,
  rows: Record<string, unknown>[],
): string[] {
  const schemaCols = getSchemaColumns(tableName);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const col of schemaCols) {
    if (!seen.has(col)) {
      seen.add(col);
      out.push(col);
    }
  }

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  }

  return out;
}

function estimateRowsBytes(rows: Record<string, unknown>[]): number {
  let sum = 0;
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const value = row[key];
      if (value instanceof Blob) {
        sum += value.size;
        continue;
      }
      try {
        sum += new Blob([JSON.stringify(value ?? "")]).size;
      } catch {
        sum += String(value ?? "").length;
      }
    }
  }
  return sum;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatCellValue(value: unknown): string {
  if (value instanceof Blob) {
    return `[Blob ${formatBytes(value.size)} ${value.type || "application/octet-stream"}]`;
  }
  if (value == null) {
    return "";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

function toEditorText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }
  return String(value);
}

function parseEditedValue(original: unknown, text: string): unknown {
  const trimmed = text.trim();

  if (typeof original === "number") {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : original;
  }

  if (typeof original === "boolean") {
    if (trimmed === "true") {
      return true;
    }
    if (trimmed === "false") {
      return false;
    }
    return original;
  }

  if (original == null) {
    if (trimmed === "") {
      return "";
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return text;
    }
  }

  if (typeof original === "object") {
    try {
      return JSON.parse(trimmed);
    } catch {
      return original;
    }
  }

  return text;
}

function getSelectedSet(tableName: string): Set<string> {
  let selected = selectedByTable.get(tableName);
  if (!selected) {
    selected = new Set<string>();
    selectedByTable.set(tableName, selected);
  }
  return selected;
}

function encodeKeyToken(value: unknown): string {
  return `${typeof value}:${JSON.stringify(value)}`;
}

function syncBulkDeleteButton(tableName: string): void {
  if (!bulkDeleteBtn) {
    return;
  }
  const set = getSelectedSet(tableName);
  bulkDeleteBtn.disabled = set.size === 0;
  bulkDeleteBtn.textContent =
    set.size > 0
      ? t("bulk_delete_with_count", { count: set.size })
      : t("bulk_delete");
}

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
