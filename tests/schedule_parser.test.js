const test = require("node:test");
const assert = require("node:assert/strict");
const parser = require("../schedule_parser.js");

const SAMPLE_TEXT =
  "開講スケジュール2026年01月期(MBA)人材マネジメント曜日・時間木 19:00～22:00 JST" +
  "Day 1202601/08（木）19:00～22:00 JST" +
  "Day 2202601/22（木）19:00～22:00 JST" +
  "Day 3202602/05（木）19:00～22:00 JST" +
  "Day 4202602/19（木）19:00～22:00 JST" +
  "Day 5202603/05（木）19:00～22:00 JST" +
  "Day 6202603/19（木）19:00～22:00 JST";

test("parseSchedulesFromText should parse day/date/time/timezone entries", () => {
  const out = parser.parseSchedulesFromText(SAMPLE_TEXT, "JST");
  assert.equal(out.length, 6);
  assert.deepEqual(out[0], {
    date: "2026-01-08",
    start: "19:00",
    end: "22:00",
    timezone: "JST",
    dayNo: 1,
  });
  assert.deepEqual(out[5], {
    date: "2026-03-19",
    start: "19:00",
    end: "22:00",
    timezone: "JST",
    dayNo: 6,
  });
});

test("parseScheduleCandidates should dedupe same entries across candidates", () => {
  const out = parser.parseScheduleCandidates([SAMPLE_TEXT, SAMPLE_TEXT], "JST");
  assert.equal(out.length, 6);
});
