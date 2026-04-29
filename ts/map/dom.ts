export const MAP_PAGE_ID = {
  addButton: "addStageBtn",
  addTaskButton: "addTaskBtn",
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
  stageSpriteToggle: "stageSpriteToggle",
  stageSpriteMetaInfo: "stageSpriteMetaInfo",
  stageSpriteCoordGroup: "stageSpriteCoordGroup",
  stageSpriteRowInput: "stageSpriteRowInput",
  stageSpriteColInput: "stageSpriteColInput",
  mapImageFileInput: "mapImageFileInput",
  mapImagePickButton: "mapImagePickBtn",
  mapImageClearButton: "mapImageClearBtn",
  mapImageSaveButton: "mapImageSaveBtn",
  mapImageCurrent: "mapImageCurrent",
  cancelButton: "stageDialogCancel",
  saveButton: "stageDialogSave",
  bgmButton: "bgmBtn",
} as const;

export const MAPPAGE_CLASS = {
  worldActive: "world-active",
  logoExiting: "logo-exiting",
  editMode: "edit-mode",
  viewMode: "view-mode",
  stageObject: "stage-object",
  taskObject: "task-object",
  stageObjectSideImage: "stage-object-side-image",
  stageObjectSideImageImg: "stage-object-side-image-img",
  stageObjectSideImageSprite: "stage-object-side-image-sprite",
  spriteToneRed: "sprite-tone-red",
  spriteToneDark: "sprite-tone-dark",
  stageObjectHp: "stage-object-hp",
  stageObjectHpFill: "stage-object-hp-fill",
  stageDialogShell: "stage-dialog-shell",
} as const;

export const MAPPAGE_SELECTOR = {
  stageObject: `.${MAPPAGE_CLASS.stageObject}`,
  taskObject: `.${MAPPAGE_CLASS.taskObject}`,
  stageObjectHpFill: `.${MAPPAGE_CLASS.stageObjectHpFill}`,
  stageObjectSideImage: `.${MAPPAGE_CLASS.stageObjectSideImage}`,
  stageObjectSideImageImg: `.${MAPPAGE_CLASS.stageObjectSideImageImg}`,
  stageDialogShell: `.${MAPPAGE_CLASS.stageDialogShell}`,
} as const;

export type MapPageElements = {
  addButton: HTMLButtonElement | null;
  addTaskButton: HTMLButtonElement | null;
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
export function getMapPageElements(): MapPageElements {
  return {
    addButton: document.getElementById(
      MAP_PAGE_ID.addButton,
    ) as HTMLButtonElement | null,
    addTaskButton: document.getElementById(
      MAP_PAGE_ID.addTaskButton,
    ) as HTMLButtonElement | null,
    logoWrap: document.getElementById(MAP_PAGE_ID.logoWrap),
    modeSwitch: document.getElementById(
      MAP_PAGE_ID.modeSwitch,
    ) as HTMLInputElement | null,
    stageMap: document.getElementById(MAP_PAGE_ID.stageMap),
    stageMapContent: document.getElementById(MAP_PAGE_ID.stageMapContent),
    dbDownloadButton: document.getElementById(
      MAP_PAGE_ID.dbDownloadButton,
    ) as HTMLButtonElement | null,
    dbUploadButton: document.getElementById(
      MAP_PAGE_ID.dbUploadButton,
    ) as HTMLButtonElement | null,
    dbUploadInput: document.getElementById(
      MAP_PAGE_ID.dbUploadInput,
    ) as HTMLInputElement | null,
    dbMaintButton: document.getElementById(
      MAP_PAGE_ID.dbMaintButton,
    ) as HTMLButtonElement | null,
    selectedWorldName: document.getElementById(MAP_PAGE_ID.selectedWorldName),
    worldLeftButton: document.getElementById(MAP_PAGE_ID.worldLeftButton),
    worldRightButton: document.getElementById(MAP_PAGE_ID.worldRightButton),
    bgmButton: document.getElementById(
      MAP_PAGE_ID.bgmButton,
    ) as HTMLButtonElement | null,
  };
}
