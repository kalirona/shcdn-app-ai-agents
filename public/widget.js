(() => {
  var scripts = document.getElementsByTagName("script");
  var current = null;
  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].getAttribute("data-agent")) {
      current = scripts[i];
      break;
    }
  }
  if (!current) return;

  var agentId = current.getAttribute("data-agent");
  var baseUrl = window.location.origin;

  var iframe = document.createElement("iframe");
  iframe.src = baseUrl + "/widget?agent=" + encodeURIComponent(agentId);
  iframe.id = "agent-ai-widget-frame";
  iframe.setAttribute("title", "Chat widget");
  iframe.style.cssText =
    "position:fixed;bottom:20px;right:20px;width:0;height:0;border:none;z-index:999999;transition:all 0.3s ease;";

  var toggle = document.createElement("button");
  toggle.id = "agent-ai-widget-toggle";
  toggle.setAttribute("aria-label", "Open chat widget");
  toggle.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  toggle.style.cssText =
    "position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:none;background:#3b82f6;color:white;cursor:pointer;z-index:999998;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;transition:transform 0.2s;";

  var isOpen = false;
  toggle.addEventListener("click", () => {
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
      toggle.style.transform = "scale(1)";
    }
  });

  document.body.appendChild(iframe);
  document.body.appendChild(toggle);
})();
