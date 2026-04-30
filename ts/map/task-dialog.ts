import { FileStoreGateway, SpriteFileMeta } from "../data/file-store";
import { t } from "../i18n";
import { playAudio } from "../sound/audio";
import { TOP_PAGE_SOUND_SOURCE } from "../sound/constants";
import { createBasicImageDialogFrame } from "../ui/common-dialog";
import { DEFAULT_PROGRESS } from "./constants";
import { MAPPAGE_SELECTOR } from "./dom";
import {
  normalizeImageBrightness,
  normalizeImageContrast,
  normalizeImageHue,
} from "./image-filter";
import { setMapObjectLabel } from "./object-view";
import { clampProgress, getHpColor, normalizeHexColor } from "./stage-model";

type TaskDialogElements = {
  dialog: HTMLElement | null;
  backdrop: HTMLElement | null;
  title: HTMLElement | null;
  tabBasic: HTMLElement | null;
  tabImage: HTMLElement | null;
  panelBasic: HTMLElement | null;
  panelImage: HTMLElement | null;
  progressRange: HTMLElement | null;
  progressBarFill: HTMLElement | null;
  progressValue: HTMLElement | null;
  nameInput: HTMLElement | null;
  descInput: HTMLElement | null;
  colorInput: HTMLElement | null;
  taskImageFileInput: HTMLElement | null;
  taskImagePickButton: HTMLElement | null;
  taskImageClearButton: HTMLElement | null;
  taskImageSaveButton: HTMLElement | null;
  taskImageCurrent: HTMLElement | null;
  taskImageHueInput: HTMLElement | null;
  taskImageBrightnessInput: HTMLElement | null;
  taskImageContrastInput: HTMLElement | null;
  taskSpriteToggle: HTMLElement | null;
  taskSpriteMetaInfo: HTMLElement | null;
  taskSpriteCoordGroup: HTMLElement | null;
  taskSpriteRowInput: HTMLElement | null;
  taskSpriteColInput: HTMLElement | null;
  cancelButton: HTMLElement | null;
  saveButton: HTMLElement | null;
};

type TaskDialogControllerOptions = {
  elements: TaskDialogElements;
  fileStore: FileStoreGateway;
  saveTaskFromElement: (target: HTMLButtonElement) => Promise<void>;
  onAfterSave?: () => Promise<void>;
};

export type TaskDialogController = {
  bindEvents: () => void;
  open: (target: HTMLButtonElement) => void;
  close: () => void;
};

