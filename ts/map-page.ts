import {
  fetchAllRows,
  getAppStateText,
  putRow,
  setAppStateText,
} from "./data/yg-idb";
import { downloadYGBackupJson, restoreYGBackupFromFile } from "./db-backup";
import { applyI18n, t } from "./i18n";
import { ensureYGDatabase } from "./init-db";
import { getCycledId, resolveSelectedId } from "./state/selection";
import { setupBackupToolbar, setupModeSwitch } from "./ui/common-header";
import { createEntityEditDialog } from "./ui/entity-edit-dialog";

type MapRecord = {
  mpId: string;
  stgId: string;
  ord: number;
  nm: string;
  desc?: string;
};

type TaskRecord = {
  tkId: string;
  mpId: string;
  ord: number;
  nm: string;
  desc?: string;
  progress?: number;
  state?: string;
  t_c: number;
  t_u: number;
};

const modeSwitch = document.getElementById("modeSwitch");
const addTaskBtn = document.getElementById("addTaskBtn");
const selectedMapBox = document.getElementById("selectedMapBox");
const taskList = document.getElementById("taskList");
const prevMapBtn = document.getElementById("prevMapBtn");
const nextMapBtn = document.getElementById("nextMapBtn");
const backToStageLink = document.getElementById("backToStageLink");

const dbDownloadBtn = document.getElementById("dbDownloadBtn");
const dbUploadBtn = document.getElementById("dbUploadBtn");
const dbUploadInput = document.getElementById("dbUploadInput");
const dbMaintBtn = document.getElementById("dbMaintBtn");

const dialog = document.getElementById("entityDialog");
const dialogBackdrop = document.getElementById("entityDialogBackdrop");
const dialogTitle = document.getElementById("entityDialogTitle");
const nameInput = document.getElementById("entityNameInput");
const descInput = document.getElementById("entityDescInput");
const progressInput = document.getElementById("entityProgressInput");
const stateInput = document.getElementById("entityStateInput");
const saveButton = document.getElementById("entityDialogSave");
const cancelButton = document.getElementById("entityDialogCancel");

let maps: MapRecord[] = [];
let tasks: TaskRecord[] = [];
let selectedMapId = "";
let selectedStageId = "";
const entityDialog = createEntityEditDialog({
  dialog,
  backdrop: dialogBackdrop,
  title: dialogTitle,
  nameInput,
  descInput,
  progressInput,
  stateInput,
  saveButton,
  cancelButton,
});

void initMapPage();

async function initMapPage(): Promise<void> {
  applyI18n(document);
  await ensureYGDatabase();

  setupModeSwitch({
    modeSwitch,
    editModeClass: "edit-mode",
    viewModeClass: "view-mode",
    defaultEditMode: false,
  });

  setupBackupToolbar({
    downloadButton: dbDownloadBtn,
    uploadButton: dbUploadBtn,
    uploadInput: dbUploadInput,
    settingsButton: dbMaintBtn,
    settingsPath: "./settings.html",
    onDownload: async () => {
      await downloadYGBackupJson();
    },
    onRestore: async (file: File) => {
      await restoreYGBackupFromFile(file);
      await reload();
    },
    restoreSuccessMessage: t("restore_success"),
    restoreFailedFallbackMessage: t("restore_failed"),
  });

  bindEvents();
  await reload();
}

function bindEvents(): void {
  if (addTaskBtn instanceof HTMLButtonElement) {
    addTaskBtn.addEventListener("click", () => {
      if (!document.body.classList.contains("edit-mode")) {
        return;
      }
      void addTask();
    });
  }

  if (prevMapBtn instanceof HTMLButtonElement) {
    prevMapBtn.addEventListener("click", () => {
      moveMapSelection(-1);
    });
  }

  if (nextMapBtn instanceof HTMLButtonElement) {
    nextMapBtn.addEventListener("click", () => {
      moveMapSelection(1);
    });
  }
}

