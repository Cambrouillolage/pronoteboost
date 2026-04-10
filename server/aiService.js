/**
 * PronoteBoost AI Service (OpenAI)
 *
 * Centralizes all AI-related logic:
 * - Prompt construction (subject, teacher preferences, student data)
 * - OpenAI Responses API calls
 * - Response parsing and validation
 * - Error handling with fallback model support
 */

const TONE_GUIDE = {
  bienveillant: "encourageant et valorisant",
  neutre: "factuel, mesure et clair",
  pro: "institutionnel, rigoureux et concis",
  alarmiste: "alerte pedagogique, sans agressivite",
};

const SCHOOL_LEVEL_GUIDE = {
  Maternelle: "ecole Maternelle",
  Elementaire: "ecole Elementaire",
  "Élémentaire": "ecole Elementaire",
  "Collège": "College",
  College: "College",
  "Lycée": "Lycee",
  Lycee: "Lycee",
};

const OPENAI_RESPONSES_API = "https://api.openai.com/v1/responses";

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
  const safeAverage = average && String(average).trim() ? String(average).trim() : null;
  const principlesText = (principles && principles.length) ? principles.join(", ") : "aucun principe specifique";
  const contextText = freeText ? String(freeText).trim() : "aucune note complementaire";
  const safeSubject = subject ? String(subject).trim() : "(matiere non specifiee)";
  const requestedTone = TONE_GUIDE[tone] || TONE_GUIDE.neutre;
  const levelLabel = SCHOOL_LEVEL_GUIDE[schoolLevel] || SCHOOL_LEVEL_GUIDE.College;

  const lines = [
    `Role: redacteur de bulletins scolaires francais (${levelLabel}).`,
    "Objectif: produire une appreciation personnalisee, utile au professeur et aux familles.",
    "",
    "CONTEXTE DISCIPLINAIRE:",
    `- Matiere: ${safeSubject}`,
    `- Notes du professeur sur cet eleve: ${contextText}`,
  ];

  if (teacherPreferences && teacherPreferences.length > 0) {
    lines.push("");
    lines.push("STYLE REFERENCE - Inspirez-vous des appreciations preferees du professeur:");
    teacherPreferences.forEach((pref) => {
      const trimmedPref = String(pref).trim();
      if (trimmedPref) {
        lines.push(`- \"${trimmedPref}\"`);
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
  lines.push("- Utiliser uniquement le prénom de l'élève dans l'appréciation, jamais le nom de famille.");
  lines.push("- Si le sexe de l'élève peut être déterminé avec 90 % de certitude d'après son prénom, accorder les adjectifs et participes en conséquence ; sinon, privilégier des formulations épicènes ou neutres.");
  lines.push("- L'appréciation doit être entièrement unique et personnalisée pour cet élève.");
  lines.push("- Rédiger en bon français : orthographe, grammaire et syntaxe soignées, avec accents corrects obligatoires (é, è, à, ç, ô, ï, etc.).");
  lines.push("");
  lines.push(`Ton a adopter: ${requestedTone}.`);
  lines.push("");
  lines.push("Donnees eleve:");
  lines.push(`- Prénom: ${trimmedName}`);
  if (safeAverage) {
    lines.push(`- Moyenne: ${safeAverage}/20`);
  } else {
    lines.push("- Moyenne: non evaluee (ne pas mentionner de note dans l'appreciation)");
  }
  lines.push(`- Principes a integrer si pertinents: ${principlesText}`);

  if (additionalPromptInstructions && String(additionalPromptInstructions).trim()) {
    lines.push("");
    lines.push(`Consignes supplementaires: ${String(additionalPromptInstructions).trim()}`);
  }

  return lines.join("\n");
}

function buildBatchPrompt(students, {
  subject,
  schoolLevel,
  teacherPreferences,
  additionalPromptInstructions,
} = {}) {
  const safeSubject = subject ? String(subject).trim() : "(matiere non specifiee)";
  const levelLabel = SCHOOL_LEVEL_GUIDE[schoolLevel] || SCHOOL_LEVEL_GUIDE.College;

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
      if (trimmed) lines.push(`- \"${trimmed}\"`);
    });
  }

  lines.push("");
  lines.push("CONTRAINTES POUR CHAQUE APPRECIATION:");
  lines.push("- 2 ou 3 phrases, 320 caracteres maximum par appreciation.");
  lines.push("- Style naturel et professionnel, vocabulaire simple et precis.");
  lines.push("- Ne jamais inventer de faits, sanctions, diagnostics ou elements medicaux.");
  lines.push("- Eviter les formules creuses et les repetitions entre eleves.");
  lines.push("- Orientation pedagogique: constat + perspective de progression.");
  lines.push("- Utiliser uniquement le prénom de l'élève dans l'appréciation, jamais le nom de famille.");
  lines.push("- Si le sexe de l'élève peut être déterminé avec 90 % de certitude d'après son prénom, accorder les adjectifs et participes en conséquence ; sinon, privilégier des formulations épicènes ou neutres.");
  lines.push("- Chaque appréciation doit être entièrement distincte des autres : aucune formule répétée entre élèves.");
  lines.push("- Rédiger en bon français : orthographe, grammaire et syntaxe soignées, avec accents corrects obligatoires (é, è, à, ç, ô, ï, etc.).");

  if (additionalPromptInstructions && String(additionalPromptInstructions).trim()) {
    lines.push(`- Consignes supplementaires: ${String(additionalPromptInstructions).trim()}`);
  }

  lines.push("");
  lines.push("FORMAT DE SORTIE OBLIGATOIRE:");
  lines.push("Retourne UNIQUEMENT du JSON valide, sans texte avant ni apres.");
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

function extractResponseText(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  try {
    const output = Array.isArray(payload.output) ? payload.output : [];
    const parts = [];
    for (const item of output) {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const chunk of content) {
        if (typeof chunk?.text === "string" && chunk.text.trim()) {
          parts.push(chunk.text.trim());
        }
      }
    }
    return parts.join("\n").trim();
  } catch {
    return "";
  }
}

