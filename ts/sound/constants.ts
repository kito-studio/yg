const bgmWavUrl = new URL("../../wav/gound003.wav", import.meta.url).toString();
const buttonClickWavUrl = new URL(
  "../../wav/hyu.wav",
  import.meta.url,
).toString();
const dialogOpenWavUrl = new URL(
  "../../wav/pinyu.wav",
  import.meta.url,
).toString();
const dialogCancelWavUrl = new URL(
  "../../wav/pin.wav",
  import.meta.url,
).toString();
const mapTransitionWavUrl = new URL(
  "../../wav/Bihyororon.wav",
  import.meta.url,
).toString();

export const ON_LABEL = "🔊";
export const OFF_LABEL = "🔇";
export const TOP_PAGE_SOUND_SOURCE = {
  bgm: bgmWavUrl,
  buttonClick: buttonClickWavUrl,
  dialogOpen: dialogOpenWavUrl,
  dialogCancel: dialogCancelWavUrl,
  mapTransition: mapTransitionWavUrl,
} as const;
