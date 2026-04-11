type DialogTab = "basic" | "image";

type BasicImageDialogFrameOptions = {
  dialog: HTMLElement | null;
  backdrop: HTMLElement | null;
  tabBasic: HTMLElement | null;
  tabImage: HTMLElement | null;
  panelBasic: HTMLElement | null;
  panelImage: HTMLElement | null;
  cancelButton?: HTMLElement | null;
  onClose?: () => void;
};

type BasicImageDialogFrameController = {
  setTab: (tab: DialogTab) => void;
  open: () => void;
  close: () => void;
};

function setTabState(
  tabBasic: HTMLElement | null,
  tabImage: HTMLElement | null,
  panelBasic: HTMLElement | null,
  panelImage: HTMLElement | null,
  tab: DialogTab,
): void {
  if (
    !(tabBasic instanceof HTMLButtonElement) ||
    !(tabImage instanceof HTMLButtonElement) ||
    !(panelBasic instanceof HTMLElement) ||
    !(panelImage instanceof HTMLElement)
  ) {
    return;
  }

  const basicActive = tab === "basic";
  tabBasic.classList.toggle("active", basicActive);
  tabImage.classList.toggle("active", !basicActive);
  tabBasic.setAttribute("aria-selected", String(basicActive));
  tabImage.setAttribute("aria-selected", String(!basicActive));

  panelBasic.classList.toggle("active", basicActive);
  panelImage.classList.toggle("active", !basicActive);
  panelBasic.hidden = !basicActive;
  panelImage.hidden = basicActive;
  panelBasic.setAttribute("aria-hidden", String(!basicActive));
  panelImage.setAttribute("aria-hidden", String(basicActive));
}

function openDialog(
  dialog: HTMLElement | null,
  backdrop: HTMLElement | null,
): void {
  if (
    !(dialog instanceof HTMLDialogElement) ||
    !(backdrop instanceof HTMLElement)
  ) {
    return;
  }

  backdrop.hidden = false;
  if (!dialog.open) {
    dialog.showModal();
  }
}

function closeDialog(
  dialog: HTMLElement | null,
  backdrop: HTMLElement | null,
): void {
  if (
    !(dialog instanceof HTMLDialogElement) ||
    !(backdrop instanceof HTMLElement)
  ) {
    return;
  }

  backdrop.hidden = true;
  if (dialog.open) {
    dialog.close();
  }
}

export function createBasicImageDialogFrame(
  options: BasicImageDialogFrameOptions,
): BasicImageDialogFrameController {
  const {
    dialog,
    backdrop,
    tabBasic,
    tabImage,
    panelBasic,
    panelImage,
    cancelButton,
    onClose,
  } = options;

  const close = () => {
    closeDialog(dialog, backdrop);
    onClose?.();
  };

  if (tabBasic instanceof HTMLButtonElement) {
    tabBasic.addEventListener("click", () => {
      setTabState(tabBasic, tabImage, panelBasic, panelImage, "basic");
    });
  }

  if (tabImage instanceof HTMLButtonElement) {
    tabImage.addEventListener("click", () => {
      setTabState(tabBasic, tabImage, panelBasic, panelImage, "image");
    });
  }

  if (cancelButton instanceof HTMLButtonElement) {
    cancelButton.addEventListener("click", close);
  }

  if (backdrop instanceof HTMLElement) {
    backdrop.addEventListener("click", close);
  }

  return {
    setTab: (tab: DialogTab) => {
      setTabState(tabBasic, tabImage, panelBasic, panelImage, tab);
    },
    open: () => {
      openDialog(dialog, backdrop);
    },
    close,
  };
}
