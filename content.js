(() => {
  if (window.__globisSchedulePocInstalled) return;
  window.__globisSchedulePocInstalled = true;

  const LOG_PREFIX = "[GLOBIS PoC]";
  const networkEvents = [];
  const parser = window.GlobisScheduleParser;

  const log = (...args) => console.log(LOG_PREFIX, ...args);

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

  const extractModalLikeSchedules = () => {
    const candidates = [...document.querySelectorAll('[role="dialog"], .tippy-box, .modal, [class*="modal"], [class*="dialog"]')];
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

        const modalSchedules = extractModalLikeSchedules();
        if (modalSchedules.length) {
          log("Modal-like schedule text candidates:", modalSchedules);
          if (parser && typeof parser.parseScheduleCandidates === "function") {
            const parsed = parser.parseScheduleCandidates(modalSchedules, "JST");
            log("Parsed schedule entries:", parsed);
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
