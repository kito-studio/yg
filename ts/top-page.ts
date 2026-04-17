import { insertHtmlPart } from "./core";
import { createFileStoreGateway } from "./data/file-store";
import { setAppStateText } from "./data/yg-idb";
import { downloadYGBackupJson, restoreYGBackupFromFile } from "./db-backup";
import { applyI18n, t } from "./i18n";
import { ensureYGDatabase } from "./init-db";
import { StageRecord } from "./obj";
import {
  ADD_BUTTON_ID,
  BGM_BUTTON_ID,
  BGM_SRC,
  BODY_READY_CLASS,
  BTN_SOUND_SRC,
  CANCEL_BUTTON_ID,
  COLOR_INPUT_ID,
  DB_DOWNLOAD_BUTTON_ID,
  DB_MAINT_BUTTON_ID,
  DB_UPLOAD_BUTTON_ID,
  DB_UPLOAD_INPUT_ID,
  DESC_INPUT_ID,
  DIALOG_BACKDROP_ID,
  DIALOG_ID,
  DIALOG_PANEL_BASIC_ID,
  DIALOG_PANEL_IMAGE_ID,
  DIALOG_TAB_BASIC_ID,
  DIALOG_TAB_IMAGE_ID,
  DIALOG_TITLE_ID,
  EDIT_MODE_CLASS,
  INTRO_DONE_CLASS,
  LOGO_DISMISS_TIMEOUT_MS,
  LOGO_FADE_DURATION_MS,
  LOGO_FADE_OUT_CLASS,
  LOGO_WRAP_ID,
  MAP_IMAGE_CLEAR_BUTTON_ID,
  MAP_IMAGE_CURRENT_ID,
  MAP_IMAGE_FILE_INPUT_ID,
  MAP_IMAGE_PICK_BUTTON_ID,
  MAP_IMAGE_SAVE_BUTTON_ID,
  MAP_INERTIA_FRICTION,
  MAP_INERTIA_MIN_SPEED,
  MAP_PAN_THRESHOLD_PX,
  MAP_VISIBLE_CLASS,
  MAP_ZOOM_SENSITIVITY,
  MAX_MAP_SCALE,
  MIN_MAP_SCALE,
  MODE_SWITCH_ID,
  NAME_INPUT_ID,
  PROGRESS_BAR_FILL_ID,
  PROGRESS_RANGE_ID,
  PROGRESS_VALUE_ID,
  SAVE_BUTTON_ID,
  SELECTED_WORLD_NAME_ID,
  STAGE_DEFAULT_SIZE,
  STAGE_IMAGE_CLEAR_BUTTON_ID,
  STAGE_IMAGE_CURRENT_ID,
  STAGE_IMAGE_FILE_INPUT_ID,
  STAGE_IMAGE_PICK_BUTTON_ID,
  STAGE_IMAGE_SAVE_BUTTON_ID,
  STAGE_MAP_CONTENT_ID,
  STAGE_MAP_CONTENT_SIZE,
  STAGE_MAP_ID,
  VIEW_MODE_CLASS,
} from "./top-page/constants";
import {
  loadSelectedWorld,
  loadStages,
  saveStageFromElement,
} from "./top-page/stage-db";
import { createStageDialogController } from "./top-page/stage-dialog";
import { buildStageId } from "./top-page/stage-model";
import { applyStageVisuals, createStageObject } from "./top-page/stage-ui";
import {
  hideElementOnLocalHost,
  setupBackupToolbar,
  setupModeSwitch,
} from "./ui/common-header";
import { createMapViewportController } from "./ui/map-viewport";

const addBtn = document.getElementById(ADD_BUTTON_ID);
const logoWrap = document.getElementById(LOGO_WRAP_ID);
const modeSwitch = document.getElementById(MODE_SWITCH_ID);
const stageMap = document.getElementById(STAGE_MAP_ID);
const stageMapContent = document.getElementById(STAGE_MAP_CONTENT_ID);
const dbDownloadBtn = document.getElementById(DB_DOWNLOAD_BUTTON_ID);
const dbUploadBtn = document.getElementById(DB_UPLOAD_BUTTON_ID);
const dbUploadInput = document.getElementById(DB_UPLOAD_INPUT_ID);
const dbMaintBtn = document.getElementById(DB_MAINT_BUTTON_ID);
const selectedWorldNameEl = document.getElementById(SELECTED_WORLD_NAME_ID);
const bgmBtn = document.getElementById(BGM_BUTTON_ID);

const bgmAudio = new Audio(BGM_SRC);
bgmAudio.loop = true;

