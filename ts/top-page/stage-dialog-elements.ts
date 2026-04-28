import { TOP_PAGE_ID } from "../dom/top-page";

export function getStageDialogElements() {
  // ダイアログに必要なDOM参照をまとめて取得する。
  return {
    dialog: document.getElementById(TOP_PAGE_ID.dialog),
    backdrop: document.getElementById(TOP_PAGE_ID.dialogBackdrop),
    title: document.getElementById(TOP_PAGE_ID.dialogTitle),
    tabBasic: document.getElementById(TOP_PAGE_ID.dialogTabBasic),
    tabImage: document.getElementById(TOP_PAGE_ID.dialogTabImage),
    panelBasic: document.getElementById(TOP_PAGE_ID.dialogPanelBasic),
    panelImage: document.getElementById(TOP_PAGE_ID.dialogPanelImage),
    progressRange: document.getElementById(TOP_PAGE_ID.progressRange),
    progressBarFill: document.getElementById(TOP_PAGE_ID.progressBarFill),
    progressValue: document.getElementById(TOP_PAGE_ID.progressValue),
    nameInput: document.getElementById(TOP_PAGE_ID.nameInput),
    descInput: document.getElementById(TOP_PAGE_ID.descInput),
    colorInput: document.getElementById(TOP_PAGE_ID.colorInput),
    stageImageFileInput: document.getElementById(
      TOP_PAGE_ID.stageImageFileInput,
    ),
    stageImagePickButton: document.getElementById(
      TOP_PAGE_ID.stageImagePickButton,
    ),
    stageImageClearButton: document.getElementById(
      TOP_PAGE_ID.stageImageClearButton,
    ),
    stageImageSaveButton: document.getElementById(
      TOP_PAGE_ID.stageImageSaveButton,
    ),
    stageImageCurrent: document.getElementById(TOP_PAGE_ID.stageImageCurrent),
    mapImageFileInput: document.getElementById(TOP_PAGE_ID.mapImageFileInput),
    mapImagePickButton: document.getElementById(TOP_PAGE_ID.mapImagePickButton),
    mapImageClearButton: document.getElementById(
      TOP_PAGE_ID.mapImageClearButton,
    ),
    mapImageSaveButton: document.getElementById(TOP_PAGE_ID.mapImageSaveButton),
    mapImageCurrent: document.getElementById(TOP_PAGE_ID.mapImageCurrent),
    cancelButton: document.getElementById(TOP_PAGE_ID.cancelButton),
    saveButton: document.getElementById(TOP_PAGE_ID.saveButton),
  };
}
