export interface PronoteStudent {
  rowKey: string;
  name: string;
  appreciation: string;
}

export interface InsertPayloadItem {
  rowKey?: string;
  name: string;
  text: string;
}

export interface InsertResponse {
  ok: boolean;
  inserted: number;
  failed: number;
  details: Array<{
    rowKey?: string;
    name?: string;
    ok: boolean;
    reason?: string;
  }>;
}

const PRONOTE_URL_REGEX = /index-education\.net\/pronote\//i;

const getChromeApi = (): any => (globalThis as any).chrome;

const isPromiseLike = (value: unknown): value is Promise<unknown> => {
  return typeof value === "object" && value !== null && "then" in value;
};

const chromeTabsQuery = async (queryInfo: Record<string, unknown>): Promise<any[]> => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.query) {
    throw new Error("Chrome tabs API unavailable");
  }

  const result = chromeApi.tabs.query(queryInfo);
  if (isPromiseLike(result)) {
    return (await result) as any[];
  }

  return new Promise((resolve, reject) => {
    chromeApi.tabs.query(queryInfo, (tabs: any[]) => {
      const runtimeError = chromeApi.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || "Unable to query tabs"));
        return;
      }
      resolve(tabs);
    });
  });
};

const chromeTabsSendMessage = async (tabId: number, message: unknown): Promise<any> => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.sendMessage) {
    throw new Error("Chrome tabs.sendMessage API unavailable");
  }

  const result = chromeApi.tabs.sendMessage(tabId, message);
  if (isPromiseLike(result)) {
    return result;
  }

  return new Promise((resolve, reject) => {
    chromeApi.tabs.sendMessage(tabId, message, (response: any) => {
      const runtimeError = chromeApi.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || "Unable to send message"));
        return;
      }
      resolve(response);
    });
  });
};

const getActivePronoteTabId = async (): Promise<number> => {
  const tabs = await chromeTabsQuery({ active: true, currentWindow: true });
  const activePronoteTab = tabs.find((tab) => {
    const url = typeof tab?.url === "string" ? tab.url : "";
    return PRONOTE_URL_REGEX.test(url);
  });

  if (!activePronoteTab?.id) {
    throw new Error("Aucun onglet Pronote actif trouve");
  }

  return activePronoteTab.id;
};

export const isExtensionRuntimeAvailable = (): boolean => {
  const chromeApi = getChromeApi();
  return Boolean(chromeApi?.tabs && chromeApi?.runtime);
};

export const fetchStudentsFromPronote = async (): Promise<PronoteStudent[]> => {
  const tabId = await getActivePronoteTabId();
  const response = (await chromeTabsSendMessage(tabId, {
    type: "PRONOTE_EXTRACT_STUDENTS",
  })) as { ok?: boolean; students?: PronoteStudent[]; reason?: string };

  if (!response?.ok || !Array.isArray(response.students)) {
    throw new Error(response?.reason || "Impossible de recuperer les eleves Pronote");
  }

  return response.students;
};

export const insertAppreciationsIntoPronote = async (
  payload: InsertPayloadItem[],
): Promise<InsertResponse> => {
  const tabId = await getActivePronoteTabId();
  const response = (await chromeTabsSendMessage(tabId, {
    type: "PRONOTE_INSERT_APPRECIATIONS",
    payload,
  })) as InsertResponse;

  if (!response?.ok) {
    throw new Error("Echec de l'insertion dans Pronote");
  }

  return response;
};
