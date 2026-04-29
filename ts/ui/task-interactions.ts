import { t } from "../i18n";
import { context, rerenderStagesFromDb } from "../map";
import { MapPageContext } from "../map/constants";
import { MAPPAGE_CLASS } from "../map/dom";
import { beginStageDrag } from "../map/drag";
import { createMapObjectElement } from "../map/object-view";
import { getElementPosition } from "../map/stage-model";
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
};

export type TaskInteractionHandlers = {
  onTaskClick: (event: MouseEvent) => void;
  onTaskDoubleClick: (event: MouseEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  beginDrag: (target: HTMLButtonElement, startEvent?: PointerEvent) => void;
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

  return {
    onTaskClick,
    onTaskDoubleClick,
    onPointerDown,
    beginDrag,
  };
}
export function createTaskButton(
  task: TaskRecord,
  cntx: MapPageContext,
): HTMLButtonElement {
  const taskObject = createMapObjectElement({
    className: `${MAPPAGE_CLASS.stageObject} ${MAPPAGE_CLASS.taskObject}`,
    label: task.nm,
    ariaLabel: task.nm || t("add_task"),
    baseColor: task.clr || "#6fd3ff",
    dataset: {
      taskId: task.tkId,
      taskWorldId: task.wId,
      taskStageId: task.stgId || "",
      taskOrd: String(task.ord),
      taskColor: task.clr,
    },
    // タスクでも同構造を維持しておくと、画像/HP表現を差し込む拡張が容易。
    withSideImage: true,
    withHpGauge: true,
  });
  taskObject.addEventListener("pointerdown", cntx.taskHandlers.onPointerDown);
  taskObject.addEventListener("dblclick", cntx.taskHandlers.onTaskDoubleClick);
  taskObject.addEventListener("click", cntx.taskHandlers.onTaskClick);
  return taskObject;
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
    // Task dialog is not implemented yet. Keep the hook for parity with stages.
    onOpenTaskEditor: async () => {},
  });
}
