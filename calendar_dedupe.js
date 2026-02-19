(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.GlobisCalendarDedupe = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const buildDuplicateLookupUrl = (calendarId, key) => {
    const k = String(key || "").trim();
    if (!k) return "";

    const params = new URLSearchParams({
      maxResults: "1",
      singleEvents: "true",
      showDeleted: "false",
    });
    params.append("privateExtendedProperty", `globisKey=${k}`);
    return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events?${params.toString()}`;
  };

  const hasDuplicateItems = (result) =>
    Array.isArray(result?.items) && result.items.length > 0;

  return {
    buildDuplicateLookupUrl,
    hasDuplicateItems,
  };
});
