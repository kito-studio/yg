import { FileStoreGateway } from "../data/file-store";
import { StageRecord } from "../obj/stage";
import { TaskRecord } from "../obj/task";
import { WorldRecord } from "../obj/world";
import { MapViewportController } from "../ui/map-viewport";
import { createStageInteractionHandlers } from "../ui/stage-interactions";
import { createTaskInteractionHandlers } from "../ui/task-interactions";
import { MapPageElements } from "./dom";
import { createStageDialogController } from "./stage-dialog";

export const STAGE_DEFAULT_SIZE = 74;
export const DEFAULT_PROGRESS = 100;
export const LOGO_DISMISS_TIMEOUT_MS = 3000;
export const LOGO_FADE_DURATION_MS = 360;
export const STAGE_MAP_CONTENT_SIZE = {
  width: 1600,
  height: 1600,
};
export const MIN_MAP_SCALE = 0.6;
export const MAX_MAP_SCALE = 3;
export const MAP_ZOOM_SENSITIVITY = 0.0014;
export const MAP_PAN_THRESHOLD_PX = 6;
export const MAP_INERTIA_FRICTION = 0.92;
export const MAP_INERTIA_MIN_SPEED = 0.02;
// －－－ 地図画面要素 －－－

export type MapPageContext = {
  elements: MapPageElements;
  mapViewport: MapViewportController;
  stageDialog: ReturnType<typeof createStageDialogController>;
  stageHandlers: ReturnType<typeof createStageInteractionHandlers>;
  taskHandlers: ReturnType<typeof createTaskInteractionHandlers>;
  worlds: WorldRecord[];
  world: WorldRecord | null;
  stages: StageRecord[];
  stage: StageRecord | null;
  tasks: TaskRecord[];
  lastPointerClient: { x: number; y: number } | null;
  bgmAudio: HTMLAudioElement;
  fileStore: FileStoreGateway;
};
