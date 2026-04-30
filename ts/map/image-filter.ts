import type { SpriteFileMeta } from "../data/file-store";

export type ImageFilterValues = {
  hue: number;
  brightness: number;
  contrast: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeImageHue(value: unknown): number {
  return clamp(Math.round(toFiniteNumber(value, 0)), -360, 360);
}

export function normalizeImageBrightness(value: unknown): number {
  return clamp(toFiniteNumber(value, 1), 0.1, 3);
}

export function normalizeImageContrast(value: unknown): number {
  return clamp(toFiniteNumber(value, 1), 0.1, 3);
}

export function normalizeImageFilters(
  values: Partial<ImageFilterValues>,
): ImageFilterValues {
  return {
    hue: normalizeImageHue(values.hue),
    brightness: normalizeImageBrightness(values.brightness),
    contrast: normalizeImageContrast(values.contrast),
  };
}

function toFilterNumberText(value: number): string {
  return Number(value.toFixed(3)).toString();
}

export function buildImageFilterCss(
  values: ImageFilterValues,
  baseFilter: string = "",
): string {
  const filters: string[] = [];
  const base = String(baseFilter || "").trim();
  if (base) {
    filters.push(base);
  }

  filters.push(
    `hue-rotate(${toFilterNumberText(values.hue)}deg)`,
    `brightness(${toFilterNumberText(values.brightness)})`,
    `contrast(${toFilterNumberText(values.contrast)})`,
  );

  return filters.join(" ");
}

export async function renderSpriteCellDataUrl(
  srcUrl: string,
  meta: SpriteFileMeta,
  row: number,
  col: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = meta.unit_w;
        canvas.height = meta.unit_h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        const safeRow = Math.max(0, Math.min(row, meta.nh - 1));
        const safeCol = Math.max(0, Math.min(col, meta.nw - 1));
        ctx.drawImage(
          img,
          safeCol * meta.unit_w,
          safeRow * meta.unit_h,
          meta.unit_w,
          meta.unit_h,
          0,
          0,
          meta.unit_w,
          meta.unit_h,
        );
        resolve(canvas.toDataURL());
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = srcUrl;
  });
}
