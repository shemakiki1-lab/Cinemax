import "dotenv/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
// Ensure config/.env is loaded in both dev and production builds.
try {
  const __dir = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dir, "../config/.env") });
  dotenv.config({ path: path.resolve(__dir, "../../config/.env") });
} catch {}
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { GoogleGenAI } from "@google/genai";
import { authRouter } from "./routes/website.js";
import { adminRouter } from "./routes/admin.js";
import { seedAdminUser, getUserById, getOptionalUserId, AuthedRequest, isAdminEmail } from "./lib/auth.js";
import { connectDB } from "../config/db.js";
import db, { initDb, flushDb } from "./lib/db.js";
import { getMailerStatus } from "./lib/mailer.js";
import { buildCinemaxKnowledgeBase } from "./lib/assistantKnowledge.js";
import { matchMoviesFromAnalysis, VisualAnalysis } from "./lib/tmdbMatch.js";

const app = express();

// Behind Render's proxy — required for `secure` cookies to be recognized.
app.set("trust proxy", 1);

// ---------------------------------------------------------------------------
// CORS — allow the deployed website + admin panel origins, plus anything
// listed explicitly in CORS_ORIGIN (comma-separated). WEBSITE_URL and
// ADMIN_PANEL_URL are wired automatically by render.yaml.
// ---------------------------------------------------------------------------
function buildAllowedOrigins(): string[] {
  const raw: string[] = [];
  if (process.env.CORS_ORIGIN) raw.push(...process.env.CORS_ORIGIN.split(","));
  if (process.env.WEBSITE_URL) raw.push(process.env.WEBSITE_URL);
  if (process.env.ADMIN_PANEL_URL) raw.push(process.env.ADMIN_PANEL_URL);
  // Hosted Render service names currently used by the live Cinemax site/admin.
  raw.push(
    "https://cinemax-backend.onrender.com",
    "https://cinemaxmovie.onrender.com",
    "https://cinemaxmovie-admin.onrender.com",
    "https://cinemax-website.onrender.com",
    "https://cinemax-admin.onrender.com",
  );
  // Local dev conveniences.
  raw.push("http://localhost:5173", "http://localhost:5174", "http://localhost:3000");
  return Array.from(
    new Set(
      raw
        .map((o) => (o || "").trim().replace(/\/+$/, ""))
        .filter(Boolean),
    ),
  );
}
const allowedOrigins = buildAllowedOrigins();
console.log("[cors] Allowed origins:", allowedOrigins);

function isAllowedOrigin(origin: string): boolean {
  const normalized = origin.replace(/\/+$/, "");
  if (allowedOrigins.includes(normalized)) return true;
  // Render static service URLs can change if the project is renamed. Trusting
  // Render HTTPS origins prevents hosted login from breaking with a browser
  // "Failed to fetch" when the service name differs from render.yaml.
  if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(normalized)) return true;
  return false;
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Non-browser callers (curl, server-to-server) send no Origin — allow.
    if (!origin) return cb(null, true);
    if (isAllowedOrigin(origin)) return cb(null, true);
    console.warn("[cors] Rejected origin:", origin);
    return cb(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());

// Render healthcheck target (declared in render.yaml). Kept intentionally
// tiny so it always responds even when the DB is degraded.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    db: process.env.MONGO_URI ? "mongo" : "file",
    mailer: getMailerStatus().configured ? "configured" : "missing",
    time: new Date().toISOString(),
  });
});

app.use(authRouter);
app.use(adminRouter);


