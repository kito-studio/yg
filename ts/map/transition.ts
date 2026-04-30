const OVERLAY_ID = "mapTransitionOverlay";

function getOrCreateOverlay(): HTMLElement {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    return existing;
  }
  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.className = "map-transition-overlay";
  document.body.append(el);
  return el;
}

function waitTransitionEnd(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      el.removeEventListener("transitionend", handler);
      resolve();
    };
    el.addEventListener("transitionend", handler);
  });
}

/**
 * 地図遷移演出: 中央に向かって円が縮小して暗転し、fnを実行後に再び円が広がって表示する。
 */
export async function playMapTransition(
  fn: () => Promise<void>,
): Promise<void> {
  const overlay = getOrCreateOverlay();

  // 遷移なしで円を最大サイズに設定（前回の残留状態をリセット）
  overlay.style.transition = "none";
  overlay.style.clipPath = "circle(120% at 50% 50%)";
  overlay.getBoundingClientRect(); // force reflow

  // 閉じる: 円を縮小して暗転
  overlay.style.transition = "";
  overlay.style.clipPath = "circle(0% at 50% 50%)";
  await waitTransitionEnd(overlay);

  // 暗転中に地図を更新
  await fn();

  // 開く: 円を拡大して表示
  overlay.style.clipPath = "circle(120% at 50% 50%)";
  await waitTransitionEnd(overlay);

  // 非表示状態に戻す（次回のために）
  overlay.style.transition = "none";
  overlay.style.clipPath = "circle(0% at 50% 50%)";
}
