import { StageRecord } from "../obj/stage-object";
import { DEFAULT_PROGRESS, STAGE_DEFAULT_SIZE } from "./constants";

export function buildStageId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `stg_${Date.now()}_${rand}`;
}

export function getElementPosition(target: HTMLElement): {
  x: number;
  y: number;
} {
  const left = Number.parseFloat(target.style.left);
  const top = Number.parseFloat(target.style.top);
  return {
    x: Number.isFinite(left) ? left : 0,
    y: Number.isFinite(top) ? top : 0,
  };
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PROGRESS;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getHpColor(value: number): string {
  if (value > 75) {
    return "#4dd26d";
  }
  if (value > 50) {
    return "#dbd34f";
  }
  if (value > 25) {
    return "#f39a3d";
  }
  return "#e84d43";
}

export function normalizeHexColor(value: string): string {
  const text = value.trim();
  const shortHex = /^#[0-9a-fA-F]{3}$/;
  const fullHex = /^#[0-9a-fA-F]{6}$/;

  if (fullHex.test(text)) {
    return text.toLowerCase();
  }

  if (shortHex.test(text)) {
    const r = text[1];
    const g = text[2];
    const b = text[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return "#ffc96b";
}

export function normalizeStageRow(
  row: Partial<StageRecord>,
  index: number,
): StageRecord {
  const safeOrd = Number.isFinite(row.ord) ? Number(row.ord) : index + 1;
  const safeName =
    typeof row.nm === "string" && row.nm.length > 0 ? row.nm : `ST${safeOrd}`;
  const safeDesc = typeof row.desc === "string" ? row.desc : "";
  const safeColor = normalizeHexColor(
    typeof row.baseColor === "string" ? row.baseColor : "#ffc96b",
  );
  const safeProgress = clampProgress(
    Number.isFinite(row.progress) ? Number(row.progress) : DEFAULT_PROGRESS,
  );

  return {
    stgId: row.stgId as string,
    wId: typeof row.wId === "string" ? row.wId : "",
    parentStgId: typeof row.parentStgId === "string" ? row.parentStgId : "",
    ord: safeOrd,
    nm: safeName,
    desc: safeDesc,
    baseColor: safeColor,
    progress: safeProgress,
    imgPath: typeof row.imgPath === "string" ? row.imgPath : "",
    mapImgPath: typeof row.mapImgPath === "string" ? row.mapImgPath : "",
    x: Number.isFinite(row.x) ? Number(row.x) : 0,
    y: Number.isFinite(row.y) ? Number(row.y) : 0,
    w: Number.isFinite(row.w) ? Number(row.w) : STAGE_DEFAULT_SIZE,
    h: Number.isFinite(row.h) ? Number(row.h) : STAGE_DEFAULT_SIZE,
    rot: Number.isFinite(row.rot) ? Number(row.rot) : 0,
    mode: typeof row.mode === "string" ? row.mode : "edit",
    isLocked: Number.isFinite(row.isLocked) ? Number(row.isLocked) : 0,
    t_c: Number.isFinite(row.t_c) ? Number(row.t_c) : Date.now(),
    t_u: Number.isFinite(row.t_u) ? Number(row.t_u) : Date.now(),
  };
}
