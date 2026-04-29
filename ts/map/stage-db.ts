import {
  getAppStateText,
  requestToPromise,
  setAppStateText,
  transactionDone,
} from "../data/yg-idb";
import { openYGDatabase } from "../init-db";
import { StageRecord } from "../obj/stage";
import { WorldRow } from "../obj/world";
import { DEFAULT_PROGRESS, STAGE_DEFAULT_SIZE } from "./constants";
import {
  clampProgress,
  getElementPosition,
  normalizeHexColor,
  normalizeStageRow,
} from "./stage-model";

export type WorldHeaderRecord = {
  wId: string;
  nm: string;
  mapImgPath?: string;
};

export async function loadWorlds(): Promise<WorldHeaderRecord[]> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("worlds", "readonly");
    const worldsStore = tx.objectStore("worlds");
    const worlds = (await requestToPromise(worldsStore.getAll())) as WorldRow[];

    return worlds
      .filter((row) => typeof row?.wId === "string")
      .sort((a, b) => Number(a?.ord || 0) - Number(b?.ord || 0))
      .map((row) => {
        const wId = String(row.wId || "").trim();
        const nm = String(row.nm || wId || "").trim();
        const mapImgPath = String(row.mapImgPath || "").trim();
        return { wId, nm: nm || wId, mapImgPath };
      })
      .filter((row) => row.wId.length > 0);
  } finally {
    db.close();
  }
}

export async function loadSelectedWorld(): Promise<{
  wId: string;
  nm: string;
} | null> {
  const selectedWId = String((await getAppStateText("worlds")) || "").trim();
  const worlds = await loadWorlds();
  if (worlds.length === 0) {
    return null;
  }

  const selected = worlds.find((row) => row.wId === selectedWId) || worlds[0];
  if (selected.wId !== selectedWId) {
    await setAppStateText("worlds", selected.wId);
  }

  return selected;
}

export async function loadStages(): Promise<StageRecord[]> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("stages", "readonly");
    const store = tx.objectStore("stages");
    const rows = (await requestToPromise(
      store.getAll(),
    )) as Partial<StageRecord>[];

    return rows
      .filter((row) => typeof row.stgId === "string")
      .map((row, index) => normalizeStageRow(row, index))
      .sort((a, b) => a.ord - b.ord);
  } finally {
    db.close();
  }
}

export async function saveStageFromElement(
  target: HTMLButtonElement,
  ordOverride?: number,
): Promise<void> {
  const stgId = target.dataset.stageId;
  const wId = String(target.dataset.stageWorldId || "").trim();
  const parentStgId = String(target.dataset.parentStageId || "").trim();
  const stageName = target.dataset.stageLabel;
  const stageDesc = target.dataset.stageDesc || "";
  const stageColor = normalizeHexColor(target.dataset.stageColor || "#ffc96b");
  const stageProgress = Number.parseInt(
    target.dataset.stageProgress || `${DEFAULT_PROGRESS}`,
    10,
  );
  const stageImgPath = String(target.dataset.stageImgPath || "").trim();
  const stageMapImgPath = String(target.dataset.stageMapImgPath || "").trim();
  if (!stgId || !stageName) {
    return;
  }

  const pos = getElementPosition(target);
  const ordFromData = Number.parseInt(target.dataset.stageOrd || "", 10);
  const ord = Number.isFinite(ordOverride)
    ? Number(ordOverride)
    : Number.isFinite(ordFromData)
      ? ordFromData
      : 0;

  target.dataset.stageOrd = String(ord);

  const now = Date.now();
  await upsertStage({
    stgId,
    wId,
    parentStgId,
    ord,
    nm: stageName,
    desc: stageDesc,
    baseColor: stageColor,
    progress: clampProgress(stageProgress),
    imgPath: stageImgPath,
    mapImgPath: stageMapImgPath,
    x: pos.x,
    y: pos.y,
    w: STAGE_DEFAULT_SIZE,
    h: STAGE_DEFAULT_SIZE,
    rot: 0,
    mode: "edit",
    isLocked: 0,
    t_c: now,
    t_u: now,
  });
}

export async function upsertStage(record: StageRecord): Promise<void> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("stages", "readwrite");
    const store = tx.objectStore("stages");
    const existing = (await requestToPromise(store.get(record.stgId))) as
      | Partial<StageRecord>
      | undefined;

    const merged: StageRecord = {
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
