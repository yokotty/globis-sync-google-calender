importScripts("calendar_payload.js");

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

const calendarInsert = async (token, event) => {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Calendar API error ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
};

const insertWithRetry = async (event) => {
  let token = await getAuthToken(true);
  try {
    return await calendarInsert(token, event);
  } catch (err) {
    if (err.status === 401) {
      await removeToken(token);
      token = await getAuthToken(true);
      return calendarInsert(token, event);
    }
    throw err;
  }
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
  for (const ev of events) {
    const inserted = await insertWithRetry(ev);
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
    created,
  };
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "GLOBIS_CREATE_CALENDAR_EVENTS") return;

  createEvents(msg.payload)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
