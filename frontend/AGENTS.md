<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# CRM UI Development & Design System Guide

This document defines the architectural specifications, design system tokens, CSS utilities, component blueprints, and state patterns for the CRM frontend (`/frontend`).

---

## 1. Technology Stack & Architecture

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Pure CSS Design System defined in `src/app/globals.css` (No Tailwind dependencies)
- **Icons**: `lucide-react`
- **Typography**: Plus Jakarta Sans (UI body & headings) & JetBrains Mono (Code, IDs, numbers)
- **API Client**: Strongly typed Promise client in `src/lib/api.ts` with JWT authentication

---

## 2. Design System Tokens (`globals.css`)

Always use the standardized CSS variables rather than hardcoded hex values:

```css
:root {
  /* Surface & Background Colors */
  --bg-primary: #FFFFFF;
  --bg-page: #F8FAFC;
  --bg-card: #FFFFFF;
  --bg-card-hover: #F8FAFC;
  --bg-input: #FFFFFF;
  --bg-elevated: #F4F7FB;
  --sidebar-bg: #FFFFFF;

  /* Typography Colors */
  --text-primary: #0B1730;      /* Deep navy primary */
  --text-secondary: #475569;    /* Muted body text */
  --text-muted: #8092A7;        /* Form placeholders & hints */
  --text-inverse: #FFFFFF;

  /* Brand Accents */
  --primary-teal: #009F9A;      /* Primary accent */
  --primary-teal-hover: #008782;
  --primary-blue: #009FE3;      /* Secondary blue */
  --primary-blue-hover: #0088C4;
  --light-teal: #E8F7F5;
  --light-blue: #EAF7FC;

  /* Borders */
  --border-subtle: #E5EAF0;
  --border-focus: #009F9A;
  --border-strong: #CBD5E1;

  /* Status Tokens */
  --success: #10B981;
  --success-bg: #ECFDF5;
  --success-border: #A7F3D0;

  --warning: #F59E0B;
  --warning-bg: #FFFBEB;
  --warning-border: #FDE68A;

  --danger: #EF4444;
  --danger-bg: #FEF2F2;
  --danger-border: #FCA5A5;

  /* Elevation & Shadows */
  --shadow-xs: 0 1px 2px rgba(11, 23, 48, 0.04);
  --shadow-sm: 0 1px 3px rgba(11, 23, 48, 0.06), 0 1px 2px rgba(11, 23, 48, 0.04);
  --shadow-md: 0 4px 12px rgba(11, 23, 48, 0.06), 0 2px 4px rgba(11, 23, 48, 0.03);
  --shadow-lg: 0 10px 25px -3px rgba(11, 23, 48, 0.08);
  --shadow-xl: 0 20px 35px -5px rgba(11, 23, 48, 0.12);

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 9999px;
}
```

---

## 3. Standard Component Blueprints

### A. Buttons (`.btn`)

Use predefined button classes with icons from `lucide-react`:

```tsx
import { Plus, Download, Trash2, Send, Edit2 } from 'lucide-react';

// Primary Action Button (Teal)
<button className="btn btn-primary" id="btn-create-item" onClick={handleCreate}>
  <Plus size={16} />
  <span>New Lead</span>
</button>

// Secondary / Export Button (White elevated)
<button className="btn btn-secondary" id="btn-export-data" onClick={handleExport}>
  <Download size={16} />
  <span>Export</span>
</button>

// Accent Blue Button
<button className="btn btn-blue" id="btn-send-email" onClick={handleSend}>
  <Send size={16} />
  <span>Send Email</span>
</button>

// Danger Button
<button className="btn btn-danger" id="btn-delete-item" onClick={handleDelete}>
  <Trash2 size={16} />
  <span>Delete</span>
</button>

// Icon-Only Action Button
<button className="btn-icon" aria-label="Edit item">
  <Edit2 size={16} />
</button>
```

---

### B. Metric & Stat Cards

