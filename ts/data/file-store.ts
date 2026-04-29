import { openYGDatabase } from "../init-db";
import { requestToPromise, transactionDone } from "./yg-idb";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

export type SpriteFileMeta = {
  type: "sprite";
  w: number;
  h: number;
  unit_w: number;
  unit_h: number;
  nw: number;
  nh: number;
};

export type RegisteredImageRow = {
  fId: string;
  nm: string;
  ext: string;
  objectUrl: string;
  spriteMeta: SpriteFileMeta | null;
};

export type FileStoreGateway = {
  fetchRegisteredImageRows: () => Promise<RegisteredImageRow[]>;
  saveFileToStore: (
    file: File,
    options?: { body?: string | null },
  ) => Promise<string | null>;
  getObjectUrlForFile: (fId: string) => Promise<string | null>;
  getFileBlobById: (fId: string) => Promise<Blob | null>;
  getSpriteMetaForFile: (fId: string) => Promise<SpriteFileMeta | null>;
};

function parseSpriteFileMeta(rawBody: unknown): SpriteFileMeta | null {
  if (!rawBody) {
    return null;
  }

  let parsed: unknown = rawBody;
  if (typeof rawBody === "string") {
    const text = rawBody.trim();
    if (!text || text.startsWith("data:")) {
      return null;
    }
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const meta = parsed as Partial<SpriteFileMeta>;
  const toPositiveInt = (value: unknown): number | null => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      return null;
    }
    return Math.round(num);
  };

  if (meta.type !== "sprite") {
    return null;
  }

  const w = toPositiveInt(meta.w);
  const h = toPositiveInt(meta.h);
  const unit_w = toPositiveInt(meta.unit_w);
  const unit_h = toPositiveInt(meta.unit_h);
  const nw = toPositiveInt(meta.nw);
  const nh = toPositiveInt(meta.nh);
  if (!w || !h || !unit_w || !unit_h || !nw || !nh) {
    return null;
  }

  return {
    type: "sprite",
    w,
    h,
    unit_w,
    unit_h,
    nw,
    nh,
  };
}

export function createFileStoreGateway(): FileStoreGateway {
  const fileObjectUrlCache = new Map<string, string>();

  async function getFileBlobById(fId: string): Promise<Blob | null> {
    const db = await openYGDatabase();
    try {
      const tx = db.transaction("files", "readonly");
      const store = tx.objectStore("files");
      const row = (await requestToPromise(store.get(fId))) as
        | { bin?: Blob }
        | undefined;
      const bin = row?.bin;
      return bin instanceof Blob ? bin : null;
    } finally {
      db.close();
    }
  }

  async function getObjectUrlForFile(fId: string): Promise<string | null> {
    const cached = fileObjectUrlCache.get(fId);
    if (cached) {
      return cached;
    }

    const blob = await getFileBlobById(fId);
    if (!blob) {
      return null;
    }

    const objectUrl = URL.createObjectURL(blob);
    fileObjectUrlCache.set(fId, objectUrl);
    return objectUrl;
  }

  async function fetchRegisteredImageRows(): Promise<RegisteredImageRow[]> {
    const db = await openYGDatabase();
    try {
      const tx = db.transaction("files", "readonly");
      const store = tx.objectStore("files");
      const rows = (await requestToPromise(store.getAll())) as Array<{
        fId?: string;
        nm?: string;
        ext?: string;
        mime?: string;
        body?: string;
        bin?: Blob;
        t_u?: number;
      }>;

      return rows
        .filter((row) => {
          const ext = String(row?.ext || "")
            .trim()
            .toLowerCase();
          const mime = String(row?.mime || "")
            .trim()
            .toLowerCase();
          const body = String(row?.body || "")
            .trim()
            .toLowerCase();
          if (IMAGE_EXTENSIONS.has(ext)) {
            return true;
          }
          if (mime.startsWith("image/")) {
            return true;
          }
          return body.startsWith("data:image/");
        })
        .map((row) => {
          const fId = String(row?.fId || "").trim();
          const nm = String(row?.nm || fId).trim();
          const ext = String(row?.ext || "")
            .trim()
            .toLowerCase();
          const spriteMeta = parseSpriteFileMeta(row?.body);
          let objectUrl = "";
          if (row?.bin instanceof Blob) {
            objectUrl = URL.createObjectURL(row.bin);
          } else {
            const body = String(row?.body || "").trim();
            if (body.toLowerCase().startsWith("data:image/")) {
              objectUrl = body;
            }
          }
          return {
            fId,
            nm,
            ext,
            objectUrl,
            spriteMeta,
            t_u: Number(row?.t_u || 0),
          };
        })
        .filter((row) => !!row.fId && !!row.objectUrl)
        .sort((a, b) => {
          if (a.t_u !== b.t_u) {
            return b.t_u - a.t_u;
          }
          return a.fId.localeCompare(b.fId);
        })
        .map((row) => ({
          fId: row.fId,
          nm: row.nm,
          ext: row.ext,
          objectUrl: row.objectUrl,
          spriteMeta: row.spriteMeta,
        }));
    } finally {
      db.close();
    }
  }

  async function saveFileToStore(
    file: File,
    options?: { body?: string | null },
  ): Promise<string | null> {
    const extByName = String(file.name || "")
      .split(".")
      .pop()
      ?.toLowerCase();
    const extByMime = String(file.type || "")
      .split("/")
      .pop()
      ?.toLowerCase();
    const ext = extByName || extByMime || "bin";
    const rand = Math.random().toString(36).slice(2, 8);
    const fId = `f_${Date.now()}_${rand}.${ext}`;

    const db = await openYGDatabase();
    try {
      const tx = db.transaction("files", "readwrite");
      const store = tx.objectStore("files");
      await requestToPromise(
        store.put({
          fId,
          ext,
          nm: file.name || fId,
          mime: file.type || "application/octet-stream",
          size: file.size,
          body: String(options?.body || "").trim(),
          bin: file,
          t_c: Date.now(),
          t_u: Date.now(),
        }),
      );
      await transactionDone(tx);
      return fId;
    } finally {
      db.close();
    }
  }

  async function getSpriteMetaForFile(
    fId: string,
  ): Promise<SpriteFileMeta | null> {
    const db = await openYGDatabase();
    try {
      const tx = db.transaction("files", "readonly");
      const store = tx.objectStore("files");
      const row = (await requestToPromise(store.get(fId))) as
        | { body?: string }
        | undefined;
      return parseSpriteFileMeta(row?.body);
    } finally {
      db.close();
    }
  }

  return {
    fetchRegisteredImageRows,
    saveFileToStore,
    getObjectUrlForFile,
    getFileBlobById,
    getSpriteMetaForFile,
  };
}