const fileStore = createFileStoreGateway();
const mapViewport = createMapViewportController({
  viewport: stageMap,
  content: stageMapContent,
  contentSize: STAGE_MAP_CONTENT_SIZE,
  minScale: MIN_MAP_SCALE,
  maxScale: MAX_MAP_SCALE,
  zoomSensitivity: MAP_ZOOM_SENSITIVITY,
  panThresholdPx: MAP_PAN_THRESHOLD_PX,
  inertiaFriction: MAP_INERTIA_FRICTION,
  inertiaMinSpeed: MAP_INERTIA_MIN_SPEED,
  ignorePanStart: (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return false;
    }

    return (
      document.body.classList.contains(EDIT_MODE_CLASS) &&
      !!event.target.closest(".stage-object")
    );
  },
});
const stageDialog = createStageDialogController({
  elements: {
    dialog: document.getElementById(DIALOG_ID),
    backdrop: document.getElementById(DIALOG_BACKDROP_ID),
    title: document.getElementById(DIALOG_TITLE_ID),
    tabBasic: document.getElementById(DIALOG_TAB_BASIC_ID),
    tabImage: document.getElementById(DIALOG_TAB_IMAGE_ID),
    panelBasic: document.getElementById(DIALOG_PANEL_BASIC_ID),
    panelImage: document.getElementById(DIALOG_PANEL_IMAGE_ID),
    progressRange: document.getElementById(PROGRESS_RANGE_ID),
    progressBarFill: document.getElementById(PROGRESS_BAR_FILL_ID),
    progressValue: document.getElementById(PROGRESS_VALUE_ID),
    nameInput: document.getElementById(NAME_INPUT_ID),
    descInput: document.getElementById(DESC_INPUT_ID),
    colorInput: document.getElementById(COLOR_INPUT_ID),
    stageImageFileInput: document.getElementById(STAGE_IMAGE_FILE_INPUT_ID),
    stageImagePickButton: document.getElementById(STAGE_IMAGE_PICK_BUTTON_ID),
    stageImageClearButton: document.getElementById(STAGE_IMAGE_CLEAR_BUTTON_ID),
    stageImageSaveButton: document.getElementById(STAGE_IMAGE_SAVE_BUTTON_ID),
    stageImageCurrent: document.getElementById(STAGE_IMAGE_CURRENT_ID),
    mapImageFileInput: document.getElementById(MAP_IMAGE_FILE_INPUT_ID),
    mapImagePickButton: document.getElementById(MAP_IMAGE_PICK_BUTTON_ID),
    mapImageClearButton: document.getElementById(MAP_IMAGE_CLEAR_BUTTON_ID),
    mapImageSaveButton: document.getElementById(MAP_IMAGE_SAVE_BUTTON_ID),
    mapImageCurrent: document.getElementById(MAP_IMAGE_CURRENT_ID),
    cancelButton: document.getElementById(CANCEL_BUTTON_ID),
    saveButton: document.getElementById(SAVE_BUTTON_ID),
  },
  fileStore,
  saveStageFromElement: async (target) => {
    await saveStageFromElement(target);
  },
  playButtonSound,
});

let stageCount = 0;

void initTopPage();

function playButtonSound(): void {
  const audio = new Audio(BTN_SOUND_SRC);
  audio.play().catch(() => {});
}

async function initTopPage(): Promise<void> {
  // イントロの表示判定

  const referrer = document.referrer;
  const currentDomain = window.location.hostname;

  // 1. 参照元（referrer）が空（直接入力やブックマーク）
  // 2. または、参照元のドメインに自分のサイトのドメインが含まれていない
  if (referrer && referrer.includes(currentDomain)) {
    console.log("サイト内遷移なのでイントロをスキップします");
    initWorldPage();
    return;
  }
  // ロゴ組み込み
  insertHtmlPart("logo", document.body);

  // 所定時間経過後、または入力後にイントロを終了
  window.setTimeout(() => {
    document.body.classList.add(BODY_READY_CLASS);
  }, 120);
}

