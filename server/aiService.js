/**
 * PronoteBoost AI Service
 * 
 * Centralizes all AI-related logic:
 * - Prompt construction (with subject, teacher preferences, student data)
 * - API calls to Gemini
 * - Response parsing and validation
 * - Error handling with detailed messages
 */

const TONE_GUIDE = {
  bienveillant: "encourageant et valorisant",
  neutre: "factuel, mesure et clair",
  pro: "institutionnel, rigoureux et concis",
  alarmiste: "alerte pedagogique, sans agressivite",
};

// ── Niveaux scolaires ─────────────────────────────────────────────────────────
//
// Valeurs acceptées pour le paramètre `schoolLevel`. Le libellé est injecté
// directement dans le rôle du prompt, ce qui oriente le registre de Gemini:
// vocabulaire accessible pour Maternelle/Élémentaire, institutionnel pour Lycée.
//
const SCHOOL_LEVEL_GUIDE = {
  "Maternelle": "école Maternelle",
  "Élémentaire": "école Élémentaire",
  "Collège": "Collège",
  "Lycée": "Lycée",
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Build a prompt for a single-student appreciation generation.
 * Utilisé par l'endpoint `/api/generate-appreciation` (singulier, rétrocompatible).
 *
 * @param {Object} input - Student and teacher context
 * @param {string} input.studentName - Student full name
 * @param {string} [input.average] - Student average grade (optional — absent → "non evaluee")
 * @param {string} [input.schoolLevel] - School level: "Maternelle"|"Élémentaire"|"Collège"|"Lycée"
 * @param {string} input.tone - One of: bienveillant, neutre, pro, alarmiste
 * @param {string[]} input.principles - Key principles to mention (e.g., "Participation active")
 * @param {string} input.freeText - Free-form teacher notes for this student
 * @param {string} input.subject - School subject (e.g., "Anglais", "Mathématiques")
 * @param {string[]} input.teacherPreferences - Preferred appreciation phrases from teacher
 * @param {string} input.additionalPromptInstructions - Custom instructions from env (GEMINI_PROMPT_APPEND)
 *
 * @returns {string} Complete prompt for Gemini
 */
function buildPrompt({
  studentName,
  average,
  schoolLevel,
  tone,
  principles,
  freeText,
  subject,
  teacherPreferences,
  additionalPromptInstructions,
}) {
  const trimmedName = String(studentName || "").trim();
  // La moyenne est optionnelle: si vide ou absente, on indique "non evaluee" pour que
  // Gemini ne mentionne pas de note dans l'appréciation plutôt qu'une valeur confuse.
  const safeAverage = average && String(average).trim() ? String(average).trim() : null;
  const principlesText = (principles && principles.length)
    ? principles.join(", ")
    : "aucun principe specifique";
  const contextText = freeText ? String(freeText).trim() : "aucune note complementaire";
  const safeSubject = subject ? String(subject).trim() : "(matiere non specifiee)";
  const requestedTone = TONE_GUIDE[tone] || TONE_GUIDE.neutre;
  const levelLabel = SCHOOL_LEVEL_GUIDE[schoolLevel] || SCHOOL_LEVEL_GUIDE["Collège"];

  const lines = [
    `Role: redacteur de bulletins scolaires francais (${levelLabel}).`,
    "Objectif: produire une appreciation personnalisee, utile au professeur et aux familles.",
    "",
    "CONTEXTE DISCIPLINAIRE:",
    `- Matiere: ${safeSubject}`,
    `- Notes du professeur sur cet eleve: ${contextText}`,
  ];

  // Add teacher preferences if available
  if (teacherPreferences && teacherPreferences.length > 0) {
    lines.push("");
    lines.push("STYLE REFERENCE - Inspirez-vous des appreciations preferees du professeur:");
    teacherPreferences.forEach((pref) => {
      const trimmedPref = String(pref).trim();
      if (trimmedPref) {
        lines.push(`- "${trimmedPref}"`);
      }
    });
  }

  lines.push("");
  lines.push("Contraintes de sortie:");
  lines.push("- Renvoyer uniquement le texte final, sans guillemets ni liste.");
  lines.push("- 2 ou 3 phrases, 320 caracteres maximum.");
  lines.push("- Style naturel et professionnel, vocabulaire simple et precis.");
  lines.push("- Ne jamais inventer de faits, sanctions, diagnostics ou elements medicaux.");
  lines.push("- Eviter toute formule creuse et toute repetition.");
  lines.push("- Conserver une orientation pedagogique: constat + perspective de progression.");
  lines.push("");
  lines.push(`Ton a adopter: ${requestedTone}.`);
  lines.push("");
  lines.push("Donnees eleve:");
  lines.push(`- Nom: ${trimmedName}`);
  if (safeAverage) {
    lines.push(`- Moyenne: ${safeAverage}/20`);
  } else {
    lines.push("- Moyenne: non evaluee (ne pas mentionner de note dans l'appreciation)");
  }
  lines.push(`- Principes a integrer si pertinents: ${principlesText}`);

  // Add custom instructions if provided
  if (additionalPromptInstructions && String(additionalPromptInstructions).trim()) {
    lines.push("");
    lines.push(`Consignes supplementaires: ${String(additionalPromptInstructions).trim()}`);
  }

  return lines.join("\n");
}

/**
 * Extract text from Gemini API response
 * 
 * @param {Object} payload - Gemini API response body
 * @returns {string} Extracted text or empty string if parsing fails
 */
function extractGeminiText(payload) {
  try {
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join(" ")
      .trim();

    return text ? text.replace(/^['\"]|['\"]$/g, "").trim() : "";
  } catch (err) {
    console.error("[aiService] Failed to extract Gemini text:", err.message);
    return "";
  }
}

/**
 * Call Gemini API to generate appreciation
 * 
 * @param {Object} input - Student and teacher context (see buildPrompt for fields)
 * @param {string} apiKey - Gemini API key (from server environment only)
 * @param {string} model - Gemini model to use (default: gemini-2.0-flash)
 * @returns {Promise<string>} Generated appreciation text
 * @throws {Error} If API call fails, response is invalid, or output is empty
 */
async function generateAppreciation(input, apiKey, model = "gemini-2.0-flash") {
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY missing or invalid - configure it in .env");
  }

  const prompt = buildPrompt(input);

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(
        apiKey.trim(),
      )}`,
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
                  text: prompt,
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
      const errorMsg = payload?.error?.message || `HTTP ${response.status}`;
      throw new Error(`Gemini API error: ${errorMsg}`);
    }

    const appreciation = extractGeminiText(payload);

    if (!appreciation || appreciation === "") {
      throw new Error("Gemini returned empty or unparseable response");
    }

    return appreciation;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate appreciation: ${error.message}`);
    }
    throw new Error("Failed to generate appreciation: unknown error");
  }
}

