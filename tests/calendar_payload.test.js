const test = require("node:test");
const assert = require("node:assert/strict");
const payload = require("../calendar_payload.js");

test("normalizeRow strips known Japanese labels", () => {
  const row = payload.normalizeRow({
    科目: "科目(MBA)人材マネジメント",
    開講期: "開講期2026年01月期",
    開催場所: "開催場所東京",
    クラス: "クラスA",
    講師: "講師樋口 知比呂",
  });

  assert.equal(row["科目"], "(MBA)人材マネジメント");
  assert.equal(row["開講期"], "2026年01月期");
  assert.equal(row["開催場所"], "東京");
  assert.equal(row["クラス"], "A");
  assert.equal(row["講師"], "樋口 知比呂");
});

test("buildCalendarEvents builds Google Calendar event bodies", () => {
  const row = {
    科目: "科目(MBA)人材マネジメント",
    開講期: "開講期2026年01月期",
    開催場所: "開催場所東京",
    クラス: "クラスA",
    講師: "講師樋口 知比呂",
  };
  const sessions = [
    { date: "2026-01-08", start: "19:00", end: "22:00", timezone: "JST", dayNo: 1 },
    { date: "2026-01-22", start: "19:00", end: "22:00", timezone: "JST", dayNo: 2 },
  ];

  const events = payload.buildCalendarEvents(row, sessions, "https://vc.globis.ac.jp/my/zr/530");
  assert.equal(events.length, 2);
  assert.equal(events[0].summary, "(MBA)人材マネジメント 東京 Aクラス Day1");
  assert.equal(events[0].location, "");
  assert.equal(events[0].start.dateTime, "2026-01-08T19:00:00");
  assert.equal(events[0].start.timeZone, "Asia/Tokyo");
  assert.equal(events[0].end.dateTime, "2026-01-08T22:00:00");
  assert.equal(events[0].extendedProperties.private.globisKey.includes("globis|"), true);
});

test("buildCalendarEvents omits Day suffix when dayNo is 0", () => {
  const row = {
    科目: "G-CHALLENGE 2025本選見学（東京校会場参加）",
    開催場所: "",
    クラス: "",
  };
  const sessions = [
    { date: "2026-02-01", start: "12:30", end: "18:30", timezone: "JST", dayNo: 0 },
  ];

  const events = payload.buildCalendarEvents(row, sessions, "https://vc.globis.ac.jp/my/ev/030");
  assert.equal(events.length, 1);
  assert.equal(events[0].summary, "G-CHALLENGE 2025本選見学（東京校会場参加）");
});
