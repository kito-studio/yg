type DragViewport = {
  viewportPointToContentPoint: (x: number, y: number) => { x: number; y: number };
  placeElementWithinContent: (
    target: HTMLElement,
    x: number,
    y: number,
  ) => void;
};

type BeginStageDragOptions = {
  target: HTMLButtonElement;
  mapViewport: DragViewport;
  startEvent?: PointerEvent;
  onDragEnd: (target: HTMLButtonElement) => Promise<void> | void;
};

export function beginStageDrag(options: BeginStageDragOptions): void {
  const { target, mapViewport, startEvent, onDragEnd } = options;

  // ドラッグ開始時点の位置とポインタ差分を保持する。
  target.classList.add("dragging");

  const left = Number.parseFloat(target.style.left);
  const top = Number.parseFloat(target.style.top);
  const targetPosition = {
    x: Number.isFinite(left) ? left : 0,
    y: Number.isFinite(top) ? top : 0,
  };
  const initialPointerPoint = startEvent
    ? mapViewport.viewportPointToContentPoint(startEvent.clientX, startEvent.clientY)
    : null;
  const offsetX =
    startEvent && initialPointerPoint
      ? initialPointerPoint.x - targetPosition.x
      : target.offsetWidth / 2;
  const offsetY =
    startEvent && initialPointerPoint
      ? initialPointerPoint.y - targetPosition.y
      : target.offsetHeight / 2;

  const move = (clientX: number, clientY: number) => {
    // 画面座標をコンテンツ座標へ変換してから配置する。
    const point = mapViewport.viewportPointToContentPoint(clientX, clientY);
    mapViewport.placeElementWithinContent(target, point.x - offsetX, point.y - offsetY);
  };

  const onMove = (event: PointerEvent) => {
    move(event.clientX, event.clientY);
  };

  const onUp = () => {
    target.classList.remove("dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    void onDragEnd(target);
  };

  if (startEvent && startEvent.pointerId != null) {
    target.setPointerCapture(startEvent.pointerId);
    move(startEvent.clientX, startEvent.clientY);
  }

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
