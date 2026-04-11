import { downloadYGBackupJson, restoreYGBackupFromFile } from "./db-backup";
import { applyI18n, t } from "./i18n";
import { ensureYGDatabase, openYGDatabase } from "./init-db";

type StageRecord = {
  stgId: string;
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

const BODY_READY_CLASS = "ready";
const MAP_VISIBLE_CLASS = "map-visible";
const INTRO_DONE_CLASS = "intro-done";
const LOGO_FADE_OUT_CLASS = "logo-fade-out";
const EDIT_MODE_CLASS = "edit-mode";
const VIEW_MODE_CLASS = "view-mode";

const ADD_BUTTON_ID = "addStageBtn";
const LOGO_WRAP_ID = "logoWrap";
const MODE_SWITCH_ID = "modeSwitch";
const STAGE_MAP_ID = "stageMap";
const DB_DOWNLOAD_BUTTON_ID = "dbDownloadBtn";
const DB_UPLOAD_BUTTON_ID = "dbUploadBtn";
const DB_UPLOAD_INPUT_ID = "dbUploadInput";
const DB_MAINT_BUTTON_ID = "dbMaintBtn";
const DIALOG_ID = "stageSettingsDialog";
const DIALOG_BACKDROP_ID = "stageDialogBackdrop";
const DIALOG_TITLE_ID = "stageDialogTitle";
const DIALOG_TAB_BASIC_ID = "stageDialogTabBasic";
const DIALOG_TAB_IMAGE_ID = "stageDialogTabImage";
const DIALOG_PANEL_BASIC_ID = "stageDialogPanelBasic";
const DIALOG_PANEL_IMAGE_ID = "stageDialogPanelImage";
const PROGRESS_RANGE_ID = "stageProgressRange";
const PROGRESS_BAR_FILL_ID = "stageProgressBarFill";
const PROGRESS_VALUE_ID = "stageProgressValue";
const NAME_INPUT_ID = "stageNameInput";
const DESC_INPUT_ID = "stageDescInput";
const COLOR_INPUT_ID = "stageColorInput";
const STAGE_IMAGE_FILE_INPUT_ID = "stageImageFileInput";
const STAGE_IMAGE_PICK_BUTTON_ID = "stageImagePickBtn";
const STAGE_IMAGE_CLEAR_BUTTON_ID = "stageImageClearBtn";
const STAGE_IMAGE_SAVE_BUTTON_ID = "stageImageSaveBtn";
const STAGE_IMAGE_CURRENT_ID = "stageImageCurrent";
const MAP_IMAGE_FILE_INPUT_ID = "mapImageFileInput";
const MAP_IMAGE_PICK_BUTTON_ID = "mapImagePickBtn";
const MAP_IMAGE_CLEAR_BUTTON_ID = "mapImageClearBtn";
const MAP_IMAGE_SAVE_BUTTON_ID = "mapImageSaveBtn";
const MAP_IMAGE_CURRENT_ID = "mapImageCurrent";
const CANCEL_BUTTON_ID = "stageDialogCancel";
const SAVE_BUTTON_ID = "stageDialogSave";

const STAGE_DEFAULT_SIZE = 74;
const DEFAULT_PROGRESS = 100;
const LOGO_DISMISS_TIMEOUT_MS = 3000;
const LOGO_FADE_DURATION_MS = 360;

const addBtn = document.getElementById(ADD_BUTTON_ID);
const logoWrap = document.getElementById(LOGO_WRAP_ID);
const modeSwitch = document.getElementById(MODE_SWITCH_ID);
const stageMap = document.getElementById(STAGE_MAP_ID);
const dbDownloadBtn = document.getElementById(DB_DOWNLOAD_BUTTON_ID);
const dbUploadBtn = document.getElementById(DB_UPLOAD_BUTTON_ID);
const dbUploadInput = document.getElementById(DB_UPLOAD_INPUT_ID);
const dbMaintBtn = document.getElementById(DB_MAINT_BUTTON_ID);
const stageDialog = document.getElementById(DIALOG_ID);
const stageDialogBackdrop = document.getElementById(DIALOG_BACKDROP_ID);
const stageDialogTitle = document.getElementById(DIALOG_TITLE_ID);
const stageDialogTabBasic = document.getElementById(DIALOG_TAB_BASIC_ID);
const stageDialogTabImage = document.getElementById(DIALOG_TAB_IMAGE_ID);
const stageDialogPanelBasic = document.getElementById(DIALOG_PANEL_BASIC_ID);
const stageDialogPanelImage = document.getElementById(DIALOG_PANEL_IMAGE_ID);
const progressRange = document.getElementById(PROGRESS_RANGE_ID);
const progressBarFill = document.getElementById(PROGRESS_BAR_FILL_ID);
const progressValue = document.getElementById(PROGRESS_VALUE_ID);
const nameInput = document.getElementById(NAME_INPUT_ID);
const descInput = document.getElementById(DESC_INPUT_ID);
const colorInput = document.getElementById(COLOR_INPUT_ID);
const stageImageFileInput = document.getElementById(STAGE_IMAGE_FILE_INPUT_ID);
const stageImagePickButton = document.getElementById(
  STAGE_IMAGE_PICK_BUTTON_ID,
);
const stageImageClearButton = document.getElementById(
  STAGE_IMAGE_CLEAR_BUTTON_ID,
);
const stageImageSaveButton = document.getElementById(
  STAGE_IMAGE_SAVE_BUTTON_ID,
);
const stageImageCurrent = document.getElementById(STAGE_IMAGE_CURRENT_ID);
const mapImageFileInput = document.getElementById(MAP_IMAGE_FILE_INPUT_ID);
const mapImagePickButton = document.getElementById(MAP_IMAGE_PICK_BUTTON_ID);
const mapImageClearButton = document.getElementById(MAP_IMAGE_CLEAR_BUTTON_ID);
const mapImageSaveButton = document.getElementById(MAP_IMAGE_SAVE_BUTTON_ID);
const mapImageCurrent = document.getElementById(MAP_IMAGE_CURRENT_ID);
const cancelButton = document.getElementById(CANCEL_BUTTON_ID);
const saveButton = document.getElementById(SAVE_BUTTON_ID);

let stageCount = 0;
let editingStage: HTMLButtonElement | null = null;
let stageMapDefaultSrc = "";
const fileObjectUrlCache = new Map<string, string>();

// ローカルならdiv#infoを非表示にする
const host = window.location.hostname;
const isLocalHost =
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "::1" ||
  host.endsWith(".local");
if (isLocalHost) {
  const infoEl = document.getElementById("info");
  if (infoEl) {
    infoEl.style.display = "none";
  }
}

void initTopPage();

async function initTopPage(): Promise<void> {
  applyI18n(document);
  document.body.classList.add(VIEW_MODE_CLASS);

  window.setTimeout(() => {
    document.body.classList.add(BODY_READY_CLASS);
  }, 120);

  if (!addBtn || !logoWrap || !(modeSwitch instanceof HTMLInputElement)) {
    return;
  }

  const baseMapImg = getStageMapImageElement();
  if (baseMapImg) {
    stageMapDefaultSrc = baseMapImg.getAttribute("src") || baseMapImg.src || "";
  }

  if (dbDownloadBtn instanceof HTMLButtonElement) {
    dbDownloadBtn.addEventListener("click", () => {
      void downloadYGBackupJson();
    });
  }

  if (dbMaintBtn instanceof HTMLButtonElement) {
    dbMaintBtn.addEventListener("click", () => {
      window.location.href = "./settings.html";
    });
  }

  if (
    dbUploadBtn instanceof HTMLButtonElement &&
    dbUploadInput instanceof HTMLInputElement
  ) {
    dbUploadBtn.addEventListener("click", () => {
      dbUploadInput.click();
    });
    dbUploadInput.addEventListener("change", () => {
      const file = dbUploadInput.files?.[0];
      if (!file) {
        return;
      }
      void (async () => {
        try {
          await restoreYGBackupFromFile(file);
          await rerenderStagesFromDb();
          window.alert(t("restore_success"));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : t("restore_failed");
          window.alert(message);
        }
      })();
      dbUploadInput.value = "";
    });
  }

  await ensureYGDatabase();
  await waitForLogoDismiss(logoWrap);
  document.body.classList.add(INTRO_DONE_CLASS);
  document.body.classList.add(MAP_VISIBLE_CLASS);
  await waitForMapRevealComplete();

  const stages = await loadStages();
  stageCount = stages.length;

  for (const stage of stages) {
    const stageObject = createStageObject(stage);
    document.body.append(stageObject);
    placeStageObject(stageObject, stage.x, stage.y);
  }

  modeSwitch.checked = false;
  modeSwitch.addEventListener("change", () => {
    const editMode = modeSwitch.checked;
    document.body.classList.toggle(EDIT_MODE_CLASS, editMode);
    document.body.classList.toggle(VIEW_MODE_CLASS, !editMode);
  });

  addBtn.addEventListener("click", async () => {
    if (!document.body.classList.contains(EDIT_MODE_CLASS)) {
      return;
    }

    stageCount += 1;
    const stgId = buildStageId();
    const stageObject = createStageObject({
      stgId,
      ord: stageCount,
      nm: `ST${stageCount}`,
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
      t_c: Date.now(),
      t_u: Date.now(),
    });
    document.body.append(stageObject);

    const rect = logoWrap.getBoundingClientRect();
    placeStageObject(stageObject, rect.left + 22, rect.bottom + 22);

    await saveStageFromElement(stageObject, stageCount);
    beginDrag(stageObject);
  });

  setupDialogEvents();
}

async function waitForLogoDismiss(logoElement: HTMLElement): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;
    const timeoutId = window.setTimeout(startDismiss, LOGO_DISMISS_TIMEOUT_MS);

    const onKeyDown = () => {
      startDismiss();
    };

    const onMouseDown = () => {
      startDismiss();
    };

    function cleanupListeners(): void {
      window.clearTimeout(timeoutId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    }

    function finish(): void {
      if (settled) {
        return;
      }
      settled = true;
      logoElement.removeEventListener("transitionend", onTransitionEnd);
      cleanupListeners();
      resolve();
    }

    function onTransitionEnd(event: TransitionEvent): void {
      if (event.target === logoElement && event.propertyName === "opacity") {
        finish();
      }
    }

    function startDismiss(): void {
      if (settled) {
        return;
      }
      cleanupListeners();
      document.body.classList.add(LOGO_FADE_OUT_CLASS);
      logoElement.addEventListener("transitionend", onTransitionEnd, {
        once: true,
      });
      window.setTimeout(finish, LOGO_FADE_DURATION_MS + 120);
    }

    window.addEventListener("keydown", onKeyDown, { once: true });
    window.addEventListener("mousedown", onMouseDown, { once: true });
  });
}