app.post("/api/assistant", async (req, res) => {
  try {
    if (db.data?.site_settings?.aiEnabled === false) {
      res.status(403).json({ error: "The AI assistant is currently disabled by the administrator." });
      return;
    }

    const { message, history = [], movieContext, visualContext } = req.body || {};
    const userMessage = String(message || "").trim();
    if (!userMessage) {
      res.status(400).json({ error: "Message is required." });
      return;
    }

    const systemPrompt = buildAssistantSystemPrompt({
      movieContext,
      visualContext,
      sessionUser: resolveSessionUser(req),
    });

    const safeHistory = Array.isArray(history)
      ? history.slice(-12).map((h: any) => ({
          role: h?.role === "assistant" ? "assistant" : "user",
          content: String(h?.content ?? h?.text ?? "").slice(0, 3000),
        })).filter((h: any) => h.content.trim())
      : [];

    const routed = await routedAssistantChat([
      { role: "system", content: systemPrompt },
      ...safeHistory,
      { role: "user", content: userMessage },
    ], db.data?.site_settings?.aiModel);

    const user = resolveSessionUser(req);
    saveAiChatLog(user, "user", userMessage, "system");
    saveAiChatLog(user, "assistant", routed.text, routed.engine);

    res.json({ text: routed.text, engine: routed.engine });
  } catch (err: any) {
    console.error("[assistant] request failed:", err);
    const missingKey = String(err?.message || "").toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey
        ? "AI is not configured yet. Add GEMINI_API_KEY or GROQ_API_KEY in the hosted backend environment."
        : "The AI assistant is temporarily unavailable. Please try again.",
    });
  }
});

app.post("/api/visual-search/match", async (req, res) => {
  try {
    const { imageBase64, mimeType, question } = req.body || {};
    const rawImage = String(imageBase64 || "").trim();
    if (!rawImage) {
      res.status(400).json({ error: "Image data is required." });
      return;
    }

    const cleanImage = rawImage.includes(",") ? rawImage.split(",").pop() || rawImage : rawImage;
    const analysis = await analyzeImageWithGemini(cleanImage, String(mimeType || "image/jpeg"), question);
    const matches = await matchMoviesFromAnalysis(analysis);

    let aiAnswer: string | undefined;
    if (String(question || "").trim()) {
      try {
        const routed = await routedAssistantChat([
          {
            role: "system",
            content: buildAssistantSystemPrompt({
              visualContext: {
                description: analysis.description,
                analysis,
                matches: matches.map((m) => ({
                  id: m.id,
                  title: m.title || m.name || "Unknown",
                  overview: m.overview,
                  rating: m.vote_average,
                })),
              },
              sessionUser: resolveSessionUser(req),
            }),
          },
          { role: "user", content: String(question).trim() },
        ]);
        aiAnswer = routed.text;
      } catch (err) {
        console.warn("[visual-search] optional AI answer failed:", err);
      }
    }

    res.json({
      description: analysis.description,
      analysis,
      matches,
      ...(aiAnswer ? { aiAnswer } : {}),
    });
  } catch (err: any) {
    console.error("[visual-search] request failed:", err);
    const message = String(err?.message || "");
    const missingKey = message.toLowerCase().includes("api key");
    res.status(missingKey ? 503 : 500).json({
      error: missingKey
        ? "Visual search is not configured yet. Add GEMINI_API_KEY in the hosted backend environment."
        : "Visual search is temporarily unavailable. Please try again.",
    });
  }
});

function getApiKey(name: "tmdb" | "gemini" | "groq"): string {
  const fromDb = db.data?.site_settings?.apiKeys?.[name];
  const fromEnv = name === "tmdb"
    ? process.env.TMDB_API_KEY
    : name === "gemini"
    ? process.env.GEMINI_API_KEY
    : process.env.GROQ_API_KEY;
  return (fromDb || fromEnv || "").trim();
}

