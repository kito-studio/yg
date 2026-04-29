import { MAPPAGE_CLASS } from "../map/dom";
import { beginStageDrag } from "../map/drag";

type StageMapViewport = {
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

type StageDialogBridge = {
  open: (target: HTMLButtonElement) => void;
};

type StagePageContext = {
  mapViewport: StageMapViewport;
  stageDialog: StageDialogBridge;
};

type StageInteractionOptions = {
  getContext: () => StagePageContext | null;
  saveSelectedStageId: (stgId: string) => Promise<void>;
  navigateToStage: (stgId: string) => Promise<void> | void;
  saveStageFromElement: (target: HTMLButtonElement) => Promise<void>;
};

export type StageInteractionHandlers = {
  onStageClick: (event: MouseEvent) => void;
  onStageDoubleClick: (event: MouseEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  beginDrag: (target: HTMLButtonElement, startEvent?: PointerEvent) => void;
};

export function createStageInteractionHandlers(
  options: StageInteractionOptions,
): StageInteractionHandlers {
  const {
    getContext,
    saveSelectedStageId,
    navigateToStage,
    saveStageFromElement,
  } = options;

  function onStageClick(event: MouseEvent): void {
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

    const stgId = String(target.dataset.stageId || "").trim();
    if (!stgId) {
      return;
    }

    void (async () => {
      await saveSelectedStageId(stgId);
      await navigateToStage(stgId);
    })();
  }

  function onStageDoubleClick(event: MouseEvent): void {
    if (!document.body.classList.contains(MAPPAGE_CLASS.editMode)) {
      return;
    }

    const context = getContext();
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
        await saveStageFromElement(dragTarget);
      },
    });
  }

  return {
    onStageClick,
    onStageDoubleClick,
    onPointerDown,
    beginDrag,
  };
}
