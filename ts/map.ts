import { insertHtmlPart, isLocal } from "./core";
import { createFileStoreGateway, FileStoreGateway } from "./data/file-store";
import { getAppStateText, setAppStateText } from "./data/yg-idb";
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
import { beginStageDrag } from "./map/drag";
import {
  revealWorld,
  shouldSkipIntro,
  waitForMapRevealComplete,
} from "./map/reveal";
import { createStageDialogController } from "./map/stage-dialog";
import { getStageDialogElements } from "./map/stage-dialog-elements";
import { getElementPosition } from "./map/stage-model";
import {
  applyStageVisuals,
  createNewStageRecord,
  createStageObject,
  loadStages,
  saveStageFromElement,
  StageRecord,
} from "./obj/stage";
import {
  createNewTaskRecord,
  loadTasks,
  TaskRecord,
  upsertTask,
} from "./obj/task";
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
  stage: StageRecord | null;
  tasks: TaskRecord[];
  lastPointerClient: { x: number; y: number } | null;
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
  cntx.elements.stageMap?.addEventListener("pointermove", (event) => {
    cntx.lastPointerClient = { x: event.clientX, y: event.clientY };
  });

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
    stageRecord.wId = cntx.world?.wId || "";
    stageRecord.parentStgId = cntx.stage?.stgId || null;
    const stageObject = createStageButton(stageRecord, cntx);

    appendStageObject(stageObject, cntx);

    const point = getNewStageAnchorPoint(cntx);
    cntx.mapViewport.placeElementWithinContent(stageObject, point.x, point.y);

    await saveStageFromElement(stageObject, nextOrd);
    cntx.stageHandlers.beginDrag(stageObject);
  });

  elements.addTaskButton?.addEventListener("click", async () => {
    if (!document.body.classList.contains(MAPPAGE_CLASS.editMode)) {
      return;
    }
    if (!context) {
      return;
    }
    const cntx = context;
    if (!cntx.world) {
      window.alert(t("no_world"));
      return;
    }

    const nextOrd = getVisibleTasks(cntx).length + 1;
    const taskRecord = createNewTaskRecord(nextOrd);
    taskRecord.wId = cntx.world.wId;
    taskRecord.stgId = cntx.stage?.stgId || null;
    const taskObject = createTaskButton(taskRecord, cntx);
    appendTaskObject(taskObject, cntx);

    const point = getNewStageAnchorPoint(cntx);
    cntx.mapViewport.placeElementWithinContent(taskObject, point.x, point.y);

    await saveTaskFromElement(taskObject, cntx, nextOrd);
    cntx.tasks.push(taskRecord);
    beginTaskDrag(taskObject, cntx);
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
    "toolbox",
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
    stage: null,
    stages: [],
    tasks: [],
    lastPointerClient: null,
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
        cntx.world = cntx.worlds.find((world) => world.wId === nextId) || null;
        cntx.stage = null;
        await setAppStateText("worlds", nextId);
        await setAppStateText("stages", null);
        await rerenderStagesFromDb();
        return;
      }

      cntx.stage = cntx.stages.find((stage) => stage.stgId === nextId) || null;
      await setAppStateText("stages", cntx.stage?.stgId || null);
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
      context.stage =
        context.stages.find((stage) => stage.stgId === stgId) || null;
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

  if (cntx.lastPointerClient) {
    return cntx.mapViewport.viewportPointToContentPoint(
      cntx.lastPointerClient.x,
      cntx.lastPointerClient.y,
    );
  }

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
  cntx.world = (await loadSelectedWorld()) || cntx.worlds[0] || null;
  cntx.stage = null;
  // URLパラメータからのディープリンクのみ反映する。
  // stages はまだロード前なので appState に退避し、rerenderStagesFromDb 内で解決する。
  const queryStageId = String(
    new URLSearchParams(window.location.search).get("stgId") || "",
  ).trim();
  if (queryStageId) {
    await setAppStateText("stages", queryStageId);
  }
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

function createTaskButton(
  task: TaskRecord,
  cntx: MapPageContext,
): HTMLButtonElement {
  const taskObject = document.createElement("button");
  taskObject.type = "button";
  taskObject.className = `${MAPPAGE_CLASS.stageObject} ${MAPPAGE_CLASS.taskObject}`;
  taskObject.dataset.taskId = task.tkId;
  taskObject.dataset.taskWorldId = task.wId;
  taskObject.dataset.taskStageId = task.stgId || "";
  taskObject.dataset.taskOrd = String(task.ord);
  taskObject.dataset.taskColor = task.clr;
  taskObject.dataset.stageLabel = task.nm;
  taskObject.style.setProperty("--stage-base-color", task.clr || "#6fd3ff");
  taskObject.setAttribute("aria-label", task.nm || t("add_task"));
  taskObject.addEventListener("pointerdown", (event) => {
    if (!document.body.classList.contains(MAPPAGE_CLASS.editMode)) {
      return;
    }
    event.stopPropagation();
    beginTaskDrag(taskObject, cntx, event);
  });
  return taskObject;
}

function appendTaskObject(
  target: HTMLButtonElement,
  cntx: MapPageContext,
): void {
  if (cntx.elements.stageMapContent instanceof HTMLElement) {
    cntx.elements.stageMapContent.append(target);
    return;
  }
  document.body.append(target);
}

function beginTaskDrag(
  target: HTMLButtonElement,
  cntx: MapPageContext,
  startEvent?: PointerEvent,
): void {
  beginStageDrag({
    target,
    mapViewport: cntx.mapViewport,
    startEvent,
    onDragEnd: async (dragTarget) => {
      await saveTaskFromElement(dragTarget, cntx);
      await rerenderStagesFromDb();
    },
  });
}

async function saveTaskFromElement(
  target: HTMLButtonElement,
  cntx: MapPageContext,
  ordOverride?: number,
): Promise<void> {
  const tkId = String(target.dataset.taskId || "").trim();
  const wId = String(
    target.dataset.taskWorldId || cntx.world?.wId || "",
  ).trim();
  const stgIdText = String(
    target.dataset.taskStageId || cntx.stage?.stgId || "",
  ).trim();
  const stgId = stgIdText || null;
  const nm = String(target.dataset.stageLabel || "").trim();
  if (!tkId || !wId || !nm) {
    return;
  }

  const ordFromData = Number.parseInt(target.dataset.taskOrd || "", 10);
  const ord = Number.isFinite(ordOverride)
    ? Number(ordOverride)
    : Number.isFinite(ordFromData)
      ? ordFromData
      : 0;
  const current = cntx.tasks.find((task) => task.tkId === tkId);
  const pos = getElementPosition(target);

  await upsertTask({
    ...(current || createNewTaskRecord(ord || 1)),
    tkId,
    wId,
    stgId,
    ord,
    nm,
    clr: String(target.dataset.taskColor || current?.clr || "#6fd3ff"),
    x: pos.x,
    y: pos.y,
  });
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
    if (el.classList.contains(MAPPAGE_CLASS.taskObject)) {
      continue;
    }
    el.remove();
  }

  const currentTasks = Array.from(
    document.querySelectorAll(MAPPAGE_SELECTOR.taskObject),
  );
  for (const el of currentTasks) {
    el.remove();
  }

  const stages = await loadStages();
  cntx.stages = stages;
  cntx.tasks = await loadTasks();
  cntx.stage = await resolveSelectedStage(cntx);
  cntx.world =
    cntx.worlds.find((world) => world.wId === cntx.world?.wId) ||
    cntx.worlds[0] ||
    null;

  await applyCurrentMapBackground(cntx);
  renderCurrentHeaderLabel(cntx, cntx.elements.selectedWorldName);

  for (const stage of getVisibleStages(cntx)) {
    const stageObject = createStageButton(stage, cntx);
    appendStageObject(stageObject, cntx);
    cntx.mapViewport.placeElementWithinContent(stageObject, stage.x, stage.y);
  }

  for (const task of getVisibleTasks(cntx)) {
    const taskObject = createTaskButton(task, cntx);
    appendTaskObject(taskObject, cntx);
    cntx.mapViewport.placeElementWithinContent(taskObject, task.x, task.y);
  }
}

