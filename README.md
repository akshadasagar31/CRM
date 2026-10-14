# BizCopilot CRM — Universal Enterprise Sales, Inventory & Financial Suite

A high-performance, full-stack Enterprise CRM and Business Operating System built with **Go (Gin + pgx)**, **PostgreSQL 17**, and **Next.js 15 (React 19)**. Engineered to power end-to-end commercial operations across any business vertical—from initial lead capture and multi-pipeline sales to real-time inventory reservation, quotation workflows, automated invoicing, and PDF payment receipt issuance.

---

## 🧭 End-to-End Commercial Lifecycle

```mermaid
flowchart LR
    A[Inbound Lead<br/>& Webhooks] --> B[Deal & Pipeline<br/>Stage Progression]
    B --> C[Quotation & Line Items<br/>PDF Generation]
    C --> D[Sales Order<br/>Inventory Reservation]
    D --> E[Fulfillment &<br/>Stock Deduction]
    E --> F[Tax Invoice<br/>PDF & Printing]
    F --> G[Payment Recording<br/>& PDF Receipts]
```

---

## 🚀 Key Modules & Capabilities

### 1. Universal Lead Management & Dynamic Custom Fields Engine
- **Universal Core Model**: `name`, `phone`, `email`, `requirement`, `source`, `city`, `status`, `owner_id`, `score`, `lost_reason`, `tags`, `follow_up_date`, `last_activity_at`, `deleted_at`.
- **Dynamic Custom Fields without Schema Migrations**:
  - Supported field types: **Text**, **Long Text**, **Number**, **Currency**, **Phone**, **Email**, **Date**, **Date & Time**, **Dropdown**, **Multi-select**, **Checkbox**, and **URL**.
  - Dynamic JSON/relational mapping automatically reflected in API payloads and UI forms.
- **Smart Duplicate Prevention**:
  - E.164 phone normalization (e.g. `+1 (555) 0192` ➔ `+15550192`).
  - Configurable duplicate policies: **Prevent** (`HTTP 409 Conflict`) or **Warn**.
- **Follow-ups & Overdue Alert Badges**:
  - ⚠️ Overdue follow-ups highlighted in red with badge counters.
  - 📅 Due today and scheduled upcoming follow-ups.
  - One-click completion logging and rescheduling.
- **Unpaged Data Display**:
  - Full-record table viewing without restrictive pagination caps, preserving real-time multi-filter queries, global search debouncing, and column sorting.
- **Bulk Operations & Data Portability**:
  - Bulk status transitions, owner reassignment, tag appending, and soft delete/restore.
  - CSV/Excel imports with column mapping and duplicate resolution (`skip`, `update`, `error`).
  - Filtered CSV exports with a single click.

### 2. Deals & Visual Pipeline Management
- **Multi-Pipeline Architecture**: Configure separate sales funnels (e.g., Enterprise B2B, Direct Sales, Inbound Partnerships).
- **Customizable Stages**: Color-coded stages with customizable win probability, order sequencing, and qualification criteria.
- **Visual Funnel & Kanban**: Instant stage transitions with drag-and-drop or modal selectors.
- **Revenue Aggregation**: Real-time stage value calculations, expected closing dates, and currency normalization.

### 3. Product Catalog & Inventory Reservation
- **Unified Product Registry**: Product details, SKUs, HSN/SAC codes, tax rates, selling price, and currency.
- **Tri-State Stock Tracking**:
  - **On-Hand Stock**: Physical count in inventory.
  - **Reserved Stock**: Units committed to confirmed, unfulfilled sales orders.
  - **Available Stock**: Instantly calculate `Current Stock - Reserved Stock` to prevent overselling.
- **Low-Stock Warnings**: Visual status indicators (green / amber / red) based on configurable low-stock thresholds.

### 4. Warehouse & Stock Movement Ledger
- **Complete Audit Trail**: Every stock movement is logged with timestamp, movement type, previous/new stock values, and user accountability.
- **Movement Operations**:
  - **Stock-In**: Inbound shipments from suppliers.
  - **Reserve & Release**: Automated order allocation.
  - **Dispatch**: Physical shipment deducting stock from warehouse.
  - **Returns**: Restock or mark damaged/scrap with condition classification.
  - **Manual Adjustments**: Reconcile physical inventory audits with reason logging.
- **Inventory Alerts**: Dedicated dashboard for critically low and out-of-stock items.

### 5. Quotation Engine & Professional PDF Generation
- **Dynamic Line Items**: Multi-item quotations with unit pricing, customizable discounts, and HSN/SAC tax breakdown.
- **Vector PDF Generator**: Powered by Go Maroto for high-resolution, branded PDF quotes with company letterhead, terms, and payment instructions.
- **In-App PDF Viewer & Download**: Integrated modal viewer with inline rendering and instant download.
- **One-Click Order Conversion**: Convert approved quotes into active sales orders while synchronizing client and item details.

### 6. Sales Order Management & Fulfillment
- **Fulfillment Stage Workflow**:
  - `Confirmed` ➔ `Planning` ➔ `In Progress` ➔ `Delivered` ➔ `Completed` (or `Cancelled`).
