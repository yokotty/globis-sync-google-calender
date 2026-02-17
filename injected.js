(() => {
  if (window.__globisScheduleNetworkHookInstalled) return;
  window.__globisScheduleNetworkHookInstalled = true;

  const KEYWORD_RE = /(class|schedule|calendar|zr|detail|event|lesson|lecture)/i;

  const emit = (kind, payload) => {
    window.dispatchEvent(
      new CustomEvent("globis-schedule-network", {
        detail: {
          kind,
          ts: Date.now(),
          ...payload,
        },
      })
    );
  };

  const shouldTrack = (url = "") => KEYWORD_RE.test(String(url));

  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = args[0] instanceof Request ? args[0].url : String(args[0] || "");
    const method = args[0] instanceof Request ? args[0].method : args[1]?.method || "GET";

    const res = await originalFetch(...args);
    if (!shouldTrack(url)) return res;

    try {
      const clone = res.clone();
      const text = await clone.text();
      emit("fetch", {
        url,
        method,
        status: res.status,
        bodyPreview: text.slice(0, 4000),
      });
    } catch (e) {
      emit("fetch", {
        url,
        method,
        status: res.status,
        error: String(e),
      });
    }
    return res;
  };

  const XHR = XMLHttpRequest.prototype;
  const originalOpen = XHR.open;
  const originalSend = XHR.send;

  XHR.open = function (method, url, ...rest) {
    this.__globisUrl = String(url || "");
    this.__globisMethod = String(method || "GET");
    return originalOpen.call(this, method, url, ...rest);
  };

  XHR.send = function (...args) {
    this.addEventListener("load", () => {
      if (!shouldTrack(this.__globisUrl)) return;
      const text = typeof this.responseText === "string" ? this.responseText : "";
      emit("xhr", {
        url: this.__globisUrl,
        method: this.__globisMethod,
        status: this.status,
        bodyPreview: text.slice(0, 4000),
      });
    });
    return originalSend.call(this, ...args);
  };

  emit("hook", { message: "network hooks installed" });
})();
