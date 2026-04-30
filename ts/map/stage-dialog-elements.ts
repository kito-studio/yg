import { MAP_PAGE_ID } from "./dom";

export function getStageDialogElements() {
  // ダイアログに必要なDOM参照をまとめて取得する。
  return {
    dialog: document.getElementById(MAP_PAGE_ID.dialog),
    backdrop: document.getElementById(MAP_PAGE_ID.dialogBackdrop),
    title: document.getElementById(MAP_PAGE_ID.dialogTitle),
    tabBasic: document.getElementById(MAP_PAGE_ID.dialogTabBasic),
    tabImage: document.getElementById(MAP_PAGE_ID.dialogTabImage),
    panelBasic: document.getElementById(MAP_PAGE_ID.dialogPanelBasic),
    panelImage: document.getElementById(MAP_PAGE_ID.dialogPanelImage),
    nameInput: document.getElementById(MAP_PAGE_ID.nameInput),
    descInput: document.getElementById(MAP_PAGE_ID.descInput),
    colorInput: document.getElementById(MAP_PAGE_ID.colorInput),
    stageImageFileInput: document.getElementById(
      MAP_PAGE_ID.stageImageFileInput,
    ),
    stageImagePickButton: document.getElementById(
      MAP_PAGE_ID.stageImagePickButton,
    ),
    stageImageClearButton: document.getElementById(
      MAP_PAGE_ID.stageImageClearButton,
    ),
    stageImageSaveButton: document.getElementById(
      MAP_PAGE_ID.stageImageSaveButton,
    ),
    stageImageCurrent: document.getElementById(MAP_PAGE_ID.stageImageCurrent),
    stageImagePreview: document.getElementById(MAP_PAGE_ID.stageImagePreview),
    stageImageHueInput: document.getElementById(MAP_PAGE_ID.stageImageHueInput),
    stageImageHueRange: document.getElementById(MAP_PAGE_ID.stageImageHueRange),
    stageImageBrightnessInput: document.getElementById(
      MAP_PAGE_ID.stageImageBrightnessInput,
    ),
    stageImageBrightnessRange: document.getElementById(
      MAP_PAGE_ID.stageImageBrightnessRange,
    ),
    stageImageContrastInput: document.getElementById(
      MAP_PAGE_ID.stageImageContrastInput,
    ),
    stageImageContrastRange: document.getElementById(
      MAP_PAGE_ID.stageImageContrastRange,
    ),
    stageSpriteToggle: document.getElementById(MAP_PAGE_ID.stageSpriteToggle),
    stageSpriteMetaInfo: document.getElementById(
      MAP_PAGE_ID.stageSpriteMetaInfo,
    ),
    stageSpriteCoordGroup: document.getElementById(
      MAP_PAGE_ID.stageSpriteCoordGroup,
    ),
    stageSpriteRowInput: document.getElementById(
      MAP_PAGE_ID.stageSpriteRowInput,
    ),
    stageSpriteColInput: document.getElementById(
      MAP_PAGE_ID.stageSpriteColInput,
    ),
    mapImageFileInput: document.getElementById(MAP_PAGE_ID.mapImageFileInput),
    mapImagePickButton: document.getElementById(MAP_PAGE_ID.mapImagePickButton),
    mapImageClearButton: document.getElementById(
      MAP_PAGE_ID.mapImageClearButton,
    ),
    mapImageSaveButton: document.getElementById(MAP_PAGE_ID.mapImageSaveButton),
    mapImageCurrent: document.getElementById(MAP_PAGE_ID.mapImageCurrent),
    mapImagePreview: document.getElementById(MAP_PAGE_ID.mapImagePreview),
    mapImageHueInput: document.getElementById(MAP_PAGE_ID.mapImageHueInput),
    mapImageHueRange: document.getElementById(MAP_PAGE_ID.mapImageHueRange),
    mapImageBrightnessInput: document.getElementById(
      MAP_PAGE_ID.mapImageBrightnessInput,
    ),
    mapImageBrightnessRange: document.getElementById(
      MAP_PAGE_ID.mapImageBrightnessRange,
    ),
    mapImageContrastInput: document.getElementById(
      MAP_PAGE_ID.mapImageContrastInput,
    ),
    mapImageContrastRange: document.getElementById(
      MAP_PAGE_ID.mapImageContrastRange,
    ),
    cancelButton: document.getElementById(MAP_PAGE_ID.cancelButton),
    saveButton: document.getElementById(MAP_PAGE_ID.saveButton),
  };
}