export function createTaskDialogController(
  options: TaskDialogControllerOptions,
): TaskDialogController {
  const { elements, fileStore, saveTaskFromElement, onAfterSave } = options;
  const {
    dialog,
    backdrop,
    tabBasic,
    tabImage,
    panelBasic,
    panelImage,
    progressRange,
    progressBarFill,
    progressValue,
    nameInput,
    descInput,
    colorInput,
    taskImageFileInput,
    taskImagePickButton,
    taskImageClearButton,
    taskImageSaveButton,
    taskImageCurrent,
    taskImageHueInput,
    taskImageBrightnessInput,
    taskImageContrastInput,
    taskSpriteToggle,
    taskSpriteMetaInfo,
    taskSpriteCoordGroup,
    taskSpriteRowInput,
    taskSpriteColInput,
    cancelButton,
    saveButton,
  } = elements;

  let editingTask: HTMLButtonElement | null = null;
  const DEFAULT_SPRITE_GRID = 12;

  const frame = createBasicImageDialogFrame({
    dialog,
    backdrop,
    tabBasic,
    tabImage,
    panelBasic,
    panelImage,
    cancelButton,
    onClose: () => {
      editingTask = null;
    },
  });

  function updateProgressPreview(value: number): void {
    const safeValue = clampProgress(value);
    const hpColor = getHpColor(safeValue);

    if (progressBarFill instanceof HTMLElement) {
      progressBarFill.style.width = `${safeValue}%`;
      progressBarFill.style.background = hpColor;
    }

    if (progressValue instanceof HTMLElement) {
      progressValue.textContent = `${safeValue}%`;
      progressValue.style.color = hpColor;
    }

    if (progressRange instanceof HTMLInputElement) {
      const trackColor = "rgba(12, 8, 4, 0.9)";
      const fillColor = "#9b60d0";
      progressRange.style.background = `linear-gradient(to right, ${fillColor} ${safeValue}%, ${trackColor} ${safeValue}%)`;
    }
  }

  function buildSpriteMetaText(meta: SpriteFileMeta | null): string {
    if (!meta) {
      return "通常画像";
    }
    return `sprite ${meta.w}x${meta.h} / ${meta.nw}x${meta.nh} / cell ${meta.unit_w}x${meta.unit_h}`;
  }

  function updateSpriteCoordinateInputs(
    target: HTMLButtonElement | null,
    spriteMeta: SpriteFileMeta | null,
  ): void {
    if (
      !(taskSpriteCoordGroup instanceof HTMLElement) ||
      !(taskSpriteRowInput instanceof HTMLInputElement) ||
      !(taskSpriteColInput instanceof HTMLInputElement) ||
      !(taskSpriteMetaInfo instanceof HTMLElement) ||
      !(taskSpriteToggle instanceof HTMLInputElement)
    ) {
      return;
    }

    taskSpriteToggle.checked = !!spriteMeta;
    taskSpriteMetaInfo.textContent = buildSpriteMetaText(spriteMeta);
    taskSpriteCoordGroup.hidden = !spriteMeta;

    if (!spriteMeta) {
      taskSpriteRowInput.value = "1";
      taskSpriteColInput.value = "1";
      taskSpriteRowInput.removeAttribute("max");
      taskSpriteColInput.removeAttribute("max");
      return;
    }

    const rowZero = Number.parseInt(target?.dataset.taskSpriteRow || "0", 10);
    const colZero = Number.parseInt(target?.dataset.taskSpriteCol || "0", 10);
    const safeRow = Number.isFinite(rowZero) && rowZero >= 0 ? rowZero : 0;
    const safeCol = Number.isFinite(colZero) && colZero >= 0 ? colZero : 0;
    const clampedRow = Math.min(safeRow, Math.max(0, spriteMeta.nh - 1));
    const clampedCol = Math.min(safeCol, Math.max(0, spriteMeta.nw - 1));

    if (target) {
      target.dataset.taskSpriteRow = String(clampedRow);
      target.dataset.taskSpriteCol = String(clampedCol);
    }

    taskSpriteRowInput.max = String(spriteMeta.nh);
    taskSpriteColInput.max = String(spriteMeta.nw);
    taskSpriteRowInput.value = String(clampedRow + 1);
    taskSpriteColInput.value = String(clampedCol + 1);
  }

  function syncSpritePlacementFromInputs(): void {
    if (
      !editingTask ||
      !(taskSpriteRowInput instanceof HTMLInputElement) ||
      !(taskSpriteColInput instanceof HTMLInputElement)
    ) {
      return;
    }

    const row = Math.max(
      1,
      Number.parseInt(taskSpriteRowInput.value || "1", 10),
    );
    const col = Math.max(
      1,
      Number.parseInt(taskSpriteColInput.value || "1", 10),
    );
    editingTask.dataset.taskSpriteRow = String(row - 1);
    editingTask.dataset.taskSpriteCol = String(col - 1);
  }

  async function buildSpriteMetaFromFile(
    file: File,
  ): Promise<SpriteFileMeta | null> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const size = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          };
          image.onerror = () => {
            reject(new Error("Failed to read image size"));
          };
          image.src = objectUrl;
        },
      );

      if (
        size.width % DEFAULT_SPRITE_GRID !== 0 ||
        size.height % DEFAULT_SPRITE_GRID !== 0
      ) {
        window.alert(
          "スプライトシートは現在 12x12 分割できる画像のみ対応です。",
        );
        return null;
      }

      return {
        type: "sprite",
        w: size.width,
        h: size.height,
        unit_w: size.width / DEFAULT_SPRITE_GRID,
        unit_h: size.height / DEFAULT_SPRITE_GRID,
        nw: DEFAULT_SPRITE_GRID,
        nh: DEFAULT_SPRITE_GRID,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function syncImageTabFromTask(
    target: HTMLButtonElement,
  ): Promise<void> {
    if (
      !(taskImageCurrent instanceof HTMLElement) ||
      !(taskImageFileInput instanceof HTMLInputElement)
    ) {
      return;
    }

    taskImageFileInput.value = "";

    const imgPath = String(target.dataset.taskImgPath || "").trim();
    const imgHue = normalizeImageHue(target.dataset.taskImgHue);
    const imgBrightness = normalizeImageBrightness(
      target.dataset.taskImgBrightness,
    );
    const imgContrast = normalizeImageContrast(target.dataset.taskImgContrast);
    taskImageCurrent.textContent = imgPath || "-";
    target.dataset.taskImgHue = String(imgHue);
    target.dataset.taskImgBrightness = String(imgBrightness);
    target.dataset.taskImgContrast = String(imgContrast);

    if (taskImageHueInput instanceof HTMLInputElement) {
      taskImageHueInput.value = String(imgHue);
    }
    if (taskImageBrightnessInput instanceof HTMLInputElement) {
      taskImageBrightnessInput.value = String(imgBrightness);
    }
    if (taskImageContrastInput instanceof HTMLInputElement) {
      taskImageContrastInput.value = String(imgContrast);
    }

    const spriteMeta = imgPath
      ? await fileStore.getSpriteMetaForFile(imgPath)
      : null;
    updateSpriteCoordinateInputs(target, spriteMeta);
  }

  async function saveImageTabSelection(): Promise<void> {
    if (!editingTask) {
      return;
    }

    if (
      !(taskImageFileInput instanceof HTMLInputElement) ||
      !(taskImageCurrent instanceof HTMLElement)
    ) {
      return;
    }

    const file = taskImageFileInput.files?.[0] || null;
    if (!file) {
      return;
    }

    let body = "";
    let spriteMeta: SpriteFileMeta | null = null;
    if (taskSpriteToggle instanceof HTMLInputElement) {
      if (taskSpriteToggle.checked) {
        spriteMeta = await buildSpriteMetaFromFile(file);
        if (!spriteMeta) {
          return;
        }
        body = JSON.stringify(spriteMeta);
      }
    }

    const fId = await fileStore.saveFileToStore(file, { body });
    if (!fId) {
      return;
    }

    editingTask.dataset.taskImgPath = fId;
    if (taskImageHueInput instanceof HTMLInputElement) {
      editingTask.dataset.taskImgHue = String(
        normalizeImageHue(taskImageHueInput.value),
      );
    }
    if (taskImageBrightnessInput instanceof HTMLInputElement) {
      editingTask.dataset.taskImgBrightness = String(
        normalizeImageBrightness(taskImageBrightnessInput.value),
      );
    }
    if (taskImageContrastInput instanceof HTMLInputElement) {
      editingTask.dataset.taskImgContrast = String(
        normalizeImageContrast(taskImageContrastInput.value),
      );
    }
    updateSpriteCoordinateInputs(editingTask, spriteMeta);
    syncSpritePlacementFromInputs();
    taskImageCurrent.textContent = fId;

    await saveTaskFromElement(editingTask);
    taskImageFileInput.value = "";
  }

  async function openRegisteredImagePicker(): Promise<void> {
    if (!editingTask) {
      return;
    }

    const rows = await fileStore.fetchRegisteredImageRows();
    const oldBack = document.getElementById("yg_image_picker_back");
    const oldPop = document.getElementById("yg_image_picker_popup");
    oldBack?.remove();
    oldPop?.remove();

    const overlayRoot =
      document.querySelector(MAPPAGE_SELECTOR.taskDialogShell) || document.body;
    const createdUrls: string[] = [];
    const close = () => {
      for (const url of createdUrls) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // noop
        }
      }
      back.remove();
      pop.remove();
    };

    const back = document.createElement("div");
    back.id = "yg_image_picker_back";
    back.style.position = "absolute";
    back.style.left = "0";
    back.style.top = "0";
    back.style.width = "100%";
    back.style.height = "100%";
    back.style.background = "rgba(0,0,0,0.42)";
    back.style.zIndex = "150";
    overlayRoot.appendChild(back);

    const pop = document.createElement("div");
    pop.id = "yg_image_picker_popup";
    pop.style.position = "absolute";
    pop.style.left = "50%";
    pop.style.top = "50%";
    pop.style.transform = "translate(-50%, -50%)";
    pop.style.width = "min(900px, calc(100% - 16px))";
    pop.style.maxHeight = "calc(100% - 16px)";
    pop.style.background = "#fff";
    pop.style.border = "1px solid #ccc";
    pop.style.borderRadius = "8px";
    pop.style.padding = "10px";
    pop.style.display = "flex";
    pop.style.flexDirection = "column";
    pop.style.gap = "8px";
    pop.style.zIndex = "151";
    overlayRoot.appendChild(pop);

    const titleEl = document.createElement("h3");
    titleEl.textContent = t("image_picker_title");
    titleEl.style.margin = "0";
    pop.appendChild(titleEl);

    const toolRow = document.createElement("div");
    toolRow.style.display = "flex";
    toolRow.style.gap = "8px";
    toolRow.style.flexWrap = "wrap";
    pop.appendChild(toolRow);

    const qInput = document.createElement("input");
    qInput.type = "text";
    qInput.placeholder = t("image_picker_filter_placeholder");
    qInput.style.flex = "1 1 280px";
    qInput.style.minWidth = "200px";
    toolRow.appendChild(qInput);

    const extSelect = document.createElement("select");
    ["", "png", "jpg", "jpeg", "webp", "gif", "svg"].forEach((ext) => {
      const opt = document.createElement("option");
      opt.value = ext;
      opt.textContent = ext ? `.${ext}` : t("image_picker_ext_all");
      extSelect.appendChild(opt);
    });
    toolRow.appendChild(extSelect);

    const count = document.createElement("span");
    count.style.marginLeft = "auto";
    count.style.fontSize = "12px";
    count.style.color = "#666";
    toolRow.appendChild(count);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(130px, 1fr))";
    grid.style.gap = "8px";
    grid.style.overflow = "auto";
    grid.style.minHeight = "220px";
    grid.style.maxHeight = "54vh";
    grid.style.border = "1px solid #eee";
    grid.style.borderRadius = "6px";
    grid.style.padding = "8px";
    pop.appendChild(grid);

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    pop.appendChild(footer);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = t("image_picker_close");
    footer.appendChild(closeBtn);

    const renderGrid = () => {
      grid.innerHTML = "";

      const query = String(qInput.value || "")
        .trim()
        .toLowerCase();
      const ext = String(extSelect.value || "")
        .trim()
        .toLowerCase();

      const filtered = rows.filter((row) => {
        if (ext && row.ext !== ext) {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          row.nm.toLowerCase().includes(query) ||
          row.fId.toLowerCase().includes(query)
        );
      });

      count.textContent = t("image_picker_count", { count: filtered.length });

      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = t("image_picker_empty");
        empty.style.color = "#777";
        empty.style.fontSize = "13px";
        grid.appendChild(empty);
        return;
      }

      for (const row of filtered) {
        const card = document.createElement("button");
        card.type = "button";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.alignItems = "stretch";
        card.style.gap = "6px";
        card.style.padding = "6px";
        card.style.border = "1px solid #ddd";
        card.style.borderRadius = "6px";
        card.style.background = "#fff";
        card.style.cursor = "pointer";

        const img = document.createElement("img");
        img.alt = row.nm || row.fId;
        img.style.width = "100%";
        img.style.aspectRatio = "1 / 1";
        img.style.objectFit = "cover";
        img.style.background = "#f5f5f5";
        img.style.borderRadius = "4px";
        if (row.objectUrl) {
          img.src = row.objectUrl;
        }
        card.appendChild(img);

        const label = document.createElement("div");
        label.textContent = row.nm || row.fId;
        label.style.fontSize = "11px";
        label.style.lineHeight = "1.3";
        label.style.wordBreak = "break-all";
        card.appendChild(label);

        if (row.nm && row.nm !== row.fId) {
          const sub = document.createElement("div");
          sub.textContent = row.fId;
          sub.style.fontSize = "10px";
          sub.style.color = "#666";
          sub.style.wordBreak = "break-all";
          card.appendChild(sub);
        }

        card.addEventListener("click", async () => {
          if (!editingTask) {
            close();
            return;
          }

          editingTask.dataset.taskImgPath = row.fId;
          if (taskImageHueInput instanceof HTMLInputElement) {
            editingTask.dataset.taskImgHue = String(
              normalizeImageHue(taskImageHueInput.value),
            );
          }
          if (taskImageBrightnessInput instanceof HTMLInputElement) {
            editingTask.dataset.taskImgBrightness = String(
              normalizeImageBrightness(taskImageBrightnessInput.value),
            );
          }
          if (taskImageContrastInput instanceof HTMLInputElement) {
            editingTask.dataset.taskImgContrast = String(
              normalizeImageContrast(taskImageContrastInput.value),
            );
          }
          updateSpriteCoordinateInputs(editingTask, row.spriteMeta);
          syncSpritePlacementFromInputs();
          if (taskImageCurrent instanceof HTMLElement) {
            taskImageCurrent.textContent = row.fId;
          }

          await saveTaskFromElement(editingTask);
          close();
        });

        grid.appendChild(card);

        if (row.objectUrl && !row.objectUrl.startsWith("data:")) {
          createdUrls.push(row.objectUrl);
        }
      }
    };

    qInput.addEventListener("input", renderGrid);
    extSelect.addEventListener("change", renderGrid);
    closeBtn.addEventListener("click", close);
    back.addEventListener("click", close);

    renderGrid();
    qInput.focus();
  }

  async function onSave(): Promise<void> {
    if (
      !editingTask ||
      !(progressRange instanceof HTMLInputElement) ||
      !(nameInput instanceof HTMLInputElement) ||
      !(descInput instanceof HTMLTextAreaElement) ||
      !(colorInput instanceof HTMLInputElement)
    ) {
      frame.close();
      return;
    }

    const nextName =
      nameInput.value.trim() || editingTask.dataset.stageLabel || "TK";
    const nextDesc = descInput.value.trim();
    const nextColor = normalizeHexColor(colorInput.value);
    const nextProgress = clampProgress(
      Number.parseInt(progressRange.value, 10),
    );
    const imgHue =
      taskImageHueInput instanceof HTMLInputElement
        ? normalizeImageHue(taskImageHueInput.value)
        : normalizeImageHue(editingTask.dataset.taskImgHue);
    const imgBrightness =
      taskImageBrightnessInput instanceof HTMLInputElement
        ? normalizeImageBrightness(taskImageBrightnessInput.value)
        : normalizeImageBrightness(editingTask.dataset.taskImgBrightness);
    const imgContrast =
      taskImageContrastInput instanceof HTMLInputElement
        ? normalizeImageContrast(taskImageContrastInput.value)
        : normalizeImageContrast(editingTask.dataset.taskImgContrast);

    setMapObjectLabel(editingTask, nextName);
    editingTask.dataset.taskDesc = nextDesc;
    editingTask.dataset.taskColor = nextColor;
    editingTask.dataset.taskProgress = String(nextProgress);
    editingTask.dataset.taskImgHue = String(imgHue);
    editingTask.dataset.taskImgBrightness = String(imgBrightness);
    editingTask.dataset.taskImgContrast = String(imgContrast);
    syncSpritePlacementFromInputs();
    editingTask.title = nextDesc || t("stage_no_desc");
    editingTask.setAttribute(
      "aria-label",
      t("task_object_aria", { name: nextName }),
    );
    editingTask.style.setProperty("--stage-base-color", nextColor);

    await saveTaskFromElement(editingTask);
    frame.close();
    if (onAfterSave) {
      await onAfterSave();
    }
  }

  function bindEvents(): void {
    if (progressRange instanceof HTMLInputElement) {
      progressRange.addEventListener("input", () => {
        updateProgressPreview(Number.parseInt(progressRange.value, 10));
      });
    }

    if (
      taskImageFileInput instanceof HTMLInputElement &&
      taskImageClearButton instanceof HTMLButtonElement
    ) {
      taskImageClearButton.addEventListener("click", () => {
        taskImageFileInput.value = "";
        if (editingTask) {
          void syncImageTabFromTask(editingTask);
        } else {
          updateSpriteCoordinateInputs(null, null);
        }
      });
    }

    if (taskImageFileInput instanceof HTMLInputElement) {
      taskImageFileInput.addEventListener("change", async () => {
        const file = taskImageFileInput.files?.[0] || null;
        if (!file) {
          if (editingTask) {
            void syncImageTabFromTask(editingTask);
          } else {
            updateSpriteCoordinateInputs(null, null);
          }
          return;
        }

        if (
          !(taskSpriteToggle instanceof HTMLInputElement) ||
          !taskSpriteToggle.checked
        ) {
          updateSpriteCoordinateInputs(editingTask, null);
          return;
        }

        const spriteMeta = await buildSpriteMetaFromFile(file);
        if (!spriteMeta) {
          taskImageFileInput.value = "";
          return;
        }
        updateSpriteCoordinateInputs(editingTask, spriteMeta);
      });
    }

    if (taskSpriteToggle instanceof HTMLInputElement) {
      taskSpriteToggle.addEventListener("change", async () => {
        const file =
          taskImageFileInput instanceof HTMLInputElement
            ? taskImageFileInput.files?.[0] || null
            : null;
        if (!file) {
          if (editingTask) {
            void syncImageTabFromTask(editingTask);
          } else {
            updateSpriteCoordinateInputs(null, null);
          }
          return;
        }

        if (!taskSpriteToggle.checked) {
          updateSpriteCoordinateInputs(editingTask, null);
          return;
        }

        const spriteMeta = await buildSpriteMetaFromFile(file);
        if (!spriteMeta) {
          taskSpriteToggle.checked = false;
          return;
        }
        updateSpriteCoordinateInputs(editingTask, spriteMeta);
      });
    }

    const handleSpritePlacementInput = () => {
      syncSpritePlacementFromInputs();
    };

    if (taskSpriteRowInput instanceof HTMLInputElement) {
      taskSpriteRowInput.addEventListener("input", handleSpritePlacementInput);
    }

    if (taskSpriteColInput instanceof HTMLInputElement) {
      taskSpriteColInput.addEventListener("input", handleSpritePlacementInput);
    }

    if (taskImagePickButton instanceof HTMLButtonElement) {
      taskImagePickButton.addEventListener("click", () => {
        void openRegisteredImagePicker();
      });
    }

    if (taskImageSaveButton instanceof HTMLButtonElement) {
      taskImageSaveButton.addEventListener("click", () => {
        void saveImageTabSelection();
      });
    }

    if (taskImageHueInput instanceof HTMLInputElement) {
      taskImageHueInput.addEventListener("input", () => {
        if (!editingTask) {
          return;
        }
        editingTask.dataset.taskImgHue = String(
          normalizeImageHue(taskImageHueInput.value),
        );
      });
    }

    if (taskImageBrightnessInput instanceof HTMLInputElement) {
      taskImageBrightnessInput.addEventListener("input", () => {
        if (!editingTask) {
          return;
        }
        editingTask.dataset.taskImgBrightness = String(
          normalizeImageBrightness(taskImageBrightnessInput.value),
        );
      });
    }

    if (taskImageContrastInput instanceof HTMLInputElement) {
      taskImageContrastInput.addEventListener("input", () => {
        if (!editingTask) {
          return;
        }
        editingTask.dataset.taskImgContrast = String(
          normalizeImageContrast(taskImageContrastInput.value),
        );
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
      !(progressRange instanceof HTMLInputElement) ||
      !(nameInput instanceof HTMLInputElement) ||
      !(descInput instanceof HTMLTextAreaElement) ||
      !(colorInput instanceof HTMLInputElement)
    ) {
      return;
    }

    playAudio(TOP_PAGE_SOUND_SOURCE.buttonClick);
    editingTask = target;

    const label = target.dataset.stageLabel || "TK";
    const desc = target.dataset.taskDesc || "";
    const color = normalizeHexColor(target.dataset.taskColor || "#6fd3ff");
    const progress = clampProgress(
      Number.parseInt(target.dataset.taskProgress || `${DEFAULT_PROGRESS}`, 10),
    );

    nameInput.value = label;
    descInput.value = desc;
    colorInput.value = color;
    progressRange.value = String(progress);
    updateProgressPreview(progress);
    frame.setTab("basic");
    void syncImageTabFromTask(target);
    frame.open();
  }

  return {
    bindEvents,
    open,
    close: () => {
      frame.close();
    },
  };
}
