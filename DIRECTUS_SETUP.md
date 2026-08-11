# Directus Setup Guide

This guide tells you exactly which Directus collections to create and how, so the app can:

1. Store workspaces (organizations) in Directus
2. Link each user to their workspace via a membership with an **owner** role
3. Keep every user's data (agents, knowledge, conversations) fully separated per workspace

---

## Data model

```
John registers (Logto)
        |
        v
John's Logto user (sub = e.g. "abc-123")
        |  membership { user: "abc-123", role: "owner", workspace: <id> }
        v
workspaces  --->  "John's Workspace"
        |
        +-- agents             (system prompts, tone, etc.)
        +-- knowledge_sources  (FAQ / website / document sources)
        +-- knowledge_chunks   (chunked content)
        +-- conversations      (chat sessions + messages)
```

Every record in `agents`, `knowledge_sources`, `conversations` has a `workspace` field (many-to-one). Queries are always filtered by `workspace`, so John and Sarah can never see each other's data.

---

## Prerequisites

1. Directus is running (anywhere - self-hosted or hosted). Get the public URL and admin login.
2. In the app's env file set:
   - `DIRECTUS_URL` = your Directus base URL (e.g. `https://directus.example.com`)
   - `DIRECTUS_TOKEN` = a static access token (see "Token" section below)
3. Note: `user` field on memberships stores the **Logto user ID** (`sub` claim), NOT a Directus user ID.

---

## 1. Create the "workspaces" collection

**Collection name:** `workspaces`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `name` | String | Yes | - | Display name, e.g. "John's Workspace" |
| `slug` | String | Yes | - | Unique URL slug, e.g. `johns-workspace` |
| `description` | Text | No | - | - |
| `logo` | UUID (file) | No | - | File interface |
| `website` | String | No | - | - |
| `status` | String | No | `active` | `active` / `suspended` / `archived` |

Create it in Settings -> Data Model -> Create Collection. Then add each field above.
Directus auto-adds `id` (UUID), `date_created`, `date_updated` - leave those as-is.

**Recommended:** add a **unique** constraint on `slug` (Field -> Configure unique).
This guarantees the app's auto-generated slug stays unique even when two users
have the same name; the code retries with a random suffix if a duplicate is hit.

---

## 2. Create the "memberships" collection

**Collection name:** `memberships`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | UUID (M2O -> workspaces) | Yes | - | Many-to-One relation to workspaces |
| `user` | String | Yes | - | Logto user ID (`sub`), plain string |
| `role` | String | No | `member` | `owner` / `admin` / `member` |
| `status` | String | No | `active` | `active` / `invited` / `inactive` |

For the `workspace` field use the relation interface (M2O) pointing to `workspaces`.

---

## 3. Create the "agents" collection

**Collection name:** `agents`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | UUID (M2O -> workspaces) | Yes | - | Data isolation anchor |
| `name` | String | Yes | - | Agent name |
| `description` | Text | No | - | - |
| `avatar` | UUID (file) | No | - | - |
| `system_prompt` | Text | Yes | - | - |
| `tone` | String | No | `professional` | `professional` / `friendly` / `casual` / `custom` |
| `language` | String | No | `en` | - |
| `greeting` | Text | No | `Hello! How can I help you today?` | - |
| `fallback_message` | Text | Yes | - | - |
| `status` | String | No | `draft` | `draft` / `active` / `paused` |
| `purpose` | String | No | `custom` | - |
| `primary_goal` | String | No | `answer_questions` | - |
| `secondary_goal` | String | No | `` | - |
| `fallback_action` | String | No | `transfer_human` | - |
| `behaviors` | JSON | No | `[]` | Array of strings |
| `allowed_tools` | JSON | No | `[]` | Array of strings |

---

## 4. Create the "knowledge_sources" collection

**Collection name:** `knowledge_sources`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | UUID (M2O -> workspaces) | Yes | - | Data isolation anchor |
| `agent` | UUID (M2O -> agents) | No | - | Optional, which agent it belongs to |
| `type` | String | Yes | - | `website` / `document` / `faq` / `text` |
| `title` | String | Yes | - | - |
| `url` | String | No | - | - |
| `file` | UUID (file) | No | - | - |
| `status` | String | No | `pending` | `pending` / `processing` / `ready` / `failed` |
| `error_message` | Text | No | - | - |
| `chunk_count` | Integer | No | `0` | - |
| `visibility` | String | No | `public` | `public` / `internal` |

---

## 5. Create the "knowledge_chunks" collection

**Collection name:** `knowledge_chunks`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `source` | UUID (M2O -> knowledge_sources) | Yes | - | Parent source |
| `content` | Text | Yes | - | Chunked text |
| `embedding` | JSON | No | - | Vector embedding (pgvector) |
| `metadata` | JSON | No | `{}` | - |
| `index` | Integer | No | `0` | Order within source |

---

## 6. Create the "conversations" collection

**Collection name:** `conversations`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `workspace` | UUID (M2O -> workspaces) | Yes | - | Data isolation anchor |
| `agent` | UUID (M2O -> agents) | Yes | - | - |
| `customer` | UUID (M2O -> customers) | No | - | Optional |
| `customer_email` | String | No | - | - |
| `customer_name` | String | No | - | - |
| `status` | String | No | `active` | `active` / `human_required` / `with_human` / `resolved` |
| `handoff_trigger` | String | No | - | - |
| `handoff_reason` | String | No | - | - |

---

## 7. Create the "messages" collection

**Collection name:** `messages`

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `conversation` | UUID (M2O -> conversations) | Yes | - | - |
| `role` | String | Yes | - | `user` / `assistant` / `system` |
| `content` | Text | Yes | - | - |
| `sources` | JSON | No | - | Source citations array |
| `metadata` | JSON | No | `{}` | - |

---

## Token / API access

The app uses a single **static access token** (`DIRECTUS_TOKEN`) for ALL reads and writes
(widget, public agent pages, dashboard). It is sent as `Authorization: Bearer <token>`.

1. In Directus admin, create a user (or reuse the admin).
2. In that user's profile, generate a **Token** (Directus will show it once).
3. Set that token as `DIRECTUS_TOKEN` in the app env.
4. Make sure that user has full read/write permissions on all collections above.

---

## How registration creates the organization (in code)

The app does not wait for a manual "create org" step. On the first authenticated request
after login, `getCurrentUser()` (in `src/lib/auth/actions/user.actions.ts`) runs:

1. Reads the Logto session to get the user (`id`, `email`, `name`).
2. Calls `getUserWorkspaces(user.id)` -> queries `memberships` for rows where `user = <logto sub>`.
3. If none found, creates:
   - a `workspaces` row named `"<Name>'s Workspace"` with a unique slug, and
   - a `memberships` row with `user = <logto sub>`, `workspace = <new id>`, `role = "owner"`.
4. Returns the workspace list so the dashboard shows it.

So after John registers in Logto and lands on the dashboard, his workspace + owner
membership are auto-created. When Sarah registers, she gets her own separate workspace.

---

## Verify it works

1. Register a fresh account in Logto.
2. Land on the dashboard - you should see your name/email (not "Dev User").
3. In Directus admin, check:
   - `workspaces` has exactly one row named `"<your name>'s Workspace"`.
   - `memberships` has one row linking your Logto sub to that workspace with `role = owner`.
4. Create an agent. Confirm in Directus that the agent row has your workspace's id in `workspace`.
5. Register a second account - it must get its own workspace with NO agents from the first account.
