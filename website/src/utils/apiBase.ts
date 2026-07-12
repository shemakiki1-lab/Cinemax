import { resolveOptionalServiceUrl } from "../config"; // KOSORA HANO: Simbuza @cinemax/config n'inzira y'ukuri ya local file

/**
 * Cinemax API base URL + fetch shim.
 *
 * The backend lives on a separate origin on Render. Any code that calls
 * `fetch("/api/...")` with a relative path is rewritten to hit the backend,
 * and credentials are included so the session cookie flows cross-origin.
 *
 * Import this file ONCE from main.tsx (side-effect import).
 */
export const API_BASE = resolveOptionalServiceUrl(import.meta.env.VITE_API_BASE_URL);

if (typeof window !== "undefined" && API_BASE) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    let url: string;
    if (typeof input === "string") url = input;
    else if (input instanceof URL) url = input.toString();
    else url = input.url;

    // Only rewrite relative /api/... URLs — leave absolute URLs alone.
    if (url.startsWith("/api/") || url === "/api") {
      const nextUrl = API_BASE + url;
      const nextInit: RequestInit = { credentials: "include", ...init };
      if (typeof input === "string" || input instanceof URL) {
        return originalFetch(nextUrl, nextInit);
      }
      // Request object — rebuild it against the new URL.
      return originalFetch(new Request(nextUrl, input), nextInit);
    }
    return originalFetch(input as any, init);
  }) as typeof window.fetch;
}