async function waitForMapRevealComplete(): Promise<void> {
  if (!(stageMap instanceof HTMLElement)) {
    return;
  }

  if (!document.body.classList.contains(MAP_VISIBLE_CLASS)) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;

    const done = () => {
      if (settled) {
        return;
      }
      settled = true;
      stageMap.removeEventListener("transitionend", onTransitionEnd);
      resolve();
    };

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === stageMap && event.propertyName === "opacity") {
        done();
      }
    };

    stageMap.addEventListener("transitionend", onTransitionEnd, {
      once: true,
    });

    window.setTimeout(done, 980);
  });
}

function createStageObject(stage: StageRecord): HTMLButtonElement {
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

  applyStageVisuals(el);

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("dblclick", onStageDoubleClick);
  el.addEventListener("click", onStageClick);
  return el;
}

function onStageClick(event: MouseEvent): void {
  if (!document.body.classList.contains(VIEW_MODE_CLASS)) {
    return;
  }

  const target = event.currentTarget;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  void applyStageMapImage(target);
}

function onStageDoubleClick(event: MouseEvent): void {
  if (!document.body.classList.contains(EDIT_MODE_CLASS)) {
    return;
  }

  const target = event.currentTarget;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  openStageSettingsDialog(target);
}

function onPointerDown(event: PointerEvent): void {
  if (!document.body.classList.contains(EDIT_MODE_CLASS)) {
    return;
  }

  const target = event.currentTarget;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  beginDrag(target, event);
}

