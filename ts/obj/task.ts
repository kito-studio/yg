import { requestToPromise, transactionDone } from "../data/yg-idb";
import { openYGDatabase } from "../init-db";
import { STAGE_DEFAULT_SIZE } from "../map/constants";
import { buildId } from "./common";

export type TaskRecord = {
  tkId: string;
  wId: string;
  stgId: string | null;
  ord: number;
  cat: string;
  nm: string;
  desc: string;
  state: string;
  hpMax: number;
  hpNow: number;
  progress: number;
  enemyNm: string;
  dueY: number;
  dueM: number;
  dueD: number;
  requiresApproval: number;
  iconFId: string;
  beforeFId: string;
  afterFId: string;
  spriteCol: number;
  spriteRow: number;
  spriteTone: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  clr: string;
  vis: number;
  isLocked: number;
  memo: string;
  t_c: number;
  t_u: number;
};

export function buildTaskId(): string {
  return buildId("tk");
}

export function createNewTaskRecord(ord: number): TaskRecord {
  const now = Date.now();
  return {
    tkId: buildTaskId(),
    wId: "",
    stgId: null,
    ord,
    cat: "",
    nm: `TK${ord}`,
    desc: "",
    state: "todo",
    hpMax: 100,
    hpNow: 100,
    progress: 0,
    enemyNm: "",
    dueY: 0,
    dueM: 0,
    dueD: 0,
    requiresApproval: 0,
    iconFId: "",
    beforeFId: "",
    afterFId: "",
    spriteCol: 0,
    spriteRow: 0,
    spriteTone: "none",
    x: 0,
    y: 0,
    w: STAGE_DEFAULT_SIZE,
    h: STAGE_DEFAULT_SIZE,
    rot: 0,
    clr: "#6fd3ff",
    vis: 1,
    isLocked: 0,
    memo: "",
    t_c: now,
    t_u: now,
  };
}

export async function loadTasks(): Promise<TaskRecord[]> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("tasks", "readonly");
    const store = tx.objectStore("tasks");
    const rows = (await requestToPromise(
      store.getAll(),
    )) as Partial<TaskRecord>[];

    return rows
      .filter((row) => typeof row.tkId === "string")
      .map((row, index) => {
        const now = Date.now();
        return {
          tkId: String(row.tkId || "").trim(),
          wId: String(row.wId || "").trim(),
          stgId:
            typeof row.stgId === "string"
              ? String(row.stgId).trim()
              : row.stgId == null
                ? null
                : "",
          ord: Number.isFinite(Number(row.ord)) ? Number(row.ord) : index + 1,
          cat: String(row.cat || "").trim(),
          nm: String(row.nm || `TK${index + 1}`).trim(),
          desc: String(row.desc || "").trim(),
          state: String(row.state || "todo").trim(),
          hpMax: Number.isFinite(Number(row.hpMax)) ? Number(row.hpMax) : 100,
          hpNow: Number.isFinite(Number(row.hpNow)) ? Number(row.hpNow) : 100,
          progress: Number.isFinite(Number(row.progress))
            ? Number(row.progress)
            : 0,
          enemyNm: String(row.enemyNm || "").trim(),
          dueY: Number.isFinite(Number(row.dueY)) ? Number(row.dueY) : 0,
          dueM: Number.isFinite(Number(row.dueM)) ? Number(row.dueM) : 0,
          dueD: Number.isFinite(Number(row.dueD)) ? Number(row.dueD) : 0,
          requiresApproval: Number.isFinite(Number(row.requiresApproval))
            ? Number(row.requiresApproval)
            : 0,
          iconFId: String(row.iconFId || "").trim(),
          beforeFId: String(row.beforeFId || "").trim(),
          afterFId: String(row.afterFId || "").trim(),
          spriteCol: Number.isFinite(Number(row.spriteCol))
            ? Math.max(0, Number(row.spriteCol))
            : 0,
          spriteRow: Number.isFinite(Number(row.spriteRow))
            ? Math.max(0, Number(row.spriteRow))
            : 0,
          spriteTone: (() => {
            const tone = String(row.spriteTone || "")
              .trim()
              .toLowerCase();
            return tone === "red" || tone === "dark" ? tone : "none";
          })(),
          x: Number.isFinite(Number(row.x)) ? Number(row.x) : 0,
          y: Number.isFinite(Number(row.y)) ? Number(row.y) : 0,
          w: Number.isFinite(Number(row.w))
            ? Number(row.w)
            : STAGE_DEFAULT_SIZE,
          h: Number.isFinite(Number(row.h))
            ? Number(row.h)
            : STAGE_DEFAULT_SIZE,
          rot: Number.isFinite(Number(row.rot)) ? Number(row.rot) : 0,
          clr: String(row.clr || "#6fd3ff").trim(),
          vis: Number.isFinite(Number(row.vis)) ? Number(row.vis) : 1,
          isLocked: Number.isFinite(Number(row.isLocked))
            ? Number(row.isLocked)
            : 0,
          memo: String(row.memo || "").trim(),
          t_c: Number.isFinite(Number(row.t_c)) ? Number(row.t_c) : now,
          t_u: Number.isFinite(Number(row.t_u)) ? Number(row.t_u) : now,
        };
      })
      .sort((a, b) => a.ord - b.ord);
  } finally {
    db.close();
  }
}

export async function upsertTask(record: TaskRecord): Promise<void> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");
    const existing = (await requestToPromise(store.get(record.tkId))) as
      | Partial<TaskRecord>
      | undefined;

    const merged: TaskRecord = {
      ...record,
      t_c: existing?.t_c ?? record.t_c,
      t_u: Date.now(),
    };

    await requestToPromise(store.put(merged));
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function deleteTask(tkId: string): Promise<void> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("tasks", "readwrite");
    const store = tx.objectStore("tasks");
    await requestToPromise(store.delete(tkId));
    await transactionDone(tx);
  } finally {
    db.close();
  }
}
