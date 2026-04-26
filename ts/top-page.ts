import { insertHtmlPart } from "./core";
import { createFileStoreGateway } from "./data/file-store";
import { setAppStateText } from "./data/yg-idb";
import { downloadYGBackupJson, restoreYGBackupFromFile } from "./db-backup";
import { applyI18n, t } from "./i18n";
import { ensureYGDatabase } from "./init-db";
import { StageRecord } from "./obj";
import { playTransientSound, setupLoopAudioToggle } from "./top-page/audio";
import {
  ADD_BUTTON_ID,
  BGM_BUTTON_ID,
  BGM_SRC,
  BTN_SOUND_SRC,
  DB_DOWNLOAD_BUTTON_ID,
  DB_MAINT_BUTTON_ID,
  DB_UPLOAD_BUTTON_ID,
  DB_UPLOAD_INPUT_ID,
  DEFAULT_PROGRESS,
  EDIT_MODE_CLASS,
  LOGO_DISMISS_TIMEOUT_MS,
  LOGO_EXITING_CLASS,
  LOGO_FADE_DURATION_MS,
  LOGO_WRAP_ID,
  MAP_INERTIA_FRICTION,
  MAP_INERTIA_MIN_SPEED,
  MAP_PAN_THRESHOLD_PX,
  MAP_ZOOM_SENSITIVITY,
  MAX_MAP_SCALE,
  MIN_MAP_SCALE,
  MODE_SWITCH_ID,
  SELECTED_WORLD_NAME_ID,
  STAGE_DEFAULT_SIZE,
  STAGE_MAP_CONTENT_ID,
  STAGE_MAP_CONTENT_SIZE,
  STAGE_MAP_ID,
  VIEW_MODE_CLASS,
  WORLD_ACTIVE_CLASS,
  WORLD_LEFT_BUTTON_ID,
  WORLD_RIGHT_BUTTON_ID,
} from "./top-page/constants";
import {
  revealWorld,
  shouldSkipIntro,
  waitForMapRevealComplete,
} from "./top-page/reveal";
import {
  loadSelectedWorld,
  loadStages,
  loadWorlds,
  saveStageFromElement,
} from "./top-page/stage-db";
import { createStageDialogController } from "./top-page/stage-dialog";
import { getStageDialogElements } from "./top-page/stage-dialog-elements";
import { createStageInteractionHandlers } from "./top-page/stage-events";
import { buildStageId } from "./top-page/stage-model";
import { applyStageVisuals, createStageObject } from "./top-page/stage-ui";
import {
  hideElementOnLocalHost,
  renderHeaderSelectedLabel,
  setupBackupToolbar,
  setupHeaderSwitch,
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
  worldLeftButton: HTMLElement | null;
  worldRightButton: HTMLElement | null;
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
let selectedWorldId = "";
let worldItems: Array<{ wId: string; nm: string }> = [];

const stageHandlers = createStageInteractionHandlers({
  editModeClass: EDIT_MODE_CLASS,
  viewModeClass: VIEW_MODE_CLASS,
  getContext: () => getTopPageContext(),
  saveSelectedStageId: async (stgId) => {
    await setAppStateText("stages", stgId);
  },
  navigateToStage: (stgId) => {
    window.location.href = `./maps.html?stgId=${encodeURIComponent(stgId)}`;
  },
  saveStageFromElement: async (target) => {
    await saveStageFromElement(target);
  },
});

void initTopPage();

function playButtonSound(): void {
  playTransientSound(BTN_SOUND_SRC);
}

async function initTopPage(): Promise<void> {
  // 先にHTML断片を組み立ててから、挙動を配線する。
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
  await setupWorldHeader(elements);

  // イントロ演出とマップ表示待機を分離し、ステージ描画がCSS遷移と競合しないようにする。
  await revealWorld({
    logoElement: elements.logoWrap,
    skipIntro: shouldSkipIntro(document.referrer, window.location.hostname),
    dismissTimeoutMs: LOGO_DISMISS_TIMEOUT_MS,
    fadeDurationMs: LOGO_FADE_DURATION_MS,
    exitingClass: LOGO_EXITING_CLASS,
    activeClass: WORLD_ACTIVE_CLASS,
  });

  setupLoopAudioToggle({
    audio: bgmAudio,
    button: elements.bgmButton,
    onLabel: "🔊",
    offLabel: "🔇",
  });

  await waitForMapRevealComplete({
    stageMap: elements.stageMap,
    activeClass: WORLD_ACTIVE_CLASS,
  });
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
    const stageObject = createStageButton(createNewStageRecord(stageCount));

    appendStageObject(stageObject);

    const point = getNewStageAnchorPoint();
    context.mapViewport.placeElementWithinContent(
      stageObject,
      point.x,
      point.y,
    );

    await saveStageFromElement(stageObject, stageCount);
    stageHandlers.beginDrag(stageObject);
  });
}

