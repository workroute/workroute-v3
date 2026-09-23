"use client";

import { useState } from "react";

// Must match WIDGET_ORIGIN in public/widget.js exactly.
const WIDGET_ORIGIN = "https://workroute-v3.vercel.app";

export default function WebsiteChatForm({ widgetKey }: { widgetKey: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  const snippet = `<script async src="${WIDGET_ORIGIN}/widget.js" data-widget-key="${widgetKey}"></script>`;

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet);
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 2000);
  }

  if (!widgetKey) {
    return (
      <p className="text-sm text-rig-700">
        Couldn't load your widget key — refresh this page, or contact support if this keeps happening.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display font-semibold text-rig-900">Your embed snippet</p>
        <p className="mt-1 text-xs text-rig-700/70">
          Paste this once into your website's HTML (most site builders have a spot for "custom code" or "header
          scripts") — that's the whole setup, nothing else to configure.
        </p>
        <pre className="mt-3 overflow-x-auto rounded border border-rig-700/20 bg-paper-50 p-3 text-xs text-rig-900">
          <code>{snippet}</code>
        </pre>
        <button type="button" onClick={handleCopy} className="btn-primary mt-3">
          {copyStatus === "copied" ? "Copied!" : "Copy snippet"}
        </button>
      </div>

      <div className="border-t border-rig-900/10 pt-6">
        <p className="font-display font-semibold text-rig-900">Try it now</p>
        <p className="mt-1 text-xs text-rig-700/70">
          This is exactly what your website visitors will see — chat with your own Sarah below before adding the
          snippet to your site.
        </p>
        <div className="relative mt-3 h-[500px] w-full overflow-hidden rounded-lg border border-rig-700/20">
          <iframe
            src={`/widget-frame?key=${widgetKey}&preview=1`}
            title="Widget preview"
            className="h-full w-full border-none"
          />
        </div>
      </div>
    </div>
  );
}