/**
 * Validate and format the final output JSON
 * 
 * @param {string} appreciation - Generated appreciation text
 * @returns {Object} Validated response object
 * @throws {Error} If appreciation is invalid
 */
function validateAndFormatOutput(appreciation) {
  const trimmed = String(appreciation || "").trim();

  if (!trimmed) {
    throw new Error("Output validation failed: appreciation is empty");
  }

  if (trimmed.length > 320) {
    throw new Error(`Output validation failed: appreciation exceeds 320 characters (got ${trimmed.length})`);
  }

  return {
    appreciation: trimmed,
  };
}

/**
 * Main entry point: Generate and validate a single appreciation
 * 
 * @param {Object} input - Full input object with student data and teacher preferences
 * @param {string} apiKey - Gemini API key (server-side only)
 * @param {string} model - Gemini model to use
 * @returns {Promise<Object>} { appreciation: string }
 * @throws {Error} With detailed context if any step fails
 */
async function generateAppreciationForStudent(input, apiKey, model = "gemini-2.0-flash") {
  try {
    const appreciation = await generateAppreciation(input, apiKey, model);
    const output = validateAndFormatOutput(appreciation);
    return output;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`[AI Service] ${errorMessage}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MODE BATCH — COMMENT ÇA FONCTIONNE
// ══════════════════════════════════════════════════════════════════════════════
//
// Problème résolu:
//   Appeler Gemini 30 fois (une par élève) prendrait ~30 secondes et multiplie
//   les coûts. Le mode batch envoie TOUS les élèves dans UN SEUL prompt et
//   récupère toutes les appréciations en une seule réponse JSON structurée.
//
// Flux complet:
//   Client → POST /api/generate-appreciations
//     → buildBatchPrompt(students, sharedContext)   ← construit 1 prompt
//     → Gemini API (1 seul appel)                  ← génère tout d'un coup
//     → parseGeminiBatchResponse(payload)           ← extrait le JSON
//   Client ← { ok: true, appreciations: [{line, firstName, appreciation}] }
//
// Structure du prompt généré par buildBatchPrompt:
//
//   ┌─ [1] RÔLE & OBJECTIF ────────────────────────────────────────────────┐
//   │  Indique à Gemini son rôle et le niveau scolaire (Maternelle,        │
//   │  Élémentaire, Collège, Lycée). Le niveau influence le registre:      │
//   │  vocabulaire simple pour le primaire, institutionnel au lycée.       │
//   └──────────────────────────────────────────────────────────────────────┘
//
//   ┌─ [2] CONTEXTE COMMUN À LA CLASSE ────────────────────────────────────┐
//   │  Matière + appréciations-types préférées du prof (teacherPrefs).     │
//   │  Partagés par tous les élèves de la requête.                         │
//   └──────────────────────────────────────────────────────────────────────┘
//
//   ┌─ [3] FORMAT DE SORTIE JSON OBLIGATOIRE ──────────────────────────────┐
//   │  Gemini doit retourner UNIQUEMENT du JSON valide:                    │
//   │  { "appreciations": [                                                │
//   │      { "line": 1, "firstName": "Maxime", "appreciation": "..." },   │
//   │      { "line": 3, "firstName": "Sophie", "appreciation": "..." }    │
//   │  ]}                                                                  │
//   │  → `line` = identifiant de ligne Pronote → mapping côté client      │
//   │    sans ambiguïté même si les prénoms se ressemblent.                │
//   └──────────────────────────────────────────────────────────────────────┘
//
//   ┌─ [4] LISTE DES ÉLÈVES ────────────────────────────────────────────────┐
//   │  Chaque élève est décrit individuellement:                           │
//   │    Line 1 - Maxime:                                                  │
//   │    - Ton: neutre (factuel, mesuré et clair)                          │
//   │    - Moyenne: 14.5/20  (ou "non évaluée" si absente)                │
//   │    - Principes à mentionner: Travail régulier, Participation active  │
//   │    - Notes du professeur: bon élève, attention à rester concentré    │
//   └──────────────────────────────────────────────────────────────────────┘
//
// Pourquoi ça marche:
//   - Les LLMs sont très efficaces pour les tâches répétitives en batch dans
//     un même contexte: ils maintiennent le style et évitent les formules
//     répétitives entre élèves, ce qu'on ne peut pas garantir avec 30 appels.
//   - `responseMimeType: "application/json"` force Gemini à retourner du JSON
//     pur sans enveloppe Markdown (``` json ```).
//
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Build a single prompt that covers an entire class (up to 30 students).
 * Used by the batch endpoint `/api/generate-appreciations`.
 *
 * @param {Array<Object>} students - List of students
 * @param {number|string} students[].line - Pronote row identifier (used to map response back)
 * @param {string} students[].firstName - Student first name
 * @param {string} [students[].average] - Average grade (optional — omitted → "non evaluee")
 * @param {string} [students[].tone] - One of: bienveillant, neutre, pro, alarmiste
 * @param {string[]} [students[].principles] - Pedagogical principles to mention
 * @param {string} [students[].freeText] - Free-form teacher notes for this student
 * @param {Object} [sharedContext] - Context common to all students in the request
 * @param {string} [sharedContext.subject] - School subject
 * @param {string} [sharedContext.schoolLevel] - "Maternelle"|"Élémentaire"|"Collège"|"Lycée"
 * @param {string[]} [sharedContext.teacherPreferences] - Teacher's preferred appreciation phrases
 * @param {string} [sharedContext.additionalPromptInstructions] - Extra instructions from env
 * @returns {string} Complete prompt for Gemini
 */
function buildBatchPrompt(students, {
  subject,
  schoolLevel,
  teacherPreferences,
  additionalPromptInstructions,
} = {}) {
  const safeSubject = subject ? String(subject).trim() : "(matiere non specifiee)";
  const levelLabel = SCHOOL_LEVEL_GUIDE[schoolLevel] || SCHOOL_LEVEL_GUIDE["Collège"];

  const lines = [
    `Role: redacteur d'appreciations scolaires pour bulletins de fin de trimestre (${levelLabel}).`,
    "Objectif: rediger une appreciation personnalisee et unique pour chaque eleve liste ci-dessous.",
    "",
    "CONTEXTE COMMUN A LA CLASSE:",
    `- Matiere: ${safeSubject}`,
    `- Niveau scolaire: ${levelLabel}`,
  ];

  if (teacherPreferences && teacherPreferences.length > 0) {
    lines.push("");
    lines.push("STYLE REFERENCE - L'enseignant prefere ces formulations (inspire-toi en les adaptant):");
    teacherPreferences.forEach((pref) => {
      const trimmed = String(pref).trim();
      if (trimmed) lines.push(`- "${trimmed}"`);
    });
  }

  lines.push("");
  lines.push("CONTRAINTES POUR CHAQUE APPRECIATION:");
  lines.push("- 2 ou 3 phrases, 320 caracteres maximum par appreciation.");
  lines.push("- Style naturel et professionnel, vocabulaire simple et precis.");
  lines.push("- Ne jamais inventer de faits, sanctions, diagnostics ou elements medicaux.");
  lines.push("- Eviter les formules creuses et les repetitions entre eleves.");
  lines.push("- Orientation pedagogique: constat + perspective de progression.");

  if (additionalPromptInstructions && String(additionalPromptInstructions).trim()) {
    lines.push(`- Consignes supplementaires: ${String(additionalPromptInstructions).trim()}`);
  }

  // Explicit JSON output schema so Gemini knows exactly what shape to produce
  lines.push("");
  lines.push("FORMAT DE SORTIE OBLIGATOIRE:");
  lines.push("Retourne UNIQUEMENT du JSON valide, sans texte avant ni apres, sans bloc ```json.");
  lines.push('{"appreciations":[{"line":<identifiant Pronote>,"firstName":"<prenom>","appreciation":"<texte redige>"},...]}');

  lines.push("");
  lines.push("=== LISTE DES ELEVES ===");

  for (const student of students) {
    const line = student.line ?? student.id;
    const firstName = String(student.firstName || "").trim();
    const tone = TONE_GUIDE[student.tone] || TONE_GUIDE.neutre;
    const averageText = student.average && String(student.average).trim()
      ? `${String(student.average).trim()}/20`
      : "non evaluee";
    const principlesText = (student.principles && student.principles.length)
      ? student.principles.join(", ")
      : "aucun";
    const context = student.freeText ? String(student.freeText).trim() : "aucune note";

    lines.push("");
    lines.push(`Line ${line} - ${firstName}:`);
    lines.push(`- Ton: ${student.tone || "neutre"} (${tone})`);
    lines.push(`- Moyenne: ${averageText}`);
    lines.push(`- Principes a mentionner si pertinents: ${principlesText}`);
    lines.push(`- Notes du professeur: ${context}`);
  }

  return lines.join("\n");
}

