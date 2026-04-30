import { t } from "../i18n";

export type WeightDialogItem = {
  type: "stage" | "task";
  id: string;
  label: string;
  progress: number;
  weight: number;
};

type WeightDialogElements = {
  dialog: HTMLElement | null;
  backdrop: HTMLElement | null;
  title: HTMLElement | null;
  summary: HTMLElement | null;
  tableBody: HTMLElement | null;
  totalWeightValue: HTMLElement | null;
  cancelButton: HTMLElement | null;
  saveButton: HTMLElement | null;
};

type WeightDialogControllerOptions = {
  elements: WeightDialogElements;
  resolveItems: () => WeightDialogItem[];
  saveWeights: (
    next: Array<{ type: "stage" | "task"; id: string; weight: number }>,
  ) => Promise<void>;
};

export type WeightDialogController = {
  bindEvents: () => void;
  open: () => void;
  close: () => void;
};

function clampWeightInt(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(100, Math.round(value)));
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

export function createWeightDialogController(
  options: WeightDialogControllerOptions,
): WeightDialogController {
  const { elements, resolveItems, saveWeights } = options;
  const {
    dialog,
    backdrop,
    summary,
    tableBody,
    totalWeightValue,
    cancelButton,
    saveButton,
  } = elements;

  function updateWeightTotal(): void {
    if (
      !(tableBody instanceof HTMLElement) ||
      !(totalWeightValue instanceof HTMLElement)
    ) {
      return;
    }
    const inputs = Array.from(
      tableBody.querySelectorAll<HTMLInputElement>(".weight-row-input"),
    );
    const total = inputs.reduce((sum, input) => {
      return sum + clampWeightInt(Number.parseFloat(input.value));
    }, 0);
    totalWeightValue.textContent = String(total);
  }

  function close(): void {
    closeDialog(dialog, backdrop);
  }

  async function onSave(): Promise<void> {
    if (!(tableBody instanceof HTMLElement)) {
      close();
      return;
    }

    const rows = Array.from(
      tableBody.querySelectorAll<HTMLElement>(".weight-row"),
    );
    const payload = rows
      .map((row) => {
        const typeText = String(row.dataset.itemType || "").trim();
        const id = String(row.dataset.itemId || "").trim();
        const input = row.querySelector<HTMLInputElement>(".weight-row-input");
        if (!id || !(typeText === "stage" || typeText === "task") || !input) {
          return null;
        }
        return {
          type: typeText,
          id,
          weight: clampWeightInt(Number.parseFloat(input.value)),
        };
      })
      .filter(
        (
          item,
        ): item is { type: "stage" | "task"; id: string; weight: number } =>
          !!item,
      );

    await saveWeights(payload);
    close();
  }

  function bindEvents(): void {
    if (cancelButton instanceof HTMLButtonElement) {
      cancelButton.addEventListener("click", close);
    }

    if (backdrop instanceof HTMLElement) {
      backdrop.addEventListener("click", close);
    }

    if (tableBody instanceof HTMLElement) {
      tableBody.addEventListener("input", (event) => {
        if (!(event.target instanceof HTMLInputElement)) {
          return;
        }
        if (!event.target.classList.contains("weight-row-input")) {
          return;
        }
        updateWeightTotal();
      });
    }

    if (saveButton instanceof HTMLButtonElement) {
      saveButton.addEventListener("click", () => {
        void onSave();
      });
    }
  }

  function open(): void {
    if (!(tableBody instanceof HTMLElement)) {
      return;
    }

    const items = resolveItems();
    if (summary instanceof HTMLElement) {
      summary.textContent = t("weight_dialog_sub");
    }

    tableBody.innerHTML = "";
    for (const item of items) {
      const row = document.createElement("tr");
      row.className = "weight-row";
      row.dataset.itemType = item.type;
      row.dataset.itemId = item.id;

      const typeCell = document.createElement("td");
      typeCell.textContent = item.type === "stage" ? "STAGE" : "TASK";

      const labelCell = document.createElement("td");
      labelCell.textContent = item.label || "-";

      const progressCell = document.createElement("td");
      progressCell.textContent = `${Math.max(0, Math.min(100, Math.round(item.progress)))}%`;

      const weightCell = document.createElement("td");
      const weightInput = document.createElement("input");
      weightInput.className = "weight-row-input";
      weightInput.type = "number";
      weightInput.min = "1";
      weightInput.max = "100";
      weightInput.step = "1";
      weightInput.value = String(clampWeightInt(item.weight));
      weightCell.append(weightInput);

      row.append(typeCell, labelCell, progressCell, weightCell);
      tableBody.append(row);
    }

    updateWeightTotal();
    openDialog(dialog, backdrop);
  }

  return {
    bindEvents,
    open,
    close,
  };
}