async function initWorldPage(): Promise<void> {
  applyI18n(document);
  document.body.classList.add(VIEW_MODE_CLASS);
  if (!addBtn || !logoWrap || !(modeSwitch instanceof HTMLInputElement)) {
    return;
  }
  insertHtmlPart("info", document.body);
  hideElementOnLocalHost("info");
  insertHtmlPart("header", document.body);
  insertHtmlPart("world_map", document.body);
  insertHtmlPart("stage_dialog", document.body);

  mapViewport.setup();
  stageDialog.bindEvents();

  setupBackupToolbar({
    downloadButton: dbDownloadBtn,
    uploadButton: dbUploadBtn,
    uploadInput: dbUploadInput,
    settingsButton: dbMaintBtn,
    settingsPath: "./settings.html",
    onDownload: async () => {
      await downloadYGBackupJson();
    },
    onRestore: async (file: File) => {
      await restoreYGBackupFromFile(file);
      await rerenderStagesFromDb();
    },
    restoreSuccessMessage: t("restore_success"),
    restoreFailedFallbackMessage: t("restore_failed"),
  });

  await ensureYGDatabase();
  await syncSelectedWorldHeader();
  await waitForLogoDismiss(logoWrap);
  document.body.classList.add(INTRO_DONE_CLASS);
  document.body.classList.add(MAP_VISIBLE_CLASS);

  bgmAudio.play().catch(() => {});
  if (bgmBtn instanceof HTMLButtonElement) {
    bgmBtn.addEventListener("click", () => {
      if (bgmAudio.paused) {
        bgmAudio.play().catch(() => {});
        bgmBtn.textContent = "🔊";
      } else {
        bgmAudio.pause();
        bgmBtn.textContent = "🔇";
      }
    });
    bgmAudio.pause();
    bgmBtn.textContent = "🔇";
  }

  await waitForMapRevealComplete();
  await rerenderStagesFromDb();

  setupModeSwitch({
    modeSwitch,
    editModeClass: EDIT_MODE_CLASS,
    viewModeClass: VIEW_MODE_CLASS,
    defaultEditMode: false,
  });

  addBtn.addEventListener("click", async () => {
    if (!document.body.classList.contains(EDIT_MODE_CLASS)) {
      return;
    }

    stageCount += 1;
    const stageObject = createStageButton({
      stgId: buildStageId(),
      ord: stageCount,
      nm: `ST${stageCount}`,
      desc: "",
      baseColor: "#ffc96b",
      progress: 100,
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

    appendStageObject(stageObject);

    const rect = logoWrap.getBoundingClientRect();
    const point = mapViewport.viewportPointToContentPoint(
      rect.left + 22,
      rect.bottom + 22,
    );
    mapViewport.placeElementWithinContent(stageObject, point.x, point.y);

    await saveStageFromElement(stageObject, stageCount);
    beginDrag(stageObject);
  });
}

async function syncSelectedWorldHeader(): Promise<void> {
  if (!(selectedWorldNameEl instanceof HTMLElement)) {
    return;
  }

  const world = await loadSelectedWorld();
  selectedWorldNameEl.textContent = world?.nm || t("no_world");
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

function createStageButton(stage: StageRecord): HTMLButtonElement {
  const stageObject = createStageObject(stage, {
    onPointerDown,
    onDoubleClick: onStageDoubleClick,
    onClick: onStageClick,
  });
  applyStageVisuals(stageObject, fileStore);
  return stageObject;
}

function appendStageObject(target: HTMLButtonElement): void {
  if (stageMapContent instanceof HTMLElement) {
    stageMapContent.append(target);
    return;
  }
  document.body.append(target);
}

function onStageClick(event: MouseEvent): void {
  if (!document.body.classList.contains(VIEW_MODE_CLASS)) {
    return;
  }

  if (mapViewport.isClickSuppressed()) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const target = event.currentTarget;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const stgId = String(target.dataset.stageId || "").trim();
  if (!stgId) {
    return;
  }

  void (async () => {
    await setAppStateText("stages", stgId);
    window.location.href = `./maps.html?stgId=${encodeURIComponent(stgId)}`;
  })();
}

function onStageDoubleClick(event: MouseEvent): void {
  if (!document.body.classList.contains(EDIT_MODE_CLASS)) {
    return;
  }

  const target = event.currentTarget;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  stageDialog.open(target);
}

function onPointerDown(event: PointerEvent): void {
  if (!document.body.classList.contains(EDIT_MODE_CLASS)) {
    return;
  }

  const target = event.currentTarget;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  event.stopPropagation();
  beginDrag(target, event);
}

function beginDrag(target: HTMLButtonElement, startEvent?: PointerEvent): void {
  target.classList.add("dragging");

  const left = Number.parseFloat(target.style.left);
  const top = Number.parseFloat(target.style.top);
  const targetPosition = {
    x: Number.isFinite(left) ? left : 0,
    y: Number.isFinite(top) ? top : 0,
  };
  const initialPointerPoint = startEvent
    ? mapViewport.viewportPointToContentPoint(
        startEvent.clientX,
        startEvent.clientY,
      )
    : null;
  const offsetX =
    startEvent && initialPointerPoint
      ? initialPointerPoint.x - targetPosition.x
      : target.offsetWidth / 2;
  const offsetY =
    startEvent && initialPointerPoint
      ? initialPointerPoint.y - targetPosition.y
      : target.offsetHeight / 2;

  const move = (clientX: number, clientY: number) => {
    const point = mapViewport.viewportPointToContentPoint(clientX, clientY);
    mapViewport.placeElementWithinContent(
      target,
      point.x - offsetX,
      point.y - offsetY,
    );
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

async function rerenderStagesFromDb(): Promise<void> {
  const current = Array.from(document.querySelectorAll(".stage-object"));
  for (const el of current) {
    el.remove();
  }

  const stages = await loadStages();
  stageCount = stages.length;

  for (const stage of stages) {
    const stageObject = createStageButton(stage);
    appendStageObject(stageObject);
    mapViewport.placeElementWithinContent(stageObject, stage.x, stage.y);
  }
}
