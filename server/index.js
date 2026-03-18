import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const buildPrompt = ({ studentName, average, tone, principles, freeText }) => {
  const trimmedName = String(studentName || "").trim();
  const safeAverage = String(average || "non communiquee").trim() || "non communiquee";
  const principlesText = principles.length ? principles.join(", ") : "aucun principe specifique";
  const contextText = freeText ? String(freeText).trim() : "aucune note complementaire";

  return [
    "Tu rediges une appreciation de bulletin en francais pour un enseignant.",
    "Rends uniquement le texte final de l'appreciation, sans guillemets, sans liste, sans preambule.",
    "Le texte doit etre naturel, professionnel, fluide, entre 2 et 3 phrases, et rester compatible avec un bulletin Pronote.",
    "Evite les formulations trop generiques, les emojis, et toute invention factuelle excessive.",
    "Adapte le ton demande: bienveillant, neutre, pro ou alarmiste.",
    `Eleve: ${trimmedName}`,
    `Moyenne: ${safeAverage}`,
    `Ton attendu: ${tone}`,
    `Principes a mentionner si pertinent: ${principlesText}`,
    `Notes complementaires: ${contextText}`,
  ].join("\n");
};

const extractGeminiText = (payload) => {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join(" ")
    .trim();

  return text ? text.replace(/^['\"]|['\"]$/g, "").trim() : "";
};

const generateAppreciation = async (input) => {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY manquante");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(input),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 180,
        },
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Erreur Gemini ${response.status}`);
  }

  const appreciation = extractGeminiText(payload);
  if (!appreciation) {
    throw new Error("Reponse Gemini vide ou invalide");
  }

  return appreciation;
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

      const appreciation = await generateAppreciation({
        studentName,
        average: typeof body.average === "string" ? body.average : "",
        tone: typeof body.tone === "string" ? body.tone : "neutre",
        principles: normalizeList(body.principles),
        freeText: typeof body.freeText === "string" ? body.freeText : "",
      });

      sendJson(response, 200, {
        ok: true,
        appreciation,
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