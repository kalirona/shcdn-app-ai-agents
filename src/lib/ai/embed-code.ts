"use server";

import { getAgentById } from "@/lib/auth/actions/agent.actions";

export async function getEmbedCode(agentId: string): Promise<{ code: string; error?: string }> {
  const agentResult = await getAgentById(agentId);

  if (!agentResult.agent) {
    return { code: "", error: "Agent not found" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const embedUrl = `${baseUrl}/widget?agent=${agentId}`;

  const code = `<!-- Agent AI Chat Widget -->
<script>
(function() {
  var config = {
    agentId: "${agentId}",
    baseUrl: "${baseUrl}",
    embedUrl: "${embedUrl}"
  };

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.src = config.embedUrl;
  iframe.id = 'agent-ai-widget-frame';
  iframe.style.cssText = 'position:fixed;bottom:20px;right:20px;width:0;height:0;border:none;z-index:999999;transition:all 0.3s ease;';

  // Create toggle button
  var toggle = document.createElement('button');
  toggle.id = 'agent-ai-widget-toggle';
  toggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  toggle.style.cssText = 'position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:none;background:#3b82f6;color:white;cursor:pointer;z-index:999998;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';

  var isOpen = false;

  toggle.addEventListener('click', function() {
    isOpen = !isOpen;
    if (isOpen) {
      iframe.style.width = '380px';
      iframe.style.height = '600px';
      iframe.style.bottom = '88px';
      iframe.style.borderRadius = '12px';
      iframe.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)';
      toggle.style.transform = 'scale(0.9)';
    } else {
      iframe.style.width = '0';
      iframe.style.height = '0';
      toggle.style.transform = 'scale(1)';
    }
  });

  document.body.appendChild(iframe);
  document.body.appendChild(toggle);

  // Handle messages from widget
  window.addEventListener('message', function(e) {
    if (e.origin !== config.baseUrl) return;
    if (e.data === 'close-widget' && isOpen) {
      toggle.click();
    }
  });
})();
</script>
<!-- End Agent AI Chat Widget -->`;

  return { code };
}
