"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Key,
  Users,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Edit3,
  LogOut,
  X,
  CheckCircle,
  AlertCircle,
  Copy,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  CalendarClock,
  AlertTriangle,
  Zap,
} from "lucide-react";
import {
  apiKeysApi,
  authApi,
  getToken,
  getStoredUser,
  ApiKey,
  ApiKeyCreatePayload,
  ExpiryPreset,
  User,
  saveGeneratedToken,
  formatExpiryDate,
  copyTextToClipboard,
} from "@/lib/api";

export default function ApiKeysPage({
  hideSidebar = false,
  onKeyCountChange,
}: {
  hideSidebar?: boolean;
  onKeyCountChange?: (count: number) => void;
} = {}) {
  const router = useRouter();

  // Authentication & User State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // API Keys State
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRevealModalOpen, setIsRevealModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Active Key for View/Edit/Revoke/Delete
  const [activeKey, setActiveKey] = useState<ApiKey | null>(null);

  // Plaintext revealed key (ONLY shown once after creation)
  const [revealedKey, setRevealedKey] = useState<string>("");
  const [revealedKeyName, setRevealedKeyName] = useState<string>("");

  // Create Form State
  const [createForm, setCreateForm] = useState<ApiKeyCreatePayload>({
    name: "",
    expiry: "7_days",
    custom_expiry_date: "",
  });
  const [editName, setEditName] = useState("");
  const [editExpiry, setEditExpiry] = useState<string>("keep");
  const [editCustomExpiryDate, setEditCustomExpiryDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    if (!hideSidebar) {
      router.replace("/leads?tab=api-keys");
      return;
    }
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    const stored = getStoredUser();
    if (stored) setUser(stored);
    authApi
      .getMe()
      .then((u) => setUser(u))
      .catch(() => router.push("/login"))
      .finally(() => setIsAuthChecking(false));
  }, [router, hideSidebar]);

  // Fetch keys
  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const data = await apiKeysApi.list();
      setKeys(data);
      if (onKeyCountChange) {
        onKeyCountChange(data.length);
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to fetch API keys.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthChecking) {
      fetchKeys();
    }
  }, [isAuthChecking]);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLogout = () => {
    authApi.logout();
    router.push("/");
  };

  // Copy helper with safe fallback for all environments
  const copyToClipboard = async (text: string, id: string) => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2500);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = keys.length;
    const active = keys.filter((k) => k.status === "active").length;
    const expired = keys.filter((k) => k.status === "expired").length;
    const revoked = keys.filter((k) => k.status === "revoked").length;
    return { total, active, expired, revoked };
  }, [keys]);

  // Filtered keys
  const filteredKeys = useMemo(() => {
    return keys.filter((k) => {
      const matchesSearch =
        k.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.masked_key.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || k.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [keys, searchTerm, statusFilter]);

  // Handle Create API Key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const payload: ApiKeyCreatePayload = {
        name: createForm.name.trim(),
        expiry: createForm.expiry,
        custom_expiry_date: createForm.expiry === "custom" ? createForm.custom_expiry_date : undefined,
      };

      const res = await apiKeysApi.create(payload);
      setIsCreateModalOpen(false);

      // Save raw plaintext key to reveal ONCE in modal and cache in session
      saveGeneratedToken(res.id, res.api_key);
      setRevealedKey(res.api_key);
      setRevealedKeyName(res.name);
      setIsRevealModalOpen(true);

      // Reset form
      setCreateForm({ name: "", expiry: "30_days", custom_expiry_date: "" });
      fetchKeys();
      showToast("success", `API Key '${res.name}' created successfully.`);
    } catch (err: any) {
      setFormError(err.message || "Failed to create API key.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Update Key
  const handleUpdateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKey) return;
    setIsSubmitting(true);

    try {
      const updatePayload: any = { name: editName.trim() };
      if (editExpiry !== "keep") {
        updatePayload.expiry = editExpiry;
        if (editExpiry === "custom") {
          updatePayload.custom_expiry_date = editCustomExpiryDate;
        }
      }
      await apiKeysApi.update(activeKey.id, updatePayload);
      setIsEditModalOpen(false);
      showToast("success", `API Key updated successfully.`);
      fetchKeys();
    } catch (err: any) {
      showToast("error", err.message || "Failed to update API key.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Revoke Key
  const handleRevokeKey = async () => {
    if (!activeKey) return;
    setIsSubmitting(true);

    try {
      await apiKeysApi.revoke(activeKey.id);
      setIsRevokeModalOpen(false);
      showToast("success", `API Key '${activeKey.name}' has been revoked.`);
      fetchKeys();
    } catch (err: any) {
      showToast("error", err.message || "Failed to revoke API key.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Key
  const handleDeleteKey = async () => {
    if (!activeKey) return;
    setIsSubmitting(true);

    try {
      await apiKeysApi.delete(activeKey.id);
      setIsDeleteModalOpen(false);
      showToast("success", `API Key '${activeKey.name}' permanently deleted.`);
      fetchKeys();
    } catch (err: any) {
      showToast("error", err.message || "Failed to delete API key.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthChecking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              backgroundColor: "var(--primary-teal)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "1.125rem",
            }}
            className="animate-pulse"
          >
            CRM
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>Loading API Keys...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: hideSidebar ? "auto" : "100vh", backgroundColor: "var(--bg-page)", width: "100%" }}>
      {/* ================= LEFT SIDEBAR ================= */}
      {!hideSidebar && (
        <aside
        style={{
          width: "250px",
          backgroundColor: "#FFFFFF",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 100,
        }}
        id="crm-left-sidebar"
      >
        {/* Brand Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, var(--primary-teal) 0%, var(--primary-blue) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "0.875rem",
              letterSpacing: "-0.02em",
            }}
          >
            C
          </div>
          <span style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            CRM
          </span>
        </div>

        {/* Sidebar Navigation - Leads & API Keys */}
        <nav style={{ padding: "1.25rem 1rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: "0.25rem", paddingLeft: "0.5rem" }}>
            MODULES
          </div>

          {/* 1. Leads Link */}
          <Link
            href="/leads"
            id="sidebar-nav-leads"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.65rem 0.85rem",
              borderRadius: "var(--radius-md)",
              color: "var(--text-secondary)",
              fontWeight: 600,
              fontSize: "0.875rem",
              transition: "all 0.15s ease",
            }}
          >
            <Users size={18} />
            <span>Leads</span>
          </Link>

          {/* 2. Follow-ups Link */}
          <Link
            href="/leads?tab=follow-ups"
            id="sidebar-nav-followups"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.65rem 0.85rem",
              borderRadius: "var(--radius-md)",
              color: "var(--text-secondary)",
              fontWeight: 600,
              fontSize: "0.875rem",
              transition: "all 0.15s ease",
            }}
          >
            <CalendarClock size={18} />
            <span>Follow-ups</span>
          </Link>

          {/* 3. API Keys Link (Active) */}
          <div
            id="sidebar-nav-apikeys"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.65rem 0.85rem",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--light-teal)",
              color: "var(--primary-teal)",
              fontWeight: 700,
              fontSize: "0.875rem",
              border: "1px solid rgba(0, 159, 154, 0.2)",
              cursor: "default",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <Key size={18} />
              <span>API Keys</span>
            </div>
            <span
              style={{
                backgroundColor: "#FFFFFF",
                color: "var(--primary-teal)",
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: "var(--radius-full)",
                border: "1px solid rgba(0, 159, 154, 0.25)",
              }}
            >
              {keys.length}
            </span>
          </div>
        </nav>

        {/* Sidebar Bottom: Profile & Logout */}
        <div
          style={{
            padding: "1rem",
            borderTop: "1px solid var(--border-subtle)",
            backgroundColor: "#FFFFFF",
          }}
          id="sidebar-user-footer"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "var(--light-blue)",
                color: "var(--primary-blue)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.875rem",
                border: "1px solid rgba(0, 159, 227, 0.25)",
                flexShrink: 0,
              }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.name || "Admin User"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.email || "admin@crmdemo.com"}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-outline"
            style={{ width: "100%", padding: "0.45rem", fontSize: "0.8125rem", justifyContent: "center" }}
            id="btn-sidebar-logout"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>
      )}

      {/* ================= MAIN CONTENT WRAPPER ================= */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <header
          style={{
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "0.875rem 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 90,
          }}
          id="crm-topbar"
        >
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              API Keys Management
            </h1>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
              Authenticate external integrations using <strong style={{ color: "var(--primary-teal)" }}>Authorization: Bearer &lt;API_KEY&gt;</strong>
            </div>
          </div>

          <button
            onClick={() => {
              setFormError(null);
              setIsCreateModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ fontSize: "0.8125rem" }}
            id="btn-create-api-key"
          >
            <Plus size={16} /> Create API Key
          </button>
        </header>

        {/* Content Body */}
        <main style={{ padding: "1.75rem 2rem", flex: 1 }}>
          {/* Toast Notification */}
          {toastMessage && (
            <div
              className={`alert ${toastMessage.type === "success" ? "alert-success" : "alert-danger"}`}
              style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 1100, boxShadow: "var(--shadow-lg)" }}
            >
              {toastMessage.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              <span>{toastMessage.text}</span>
            </div>
          )}

          {/* Metric Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div
              className="white-card"
              style={{ padding: "1rem 1.25rem", cursor: "pointer", borderLeft: statusFilter === "all" ? "4px solid var(--primary-teal)" : undefined }}
              onClick={() => setStatusFilter("all")}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 700 }}>
                <span>TOTAL KEYS</span>
                <Key size={16} color="var(--primary-teal)" />
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.25rem", color: "var(--text-primary)" }}>
                {stats.total}
              </div>
            </div>

            <div
              className="white-card"
              style={{ padding: "1rem 1.25rem", cursor: "pointer", borderLeft: statusFilter === "active" ? "4px solid #10B981" : undefined }}
              onClick={() => setStatusFilter("active")}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#10B981", fontSize: "0.75rem", fontWeight: 700 }}>
                <span>ACTIVE KEYS</span>
                <ShieldCheck size={16} />
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.25rem", color: "#047857" }}>
                {stats.active}
              </div>
            </div>

            <div
              className="white-card"
              style={{ padding: "1rem 1.25rem", cursor: "pointer", borderLeft: statusFilter === "expired" ? "4px solid #F59E0B" : undefined }}
              onClick={() => setStatusFilter("expired")}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#D97706", fontSize: "0.75rem", fontWeight: 700 }}>
                <span>EXPIRED</span>
                <Clock size={16} />
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.25rem", color: "#B45309" }}>
                {stats.expired}
              </div>
            </div>

            <div
              className="white-card"
              style={{ padding: "1rem 1.25rem", cursor: "pointer", borderLeft: statusFilter === "revoked" ? "4px solid #EF4444" : undefined }}
              onClick={() => setStatusFilter("revoked")}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#DC2626", fontSize: "0.75rem", fontWeight: 700 }}>
                <span>REVOKED</span>
                <ShieldAlert size={16} />
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.25rem", color: "#B91C1C" }}>
                {stats.revoked}
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              marginBottom: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ position: "relative", flex: 1, minWidth: "260px", maxWidth: "420px" }}>
              <Search
                size={16}
                style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
              />
              <input
                type="text"
                placeholder="Search keys by name or masked value..."
                className="form-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: "2.35rem" }}
                id="input-keys-search"
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                <Filter size={14} /> STATUS:
              </span>
              {(["all", "active", "expired", "revoked"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    borderRadius: "var(--radius-full)",
                    backgroundColor: statusFilter === st ? "var(--primary-teal)" : "#FFFFFF",
                    color: statusFilter === st ? "#FFFFFF" : "var(--text-secondary)",
                    border: statusFilter === st ? "1px solid var(--primary-teal)" : "1px solid var(--border-subtle)",
                    textTransform: "capitalize",
                  }}
                >
                  {st}
                </button>
              ))}

              <button
                onClick={fetchKeys}
                className="btn btn-secondary"
                style={{ padding: "0.45rem 0.75rem", fontSize: "0.75rem" }}
                id="btn-refresh-keys"
              >
                <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          </div>

          {/* Keys Table */}
          <div className="table-container">
            <table className="crm-table" id="api-keys-table">
              <thead>
                <tr>
                  <th style={{ width: "25%" }}>Integration Name</th>
                  <th style={{ width: "22%" }}>API Key (Masked)</th>
                  <th style={{ width: "12%" }}>Status</th>
                  <th style={{ width: "14%" }}>Created</th>
                  <th style={{ width: "14%" }}>Expires</th>
                  <th style={{ width: "13%" }}>Last Used</th>
                  <th style={{ width: "10%", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && keys.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                        <RefreshCw size={18} className="animate-spin" /> Loading API Keys...
                      </div>
                    </td>
                  </tr>
                ) : filteredKeys.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "4rem 1.5rem" }}>
                      <div style={{ maxWidth: "380px", margin: "0 auto" }}>
                        <div
                          style={{
                            width: "52px",
                            height: "52px",
                            borderRadius: "50%",
                            backgroundColor: "var(--bg-elevated)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 1rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Key size={26} />
                        </div>
                        <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.25rem", color: "var(--text-primary)" }}>
                          No API Keys Found
                        </h3>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                          Generate your first API key to authenticate external contact forms, social ad campaigns, or spreadsheets.
                        </p>
                        <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary" id="btn-empty-state-create-key">
                          <Plus size={16} /> Create API Key
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredKeys.map((k) => (
                    <tr key={k.id} id={`key-row-${k.id}`}>
                      {/* Name */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                          <div
                            style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "6px",
                              backgroundColor: "var(--light-teal)",
                              color: "var(--primary-teal)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Key size={15} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{k.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>ID #{k.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Masked Key */}
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <code
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "0.8125rem",
                              backgroundColor: "var(--bg-elevated)",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              border: "1px solid var(--border-subtle)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {k.masked_key}
                          </code>
                          <button
                            onClick={() => copyToClipboard(k.masked_key, `mask-${k.id}`)}
                            className="btn-icon"
                            title="Copy masked key"
                            style={{ padding: "3px" }}
                          >
                            <Copy size={13} color={copiedKeyId === `mask-${k.id}` ? "var(--primary-teal)" : undefined} />
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {k.status === "active" && (
                          <span style={{ backgroundColor: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0", padding: "2px 8px", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 700 }}>
                            ● Active
                          </span>
                        )}
                        {k.status === "expired" && (
                          <span style={{ backgroundColor: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A", padding: "2px 8px", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 700 }}>
                            ● Expired
                          </span>
                        )}
                        {k.status === "revoked" && (
                          <span style={{ backgroundColor: "#FEF2F2", color: "#B91C1C", border: "1px solid #FCA5A5", padding: "2px 8px", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 700 }}>
                            ● Revoked
                          </span>
                        )}
                      </td>

                      {/* Created */}
                      <td style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>

                      {/* Expires */}
                      <td style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                        {k.expires_at ? (
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {formatExpiryDate(k.expires_at)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Never</span>
                        )}
                      </td>

                      {/* Last Used */}
                      <td style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : <span style={{ color: "var(--text-muted)" }}>Never used</span>}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                          <button
                            onClick={() => {
                              setActiveKey(k);
                              setEditName(k.name);
                              setEditExpiry("keep");
                              setEditCustomExpiryDate("");
                              setIsEditModalOpen(true);
                            }}
                            className="btn-icon"
                            title="Edit key name"
                            id={`btn-edit-key-${k.id}`}
                          >
                            <Edit3 size={15} />
                          </button>
                          {k.status === "active" && (
                            <button
                              onClick={() => {
                                setActiveKey(k);
                                setIsRevokeModalOpen(true);
                              }}
                              className="btn-icon"
                              style={{ color: "#D97706" }}
                              title="Revoke key"
                              id={`btn-revoke-key-${k.id}`}
                            >
                              <ShieldAlert size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setActiveKey(k);
                              setIsDeleteModalOpen(true);
                            }}
                            className="btn-icon"
                            style={{ color: "#DC2626" }}
                            title="Delete key"
                            id={`btn-delete-key-${k.id}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* ================= MODAL: CREATE API KEY ================= */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div className="modal-header">
              <h2 className="heading-sm" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Key size={18} color="var(--primary-teal)" /> Create New API Key
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateKey}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger">
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Integration / Service Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Website Pricing Form, Meta Lead Gen, Zapier"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                    id="input-create-key-name"
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Descriptive label for tracking which system is using this key.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Expiration Preset *</label>
                  <select
                    className="form-select"
                    value={createForm.expiry}
                    onChange={(e) => setCreateForm({ ...createForm, expiry: e.target.value as ExpiryPreset })}
                    id="select-create-key-expiry"
                  >
                    <option value="7_days">7 Days</option>
                    <option value="30_days">30 Days (Recommended)</option>
                    <option value="90_days">90 Days</option>
                    <option value="1_year">1 Year</option>
                    <option value="never">Never Expires</option>
                    <option value="custom">Custom Date</option>
                  </select>
                </div>

                {createForm.expiry === "custom" && (
                  <div className="form-group">
                    <label className="form-label">Custom Expiry Date & Time *</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={createForm.custom_expiry_date}
                      onChange={(e) => setCreateForm({ ...createForm, custom_expiry_date: e.target.value })}
                      required
                      id="input-create-key-custom-date"
                    />
                  </div>
                )}

                <div
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    padding: "0.75rem 1rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "var(--text-primary)" }}>Security Guarantee:</strong> A cryptographically secure random token prefixed with <code>crm_live_</code> will be generated automatically. Only a SHA-256 hash is stored in PostgreSQL.
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting} id="btn-submit-create-key">
                  {isSubmitting ? "Generating Key..." : "Generate API Key"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: REVEAL FULL KEY STRICTLY ONCE ================= */}
      {isRevealModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRevealModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
            <div className="modal-header" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h2 className="heading-sm" style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#047857" }}>
                <CheckCircle size={20} color="#10B981" /> API Key Generated Successfully
              </h2>
              <button onClick={() => setIsRevealModalOpen(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  backgroundColor: "#FEF3C7",
                  border: "1px solid #FDE68A",
                  borderRadius: "8px",
                  padding: "0.875rem 1rem",
                  marginBottom: "1.25rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.625rem",
                }}
              >
                <AlertTriangle size={20} color="#D97706" style={{ flexShrink: 0, marginTop: "2px" }} />
                <div style={{ fontSize: "0.8125rem", color: "#92400E", lineHeight: 1.5 }}>
                  <strong>Save this API key immediately!</strong> For security reasons, you will never be able to view this full key again. If you lose it, you will need to generate a new key.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>API Key for: <strong>{revealedKeyName}</strong></span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Authorization: Bearer &lt;KEY&gt;</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    readOnly
                    value={revealedKey}
                    className="form-input"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--primary-teal)",
                      backgroundColor: "var(--light-teal)",
                      borderColor: "rgba(0, 159, 154, 0.4)",
                      paddingRight: "5.5rem",
                    }}
                    id="input-revealed-full-key"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(revealedKey, "revealed-key")}
                    className="btn btn-primary"
                    style={{
                      position: "absolute",
                      right: "4px",
                      top: "4px",
                      bottom: "4px",
                      padding: "0 0.75rem",
                      fontSize: "0.75rem",
                    }}
                    id="btn-copy-revealed-key"
                  >
                    <Copy size={13} /> {copiedKeyId === "revealed-key" ? "Copied!" : "Copy Key"}
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setIsRevealModalOpen(false)}
                className="btn btn-primary"
                id="btn-done-revealed-key"
              >
                I Have Saved My API Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT KEY NAME ================= */}
      {isEditModalOpen && activeKey && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
            <div className="modal-header">
              <h2 className="heading-sm">Edit Key Name</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateKey}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Integration Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    id="input-edit-key-name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expiration Setting</label>
                  <select
                    className="form-select"
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    id="select-edit-key-expiry"
                  >
                    <option value="keep">Keep Current Expiration</option>
                    <option value="7_days">Set: 7 Days from now</option>
                    <option value="30_days">Set: 30 Days from now</option>
                    <option value="90_days">Set: 90 Days from now</option>
                    <option value="1_year">Set: 1 Year from now</option>
                    <option value="never">Never Expires</option>
                    <option value="custom">Set Custom Date</option>
                  </select>
                </div>

                {editExpiry === "custom" && (
                  <div className="form-group">
                    <label className="form-label">Custom Expiry Date & Time *</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={editCustomExpiryDate}
                      onChange={(e) => setEditCustomExpiryDate(e.target.value)}
                      required
                      id="input-edit-key-custom-date"
                    />
                  </div>
                )}

                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>Masked Token: <code>{activeKey.masked_key}</code></span>
                  <span>Expires: {formatExpiryDate(activeKey.expires_at)}</span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: REVOKE KEY ================= */}
      {isRevokeModalOpen && activeKey && (
        <div className="modal-overlay" onClick={() => setIsRevokeModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
            <div className="modal-header">
              <h2 className="heading-sm" style={{ color: "#D97706", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ShieldAlert size={18} /> Revoke API Key
              </h2>
              <button onClick={() => setIsRevokeModalOpen(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.5 }}>
                Are you sure you want to revoke key <strong>{activeKey.name}</strong> ({activeKey.masked_key})?
              </p>
              <p style={{ color: "#B45309", fontSize: "0.8125rem", marginTop: "0.5rem", lineHeight: 1.5 }}>
                Any external contact form, Google Sheet, or campaign sending requests with this key will immediately be rejected with <strong>HTTP 401 Unauthorized</strong>.
              </p>
            </div>

            <div className="modal-footer">
              <button onClick={() => setIsRevokeModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleRevokeKey}
                className="btn btn-danger"
                style={{ backgroundColor: "#F59E0B", borderColor: "#F59E0B", color: "#FFFFFF" }}
                disabled={isSubmitting}
                id="btn-confirm-revoke-key"
              >
                {isSubmitting ? "Revoking..." : "Revoke Key"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE KEY ================= */}
      {isDeleteModalOpen && activeKey && (
        <div className="modal-overlay" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
            <div className="modal-header">
              <h2 className="heading-sm" style={{ color: "#DC2626", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Trash2 size={18} /> Delete API Key
              </h2>
              <button onClick={() => setIsDeleteModalOpen(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.5 }}>
                Are you sure you want to permanently delete API key <strong>{activeKey.name}</strong> ({activeKey.masked_key})?
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginTop: "0.5rem" }}>
                This record will be permanently deleted from the database.
              </p>
            </div>

            <div className="modal-footer">
              <button onClick={() => setIsDeleteModalOpen(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleDeleteKey}
                className="btn btn-danger"
                disabled={isSubmitting}
                id="btn-confirm-delete-key"
              >
                {isSubmitting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
