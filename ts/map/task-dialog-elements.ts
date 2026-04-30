import { TASK_DIALOG_ID } from "./dom";

export function getTaskDialogElements() {
  return {
    dialog: document.getElementById(TASK_DIALOG_ID.dialog),
    backdrop: document.getElementById(TASK_DIALOG_ID.dialogBackdrop),
    title: document.getElementById(TASK_DIALOG_ID.dialogTitle),
    tabBasic: document.getElementById(TASK_DIALOG_ID.dialogTabBasic),
    tabImage: document.getElementById(TASK_DIALOG_ID.dialogTabImage),
    panelBasic: document.getElementById(TASK_DIALOG_ID.dialogPanelBasic),
    panelImage: document.getElementById(TASK_DIALOG_ID.dialogPanelImage),
    progressRange: document.getElementById(TASK_DIALOG_ID.progressRange),
    progressBarFill: document.getElementById(TASK_DIALOG_ID.progressBarFill),
    progressValue: document.getElementById(TASK_DIALOG_ID.progressValue),
    nameInput: document.getElementById(TASK_DIALOG_ID.nameInput),
    descInput: document.getElementById(TASK_DIALOG_ID.descInput),
    colorInput: document.getElementById(TASK_DIALOG_ID.colorInput),
    taskImageFileInput: document.getElementById(
      TASK_DIALOG_ID.taskImageFileInput,
    ),
    taskImagePickButton: document.getElementById(
      TASK_DIALOG_ID.taskImagePickButton,
    ),
    taskImageClearButton: document.getElementById(
      TASK_DIALOG_ID.taskImageClearButton,
    ),
    taskImageSaveButton: document.getElementById(
      TASK_DIALOG_ID.taskImageSaveButton,
    ),
    taskImageCurrent: document.getElementById(TASK_DIALOG_ID.taskImageCurrent),
    taskImagePreview: document.getElementById(TASK_DIALOG_ID.taskImagePreview),
    taskImageHueInput: document.getElementById(
      TASK_DIALOG_ID.taskImageHueInput,
    ),
    taskImageHueRange: document.getElementById(
      TASK_DIALOG_ID.taskImageHueRange,
    ),
    taskImageBrightnessInput: document.getElementById(
      TASK_DIALOG_ID.taskImageBrightnessInput,
    ),
    taskImageBrightnessRange: document.getElementById(
      TASK_DIALOG_ID.taskImageBrightnessRange,
    ),
    taskImageContrastInput: document.getElementById(
      TASK_DIALOG_ID.taskImageContrastInput,
    ),
    taskImageContrastRange: document.getElementById(
      TASK_DIALOG_ID.taskImageContrastRange,
    ),
    taskSpriteToggle: document.getElementById(TASK_DIALOG_ID.taskSpriteToggle),
    taskSpriteMetaInfo: document.getElementById(
      TASK_DIALOG_ID.taskSpriteMetaInfo,
    ),
    taskSpriteCoordGroup: document.getElementById(
      TASK_DIALOG_ID.taskSpriteCoordGroup,
    ),
    taskSpriteRowInput: document.getElementById(
      TASK_DIALOG_ID.taskSpriteRowInput,
    ),
    taskSpriteColInput: document.getElementById(
      TASK_DIALOG_ID.taskSpriteColInput,
    ),
    cancelButton: document.getElementById(TASK_DIALOG_ID.cancelButton),
    saveButton: document.getElementById(TASK_DIALOG_ID.saveButton),
  };
}
