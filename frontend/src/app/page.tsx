"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Globe,
  Share2,
  Table as TableIcon,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Terminal,
  Layers,
  LogIn,
  ChevronDown,
  LayoutDashboard,
  Building2,
  Phone,
  Mail,
  FileText,
  Sparkles,
  Flame,
  Check,
  ShieldAlert,
  UserCheck,
  Users,
  Target,
  TrendingUp,
  BarChart3,
  Briefcase,
  FileCheck,
  ShoppingBag,
  PackageCheck,
  Truck,
  Boxes,
  Warehouse,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
  Percent,
  CreditCard,
  Wallet,
  Banknote,
  Key,
  Webhook,
  Code2,
  Copy,
  Cpu,
  Database,
  Server,
  ExternalLink,
  ChevronRight,
  X,
  Play,
  CheckCheck,
} from "lucide-react";
import { getToken } from "@/lib/api";

// 7-Stage End-to-End Workflow Definition
const WORKFLOW_STAGES = [
  {
    id: "leads",
    step: "01",
    name: "Inbound Leads",
    shortName: "Lead Capture",
    icon: Target,
    color: "#009F9A",
    tagline: "Multi-channel ingestion with phone deduplication",
    entityId: "LEAD-0042",
    entityTitle: "Priya Sharma (Acme Corp)",
    transitionLabel: "Qualified & Verified",
    nextAction: "Convert to Pipeline Deal →",
    description: "Inbound inquiries are automatically ingested via webhooks, website forms, or Google Sheets with strict unique phone number deduplication.",
    metrics: [
      { label: "Deduplication", value: "Strict Primary Key" },
      { label: "Ingestion Latency", value: "< 5ms" },
      { label: "Status", value: "New Inbound" },
    ],
    sampleData: {
      phone: "+91 98765 43210",
      source: "website",
      city: "Mumbai, MH",
      requirement: "Enterprise Cloud ERP Automation",
    },
  },
  {
    id: "deals",
    step: "02",
    name: "Deals & Pipelines",
    shortName: "Deal Pipeline",
    icon: TrendingUp,
    color: "#009FE3",
    tagline: "Kanban stages, weighted probabilities & forecasting",
    entityId: "DEAL-0028",
    entityTitle: "Acme Corp - ERP Implementation",
    transitionLabel: "Proposal Stage (75%)",
    nextAction: "Generate Commercial Quotation →",
    description: "Visual stage tracking with drag-and-drop Kanban, weighted deal revenue calculations, and automated follow-up reminders.",
    metrics: [
      { label: "Deal Value", value: "₹ 15,00,000" },
      { label: "Win Probability", value: "75%" },
      { label: "Pipeline Stage", value: "Proposal Sent" },
    ],
    sampleData: {
      owner: "Akshada Sagar",
      expectedClose: "28-Oct-2026",
      pipeline: "Enterprise B2B Pipeline",
      weightedValue: "₹ 11,25,000",
    },
  },
  {
    id: "customers",
    step: "03",
    name: "Customer Accounts",
    shortName: "Customer 360",
    icon: Building2,
    color: "#8B5CF6",
    tagline: "Verified company master with GSTIN & billing addresses",
    entityId: "CUST-0015",
    entityTitle: "Acme Technologies Pvt Ltd",
    transitionLabel: "Active Account",
    nextAction: "Configure Line Items →",
    description: "Master client records with tax metadata, shipping/billing locations, contact persons, and lifetime purchase histories.",
    metrics: [
      { label: "GSTIN Status", value: "Active Verified" },
      { label: "State Code", value: "27 - Maharashtra" },
      { label: "Account Health", value: "High Value" },
    ],
    sampleData: {
      gstin: "27AAACB2233M1Z2",
      pan: "AAACB2233M",
      contact: "priya@acmetech.com | 98765 43210",
      address: "Bandra Kurla Complex, Mumbai 400051",
    },
  },
  {
    id: "quotations",
    step: "04",
    name: "Commercial Quotations",
    shortName: "Quotations",
    icon: FileText,
    color: "#F59E0B",
    tagline: "Multi-item pricing, tax breakdown & Maroto v2 PDFs",
    entityId: "QTN-0001-R1",
    entityTitle: "Quotation for Cloud ERP Suite",
    transitionLabel: "Approved by Client",
    nextAction: "Confirm Sales Order →",
    description: "Dynamic pricing with customizable tax breakdown (CGST/SGST/IGST), discount rules, and instant generation of professional Maroto v2 PDFs.",
    metrics: [
      { label: "Subtotal", value: "₹ 15,00,000" },
      { label: "GST (18%)", value: "₹ 2,70,000" },
      { label: "Grand Total", value: "₹ 17,70,000" },
    ],
    sampleData: {
      itemsCount: "3 Line Items",
      terms: "Payment 50% advance, balance on delivery",
      pdfEngine: "Maroto v2 Native Go",
      status: "Sent & Viewed",
    },
  },
  {
    id: "orders",
    step: "05",
    name: "Sales Orders",
    shortName: "Order Fulfillment",
    icon: ShoppingBag,
    color: "#10B981",
    tagline: "Order confirmation, dispatch scheduling & tracking",
    entityId: "ORD-0019",
    entityTitle: "Sales Order - Cloud ERP Suite",
    transitionLabel: "Confirmed & Scheduled",
    nextAction: "Allocate Warehouse Inventory →",
    description: "Formal sales order commitment binding customer quotations to inventory allocations, dispatch dates, and payment milestones.",
    metrics: [
      { label: "Order Status", value: "Confirmed" },
      { label: "Fulfillment", value: "Pending Stock Allocation" },
      { label: "Total Value", value: "₹ 17,70,000" },
    ],
    sampleData: {
      orderDate: "12-Oct-2026",
      dispatchDate: "18-Oct-2026",
      shippingMethod: "Direct Delivery / Digital Activation",
      linkedQuote: "QTN-0001-R1",
    },
  },
  {
    id: "inventory",
    step: "06",
    name: "Inventory Allocation",
    shortName: "Inventory Control",
    icon: Boxes,
    color: "#EC4899",
    tagline: "Real-time stock reservation & automated reorder alerts",
    entityId: "INV-SKU-004",
    entityTitle: "ERP Server Node License (x20 Units)",
    transitionLabel: "Stock Reserved",
    nextAction: "Issue GST Tax Invoice →",
    description: "Automatic stock deductions upon order confirmation, low-inventory threshold notifications, and warehouse movement audit trails.",
    metrics: [
      { label: "Units Reserved", value: "20 Units" },
      { label: "Warehouse", value: "Main Central Hub" },
      { label: "Stock Level", value: "Healthy (180 remaining)" },
    ],
    sampleData: {
      sku: "LIC-CLOUD-ENT-V2",
      batch: "BATCH-2026-Q4",
      action: "Stock-Out Reservation",
      reorderPoint: "50 Units",
    },
  },
  {
    id: "invoices",
    step: "07",
    name: "Invoices & Payments",
    shortName: "Invoice & Payment",
    icon: Receipt,
    color: "#009F9A",
    tagline: "GST tax compliance, partial payments & official receipts",
    entityId: "INV-0003 & PAY-00018",
    entityTitle: "Tax Invoice & Official Payment Receipt",
    transitionLabel: "Settled & Closed",
    nextAction: "Workflow Complete ✓",
    description: "Automated GST tax invoicing with intra/inter-state tax logic, multiple payment modes (UPI, NEFT, Cheque), and Maroto payment receipt vouchers.",
    metrics: [
      { label: "Total Invoiced", value: "₹ 17,70,000" },
      { label: "Paid Today", value: "₹ 70,000 (UPI)" },
      { label: "Remaining Due", value: "₹ 17,00,000" },
    ],
    sampleData: {
      invoiceStatus: "Partially Paid",
      voucher: "PAY-00018",
      receiptPdf: "Maroto v2 Standardized Voucher",
      reconciliation: "Live Balance Updated",
    },
  },
];

