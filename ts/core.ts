import { createAccessToken } from "./access";
import { lg } from "./util/log";

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
  const uri = `/yg/html_part/${url}.html`;
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error("読み込み失敗 " + url);
  }
  const html = await res.text();
  target.insertAdjacentHTML("beforeend", html);
}
