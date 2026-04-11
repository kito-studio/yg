import {
  fetchAllRows,
  getAppStateText,
  putRow,
  setAppStateText,
} from "./data/yg-idb";
import { applyI18n, t } from "./i18n";
import { ensureYGDatabase } from "./init-db";
import { getCycledId, resolveSelectedId } from "./state/selection";
import { setupModeSwitch } from "./ui/common-header";
import { createEntityEditDialog } from "./ui/entity-edit-dialog";

type StageRecord = {
  stgId: string;
  ord: number;
  nm: string;
  desc?: string;
};

type MapRecord = {
  mpId: string;
  stgId: string;
  ord: number;
  nm: string;
  desc?: string;
  progress?: number;
  t_c: number;
  t_u: number;
};

const modeSwitch = document.getElementById("modeSwitch");
const addMapBtn = document.getElementById("addMapBtn");
const selectedStageHeaderName = document.getElementById(
  "selectedStageHeaderName",
);
const mapList = document.getElementById("mapList");
const prevStageBtn = document.getElementById("prevStageBtn");
const nextStageBtn = document.getElementById("nextStageBtn");

const dbMaintBtn = document.getElementById("dbMaintBtn");

const dialog = document.getElementById("entityDialog");
const dialogBackdrop = document.getElementById("entityDialogBackdrop");
const dialogTitle = document.getElementById("entityDialogTitle");
const nameInput = document.getElementById("entityNameInput");
const descInput = document.getElementById("entityDescInput");
const progressInput = document.getElementById("entityProgressInput");
const saveButton = document.getElementById("entityDialogSave");
const cancelButton = document.getElementById("entityDialogCancel");

let stages: StageRecord[] = [];
let maps: MapRecord[] = [];
let selectedStageId = "";
const entityDialog = createEntityEditDialog({
  dialog,
  backdrop: dialogBackdrop,
  title: dialogTitle,
  nameInput,
  descInput,
  progressInput,
  saveButton,
  cancelButton,
});

void initStagePage();

async function initStagePage(): Promise<void> {
  applyI18n(document);
  await ensureYGDatabase();

  setupModeSwitch({
    modeSwitch,
    editModeClass: "edit-mode",
    viewModeClass: "view-mode",
    defaultEditMode: false,
  });

  if (dbMaintBtn instanceof HTMLButtonElement) {
    dbMaintBtn.addEventListener("click", () => {
      window.location.href = "./settings.html";
    });
  }

  bindEvents();
  await reload();
}

function bindEvents(): void {
  if (addMapBtn instanceof HTMLButtonElement) {
    addMapBtn.addEventListener("click", () => {
      if (!document.body.classList.contains("edit-mode")) {
        return;
      }
      void addMap();
    });
  }

  if (prevStageBtn instanceof HTMLButtonElement) {
    prevStageBtn.addEventListener("click", () => {
      moveStageSelection(-1);
    });
  }

  if (nextStageBtn instanceof HTMLButtonElement) {
    nextStageBtn.addEventListener("click", () => {
      moveStageSelection(1);
    });
  }
}

async function reload(): Promise<void> {
  stages = ((await fetchAllRows("stages")) as StageRecord[])
    .filter((row) => typeof row?.stgId === "string")
    .sort((a, b) => Number(a.ord || 0) - Number(b.ord || 0));

  if (stages.length === 0) {
    selectedStageId = "";
    renderSelectedStageHeader();
    renderMapList();
    return;
  }

  const urlStageId = new URLSearchParams(window.location.search).get("stgId");
  const savedStageId = await getAppStateText("stages");
  const stageIds = stages.map((row) => String(row.stgId || "")).filter(Boolean);

  selectedStageId = resolveSelectedId({
    ids: stageIds,
    preferredIds: [urlStageId, savedStageId, selectedStageId],
  });
  await setAppStateText("stages", selectedStageId);

  maps = ((await fetchAllRows("maps")) as MapRecord[])
    .filter((row) => String(row?.stgId || "") === selectedStageId)
    .sort((a, b) => Number(a.ord || 0) - Number(b.ord || 0));

  renderSelectedStageHeader();
  renderMapList();
}

function renderSelectedStageHeader(): void {
  if (!(selectedStageHeaderName instanceof HTMLElement)) {
    return;
  }

  const stage = stages.find((s) => s.stgId === selectedStageId);
  if (!stage) {
    selectedStageHeaderName.textContent = t("no_stage");
    return;
  }

  selectedStageHeaderName.textContent = stage.nm || stage.stgId;
}

function renderMapList(): void {
  if (!(mapList instanceof HTMLElement)) {
    return;
  }

  mapList.innerHTML = "";

  if (maps.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("no_map");
    mapList.append(empty);
    return;
  }

  for (const map of maps) {
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

    const actions = document.createElement("div");
    actions.className = "actions";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "page-btn";
    openBtn.textContent = t("open_map");
    openBtn.addEventListener("click", async () => {
      await setAppStateText("maps", map.mpId);
      window.location.href = `./map.html?mpId=${encodeURIComponent(map.mpId)}`;
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "page-btn";
    editBtn.textContent = t("edit");
    editBtn.addEventListener("click", () => {
      if (!document.body.classList.contains("edit-mode")) {
        return;
      }
      openMapDialog(map);
    });

    actions.append(openBtn, editBtn);
    row.append(left, actions);
    mapList.append(row);
  }
}

function moveStageSelection(delta: number): void {
  if (stages.length === 0) {
    return;
  }

  const stageIds = stages.map((row) => String(row.stgId || "")).filter(Boolean);
  selectedStageId = getCycledId(stageIds, selectedStageId, delta);

  void (async () => {
    await setAppStateText("stages", selectedStageId);
    await reload();
  })();
}

async function addMap(): Promise<void> {
  if (!selectedStageId) {
    return;
  }

  const nextOrd =
    maps.length > 0 ? Number(maps[maps.length - 1].ord || 0) + 1 : 1;
  const rand = Math.random().toString(36).slice(2, 8);
  const mpId = `mp_${Date.now()}_${rand}`;
  const now = Date.now();

  await putRow("maps", {
    mpId,
    stgId: selectedStageId,
    ord: nextOrd,
    nm: `MAP${nextOrd}`,
    desc: "",
    progress: 0,
    mode: "edit",
    isLocked: 0,
    t_c: now,
    t_u: now,
  });

  await reload();
}

function openMapDialog(map: MapRecord): void {
  entityDialog.open({
    title: t("map_edit_title"),
    values: {
      nm: String(map.nm || ""),
      desc: String(map.desc || ""),
      progress: Number(map.progress || 0),
    },
    onSave: async (nextValues) => {
      await putRow("maps", {
        ...map,
        nm: nextValues.nm || map.nm,
        desc: nextValues.desc,
        progress: nextValues.progress,
        t_u: Date.now(),
      });

      await reload();
    },
  });
}
