import { FileStoreGateway, SpriteFileMeta } from "../data/file-store";
import { t } from "../i18n";
import { applyStageImageVisual, applyStageVisuals } from "../obj/stage";
import { playAudio } from "../sound/audio";
import { TOP_PAGE_SOUND_SOURCE } from "../sound/constants";
import { createBasicImageDialogFrame } from "../ui/common-dialog";
import { DEFAULT_PROGRESS } from "./constants";
import { MAPPAGE_SELECTOR } from "./dom";
import {
  buildImageFilterCss,
  normalizeImageBrightness,
  normalizeImageContrast,
  normalizeImageHue,
  renderSpriteCellDataUrl,
} from "./image-filter";
import { setMapObjectLabel } from "./object-view";
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
  stageImagePreview: HTMLElement | null;
  stageImageHueInput: HTMLElement | null;
  stageImageHueRange: HTMLElement | null;
  stageImageBrightnessInput: HTMLElement | null;
  stageImageBrightnessRange: HTMLElement | null;
  stageImageContrastInput: HTMLElement | null;
  stageImageContrastRange: HTMLElement | null;
  stageSpriteToggle: HTMLElement | null;
  stageSpriteMetaInfo: HTMLElement | null;
  stageSpriteCoordGroup: HTMLElement | null;
  stageSpriteRowInput: HTMLElement | null;
  stageSpriteColInput: HTMLElement | null;
  mapImageFileInput: HTMLElement | null;
  mapImagePickButton: HTMLElement | null;
  mapImageClearButton: HTMLElement | null;
  mapImageSaveButton: HTMLElement | null;
  mapImageCurrent: HTMLElement | null;
  mapImagePreview: HTMLElement | null;
  mapImageHueInput: HTMLElement | null;
  mapImageHueRange: HTMLElement | null;
  mapImageBrightnessInput: HTMLElement | null;
  mapImageBrightnessRange: HTMLElement | null;
  mapImageContrastInput: HTMLElement | null;
  mapImageContrastRange: HTMLElement | null;
  cancelButton: HTMLElement | null;
  saveButton: HTMLElement | null;
};

type StageDialogControllerOptions = {
  elements: StageDialogElements;
  fileStore: FileStoreGateway;
  saveStageFromElement: (target: HTMLButtonElement) => Promise<void>;
};

export type StageDialogController = {
  bindEvents: () => void;
  open: (target: HTMLButtonElement) => void;
  close: () => void;
};

