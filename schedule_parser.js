(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.GlobisScheduleParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DATE_TIME_RE =
    /Day\s*(\d{1,2}?)(?=(?:20)\d{2}\s*\/?\s*\d{1,2}\s*\/)\s*(20\d{2})\s*\/?\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*（[^）]*）\s*(\d{1,2}:\d{2})\s*[～~\-]\s*(\d{1,2}:\d{2})(?:\s*([A-Z]{2,5}))?(?=\s*Day\s*\d{1,2}\s*20\d{2}|\s*$)/g;

  const pad2 = (n) => String(n).padStart(2, "0");

  const uniqueBy = (items, keyFn) => {
    const seen = new Set();
    const out = [];
    for (const item of items) {
      const key = keyFn(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };

  const parseSchedulesFromText = (text, fallbackTimezone) => {
    const src = String(text || "");
    const entries = [];
    let m;

    while ((m = DATE_TIME_RE.exec(src)) !== null) {
      const dayNo = Number(m[1]);
      const year = Number(m[2]);
      const month = Number(m[3]);
      const day = Number(m[4]);
      const start = m[5];
      const end = m[6];
      const timezone = m[7] || fallbackTimezone || "JST";

      entries.push({
        date: `${year}-${pad2(month)}-${pad2(day)}`,
        start,
        end,
        timezone,
        dayNo,
      });
    }

    return uniqueBy(entries, (e) => `${e.date}|${e.start}|${e.end}|${e.timezone}|${e.dayNo}`);
  };

  const parseScheduleCandidates = (candidates, fallbackTimezone) => {
    const lines = Array.isArray(candidates) ? candidates : [];
    const all = [];
    for (const line of lines) {
      all.push(...parseSchedulesFromText(line, fallbackTimezone));
    }
    return uniqueBy(all, (e) => `${e.date}|${e.start}|${e.end}|${e.timezone}|${e.dayNo}`);
  };

  return {
    parseSchedulesFromText,
    parseScheduleCandidates,
  };
});
