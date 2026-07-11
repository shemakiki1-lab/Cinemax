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
 * P1, P2, and P3 use high-performing Vidsrc alternatives optimized for full movie playback.
 * Updated with enhanced patterns for reliable 1080p streaming and better ad-resistance.
 */
export const PROVIDERS_CONFIG: StreamingProvider[] = [
  {
    // Vidsrc.xyz — currently the most reliable free TMDB-ID embed source with
    // full-movie playback and 1080p fallbacks. Query params tune autoplay,
    // subtitle language, and the UI accent color for a cleaner in-frame UX.
    id: "vidsrc-xyz",
    name: "P1",
    homepage: "https://vidsrc.xyz",
    moviePattern: "https://vidsrc.xyz/embed/movie?tmdb={id}&ds_lang=en&autoplay=1",
    tvPattern: "https://vidsrc.xyz/embed/tv?tmdb={id}&season={season}&episode={episode}&ds_lang=en&autoplay=1",
    qualityOptions: ["1080p", "720p", "Auto"],
    audioOptions: ["Original", "English"],
    subtitlesOptions: ["Embedded", "English"],
    defaultLatency: 95,
    status: "Online",
  },
  {
    // Embed.su — strong ad-blocking, direct-MP4 fallback for many titles.
    id: "embed-su",
    name: "P2",
    homepage: "https://embed.su",
    moviePattern: "https://embed.su/embed/movie/{id}",
    tvPattern: "https://embed.su/embed/tv/{id}/{season}/{episode}",
    qualityOptions: ["1080p", "720p", "Auto"],
    audioOptions: ["Original", "English"],
    subtitlesOptions: ["Embedded", "English"],
    defaultLatency: 105,
    status: "Online",
  },
  {
    // Vidlink.pro — clean player, brand-color theming, autoplay, next-episode
    // support out of the box. Great fallback when P1/P2 rate-limit.
    id: "vidlink-pro",
    name: "P3",
    homepage: "https://vidlink.pro",
    moviePattern: "https://vidlink.pro/movie/{id}?primaryColor=39FF14&secondaryColor=39FF14&iconColor=39FF14&autoplay=true&title=true",
    tvPattern: "https://vidlink.pro/tv/{id}/{season}/{episode}?primaryColor=39FF14&secondaryColor=39FF14&iconColor=39FF14&autoplay=true&nextbutton=true&title=true",
    qualityOptions: ["1080p", "720p", "Auto"],
    audioOptions: ["Original", "English"],
    subtitlesOptions: ["Embedded", "English"],
    defaultLatency: 115,
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
  if (/autoplay=/.test(url)) return url;
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
