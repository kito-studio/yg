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
