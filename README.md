# BizCopilot Universal CRM — Lead Management Module (Phase 1)

A powerful, universal lead management module built with **Go (Gin)**, **PostgreSQL 17**, and **Next.js**, designed to work for any business vertical (Technology, Real Estate, Healthcare, Education, Travel, Retail, Agencies) while remaining simple and intuitive.

---

## 🚀 Key Modules & Capabilities

### 1. Universal Data Model & Dynamic Custom Fields Engine
- **Universal Fixed Fields**: `name`, `phone`, `email`, `requirement`, `source`, `city`, `status`, `owner_id`, `score`, `lost_reason`, `tags`, `follow_up_date`, `last_activity_at`, `deleted_at`.
- **Dynamic Custom Fields without Schema Changes**: Admin can configure business-specific fields on the fly:
  - Supported field types: **Text**, **Long Text**, **Number**, **Currency**, **Phone**, **Email**, **Date**, **Date & Time**, **Dropdown**, **Multi-select**, **Checkbox**, and **URL**.
  - Key-value JSON/relational storage mapping automatically into API payloads and UI forms.

### 2. Smart Duplicate Protection & Phone Normalization
- Configurable rules in Admin Settings:
  - **Phone number duplicate check** (normalizes `+1 (555) 0192` to `+15550192` to detect duplicates across variations).
  - **Email duplicate check** (case-insensitive).
  - Mode: **Prevent** (rejects with `HTTP 409 Conflict`) or **Warn**.

### 3. Follow-ups, Reminders & Overdue Tracking
- Next follow-up tracking with alert badges:
  - ⚠️ **Overdue Follow-ups**: Highlighted in red if the due timestamp has elapsed.
  - 📅 **Due Today**: Highlighted in amber.
  - ⏱️ **Scheduled / Upcoming**.
- One-click **Mark Complete** toggle and **Schedule Next Follow-up** modal.
- Historical audit of all past follow-up attempts.

### 4. Saved Views & Server-Side Pagination
- Pre-configured saved views with real-time counters:
  - **All Leads**
  - **My Leads**
  - **Unassigned**
  - **Hot Leads 🔥** (Score ≥ 70 or tagged "Hot")
  - **Today's Follow-ups**
  - **Overdue Follow-ups ⚠️**
  - **Trash / Soft-deleted Leads** (with one-click restore!)
- Multi-criteria filtering by Status, Source, Owner, Tags, Follow-up state, and global text search across both core and custom fields.

### 5. Bulk Operations & Data Quality
- Checkbox multi-selection for bulk operations:
  - Bulk Status change (with optional Lost Reason prompt)
  - Bulk Owner reassignment
  - Bulk Tag management
  - Bulk Soft Delete / Restore
  - Bulk Export
- **CSV / Excel Import**: Column mapping preview with duplicate resolution strategies (`skip`, `update`, `error`) and row-by-row error validation report.
- **CSV Export**: Instant download respecting active search and filter parameters.

### 6. Activity Timeline & Internal Notes
- Full audit log of timeline events:
  - `lead_created`, `lead_updated`, `status_change`, `owner_assigned`, `note_added`, `follow_up_scheduled`, `follow_up_completed`, `lead_deleted`, `lead_restored`.
- Timestamped internal notes with author names and avatar identifiers.

### 7. Interactive API Documentation Endpoint Page (`/api-docs`)
- Dedicated in-app **API Documentation Page** with:
  - Complete endpoint reference for all Lead CRUD, Custom Fields, Bulk Actions, Follow-ups, and Webhooks.
  - Interactive Request Playground with live test requests against the backend.
  - Instant code generators for **cURL**, **JavaScript Fetch**, and **Python Requests**.
  - Direct link to Go Swagger OpenAPI documentation (`/docs`).

---

## 📡 API Reference Overview

### Core Leads
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/leads` | Create single lead with core + custom fields and duplicate check |
| `GET` | `/api/leads` | List, search, filter leads with pagination and saved views |
| `GET` | `/api/leads/{number}` | Get full lead details including custom fields and notes |
| `PATCH` | `/api/leads/{number}` | Update core, custom fields, score, lost reason, status, or owner |
| `DELETE` | `/api/leads/{number}` | Soft delete lead to Trash (`?permanent=true` for hard delete) |
| `POST` | `/api/leads/{number}/restore` | Restore soft-deleted lead from Trash |

### Bulk Operations & Quality
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/leads/bulk` | Batch insert multiple leads |
| `PATCH` | `/api/leads/bulk` | Bulk update status, assign owner, add tags, or delete |
| `POST` | `/api/leads/import` | CSV import with mapping and duplicate handling |
| `GET` | `/api/leads/export` | Export filtered leads to downloadable CSV |

### Interactions & Metadata
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/leads/{number}/notes` | Add internal note |
| `GET` | `/api/leads/{number}/notes` | List internal notes |
| `POST` | `/api/leads/{number}/follow-ups` | Schedule follow-up task |
| `GET` | `/api/leads/{number}/activities` | Get audit timeline |
| `GET` / `POST` | `/api/leads/custom-fields` | View / create custom field definitions |
| `GET` / `POST` | `/api/leads/statuses` | View / create lead statuses |
| `GET` / `POST` | `/api/leads/sources` | View / create lead sources |
| `GET` / `POST` | `/api/leads/tags` | View / create tags |
| `GET` / `PUT` | `/api/leads/settings/duplicates` | View / update duplicate prevention rules |

### Webhooks & Integrations
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/webhooks/lead` | Ingest lead from Website, WhatsApp, Ads via Bearer API Key |
| `GET` / `POST` | `/api/api-keys` | Manage SHA-256 hashed programmatic API keys |

---

## 🛠️ Running Locally

### Backend (Go + Gin & PostgreSQL 17 with pgx)
The high-performance Go backend is located in `backend`:
```bash
cd backend

# Run directly with Go toolchain
go run ./cmd/server

# Or build and run executable binary:
go build -o server.exe ./cmd/server
.\server.exe
```
- Server URL: [http://localhost:8001](http://localhost:8001)
- Interactive Swagger OpenAPI Docs: [http://localhost:8001/docs](http://localhost:8001/docs) (or [http://localhost:8001/swagger/index.html](http://localhost:8001/swagger/index.html))

### Frontend (Next.js)
```bash
cd frontend
npm run dev
```
- App Home: [http://localhost:3000](http://localhost:3000)
- Leads Dashboard: [http://localhost:3000/leads](http://localhost:3000/leads)
- API Documentation: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- API Keys: [http://localhost:3000/api-keys](http://localhost:3000/api-keys)

*(Next.js automatically proxies `/api/*` requests directly to the Go backend on port 8001 via `next.config.ts`)*

### Verification Test Suites
```bash
# Complete Go Unit & E2E Integration Test Suite
cd backend
go test -v ./tests/...
```
