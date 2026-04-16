type Point = {
  x: number;
  y: number;
};

type ViewState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

type PanState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  moved: boolean;
  lastClientX: number;
  lastClientY: number;
  lastTimestamp: number;
  velocityX: number;
  velocityY: number;
};

type MapViewportControllerOptions = {
  viewport: HTMLElement | null;
  content: HTMLElement | null;
  contentSize: { width: number; height: number };
  minScale: number;
  maxScale: number;
  zoomSensitivity: number;
  panThresholdPx: number;
  inertiaFriction: number;
  inertiaMinSpeed: number;
  ignorePanStart?: (event: PointerEvent) => boolean;
};

export type MapViewportController = {
  setup: () => void;
  placeElementWithinContent: (
    target: HTMLElement,
    left: number,
    top: number,
  ) => void;
  viewportPointToContentPoint: (clientX: number, clientY: number) => Point;
  isClickSuppressed: () => boolean;
};

export function createMapViewportController(
  options: MapViewportControllerOptions,
): MapViewportController {
  const {
    viewport,
    content,
    contentSize,
    minScale,
    maxScale,
    zoomSensitivity,
    panThresholdPx,
    inertiaFriction,
    inertiaMinSpeed,
    ignorePanStart,
  } = options;

  const viewState: ViewState = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };

  let panState: PanState | null = null;
  let inertiaFrameId: number | null = null;
  let inertiaVelocityX = 0;
  let inertiaVelocityY = 0;
  let suppressClickUntil = 0;

  function getViewportSize(): { width: number; height: number } {
    if (viewport instanceof HTMLElement) {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  function clampScale(value: number): number {
    return Math.max(minScale, Math.min(value, maxScale));
  }

  function clampOffset(
    offset: number,
    viewportSize: number,
    scaledSize: number,
  ): number {
    if (scaledSize <= viewportSize) {
      return (viewportSize - scaledSize) / 2;
    }

    const minOffset = viewportSize - scaledSize;
    return Math.max(minOffset, Math.min(offset, 0));
  }

  function clampTransform(
    scale: number,
    offsetX: number,
    offsetY: number,
  ): ViewState {
    const safeScale = clampScale(scale);
    const viewportSize = getViewportSize();
    const scaledWidth = contentSize.width * safeScale;
    const scaledHeight = contentSize.height * safeScale;

    return {
      scale: safeScale,
      offsetX: clampOffset(offsetX, viewportSize.width, scaledWidth),
      offsetY: clampOffset(offsetY, viewportSize.height, scaledHeight),
    };
  }

  function applyTransform(): void {
    if (!(content instanceof HTMLElement)) {
      return;
    }

    content.style.transform = `translate(${viewState.offsetX}px, ${viewState.offsetY}px) scale(${viewState.scale})`;
  }

  function setTransform(scale: number, offsetX: number, offsetY: number): void {
    const clamped = clampTransform(scale, offsetX, offsetY);
    viewState.scale = clamped.scale;
    viewState.offsetX = clamped.offsetX;
    viewState.offsetY = clamped.offsetY;
    applyTransform();
  }

  function stopInertia(): void {
    if (inertiaFrameId != null) {
      window.cancelAnimationFrame(inertiaFrameId);
      inertiaFrameId = null;
    }
    inertiaVelocityX = 0;
    inertiaVelocityY = 0;
  }

  function startInertia(velocityX: number, velocityY: number): void {
    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    stopInertia();
    if (Math.hypot(velocityX, velocityY) < inertiaMinSpeed) {
      return;
    }

    inertiaVelocityX = velocityX;
    inertiaVelocityY = velocityY;
    let lastTimestamp = performance.now();

    const step = (timestamp: number) => {
      const elapsed = Math.max(timestamp - lastTimestamp, 1);
      lastTimestamp = timestamp;

      inertiaVelocityX *= inertiaFriction;
      inertiaVelocityY *= inertiaFriction;

      const previousOffsetX = viewState.offsetX;
      const previousOffsetY = viewState.offsetY;
      setTransform(
        viewState.scale,
        viewState.offsetX + inertiaVelocityX * elapsed,
        viewState.offsetY + inertiaVelocityY * elapsed,
      );

      const hitBoundaryX = Math.abs(viewState.offsetX - previousOffsetX) < 0.01;
      const hitBoundaryY = Math.abs(viewState.offsetY - previousOffsetY) < 0.01;

      if (hitBoundaryX) {
        inertiaVelocityX = 0;
      }
      if (hitBoundaryY) {
        inertiaVelocityY = 0;
      }

      if (
        Math.abs(inertiaVelocityX) < inertiaMinSpeed &&
        Math.abs(inertiaVelocityY) < inertiaMinSpeed
      ) {
        stopInertia();
        return;
      }

      inertiaFrameId = window.requestAnimationFrame(step);
    };

    inertiaFrameId = window.requestAnimationFrame(step);
  }

  function zoomToClientPoint(
    nextScale: number,
    clientX: number,
    clientY: number,
  ): void {
    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    const safeScale = clampScale(nextScale);
    const rect = viewport.getBoundingClientRect();
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;
    const contentX = (viewportX - viewState.offsetX) / viewState.scale;
    const contentY = (viewportY - viewState.offsetY) / viewState.scale;

    setTransform(
      safeScale,
      viewportX - contentX * safeScale,
      viewportY - contentY * safeScale,
    );
  }

  function onWheel(event: WheelEvent): void {
    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    stopInertia();
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      const zoomFactor = Math.exp(-event.deltaY * zoomSensitivity);
      zoomToClientPoint(
        viewState.scale * zoomFactor,
        event.clientX,
        event.clientY,
      );
      return;
    }

    setTransform(
      viewState.scale,
      viewState.offsetX - event.deltaX,
      viewState.offsetY - event.deltaY,
    );
  }

  function onPointerMove(event: PointerEvent): void {
    if (!(viewport instanceof HTMLElement) || !panState) {
      return;
    }

    if (event.pointerId !== panState.pointerId) {
      return;
    }

    const deltaX = event.clientX - panState.startClientX;
    const deltaY = event.clientY - panState.startClientY;
    const now = performance.now();
    const elapsed = Math.max(now - panState.lastTimestamp, 1);
    const velocityX = (event.clientX - panState.lastClientX) / elapsed;
    const velocityY = (event.clientY - panState.lastClientY) / elapsed;

    if (!panState.moved && Math.hypot(deltaX, deltaY) >= panThresholdPx) {
      panState.moved = true;
    }

    panState.velocityX = velocityX * 0.35 + panState.velocityX * 0.65;
    panState.velocityY = velocityY * 0.35 + panState.velocityY * 0.65;
    panState.lastClientX = event.clientX;
    panState.lastClientY = event.clientY;
    panState.lastTimestamp = now;

    setTransform(
      viewState.scale,
      panState.startOffsetX + deltaX,
      panState.startOffsetY + deltaY,
    );
    event.preventDefault();
  }

  function clearPanListeners(): void {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  function onPointerUp(event: PointerEvent): void {
    if (!(viewport instanceof HTMLElement) || !panState) {
      return;
    }

    if (event.pointerId !== panState.pointerId) {
      return;
    }

    if (panState.moved) {
      suppressClickUntil = performance.now() + 250;
    }

    const nextVelocityX = panState.velocityX;
    const nextVelocityY = panState.velocityY;

    viewport.classList.remove("is-panning");
    clearPanListeners();
    panState = null;

    startInertia(nextVelocityX, nextVelocityY);
  }

  function onPointerDown(event: PointerEvent): void {
    if (!(viewport instanceof HTMLElement)) {
      return;
    }

    if (ignorePanStart?.(event)) {
      return;
    }

    stopInertia();
    const timestamp = performance.now();
    panState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: viewState.offsetX,
      startOffsetY: viewState.offsetY,
      moved: false,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      lastTimestamp: timestamp,
      velocityX: 0,
      velocityY: 0,
    };

    viewport.classList.add("is-panning");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function onResize(): void {
    stopInertia();
    setTransform(viewState.scale, viewState.offsetX, viewState.offsetY);
  }

  function placeElementWithinContent(
    target: HTMLElement,
    left: number,
    top: number,
  ): void {
    const maxLeft = contentSize.width - target.offsetWidth;
    const maxTop = contentSize.height - target.offsetHeight;
    target.style.left = `${Math.max(0, Math.min(left, maxLeft))}px`;
    target.style.top = `${Math.max(0, Math.min(top, maxTop))}px`;
  }

  function viewportPointToContentPoint(
    clientX: number,
    clientY: number,
  ): Point {
    if (!(viewport instanceof HTMLElement)) {
      return { x: clientX, y: clientY };
    }

    const rect = viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewState.offsetX) / viewState.scale,
      y: (clientY - rect.top - viewState.offsetY) / viewState.scale,
    };
  }

  function setup(): void {
    if (
      !(viewport instanceof HTMLElement) ||
      !(content instanceof HTMLElement)
    ) {
      return;
    }

    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);
    applyTransform();
  }

  return {
    setup,
    placeElementWithinContent,
    viewportPointToContentPoint,
    isClickSuppressed: () => performance.now() < suppressClickUntil,
  };
}
