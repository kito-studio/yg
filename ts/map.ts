import { insertHtmlPart } from "./core";
import { createFileStoreGateway, FileStoreGateway } from "./data/file-store";
import { setAppStateText } from "./data/yg-idb";
import { downloadYGBackupJson, restoreYGBackupFromFile } from "./db-backup";
import { applyI18n, t } from "./i18n";
import { ensureYGDatabase } from "./init-db";
import {
  LOGO_DISMISS_TIMEOUT_MS,
  LOGO_FADE_DURATION_MS,
  MAP_INERTIA_FRICTION,
  MAP_INERTIA_MIN_SPEED,
  MAP_PAN_THRESHOLD_PX,
  MAP_ZOOM_SENSITIVITY,
  MAX_MAP_SCALE,
  MIN_MAP_SCALE,
  STAGE_MAP_CONTENT_SIZE,
} from "./map/constants";
import {
  MAP_PAGE_ID,
  MAPPAGE_CLASS,
  MAPPAGE_SELECTOR,
  MapPageElements,
} from "./map/dom";
import {
  revealWorld,
  shouldSkipIntro,
  waitForMapRevealComplete,
} from "./map/reveal";
import { createStageDialogController } from "./map/stage-dialog";
import { getStageDialogElements } from "./map/stage-dialog-elements";
import {
  applyStageVisuals,
  createNewStageRecord,
  createStageObject,
  loadStages,
  saveStageFromElement,
  StageRecord,
} from "./obj/stage";
import { loadSelectedWorld, loadWorlds, WorldRecord } from "./obj/world";
import { setupLoopAudioToggle } from "./sound/audio";
import { createTopPageBgmAudio as createMapPageBgmAudio } from "./sound/top-page";
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

// －－－ 地図画面要素 －－－
type MapPageContext = {
  elements: MapPageElements;
  mapViewport: MapViewportController;
  stageDialog: ReturnType<typeof createStageDialogController>;
  stageHandlers: ReturnType<typeof createStageInteractionHandlers>;
  world: WorldRecord | null;
  stages: StageRecord[];
  selectedWorldId: string;
  selectedStageId: string;
  worldItems: WorldRecord[];
  bgmAudio: HTMLAudioElement;
  fileStore: FileStoreGateway;
};

let context: MapPageContext | null = null;

void initMapPage();

async function initMapPage(): Promise<void> {
  // 先にHTML断片を組み立ててから、挙動を配線する。
  await mountMapPageParts();
  const elements = getMapPageElements();
  context = createMapPageContext(elements);

  applyI18n(document);
  document.body.classList.add(MAPPAGE_CLASS.viewMode);
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
    exitingClass: MAPPAGE_CLASS.logoExiting,
    activeClass: MAPPAGE_CLASS.worldActive,
  });

  setupLoopAudioToggle({
    audio: context.bgmAudio,
    button: elements.bgmButton,
  });

  await waitForMapRevealComplete({
    stageMap: elements.stageMap,
    activeClass: MAPPAGE_CLASS.worldActive,
  });
  await rerenderStagesFromDb();

  setupModeSwitch({
    modeSwitch: elements.modeSwitch,
    editModeClass: MAPPAGE_CLASS.editMode,
    viewModeClass: MAPPAGE_CLASS.viewMode,
    defaultEditMode: false,
  });

  elements.addButton?.addEventListener("click", async () => {
    if (!document.body.classList.contains(MAPPAGE_CLASS.editMode)) {
      return;
    }
    if (!context) {
      return;
    }
    const cntx = context;

    const nextOrd = getVisibleStages(cntx).length + 1;
    const stageRecord = createNewStageRecord(nextOrd);
    stageRecord.wId = cntx.selectedWorldId;
    stageRecord.parentStgId = cntx.selectedStageId;
    const stageObject = createStageButton(stageRecord, cntx);

    appendStageObject(stageObject, cntx);

    const point = getNewStageAnchorPoint(cntx);
    cntx.mapViewport.placeElementWithinContent(stageObject, point.x, point.y);

    await saveStageFromElement(stageObject, nextOrd);
    cntx.stageHandlers.beginDrag(stageObject);
  });
}

async function setupWorldHeader(elements: MapPageElements): Promise<void> {
  if (!context) {
    return;
  }
  const cntx = context;

  await syncHeaderSelection(elements.selectedWorldName);
  setupHeaderSwitch({
    prevButton: elements.worldLeftButton,
    nextButton: elements.worldRightButton,
    getItemIds: () => getHeaderItems(cntx).map((item) => item.id),
    getSelectedId: () => getHeaderSelectedId(cntx),
    onSelect: async (nextId) => {
      const currentStage = getCurrentStage(cntx);
      if (!currentStage) {
        cntx.selectedWorldId = nextId;
        cntx.world =
          cntx.worldItems.find((world) => world.wId === nextId) || null;
        cntx.selectedStageId = "";
        await setAppStateText("worlds", nextId);
        await setAppStateText("stages", null);
        await rerenderStagesFromDb();
        return;
      }

      cntx.selectedStageId = nextId;
      await setAppStateText("stages", nextId);
      await rerenderStagesFromDb();
    },
  });

  if (elements.selectedWorldName instanceof HTMLElement) {
    elements.selectedWorldName.style.cursor = "pointer";
    elements.selectedWorldName.addEventListener("click", () => {
      void stepOutSelection();
    });
  }
}

