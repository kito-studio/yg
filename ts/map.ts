import { insertHtmlPart, isLocal } from "./core";
import { createFileStoreGateway, FileStoreGateway } from "./data/file-store";
import { getAppStateText, setAppStateText } from "./data/yg-idb";
import { downloadYGBackupJson, restoreYGBackupFromFile } from "./db-backup";
import { applyI18n, t } from "./i18n";
import { ensureYGDatabase } from "./init-db";
import { addMapObjectWithDrag } from "./map/add-object";
import {
  MAP_INERTIA_FRICTION,
  MAP_INERTIA_MIN_SPEED,
  MAP_PAN_THRESHOLD_PX,
  MAP_ZOOM_SENSITIVITY,
  MapPageContext,
  MAX_MAP_SCALE,
  MIN_MAP_SCALE,
  STAGE_MAP_CONTENT_SIZE,
} from "./map/constants";
import { createContextMenuController } from "./map/context-menu";
import {
  getMapPageElements,
  MAPPAGE_CLASS,
  MAPPAGE_SELECTOR,
  MapPageElements,
} from "./map/dom";
import {
  buildImageFilterCss,
  normalizeImageBrightness,
  normalizeImageContrast,
  normalizeImageHue,
} from "./map/image-filter";
import { intro, waitForMapRevealComplete } from "./map/reveal";
import { createStageDialogController } from "./map/stage-dialog";
import { getStageDialogElements } from "./map/stage-dialog-elements";
import { createTaskDialogController } from "./map/task-dialog";
import { getTaskDialogElements } from "./map/task-dialog-elements";
import { createTaskProgressDialogController } from "./map/task-progress-dialog";
import { getTaskProgressDialogElements } from "./map/task-progress-dialog-elements";
import { playMapTransition } from "./map/transition";
import { createWeightDialogController } from "./map/weight-dialog";
import { getWeightDialogElements } from "./map/weight-dialog-elements";
import { createWorldDialogController } from "./map/world-dialog";
import { getWorldDialogElements } from "./map/world-dialog-elements";
import {
  createNewStageRecord,
  loadStages,
  saveStageFromElement,
  StageRecord,
  upsertStage,
} from "./obj/stage";
import {
  createNewTaskRecord,
  loadTasks,
  TaskRecord,
  upsertTask,
} from "./obj/task";
import { loadSelectedWorld, loadWorlds, upsertWorld } from "./obj/world";
import { setupLoopAudioToggle } from "./sound/audio";
import { createTopPageBgmAudio as createMapPageBgmAudio } from "./sound/top-page";
import {
  setupHeaderSwitch,
  setupModeSwitch,
  setupToolbar,
} from "./ui/common-header";
import {
  createMapViewportController,
  MapViewportController,
} from "./ui/map-viewport";
import {
  appendStageObject,
  createStageButton,
  createStageHandlers,
} from "./ui/stage-interactions";
import {
  appendTaskObject,
  createTaskButton,
  createTaskHandlers,
  saveTaskFromElement,
} from "./ui/task-interactions";
import { lg } from "./util/log";

const fallbackWorldMapImageUrl = new URL(
  "../img/world_map/fantasy1_e.jpg",
  import.meta.url,
).toString();

