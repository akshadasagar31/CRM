"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Code,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Zap,
  Layers,
  ArrowRight,
  Database,
  Filter,
  Users,
  Calendar,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileText,
  Webhook,
  Key,
  Search,
  Globe,
  Settings,
  RefreshCw,
} from "lucide-react";
import { getApiBaseUrl, getToken, copyTextToClipboard } from "@/lib/api";

interface EndpointDef {
  id: string;
  category: "leads" | "bulk" | "interactions" | "metadata" | "webhooks" | "apikeys";
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  path: string;
  title: string;
  description: string;
  auth: "Bearer Token" | "API Key" | "Bearer or API Key" | "None";
  queryParams?: { name: string; type: string; required?: boolean; description: string }[];
  requestBody?: {
    contentType: string;
    example: any;
    schemaNotes?: string;
  };
  responseExample: {
    status: number;
    body: any;
  };
}

const ENDPOINTS: EndpointDef[] = [
  // --- LEADS CORE ---
  {
    id: "create-lead",
    category: "leads",
    method: "POST",
    path: "/api/leads",
    title: "Create Lead",
    description: "Create a new lead with duplicate checking (phone & email), phone normalization, custom field values, and automated timeline activity recording.",
    auth: "Bearer Token",
    requestBody: {
      contentType: "application/json",
      example: {
        number: "+1-555-829-4011",
        name: "Acme Enterprise Corp",
        email: "contact@acme.io",
        phone: "+1 (555) 829-4011",
        requirement: "Enterprise Universal CRM implementation for 120 sales reps",
        source: "Website",
        city: "San Francisco",
        status: "New",
        owner_id: 1,
        score: 85,
        tags: ["Hot", "VIP", "Enterprise"],
        follow_up_date: "2026-10-15T14:30:00Z",
        follow_up_type: "Meeting",
        follow_up_notes: "Schedule solution demo with VP of Operations",
        custom_fields: {
          industry: "Technology",
          budget: "$50,000",
          company_size: "51-200",
          preferred_contact_method: "WhatsApp"
        }
      },
      schemaNotes: "Enforces duplicate detection rules. Returns 409 Conflict if duplicate phone or email exists."
    },
    responseExample: {
      status: 201,
      body: {
        number: "+15558294011",
        name: "Acme Enterprise Corp",
        email: "contact@acme.io",
        phone: "+15558294011",
        requirement: "Enterprise Universal CRM implementation for 120 sales reps",
        source: "Website",
        city: "San Francisco",
        status: "New",
        owner_id: 1,
        score: 85,
        lost_reason: null,
        tags: ["Hot", "VIP", "Enterprise"],
        follow_up_date: "2026-10-15T14:30:00Z",
        follow_up_type: "Meeting",
        follow_up_notes: "Schedule solution demo with VP of Operations",
        follow_up_completed: false,
        notes_count: 0,
        last_activity_at: "2026-10-06T16:50:00Z",
        lead_age_days: 0,
        custom_fields: {
          industry: "Technology",
          budget: "$50,000",
          company_size: "51-200",
          preferred_contact_method: "WhatsApp"
        },
        created_at: "2026-10-06T16:50:00Z",
        updated_at: "2026-10-06T16:50:00Z"
      }
    }
  },
  {
    id: "get-leads",
    category: "leads",
    method: "GET",
    path: "/api/leads",
    title: "List & Search Leads",
    description: "Search across name, phone, email, city, requirement, tags, and custom fields. Supports server-side pagination, multi-criteria filtering, and saved views counters.",
    auth: "Bearer Token",
    queryParams: [
      { name: "search", type: "string", description: "Search query across core and visible custom fields" },
      { name: "source", type: "string", description: "Filter by lead source (Website, WhatsApp, Social Media, etc.)" },
      { name: "status", type: "string", description: "Filter by status (New, Contacted, Qualified, Won, Lost, etc.)" },
      { name: "owner_id", type: "integer", description: "Filter by owner user ID (0 = Unassigned)" },
      { name: "tag", type: "string", description: "Filter by tag keyword (e.g. Hot, VIP)" },
      { name: "follow_up_status", type: "string", description: "Filter follow-ups: overdue, due_today, pending, completed" },
      { name: "view", type: "string", description: "Predefined views: all, my_leads, unassigned, hot_leads, today_followups, overdue_followups, trash" },
      { name: "include_deleted", type: "boolean", description: "Include soft-deleted records (default false)" },
      { name: "sort_by", type: "string", description: "Field to sort by (created_at, name, score, last_activity_at)" },
      { name: "sort_order", type: "string", description: "Sort direction: asc or desc (default desc)" },
      { name: "page", type: "integer", description: "Page number (1-based, default 1)" },
      { name: "limit", type: "integer", description: "Items per page (max 100, default 50)" }
    ],
    responseExample: {
      status: 200,
      body: {
        items: [
          {
            number: "+15558294011",
            name: "Acme Enterprise Corp",
            email: "contact@acme.io",
            phone: "+15558294011",
            status: "New",
            source: "Website",
            score: 85,
            lead_age_days: 2,
            tags: ["Hot", "VIP"]
          }
        ],
        total: 48,
        page: 1,
        limit: 50,
        pages: 1,
        view_counts: {
          all: 48,
          my_leads: 19,
          unassigned: 12,
          hot_leads: 15,
          today_followups: 4,
          overdue_followups: 2,
          trash: 3
        }
      }
    }
  },
  {
    id: "get-lead-by-number",
    category: "leads",
    method: "GET",
    path: "/api/leads/{number}",
    title: "Get Lead Details",
    description: "Fetch comprehensive lead details including resolved custom fields, owner summary, follow-up state, and notes count.",
    auth: "Bearer Token",
    responseExample: {
      status: 200,
      body: {
        number: "+15558294011",
        name: "Acme Enterprise Corp",
        email: "contact@acme.io",
        phone: "+15558294011",
        requirement: "Enterprise CRM Implementation",
        source: "Website",
        city: "San Francisco",
        status: "Qualified",
        score: 85,
        owner: { id: 1, name: "Alex Morgan", email: "alex@crm.com" },
        custom_fields: { industry: "Technology", budget: "$50,000" },
        custom_field_details: [
          { field_key: "industry", field_label: "Industry", field_type: "Dropdown", value: "Technology" },
          { field_key: "budget", field_label: "Estimated Budget", field_type: "Currency", value: "$50,000" }
        ],
        created_at: "2026-10-06T16:50:00Z"
      }
    }
  },
  {
    id: "patch-lead",
    category: "leads",
    method: "PATCH",
    path: "/api/leads/{number}",
    title: "Update Lead",
    description: "Update core details, custom fields, score, lost reason, status, or owner. Automatically logs audit timeline entries for status changes and reassignments.",
    auth: "Bearer Token",
    requestBody: {
      contentType: "application/json",
      example: {
        status: "Lost",
        lost_reason: "Selected competitor with local hardware presence",
        score: 30,
        custom_fields: {
          budget: "$25,000"
        }
      }
    },
    responseExample: {
      status: 200,
      body: {
        number: "+15558294011",
        status: "Lost",
        lost_reason: "Selected competitor with local hardware presence",
        score: 30,
        last_activity_at: "2026-10-06T17:15:00Z"
      }
    }
  },
  {
    id: "delete-lead",
    category: "leads",
    method: "DELETE",
    path: "/api/leads/{number}",
    title: "Soft Delete Lead",
    description: "Soft deletes the lead to Trash by recording a deleted_at timestamp. Pass ?permanent=true to permanently destroy the lead and its associated relations.",
    auth: "Bearer Token",
    queryParams: [
      { name: "permanent", type: "boolean", description: "Set to true to bypass trash and delete permanently" }
    ],
    responseExample: {
      status: 200,
      body: {
        success: true,
        message: "Lead '+15558294011' has been moved to trash."
      }
    }
  },
  {
    id: "restore-lead",
    category: "leads",
    method: "POST",
    path: "/api/leads/{number}/restore",
    title: "Restore Soft-Deleted Lead",
    description: "Recovers a soft-deleted lead from Trash back into the active lead workspace.",
    auth: "Bearer Token",
    responseExample: {
      status: 200,
      body: {
        success: true,
        message: "Lead '+15558294011' restored successfully."
      }
    }
  },

  // --- BULK & IMPORT/EXPORT ---
  {
    id: "bulk-actions",
    category: "bulk",
    method: "PATCH",
    path: "/api/leads/bulk",
    title: "Bulk Lead Actions",
    description: "Execute bulk operations across multiple leads simultaneously (status updates, owner transfers, adding tags, soft deletion, or restoration).",
    auth: "Bearer Token",
    requestBody: {
      contentType: "application/json",
      example: {
        lead_numbers: ["+15558294011", "+15552345678", "+15559876543"],
        action: "update_status",
        status: "Qualified"
      }
    },
    responseExample: {
      status: 200,
      body: {
        success: true,
        affected_count: 3,
        message: "Bulk action 'update_status' applied to 3 leads."
      }
    }
  },
  {
    id: "import-leads",
    category: "bulk",
    method: "POST",
    path: "/api/leads/import",
    title: "Import Leads (CSV / JSON)",
    description: "Batch import leads with duplicate resolution strategy ('skip', 'update', or 'error') and dynamic custom field mapping.",
    auth: "Bearer Token",
    requestBody: {
      contentType: "application/json",
      example: {
        duplicate_strategy: "skip",
        leads: [
          {
            number: "+1-555-101-2001",
            name: "CloudScale Inc",
            email: "growth@cloudscale.net",
            city: "Seattle",
            requirement: "Needs multi-channel CRM integration",
            source: "CSV Import",
            industry: "Technology",
            budget: "$40,000"
          }
        ]
      }
    },
    responseExample: {
      status: 200,
      body: {
        success: true,
        total_processed: 1,
        imported_count: 1,
        skipped_count: 0,
        updated_count: 0,
        errors: []
      }
    }
  },
  {
    id: "export-leads",
    category: "bulk",
    method: "GET",
    path: "/api/leads/export",
    title: "Export Leads CSV",
    description: "Generates a clean CSV download of leads honoring active search queries, status filters, and owners.",
    auth: "Bearer Token",
    responseExample: {
      status: 200,
      body: "CSV File Download (Content-Type: text/csv, attachment; filename=leads_export.csv)"
    }
  },

  // --- INTERACTIONS & TIMELINE ---
  {
    id: "lead-notes",
    category: "interactions",
    method: "POST",
    path: "/api/leads/{number}/notes",
    title: "Add Internal Note",
    description: "Appends a timestamped internal note authored by current user and generates a timeline entry.",
    auth: "Bearer Token",
    requestBody: {
      contentType: "application/json",
      example: {
        content: "Spoke with Procurement. Master Services Agreement approved. Expecting signature Friday."
      }
    },
    responseExample: {
      status: 201,
      body: {
        id: 12,
        lead_number: "+15558294011",
        content: "Spoke with Procurement. Master Services Agreement approved. Expecting signature Friday.",
        user: { id: 1, name: "Alex Morgan" },
        created_at: "2026-10-06T17:30:00Z"
      }
    }
  },
  {
    id: "lead-followups",
    category: "interactions",
    method: "POST",
    path: "/api/leads/{number}/follow-ups",
    title: "Schedule Follow-up Task",
    description: "Creates a structured follow-up task (Call, Email, Meeting, Demo, WhatsApp) and syncs lead next_follow_up date.",
    auth: "Bearer Token",
    requestBody: {
      contentType: "application/json",
      example: {
        title: "Proposal Review Call",
        follow_up_type: "Call",
        due_date: "2026-10-14T15:00:00Z",
        notes: "Present customized SLA tier options"
      }
    },
    responseExample: {
      status: 201,
      body: {
        id: 7,
        lead_number: "+15558294011",
        title: "Proposal Review Call",
        follow_up_type: "Call",
        due_date: "2026-10-14T15:00:00Z",
        completed: false,
        reminder_state: "pending",
        created_at: "2026-10-06T17:35:00Z"
      }
    }
  },
  {
    id: "lead-activities",
    category: "interactions",
    method: "GET",
    path: "/api/leads/{number}/activities",
    title: "Get Lead Activity Timeline",
    description: "Retrieve chronological audit trail of all actions on this lead: lead created, status changes, reassignments, notes added, follow-ups scheduled/completed.",
    auth: "Bearer Token",
    responseExample: {
      status: 200,
      body: [
        {
          id: 42,
          lead_number: "+15558294011",
          activity_type: "status_change",
          title: "Status Changed: Qualified",
          description: "Status updated from 'New' to 'Qualified' by Alex Morgan",
          created_at: "2026-10-06T17:15:00Z"
        },
        {
          id: 39,
          activity_type: "lead_created",
          title: "Lead Created",
          description: "Created via Website by Alex Morgan",
          created_at: "2026-10-06T16:50:00Z"
        }
      ]
    }
  },

  // --- CONFIGURATION & METADATA ---
  {
    id: "custom-fields",
    category: "metadata",
    method: "GET",
    path: "/api/leads/custom-fields",
    title: "Get Custom Field Definitions",
    description: "List all dynamic custom fields defined for this workspace (Text, Long Text, Number, Currency, Phone, Email, Date, Dropdown, Multi-select, Checkbox, URL).",
    auth: "Bearer Token",
    responseExample: {
      status: 200,
      body: [
        {
          id: 1,
          field_key: "industry",
          field_label: "Industry",
          field_type: "Dropdown",
          options: ["Technology", "Real Estate", "Healthcare", "Education", "Travel", "Retail", "Other"],
          required: false,
          visibility: true,
          field_order: 1,
          section: "Business Profile"
        },
        {
          id: 2,
          field_key: "budget",
          field_label: "Estimated Budget",
          field_type: "Currency",
          options: [],
          required: false,
          visibility: true,
          field_order: 2,
          section: "Deal Details"
        }
      ]
    }
  },
  {
    id: "create-custom-field",
    category: "metadata",
    method: "POST",
    path: "/api/leads/custom-fields",
    title: "Create Custom Field",
    description: "Add a business-specific custom field dynamically without database schema migrations.",
    auth: "Bearer Token",
    requestBody: {
      contentType: "application/json",
      example: {
        field_key: "lead_qualification_score_tier",
        field_label: "Qualification Tier",
        field_type: "Dropdown",
        options: ["Tier 1 - Enterprise", "Tier 2 - Commercial", "Tier 3 - SMB"],
        required: false,
        visibility: true,
        field_order: 5,
        section: "Qualification"
      }
    },
    responseExample: {
      status: 201,
      body: {
        id: 7,
        field_key: "lead_qualification_score_tier",
        field_label: "Qualification Tier",
        field_type: "Dropdown"
      }
    }
  },
  {
    id: "duplicate-rules",
    category: "metadata",
    method: "GET",
    path: "/api/leads/settings/duplicates",
    title: "Get Duplicate Rules",
    description: "Inspect the duplicate check configuration (check_phone, check_email, action: 'prevent' | 'warn').",
    auth: "Bearer Token",
    responseExample: {
      status: 200,
      body: {
        check_phone: true,
        check_email: true,
        action: "prevent"
      }
    }
  },

  // --- WEBHOOKS & INGESTION ---
  {
    id: "webhook-lead",
    category: "webhooks",
    method: "POST",
    path: "/api/webhooks/lead",
    title: "Ingest Lead Webhook",
    description: "Public lead ingestion endpoint for Website forms, WhatsApp chatbots, Facebook Lead Ads, or Zapier. Authenticates via Bearer API Key header.",
    auth: "API Key",
    requestBody: {
      contentType: "application/json",
      example: {
        phone: "+1-555-443-8899",
        name: "Samantha Wright",
        email: "samantha@wrightventures.com",
        city: "Austin",
        requirement: "Looking for real-time lead webhook integration with CRM",
        source: "WhatsApp",
        custom_fields: {
          industry: "Real Estate",
          budget: "$120,000"
        }
      },
      schemaNotes: "Accepts alternative key aliases: phone / number / mobile / contact, name / full_name, etc. Enforces duplicate check and records lead.created timeline event."
    },
    responseExample: {
      status: 201,
      body: {
        success: true,
        message: "Lead successfully captured and saved from 'WhatsApp'.",
        lead: {
          number: "+15554438899",
          name: "Samantha Wright",
          email: "samantha@wrightventures.com",
          source: "WhatsApp",
          status: "New"
        }
      }
    }
  },

  // --- API KEYS ---
  {
    id: "api-keys-list",
    category: "apikeys",
    method: "GET",
    path: "/api/api-keys",
    title: "List API Keys",
    description: "View all provisioned API keys with usage tracking, masked suffixes, and expiration states.",
    auth: "Bearer Token",
    responseExample: {
      status: 200,
      body: [
        {
          id: 1,
          name: "Website Form Webhook Key",
          masked_key: "crm_live_...9aB2",
          key_prefix: "crm_live_",
          key_suffix: "9aB2",
          status: "active",
          expires_at: "2026-11-06T00:00:00Z",
          last_used_at: "2026-10-06T16:51:32Z"
        }
      ]
    }
  },
  {
    id: "create-api-key",
    category: "apikeys",
    method: "POST",
    path: "/api/api-keys",
    title: "Generate API Key",
    description: "Creates a new cryptographically secure SHA-256 hashed API key. The plaintext key is revealed strictly ONCE in this response.",
    auth: "Bearer Token",
    requestBody: {
      contentType: "application/json",
      example: {
        name: "Zapier Lead Sync",
        expiry: "90_days"
      }
    },
    responseExample: {
      status: 201,
      body: {
        id: 2,
        name: "Zapier Lead Sync",
        api_key: "crm_live_aBcDeFg123456789...",
        masked_key: "crm_live_...789",
        status: "active",
        expires_at: "2027-01-04T00:00:00Z"
      }
    }
  }
];