async function mountMapPageParts(): Promise<void> {
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

function getMapPageElements(): MapPageElements {
  return {
    addButton: document.getElementById(
      MAP_PAGE_ID.addButton,
    ) as HTMLButtonElement | null,
    logoWrap: document.getElementById(MAP_PAGE_ID.logoWrap),
    modeSwitch: document.getElementById(
      MAP_PAGE_ID.modeSwitch,
    ) as HTMLInputElement | null,
    stageMap: document.getElementById(MAP_PAGE_ID.stageMap),
    stageMapContent: document.getElementById(MAP_PAGE_ID.stageMapContent),
    dbDownloadButton: document.getElementById(
      MAP_PAGE_ID.dbDownloadButton,
    ) as HTMLButtonElement | null,
    dbUploadButton: document.getElementById(
      MAP_PAGE_ID.dbUploadButton,
    ) as HTMLButtonElement | null,
    dbUploadInput: document.getElementById(
      MAP_PAGE_ID.dbUploadInput,
    ) as HTMLInputElement | null,
    dbMaintButton: document.getElementById(
      MAP_PAGE_ID.dbMaintButton,
    ) as HTMLButtonElement | null,
    selectedWorldName: document.getElementById(MAP_PAGE_ID.selectedWorldName),
    worldLeftButton: document.getElementById(MAP_PAGE_ID.worldLeftButton),
    worldRightButton: document.getElementById(MAP_PAGE_ID.worldRightButton),
    bgmButton: document.getElementById(
      MAP_PAGE_ID.bgmButton,
    ) as HTMLButtonElement | null,
  };
}

function createMapPageContext(elements: MapPageElements): MapPageContext {
  const fileStore = createFileStoreGateway();
  const bgmAudio = createMapPageBgmAudio();
  return {
    elements,
    mapViewport: createMapViewport(elements),
    stageDialog: createStageDialog(fileStore),
    stageHandlers: createStageHandlers(),
    world: null,
    stages: [],
    selectedWorldId: "",
    selectedStageId: "",
    worldItems: [],
    bgmAudio,
    fileStore,
  };
}

function createStageHandlers(): ReturnType<
  typeof createStageInteractionHandlers
> {
  return createStageInteractionHandlers({
    getContext: () => context,
    saveSelectedStageId: async (stgId) => {
      await setAppStateText("stages", stgId);
    },
    navigateToStage: async (stgId) => {
      if (!context) {
        return;
      }
      context.selectedStageId = stgId;
      await rerenderStagesFromDb();
    },
    saveStageFromElement: async (target) => {
      await saveStageFromElement(target);
    },
  });
}

function createMapViewport(elements: MapPageElements): MapViewportController {
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
        document.body.classList.contains(MAPPAGE_CLASS.editMode) &&
        !!event.target.closest(MAPPAGE_SELECTOR.stageObject)
      );
    },
  });
}

function createStageDialog(
  fileStore: FileStoreGateway,
): ReturnType<typeof createStageDialogController> {
  return createStageDialogController({
    elements: getStageDialogElements(),
    fileStore,
    saveStageFromElement: async (target) => {
      await saveStageFromElement(target);
    },
  });
}

function getNewStageAnchorPoint(cntx: MapPageContext): {
  x: number;
  y: number;
} {
  const { logoWrap, stageMap } = cntx.elements;
  // イントロ表示中は、ロゴ領域の下端付近に新規ステージを置く。
  if (logoWrap instanceof HTMLElement && document.body.contains(logoWrap)) {
    const rect = logoWrap.getBoundingClientRect();
    return cntx.mapViewport.viewportPointToContentPoint(
      rect.left + 22,
      rect.bottom + 22,
    );
  }

  if (stageMap instanceof HTMLElement) {
    const rect = stageMap.getBoundingClientRect();
    return cntx.mapViewport.viewportPointToContentPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
  }

  return { x: 0, y: 0 };
}

async function syncHeaderSelection(
  selectedWorldNameEl: HTMLElement | null,
): Promise<void> {
  if (!context) {
    return;
  }

  context.worldItems = await loadWorlds();
  const world = await loadSelectedWorld();
  context.selectedWorldId = world?.wId || context.worldItems[0]?.wId || "";
  context.world = world;
  // URLパラメータからのディープリンクのみ反映する。
  // savedStageId は stages ロード前にセットすると no_world になるため、
  // rerenderStagesFromDb 内で解決する。
  const queryStageId = String(
    new URLSearchParams(window.location.search).get("stgId") || "",
  ).trim();
  if (queryStageId) {
    context.selectedStageId = queryStageId;
  }
  // renderCurrentHeaderLabel は stages ロード前に呼ばない。rerenderStagesFromDb 内で呼ばれる。
}

