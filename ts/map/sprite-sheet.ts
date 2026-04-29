import { MAPPAGE_CLASS, MAPPAGE_SELECTOR } from "./dom";

const SPRITE_COLUMNS = 12;
const SPRITE_ROWS = 12;
const SPRITE_SHEET_URL = "./img/world_map/sprite1536.webp";

type SpriteTone = "none" | "red" | "dark";

type SpriteCell = {
  col: number;
  row: number;
  tone?: SpriteTone;
};

function clampCell(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max - 1);
}

function clearSpriteTone(sideImage: HTMLElement): void {
  sideImage.classList.remove(
    MAPPAGE_CLASS.spriteToneRed,
    MAPPAGE_CLASS.spriteToneDark,
  );
}

export function clearSpriteCellVisual(target: HTMLButtonElement): void {
  const sideImage = target.querySelector(
    MAPPAGE_SELECTOR.stageObjectSideImage,
  ) as HTMLElement | null;
  const sideImageImg = target.querySelector(
    MAPPAGE_SELECTOR.stageObjectSideImageImg,
  ) as HTMLImageElement | null;
  if (!sideImage || !sideImageImg) {
    return;
  }

  sideImage.classList.remove(MAPPAGE_CLASS.stageObjectSideImageSprite);
  clearSpriteTone(sideImage);
  sideImage.style.removeProperty("--sprite-sheet-url");
  sideImage.style.removeProperty("--sprite-col");
  sideImage.style.removeProperty("--sprite-row");
  sideImage.style.removeProperty("--sprite-cols");
  sideImage.style.removeProperty("--sprite-rows");
  sideImageImg.hidden = false;
}

export function applySpriteCellVisual(
  target: HTMLButtonElement,
  spriteCell: SpriteCell,
): void {
  const sideImage = target.querySelector(
    MAPPAGE_SELECTOR.stageObjectSideImage,
  ) as HTMLElement | null;
  const sideImageImg = target.querySelector(
    MAPPAGE_SELECTOR.stageObjectSideImageImg,
  ) as HTMLImageElement | null;
  if (!sideImage || !sideImageImg) {
    return;
  }

  const col = clampCell(Number(spriteCell.col), SPRITE_COLUMNS);
  const row = clampCell(Number(spriteCell.row), SPRITE_ROWS);

  sideImage.hidden = false;
  sideImage.classList.add(MAPPAGE_CLASS.stageObjectSideImageSprite);
  clearSpriteTone(sideImage);
  if (spriteCell.tone === "red") {
    sideImage.classList.add(MAPPAGE_CLASS.spriteToneRed);
  }
  if (spriteCell.tone === "dark") {
    sideImage.classList.add(MAPPAGE_CLASS.spriteToneDark);
  }

  sideImage.style.setProperty(
    "--sprite-sheet-url",
    `url(\"${SPRITE_SHEET_URL}\")`,
  );
  sideImage.style.setProperty("--sprite-col", `${col}`);
  sideImage.style.setProperty("--sprite-row", `${row}`);
  sideImage.style.setProperty("--sprite-cols", `${SPRITE_COLUMNS}`);
  sideImage.style.setProperty("--sprite-rows", `${SPRITE_ROWS}`);

  sideImageImg.hidden = true;
  sideImageImg.removeAttribute("src");
}