function createNewStageRecord(ord: number): StageRecord {
  // 新規ステージの既定値を1か所に集約して調整しやすくする。
  const now = Date.now();
  return {
    stgId: buildStageId(),
    ord,
    nm: `ST${ord}`,
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
    t_c: now,
    t_u: now,
  };
}

async function setupWorldHeader(elements: TopPageElements): Promise<void> {
  // ヘッダ切り替えの仕組みは共通。ここでは対象が「世界」になる。
  await syncSelectedWorldHeader(elements.selectedWorldName);
  setupHeaderSwitch({
    prevButton: elements.worldLeftButton,
    nextButton: elements.worldRightButton,
    getItemIds: () => worldItems.map((world) => world.wId),
    getSelectedId: () => selectedWorldId,
    onSelect: async (nextWorldId) => {
      selectedWorldId = nextWorldId;
      await setAppStateText("worlds", nextWorldId);
      renderSelectedWorldHeader(elements.selectedWorldName);
    },
  });
}

async function mountTopPageParts(): Promise<void> {
  // z-indexとオーバーレイの重なりを壊さないよう、固定順序で挿入する。
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
    worldLeftButton: document.getElementById(WORLD_LEFT_BUTTON_ID),
    worldRightButton: document.getElementById(WORLD_RIGHT_BUTTON_ID),
    bgmButton: document.getElementById(
      BGM_BUTTON_ID,
    ) as HTMLButtonElement | null,
  };
}

function createTopPageContext(elements: TopPageElements): TopPageContext {
  return {
    elements,
    mapViewport: createTopPageMapViewport(elements),
    stageDialog: createTopPageStageDialog(),
  };
}

function createTopPageMapViewport(elements: TopPageElements): MapViewportController {
  // ビューポートはパン/ズームを担当し、座標は常にコンテンツ基準で扱う。
  return createMapViewportController({
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
}

function createTopPageStageDialog(): ReturnType<typeof createStageDialogController> {
  return createStageDialogController({
    elements: getStageDialogElements(),
    fileStore,
    saveStageFromElement: async (target) => {
      await saveStageFromElement(target);
    },
    playButtonSound,
  });
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
  // イントロ表示中は、ロゴ領域の下端付近に新規ステージを置く。
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

async function syncSelectedWorldHeader(
  selectedWorldNameEl: HTMLElement | null,
): Promise<void> {
  // 世界一覧と現在選択をapp_stateと同期する。
  worldItems = await loadWorlds();
  const world = await loadSelectedWorld();
  selectedWorldId = world?.wId || worldItems[0]?.wId || "";
  renderSelectedWorldHeader(selectedWorldNameEl);
}

function renderSelectedWorldHeader(
  selectedWorldNameEl: HTMLElement | null,
): void {
  renderHeaderSelectedLabel({
    labelElement: selectedWorldNameEl,
    items: worldItems.map((world) => ({
      id: world.wId,
      label: world.nm || world.wId,
    })),
    selectedId: selectedWorldId,
    emptyLabel: t("no_world"),
  });
}

function createStageButton(stage: StageRecord): HTMLButtonElement {
  const stageObject = createStageObject(stage, {
    onPointerDown: stageHandlers.onPointerDown,
    onDoubleClick: stageHandlers.onStageDoubleClick,
    onClick: stageHandlers.onStageClick,
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

async function rerenderStagesFromDb(): Promise<void> {
  const context = getTopPageContext();
  if (!context) {
    return;
  }

  const current = Array.from(document.querySelectorAll(".stage-object"));
  for (const el of current) {
    el.remove();
  }

  // 現行スキーマではトップページのステージは世界とは独立して保持される。
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
