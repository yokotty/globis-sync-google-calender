(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.GlobisCalendarPayload = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TZ_MAP = {
    JST: "Asia/Tokyo",
  };

  const FIELD_LABELS = ["科目", "開講期", "開催場所", "クラス", "講師", "初回開講日", "曜日", "時間"];

  const normalize = (v) => String(v || "").replace(/\s+/g, " ").trim();

  const stripLeadingLabel = (value, label) => {
    const src = normalize(value);
    if (!label) return src;
    return src.startsWith(label) ? normalize(src.slice(label.length)) : src;
  };

  const normalizeRow = (row) => {
    const src = row || {};
    const out = {};
    for (const label of FIELD_LABELS) {
      out[label] = stripLeadingLabel(src[label], label);
    }
    return out;
  };

  const toDateTime = (date, hm) => `${date}T${hm}:00`;
  const classLabel = (value) => {
    const v = normalize(value);
    if (!v) return "";
    return v.endsWith("クラス") ? v : `${v}クラス`;
  };

  const buildDescription = (row, session, sourceUrl) => {
    const lines = [
      `Day ${session.dayNo}`,
      row["講師"] ? `講師: ${row["講師"]}` : "",
      row["クラス"] ? `クラス: ${row["クラス"]}` : "",
      row["開講期"] ? `開講期: ${row["開講期"]}` : "",
      row["開催場所"] ? `開催場所: ${row["開催場所"]}` : "",
      sourceUrl ? `取得元: ${sourceUrl}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  };

  const makeExternalKey = (row, session) =>
    [
      "globis",
      row["科目"] || "unknown-subject",
      row["クラス"] || "unknown-class",
      session.dayNo,
      session.date,
      session.start,
      session.end,
    ].join("|");

  const buildCalendarEvents = (rowRaw, sessions, sourceUrl) => {
    const row = normalizeRow(rowRaw);
    const list = Array.isArray(sessions) ? sessions : [];

    return list.map((session) => {
      const timeZone = TZ_MAP[session.timezone] || "Asia/Tokyo";
      const summaryParts = [row["科目"] || "GLOBIS Class", row["開催場所"], classLabel(row["クラス"]), `Day${session.dayNo}`].filter(Boolean);
      const summary = summaryParts.join(" ");
      const location = "";
      const description = buildDescription(row, session, sourceUrl);

      return {
        summary,
        location,
        description,
        start: {
          dateTime: toDateTime(session.date, session.start),
          timeZone,
        },
        end: {
          dateTime: toDateTime(session.date, session.end),
          timeZone,
        },
        extendedProperties: {
          private: {
            globisKey: makeExternalKey(row, session),
          },
        },
      };
    });
  };

  return {
    normalizeRow,
    buildCalendarEvents,
  };
});
