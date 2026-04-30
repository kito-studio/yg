import { TASK_PROGRESS_DIALOG_ID } from "./dom";

export function getTaskProgressDialogElements() {
  return {
    dialog: document.getElementById(TASK_PROGRESS_DIALOG_ID.dialog),
    backdrop: document.getElementById(TASK_PROGRESS_DIALOG_ID.dialogBackdrop),
    title: document.getElementById(TASK_PROGRESS_DIALOG_ID.title),
    imagePreview: document.getElementById(TASK_PROGRESS_DIALOG_ID.imagePreview),
    nameText: document.getElementById(TASK_PROGRESS_DIALOG_ID.nameText),
    descText: document.getElementById(TASK_PROGRESS_DIALOG_ID.descText),
    progressInput: document.getElementById(
      TASK_PROGRESS_DIALOG_ID.progressInput,
    ),
    progressRange: document.getElementById(
      TASK_PROGRESS_DIALOG_ID.progressRange,
    ),
    cancelButton: document.getElementById(TASK_PROGRESS_DIALOG_ID.cancelButton),
    saveButton: document.getElementById(TASK_PROGRESS_DIALOG_ID.saveButton),
  };
}
