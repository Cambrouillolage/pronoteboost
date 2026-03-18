type Tone = "bienveillant" | "neutre" | "pro" | "alarmiste";

export interface GeminiGenerateInput {
  studentName: string;
  average: string;
  tone: Tone;
  principles: string[];
  freeText: string;
  subject?: string;
  teacherPreferences?: string[];
}

export interface GeminiGenerateResponse {
  appreciation: string;
}

const getApiBase = (): string | null => {
  const apiBase = (import.meta as any)?.env?.VITE_PRONOTEBOOST_API_URL;
  if (!apiBase || typeof apiBase !== "string") {
    return null;
  }

  return apiBase.replace(/\/$/, "");
};

export const canUseGeminiApi = (): boolean => {
  return Boolean(getApiBase());
};

export const generateAppreciationWithGemini = async (
  input: GeminiGenerateInput,
): Promise<string> => {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error("API Gemini non configuree");
  }

  const response = await fetch(`${apiBase}/api/generate-appreciation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Erreur API Gemini (${response.status})`);
  }

  const data = (await response.json()) as GeminiGenerateResponse;
  if (!data?.appreciation) {
    throw new Error("Reponse Gemini invalide");
  }

  return data.appreciation;
};
