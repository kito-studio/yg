import { WORLD_DIALOG_ID } from "./dom";

export function getWorldDialogElements() {
  return {
    dialog: document.getElementById(WORLD_DIALOG_ID.dialog),
    backdrop: document.getElementById(WORLD_DIALOG_ID.dialogBackdrop),
    title: document.getElementById(WORLD_DIALOG_ID.dialogTitle),
    tabBasic: document.getElementById(WORLD_DIALOG_ID.dialogTabBasic),
    tabImage: document.getElementById(WORLD_DIALOG_ID.dialogTabImage),
    panelBasic: document.getElementById(WORLD_DIALOG_ID.dialogPanelBasic),
    panelImage: document.getElementById(WORLD_DIALOG_ID.dialogPanelImage),
    progressRange: document.getElementById(WORLD_DIALOG_ID.progressRange),
    progressBarFill: document.getElementById(WORLD_DIALOG_ID.progressBarFill),
    progressValue: document.getElementById(WORLD_DIALOG_ID.progressValue),
    nameInput: document.getElementById(WORLD_DIALOG_ID.nameInput),
    descInput: document.getElementById(WORLD_DIALOG_ID.descInput),
    colorInput: document.getElementById(WORLD_DIALOG_ID.colorInput),
    mapImageFileInput: document.getElementById(
      WORLD_DIALOG_ID.mapImageFileInput,
    ),
    mapImagePickButton: document.getElementById(
      WORLD_DIALOG_ID.mapImagePickButton,
    ),
    mapImageClearButton: document.getElementById(
      WORLD_DIALOG_ID.mapImageClearButton,
    ),
    mapImageSaveButton: document.getElementById(
      WORLD_DIALOG_ID.mapImageSaveButton,
    ),
    mapImageCurrent: document.getElementById(WORLD_DIALOG_ID.mapImageCurrent),
    mapImagePreview: document.getElementById(WORLD_DIALOG_ID.mapImagePreview),
    mapImageHueInput: document.getElementById(WORLD_DIALOG_ID.mapImageHueInput),
    mapImageHueRange: document.getElementById(WORLD_DIALOG_ID.mapImageHueRange),
    mapImageBrightnessInput: document.getElementById(
      WORLD_DIALOG_ID.mapImageBrightnessInput,
    ),
    mapImageBrightnessRange: document.getElementById(
      WORLD_DIALOG_ID.mapImageBrightnessRange,
    ),
    mapImageContrastInput: document.getElementById(
      WORLD_DIALOG_ID.mapImageContrastInput,
    ),
    mapImageContrastRange: document.getElementById(
      WORLD_DIALOG_ID.mapImageContrastRange,
    ),
    cancelButton: document.getElementById(WORLD_DIALOG_ID.cancelButton),
    saveButton: document.getElementById(WORLD_DIALOG_ID.saveButton),
  };
}
