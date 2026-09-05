/**
 * Agent AI Chat Widget — standalone embeddable script.
 *
 * Host your chat widget anywhere with a single script tag:
 *
 *   <script src="https://myapp.sitenexai.com/embed.js"
 *           data-agent="AGENT_ID"
 *           data-base-url="https://myapp.sitenexai.com"
 *           data-position="bottom-right"
 *           data-primary-color="#3b82f6">
 *   </script>
 *
 * Static file, served without auth so third-party sites can load it freely.
 * It injects an iframe pointing at /widget?agent=… (which enforces its own
 * CORS origin checks) and renders the chat UI in the configured corner.
 */
(function () {
  "use strict";

  var script =
    document.currentScript ||
    (document.scripts && document.scripts[document.scripts.length - 1]);

  if (!script || !script.dataset || !script.dataset.agent) {
    console.error(
      "[AgentAI] embed.js requires a data-agent attribute, e.g." +
        ' <script src="…/embed.js" data-agent="AGENT_ID"></script>'
    );
    return;
  }

  // Guard against double-injection on the same page.
  if (document.getElementById("agent-ai-widget-frame")) return;

  var agentId = script.dataset.agent;
  // Prefer the explicit app origin; fall back to the current page origin only
  // if data-base-url wasn't provided.
  var baseUrl = script.dataset.baseUrl || "";
  var position = script.dataset.position || "bottom-right";
  var primaryColor = script.dataset.primaryColor || "#3b82f6";
  var align = position === "bottom-left" ? "left" : "right";

  // iframe hosting the chat UI — always loaded from the application origin.
  var iframe = document.createElement("iframe");
  iframe.src = baseUrl + "/widget?agent=" + encodeURIComponent(agentId);
  iframe.id = "agent-ai-widget-frame";
  iframe.setAttribute("title", "Chat widget");
  iframe.allow = "clipboard-write; encrypted-media; fullscreen";
  iframe.style.cssText =
    "position:fixed;bottom:20px;" +
    align +
    ":20px;width:0;height:0;border:none;border-radius:0;box-shadow:none;z-index:999999;transition:all 0.3s ease;";

  var toggle = document.createElement("button");
  toggle.id = "agent-ai-widget-toggle";
  toggle.setAttribute("aria-label", "Open chat");
  toggle.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  toggle.style.cssText =
    "position:fixed;bottom:20px;" +
    align +
    ":20px;width:56px;height:56px;border-radius:50%;border:none;background:" +
    primaryColor +
    ";color:white;cursor:pointer;z-index:999998;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;transition:transform 0.2s;";

  var isOpen = false;
  toggle.addEventListener("click", function () {
    isOpen = !isOpen;
    if (isOpen) {
      iframe.style.width = "380px";
      iframe.style.height = "600px";
      iframe.style.bottom = "88px";
      iframe.style.borderRadius = "12px";
      iframe.style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)";
      toggle.style.transform = "scale(0.9)";
    } else {
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.borderRadius = "0";
      iframe.style.boxShadow = "none";
      toggle.style.transform = "scale(1)";
    }
  });

  document.body.appendChild(iframe);
  document.body.appendChild(toggle);
})();
