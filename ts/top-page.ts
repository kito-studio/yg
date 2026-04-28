import { insertHtmlPart } from "./core";
import { createFileStoreGateway, FileStoreGateway } from "./data/file-store";
import { setAppStateText } from "./data/yg-idb";
import { downloadYGBackupJson, restoreYGBackupFromFile } from "./db-backup";
import { TOP_PAGE_CLASS, TOP_PAGE_ID, TOP_PAGE_SELECTOR } from "./dom/top-page";
import { applyI18n, t } from "./i18n";
import { ensureYGDatabase } from "./init-db";
import { StageRecord, TopPageElements } from "./obj";
import { applyStageVisuals, createStageObject } from "./obj/stage-object";
import { setupLoopAudioToggle } from "./sound/audio";
import {
  createTopPageBgmAudio,
  playTopPageButtonSound,
} from "./sound/top-page";
import {
  DEFAULT_PROGRESS,
  LOGO_DISMISS_TIMEOUT_MS,
  LOGO_FADE_DURATION_MS,
  MAP_INERTIA_FRICTION,
  MAP_INERTIA_MIN_SPEED,
  MAP_PAN_THRESHOLD_PX,
  MAP_ZOOM_SENSITIVITY,
  MAX_MAP_SCALE,
  MIN_MAP_SCALE,
  STAGE_DEFAULT_SIZE,
  STAGE_MAP_CONTENT_SIZE,
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
  WorldHeaderRecord,
} from "./top-page/stage-db";
import { createStageDialogController } from "./top-page/stage-dialog";
import { getStageDialogElements } from "./top-page/stage-dialog-elements";
import { buildStageId } from "./top-page/stage-model";
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
import { createStageInteractionHandlers } from "./ui/stage-interactions";

// －－－ 世界地図画面の構成 －－－
type TopPageContext = {
  elements: TopPageElements;
  mapViewport: MapViewportController;
  stageDialog: ReturnType<typeof createStageDialogController>;
  world: WorldHeaderRecord | null;
  stages: StageRecord[];
  bgmAudio: HTMLAudioElement;
  fileStore: FileStoreGateway;
};

let topPageContext: TopPageContext | null = null;

let stageCount = 0;
let selectedWorldId = "";
let worldItems: Array<{ wId: string; nm: string }> = [];

const stageHandlers = createStageInteractionHandlers({
  editModeClass: TOP_PAGE_CLASS.editMode,
  viewModeClass: TOP_PAGE_CLASS.viewMode,
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
  playTopPageButtonSound();
}

async function initTopPage(): Promise<void> {
  // 先にHTML断片を組み立ててから、挙動を配線する。
  await mountTopPageParts();
  const elements = getTopPageElements();
  const context = createTopPageContext(elements);
  topPageContext = context;

  applyI18n(document);
  document.body.classList.add(TOP_PAGE_CLASS.viewMode);
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
    exitingClass: TOP_PAGE_CLASS.logoExiting,
    activeClass: TOP_PAGE_CLASS.worldActive,
  });

  setupLoopAudioToggle({
    audio: context.bgmAudio,
    button: elements.bgmButton,
  });

  await waitForMapRevealComplete({
    stageMap: elements.stageMap,
    activeClass: TOP_PAGE_CLASS.worldActive,
  });
  await rerenderStagesFromDb();

  setupModeSwitch({
    modeSwitch: elements.modeSwitch,
    editModeClass: TOP_PAGE_CLASS.editMode,
    viewModeClass: TOP_PAGE_CLASS.viewMode,
    defaultEditMode: false,
  });

  elements.addButton?.addEventListener("click", async () => {
    if (!document.body.classList.contains(TOP_PAGE_CLASS.editMode)) {
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
      const context = getTopPageContext();
      if (context) {
        context.world =
          worldItems.find((world) => world.wId === nextWorldId) || null;
      }
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
      TOP_PAGE_ID.addButton,
    ) as HTMLButtonElement | null,
    logoWrap: document.getElementById(TOP_PAGE_ID.logoWrap),
    modeSwitch: document.getElementById(
      TOP_PAGE_ID.modeSwitch,
    ) as HTMLInputElement | null,
    stageMap: document.getElementById(TOP_PAGE_ID.stageMap),
    stageMapContent: document.getElementById(TOP_PAGE_ID.stageMapContent),
    dbDownloadButton: document.getElementById(
      TOP_PAGE_ID.dbDownloadButton,
    ) as HTMLButtonElement | null,
    dbUploadButton: document.getElementById(
      TOP_PAGE_ID.dbUploadButton,
    ) as HTMLButtonElement | null,
    dbUploadInput: document.getElementById(
      TOP_PAGE_ID.dbUploadInput,
    ) as HTMLInputElement | null,
    dbMaintButton: document.getElementById(
      TOP_PAGE_ID.dbMaintButton,
    ) as HTMLButtonElement | null,
    selectedWorldName: document.getElementById(TOP_PAGE_ID.selectedWorldName),
    worldLeftButton: document.getElementById(TOP_PAGE_ID.worldLeftButton),
    worldRightButton: document.getElementById(TOP_PAGE_ID.worldRightButton),
    bgmButton: document.getElementById(
      TOP_PAGE_ID.bgmButton,
    ) as HTMLButtonElement | null,
  };
}

function createTopPageContext(elements: TopPageElements): TopPageContext {
  const fileStore = createFileStoreGateway();
  const bgmAudio = createTopPageBgmAudio();
  return {
    elements,
    mapViewport: createTopPageMapViewport(elements),
    stageDialog: createTopPageStageDialog(fileStore),
    world: null,
    stages: [],
    bgmAudio,
    fileStore,
  };
}

function createTopPageMapViewport(
  elements: TopPageElements,
): MapViewportController {
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
        document.body.classList.contains(TOP_PAGE_CLASS.editMode) &&
        !!event.target.closest(TOP_PAGE_SELECTOR.stageObject)
      );
    },
  });
}

function createTopPageStageDialog(
  fileStore: FileStoreGateway,
): ReturnType<typeof createStageDialogController> {
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
  const context = getTopPageContext();
  // 世界一覧と現在選択をapp_stateと同期する。
  worldItems = await loadWorlds();
  const world = await loadSelectedWorld();
  selectedWorldId = world?.wId || worldItems[0]?.wId || "";
  if (context) {
    context.world = world;
  }
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
  const context = getTopPageContext();
  const stageObject = createStageObject(stage, {
    onPointerDown: stageHandlers.onPointerDown,
    onDoubleClick: stageHandlers.onStageDoubleClick,
    onClick: stageHandlers.onStageClick,
  });
  if (context) {
    applyStageVisuals(stageObject, context.fileStore);
  }
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

  const current = Array.from(
    document.querySelectorAll(TOP_PAGE_SELECTOR.stageObject),
  );
  for (const el of current) {
    el.remove();
  }

  // 現行スキーマではトップページのステージは世界とは独立して保持される。
  const stages = await loadStages();
  context.stages = stages;
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
