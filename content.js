(() => {
  if (window.__globisSchedulePocInstalled) return;
  window.__globisSchedulePocInstalled = true;

  const networkEvents = [];
  const parser = window.GlobisScheduleParser;
  const communityParser = window.GlobisCommunityParser;
  const ACTION_ID = "globis-calendar-sync-action";
  const DAY_ACTION_CLASS = "globis-day-calendar-action";
  const BULK_ACTION_ID = "globis-bulk-calendar-action";
  const EVENT_ACTION_CLASS = "globis-event-calendar-action";
  const SOCIAL_ACTION_CLASS = "globis-social-calendar-action";
  const URL_POLL_MS = 500;
  let latestSyncContext = null;
  let detailInjectTimer = null;
  let bootstrapped = false;
  let observerStarted = false;
  let urlPollTimer = null;
  let lastUrl = location.href;

  const log = () => {};
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

  const toIsoDate = (dateText) => {
    const m = String(dateText || "").match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (!m) return "";
    return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
  };

  const extractRelatedUrl = (root) => {
    if (!root) return "";
    const links = [...root.querySelectorAll("a[href]")];
    for (const link of links) {
      const href = normalize(link.getAttribute("href") || "");
      if (!href) continue;
      if (/^https?:\/\//i.test(href)) return href;
    }
    return "";
  };

  const getPageMeta = () => {
    const titleRoot = document.querySelector("#layout-title");
    const titleSpans = [...(titleRoot?.querySelectorAll("span") || [])]
      .map((el) => normalize(el.textContent))
      .filter(Boolean);

    const subject = normalize(titleRoot?.querySelector(":scope > h2 span")?.textContent || "");
    const term = titleSpans.find((t) => /\d{4}年\d{2}月期/.test(t)) || "";

    return { subject, term };
  };

  const buildSocialEventTitle = (title) => {
    const base = normalize(title);
    if (!base) return "";
    const subject = normalize(getPageMeta().subject);
    if (!subject) return base;
    if (base.startsWith(subject)) return base;
    return `${subject} ${base}`;
  };

  const parseDaySessionFromAccordion = (accordion) => {
    const dayHead = normalize(accordion.querySelector("h3")?.textContent || "");
    const dayNo = Number((dayHead.match(/Day\s*(\d+)/i) || [])[1] || 0);
    if (!dayNo) return null;

    const participateLabel = [...accordion.querySelectorAll("span")]
      .find((el) => normalize(el.textContent) === "授業に参加");
    if (!participateLabel) return null;
    const todoItem = participateLabel.closest(".todo-item");
    if (!todoItem) return null;

    const dateInfoBlock = [...todoItem.querySelectorAll("div")]
      .find((div) => normalize(div.querySelector(":scope > span:first-of-type")?.textContent) === "開催日時：");
    if (!dateInfoBlock) return null;

    const dateTimeText = normalize(dateInfoBlock.querySelector(":scope > span:nth-of-type(2)")?.textContent || "");
    const dtMatch = dateTimeText.match(/(\d{4}\/\d{1,2}\/\d{1,2}).*?(\d{1,2}:\d{2})\s*[～~\-]\s*(\d{1,2}:\d{2})\s*([A-Z]{2,5})?/);
    if (!dtMatch) return null;

    const locationAndClass = [...(accordion.querySelector("button")?.querySelectorAll("span") || [])]
      .map((el) => normalize(el.textContent))
      .filter(Boolean);
    const location = locationAndClass.find((s) => !s.includes("クラス") && !s.includes("東京校")) || "";
    const className = locationAndClass.find((s) => s.includes("クラス")) || "";

    const { subject, term } = getPageMeta();
    return {
      dateInfoBlock,
      row: {
        科目: subject,
        開講期: term,
        開催場所: location,
        クラス: className,
      },
      session: {
        date: toIsoDate(dtMatch[1]),
        start: dtMatch[2],
        end: dtMatch[3],
        timezone: dtMatch[4] || "JST",
        dayNo,
      },
    };
  };

  const parseSessionFromAccordionHeader = (accordion) => {
    const button = accordion.querySelector(":scope > button");
    if (!button) return null;

    const dayHead = normalize(button.querySelector("h3")?.textContent || "");
    const dayNo = Number((dayHead.match(/Day\s*(\d+)/i) || [])[1] || 0);
    if (!dayNo) return null;

    const dateText = normalize(
      [...button.querySelectorAll("p")]
        .map((p) => normalize(p.textContent))
        .find((t) => /\d{4}\/\d{1,2}\/\d{1,2}/.test(t)) || ""
    );
    const timeText = normalize(
      [...button.querySelectorAll("p")]
        .map((p) => normalize(p.textContent))
        .find((t) => /\d{1,2}:\d{2}\s*[～~\-]\s*\d{1,2}:\d{2}/.test(t)) || ""
    );

    const infoSpans = [...button.querySelectorAll("div span")]
      .map((el) => normalize(el.textContent))
      .filter(Boolean);
    const location = infoSpans.find((s) => !s.includes("クラス") && !/\d{4}\/\d{1,2}\/\d{1,2}/.test(s) && !/\d{1,2}:\d{2}/.test(s)) || "";
    const className = infoSpans.find((s) => s.includes("クラス")) || "";

    const dt = `${dateText} ${timeText}`;
    const dtMatch = dt.match(/(\d{4}\/\d{1,2}\/\d{1,2}).*?(\d{1,2}:\d{2})\s*[～~\-]\s*(\d{1,2}:\d{2})\s*([A-Z]{2,5})?/);
    if (!dtMatch) return null;

    const { subject, term } = getPageMeta();
    return {
      row: {
        科目: subject,
        開講期: term,
        開催場所: location,
        クラス: className,
      },
      session: {
        date: toIsoDate(dtMatch[1]),
        start: dtMatch[2],
        end: dtMatch[3],
        timezone: dtMatch[4] || "JST",
        dayNo,
      },
    };
  };

  const applyStyles = (el, styles) => {
    Object.entries(styles || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) el.style[k] = String(v);
    });
  };

  const createCalendarRegisterActionElement = ({
    className,
    containerTag = "div",
    containerStyle,
    linkStyle,
    statusTag = "span",
    statusStyle,
    onClick,
  }) => {
    const wrap = document.createElement(containerTag);
    if (className) wrap.className = className;
    applyStyles(wrap, containerStyle);

    const link = document.createElement("a");
    link.href = "#";
    link.textContent = "Googleカレンダー登録";
    applyStyles(link, {
      fontSize: "12px",
      fontWeight: "700",
      color: "#0E357F",
      textDecoration: "underline",
      cursor: "pointer",
      ...linkStyle,
    });

    const status = document.createElement(statusTag);
    applyStyles(status, {
      marginLeft: "8px",
      fontSize: "12px",
      color: "#666",
      ...statusStyle,
    });

    const setBusy = (busy, text) => {
      link.style.pointerEvents = busy ? "none" : "auto";
      link.style.opacity = busy ? "0.6" : "1";
      status.textContent = text || "";
    };

    link.addEventListener("click", async (ev) => {
      ev.preventDefault();
      try {
        setBusy(true, "登録中...");
        await onClick();
        setBusy(false, "登録しました");
      } catch (err) {
        setBusy(false, `失敗: ${err.message}`);
      }
    });

    wrap.append(link, status);
    return wrap;
  };

  const createDayActionElement = (onClick) =>
    createCalendarRegisterActionElement({
      className: DAY_ACTION_CLASS,
      containerTag: "span",
      containerStyle: {
        display: "block",
        marginTop: "6px",
      },
      onClick,
    });

  const createBulkActionElement = (onClick) => {
    const wrap = document.createElement("div");
    wrap.id = BULK_ACTION_ID;
    wrap.style.marginTop = "16px";
    wrap.style.marginBottom = "8px";
    wrap.style.textAlign = "center";

    const link = document.createElement("a");
    link.href = "#";
    link.textContent = "Googleカレンダーに一括登録";
    link.style.fontSize = "13px";
    link.style.fontWeight = "700";
    link.style.color = "#0E357F";
    link.style.textDecoration = "underline";
    link.style.cursor = "pointer";

    const status = document.createElement("div");
    status.style.fontSize = "12px";
    status.style.marginTop = "6px";
    status.style.color = "#666";
    status.textContent = "";

    const setBusy = (busy, text) => {
      link.style.pointerEvents = busy ? "none" : "auto";
      link.style.opacity = busy ? "0.6" : "1";
      status.textContent = text || "";
    };

    link.addEventListener("click", async (ev) => {
      ev.preventDefault();
      try {
        setBusy(true, "一括登録中...");
        await onClick();
        setBusy(false, "登録しました");
      } catch (err) {
        setBusy(false, `失敗: ${err.message}`);
      }
    });

    wrap.append(link, status);
    return wrap;
  };

  const createEventActionElement = (onClick) =>
    createCalendarRegisterActionElement({
      className: EVENT_ACTION_CLASS,
      containerStyle: {
        marginTop: "8px",
        width: "100%",
        flexBasis: "100%",
      },
      linkStyle: {
        fontSize: "13px",
      },
      onClick,
    });

  const createSocialActionElement = (onClick) =>
    createCalendarRegisterActionElement({
      className: SOCIAL_ACTION_CLASS,
      containerStyle: {
        marginTop: "8px",
      },
      onClick,
    });

  const parseEventSection = (section) => {
    const title = normalize(section.querySelector("h2")?.textContent || "");
    if (!title) return null;

    const dateLabel = [...section.querySelectorAll("div")]
      .find((el) => normalize(el.textContent) === "開催日時");
    if (!dateLabel) return null;
    const dateValue = dateLabel.nextElementSibling;
    if (!dateValue) return null;

    const dateTimeText = normalize(dateValue.textContent || "");
    const m = dateTimeText.match(
      /(\d{4}\/\d{1,2}\/\d{1,2})\s*\([^)]*\)\s*(\d{1,2}:\d{2})\s*[～~\-]\s*(\d{1,2}:\d{2})\s*([A-Z]{2,5})?/
    );
    if (!m) return null;

    return {
      mountEl: dateValue,
      row: {
        科目: title,
        開催場所: "",
        クラス: "",
      },
      session: {
        date: toIsoDate(m[1]),
        start: m[2],
        end: m[3],
        timezone: m[4] || "JST",
        dayNo: 0,
      },
    };
  };

  const injectParsedActions = ({
    elements,
    parseElement,
    actionClass,
    createAction,
    logLabel,
    decorateAction,
  }) => {
    const list = Array.isArray(elements) ? elements : [];
    if (!list.length) return;

    for (const el of list) {
      const parsed = parseElement(el);
      if (!parsed) continue;

      const { mountEl, row, session } = parsed;
      if (!mountEl || mountEl.querySelector(`.${actionClass}`)) continue;

      const action = createAction(() => syncSchedulesToCalendar(row, [session]));
      if (typeof decorateAction === "function") decorateAction(action, parsed);
      mountEl.appendChild(action);
      log(logLabel, { title: row["科目"], session });
    }
  };

  const injectEventScheduleActions = () =>
    injectParsedActions({
      elements: [...document.querySelectorAll("section.mb-2 > div.mb-8, div.mb-8")],
      parseElement: parseEventSection,
      actionClass: EVENT_ACTION_CLASS,
      createAction: createEventActionElement,
      logLabel: "Injected event calendar action:",
    });

  const parseSocialCard = (card) => {
    const parsed = communityParser?.extractSocialPostFromHtmlSnippet?.(card.innerHTML);
    if (!parsed) return null;
    const relatedUrl =
      parsed.row["関連URL"] ||
      extractRelatedUrl(card.querySelector(".editor-content")) ||
      extractRelatedUrl(card);

    return {
      mountEl: card.querySelector("div.font-medium.text-xs.leading-\\[18px\\].mb-2") || card,
      row: {
        ...parsed.row,
        科目: buildSocialEventTitle(parsed.row["科目"]),
        関連URL: relatedUrl,
      },
      session: parsed.session,
    };
  };

  const injectSocialActions = () => {
    const socialHeaders = [...document.querySelectorAll("span")]
      .filter((el) => normalize(el.textContent) === "勉強会 ・ 懇親会");
    if (!socialHeaders.length) return;

    injectParsedActions({
      elements: [...document.querySelectorAll("div.bg-gray1.rounded-lg.text-black2.pt-4.px-4.pb-5")],
      parseElement: parseSocialCard,
      actionClass: SOCIAL_ACTION_CLASS,
      createAction: createSocialActionElement,
      logLabel: "Injected social calendar action:",
    });
  };

  const parseCommunityPostCard = (card) => {
    const infoBlock = [...card.querySelectorAll("div")]
      .find((el) => normalize(el.textContent).includes("開催日時："));
    if (!infoBlock) return null;

    const lineDivs = [...infoBlock.children].filter(
      (el) => el && el.tagName === "DIV"
    );
    const isDateLine = (s) => /^開催日時[:：]/.test(normalize(s));
    const parsed = communityParser?.extractCommunityPostFromHtmlSnippet?.(card.innerHTML);
    if (!parsed) return null;
    const relatedUrl =
      parsed.row["関連URL"] ||
      extractRelatedUrl(card.querySelector(".editor-content")) ||
      extractRelatedUrl(card);

    const dateLineEl =
      lineDivs.find((el) => isDateLine(el.textContent)) || null;

    return {
      mountEl: dateLineEl || infoBlock,
      row: {
        ...parsed.row,
        科目: buildSocialEventTitle(parsed.row["科目"]),
        関連URL: relatedUrl,
      },
      session: parsed.session,
    };
  };

  const injectCommunityPostActions = () =>
    injectParsedActions({
      elements: [...document.querySelectorAll("div.text-black2.grid.grid-cols-1")],
      parseElement: parseCommunityPostCard,
      actionClass: SOCIAL_ACTION_CLASS,
      createAction: createSocialActionElement,
      logLabel: "Injected community-post calendar action:",
      decorateAction: (action) => {
        action.style.display = "inline-block";
        action.style.marginLeft = "8px";
        action.style.marginTop = "0";
        action.style.verticalAlign = "baseline";
      },
    });

  const upsertBulkAction = (parsedList) => {
    const accordions = [...document.querySelectorAll('div[id^="day-accordion-"]')];
    if (!accordions.length) return;

    const headerParsed = accordions
      .map((acc) => parseSessionFromAccordionHeader(acc))
      .filter(Boolean);
    const source = headerParsed.length ? headerParsed : parsedList;
    if (!source.length) return;

    const sessions = source.map((x) => x.session).sort((a, b) => a.dayNo - b.dayNo);
    const row = source[0].row;
    const parent = accordions[accordions.length - 1].parentElement;
    if (!parent) return;

    let bulk = parent.querySelector(`#${BULK_ACTION_ID}`);
    if (bulk) return;

    bulk = createBulkActionElement(() => syncSchedulesToCalendar(row, sessions));
    parent.appendChild(bulk);
    log("Injected class-detail bulk calendar action:", sessions.length);
  };

  const injectDayDetailActions = () => {
    const accordions = [...document.querySelectorAll('div[id^="day-accordion-"]')];
    if (!accordions.length) return;
    const parsedList = [];

    for (const accordion of accordions) {
      const parsed = parseDaySessionFromAccordion(accordion);
      if (!parsed) continue;
      parsedList.push(parsed);

      const { dateInfoBlock, row, session } = parsed;
      const detailTextSpan = dateInfoBlock.querySelector(":scope > span:nth-of-type(2)");
      const mountEl = detailTextSpan || dateInfoBlock;
      if (mountEl.querySelector(`.${DAY_ACTION_CLASS}`)) continue;

      const action = createDayActionElement(() => syncSchedulesToCalendar(row, [session]));
      mountEl.appendChild(action);
      log("Injected class-detail day action:", session);
    }

    upsertBulkAction(parsedList);
  };

  const scheduleDayDetailInjection = () => {
    if (detailInjectTimer) clearTimeout(detailInjectTimer);
    detailInjectTimer = setTimeout(() => {
      injectDayDetailActions();
      injectEventScheduleActions();
      injectSocialActions();
      injectCommunityPostActions();
    }, 200);
  };

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

  const observer = new MutationObserver(() => {
    scheduleDayDetailInjection();
  });
  const onUrlChange = () => {
    if (lastUrl === location.href) return;
    lastUrl = location.href;
    scheduleDayDetailInjection();
  };

  const hookHistory = () => {
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      onUrlChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      onUrlChange();
    };

    window.addEventListener("popstate", onUrlChange);
  };

  const startUrlPoll = () => {
    if (urlPollTimer) return;
    urlPollTimer = setInterval(onUrlChange, URL_POLL_MS);
  };

  const startObserver = () => {
    if (observerStarted || !document.body) return;
    observerStarted = true;
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleDayDetailInjection();
  };

  const bootstrap = () => {
    if (bootstrapped) return;
    bootstrapped = true;
    hookHistory();
    startUrlPoll();
    startObserver();
    injectScript();
    log("content script ready");
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