function beginDrag(target: HTMLButtonElement, startEvent?: PointerEvent): void {
  target.classList.add("dragging");

  const targetRect = target.getBoundingClientRect();
  const offsetX = startEvent
    ? startEvent.clientX - targetRect.left
    : targetRect.width / 2;
  const offsetY = startEvent
    ? startEvent.clientY - targetRect.top
    : targetRect.height / 2;

  const move = (clientX: number, clientY: number) => {
    placeStageObject(target, clientX - offsetX, clientY - offsetY);
  };

  const onMove = (event: PointerEvent) => {
    move(event.clientX, event.clientY);
  };

  const onUp = () => {
    target.classList.remove("dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    void saveStageFromElement(target);
  };

  if (startEvent && startEvent.pointerId != null) {
    target.setPointerCapture(startEvent.pointerId);
    move(startEvent.clientX, startEvent.clientY);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

function placeStageObject(
  target: HTMLElement,
  left: number,
  top: number,
): void {
  const maxLeft = window.innerWidth - target.offsetWidth;
  const maxTop = window.innerHeight - target.offsetHeight;
  target.style.left = `${Math.max(0, Math.min(left, maxLeft))}px`;
  target.style.top = `${Math.max(0, Math.min(top, maxTop))}px`;
}

function buildStageId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `stg_${Date.now()}_${rand}`;
}

function getElementPosition(target: HTMLElement): { x: number; y: number } {
  const left = Number.parseFloat(target.style.left);
  const top = Number.parseFloat(target.style.top);
  return {
    x: Number.isFinite(left) ? left : 0,
    y: Number.isFinite(top) ? top : 0,
  };
}

async function loadStages(): Promise<StageRecord[]> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("stages", "readonly");
    const store = tx.objectStore("stages");
    const rows = (await requestToPromise(
      store.getAll(),
    )) as Partial<StageRecord>[];

    const normalized = rows
      .filter((row) => typeof row.stgId === "string")
      .map((row, index) => normalizeStageRow(row, index));

    normalized.sort((a, b) => a.ord - b.ord);
    return normalized;
  } finally {
    db.close();
  }
}

