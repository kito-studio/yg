export function createAccessToken(): void {
  // Cloudflare Web Analytics
  const analyticsScript = document.createElement("script");
  analyticsScript.defer = true;
  analyticsScript.src = "https://static.cloudflareinsights.com/beacon.min.js";
  analyticsScript.setAttribute(
    "data-cf-beacon",
    '{"token": "a00658942d21445fae2c9aec4fd031d2"}',
  );
  document.head.appendChild(analyticsScript);
}
