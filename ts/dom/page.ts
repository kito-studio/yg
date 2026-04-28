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
