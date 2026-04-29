import { MAPPAGE_CLASS } from "./dom";

export type MapObjectHandlers = {
  onPointerDown?: (event: PointerEvent) => void;
  onDoubleClick?: (event: MouseEvent) => void;
  onClick?: (event: MouseEvent) => void;
};

export type CreateMapObjectOptions = {
  className?: string;
  label: string;
  ariaLabel: string;
  title?: string;
  baseColor: string;
  dataset?: Record<string, string>;
  handlers?: MapObjectHandlers;
  withSideImage?: boolean;
  withHpGauge?: boolean;
};

export function createMapObjectElement(
  options: CreateMapObjectOptions,
): HTMLButtonElement {
  const target = document.createElement("button");
  target.type = "button";
  target.className = options.className || MAPPAGE_CLASS.stageObject;
  target.dataset.stageLabel = options.label;
  target.style.setProperty("--stage-base-color", options.baseColor);
  target.setAttribute("aria-label", options.ariaLabel);

  if (options.title) {
    target.title = options.title;
  }

  if (options.dataset) {
    for (const [key, value] of Object.entries(options.dataset)) {
      target.dataset[key] = value;
    }
  }

  if (options.withSideImage) {
    const sideImage = document.createElement("span");
    sideImage.className = MAPPAGE_CLASS.stageObjectSideImage;
    sideImage.setAttribute("aria-hidden", "true");

    const sideImageImg = document.createElement("img");
    sideImageImg.className = MAPPAGE_CLASS.stageObjectSideImageImg;
    sideImageImg.alt = "";
    sideImage.append(sideImageImg);
    target.append(sideImage);
  }

  const label = document.createElement("span");
  label.className = MAPPAGE_CLASS.stageObjectLabel;
  label.textContent = options.label;
  target.append(label);

  if (options.withHpGauge) {
    const hp = document.createElement("span");
    hp.className = MAPPAGE_CLASS.stageObjectHp;
    hp.setAttribute("aria-hidden", "true");

    const hpFill = document.createElement("span");
    hpFill.className = MAPPAGE_CLASS.stageObjectHpFill;
    hp.append(hpFill);
    target.append(hp);
  }

  if (options.handlers?.onPointerDown) {
    target.addEventListener("pointerdown", options.handlers.onPointerDown);
  }
  if (options.handlers?.onDoubleClick) {
    target.addEventListener("dblclick", options.handlers.onDoubleClick);
  }
  if (options.handlers?.onClick) {
    target.addEventListener("click", options.handlers.onClick);
  }

  return target;
}

export function setMapObjectLabel(
  target: HTMLButtonElement,
  labelText: string,
): void {
  target.dataset.stageLabel = labelText;
  const label = target.querySelector(
    `.${MAPPAGE_CLASS.stageObjectLabel}`,
  ) as HTMLElement | null;
  if (label) {
    label.textContent = labelText;
  }
}
