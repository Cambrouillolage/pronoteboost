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

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Build a comprehensive prompt for appreciation generation
 * 
 * @param {Object} input - Student and teacher context
 * @param {string} input.studentName - Student full name
 * @param {string} input.average - Student average grade
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
  tone,
  principles,
  freeText,
  subject,
  teacherPreferences,
  additionalPromptInstructions,
}) {
  const trimmedName = String(studentName || "").trim();
  const safeAverage = String(average || "non communiquee").trim() || "non communiquee";
  const principlesText = (principles && principles.length)
    ? principles.join(", ")
    : "aucun principe specifique";
  const contextText = freeText ? String(freeText).trim() : "aucune note complementaire";
  const safeSubject = subject ? String(subject).trim() : "(matiere non specifiee)";
  const requestedTone = TONE_GUIDE[tone] || TONE_GUIDE.neutre;

  const lines = [
    "Role: redacteur de bulletin scolaire francais (niveau college/lycee).",
    "Objectif: produire une appreciation utile au professeur principal et aux familles.",
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
  lines.push(`- Moyenne: ${safeAverage}`);
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

export {
  buildPrompt,
  extractGeminiText,
  generateAppreciation,
  validateAndFormatOutput,
  generateAppreciationForStudent,
  TONE_GUIDE,
};
