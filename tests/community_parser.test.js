const test = require("node:test");
const assert = require("node:assert/strict");
const parser = require("../community_parser.js");

const SAMPLE_POST_HTML = `
<div class="text-black2 grid grid-cols-1 py-3 px-3">
  <div class="flex justify-start items-center font-bold text-lg mt-1 wrap-anywhere">Day3 勉強会</div>
  <div>
    <div class="md:flex justify-between mt-2">
      <button>参加</button>
      <button>不参加</button>
    </div>
    <div class="mt-4 text-[13px]">
      <div>開催日時：2026/02/22 08:30 JST</div>
      <div class="line-clamp-2 break-words">開催場所：Zoom</div>
      <div>回答期限：</div>
    </div>
    <div class="editor-content">
      <a href="https://us06web.zoom.us/j/82089599525?pwd=abc">Zoom ミーティングに参加する</a>
    </div>
  </div>
</div>
`;

const SAMPLE_SOCIAL_HTML = `
<div class="bg-gray1 rounded-lg text-black2 pt-4 px-4 pb-5">
  <div class="font-bold text-sm">Day3 勉強会</div>
  <div class="editor-content">
    <a href="https://teams.microsoft.com/meet/46954911546975?p=abc">Teams</a>
  </div>
  <div class="font-medium text-xs leading-[18px] mb-2">
    <p>開催日時：2026/02/22 21:30～22:30 JST</p>
    <p>開催場所：オンライン (Teams)</p>
    <p>回答期限：</p>
  </div>
</div>
`;

test("parseLooseDateTime fills 1-hour range when end time is missing", () => {
  const out = parser.parseLooseDateTime("2026/02/22 08:30 JST", 60);
  assert.deepEqual(out, {
    date: "2026-02-22",
    start: "08:30",
    end: "09:30",
    endDate: "2026-02-22",
    timezone: "JST",
  });
});

test("extractCommunityPostFromHtmlSnippet parses sample post", () => {
  const out = parser.extractCommunityPostFromHtmlSnippet(SAMPLE_POST_HTML);
  assert.ok(out);
  assert.equal(out.row["科目"], "Day3 勉強会");
  assert.equal(out.row["開催場所"], "Zoom");
  assert.equal(out.row["関連URL"], "https://us06web.zoom.us/j/82089599525?pwd=abc");
  assert.equal(out.session.date, "2026-02-22");
  assert.equal(out.session.start, "08:30");
  assert.equal(out.session.end, "09:30");
  assert.equal(out.session.dayNo, 0);
});

test("extractSocialPostFromHtmlSnippet parses side social card", () => {
  const out = parser.extractSocialPostFromHtmlSnippet(SAMPLE_SOCIAL_HTML);
  assert.ok(out);
  assert.equal(out.row["科目"], "Day3 勉強会");
  assert.equal(out.row["開催場所"], "オンライン (Teams)");
  assert.equal(out.row["関連URL"], "https://teams.microsoft.com/meet/46954911546975?p=abc");
  assert.equal(out.session.date, "2026-02-22");
  assert.equal(out.session.start, "21:30");
  assert.equal(out.session.end, "22:30");
});
