import { FileStoreGateway } from "../data/file-store";
import { requestToPromise, transactionDone } from "../data/yg-idb";
import { t } from "../i18n";
import { openYGDatabase } from "../init-db";
import { DEFAULT_PROGRESS, STAGE_DEFAULT_SIZE } from "../map/constants";
import { MAPPAGE_CLASS, MAPPAGE_SELECTOR } from "../map/dom";
import {
  buildImageFilterCss,
  normalizeImageBrightness,
  normalizeImageContrast,
  normalizeImageHue,
} from "../map/image-filter";
import { createMapObjectElement } from "../map/object-view";
import {
  applySpriteCellVisual,
  clearSpriteCellVisual,
} from "../map/sprite-sheet";
import {
  clampProgress,
  getElementPosition,
  getHpColor,
  normalizeHexColor,
  normalizeStageRow,
  progressToHp,
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
  imgHue: number;
  imgBrightness: number;
  imgContrast: number;
  mapImgPath: string;
  mapImgHue: number;
  mapImgBrightness: number;
  mapImgContrast: number;
  spriteCol: number;
  spriteRow: number;
  spriteTone: string;
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
  return createMapObjectElement({
    className: MAPPAGE_CLASS.stageObject,
    label: stage.nm,
    ariaLabel: t("stage_object_aria", { name: stage.nm }),
    title: stage.desc || t("stage_no_desc"),
    baseColor: normalizeHexColor(stage.baseColor),
    dataset: {
      stageId: stage.stgId,
      stageWorldId: stage.wId,
      parentStageId: stage.parentStgId || "",
      stageOrd: String(stage.ord),
      stageDesc: stage.desc,
      stageColor: normalizeHexColor(stage.baseColor),
      stageProgress: String(stage.progress),
      stageImgPath: stage.imgPath,
      stageImgHue: String(normalizeImageHue(stage.imgHue)),
      stageImgBrightness: String(normalizeImageBrightness(stage.imgBrightness)),
      stageImgContrast: String(normalizeImageContrast(stage.imgContrast)),
      stageMapImgPath: stage.mapImgPath,
      stageMapImgHue: String(normalizeImageHue(stage.mapImgHue)),
      stageMapImgBrightness: String(
        normalizeImageBrightness(stage.mapImgBrightness),
      ),
      stageMapImgContrast: String(normalizeImageContrast(stage.mapImgContrast)),
      stageSpriteCol: String(stage.spriteCol),
      stageSpriteRow: String(stage.spriteRow),
      stageSpriteTone: stage.spriteTone,
    },
    handlers: {
      onPointerDown: handlers.onPointerDown,
      onDoubleClick: handlers.onDoubleClick,
      onClick: handlers.onClick,
    },
    withSideImage: true,
    withHpGauge: true,
  });
}

