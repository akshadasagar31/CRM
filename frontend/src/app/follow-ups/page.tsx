"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarClock,
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Edit3,
  CheckCircle2,
  Circle,
  AlertCircle,
  AlertTriangle,
  Phone,
  Mail,
  Video,
  MessageCircle,
  CheckSquare,
  Sparkles,
  Users,
  ChevronRight,
  X,
  ExternalLink,
  UserCheck,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  followUpsApi,
  leadsApi,
  authApi,
  getToken,
  getStoredUser,
  FollowUpItem,
  FollowUpsResponse,
  Lead,
  User,
} from "@/lib/api";
import Sidebar, { SidebarTab } from "@/components/Sidebar";

export type FollowUpTab = "all" | "overdue" | "today" | "pending" | "completed";

interface FollowUpsPageProps {
  hideSidebar?: boolean;
  onFollowUpsCountChange?: (count: number) => void;
  onSelectLead?: (leadNumber: string) => void;
}

export default function FollowUpsPage({
  hideSidebar = false,
  onFollowUpsCountChange,
  onSelectLead,
}: FollowUpsPageProps = {}) {
  const router = useRouter();

  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<FollowUpTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Data State
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [counts, setCounts] = useState<{
    all: number;
    overdue: number;
    today: number;
    pending: number;
    completed: number;
  }>({
    all: 0,
    overdue: 0,
    today: 0,
    pending: 0,
    completed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Leads cache for selector
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  // Modals State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<FollowUpItem | null>(null);

  // Form states
  const [scheduleForm, setScheduleForm] = useState({
    lead_number: "",
    title: "",
    follow_up_type: "Call",
    due_date: "",
    notes: "",
  });

  const [editForm, setEditForm] = useState({
    title: "",
    follow_up_type: "Call",
    due_date: "",
    notes: "",
    completed: false,
  });

  const [rescheduleDate, setRescheduleDate] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth & Initial load
  useEffect(() => {
    if (!hideSidebar) {
      router.replace("/leads?tab=follow-ups");
      return;
    }

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      setIsAuthChecking(false);
    }
    authApi
      .getMe()
      .then((u) => setUser(u))
      .catch(() => router.push("/login"))
      .finally(() => setIsAuthChecking(false));

    loadFollowUps();
    loadLeads();
  }, [router, hideSidebar]);

  // Toast Auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
  };

  // Fetch follow-ups
  const loadFollowUps = async (tabToLoad = activeTab) => {
    try {
      setIsLoading(true);
      const res: FollowUpsResponse = await followUpsApi.getAll(tabToLoad);
      setFollowUps(res.items || []);
      if (res.counts) {
        setCounts(res.counts);
        onFollowUpsCountChange?.(res.counts.pending ?? res.counts.all);
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to load follow-ups");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch leads for scheduling dropdown
  const loadLeads = async () => {
    try {
      setIsLoadingLeads(true);
      const res = await leadsApi.getAll({ limit: 100 });
      setLeadsList(res.items || []);
    } catch {
      // ignore silently
    } finally {
      setIsLoadingLeads(false);
    }
  };

  // Change Tab
  const handleTabChange = (tab: FollowUpTab) => {
    setActiveTab(tab);
    loadFollowUps(tab);
  };

  // Filtered Items (Client search & type filter)
  const filteredFollowUps = useMemo(() => {
    return followUps.filter((item) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const leadName = (item.lead_name || "").toLowerCase();
        const title = (item.title || "").toLowerCase();
        const notes = (item.notes || "").toLowerCase();
        const leadNum = (item.lead_number || "").toLowerCase();
        const ownerName = (item.user?.name || "").toLowerCase();
        if (
          !leadName.includes(q) &&
          !title.includes(q) &&
          !notes.includes(q) &&
          !leadNum.includes(q) &&
          !ownerName.includes(q)
        ) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== "all") {
        if ((item.follow_up_type || "").toLowerCase() !== typeFilter.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [followUps, searchQuery, typeFilter]);

  // Open Schedule Modal
  const openScheduleModal = () => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    defaultDate.setHours(10, 0, 0, 0);
    // Format YYYY-MM-DDTHH:mm for datetime-local
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(
      defaultDate.getDate()
    )}T${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`;

    setScheduleForm({
      lead_number: leadsList.length > 0 ? leadsList[0].number : "",
      title: "Follow-up Call",
      follow_up_type: "Call",
      due_date: dateStr,
      notes: "",
    });
    setFormError("");
    setIsScheduleModalOpen(true);
  };

  // Submit Schedule Follow-up
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.lead_number) {
      setFormError("Please select a lead.");
      return;
    }
    if (!scheduleForm.title.trim()) {
      setFormError("Please enter a follow-up title.");
      return;
    }
    if (!scheduleForm.due_date) {
      setFormError("Please choose a date and time.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError("");
      const isoDate = new Date(scheduleForm.due_date).toISOString();
      await followUpsApi.create({
        lead_number: scheduleForm.lead_number,
        title: scheduleForm.title.trim(),
        follow_up_type: scheduleForm.follow_up_type,
        due_date: isoDate,
        notes: scheduleForm.notes.trim() || undefined,
      });

      setIsScheduleModalOpen(false);
      showToast("success", "Follow-up scheduled successfully!");
      loadFollowUps();
    } catch (err: any) {
      setFormError(err.message || "Failed to schedule follow-up");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (item: FollowUpItem) => {
    setActiveItem(item);
    const d = new Date(item.due_date);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;

    setEditForm({
      title: item.title,
      follow_up_type: item.follow_up_type || "Call",
      due_date: dateStr,
      notes: item.notes || "",
      completed: item.completed,
    });
    setFormError("");
    setIsEditModalOpen(true);
  };

  // Submit Edit Follow-up
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    if (!editForm.title.trim()) {
      setFormError("Title cannot be empty.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError("");
      const isoDate = new Date(editForm.due_date).toISOString();
      await followUpsApi.update(activeItem.id, {
        title: editForm.title.trim(),
        follow_up_type: editForm.follow_up_type,
        due_date: isoDate,
        notes: editForm.notes.trim(),
        completed: editForm.completed,
      });

      setIsEditModalOpen(false);
      showToast("success", "Follow-up updated successfully!");
      loadFollowUps();
    } catch (err: any) {
      setFormError(err.message || "Failed to update follow-up");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Reschedule Modal
  const openRescheduleModal = (item: FollowUpItem) => {
    setActiveItem(item);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;

    setRescheduleDate(dateStr);
    setFormError("");
    setIsRescheduleModalOpen(true);
  };

  // Quick Reschedule Shortcuts
  const applyQuickReschedule = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    d.setHours(10, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    setRescheduleDate(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
        d.getMinutes()
      )}`
    );
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !rescheduleDate) return;

    try {
      setIsSubmitting(true);
      setFormError("");
      const isoDate = new Date(rescheduleDate).toISOString();
      await followUpsApi.update(activeItem.id, {
        due_date: isoDate,
        completed: false, // rescheduling implicitly keeps it active/pending
      });

      setIsRescheduleModalOpen(false);
      showToast("success", `Rescheduled "${activeItem.title}" to ${formatDateTime(isoDate)}`);
      loadFollowUps();
    } catch (err: any) {
      setFormError(err.message || "Failed to reschedule");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Complete / Incomplete
  const handleToggleComplete = async (item: FollowUpItem) => {
    try {
      const nextStatus = !item.completed;
      await followUpsApi.update(item.id, {
        completed: nextStatus,
      });
      showToast(
        "success",
        nextStatus ? `Marked "${item.title}" as completed` : `Reopened "${item.title}"`
      );
      loadFollowUps();
    } catch (err: any) {
      showToast("error", err.message || "Failed to update status");
    }
  };

  // Open Delete Modal
  const openDeleteModal = (item: FollowUpItem) => {
    setActiveItem(item);
    setIsDeleteModalOpen(true);
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!activeItem) return;
    try {
      setIsSubmitting(true);
      await followUpsApi.delete(activeItem.id);
      setIsDeleteModalOpen(false);
      showToast("success", "Follow-up deleted successfully.");
      loadFollowUps();
    } catch (err: any) {
      showToast("error", err.message || "Failed to delete follow-up");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Formatting helpers
  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const isOverdue = (item: FollowUpItem) => {
    if (item.completed) return false;
    const due = new Date(item.due_date);
    const now = new Date();
    // Due today check
    if (due.toDateString() === now.toDateString()) return false;
    return due < now;
  };

  const isDueToday = (item: FollowUpItem) => {
    if (item.completed) return false;
    const due = new Date(item.due_date);
    const now = new Date();
    return due.toDateString() === now.toDateString();
  };

  const getTypeIcon = (type: string) => {
    const t = (type || "").toLowerCase();
    if (t.includes("call")) return <Phone size={14} />;
    if (t.includes("email") || t.includes("mail")) return <Mail size={14} />;
    if (t.includes("meet") || t.includes("video")) return <Video size={14} />;
    if (t.includes("whatsapp") || t.includes("chat")) return <MessageCircle size={14} />;
    if (t.includes("demo")) return <Sparkles size={14} />;
    return <CheckSquare size={14} />;
  };

  const getTypeBadgeStyle = (type: string) => {
    const t = (type || "").toLowerCase();
    if (t.includes("call"))
      return { bg: "#EFF6FF", text: "#2563EB", border: "rgba(37, 99, 235, 0.2)" };
    if (t.includes("email") || t.includes("mail"))
      return { bg: "#F5F3FF", text: "#7C3AED", border: "rgba(124, 58, 237, 0.2)" };
    if (t.includes("meet") || t.includes("video"))
      return { bg: "#FDF2F8", text: "#DB2777", border: "rgba(219, 39, 119, 0.2)" };
    if (t.includes("whatsapp") || t.includes("chat"))
      return { bg: "#ECFDF5", text: "#059669", border: "rgba(5, 150, 105, 0.2)" };
    if (t.includes("demo"))
      return { bg: "#FFFBEB", text: "#D97706", border: "rgba(217, 119, 6, 0.2)" };
    return { bg: "#F1F5F9", text: "#475569", border: "rgba(71, 85, 105, 0.2)" };
  };

  // Main UI Content
  const mainContent = (
    <div
      style={{
        flex: 1,
        padding: "1.75rem",
        maxWidth: "1400px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: "1.5rem",
            right: "1.5rem",
            zIndex: 9999,
            backgroundColor: toastMessage.type === "success" ? "#065F46" : "#991B1B",
            color: "#FFFFFF",
            padding: "0.85rem 1.25rem",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            animation: "fadeIn 0.2s ease",
          }}
        >
          {toastMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.5rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.35rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "var(--light-teal)",
                color: "var(--primary-teal)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CalendarClock size={20} />
            </div>
            <h1
              style={{
                fontSize: "1.625rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Follow-ups
            </h1>
          </div>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Centralized schedule of pending calls, demos, and outreach across your workspace leads.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={() => loadFollowUps()}
            disabled={isLoading}
            className="btn btn-secondary"
            title="Refresh list"
            id="btn-refresh-followups"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.6rem 0.9rem",
              fontSize: "0.875rem",
            }}
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={openScheduleModal}
            className="btn btn-primary"
            id="btn-schedule-followup"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.6rem 1.1rem",
              fontSize: "0.875rem",
              fontWeight: 700,
              backgroundColor: "var(--primary-teal)",
              borderColor: "var(--primary-teal)",
            }}
          >
            <Plus size={16} />
            <span>Schedule Follow-up</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation (All, Overdue, Due Today, Pending, Completed) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: "1.25rem",
          overflowX: "auto",
          paddingBottom: "0.25rem",
        }}
        id="followups-tabs-container"
      >
        {[
          { id: "all" as FollowUpTab, label: "All", count: counts.all },
          {
            id: "overdue" as FollowUpTab,
            label: "Overdue",
            count: counts.overdue,
            isWarning: counts.overdue > 0,
          },
          { id: "today" as FollowUpTab, label: "Due Today", count: counts.today },
          { id: "pending" as FollowUpTab, label: "Pending", count: counts.pending },
          { id: "completed" as FollowUpTab, label: "Completed", count: counts.completed },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              id={`tab-followup-${tab.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1rem",
                borderRadius: "var(--radius-md) var(--radius-md) 0 0",
                fontSize: "0.875rem",
                fontWeight: isActive ? 700 : 500,
                color: isActive
                  ? "var(--primary-teal)"
                  : tab.isWarning
                  ? "#DC2626"
                  : "var(--text-secondary)",
                backgroundColor: isActive ? "#FFFFFF" : "transparent",
                borderBottom: isActive ? "2px solid var(--primary-teal)" : "2px solid transparent",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: "9999px",
                  backgroundColor: isActive
                    ? "var(--light-teal)"
                    : tab.isWarning
                    ? "#FEE2E2"
                    : "#F1F5F9",
                  color: isActive
                    ? "var(--primary-teal)"
                    : tab.isWarning
                    ? "#B91C1C"
                    : "var(--text-secondary)",
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem", flex: 1, minWidth: "280px", maxWidth: "560px" }}>
          {/* Search Input */}
          <div
            style={{
              position: "relative",
              flex: 1,
            }}
          >
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "0.85rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Search by lead name, notes, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              id="input-search-followups"
              style={{
                paddingLeft: "2.4rem",
                fontSize: "0.875rem",
                height: "38px",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "0.6rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div style={{ width: "160px" }}>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-select"
              id="select-type-filter"
              style={{ height: "38px", fontSize: "0.875rem" }}
            >
              <option value="all">All Types</option>
              <option value="Call">Calls</option>
              <option value="Email">Emails</option>
              <option value="Meeting">Meetings</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Demo">Demos</option>
              <option value="Task">Tasks</option>
            </select>
          </div>
        </div>

        {/* Quick status summary counter */}
        <div
          style={{
            fontSize: "0.8125rem",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>
            Showing <strong>{filteredFollowUps.length}</strong> follow-ups
          </span>
          {activeTab === "overdue" && counts.overdue > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                color: "#DC2626",
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={14} />
              Action required
            </span>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            className="table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.875rem",
            }}
            id="table-followups"
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "#F8FAFC",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <th style={{ width: "44px", padding: "0.75rem 0.5rem 0.75rem 1rem", textAlign: "center" }}>
                  <span title="Status completion toggle">Done</span>
                </th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  Lead Name
                </th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  Type & Title
                </th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  Date & Time
                </th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  Notes
                </th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  Status
                </th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                  Owner
                </th>
                <th
                  style={{
                    padding: "0.75rem 1rem",
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    textAlign: "right",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "3.5rem 1rem" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.75rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      <RefreshCw size={24} className="animate-spin" color="var(--primary-teal)" />
                      <span>Loading follow-ups...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredFollowUps.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "3.5rem 1rem" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.75rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          backgroundColor: "#F1F5F9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <CalendarClock size={24} />
                      </div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        No follow-ups found
                      </div>
                      <div style={{ fontSize: "0.8125rem", maxWidth: "340px" }}>
                        {searchQuery
                          ? `No follow-ups match "${searchQuery}". Try adjusting your filters.`
                          : activeTab === "overdue"
                          ? "Great job! There are no overdue follow-ups right now."
                          : activeTab === "today"
                          ? "Nothing scheduled for today. Schedule outreach to stay ahead!"
                          : "Schedule a follow-up call, meeting, or demo to keep leads active."}
                      </div>
                      <button
                        onClick={openScheduleModal}
                        className="btn btn-primary"
                        style={{
                          marginTop: "0.5rem",
                          backgroundColor: "var(--primary-teal)",
                          borderColor: "var(--primary-teal)",
                        }}
                      >
                        <Plus size={15} style={{ marginRight: "0.35rem" }} /> Schedule Follow-up
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFollowUps.map((item) => {
                  const overdue = isOverdue(item);
                  const dueToday = isDueToday(item);
                  const typeStyle = getTypeBadgeStyle(item.follow_up_type);

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid var(--border-subtle)",
                        backgroundColor: item.completed
                          ? "rgba(248, 250, 252, 0.6)"
                          : overdue
                          ? "rgba(254, 242, 242, 0.4)"
                          : dueToday
                          ? "rgba(255, 251, 235, 0.3)"
                          : "#FFFFFF",
                        transition: "background-color 0.1s ease",
                      }}
                      className="hover-row"
                    >
                      {/* 1. Quick Complete Checkbox */}
                      <td style={{ textAlign: "center", padding: "0.85rem 0.5rem 0.85rem 1rem" }}>
                        <button
                          onClick={() => handleToggleComplete(item)}
                          title={item.completed ? "Mark as Pending" : "Mark as Completed"}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "2px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: item.completed
                              ? "#10B981"
                              : overdue
                              ? "#EF4444"
                              : "var(--text-muted)",
                          }}
                          id={`toggle-complete-${item.id}`}
                        >
                          {item.completed ? (
                            <CheckCircle2 size={19} />
                          ) : (
                            <Circle size={19} style={{ strokeWidth: 1.75 }} />
                          )}
                        </button>
                      </td>

                      {/* 2. Lead Name & Number */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                            }}
                          >
                            <span>{item.lead_name || item.lead_number}</span>
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              marginTop: "1px",
                            }}
                          >
                            <span>{item.lead_number}</span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Type & Title */}
                      <td style={{ padding: "0.85rem 1rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                backgroundColor: typeStyle.bg,
                                color: typeStyle.text,
                                border: `1px solid ${typeStyle.border}`,
                              }}
                            >
                              {getTypeIcon(item.follow_up_type)}
                              <span>{item.follow_up_type || "Follow-up"}</span>
                            </span>
                          </div>
                          <span
                            style={{
                              fontWeight: 600,
                              color: item.completed ? "var(--text-secondary)" : "var(--text-primary)",
                              textDecoration: item.completed ? "line-through" : "none",
                            }}
                          >
                            {item.title}
                          </span>
                        </div>
                      </td>

                      {/* 4. Date & Time */}
                      <td style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: overdue
                                ? "#DC2626"
                                : dueToday
                                ? "#D97706"
                                : "var(--text-primary)",
                            }}
                          >
                            <Calendar size={13} />
                            <span>{formatDateTime(item.due_date)}</span>
                          </div>

                          {overdue && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.2rem",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                color: "#DC2626",
                              }}
                            >
                              <AlertTriangle size={11} /> Overdue
                            </span>
                          )}
                          {dueToday && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                color: "#D97706",
                              }}
                            >
                              ● Due Today
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Notes */}
                      <td style={{ padding: "0.85rem 1rem", maxWidth: "240px" }}>
                        {item.notes ? (
                          <div
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--text-secondary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={item.notes}
                          >
                            {item.notes}
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                            No notes
                          </span>
                        )}
                      </td>

                      {/* 6. Status */}
                      <td style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>
                        {item.completed ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              backgroundColor: "#ECFDF5",
                              color: "#059669",
                              border: "1px solid rgba(16, 185, 129, 0.25)",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            <Check size={12} /> Completed
                          </span>
                        ) : overdue ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              backgroundColor: "#FEF2F2",
                              color: "#DC2626",
                              border: "1px solid rgba(239, 68, 68, 0.25)",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            <AlertCircle size={12} /> Overdue
                          </span>
                        ) : dueToday ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              backgroundColor: "#FFFBEB",
                              color: "#D97706",
                              border: "1px solid rgba(217, 119, 6, 0.25)",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            <Clock size={12} /> Due Today
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              backgroundColor: "#F1F5F9",
                              color: "#475569",
                              border: "1px solid rgba(71, 85, 105, 0.2)",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            <Clock size={12} /> Pending
                          </span>
                        )}
                      </td>

                      {/* 7. Owner */}
                      <td style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "50%",
                              backgroundColor: "var(--light-teal)",
                              color: "var(--primary-teal)",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {item.user?.name ? item.user.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                            {item.user?.name || "Unassigned"}
                          </span>
                        </div>
                      </td>

                      {/* 8. Actions (Mark complete, Reschedule, Edit, Delete) */}
                      <td style={{ padding: "0.85rem 1rem", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                          {/* Toggle Complete Button */}
                          <button
                            onClick={() => handleToggleComplete(item)}
                            className="btn-icon"
                            title={item.completed ? "Mark Incomplete / Reopen" : "Mark as Complete"}
                            id={`btn-complete-row-${item.id}`}
                            style={{
                              color: item.completed ? "#059669" : "var(--primary-teal)",
                              padding: "5px",
                            }}
                          >
                            {item.completed ? <RotateCcw size={15} /> : <Check size={16} />}
                          </button>

                          {/* Reschedule Button */}
                          <button
                            onClick={() => openRescheduleModal(item)}
                            className="btn-icon"
                            title="Reschedule Date/Time"
                            id={`btn-reschedule-row-${item.id}`}
                            style={{ color: "#D97706", padding: "5px" }}
                          >
                            <CalendarClock size={15} />
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => openEditModal(item)}
                            className="btn-icon"
                            title="Edit details"
                            id={`btn-edit-row-${item.id}`}
                            style={{ color: "var(--text-secondary)", padding: "5px" }}
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => openDeleteModal(item)}
                            className="btn-icon"
                            title="Delete follow-up"
                            id={`btn-delete-row-${item.id}`}
                            style={{ color: "#EF4444", padding: "5px" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: SCHEDULE FOLLOW-UP ================= */}
      {isScheduleModalOpen && (
        <div className="modal-overlay" onClick={() => setIsScheduleModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "540px" }}
          >
            <div className="modal-header">
              <h2
                className="heading-sm"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <CalendarClock size={19} color="var(--primary-teal)" /> Schedule Follow-up
              </h2>
              <button onClick={() => setIsScheduleModalOpen(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* 1. Select Lead */}
                <div className="form-group">
                  <label className="form-label">Lead *</label>
                  <select
                    className="form-select"
                    value={scheduleForm.lead_number}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, lead_number: e.target.value })}
                    required
                    id="select-schedule-lead"
                  >
                    {leadsList.length === 0 ? (
                      <option value="">No leads available</option>
                    ) : (
                      leadsList.map((l) => (
                        <option key={l.number} value={l.number}>
                          {l.name} ({l.number}) {l.city ? `• ${l.city}` : ""}
                        </option>
                      ))
                    )}
                  </select>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Choose the lead to associate with this scheduled touchpoint.
                  </span>
                </div>

                {/* 2. Title */}
                <div className="form-group">
                  <label className="form-label">Follow-up Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Introductory Call, Product Demo, Contract Review"
                    value={scheduleForm.title}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                    required
                    id="input-schedule-title"
                  />
                </div>

                {/* 3. Type & Due Date Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select
                      className="form-select"
                      value={scheduleForm.follow_up_type}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, follow_up_type: e.target.value })
                      }
                      id="select-schedule-type"
                    >
                      <option value="Call">Call</option>
                      <option value="Email">Email</option>
                      <option value="Meeting">Meeting</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Demo">Demo</option>
                      <option value="Task">Task</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date & Time *</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={scheduleForm.due_date}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, due_date: e.target.value })
                      }
                      required
                      id="input-schedule-duedate"
                    />
                  </div>
                </div>

                {/* 4. Notes */}
                <div className="form-group">
                  <label className="form-label">Agenda / Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Agenda, topics to discuss, or prep notes..."
                    value={scheduleForm.notes}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                    id="textarea-schedule-notes"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  id="btn-submit-schedule"
                  style={{
                    backgroundColor: "var(--primary-teal)",
                    borderColor: "var(--primary-teal)",
                  }}
                >
                  {isSubmitting ? "Scheduling..." : "Schedule Follow-up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT FOLLOW-UP ================= */}
      {isEditModalOpen && activeItem && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "540px" }}
          >
            <div className="modal-header">
              <h2
                className="heading-sm"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <Edit3 size={18} color="var(--primary-teal)" /> Edit Follow-up
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div
                  style={{
                    backgroundColor: "#F8FAFC",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "1rem",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Associated Lead:</span>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                    {activeItem.lead_name || activeItem.lead_number} ({activeItem.lead_number})
                  </div>
                </div>

                {/* Title */}
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    required
                    id="input-edit-title"
                  />
                </div>

                {/* Type & Date */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select
                      className="form-select"
                      value={editForm.follow_up_type}
                      onChange={(e) => setEditForm({ ...editForm, follow_up_type: e.target.value })}
                      id="select-edit-type"
                    >
                      <option value="Call">Call</option>
                      <option value="Email">Email</option>
                      <option value="Meeting">Meeting</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Demo">Demo</option>
                      <option value="Task">Task</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date & Time *</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={editForm.due_date}
                      onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                      required
                      id="input-edit-duedate"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    id="textarea-edit-notes"
                  />
                </div>

                {/* Completed Toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    paddingTop: "0.25rem",
                  }}
                >
                  <input
                    type="checkbox"
                    id="checkbox-edit-completed"
                    checked={editForm.completed}
                    onChange={(e) => setEditForm({ ...editForm, completed: e.target.checked })}
                    style={{ width: "16px", height: "16px", accentColor: "var(--primary-teal)" }}
                  />
                  <label
                    htmlFor="checkbox-edit-completed"
                    style={{ fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
                  >
                    Mark as completed
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  id="btn-submit-edit"
                  style={{
                    backgroundColor: "var(--primary-teal)",
                    borderColor: "var(--primary-teal)",
                  }}
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: QUICK RESCHEDULE ================= */}
      {isRescheduleModalOpen && activeItem && (
        <div className="modal-overlay" onClick={() => setIsRescheduleModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "480px" }}
          >
            <div className="modal-header">
              <h2
                className="heading-sm"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <CalendarClock size={19} color="#D97706" /> Reschedule Follow-up
              </h2>
              <button onClick={() => setIsRescheduleModalOpen(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <p style={{ margin: "0 0 1rem 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Rescheduling <strong>"{activeItem.title}"</strong> for{" "}
                  <strong>{activeItem.lead_name || activeItem.lead_number}</strong>.
                </p>

                {/* Quick Presets */}
                <div style={{ marginBottom: "1.25rem" }}>
                  <label className="form-label" style={{ marginBottom: "0.5rem" }}>
                    Quick Presets:
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => applyQuickReschedule(1)}
                      className="btn btn-secondary"
                      style={{ fontSize: "0.8125rem", padding: "0.4rem 0.75rem" }}
                    >
                      +1 Day (Tomorrow)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickReschedule(3)}
                      className="btn btn-secondary"
                      style={{ fontSize: "0.8125rem", padding: "0.4rem 0.75rem" }}
                    >
                      +3 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickReschedule(7)}
                      className="btn btn-secondary"
                      style={{ fontSize: "0.8125rem", padding: "0.4rem 0.75rem" }}
                    >
                      +1 Week
                    </button>
                  </div>
                </div>

                {/* Datetime input */}
                <div className="form-group">
                  <label className="form-label">New Date & Time *</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    required
                    id="input-reschedule-duedate"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsRescheduleModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                  id="btn-submit-reschedule"
                  style={{
                    backgroundColor: "var(--primary-teal)",
                    borderColor: "var(--primary-teal)",
                  }}
                >
                  {isSubmitting ? "Updating..." : "Confirm Reschedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      {isDeleteModalOpen && activeItem && (
        <div className="modal-overlay" onClick={() => setIsDeleteModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "440px" }}
          >
            <div className="modal-header">
              <h2
                className="heading-sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "#DC2626",
                }}
              >
                <Trash2 size={19} color="#DC2626" /> Delete Follow-up
              </h2>
              <button onClick={() => setIsDeleteModalOpen(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                Are you sure you want to permanently delete this follow-up?
              </p>
              <div
                style={{
                  backgroundColor: "#FEF2F2",
                  padding: "0.85rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid #FEE2E2",
                  fontSize: "0.8125rem",
                  color: "#991B1B",
                }}
              >
                <strong>{activeItem.title}</strong>
                <div>Lead: {activeItem.lead_name || activeItem.lead_number}</div>
                <div>Scheduled: {formatDateTime(activeItem.due_date)}</div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteConfirm}
                className="btn"
                id="btn-confirm-delete"
                style={{
                  backgroundColor: "#DC2626",
                  color: "#FFFFFF",
                  borderColor: "#DC2626",
                }}
              >
                {isSubmitting ? "Deleting..." : "Delete Follow-up"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // If hideSidebar is true, render directly inside keep-alive tab
  if (hideSidebar) {
    return mainContent;
  }

  // Otherwise render full standalone page with persistent sidebar
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "var(--bg-page)",
        width: "100%",
      }}
    >
      <Sidebar
        activeTab="follow-ups"
        onSelectTab={(tab) => {
          if (tab === "leads") router.push("/leads");
          else if (tab === "deals") router.push("/deals");
          else if (tab === "products") router.push("/products");
          else if (tab === "quotations") router.push("/quotations");
          else if (tab === "orders") router.push("/orders");
          else if (tab === "company") router.push("/company");
          else if (tab === "api-keys") router.push("/leads?tab=api-keys");
          else if (tab === "api-docs") router.push("/leads?tab=api-docs");
          else if (tab === "profile") router.push("/leads?tab=profile");
        }}
        followUpsCount={counts.pending ?? counts.all}
        user={user}
        onLogout={() => {
          authApi.logout();
          router.push("/login");
        }}
        isCollapsed={false}
        onToggleCollapse={() => {}}
        onOpenAdminSettings={() => {}}
      />
      {mainContent}
    </div>
  );
}
