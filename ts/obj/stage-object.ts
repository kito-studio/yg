import { FileStoreGateway } from "../data/file-store";
import { TOP_PAGE_CLASS, TOP_PAGE_SELECTOR } from "../dom/top-page";
import { t } from "../i18n";
import { StageRecord } from "../obj";
import { DEFAULT_PROGRESS } from "../top-page/constants";
import {
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
  el.className = TOP_PAGE_CLASS.stageObject;
  el.dataset.stageId = stage.stgId;
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
  sideImage.className = TOP_PAGE_CLASS.stageObjectSideImage;
  sideImage.setAttribute("aria-hidden", "true");

  const sideImageImg = document.createElement("img");
  sideImageImg.className = TOP_PAGE_CLASS.stageObjectSideImageImg;
  sideImageImg.alt = "";
  sideImage.append(sideImageImg);
  el.append(sideImage);

  const hp = document.createElement("span");
  hp.className = TOP_PAGE_CLASS.stageObjectHp;
  hp.setAttribute("aria-hidden", "true");

  const hpFill = document.createElement("span");
  hpFill.className = TOP_PAGE_CLASS.stageObjectHpFill;
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
    TOP_PAGE_SELECTOR.stageObjectHpFill,
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
    TOP_PAGE_SELECTOR.stageObjectSideImage,
  ) as HTMLElement | null;
  const sideImageImg = target.querySelector(
    TOP_PAGE_SELECTOR.stageObjectSideImageImg,
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