Standard metric banner displayed at the top of entity pages (e.g. Invoices, Deals, Leads):

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
  <div className="white-card" style={{ padding: '1.25rem' }}>
    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
      Total Revenue
    </div>
    <div style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text-primary)' }}>
      ₹1,45,200
    </div>
    <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem', fontWeight: 600 }}>
      +12.4% from last month
    </div>
  </div>
</div>
```

---

### C. Clean CRM Data Table

Data tables must use `.table-container` and `.crm-table` with sticky headers and responsive horizontal scroll:

```tsx
<div className="table-container">
  <table className="crm-table">
    <thead>
      <tr>
        <th style={{ width: '40px' }}><input type="checkbox" /></th>
        <th>Customer</th>
        <th>Invoice Number</th>
        <th>Amount</th>
        <th>Status</th>
        <th>Due Date</th>
        <th style={{ textAlign: 'right' }}>Actions</th>
      </tr>
    </thead>
    <tbody>
      {items.map((item) => (
        <tr key={item.id} className="crm-table-row">
          <td><input type="checkbox" /></td>
          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.customer_name}</td>
          <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{item.invoice_number}</span></td>
          <td style={{ fontWeight: 600 }}>₹{item.grand_total.toFixed(2)}</td>
          <td>
            <span className={`badge-status status-${item.status.toLowerCase()}`}>
              {item.status}
            </span>
          </td>
          <td style={{ color: 'var(--text-secondary)' }}>{item.due_date}</td>
          <td style={{ textAlign: 'right' }}>
            <button className="btn-icon" title="Send Email" onClick={() => handleSendEmail(item)}>
              <Mail size={15} />
            </button>
            <button className="btn-icon" title="Download PDF" onClick={() => handleDownloadPdf(item)}>
              <Download size={15} />
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

### D. Modal Dialog System

Modals must use backdrop blur, entrance transitions, and accessible close handles:

```tsx
{isModalOpen && (
  <div className="modal-overlay" id="modal-backdrop" onClick={() => setIsModalOpen(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h3 className="heading-sm">Schedule Follow-Up</h3>
        <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
          <X size={18} />
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Task Title</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quarterly Review Call"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Due Date & Time</label>
            <input
              type="datetime-local"
              className="form-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Follow-Up'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

---

### E. Slide-Over Drawer

Used for deep detail inspection without leaving the active table view:

```tsx
{isDrawerOpen && (
  <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)}>
    <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header">
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-teal)' }}>
            LEAD DETAILS
          </span>
          <h2 className="heading-md">{selectedLead?.name}</h2>
        </div>
        <button className="btn-icon" onClick={() => setIsDrawerOpen(false)}>
          <X size={20} />
        </button>
      </div>

      <div className="drawer-content">
        {/* Tab Navigation, Timeline, & Interaction Notes */}
      </div>
    </div>
  </div>
)}
```

---

## 4. API & State Integration Rules

1. **Centralized Requests**: All backend communications go through functions in `src/lib/api.ts`.
2. **Toast Feedback**: Every write operation (Create, Update, Delete, Send Email) must trigger visual feedback using the custom toast utility (`showToast("Message", "success" | "error")`).
3. **Empty States**: Never display a raw empty table. Render an empty card with an icon, informative text, and a primary call-to-action button when `items.length === 0`.
4. **Loading States**: Display subtle skeletons or disabled button spinners (`isSubmitting`) during async operations.

---

## 5. Accessibility & Testing Standards

- **Unique Element IDs**: All interactive elements (buttons, inputs, dropdowns, modals) must have descriptive `id` attributes (e.g. `id="btn-create-invoice"`, `id="input-customer-email"`).
- **ARIA Attributes**: Include proper `aria-label` on icon-only buttons.
- **Keyboard Navigation**: Ensure `Escape` closes active modals and drawers.
- **No Tailwind Conflicts**: Maintain full visual control by extending `globals.css` with semantic classes rather than injecting inline utility frameworks.

