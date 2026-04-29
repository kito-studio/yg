import { insertHtmlPart, isLocal } from "./core";
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
  getMapPageElements,
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
  renderHeaderSelectedLabel,
  setupHeaderSwitch,
  setupModeSwitch,
  setupToolbar,
} from "./ui/common-header";
import {
  createMapViewportController,
  MapViewportController,
} from "./ui/map-viewport";
import { createStageInteractionHandlers } from "./ui/stage-interactions";
import { lg } from "./util/log";

// －－－ 地図画面要素 －－－
type MapPageContext = {
  elements: MapPageElements;
  mapViewport: MapViewportController;
  stageDialog: ReturnType<typeof createStageDialogController>;
  stageHandlers: ReturnType<typeof createStageInteractionHandlers>;
  worlds: WorldRecord[];
  world: WorldRecord | null;
  stages: StageRecord[];
  selectedWorldId: string;
  selectedStageId: string;
  bgmAudio: HTMLAudioElement;
  fileStore: FileStoreGateway;
};
let context: MapPageContext | null = null;

// －－－ 初期化－－－
void initMapPage();
async function initMapPage(): Promise<void> {
  lg("initMapPage");
  // 先にHTML断片を組み立ててから、挙動を配線する。
  await mountMapPageParts();
  // CSS IDなどを参照しやすくする
  const elements = getMapPageElements();
  // 地図画面要素の初期化
  const cntx = createMapPageContext(elements);
  context = cntx;

  // 翻訳
  applyI18n();
  document.body.classList.add(MAPPAGE_CLASS.viewMode);

  cntx.stageDialog.bindEvents();

  setupToolbar({
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
  // createMapPageContext 直後は world が null。ここで選択状態を読み込んで反映する。
  await setupHeader(cntx, elements);
  lg(cntx, "setupHeader");
  cntx.mapViewport.setup();

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
    audio: cntx.bgmAudio,
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

/**
 * HTML部品を組み立てる
 */
async function mountMapPageParts(): Promise<void> {
  // z-indexとオーバーレイの重なりを壊さないよう、固定順序で挿入する。
  const partNames = [
    "logo",
    "header",
    "control",
    "map",
    "stage_dialog",
    "info",
  ];

  for (const partName of partNames) {
    // 開発環境ではinfoを通常表示しない
    if (partName === "info" && isLocal()) {
      continue;
    }
    await insertHtmlPart(partName, document.body);
  }
}

/**
 * 地図画面要素の初期化
 */
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
    worlds: [],
    bgmAudio,
    fileStore,
  };
}

async function setupHeader(
  cntx: MapPageContext,
  elements: MapPageElements,
): Promise<void> {
  await syncHeaderSelection(cntx);
  setupHeaderSwitch({
    prevButton: elements.worldLeftButton,
    nextButton: elements.worldRightButton,
    getItemIds: () => getHeaderItems(cntx).map((item) => item.id),
    getSelectedId: () => getHeaderSelectedId(cntx),
    onSelect: async (nextId) => {
      const currentStage = getCurrentStage(cntx);
      if (!currentStage) {
        cntx.selectedWorldId = nextId;
        cntx.world = cntx.worlds.find((world) => world.wId === nextId) || null;
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

async function syncHeaderSelection(cntx: MapPageContext): Promise<void> {
  cntx.worlds = await loadWorlds();
  const world = await loadSelectedWorld();
  cntx.selectedWorldId = world?.wId || cntx.worlds[0]?.wId || "";
  cntx.world = world;
  // URLパラメータからのディープリンクのみ反映する。
  // savedStageId は stages ロード前にセットすると no_world になるため、
  // rerenderStagesFromDb 内で解決する。
  const queryStageId = String(
    new URLSearchParams(window.location.search).get("stgId") || "",
  ).trim();
  if (queryStageId) {
    cntx.selectedStageId = queryStageId;
  }
  // renderCurrentHeaderLabel は stages ロード前に呼ばない。rerenderStagesFromDb 内で呼ばれる。
}

function renderCurrentHeaderLabel(
  cntx: MapPageContext,
  selectedWorldNameEl: HTMLElement | null,
): void {
  renderHeaderSelectedLabel({
    labelElement: selectedWorldNameEl,
    items: getHeaderItems(cntx),
    selectedId: getHeaderSelectedId(cntx),
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
    cntx.worlds.find((world) => world.wId === cntx.selectedWorldId) || null;

  await applyCurrentMapBackground(cntx);
  renderCurrentHeaderLabel(cntx, cntx.elements.selectedWorldName);

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
    return cntx.worlds.map((world) => ({
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
