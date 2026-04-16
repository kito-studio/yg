import {
  getAppStateText,
  requestToPromise,
  setAppStateText,
  transactionDone,
} from "../data/yg-idb";
import { openYGDatabase } from "../init-db";
import { StageRecord } from "../obj";
import { DEFAULT_PROGRESS, STAGE_DEFAULT_SIZE } from "./constants";
import {
  clampProgress,
  getElementPosition,
  normalizeHexColor,
  normalizeStageRow,
} from "./stage-model";

export async function loadSelectedWorld(): Promise<{
  wId: string;
  nm: string;
} | null> {
  const selectedWId = String((await getAppStateText("worlds")) || "").trim();
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("worlds", "readonly");
    const worldsStore = tx.objectStore("worlds");
    const worlds = (await requestToPromise(worldsStore.getAll())) as Array<{
      wId?: string;
      nm?: string;
      ord?: number;
    }>;

    const sorted = worlds
      .filter((row) => typeof row?.wId === "string")
      .sort((a, b) => Number(a?.ord || 0) - Number(b?.ord || 0));

    if (sorted.length === 0) {
      return null;
    }

    const selected =
      sorted.find((row) => String(row.wId || "") === selectedWId) || sorted[0];
    const wId = String(selected.wId || "").trim();
    const nm = String(selected.nm || wId || "").trim();
    if (!wId) {
      return null;
    }

    if (wId !== selectedWId) {
      await setAppStateText("worlds", wId);
    }

    return { wId, nm: nm || wId };
  } finally {
    db.close();
  }
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
