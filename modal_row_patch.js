(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.GlobisModalRowPatch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

  const isExternalHttpUrl = (href) => /^https?:\/\//i.test(normalize(href));

  const isTeacherUrl = (href) => /\/teacher\//i.test(normalize(href));

  const pickSubjectLink = (links) => {
    const list = Array.isArray(links) ? links : [];
    return list.find((link) => isExternalHttpUrl(link.href) && !isTeacherUrl(link.href) && normalize(link.text)) || null;
  };

  const pickRelatedLink = (links) => {
    const list = Array.isArray(links) ? links : [];
    return list.find((link) => isExternalHttpUrl(link.href)) || null;
  };

  const extractModalRowPatch = ({ modalText, links }) => {
    const text = normalize(modalText);
    const subjectLink = pickSubjectLink(links);
    const relatedLink = pickRelatedLink(links);
    const term = (text.match(/\d{4}年\d{2}月期/) || [])[0] || "";
    const subject = normalize(subjectLink?.text || "");
    const relatedUrl = normalize(relatedLink?.href || "");

    const patch = {};
    if (subject) patch["科目"] = subject;
    if (term) patch["開講期"] = term;
    if (relatedUrl) patch["関連URL"] = relatedUrl;
    return patch;
  };

  return {
    extractModalRowPatch,
  };
});
