import { MAPPAGE_CLASS } from "../map/dom";
import { beginStageDrag } from "../map/drag";

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
