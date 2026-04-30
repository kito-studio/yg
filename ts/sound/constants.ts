import { resolveStaticAssetUrl } from "../utils/asset-url";

const bgmWavUrl = resolveStaticAssetUrl("/wav/gound003.wav");
const buttonClickWavUrl = resolveStaticAssetUrl("/wav/hyu.wav");
const dialogOpenWavUrl = resolveStaticAssetUrl("/wav/pinyu.wav");
const dialogCancelWavUrl = resolveStaticAssetUrl("/wav/pin.wav");
const mapTransitionWavUrl = resolveStaticAssetUrl("/wav/Bihyororon.wav");

export const ON_LABEL = "🔊";
export const OFF_LABEL = "🔇";
export const TOP_PAGE_SOUND_SOURCE = {
  bgm: bgmWavUrl,
  buttonClick: buttonClickWavUrl,
  dialogOpen: dialogOpenWavUrl,
  dialogCancel: dialogCancelWavUrl,
  mapTransition: mapTransitionWavUrl,
} as const;
