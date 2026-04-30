import { FileStoreGateway } from "../data/file-store";
import { WorldRecord } from "../obj/world";
import { playAudio } from "../sound/audio";
import { TOP_PAGE_SOUND_SOURCE } from "../sound/constants";
import { createBasicImageDialogFrame } from "../ui/common-dialog";
import { DEFAULT_PROGRESS } from "./constants";
import { MAPPAGE_SELECTOR } from "./dom";
import { clampProgress, getHpColor, normalizeHexColor } from "./stage-model";

type WorldDialogElements = {
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
  mapImageFileInput: HTMLElement | null;
  mapImagePickButton: HTMLElement | null;
  mapImageClearButton: HTMLElement | null;
  mapImageSaveButton: HTMLElement | null;
  mapImageCurrent: HTMLElement | null;
  cancelButton: HTMLElement | null;
  saveButton: HTMLElement | null;
};

type WorldDialogControllerOptions = {
  elements: WorldDialogElements;
  fileStore: FileStoreGateway;
  saveWorld: (next: WorldRecord) => Promise<void>;
  onAfterSave?: () => Promise<void>;
};

export type WorldDialogController = {
  bindEvents: () => void;
  open: (target: WorldRecord) => void;
  close: () => void;
};

export function createWorldDialogController(
  options: WorldDialogControllerOptions,
): WorldDialogController {
  const { elements, fileStore, saveWorld, onAfterSave } = options;
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
    mapImageFileInput,
    mapImagePickButton,
    mapImageClearButton,
    mapImageSaveButton,
    mapImageCurrent,
    cancelButton,
    saveButton,
  } = elements;

  let editingWorld: WorldRecord | null = null;

  const frame = createBasicImageDialogFrame({
    dialog,
    backdrop,
    tabBasic,
    tabImage,
    panelBasic,
    panelImage,
    cancelButton,
    onClose: () => {
      editingWorld = null;
    },
  });

  function updateProgressPreview(value: number): void {
    const safeValue = clampProgress(value);
    const color = getHpColor(safeValue);

    if (progressBarFill instanceof HTMLElement) {
      progressBarFill.style.width = `${safeValue}%`;
      progressBarFill.style.background = color;
    }

    if (progressValue instanceof HTMLElement) {
      progressValue.textContent = `${safeValue}%`;
      progressValue.style.color = color;
    }

    if (progressRange instanceof HTMLInputElement) {
      const trackColor = "rgba(12, 8, 4, 0.9)";
      const fillColor = "#9b60d0";
      progressRange.style.background = `linear-gradient(to right, ${fillColor} ${safeValue}%, ${trackColor} ${safeValue}%)`;
    }
  }

  async function syncImageTabFromWorld(world: WorldRecord): Promise<void> {
    if (
      !(mapImageCurrent instanceof HTMLElement) ||
      !(mapImageFileInput instanceof HTMLInputElement)
    ) {
      return;
    }
    mapImageFileInput.value = "";
    mapImageCurrent.textContent = String(world.mapImgPath || "").trim() || "-";
  }

  async function saveMapImageSelection(): Promise<void> {
    if (!editingWorld) {
      return;
    }

    if (
      !(mapImageFileInput instanceof HTMLInputElement) ||
      !(mapImageCurrent instanceof HTMLElement)
    ) {
      return;
    }

    const file = mapImageFileInput.files?.[0] || null;
    if (!file) {
      return;
    }

    const fId = await fileStore.saveFileToStore(file, { body: "" });
    if (!fId) {
      return;
    }

    editingWorld = {
      ...editingWorld,
      mapImgPath: fId,
    };
    mapImageCurrent.textContent = fId;
    await saveWorld(editingWorld);
    if (onAfterSave) {
      await onAfterSave();
    }
    mapImageFileInput.value = "";
  }

  async function openRegisteredImagePicker(): Promise<void> {
    if (!editingWorld) {
      return;
    }

    const rows = await fileStore.fetchRegisteredImageRows();
    const oldBack = document.getElementById("yg_image_picker_back");
    const oldPop = document.getElementById("yg_image_picker_popup");
    oldBack?.remove();
    oldPop?.remove();

    const overlayRoot =
      document.querySelector(MAPPAGE_SELECTOR.worldDialogShell) ||
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
    titleEl.textContent = "登録済み画像から選択";
    titleEl.style.margin = "0";
    pop.appendChild(titleEl);

    const toolRow = document.createElement("div");
    toolRow.style.display = "flex";
    toolRow.style.gap = "8px";
    toolRow.style.flexWrap = "wrap";
    pop.appendChild(toolRow);

    const qInput = document.createElement("input");
    qInput.type = "text";
    qInput.placeholder = "名前(nm)で絞り込み";
    qInput.style.flex = "1 1 280px";
    qInput.style.minWidth = "200px";
    toolRow.appendChild(qInput);

    const extSelect = document.createElement("select");
    ["", "png", "jpg", "jpeg", "webp", "gif", "svg"].forEach((ext) => {
      const opt = document.createElement("option");
      opt.value = ext;
      opt.textContent = ext ? `.${ext}` : "拡張子: すべて";
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
    closeBtn.textContent = "閉じる";
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

      count.textContent = `${filtered.length} 件`;

      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = "該当する画像がありません";
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

        card.addEventListener("click", async () => {
          if (!editingWorld) {
            close();
            return;
          }

          editingWorld = {
            ...editingWorld,
            mapImgPath: row.fId,
          };
          if (mapImageCurrent instanceof HTMLElement) {
            mapImageCurrent.textContent = row.fId;
          }

          await saveWorld(editingWorld);
          if (onAfterSave) {
            await onAfterSave();
          }
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
      !editingWorld ||
      !(progressRange instanceof HTMLInputElement) ||
      !(nameInput instanceof HTMLInputElement) ||
      !(descInput instanceof HTMLTextAreaElement) ||
      !(colorInput instanceof HTMLInputElement)
    ) {
      frame.close();
      return;
    }

    const nextWorld: WorldRecord = {
      ...editingWorld,
      nm: nameInput.value.trim() || editingWorld.nm,
      desc: descInput.value.trim(),
      baseColor: normalizeHexColor(colorInput.value),
      progress: clampProgress(Number.parseInt(progressRange.value, 10)),
    };

    editingWorld = nextWorld;
    await saveWorld(nextWorld);
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
      mapImageFileInput instanceof HTMLInputElement &&
      mapImageClearButton instanceof HTMLButtonElement
    ) {
      mapImageClearButton.addEventListener("click", () => {
        mapImageFileInput.value = "";
        if (editingWorld) {
          void syncImageTabFromWorld(editingWorld);
        }
      });
    }

    if (mapImagePickButton instanceof HTMLButtonElement) {
      mapImagePickButton.addEventListener("click", () => {
        void openRegisteredImagePicker();
      });
    }

    if (mapImageSaveButton instanceof HTMLButtonElement) {
      mapImageSaveButton.addEventListener("click", () => {
        void saveMapImageSelection();
      });
    }

    if (saveButton instanceof HTMLButtonElement) {
      saveButton.addEventListener("click", () => {
        void onSave();
      });
    }
  }

  function open(target: WorldRecord): void {
    if (
      !(progressRange instanceof HTMLInputElement) ||
      !(nameInput instanceof HTMLInputElement) ||
      !(descInput instanceof HTMLTextAreaElement) ||
      !(colorInput instanceof HTMLInputElement)
    ) {
      return;
    }

    playAudio(TOP_PAGE_SOUND_SOURCE.buttonClick);
    editingWorld = { ...target };

    nameInput.value = target.nm || "";
    descInput.value = String(target.desc || "");
    colorInput.value = normalizeHexColor(String(target.baseColor || "#ffc96b"));
    const progress = clampProgress(Number(target.progress ?? DEFAULT_PROGRESS));
    progressRange.value = String(progress);
    updateProgressPreview(progress);
    frame.setTab("basic");
    void syncImageTabFromWorld(target);
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