/**
 * Parse and validate the JSON batch response from Gemini.
 *
 * Even with `responseMimeType: "application/json"`, Gemini can occasionally
 * wrap the output in ```json fences. This function handles both cases and
 * validates that every entry has a non-empty appreciation text.
 *
 * @param {Object} payload - Raw Gemini API response object
 * @returns {Array<{line: number|string, firstName: string, appreciation: string}>}
 * @throws {Error} If the response cannot be parsed or is structurally invalid
 */
function parseGeminiBatchResponse(payload) {
  let rawText;
  try {
    rawText = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  } catch (err) {
    throw new Error("Impossible d'extraire le texte de la reponse Gemini");
  }

  if (!rawText) {
    throw new Error("Gemini a retourne une reponse vide");
  }

  // Strip potential ```json ... ``` fences that Gemini may add despite instructions
  let jsonText = rawText;
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  } else {
    const objectMatch = rawText.match(/(\{[\s\S]*\})/);
    if (objectMatch) {
      jsonText = objectMatch[1].trim();
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Gemini n'a pas retourne du JSON valide: ${err.message}`);
  }

  if (!Array.isArray(parsed?.appreciations)) {
    throw new Error("Format JSON invalide: champ 'appreciations' manquant ou non-tableau");
  }

  return parsed.appreciations.map((entry) => {
    const appreciation = String(entry?.appreciation || "").trim();
    if (!appreciation) {
      throw new Error(`Appreciation vide pour line ${entry?.line ?? "inconnue"}`);
    }
    return {
      line: entry.line,
      firstName: String(entry?.firstName || "").trim(),
      appreciation,
    };
  });
}

