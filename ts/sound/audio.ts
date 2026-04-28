type ToggleLoopAudioOptions = {
  audio: HTMLAudioElement;
  button: HTMLButtonElement | null;
};

const ON_LABEL = "🔊";
const OFF_LABEL = "🔇";

export function playAudio(src: string): void {
  const audio = new Audio(src);
  audio.play().catch(() => {});
}

export function setupLoopAudioToggle(options: ToggleLoopAudioOptions): void {
  const { audio, button } = options;

  // Keep the initial state muted in case autoplay is blocked.
  audio.play().catch(() => {});
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().catch(() => {});
      button.textContent = ON_LABEL;
    } else {
      audio.pause();
      button.textContent = OFF_LABEL;
    }
  });

  audio.pause();
  button.textContent = OFF_LABEL;
}
