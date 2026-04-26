type ToggleLoopAudioOptions = {
  audio: HTMLAudioElement;
  button: HTMLButtonElement | null;
  onLabel: string;
  offLabel: string;
};

export function playTransientSound(src: string): void {
  const audio = new Audio(src);
  audio.play().catch(() => {});
}

export function setupLoopAudioToggle(options: ToggleLoopAudioOptions): void {
  const { audio, button, onLabel, offLabel } = options;

  // ブラウザの自動再生制約を考慮し、初期状態はミュート表示に寄せる。
  audio.play().catch(() => {});
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().catch(() => {});
      button.textContent = onLabel;
    } else {
      audio.pause();
      button.textContent = offLabel;
    }
  });

  audio.pause();
  button.textContent = offLabel;
}