function getVisibleTasks(cntx: MapPageContext): TaskRecord[] {
  const selectedWorldId = cntx.world?.wId || "";
  const selectedStageId = cntx.stage?.stgId || null;
  return cntx.tasks
    .filter((task) => task.wId === selectedWorldId)
    .filter(
      (task) =>
        (task.stgId || null) === selectedStageId ||
        (selectedStageId === null && task.stgId === ""),
    )
    .sort((a, b) => a.ord - b.ord);
}

function getVisibleStages(cntx: MapPageContext): StageRecord[] {
  const selectedWorldId = cntx.world?.wId || "";
  const selectedStageId = cntx.stage?.stgId || null;
  return cntx.stages
    .filter((stage) => stage.wId === selectedWorldId)
    .filter(
      (stage) =>
        (stage.parentStgId || null) === selectedStageId ||
        (selectedStageId === null && stage.parentStgId === ""),
    )
    .sort((a, b) => a.ord - b.ord);
}

function getCurrentStage(cntx: MapPageContext): StageRecord | null {
  return cntx.stage;
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
  return cntx.stage?.stgId || cntx.world?.wId || "";
}

async function resolveSelectedStage(
  cntx: MapPageContext,
): Promise<StageRecord | null> {
  const savedStageId = String((await getAppStateText("stages")) || "").trim();
  if (!savedStageId) {
    return null;
  }

  const selected = cntx.stages.find((stage) => stage.stgId === savedStageId);
  if (!selected) {
    return null;
  }
  if (selected.wId !== (cntx.world?.wId || "")) {
    return null;
  }
  return selected;
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

  context.stage =
    context.stages.find((stage) => stage.stgId === currentStage.parentStgId) ||
    null;
  await setAppStateText("stages", context.stage?.stgId || null);
  await rerenderStagesFromDb();
}