export function applyStageVisuals(
  target: HTMLButtonElement,
  fileStore: FileStoreGateway,
): void {
  const color = normalizeHexColor(target.dataset.stageColor || "#ffc96b");
  const progress = clampProgress(
    Number.parseInt(target.dataset.stageProgress || `${DEFAULT_PROGRESS}`, 10),
  );
  const hp = progressToHp(progress);
  const hpColor = getHpColor(hp);

  target.style.setProperty("--stage-base-color", color);

  const hpFill = target.querySelector(
    MAPPAGE_SELECTOR.stageObjectHpFill,
  ) as HTMLElement | null;
  if (hpFill) {
    hpFill.style.width = `${hp}%`;
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

  const imgHue = normalizeImageHue(target.dataset.stageImgHue);
  const imgBrightness = normalizeImageBrightness(
    target.dataset.stageImgBrightness,
  );
  const imgContrast = normalizeImageContrast(target.dataset.stageImgContrast);
  target.dataset.stageImgHue = String(imgHue);
  target.dataset.stageImgBrightness = String(imgBrightness);
  target.dataset.stageImgContrast = String(imgContrast);
  sideImage.style.filter = buildImageFilterCss({
    hue: imgHue,
    brightness: imgBrightness,
    contrast: imgContrast,
  });

  const fId = String(target.dataset.stageImgPath || "").trim();
  if (!fId) {
    applyStageSpriteFallback(target);
    return;
  }

  const objectUrl = await fileStore.getObjectUrlForFile(fId);
  if (!objectUrl) {
    applyStageSpriteFallback(target);
    return;
  }

  const spriteMeta = await fileStore.getSpriteMetaForFile(fId);
  if (spriteMeta) {
    const spriteCol = parseSpriteCellValue(target.dataset.stageSpriteCol, 0);
    const spriteRow = parseSpriteCellValue(target.dataset.stageSpriteRow, 0);
    const spriteTone = normalizeSpriteTone(target.dataset.stageSpriteTone);

    target.dataset.stageSpriteCol = String(spriteCol);
    target.dataset.stageSpriteRow = String(spriteRow);
    target.dataset.stageSpriteTone = spriteTone;

    applySpriteCellVisual(target, {
      col: spriteCol,
      row: spriteRow,
      tone: spriteTone,
      sheetUrl: objectUrl,
      columns: spriteMeta.nw,
      rows: spriteMeta.nh,
    });
    return;
  }

  clearSpriteCellVisual(target);
  sideImage.hidden = false;
  sideImageImg.hidden = false;
  sideImageImg.src = objectUrl;
}

function applyStageSpriteFallback(target: HTMLButtonElement): void {
  const spriteCol = parseSpriteCellValue(target.dataset.stageSpriteCol, 0);
  const spriteRow = parseSpriteCellValue(target.dataset.stageSpriteRow, -1);
  const spriteTone = normalizeSpriteTone(target.dataset.stageSpriteTone);

  const ord = Number.parseInt(target.dataset.stageOrd || "1", 10);
  const normalizedOrd = Number.isFinite(ord) && ord > 0 ? ord : 1;

  // 2~4行目(0-based: 1~3)の1列目(0-based: 0)をステージ用の既定枠として使う。
  const resolvedCol = spriteCol;
  const resolvedRow =
    spriteRow >= 0 ? spriteRow : ((normalizedOrd - 1) % 3) + 1;

  target.dataset.stageSpriteCol = String(resolvedCol);
  target.dataset.stageSpriteRow = String(resolvedRow);
  target.dataset.stageSpriteTone = spriteTone;

  applySpriteCellVisual(target, {
    col: resolvedCol,
    row: resolvedRow,
    tone: spriteTone,
  });
}

function parseSpriteCellValue(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function normalizeSpriteTone(
  value: string | undefined,
): "none" | "red" | "dark" {
  const tone = String(value || "")
    .trim()
    .toLowerCase();
  if (tone === "red") {
    return "red";
  }
  if (tone === "dark") {
    return "dark";
  }
  return "none";
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
    imgHue: 0,
    imgBrightness: 1,
    imgContrast: 1,
    mapImgPath: "",
    mapImgHue: 0,
    mapImgBrightness: 1,
    mapImgContrast: 1,
    spriteCol: 0,
    spriteRow: 1,
    spriteTone: "none",
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
  const stageImgHue = normalizeImageHue(target.dataset.stageImgHue);
  const stageImgBrightness = normalizeImageBrightness(
    target.dataset.stageImgBrightness,
  );
  const stageImgContrast = normalizeImageContrast(
    target.dataset.stageImgContrast,
  );
  const stageMapImgPath = String(target.dataset.stageMapImgPath || "").trim();
  const stageMapImgHue = normalizeImageHue(target.dataset.stageMapImgHue);
  const stageMapImgBrightness = normalizeImageBrightness(
    target.dataset.stageMapImgBrightness,
  );
  const stageMapImgContrast = normalizeImageContrast(
    target.dataset.stageMapImgContrast,
  );
  const stageSpriteCol = parseSpriteCellValue(target.dataset.stageSpriteCol, 0);
  const stageSpriteRow = parseSpriteCellValue(target.dataset.stageSpriteRow, 1);
  const stageSpriteTone = normalizeSpriteTone(target.dataset.stageSpriteTone);
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
  target.dataset.stageImgHue = String(stageImgHue);
  target.dataset.stageImgBrightness = String(stageImgBrightness);
  target.dataset.stageImgContrast = String(stageImgContrast);
  target.dataset.stageMapImgHue = String(stageMapImgHue);
  target.dataset.stageMapImgBrightness = String(stageMapImgBrightness);
  target.dataset.stageMapImgContrast = String(stageMapImgContrast);
  target.dataset.stageSpriteCol = String(stageSpriteCol);
  target.dataset.stageSpriteRow = String(stageSpriteRow);
  target.dataset.stageSpriteTone = stageSpriteTone;

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
    imgHue: stageImgHue,
    imgBrightness: stageImgBrightness,
    imgContrast: stageImgContrast,
    mapImgPath: stageMapImgPath,
    mapImgHue: stageMapImgHue,
    mapImgBrightness: stageMapImgBrightness,
    mapImgContrast: stageMapImgContrast,
    spriteCol: stageSpriteCol,
    spriteRow: stageSpriteRow,
    spriteTone: stageSpriteTone,
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

export async function deleteStage(stgId: string): Promise<void> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("stages", "readwrite");
    const store = tx.objectStore("stages");
    await requestToPromise(store.delete(stgId));
    await transactionDone(tx);
  } finally {
    db.close();
  }
}
