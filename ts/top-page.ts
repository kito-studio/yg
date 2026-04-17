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
  LOGO_DISMISS_TIMEOUT_MS,
  LOGO_EXITING_CLASS,
  LOGO_FADE_DURATION_MS,
  LOGO_WRAP_ID,
  MAP_IMAGE_CLEAR_BUTTON_ID,
  MAP_IMAGE_CURRENT_ID,
  MAP_IMAGE_FILE_INPUT_ID,
  MAP_IMAGE_PICK_BUTTON_ID,
  MAP_IMAGE_SAVE_BUTTON_ID,
  MAP_INERTIA_FRICTION,
  MAP_INERTIA_MIN_SPEED,
  MAP_PAN_THRESHOLD_PX,
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
  WORLD_ACTIVE_CLASS,
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
import {
  createMapViewportController,
  MapViewportController,
} from "./ui/map-viewport";

type TopPageElements = {
  addButton: HTMLButtonElement | null;
  logoWrap: HTMLElement | null;
  modeSwitch: HTMLInputElement | null;
  stageMap: HTMLElement | null;
  stageMapContent: HTMLElement | null;
  dbDownloadButton: HTMLButtonElement | null;
  dbUploadButton: HTMLButtonElement | null;
  dbUploadInput: HTMLInputElement | null;
  dbMaintButton: HTMLButtonElement | null;
  selectedWorldName: HTMLElement | null;
  bgmButton: HTMLButtonElement | null;
};

type TopPageContext = {
  elements: TopPageElements;
  mapViewport: MapViewportController;
  stageDialog: ReturnType<typeof createStageDialogController>;
};

const bgmAudio = new Audio(BGM_SRC);
bgmAudio.loop = true;

const fileStore = createFileStoreGateway();
let topPageContext: TopPageContext | null = null;

let stageCount = 0;

void initTopPage();

function playButtonSound(): void {
  const audio = new Audio(BTN_SOUND_SRC);
  audio.play().catch(() => {});
}

