/**
 * API client and helpers for BizCopilot Universal CRM Lead Management System
 */

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type LeadSource = string;
export type LeadStatus = string;
export type FollowUpType = "Call" | "Email" | "Meeting" | "Demo" | "WhatsApp" | "Other";

export interface LeadUserSummary {
  id: number;
  name: string;
  email: string;
}

export interface CustomFieldDefinition {
  id: number;
  field_key: string;
  field_label: string;
  field_type: string;
  options: string[];
  required: boolean;
  visibility: boolean;
  field_order: number;
  section: string;
  workspace_id: number;
  created_at: string;
}

export interface CustomFieldValueItem {
  field_key: string;
  field_label: string;
  field_type: string;
  value: any;
}

export interface LeadStatusItem {
  id: number;
  name: string;
  color: string;
  order: number;
  is_default: boolean;
  workspace_id: number;
  created_at: string;
}

export interface LeadSourceItem {
  id: number;
  name: string;
  is_default: boolean;
  workspace_id: number;
  created_at: string;
}

export interface TagItem {
  id: number;
  name: string;
  color: string;
  workspace_id: number;
  created_at: string;
}

export interface DuplicateSettings {
  check_phone: boolean;
  check_email: boolean;
  action: "prevent" | "warn";
}

export interface SavedViewItem {
  id: number;
  user_id: number;
  name: string;
  filters: Record<string, any>;
  is_default: boolean;
  created_at: string;
}

export interface FollowUpItem {
  id: number;
  lead_number: string;
  user_id?: number | null;
  user?: LeadUserSummary | null;
  title: string;
  follow_up_type: string;
  due_date: string;
  completed: boolean;
  completed_at?: string | null;
  notes?: string | null;
  reminder_state: string;
  created_at: string;
}

export interface LeadNote {
  id: number;
  lead_number: string;
  user_id?: number | null;
  user?: LeadUserSummary | null;
  content: string;
  created_at: string;
}

export interface LeadActivity {
  id: number;
  lead_number: string;
  user_id?: number | null;
  user?: LeadUserSummary | null;
  activity_type: string;
  title: string;
  description?: string | null;
  created_at: string;
}

export interface Lead {
  number: string; // Required unique primary key
  name: string;
  email: string;
  phone?: string | null;
  requirement: string;
  source: LeadSource;
  city: string;
  status: LeadStatus;
  owner_id?: number | null;
  owner?: LeadUserSummary | null;
  score: number;
  lost_reason?: string | null;
  tags: string[];
  follow_up_date?: string | null;
  follow_up_type?: FollowUpType | string | null;
  follow_up_notes?: string | null;
  follow_up_completed: boolean;
  notes_count?: number;
  created_by_id?: number | null;
  creator?: LeadUserSummary | null;
  last_activity_at: string;
  deleted_at?: string | null;
  lead_age_days: number;
  custom_fields: Record<string, any>;
  custom_field_details: CustomFieldValueItem[];
  created_at: string;
  updated_at: string;
}

export interface LeadCreatePayload {
  number: string;
  name: string;
  email: string;
  phone?: string | null;
  requirement: string;
  source: LeadSource;
  city: string;
  status?: LeadStatus;
  owner_id?: number | null;
  score?: number;
  lost_reason?: string | null;
  tags?: string[];
  follow_up_date?: string | null;
  follow_up_type?: string | null;
  follow_up_notes?: string | null;
  follow_up_completed?: boolean;
  custom_fields?: Record<string, any>;
}

export interface LeadUpdatePayload {
  name?: string;
  email?: string;
  phone?: string | null;
  requirement?: string;
  source?: LeadSource;
  city?: string;
  status?: LeadStatus | string;
  owner_id?: number | null;
  score?: number;
  lost_reason?: string | null;
  tags?: string[];
  follow_up_date?: string | null;
  follow_up_type?: string | null;
  follow_up_notes?: string | null;
  follow_up_completed?: boolean;
  custom_fields?: Record<string, any>;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  view_counts?: {
    all: number;
    my_leads: number;
    unassigned: number;
    hot_leads: number;
    today_followups: number;
    overdue_followups: number;
    trash: number;
  };
}

