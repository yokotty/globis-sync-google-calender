const test = require("node:test");
const assert = require("node:assert/strict");
const dedupe = require("../calendar_dedupe.js");

test("buildDuplicateLookupUrl builds lookup url with privateExtendedProperty", () => {
  const url = dedupe.buildDuplicateLookupUrl(
    "primary",
    "globis|(MBA)人材マネジメント|A|4|2026-02-19|19:00|22:00"
  );
  assert.ok(url.startsWith("https://www.googleapis.com/calendar/v3/calendars/primary/events?"));
  assert.ok(url.includes("maxResults=1"));
  assert.ok(url.includes("singleEvents=true"));
  assert.ok(url.includes("showDeleted=false"));
  assert.ok(url.includes("privateExtendedProperty=globisKey%3Dglobis%7C"));
});

test("buildDuplicateLookupUrl returns empty string when key is missing", () => {
  assert.equal(dedupe.buildDuplicateLookupUrl("primary", ""), "");
});

test("hasDuplicateItems returns true only when items has at least one element", () => {
  assert.equal(dedupe.hasDuplicateItems({ items: [{ id: "1" }] }), true);
  assert.equal(dedupe.hasDuplicateItems({ items: [] }), false);
  assert.equal(dedupe.hasDuplicateItems({}), false);
  assert.equal(dedupe.hasDuplicateItems(null), false);
});
