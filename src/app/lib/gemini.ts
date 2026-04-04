type Tone = "bienveillant" | "neutre" | "pro" | "alarmiste";

const DAILY_API_LIMIT = 20;
const DAILY_API_QUOTA_KEY = "pronoteBoost_dailyApiQuota";
const MAX_API_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 350;

export interface GeminiGenerateInput {
  studentName: string;
  average: string;
  tone: Tone;
  principles: string[];
  freeText: string;
  subject?: string;
  teacherPreferences?: string[];
}

export interface GeminiBatchStudentInput {
  line: number | string;
  firstName: string;
  average: string;
  tone: Tone;
  principles: string[];
  freeText: string;
}

export interface GeminiBatchContext {
  subject?: string;
  schoolLevel?: "Maternelle" | "Elementaire" | "Collège" | "Lycée";
  teacherPreferences?: string[];
}

export interface GeminiBatchItemResponse {
  line: number | string;
  firstName: string;
  appreciation: string;
}

interface GeminiBatchResponse {
  ok: boolean;
  error?: string;
  appreciations?: GeminiBatchItemResponse[];
}

export interface GeminiGenerateResponse {
  appreciation: string;
}

export interface DailyQuotaStatus {
  limit: number;
  used: number;
  remaining: number;
  dayKey: string;
}

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const shouldRetryRequest = (status?: number): boolean => {
  if (typeof status !== "number") {
    return true;
  }

  return status >= 500;
};

const requestWithRetry = async (
  url: string,
  options: RequestInit,
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_API_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const retryAllowed = shouldRetryRequest(response.status);
        if (!retryAllowed) {
          throw new Error(`Erreur API Gemini (${response.status})`);
        }

        if (attempt === MAX_API_ATTEMPTS) {
          throw new Error(`Erreur API Gemini (${response.status}) apres ${MAX_API_ATTEMPTS} tentatives`);
        }

        await wait(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      return response;
    } catch (error) {
      const caught = error instanceof Error ? error : new Error("Erreur reseau inconnue");

      // Non-retryable 4xx errors are thrown as regular API errors above.
      if (caught.message.includes("Erreur API Gemini (4")) {
        throw caught;
      }

      lastError = caught;
      if (attempt === MAX_API_ATTEMPTS) {
        break;
      }

      await wait(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  const reason = lastError?.message || "Echec reseau";
  throw new Error(`Erreur API Gemini apres ${MAX_API_ATTEMPTS} tentatives: ${reason}`);
};

const getDayKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const readQuota = (): DailyQuotaStatus => {
  const currentDay = getDayKey();
  const raw = localStorage.getItem(DAILY_API_QUOTA_KEY);

  if (!raw) {
    return {
      limit: DAILY_API_LIMIT,
      used: 0,
      remaining: DAILY_API_LIMIT,
      dayKey: currentDay,
    };
  }

  try {
    const parsed = JSON.parse(raw) as { dayKey?: string; used?: number };
    const storedDay = parsed.dayKey || currentDay;
    const storedUsed = Number(parsed.used || 0);

    if (storedDay !== currentDay) {
      return {
        limit: DAILY_API_LIMIT,
        used: 0,
        remaining: DAILY_API_LIMIT,
        dayKey: currentDay,
      };
    }

    const safeUsed = Math.max(0, Math.min(DAILY_API_LIMIT, storedUsed));
    return {
      limit: DAILY_API_LIMIT,
      used: safeUsed,
      remaining: Math.max(0, DAILY_API_LIMIT - safeUsed),
      dayKey: currentDay,
    };
  } catch {
    return {
      limit: DAILY_API_LIMIT,
      used: 0,
      remaining: DAILY_API_LIMIT,
      dayKey: currentDay,
    };
  }
};

const writeQuota = (status: DailyQuotaStatus): void => {
  localStorage.setItem(
    DAILY_API_QUOTA_KEY,
    JSON.stringify({ dayKey: status.dayKey, used: status.used }),
  );
};

export const getDailyQuotaStatus = (): DailyQuotaStatus => {
  const status = readQuota();
  writeQuota(status);
  return status;
};

const consumeDailyApiCall = (): DailyQuotaStatus => {
  const status = readQuota();
  if (status.remaining <= 0) {
    throw new Error("Quota quotidien atteint (20 appels API). Revenez demain.");
  }

  const updated: DailyQuotaStatus = {
    ...status,
    used: status.used + 1,
    remaining: Math.max(0, status.remaining - 1),
  };
  writeQuota(updated);
  return updated;
};

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

  consumeDailyApiCall();

  const response = await requestWithRetry(`${apiBase}/api/generate-appreciation`, {
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

export const generateAppreciationsWithGeminiBatch = async (
  students: GeminiBatchStudentInput[],
  context: GeminiBatchContext,
): Promise<GeminiBatchItemResponse[]> => {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error("API Gemini non configuree");
  }

  if (!students.length) {
    throw new Error("Aucun eleve selectionne pour la generation batch.");
  }

  consumeDailyApiCall();

  const response = await requestWithRetry(`${apiBase}/api/generate-appreciations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      students,
      subject: context.subject || "",
      schoolLevel: context.schoolLevel || "Collège",
      teacherPreferences: context.teacherPreferences || [],
    }),
  });

  const data = (await response.json()) as GeminiBatchResponse;

  if (!data?.ok) {
    throw new Error(data?.error || "Erreur batch Gemini");
  }

  if (!Array.isArray(data.appreciations) || data.appreciations.length === 0) {
    throw new Error("Reponse batch Gemini invalide");
  }

  return data.appreciations;
};
