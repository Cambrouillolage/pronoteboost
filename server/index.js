import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  generateAppreciationForStudent,
  generateAppreciationsForBatch,
} from "./aiService.js";

const ENV_PATH = resolve(process.cwd(), ".env");
const DOTENV_PRIORITY_KEYS = new Set([
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_FALLBACK_MODEL",
  "OPENAI_PROMPT_APPEND",
  "PORT",
]);

const loadEnvFile = () => {
  if (!existsSync(ENV_PATH)) {
    return;
  }

  const content = readFileSync(ENV_PATH, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['\"]|['\"]$/g, "");
    if (!key) {
      continue;
    }

    const hasExistingValue = process.env[key] !== undefined;
    const shouldOverrideFromDotEnv = DOTENV_PRIORITY_KEYS.has(key);

    if (!hasExistingValue || shouldOverrideFromDotEnv) {
      if (hasExistingValue && process.env[key] !== value && shouldOverrideFromDotEnv) {
        console.warn(`[PronoteBoost API] .env overrides inherited env for '${key}' (local precedence)`);
      }
      process.env[key] = value;
    } else {
      console.warn(`[PronoteBoost API] .env: '${key}' already set via shell/system env — .env value ignored (precedence rule)`);
    }
  }
};

loadEnvFile();

const PORT = Number(process.env.PORT || 8787);
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_PROMPT_APPEND = process.env.OPENAI_PROMPT_APPEND || "";

// Safe runtime diagnostics — never expose the full key
const getVarSource = (envKey) => (process.env[envKey] !== undefined ? "env" : "default");
const computeKeyFingerprint = (key) => {
  if (!key || key.length < 10) return null;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
};
const OPENAI_MODEL_SOURCE = getVarSource("OPENAI_MODEL");
const OPENAI_KEY_FINGERPRINT = computeKeyFingerprint(OPENAI_API_KEY);

console.info(`[PronoteBoost API] provider=openai model=${OPENAI_MODEL} (source: ${OPENAI_MODEL_SOURCE})`);
console.info(`[PronoteBoost API] openaiKey=${OPENAI_KEY_FINGERPRINT ?? "NOT SET"} (hasKey: ${Boolean(OPENAI_API_KEY)})`);

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  response.end(JSON.stringify(payload));
};

const readJsonBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
};

const normalizeList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

const isQuotaOrRateLimitError = (message) => {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("rate limit")
    || normalized.includes("quota")
    || normalized.includes("quota exceeded")
    || normalized.includes("resource_exhausted")
    || normalized.includes("too many requests")
    || normalized.includes("insufficient_quota")
  );
};

const isAuthKeyError = (message) => {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("api key was reported as leaked")
    || normalized.includes("incorrect api key")
    || normalized.includes("api key not valid")
    || normalized.includes("invalid api key")
    || normalized.includes("permission denied")
    || normalized.includes("unauthenticated")
    || normalized.includes("invalid_api_key")
  );
};

const isHighDemandError = (message) => {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("high demand")
    || normalized.includes("overloaded")
    || normalized.includes("try again later")
    || normalized.includes("temporarily")
  );
};

const getErrorStatusCode = (error) => {
  const message = error instanceof Error ? error.message : "";
  if (isAuthKeyError(message)) {
    return 401;
  }

  if (isQuotaOrRateLimitError(message)) {
    return 429;
  }

  if (isHighDemandError(message)) {
    return 503;
  }

  return 500;
};