export let context: MapPageContext | null = null;

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
  cntx.taskDialog.bindEvents();
  cntx.taskProgressDialog.bindEvents();
  cntx.weightDialog.bindEvents();
  cntx.worldDialog.bindEvents();
  cntx.contextMenu.bindEvents();

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
  await intro({
    logoWrap: elements.logoWrap,
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
    if (!context) {
      return;
    }
    const cntx = context;

    await addMapObjectWithDrag({
      isEditMode: () =>
        document.body.classList.contains(MAPPAGE_CLASS.editMode),
      resolveNextOrd: () => getVisibleStages(cntx).length + 1,
      createRecord: (nextOrd) => {
        const stageRecord = createNewStageRecord(nextOrd);
        stageRecord.wId = cntx.world?.wId || "";
        stageRecord.parentStgId = cntx.stage?.stgId || null;
        return stageRecord;
      },
      createElement: (stageRecord) => createStageButton(stageRecord, cntx),
      appendElement: (stageObject) => {
        appendStageObject(stageObject, cntx);
      },
      getAnchorPoint: () => getNewStageAnchorPoint(cntx),
      placeElement: (stageObject, x, y) => {
        cntx.mapViewport.placeElementWithinContent(stageObject, x, y);
      },
      saveElement: async (stageObject, _record, nextOrd) => {
        await saveStageFromElement(stageObject, nextOrd);
      },
      startAdjust: (stageObject) => {
        cntx.stageHandlers.beginDrag(stageObject);
      },
    });
  });

  elements.addTaskButton?.addEventListener("click", async () => {
    if (!context) {
      return;
    }
    const cntx = context;

    await addMapObjectWithDrag({
      isEditMode: () =>
        document.body.classList.contains(MAPPAGE_CLASS.editMode),
      canCreate: () => {
        if (cntx.world) {
          return true;
        }
        window.alert(t("no_world"));
        return false;
      },
      resolveNextOrd: () => getVisibleTasks(cntx).length + 1,
      createRecord: (nextOrd) => {
        const taskRecord = createNewTaskRecord(nextOrd);
        taskRecord.wId = cntx.world?.wId || "";
        taskRecord.stgId = cntx.stage?.stgId || null;
        return taskRecord;
      },
      createElement: (taskRecord) => createTaskButton(taskRecord, cntx),
      appendElement: (taskObject) => {
        appendTaskObject(taskObject, cntx);
      },
      getAnchorPoint: () => getNewStageAnchorPoint(cntx),
      placeElement: (taskObject, x, y) => {
        cntx.mapViewport.placeElementWithinContent(taskObject, x, y);
      },
      saveElement: async (taskObject, taskRecord, nextOrd) => {
        await saveTaskFromElement(taskObject, cntx, nextOrd);
        cntx.tasks.push(taskRecord);
      },
      startAdjust: (taskObject) => {
        cntx.taskHandlers.beginDrag(taskObject);
      },
    });
  });

  elements.weightAdjustButton?.addEventListener("click", () => {
    if (!context) {
      return;
    }
    context.weightDialog.open();
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
    "task_dialog",
    "world_dialog",
    "weight_dialog",
    "context_menu",
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
    taskDialog: createTaskDialog(fileStore),
    taskProgressDialog: createTaskProgressDialog(fileStore),
    weightDialog: createWeightDialog(),
    worldDialog: createWorldDialog(fileStore),
    contextMenu: createContextMenu(),
    stageHandlers: createStageHandlers(),
    taskHandlers: createTaskHandlers(),
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
        await playMapTransition(() => rerenderStagesFromDb());
        return;
      }

      cntx.stage = cntx.stages.find((stage) => stage.stgId === nextId) || null;
      await setAppStateText("stages", cntx.stage?.stgId || null);
      await playMapTransition(() => rerenderStagesFromDb());
    },
  });

  if (elements.selectedWorldName instanceof HTMLElement) {
    elements.selectedWorldName.style.cursor = "pointer";
    elements.selectedWorldName.addEventListener("click", () => {
      if (document.body.classList.contains(MAPPAGE_CLASS.editMode)) {
        return;
      }
      void stepOutSelection();
    });
    elements.selectedWorldName.addEventListener("dblclick", () => {
      if (!context?.world) {
        return;
      }
      if (!document.body.classList.contains(MAPPAGE_CLASS.editMode)) {
        return;
      }
      context.worldDialog.open(context.world);
    });
  }
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
        !!event.target.closest(
          `${MAPPAGE_SELECTOR.stageObject}, ${MAPPAGE_SELECTOR.taskObject}`,
        )
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

function createTaskDialog(
  fileStore: FileStoreGateway,
): ReturnType<typeof createTaskDialogController> {
  return createTaskDialogController({
    elements: getTaskDialogElements(),
    fileStore,
    saveTaskFromElement: async (target) => {
      if (!context) {
        return;
      }
      await saveTaskFromElement(target, context);
    },
    onAfterSave: async () => {
      await rerenderStagesFromDb();
    },
  });
}

function createTaskProgressDialog(
  fileStore: FileStoreGateway,
): ReturnType<typeof createTaskProgressDialogController> {
  return createTaskProgressDialogController({
    elements: getTaskProgressDialogElements(),
    fileStore,
    saveTaskFromElement: async (target) => {
      if (!context) {
        return;
      }
      await saveTaskFromElement(target, context);
    },
    onAfterSave: async () => {
      await rerenderStagesFromDb();
    },
  });
}

function createWorldDialog(
  fileStore: FileStoreGateway,
): ReturnType<typeof createWorldDialogController> {
  return createWorldDialogController({
    elements: getWorldDialogElements(),
    fileStore,
    saveWorld: async (nextWorld) => {
      await upsertWorld(nextWorld);
      if (!context) {
        return;
      }

      context.worlds = context.worlds.map((world) =>
        world.wId === nextWorld.wId ? { ...world, ...nextWorld } : world,
      );
      context.world =
        context.worlds.find((world) => world.wId === nextWorld.wId) ||
        context.world;
    },
    onAfterSave: async () => {
      await rerenderStagesFromDb();
    },
  });
}

