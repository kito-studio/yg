import { TOP_PAGE_SOUND_SOURCE } from "./constants";

export function createTopPageBgmAudio(): HTMLAudioElement {
  const audio = new Audio(TOP_PAGE_SOUND_SOURCE.bgm);
  audio.loop = true;
  return audio;
}
