import { buildId } from "./common";

export type TaskRecord = {
  tskId: string;
  wId: string;
  parentStgId: string;
  ord: number;
  nm: string;
  desc: string;
  baseColor: string;
  progress: number;
  imgPath: string;
  mapImgPath: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  mode: string;
  isLocked: number;
  t_c: number;
  t_u: number;
};

export function buildTaskId(): string {
  return buildId("tsk");
}
