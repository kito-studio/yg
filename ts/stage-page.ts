import { createFileStoreGateway } from "./data/file-store";
import {
  fetchAllRows,
  getAppStateText,
  putRow,
  setAppStateText,
} from "./data/yg-idb";
import { applyI18n, t } from "./i18n";
import { ensureYGDatabase } from "./init-db";
import { resolveSelectedId } from "./state/selection";
import {
  renderHeaderSelectedLabel,
  setupHeaderSwitch,
  setupModeSwitch,
} from "./ui/common-header";
import { createEntityEditDialog } from "./ui/entity-edit-dialog";

type StageRecord = {
  stgId: string;
  ord: number;
  nm: string;
  desc?: string;
  mapImgPath?: string;
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
const stageMapImage = document.getElementById("stageMapImage");
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
const DEFAULT_STAGE_BG = "./img/world_map/world_map0.jpg";
const fileStore = createFileStoreGateway();
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

  setupHeaderSwitch({
    prevButton: prevStageBtn,
    nextButton: nextStageBtn,
    getItemIds: () =>
      stages.map((row) => String(row.stgId || "")).filter(Boolean),
    getSelectedId: () => selectedStageId,
    onSelect: async (nextStageId) => {
      // URL遷移や復帰時の整合を保つため、現在ステージを都度保存する。
      selectedStageId = nextStageId;
      await setAppStateText("stages", selectedStageId);
      await reload();
    },
  });

  bindEvents();
  await reload();
}

function bindEvents(): void {
  // 閲覧モードでは編集操作を受け付けず、誤更新を防ぐ。
  if (addMapBtn instanceof HTMLButtonElement) {
    addMapBtn.addEventListener("click", () => {
      if (!document.body.classList.contains("edit-mode")) {
        return;
      }
      void addMap();
    });
  }
}

async function reload(): Promise<void> {
  // URL/app_state/現在値からアクティブなステージを解決し、一覧を再読込する。
  stages = ((await fetchAllRows("stages")) as StageRecord[])
    .filter((row) => typeof row?.stgId === "string")
    .sort((a, b) => Number(a.ord || 0) - Number(b.ord || 0));

  if (stages.length === 0) {
    selectedStageId = "";
    renderSelectedStageHeader();
    await applySelectedStageBackground();
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
  await applySelectedStageBackground();
  renderMapList();
}

function renderSelectedStageHeader(): void {
  renderHeaderSelectedLabel({
    labelElement: selectedStageHeaderName,
    items: stages.map((stage) => ({
      id: stage.stgId,
      label: stage.nm || stage.stgId,
    })),
    selectedId: selectedStageId,
    emptyLabel: t("no_stage"),
  });
}

async function applySelectedStageBackground(): Promise<void> {
  if (!(stageMapImage instanceof HTMLImageElement)) {
    return;
  }

  const stage = stages.find((s) => s.stgId === selectedStageId) || null;
  if (!stage) {
    stageMapImage.src = DEFAULT_STAGE_BG;
    return;
  }

  const mapImgPath = String(stage.mapImgPath || "").trim();
  if (!mapImgPath) {
    stageMapImage.src = DEFAULT_STAGE_BG;
    return;
  }

  const objectUrl = await getObjectUrlForFile(mapImgPath);
  if (objectUrl) {
    stageMapImage.src = objectUrl;
    return;
  }

  stageMapImage.src = mapImgPath;
}

async function getObjectUrlForFile(fId: string): Promise<string | null> {
  return fileStore.getObjectUrlForFile(fId);
}

function renderMapList(): void {
  if (!(mapList instanceof HTMLElement)) {
    return;
  }

  // データ件数が小さい前提なので、全再描画で実装を単純化する。
  mapList.innerHTML = "";

  if (maps.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("no_map");
    mapList.append(empty);
    return;
  }

  for (const map of maps) {
    mapList.append(createMapRow(map));
  }
}

function createMapRow(map: MapRecord): HTMLDivElement {
  // 表示ブロックと操作ボタンを1行単位で組み立てる。
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
  return row;
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
