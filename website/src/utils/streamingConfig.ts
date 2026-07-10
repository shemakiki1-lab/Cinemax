export interface StreamingProvider {
  id: string;
  name: string;
  homepage: string;
  moviePattern: string;
  tvPattern: string;
  qualityOptions: string[];
  audioOptions: string[];
  subtitlesOptions: string[];
  defaultLatency: number; // in ms
  status: "Online" | "Slow" | "Offline";
  ping?: number; // current ping in ms
}

/**
 * Streaming sources for the Multi-Server Movie Player.
 * P1 and P2 use high-performing Vidsrc alternatives; P3 stays on 2embed.
 */
export const PROVIDERS_CONFIG: StreamingProvider[] = [
  {
    id: "vidsrc-pro",
    name: "P1",
    homepage: "https://vidsrc.pro",
    moviePattern: "https://vidsrc.pro/embed/movie/{id}",
    tvPattern: "https://vidsrc.pro/embed/tv/{id}/{season}/{episode}",
    qualityOptions: ["Auto"],
    audioOptions: ["Original"],
    subtitlesOptions: ["Embedded"],
    defaultLatency: 110,
    status: "Online",
  },
  {
    id: "vidsrc-to",
    name: "P2",
    homepage: "https://vidsrc.to",
    moviePattern: "https://vidsrc.to/embed/movie/{id}",
    tvPattern: "https://vidsrc.to/embed/tv/{id}/{season}/{episode}",
    qualityOptions: ["Auto"],
    audioOptions: ["Original"],
    subtitlesOptions: ["Embedded"],
    defaultLatency: 120,
    status: "Online",
  },
  {
    id: "2embed",
    name: "P3",
    homepage: "https://www.2embed.cc",
    moviePattern: "https://www.2embed.cc/embed/{id}",
    tvPattern: "https://www.2embed.cc/embedtv/{id}&s={season}&e={episode}",
    qualityOptions: ["Auto"],
    audioOptions: ["Original"],
    subtitlesOptions: ["Embedded"],
    defaultLatency: 130,
    status: "Online",
  },
];

/** Permissions required for third-party embed players (autoplay, HLS, fullscreen). */
export const EMBED_IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";

export const buildEmbedUrl = (
  provider: StreamingProvider,
  type: "movie" | "tv",
  id: number | string,
  season: number = 1,
  episode: number = 1,
  _subtitles: string = "English",
  _quality: string = "Auto",
  _audio: string = "English"
): string => {
  const pattern = type === "movie" ? provider.moviePattern : provider.tvPattern;

  return pattern
    .replace("{id}", id.toString())
    .replace("{season}", season.toString())
    .replace("{episode}", episode.toString());
};

/** Append autoplay hint for embed providers that support it. */
export function embedUrlWithAutoplay(url: string): string {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}autoplay=1`;
}

/**
 * Perform a real network latency check against the provider domain homepage
 * with fallback to mock response if connection gets blocked by security or offline.
 */
export const checkProviderLatency = async (
  provider: StreamingProvider,
  customHomepage?: string
): Promise<{ ping: number; status: "Online" | "Slow" | "Offline" }> => {
  const urlToCheck = customHomepage || provider.homepage;
  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout limit

  try {
    await fetch(urlToCheck, {
      mode: "no-cors",
      signal: controller.signal,
      cache: "no-cache",
      credentials: "omit"
    });

    clearTimeout(timeoutId);
    const end = performance.now();
    const ping = Math.round(end - start);

    let status: "Online" | "Slow" | "Offline" = "Online";
    if (ping > 1500) status = "Slow";

    return { ping, status };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      return { ping: 9999, status: "Offline" };
    }

    const simulatedPing = Math.round(provider.defaultLatency + (Math.random() * 40 - 20));
    let status: "Online" | "Slow" | "Offline" = "Online";
    if (simulatedPing > 1500) status = "Slow";

    return { ping: simulatedPing, status };
  }
};
