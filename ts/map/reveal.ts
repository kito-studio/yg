import { LOGO_DISMISS_TIMEOUT_MS, LOGO_FADE_DURATION_MS } from "./constants";
import { MAPPAGE_CLASS } from "./dom";

type RevealWorldOptions = {
  logoElement: HTMLElement | null;
  skipIntro: boolean;
  dismissTimeoutMs: number;
  fadeDurationMs: number;
  exitingClass: string;
  activeClass: string;
};

type WaitForMapRevealOptions = {
  stageMap: HTMLElement | null;
  activeClass: string;
  timeoutMs?: number;
};

export function shouldSkipIntro(referrer: string, hostname: string): boolean {
  return !!(referrer && referrer.includes(hostname));
}

export async function intro(elements: {
  logoWrap: HTMLElement | null;
}): Promise<void> {
  // イントロ演出とマップ表示待機を分離し、ステージ描画がCSS遷移と競合しないようにする。
  await revealWorld({
    logoElement: elements.logoWrap,
    skipIntro: shouldSkipIntro(document.referrer, window.location.hostname),
    dismissTimeoutMs: LOGO_DISMISS_TIMEOUT_MS,
    fadeDurationMs: LOGO_FADE_DURATION_MS,
    exitingClass: MAPPAGE_CLASS.logoExiting,
    activeClass: MAPPAGE_CLASS.worldActive,
  });
}

export async function revealWorld(options: RevealWorldOptions): Promise<void> {
  const {
    logoElement,
    skipIntro,
    dismissTimeoutMs,
    fadeDurationMs,
    exitingClass,
    activeClass,
  } = options;

  if (!(logoElement instanceof HTMLElement)) {
    // ロゴ要素が無い構成でも表示状態だけは成立させる。
    document.body.classList.add(activeClass);
    return;
  }

  if (skipIntro) {
    // 画面遷移直後などはイントロを省略して即時表示する。
    logoElement.remove();
    document.body.classList.add(activeClass);
    return;
  }

  await waitForLogoDismiss({
    logoElement,
    dismissTimeoutMs,
    fadeDurationMs,
    exitingClass,
  });
  document.body.classList.add(activeClass);
}

export async function waitForMapRevealComplete(
  options: WaitForMapRevealOptions,
): Promise<void> {
  const { stageMap, activeClass, timeoutMs = 980 } = options;
  if (!(stageMap instanceof HTMLElement)) {
    return;
  }
  if (!document.body.classList.contains(activeClass)) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;

    const done = () => {
      if (settled) {
        return;
      }
      settled = true;
      stageMap.removeEventListener("transitionend", onTransitionEnd);
      resolve();
    };

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === stageMap && event.propertyName === "opacity") {
        done();
      }
    };

    stageMap.addEventListener("transitionend", onTransitionEnd, {
      once: true,
    });

    // transitionend が拾えないケース向けにタイムアウトで収束させる。
    window.setTimeout(done, timeoutMs);
  });
}

async function waitForLogoDismiss(options: {
  logoElement: HTMLElement;
  dismissTimeoutMs: number;
  fadeDurationMs: number;
  exitingClass: string;
}): Promise<void> {
  const { logoElement, dismissTimeoutMs, fadeDurationMs, exitingClass } =
    options;

  await new Promise<void>((resolve) => {
    let settled = false;
    const timeoutId = window.setTimeout(startDismiss, dismissTimeoutMs);

    const onKeyDown = () => {
      startDismiss();
    };

    const onMouseDown = () => {
      startDismiss();
    };

    function cleanupListeners(): void {
      window.clearTimeout(timeoutId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    }

    function finish(): void {
      if (settled) {
        return;
      }
      settled = true;
      logoElement.removeEventListener("transitionend", onTransitionEnd);
      cleanupListeners();
      resolve();
    }

    function onTransitionEnd(event: TransitionEvent): void {
      if (event.target === logoElement && event.propertyName === "opacity") {
        finish();
      }
    }

    function startDismiss(): void {
      if (settled) {
        return;
      }
      cleanupListeners();
      document.body.classList.add(exitingClass);
      logoElement.addEventListener("transitionend", onTransitionEnd, {
        once: true,
      });
      window.setTimeout(finish, fadeDurationMs + 120);
    }

    window.addEventListener("keydown", onKeyDown, { once: true });
    window.addEventListener("mousedown", onMouseDown, { once: true });
  });
}
