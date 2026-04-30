import {
  getAppStateText,
  requestToPromise,
  setAppStateText,
} from "../data/yg-idb";
import { openYGDatabase } from "../init-db";
import { buildId } from "./common";

export type WorldRecord = {
  wId: string;
  nm: string;
  ord?: number;
  desc?: string;
  baseColor?: string;
  progress?: number;
  mapImgPath?: string;
};

export function buildWorldId(): string {
  return buildId("w");
}

export async function loadWorlds(): Promise<WorldRecord[]> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("worlds", "readonly");
    const worldsStore = tx.objectStore("worlds");
    const worlds = (await requestToPromise(
      worldsStore.getAll(),
    )) as WorldRecord[];

    return worlds
      .filter((row) => typeof row?.wId === "string")
      .sort((a, b) => Number(a?.ord || 0) - Number(b?.ord || 0))
      .map((row) => {
        const wId = String(row.wId || "").trim();
        const nm = String(row.nm || wId || "").trim();
        const desc = String(row.desc || "").trim();
        const baseColor = String(row.baseColor || "#ffc96b").trim();
        const progress = Number.isFinite(Number(row.progress))
          ? Number(row.progress)
          : 100;
        const mapImgPath = String(row.mapImgPath || "").trim();
        return {
          wId,
          nm: nm || wId,
          desc,
          baseColor,
          progress,
          mapImgPath,
        };
      })
      .filter((row) => row.wId.length > 0);
  } finally {
    db.close();
  }
}

export async function upsertWorld(record: WorldRecord): Promise<void> {
  const wId = String(record.wId || "").trim();
  if (!wId) {
    return;
  }

  const nm = String(record.nm || wId).trim() || wId;
  const desc = String(record.desc || "").trim();
  const baseColor = String(record.baseColor || "#ffc96b").trim() || "#ffc96b";
  const progress = Number.isFinite(Number(record.progress))
    ? Math.max(0, Math.min(100, Math.round(Number(record.progress))))
    : 100;
  const mapImgPath = String(record.mapImgPath || "").trim();

  const db = await openYGDatabase();
  try {
    const tx = db.transaction("worlds", "readwrite");
    const worldsStore = tx.objectStore("worlds");
    await requestToPromise(
      worldsStore.put({
        ...record,
        wId,
        nm,
        desc,
        baseColor,
        progress,
        mapImgPath,
      }),
    );
  } finally {
    db.close();
  }
}

export async function loadSelectedWorld(): Promise<WorldRecord | null> {
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
