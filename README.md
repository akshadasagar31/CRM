# BizCopilot CRM — Universal Enterprise Sales, Inventory & Financial Suite

[![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8?style=flat&logo=go)](https://golang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?style=flat&logo=postgresql)](https://www.postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Gin Gonic](https://img.shields.io/badge/Gin-Gonic-008ECF?style=flat)](https://gin-gonic.com)

A high-performance, full-stack Enterprise CRM and Business Operating System built with **Go (Gin + pgx)**, **PostgreSQL 17**, and **Next.js 15 (React 19)**. Engineered to power end-to-end commercial operations across any business vertical—from inbound lead capture and multi-pipeline sales to real-time inventory reservation, quotation workflows, automated invoicing, PDF payment receipt issuance, and email deliverability.

---

## 🧭 End-to-End Commercial Lifecycle

```mermaid
flowchart LR
    A[Inbound Lead<br/>& Webhooks] --> B[Deal & Pipeline<br/>Stage Progression]
    B --> C[Quotation & Line Items<br/>PDF Generation]
    C --> D[Sales Order<br/>Inventory Reservation]
    D --> E[Fulfillment &<br/>Stock Deduction]
    E --> F[Tax Invoice<br/>PDF & Email Dispatch]
    F --> G[Payment Recording<br/>& PDF Receipts]
```

---

## 🚀 Key Modules & Capabilities

### 1. Universal Lead Management & Validation Engine
- **Universal Core Model**: `number` (unique phone identifier), `name`, `email`, `phone`, `requirement`, `source`, `city`, `status`, `owner_id`, `score`, `lost_reason`, `tags`, `follow_up_date`, `last_activity_at`, `deleted_at`.
- **Strict Indian Mobile & Email Validation**:
  - **Phone Validation (`^[6-9]\d{9}$`)**: Enforces exactly 10 digits starting with 6, 7, 8, or 9. Automatically strips formatting (`+91`, `91`, leading `0`, spaces, dashes, and parentheses).
  - **RFC 5322 Email Format**: Enforces standard `name@domain.tld` syntax, rejects double dots (`..`), and normalizes addresses to lowercase.
  - **Dual-Layer Enforcement**: Both Go backend handlers and Next.js client forms enforce validation. Invalid entries yield real-time inline red error messages, red input borders, disabled submit buttons, and `HTTP 400 Bad Request` API responses.
- **Smart Duplicate Prevention**:
  - Configurable duplicate policies: **Prevent** (`HTTP 409 Conflict`) or **Warn** based on matching phone, email, or company.
- **Dynamic Custom Fields without Schema Migrations**:
  - Supported field types: **Text**, **Long Text**, **Number**, **Currency**, **Phone**, **Email**, **Date**, **Date & Time**, **Dropdown**, **Multi-select**, **Checkbox**, and **URL**.
- **Follow-ups & Overdue Alert Badges**:
  - ⚠️ Overdue follow-ups highlighted in red with badge counters.
  - 📅 Due today and scheduled upcoming follow-ups with one-click completion logging.
- **Bulk Operations & Data Portability**:
  - Bulk status transitions, owner reassignment, tag appending, and soft delete/restore.
  - Client-validated CSV imports with duplicate resolution (`skip`, `update`, `error`).
  - Single-click filtered CSV exports respecting active views and search queries.

---

### 2. Deals & Dynamic Visual Pipeline Kanban
- **Multi-Pipeline Architecture**: Configure separate sales funnels (e.g., Enterprise B2B, Direct Sales, Inbound Partnerships).
- **Kanban Stage Editor Modal**:
  - **Add New Stages**: Create custom pipeline stages with custom names, stage order, and win probability percentages.
  - **Rename Stages**: Update stage titles and probability weights inline.
  - **Reorder Stages**: Adjust sequencing order of the entire pipeline.
  - **Delete Stages with Deal Safety**: Blocks deletion if deals are currently active in that stage to preserve relational integrity.
- **Dynamic Deal Naming**: Deals dynamically present linked Lead/Customer names instead of generic IDs for instant context.
- **Visual Funnel & Kanban**: Drag-and-drop or modal stage transitions with real-time aggregated stage revenue and probability weighting.

---

### 3. Relational Quotations Engine & Vector PDF Generator
- **Relational Integrity**:
  - **Linked Deal Column**: Shows the linked Deal ID (`DEAL-xxxx`) and Deal title fetched via foreign-key relationships.
  - **Customer / Company Column**: Displays the actual linked customer name and company name.
  - **Quotation Title**: Kept distinct from deal and customer identifiers.
- **Dynamic Line Items**: Multi-item quotations with unit pricing, quantity, customizable discounts, and HSN/SAC tax breakdown.
- **Vector PDF Generator**: Powered by **Go Maroto v2** for high-resolution, branded PDF quotes with company letterhead, terms, and payment instructions.
- **In-App PDF Viewer & Download**: Integrated modal viewer with inline rendering and instant download.
- **One-Click Order & Invoice Conversion**: Convert approved quotes into active sales orders or tax invoices.

---

### 4. Product Catalog & Tri-State Inventory Reservation
- **Unified Product Registry**: Product details, SKUs, HSN/SAC codes, tax rates, selling price, and currency.
- **Tri-State Stock Tracking**:
  - **On-Hand Stock**: Physical count in inventory.
  - **Reserved Stock**: Units committed to confirmed, unfulfilled sales orders.
  - **Available Stock**: Calculated as `Current Stock - Reserved Stock` to prevent overselling.
- **Low-Stock Warnings**: Visual status indicators (green / amber / red) based on configurable thresholds.

---

### 5. Warehouse & Stock Movement Ledger
- **Complete Audit Trail**: Every stock movement is logged with timestamp, movement type, previous/new stock values, and user accountability.
- **Movement Operations**:
  - **Stock-In**: Inbound shipments from suppliers.
  - **Reserve & Release**: Automated order allocation upon confirmation.
  - **Dispatch**: Physical shipment deducting stock from warehouse.
  - **Returns**: Restock or mark damaged/scrap with condition classification.
  - **Manual Adjustments**: Reconcile physical inventory audits with reason logging.
- **Inventory Alerts**: Dedicated dashboard for critically low and out-of-stock items.

---

### 6. Sales Orders & Fulfillment Workflows
- **Fulfillment Stage Workflow**:
  - `Confirmed` ➔ `Planning` ➔ `In Progress` ➔ `Delivered` ➔ `Completed` (or `Cancelled`).
- **Automated Inventory Synchronization**:
  - Order confirmation automatically reserves catalog inventory.
  - Order dispatch/completion deducts physical stock.
  - Order cancellation safely releases reservations back to available stock.
- **Financial Status Tracking**: Tracks invoice generation status (`Not Invoiced` / `Invoiced`) and payment status (`Unpaid` / `Partially Paid` / `Paid`).

---

### 7. Tax Invoicing & Payment Receipts
- **Automated Invoice Generation**: Generate tax invoices directly from sales orders or quotations with sequential invoice numbering.
- **Comprehensive Ledger**: Subtotal, line-item taxes, applied discounts, amount paid, and live remaining balance.
- **Multi-Mode Payment Recording**: Bank Transfer, Credit/Debit Card, UPI, Cheque, and Cash.
- **Official Payment Receipts**: Generates downloadable and printable vector PDF payment receipts with unique receipt numbers and transaction reference IDs.

---

### 8. Automated Email Notifications & Deliverability Hub
- **Automated Trigger Matrix**:
  - ⏰ **Follow-Up Reminders**: Background cron engine running every 60 seconds scans due follow-ups (`completed = 0 AND due_date <= NOW()`) and dispatches responsive corporate email notifications.
  - 📄 **Quotation Finalization**: Automatically renders and attaches the vector PDF quotation when status transitions to `Sent` or `Accepted` (**Single consolidated email with PDF attachment—zero duplicate messages**).
  - 🧾 **Invoice Finalization**: Automatically renders and attaches the vector PDF tax invoice when status transitions to `Sent`.
- **Anti-Spoofing & Deliverability Standards**:
  - **SPF (Sender Policy Framework)**: Authorizes outbound SMTP servers.
  - **DKIM (DomainKeys Identified Mail)**: Cryptographically signs headers with 2048-bit RSA keys.
  - **DMARC (Domain-based Message Authentication)**: Enforces domain integrity and anti-phishing policies.
- **High-Reliability Architecture**:
  - **Zero Duplicate Guarantees**: Deterministic idempotency keys (`quotation:{id}:{status}`, `invoice:{id}:{status}`, `follow_up:{id}:{due_timestamp}`) enforced via PostgreSQL unique constraints.
  - **Exponential Backoff Retries**: Up to 3 automatic retry attempts with intelligent intervals (2 min, 5 min, 15 min).
  - **Centralized Email Audit Ledger**: Outgoing email logs under **Company Settings > Automated Emails & Logs** displaying delivery status, recipient addresses, attachments, error diagnostics, and one-click manual retry dispatch.

---

### 9. Admin Settings & Role-Based Access Control
- **User Management & Roles**: `admin`, `manager`, `sales_rep`.
- **Pipeline Stage Editor**: Add, rename, reorder, and safely delete stages.
- **Metadata Management**: Customizable Lead Statuses, Lead Sources, and Tags with hex color pickers.
- **Duplicate Detection Rules**: Configure phone, email, and company duplicate policies.
- **Custom Field Builder**: Define dynamic fields for leads across custom sections.

---

### 10. Developer API, Webhooks & Interactive Playground
- **In-App API Playground (`/api-docs`)**: Live execution console against the Go backend with automated code generation for **cURL**, **JavaScript Fetch**, and **Python Requests**.
- **Swagger OpenAPI 2.0 (`/docs`)**: Interactive Swagger UI.
- **Public Ingestion Webhooks**: Ingest leads from landing pages, contact forms, Meta ads, or WhatsApp using Bearer API keys.
- **Programmatic API Keys (`/api-keys`)**: SHA-256 hashed API keys with custom naming and revocation controls.

---

## 🔬 Deep Technical Reference & API Payloads

### 1. Strict Validation Error Response (`HTTP 400 Bad Request`)
When an invalid phone number or email address is submitted to `/api/leads`, `/api/leads/:number`, `/api/customers`, or `/api/company`:

```json
{
  "detail": "invalid phone number: must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 (e.g. 9876543210)"
}
```

```json
{
  "detail": "invalid email address format: must follow a valid format like name@gmail.com"
}
```

---

### 2. Pipeline Stage Reordering (`POST /api/pipelines/:id/stages/reorder`)
Updates the display sequence of stages across the Kanban board:

**Request Body:**
```json
{
  "stage_orders": [
    { "stage_id": 12, "order": 1 },
    { "stage_id": 13, "order": 2 },
    { "stage_id": 15, "order": 3 },
    { "stage_id": 14, "order": 4 }
  ]
}
```

**Response (`HTTP 200 OK`):**
```json
{
  "success": true,
  "message": "Stages reordered successfully"
}
```

---

### 3. Lead to Deal & Customer Conversion (`POST /api/leads/:number/convert`)
Atomically converts a lead into an active sales opportunity and dedicated customer record:

**Request Body:**
```json
{
  "deal_name": "ABC Tech - Cloud Implementation",
  "deal_value": 750000,
  "pipeline_id": 1,
  "stage_id": 2,
  "priority": "High",
  "expected_close_date": "2026-11-30T00:00:00Z",
  "customer_name": "Rahul Sharma",
  "customer_email": "rahul.sharma@abctech.com",
  "customer_phone": "9876543210",
  "customer_company": "ABC Tech Solutions Pvt. Ltd.",
  "create_new_customer": true
}
```

**Response (`HTTP 200 OK`):**
```json
{
  "deal": {
    "id": 182,
    "deal_number": "DEAL-0008",
    "title": "ABC Tech - Cloud Implementation",
    "value": 750000,
    "pipeline_id": 1,
    "stage_id": 2,
    "customer_id": 45,
    "lead_number": "9876543210",
    "status": "Open"
  },
  "customer": {
    "id": 45,
    "name": "Rahul Sharma",
    "company": "ABC Tech Solutions Pvt. Ltd.",
    "email": "rahul.sharma@abctech.com",
    "phone": "9876543210"
  }
}
```

---

### 4. Custom Field Definition (`POST /api/leads/custom-fields`)
Creates a schema-less dynamic field (Admin role required):

**Request Body:**
```json
{
  "field_key": "gst_number",
  "field_label": "Client GSTIN",
  "field_type": "Text",
  "options": [],
  "required": false,
  "section": "Tax & Compliance"
}
```

---

### 5. Inbound Webhook Lead Ingestion (`POST /api/webhooks/lead`)
Ingests leads from external forms or marketing webhooks using an API Key:

**Headers:**
```http
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Priya Patel",
  "phone": "+91 9823012345",
  "email": "priya.patel@enterprise.in",
  "requirement": "Enterprise CRM 50 seats",
  "source": "Google Ads",
  "city": "Mumbai"
}
```

**Response (`HTTP 201 Created`):**
```json
{
  "success": true,
  "message": "Lead ingested successfully via webhook.",
  "lead": {
    "number": "9823012345",
    "name": "Priya Patel",
    "email": "priya.patel@enterprise.in",
    "phone": "9823012345",
    "status": "New",
    "source": "Google Ads",
    "city": "Mumbai"
  }
}
```

---

## 📡 API Reference Overview

| Module | Method | Endpoint | Description |
|---|---|---|---|
| **Auth** | `POST` | `/api/auth/login` | Authenticate user and issue JWT Bearer token |
| | `GET` | `/api/auth/me` | Fetch authenticated user profile & permissions |
| | `GET` | `/api/auth/users` | List system users and roles (`admin`, `manager`, `sales_rep`) |
| **Leads** | `GET` | `/api/leads` | List leads (supports unpaged `limit=0`, filtering, search) |
| | `POST` | `/api/leads` | Create lead (enforces 10-digit Indian phone & RFC email) |
| | `GET` | `/api/leads/:number` | Retrieve lead details, notes, activities, and custom fields |
| | `PATCH` | `/api/leads/:number` | Update lead fields, score, status, or owner |
| | `DELETE` | `/api/leads/:number` | Soft delete lead (`?permanent=true` for purge) |
| | `POST` | `/api/leads/:number/convert` | Convert lead into Deal and Customer |
| | `POST` | `/api/leads/import` | Bulk CSV import with client-side validation |
| | `GET` | `/api/leads/export` | Download filtered leads as CSV |
| **Settings** | `GET` / `POST` | `/api/leads/custom-fields` | List or create dynamic custom fields |
| | `GET` / `POST` | `/api/leads/statuses` | List or create custom lead statuses |
| | `GET` / `POST` | `/api/leads/sources` | List or create lead sources |
| | `GET` / `POST` | `/api/leads/tags` | List or create lead tags |
| | `GET` / `PUT` | `/api/leads/settings/duplicates`| Get or update duplicate prevention policy |
| **Pipelines** | `GET` / `POST` | `/api/pipelines` | List or create sales pipelines |
| | `PATCH` / `DELETE`| `/api/pipelines/:id` | Update or delete sales pipeline |
| | `POST` | `/api/pipelines/:id/stages` | Add new stage with win probability & ordering |
| | `POST` | `/api/pipelines/:id/stages/reorder` | Reorder pipeline stages sequence |
| | `PATCH` | `/api/stages/:stage_id` | Rename stage or update probability |
| | `DELETE` | `/api/stages/:stage_id` | Delete stage (protected against active deals) |
| **Deals** | `GET` / `POST` | `/api/deals` | List deals or create opportunity |
| | `GET` / `PATCH` | `/api/deals/:id` | Get deal details or update stage & value |
| | `POST` | `/api/deals/:id/stage` | Transition deal stage on Kanban |
| | `POST` | `/api/deals/:id/create-order` | Generate Sales Order directly from Deal |
| **Products** | `GET` / `POST` | `/api/products` | List product catalog or add new SKU |
| | `PATCH` / `DELETE`| `/api/products/:id` | Update product details or delete SKU |
| | `GET` | `/api/inventory/stats` | Aggregated inventory metrics (on-hand, reserved, available) |
| | `POST` | `/api/inventory/stock-in` | Record inbound product stock-in |
| | `POST` | `/api/inventory/adjust` | Record audit stock adjustment |
| | `POST` | `/api/inventory/return` | Record customer product return |
| **Quotes** | `GET` / `POST` | `/api/quotations` | List or create itemized quotations |
| | `GET` | `/api/quotations/:id/pdf` | Stream vector PDF quotation |
| | `POST` | `/api/quotations/:id/send-email` | Dispatch single email with PDF quote attached |
| | `POST` | `/api/quotations/:id/create-invoice` | Convert quotation directly to Tax Invoice |
| **Orders** | `GET` / `POST` | `/api/orders` | List sales orders or create order |
| | `POST` | `/api/orders/:id/stage` | Update fulfillment stage (reserves/deducts stock) |
| | `POST` | `/api/orders/:id/create-invoice` | Generate Tax Invoice from Sales Order |
| **Invoices** | `GET` / `POST` | `/api/invoices` | List invoices or create tax invoice |
| | `GET` | `/api/invoices/:id/pdf` | Stream official Tax Invoice PDF |
| | `POST` | `/api/invoices/:id/send-email` | Dispatch single email with PDF invoice attached |
| **Payments** | `GET` / `POST` | `/api/payments` | List payments or record invoice payment |
| | `GET` | `/api/payments/:id/pdf` | Stream official PDF payment receipt |
| **Emails** | `GET` | `/api/emails` | List outgoing email delivery audit logs |
| | `POST` | `/api/emails/:id/retry` | Re-queue failed email delivery |
| | `GET` | `/api/emails/deliverability` | View SMTP settings and SPF/DKIM/DMARC status |
| **Company** | `GET` / `PUT` | `/api/company` | View or update company profile, phone & email |
| | `POST` / `DELETE`| `/api/company/logo` | Upload or remove company logo |
| **Webhooks** | `POST` | `/api/webhooks/lead` | Public lead ingestion via Bearer API Key |

---

## ⚙️ Environment Variables Reference

### Backend Configuration (`backend/.env`)

```ini
# Database Connection (PostgreSQL 15-17)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm_db

# JWT Security
JWT_SECRET_KEY=your_super_secret_jwt_key_here_change_in_production

# Server Ports
PORT=8001
FRONTEND_URL=http://localhost:3000

# Google OAuth 2.0 (Optional)
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Outbound SMTP Gateway
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-google-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME="BizCopilot CRM"
SMTP_ENCRYPTION=starttls
SMTP_MOCK_MODE=false
```

### Frontend Configuration (`frontend/.env.local`)

```ini
# Backend API Base URL
NEXT_PUBLIC_API_URL=http://localhost:8001/api

# Google OAuth Client ID (Optional)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## 🛠️ Running Locally

### Prerequisites
- **Go**: 1.23+ ([golang.org](https://golang.org))
- **Node.js**: 18.x or 20.x+ & `npm` ([nodejs.org](https://nodejs.org))
- **PostgreSQL**: 15+ (PostgreSQL 17 recommended) running locally

---

### Step 1: Database Setup
Create the PostgreSQL database:
```sql
CREATE DATABASE crm_db;
```

---

### Step 2: Backend (Go + Gin + pgx)
Navigate to `backend`:
```bash
cd backend

# Verify and download dependencies:
go mod tidy

# Start the backend server (migrations run automatically on startup):
go run ./cmd/server
```
- **Backend API**: [http://localhost:8001](http://localhost:8001)
- **Health Check**: [http://localhost:8001/api/health](http://localhost:8001/api/health)
- **Interactive Swagger Docs**: [http://localhost:8001/docs](http://localhost:8001/docs)

---

### Step 3: Frontend (Next.js 15 + React 19)
Open a separate terminal and navigate to `frontend`:
```bash
cd frontend

# Install dependencies:
npm install

# Start development server:
npm run dev
```
- **Application Portal**: [http://localhost:3000](http://localhost:3000)
- **Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Leads**: [http://localhost:3000/leads](http://localhost:3000/leads)
- **Deals & Kanban**: [http://localhost:3000/deals](http://localhost:3000/deals)
- **Products Catalog**: [http://localhost:3000/products](http://localhost:3000/products)
- **Inventory & Movements**: [http://localhost:3000/inventory](http://localhost:3000/inventory)
- **Quotations**: [http://localhost:3000/quotations](http://localhost:3000/quotations)
- **Orders**: [http://localhost:3000/orders](http://localhost:3000/orders)
- **Invoices**: [http://localhost:3000/invoices](http://localhost:3000/invoices)
- **Payments & Receipts**: [http://localhost:3000/payments](http://localhost:3000/payments)
- **Company Settings & Deliverability**: [http://localhost:3000/company](http://localhost:3000/company)
- **Interactive API Playground**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

---

## 🧪 Verification & Testing

### 1. Frontend TypeScript Validation Check
Ensure zero TypeScript compilation or interface errors:
```bash
cd frontend
npx tsc --noEmit
```

### 2. Backend Automated Test Suite
Execute comprehensive Go tests verifying phone/email validation, inventory reservation, idempotency, and quotation-to-order conversions:
```bash
cd backend
go test -v ./...
```

---

## 📄 License
Internal proprietary license. Built for high-volume enterprise commercial operations.