function getGeminiClient(): GoogleGenAI {
  const key = getApiKey("gemini");
  if (!key) throw new Error("Gemini API key not configured");
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

async function analyzeImageWithGemini(imageBase64: string, mimeType: string, userQuestion?: string): Promise<VisualAnalysis & { description: string }> {
  const questionBlock = userQuestion
    ? `\nThe user also asks: "${userQuestion}" — factor this into your genre/keyword choices.`
    : "";

  const prompt = `You are a film curator analyzing an image (poster, screenshot, or photo) to find visually or thematically similar movies.
Look at composition, color palette, lighting, mood, setting, and recognizable film cues.${questionBlock}
If this is clearly a known movie poster or screenshot, extract the exact title and year.
Respond with ONLY raw JSON (no markdown fences):
{
  "description": "one vivid sentence describing the image and its cinematic mood",
  "genres": ["up to 3 TMDB genre names e.g. Science Fiction, Horror, Action"],
  "keywords": ["3-6 visual/theme keywords"],
  "moodTags": ["2-4 mood words e.g. moody, vibrant, gritty"],
  "exactTitle": "exact movie/show title if recognizable, else null",
  "exactYear": "YYYY release year if known, else null",
  "isKnownPoster": true or false
}`;

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
        ],
      },
    ],
  });

  const rawText = (response as any).text ?? (response as any).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      description: parsed.description || "A visually distinct image.",
      genres: parsed.genres || [],
      keywords: parsed.keywords || [],
      moodTags: parsed.moodTags || [],
      exactTitle: parsed.exactTitle || null,
      exactYear: parsed.exactYear || null,
      isKnownPoster: !!parsed.isKnownPoster,
    };
  } catch {
    return {
      description: "A visually distinct image with cinematic qualities.",
      genres: [],
      keywords: [],
      moodTags: [],
      exactTitle: null,
      exactYear: null,
      isKnownPoster: false,
    };
  }
}

async function groqChat(messages: Array<{ role: string; content: string }>, model?: string): Promise<string> {
  const groqKey = getApiKey("groq").replace(/\/$/, "");
  if (!groqKey) throw new Error("Groq API key not configured");

  const aiModel = model || db.data?.site_settings?.aiModel || "llama-3.1-8b-instant";

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: aiModel,
      messages,
      temperature: 0.6,
      max_tokens: 1024,
    }),
  });

  if (!groqResponse.ok) {
    const errorText = await groqResponse.text();
    let detail = `Groq returned status ${groqResponse.status}`;
    try {
      const parsedErr = JSON.parse(errorText);
      if (parsedErr?.error?.message) detail = parsedErr.error.message;
    } catch {
      /* keep generic */
    }
    throw new Error(detail);
  }

  const groqData = await groqResponse.json();
  return groqData.choices?.[0]?.message?.content || "I couldn't formulate an answer right now.";
}

