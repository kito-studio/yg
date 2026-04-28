import { FileStoreGateway } from "../data/file-store";
import { PAGE_CLASS, PAGE_SELECTOR } from "../dom/page";
import { t } from "../i18n";
import { DEFAULT_PROGRESS, STAGE_DEFAULT_SIZE } from "../top-page/constants";
import {
  buildStageId,
  clampProgress,
  getHpColor,
  normalizeHexColor,
} from "../top-page/stage-model";

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
  el.className = PAGE_CLASS.stageObject;
  el.dataset.stageId = stage.stgId;
  el.dataset.stageWorldId = stage.wId;
  el.dataset.parentStageId = stage.parentStgId;
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
  sideImage.className = PAGE_CLASS.stageObjectSideImage;
  sideImage.setAttribute("aria-hidden", "true");

  const sideImageImg = document.createElement("img");
  sideImageImg.className = PAGE_CLASS.stageObjectSideImageImg;
  sideImageImg.alt = "";
  sideImage.append(sideImageImg);
  el.append(sideImage);

  const hp = document.createElement("span");
  hp.className = PAGE_CLASS.stageObjectHp;
  hp.setAttribute("aria-hidden", "true");

  const hpFill = document.createElement("span");
  hpFill.className = PAGE_CLASS.stageObjectHpFill;
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
    PAGE_SELECTOR.stageObjectHpFill,
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
    PAGE_SELECTOR.stageObjectSideImage,
  ) as HTMLElement | null;
  const sideImageImg = target.querySelector(
    PAGE_SELECTOR.stageObjectSideImageImg,
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
    parentStgId: "",
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
export type StageRecord = {
  stgId: string;
  wId: string;
  parentStgId: string;
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
