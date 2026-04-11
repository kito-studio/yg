type ModeSwitchOptions = {
  modeSwitch: HTMLElement | null;
  editModeClass: string;
  viewModeClass: string;
  defaultEditMode?: boolean;
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