async function saveStageFromElement(
  target: HTMLButtonElement,
  ordOverride?: number,
): Promise<void> {
  const stgId = target.dataset.stageId;
  const stageName = target.dataset.stageLabel;
  const stageDesc = target.dataset.stageDesc || "";
  const stageColor = normalizeHexColor(target.dataset.stageColor || "#ffc96b");
  const stageProgress = Number.parseInt(
    target.dataset.stageProgress || `${DEFAULT_PROGRESS}`,
    10,
  );
  const stageImgPath = String(target.dataset.stageImgPath || "").trim();
  const stageMapImgPath = String(target.dataset.stageMapImgPath || "").trim();
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

  const now = Date.now();
  const record: StageRecord = {
    stgId,
    ord,
    nm: stageName,
    desc: stageDesc,
    baseColor: stageColor,
    progress: clampProgress(stageProgress),
    imgPath: stageImgPath,
    mapImgPath: stageMapImgPath,
    x: pos.x,
    y: pos.y,
    w: STAGE_DEFAULT_SIZE,
    h: STAGE_DEFAULT_SIZE,
    rot: 0,
    mode: "edit",
    isLocked: 0,
    t_c: now,
    t_u: now,
  };

  await upsertStage(record);
}

function normalizeStageRow(
  row: Partial<StageRecord>,
  index: number,
): StageRecord {
  const safeOrd = Number.isFinite(row.ord) ? Number(row.ord) : index + 1;
  const safeName =
    typeof row.nm === "string" && row.nm.length > 0 ? row.nm : `ST${safeOrd}`;
  const safeDesc = typeof row.desc === "string" ? row.desc : "";
  const safeColor = normalizeHexColor(
    typeof row.baseColor === "string" ? row.baseColor : "#ffc96b",
  );
  const safeProgress = clampProgress(
    Number.isFinite(row.progress) ? Number(row.progress) : DEFAULT_PROGRESS,
  );

  return {
    stgId: row.stgId as string,
    ord: safeOrd,
    nm: safeName,
    desc: safeDesc,
    baseColor: safeColor,
    progress: safeProgress,
    imgPath: typeof row.imgPath === "string" ? row.imgPath : "",
    mapImgPath: typeof row.mapImgPath === "string" ? row.mapImgPath : "",
    x: Number.isFinite(row.x) ? Number(row.x) : 0,
    y: Number.isFinite(row.y) ? Number(row.y) : 0,
    w: Number.isFinite(row.w) ? Number(row.w) : STAGE_DEFAULT_SIZE,
    h: Number.isFinite(row.h) ? Number(row.h) : STAGE_DEFAULT_SIZE,
    rot: Number.isFinite(row.rot) ? Number(row.rot) : 0,
    mode: typeof row.mode === "string" ? row.mode : "edit",
    isLocked: Number.isFinite(row.isLocked) ? Number(row.isLocked) : 0,
    t_c: Number.isFinite(row.t_c) ? Number(row.t_c) : Date.now(),
    t_u: Number.isFinite(row.t_u) ? Number(row.t_u) : Date.now(),
  };
}

