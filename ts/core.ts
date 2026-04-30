import { createAccessToken } from "./access";
import { lg } from "./util/log";

const htmlPartsRaw = import.meta.glob("../html_part/*.html", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function rewriteBundledPartAssetPaths(html: string): string {
  return html.replace(
    /(src|href)=(["'])(\.\/(?:img|wav)\/[^"']+)\2/g,
    (_match, attr: string, quote: string, path: string) => {
      return `${attr}=${quote}/${path.replace(/^\.\//, "")}${quote}`;
    },
  );
}

(() => {
  if (isLocal()) {
    lg(
      "ローカル環境のため、Cloudflare Analyticsのスクリプトは読み込まれません。",
    );
  } else {
    // アクセス解析のトークンを生成
    createAccessToken();
  }
  //
})();

export function isLocal(): boolean {
  const host = window.location.hostname;
  const isLocalHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local");
  return isLocalHost;
}

/**
 * HTML部品を挿入する
 */
export async function insertHtmlPart(
  url: string,
  target: HTMLElement,
): Promise<void> {
  const bundledKey = `../html_part/${url}.html`;
  const bundledHtml = htmlPartsRaw[bundledKey];
  if (typeof bundledHtml === "string" && bundledHtml.length > 0) {
    target.insertAdjacentHTML(
      "beforeend",
      rewriteBundledPartAssetPaths(bundledHtml),
    );
    return;
  }

  const uri = `/yg/html_part/${url}.html`;
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error("読み込み失敗 " + url);
  }
  const html = await res.text();
  target.insertAdjacentHTML("beforeend", html);
}
