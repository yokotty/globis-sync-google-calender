(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.GlobisCommunityParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const normalize = (s) => String(s || "").replace(/\s+/g, " ").trim();

  const toIsoDate = (dateText) => {
    const m = String(dateText || "").match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (!m) return "";
    return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
  };

  const addDuration = (dateIso, hm, minutesToAdd) => {
    const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m || !dateIso) return { date: dateIso, time: hm };

    const base = new Date(`${dateIso}T${String(Number(m[1])).padStart(2, "0")}:${m[2]}:00+09:00`);
    if (Number.isNaN(base.getTime())) return { date: dateIso, time: hm };

    const end = new Date(base.getTime() + Number(minutesToAdd || 0) * 60 * 1000);
    const y = end.getFullYear();
    const mo = String(end.getMonth() + 1).padStart(2, "0");
    const d = String(end.getDate()).padStart(2, "0");
    const hh = String(end.getHours()).padStart(2, "0");
    const mm = String(end.getMinutes()).padStart(2, "0");
    return { date: `${y}-${mo}-${d}`, time: `${hh}:${mm}` };
  };

  const parseLooseDateTime = (raw, defaultMinutes = 60) => {
    const m = normalize(raw).match(
      /(\d{4}\/\d{1,2}\/\d{1,2})\s*(?:\([^)]*\))?\s*(\d{1,2}:\d{2})(?:\s*[～~\-]\s*(\d{1,2}:\d{2}))?\s*([A-Z]{2,5})?/
    );
    if (!m) return null;
    const startDate = toIsoDate(m[1]);
    const start = m[2];
    const autoEnd = addDuration(startDate, start, defaultMinutes);
    return {
      date: startDate,
      start,
      end: m[3] || autoEnd.time,
      endDate: m[3] ? startDate : autoEnd.date,
      timezone: m[4] || "JST",
    };
  };

  const extractCommunityPostFromHtmlSnippet = (html) => {
    const src = String(html || "");
    const title = normalize((src.match(/font-bold text-lg[^>]*>([^<]+)</) || [])[1]);
    const hasAttend = />参加</.test(src);
    const hasDecline = />不参加</.test(src);
    const dateRaw = normalize((src.match(/開催日時[:：]([^<]+)/) || [])[1]);
    const placeRaw = normalize((src.match(/開催場所[:：]([^<]+)/) || [])[1]);
    const relatedUrl = normalize((src.match(/href="(https?:\/\/[^"]+)"/i) || [])[1]);
    if (!title || !hasAttend || !hasDecline || !dateRaw) return null;
    const session = parseLooseDateTime(dateRaw);
    if (!session) return null;
    return {
      row: {
        科目: title,
        開催場所: placeRaw,
        クラス: "",
        関連URL: relatedUrl,
      },
      session: { ...session, dayNo: 0 },
    };
  };

  return {
    parseLooseDateTime,
    extractCommunityPostFromHtmlSnippet,
  };
});