function createWeightDialog(): ReturnType<typeof createWeightDialogController> {
  return createWeightDialogController({
    elements: getWeightDialogElements(),
    resolveItems: () => {
      if (!context) {
        return [];
      }
      const stages = getVisibleStages(context).map((stage) => ({
        type: "stage" as const,
        id: stage.stgId,
        label: stage.nm || stage.stgId,
        progress: stage.progress,
        weight: Number.isFinite(stage.weight) ? stage.weight : 1,
      }));
      const tasks = getVisibleTasks(context).map((task) => ({
        type: "task" as const,
        id: task.tkId,
        label: task.nm || task.tkId,
        progress: task.progress,
        weight: Number.isFinite(task.weight) ? task.weight : 1,
      }));
      return [...stages, ...tasks];
    },
    saveWeights: async (next) => {
      if (!context) {
        return;
      }

      const stageUpdates: Promise<void>[] = [];
      const taskUpdates: Promise<void>[] = [];
      for (const item of next) {
        const w = Math.max(1, Math.min(100, Math.round(item.weight)));
        if (item.type === "stage") {
          const stage = context.stages.find((s) => s.stgId === item.id);
          if (stage && stage.weight !== w) {
            stage.weight = w;
            stageUpdates.push(upsertStage({ ...stage, weight: w }));
          }
        } else {
          const task = context.tasks.find((tk) => tk.tkId === item.id);
          if (task && task.weight !== w) {
            task.weight = w;
            taskUpdates.push(upsertTask({ ...task, weight: w }));
          }
        }
      }
      await Promise.all([...stageUpdates, ...taskUpdates]);
      await rerenderStagesFromDb();
    },
  });
}

function createContextMenu(): ReturnType<typeof createContextMenuController> {
  return createContextMenuController({
    getContext: () => context,
    onAfterChange: async () => {
      await rerenderStagesFromDb();
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
  selectedStageNameEl: HTMLElement | null,
): void {
  const worldLabel = cntx.world?.nm || cntx.world?.wId || t("no_world");
  if (selectedWorldNameEl instanceof HTMLElement) {
    selectedWorldNameEl.textContent = worldLabel;
  }

  if (selectedStageNameEl instanceof HTMLElement) {
    const stageLabel = cntx.stage?.nm || cntx.stage?.stgId || "";
    selectedStageNameEl.textContent = stageLabel ? ` > ${stageLabel}` : "";
  }
}

export async function rerenderStagesFromDb(): Promise<void> {
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

  await persistAggregateProgressForCurrentMap(cntx);

  await applyCurrentMapBackground(cntx);
  renderCurrentHeaderLabel(
    cntx,
    cntx.elements.selectedWorldName,
    cntx.elements.selectedStageName,
  );

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

async function persistAggregateProgressForCurrentMap(
  cntx: MapPageContext,
): Promise<void> {
  const stages = getVisibleStages(cntx);
  const tasks = getVisibleTasks(cntx);
  const items = [
    ...stages.map((stage) => ({
      progress: stage.progress,
      weight:
        Number.isFinite(stage.weight) && stage.weight > 0 ? stage.weight : 1,
    })),
    ...tasks.map((task) => ({
      progress: task.progress,
      weight: Number.isFinite(task.weight) && task.weight > 0 ? task.weight : 1,
    })),
  ];
  if (items.length === 0) {
    return;
  }

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const weighted = items.reduce((sum, item) => {
    const safeProgress = Math.max(0, Math.min(100, Math.round(item.progress)));
    return sum + (item.weight / totalWeight) * safeProgress;
  }, 0);
  const totalProgress = Math.max(0, Math.min(100, Math.round(weighted)));

  if (!cntx.stage && cntx.world) {
    if ((cntx.world.progress ?? 0) !== totalProgress) {
      cntx.world.progress = totalProgress;
      await upsertWorld({ ...cntx.world, progress: totalProgress });
    }
    return;
  }

  if (cntx.stage) {
    const parent = cntx.stages.find(
      (stage) => stage.stgId === cntx.stage?.stgId,
    );
    if (!parent) {
      return;
    }
    if (parent.progress !== totalProgress) {
      parent.progress = totalProgress;
      await upsertStage({ ...parent, progress: totalProgress });
    }
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
  const mapHue = normalizeImageHue(
    currentStage?.mapImgHue ?? cntx.world?.mapImgHue,
  );
  const mapBrightness = normalizeImageBrightness(
    currentStage?.mapImgBrightness ?? cntx.world?.mapImgBrightness,
  );
  const mapContrast = normalizeImageContrast(
    currentStage?.mapImgContrast ?? cntx.world?.mapImgContrast,
  );
  image.style.filter = buildImageFilterCss(
    {
      hue: mapHue,
      brightness: mapBrightness,
      contrast: mapContrast,
    },
    "saturate(1.08) contrast(1.02)",
  );
  if (!path) {
    image.src = fallbackWorldMapImageUrl;
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
  await playMapTransition(() => rerenderStagesFromDb());
}
