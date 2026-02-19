(() => {
  if (window.__globisSchedulePocInstalled) return;
  window.__globisSchedulePocInstalled = true;

  const LOG_PREFIX = "[GLOBIS PoC]";
  const networkEvents = [];
  const parser = window.GlobisScheduleParser;
  const ACTION_ID = "globis-calendar-sync-action";
  let latestSyncContext = null;

  const log = (...args) => console.log(LOG_PREFIX, ...args);
  const sendMessage = (message) =>
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });

  const injectScript = () => {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("injected.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  };

  const normalize = (s) => String(s || "").replace(/\s+/g, " ").trim();

  const getHeaderMap = (table) => {
    const headers = [...table.querySelectorAll("thead th")].map((th) => normalize(th.textContent));
    return headers;
  };

  const rowToObject = (tr) => {
    const table = tr.closest("table");
    if (!table) return null;

    const headers = getHeaderMap(table);
    const tds = [...tr.querySelectorAll(":scope > td")];
    if (!headers.length || !tds.length) return null;

    const data = {};
    headers.forEach((h, i) => {
      data[h || `col_${i + 1}`] = normalize(tds[i]?.textContent);
    });
    return data;
  };

  const findScheduleModal = () =>
    document.querySelector("#base-modal") || document.querySelector('[role="dialog"]');

  const extractModalLikeSchedules = (rootEl) => {
    const scope = rootEl || document;
    const candidates = [...scope.querySelectorAll('[role="dialog"], #base-modal, .tippy-box, .modal, [class*="modal"], [class*="dialog"]')];
    if (scope.nodeType === 1) candidates.unshift(scope);
    const lines = [];

    for (const el of candidates) {
      const text = normalize(el.textContent);
      if (!text) continue;
      const hasDate = /\b\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}\b/.test(text);
      const hasTime = /\b\d{1,2}:\d{2}\b/.test(text);
      if (hasDate || hasTime) {
        lines.push(text.slice(0, 1000));
      }
    }

    return lines;
  };

  const createActionElement = () => {
    const wrap = document.createElement("div");
    wrap.id = ACTION_ID;
    wrap.style.marginTop = "8px";
    wrap.style.marginBottom = "16px";
    wrap.style.textAlign = "center";

    const link = document.createElement("a");
    link.href = "#";
    link.textContent = "Googleカレンダーにスケジュール登録";
    link.style.fontSize = "13px";
    link.style.fontWeight = "700";
    link.style.color = "#0E357F";
    link.style.textDecoration = "underline";
    link.style.cursor = "pointer";
    link.setAttribute("data-state", "ready");

    const status = document.createElement("div");
    status.style.fontSize = "12px";
    status.style.marginTop = "8px";
    status.style.color = "#555";
    status.textContent = "";

    const setBusy = (busy, message) => {
      link.style.pointerEvents = busy ? "none" : "auto";
      link.style.opacity = busy ? "0.6" : "1";
      status.textContent = message || "";
    };

    link.addEventListener("click", async (ev) => {
      ev.preventDefault();
      if (!latestSyncContext) {
        log("No sync context is prepared");
        return;
      }

      try {
        setBusy(true, "Googleカレンダーに登録中...");
        await syncSchedulesToCalendar(latestSyncContext.row, latestSyncContext.parsedSchedules);
        setBusy(false, "登録しました。Googleカレンダーを確認してください。");
      } catch (err) {
        setBusy(false, `登録に失敗しました: ${err.message}`);
      }
    });

    wrap.append(link, status);
    return wrap;
  };

  const upsertModalAction = (row, parsedSchedules) => {
    const modal = findScheduleModal();
    const modalContent = modal?.querySelector("#modal-content");
    if (!modal || !modalContent) {
      log("Schedule modal not found for action link injection");
      return false;
    }

    latestSyncContext = { row, parsedSchedules };

    let action = modalContent.querySelector(`#${ACTION_ID}`);
    if (!action) {
      action = createActionElement();
      modalContent.appendChild(action);
      log("Injected calendar sync link into modal");
    }

    return true;
  };

  const printRecentNetworkEvents = (fromTs) => {
    const recent = networkEvents.filter((e) => e.ts >= fromTs - 200 && e.ts <= Date.now() + 5000);
    if (!recent.length) {
      log("No network events captured around click time");
      return;
    }

    log("Captured network events:", recent.map((e) => ({
      kind: e.kind,
      method: e.method,
      status: e.status,
      url: e.url,
      ts: e.ts,
    })));

    recent.forEach((e, idx) => {
      log(`Network payload preview #${idx + 1}:`, {
        url: e.url,
        status: e.status,
        bodyPreview: e.bodyPreview,
      });
    });
  };

  const syncSchedulesToCalendar = async (row, parsedSchedules) => {
    const schedules = Array.isArray(parsedSchedules) ? parsedSchedules : [];
    if (!schedules.length) {
      log("Skip calendar sync: no parsed schedules");
      return;
    }

    log("Creating Google Calendar events...");
    const response = await sendMessage({
      type: "GLOBIS_CREATE_CALENDAR_EVENTS",
      payload: {
        row,
        sessions: schedules,
        sourceUrl: window.location.href,
      },
    });

    if (!response || !response.ok) {
      const message = response?.error || "Unknown error";
      throw new Error(message);
    }

    log("Google Calendar events created:", response.result);
  };

  window.addEventListener("globis-schedule-network", (ev) => {
    const detail = ev.detail || {};
    networkEvents.push(detail);
    if (networkEvents.length > 200) networkEvents.shift();

    if (detail.kind === "hook") {
      log(detail.message);
    }
  });

  document.addEventListener(
    "click",
    (ev) => {
      const btn = ev.target.closest("button");
      if (!btn) return;

      const tr = btn.closest("tr[heads*='初回開講日']");
      if (!tr) return;

      const row = rowToObject(tr);
      if (!row) return;

      const clickTs = Date.now();
      log("Calendar icon clicked. Row data:", row);

      setTimeout(() => {
        printRecentNetworkEvents(clickTs);

        const modalSchedules = extractModalLikeSchedules(findScheduleModal());
        if (modalSchedules.length) {
          log("Modal-like schedule text candidates:", modalSchedules);
          if (parser && typeof parser.parseScheduleCandidates === "function") {
            const parsed = parser.parseScheduleCandidates(modalSchedules, "JST");
            log("Parsed schedule entries:", parsed);
            if (!upsertModalAction(row, parsed)) {
              log("Calendar link injection skipped");
            }
          } else {
            log("Parser is not available");
          }
        } else {
          log("No modal-like schedule text detected yet");
        }
      }, 1200);
    },
    true
  );

  injectScript();
  log("content script ready");
})();
