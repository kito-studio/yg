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
export const TOP_PAGE_ID = {
  addButton: "addStageBtn",
  logoWrap: "logoWrap",
  modeSwitch: "modeSwitch",
  stageMap: "stageMap",
  stageMapContent: "stageMapContent",
  dbDownloadButton: "dbDownloadBtn",
  dbUploadButton: "dbUploadBtn",
  dbUploadInput: "dbUploadInput",
  dbMaintButton: "dbMaintBtn",
  selectedWorldName: "selectedWorldName",
  worldLeftButton: "prev",
  worldRightButton: "next",
  dialog: "stageSettingsDialog",
  dialogBackdrop: "stageDialogBackdrop",
  dialogTitle: "stageDialogTitle",
  dialogTabBasic: "stageDialogTabBasic",
  dialogTabImage: "stageDialogTabImage",
  dialogPanelBasic: "stageDialogPanelBasic",
  dialogPanelImage: "stageDialogPanelImage",
  progressRange: "stageProgressRange",
  progressBarFill: "stageProgressBarFill",
  progressValue: "stageProgressValue",
  nameInput: "stageNameInput",
  descInput: "stageDescInput",
  colorInput: "stageColorInput",
  stageImageFileInput: "stageImageFileInput",
  stageImagePickButton: "stageImagePickBtn",
  stageImageClearButton: "stageImageClearBtn",
  stageImageSaveButton: "stageImageSaveBtn",
  stageImageCurrent: "stageImageCurrent",
  mapImageFileInput: "mapImageFileInput",
  mapImagePickButton: "mapImagePickBtn",
  mapImageClearButton: "mapImageClearBtn",
  mapImageSaveButton: "mapImageSaveBtn",
  mapImageCurrent: "mapImageCurrent",
  cancelButton: "stageDialogCancel",
  saveButton: "stageDialogSave",
  bgmButton: "bgmBtn",
} as const;