const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 404, { ok: false, error: "Route introuvable" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || `localhost:${PORT}`}`);

  if (request.method && request.method !== "OPTIONS") {
    console.info(`[PronoteBoost API] ${request.method} ${url.pathname}`);
  }

  if (request.method === "OPTIONS") {
    sendJson(response, 204, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      provider: "openai",
      model: OPENAI_MODEL,
      fallbackModel: OPENAI_FALLBACK_MODEL,
      modelSource: OPENAI_MODEL_SOURCE,
      hasOpenAiKey: Boolean(OPENAI_API_KEY),
      keyFingerprint: OPENAI_KEY_FINGERPRINT,
      acceptsClientOpenAiKey: false,
      message: "Cle API serveur uniquement (pas de cle cote client)",
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/generate-appreciation") {
    try {
      const body = await readJsonBody(request);
      const studentName = typeof body.studentName === "string" ? body.studentName.trim() : "";

      if (!studentName) {
        sendJson(response, 400, { ok: false, error: "studentName est requis" });
        return;
      }

      if (!OPENAI_API_KEY) {
        console.error("[PronoteBoost API] OPENAI_API_KEY missing for /api/generate-appreciation");
        sendJson(response, 500, {
          ok: false,
          error: "OPENAI_API_KEY is not configured on the server. Please set it in .env",
          code: "OPENAI_KEY_MISSING",
        });
        return;
      }

      const result = await generateAppreciationForStudent(
        {
          studentName,
          average: typeof body.average === "string" ? body.average : "",
          tone: typeof body.tone === "string" ? body.tone : "neutre",
          principles: normalizeList(body.principles),
          freeText: typeof body.freeText === "string" ? body.freeText : "",
          subject: typeof body.subject === "string" ? body.subject : "",
          teacherPreferences: normalizeList(body.teacherPreferences),
          additionalPromptInstructions: OPENAI_PROMPT_APPEND,
        },
        OPENAI_API_KEY,
        OPENAI_MODEL,
        OPENAI_FALLBACK_MODEL,
      );

      sendJson(response, 200, {
        ok: true,
        ...result,
      });
      console.info(`[PronoteBoost API] /api/generate-appreciation ok for ${studentName}`);
      return;
    } catch (error) {
      console.error("[PronoteBoost API] /api/generate-appreciation failed:", error);
      sendJson(response, getErrorStatusCode(error), {
        ok: false,
        error: error instanceof Error ? error.message : "Erreur serveur",
      });
      return;
    }
  }

  // ── Endpoint batch ─────────────────────────────────────────────────────────
  // POST /api/generate-appreciations
  //
  // Reçoit tous les eleves d'une classe et retourne toutes les appreciations
  // en UN SEUL appel OpenAI (voir aiService.js pour le detail de la logique).
  //
  // Corps de la requête:
  //   {
  //     students: [
  //       { line: 1, firstName: "Maxime", average?: "14.5", tone: "neutre",
  //         principles?: [...], freeText?: "..." }
  //     ],
  //     subject: "Mathématiques",
  //     schoolLevel: "Collège",          // Maternelle | Élémentaire | Collège | Lycée
  //     teacherPreferences?: ["..."]    // optionnel
  //   }
  //
  // Réponse:
  //   { ok: true, appreciations: [{ line: 1, firstName: "Maxime", appreciation: "..." }] }
  //
  if (request.method === "POST" && url.pathname === "/api/generate-appreciations") {
    try {
      const body = await readJsonBody(request);

      if (!Array.isArray(body.students) || body.students.length === 0) {
        sendJson(response, 400, { ok: false, error: "Le champ 'students' doit etre un tableau non vide" });
        return;
      }

      if (body.students.length > 30) {
        sendJson(response, 400, { ok: false, error: "Maximum 30 eleves par requete batch" });
        return;
      }

      if (!OPENAI_API_KEY) {
        console.error("[PronoteBoost API] OPENAI_API_KEY missing for /api/generate-appreciations");
        sendJson(response, 500, {
          ok: false,
          error: "OPENAI_API_KEY is not configured on the server. Please set it in .env",
          code: "OPENAI_KEY_MISSING",
        });
        return;
      }

      const students = body.students.map((s) => ({
        line: s.line ?? s.id,
        firstName: typeof s.firstName === "string" ? s.firstName.trim() : "",
        average: typeof s.average === "string" ? s.average.trim() : "",
        tone: typeof s.tone === "string" ? s.tone : "neutre",
        principles: normalizeList(s.principles),
        freeText: typeof s.freeText === "string" ? s.freeText : "",
      }));

      const sharedContext = {
        subject: typeof body.subject === "string" ? body.subject : "",
        schoolLevel: typeof body.schoolLevel === "string" ? body.schoolLevel : "Collège",
        teacherPreferences: normalizeList(body.teacherPreferences),
        additionalPromptInstructions: OPENAI_PROMPT_APPEND,
      };

      const appreciations = await generateAppreciationsForBatch(
        students,
        sharedContext,
        OPENAI_API_KEY,
        OPENAI_MODEL,
        OPENAI_FALLBACK_MODEL,
      );

      sendJson(response, 200, { ok: true, appreciations });
      console.info(`[PronoteBoost API] /api/generate-appreciations ok (${students.length} students)`);
      return;
    } catch (error) {
      console.error("[PronoteBoost API] /api/generate-appreciations failed:", error);
      sendJson(response, getErrorStatusCode(error), {
        ok: false,
        error: error instanceof Error ? error.message : "Erreur serveur",
      });
      return;
    }
  }

  sendJson(response, 404, { ok: false, error: "Route introuvable" });
});

server.listen(PORT, () => {
  console.log(`PronoteBoost OpenAI backend listening on http://localhost:${PORT}`);
});