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

  // Keep the initial state muted in case autoplay is blocked.
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
