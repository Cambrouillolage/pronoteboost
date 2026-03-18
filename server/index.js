import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  generateAppreciationForStudent,
  buildPrompt,
} from "./aiService.js";

const ENV_PATH = resolve(process.cwd(), ".env");

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
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

loadEnvFile();

const PORT = Number(process.env.PORT || 8787);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_PROMPT_APPEND = process.env.GEMINI_PROMPT_APPEND || "";

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


const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 404, { ok: false, error: "Route introuvable" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || `localhost:${PORT}`}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      model: GEMINI_MODEL,
      hasGeminiKey: Boolean(GEMINI_API_KEY),
      acceptsClientGeminiKey: false,
      message: "Clé API serveur uniquement (pas de clé côté client)",
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

      if (!GEMINI_API_KEY) {
        sendJson(response, 500, {
          ok: false,
          error: "GEMINI_API_KEY is not configured on the server. Please set it in .env",
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
          additionalPromptInstructions: GEMINI_PROMPT_APPEND,
        },
        GEMINI_API_KEY,
        GEMINI_MODEL,
      );

      sendJson(response, 200, {
        ok: true,
        ...result,
      });
      return;
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Erreur serveur",
      });
      return;
    }
  }

  sendJson(response, 404, { ok: false, error: "Route introuvable" });
});

server.listen(PORT, () => {
  console.log(`PronoteBoost Gemini backend listening on http://localhost:${PORT}`);
});