function parseBatchResponse(payload) {
  const rawText = extractResponseText(payload);

  if (!rawText) {
    throw new Error("OpenAI a retourne une reponse vide");
  }

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
    throw new Error(`OpenAI n'a pas retourne du JSON valide: ${err.message}`);
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

function validateAndFormatOutput(appreciation) {
  const trimmed = String(appreciation || "").trim();

  if (!trimmed) {
    throw new Error("Output validation failed: appreciation is empty");
  }

  if (trimmed.length > 320) {
    throw new Error(`Output validation failed: appreciation exceeds 320 characters (got ${trimmed.length})`);
  }

  return { appreciation: trimmed };
}

function isTransientOpenAIError(status, message) {
  const transientStatuses = new Set([408, 409, 429, 500, 502, 503, 504]);
  if (transientStatuses.has(status)) {
    return true;
  }

  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("high demand")
    || normalized.includes("overloaded")
    || normalized.includes("try again later")
    || normalized.includes("temporarily")
  );
}

async function callOpenAI({
  model,
  apiKey,
  systemText,
  userText,
  maxOutputTokens,
  jsonSchema,
}) {
  const payload = {
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemText }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userText }],
      },
    ],
    max_output_tokens: maxOutputTokens,
  };

  if (jsonSchema) {
    payload.text = {
      format: {
        type: "json_schema",
        name: jsonSchema.name,
        schema: jsonSchema.schema,
        strict: true,
      },
    };
  }

  const response = await fetch(OPENAI_RESPONSES_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data?.error?.message || `HTTP ${response.status}`;
    const err = new Error(`OpenAI API error: ${errorMsg}`);
    err.statusCode = response.status;
    throw err;
  }

  return data;
}

