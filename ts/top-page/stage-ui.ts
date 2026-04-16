import { FileStoreGateway } from "../data/file-store";
import { t } from "../i18n";
import { StageRecord } from "../obj";
import { DEFAULT_PROGRESS } from "./constants";
import { clampProgress, getHpColor, normalizeHexColor } from "./stage-model";

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
  el.className = "stage-object";
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
  sideImage.className = "stage-object-side-image";
  sideImage.setAttribute("aria-hidden", "true");

  const sideImageImg = document.createElement("img");
  sideImageImg.className = "stage-object-side-image-img";
  sideImageImg.alt = "";
  sideImage.append(sideImageImg);
  el.append(sideImage);

  const hp = document.createElement("span");
  hp.className = "stage-object-hp";
  hp.setAttribute("aria-hidden", "true");

  const hpFill = document.createElement("span");
  hpFill.className = "stage-object-hp-fill";
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
    ".stage-object-hp-fill",
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
    ".stage-object-side-image",
  ) as HTMLElement | null;
  const sideImageImg = target.querySelector(
    ".stage-object-side-image-img",
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