function setupDialogEvents(): void {
  if (
    !(stageDialog instanceof HTMLDialogElement) ||
    !(stageDialogBackdrop instanceof HTMLElement) ||
    !(progressRange instanceof HTMLInputElement) ||
    !(nameInput instanceof HTMLInputElement) ||
    !(descInput instanceof HTMLTextAreaElement) ||
    !(colorInput instanceof HTMLInputElement) ||
    !(cancelButton instanceof HTMLButtonElement) ||
    !(saveButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  if (
    stageDialogTabBasic instanceof HTMLButtonElement &&
    stageDialogTabImage instanceof HTMLButtonElement &&
    stageDialogPanelBasic instanceof HTMLElement &&
    stageDialogPanelImage instanceof HTMLElement
  ) {
    stageDialogTabBasic.addEventListener("click", () => {
      setDialogTab("basic");
    });

    stageDialogTabImage.addEventListener("click", () => {
      setDialogTab("image");
    });
  }

  progressRange.addEventListener("input", () => {
    updateProgressPreview(Number.parseInt(progressRange.value, 10));
  });

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

  cancelButton.addEventListener("click", () => {
    closeStageSettingsDialog();
  });

  stageDialogBackdrop.addEventListener("click", () => {
    closeStageSettingsDialog();
  });

  saveButton.addEventListener("click", async () => {
    if (!editingStage) {
      closeStageSettingsDialog();
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
    applyStageVisuals(editingStage);

    await saveStageFromElement(editingStage);
    closeStageSettingsDialog();
  });
}

function openStageSettingsDialog(target: HTMLButtonElement): void {
  if (
    !(stageDialog instanceof HTMLDialogElement) ||
    !(progressRange instanceof HTMLInputElement) ||
    !(nameInput instanceof HTMLInputElement) ||
    !(descInput instanceof HTMLTextAreaElement) ||
    !(colorInput instanceof HTMLInputElement) ||
    !(stageDialogBackdrop instanceof HTMLElement)
  ) {
    return;
  }

  editingStage = target;

  const label = target.dataset.stageLabel || "ST";
  const desc = target.dataset.stageDesc || "";
  const color = normalizeHexColor(target.dataset.stageColor || "#ffc96b");
  const progress = clampProgress(
    Number.parseInt(target.dataset.stageProgress || `${DEFAULT_PROGRESS}`, 10),
  );

  if (stageDialogTitle instanceof HTMLElement) {
    stageDialogTitle.textContent = `${label} ${t("stage_settings_suffix")}`;
  }

  nameInput.value = label;
  descInput.value = desc;
  colorInput.value = color;
  progressRange.value = String(progress);
  updateProgressPreview(progress);
  setDialogTab("basic");
  syncImageTabFromStage(target);

  stageDialogBackdrop.hidden = false;
  if (!stageDialog.open) {
    stageDialog.showModal();
  }
}

function closeStageSettingsDialog(): void {
  if (
    !(stageDialog instanceof HTMLDialogElement) ||
    !(stageDialogBackdrop instanceof HTMLElement)
  ) {
    return;
  }

  editingStage = null;
  stageDialogBackdrop.hidden = true;
  if (stageDialog.open) {
    stageDialog.close();
  }
}

function setDialogTab(tab: "basic" | "image"): void {
  if (
    !(stageDialogTabBasic instanceof HTMLButtonElement) ||
    !(stageDialogTabImage instanceof HTMLButtonElement) ||
    !(stageDialogPanelBasic instanceof HTMLElement) ||
    !(stageDialogPanelImage instanceof HTMLElement)
  ) {
    return;
  }

  const basicActive = tab === "basic";
  stageDialogTabBasic.classList.toggle("active", basicActive);
  stageDialogTabImage.classList.toggle("active", !basicActive);
  stageDialogTabBasic.setAttribute("aria-selected", String(basicActive));
  stageDialogTabImage.setAttribute("aria-selected", String(!basicActive));
  stageDialogPanelBasic.classList.toggle("active", basicActive);
  stageDialogPanelImage.classList.toggle("active", !basicActive);
  stageDialogPanelBasic.hidden = !basicActive;
  stageDialogPanelImage.hidden = basicActive;
  stageDialogPanelBasic.setAttribute("aria-hidden", String(!basicActive));
  stageDialogPanelImage.setAttribute("aria-hidden", String(basicActive));
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

  const fId = await saveFileToStore(file);
  if (!fId) {
    return;
  }

  if (kind === "stage") {
    editingStage.dataset.stageImgPath = fId;
    stageImageCurrent.textContent = fId;
    await applyStageImageVisual(editingStage);
  } else {
    editingStage.dataset.stageMapImgPath = fId;
    mapImageCurrent.textContent = fId;
  }

  await saveStageFromElement(editingStage);
  input.value = "";
}

async function openRegisteredImagePicker(kind: "stage" | "map"): Promise<void> {
  if (!editingStage) {
    return;
  }

  const rows = await fetchRegisteredImageRows();

  const oldBack = document.getElementById("yg_image_picker_back");
  const oldPop = document.getElementById("yg_image_picker_popup");
  oldBack?.remove();
  oldPop?.remove();

  const overlayRoot =
    document.querySelector(".stage-dialog-shell") || document.body;

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

  const title = document.createElement("h3");
  title.textContent = t("image_picker_title");
  title.style.margin = "0";
  pop.appendChild(title);

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
          await applyStageImageVisual(editingStage);
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

      if (row.objectUrl) {
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

type PickerImageRow = {
  fId: string;
  nm: string;
  ext: string;
  objectUrl: string;
};

async function fetchRegisteredImageRows(): Promise<PickerImageRow[]> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("files", "readonly");
    const store = tx.objectStore("files");
    const rows = (await requestToPromise(store.getAll())) as Array<{
      fId?: string;
      nm?: string;
      ext?: string;
      mime?: string;
      body?: string;
      bin?: Blob;
      t_u?: number;
    }>;

    const images = rows
      .filter((row) => {
        const ext = String(row?.ext || "")
          .trim()
          .toLowerCase();
        const mime = String(row?.mime || "")
          .trim()
          .toLowerCase();
        const body = String(row?.body || "")
          .trim()
          .toLowerCase();
        const imageExts = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
        if (imageExts.has(ext)) {
          return true;
        }
        if (mime.startsWith("image/")) {
          return true;
        }
        return body.startsWith("data:image/");
      })
      .map((row) => {
        const fId = String(row?.fId || "").trim();
        const nm = String(row?.nm || fId).trim();
        const ext = String(row?.ext || "")
          .trim()
          .toLowerCase();
        let objectUrl = "";
        if (row?.bin instanceof Blob) {
          objectUrl = URL.createObjectURL(row.bin);
        } else {
          const body = String(row?.body || "").trim();
          if (body.toLowerCase().startsWith("data:image/")) {
            objectUrl = body;
          }
        }
        return {
          fId,
          nm,
          ext,
          objectUrl,
          t_u: Number(row?.t_u || 0),
        };
      })
      .filter((row) => !!row.fId && !!row.objectUrl)
      .sort((a, b) => {
        if (a.t_u !== b.t_u) {
          return b.t_u - a.t_u;
        }
        return a.fId.localeCompare(b.fId);
      })
      .map((row) => ({
        fId: row.fId,
        nm: row.nm,
        ext: row.ext,
        objectUrl: row.objectUrl,
      }));

    return images;
  } finally {
    db.close();
  }
}

async function saveFileToStore(file: File): Promise<string | null> {
  const extByName = String(file.name || "")
    .split(".")
    .pop()
    ?.toLowerCase();
  const extByMime = String(file.type || "")
    .split("/")
    .pop()
    ?.toLowerCase();
  const ext = extByName || extByMime || "bin";
  const rand = Math.random().toString(36).slice(2, 8);
  const fId = `f_${Date.now()}_${rand}.${ext}`;

  const db = await openYGDatabase();
  try {
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    await requestToPromise(
      store.put({
        fId,
        ext,
        nm: file.name || fId,
        mime: file.type || "application/octet-stream",
        size: file.size,
        bin: file,
        t_c: Date.now(),
        t_u: Date.now(),
      }),
    );
    await transactionDone(tx);
    return fId;
  } finally {
    db.close();
  }
}

async function applyStageMapImage(target: HTMLButtonElement): Promise<void> {
  const mapImg = getStageMapImageElement();
  if (!mapImg) {
    return;
  }

  const mapFId = String(target.dataset.stageMapImgPath || "").trim();
  if (!mapFId) {
    if (stageMapDefaultSrc) {
      mapImg.src = stageMapDefaultSrc;
    }
    return;
  }

  const objectUrl = await getObjectUrlForFile(mapFId);
  if (!objectUrl) {
    if (stageMapDefaultSrc) {
      mapImg.src = stageMapDefaultSrc;
    }
    return;
  }

  mapImg.src = objectUrl;
}

function getStageMapImageElement(): HTMLImageElement | null {
  if (!(stageMap instanceof HTMLElement)) {
    return null;
  }
  const image = stageMap.querySelector("img");
  return image instanceof HTMLImageElement ? image : null;
}

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

function applyStageVisuals(target: HTMLButtonElement): void {
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

  void applyStageImageVisual(target);
}

async function applyStageImageVisual(target: HTMLButtonElement): Promise<void> {
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

  const objectUrl = await getObjectUrlForFile(fId);
  if (!objectUrl) {
    sideImage.hidden = true;
    sideImageImg.removeAttribute("src");
    return;
  }

  sideImage.hidden = false;
  sideImageImg.src = objectUrl;
}

async function getObjectUrlForFile(fId: string): Promise<string | null> {
  const cached = fileObjectUrlCache.get(fId);
  if (cached) {
    return cached;
  }

  const blob = await getFileBlobById(fId);
  if (!blob) {
    return null;
  }

  const objectUrl = URL.createObjectURL(blob);
  fileObjectUrlCache.set(fId, objectUrl);
  return objectUrl;
}

async function getFileBlobById(fId: string): Promise<Blob | null> {
  const db = await openYGDatabase();
  try {
    const tx = db.transaction("files", "readonly");
    const store = tx.objectStore("files");
    const row = (await requestToPromise(store.get(fId))) as
      | { bin?: Blob }
      | undefined;
    const bin = row?.bin;
    return bin instanceof Blob ? bin : null;
  } finally {
    db.close();
  }
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PROGRESS;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getHpColor(value: number): string {
  if (value > 75) {
    return "#4dd26d";
  }
  if (value > 50) {
    return "#dbd34f";
  }
  if (value > 25) {
    return "#f39a3d";
  }
  return "#e84d43";
}

function normalizeHexColor(value: string): string {
  const text = value.trim();
  const shortHex = /^#[0-9a-fA-F]{3}$/;
  const fullHex = /^#[0-9a-fA-F]{6}$/;

  if (fullHex.test(text)) {
    return text.toLowerCase();
  }

  if (shortHex.test(text)) {
    const r = text[1];
    const g = text[2];
    const b = text[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return "#ffc96b";
}

async function upsertStage(record: StageRecord): Promise<void> {
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

async function rerenderStagesFromDb(): Promise<void> {
  const current = Array.from(document.querySelectorAll(".stage-object"));
  for (const el of current) {
    el.remove();
  }

  const stages = await loadStages();
  stageCount = stages.length;

  for (const stage of stages) {
    const stageObject = createStageObject(stage);
    document.body.append(stageObject);
    placeStageObject(stageObject, stage.x, stage.y);
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    };
    tx.onabort = () => {
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    };
  });
}
