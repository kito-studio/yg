import { setAppStateText } from "../data/yg-idb";
import { context, rerenderStagesFromDb } from "../map";
import { MapPageContext } from "../map/constants";
import { MAPPAGE_CLASS } from "../map/dom";
import { beginStageDrag } from "../map/drag";
import {
  applyStageVisuals,
  createStageObject,
  saveStageFromElement,
  StageRecord,
} from "../obj/stage";

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
  onOpenContextMenu?: (stgId: string, x: number, y: number) => void;
};

export type StageInteractionHandlers = {
  onStageClick: (event: MouseEvent) => void;
  onStageDoubleClick: (event: MouseEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  beginDrag: (target: HTMLButtonElement, startEvent?: PointerEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
};

export function createStageInteractionHandlers(
  options: StageInteractionOptions,
): StageInteractionHandlers {
  const {
    getContext,
    saveSelectedStageId,
    navigateToStage,
    saveStageFromElement,
    onOpenContextMenu,
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

    const stgId = String(target.dataset.stageId || "").trim();
    if (!stgId || !onOpenContextMenu) {
      return;
    }

    onOpenContextMenu(stgId, event.clientX, event.clientY);
  }

  return {
    onStageClick,
    onStageDoubleClick,
    onPointerDown,
    beginDrag,
    onContextMenu,
  };
}
export function createStageButton(
  stage: StageRecord,
  cntx: MapPageContext,
): HTMLButtonElement {
  const stageObject = createStageObject(stage, {
    onPointerDown: cntx.stageHandlers.onPointerDown,
    onDoubleClick: cntx.stageHandlers.onStageDoubleClick,
    onClick: cntx.stageHandlers.onStageClick,
  });
  stageObject.addEventListener("contextmenu", cntx.stageHandlers.onContextMenu);
  applyStageVisuals(stageObject, cntx.fileStore);
  return stageObject;
}

export function appendStageObject(
  target: HTMLButtonElement,
  cntx: MapPageContext,
): void {
  if (cntx.elements.stageMapContent instanceof HTMLElement) {
    cntx.elements.stageMapContent.append(target);
    return;
  }
  document.body.append(target);
}
export function createStageHandlers(): ReturnType<
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
    onOpenContextMenu: (stgId, x, y) => {
      if (!context?.contextMenu) {
        return;
      }
      context.contextMenu.open({ type: "stage", stgId }, x, y);
    },
  });
}
