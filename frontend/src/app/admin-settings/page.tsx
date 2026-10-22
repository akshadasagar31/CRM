"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  Tag,
  Sliders,
  Layers,
  Copy,
  ExternalLink,
  RefreshCw,
  Info,
  Check,
  X,
  FileSpreadsheet,
} from "lucide-react";
import Sidebar, { SidebarTab } from "@/components/Sidebar";
import {
  leadsApi,
  authApi,
  CustomFieldDefinition,
  LeadStatusItem,
  LeadSourceItem,
  TagItem,
  DuplicateSettings,
  User,
  LeadUserSummary,
} from "@/lib/api";

type AdminTab = "custom_fields" | "statuses" | "sources" | "tags" | "duplicates" | "team";

export default function AdminSettingsPage() {
  const router = useRouter();

  // Auth & Permissions State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<AdminTab>("custom_fields");

  // Data State
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDuplicates, setIsSavingDuplicates] = useState(false);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusItem[]>([]);
  const [sources, setSources] = useState<LeadSourceItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [teamUsers, setTeamUsers] = useState<LeadUserSummary[]>([]);
  const [duplicateSettings, setDuplicateSettings] = useState<DuplicateSettings>({
    check_phone: true,
    check_email: true,
    action: "prevent",
  });

  // Form Inputs
  const [newCustomField, setNewCustomField] = useState({
    field_key: "",
    field_label: "",
    field_type: "Text",
    options: "",
    required: false,
    section: "Custom Details",
  });
  const [newStatusInput, setNewStatusInput] = useState({ name: "", color: "#0D9488" });
  const [newSourceInput, setNewSourceInput] = useState("");
  const [newTagInput, setNewTagInput] = useState({ name: "", color: "#6366F1" });

  // Toast State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isAdmin = currentUser?.role?.toLowerCase() === "admin";

  // Check auth and load settings data
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cfs, stList, srcList, tagList, dupRules, users] = await Promise.all([
        leadsApi.getCustomFields().catch(() => []),
        leadsApi.getStatuses().catch(() => []),
        leadsApi.getSources().catch(() => []),
        leadsApi.getTags().catch(() => []),
        leadsApi.getDuplicateSettings().catch(() => ({ check_phone: true, check_email: true, action: "prevent" as const })),
        authApi.getUsers().catch(() => []),
      ]);

      setCustomFields(cfs);
      setStatuses(stList);
      setSources(srcList);
      setTags(tagList);
      setDuplicateSettings(dupRules);
      setTeamUsers(users);
    } catch (err: any) {
      showToast(err.message || "Failed to load admin settings", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    authApi
      .getMe()
      .then((user) => {
        setCurrentUser(user);
        setIsAuthLoading(false);
        loadAllData();
      })
      .catch(() => {
        router.push("/login");
      });

    const savedCollapse = localStorage.getItem("crm_sidebar_collapsed");
    if (savedCollapse !== null) {
      setIsSidebarCollapsed(savedCollapse === "true");
    }
  }, [router, loadAllData]);

  // Sidebar toggle
  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("crm_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Sidebar Navigation
  const handleSelectTab = (tab: SidebarTab) => {
    if (tab === "admin-settings") return;
    if (tab === "dashboard") router.push("/dashboard");
    else if (tab === "leads") router.push("/leads");
    else if (tab === "deals") router.push("/deals");
    else if (tab === "quotations") router.push("/quotations");
    else if (tab === "orders") router.push("/orders");
    else if (tab === "invoices") router.push("/invoices");
    else if (tab === "payments") router.push("/payments");
    else if (tab === "inventory") router.push("/inventory");
    else if (tab === "products") router.push("/products");
    else if (tab === "follow-ups") router.push("/follow-ups");
    else if (tab === "company") router.push("/company");
    else if (tab === "api-keys") router.push("/leads?tab=api-keys");
    else if (tab === "api-docs") router.push("/leads?tab=api-docs");
    else if (tab === "profile") router.push("/leads?tab=profile");
  };

  // Custom Field Form Submit
  const handleCreateCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast("Administrator role required to add custom fields", "error");
      return;
    }
    if (!newCustomField.field_label.trim() || !newCustomField.field_key.trim()) {
      showToast("Field label and key are required", "error");
      return;
    }

    try {
      const opts = newCustomField.options
        ? newCustomField.options.split(",").map((o) => o.trim()).filter((o) => o)
        : [];

      await leadsApi.createCustomField({
        field_key: newCustomField.field_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        field_label: newCustomField.field_label.trim(),
        field_type: newCustomField.field_type,
        options: opts,
        required: newCustomField.required,
        section: newCustomField.section || "Custom Details",
      });

      showToast("Custom field created successfully");
      setNewCustomField({
        field_key: "",
        field_label: "",
        field_type: "Text",
        options: "",
        required: false,
        section: "Custom Details",
      });

      const updated = await leadsApi.getCustomFields();
      setCustomFields(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to create custom field", "error");
    }
  };

  // Delete Custom Field
  const handleDeleteCustomField = async (id: number, label: string) => {
    if (!isAdmin) {
      showToast("Administrator role required to delete custom fields", "error");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the custom field "${label}"? This will permanently remove it from all records.`)) return;

    try {
      await leadsApi.deleteCustomField(id);
      showToast("Custom field removed");
      const updated = await leadsApi.getCustomFields();
      setCustomFields(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to delete custom field", "error");
    }
  };

  // Status Form Submit
  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast("Administrator role required to add lead statuses", "error");
      return;
    }
    if (!newStatusInput.name.trim()) return;

    try {
      await leadsApi.createStatus({
        name: newStatusInput.name.trim(),
        color: newStatusInput.color || "#0D9488",
        order: statuses.length + 1,
      });

      showToast("Status added successfully");
      setNewStatusInput({ name: "", color: "#0D9488" });
      const updated = await leadsApi.getStatuses();
      setStatuses(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to add status", "error");
    }
  };

  // Delete Status
  const handleDeleteStatus = async (id: number, name: string) => {
    if (!isAdmin) {
      showToast("Administrator role required to delete statuses", "error");
      return;
    }
    if (!window.confirm(`Delete status "${name}"?`)) return;

    try {
      await leadsApi.deleteStatus(id);
      showToast("Status deleted");
      const updated = await leadsApi.getStatuses();
      setStatuses(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to delete status", "error");
    }
  };

  // Source Form Submit
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast("Administrator role required to add lead sources", "error");
      return;
    }
    if (!newSourceInput.trim()) return;

    try {
      await leadsApi.createSource({ name: newSourceInput.trim() });
      showToast("Lead source added");
      setNewSourceInput("");
      const updated = await leadsApi.getSources();
      setSources(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to add source", "error");
    }
  };

  // Delete Source
  const handleDeleteSource = async (id: number, name: string) => {
    if (!isAdmin) {
      showToast("Administrator role required to delete sources", "error");
      return;
    }
    if (!window.confirm(`Delete source "${name}"?`)) return;

    try {
      await leadsApi.deleteSource(id);
      showToast("Source deleted");
      const updated = await leadsApi.getSources();
      setSources(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to delete source", "error");
    }
  };

  // Tag Form Submit
  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast("Administrator role required to add tags", "error");
      return;
    }
    if (!newTagInput.name.trim()) return;

    try {
      await leadsApi.createTag({
        name: newTagInput.name.trim(),
        color: newTagInput.color || "#6366F1",
      });
      showToast("Tag added");
      setNewTagInput({ name: "", color: "#6366F1" });
      const updated = await leadsApi.getTags();
      setTags(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to add tag", "error");
    }
  };

  // Delete Tag
  const handleDeleteTag = async (id: number, name: string) => {
    if (!isAdmin) {
      showToast("Administrator role required to delete tags", "error");
      return;
    }
    try {
      await leadsApi.deleteTag(id);
      showToast(`Tag "${name}" removed`);
      const updated = await leadsApi.getTags();
      setTags(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to delete tag", "error");
    }
  };

  // Save Duplicate Rules
  const handleSaveDuplicateRules = async () => {
    if (!isAdmin) {
      showToast("Administrator role required to update duplicate rules", "error");
      return;
    }
    setIsSavingDuplicates(true);
    try {
      const res = await leadsApi.updateDuplicateSettings(duplicateSettings);
      setDuplicateSettings(res);
      showToast("Duplicate rules saved permanently in database");
    } catch (err: any) {
      showToast(err.message || "Failed to save duplicate rules", "error");
    } finally {
      setIsSavingDuplicates(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "#F8FAFC" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <RefreshCw className="animate-spin" size={32} color="#0D9488" />
          <span style={{ fontSize: "0.875rem", color: "#64748B", fontWeight: 600 }}>Loading Admin Settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F8FAFC", width: "100%" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.25rem",
            borderRadius: "8px",
            backgroundColor: toastMessage.type === "error" ? "#FEF2F2" : "#F0FDF4",
            border: `1px solid ${toastMessage.type === "error" ? "#FCA5A5" : "#86EFAC"}`,
            color: toastMessage.type === "error" ? "#991B1B" : "#166534",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {toastMessage.type === "error" ? <AlertCircle size={18} color="#DC2626" /> : <CheckCircle2 size={18} color="#059669" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Persistent Sidebar */}
      <Sidebar
        activeTab="admin-settings"
        onSelectTab={handleSelectTab}
        user={currentUser}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main Admin Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: "100vh" }}>
        {/* Top Header */}
        <header
          style={{
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #E2E8F0",
            padding: "1rem 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <Settings size={22} color="#0D9488" />
              <h1 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                Admin & Workspace Settings
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748B" }}>
              Configure custom business attributes, pipelines, tags, duplicate checks, and team roles.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "999px",
                backgroundColor: isAdmin ? "#CCFBF1" : "#FEF3C7",
                color: isAdmin ? "#0F766E" : "#92400E",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {isAdmin ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
              <span>{isAdmin ? "Administrator Access" : "Read-Only (Sales Rep)"}</span>
            </div>

            <button
              onClick={loadAllData}
              disabled={isLoading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.45rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Access Warning if not admin */}
        {!isAdmin && (
          <div
            style={{
              margin: "1.5rem 2rem 0",
              padding: "0.875rem 1.25rem",
              backgroundColor: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              color: "#92400E",
              fontSize: "0.8125rem",
            }}
          >
            <Info size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Limited View:</strong> You are currently logged in with the <strong>Sales Representative</strong> role. Viewing configuration is enabled, but updating or deleting system settings requires <strong>Administrator</strong> privileges.
            </div>
          </div>
        )}

        {/* Content Body */}
        <div style={{ padding: "1.5rem 2rem", flex: 1, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Tab Navigation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              borderBottom: "1px solid #E2E8F0",
              paddingBottom: "0.25rem",
              overflowX: "auto",
            }}
          >
            {[
              { id: "custom_fields", label: "Custom Fields", icon: Sliders, count: customFields.length },
              { id: "statuses", label: "Lead Statuses", icon: Layers, count: statuses.length },
              { id: "sources", label: "Lead Sources", icon: FileSpreadsheet, count: sources.length },
              { id: "tags", label: "Tags & Labels", icon: Tag, count: tags.length },
              { id: "duplicates", label: "Duplicate Rules", icon: Copy, count: null },
              { id: "team", label: "Team Members & Roles", icon: Users, count: teamUsers.length },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.55rem 1rem",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "0.8125rem",
                    fontWeight: isActive ? 700 : 500,
                    backgroundColor: isActive ? "#0D9488" : "transparent",
                    color: isActive ? "#FFFFFF" : "#64748B",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  <TabIcon size={16} />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: "999px",
                        fontSize: "0.6875rem",
                        backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "#E2E8F0",
                        color: isActive ? "#FFFFFF" : "#475569",
                        fontWeight: 700,
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: CUSTOM FIELDS */}
          {activeTab === "custom_fields" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "1.5rem" }}>
              {/* Left Column: Create Form */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <Plus size={18} color="#0D9488" />
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "#0F172A" }}>
                    Define New Business Custom Field
                  </h3>
                </div>

                <form onSubmit={handleCreateCustomField} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                        Field Label *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Project Budget"
                        value={newCustomField.field_label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewCustomField({
                            ...newCustomField,
                            field_label: val,
                            field_key: val.toLowerCase().replace(/[^a-z0-9]/g, "_"),
                          });
                        }}
                        disabled={!isAdmin}
                        style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                        Field Key / Slug *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="project_budget"
                        value={newCustomField.field_key}
                        onChange={(e) => setNewCustomField({ ...newCustomField, field_key: e.target.value })}
                        disabled={!isAdmin}
                        style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem", fontFamily: "monospace" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                        Field Type
                      </label>
                      <select
                        value={newCustomField.field_type}
                        onChange={(e) => setNewCustomField({ ...newCustomField, field_type: e.target.value })}
                        disabled={!isAdmin}
                        style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                      >
                        <option value="Text">Text</option>
                        <option value="Long Text">Long Text</option>
                        <option value="Number">Number</option>
                        <option value="Currency">Currency</option>
                        <option value="Phone">Phone</option>
                        <option value="Email">Email</option>
                        <option value="Date">Date</option>
                        <option value="Date & Time">Date & Time</option>
                        <option value="Dropdown">Dropdown</option>
                        <option value="Multi-select">Multi-select</option>
                        <option value="Checkbox">Checkbox</option>
                        <option value="URL">URL</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                        Section Group
                      </label>
                      <input
                        type="text"
                        placeholder="Custom Details"
                        value={newCustomField.section}
                        onChange={(e) => setNewCustomField({ ...newCustomField, section: e.target.value })}
                        disabled={!isAdmin}
                        style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                      />
                    </div>
                  </div>

                  {["Dropdown", "Multi-select"].includes(newCustomField.field_type) && (
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                        Options (Comma-separated)
                      </label>
                      <input
                        type="text"
                        placeholder="Enterprise, Mid-Market, SMB"
                        value={newCustomField.options}
                        onChange={(e) => setNewCustomField({ ...newCustomField, options: e.target.value })}
                        disabled={!isAdmin}
                        style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                      />
                    </div>
                  )}

                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "#334155", cursor: "pointer", marginTop: "0.25rem" }}>
                    <input
                      type="checkbox"
                      checked={newCustomField.required}
                      onChange={(e) => setNewCustomField({ ...newCustomField, required: e.target.checked })}
                      disabled={!isAdmin}
                    />
                    <span>Mark as required field on lead forms</span>
                  </label>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                    <button
                      type="submit"
                      disabled={!isAdmin}
                      style={{
                        padding: "0.55rem 1.25rem",
                        borderRadius: "6px",
                        backgroundColor: isAdmin ? "#0D9488" : "#94A3B8",
                        color: "#FFFFFF",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: isAdmin ? "pointer" : "not-allowed",
                      }}
                    >
                      Save Custom Field
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Active Fields List */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "#0F172A" }}>
                    Active Custom Fields ({customFields.length})
                  </h3>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", overflowY: "auto", maxHeight: "550px" }}>
                  {customFields.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.8125rem" }}>
                      No custom fields defined yet.
                    </div>
                  ) : (
                    customFields.map((cf) => (
                      <div
                        key={cf.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.75rem 1rem",
                          borderRadius: "8px",
                          border: "1px solid #E2E8F0",
                          backgroundColor: "#F8FAFC",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>
                              {cf.field_label}
                            </span>
                            <span style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "#0D9488", backgroundColor: "#CCFBF1", padding: "1px 6px", borderRadius: "4px" }}>
                              {cf.field_key}
                            </span>
                            {cf.required && (
                              <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#DC2626", backgroundColor: "#FEE2E2", padding: "1px 5px", borderRadius: "4px" }}>
                                Required
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "3px" }}>
                            Type: <strong>{cf.field_type}</strong> • Section: {cf.section}
                            {cf.options && cf.options.length > 0 && ` • [${cf.options.join(", ")}]`}
                          </div>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteCustomField(cf.id, cf.field_label)}
                            title="Delete custom field"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#DC2626",
                              padding: "6px",
                              borderRadius: "4px",
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LEAD STATUSES */}
          {activeTab === "statuses" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1.5rem" }}>
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <Plus size={18} color="#0D9488" />
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "#0F172A" }}>
                    Add Lead Status
                  </h3>
                </div>

                <form onSubmit={handleAddStatus} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                      Status Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Contract Signed"
                      value={newStatusInput.name}
                      onChange={(e) => setNewStatusInput({ ...newStatusInput, name: e.target.value })}
                      disabled={!isAdmin}
                      style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                      Status Color Badge
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <input
                        type="color"
                        value={newStatusInput.color}
                        onChange={(e) => setNewStatusInput({ ...newStatusInput, color: e.target.value })}
                        disabled={!isAdmin}
                        style={{ width: "60px", height: "36px", padding: 0, borderRadius: "6px", border: "1px solid #CBD5E1", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "0.8125rem", fontFamily: "monospace", color: "#64748B" }}>
                        {newStatusInput.color}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={!isAdmin}
                      style={{
                        padding: "0.55rem 1.25rem",
                        borderRadius: "6px",
                        backgroundColor: isAdmin ? "#0D9488" : "#94A3B8",
                        color: "#FFFFFF",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: isAdmin ? "pointer" : "not-allowed",
                      }}
                    >
                      Add Status
                    </button>
                  </div>
                </form>
              </div>

              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 1rem", color: "#0F172A" }}>
                  Active Lead Statuses ({statuses.length})
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {statuses.map((st) => (
                    <div
                      key={st.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.625rem 0.875rem",
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#F8FAFC",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: st.color }} />
                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>{st.name}</span>
                        {st.is_default && (
                          <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#0D9488", backgroundColor: "#CCFBF1", padding: "1px 6px", borderRadius: "4px" }}>
                            Default
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteStatus(st.id, st.name)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: "4px" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LEAD SOURCES */}
          {activeTab === "sources" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1.5rem" }}>
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <Plus size={18} color="#0D9488" />
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "#0F172A" }}>
                    Add Lead Source
                  </h3>
                </div>

                <form onSubmit={handleAddSource} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                      Source Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. LinkedIn Ads, Trade Show"
                      value={newSourceInput}
                      onChange={(e) => setNewSourceInput(e.target.value)}
                      disabled={!isAdmin}
                      style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={!isAdmin}
                      style={{
                        padding: "0.55rem 1.25rem",
                        borderRadius: "6px",
                        backgroundColor: isAdmin ? "#0D9488" : "#94A3B8",
                        color: "#FFFFFF",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: isAdmin ? "pointer" : "not-allowed",
                      }}
                    >
                      Add Source
                    </button>
                  </div>
                </form>
              </div>

              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 1rem", color: "#0F172A" }}>
                  Configured Sources ({sources.length})
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {sources.map((src) => (
                    <div
                      key={src.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.625rem 0.875rem",
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#F8FAFC",
                      }}
                    >
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>{src.name}</span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteSource(src.id, src.name)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", padding: "4px" }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TAGS & LABELS */}
          {activeTab === "tags" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1.5rem" }}>
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <Plus size={18} color="#0D9488" />
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "#0F172A" }}>
                    Create Tag
                  </h3>
                </div>

                <form onSubmit={handleAddTag} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                      Tag Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. VIP Client, Urgent"
                      value={newTagInput.name}
                      onChange={(e) => setNewTagInput({ ...newTagInput, name: e.target.value })}
                      disabled={!isAdmin}
                      style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                      Tag Color
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <input
                        type="color"
                        value={newTagInput.color}
                        onChange={(e) => setNewTagInput({ ...newTagInput, color: e.target.value })}
                        disabled={!isAdmin}
                        style={{ width: "60px", height: "36px", padding: 0, borderRadius: "6px", border: "1px solid #CBD5E1", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "0.8125rem", fontFamily: "monospace", color: "#64748B" }}>
                        {newTagInput.color}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={!isAdmin}
                      style={{
                        padding: "0.55rem 1.25rem",
                        borderRadius: "6px",
                        backgroundColor: isAdmin ? "#0D9488" : "#94A3B8",
                        color: "#FFFFFF",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: isAdmin ? "pointer" : "not-allowed",
                      }}
                    >
                      Add Tag
                    </button>
                  </div>
                </form>
              </div>

              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 1rem", color: "#0F172A" }}>
                  Active Tags & Badges ({tags.length})
                </h3>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {tags.map((tg) => (
                    <div
                      key={tg.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.4rem 0.75rem",
                        borderRadius: "999px",
                        backgroundColor: `${tg.color}15`,
                        color: tg.color,
                        border: `1px solid ${tg.color}35`,
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                      }}
                    >
                      <span>{tg.name}</span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteTag(tg.id, tg.name)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: tg.color,
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DUPLICATE PREVENTION RULES */}
          {activeTab === "duplicates" && (
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "1.75rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                maxWidth: "720px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <Copy size={20} color="#0D9488" />
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 800, margin: 0, color: "#0F172A" }}>
                  Workspace Duplicate Check & Prevention Rules
                </h3>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "#64748B", marginBottom: "1.5rem" }}>
                These rules apply universally to Manual Lead Creation, CSV Imports, and Webhook Ingestions.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "1rem",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    backgroundColor: "#F8FAFC",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={duplicateSettings.check_phone}
                    onChange={(e) => setDuplicateSettings({ ...duplicateSettings, check_phone: e.target.checked })}
                    disabled={!isAdmin}
                    style={{ marginTop: "3px" }}
                  />
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>
                      Check Duplicate Phone Number
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                      Normalizes international formats (e.g., +1 (555) 0192 converts to +15550192) and prevents duplicate phone entries.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "1rem",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    backgroundColor: "#F8FAFC",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={duplicateSettings.check_email}
                    onChange={(e) => setDuplicateSettings({ ...duplicateSettings, check_email: e.target.checked })}
                    disabled={!isAdmin}
                    style={{ marginTop: "3px" }}
                  />
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>
                      Check Duplicate Email Address
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                      Performs case-insensitive email matching across existing workspace records.
                    </div>
                  </div>
                </label>

                <div
                  style={{
                    padding: "1rem",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    backgroundColor: "#F8FAFC",
                  }}
                >
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", marginBottom: "0.4rem" }}>
                    Duplicate Enforcement Action
                  </label>
                  <select
                    value={duplicateSettings.action}
                    onChange={(e) => setDuplicateSettings({ ...duplicateSettings, action: e.target.value as any })}
                    disabled={!isAdmin}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  >
                    <option value="prevent">Prevent (Reject with HTTP 409 Conflict)</option>
                    <option value="warn">Warn (Log warning and allow lead creation)</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                  <button
                    onClick={handleSaveDuplicateRules}
                    disabled={!isAdmin || isSavingDuplicates}
                    style={{
                      padding: "0.6rem 1.5rem",
                      borderRadius: "6px",
                      backgroundColor: isAdmin ? "#0D9488" : "#94A3B8",
                      color: "#FFFFFF",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      border: "none",
                      cursor: isAdmin ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    {isSavingDuplicates ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
                    <span>{isSavingDuplicates ? "Saving Rules..." : "Save Duplicate Rules"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: TEAM MEMBERS & ROLES */}
          {activeTab === "team" && (
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "1.5rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 800, margin: 0, color: "#0F172A" }}>
                    Workspace Team & Role Permissions ({teamUsers.length})
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: "#64748B" }}>
                    System privileges: Only <strong>Admin</strong> users can access and modify configuration options.
                  </p>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "#475569" }}>User</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "#475569" }}>Email</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "#475569" }}>Role</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "#475569" }}>User ID</th>
                      <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "#475569" }}>Member Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamUsers.map((u) => {
                      const isUserAdmin = u.role?.toLowerCase() === "admin";
                      return (
                        <tr key={u.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "#0F172A" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                              <div
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "50%",
                                  backgroundColor: isUserAdmin ? "#CCFBF1" : "#E2E8F0",
                                  color: isUserAdmin ? "#0D9488" : "#475569",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 700,
                                  fontSize: "0.75rem",
                                }}
                              >
                                {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                              </div>
                              <span>{u.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: "0.75rem 1rem", color: "#64748B" }}>{u.email}</td>
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: "999px",
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                backgroundColor: isUserAdmin ? "#CCFBF1" : "#F1F5F9",
                                color: isUserAdmin ? "#0F766E" : "#475569",
                              }}
                            >
                              {isUserAdmin ? "Administrator" : "Sales Representative"}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#64748B" }}>#{u.id}</td>
                          <td style={{ padding: "0.75rem 1rem", color: "#64748B" }}>
                            {(u as any).created_at ? new Date((u as any).created_at).toLocaleDateString() : "Active Member"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
