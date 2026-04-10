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
const PROGRESS_RANGE_ID = "stageProgressRange";
const PROGRESS_BAR_FILL_ID = "stageProgressBarFill";
const PROGRESS_VALUE_ID = "stageProgressValue";
const NAME_INPUT_ID = "stageNameInput";
const DESC_INPUT_ID = "stageDescInput";
const COLOR_INPUT_ID = "stageColorInput";
const CANCEL_BUTTON_ID = "stageDialogCancel";
const SAVE_BUTTON_ID = "stageDialogSave";

const STAGE_DEFAULT_SIZE = 74;
const DEFAULT_PROGRESS = 100;

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
const progressRange = document.getElementById(PROGRESS_RANGE_ID);
const progressBarFill = document.getElementById(PROGRESS_BAR_FILL_ID);
const progressValue = document.getElementById(PROGRESS_VALUE_ID);
const nameInput = document.getElementById(NAME_INPUT_ID);
const descInput = document.getElementById(DESC_INPUT_ID);
const colorInput = document.getElementById(COLOR_INPUT_ID);
const cancelButton = document.getElementById(CANCEL_BUTTON_ID);
const saveButton = document.getElementById(SAVE_BUTTON_ID);

let stageCount = 0;
let editingStage: HTMLButtonElement | null = null;

void initTopPage();

async function initTopPage(): Promise<void> {
  applyI18n(document);
  document.body.classList.add(VIEW_MODE_CLASS);

  setTimeout(() => {
    document.body.classList.add(BODY_READY_CLASS);
  }, 420);

  setTimeout(() => {
    document.body.classList.add(MAP_VISIBLE_CLASS);
  }, 1800);

  if (!addBtn || !logoWrap || !(modeSwitch instanceof HTMLInputElement)) {
    return;
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

async function waitForMapRevealComplete(): Promise<void> {
  if (!(stageMap instanceof HTMLElement)) {
    return;
  }

  if (!document.body.classList.contains(MAP_VISIBLE_CLASS)) {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 1850);
    });
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
  el.title = stage.desc || t("stage_no_desc");
  el.setAttribute("aria-label", t("stage_object_aria", { name: stage.nm }));

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
  return el;
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

  progressRange.addEventListener("input", () => {
    updateProgressPreview(Number.parseInt(progressRange.value, 10));
  });

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