async function geminiChat(messages: Array<{ role: string; content: string }>): Promise<string> {
  const ai = getGeminiClient();
  const system = messages.find((m) => m.role === "system")?.content || "";
  const turns = messages.filter((m) => m.role !== "system");
  const response = await ai.models.generateContent({
    model: db.data?.site_settings?.aiPrimaryModel || "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${system}\n\nCONVERSATION:\n${turns
              .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
              .join("\n")}`,
          },
        ],
      },
    ],
  });
  const text = (response as any).text ?? (response as any).candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("Gemini returned an empty response");
  return text.trim();
}

async function routedAssistantChat(messages: Array<{ role: string; content: string }>, groqModel?: string): Promise<{ text: string; engine: "gemini" | "groq" }> {
  try {
    return { text: await geminiChat(messages), engine: "gemini" };
  } catch (err) {
    console.warn("[assistant] Gemini primary failed; falling back to Groq:", err);
    return { text: await groqChat(messages, groqModel), engine: "groq" };
  }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(String(text || "").length / 4));
}

function saveAiChatLog(user: ReturnType<typeof getUserById> | undefined, role: "user" | "assistant", message: string, engine: "gemini" | "groq" | "system") {
  db.data.ai_chat_history.push({
    id: crypto.randomUUID(),
    user_id: user?.id || null,
    user_name: user?.name || null,
    role,
    message: String(message || "").slice(0, 12000),
    engine,
    tokens_estimate: estimateTokens(message),
    created_at: new Date().toISOString(),
  });
  db.data.ai_chat_history = db.data.ai_chat_history.slice(-2000);
  db.save();
}

function resolveSessionUser(req: express.Request) {
  const userId = getOptionalUserId(req as AuthedRequest);
  return userId ? getUserById(userId) : undefined;
}

function buildAssistantSystemPrompt(opts: {
  movieContext?: any;
  visualContext?: any;
  sessionUser?: ReturnType<typeof getUserById>;
}): string {
  const settings = db.data?.site_settings || {};
  let systemPrompt =
    'You are "All Kiki\'s", the official Cinemax AI Agent — expert, friendly, and deeply knowledgeable about every feature on the Cinemax website.\n\n';
  systemPrompt += buildCinemaxKnowledgeBase();
  systemPrompt += "\n\nRESPONSE STYLE: Cinematic, engaging, concise. Use bullets or bold for lists. Match the user's language exactly (including fluent Kinyarwanda).\n";
  systemPrompt +=
    "SITE ACTIONS: When the user explicitly requests a settings change, end with ONE ```action\\n{JSON}\\n``` block. Valid types: update_name, toggle_autoplay_next, toggle_autoplay_trailers, set_subtitle_language, set_default_quality, toggle_mature_lock, clear_watch_history, navigate (home|movies|tv|mylist|watchlist|history|favorites|downloads|profile|help). Only one action block when clearly requested.\n";

  if (settings.aiSystemPromptExtra) {
    systemPrompt += `\n\nADMIN CUSTOM INSTRUCTIONS:\n${settings.aiSystemPromptExtra}`;
  }
  const memories = (db.data?.ai_memory || []).filter((m) => m.enabled).slice(-30);
  if (memories.length) {
    systemPrompt += `\n\nAPPROVED AI MEMORY BANK:\n${memories.map((m) => `- ${m.title}: ${m.content}`).join("\n")}`;
  }

  const u = opts.sessionUser;
  if (u) {
    systemPrompt += `\n\n[SIGNED-IN USER: ${u.name} (${u.email}), role: ${u.role}, subscription: ${u.subscription || "Free"}]`;
    if (u.role === "admin") {
      systemPrompt += `\nThis user is a CINEMAX ADMINISTRATOR with access to the Admin Panel. Address them professionally. Help with site management, content curation, Help Desk inquiries, broadcasts, and admin workflows. Never expose secrets.`;
      if (isAdminEmail(u.email)) {
        systemPrompt += `\nThis is the PRIMARY platform owner (allkikisweb@gmail.com) — highest priority for admin guidance.`;
      }
    }
    try {
      const prefs = JSON.parse(u.preferences || "{}");
      systemPrompt += `\nUser preferences snapshot: appLanguage=${prefs.appLanguage || "English"}, autoplayNext=${prefs.autoplayNext}, defaultQuality=${prefs.defaultQuality}, subtitleLanguage=${prefs.subtitleLanguage}.`;
    } catch {
      /* ignore */
    }
  } else {
    systemPrompt += "\n\n[VISITOR: Not signed in — guest browsing or anonymous. Remind them to sign in for downloads, My List, and profile features when relevant.]";
  }

  if (opts.visualContext) {
    systemPrompt += `\n\n[VISUAL SEARCH CONTEXT — user uploaded an image]\nImage analysis: ${opts.visualContext.description}`;
    if (opts.visualContext.analysis) {
      systemPrompt += `\nGenres: ${(opts.visualContext.analysis.genres || []).join(", ")}`;
      systemPrompt += `\nMood: ${(opts.visualContext.analysis.moodTags || []).join(", ")}`;
    }
    if (opts.visualContext.matches?.length) {
      systemPrompt += `\nMatched titles:\n${opts.visualContext.matches
        .map((m: any, i: number) => `${i + 1}. ${m.title} (TMDB #${m.id})${m.rating ? ` — ${m.rating}/10` : ""}`)
        .join("\n")}`;
    }
    systemPrompt += "\nAnswer follow-up questions about these matches with specific references to the list above.";
  }

  if (opts.movieContext) {
    systemPrompt += `\n\n[CURRENT TITLE: "${opts.movieContext.title || opts.movieContext.name || "Unknown"}"]`;
    if (opts.movieContext.overview) systemPrompt += `\nOverview: ${opts.movieContext.overview}`;
  }

  return systemPrompt;
}

// ---------------------------------------------------------------------------
// STARTUP — connect to Mongo, load state, seed admin, then listen.
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 5000;

async function start() {
  await connectDB();
  await initDb();
  try {
    seedAdminUser();
  } catch (err) {
    console.error("[startup] seedAdminUser failed:", err);
  }
  app.listen(PORT, () => {
    console.log(`🚀 Cinemax Backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("[startup] Fatal error:", err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} received — flushing DB…`);
  try {
    await flushDb();
  } catch (err) {
    console.error("[shutdown] flush failed:", err);
  }
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