export default function ApiDocumentationPage({
  hideNavbar = false,
}: {
  hideNavbar?: boolean;
} = {}) {
  const router = useRouter();
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>("create-lead");
  const [selectedLanguage, setSelectedLanguage] = useState<"curl" | "javascript" | "python">("curl");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Playground state
  const [playgroundApiKey, setPlaygroundApiKey] = useState<string>("");
  const [playgroundResponse, setPlaygroundResponse] = useState<any>(null);
  const [playgroundLoading, setPlaygroundLoading] = useState<boolean>(false);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>("http://localhost:8000/api");
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    if (!hideNavbar) {
      router.replace("/leads?tab=api-docs");
      return;
    }
    setApiBaseUrl(getApiBaseUrl());
    // Check health
    fetch(`${getApiBaseUrl()}/health`)
      .then((res) => res.json())
      .then(() => setBackendHealthy(true))
      .catch(() => setBackendHealthy(false));
  }, [router, hideNavbar]);

  const selectedEndpoint = ENDPOINTS.find((e) => e.id === selectedEndpointId) || ENDPOINTS[0];

  const filteredEndpoints = ENDPOINTS.filter((e) => {
    const matchesCat = activeCategory === "all" || e.category === activeCategory;
    const matchesSearch =
      e.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      e.path.toLowerCase().includes(searchFilter.toLowerCase()) ||
      e.description.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCopy = (text: string, id: string) => {
    copyTextToClipboard(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const generateSnippet = (endpoint: EndpointDef, lang: "curl" | "javascript" | "python"): string => {
    const fullUrl = `${apiBaseUrl}${endpoint.path.replace("/api", "")}`;
    const tokenHeader =
      endpoint.auth === "API Key"
        ? 'Authorization: Bearer <YOUR_API_KEY>'
        : 'Authorization: Bearer <YOUR_JWT_TOKEN>';

    if (lang === "curl") {
      let code = `curl -X ${endpoint.method} "${fullUrl}" \\\n  -H "Content-Type: application/json" \\\n  -H "${tokenHeader}"`;
      if (endpoint.requestBody?.example) {
        code += ` \\\n  -d '${JSON.stringify(endpoint.requestBody.example, null, 2)}'`;
      }
      return code;
    }

    if (lang === "javascript") {
      const bodyStr = endpoint.requestBody?.example
        ? `,\n  body: JSON.stringify(${JSON.stringify(endpoint.requestBody.example, null, 4)})`
        : "";
      return `const response = await fetch("${fullUrl}", {
  method: "${endpoint.method}",
  headers: {
    "Content-Type": "application/json",
    "${endpoint.auth === "API Key" ? "Authorization" : "Authorization"}": "${
        endpoint.auth === "API Key" ? "Bearer <YOUR_API_KEY>" : "Bearer <YOUR_JWT_TOKEN>"
      }"
  }${bodyStr}
});
const data = await response.json();
console.log(data);`;
    }

    if (lang === "python") {
      const jsonStr = endpoint.requestBody?.example
        ? `,\n    json=${JSON.stringify(endpoint.requestBody.example, null, 4).replace(/true/g, "True").replace(/false/g, "False").replace(/null/g, "None")}`
        : "";
      return `import requests

url = "${fullUrl}"
headers = {
    "Content-Type": "application/json",
    "Authorization": "${endpoint.auth === "API Key" ? "Bearer <YOUR_API_KEY>" : "Bearer <YOUR_JWT_TOKEN>"}"
}

response = requests.${endpoint.method.toLowerCase()}(
    url,
    headers=headers${jsonStr}
)
print(response.json())`;
    }

    return "";
  };

  const runPlaygroundTest = async () => {
    setPlaygroundLoading(true);
    setPlaygroundResponse(null);
    try {
      const fullUrl = `${apiBaseUrl}${selectedEndpoint.path.replace("/api", "")}`;
      const token = playgroundApiKey || getToken() || "";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(fullUrl, {
        method: selectedEndpoint.method,
        headers,
        body:
          selectedEndpoint.method !== "GET" && selectedEndpoint.requestBody?.example
            ? JSON.stringify(selectedEndpoint.requestBody.example)
            : undefined,
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = await res.text();
      }

      setPlaygroundResponse({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        data,
      });
    } catch (err: any) {
      setPlaygroundResponse({
        status: 0,
        ok: false,
        data: { error: err.message || "Network request failed" },
      });
    } finally {
      setPlaygroundLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary, #F8FAFC)", color: "var(--text-primary, #0F172A)" }}>
      {/* Top Navbar */}
      {!hideNavbar && (
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle, #E2E8F0)",
          backgroundColor: "#FFFFFF",
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            maxWidth: "1440px",
            margin: "0 auto",
            padding: "0.875rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #0D9488 0%, #2563EB 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "1rem",
                }}
              >
                C
              </div>
              <div>
                <span style={{ fontSize: "1.25rem", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.02em" }}>
                  BizCopilot CRM
                </span>
                <span
                  style={{
                    marginLeft: "0.5rem",
                    padding: "0.125rem 0.5rem",
                    borderRadius: "999px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    backgroundColor: "#EEF2FF",
                    color: "#4F46E5",
                  }}
                >
                  Universal API v2.0
                </span>
              </div>
            </Link>

            <div style={{ height: "20px", width: "1px", backgroundColor: "#E2E8F0", margin: "0 0.5rem" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: backendHealthy === true ? "#10B981" : backendHealthy === false ? "#EF4444" : "#F59E0B",
                }}
              />
              <span style={{ fontSize: "0.8125rem", color: "#64748B", fontWeight: 500 }}>
                {backendHealthy === true ? "Backend Operational (Port 8000)" : backendHealthy === false ? "Backend Offline" : "Connecting..."}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#475569",
                textDecoration: "none",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #E2E8F0",
              }}
            >
              OpenAPI / Swagger <ExternalLink size={14} />
            </a>

            <Link
              href="/api-keys"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#475569",
                textDecoration: "none",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #E2E8F0",
              }}
            >
              <Key size={14} /> API Keys
            </Link>

            <Link
              href="/leads"
              className="btn btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                backgroundColor: "#0D9488",
                color: "#FFFFFF",
                textDecoration: "none",
              }}
            >
              Back to Leads Dashboard <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>
      )}

      {/* Hero Overview */}
      <div style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #E2E8F0", padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: "1440px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#0D9488",
                    backgroundColor: "#CCFBF1",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "4px",
                  }}
                >
                  Universal Lead Management API
                </span>
                <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>Phase 1 Complete Reference</span>
              </div>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#0F172A", margin: "0 0 0.5rem 0", letterSpacing: "-0.03em" }}>
                Lead API Documentation & Endpoint Reference
              </h1>
              <p style={{ fontSize: "1rem", color: "#64748B", maxWidth: "800px", margin: 0, lineHeight: 1.6 }}>
                Integrate any business workflow with Universal CRM. Features dynamic industry custom fields, phone/email duplicate protection, multi-channel webhook ingestion, automated audit timeline logging, and complete bulk management.
              </p>
            </div>

            <div
              style={{
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "1rem 1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                minWidth: "260px",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Base Endpoint URL
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  padding: "0.375rem 0.625rem",
                  fontFamily: "monospace",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#0F172A",
                }}
              >
                <span>{apiBaseUrl}</span>
                <button
                  onClick={() => handleCopy(apiBaseUrl, "base-url")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "2px" }}
                  title="Copy base URL"
                >
                  {copiedKey === "base-url" ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                </button>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Auth: <code style={{ backgroundColor: "#F1F5F9", padding: "2px 4px", borderRadius: "3px" }}>Bearer &lt;token&gt;</code> or <code style={{ backgroundColor: "#F1F5F9", padding: "2px 4px", borderRadius: "3px" }}>crm_live_*</code>
              </div>
            </div>
          </div>

          {/* Quick Capability Pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.75rem" }}>
            {[
              { icon: Database, label: "Universal Data Model" },
              { icon: Layers, label: "Dynamic Custom Fields" },
              { icon: Shield, label: "Smart Duplicate Prevention" },
              { icon: Calendar, label: "Follow-ups & Reminders" },
              { icon: Zap, label: "Audit Timeline Events" },
              { icon: Webhook, label: "Multi-channel Webhooks" },
              { icon: Filter, label: "Saved Views & Filters" },
            ].map((feature, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#334155",
                  backgroundColor: "#F1F5F9",
                  padding: "0.375rem 0.75rem",
                  borderRadius: "999px",
                }}
              >
                <feature.icon size={14} color="#0D9488" />
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content: Left Endpoints Navigation & Right Documentation Details */}
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "1.5rem", display: "grid", gridTemplateColumns: "340px 1fr", gap: "1.5rem" }}>
        {/* Left Sidebar */}
        <aside
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            height: "fit-content",
            position: "sticky",
            top: "80px",
          }}
        >
          {/* Search Endpoints */}
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input
              type="text"
              placeholder="Search endpoints..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.5rem 0.5rem 2rem",
                fontSize: "0.8125rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                outline: "none",
              }}
            />
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {[
              { id: "all", label: "All" },
              { id: "leads", label: "Core Leads" },
              { id: "bulk", label: "Bulk / Import" },
              { id: "interactions", label: "Interactions" },
              { id: "metadata", label: "Custom Fields" },
              { id: "webhooks", label: "Webhooks" },
              { id: "apikeys", label: "API Keys" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: "0.25rem 0.625rem",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: activeCategory === cat.id ? "#0D9488" : "#F1F5F9",
                  color: activeCategory === cat.id ? "#FFFFFF" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Endpoints List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
            {filteredEndpoints.map((ep) => {
              const isSelected = ep.id === selectedEndpointId;
              const methodColor =
                ep.method === "GET"
                  ? "#2563EB"
                  : ep.method === "POST"
                  ? "#059669"
                  : ep.method === "PATCH" || ep.method === "PUT"
                  ? "#D97706"
                  : "#DC2626";

              return (
                <button
                  key={ep.id}
                  onClick={() => setSelectedEndpointId(ep.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                    padding: "0.625rem 0.75rem",
                    borderRadius: "8px",
                    border: isSelected ? "1px solid #0D9488" : "1px solid transparent",
                    backgroundColor: isSelected ? "#F0FDFA" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 800,
                      padding: "0.15rem 0.4rem",
                      borderRadius: "4px",
                      backgroundColor: isSelected ? methodColor : "#F1F5F9",
                      color: isSelected ? "#FFFFFF" : methodColor,
                      minWidth: "48px",
                      textAlign: "center",
                      fontFamily: "monospace",
                    }}
                  >
                    {ep.method}
                  </span>
                  <div style={{ overflow: "hidden" }}>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: isSelected ? 700 : 600,
                        color: isSelected ? "#0F172A" : "#334155",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    >
                      {ep.title}
                    </div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "#64748B",
                        fontFamily: "monospace",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    >
                      {ep.path}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Main Details */}
        <main style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Endpoint Details Card */}
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "1.75rem" }}>
            {/* Header info */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.5rem" }}>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 800,
                      padding: "0.25rem 0.625rem",
                      borderRadius: "6px",
                      fontFamily: "monospace",
                      backgroundColor:
                        selectedEndpoint.method === "GET"
                          ? "#DBEAFE"
                          : selectedEndpoint.method === "POST"
                          ? "#D1FAE5"
                          : selectedEndpoint.method === "PATCH" || selectedEndpoint.method === "PUT"
                          ? "#FEF3C7"
                          : "#FEE2E2",
                      color:
                        selectedEndpoint.method === "GET"
                          ? "#1D4ED8"
                          : selectedEndpoint.method === "POST"
                          ? "#047857"
                          : selectedEndpoint.method === "PATCH" || selectedEndpoint.method === "PUT"
                          ? "#B45309"
                          : "#B91C1C",
                    }}
                  >
                    {selectedEndpoint.method}
                  </span>
                  <code style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A" }}>
                    {selectedEndpoint.path}
                  </code>
                </div>
                <h2 style={{ fontSize: "1.375rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  {selectedEndpoint.title}
                </h2>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.25rem 0.625rem",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    backgroundColor: selectedEndpoint.auth === "API Key" ? "#EFF6FF" : "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    color: selectedEndpoint.auth === "API Key" ? "#2563EB" : "#475569",
                  }}
                >
                  <Key size={13} /> {selectedEndpoint.auth}
                </span>
              </div>
            </div>

            <p style={{ fontSize: "0.9375rem", color: "#475569", lineHeight: 1.6, margin: "0 0 1.5rem 0" }}>
              {selectedEndpoint.description}
            </p>

            {/* Query Parameters (if any) */}
            {selectedEndpoint.queryParams && selectedEndpoint.queryParams.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.75rem" }}>
                  Query Parameters
                </h3>
                <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                    <thead style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                      <tr>
                        <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontWeight: 700, color: "#475569" }}>Param</th>
                        <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontWeight: 700, color: "#475569" }}>Type</th>
                        <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontWeight: 700, color: "#475569" }}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEndpoint.queryParams.map((param, i) => (
                        <tr key={i} style={{ borderBottom: i < selectedEndpoint.queryParams!.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                          <td style={{ padding: "0.625rem 1rem", fontFamily: "monospace", fontWeight: 700, color: "#0D9488" }}>{param.name}</td>
                          <td style={{ padding: "0.625rem 1rem", color: "#64748B", fontFamily: "monospace" }}>{param.type}</td>
                          <td style={{ padding: "0.625rem 1rem", color: "#334155" }}>{param.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Request Body & Code Generation */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
              {selectedEndpoint.requestBody && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
                      Request Payload ({selectedEndpoint.requestBody.contentType})
                    </h3>
                    <button
                      onClick={() => handleCopy(JSON.stringify(selectedEndpoint.requestBody!.example, null, 2), "req-body")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#FFFFFF",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#64748B",
                        cursor: "pointer",
                      }}
                    >
                      {copiedKey === "req-body" ? <Check size={12} color="#10B981" /> : <Copy size={12} />} Copy JSON
                    </button>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: "1rem",
                      backgroundColor: "#0F172A",
                      color: "#E2E8F0",
                      borderRadius: "8px",
                      fontSize: "0.8125rem",
                      fontFamily: "monospace",
                      overflowX: "auto",
                      maxHeight: "320px",
                    }}
                  >
                    {JSON.stringify(selectedEndpoint.requestBody.example, null, 2)}
                  </pre>
                  {selectedEndpoint.requestBody.schemaNotes && (
                    <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "0.5rem", fontStyle: "italic" }}>
                      * {selectedEndpoint.requestBody.schemaNotes}
                    </div>
                  )}
                </div>
              )}

              {/* Code Examples in cURL, JS, Python */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
                      Code Snippet
                    </h3>
                    <div style={{ display: "flex", backgroundColor: "#F1F5F9", borderRadius: "6px", padding: "2px" }}>
                      {(["curl", "javascript", "python"] as const).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setSelectedLanguage(lang)}
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            border: "none",
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            backgroundColor: selectedLanguage === lang ? "#FFFFFF" : "transparent",
                            color: selectedLanguage === lang ? "#0D9488" : "#64748B",
                            boxShadow: selectedLanguage === lang ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                          }}
                        >
                          {lang.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopy(generateSnippet(selectedEndpoint, selectedLanguage), "code-snippet")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #E2E8F0",
                      backgroundColor: "#FFFFFF",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#64748B",
                      cursor: "pointer",
                    }}
                  >
                    {copiedKey === "code-snippet" ? <Check size={12} color="#10B981" /> : <Copy size={12} />} Copy Code
                  </button>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: "1rem",
                    backgroundColor: "#1E293B",
                    color: "#38BDF8",
                    borderRadius: "8px",
                    fontSize: "0.8125rem",
                    fontFamily: "monospace",
                    overflowX: "auto",
                    maxHeight: "320px",
                  }}
                >
                  {generateSnippet(selectedEndpoint, selectedLanguage)}
                </pre>
              </div>

              {/* Response Example */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
                      Expected Response
                    </h3>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 800,
                        backgroundColor: "#DCFCE7",
                        color: "#166534",
                        padding: "0.125rem 0.375rem",
                        borderRadius: "4px",
                      }}
                    >
                      HTTP {selectedEndpoint.responseExample.status}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(JSON.stringify(selectedEndpoint.responseExample.body, null, 2), "res-body")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      border: "1px solid #E2E8F0",
                      backgroundColor: "#FFFFFF",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#64748B",
                      cursor: "pointer",
                    }}
                  >
                    {copiedKey === "res-body" ? <Check size={12} color="#10B981" /> : <Copy size={12} />} Copy Response
                  </button>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: "1rem",
                    backgroundColor: "#0F172A",
                    color: "#A7F3D0",
                    borderRadius: "8px",
                    fontSize: "0.8125rem",
                    fontFamily: "monospace",
                    overflowX: "auto",
                    maxHeight: "320px",
                  }}
                >
                  {typeof selectedEndpoint.responseExample.body === "string"
                    ? selectedEndpoint.responseExample.body
                    : JSON.stringify(selectedEndpoint.responseExample.body, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Live Request Playground */}
          <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", padding: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Play size={18} color="#0D9488" />
                <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  Live API Playground
                </h3>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Executes request against your running backend
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.375rem" }}>
                    API Token / Key (Optional override)
                  </label>
                  <input
                    type="text"
                    placeholder="crm_live_... or leave blank to use active login session"
                    value={playgroundApiKey}
                    onChange={(e) => setPlaygroundApiKey(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.8125rem",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontFamily: "monospace",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.375rem" }}>
                    Target URL
                  </label>
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.8125rem",
                      borderRadius: "6px",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      fontFamily: "monospace",
                      color: "#334155",
                      overflowX: "auto",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {selectedEndpoint.method} {apiBaseUrl}{selectedEndpoint.path.replace("/api", "")}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={runPlaygroundTest}
                  disabled={playgroundLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.625rem 1.25rem",
                    borderRadius: "6px",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    border: "none",
                    cursor: playgroundLoading ? "not-allowed" : "pointer",
                    opacity: playgroundLoading ? 0.7 : 1,
                  }}
                >
                  {playgroundLoading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                  Send Test Request
                </button>
              </div>

              {playgroundResponse && (
                <div style={{ marginTop: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Live Response:</span>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 800,
                        padding: "0.125rem 0.375rem",
                        borderRadius: "4px",
                        backgroundColor: playgroundResponse.ok ? "#DCFCE7" : "#FEE2E2",
                        color: playgroundResponse.ok ? "#166534" : "#991B1B",
                      }}
                    >
                      HTTP {playgroundResponse.status} {playgroundResponse.statusText}
                    </span>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: "1rem",
                      backgroundColor: "#0F172A",
                      color: playgroundResponse.ok ? "#6EE7B7" : "#FCA5A5",
                      borderRadius: "8px",
                      fontSize: "0.8125rem",
                      fontFamily: "monospace",
                      overflowX: "auto",
                      maxHeight: "350px",
                    }}
                  >
                    {JSON.stringify(playgroundResponse.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
