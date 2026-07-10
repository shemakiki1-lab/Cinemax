/**
 * Local config shim.
 *
 * Some parts of the frontend import from "../config".
 * During this repo snapshot, the shared package "@cinemax/config"
 * is used elsewhere (e.g. Footer), but a local "src/config.ts" is
 * required for relative imports like "../config".
 */

/**
 * Resolve an optional service base URL.
 *
 * If the provided env value is missing, returns empty string.
 * Otherwise ensures it does not end with a trailing slash.
 */
export function resolveOptionalServiceUrl(envValue: string | undefined): string {
  return resolveServiceUrl(envValue, "https://cinemax-backend.onrender.com");
}

/**
 * Compatibility helper: allow resolving a service url with a fallback.
 */
export function resolveServiceUrl(envValue: string | undefined, fallback: string): string {
  const resolved = !envValue ? "" : String(envValue).replace(/\/+$/, "");
  return resolved || fallback;
}