async function initTopPage(): Promise<void> {
  await mountTopPageParts();
  const elements = getTopPageElements();
  const context = createTopPageContext(elements);
  topPageContext = context;

  applyI18n(document);
  document.body.classList.add(VIEW_MODE_CLASS);
  hideElementOnLocalHost("info");

  context.mapViewport.setup();
  context.stageDialog.bindEvents();

  setupBackupToolbar({
    downloadButton: elements.dbDownloadButton,
    uploadButton: elements.dbUploadButton,
    uploadInput: elements.dbUploadInput,
    settingsButton: elements.dbMaintButton,
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
  await syncSelectedWorldHeader(elements.selectedWorldName);

  if (shouldSkipIntro()) {
    showWorldImmediately(elements.logoWrap);
  } else {
    await waitForLogoDismiss(elements.logoWrap);
    document.body.classList.add(WORLD_ACTIVE_CLASS);
  }

  bgmAudio.play().catch(() => {});
  const bgmButton = elements.bgmButton;
  if (bgmButton instanceof HTMLButtonElement) {
    bgmButton.addEventListener("click", () => {
      if (bgmAudio.paused) {
        bgmAudio.play().catch(() => {});
        bgmButton.textContent = "🔊";
      } else {
        bgmAudio.pause();
        bgmButton.textContent = "🔇";
      }
    });
    bgmAudio.pause();
    bgmButton.textContent = "🔇";
  }

  await waitForMapRevealComplete(elements.stageMap);
  await rerenderStagesFromDb();

  setupModeSwitch({
    modeSwitch: elements.modeSwitch,
    editModeClass: EDIT_MODE_CLASS,
    viewModeClass: VIEW_MODE_CLASS,
    defaultEditMode: false,
  });

  elements.addButton?.addEventListener("click", async () => {
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

    const point = getNewStageAnchorPoint();
    context.mapViewport.placeElementWithinContent(
      stageObject,
      point.x,
      point.y,
    );

    await saveStageFromElement(stageObject, stageCount);
    beginDrag(stageObject);
  });
}

async function mountTopPageParts(): Promise<void> {
  const partNames = [
    "logo",
    "info",
    "header",
    "control",
    "world_map",
    "stage_dialog",
  ];

  for (const partName of partNames) {
    await insertHtmlPart(partName, document.body);
  }
}

function shouldSkipIntro(): boolean {
  const referrer = document.referrer;
  const currentDomain = window.location.hostname;
  return !!(referrer && referrer.includes(currentDomain));
}

function getTopPageElements(): TopPageElements {
  return {
    addButton: document.getElementById(
      ADD_BUTTON_ID,
    ) as HTMLButtonElement | null,
    logoWrap: document.getElementById(LOGO_WRAP_ID),
    modeSwitch: document.getElementById(
      MODE_SWITCH_ID,
    ) as HTMLInputElement | null,
    stageMap: document.getElementById(STAGE_MAP_ID),
    stageMapContent: document.getElementById(STAGE_MAP_CONTENT_ID),
    dbDownloadButton: document.getElementById(
      DB_DOWNLOAD_BUTTON_ID,
    ) as HTMLButtonElement | null,
    dbUploadButton: document.getElementById(
      DB_UPLOAD_BUTTON_ID,
    ) as HTMLButtonElement | null,
    dbUploadInput: document.getElementById(
      DB_UPLOAD_INPUT_ID,
    ) as HTMLInputElement | null,
    dbMaintButton: document.getElementById(
      DB_MAINT_BUTTON_ID,
    ) as HTMLButtonElement | null,
    selectedWorldName: document.getElementById(SELECTED_WORLD_NAME_ID),
    bgmButton: document.getElementById(
      BGM_BUTTON_ID,
    ) as HTMLButtonElement | null,
  };
}

function createTopPageContext(elements: TopPageElements): TopPageContext {
  const mapViewport = createMapViewportController({
    viewport: elements.stageMap,
    content: elements.stageMapContent,
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
      stageImageClearButton: document.getElementById(
        STAGE_IMAGE_CLEAR_BUTTON_ID,
      ),
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

  return {
    elements,
    mapViewport,
    stageDialog,
  };
}

function getTopPageContext(): TopPageContext | null {
  return topPageContext;
}

function getNewStageAnchorPoint(): { x: number; y: number } {
  const context = getTopPageContext();
  if (!context) {
    return { x: 0, y: 0 };
  }

  const { logoWrap, stageMap } = context.elements;
  if (logoWrap instanceof HTMLElement && document.body.contains(logoWrap)) {
    const rect = logoWrap.getBoundingClientRect();
    return context.mapViewport.viewportPointToContentPoint(
      rect.left + 22,
      rect.bottom + 22,
    );
  }

  if (stageMap instanceof HTMLElement) {
    const rect = stageMap.getBoundingClientRect();
    return context.mapViewport.viewportPointToContentPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
  }

  return { x: 0, y: 0 };
}

function showWorldImmediately(logoElement: HTMLElement | null): void {
  if (logoElement instanceof HTMLElement) {
    logoElement.remove();
  }
  document.body.classList.add(WORLD_ACTIVE_CLASS);
}

async function syncSelectedWorldHeader(
  selectedWorldNameEl: HTMLElement | null,
): Promise<void> {
  if (!(selectedWorldNameEl instanceof HTMLElement)) {
    return;
  }

  const world = await loadSelectedWorld();
  selectedWorldNameEl.textContent = world?.nm || t("no_world");
}

async function waitForLogoDismiss(
  logoElement: HTMLElement | null,
): Promise<void> {
  if (!(logoElement instanceof HTMLElement)) {
    return;
  }

  const targetLogo = logoElement;

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
      targetLogo.removeEventListener("transitionend", onTransitionEnd);
      cleanupListeners();
      resolve();
    }

    function onTransitionEnd(event: TransitionEvent): void {
      if (event.target === targetLogo && event.propertyName === "opacity") {
        finish();
      }
    }

    function startDismiss(): void {
      if (settled) {
        return;
      }
      cleanupListeners();
      document.body.classList.add(LOGO_EXITING_CLASS);
      targetLogo.addEventListener("transitionend", onTransitionEnd, {
        once: true,
      });
      window.setTimeout(finish, LOGO_FADE_DURATION_MS + 120);
    }

    window.addEventListener("keydown", onKeyDown, { once: true });
    window.addEventListener("mousedown", onMouseDown, { once: true });
  });
}

async function waitForMapRevealComplete(
  stageMap: HTMLElement | null,
): Promise<void> {
  if (!(stageMap instanceof HTMLElement)) {
    return;
  }

  if (!document.body.classList.contains(WORLD_ACTIVE_CLASS)) {
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
  const context = getTopPageContext();
  if (context?.elements.stageMapContent instanceof HTMLElement) {
    context.elements.stageMapContent.append(target);
    return;
  }
  document.body.append(target);
}

function onStageClick(event: MouseEvent): void {
  if (!document.body.classList.contains(VIEW_MODE_CLASS)) {
    return;
  }

  const context = getTopPageContext();
  if (context?.mapViewport.isClickSuppressed()) {
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

  const context = getTopPageContext();
  if (!context) {
    return;
  }

  const target = event.currentTarget;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  context.stageDialog.open(target);
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
  const context = getTopPageContext();
  if (!context) {
    return;
  }

  target.classList.add("dragging");

  const left = Number.parseFloat(target.style.left);
  const top = Number.parseFloat(target.style.top);
  const targetPosition = {
    x: Number.isFinite(left) ? left : 0,
    y: Number.isFinite(top) ? top : 0,
  };
  const initialPointerPoint = startEvent
    ? context.mapViewport.viewportPointToContentPoint(
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
    const point = context.mapViewport.viewportPointToContentPoint(
      clientX,
      clientY,
    );
    context.mapViewport.placeElementWithinContent(
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
  const context = getTopPageContext();
  if (!context) {
    return;
  }

  const current = Array.from(document.querySelectorAll(".stage-object"));
  for (const el of current) {
    el.remove();
  }

  const stages = await loadStages();
  stageCount = stages.length;

  for (const stage of stages) {
    const stageObject = createStageButton(stage);
    appendStageObject(stageObject);
    context.mapViewport.placeElementWithinContent(
      stageObject,
      stage.x,
      stage.y,
    );
  }
}
