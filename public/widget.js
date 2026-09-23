(function () {
  // §Website Widget — the tradie-facing snippet is just:
  //   <script async src="https://workroute-v3.vercel.app/widget.js" data-widget-key="..."></script>
  // Everything else (launcher bubble, chat window) lives inside the iframe
  // this injects — this file only injects the container + iframe and
  // resizes the container on request. Kept as plain, dependency-free JS
  // (no bundler) since it runs on someone else's page-load performance.
  //
  // IMPORTANT: this must always be the real, current production origin —
  // never derived from window.location (that would point at the tradie's
  // own site, not ours). Updated 2026-09-17 to the real custom domain now
  // that it's set up — middleware.ts redirects the old vercel.app address
  // here, so this must stay in sync with CANONICAL_HOST there, or a
  // postMessage's event.origin check silently stops matching (the iframe
  // would load from the redirected domain while this constant still named
  // the old one, exactly the resize-breaking bug that guarding against
  // guessed at when this was first written).
  var WIDGET_ORIGIN = "https://app.workroute.com.au";
  var CONTAINER_ID = "workroute-widget-container";

  // Guards against the snippet being pasted twice on the same page.
  if (document.getElementById(CONTAINER_ID)) return;

  var currentScript = document.currentScript;
  var widgetKey = currentScript && currentScript.getAttribute("data-widget-key");
  if (!widgetKey) {
    console.error("[WorkRoute widget] missing data-widget-key attribute on the script tag");
    return;
  }

  // §fix — an iframe blocks clicks across its whole rectangle regardless of
  // what's actually drawn inside it, even fully transparent areas. The old
  // single CLOSED_SIZE (300x80, right-aligned content) left a wide invisible
  // dead zone to the left of the bubble — harmless most of the time, but a
  // real bug once a host site's footer (e.g. a Terms & Conditions link)
  // scrolls into that same fixed screen corner, since this container never
  // moves with the page. Fix: CLOSED_SIZE now tightly wraps just the round
  // avatar bubble itself (no dead space at all), and the wider box is only
  // ever applied transiently, while the "Chat with {business}" callout pill
  // is actually showing (LAUNCHER_SIZE) — see the mode-based resize
  // listener below.
  var CLOSED_SIZE = { width: "76px", height: "76px", radius: "9999px" };
  var LAUNCHER_SIZE = { width: "300px", height: "80px", radius: "16px" };
  var OPEN_SIZE = { width: "380px", height: "600px", radius: "12px" };

  var container = document.createElement("div");
  container.id = CONTAINER_ID;
  container.style.position = "fixed";
  container.style.bottom = "20px";
  container.style.right = "20px";
  container.style.width = CLOSED_SIZE.width;
  container.style.height = CLOSED_SIZE.height;
  container.style.borderRadius = CLOSED_SIZE.radius;
  container.style.overflow = "hidden";
  container.style.zIndex = "2147483000";
  container.style.maxWidth = "calc(100vw - 40px)";
  container.style.maxHeight = "calc(100vh - 40px)";
  container.style.transition = "width 0.2s ease, height 0.2s ease";

  var iframe = document.createElement("iframe");
  iframe.src = WIDGET_ORIGIN + "/widget-frame?key=" + encodeURIComponent(widgetKey);
  iframe.title = "Chat widget";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.background = "transparent";

  container.appendChild(iframe);
  document.body.appendChild(container);

  // Never trust an unchecked postMessage, even from an iframe we control —
  // some other script on the host page could race a spoofed message.
  window.addEventListener("message", function (event) {
    if (event.origin !== WIDGET_ORIGIN) return;
    if (!event.data || event.data.type !== "workroute-widget-resize") return;

    var size =
      event.data.mode === "open" ? OPEN_SIZE : event.data.mode === "launcher" ? LAUNCHER_SIZE : CLOSED_SIZE;
    container.style.width = size.width;
    container.style.height = size.height;
    container.style.borderRadius = size.radius;
  });
})();
