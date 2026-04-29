import { FileStoreGateway } from "../data/file-store";
import { t } from "../i18n";
import { applyStageImageVisual, applyStageVisuals } from "../obj/stage";
import { createBasicImageDialogFrame } from "../ui/common-dialog";
import { DEFAULT_PROGRESS } from "./constants";
import { MAPPAGE_SELECTOR } from "./dom";
import { clampProgress, getHpColor, normalizeHexColor } from "./stage-model";

type StageDialogElements = {
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
  stageImageFileInput: HTMLElement | null;
  stageImagePickButton: HTMLElement | null;
  stageImageClearButton: HTMLElement | null;
  stageImageSaveButton: HTMLElement | null;
  stageImageCurrent: HTMLElement | null;
  mapImageFileInput: HTMLElement | null;
  mapImagePickButton: HTMLElement | null;
  mapImageClearButton: HTMLElement | null;
  mapImageSaveButton: HTMLElement | null;
  mapImageCurrent: HTMLElement | null;
  cancelButton: HTMLElement | null;
  saveButton: HTMLElement | null;
};

type StageDialogControllerOptions = {
  elements: StageDialogElements;
  fileStore: FileStoreGateway;
  saveStageFromElement: (target: HTMLButtonElement) => Promise<void>;
  playButtonSound: () => void;
};

export type StageDialogController = {
  bindEvents: () => void;
  open: (target: HTMLButtonElement) => void;
  close: () => void;
};

