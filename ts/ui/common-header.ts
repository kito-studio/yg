type ModeSwitchOptions = {
  modeSwitch: HTMLElement | null;
  editModeClass: string;
  viewModeClass: string;
  defaultEditMode?: boolean;
};

type HeaderSwitchOptions = {
  prevButton: HTMLElement | null;
  nextButton: HTMLElement | null;
  getItemIds: () => string[];
  getSelectedId: () => string;
  onSelect: (nextId: string) => Promise<void> | void;
};

type HeaderLabelItem = {
  id: string;
  label: string;
};

type HeaderLabelOptions = {
  labelElement: HTMLElement | null;
  items: HeaderLabelItem[];
  selectedId: string;
  emptyLabel: string;
};

type BackupToolbarOptions = {
  downloadButton: HTMLElement | null;
  uploadButton: HTMLElement | null;
  uploadInput: HTMLElement | null;
  settingsButton?: HTMLElement | null;
  settingsPath?: string;
  onDownload: () => Promise<void> | void;
  onRestore: (file: File) => Promise<void>;
  restoreSuccessMessage: string;
  restoreFailedFallbackMessage: string;
};

function getCycledId(ids: string[], currentId: string, delta: number): string {
  if (ids.length === 0) {
    return "";
  }

  const currentIndex = ids.findIndex((id) => id === currentId);
  const baseIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (baseIndex + delta + ids.length) % ids.length;
  return ids[nextIndex];
}

function isLocalHostName(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  );
}

export function hideElementOnLocalHost(elementId: string): void {
  if (!isLocalHostName(window.location.hostname)) {
    return;
  }

  const target = document.getElementById(elementId);
  if (!target) {
    return;
  }
  target.style.display = "none";
}

export function setupModeSwitch(options: ModeSwitchOptions): void {
  const {
    modeSwitch,
    editModeClass,
    viewModeClass,
    defaultEditMode = false,
  } = options;

  if (!(modeSwitch instanceof HTMLInputElement)) {
    return;
  }

  const applyMode = (editMode: boolean) => {
    document.body.classList.toggle(editModeClass, editMode);
    document.body.classList.toggle(viewModeClass, !editMode);
  };

  modeSwitch.checked = defaultEditMode;
  applyMode(defaultEditMode);

  modeSwitch.addEventListener("change", () => {
    applyMode(modeSwitch.checked);
  });
}

export function setupHeaderSwitch(options: HeaderSwitchOptions): void {
  const { prevButton, nextButton, getItemIds, getSelectedId, onSelect } =
    options;

  const moveBy = (delta: number) => {
    const ids = getItemIds().filter((id) => id.length > 0);
    if (ids.length === 0) {
      return;
    }

    const currentId = getSelectedId();
    const nextId = getCycledId(ids, currentId, delta);
    if (!nextId || nextId === currentId) {
      return;
    }

    void onSelect(nextId);
  };

  if (
    prevButton instanceof HTMLButtonElement ||
    prevButton instanceof HTMLElement
  ) {
    prevButton.addEventListener("click", () => {
      moveBy(-1);
    });
  }

  if (
    nextButton instanceof HTMLButtonElement ||
    nextButton instanceof HTMLElement
  ) {
    nextButton.addEventListener("click", () => {
      moveBy(1);
    });
  }
}

export function renderHeaderSelectedLabel(options: HeaderLabelOptions): void {
  const { labelElement, items, selectedId, emptyLabel } = options;
  if (!(labelElement instanceof HTMLElement)) {
    return;
  }

  const selected = items.find((item) => item.id === selectedId) || null;
  labelElement.textContent = selected?.label || emptyLabel;
}

export function setupBackupToolbar(options: BackupToolbarOptions): void {
  const {
    downloadButton,
    uploadButton,
    uploadInput,
    settingsButton,
    settingsPath,
    onDownload,
    onRestore,
    restoreSuccessMessage,
    restoreFailedFallbackMessage,
  } = options;

  if (downloadButton instanceof HTMLButtonElement) {
    downloadButton.addEventListener("click", () => {
      void onDownload();
    });
  }

  if (
    uploadButton instanceof HTMLButtonElement &&
    uploadInput instanceof HTMLInputElement
  ) {
    uploadButton.addEventListener("click", () => {
      uploadInput.click();
    });

    uploadInput.addEventListener("change", () => {
      const file = uploadInput.files?.[0];
      if (!file) {
        return;
      }

      void (async () => {
        try {
          await onRestore(file);
          window.alert(restoreSuccessMessage);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : restoreFailedFallbackMessage;
          window.alert(message);
        }
      })();

      uploadInput.value = "";
    });
  }

  if (
    settingsButton instanceof HTMLButtonElement &&
    typeof settingsPath === "string" &&
    settingsPath.length > 0
  ) {
    settingsButton.addEventListener("click", () => {
      window.location.href = settingsPath;
    });
  }
}
