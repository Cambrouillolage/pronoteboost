type Tone = "bienveillant" | "neutre" | "pro" | "alarmiste";

const DAILY_API_LIMIT = 20;
const DAILY_API_QUOTA_KEY = "pronoteBoost_dailyApiQuota";
const MAX_API_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 350;
const NON_RETRYABLE_ERROR_PREFIX = "NON_RETRYABLE::";

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

const isQuotaOrRateLimitError = (message: string): boolean => {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("quota exceeded")
    || normalized.includes("rate limit")
    || normalized.includes("resource_exhausted")
    || normalized.includes("too many requests")
    || normalized.includes("billing")
  );
};

const parseApiError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string; reason?: string; code?: string };
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
    if (typeof payload?.reason === "string" && payload.reason.trim()) {
      return payload.reason.trim();
    }
    if (typeof payload?.code === "string" && payload.code.trim()) {
      return payload.code.trim();
    }
  } catch {
    // ignore JSON parse error and fallback below
  }

  return `Erreur API (${response.status})`;
};

const assertQuotaAvailable = (): void => {
  const status = getDailyQuotaStatus();
  if (status.remaining <= 0) {
    throw new Error("Quota quotidien atteint (20 appels API). Revenez demain.");
  }
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
        const apiError = await parseApiError(response);
        const retryAllowed = shouldRetryRequest(response.status);
        const nonRetryable = !retryAllowed || isQuotaOrRateLimitError(apiError);
        if (nonRetryable) {
          throw new Error(`${NON_RETRYABLE_ERROR_PREFIX}${apiError}`);
        }

        if (attempt === MAX_API_ATTEMPTS) {
          throw new Error(`${apiError} apres ${MAX_API_ATTEMPTS} tentatives`);
        }

        await wait(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      return response;
    } catch (error) {
      const caught = error instanceof Error ? error : new Error("Erreur reseau inconnue");

      if (caught.message.startsWith(NON_RETRYABLE_ERROR_PREFIX)) {
        throw new Error(caught.message.slice(NON_RETRYABLE_ERROR_PREFIX.length));
      }

      lastError = caught;
      if (attempt === MAX_API_ATTEMPTS) {
        break;
      }

      await wait(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  const reason = lastError?.message || "Echec reseau";
  throw new Error(`Serveur PronoteBoost indisponible ou erreur reseau (${reason})`);
};

const getDayKey = (): string => {
  const now = new Date();
  // Daily quota resets at 08:00 local time. Before 08:00, keep previous logical day.
  if (now.getHours() < 8) {
    now.setDate(now.getDate() - 1);
  }
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
  const apiBase = import.meta.env.VITE_PRONOTEBOOST_API_URL;
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
    throw new Error("API IA non configuree (VITE_PRONOTEBOOST_API_URL manquant).");
  }

  assertQuotaAvailable();

  const response = await requestWithRetry(`${apiBase}/api/generate-appreciation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Erreur API IA (${response.status})`);
  }

  const data = (await response.json()) as GeminiGenerateResponse;
  if (!data?.appreciation) {
    throw new Error("Reponse IA invalide");
  }

  consumeDailyApiCall();

  return data.appreciation;
};

export const generateAppreciationsWithGeminiBatch = async (
  students: GeminiBatchStudentInput[],
  context: GeminiBatchContext,
): Promise<GeminiBatchItemResponse[]> => {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error("API IA non configuree (VITE_PRONOTEBOOST_API_URL manquant).");
  }

  if (!students.length) {
    throw new Error("Aucun eleve selectionne pour la generation batch.");
  }

  assertQuotaAvailable();

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
    throw new Error(data?.error || "Erreur batch IA");
  }

  if (!Array.isArray(data.appreciations) || data.appreciations.length === 0) {
    throw new Error("Reponse batch IA invalide");
  }

  consumeDailyApiCall();

  return data.appreciations;
};
