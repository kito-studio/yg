import { playAudio } from "./audio";
import { TOP_PAGE_SOUND_SOURCE } from "./constants";

export function createTopPageBgmAudio(): HTMLAudioElement {
  const audio = new Audio(TOP_PAGE_SOUND_SOURCE.bgm);
  audio.loop = true;
  return audio;
}

export function playTopPageButtonSound(): void {
  playAudio(TOP_PAGE_SOUND_SOURCE.buttonClick);
}
