type ResolveSelectionInput = {
  ids: string[];
  preferredIds: Array<string | null | undefined>;
};

export function resolveSelectedId(input: ResolveSelectionInput): string {
  const { ids, preferredIds } = input;
  if (ids.length === 0) {
    return "";
  }

  for (const candidate of preferredIds) {
    const value = String(candidate || "").trim();
    if (!value) {
      continue;
    }
    if (ids.includes(value)) {
      return value;
    }
  }

  return ids[0];
}

export function getCycledId(
  ids: string[],
  currentId: string,
  delta: number,
): string {
  if (ids.length === 0) {
    return "";
  }

  const currentIndex = ids.findIndex((id) => id === currentId);
  const baseIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (baseIndex + delta + ids.length) % ids.length;
  return ids[nextIndex];
}
