const test = require("node:test");
const assert = require("node:assert/strict");
const patcher = require("../modal_row_patch.js");

test("extractModalRowPatch picks subject, term and URL from schedule modal metadata", () => {
  const patch = patcher.extractModalRowPatch({
    modalText:
      "開講スケジュール 2026年04月期 (MBA)リーダーシップ開発と倫理・価値観 木 19:00～22:00 JST",
    links: [
      {
        text: "(MBA)リーダーシップ開発と倫理・価値観",
        href: "https://mba.globis.ac.jp/curriculum/detail/lev/index.html",
      },
      {
        text: "田久保 善彦",
        href: "https://mba.globis.ac.jp/curriculum/detail/lev/teacher/takubo_yoshihiko.html",
      },
    ],
  });

  assert.deepEqual(patch, {
    科目: "(MBA)リーダーシップ開発と倫理・価値観",
    開講期: "2026年04月期",
    関連URL: "https://mba.globis.ac.jp/curriculum/detail/lev/index.html",
  });
});

test("extractModalRowPatch skips teacher-only link for subject selection", () => {
  const patch = patcher.extractModalRowPatch({
    modalText: "開講スケジュール 2026年04月期",
    links: [
      {
        text: "田久保 善彦",
        href: "https://mba.globis.ac.jp/curriculum/detail/lev/teacher/takubo_yoshihiko.html",
      },
    ],
  });

  assert.deepEqual(patch, {
    開講期: "2026年04月期",
    関連URL: "https://mba.globis.ac.jp/curriculum/detail/lev/teacher/takubo_yoshihiko.html",
  });
});