- **Automated Inventory Synchronization**:
  - Order confirmation automatically places a reservation on catalog inventory.
  - Order dispatch/completion deducts physical stock.
  - Order cancellation safely releases reservations back to available stock.
- **Financial Status Tracking**: Tracks invoice generation status (`Not Invoiced` / `Invoiced`) and payment receipt status (`Unpaid` / `Partially Paid` / `Paid`).

### 7. Tax Invoicing & Balance Tracking
- **Automated Invoice Generation**: Generate tax invoices directly from sales orders with sequential invoice numbering.
- **Comprehensive Ledger**: Subtotal, line-item taxes, applied discounts, amount paid, and live remaining balance.
- **Status Lifecycle**: `Draft` ➔ `Sent` ➔ `Partially Paid` ➔ `Paid` ➔ `Overdue` ➔ `Void`.
- **Direct PDF Print & Export**: Print-ready PDF documents formatted to standard paper sizes (A4/Letter).

### 8. Payment Ledger & PDF Payment Receipts
- **Multi-Mode Payment Recording**: Bank Transfer, Credit/Debit Card, UPI, Cheque, and Cash.
- **Automatic Balance Updating**: Every payment updates the invoice balance and payment status in real time.
- **Official Payment Receipts**:
  - Generates downloadable and printable PDF payment receipts with unique receipt numbers, transaction reference IDs, and payment breakdown.

### 9. Executive Dashboard & Commercial Intelligence
- **Real-Time KPIs**: Total Leads, Active Deals, Pipeline Value, Invoiced Revenue, and Cash Collected.
- **Sales Funnel Analytics**: Win/Loss ratios, conversion speed, and average deal size.
- **Actionable Alerts**: Urgent follow-ups, low-stock inventory items, and overdue invoices.

### 10. Company Branding & Localization Settings
- **Branding Customization**: Upload company logo, specify legal entity name, address, email, phone, and website.
- **Tax & Compliance**: GSTIN / VAT / Tax ID registration numbers displayed on all generated PDFs.
- **Sequence Generators**: Customizable numbering formats for Leads (`LEAD-`), Quotes (`QT-`), Orders (`ORD-`), Invoices (`INV-`), and Receipts (`REC-`).

### 11. Developer API, Webhooks & Interactive Documentation
- **Interactive API Playground (`/api-docs`)**: In-app test console with live execution against the Go backend, request headers, parameter builder, and automated code generation for **cURL**, **JavaScript Fetch**, and **Python Requests**.
- **Swagger OpenAPI 2.0 (`/docs`)**: Auto-generated interactive Swagger specification.
- **Public Ingestion Webhooks**: Ingest leads from landing pages, forms, Meta ads, or WhatsApp using Bearer API keys.
- **Programmatic API Keys (`/api-keys`)**: SHA-256 hashed API keys with custom naming and revocation controls.

---

## 📡 API Reference Overview

### Authentication & API Keys
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate user and issue JWT Bearer token |
| `GET` | `/api/auth/me` | Fetch currently authenticated user profile |
| `GET` / `POST` | `/api/api-keys` | List or create SHA-256 hashed programmatic API keys |
| `DELETE` | `/api/api-keys/{id}` | Revoke programmatic API key |