export function createStageDialogController(
  options: StageDialogControllerOptions,
): StageDialogController {
  const { elements, fileStore, saveStageFromElement } = options;
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
    stageImagePreview,
    stageImageHueInput,
    stageImageHueRange,
    stageImageBrightnessInput,
    stageImageBrightnessRange,
    stageImageContrastInput,
    stageImageContrastRange,
    stageSpriteToggle,
    stageSpriteMetaInfo,
    stageSpriteCoordGroup,
    stageSpriteRowInput,
    stageSpriteColInput,
    mapImageFileInput,
    mapImagePickButton,
    mapImageClearButton,
    mapImageSaveButton,
    mapImageCurrent,
    mapImagePreview,
    mapImageHueInput,
    mapImageHueRange,
    mapImageBrightnessInput,
    mapImageBrightnessRange,
    mapImageContrastInput,
    mapImageContrastRange,
    cancelButton,
    saveButton,
  } = elements;

  let editingStage: HTMLButtonElement | null = null;
  let currentStageSpriteMeta: SpriteFileMeta | null = null;
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

    if (progressRange instanceof HTMLInputElement) {
      const trackColor = "rgba(12, 8, 4, 0.9)";
      const fillColor = "#9b60d0";
      progressRange.style.background = `linear-gradient(to right, ${fillColor} ${safeValue}%, ${trackColor} ${safeValue}%)`;
    }
  }

  function syncFilterPair(
    textInput: HTMLInputElement | null,
    rangeInput: HTMLInputElement | null,
    value: number,
  ): void {
    const text = String(value);
    if (textInput) {
      textInput.value = text;
    }
    if (rangeInput) {
      rangeInput.value = text;
    }
  }

  function buildStageImgSpriteClip():
    | { meta: SpriteFileMeta; row: number; col: number }
    | undefined {
    if (!currentStageSpriteMeta || !editingStage) {
      return undefined;
    }
    return {
      meta: currentStageSpriteMeta,
      row: Number.parseInt(editingStage.dataset.stageSpriteRow || "0", 10),
      col: Number.parseInt(editingStage.dataset.stageSpriteCol || "0", 10),
    };
  }

  async function updateImagePreview(
    previewElement: HTMLElement | null,
    fId: string,
    filterValues: { hue: number; brightness: number; contrast: number },
    spriteClip?: { meta: SpriteFileMeta; row: number; col: number },
  ): Promise<void> {
    if (!(previewElement instanceof HTMLImageElement)) {
      return;
    }

    const path = String(fId || "").trim();
    if (!path) {
      previewElement.hidden = true;
      previewElement.removeAttribute("src");
      previewElement.style.removeProperty("filter");
      return;
    }

    const objectUrl = await fileStore.getObjectUrlForFile(path);
    const resolvedUrl = objectUrl || path;
    let finalSrc = resolvedUrl;
    if (spriteClip) {
      const cellDataUrl = await renderSpriteCellDataUrl(
        resolvedUrl,
        spriteClip.meta,
        spriteClip.row,
        spriteClip.col,
      );
      if (cellDataUrl) {
        finalSrc = cellDataUrl;
      }
    }
    previewElement.src = finalSrc;
    previewElement.style.filter = buildImageFilterCss(filterValues);
    previewElement.hidden = false;
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
    currentStageSpriteMeta = spriteMeta;
    if (
      !(stageSpriteCoordGroup instanceof HTMLElement) ||
      !(stageSpriteRowInput instanceof HTMLInputElement) ||
      !(stageSpriteColInput instanceof HTMLInputElement) ||
      !(stageSpriteMetaInfo instanceof HTMLElement) ||
      !(stageSpriteToggle instanceof HTMLInputElement)
    ) {
      return;
    }

    stageSpriteToggle.checked = !!spriteMeta;
    stageSpriteMetaInfo.textContent = buildSpriteMetaText(spriteMeta);
    stageSpriteCoordGroup.hidden = !spriteMeta;

    if (!spriteMeta) {
      stageSpriteRowInput.value = "1";
      stageSpriteColInput.value = "1";
      stageSpriteRowInput.removeAttribute("max");
      stageSpriteColInput.removeAttribute("max");
      return;
    }

    const rowZero = Number.parseInt(target?.dataset.stageSpriteRow || "0", 10);
    const colZero = Number.parseInt(target?.dataset.stageSpriteCol || "0", 10);
    const safeRow = Number.isFinite(rowZero) && rowZero >= 0 ? rowZero : 0;
    const safeCol = Number.isFinite(colZero) && colZero >= 0 ? colZero : 0;
    const clampedRow = Math.min(safeRow, Math.max(0, spriteMeta.nh - 1));
    const clampedCol = Math.min(safeCol, Math.max(0, spriteMeta.nw - 1));

    if (target) {
      target.dataset.stageSpriteRow = String(clampedRow);
      target.dataset.stageSpriteCol = String(clampedCol);
    }

    stageSpriteRowInput.max = String(spriteMeta.nh);
    stageSpriteColInput.max = String(spriteMeta.nw);
    stageSpriteRowInput.value = String(clampedRow + 1);
    stageSpriteColInput.value = String(clampedCol + 1);
  }

  function syncSpritePlacementFromInputs(): void {
    if (
      !editingStage ||
      !(stageSpriteRowInput instanceof HTMLInputElement) ||
      !(stageSpriteColInput instanceof HTMLInputElement)
    ) {
      return;
    }

    const row = Math.max(
      1,
      Number.parseInt(stageSpriteRowInput.value || "1", 10),
    );
    const col = Math.max(
      1,
      Number.parseInt(stageSpriteColInput.value || "1", 10),
    );
    editingStage.dataset.stageSpriteRow = String(row - 1);
    editingStage.dataset.stageSpriteCol = String(col - 1);
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

  async function syncImageTabFromStage(
    target: HTMLButtonElement,
  ): Promise<void> {
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
    const stageImgHue = normalizeImageHue(target.dataset.stageImgHue);
    const stageImgBrightness = normalizeImageBrightness(
      target.dataset.stageImgBrightness,
    );
    const stageImgContrast = normalizeImageContrast(
      target.dataset.stageImgContrast,
    );
    const mapImgHue = normalizeImageHue(target.dataset.stageMapImgHue);
    const mapImgBrightness = normalizeImageBrightness(
      target.dataset.stageMapImgBrightness,
    );
    const mapImgContrast = normalizeImageContrast(
      target.dataset.stageMapImgContrast,
    );
    stageImageCurrent.textContent = stageImgPath || "-";
    mapImageCurrent.textContent = mapImgPath || "-";
    target.dataset.stageImgHue = String(stageImgHue);
    target.dataset.stageImgBrightness = String(stageImgBrightness);
    target.dataset.stageImgContrast = String(stageImgContrast);
    target.dataset.stageMapImgHue = String(mapImgHue);
    target.dataset.stageMapImgBrightness = String(mapImgBrightness);
    target.dataset.stageMapImgContrast = String(mapImgContrast);

    syncFilterPair(
      stageImageHueInput instanceof HTMLInputElement
        ? stageImageHueInput
        : null,
      stageImageHueRange instanceof HTMLInputElement
        ? stageImageHueRange
        : null,
      stageImgHue,
    );
    syncFilterPair(
      stageImageBrightnessInput instanceof HTMLInputElement
        ? stageImageBrightnessInput
        : null,
      stageImageBrightnessRange instanceof HTMLInputElement
        ? stageImageBrightnessRange
        : null,
      stageImgBrightness,
    );
    syncFilterPair(
      stageImageContrastInput instanceof HTMLInputElement
        ? stageImageContrastInput
        : null,
      stageImageContrastRange instanceof HTMLInputElement
        ? stageImageContrastRange
        : null,
      stageImgContrast,
    );
    syncFilterPair(
      mapImageHueInput instanceof HTMLInputElement ? mapImageHueInput : null,
      mapImageHueRange instanceof HTMLInputElement ? mapImageHueRange : null,
      mapImgHue,
    );
    syncFilterPair(
      mapImageBrightnessInput instanceof HTMLInputElement
        ? mapImageBrightnessInput
        : null,
      mapImageBrightnessRange instanceof HTMLInputElement
        ? mapImageBrightnessRange
        : null,
      mapImgBrightness,
    );
    syncFilterPair(
      mapImageContrastInput instanceof HTMLInputElement
        ? mapImageContrastInput
        : null,
      mapImageContrastRange instanceof HTMLInputElement
        ? mapImageContrastRange
        : null,
      mapImgContrast,
    );

    const spriteMeta = stageImgPath
      ? await fileStore.getSpriteMetaForFile(stageImgPath)
      : null;
    updateSpriteCoordinateInputs(target, spriteMeta);

    await updateImagePreview(
      stageImagePreview,
      stageImgPath,
      {
        hue: stageImgHue,
        brightness: stageImgBrightness,
        contrast: stageImgContrast,
      },
      buildStageImgSpriteClip(),
    );
    await updateImagePreview(mapImagePreview, mapImgPath, {
      hue: mapImgHue,
      brightness: mapImgBrightness,
      contrast: mapImgContrast,
    });
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

    let body = "";
    let spriteMeta: SpriteFileMeta | null = null;
    if (kind === "stage" && stageSpriteToggle instanceof HTMLInputElement) {
      if (stageSpriteToggle.checked) {
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

    if (kind === "stage") {
      editingStage.dataset.stageImgPath = fId;
      if (stageImageHueInput instanceof HTMLInputElement) {
        editingStage.dataset.stageImgHue = String(
          normalizeImageHue(stageImageHueInput.value),
        );
      }
      if (stageImageBrightnessInput instanceof HTMLInputElement) {
        editingStage.dataset.stageImgBrightness = String(
          normalizeImageBrightness(stageImageBrightnessInput.value),
        );
      }
      if (stageImageContrastInput instanceof HTMLInputElement) {
        editingStage.dataset.stageImgContrast = String(
          normalizeImageContrast(stageImageContrastInput.value),
        );
      }
      updateSpriteCoordinateInputs(editingStage, spriteMeta);
      syncSpritePlacementFromInputs();
      stageImageCurrent.textContent = fId;
      await applyStageImageVisual(editingStage, fileStore);
      await updateImagePreview(
        stageImagePreview,
        fId,
        {
          hue: normalizeImageHue(editingStage.dataset.stageImgHue),
          brightness: normalizeImageBrightness(
            editingStage.dataset.stageImgBrightness,
          ),
          contrast: normalizeImageContrast(
            editingStage.dataset.stageImgContrast,
          ),
        },
        buildStageImgSpriteClip(),
      );
    } else {
      editingStage.dataset.stageMapImgPath = fId;
      if (mapImageHueInput instanceof HTMLInputElement) {
        editingStage.dataset.stageMapImgHue = String(
          normalizeImageHue(mapImageHueInput.value),
        );
      }
      if (mapImageBrightnessInput instanceof HTMLInputElement) {
        editingStage.dataset.stageMapImgBrightness = String(
          normalizeImageBrightness(mapImageBrightnessInput.value),
        );
      }
      if (mapImageContrastInput instanceof HTMLInputElement) {
        editingStage.dataset.stageMapImgContrast = String(
          normalizeImageContrast(mapImageContrastInput.value),
        );
      }
      mapImageCurrent.textContent = fId;
      await updateImagePreview(mapImagePreview, fId, {
        hue: normalizeImageHue(editingStage.dataset.stageMapImgHue),
        brightness: normalizeImageBrightness(
          editingStage.dataset.stageMapImgBrightness,
        ),
        contrast: normalizeImageContrast(
          editingStage.dataset.stageMapImgContrast,
        ),
      });
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
            if (stageImageHueInput instanceof HTMLInputElement) {
              editingStage.dataset.stageImgHue = String(
                normalizeImageHue(stageImageHueInput.value),
              );
            }
            if (stageImageBrightnessInput instanceof HTMLInputElement) {
              editingStage.dataset.stageImgBrightness = String(
                normalizeImageBrightness(stageImageBrightnessInput.value),
              );
            }
            if (stageImageContrastInput instanceof HTMLInputElement) {
              editingStage.dataset.stageImgContrast = String(
                normalizeImageContrast(stageImageContrastInput.value),
              );
            }
            updateSpriteCoordinateInputs(editingStage, row.spriteMeta);
            syncSpritePlacementFromInputs();
            if (stageImageCurrent instanceof HTMLElement) {
              stageImageCurrent.textContent = row.fId;
            }
            await applyStageImageVisual(editingStage, fileStore);
            await updateImagePreview(
              stageImagePreview,
              row.fId,
              {
                hue: normalizeImageHue(editingStage.dataset.stageImgHue),
                brightness: normalizeImageBrightness(
                  editingStage.dataset.stageImgBrightness,
                ),
                contrast: normalizeImageContrast(
                  editingStage.dataset.stageImgContrast,
                ),
              },
              buildStageImgSpriteClip(),
            );
          } else {
            editingStage.dataset.stageMapImgPath = row.fId;
            if (mapImageHueInput instanceof HTMLInputElement) {
              editingStage.dataset.stageMapImgHue = String(
                normalizeImageHue(mapImageHueInput.value),
              );
            }
            if (mapImageBrightnessInput instanceof HTMLInputElement) {
              editingStage.dataset.stageMapImgBrightness = String(
                normalizeImageBrightness(mapImageBrightnessInput.value),
              );
            }
            if (mapImageContrastInput instanceof HTMLInputElement) {
              editingStage.dataset.stageMapImgContrast = String(
                normalizeImageContrast(mapImageContrastInput.value),
              );
            }
            if (mapImageCurrent instanceof HTMLElement) {
              mapImageCurrent.textContent = row.fId;
            }
            await updateImagePreview(mapImagePreview, row.fId, {
              hue: normalizeImageHue(editingStage.dataset.stageMapImgHue),
              brightness: normalizeImageBrightness(
                editingStage.dataset.stageMapImgBrightness,
              ),
              contrast: normalizeImageContrast(
                editingStage.dataset.stageMapImgContrast,
              ),
            });
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
    const stageImgHue =
      stageImageHueInput instanceof HTMLInputElement
        ? normalizeImageHue(stageImageHueInput.value)
        : normalizeImageHue(editingStage.dataset.stageImgHue);
    const stageImgBrightness =
      stageImageBrightnessInput instanceof HTMLInputElement
        ? normalizeImageBrightness(stageImageBrightnessInput.value)
        : normalizeImageBrightness(editingStage.dataset.stageImgBrightness);
    const stageImgContrast =
      stageImageContrastInput instanceof HTMLInputElement
        ? normalizeImageContrast(stageImageContrastInput.value)
        : normalizeImageContrast(editingStage.dataset.stageImgContrast);
    const mapImgHue =
      mapImageHueInput instanceof HTMLInputElement
        ? normalizeImageHue(mapImageHueInput.value)
        : normalizeImageHue(editingStage.dataset.stageMapImgHue);
    const mapImgBrightness =
      mapImageBrightnessInput instanceof HTMLInputElement
        ? normalizeImageBrightness(mapImageBrightnessInput.value)
        : normalizeImageBrightness(editingStage.dataset.stageMapImgBrightness);
    const mapImgContrast =
      mapImageContrastInput instanceof HTMLInputElement
        ? normalizeImageContrast(mapImageContrastInput.value)
        : normalizeImageContrast(editingStage.dataset.stageMapImgContrast);

    setMapObjectLabel(editingStage, nextName);
    editingStage.dataset.stageDesc = nextDesc;
    editingStage.dataset.stageColor = nextColor;
    editingStage.dataset.stageProgress = String(nextProgress);
    editingStage.dataset.stageImgHue = String(stageImgHue);
    editingStage.dataset.stageImgBrightness = String(stageImgBrightness);
    editingStage.dataset.stageImgContrast = String(stageImgContrast);
    editingStage.dataset.stageMapImgHue = String(mapImgHue);
    editingStage.dataset.stageMapImgBrightness = String(mapImgBrightness);
    editingStage.dataset.stageMapImgContrast = String(mapImgContrast);
    syncSpritePlacementFromInputs();
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
        if (editingStage) {
          void syncImageTabFromStage(editingStage);
        } else {
          updateSpriteCoordinateInputs(null, null);
        }
      });
    }

    if (stageImageFileInput instanceof HTMLInputElement) {
      stageImageFileInput.addEventListener("change", async () => {
        const file = stageImageFileInput.files?.[0] || null;
        if (!file) {
          if (editingStage) {
            void syncImageTabFromStage(editingStage);
          } else {
            updateSpriteCoordinateInputs(null, null);
          }
          return;
        }

        if (
          !(stageSpriteToggle instanceof HTMLInputElement) ||
          !stageSpriteToggle.checked
        ) {
          updateSpriteCoordinateInputs(editingStage, null);
          return;
        }

        const spriteMeta = await buildSpriteMetaFromFile(file);
        if (!spriteMeta) {
          stageImageFileInput.value = "";
          return;
        }
        updateSpriteCoordinateInputs(editingStage, spriteMeta);
      });
    }

    if (stageSpriteToggle instanceof HTMLInputElement) {
      stageSpriteToggle.addEventListener("change", async () => {
        const file =
          stageImageFileInput instanceof HTMLInputElement
            ? stageImageFileInput.files?.[0] || null
            : null;
        if (!file) {
          if (editingStage) {
            void syncImageTabFromStage(editingStage);
          } else {
            updateSpriteCoordinateInputs(null, null);
          }
          return;
        }

        if (!stageSpriteToggle.checked) {
          updateSpriteCoordinateInputs(editingStage, null);
          return;
        }

        const spriteMeta = await buildSpriteMetaFromFile(file);
        if (!spriteMeta) {
          stageSpriteToggle.checked = false;
          return;
        }
        updateSpriteCoordinateInputs(editingStage, spriteMeta);
      });
    }

    const handleSpritePlacementInput = () => {
      syncSpritePlacementFromInputs();
      if (editingStage) {
        void applyStageImageVisual(editingStage, fileStore);
        void updateImagePreview(
          stageImagePreview,
          editingStage.dataset.stageImgPath || "",
          {
            hue: normalizeImageHue(editingStage.dataset.stageImgHue),
            brightness: normalizeImageBrightness(
              editingStage.dataset.stageImgBrightness,
            ),
            contrast: normalizeImageContrast(
              editingStage.dataset.stageImgContrast,
            ),
          },
          buildStageImgSpriteClip(),
        );
      }
    };

    if (stageSpriteRowInput instanceof HTMLInputElement) {
      stageSpriteRowInput.addEventListener("input", handleSpritePlacementInput);
    }

    if (stageSpriteColInput instanceof HTMLInputElement) {
      stageSpriteColInput.addEventListener("input", handleSpritePlacementInput);
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

    if (stageImageHueInput instanceof HTMLInputElement) {
      stageImageHueInput.addEventListener("input", () => {
        if (!editingStage) {
          return;
        }
        const next = normalizeImageHue(stageImageHueInput.value);
        editingStage.dataset.stageImgHue = String(next);
        syncFilterPair(
          stageImageHueInput,
          stageImageHueRange instanceof HTMLInputElement
            ? stageImageHueRange
            : null,
          next,
        );
        void applyStageImageVisual(editingStage, fileStore);
        void updateImagePreview(
          stageImagePreview,
          editingStage.dataset.stageImgPath || "",
          {
            hue: next,
            brightness: normalizeImageBrightness(
              editingStage.dataset.stageImgBrightness,
            ),
            contrast: normalizeImageContrast(
              editingStage.dataset.stageImgContrast,
            ),
          },
          buildStageImgSpriteClip(),
        );
      });
    }

    if (stageImageHueRange instanceof HTMLInputElement) {
      stageImageHueRange.addEventListener("input", () => {
        if (!(stageImageHueInput instanceof HTMLInputElement)) {
          return;
        }
        stageImageHueInput.value = stageImageHueRange.value;
        stageImageHueInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    if (stageImageBrightnessInput instanceof HTMLInputElement) {
      stageImageBrightnessInput.addEventListener("input", () => {
        if (!editingStage) {
          return;
        }
        const next = normalizeImageBrightness(stageImageBrightnessInput.value);
        editingStage.dataset.stageImgBrightness = String(next);
        syncFilterPair(
          stageImageBrightnessInput,
          stageImageBrightnessRange instanceof HTMLInputElement
            ? stageImageBrightnessRange
            : null,
          next,
        );
        void applyStageImageVisual(editingStage, fileStore);
        void updateImagePreview(
          stageImagePreview,
          editingStage.dataset.stageImgPath || "",
          {
            hue: normalizeImageHue(editingStage.dataset.stageImgHue),
            brightness: next,
            contrast: normalizeImageContrast(
              editingStage.dataset.stageImgContrast,
            ),
          },
          buildStageImgSpriteClip(),
        );
      });
    }

    if (stageImageBrightnessRange instanceof HTMLInputElement) {
      stageImageBrightnessRange.addEventListener("input", () => {
        if (!(stageImageBrightnessInput instanceof HTMLInputElement)) {
          return;
        }
        stageImageBrightnessInput.value = stageImageBrightnessRange.value;
        stageImageBrightnessInput.dispatchEvent(
          new Event("input", { bubbles: true }),
        );
      });
    }

    if (stageImageContrastInput instanceof HTMLInputElement) {
      stageImageContrastInput.addEventListener("input", () => {
        if (!editingStage) {
          return;
        }
        const next = normalizeImageContrast(stageImageContrastInput.value);
        editingStage.dataset.stageImgContrast = String(next);
        syncFilterPair(
          stageImageContrastInput,
          stageImageContrastRange instanceof HTMLInputElement
            ? stageImageContrastRange
            : null,
          next,
        );
        void applyStageImageVisual(editingStage, fileStore);
        void updateImagePreview(
          stageImagePreview,
          editingStage.dataset.stageImgPath || "",
          {
            hue: normalizeImageHue(editingStage.dataset.stageImgHue),
            brightness: normalizeImageBrightness(
              editingStage.dataset.stageImgBrightness,
            ),
            contrast: next,
          },
          buildStageImgSpriteClip(),
        );
      });
    }

    if (stageImageContrastRange instanceof HTMLInputElement) {
      stageImageContrastRange.addEventListener("input", () => {
        if (!(stageImageContrastInput instanceof HTMLInputElement)) {
          return;
        }
        stageImageContrastInput.value = stageImageContrastRange.value;
        stageImageContrastInput.dispatchEvent(
          new Event("input", { bubbles: true }),
        );
      });
    }

    if (mapImageSaveButton instanceof HTMLButtonElement) {
      mapImageSaveButton.addEventListener("click", () => {
        void saveImageTabSelection("map");
      });
    }

    if (mapImageHueInput instanceof HTMLInputElement) {
      mapImageHueInput.addEventListener("input", () => {
        if (!editingStage) {
          return;
        }
        const next = normalizeImageHue(mapImageHueInput.value);
        editingStage.dataset.stageMapImgHue = String(next);
        syncFilterPair(
          mapImageHueInput,
          mapImageHueRange instanceof HTMLInputElement
            ? mapImageHueRange
            : null,
          next,
        );
        void updateImagePreview(
          mapImagePreview,
          editingStage.dataset.stageMapImgPath || "",
          {
            hue: next,
            brightness: normalizeImageBrightness(
              editingStage.dataset.stageMapImgBrightness,
            ),
            contrast: normalizeImageContrast(
              editingStage.dataset.stageMapImgContrast,
            ),
          },
        );
      });
    }

    if (mapImageHueRange instanceof HTMLInputElement) {
      mapImageHueRange.addEventListener("input", () => {
        if (!(mapImageHueInput instanceof HTMLInputElement)) {
          return;
        }
        mapImageHueInput.value = mapImageHueRange.value;
        mapImageHueInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    if (mapImageBrightnessInput instanceof HTMLInputElement) {
      mapImageBrightnessInput.addEventListener("input", () => {
        if (!editingStage) {
          return;
        }
        const next = normalizeImageBrightness(mapImageBrightnessInput.value);
        editingStage.dataset.stageMapImgBrightness = String(next);
        syncFilterPair(
          mapImageBrightnessInput,
          mapImageBrightnessRange instanceof HTMLInputElement
            ? mapImageBrightnessRange
            : null,
          next,
        );
        void updateImagePreview(
          mapImagePreview,
          editingStage.dataset.stageMapImgPath || "",
          {
            hue: normalizeImageHue(editingStage.dataset.stageMapImgHue),
            brightness: next,
            contrast: normalizeImageContrast(
              editingStage.dataset.stageMapImgContrast,
            ),
          },
        );
      });
    }

    if (mapImageBrightnessRange instanceof HTMLInputElement) {
      mapImageBrightnessRange.addEventListener("input", () => {
        if (!(mapImageBrightnessInput instanceof HTMLInputElement)) {
          return;
        }
        mapImageBrightnessInput.value = mapImageBrightnessRange.value;
        mapImageBrightnessInput.dispatchEvent(
          new Event("input", { bubbles: true }),
        );
      });
    }

    if (mapImageContrastInput instanceof HTMLInputElement) {
      mapImageContrastInput.addEventListener("input", () => {
        if (!editingStage) {
          return;
        }
        const next = normalizeImageContrast(mapImageContrastInput.value);
        editingStage.dataset.stageMapImgContrast = String(next);
        syncFilterPair(
          mapImageContrastInput,
          mapImageContrastRange instanceof HTMLInputElement
            ? mapImageContrastRange
            : null,
          next,
        );
        void updateImagePreview(
          mapImagePreview,
          editingStage.dataset.stageMapImgPath || "",
          {
            hue: normalizeImageHue(editingStage.dataset.stageMapImgHue),
            brightness: normalizeImageBrightness(
              editingStage.dataset.stageMapImgBrightness,
            ),
            contrast: next,
          },
        );
      });
    }

    if (mapImageContrastRange instanceof HTMLInputElement) {
      mapImageContrastRange.addEventListener("input", () => {
        if (!(mapImageContrastInput instanceof HTMLInputElement)) {
          return;
        }
        mapImageContrastInput.value = mapImageContrastRange.value;
        mapImageContrastInput.dispatchEvent(
          new Event("input", { bubbles: true }),
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
    void syncImageTabFromStage(target);
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