function renderCurrentHeaderLabel(
  selectedWorldNameEl: HTMLElement | null,
): void {
  if (!context) {
    return;
  }

  renderHeaderSelectedLabel({
    labelElement: selectedWorldNameEl,
    items: getHeaderItems(context),
    selectedId: getHeaderSelectedId(context),
    emptyLabel: t("no_world"),
  });
}

function createStageButton(
  stage: StageRecord,
  cntx: MapPageContext,
): HTMLButtonElement {
  const stageObject = createStageObject(stage, {
    onPointerDown: cntx.stageHandlers.onPointerDown,
    onDoubleClick: cntx.stageHandlers.onStageDoubleClick,
    onClick: cntx.stageHandlers.onStageClick,
  });
  applyStageVisuals(stageObject, cntx.fileStore);
  return stageObject;
}

function appendStageObject(
  target: HTMLButtonElement,
  cntx: MapPageContext,
): void {
  if (cntx.elements.stageMapContent instanceof HTMLElement) {
    cntx.elements.stageMapContent.append(target);
    return;
  }
  document.body.append(target);
}

async function rerenderStagesFromDb(): Promise<void> {
  if (!context) {
    return;
  }
  const cntx = context;

  const current = Array.from(
    document.querySelectorAll(MAPPAGE_SELECTOR.stageObject),
  );
  for (const el of current) {
    el.remove();
  }

  const stages = await loadStages();
  cntx.stages = stages;
  cntx.selectedStageId = resolveSelectedStageId(cntx);
  cntx.world =
    cntx.worldItems.find((world) => world.wId === cntx.selectedWorldId) || null;

  await applyCurrentMapBackground(cntx);
  renderCurrentHeaderLabel(cntx.elements.selectedWorldName);

  for (const stage of getVisibleStages(cntx)) {
    const stageObject = createStageButton(stage, cntx);
    appendStageObject(stageObject, cntx);
    cntx.mapViewport.placeElementWithinContent(stageObject, stage.x, stage.y);
  }
}

function getVisibleStages(cntx: MapPageContext): StageRecord[] {
  return cntx.stages
    .filter((stage) => stage.wId === cntx.selectedWorldId)
    .filter((stage) => stage.parentStgId === cntx.selectedStageId)
    .sort((a, b) => a.ord - b.ord);
}

function getCurrentStage(cntx: MapPageContext): StageRecord | null {
  return (
    cntx.stages.find((stage) => stage.stgId === cntx.selectedStageId) || null
  );
}

function getHeaderItems(
  cntx: MapPageContext,
): Array<{ id: string; label: string }> {
  const currentStage = getCurrentStage(cntx);
  if (!currentStage) {
    return cntx.worldItems.map((world) => ({
      id: world.wId || "",
      label: world.nm || world.wId,
    }));
  }

  return cntx.stages
    .filter((stage) => stage.wId === currentStage.wId)
    .filter((stage) => stage.parentStgId === currentStage.parentStgId)
    .sort((a, b) => a.ord - b.ord)
    .map((stage) => ({
      id: stage.stgId || "",
      label: stage.nm || stage.stgId,
    }));
}

function getHeaderSelectedId(cntx: MapPageContext): string {
  return cntx.selectedStageId || cntx.selectedWorldId;
}

function resolveSelectedStageId(cntx: MapPageContext): string {
  const selected = cntx.stages.find(
    (stage) => stage.stgId === cntx.selectedStageId,
  );
  if (!selected) {
    return "";
  }
  if (selected.wId !== cntx.selectedWorldId) {
    return "";
  }
  return selected.stgId;
}

async function applyCurrentMapBackground(cntx: MapPageContext): Promise<void> {
  if (!cntx.elements.stageMapContent) {
    return;
  }

  const image = cntx.elements.stageMapContent.querySelector(
    ".stage-map-image",
  ) as HTMLImageElement | null;
  if (!(image instanceof HTMLImageElement)) {
    return;
  }

  const currentStage = getCurrentStage(cntx);
  const path = String(
    currentStage?.mapImgPath || cntx.world?.mapImgPath || "",
  ).trim();
  if (!path) {
    image.src = "./img/world_map/fantasy1_e.jpg";
    return;
  }

  const objectUrl = await cntx.fileStore.getObjectUrlForFile(path);
  image.src = objectUrl || path;
}

async function stepOutSelection(): Promise<void> {
  if (!context) {
    return;
  }

  const currentStage = getCurrentStage(context);
  if (!currentStage) {
    return;
  }

  context.selectedStageId = currentStage.parentStgId || "";
  await setAppStateText("stages", context.selectedStageId || null);
  await rerenderStagesFromDb();
}
