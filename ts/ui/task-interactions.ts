import { FileStoreGateway } from "../data/file-store";
import { t } from "../i18n";
import { context, rerenderStagesFromDb } from "../map";
import { MapPageContext } from "../map/constants";
import { MAPPAGE_CLASS, MAPPAGE_SELECTOR } from "../map/dom";
import { beginStageDrag } from "../map/drag";
import {
  buildImageFilterCss,
  normalizeImageBrightness,
  normalizeImageContrast,
  normalizeImageHue,
} from "../map/image-filter";
import { createMapObjectElement } from "../map/object-view";
import {
  applySpriteCellVisual,
  clearSpriteCellVisual,
} from "../map/sprite-sheet";
import {
  clampProgress,
  getElementPosition,
  getHpColor,
  progressToHp,
} from "../map/stage-model";
import { createNewTaskRecord, TaskRecord, upsertTask } from "../obj/task";

type TaskMapViewport = {
  isClickSuppressed: () => boolean;
  viewportPointToContentPoint: (
    x: number,
    y: number,
  ) => { x: number; y: number };
  placeElementWithinContent: (
    target: HTMLElement,
    x: number,
    y: number,
  ) => void;
};

type TaskPageContext = {
  mapViewport: TaskMapViewport;
};

type TaskInteractionOptions = {
  getContext: () => TaskPageContext | null;
  saveTaskFromElement: (target: HTMLButtonElement) => Promise<void>;
  onAfterDragEnd?: (target: HTMLButtonElement) => Promise<void> | void;
  onSelectTask?: (taskId: string) => Promise<void> | void;
  onOpenTaskEditor?: (target: HTMLButtonElement) => Promise<void> | void;
  onOpenContextMenu?: (tkId: string, x: number, y: number) => void;
};

