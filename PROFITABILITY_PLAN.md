# Agent AI — Product & Profitability Plan

> **Product:** AI Customer Agent SaaS — embeddable AI assistants trained on your business knowledge.
> **Stack:** Next.js 16, Directus (backend), Logto (auth), Stripe/Lemon Squeezy (billing), vector RAG pipeline.
> **Status:** Functional MVP on production at `myapp.sitenexai.com`. Auth, agent CRUD, widget, public pages, and logout are working.

---

## 1. What problem does this app solve?

Small and medium businesses cannot afford 24/7 human support, yet customers expect instant answers.

**The core problem:** A business gets the same repetitive questions every day ("What are your hours?", "Do you ship internationally?", "How do I cancel?") and either:
- Loses customers because nobody answers fast enough, or
- Pays a full-time employee to answer the same questions over and over.

**The solution:** Agent AI lets a business create an AI agent trained *only on their own content* (website, documents, FAQs). The agent answers questions instantly, 24/7, on their website via a one-line embed. When it truly can't help, it hands off to a human.

| Pain point | Without Agent AI | With Agent AI |
|---|---|---|
| After-hours questions | Unanswered → lost sales | Answered instantly |
| Repetitive support load | Human time wasted | Handled by AI |
| Lead capture | Manual, inconsistent | Automatic from conversations |
| Bookings | Phone tag | Booked in chat |
| Hiring cost | Full-time staff | One low monthly fee |

---

## 2. Target market & positioning

### Primary ICP (Ideal Customer Profile)
- **Local service businesses** — dentists, salons, plumbers, real estate, restaurants (high phone/repetitive Q volume)
- **E-commerce stores** — shipping, returns, sizing questions (24/7 coverage wins sales)
- **SaaS & agencies** — product questions + lead qualification at scale
- **Agencies building for clients** — white-label (Pro plan) = high-margin reseller channel

### Positioning statement
> "Turn your website into an AI employee that answers questions, captures leads, and books appointments — 24/7, in one line of code."

### Competitive landscape
Competitors: Intercom Fin, Zendesk AI, Tidio, Chatbase, SiteGPT, ChatBot.

**Our differentiators (what to lead with):**
1. **Simplicity** — one-line embed, no code, setup in < 10 minutes
2. **Transparent flat pricing** — no per-seat surprises
3. **Multi-agent** — different agents for support, sales, and booking
4. **Built-in lead capture + booking** (competitors often charge add-ons)
5. **White-label for agencies**

---

## 3. Features — what's built today

### Core (working)
| Feature | Where | Status |
|---|---|---|
| Create/manage AI agents | `/dashboard/agents` | ✅ |
| Agent wizard (purpose, tone, goals, tools) | `/dashboard/agents/create` | ✅ |
| Knowledge base (upload, URL, text, FAQ) + vector search | Agent → Knowledge tab | ✅ |
| RAG chat pipeline (answers from your content) | `src/lib/ai/rag-pipeline.ts` | ✅ |
| Website widget (iframe embed, configurable color/position) | Agent → Appearance | ✅ |
| Script embed (`<script src="/widget.js">`) | Overview → Embed Code | ✅ |
| Public agent page + QR code | Agent → Settings → Public page | ✅ |
| Status control (draft / active / paused) | Settings + Overview | ✅ |
| Human handoff, fallback messages, lead capture | Agent config | ✅ |
| Analytics, conversations, team, billing screens | Dashboard | ✅ |
| Auth (Logto), usage limits, rate limiting | Platform | ✅ |

### Core (needs hardening — see §5)
- Knowledge ingestion is scaffolded; verify real upload/chunking end-to-end
- Analytics screens may be display-only (mock stats)
- Booking + lead capture exist as UI/config; wire to real workflow
- Usage enforcement exists in code but needs plan-gating wired to billing

---

## 4. How to make it profitable

### 4.1 Revenue model (already designed)
Three-tier monthly SaaS with usage caps — the classic AI-SaaS pricing that works because **margins are high and churn is low** when the widget is embedded in customers' websites.

| Tier | Price | Agents | Conversations/mo | Knowledge | Target |
|---|---|---|---|---|---|
| Starter | $29 | 1 | 1,000 | 50 MB | Local businesses |
| Business | $79 | 5 | 5,000 | 500 MB | Growing companies |
| Pro | $149 | 15 | 20,000 | 2 GB | Agencies / white-label |

### 4.2 Revenue levers (in priority order)
1. **Free trial → paid conversion.** 14-day trial, no credit card. Focus on activation: get the user to *embed the widget and see one real conversation* in their first session.
2. **Usage-based upsells.** Over-limit conversations → soft-cap banner + one-click upgrade. This is the highest-LTV lever.
3. **Add-on revenue:**
   - Extra agent packs
   - Extra conversations (top-up packs)
   - White-label / custom domain (Pro)
   - SMS / WhatsApp channel (premium, big local-business appeal)