/**
 * Generate all appreciations for a class in a single Gemini API call.
 *
 * @param {Array<Object>} students - List of students (see buildBatchPrompt for fields)
 * @param {Object} sharedContext - Context common to all students (subject, schoolLevel, etc.)
 * @param {string} apiKey - Gemini API key (server-side only)
 * @param {string} [model] - Gemini model to use
 * @returns {Promise<Array<{line, firstName, appreciation}>>}
 * @throws {Error} If the API call fails or the response cannot be parsed
 */
async function generateAppreciationsForBatch(students, sharedContext = {}, apiKey, model = "gemini-2.0-flash") {
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY missing or invalid - configure it in .env");
  }

  if (!Array.isArray(students) || students.length === 0) {
    throw new Error("La liste des eleves est vide");
  }

  const prompt = buildBatchPrompt(students, sharedContext);

  // Scale token limit to class size: ~150 tokens per appreciation + JSON overhead
  const maxOutputTokens = Math.min(students.length * 150 + 500, 8192);

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens,
            // Forces Gemini to return pure JSON without Markdown fences (gemini-1.5+)
            responseMimeType: "application/json",
          },
        }),
      },
    );

    const payload = await response.json();

    if (!response.ok) {
      const errorMsg = payload?.error?.message || `HTTP ${response.status}`;
      throw new Error(`Gemini API error: ${errorMsg}`);
    }

    return parseGeminiBatchResponse(payload);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Echec de generation batch: ${error.message}`);
    }
    throw new Error("Echec de generation batch: erreur inconnue");
  }
}

export {
  buildPrompt,
  buildBatchPrompt,
  extractGeminiText,
  generateAppreciation,
  validateAndFormatOutput,
  generateAppreciationForStudent,
  generateAppreciationsForBatch,
  parseGeminiBatchResponse,
  TONE_GUIDE,
  SCHOOL_LEVEL_GUIDE,
};
