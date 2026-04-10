(() => {
  const DEFAULT_NAME_COLUMN = 0;
  const DEFAULT_APPRECIATION_COLUMN = 5;
  const APPRECIATION_EXACT_REGEX = /\bapp\.?\s*a\s*:?\s*appreciation\b/;
  const APPRECIATION_FALLBACK_REGEX = /\bappreciation\b|\bapp\.?\b/;
  const NAME_HEADER_REGEX = /\beleve\b|\bnom\b|\bprenom\b/;
  const BLOCKED_COLUMN_REGEX = /\bn\.?\s*note\b|\bnote\s*n\.?\b|\bnote\b/;

  const normalizeText = (value) =>
    (value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const normalizeForCompare = (value) =>
    normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const pause = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

  const nextFrame = () =>
    new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve);
      });
    });

  const syncGridRender = async () => {
    await nextFrame();
    await pause(80);
  };

  const extractRowFromId = (id) => {
    if (!id) {
      return null;
    }

    const match = id.match(/_(\d+)_(\d+)(?:_div)?$/);
    if (!match) {
      return null;
    }

    return {
      column: Number(match[1]),
      row: Number(match[2]),
    };
  };

  const getGridIdPrefix = (id) => {
    if (!id) {
      return null;
    }

    const match = id.match(/^(.*)_(\d+)_(\d+)(?:_div)?$/);
    if (!match) {
      return null;
    }

    return match[1];
  };

  const getGridCells = () => {
    return Array.from(document.querySelectorAll(".liste_fixed.liste-focus-grid .liste_celluleGrid[data-colonne]"));
  };

  const getGridRoot = () => document.querySelector(".liste_fixed.liste-focus-grid");

  const DEBUG_FLAG_KEY = "pronoteboost_debug";

  const isDebugEnabled = () => {
    try {
      return window.localStorage.getItem(DEBUG_FLAG_KEY) === "1";
    } catch {
      return false;
    }
  };

  const debugLog = (...args) => {
    if (isDebugEnabled()) {
      console.log("[PronoteBoost]", ...args);
    }
  };

  const getGridPrefixes = () => {
    const prefixes = new Set();
    for (const cell of getGridCells()) {
      const prefix = getGridIdPrefix(cell?.id || "");
      if (prefix) {
        prefixes.add(prefix);
      }
    }

    return prefixes;
  };

  const getActiveGridPrefix = () => {
    const firstCell = getGridCells()[0];
    return getGridIdPrefix(firstCell?.id || "");
  };

  const parseColumnFromElement = (element) => {
    const value = Number(element?.getAttribute?.("data-colonne"));
    return Number.isNaN(value) ? null : value;
  };

  const parseGridColumnStart = (element) => {
    if (!element) {
      return null;
    }

    const inlineGridColumn = (element.style?.gridColumn || "").trim();
    if (inlineGridColumn) {
      const firstToken = inlineGridColumn.split("/")[0].trim();
      const numeric = Number(firstToken);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }

    const computedGridColumnStart = window.getComputedStyle(element).gridColumnStart;
    const computedNumeric = Number(computedGridColumnStart);
    return Number.isNaN(computedNumeric) ? null : computedNumeric;
  };

  const getVisibleColumnGeometry = () => {
    const byColumn = new Map();
    const cells = getGridCells().slice(0, 180);

    for (const cell of cells) {
      const column = parseColumnFromElement(cell);
      if (column === null) {
        continue;
      }

      const rect = cell.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        continue;
      }

      const previous = byColumn.get(column);
      if (!previous || rect.width > previous.width) {
        byColumn.set(column, {
          column,
          left: rect.left,
          right: rect.right,
          center: rect.left + rect.width / 2,
          width: rect.width,
        });
      }
    }

    return Array.from(byColumn.values()).sort((a, b) => a.left - b.left);
  };

  const parseColumnFromHeaderId = (element) => {
    const id = element?.id || "";
    const match = id.match(/_titrecell_\d+_(\d+)$/);
    if (!match) {
      return null;
    }

    const value = Number(match[1]);
    return Number.isNaN(value) ? null : value;
  };

  const resolveColumnFromGeometry = (element) => {
    if (!element) {
      return null;
    }

    const geometry = getVisibleColumnGeometry();
    if (!geometry.length) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    const center = rect.left + rect.width / 2;
    const overlap = geometry.find((item) => center >= item.left - 2 && center <= item.right + 2);
    if (overlap) {
      return overlap.column;
    }

    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const item of geometry) {
      const distance = Math.abs(item.center - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = item;
      }
    }

    return best?.column ?? null;
  };

  const parseColumnFromHeaderElement = (element) => {
    const fromHeaderId = parseColumnFromHeaderId(element);
    if (fromHeaderId !== null) {
      return fromHeaderId;
    }

    const fromDataAttribute = parseColumnFromElement(element);
    if (fromDataAttribute !== null) {
      return fromDataAttribute;
    }

    return resolveColumnFromGeometry(element);
  };

  const isBlockedHeaderText = (text) => BLOCKED_COLUMN_REGEX.test(text);

  const isAppreciationHeaderText = (text) => {
    if (!text || isBlockedHeaderText(text)) {
      return false;
    }

    return APPRECIATION_EXACT_REGEX.test(text) || APPRECIATION_FALLBACK_REGEX.test(text);
  };

  const getColumnHeaderNodes = () => {
    const root = getGridRoot();
    const gridPrefix = getActiveGridPrefix();
    const knownPrefixes = getGridPrefixes();

    const titleHeaders = Array.from(document.querySelectorAll('[role="columnheader"][id*="_titrecell_"]'));

    const samePrefixHeaders = titleHeaders.filter((node) => {
      if (!gridPrefix) {
        return false;
      }

      const id = node.getAttribute("id") || "";
      return id.startsWith(`${gridPrefix}_titrecell_`);
    });
    if (samePrefixHeaders.length) {
      return samePrefixHeaders;
    }

    // Split Pronote grids can expose multiple prefixes (frozen + scrolling panes).
    const multiPrefixHeaders = titleHeaders.filter((node) => {
      const id = node.getAttribute("id") || "";
      for (const prefix of knownPrefixes) {
        if (id.startsWith(`${prefix}_titrecell_`)) {
          return true;
        }
      }
      return false;
    });
    if (multiPrefixHeaders.length) {
      return multiPrefixHeaders;
    }

    // Preferred path: Pronote title headers bound to the same grid prefix as data cells.
    const scopedRoleHeaders = root
      ? Array.from(root.querySelectorAll('[role="columnheader"]'))
      : [];
    if (scopedRoleHeaders.length) {
      return scopedRoleHeaders;
    }

    const documentRoleHeaders = Array.from(document.querySelectorAll('[role="columnheader"]'));
    if (documentRoleHeaders.length) {
      return documentRoleHeaders;
    }

    return root ? Array.from(root.querySelectorAll("[data-colonne]")) : [];
  };

  const getHeaderByColumn = () => {
    const nodes = getColumnHeaderNodes();
    if (!nodes.length) {
      return [];
    }

    const byColumn = new Map();
    for (const node of nodes) {
      const column = parseColumnFromHeaderElement(node);
      if (column === null) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        continue;
      }

      const rawText = normalizeText(node.textContent || "");
      const text = normalizeForCompare(rawText);
      const previous = byColumn.get(column);
      if (!previous) {
        byColumn.set(column, { column, top: rect.top, text, rawText });
        continue;
      }

      const isHigher = rect.top < previous.top - 1;
      const isSameBandWithBetterText = Math.abs(rect.top - previous.top) <= 1 && text.length > previous.text.length;
      if (isHigher || isSameBandWithBetterText) {
        byColumn.set(column, { column, top: rect.top, text, rawText });
      }
    }

    return Array.from(byColumn.values());
  };

  const getPotentialHeaderCells = () => {
    const allColumnElements = getColumnHeaderNodes();
    if (!allColumnElements.length) {
      return [];
    }

    const headerLike = allColumnElements.filter((element) => {
      const className = typeof element.className === "string" ? element.className : "";
      return (
        /entete|header|titre|colonne|caption|label/i.test(className) ||
        element.tagName === "TH" ||
        element.getAttribute("role") === "columnheader"
      );
    });

    return headerLike.length ? headerLike : allColumnElements;
  };

  const findAppreciationColumnFromHeaders = () => {
    const cells = getPotentialHeaderCells();
    const candidates = cells
      .map((cell) => {
        const column = parseColumnFromHeaderElement(cell);
        if (column === null) {
          return null;
        }

        const text = normalizeForCompare(cell.textContent || "");
        if (!text) {
          return null;
        }

        return { column, text };
      })
      .filter(Boolean);

    const exact = candidates.find((candidate) => APPRECIATION_EXACT_REGEX.test(candidate.text));
    if (exact) {
      return exact.column;
    }

    const fallback = candidates.find((candidate) => isAppreciationHeaderText(candidate.text));
    if (fallback) {
      return fallback.column;
    }

    return null;
  };

  const getColumnConfig = () => {
    const headers = getHeaderByColumn();
    const appreciationByHeaderMap = headers.find((item) => APPRECIATION_EXACT_REGEX.test(item.text));
    const appreciationByGenericHeader = headers.find((item) => isAppreciationHeaderText(item.text));
    const nameByHeaderMap = headers.find((item) => NAME_HEADER_REGEX.test(item.text));

    const dynamicAppreciationColumn =
      appreciationByHeaderMap?.column ??
      appreciationByGenericHeader?.column ??
      findAppreciationColumnFromHeaders();

    const appreciationColumn =
      dynamicAppreciationColumn === null ? DEFAULT_APPRECIATION_COLUMN : dynamicAppreciationColumn;

    const appreciationHeaderText =
      headers.find((item) => item.column === appreciationColumn)?.text || "";

    debugLog("column_config", {
      availableHeaders: headers.map((item) => ({ column: item.column, text: item.text })),
      selected: {
        nameColumn: nameByHeaderMap?.column ?? DEFAULT_NAME_COLUMN,
        appreciationColumn,
        appreciationHeaderText,
      },
      prefixes: Array.from(getGridPrefixes()),
    });

    return {
      nameColumn: nameByHeaderMap?.column ?? DEFAULT_NAME_COLUMN,
      appreciationColumn,
      appreciationHeaderText,
    };
  };

  const getCellsForColumn = (rowCells, column) => {
    const value = rowCells[column];
    if (!value) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  };

  const hasLineContainer = (cell) => Boolean(cell?.querySelector?.(".liste_contenu_ligne"));

  const pickNameCell = (rowCells, nameColumn) => {
    const directCandidates = getCellsForColumn(rowCells, nameColumn);
    const directMatch = directCandidates.find((cell) => normalizeText(readStudentName(cell)));
    if (directMatch) {
      return directMatch;
    }

    const allCandidates = Object.entries(rowCells)
      .filter(([key]) => key !== "rowKey")
      .flatMap(([, cells]) => (Array.isArray(cells) ? cells : [cells]))
      .filter(Boolean);

    return allCandidates.find((cell) => normalizeText(readStudentName(cell))) || null;
  };

  const pickAppreciationCell = (rowCells, appreciationColumn, selectedNameCell) => {
    const directCandidates = getCellsForColumn(rowCells, appreciationColumn)
      .filter((cell) => cell && cell !== selectedNameCell);

    const withLine = directCandidates.find((cell) => hasLineContainer(cell));
    if (withLine) {
      return withLine;
    }

    return directCandidates[0] || null;
  };

  const getScrollableContainer = () => {
    const firstCell = getGridCells()[0];
    if (!firstCell) {
      return null;
    }

    let current = firstCell.parentElement;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const isScrollable = /(auto|scroll)/.test(style.overflowY || "");
      if (isScrollable && current.scrollHeight > current.clientHeight + 20) {
        return current;
      }
      current = current.parentElement;
    }

    return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
  };

  const getScrollPositions = (container) => {
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    if (!maxScrollTop) {
      return [0];
    }

    const step = Math.max(140, Math.floor(container.clientHeight * 0.8) || 240);
    const positions = [0];
    for (let nextScrollTop = step; nextScrollTop < maxScrollTop; nextScrollTop += step) {
      positions.push(nextScrollTop);
    }

    if (positions[positions.length - 1] !== maxScrollTop) {
      positions.push(maxScrollTop);
    }

    return positions;
  };

  const readStudentName = (nameCell) => {
    const visibleName = normalizeText(
      nameCell.querySelector(".InlineBlock.AlignementHaut.EspaceGauche.EspaceHaut")?.textContent || ""
    );

    if (visibleName) {
      return visibleName;
    }

    const imageName = normalizeText(
      nameCell.querySelector("img[data-libelle]")?.getAttribute("data-libelle") ||
        nameCell.querySelector("img[alt]")?.getAttribute("alt") ||
        ""
    );

    if (imageName) {
      return imageName;
    }

    return normalizeText(nameCell.querySelector(".liste_contenu_ligne")?.textContent || "");
  };

  const readAppreciation = (appCell) => {
    return normalizeText(appCell.querySelector(".liste_contenu_ligne")?.textContent || "");
  };

  const getVisibleRowsSnapshot = () => {
    const { nameColumn, appreciationColumn, appreciationHeaderText } = getColumnConfig();
    const targetLooksBlocked = isBlockedHeaderText(appreciationHeaderText || "");
    const rows = new Map();

    for (const cell of getGridCells()) {
      const idMeta = extractRowFromId(cell.id);
      if (!idMeta) {
        continue;
      }

      const rowKey = String(idMeta.row);
      const column = Number(cell.getAttribute("data-colonne"));
      if (Number.isNaN(column)) {
        continue;
      }

      if (!rows.has(rowKey)) {
        rows.set(rowKey, { rowKey });
      }

      const rowCells = rows.get(rowKey);
      if (!rowCells[column]) {
        rowCells[column] = [];
      }

      if (Array.isArray(rowCells[column])) {
        rowCells[column].push(cell);
      } else {
        rowCells[column] = [rowCells[column], cell];
      }
    }

    const results = [];
    for (const [rowKey, rowCells] of rows.entries()) {
      const nameCell = pickNameCell(rowCells, nameColumn);
      const appreciationCell = targetLooksBlocked
        ? null
        : pickAppreciationCell(rowCells, appreciationColumn, nameCell);
      if (!nameCell || !appreciationCell) {
        continue;
      }

      const name = readStudentName(nameCell);
      if (!name) {
        continue;
      }

      results.push({
        rowKey,
        name,
        normalizedName: normalizeText(name).toLowerCase(),
        appreciation: readAppreciation(appreciationCell),
        nameCell,
        appreciationCell,
      });
    }

    debugLog("rows_snapshot", {
      count: results.length,
      columns: { nameColumn, appreciationColumn, targetLooksBlocked },
      sample: results.slice(0, 3).map((row) => ({
        rowKey: row.rowKey,
        name: row.name,
        nameCellId: row.nameCell?.id,
        appreciationCellId: row.appreciationCell?.id,
      })),
    });

    results.sort((a, b) => Number(a.rowKey) - Number(b.rowKey));
    return results;
  };

  const collectRowsSnapshot = async () => {
    const rows = new Map();
    const mergeVisibleRows = () => {
      for (const row of getVisibleRowsSnapshot()) {
        rows.set(row.rowKey, row);
      }
    };

    mergeVisibleRows();

    const container = getScrollableContainer();
    if (!container) {
      return Array.from(rows.values()).sort((left, right) => Number(left.rowKey) - Number(right.rowKey));
    }

    const originalScrollTop = container.scrollTop;
    try {
      for (const scrollTop of getScrollPositions(container)) {
        container.scrollTop = scrollTop;
        await syncGridRender();
        mergeVisibleRows();
      }
    } finally {
      container.scrollTop = originalScrollTop;
      await syncGridRender();
    }

    return Array.from(rows.values()).sort((left, right) => Number(left.rowKey) - Number(right.rowKey));
  };

  const dispatchWriteEvents = (target) => {
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    target.dispatchEvent(new Event("blur", { bubbles: true }));
  };

  const writeAppreciationInCell = (appreciationCell, text) => {
    const line = appreciationCell.querySelector(".liste_contenu_ligne");
    const focusable = appreciationCell.querySelector(".liste_contenu_cellule") || appreciationCell;

    if (!line || !focusable) {
      return { ok: false, reason: "line_not_found" };
    }

    line.textContent = text;
    dispatchWriteEvents(focusable);

    const persisted = normalizeText(line.textContent) === normalizeText(text);
    if (!persisted) {
      return { ok: false, reason: "persistence_check_failed" };
    }

    return { ok: true };
  };

  const matchesPendingEntry = (row, pendingEntry) => {
    // Strict matching: rowKey only (no fallback to normalizedName to prevent inversions)
    if (!pendingEntry.rowKey || pendingEntry.rowKey === "") {
      return false;
    }
    return String(pendingEntry.rowKey) === String(row.rowKey);
  };

  const insertAppreciations = async (payload) => {
    // First, validate all entries have rowKey (anti-inversion check)
    const entriesWithoutRowKey = payload.filter((entry) => !entry?.rowKey || String(entry.rowKey).trim() === "");
    
    if (entriesWithoutRowKey.length > 0) {
      return {
        inserted: 0,
        failed: payload.length,
        details: [
          {
            ok: false,
            error: `${entriesWithoutRowKey.length} entries rejected: missing or invalid rowKey. This prevents accidental inversions. Reload student list from Pronote.`,
            failedEntries: entriesWithoutRowKey.map((e) => e?.name || "(no name)"),
          },
        ],
      };
    }

    const pendingEntries = payload.map((entry, index) => ({
      index,
      rowKey: entry?.rowKey ? String(entry.rowKey) : "",
      name: entry?.name || "",
      normalizedName: normalizeText(entry?.name || "").toLowerCase(),
      text: entry?.text || "",
      done: false,
      result: null,
    }));

    const attemptVisibleWrites = () => {
      const visibleRows = getVisibleRowsSnapshot();
      for (const row of visibleRows) {
        for (const entry of pendingEntries) {
          if (entry.done || !matchesPendingEntry(row, entry)) {
            continue;
          }

          entry.result = {
            rowKey: row.rowKey,
            name: row.name,
            ...writeAppreciationInCell(row.appreciationCell, entry.text),
          };
          entry.done = Boolean(entry.result?.ok);
        }
      }
    };

    attemptVisibleWrites();

    const container = getScrollableContainer();
    if (container && pendingEntries.some((entry) => !entry.done)) {
      const originalScrollTop = container.scrollTop;
      try {
        for (const scrollTop of getScrollPositions(container)) {
          container.scrollTop = scrollTop;
          await syncGridRender();
          attemptVisibleWrites();

          if (pendingEntries.every((entry) => entry.done)) {
            break;
          }
        }
      } finally {
        container.scrollTop = originalScrollTop;
        await syncGridRender();
      }
    }

    const details = pendingEntries.map((entry) =>
      entry.result || {
        rowKey: entry.rowKey || undefined,
        name: entry.name,
        ok: false,
        reason: "row_not_found_or_target_unavailable",
      },
    );

    return {
      ok: true,
      inserted: details.filter((item) => item.ok).length,
      failed: details.filter((item) => !item.ok).length,
      details,
    };
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = message?.type;

    if (type === "PRONOTE_EXTRACT_STUDENTS") {
      void collectRowsSnapshot()
        .then((students) => {
          sendResponse({
            ok: true,
            students: students.map(({ rowKey, name, appreciation }) => ({
              rowKey,
              name,
              appreciation,
            })),
          });
        })
        .catch((error) => {
          sendResponse({ ok: false, reason: error instanceof Error ? error.message : "extract_failed" });
        });
      return true;
    }

    if (type === "PRONOTE_INSERT_APPRECIATIONS") {
      const payload = Array.isArray(message?.payload) ? message.payload : [];
      void insertAppreciations(payload)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          sendResponse({ ok: false, reason: error instanceof Error ? error.message : "insert_failed" });
        });
      return true;
    }

    sendResponse({ ok: false, reason: "unknown_message_type" });
  });
})();