export function createStageDialogController(
  options: StageDialogControllerOptions,
): StageDialogController {
  const { elements, fileStore, saveStageFromElement, playButtonSound } =
    options;
  const {
    dialog,
    backdrop,
    title,
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
    stageImageFileInput,
    stageImagePickButton,
    stageImageClearButton,
    stageImageSaveButton,
    stageImageCurrent,
    mapImageFileInput,
    mapImagePickButton,
    mapImageClearButton,
    mapImageSaveButton,
    mapImageCurrent,
    cancelButton,
    saveButton,
  } = elements;

  let editingStage: HTMLButtonElement | null = null;

  const frame = createBasicImageDialogFrame({
    dialog,
    backdrop,
    tabBasic,
    tabImage,
    panelBasic,
    panelImage,
    cancelButton,
    onClose: () => {
      editingStage = null;
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
  }

  function syncImageTabFromStage(target: HTMLButtonElement): void {
    if (
      !(stageImageCurrent instanceof HTMLElement) ||
      !(mapImageCurrent instanceof HTMLElement) ||
      !(stageImageFileInput instanceof HTMLInputElement) ||
      !(mapImageFileInput instanceof HTMLInputElement)
    ) {
      return;
    }

    stageImageFileInput.value = "";
    mapImageFileInput.value = "";

    const stageImgPath = String(target.dataset.stageImgPath || "").trim();
    const mapImgPath = String(target.dataset.stageMapImgPath || "").trim();
    stageImageCurrent.textContent = stageImgPath || "-";
    mapImageCurrent.textContent = mapImgPath || "-";
  }

  async function saveImageTabSelection(kind: "stage" | "map"): Promise<void> {
    if (!editingStage) {
      return;
    }

    if (
      !(stageImageFileInput instanceof HTMLInputElement) ||
      !(mapImageFileInput instanceof HTMLInputElement) ||
      !(stageImageCurrent instanceof HTMLElement) ||
      !(mapImageCurrent instanceof HTMLElement)
    ) {
      return;
    }

    const input = kind === "stage" ? stageImageFileInput : mapImageFileInput;
    const file = input.files?.[0] || null;
    if (!file) {
      return;
    }

    const fId = await fileStore.saveFileToStore(file);
    if (!fId) {
      return;
    }

    if (kind === "stage") {
      editingStage.dataset.stageImgPath = fId;
      stageImageCurrent.textContent = fId;
      await applyStageImageVisual(editingStage, fileStore);
    } else {
      editingStage.dataset.stageMapImgPath = fId;
      mapImageCurrent.textContent = fId;
    }

    await saveStageFromElement(editingStage);
    input.value = "";
  }

  async function openRegisteredImagePicker(
    kind: "stage" | "map",
  ): Promise<void> {
    if (!editingStage) {
      return;
    }

    const rows = await fileStore.fetchRegisteredImageRows();
    const oldBack = document.getElementById("yg_image_picker_back");
    const oldPop = document.getElementById("yg_image_picker_popup");
    oldBack?.remove();
    oldPop?.remove();

    const overlayRoot =
      document.querySelector(MAPPAGE_SELECTOR.stageDialogShell) ||
      document.body;
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
          if (!editingStage) {
            close();
            return;
          }

          if (kind === "stage") {
            editingStage.dataset.stageImgPath = row.fId;
            if (stageImageCurrent instanceof HTMLElement) {
              stageImageCurrent.textContent = row.fId;
            }
            await applyStageImageVisual(editingStage, fileStore);
          } else {
            editingStage.dataset.stageMapImgPath = row.fId;
            if (mapImageCurrent instanceof HTMLElement) {
              mapImageCurrent.textContent = row.fId;
            }
          }

          await saveStageFromElement(editingStage);
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
      !editingStage ||
      !(progressRange instanceof HTMLInputElement) ||
      !(nameInput instanceof HTMLInputElement) ||
      !(descInput instanceof HTMLTextAreaElement) ||
      !(colorInput instanceof HTMLInputElement)
    ) {
      frame.close();
      return;
    }

    const nextName =
      nameInput.value.trim() || editingStage.dataset.stageLabel || "ST";
    const nextDesc = descInput.value.trim();
    const nextColor = normalizeHexColor(colorInput.value);
    const nextProgress = clampProgress(
      Number.parseInt(progressRange.value, 10),
    );

    editingStage.dataset.stageLabel = nextName;
    editingStage.dataset.stageDesc = nextDesc;
    editingStage.dataset.stageColor = nextColor;
    editingStage.dataset.stageProgress = String(nextProgress);
    editingStage.title = nextDesc || t("stage_no_desc");
    editingStage.setAttribute(
      "aria-label",
      t("stage_object_aria", { name: nextName }),
    );
    applyStageVisuals(editingStage, fileStore);

    await saveStageFromElement(editingStage);
    frame.close();
  }

  function bindEvents(): void {
    if (progressRange instanceof HTMLInputElement) {
      progressRange.addEventListener("input", () => {
        updateProgressPreview(Number.parseInt(progressRange.value, 10));
      });
    }

    if (
      stageImageFileInput instanceof HTMLInputElement &&
      stageImageClearButton instanceof HTMLButtonElement
    ) {
      stageImageClearButton.addEventListener("click", () => {
        stageImageFileInput.value = "";
      });
    }

    if (stageImagePickButton instanceof HTMLButtonElement) {
      stageImagePickButton.addEventListener("click", () => {
        void openRegisteredImagePicker("stage");
      });
    }

    if (
      mapImageFileInput instanceof HTMLInputElement &&
      mapImageClearButton instanceof HTMLButtonElement
    ) {
      mapImageClearButton.addEventListener("click", () => {
        mapImageFileInput.value = "";
      });
    }

    if (mapImagePickButton instanceof HTMLButtonElement) {
      mapImagePickButton.addEventListener("click", () => {
        void openRegisteredImagePicker("map");
      });
    }

    if (stageImageSaveButton instanceof HTMLButtonElement) {
      stageImageSaveButton.addEventListener("click", () => {
        void saveImageTabSelection("stage");
      });
    }

    if (mapImageSaveButton instanceof HTMLButtonElement) {
      mapImageSaveButton.addEventListener("click", () => {
        void saveImageTabSelection("map");
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

    playButtonSound();
    editingStage = target;

    const label = target.dataset.stageLabel || "ST";
    const desc = target.dataset.stageDesc || "";
    const color = normalizeHexColor(target.dataset.stageColor || "#ffc96b");
    const progress = clampProgress(
      Number.parseInt(
        target.dataset.stageProgress || `${DEFAULT_PROGRESS}`,
        10,
      ),
    );

    // if (title instanceof HTMLElement) {
    //   title.textContent = `${label} ${t("stage_settings_suffix")}`;
    // }

    nameInput.value = label;
    descInput.value = desc;
    colorInput.value = color;
    progressRange.value = String(progress);
    updateProgressPreview(progress);
    frame.setTab("basic");
    syncImageTabFromStage(target);
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
