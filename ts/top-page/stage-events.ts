import { beginStageDrag } from "./drag";

type StageMapViewport = {
  isClickSuppressed: () => boolean;
  viewportPointToContentPoint: (x: number, y: number) => { x: number; y: number };
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
  editModeClass: string;
  viewModeClass: string;
  getContext: () => StagePageContext | null;
  saveSelectedStageId: (stgId: string) => Promise<void>;
  navigateToStage: (stgId: string) => void;
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
    editModeClass,
    viewModeClass,
    getContext,
    saveSelectedStageId,
    navigateToStage,
    saveStageFromElement,
  } = options;

  function onStageClick(event: MouseEvent): void {
    if (!document.body.classList.contains(viewModeClass)) {
      return;
    }

    const context = getContext();
    // パン/ドラッグ由来のクリックは誤操作として無視する。
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
      // ドリルダウン先で状態復元できるよう、選択ステージを保存してから遷移する。
      await saveSelectedStageId(stgId);
      navigateToStage(stgId);
    })();
  }

  function onStageDoubleClick(event: MouseEvent): void {
    if (!document.body.classList.contains(editModeClass)) {
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
    if (!document.body.classList.contains(editModeClass)) {
      return;
    }

    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    event.stopPropagation();
    beginDrag(target, event);
  }

  function beginDrag(target: HTMLButtonElement, startEvent?: PointerEvent): void {
    const context = getContext();
    if (!context) {
      return;
    }

    beginStageDrag({
      target,
      mapViewport: context.mapViewport,
      startEvent,
      onDragEnd: async (dragTarget) => {
        // 移動中の連続保存を避け、ドラッグ完了時に一度だけ保存する。
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
