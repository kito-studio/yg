export type AddMapObjectOptions<TRecord> = {
  isEditMode: () => boolean;
  canCreate?: () => boolean | Promise<boolean>;
  resolveNextOrd: () => number;
  createRecord: (nextOrd: number) => TRecord;
  createElement: (record: TRecord) => HTMLButtonElement;
  appendElement: (element: HTMLButtonElement) => void;
  getAnchorPoint: () => { x: number; y: number };
  placeElement: (element: HTMLButtonElement, x: number, y: number) => void;
  saveElement: (
    element: HTMLButtonElement,
    record: TRecord,
    nextOrd: number,
  ) => Promise<void>;
  startAdjust: (element: HTMLButtonElement) => void;
};

export async function addMapObjectWithDrag<TRecord>(
  options: AddMapObjectOptions<TRecord>,
): Promise<void> {
  if (!options.isEditMode()) {
    return;
  }

  const canCreate = options.canCreate ? await options.canCreate() : true;
  if (!canCreate) {
    return;
  }

  const nextOrd = options.resolveNextOrd();
  const record = options.createRecord(nextOrd);
  const element = options.createElement(record);

  options.appendElement(element);

  const point = options.getAnchorPoint();
  options.placeElement(element, point.x, point.y);

  await options.saveElement(element, record, nextOrd);
  options.startAdjust(element);
}