### Leads Management
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/leads` | List leads (supports unpaged `limit=0`, filtering, search, sorting) |
| `POST` | `/api/leads` | Create single lead with duplicate protection check |
| `GET` | `/api/leads/{number}` | Get full lead details including custom fields and audit history |
| `PATCH` | `/api/leads/{number}` | Update lead fields, score, status, or assigned owner |
| `DELETE` | `/api/leads/{number}` | Soft delete lead to Trash (`?permanent=true` for purge) |
| `POST` | `/api/leads/{number}/restore` | Restore soft-deleted lead from Trash |
| `POST` | `/api/leads/bulk` | Bulk create leads |
| `PATCH` | `/api/leads/bulk` | Bulk update status, assign owner, add tags, or soft-delete |
| `POST` | `/api/leads/import` | CSV import with mapping and duplicate resolution |
| `GET` | `/api/leads/export` | Download filtered leads as CSV |
| `POST` | `/api/leads/{number}/notes` | Append internal timestamped note |
| `POST` | `/api/leads/{number}/follow-ups` | Schedule new follow-up reminder |

### Deals & Pipelines
| Method | Endpoint | Description |
|---|---|---|
| `GET` / `POST` | `/api/pipelines` | List or create sales pipelines |
| `GET` / `PUT` | `/api/pipelines/{id}` | Retrieve or update pipeline stages and order |
| `GET` | `/api/deals` | List deals with filtering by pipeline, stage, owner, and search |
| `POST` | `/api/deals` | Create a new deal associated with a lead |
| `GET` / `PATCH` | `/api/deals/{id}` | Get deal details or update stage, value, and probability |

### Products & Inventory
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | List catalog products (supports unpaged `limit=0`, search, filters) |
| `POST` | `/api/products` | Create new product with pricing, SKU, and initial stock |
| `GET` / `PUT` | `/api/products/{id}` | Retrieve or update product details and stock thresholds |
| `GET` | `/api/inventory/stats` | Aggregated inventory metrics (total units, reserved, low stock) |
| `GET` | `/api/inventory/movements` | Query historical stock movement ledger |
| `POST` | `/api/inventory/stock-in` | Record inbound product stock-in |
| `POST` | `/api/inventory/adjust` | Record audit stock adjustment (set or delta) with reason |
| `POST` | `/api/inventory/return` | Record customer return (restock or damaged) |
| `GET` | `/api/inventory/alerts` | List products with stock at or below low-stock threshold |

### Quotations & Sales Orders
| Method | Endpoint | Description |
|---|---|---|
| `GET` / `POST` | `/api/quotations` | List or generate itemized quotations |
| `GET` / `PATCH` | `/api/quotations/{id}` | Retrieve or update quotation details |
| `GET` | `/api/quotations/{id}/pdf` | Stream generated high-resolution PDF quote |
| `POST` | `/api/quotations/{id}/convert-to-order` | Convert approved quotation to sales order |
| `GET` / `POST` | `/api/orders` | List orders or create new sales order |
| `GET` / `PATCH` | `/api/orders/{id}` | Retrieve order or update fulfillment stage |

### Invoices, Payments & Receipts
| Method | Endpoint | Description |
|---|---|---|
| `GET` / `POST` | `/api/invoices` | List invoices or generate invoice from order |
| `GET` / `PATCH` | `/api/invoices/{id}` | Retrieve invoice or update details |
| `GET` | `/api/invoices/{id}/pdf` | Stream generated tax invoice PDF |
| `GET` / `POST` | `/api/payments` | List payment ledger entries or record a payment |
| `GET` | `/api/payments/{id}/receipt` | Get structured receipt details |
| `GET` | `/api/payments/{id}/pdf` | Stream official PDF payment receipt |

### Company, Dashboard & Webhooks
| Method | Endpoint | Description |
|---|---|---|
| `GET` / `PUT` | `/api/company` | View or update company profile and branding settings |
| `GET` | `/api/dashboard/stats` | Aggregate commercial KPIs and conversion metrics |
| `POST` | `/api/webhooks/lead` | Public lead ingestion via Bearer API Key |

---

## 🛠️ Running Locally

### Prerequisites
- **Go**: 1.23+ installed ([golang.org](https://golang.org))
- **Node.js**: 18.x or 20.x+ and `npm` installed ([nodejs.org](https://nodejs.org))
- **PostgreSQL**: 15+ (PostgreSQL 17 recommended) running locally or in Docker

### 1. Database Setup
Create the PostgreSQL database (default database name is `crm`):
```sql
CREATE DATABASE crm;
```

### 2. Backend (Go + Gin + pgx)
Navigate to the `backend` folder:
```bash
cd backend

# Configure environment variables (optional, defaults provided):
# export DATABASE_URL="postgres://postgres:postgres@localhost:5432/crm?sslmode=disable"
# export PORT="8001"
# export JWT_SECRET="your-super-secret-key"

# Run migrations and start server:
go run ./cmd/server

# Or compile and execute binary:
go build -o server.exe ./cmd/server
.\server.exe
```
- **Backend API**: [http://localhost:8001](http://localhost:8001)
- **Interactive Swagger Documentation**: [http://localhost:8001/docs](http://localhost:8001/docs)

### 3. Frontend (Next.js 15 + React 19)
Open a separate terminal and navigate to `frontend`:
```bash
cd frontend

# Install dependencies:
npm install

# Start development server:
npm run dev
```
- **App Portal**: [http://localhost:3000](http://localhost:3000)
- **Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Leads**: [http://localhost:3000/leads](http://localhost:3000/leads)
- **Deals**: [http://localhost:3000/deals](http://localhost:3000/deals)
- **Products**: [http://localhost:3000/products](http://localhost:3000/products)
- **Inventory**: [http://localhost:3000/inventory](http://localhost:3000/inventory)
- **Quotations**: [http://localhost:3000/quotations](http://localhost:3000/quotations)
- **Orders**: [http://localhost:3000/orders](http://localhost:3000/orders)
- **Invoices**: [http://localhost:3000/invoices](http://localhost:3000/invoices)
- **Payments**: [http://localhost:3000/payments](http://localhost:3000/payments)
- **Company Settings**: [http://localhost:3000/company](http://localhost:3000/company)
- **In-App API Playground**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **API Keys**: [http://localhost:3000/api-keys](http://localhost:3000/api-keys)

*(Next.js automatically proxies `/api/*` requests to the Go backend on port 8001 via `next.config.ts`)*

---

## 🧪 Verification & Testing

Execute the comprehensive Go backend test suite covering end-to-end commercial flows, inventory reservations, lead duplicate protection, and quotation conversions:

```bash
cd backend
go test -v ./tests/...
```

---

## 📄 License
Internal proprietary license. Built for high-volume enterprise operations.
