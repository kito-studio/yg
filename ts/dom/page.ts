export const PAGE_CLASS = {
  worldActive: "world-active",
  logoExiting: "logo-exiting",
  editMode: "edit-mode",
  viewMode: "view-mode",
  stageObject: "stage-object",
  stageObjectSideImage: "stage-object-side-image",
  stageObjectSideImageImg: "stage-object-side-image-img",
  stageObjectHp: "stage-object-hp",
  stageObjectHpFill: "stage-object-hp-fill",
  stageDialogShell: "stage-dialog-shell",
} as const;

export const PAGE_SELECTOR = {
  stageObject: `.${PAGE_CLASS.stageObject}`,
  stageObjectHpFill: `.${PAGE_CLASS.stageObjectHpFill}`,
  stageObjectSideImage: `.${PAGE_CLASS.stageObjectSideImage}`,
  stageObjectSideImageImg: `.${PAGE_CLASS.stageObjectSideImageImg}`,
  stageDialogShell: `.${PAGE_CLASS.stageDialogShell}`,
} as const;
export type TopPageElements = {
  addButton: HTMLButtonElement | null;
  logoWrap: HTMLElement | null;
  modeSwitch: HTMLInputElement | null;
  stageMap: HTMLElement | null;
  stageMapContent: HTMLElement | null;
  dbDownloadButton: HTMLButtonElement | null;
  dbUploadButton: HTMLButtonElement | null;
  dbUploadInput: HTMLInputElement | null;
  dbMaintButton: HTMLButtonElement | null;
  selectedWorldName: HTMLElement | null;
  worldLeftButton: HTMLElement | null;
  worldRightButton: HTMLElement | null;
  bgmButton: HTMLButtonElement | null;
};