export interface BulkActionPayload {
  lead_numbers: string[];
  action: "update_status" | "assign_owner" | "add_tags" | "remove_tags" | "soft_delete" | "restore" | "delete_permanent";
  status?: string;
  owner_id?: number | null;
  tags?: string[];
  lost_reason?: string;
}

export interface BulkActionResponse {
  success: boolean;
  affected_count: number;
  message: string;
}

export interface ImportLeadsPayload {
  leads: Record<string, any>[];
  duplicate_strategy: "skip" | "update" | "error";
}

export interface ImportLeadsResponse {
  success: boolean;
  total_processed: number;
  imported_count: number;
  skipped_count: number;
  updated_count: number;
  errors: { row: number; error: string; number?: string }[];
}

export type ExpiryPreset = "7_days" | "30_days" | "90_days" | "1_year" | "never" | "custom";

export interface ApiKeyCreatePayload {
  name: string;
  expiry?: ExpiryPreset;
  custom_expiry_date?: string;
}

export interface ApiKey {
  id: number;
  name: string;
  masked_key: string;
  key_prefix: string;
  key_suffix: string;
  status: "active" | "revoked" | "expired";
  expires_at?: string | null;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyCreatedResponse extends ApiKey {
  api_key: string;
}

export interface WebhookLeadPayload {
  number?: string;
  phone?: string;
  phone_number?: string;
  mobile?: string;
  contact?: string;
  name?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  email_address?: string;
  requirement?: string;
  message?: string;
  notes?: string;
  query?: string;
  description?: string;
  source?: string;
  lead_source?: string;
  city?: string;
  location?: string;
  custom_fields?: Record<string, any>;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  lead: Lead;
}

// -------------------------------------------------------------
// Storage & Base Configuration
// -------------------------------------------------------------

let cachedApiBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  // 1. Check NEXT_PUBLIC_API_URL environment variable if set
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) {
    cachedApiBaseUrl = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
    return cachedApiBaseUrl;
  }

  // 2. Check localStorage in browser
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("crm_api_base_url");
      if (stored) {
        cachedApiBaseUrl = stored.replace(/\/+$/, "");
        return cachedApiBaseUrl;
      }
    } catch {
      // Ignore localStorage read errors
    }

    const host = window.location.hostname || "localhost";
    const protocol = window.location.protocol || "http:";

    // Default to port 8001 (matching active backend)
    return `${protocol}//${host}:8001/api`;
  }

  return "http://localhost:8001/api";
}

export function setApiBaseUrl(url: string) {
  cachedApiBaseUrl = url.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("crm_api_base_url", cachedApiBaseUrl);
    } catch {
      // Ignore localStorage write errors
    }
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("crm_auth_token");
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("crm_auth_token", token);
  }
}

export function removeToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("crm_auth_token");
    localStorage.removeItem("crm_user");
  }
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const userJson = localStorage.getItem("crm_user");
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User) {
  if (typeof window !== "undefined") {
    localStorage.setItem("crm_user", JSON.stringify(user));
  }
}

export function saveGeneratedToken(keyOrId: any, maybeKey?: string) {
  if (typeof window !== "undefined") {
    const val = maybeKey !== undefined ? maybeKey : String(keyOrId);
    sessionStorage.setItem("last_created_api_key", val);
  }
}

export function getSavedGeneratedToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("last_created_api_key");
}

export function copyTextToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
}

