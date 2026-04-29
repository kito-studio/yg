import { FileStoreGateway } from "../data/file-store";
import { requestToPromise, transactionDone } from "../data/yg-idb";
import { t } from "../i18n";
import { openYGDatabase } from "../init-db";
import { DEFAULT_PROGRESS, STAGE_DEFAULT_SIZE } from "../map/constants";
import { MAPPAGE_CLASS, MAPPAGE_SELECTOR } from "../map/dom";
import {
  clampProgress,
  getElementPosition,
  getHpColor,
  normalizeHexColor,
  normalizeStageRow,
} from "../map/stage-model";
import { buildId } from "./common";

export type StageRecord = {
  stgId: string;
  wId: string;
  parentStgId: string | null;
  ord: number;
  nm: string;
  desc: string;
  baseColor: string;
  progress: number;
  imgPath: string;
  mapImgPath: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  mode: string;
  isLocked: number;
  t_c: number;
  t_u: number;
};

export function buildStageId(): string {
  return buildId("stg");
}

export type StageObjectHandlers = {
  onPointerDown: (event: PointerEvent) => void;
  onDoubleClick: (event: MouseEvent) => void;
  onClick: (event: MouseEvent) => void;
};

export function createStageObject(
  stage: StageRecord,
  handlers: StageObjectHandlers,
): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = MAPPAGE_CLASS.stageObject;
  el.dataset.stageId = stage.stgId;
  el.dataset.stageWorldId = stage.wId;
  el.dataset.parentStageId = stage.parentStgId || "";
  el.dataset.stageLabel = stage.nm;
  el.dataset.stageOrd = String(stage.ord);
  el.dataset.stageDesc = stage.desc;
  el.dataset.stageColor = normalizeHexColor(stage.baseColor);
  el.dataset.stageProgress = String(stage.progress);
  el.dataset.stageImgPath = stage.imgPath;
  el.dataset.stageMapImgPath = stage.mapImgPath;
  el.title = stage.desc || t("stage_no_desc");
  el.setAttribute("aria-label", t("stage_object_aria", { name: stage.nm }));

  const sideImage = document.createElement("span");
  sideImage.className = MAPPAGE_CLASS.stageObjectSideImage;
  sideImage.setAttribute("aria-hidden", "true");

  const sideImageImg = document.createElement("img");
  sideImageImg.className = MAPPAGE_CLASS.stageObjectSideImageImg;
  sideImageImg.alt = "";
  sideImage.append(sideImageImg);
  el.append(sideImage);

  const hp = document.createElement("span");
  hp.className = MAPPAGE_CLASS.stageObjectHp;
  hp.setAttribute("aria-hidden", "true");

  const hpFill = document.createElement("span");
  hpFill.className = MAPPAGE_CLASS.stageObjectHpFill;
  hp.append(hpFill);
  el.append(hp);

  el.addEventListener("pointerdown", handlers.onPointerDown);
  el.addEventListener("dblclick", handlers.onDoubleClick);
  el.addEventListener("click", handlers.onClick);
  return el;
}

export function applyStageVisuals(
  target: HTMLButtonElement,
  fileStore: FileStoreGateway,
): void {
  const color = normalizeHexColor(target.dataset.stageColor || "#ffc96b");
  const progress = clampProgress(
    Number.parseInt(target.dataset.stageProgress || `${DEFAULT_PROGRESS}`, 10),
  );
  const hpColor = getHpColor(progress);

  target.style.setProperty("--stage-base-color", color);

  const hpFill = target.querySelector(
    MAPPAGE_SELECTOR.stageObjectHpFill,
  ) as HTMLElement | null;
  if (hpFill) {
    hpFill.style.width = `${progress}%`;
    hpFill.style.backgroundColor = hpColor;
  }

  void applyStageImageVisual(target, fileStore);
}

export async function applyStageImageVisual(
  target: HTMLButtonElement,
  fileStore: FileStoreGateway,
): Promise<void> {
  const sideImage = target.querySelector(
    MAPPAGE_SELECTOR.stageObjectSideImage,
  ) as HTMLElement | null;
  const sideImageImg = target.querySelector(
    MAPPAGE_SELECTOR.stageObjectSideImageImg,
  ) as HTMLImageElement | null;
  if (!sideImage || !sideImageImg) {
    return;
  }

  const fId = String(target.dataset.stageImgPath || "").trim();
  if (!fId) {
    sideImage.hidden = true;
    sideImageImg.removeAttribute("src");
    return;
  }

  const objectUrl = await fileStore.getObjectUrlForFile(fId);
  if (!objectUrl) {
    sideImage.hidden = true;
    sideImageImg.removeAttribute("src");
    return;
  }

  sideImage.hidden = false;
  sideImageImg.src = objectUrl;
}

export function createNewStageRecord(ord: number): StageRecord {
  // 新規ステージの既定値を1か所に集約して調整しやすくする。
  const now = Date.now();
  return {
    stgId: buildStageId(),
    wId: "",
    parentStgId: null,
    ord,
    nm: `ST${ord}`,
    desc: "",
    baseColor: "#ffc96b",
    progress: DEFAULT_PROGRESS,
    imgPath: "",
    mapImgPath: "",
    x: 0,
    y: 0,
    w: STAGE_DEFAULT_SIZE,
    h: STAGE_DEFAULT_SIZE,
    rot: 0,
    mode: "edit",
    isLocked: 0,
    t_c: now,
    t_u: now,
  };
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
  const parentStgIdText = String(target.dataset.parentStageId || "").trim();
  const parentStgId = parentStgIdText || null;
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
