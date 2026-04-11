import { createBasicImageDialogFrame } from "./common-dialog";

type EntityEditValues = {
  nm: string;
  desc: string;
  progress: number;
  state?: string;
};

type EntityDialogElements = {
  dialog: HTMLElement | null;
  backdrop: HTMLElement | null;
  title: HTMLElement | null;
  nameInput: HTMLElement | null;
  descInput: HTMLElement | null;
  progressInput: HTMLElement | null;
  stateInput?: HTMLElement | null;
  saveButton: HTMLElement | null;
  cancelButton: HTMLElement | null;
};

type OpenEntityDialogOptions = {
  title: string;
  values: EntityEditValues;
  onSave: (nextValues: EntityEditValues) => Promise<void> | void;
};

type EntityEditDialogController = {
  open: (options: OpenEntityDialogOptions) => void;
  close: () => void;
};

export function createEntityEditDialog(
  elements: EntityDialogElements,
): EntityEditDialogController {
  const {
    dialog,
    backdrop,
    title,
    nameInput,
    descInput,
    progressInput,
    stateInput,
    saveButton,
    cancelButton,
  } = elements;

  let currentSaveHandler:
    | ((nextValues: EntityEditValues) => Promise<void> | void)
    | null = null;

  const frame = createBasicImageDialogFrame({
    dialog,
    backdrop,
    tabBasic: null,
    tabImage: null,
    panelBasic: null,
    panelImage: null,
    cancelButton,
  });

  if (saveButton instanceof HTMLButtonElement) {
    saveButton.addEventListener("click", () => {
      if (!currentSaveHandler) {
        frame.close();
        return;
      }

      const nextValues: EntityEditValues = {
        nm: nameInput instanceof HTMLInputElement ? nameInput.value.trim() : "",
        desc:
          descInput instanceof HTMLTextAreaElement
            ? descInput.value.trim()
            : "",
        progress: (() => {
          const raw =
            progressInput instanceof HTMLInputElement
              ? Number.parseInt(progressInput.value, 10)
              : 0;
          if (!Number.isFinite(raw)) {
            return 0;
          }
          return Math.max(0, Math.min(100, raw));
        })(),
        state:
          stateInput instanceof HTMLSelectElement
            ? stateInput.value
            : undefined,
      };

      void (async () => {
        await currentSaveHandler?.(nextValues);
        frame.close();
      })();
    });
  }

  return {
    open: (options: OpenEntityDialogOptions) => {
      currentSaveHandler = options.onSave;

      if (title instanceof HTMLElement) {
        title.textContent = options.title;
      }
      if (nameInput instanceof HTMLInputElement) {
        nameInput.value = String(options.values.nm || "");
      }
      if (descInput instanceof HTMLTextAreaElement) {
        descInput.value = String(options.values.desc || "");
      }
      if (progressInput instanceof HTMLInputElement) {
        progressInput.value = String(Number(options.values.progress || 0));
      }
      if (stateInput instanceof HTMLSelectElement) {
        stateInput.value = String(options.values.state || "todo");
      }

      frame.open();
    },
    close: () => {
      currentSaveHandler = null;
      frame.close();
    },
  };
}
