import { playTransientSound } from "./audio";

const TOP_PAGE_SOUND_SOURCE = {
  bgm: "./wav/gound003.wav",
  buttonClick: "./wav/hyu.wav",
} as const;

export function createTopPageBgmAudio(): HTMLAudioElement {
  const audio = new Audio(TOP_PAGE_SOUND_SOURCE.bgm);
  audio.loop = true;
  return audio;
}

export function playTopPageButtonSound(): void {
  playTransientSound(TOP_PAGE_SOUND_SOURCE.buttonClick);
}
