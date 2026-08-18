# Deployment Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Dokploy Deployment](#dokploy-deployment)
4. [Directus Configuration](#directus-configuration)
5. [Environment Variables](#environment-variables)
6. [How It Works](#how-it-works)
7. [Post-Deployment](#post-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE                              │
│                    (DNS + CDN + WAF)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DOKPLOY VPS                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Next.js    │  │   Directus   │  │    Redis     │          │
│  │   App (3000) │  │   (8055)     │  │   (6379)     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘          │
│         │                 │                                      │
│         └─────────────────┘                                      │
│              PostgreSQL                                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Directus │  │  OpenAI  │  │  Stripe  │  │ Cloudflare│       │
│  │(Auth+DB) │  │  (AI)    │  │(Payments)│  │   R2      │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Server Requirements
- **VPS** with at least 2GB RAM, 2 vCPU
- **Docker** and **Docker Compose** installed
- **Domain name** pointed to your server IP

### External Accounts
- [Directus](https://directus.io) — Authentication + database
- [OpenAI](https://platform.openai.com) — AI responses
- [Stripe](https://stripe.com) — Payments (optional)
- [Cloudflare](https://cloudflare.com) — DNS + R2 (optional)

---

## Dokploy Deployment

### Step 1: Install Dokploy

```bash
# On your VPS
curl -sSL https://dokploy.com/install.sh | sh
```

### Step 2: Create New Project

1. Open Dokploy dashboard: `http://your-server-ip:3000`
2. Create new project: `agent-ai`
3. Choose **Docker Compose** deployment

### Step 3: Configure docker-compose.yml

```yaml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
      - LOGTO_ENDPOINT=${LOGTO_ENDPOINT}
      - LOGTO_APP_ID=${LOGTO_APP_ID}
      - LOGTO_APP_SECRET=${LOGTO_APP_SECRET}
      - LOGTO_COOKIE_SECRET=${LOGTO_COOKIE_SECRET}
      - DIRECTUS_URL=${DIRECTUS_URL}
      - DIRECTUS_TOKEN=${DIRECTUS_TOKEN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  directus:
    image: directus/directus:latest
    ports:
      - "8055:8055"
    environment:
      KEY: ${DIRECTUS_KEY}
      SECRET: ${DIRECTUS_SECRET}
      CLIENT_DB_HOST: db
      CLIENT_DB_PORT: 5432
      CLIENT_DB_DATABASE: directus
      CLIENT_DB_USER: directus
      CLIENT_DB_PASSWORD: ${DB_PASSWORD}
      ADMIN_EMAIL: ${DIRECTUS_ADMIN_EMAIL}
      ADMIN_PASSWORD: ${DIRECTUS_ADMIN_PASSWORD}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: directus
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: directus
    volumes:
      - directus_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  directus_data:
```

### Step 4: Deploy

1. Clone repository:
```bash
git clone https://github.com/kalirona/shcdn-app-ai-agents.git
cd shcdn-app-ai-agents
```

2. Push to Dokploy:
```bash
git remote add dokploy dokploy@your-server:agent-ai
git push dokploy main
```

3. Dokploy will automatically build and deploy

---

## Directus Configuration

### Step 1: Deploy Directus

Directus is included in the docker-compose.yml. It will be deployed automatically.

### Step 2: Initial Setup

1. Open `https://yourdomain.com:8055`
2. Create admin account
3. Go to **Settings** → **Data Model**

### Step 3: Create Collections

#### Workspace Collection
```
Table: workspaces
Fields:
  - id (UUID, primary)
  - name (string)
  - slug (string, unique)
  - description (text, nullable)
  - logo (file, nullable)
  - website (string, nullable)
  - status (string: active/suspended/archived)
  - date_created (timestamp)
  - date_updated (timestamp)
```

#### Membership Collection
```
Table: memberships
Fields:
  - id (UUID, primary)
  - workspace (m2o → workspaces)
  - user (string) [Logto user ID]
  - role (string: owner/admin/member/viewer)
  - status (string: active/invited/inactive)
  - date_created (timestamp)
  - date_updated (timestamp)
```

#### Agent Collection
```
Table: agents
Fields:
  - id (UUID, primary)
  - workspace (m2o → workspaces)
  - name (string)
  - description (text, nullable)
  - avatar (file, nullable)
  - system_prompt (text)
  - tone (string: professional/friendly/custom)
  - language (string, default: en)
  - greeting (text)
  - fallback_message (text)
  - status (string: draft/active/paused)
  - date_created (timestamp)
  - date_updated (timestamp)
```

#### Knowledge Source Collection
```
Table: knowledge_sources
Fields:
  - id (UUID, primary)
  - workspace (m2o → workspaces)
  - agent (m2o → agents, nullable)
  - type (string: website/document/faq/text)
  - title (string)
  - url (string, nullable)
  - file (file, nullable)
  - status (string: pending/processing/ready/failed)
  - error_message (text, nullable)
  - chunk_count (integer, default: 0)
  - date_created (timestamp)
  - date_updated (timestamp)
```

#### Knowledge Chunk Collection
```
Table: knowledge_chunks
Fields:
  - id (UUID, primary)
  - source (m2o → knowledge_sources)
  - content (text)
  - embedding (json)
  - metadata (json)
  - index (integer)
```

#### Conversation Collection
```
Table: conversations
Fields:
  - id (UUID, primary)
  - workspace (m2o → workspaces)
  - agent (m2o → agents)
  - customer_email (string, nullable)
  - customer_name (string, nullable)
  - status (string: active/resolved/handoff)
  - date_created (timestamp)
  - date_updated (timestamp)
```

#### Message Collection
```
Table: messages
Fields:
  - id (UUID, primary)
  - conversation (m2o → conversations)
  - role (string: user/assistant/system)
  - content (text)
  - sources (json, nullable)
  - metadata (json)
  - date_created (timestamp)
```

#### Lead Collection
```
Table: leads
Fields:
  - id (UUID, primary)
  - workspace (m2o → workspaces)
  - name (string)
  - email (string)
  - phone (string, nullable)
  - company (string, nullable)
  - message (text, nullable)
  - source (string)
  - status (string: new/contacted/qualified/won/lost)
  - date_created (timestamp)
  - date_updated (timestamp)
```

#### Customer Collection
```
Table: customers
Fields:
  - id (UUID, primary)
  - workspace (m2o → workspaces)
  - name (string)
  - email (string)
  - phone (string, nullable)
  - company (string, nullable)
  - notes (text, nullable)
  - date_created (timestamp)
  - date_updated (timestamp)
```

#### Booking Collection
```
Table: bookings
Fields:
  - id (UUID, primary)
  - workspace (m2o → workspaces)
  - service (string)
  - date (date)
  - time (string)
  - customer_name (string)
  - customer_email (string)
  - customer_phone (string, nullable)
  - notes (text, nullable)
  - status (string: confirmed/cancelled/completed/rescheduled)
  - date_created (timestamp)
  - date_updated (timestamp)
```

### Step 4: Configure Permissions

1. Go to **Settings** → **Roles & Permissions**
2. Create **API Token** for the app
3. Grant permissions:
   - Read/Write on all collections
   - Read on users

4. Copy token → `DIRECTUS_TOKEN`

### Step 5: Enable pgvector

```sql
-- Run in Directus SQL console
CREATE EXTENSION IF NOT EXISTS vector;
```

Update `knowledge_chunks` collection:
- Change `embedding` field type to `vector(1536)` (for OpenAI embeddings)

---

## Environment Variables

### Complete .env file for Dokploy

```env
# ===========================================
# Agent AI - Production Environment
# ===========================================

# --- Application ---
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_APP_NAME="Agent AI"

# --- Authentication (Directus) ---
AUTH_PROVIDER=directus
SESSION_SECRET=your-random-32-char-secret

# --- Database (Directus) ---
DIRECTUS_URL=https://directus.yourdomain.com
DIRECTUS_TOKEN=your-directus-api-token

# --- Directus Internal (for docker-compose) ---
DIRECTUS_KEY=your-directus-key
DIRECTUS_SECRET=your-directus-secret
DB_PASSWORD=your-db-password
DIRECTUS_ADMIN_EMAIL=admin@yourdomain.com
DIRECTUS_ADMIN_PASSWORD=your-admin-password

# --- AI Provider ---
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key

# --- Payments ---
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
LEMON_SQUEEZY_API_KEY=your-key
LEMON_SQUEEZY_STORE_ID=your-store-id
LEMON_SQUEEZY_WEBHOOK_SECRET=your-webhook-secret

# --- Storage (Cloudflare R2) ---
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret
R2_BUCKET_NAME=agent-ai-uploads
R2_PUBLIC_URL=https://cdn.yourdomain.com

# --- Email ---
RESEND_API_KEY=your-resend-key

# --- Monitoring ---
SENTRY_DSN=https://your-sentry-dsn

# --- Widget ---
ALLOWED_WIDGET_ORIGINS=https://yourdomain.com,https://client-domain.com
```

---

## How It Works

### Authentication Flow

```
User → clicks "Sign In" → Logto login page → Enters credentials
                                    ↓
                            Logto authenticates
                                    ↓
                            Redirects to /callback
                                    ↓
                            Next.js saves session cookie
                                    ↓
                            Redirects to /dashboard
                                    ↓
                            User authenticated ✓
```

### Agent Creation Flow

```
User → /dashboard/agents/create → Step 1: Basic info
                                        ↓
                                  Step 2: Personality
                                        ↓
                                  Agent saved to Directus
                                        ↓
                                  Redirect to agent overview
```

### Knowledge Base Flow

```
User adds knowledge source (text/PDF/website)
              ↓
    Content extracted & chunked
              ↓
    Embeddings generated (OpenAI)
              ↓
    Vectors stored in pgvector
              ↓
    AI can now reference this knowledge
```

### Chat Flow

```
Customer opens widget → Types question
              ↓
    Question embedded (OpenAI)
              ↓
    Vector search finds relevant chunks
              ↓
    System prompt + context + question → LLM
              ↓
    AI response streamed back
              ↓
    Sources cited (if available)
```

### Booking Flow

```
Customer: "I'd like to book a consultation"
              ↓
    AI calls check_availability() tool
              ↓
    Returns available time slots
              ↓
    Customer picks a time
              ↓
    AI calls create_booking() tool
              ↓
    Booking saved to Directus
              ↓
    Confirmation sent to customer
```

---

## Post-Deployment

### Step 1: Verify Deployment

```bash
# Check containers
docker compose ps

# Check logs
docker compose logs -f app
```

### Step 2: Create First Workspace

1. Open `https://yourdomain.com`
2. Sign up with Logto
3. Complete onboarding flow
4. Create your first AI agent

### Step 3: Test Knowledge Base

1. Go to agent → Knowledge
2. Add text source or upload PDF
3. Test in the preview chat

### Step 4: Test Widget

1. Go to agent → Appearance
2. Generate embed code
3. Paste in test HTML page
4. Chat with your AI agent

### Step 5: Configure Stripe (optional)

1. Create Stripe webhook: `https://yourdomain.com/api/webhooks/stripe`
2. Copy webhook secret
3. Set environment variable
4. Test subscription flow

---

## Troubleshooting

### App won't start

```bash
# Check logs
docker compose logs app

# Common issues:
# 1. Missing environment variables
# 2. Database connection failure
# 3. Build errors
```

### Logto errors

```
"Invalid redirect URI"
→ Check LOGTO callback URLs match exactly

"Cookie encryption failed"
→ Generate new LOGTO_COOKIE_SECRET

"User not found"
→ Check Logto API resource configuration
```

### Directus errors

```
"ECONNREFUSED"
→ Check database is running: docker compose logs db

"Invalid token"
→ Regenerate API token in Directus settings

"pgvector not found"
→ Run: CREATE EXTENSION vector;
```

### AI not responding

```
"OPENAI_API_KEY invalid"
→ Check key is correct and has credits

"RAG pipeline error"
→ Check embeddings table exists in Directus

"No knowledge sources"
→ Add knowledge to the agent
```

---

## Scaling Guide

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  app:
    deploy:
      replicas: 3
    environment:
      - REDIS_URL=redis://redis:6379

  redis:
    image: redis:7-alpine
```

### Performance Tips

1. **Enable Next.js caching** — Static pages cached at edge
2. **Use Cloudflare CDN** — Assets served from edge
3. **Database indexing** — Add indexes on workspace_id, agent_id
4. **Connection pooling** — Use PgBouncer for database
5. **Rate limiting** — Enabled per-user and per-IP

---

## Security Checklist

- [ ] HTTPS enabled (Cloudflare or Let's Encrypt)
- [ ] Environment variables secured
- [ ] Database passwords strong and unique
- [ ] Logto callback URLs correct
- [ ] Rate limiting enabled
- [ ] CORS configured
- [ ] Input validation active
- [ ] Audit logging enabled
- [ ] Backups scheduled (Directus + PostgreSQL)
- [ ] Monitoring alerts set up (Sentry)

---

## Cost Estimation

| Service | Free Tier | Paid |
|---------|-----------|------|
| Dokploy | Free (self-hosted) | VPS costs |
| Logto | 25K MAU free | $50+/mo |
| Directus | Self-hosted | VPS costs |
| OpenAI | $5 credit | Pay per token |
| Stripe | No monthly fee | 2.9% + $0.30/transaction |
| Cloudflare | Free tier | $5+/mo |
| **Total** | **~$10/mo** | **~$100+/mo** |

---

*Last updated: August 2026*