export function formatExpiryDate(dateStr?: string | null): string {
  if (!dateStr) return "Never Expires";
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatExpiryDateShort(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString();
}

// -------------------------------------------------------------
// Core Fetch Request Wrapper
// -------------------------------------------------------------

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let baseUrl = getApiBaseUrl();
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response | null = null;
  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    // If we experienced a network error (e.g., port mismatch between 8000 and 8001, or localhost vs 127.0.0.1)
    const isNetworkError =
      err instanceof TypeError ||
      err?.name === "TypeError" ||
      (typeof err?.message === "string" &&
        (err.message.includes("Failed to fetch") ||
          err.message.includes("NetworkError") ||
          err.message.includes("fetch failed")));

    if (isNetworkError) {
      // Determine candidate fallback URLs
      const candidates: string[] = [];
      if (baseUrl.includes(":8000")) {
        candidates.push(baseUrl.replace(":8000", ":8001"));
      } else if (baseUrl.includes(":8001")) {
        candidates.push(baseUrl.replace(":8001", ":8000"));
      } else {
        candidates.push("http://localhost:8001/api", "http://localhost:8000/api");
      }

      // Also try 127.0.0.1 if localhost failed
      if (baseUrl.includes("localhost")) {
        candidates.push(baseUrl.replace("localhost", "127.0.0.1"));
      } else if (baseUrl.includes("127.0.0.1")) {
        candidates.push(baseUrl.replace("127.0.0.1", "localhost"));
      }

      // Try candidates sequentially
      for (const candidate of candidates) {
        if (candidate === baseUrl) continue;
        try {
          const fallbackRes = await fetch(`${candidate}${endpoint}`, {
            ...options,
            headers,
          });
          // If we reached the server and got any HTTP response
          setApiBaseUrl(candidate);
          response = fallbackRes;
          break;
        } catch {
          // Continue trying candidates
        }
      }

      if (!response) {
        throw new Error(
          `Unable to connect to CRM API server at ${baseUrl}. Please ensure the Go backend is running.`
        );
      }
    } else {
      throw err;
    }
  }

  if (!response) {
    throw new Error(`Unable to complete request to ${baseUrl}${endpoint}`);
  }

  if (response.status === 401) {
    if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
      removeToken();
    }
  }

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.message || JSON.stringify(errorData);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail);
  }

  // Handle empty responses (like 204 or file downloads)
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text() as unknown as T;
}

// -------------------------------------------------------------
// Auth API
// -------------------------------------------------------------

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.access_token);
    setStoredUser(res.user);
    return res;
  },

  register: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    const res = await request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    setToken(res.access_token);
    setStoredUser(res.user);
    return res;
  },

  getMe: async (): Promise<User> => {
    return request<User>("/auth/me");
  },

  getUsers: async (): Promise<LeadUserSummary[]> => {
    return request<LeadUserSummary[]>("/auth/users");
  },

  logout: () => {
    removeToken();
  },
};

// -------------------------------------------------------------
// Complete Lead Management API
// -------------------------------------------------------------