async function callWithFallback({
  primaryModel,
  fallbackModel,
  apiKey,
  systemText,
  userText,
  maxOutputTokens,
  jsonSchema,
}) {
  try {
    return await callOpenAI({
      model: primaryModel,
      apiKey,
      systemText,
      userText,
      maxOutputTokens,
      jsonSchema,
    });
  } catch (error) {
    const status = error?.statusCode;
    const message = error instanceof Error ? error.message : "Unknown OpenAI error";

    if (!fallbackModel || fallbackModel === primaryModel || !isTransientOpenAIError(status, message)) {
      throw error;
    }

    console.warn(`[aiService] Primary model failed (${primaryModel}), retrying with fallback (${fallbackModel})`, {
      status,
      message,
    });

    return callOpenAI({
      model: fallbackModel,
      apiKey,
      systemText,
      userText,
      maxOutputTokens,
      jsonSchema,
    });
  }
}

async function generateAppreciation(input, apiKey, model = "gpt-4.1-mini", fallbackModel = "gpt-4o-mini") {
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("OPENAI_API_KEY missing or invalid - configure it in .env");
  }

  const prompt = buildPrompt(input);
  console.info("[aiService] OpenAI request", {
    model,
    fallbackModel,
    hasApiKey: Boolean(apiKey && apiKey.trim()),
    promptLength: prompt.length,
  });

  try {
    const payload = await callWithFallback({
      primaryModel: model,
      fallbackModel,
      apiKey: apiKey.trim(),
      systemText: "Tu rediges des appreciations scolaires en francais. Respecte strictement les contraintes demandees.",
      userText: prompt,
      maxOutputTokens: 220,
    });

    const appreciation = extractResponseText(payload).replace(/^['\"]|['\"]$/g, "").trim();
    if (!appreciation) {
      throw new Error("OpenAI returned empty response");
    }

    return appreciation;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate appreciation: ${error.message}`);
    }
    throw new Error("Failed to generate appreciation: unknown error");
  }
}

async function generateAppreciationForStudent(input, apiKey, model = "gpt-4.1-mini", fallbackModel = "gpt-4o-mini") {
  try {
    const appreciation = await generateAppreciation(input, apiKey, model, fallbackModel);
    return validateAndFormatOutput(appreciation);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`[AI Service] ${errorMessage}`);
  }
}

async function generateAppreciationsForBatch(
  students,
  sharedContext = {},
  apiKey,
  model = "gpt-4.1-mini",
  fallbackModel = "gpt-4o-mini",
) {
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("OPENAI_API_KEY missing or invalid - configure it in .env");
  }

  if (!Array.isArray(students) || students.length === 0) {
    throw new Error("La liste des eleves est vide");
  }

  const prompt = buildBatchPrompt(students, sharedContext);
  const maxOutputTokens = Math.min(students.length * 160 + 700, 10000);

  console.info("[aiService] OpenAI batch request", {
    model,
    fallbackModel,
    studentCount: students.length,
    hasApiKey: Boolean(apiKey && apiKey.trim()),
    promptLength: prompt.length,
    maxOutputTokens,
  });

  const schema = {
    name: "appreciations_batch",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        appreciations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              line: {
                anyOf: [{ type: "string" }, { type: "number" }],
              },
              firstName: { type: "string" },
              appreciation: { type: "string" },
            },
            required: ["line", "firstName", "appreciation"],
          },
        },
      },
      required: ["appreciations"],
    },
  };

  try {
    const payload = await callWithFallback({
      primaryModel: model,
      fallbackModel,
      apiKey: apiKey.trim(),
      systemText: "Tu rediges des appreciations scolaires en francais. Tu dois retourner strictement du JSON valide selon le schema fourni.",
      userText: prompt,
      maxOutputTokens,
      jsonSchema: schema,
    });

    return parseBatchResponse(payload);
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
  extractResponseText,
  generateAppreciation,
  validateAndFormatOutput,
  generateAppreciationForStudent,
  generateAppreciationsForBatch,
  parseBatchResponse,
  TONE_GUIDE,
  SCHOOL_LEVEL_GUIDE,
};
