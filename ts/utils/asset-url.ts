function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl) {
    return "/";
  }

  const withLeadingSlash = baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`;
  if (withLeadingSlash === "/") {
    return "/";
  }

  return withLeadingSlash.replace(/\/+$/, "");
}

function detectLegacyYgPrefix(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const pathname = window.location.pathname;
  if (pathname === "/yg" || pathname.startsWith("/yg/")) {
    return "/yg";
  }

  return "";
}

export function getAppBasePath(): string {
  const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL || "/");
  if (baseUrl !== "/") {
    return baseUrl;
  }

  return detectLegacyYgPrefix();
}

export function resolveStaticAssetUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBasePath()}${normalizedPath}`;
}