export const leadsApi = {
  getAll: async (params?: {
    search?: string;
    source?: string;
    status?: string;
    owner_id?: number | string;
    tag?: string;
    follow_up_status?: string;
    view?: string;
    include_deleted?: boolean;
    sort_by?: string;
    sort_order?: "asc" | "desc";
    page?: number;
    limit?: number;
  }): Promise<LeadListResponse> => {
    const query = new URLSearchParams();
    if (params) {
      if (params.search) query.append("search", params.search);
      if (params.source && params.source !== "all") query.append("source", params.source);
      if (params.status && params.status !== "all") query.append("status", params.status);
      if (params.owner_id !== undefined && params.owner_id !== "all") query.append("owner_id", String(params.owner_id));
      if (params.tag) query.append("tag", params.tag);
      if (params.follow_up_status && params.follow_up_status !== "all") query.append("follow_up_status", params.follow_up_status);
      if (params.view && params.view !== "all") query.append("view", params.view);
      if (params.include_deleted) query.append("include_deleted", "true");
      if (params.sort_by) query.append("sort_by", params.sort_by);
      if (params.sort_order) query.append("sort_order", params.sort_order);
      if (params.page) query.append("page", String(params.page));
      if (params.limit) query.append("limit", String(params.limit));
    }
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return request<LeadListResponse>(`/leads${queryString}`);
  },

  getOne: async (number: string): Promise<Lead> => {
    return request<Lead>(`/leads/${encodeURIComponent(number)}`);
  },

  create: async (data: LeadCreatePayload): Promise<Lead> => {
    return request<Lead>("/leads", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (number: string, data: LeadUpdatePayload): Promise<Lead> => {
    return request<Lead>(`/leads/${encodeURIComponent(number)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  delete: async (number: string, permanent: boolean = false): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>(
      `/leads/${encodeURIComponent(number)}${permanent ? "?permanent=true" : ""}`,
      { method: "DELETE" }
    );
  },

  restore: async (number: string): Promise<{ success: boolean; message: string; lead: Lead }> => {
    return request<{ success: boolean; message: string; lead: Lead }>(
      `/leads/${encodeURIComponent(number)}/restore`,
      { method: "POST" }
    );
  },

  // Bulk & Import / Export
  bulkAction: async (payload: BulkActionPayload): Promise<BulkActionResponse> => {
    return request<BulkActionResponse>("/leads/bulk", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  importLeads: async (payload: ImportLeadsPayload): Promise<ImportLeadsResponse> => {
    return request<ImportLeadsResponse>("/leads/import", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getExportUrl: (params?: Record<string, any>): string => {
    const baseUrl = getApiBaseUrl();
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "all") {
          query.append(k, String(v));
        }
      });
    }
    const qs = query.toString();
    return `${baseUrl}/leads/export${qs ? `?${qs}` : ""}`;
  },

  exportLeads: async (params?: Record<string, any>): Promise<void> => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "all") {
          query.append(k, String(v));
        }
      });
    }
    const qs = query.toString();
    const endpoint = `/leads/export${qs ? `?${qs}` : ""}`;

    let baseUrl = getApiBaseUrl();
    const token = getToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let response: Response | null = null;
    try {
      response = await fetch(`${baseUrl}${endpoint}`, {
        method: "GET",
        headers,
      });
    } catch (err: any) {
      // Dynamic fallback between 8000 and 8001
      const candidates: string[] = [];
      if (baseUrl.includes(":8000")) {
        candidates.push(baseUrl.replace(":8000", ":8001"));
      } else if (baseUrl.includes(":8001")) {
        candidates.push(baseUrl.replace(":8001", ":8000"));
      } else {
        candidates.push("http://localhost:8001/api", "http://localhost:8000/api");
      }
      for (const candidate of candidates) {
        if (candidate === baseUrl) continue;
        try {
          const fallbackRes = await fetch(`${candidate}${endpoint}`, {
            method: "GET",
            headers,
          });
          setApiBaseUrl(candidate);
          response = fallbackRes;
          break;
        } catch {
          // ignore
        }
      }
      if (!response) {
        throw new Error(
          `Unable to connect to CRM API server at ${baseUrl}. Please ensure the Go backend is running.`
        );
      }
    }

    if (!response.ok) {
      let errorDetail = "Failed to export leads.";
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || errorData.message || JSON.stringify(errorData);
      } catch {
        errorDetail = await response.text();
      }
      throw new Error(errorDetail);
    }

    // Extract filename from Content-Disposition header if available
    let filename = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    const disposition = response.headers.get("content-disposition");
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, "").trim();
      }
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },

  // Notes
  getNotes: async (number: string): Promise<LeadNote[]> => {
    return request<LeadNote[]>(`/leads/${encodeURIComponent(number)}/notes`);
  },

  createNote: async (number: string, content: string): Promise<LeadNote> => {
    return request<LeadNote>(`/leads/${encodeURIComponent(number)}/notes`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },

  deleteNote: async (number: string, noteId: number): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/leads/${encodeURIComponent(number)}/notes/${noteId}`, {
      method: "DELETE",
    });
  },

  // Follow-ups
  getFollowUps: async (number: string): Promise<FollowUpItem[]> => {
    return request<FollowUpItem[]>(`/leads/${encodeURIComponent(number)}/follow-ups`);
  },

  createFollowUp: async (
    number: string,
    data: { title: string; follow_up_type: string; due_date: string; notes?: string }
  ): Promise<FollowUpItem> => {
    return request<FollowUpItem>(`/leads/${encodeURIComponent(number)}/follow-ups`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateFollowUp: async (
    number: string,
    followUpId: number,
    data: { completed?: boolean; title?: string; due_date?: string; notes?: string }
  ): Promise<FollowUpItem> => {
    return request<FollowUpItem>(`/leads/${encodeURIComponent(number)}/follow-ups/${followUpId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Tags
  updateTags: async (number: string, tags: string[]): Promise<{ success: boolean; tags: string[] }> => {
    return request<{ success: boolean; tags: string[] }>(`/leads/${encodeURIComponent(number)}/tags`, {
      method: "POST",
      body: JSON.stringify(tags),
    });
  },

  // Activities
  getActivities: async (number: string): Promise<LeadActivity[]> => {
    return request<LeadActivity[]>(`/leads/${encodeURIComponent(number)}/activities`);
  },

  // Custom Fields Configuration
  getCustomFields: async (): Promise<CustomFieldDefinition[]> => {
    return request<CustomFieldDefinition[]>("/leads/custom-fields");
  },

  createCustomField: async (data: {
    field_key: string;
    field_label: string;
    field_type: string;
    options?: string[];
    required?: boolean;
    visibility?: boolean;
    field_order?: number;
    section?: string;
  }): Promise<CustomFieldDefinition> => {
    return request<CustomFieldDefinition>("/leads/custom-fields", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateCustomField: async (
    fieldId: number,
    data: Partial<CustomFieldDefinition>
  ): Promise<CustomFieldDefinition> => {
    return request<CustomFieldDefinition>(`/leads/custom-fields/${fieldId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteCustomField: async (fieldId: number): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/leads/custom-fields/${fieldId}`, {
      method: "DELETE",
    });
  },

  // Lead Statuses Configuration
  getStatuses: async (): Promise<LeadStatusItem[]> => {
    return request<LeadStatusItem[]>("/leads/statuses");
  },

  createStatus: async (data: { name: string; color?: string; order?: number }): Promise<LeadStatusItem> => {
    return request<LeadStatusItem>("/leads/statuses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteStatus: async (statusId: number): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/leads/statuses/${statusId}`, {
      method: "DELETE",
    });
  },

  // Lead Sources Configuration
  getSources: async (): Promise<LeadSourceItem[]> => {
    return request<LeadSourceItem[]>("/leads/sources");
  },

  createSource: async (data: { name: string; is_default?: boolean }): Promise<LeadSourceItem> => {
    return request<LeadSourceItem>("/leads/sources", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteSource: async (sourceId: number): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/leads/sources/${sourceId}`, {
      method: "DELETE",
    });
  },

  // Tags Configuration
  getTags: async (): Promise<TagItem[]> => {
    return request<TagItem[]>("/leads/tags");
  },

  createTag: async (data: { name: string; color?: string }): Promise<TagItem> => {
    return request<TagItem>("/leads/tags", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteTag: async (tagId: number): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/leads/tags/${tagId}`, {
      method: "DELETE",
    });
  },

  // Duplicate Check Settings
  getDuplicateSettings: async (): Promise<DuplicateSettings> => {
    return request<DuplicateSettings>("/leads/settings/duplicates");
  },

  updateDuplicateSettings: async (settings: DuplicateSettings): Promise<DuplicateSettings> => {
    return request<DuplicateSettings>("/leads/settings/duplicates", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  // Saved Views
  getSavedViews: async (): Promise<SavedViewItem[]> => {
    return request<SavedViewItem[]>("/leads/saved-views");
  },

  createSavedView: async (data: { name: string; filters: Record<string, any> }): Promise<SavedViewItem> => {
    return request<SavedViewItem>("/leads/saved-views", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteSavedView: async (viewId: number): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/leads/saved-views/${viewId}`, {
      method: "DELETE",
    });
  },
};

// -------------------------------------------------------------
// API Keys & Webhooks API
// -------------------------------------------------------------

export const apiKeysApi = {
  getAll: async (): Promise<ApiKey[]> => {
    return request<ApiKey[]>("/api-keys");
  },

  list: async (): Promise<ApiKey[]> => {
    return request<ApiKey[]>("/api-keys");
  },

  create: async (data: { name: string; expiry?: ExpiryPreset; custom_expiry_date?: string }): Promise<ApiKeyCreatedResponse> => {
    return request<ApiKeyCreatedResponse>("/api-keys", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: any): Promise<ApiKey> => {
    return request<ApiKey>(`/api-keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  revoke: async (id: number): Promise<ApiKey> => {
    return request<ApiKey>(`/api-keys/${id}/revoke`, {
      method: "POST",
    });
  },

  delete: async (id: number): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/api-keys/${id}`, {
      method: "DELETE",
    });
  },
};

export const webhooksApi = {
  testLeadWebhook: async (apiKey: string, payload: WebhookLeadPayload): Promise<WebhookResponse> => {
    return request<WebhookResponse>("/webhooks/lead", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  },
};