async function reload(): Promise<void> {
  const allMaps = ((await fetchAllRows("maps")) as MapRecord[])
    .filter((row) => typeof row?.mpId === "string")
    .sort((a, b) => Number(a.ord || 0) - Number(b.ord || 0));

  if (allMaps.length === 0) {
    selectedMapId = "";
    selectedStageId = "";
    renderSelectedMap();
    renderTaskList();
    return;
  }

  const query = new URLSearchParams(window.location.search);
  const mpId = query.get("mpId");
  const savedMapId = await getAppStateText("maps");
  const mapIds = allMaps.map((row) => String(row.mpId || "")).filter(Boolean);

  selectedMapId = resolveSelectedId({
    ids: mapIds,
    preferredIds: [mpId, savedMapId, selectedMapId],
  });
  await setAppStateText("maps", selectedMapId);

  const selectedMap =
    allMaps.find((m) => m.mpId === selectedMapId) || allMaps[0];
  selectedStageId = String(selectedMap?.stgId || "");

  maps = allMaps.filter((m) => String(m.stgId || "") === selectedStageId);
  tasks = ((await fetchAllRows("tasks")) as TaskRecord[])
    .filter((row) => String(row?.mpId || "") === selectedMapId)
    .sort((a, b) => Number(a.ord || 0) - Number(b.ord || 0));

  if (backToStageLink instanceof HTMLAnchorElement) {
    const suffix = selectedStageId
      ? `?stgId=${encodeURIComponent(selectedStageId)}`
      : "";
    backToStageLink.href = `./maps.html${suffix}`;
  }

  renderSelectedMap();
  renderTaskList();
}

function renderSelectedMap(): void {
  if (!(selectedMapBox instanceof HTMLElement)) {
    return;
  }

  const map = maps.find((m) => m.mpId === selectedMapId);
  if (!map) {
    selectedMapBox.innerHTML = `<div class="empty">${t("no_map")}</div>`;
    return;
  }

  selectedMapBox.innerHTML = "";
  const row = document.createElement("div");
  row.className = "object-row";

  const left = document.createElement("div");
  const nm = document.createElement("div");
  nm.className = "nm";
  nm.textContent = map.nm || map.mpId;
  left.append(nm);

  const desc = document.createElement("div");
  desc.className = "desc";
  desc.textContent = map.desc || map.mpId;
  left.append(desc);

  row.append(left);
  selectedMapBox.append(row);
}

function renderTaskList(): void {
  if (!(taskList instanceof HTMLElement)) {
    return;
  }

  taskList.innerHTML = "";

  if (tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("no_task");
    taskList.append(empty);
    return;
  }

  for (const task of tasks) {
    const row = document.createElement("div");
    row.className = "object-row";

    const left = document.createElement("div");
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.textContent = task.nm || task.tkId;
    left.append(nm);

    const desc = document.createElement("div");
    desc.className = "desc";
    const state = String(task.state || "todo");
    const progress = Number(task.progress || 0);
    desc.textContent = `${state} / ${progress}% ${task.desc ? "- " + task.desc : ""}`;
    left.append(desc);

    const actions = document.createElement("div");
    actions.className = "actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "page-btn";
    editBtn.textContent = t("edit");
    editBtn.addEventListener("click", () => {
      if (!document.body.classList.contains("edit-mode")) {
        return;
      }
      openTaskDialog(task);
    });

    actions.append(editBtn);
    row.append(left, actions);
    taskList.append(row);
  }
}

function moveMapSelection(delta: number): void {
  if (maps.length === 0) {
    return;
  }

  const mapIds = maps.map((row) => String(row.mpId || "")).filter(Boolean);
  selectedMapId = getCycledId(mapIds, selectedMapId, delta);

  void (async () => {
    await setAppStateText("maps", selectedMapId);
    await reload();
  })();
}

async function addTask(): Promise<void> {
  if (!selectedMapId) {
    return;
  }

  const nextOrd =
    tasks.length > 0 ? Number(tasks[tasks.length - 1].ord || 0) + 1 : 1;
  const rand = Math.random().toString(36).slice(2, 8);
  const tkId = `tk_${Date.now()}_${rand}`;
  const now = Date.now();

  await putRow("tasks", {
    tkId,
    mpId: selectedMapId,
    ord: nextOrd,
    nm: `TASK${nextOrd}`,
    desc: "",
    state: "todo",
    progress: 0,
    layer: 0,
    nodeType: "task",
    isLocked: 0,
    requiresApproval: 0,
    t_c: now,
    t_u: now,
  });

  await reload();
}

function openTaskDialog(task: TaskRecord): void {
  entityDialog.open({
    title: t("task_edit_title"),
    values: {
      nm: String(task.nm || ""),
      desc: String(task.desc || ""),
      progress: Number(task.progress || 0),
      state: String(task.state || "todo"),
    },
    onSave: async (nextValues) => {
      await putRow("tasks", {
        ...task,
        nm: nextValues.nm || task.nm,
        desc: nextValues.desc,
        progress: nextValues.progress,
        state: nextValues.state || task.state || "todo",
        t_u: Date.now(),
      });

      await reload();
    },
  });
}