// 9 Comprehensive CRM Modules Data
const CRM_MODULES = [
  {
    id: "mod-leads",
    category: "sales",
    categoryName: "Sales & Pipeline",
    title: "Leads Engine",
    shortDesc: "Inbound capture, deduplication & enrichment",
    icon: Target,
    color: "#009F9A",
    badge: "Core Ingestion",
    highlightMetric: "0 Duplicate Leaks",
    capabilities: [
      "Strict phone number unique primary key enforcement",
      "Multi-channel capture: Web forms, Ads, Sheets, Manual",
      "Real-time webhook ingestion with schema validation",
      "Bulk CSV lead import and export with custom filters",
    ],
    demoPreview: {
      entity: "Lead #LEAD-0089",
      field1: "Name: Rohit Verma",
      field2: "Phone: +91 91234 56789 (Unique Check: Passed)",
      field3: "Source: Google Sheets Sync",
      field4: "Requirement: 50x CRM User Licenses",
    },
  },
  {
    id: "mod-deals",
    category: "sales",
    categoryName: "Sales & Pipeline",
    title: "Deals & Pipelines",
    shortDesc: "Multi-stage Kanban boards & revenue forecasting",
    icon: TrendingUp,
    color: "#009FE3",
    badge: "Revenue Growth",
    highlightMetric: "Visual Kanban",
    capabilities: [
      "Custom multi-stage deal pipelines with stage probabilities",
      "Real-time weighted value and revenue pipeline forecasting",
      "Drag-and-drop Kanban workflow with stage velocity",
      "Automated follow-up reminders and activity logs",
    ],
    demoPreview: {
      entity: "Deal #DEAL-0012",
      field1: "Title: Global Fintech Migration",
      field2: "Value: ₹ 24,50,000 (Weighted: ₹ 18,37,500)",
      field3: "Stage: Technical Evaluation (75%)",
      field4: "Owner: Sales Desk • Next Task: Demo Call",
    },
  },
  {
    id: "mod-customers",
    category: "sales",
    categoryName: "Sales & Pipeline",
    title: "Customer 360",
    shortDesc: "Master customer directory & tax profiles",
    icon: Building2,
    color: "#8B5CF6",
    badge: "Account Master",
    highlightMetric: "360° History",
    capabilities: [
      "Complete historical view of quotations, orders, and payments",
      "State-wise tax determination and GSTIN format checks",
      "Multi-contact directory per client organization",
      "Account tiering, lifetime value tracking & notes",
    ],
    demoPreview: {
      entity: "Customer #CUST-0024",
      field1: "Company: Apex Logistics Solutions",
      field2: "GSTIN: 27AABCA1234B1Z5 • State: Maharashtra",
      field3: "Total Invoiced: ₹ 42,00,000",
      field4: "Credit Status: Approved (30 Days)",
    },
  },
  {
    id: "mod-quotations",
    category: "commerce",
    categoryName: "Commerce & Billing",
    title: "Commercial Quotations",
    shortDesc: "Line items, tax splits & Maroto v2 PDFs",
    icon: FileText,
    color: "#F59E0B",
    badge: "Document Engine",
    highlightMetric: "Native Go PDF",
    capabilities: [
      "Multi-product line item builder with dynamic HSN/SAC codes",
      "Intra-state (CGST+SGST) vs Inter-state (IGST) calculations",
      "One-click PDF generation via native Maroto v2 engine",
      "Revision history (R1, R2) and quote-to-order conversion",
    ],
    demoPreview: {
      entity: "Quotation #QTN-0001-R1",
      field1: "Subject: Cloud ERP Solution",
      field2: "Subtotal: ₹ 15,00,000 • GST: ₹ 2,70,000",
      field3: "Grand Total: ₹ 17,70,000",
      field4: "Action: Download Maroto PDF / Print",
    },
  },
  {
    id: "mod-orders",
    category: "commerce",
    categoryName: "Commerce & Billing",
    title: "Sales Orders",
    shortDesc: "Order booking, fulfillment & dispatch logs",
    icon: ShoppingBag,
    color: "#10B981",
    badge: "Fulfillment",
    highlightMetric: "Instant Booking",
    capabilities: [
      "Direct conversion from approved quotations in one click",
      "Fulfillment status tracking: Pending, In Progress, Dispatched",
      "Delivery timeline scheduling and courier tracking numbers",
      "Automatic linkage to inventory allocations and invoices",
    ],
    demoPreview: {
      entity: "Sales Order #ORD-0034",
      field1: "Customer: Acme Technologies Pvt Ltd",
      field2: "Value: ₹ 8,50,000 • Status: Dispatched",
      field3: "Tracking: BLUEDART-982348234",
      field4: "Invoice Status: Generated (INV-0012)",
    },
  },
  {
    id: "mod-inventory",
    category: "operations",
    categoryName: "Operations & Platform",
    title: "Inventory Control",
    shortDesc: "SKU tracking, warehouse movements & alerts",
    icon: Boxes,
    color: "#EC4899",
    badge: "Stock Operations",
    highlightMetric: "Live Movements",
    capabilities: [
      "Real-time available vs reserved warehouse stock tracking",
      "Automated low-stock alerts and reorder threshold badges",
      "Stock-In, Stock-Out, and Adjustment audit logs with reasons",
      "Product category filtering, unit pricing, and HSN codes",
    ],
    demoPreview: {
      entity: "Inventory SKU #PRD-004",
      field1: "Item: Dell Latitude 5440 i7 16GB",
      field2: "Available: 42 Units • Reserved: 8 Units",
      field3: "Threshold: 15 Units (Status: Optimal)",
      field4: "Last Movement: Stock-In +25 on 10-Oct",
    },
  },
  {
    id: "mod-invoices",
    category: "commerce",
    categoryName: "Commerce & Billing",
    title: "GST Tax Invoices",
    shortDesc: "Statutory tax invoices & balance due tracking",
    icon: Receipt,
    color: "#009F9A",
    badge: "GST Compliant",
    highlightMetric: "Statutory Accurate",
    capabilities: [
      "Intra-State (CGST 9% + SGST 9%) & Inter-State (IGST 18%)",
      "Payment due date tracking with automated overdue flags",
      "Maroto v2 high-resolution A4 tax invoice generation",
      "Balance due auto-reconciliation on recorded payments",
    ],
    demoPreview: {
      entity: "Invoice #INV-0003",
      field1: "Recipient: prerna sagar (Maharashtra)",
      field2: "Total: ₹ 17,70,000 • Paid: ₹ 70,000",
      field3: "Balance Due: ₹ 17,00,000 (Partially Paid)",
      field4: "Template: Minimalist Navy/Teal Maroto v2",
    },
  },
  {
    id: "mod-payments",
    category: "commerce",
    categoryName: "Commerce & Billing",
    title: "Payments & Receipts",
    shortDesc: "Payment recording & Maroto receipt vouchers",
    icon: CreditCard,
    color: "#3B82F6",
    badge: "Collections",
    highlightMetric: "Instant Receipts",
    capabilities: [
      "Support for UPI, QR, Bank Transfer, Cheque, and Cash",
      "Transaction UTR / Reference number tracking and audits",
      "Automated Indian number-to-words currency formatting",
      "Maroto v2 Official Payment Receipt voucher PDFs",
    ],
    demoPreview: {
      entity: "Payment #PAY-00018",
      field1: "Amount: ₹ 70,000.00 (UPI / QR)",
      field2: "Ref: UPI-9834289423 • Date: 12-Oct-2026",
      field3: "Words: Seventy Thousand Rupees Only",
      field4: "PDF Receipt: Preview / Print / Download",
    },
  },
  {
    id: "mod-apikeys",
    category: "operations",
    categoryName: "Operations & Platform",
    title: "API Keys & Webhooks",
    shortDesc: "Scoped REST authentication & webhook ingestion",
    icon: Key,
    color: "#6366F1",
    badge: "Developer Hub",
    highlightMetric: "< 5ms Ingest",
    capabilities: [
      "Scoped API keys (`leads:read`, `leads:write`, `invoices:read`)",
      "Instant generic webhook ingestion at `POST /api/webhooks/lead`",
      "Instant duplicate phone detection returning HTTP 409",
      "Revocable bearer tokens with hashed storage in PostgreSQL",
    ],
    demoPreview: {
      entity: "API Key #key_live_9f83a",
      field1: "Scope: leads:write, webhooks:ingest",
      field2: "Endpoint: POST /api/webhooks/lead",
      field3: "Auth Header: X-API-Key: crm_live_***",
      field4: "Status: Active • Rate Limit: 100 req/sec",
    },
  },
];

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeWorkflowStage, setActiveWorkflowStage] = useState(0);
  const [selectedModuleCategory, setSelectedModuleCategory] = useState("all");
  const [activeModuleModal, setActiveModuleModal] = useState<typeof CRM_MODULES[0] | null>(null);

  // Developer Console Simulator State
  const [devConsoleTab, setDevConsoleTab] = useState<"webhook" | "apikey" | "snippets">("webhook");
  const [webhookScenario, setWebhookScenario] = useState<"new" | "duplicate">("new");
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false);
  const [webhookResponse, setWebhookResponse] = useState<any>(null);
  const [snippetLanguage, setSnippetLanguage] = useState<"curl" | "fetch" | "python" | "go">("curl");
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    setIsAuthenticated(!!getToken());
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSimulateWebhook = () => {
    setIsSimulatingWebhook(true);
    setWebhookResponse(null);
    setTimeout(() => {
      if (webhookScenario === "new") {
        setWebhookResponse({
          status: 201,
          statusText: "Created",
          durationMs: 4,
          data: {
            success: true,
            message: "Lead ingested and verified successfully",
            lead_id: 142,
            number: "+91 98765 43210",
            source: "website",
            created_at: new Date().toISOString(),
          },
        });
      } else {
        setWebhookResponse({
          status: 409,
          statusText: "Conflict",
          durationMs: 3,
          data: {
            success: false,
            error: "DuplicateLeadError",
            detail: "Phone number '+91 98765 43210' already exists in CRM database",
            code: 409,
            timestamp: new Date().toISOString(),
          },
        });
      }
      setIsSimulatingWebhook(false);
    }, 400);
  };

  const handleCopyApiKey = () => {
    navigator.clipboard?.writeText("crm_live_9f83a219bc044a88b7e21a9c4");
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopySnippet = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const filteredModules = selectedModuleCategory === "all"
    ? CRM_MODULES
    : CRM_MODULES.filter((m) => m.category === selectedModuleCategory);

  const currentStage = WORKFLOW_STAGES[activeWorkflowStage];

  const codeSnippets: Record<string, string> = {
    curl: `curl -X POST http://localhost:8001/api/webhooks/lead \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: crm_live_9f83a219bc044a88b7e21a9c4" \\
  -d '{
    "number": "+91 98765 43210",
    "name": "Priya Sharma",
    "email": "priya@example.com",
    "requirement": "Enterprise CRM Ingestion",
    "source": "website",
    "city": "Mumbai"
  }'`,
    fetch: `const response = await fetch("http://localhost:8001/api/webhooks/lead", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "crm_live_9f83a219bc044a88b7e21a9c4"
  },
  body: JSON.stringify({
    number: "+91 98765 43210",
    name: "Priya Sharma",
    email: "priya@example.com",
    requirement: "Enterprise CRM Ingestion",
    source: "website",
    city: "Mumbai"
  })
});
const data = await response.json();
console.log("Ingestion result:", data);`,
    python: `import requests

url = "http://localhost:8001/api/webhooks/lead"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "crm_live_9f83a219bc044a88b7e21a9c4"
}
payload = {
    "number": "+91 98765 43210",
    "name": "Priya Sharma",
    "email": "priya@example.com",
    "requirement": "Enterprise CRM Ingestion",
    "source": "website",
    "city": "Mumbai"
}

response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Response:", response.json())`,
    go: `package main

import (
    "bytes"
    "fmt"
    "net/http"
)

func main() {
    jsonData := []byte(\`{
        "number": "+91 98765 43210",
        "name": "Priya Sharma",
        "email": "priya@example.com",
        "requirement": "Enterprise CRM Ingestion",
        "source": "website",
        "city": "Mumbai"
    }\`)

    req, _ := http.NewRequest("POST", "http://localhost:8001/api/webhooks/lead", bytes.NewBuffer(jsonData))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-API-Key", "crm_live_9f83a219bc044a88b7e21a9c4")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()
    fmt.Println("Response Status:", resp.Status)
}`,
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#FFFFFF" }}>
      {/* ============================================================= */}
      {/* Fixed/Sticky Top Navigation Header                             */}
      {/* ============================================================= */}
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          height: "64px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            width: "100%",
            margin: "0 auto",
            padding: "0 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Brand Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "9px",
                background: "linear-gradient(135deg, var(--primary-teal) 0%, var(--primary-blue) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: "1.125rem",
                boxShadow: "0 2px 8px rgba(0, 159, 154, 0.25)",
              }}
            >
              C
            </div>
            <span style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.025em" }}>
              CRM
            </span>
          </Link>

          {/* In-Page Navigation Links (Smooth-scrolling to all sections) */}
          <nav style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <a
              href="#workflow"
              onClick={(e) => scrollToSection(e, "workflow")}
              className="nav-link-hover"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Workflow
            </a>
            <a
              href="#modules"
              onClick={(e) => scrollToSection(e, "modules")}
              className="nav-link-hover"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Modules (9)
            </a>
            <a
              href="#api"
              onClick={(e) => scrollToSection(e, "api")}
              className="nav-link-hover"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              API & Webhooks
            </a>
            <a
              href="#architecture"
              onClick={(e) => scrollToSection(e, "architecture")}
              className="nav-link-hover"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Architecture
            </a>
          </nav>

          {/* Prominent High-Contrast Sign In Action */}
          <div>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="btn btn-primary interactive-cta"
                id="btn-header-leads"
                style={{
                  padding: "0.55rem 1.35rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  boxShadow: "0 2px 8px rgba(0, 159, 154, 0.2)",
                }}
              >
                <LayoutDashboard size={16} /> Open Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <Link
                href="/login"
                className="btn btn-primary interactive-cta"
                id="btn-header-signin"
                style={{
                  padding: "0.55rem 1.45rem",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  backgroundColor: "var(--primary-teal)",
                  boxShadow: "0 2px 10px rgba(0, 159, 154, 0.3)",
                }}
              >
                <LogIn size={16} /> Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ============================================================= */}
      {/* Modern Full-Viewport Hero (KEPT 100% EXACTLY AS ORIGINAL)      */}
      {/* ============================================================= */}
      <section
        style={{
          height: "calc(100vh - 64px)",
          minHeight: "620px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem 2rem",
          position: "relative",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* Ambient Animated Blurred Radial Gradient Spheres */}
        <div
          className="animate-float-orb-1"
          style={{
            position: "absolute",
            top: "8%",
            left: "5%",
            width: "520px",
            height: "520px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 159, 154, 0.12) 0%, rgba(255, 255, 255, 0) 70%)",
            filter: "blur(60px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          className="animate-float-orb-2"
          style={{
            position: "absolute",
            bottom: "5%",
            right: "5%",
            width: "560px",
            height: "560px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 159, 227, 0.10) 0%, rgba(255, 255, 255, 0) 70%)",
            filter: "blur(70px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Subtle Tech Micro-Grid Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(#CBD5E1 0.75px, transparent 0.75px)",
            backgroundSize: "28px 28px",
            opacity: 0.35,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Content Container (Balanced 2-Column Layout) */}
        <div
          style={{
            maxWidth: "1280px",
            width: "100%",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: "3.5rem",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Left Column: Headline, Description & Call To Action */}
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.3rem 0.85rem",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--light-teal)",
                border: "1px solid rgba(0, 159, 154, 0.25)",
                fontSize: "0.75rem",
                color: "var(--primary-teal)",
                fontWeight: 700,
                marginBottom: "1.25rem",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              <Sparkles size={13} />
              <span>Modern Inbound CRM Engine</span>
            </div>

            <h1
              style={{
                fontSize: "3rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                lineHeight: 1.12,
                letterSpacing: "-0.035em",
                marginBottom: "1.25rem",
              }}
            >
              Universal Lead Management,{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, var(--primary-teal) 0%, var(--primary-blue) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Simplified
              </span>
            </h1>

            <p
              style={{
                fontSize: "1.125rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                marginBottom: "2.25rem",
                maxWidth: "540px",
              }}
            >
              Centralize inbound inquiries with strict phone number duplicate detection and real-time webhook ingestion into PostgreSQL.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <Link
                href={isAuthenticated ? "/dashboard" : "/login"}
                className="btn btn-primary interactive-cta"
                id="btn-hero-cta"
                style={{
                  padding: "0.875rem 2rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  boxShadow: "0 4px 15px rgba(0, 159, 154, 0.28)",
                }}
              >
                {isAuthenticated ? (
                  <>
                    <LayoutDashboard size={18} /> Open CRM Dashboard <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    <LogIn size={18} /> Sign In to Access CRM <ArrowRight size={16} />
                  </>
                )}
              </Link>

              <a
                href="#workflow"
                onClick={(e) => scrollToSection(e, "workflow")}
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  textDecoration: "none",
                  padding: "0.85rem 1rem",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary-teal)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                Explore Features <ChevronDown size={16} />
              </a>
            </div>
          </div>

          {/* Right Column: Visually Impressive Glassmorphic CRM Preview with Floating Micro-Badges */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            {/* Top-Right Floating Micro-Badge */}
            <div
              className="animate-badge-float-1"
              style={{
                position: "absolute",
                top: "-18px",
                right: "-12px",
                zIndex: 10,
                backgroundColor: "#FFFFFF",
                padding: "0.6rem 0.95rem",
                borderRadius: "12px",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                boxShadow: "0 8px 24px rgba(239, 68, 68, 0.12), 0 2px 6px rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#DC2626",
              }}
            >
              <ShieldAlert size={16} />
              <span>Duplicate Blocked: Phone Exists (409)</span>
            </div>

            {/* Bottom-Left Floating Micro-Badge */}
            <div
              className="animate-badge-float-2"
              style={{
                position: "absolute",
                bottom: "-18px",
                left: "-12px",
                zIndex: 10,
                backgroundColor: "#FFFFFF",
                padding: "0.6rem 0.95rem",
                borderRadius: "12px",
                border: "1px solid rgba(0, 159, 154, 0.25)",
                boxShadow: "0 8px 24px rgba(0, 159, 154, 0.12), 0 2px 6px rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--primary-teal)",
              }}
            >
              <CheckCircle2 size={16} />
              <span>Webhook Ingested: POST /api/webhooks/lead (201)</span>
            </div>

            {/* Main CRM Glass Window Frame */}
            <div
              className="hero-glass-window"
              style={{
                width: "100%",
                maxWidth: "470px",
                overflow: "hidden",
              }}
            >
              {/* Window Header with macOS-style Control Dots */}
              <div
                style={{
                  padding: "0.85rem 1.25rem",
                  backgroundColor: "rgba(244, 247, 251, 0.8)",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#EF4444", display: "inline-block" }} />
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#F59E0B", display: "inline-block" }} />
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#10B981", display: "inline-block" }} />
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", marginLeft: "0.25rem" }}>
                    Lead Record Preview • Fictional Demo
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    color: "#059669",
                    backgroundColor: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  PostgreSQL 17
                </span>
              </div>

              {/* Window Body: Lead Entity Card */}
              <div style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "10px",
                        backgroundColor: "var(--light-teal)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--primary-teal)",
                        fontWeight: 800,
                        fontSize: "1.125rem",
                      }}
                    >
                      A
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "1rem" }}>Acme Global Tech</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Unique Record #LEAD-001</div>
                    </div>
                  </div>
                  <span className="badge-source website">Website Form</span>
                </div>

                <div
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    borderRadius: "10px",
                    padding: "0.875rem 1rem",
                    border: "1px solid var(--border-subtle)",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                    fontSize: "0.8125rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                      Phone (Primary Key)
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Phone size={12} color="var(--primary-teal)" /> +1 (555) 0199
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                      Email
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Mail size={12} /> info@acmetech.io
                    </span>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                      Requirement
                    </span>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                      Enterprise CRM deployment with strict duplicate prevention
                    </span>
                  </div>
                </div>

                {/* Micro Validation Indicator */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary-teal)", fontWeight: 700 }}>
                    <ShieldCheck size={15} />
                    <span>Duplicate Prevention Active</span>
                  </div>
                  <span className="badge-status in-progress">Contacted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/* SECTION 1: End-to-End CRM Lifecycle Engine (#workflow)          */}
      {/* ============================================================= */}
      <section
        id="workflow"
        style={{
          padding: "5.5rem 2rem",
          maxWidth: "1280px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.3rem 0.85rem",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--light-teal)",
              border: "1px solid rgba(0, 159, 154, 0.25)",
              fontSize: "0.75rem",
              color: "var(--primary-teal)",
              fontWeight: 700,
              marginBottom: "1rem",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            <Layers size={13} />
            <span>Unified Relational Lifecycle</span>
          </div>
          <h2 className="heading-lg" style={{ fontSize: "2.35rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
            The Complete End-to-End CRM Workflow
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "680px", margin: "0 auto", fontSize: "1.0625rem", lineHeight: 1.6 }}>
            Track every customer touchpoint seamlessly: from raw inbound lead deduplication, through sales pipeline opportunities and commercial quotations, to warehouse stock allocation and GST tax invoicing.
          </p>
        </div>

        {/* 7-Step Horizontal Pipeline Tracker */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "0.75rem",
            marginBottom: "2.5rem",
            position: "relative",
          }}
        >
          {WORKFLOW_STAGES.map((stg, idx) => {
            const Icon = stg.icon;
            const isActive = activeWorkflowStage === idx;
            const isCompleted = idx < activeWorkflowStage;
            return (
              <button
                key={stg.id}
                onClick={() => setActiveWorkflowStage(idx)}
                className={`workflow-node-btn ${isActive ? "pulse-active-ring" : ""}`}
                style={{
                  background: isActive ? "#FFFFFF" : isCompleted ? "#F0FDFA" : "#F8FAFC",
                  border: isActive
                    ? "2px solid var(--primary-teal)"
                    : isCompleted
                    ? "1px solid #99F6E4"
                    : "1px solid var(--border-subtle)",
                  borderRadius: "14px",
                  padding: "1rem 0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  position: "relative",
                  boxShadow: isActive ? "0 8px 24px rgba(0, 159, 154, 0.18)" : "none",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    backgroundColor: isActive ? "var(--primary-teal)" : isCompleted ? "#CCFBF1" : "#E2E8F0",
                    color: isActive ? "#FFFFFF" : isCompleted ? "var(--primary-teal)" : "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "0.6rem",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Icon size={18} />
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: isActive ? "var(--primary-teal)" : "var(--text-muted)",
                    marginBottom: "0.2rem",
                    letterSpacing: "0.03em",
                  }}
                >
                  Stage {stg.step}
                </span>
                <span
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    lineHeight: 1.25,
                  }}
                >
                  {stg.shortName}
                </span>
                {isCompleted && (
                  <span
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "6px",
                      color: "var(--primary-teal)",
                    }}
                  >
                    <CheckCheck size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic Simulated Stage Card */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid var(--border-subtle)",
            borderRadius: "20px",
            boxShadow: "0 12px 35px -5px rgba(11, 23, 48, 0.08)",
            padding: "2.5rem",
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: "2.5rem",
            alignItems: "center",
          }}
        >
          {/* Left Details Panel */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <span
                style={{
                  backgroundColor: "var(--light-teal)",
                  color: "var(--primary-teal)",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  padding: "0.3rem 0.75rem",
                  borderRadius: "20px",
                }}
              >
                Stage {currentStage.step} of 07
              </span>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 600 }}>
                Entity: <strong style={{ color: "var(--text-primary)" }}>{currentStage.entityId}</strong>
              </span>
            </div>

            <h3 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              {currentStage.name}
            </h3>
            <div style={{ fontSize: "1rem", color: "var(--primary-teal)", fontWeight: 700, marginBottom: "1rem" }}>
              {currentStage.tagline}
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", lineHeight: 1.6, marginBottom: "1.75rem" }}>
              {currentStage.description}
            </p>

            {/* Stage KPIs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "1rem",
                padding: "1rem",
                backgroundColor: "var(--bg-elevated)",
                borderRadius: "12px",
                border: "1px solid var(--border-subtle)",
                marginBottom: "1.75rem",
              }}
            >
              {currentStage.metrics.map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Stepper Navigation Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <button
                onClick={() => setActiveWorkflowStage((prev) => Math.min(WORKFLOW_STAGES.length - 1, prev + 1))}
                className="btn btn-primary interactive-cta"
                style={{
                  padding: "0.65rem 1.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                {currentStage.nextAction}
              </button>
              {activeWorkflowStage > 0 && (
                <button
                  onClick={() => setActiveWorkflowStage((prev) => Math.max(0, prev - 1))}
                  style={{
                    padding: "0.65rem 1.25rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    backgroundColor: "transparent",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  ← Previous Stage
                </button>
              )}
            </div>
          </div>

          {/* Right Live Simulated Component Preview */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid var(--border-subtle)",
              borderRadius: "16px",
              boxShadow: "0 10px 30px rgba(11, 23, 48, 0.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                backgroundColor: "#0F172A",
                color: "#FFFFFF",
                padding: "0.875rem 1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.8125rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10B981" }} />
                <span style={{ fontWeight: 700 }}>Live State Simulation</span>
              </div>
              <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>{currentStage.entityId}</span>
            </div>

            <div style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    {currentStage.entityTitle}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    Automated Transaction Pipeline
                  </div>
                </div>
                <span
                  style={{
                    backgroundColor: "#ECFDF5",
                    color: "#059669",
                    border: "1px solid #A7F3D0",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  {currentStage.transitionLabel}
                </span>
              </div>

              {/* Sample Key-Value Attributes */}
              <div
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderRadius: "10px",
                  padding: "1rem",
                  fontSize: "0.8125rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  marginBottom: "1.25rem",
                }}
              >
                {Object.entries(currentStage.sampleData).map(([key, val]) => (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)", textTransform: "capitalize", fontWeight: 600 }}>
                      {key.replace(/([A-Z])/g, " $1")}:
                    </span>
                    <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{val}</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  backgroundColor: "#F8FAFC",
                  border: "1px dashed var(--border-strong)",
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <ShieldCheck size={16} color="var(--primary-teal)" />
                  <span>Automatic ACID Consistency</span>
                </div>
                <span style={{ fontWeight: 700, color: "var(--primary-teal)" }}>PostgreSQL 17</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/* SECTION 2: 9 CRM Modules Bento Grid Explorer (#modules)        */}
      {/* ============================================================= */}
      <section
        id="modules"
        style={{
          padding: "5.5rem 2rem",
          backgroundColor: "var(--bg-page)",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.3rem 0.85rem",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--light-blue)",
                border: "1px solid rgba(0, 159, 227, 0.25)",
                fontSize: "0.75rem",
                color: "var(--primary-blue)",
                fontWeight: 700,
                marginBottom: "1rem",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              <Boxes size={13} />
              <span>Full Product Suite</span>
            </div>
            <h2 className="heading-lg" style={{ fontSize: "2.35rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
              Explore the 9 Comprehensive CRM Modules
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "680px", margin: "0 auto", fontSize: "1.0625rem", lineHeight: 1.6 }}>
              Every component is built for production reliability with relational foreign-key integrity, sub-millisecond query execution, and modern responsive ergonomics.
            </p>

            {/* Category Filter Pills */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginTop: "2rem" }}>
              {[
                { id: "all", label: "All Modules (9)" },
                { id: "sales", label: "Sales & Pipeline (3)" },
                { id: "commerce", label: "Commerce & Billing (4)" },
                { id: "operations", label: "Operations & Platform (2)" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedModuleCategory(cat.id)}
                  className={`category-filter-btn ${selectedModuleCategory === cat.id ? "active" : ""}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 9 Modules Bento Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {filteredModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div key={mod.id} className="bento-card" style={{ padding: "1.75rem", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        backgroundColor: "var(--bg-elevated)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: mod.color,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      }}
                    >
                      <Icon size={24} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          color: "var(--text-secondary)",
                          backgroundColor: "#F1F5F9",
                          padding: "2px 8px",
                          borderRadius: "12px",
                        }}
                      >
                        {mod.categoryName}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          color: "var(--primary-teal)",
                          backgroundColor: "var(--light-teal)",
                          padding: "2px 8px",
                          borderRadius: "12px",
                        }}
                      >
                        {mod.highlightMetric}
                      </span>
                    </div>
                  </div>

                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
                    {mod.title}
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.55, marginBottom: "1.25rem" }}>
                    {mod.shortDesc}
                  </p>

                  {/* Capabilities List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem", flexGrow: 1 }}>
                    {mod.capabilities.map((cap, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                        <CheckCircle2 size={15} color="var(--primary-teal)" style={{ marginTop: "2px", flexShrink: 0 }} />
                        <span>{cap}</span>
                      </div>
                    ))}
                  </div>

                  {/* Interactive Explore Demo Trigger */}
                  <div style={{ paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
                    <button
                      onClick={() => setActiveModuleModal(mod)}
                      style={{
                        width: "100%",
                        padding: "0.65rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "#FFFFFF",
                        color: "var(--primary-teal)",
                        fontWeight: 700,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.4rem",
                        transition: "all 0.18s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--light-teal)";
                        e.currentTarget.style.borderColor = "var(--primary-teal)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#FFFFFF";
                        e.currentTarget.style.borderColor = "var(--border-subtle)";
                      }}
                    >
                      <Play size={14} /> View Live Module Simulation <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/* SECTION 3: Developer API & Webhook Ingestion (#api)            */}
      {/* ============================================================= */}
      <section
        id="api"
        style={{
          padding: "5.5rem 2rem",
          maxWidth: "1280px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.3rem 0.85rem",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--light-teal)",
              border: "1px solid rgba(0, 159, 154, 0.25)",
              fontSize: "0.75rem",
              color: "var(--primary-teal)",
              fontWeight: 700,
              marginBottom: "1rem",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            <Terminal size={13} />
            <span>Developer-First Platform</span>
          </div>
          <h2 className="heading-lg" style={{ fontSize: "2.35rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
            Interactive Developer Hub & API Sandbox
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "680px", margin: "0 auto", fontSize: "1.0625rem", lineHeight: 1.6 }}>
            Directly connect your landing pages, ads, and lead providers. Test real-time webhook deduplication, generate scoped API keys, and copy drop-in code snippets.
          </p>
        </div>

        {/* Developer Console Card */}
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid var(--border-subtle)",
            borderRadius: "20px",
            boxShadow: "0 12px 35px -5px rgba(11, 23, 48, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Navigation Bar inside Console */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 1.5rem",
              backgroundColor: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => setDevConsoleTab("webhook")}
                className={`dev-console-tab ${devConsoleTab === "webhook" ? "active" : ""}`}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Webhook size={15} /> Live Webhook Tester
                </span>
              </button>
              <button
                onClick={() => setDevConsoleTab("apikey")}
                className={`dev-console-tab ${devConsoleTab === "apikey" ? "active" : ""}`}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Key size={15} /> API Keys Generator
                </span>
              </button>
              <button
                onClick={() => setDevConsoleTab("snippets")}
                className={`dev-console-tab ${devConsoleTab === "snippets" ? "active" : ""}`}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Code2 size={15} /> Code Snippets & SDKs
                </span>
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "#059669", fontWeight: 700 }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10B981" }} />
              Go Server: Port 8001 Active
            </div>
          </div>

          {/* Tab 1: Webhook Simulator */}
          {devConsoleTab === "webhook" && (
            <div style={{ padding: "2rem", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "2rem" }}>
              <div>
                <h4 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                  POST /api/webhooks/lead
                </h4>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                  Simulate inbound payload ingestion and observe how the PostgreSQL 17 engine blocks duplicates based on the primary key phone number.
                </p>

                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", display: "block", marginBottom: "0.5rem" }}>
                    Select Test Scenario:
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div
                      onClick={() => setWebhookScenario("new")}
                      style={{
                        padding: "0.85rem",
                        borderRadius: "10px",
                        border: webhookScenario === "new" ? "2px solid var(--primary-teal)" : "1px solid var(--border-subtle)",
                        backgroundColor: webhookScenario === "new" ? "var(--light-teal)" : "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)", marginBottom: "2px" }}>
                        New Inbound Lead
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        Unique phone • Returns HTTP 201 Created
                      </div>
                    </div>
                    <div
                      onClick={() => setWebhookScenario("duplicate")}
                      style={{
                        padding: "0.85rem",
                        borderRadius: "10px",
                        border: webhookScenario === "duplicate" ? "2px solid #EF4444" : "1px solid var(--border-subtle)",
                        backgroundColor: webhookScenario === "duplicate" ? "#FEF2F2" : "#FFFFFF",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#DC2626", marginBottom: "2px" }}>
                        Duplicate Phone Number
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        Existing phone • Returns HTTP 409 Conflict
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSimulateWebhook}
                  disabled={isSimulatingWebhook}
                  className="btn btn-primary interactive-cta"
                  style={{
                    padding: "0.75rem 1.75rem",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  {isSimulatingWebhook ? (
                    <>Sending Test Request...</>
                  ) : (
                    <>
                      <Zap size={16} /> Execute Live Simulation
                    </>
                  )}
                </button>
              </div>

              {/* JSON Response Terminal Preview */}
              <div
                style={{
                  backgroundColor: "#0B132B",
                  borderRadius: "14px",
                  padding: "1.25rem",
                  color: "#E2E8F0",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.8125rem",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "260px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.6rem" }}>
                  <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>Simulated Server Response</span>
                  {webhookResponse && (
                    <span
                      style={{
                        backgroundColor: webhookResponse.status === 201 ? "#065F46" : "#991B1B",
                        color: "#FFFFFF",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                      }}
                    >
                      HTTP {webhookResponse.status} {webhookResponse.statusText} ({webhookResponse.durationMs}ms)
                    </span>
                  )}
                </div>

                <div style={{ flexGrow: 1, overflowX: "auto" }}>
                  {isSimulatingWebhook ? (
                    <div style={{ color: "#38BDF8", padding: "1rem 0" }}>// Dispatching to PostgreSQL pgxpool...</div>
                  ) : webhookResponse ? (
                    <pre style={{ margin: 0 }}>{JSON.stringify(webhookResponse.data, null, 2)}</pre>
                  ) : (
                    <div style={{ color: "#64748B", padding: "1rem 0" }}>
                      // Click "Execute Live Simulation" on the left to test the webhook response.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: API Key Generator */}
          {devConsoleTab === "apikey" && (
            <div style={{ padding: "2rem", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "2rem" }}>
              <div>
                <h4 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                  Scoped API Key Provisioning
                </h4>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                  Generate custom tokens with granular read/write privileges. All keys are hashed using SHA-256 before persistence in PostgreSQL.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
                  {[
                    { scope: "leads:write", desc: "Allow inbound webhook lead submission" },
                    { scope: "leads:read", desc: "Allow query and list leads API" },
                    { scope: "invoices:read", desc: "Allow querying invoices & Maroto PDFs" },
                  ].map((s) => (
                    <div key={s.scope} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <input type="checkbox" defaultChecked id={s.scope} style={{ accentColor: "var(--primary-teal)", width: "16px", height: "16px" }} />
                      <label htmlFor={s.scope} style={{ fontSize: "0.8125rem", color: "var(--text-primary)", fontWeight: 600 }}>
                        <code style={{ color: "var(--primary-teal)" }}>{s.scope}</code> — {s.desc}
                      </label>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      flexGrow: 1,
                      backgroundColor: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                      padding: "0.65rem 1rem",
                      borderRadius: "8px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.8125rem",
                      color: "var(--text-primary)",
                      fontWeight: 600,
                    }}
                  >
                    crm_live_9f83a219bc044a88b7e21a9c4
                  </div>
                  <button
                    onClick={handleCopyApiKey}
                    className="btn btn-primary"
                    style={{ padding: "0.65rem 1.25rem", fontSize: "0.8125rem", fontWeight: 700 }}
                  >
                    {copiedKey ? "Copied!" : <><Copy size={14} /> Copy Key</>}
                  </button>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "14px",
                  padding: "1.5rem",
                }}
              >
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                  Authentication Header Standard
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                  Include your generated key in all HTTP requests under the <code style={{ color: "var(--primary-teal)" }}>X-API-Key</code> or <code style={{ color: "var(--primary-teal)" }}>Authorization</code> header.
                </p>
                <div style={{ backgroundColor: "#0F172A", color: "#F8FAFC", padding: "0.85rem", borderRadius: "8px", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                  Authorization: Bearer crm_live_9f83a219bc...
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Code Snippets */}
          {devConsoleTab === "snippets" && (
            <div style={{ padding: "2rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {(["curl", "fetch", "python", "go"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSnippetLanguage(lang)}
                      style={{
                        padding: "0.4rem 0.85rem",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        border: snippetLanguage === lang ? "1px solid var(--primary-teal)" : "1px solid var(--border-subtle)",
                        backgroundColor: snippetLanguage === lang ? "var(--light-teal)" : "#FFFFFF",
                        color: snippetLanguage === lang ? "var(--primary-teal)" : "var(--text-secondary)",
                        cursor: "pointer",
                        textTransform: "uppercase",
                      }}
                    >
                      {lang}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleCopySnippet(codeSnippets[snippetLanguage])}
                  style={{
                    padding: "0.4rem 0.85rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: "#FFFFFF",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Copy size={13} /> {copiedSnippet ? "Copied!" : "Copy Snippet"}
                </button>
              </div>

              <div
                style={{
                  backgroundColor: "#0B132B",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  color: "#E2E8F0",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.8125rem",
                  overflowX: "auto",
                }}
              >
                <pre style={{ margin: 0 }}>{codeSnippets[snippetLanguage]}</pre>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================= */}
      {/* SECTION 4: Architecture & Technical Stack (#architecture)      */}
      {/* ============================================================= */}
      <section
        id="architecture"
        style={{
          padding: "5.5rem 2rem",
          backgroundColor: "var(--bg-page)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.3rem 0.85rem",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--light-teal)",
                border: "1px solid rgba(0, 159, 154, 0.25)",
                fontSize: "0.75rem",
                color: "var(--primary-teal)",
                fontWeight: 700,
                marginBottom: "1rem",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              <Cpu size={13} />
              <span>Core Engineering Stack</span>
            </div>
            <h2 className="heading-lg" style={{ fontSize: "2.35rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
              Enterprise High-Performance Architecture
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "680px", margin: "0 auto", fontSize: "1.0625rem", lineHeight: 1.6 }}>
              Built from first principles with compiled Go concurrency, native PostgreSQL 17 connection pools, and Maroto v2 document rendering.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
              gap: "1.5rem",
              marginBottom: "3rem",
            }}
          >
            {/* Go Gin Backend */}
            <div className="architecture-card" style={{ borderTop: "4px solid #009F9A" }}>
              <div style={{ color: "#009F9A", marginBottom: "0.85rem" }}>
                <Server size={30} />
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
                Go 1.23 + Gin Web Engine
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.55 }}>
                Sub-millisecond route dispatching with compiled Go routines, non-blocking asynchronous tasks, and pure RESTful API routes.
              </p>
              <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--primary-teal)", fontWeight: 700 }}>
                Average Latency: ~1.8ms
              </div>
            </div>

            {/* PostgreSQL 17 */}
            <div className="architecture-card" style={{ borderTop: "4px solid #009FE3" }}>
              <div style={{ color: "#009FE3", marginBottom: "0.85rem" }}>
                <Database size={30} />
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
                PostgreSQL 17 + pgxpool
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.55 }}>
                ACID transactional guarantees, foreign-key cascade integrity, and indexed uniqueness checks preventing duplicate leads.
              </p>
              <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--primary-blue)", fontWeight: 700 }}>
                High-Concurrency Pooling
              </div>
            </div>

            {/* Maroto v2 Engine */}
            <div className="architecture-card" style={{ borderTop: "4px solid #8B5CF6" }}>
              <div style={{ color: "#8B5CF6", marginBottom: "0.85rem" }}>
                <FileCheck size={30} />
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
                Maroto v2 PDF Generator
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.55 }}>
                Native Go PDF compilation without Chromium or headless browser overhead. Renders Quotations, Invoices, and Receipts in &lt;350ms.
              </p>
              <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#8B5CF6", fontWeight: 700 }}>
                Unicode Rupee (₹) & Standard A4
              </div>
            </div>

            {/* Next.js 14 & Glassmorphism */}
            <div className="architecture-card" style={{ borderTop: "4px solid #F59E0B" }}>
              <div style={{ color: "#F59E0B", marginBottom: "0.85rem" }}>
                <LayoutDashboard size={30} />
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
                Next.js 14 Responsive UI
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.55 }}>
                Zero bloated styling frameworks. Clean Vanilla CSS tokens, glassmorphic preview windows, and smooth touch-optimized responsiveness.
              </p>
              <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#D97706", fontWeight: 700 }}>
                100% Mobile & Desktop Ready
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/* SECTION 5: Enterprise Call To Action & Footer                  */}
      {/* ============================================================= */}
      <section
        style={{
          padding: "5rem 2rem",
          background: "linear-gradient(135deg, #0B1730 0%, #0F2A4A 100%)",
          color: "#FFFFFF",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "1rem", letterSpacing: "-0.03em" }}>
            Experience the Unified Enterprise CRM
          </h2>
          <p style={{ fontSize: "1.125rem", color: "#94A3B8", lineHeight: 1.6, marginBottom: "2.25rem" }}>
            Access all 9 modules, test the real-time webhook ingestion engine, generate GST tax invoices, and streamline your operations in one platform.
          </p>

          <Link
            href={isAuthenticated ? "/dashboard" : "/login"}
            className="btn btn-primary interactive-cta"
            style={{
              padding: "0.95rem 2.5rem",
              fontSize: "1.0625rem",
              fontWeight: 800,
              backgroundColor: "var(--primary-teal)",
              color: "#FFFFFF",
              borderRadius: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              boxShadow: "0 6px 20px rgba(0, 159, 154, 0.4)",
            }}
          >
            {isAuthenticated ? (
              <>
                <LayoutDashboard size={20} /> Open Live CRM Dashboard <ArrowRight size={18} />
              </>
            ) : (
              <>
                <LogIn size={20} /> Sign In to Live CRM Workspace <ArrowRight size={18} />
              </>
            )}
          </Link>
        </div>
      </section>

      {/* Clean Global Footer */}
      <footer
        style={{
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid var(--border-subtle)",
          padding: "3rem 2rem 2rem",
          color: "var(--text-secondary)",
          fontSize: "0.875rem",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1.5fr repeat(3, 1fr)",
            gap: "2.5rem",
            marginBottom: "2.5rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.75rem" }}>
              <div
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "7px",
                  background: "linear-gradient(135deg, var(--primary-teal) 0%, var(--primary-blue) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "0.9375rem",
                }}
              >
                C
              </div>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                CRM
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", lineHeight: 1.6, maxWidth: "320px" }}>
              Universal Lead, Sales Pipeline, Warehouse Inventory, and GST Billing Platform. Built with Next.js 14, Go (Gin), PostgreSQL 17, and Maroto v2.
            </p>
          </div>

          <div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem", fontSize: "0.875rem" }}>
              Sales & Pipeline
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              <a href="#workflow" onClick={(e) => scrollToSection(e, "workflow")} className="nav-link-hover">Lead Ingestion</a>
              <a href="#workflow" onClick={(e) => scrollToSection(e, "workflow")} className="nav-link-hover">Deals & Pipelines</a>
              <a href="#modules" onClick={(e) => scrollToSection(e, "modules")} className="nav-link-hover">Customer Directory</a>
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem", fontSize: "0.875rem" }}>
              Billing & Operations
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              <a href="#modules" onClick={(e) => scrollToSection(e, "modules")} className="nav-link-hover">Commercial Quotations</a>
              <a href="#modules" onClick={(e) => scrollToSection(e, "modules")} className="nav-link-hover">Sales Orders & Fulfillment</a>
              <a href="#modules" onClick={(e) => scrollToSection(e, "modules")} className="nav-link-hover">Warehouse Inventory</a>
              <a href="#modules" onClick={(e) => scrollToSection(e, "modules")} className="nav-link-hover">GST Tax Invoices & Receipts</a>
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem", fontSize: "0.875rem" }}>
              Developers & Security
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
              <a href="#api" onClick={(e) => scrollToSection(e, "api")} className="nav-link-hover">Generic Webhook API</a>
              <a href="#api" onClick={(e) => scrollToSection(e, "api")} className="nav-link-hover">Scoped API Keys</a>
              <a href="#architecture" onClick={(e) => scrollToSection(e, "architecture")} className="nav-link-hover">Architecture Specs</a>
              <Link href="/login" className="nav-link-hover">JWT Authentication</Link>
            </div>
          </div>
        </div>

        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}
        >
          <div>
            © 2026 CRM Enterprise Solutions. All rights reserved.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span>Go 1.23 • PostgreSQL 17 • Maroto v2 • Next.js 14</span>
          </div>
        </div>
      </footer>

      {/* ============================================================= */}
      {/* Interactive Module Live Preview Modal                           */}
      {/* ============================================================= */}
      {activeModuleModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            backgroundColor: "rgba(11, 23, 48, 0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setActiveModuleModal(null)}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "18px",
              maxWidth: "560px",
              width: "100%",
              boxShadow: "0 25px 60px -15px rgba(0,0,0,0.3)",
              border: "1px solid var(--border-subtle)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "var(--bg-elevated)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "9px",
                    backgroundColor: "#FFFFFF",
                    color: activeModuleModal.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  }}
                >
                  <activeModuleModal.icon size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    {activeModuleModal.title}
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {activeModuleModal.categoryName} • Production Component
                  </span>
                </div>
              </div>

              <button
                onClick={() => setActiveModuleModal(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "4px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1.25rem", lineHeight: 1.55 }}>
                {activeModuleModal.shortDesc}
              </div>

              {/* Simulated Record Card */}
              <div
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "1.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 800, color: "var(--text-primary)" }}>
                    {activeModuleModal.demoPreview.entity}
                  </span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      backgroundColor: "var(--light-teal)",
                      color: "var(--primary-teal)",
                      padding: "2px 8px",
                      borderRadius: "10px",
                    }}
                  >
                    PostgreSQL Record
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", fontSize: "0.8125rem" }}>
                  <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{activeModuleModal.demoPreview.field1}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{activeModuleModal.demoPreview.field2}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{activeModuleModal.demoPreview.field3}</div>
                  <div style={{ color: "var(--primary-teal)", fontWeight: 700 }}>{activeModuleModal.demoPreview.field4}</div>
                </div>
              </div>

              {/* Module Capabilities */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Built-In Features:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {activeModuleModal.capabilities.map((cap, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                      <CheckCircle2 size={14} color="var(--primary-teal)" />
                      <span>{cap}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <Link
                  href={isAuthenticated ? "/dashboard" : "/login"}
                  className="btn btn-primary interactive-cta"
                  style={{
                    flex: 1,
                    padding: "0.65rem 1rem",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <ExternalLink size={15} /> Access Live Module in App
                </Link>
                <button
                  onClick={() => setActiveModuleModal(null)}
                  style={{
                    padding: "0.65rem 1rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    backgroundColor: "transparent",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
