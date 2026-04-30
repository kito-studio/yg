import { WEIGHT_DIALOG_ID } from "./dom";

export function getWeightDialogElements() {
  return {
    dialog: document.getElementById(WEIGHT_DIALOG_ID.dialog),
    backdrop: document.getElementById(WEIGHT_DIALOG_ID.dialogBackdrop),
    title: document.getElementById(WEIGHT_DIALOG_ID.title),
    summary: document.getElementById(WEIGHT_DIALOG_ID.summary),
    tableBody: document.getElementById(WEIGHT_DIALOG_ID.tableBody),
    totalWeightValue: document.getElementById(
      WEIGHT_DIALOG_ID.totalWeightValue,
    ),
    cancelButton: document.getElementById(WEIGHT_DIALOG_ID.cancelButton),
    saveButton: document.getElementById(WEIGHT_DIALOG_ID.saveButton),
  };
}