export type TaskInteractionHandlers = {
  onTaskClick: (event: MouseEvent) => void;
  onTaskDoubleClick: (event: MouseEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  beginDrag: (target: HTMLButtonElement, startEvent?: PointerEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
};

export function createTaskInteractionHandlers(
  options: TaskInteractionOptions,
): TaskInteractionHandlers {
  const {
    getContext,
    saveTaskFromElement,
    onAfterDragEnd,
    onSelectTask,
    onOpenTaskEditor,
    onOpenContextMenu,
  } = options;

  function onTaskClick(event: MouseEvent): void {
    if (!document.body.classList.contains(MAPPAGE_CLASS.viewMode)) {
      return;
    }

    const context = getContext();
    if (context?.mapViewport.isClickSuppressed()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const taskId = String(target.dataset.taskId || "").trim();
    if (!taskId || !onSelectTask) {
      return;
    }

    void onSelectTask(taskId);
  }

  function onTaskDoubleClick(event: MouseEvent): void {
    if (!document.body.classList.contains(MAPPAGE_CLASS.editMode)) {
      return;
    }

    if (!onOpenTaskEditor) {
      return;
    }

    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    void onOpenTaskEditor(target);
  }

  function onPointerDown(event: PointerEvent): void {
    if (!document.body.classList.contains(MAPPAGE_CLASS.editMode)) {
      return;
    }

    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    event.stopPropagation();
    beginDrag(target, event);
  }

  function beginDrag(
    target: HTMLButtonElement,
    startEvent?: PointerEvent,
  ): void {
    const context = getContext();
    if (!context) {
      return;
    }

    beginStageDrag({
      target,
      mapViewport: context.mapViewport,
      startEvent,
      onDragEnd: async (dragTarget) => {
        await saveTaskFromElement(dragTarget);
        if (onAfterDragEnd) {
          await onAfterDragEnd(dragTarget);
        }
      },
    });
  }

  function onContextMenu(event: MouseEvent): void {
    if (!document.body.classList.contains(MAPPAGE_CLASS.editMode)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const tkId = String(target.dataset.taskId || "").trim();
    if (!tkId || !onOpenContextMenu) {
      return;
    }

    onOpenContextMenu(tkId, event.clientX, event.clientY);
  }

  return {
    onTaskClick,
    onTaskDoubleClick,
    onPointerDown,
    beginDrag,
    onContextMenu,
  };
}
export function createTaskButton(
  task: TaskRecord,
  cntx: MapPageContext,
): HTMLButtonElement {
  const taskObject = createMapObjectElement({
    className: MAPPAGE_CLASS.taskObject,
    label: task.nm,
    ariaLabel: task.nm || t("add_task"),
    baseColor: task.clr || "#6fd3ff",
    dataset: {
      taskId: task.tkId,
      taskWorldId: task.wId,
      taskStageId: task.stgId || "",
      taskOrd: String(task.ord),
      taskColor: task.clr,
      taskState: task.state,
      taskDesc: task.desc,
      taskProgress: String(task.progress),
      taskImgPath: task.iconFId,
      taskImgHue: String(normalizeImageHue(task.iconHue)),
      taskImgBrightness: String(normalizeImageBrightness(task.iconBrightness)),
      taskImgContrast: String(normalizeImageContrast(task.iconContrast)),
      taskSpriteCol: String(task.spriteCol),
      taskSpriteRow: String(task.spriteRow),
      taskSpriteTone: task.spriteTone,
    },
    // タスクでも同構造を維持しておくと、画像/HP表現を差し込む拡張が容易。
    withSideImage: true,
    withHpGauge: true,
  });
  taskObject.addEventListener("pointerdown", cntx.taskHandlers.onPointerDown);
  taskObject.addEventListener("dblclick", cntx.taskHandlers.onTaskDoubleClick);
  taskObject.addEventListener("click", cntx.taskHandlers.onTaskClick);
  taskObject.addEventListener("contextmenu", cntx.taskHandlers.onContextMenu);
  applyTaskVisuals(taskObject, task, cntx.fileStore);
  return taskObject;
}

function applyTaskVisuals(
  target: HTMLButtonElement,
  task: TaskRecord,
  fileStore: FileStoreGateway,
): void {
  const color = String(task.clr || "#6fd3ff").trim() || "#6fd3ff";
  const progress = clampProgress(Number(task.progress));
  const hp = progressToHp(progress);
  const hpFill = target.querySelector(
    MAPPAGE_SELECTOR.stageObjectHpFill,
  ) as HTMLElement | null;

  target.style.setProperty("--stage-base-color", color);
  if (hpFill) {
    hpFill.style.width = `${hp}%`;
    hpFill.style.backgroundColor = getHpColor(hp);
  }

  void applyTaskImageVisual(target, fileStore);
}

function parseTaskSpriteCell(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, parsed);
}

function applyTaskSpriteFallback(target: HTMLButtonElement): void {
  const ord = Number.parseInt(String(target.dataset.taskOrd || "1"), 10);
  const safeOrd = Number.isFinite(ord) && ord > 0 ? ord : 1;
  const col = parseTaskSpriteCell(
    target.dataset.taskSpriteCol,
    (safeOrd - 1) % 12,
  );
  const row = parseTaskSpriteCell(target.dataset.taskSpriteRow, 0);
  const tone =
    normalizeSpriteTone(target.dataset.taskSpriteTone || "") ||
    resolveTaskTone(String(target.dataset.taskState || ""));

  target.dataset.taskSpriteCol = String(col);
  target.dataset.taskSpriteRow = String(row);
  target.dataset.taskSpriteTone = tone;

  applySpriteCellVisual(target, {
    col,
    row,
    tone,
  });
}

async function applyTaskImageVisual(
  target: HTMLButtonElement,
  fileStore: FileStoreGateway,
): Promise<void> {
  const sideImage = target.querySelector(
    MAPPAGE_SELECTOR.stageObjectSideImage,
  ) as HTMLElement | null;
  const sideImageImg = target.querySelector(
    MAPPAGE_SELECTOR.stageObjectSideImageImg,
  ) as HTMLImageElement | null;
  if (!sideImage || !sideImageImg) {
    return;
  }

  const imgHue = normalizeImageHue(target.dataset.taskImgHue);
  const imgBrightness = normalizeImageBrightness(
    target.dataset.taskImgBrightness,
  );
  const imgContrast = normalizeImageContrast(target.dataset.taskImgContrast);
  target.dataset.taskImgHue = String(imgHue);
  target.dataset.taskImgBrightness = String(imgBrightness);
  target.dataset.taskImgContrast = String(imgContrast);
  sideImage.style.filter = buildImageFilterCss({
    hue: imgHue,
    brightness: imgBrightness,
    contrast: imgContrast,
  });

  const fId = String(target.dataset.taskImgPath || "").trim();
  if (!fId) {
    applyTaskSpriteFallback(target);
    return;
  }

  const objectUrl = await fileStore.getObjectUrlForFile(fId);
  if (!objectUrl) {
    applyTaskSpriteFallback(target);
    return;
  }

  const spriteMeta = await fileStore.getSpriteMetaForFile(fId);
  if (spriteMeta) {
    const col = Math.min(
      parseTaskSpriteCell(target.dataset.taskSpriteCol, 0),
      Math.max(0, spriteMeta.nw - 1),
    );
    const row = Math.min(
      parseTaskSpriteCell(target.dataset.taskSpriteRow, 0),
      Math.max(0, spriteMeta.nh - 1),
    );
    const tone =
      normalizeSpriteTone(target.dataset.taskSpriteTone || "") ||
      resolveTaskTone(String(target.dataset.taskState || ""));

    target.dataset.taskSpriteCol = String(col);
    target.dataset.taskSpriteRow = String(row);
    target.dataset.taskSpriteTone = tone;

    applySpriteCellVisual(target, {
      col,
      row,
      tone,
      sheetUrl: objectUrl,
      columns: spriteMeta.nw,
      rows: spriteMeta.nh,
    });
    return;
  }

  clearSpriteCellVisual(target);
  sideImage.hidden = false;
  sideImageImg.hidden = false;
  sideImageImg.src = objectUrl;
}

function applyTaskSpriteVisual(
  target: HTMLButtonElement,
  task: TaskRecord,
): void {
  const ord = Number.isFinite(task.ord) && task.ord > 0 ? task.ord : 1;
  const col = Number.isFinite(task.spriteCol)
    ? Math.max(0, Number(task.spriteCol))
    : (ord - 1) % 12;
  const row = Number.isFinite(task.spriteRow)
    ? Math.max(0, Number(task.spriteRow))
    : 0;
  const tone =
    normalizeSpriteTone(task.spriteTone) || resolveTaskTone(task.state);

  target.dataset.taskSpriteCol = String(col);
  target.dataset.taskSpriteRow = String(row);
  target.dataset.taskSpriteTone = tone;

  applySpriteCellVisual(target, {
    // 1行目(0-based: row=0)をタスク用に使う。
    col,
    row,
    tone,
  });
}

function normalizeSpriteTone(value: string): "none" | "red" | "dark" | "" {
  const tone = String(value || "")
    .trim()
    .toLowerCase();
  if (tone === "none" || tone === "red" || tone === "dark") {
    return tone;
  }
  return "";
}

function resolveTaskTone(state: string): "none" | "red" | "dark" {
  const normalized = String(state || "")
    .trim()
    .toLowerCase();
  if (normalized === "doing" || normalized === "in_progress") {
    return "red";
  }
  if (normalized === "done" || normalized === "closed") {
    return "dark";
  }
  return "none";
}
export function appendTaskObject(
  target: HTMLButtonElement,
  cntx: MapPageContext,
): void {
  if (cntx.elements.stageMapContent instanceof HTMLElement) {
    cntx.elements.stageMapContent.append(target);
    return;
  }
  document.body.append(target);
}
export async function saveTaskFromElement(
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
  const spriteCol = Number.isFinite(
    Number.parseInt(target.dataset.taskSpriteCol || "", 10),
  )
    ? Math.max(0, Number.parseInt(target.dataset.taskSpriteCol || "0", 10))
    : Math.max(0, (ord || 1) - 1) % 12;
  const spriteRow = Number.isFinite(
    Number.parseInt(target.dataset.taskSpriteRow || "", 10),
  )
    ? Math.max(0, Number.parseInt(target.dataset.taskSpriteRow || "0", 10))
    : 0;
  const spriteTone =
    normalizeSpriteTone(target.dataset.taskSpriteTone || "") ||
    resolveTaskTone(String(target.dataset.taskState || ""));
  const current = cntx.tasks.find((task) => task.tkId === tkId);
  const iconHue = normalizeImageHue(
    target.dataset.taskImgHue || current?.iconHue,
  );
  const iconBrightness = normalizeImageBrightness(
    target.dataset.taskImgBrightness || current?.iconBrightness,
  );
  const iconContrast = normalizeImageContrast(
    target.dataset.taskImgContrast || current?.iconContrast,
  );
  const pos = getElementPosition(target);

  target.dataset.taskImgHue = String(iconHue);
  target.dataset.taskImgBrightness = String(iconBrightness);
  target.dataset.taskImgContrast = String(iconContrast);
  target.dataset.taskSpriteCol = String(spriteCol);
  target.dataset.taskSpriteRow = String(spriteRow);
  target.dataset.taskSpriteTone = spriteTone;

  await upsertTask({
    ...(current || createNewTaskRecord(ord || 1)),
    tkId,
    wId,
    stgId,
    ord,
    nm,
    desc: String(target.dataset.taskDesc || current?.desc || ""),
    progress: clampProgress(
      Number.isFinite(Number.parseInt(target.dataset.taskProgress || "", 10))
        ? Number.parseInt(target.dataset.taskProgress || "0", 10)
        : (current?.progress ?? 0),
    ),
    iconFId: String(target.dataset.taskImgPath || current?.iconFId || ""),
    iconHue,
    iconBrightness,
    iconContrast,
    clr: String(target.dataset.taskColor || current?.clr || "#6fd3ff"),
    spriteCol,
    spriteRow,
    spriteTone,
    x: pos.x,
    y: pos.y,
  });
}
export function createTaskHandlers(): ReturnType<
  typeof createTaskInteractionHandlers
> {
  return createTaskInteractionHandlers({
    getContext: () => context,
    saveTaskFromElement: async (target) => {
      if (!context) {
        return;
      }
      await saveTaskFromElement(target, context);
    },
    onAfterDragEnd: async () => {
      await rerenderStagesFromDb();
    },
    onSelectTask: async (taskId) => {
      if (!context) {
        return;
      }

      const target = Array.from(
        document.querySelectorAll(MAPPAGE_SELECTOR.taskObject),
      ).find(
        (el) =>
          el instanceof HTMLButtonElement &&
          String(el.dataset.taskId || "").trim() === taskId,
      );

      if (target instanceof HTMLButtonElement) {
        context.taskProgressDialog.open(target);
      }
    },
    onOpenTaskEditor: async (target) => {
      if (!context) {
        return;
      }
      context.taskDialog.open(target);
    },
    onOpenContextMenu: (tkId, x, y) => {
      if (!context?.contextMenu) {
        return;
      }
      context.contextMenu.open({ type: "task", tkId }, x, y);
    },
  });
}
