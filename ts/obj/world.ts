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
        const mapImgPath = String(row.mapImgPath || "").trim();
        return { wId, nm: nm || wId, mapImgPath };
      })
      .filter((row) => row.wId.length > 0);
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
