(() => {
  const DEFAULT_NAME_COLUMN = 0;
  const DEFAULT_APPRECIATION_COLUMN = 5;

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

  const getGridCells = () => {
    return Array.from(document.querySelectorAll(".liste_fixed.liste-focus-grid .liste_celluleGrid[data-colonne]"));
  };

  const getGridRoot = () => document.querySelector(".liste_fixed.liste-focus-grid");

  const parseColumnFromElement = (element) => {
    const value = Number(element?.getAttribute?.("data-colonne"));
    return Number.isNaN(value) ? null : value;
  };

  const getHeaderByColumn = () => {
    const root = getGridRoot();
    if (!root) {
      return [];
    }

    const byColumn = new Map();
    const nodes = Array.from(root.querySelectorAll("[data-colonne]"));
    for (const node of nodes) {
      const column = parseColumnFromElement(node);
      if (column === null) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        continue;
      }

      const text = normalizeForCompare(node.textContent || "");
      const previous = byColumn.get(column);
      if (!previous) {
        byColumn.set(column, { column, top: rect.top, text });
        continue;
      }

      const isHigher = rect.top < previous.top - 1;
      const isSameBandWithBetterText = Math.abs(rect.top - previous.top) <= 1 && text.length > previous.text.length;
      if (isHigher || isSameBandWithBetterText) {
        byColumn.set(column, { column, top: rect.top, text });
      }
    }

    return Array.from(byColumn.values());
  };

  const getPotentialHeaderCells = () => {
    const root = getGridRoot();
    if (!root) {
      return [];
    }

    const allColumnElements = Array.from(root.querySelectorAll("[data-colonne]"));
    const headerLike = allColumnElements.filter((element) => {
      const className = typeof element.className === "string" ? element.className : "";
      return /entete|header|titre|colonne|caption|label/i.test(className) || element.tagName === "TH";
    });

    return headerLike.length ? headerLike : allColumnElements;
  };

  const findAppreciationColumnFromHeaders = () => {
    const cells = getPotentialHeaderCells();
    const candidates = cells
      .map((cell) => {
        const column = parseColumnFromElement(cell);
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

    const exact = candidates.find((candidate) => /app\.?\s*a\s*:?\s*appreciation/.test(candidate.text));
    if (exact) {
      return exact.column;
    }

    const fallback = candidates.find((candidate) => /appreciation/.test(candidate.text));
    if (fallback) {
      return fallback.column;
    }

    return null;
  };

  const getColumnConfig = () => {
    const headers = getHeaderByColumn();
    const appreciationByHeaderMap = headers.find((item) => /app\.?\s*a\s*:?\s*appreciation/.test(item.text));
    const appreciationByGenericHeader = headers.find((item) => /appreciation/.test(item.text));
    const nameByHeaderMap = headers.find((item) => /eleve/.test(item.text));

    const dynamicAppreciationColumn =
      appreciationByHeaderMap?.column ??
      appreciationByGenericHeader?.column ??
      findAppreciationColumnFromHeaders();

    return {
      nameColumn: nameByHeaderMap?.column ?? DEFAULT_NAME_COLUMN,
      appreciationColumn:
        dynamicAppreciationColumn === null ? DEFAULT_APPRECIATION_COLUMN : dynamicAppreciationColumn,
    };
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
    const { nameColumn, appreciationColumn } = getColumnConfig();
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

      rows.get(rowKey)[column] = cell;
    }

    const results = [];
    for (const [rowKey, rowCells] of rows.entries()) {
      let nameCell = rowCells[nameColumn];
      const appreciationCell = rowCells[appreciationColumn];
      if (!nameCell || !appreciationCell) {
        continue;
      }

      // Fallback: if the default name column is not stable, pick the first readable cell.
      if (!normalizeText(readStudentName(nameCell))) {
        const orderedCells = Object.entries(rowCells)
          .filter(([key]) => key !== "rowKey")
          .map(([, cell]) => cell)
          .filter(Boolean);

        for (const candidateCell of orderedCells) {
          if (normalizeText(readStudentName(candidateCell))) {
            nameCell = candidateCell;
            break;
          }
        }
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
    if (pendingEntry.rowKey && String(pendingEntry.rowKey) === String(row.rowKey)) {
      return true;
    }

    return Boolean(pendingEntry.normalizedName && pendingEntry.normalizedName === row.normalizedName);
  };

  const insertAppreciations = async (payload) => {
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
        reason: "row_not_found",
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
