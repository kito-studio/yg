import { FileStoreGateway } from "../data/file-store";
import { t } from "../i18n";
import {
  buildImageFilterCss,
  normalizeImageBrightness,
  normalizeImageContrast,
  normalizeImageHue,
  renderSpriteCellDataUrl,
} from "./image-filter";
import { clampProgress, getHpColor } from "./stage-model";

type TaskProgressDialogElements = {
  dialog: HTMLElement | null;
  backdrop: HTMLElement | null;
  title: HTMLElement | null;
  imagePreview: HTMLElement | null;
  nameText: HTMLElement | null;
  descText: HTMLElement | null;
  progressInput: HTMLElement | null;
  progressRange: HTMLElement | null;
  cancelButton: HTMLElement | null;
  saveButton: HTMLElement | null;
};

type TaskProgressDialogControllerOptions = {
  elements: TaskProgressDialogElements;
  fileStore: FileStoreGateway;
  saveTaskFromElement: (target: HTMLButtonElement) => Promise<void>;
  onAfterSave?: () => Promise<void>;
};

export type TaskProgressDialogController = {
  bindEvents: () => void;
  open: (target: HTMLButtonElement) => void;
  close: () => void;
};

function openDialog(
  dialog: HTMLElement | null,
  backdrop: HTMLElement | null,
): void {
  if (
    !(dialog instanceof HTMLDialogElement) ||
    !(backdrop instanceof HTMLElement)
  ) {
    return;
  }

  backdrop.hidden = false;
  if (!dialog.open) {
    dialog.showModal();
  }
}

function closeDialog(
  dialog: HTMLElement | null,
  backdrop: HTMLElement | null,
): void {
  if (
    !(dialog instanceof HTMLDialogElement) ||
    !(backdrop instanceof HTMLElement)
  ) {
    return;
  }

  backdrop.hidden = true;
  if (dialog.open) {
    dialog.close();
  }
}

export function createTaskProgressDialogController(
  options: TaskProgressDialogControllerOptions,
): TaskProgressDialogController {
  const { elements, fileStore, saveTaskFromElement, onAfterSave } = options;
  const {
    dialog,
    backdrop,
    imagePreview,
    nameText,
    descText,
    progressInput,
    progressRange,
    cancelButton,
    saveButton,
  } = elements;

  let editingTask: HTMLButtonElement | null = null;

  function updateProgressPreview(value: number): void {
    const safeValue = clampProgress(value);
    const hpColor = getHpColor(safeValue);

    if (progressInput instanceof HTMLInputElement) {
      progressInput.value = String(safeValue);
    }
    if (progressRange instanceof HTMLInputElement) {
      progressRange.value = String(safeValue);
      const trackColor = "rgba(12, 8, 4, 0.9)";
      const fillColor = "#9b60d0";
      progressRange.style.background = `linear-gradient(to right, ${fillColor} ${safeValue}%, ${trackColor} ${safeValue}%)`;
      progressRange.style.boxShadow = `0 0 0 1px ${hpColor}40 inset`;
    }
  }

  async function updateTaskImagePreview(
    target: HTMLButtonElement,
  ): Promise<void> {
    if (!(imagePreview instanceof HTMLImageElement)) {
      return;
    }

    const path = String(target.dataset.taskImgPath || "").trim();
    if (!path) {
      imagePreview.hidden = true;
      imagePreview.removeAttribute("src");
      imagePreview.style.removeProperty("filter");
      return;
    }

    const resolvedUrl = (await fileStore.getObjectUrlForFile(path)) || path;
    const imgHue = normalizeImageHue(target.dataset.taskImgHue);
    const imgBrightness = normalizeImageBrightness(
      target.dataset.taskImgBrightness,
    );
    const imgContrast = normalizeImageContrast(target.dataset.taskImgContrast);

    let finalSrc = resolvedUrl;
    const spriteMeta = await fileStore.getSpriteMetaForFile(path);
    if (spriteMeta) {
      const row = Math.max(
        0,
        Number.parseInt(target.dataset.taskSpriteRow || "0", 10),
      );
      const col = Math.max(
        0,
        Number.parseInt(target.dataset.taskSpriteCol || "0", 10),
      );
      const cellDataUrl = await renderSpriteCellDataUrl(
        resolvedUrl,
        spriteMeta,
        row,
        col,
      );
      if (cellDataUrl) {
        finalSrc = cellDataUrl;
      }
    }

    imagePreview.src = finalSrc;
    imagePreview.style.filter = buildImageFilterCss({
      hue: imgHue,
      brightness: imgBrightness,
      contrast: imgContrast,
    });
    imagePreview.hidden = false;
  }

  function close(): void {
    closeDialog(dialog, backdrop);
    editingTask = null;
  }

  async function onSave(): Promise<void> {
    if (!editingTask || !(progressInput instanceof HTMLInputElement)) {
      close();
      return;
    }

    const nextProgress = clampProgress(
      Number.parseInt(progressInput.value, 10),
    );
    editingTask.dataset.taskProgress = String(nextProgress);

    await saveTaskFromElement(editingTask);
    close();
    if (onAfterSave) {
      await onAfterSave();
    }
  }

  function bindEvents(): void {
    if (cancelButton instanceof HTMLButtonElement) {
      cancelButton.addEventListener("click", close);
    }

    if (backdrop instanceof HTMLElement) {
      backdrop.addEventListener("click", close);
    }

    if (progressInput instanceof HTMLInputElement) {
      progressInput.addEventListener("input", () => {
        const next = clampProgress(Number.parseInt(progressInput.value, 10));
        updateProgressPreview(next);
      });
    }

    if (progressRange instanceof HTMLInputElement) {
      progressRange.addEventListener("input", () => {
        const next = clampProgress(Number.parseInt(progressRange.value, 10));
        updateProgressPreview(next);
      });
    }

    if (saveButton instanceof HTMLButtonElement) {
      saveButton.addEventListener("click", () => {
        void onSave();
      });
    }
  }

  function open(target: HTMLButtonElement): void {
    if (
      !(nameText instanceof HTMLElement) ||
      !(descText instanceof HTMLElement) ||
      !(progressInput instanceof HTMLInputElement)
    ) {
      return;
    }

    editingTask = target;

    const label = String(target.dataset.stageLabel || "").trim();
    const desc = String(target.dataset.taskDesc || "").trim();
    const progress = clampProgress(
      Number.parseInt(target.dataset.taskProgress || "0", 10),
    );

    nameText.textContent = label || "-";
    descText.textContent = desc || t("stage_no_desc");
    progressInput.value = String(progress);
    updateProgressPreview(progress);
    void updateTaskImagePreview(target);
    openDialog(dialog, backdrop);
  }

  return {
    bindEvents,
    open,
    close,
  };
}
