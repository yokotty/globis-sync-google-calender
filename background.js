importScripts("calendar_payload.js");
importScripts("calendar_dedupe.js");

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_ID = "primary";

const getAuthToken = (interactive) =>
  new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive, scopes: [CALENDAR_SCOPE] }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!token) {
        reject(new Error("Failed to get OAuth token."));
        return;
      }
      resolve(token);
    });
  });

const removeToken = (token) =>
  new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });

const calendarApiRequest = async (token, url, options = {}) => {
  const res = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.contentType ? { "Content-Type": options.contentType } : {}),
    },
    ...(options.body ? { body: options.body } : {}),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Calendar API error ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
};

const requestWithRetry = async (requestFn) => {
  let token = await getAuthToken(true);
  try {
    return await requestFn(token);
  } catch (err) {
    if (err.status === 401) {
      await removeToken(token);
      token = await getAuthToken(true);
      return requestFn(token);
    }
    throw err;
  }
};

const calendarInsert = async (token, event) => {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
  return calendarApiRequest(token, url, {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify(event),
  });
};

const hasDuplicateByKey = async (token, event) => {
  const key = event?.extendedProperties?.private?.globisKey;
  if (!key) return false;
  if (!globalThis.GlobisCalendarDedupe) return false;

  const url = globalThis.GlobisCalendarDedupe.buildDuplicateLookupUrl(CALENDAR_ID, key);
  if (!url) return false;
  const result = await calendarApiRequest(token, url);
  return globalThis.GlobisCalendarDedupe.hasDuplicateItems(result);
};

const createEvents = async ({ row, sessions, sourceUrl }) => {
  if (!globalThis.GlobisCalendarPayload) {
    throw new Error("calendar payload helper is not loaded.");
  }

  const events = globalThis.GlobisCalendarPayload.buildCalendarEvents(row, sessions, sourceUrl);
  if (!events.length) {
    return { createdCount: 0, created: [] };
  }

  const created = [];
  const skipped = [];
  for (const ev of events) {
    const exists = await requestWithRetry((token) => hasDuplicateByKey(token, ev));
    if (exists) {
      skipped.push({
        summary: ev.summary,
        key: ev?.extendedProperties?.private?.globisKey || "",
      });
      continue;
    }

    const inserted = await requestWithRetry((token) => calendarInsert(token, ev));
    created.push({
      id: inserted.id,
      htmlLink: inserted.htmlLink,
      summary: inserted.summary,
      start: inserted.start,
      end: inserted.end,
    });
  }

  return {
    createdCount: created.length,
    skippedCount: skipped.length,
    created,
    skipped,
  };
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "GLOBIS_CREATE_CALENDAR_EVENTS") return;

  createEvents(msg.payload)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
