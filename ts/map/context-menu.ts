import { t } from "../i18n";
import {
  buildStageId,
  deleteStage,
  StageRecord,
  upsertStage,
} from "../obj/stage";
import { buildTaskId, deleteTask, TaskRecord, upsertTask } from "../obj/task";
import { MapPageContext } from "./constants";

export const CONTEXT_MENU_ID = {
  menu: "mapContextMenu",
  duplicate: "ctxMenuDuplicate",
  duplicateN: "ctxMenuDuplicateN",
  moveOut: "ctxMenuMoveOut",
  delete: "ctxMenuDelete",
  confirmBackdrop: "ctxConfirmBackdrop",
  confirmDialog: "ctxConfirmDialog",
  confirmMessage: "ctxConfirmMessage",
  confirmCancel: "ctxConfirmCancel",
  confirmOk: "ctxConfirmOk",
} as const;

export type ContextMenuTarget =
  | { type: "stage"; stgId: string }
  | { type: "task"; tkId: string };

export type ContextMenuController = {
  bindEvents: () => void;
  open: (target: ContextMenuTarget, x: number, y: number) => void;
  close: () => void;
};

type ContextMenuOptions = {
  getContext: () => MapPageContext | null;
  onAfterChange: () => Promise<void>;
};

export function createContextMenuController(
  options: ContextMenuOptions,
): ContextMenuController {
  const { getContext, onAfterChange } = options;

  let currentTarget: ContextMenuTarget | null = null;

  function getMenuEl(): HTMLElement | null {
    return document.getElementById(CONTEXT_MENU_ID.menu);
  }

  function open(target: ContextMenuTarget, x: number, y: number): void {
    currentTarget = target;
    const menu = getMenuEl();
    if (!(menu instanceof HTMLElement)) {
      return;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.hidden = false;

    // 画面端からはみ出す場合に位置を補正する
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = `${y - rect.height}px`;
      }
    });
  }

  function close(): void {
    currentTarget = null;
    const menu = getMenuEl();
    if (menu instanceof HTMLElement) {
      menu.hidden = true;
    }
  }

  function openConfirm(message: string, onOk: () => Promise<void>): void {
    const backdrop = document.getElementById(CONTEXT_MENU_ID.confirmBackdrop);
    const dialog = document.getElementById(
      CONTEXT_MENU_ID.confirmDialog,
    ) as HTMLDialogElement | null;
    const msgEl = document.getElementById(CONTEXT_MENU_ID.confirmMessage);

    if (!dialog || !msgEl || !backdrop) {
      return;
    }

    msgEl.textContent = message;
    backdrop.hidden = false;
    dialog.showModal();

    // cloneNode でイベントを毎回新規登録する（二重登録防止）
    const okSrc = document.getElementById(CONTEXT_MENU_ID.confirmOk);
    const cancelSrc = document.getElementById(CONTEXT_MENU_ID.confirmCancel);

    if (okSrc?.parentNode) {
      const okClone = okSrc.cloneNode(true) as HTMLElement;
      okSrc.replaceWith(okClone);
      okClone.addEventListener(
        "click",
        () => {
          closeConfirm();
          void onOk();
        },
        { once: true },
      );
    }

    if (cancelSrc?.parentNode) {
      const cancelClone = cancelSrc.cloneNode(true) as HTMLElement;
      cancelSrc.replaceWith(cancelClone);
      cancelClone.addEventListener("click", closeConfirm, { once: true });
    }
  }

  function closeConfirm(): void {
    const dialog = document.getElementById(
      CONTEXT_MENU_ID.confirmDialog,
    ) as HTMLDialogElement | null;
    const backdrop = document.getElementById(CONTEXT_MENU_ID.confirmBackdrop);

    if (dialog instanceof HTMLDialogElement && dialog.open) {
      dialog.close();
    }
    if (backdrop instanceof HTMLElement) {
      backdrop.hidden = true;
    }
  }

  async function duplicateStage(stgId: string): Promise<void> {
    const cntx = getContext();
    if (!cntx) {
      return;
    }

    const source = cntx.stages.find((s) => s.stgId === stgId);
    if (!source) {
      return;
    }

    // 旧ID → 新IDのマップ（子ステージの parentStgId 書き換えに使用）
    const idMap = new Map<string, string>();

    async function copyRecursive(
      stage: StageRecord,
      newParentId: string | null,
    ): Promise<void> {
      const newId = buildStageId();
      idMap.set(stage.stgId, newId);

      const now = Date.now();
      const copy: StageRecord = {
        ...stage,
        stgId: newId,
        parentStgId: newParentId,
        nm: stage.nm + "2",
        x: stage.x + 20,
        y: stage.y + 20,
        t_c: now,
        t_u: now,
      };
      await upsertStage(copy);

      const children = cntx.stages.filter((s) => s.parentStgId === stage.stgId);
      for (const child of children) {
        await copyRecursive(child, newId);
      }
    }

    await copyRecursive(source, source.parentStgId);

    // ステージに紐づくタスクをコピー
    const newStgId = idMap.get(stgId) ?? "";
    const sourceTasks = cntx.tasks.filter((tk) => tk.stgId === stgId);
    for (const task of sourceTasks) {
      const now = Date.now();
      const copyTask: TaskRecord = {
        ...task,
        tkId: buildTaskId(),
        stgId: newStgId,
        nm: task.nm + "2",
        x: task.x + 20,
        y: task.y + 20,
        t_c: now,
        t_u: now,
      };
      await upsertTask(copyTask);
    }

    await onAfterChange();
  }

  async function duplicateTask(tkId: string): Promise<void> {
    const cntx = getContext();
    if (!cntx) {
      return;
    }

    const source = cntx.tasks.find((tk) => tk.tkId === tkId);
    if (!source) {
      return;
    }

    const now = Date.now();
    const copy: TaskRecord = {
      ...source,
      tkId: buildTaskId(),
      nm: source.nm + "2",
      x: source.x + 20,
      y: source.y + 20,
      t_c: now,
      t_u: now,
    };
    await upsertTask(copy);
    await onAfterChange();
  }

  async function deleteStageWithSubtree(stgId: string): Promise<void> {
    const cntx = getContext();
    if (!cntx) {
      return;
    }

    // BFS で削除対象を収集
    const toDelete: string[] = [];
    const queue = [stgId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      toDelete.push(id);
      const children = cntx.stages.filter((s) => s.parentStgId === id);
      queue.push(...children.map((c) => c.stgId));
    }

    for (const id of toDelete) {
      await deleteStage(id);
      const tasks = cntx.tasks.filter((tk) => tk.stgId === id);
      for (const task of tasks) {
        await deleteTask(task.tkId);
      }
    }

    await onAfterChange();
  }

  async function deleteTaskById(tkId: string): Promise<void> {
    await deleteTask(tkId);
    await onAfterChange();
  }

  function onDuplicate(): void {
    const target = currentTarget;
    close();
    if (!target) {
      return;
    }

    if (target.type === "stage") {
      void duplicateStage(target.stgId);
    } else {
      void duplicateTask(target.tkId);
    }
  }

  function onDelete(): void {
    const target = currentTarget;
    close();
    if (!target) {
      return;
    }

    const cntx = getContext();
    let message = "";

    if (target.type === "stage") {
      const stage = cntx?.stages.find((s) => s.stgId === target.stgId);
      const nm = stage?.nm || target.stgId;
      message = t("ctx_confirm_delete_stage", { nm });
    } else {
      const task = cntx?.tasks.find((tk) => tk.tkId === target.tkId);
      const nm = task?.nm || target.tkId;
      message = t("ctx_confirm_delete_task", { nm });
    }

    openConfirm(message, async () => {
      if (target.type === "stage") {
        await deleteStageWithSubtree(target.stgId);
      } else {
        await deleteTaskById(target.tkId);
      }
    });
  }

  function bindEvents(): void {
    // メニュー外クリックで閉じる
    document.addEventListener("click", (e) => {
      const menu = getMenuEl();
      if (menu instanceof HTMLElement && !menu.hidden) {
        if (!menu.contains(e.target as Node)) {
          close();
        }
      }
    });

    // Escape で閉じる
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        close();
      }
    });

    document
      .getElementById(CONTEXT_MENU_ID.duplicate)
      ?.addEventListener("click", onDuplicate);

    document
      .getElementById(CONTEXT_MENU_ID.delete)
      ?.addEventListener("click", onDelete);
  }

  return { bindEvents, open, close };
}