4. **Agency reseller program.** Agencies white-label the widget for clients at 2–4× markup. Give them Pro-tier multi-workspace accounts.

### 4.3 Unit economics (illustrative)
- **COGS per active customer:** LLM tokens (chat + embeddings) ≈ $1–$6/mo depending on tier usage. (Set per-tier token budgets.)
- **Gross margin:** 90%+ at scale. This is why AI-SaaS pricing works.
- **Target:** 500 paying customers × ~$60 avg revenue = **$30k MRR** ≈ break-even team of 2–3.

### 4.4 Go-to-market (0 → first 100 customers)
- **Cold outreach** to local businesses with a demo link (their website + a pre-trained agent on their content = jaw-dropping demo).
- **Niche landing pages:** "Dentist website chatbot", "Real estate AI assistant" — each with a tailored hero + prebuilt agent template.
- **ProductHunt / indie launch** + agency partnerships.
- **Referral:** give agencies 20% recurring commission.
- **SEO:** pages for "AI chatbot for [industry]" and free tools (widget preview, AI answer generator).

### 4.5 Pricing guidance while starting out
Do **not** discount to get customers. Instead:
- Charge $29/$79/$149 as listed — these match perceived value and filter serious buyers.
- Offer annual billing at 2 months free (improves cash flow + retention).
- Trial length: 14 days, extend manually for promising leads.

---

## 5. Feature suggestions & roadmap

### Phase 1 — Make the core unshakeable (do first)
1. **Real knowledge ingestion end-to-end:** verify document upload → chunk → embed → search. Add progress + error states. *(This is the #1 demo killer if broken.)*
2. **Real analytics:** conversations, resolution rate, sources used, leads captured. Today it's mostly display.
3. **Wire usage enforcement to billing:** when a customer hits their conversation cap, show an upgrade modal (don't silently block).
4. **Live test panel** improvements in the dashboard so users trust answers before embedding.
5. **Billing checkout + webhook flow** fully working (Stripe/Lemon Squeezy), with trial → paid upgrade.

### Phase 2 — Retention & virality
6. **Conversation inbox:** dashboard to read every customer chat, reply, and mark resolved. Turn "human handoff" from a concept into a real queue.
7. **Email digests:** weekly "Your AI agent handled N conversations, captured M leads".
8. **Lead export:** CSV/CRM integration (HubSpot, Stripe, Airtable).
9. **Widget polish:** typing indicator, suggested replies, branding removal toggle, dark mode.

### Phase 3 — Growth features (differentiators)
10. **Multi-channel:** WhatsApp + SMS + email + Instagram DM in one inbox.
11. **Agent templates/marketplace:** prebuilt agents per industry (law, medical, real estate) with ready-made system prompts + knowledge.
12. **AI voice assistant** (call answering) for local businesses — huge willingness to pay.
13. **Real booking engine** with calendar sync (Google/Cal.com) and reminders.
14. **Public agent gallery** for discovery.
15. **API + webhooks** for developers (already in Pro pitch).

### Phase 4 — Enterprise
16. SSO/SAML, SOC2 readiness, custom SLA, dedicated instance.

### Quick wins (low effort, high impact)
- Default widget greeting + color match the customer's brand automatically (reduces setup friction).
- "Live preview" of widget on the appearance tab.
- One-click publish checklist: Train → Test → Embed → Activate.
- Success page after trial signup with a 3-step quickstart video.

---

## 6. Metrics that matter

| Metric | Where to watch | Target |
|---|---|---|
| Trial → paid conversion | Stripe/LS dashboard | > 10% |
| Time-to-first-embed | Funnel analytics | < 15 min |
| Conversations / active customer | Usage DB | Growing MoM |
| Monthly churn | Retention | < 5% |
| Over-limit upgrade rate | Billing | > 20% of capped users |
| Widget install retention | 30-day active widgets | > 70% |

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| LLM cost creep | Per-tier token budgets + cheaper models for high-volume tiers |
| Hallucinated answers | Strict "answer only from knowledge base" system prompt (already built) + confidence threshold |
| Customers churn after "AI is boring" | Prove value with lead capture + booking outcomes, not just Q&A |
| Big-company price war | Win on niche focus + white-label + local-business sales motion, not price |
| Account takeover/abuse | Rate limiting + abuse protection (already in code) |

---

## 8. Immediate next actions

1. **Verify knowledge upload end-to-end** on production (upload a PDF → ask about it in widget). Fix any gaps. *(Highest priority — this is the demo.)*
2. **Wire billing checkout + usage caps** so free users get a real upgrade path.
3. **Ship the conversation inbox** (Phase 2, item 6) — the single most-requested feature for this product type.
4. **Write 3 niche landing pages** and start cold outreach with personalized demo links.
5. **Set up funnel analytics** (Plausible/PostHog) on signup → embed → first conversation.

---

*Generated from the current Agent AI codebase and landing page. Features marked ✅ are present in code; pricing and roadmap are recommendations based on the existing product structure.*
