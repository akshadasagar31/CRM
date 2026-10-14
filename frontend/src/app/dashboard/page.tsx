"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { SidebarTab } from "@/components/Sidebar";
import {
  dashboardApi,
  automationApi,
  followUpsApi,
  authApi,
  DashboardMetrics,
  SalesChartPoint,
  PipelineStageDistribution,
  DashboardActivity,
  AutomatedReminder,
  User,
} from "@/lib/api";
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  Briefcase,
  Receipt,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Calendar,
  Users,
  RefreshCw,
  Zap,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Check,
  Bell,
  Eye,
  Plus,
  ArrowUpRight,
  ShieldAlert,
  Building,
  Sparkles,
  PackageCheck,
} from "lucide-react";

// Format Currency INR
const formatINR = (val: number | null | undefined): string => {
  const num = typeof val === "number" && !isNaN(val) ? val : 0;
  return "₹" + num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Compact Format Currency (e.g. ₹1.2L, ₹50K)
const formatCompactINR = (val: number | null | undefined): string => {
  const num = typeof val === "number" && !isNaN(val) ? val : 0;
  if (num >= 10000000) return "₹" + (num / 10000000).toFixed(1) + "Cr";
  if (num >= 100000) return "₹" + (num / 100000).toFixed(1) + "L";
  if (num >= 1000) return "₹" + (num / 1000).toFixed(1) + "k";
  return "₹" + num.toFixed(0);
};

// Relative Time Helper
const getRelativeTime = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return dateStr;
  }
};

type TimeframeOption = "this_month" | "last_30_days" | "this_quarter" | "this_year" | "all";

// --- Smooth Rolling Animated Counter Component ---
interface AnimatedCounterProps {
  value: number;
  formatter?: (val: number) => string;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

function AnimatedCounter({
  value,
  formatter,
  duration = 750,
  prefix = "",
  suffix = "",
}: AnimatedCounterProps) {
  const target = typeof value === "number" && !isNaN(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState<number>(0);
  const currentValRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const start = currentValRef.current;
    startTimeRef.current = null;

    if (start === target) {
      setDisplayValue(target);
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Smooth cubic-bezier ease out
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * easeOut;
      currentValRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        currentValRef.current = target;
        setDisplayValue(target);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [target, duration]);

  const formatted = formatter ? formatter(displayValue) : Math.round(displayValue).toLocaleString();
  return <span>{prefix}{formatted}{suffix}</span>;
}

// --- Layout-Matched Dashboard Loading Skeleton ---
function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", width: "100%" }}>
      {/* 1. Reminders Skeleton */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "14px",
          border: "1px solid #E2E8F0",
          overflow: "hidden",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="skeleton-shimmer" style={{ width: "240px", height: "20px" }} />
          <div className="skeleton-shimmer" style={{ width: "120px", height: "24px" }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: "100%", height: "48px", borderRadius: "8px" }} />
      </div>

      {/* 2. 6 KPI Cards Grid Skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "1.125rem" }}>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="skeleton-shimmer" style={{ width: "70px", height: "12px" }} />
              <div className="skeleton-shimmer" style={{ width: "32px", height: "32px", borderRadius: "8px" }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: "90px", height: "24px" }} />
            <div className="skeleton-shimmer" style={{ width: "100px", height: "12px" }} />
          </div>
        ))}
      </div>

      {/* 3. Charts Grid Skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.25rem" }}>
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E2E8F0",
            padding: "1.5rem",
            height: "320px",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div className="skeleton-shimmer" style={{ width: "200px", height: "18px" }} />
            <div className="skeleton-shimmer" style={{ width: "120px", height: "16px" }} />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "20px", height: "190px", padding: "0 1rem" }}>
            {[40, 75, 55, 90, 65, 80].map((h, idx) => (
              <div key={idx} style={{ flex: 1, display: "flex", gap: "4px", alignItems: "flex-end", height: "100%" }}>
                <div className="skeleton-shimmer" style={{ width: "50%", height: `${h}%`, borderRadius: "3px 3px 0 0" }} />
                <div className="skeleton-shimmer" style={{ width: "50%", height: `${h * 0.7}%`, borderRadius: "3px 3px 0 0" }} />
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E2E8F0",
            padding: "1.5rem",
            height: "320px",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div className="skeleton-shimmer" style={{ width: "160px", height: "18px" }} />
            <div className="skeleton-shimmer" style={{ width: "70px", height: "16px" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "10px" }}>
            {[80, 50, 65, 30].map((w, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div className="skeleton-shimmer" style={{ width: "80px", height: "12px" }} />
                  <div className="skeleton-shimmer" style={{ width: "50px", height: "12px" }} />
                </div>
                <div className="skeleton-shimmer" style={{ width: `${w}%`, height: "6px", borderRadius: "3px" }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Bottom Activity Skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.25rem" }}>
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E2E8F0",
            padding: "1.5rem",
            minHeight: "260px",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div className="skeleton-shimmer" style={{ width: "160px", height: "18px" }} />
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div className="skeleton-shimmer" style={{ width: "30px", height: "30px", borderRadius: "8px" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                <div className="skeleton-shimmer" style={{ width: "40%", height: "12px" }} />
                <div className="skeleton-shimmer" style={{ width: "75%", height: "10px" }} />
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "14px",
            border: "1px solid #E2E8F0",
            padding: "1.5rem",
            minHeight: "260px",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div className="skeleton-shimmer" style={{ width: "180px", height: "18px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div className="skeleton-shimmer" style={{ height: "40px", borderRadius: "8px" }} />
            <div className="skeleton-shimmer" style={{ height: "40px", borderRadius: "8px" }} />
            <div className="skeleton-shimmer" style={{ height: "40px", borderRadius: "8px" }} />
            <div className="skeleton-shimmer" style={{ height: "40px", borderRadius: "8px" }} />
          </div>
          <div className="skeleton-shimmer" style={{ height: "90px", borderRadius: "10px", marginTop: "6px" }} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  // User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Timeframe Filter State
  const [timeframe, setTimeframe] = useState<TimeframeOption>("this_month");

  // Dashboard Data State
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [salesChart, setSalesChart] = useState<SalesChartPoint[]>([]);
  const [pipelineDist, setPipelineDist] = useState<PipelineStageDistribution[]>([]);
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [reminders, setReminders] = useState<AutomatedReminder[]>([]);

  // UI Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Reminders Filter Tab State
  const [reminderFilter, setReminderFilter] = useState<"all" | "invoice_overdue" | "follow_up_due">("all");
  const [hoveredChartBar, setHoveredChartBar] = useState<number | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Auth Initialization
  useEffect(() => {
    authApi
      .getMe()
      .then((u) => setCurrentUser(u))
      .catch(() => router.push("/login"));
  }, [router]);

  // Load All Dashboard Data
  const loadDashboardData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [mRes, scRes, pdRes, actRes, remRes] = await Promise.all([
        dashboardApi.getMetrics(timeframe),
        dashboardApi.getSalesChart(timeframe),
        dashboardApi.getPipelineDistribution(),
        dashboardApi.getActivities(15),
        automationApi.listReminders("active", 30),
      ]);

      setMetrics(mRes);
      setSalesChart(scRes || []);
      setPipelineDist(pdRes || []);
      setActivities(actRes || []);
      setReminders(remRes || []);
    } catch (err: any) {
      showToast(err.message || "Failed to load dashboard data", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Run On-Demand Automation Check
  const handleTriggerAutomationCheck = async () => {
    setIsEvaluating(true);
    try {
      const res = await automationApi.evaluateReminders();
      showToast(`Automation scan complete: ${res.reminders_synced_or_found} reminder(s) checked.`);
      // Reload reminders and metrics
      const rems = await automationApi.listReminders("active", 30);
      setReminders(rems || []);
      const mRes = await dashboardApi.getMetrics(timeframe);
      setMetrics(mRes);
    } catch (err: any) {
      showToast(err.message || "Failed to run automated reminder check", "error");
    } finally {
      setIsEvaluating(false);
    }
  };

  // Update Reminder Status (Snooze or Dismiss)
  const handleUpdateReminder = async (
    id: number,
    status: "snoozed" | "dismissed" | "resolved",
    snoozeHours?: number
  ) => {
    try {
      await automationApi.updateStatus(id, status, snoozeHours);
      showToast(status === "snoozed" ? "Reminder snoozed for 24h" : "Reminder dismissed");
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      showToast(err.message || "Failed to update reminder", "error");
    }
  };

  // Complete Follow-Up from Reminder
  const handleCompleteFollowUp = async (reminder: AutomatedReminder) => {
    try {
      const followUpId = parseInt(reminder.entity_id, 10);
      if (!isNaN(followUpId)) {
        await followUpsApi.update(followUpId, { completed: true });
      }
      await automationApi.updateStatus(reminder.id, "resolved");
      showToast("Follow-up marked completed and reminder resolved!");
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
      loadDashboardData();
    } catch (err: any) {
      showToast(err.message || "Failed to complete follow-up", "error");
    }
  };

  // Filtered Reminders
  const filteredReminders = useMemo(() => {
    if (reminderFilter === "all") return reminders;
    return reminders.filter((r) => r.reminder_type === reminderFilter);
  }, [reminders, reminderFilter]);

  // Chart Max Computation for Scaled Heights
  const chartMaxVal = useMemo(() => {
    let max = 1000;
    salesChart.forEach((pt) => {
      if (pt.invoiced_amount > max) max = pt.invoiced_amount;
      if (pt.received_amount > max) max = pt.received_amount;
    });
    return max * 1.15; // 15% headroom
  }, [salesChart]);

  // Pipeline Stage Total Value Sum
  const totalPipelineSum = useMemo(() => {
    return pipelineDist.reduce((acc, curr) => acc + curr.total_value, 0);
  }, [pipelineDist]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "Inter, sans-serif" }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            backgroundColor: toastMessage.type === "success" ? "#065F46" : "#991B1B",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: 500,
            fontSize: "0.875rem",
          }}
        >
          {toastMessage.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Unified Sidebar */}
      <Sidebar
        activeTab="dashboard"
        onSelectTab={(tab: SidebarTab) => {
          if (tab === "dashboard") {
            // Already on dashboard
          } else if (tab === "leads") router.push("/leads");
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
        }}
        remindersCount={reminders.length > 0 ? reminders.length : undefined}
        user={currentUser}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenAdminSettings={() => router.push("/leads?tab=profile")}
      />

      {/* Main Dashboard Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        {/* Top Header Bar */}
        <header
          style={{
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #E2E8F0",
            padding: "1rem 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #0D9488 0%, #2563EB 100%)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(13, 148, 136, 0.25)",
              }}
            >
              <LayoutDashboard size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                Executive Dashboard & Reporting
              </h1>
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748B" }}>
                Live pipeline analytics, collections health, sales charts, and automated reminders
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {/* Run Automation Check Button */}
            <button
              onClick={handleTriggerAutomationCheck}
              disabled={isEvaluating}
              title="Evaluate overdue invoices and follow-ups"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                color: "#0F766E",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: isEvaluating ? "not-allowed" : "pointer",
              }}
            >
              <Zap size={15} className={isEvaluating ? "spin-animation" : ""} style={{ color: "#0D9488" }} />
              <span>{isEvaluating ? "Scanning..." : "Sync Reminders"}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={loadDashboardData}
              disabled={isRefreshing}
              title="Refresh dashboard metrics"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                backgroundColor: "#FFFFFF",
                color: "#475569",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={15} className={isRefreshing ? "spin-animation" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Scrollable Dashboard Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.75rem 2rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {/* Timeframe Filter Pills */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "0.75rem 1.25rem",
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={16} style={{ color: "#0D9488" }} />
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1E293B" }}>Reporting Timeframe:</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {[
                { id: "this_month", label: "This Month" },
                { id: "last_30_days", label: "Last 30 Days" },
                { id: "this_quarter", label: "This Quarter" },
                { id: "this_year", label: "This Year" },
                { id: "all", label: "All Time" },
              ].map((opt) => {
                const isActive = timeframe === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setTimeframe(opt.id as TimeframeOption)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      border: isActive ? "1px solid #0D9488" : "1px solid #E2E8F0",
                      backgroundColor: isActive ? "#F0FDFA" : "#FFFFFF",
                      color: isActive ? "#0D9488" : "#475569",
                      fontSize: "0.8125rem",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timeframe Shimmer Bar during background refresh */}
          {isRefreshing && !isLoading && (
            <div
              style={{
                height: "3px",
                width: "100%",
                backgroundColor: "#F1F5F9",
                borderRadius: "2px",
                overflow: "hidden",
                marginTop: "-0.75rem",
                marginBottom: "-0.5rem",
              }}
            >
              <div
                className="skeleton-shimmer"
                style={{
                  height: "100%",
                  width: "100%",
                  backgroundColor: "#0D9488",
                  borderRadius: "2px",
                }}
              />
            </div>
          )}

          {isLoading ? (
            <DashboardSkeleton />
          ) : (
            <>
              {/* 1. Automated Reminders & Action Center Section */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "14px",
                  border: "1px solid #E2E8F0",
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                {/* Action Center Header Bar */}
                <div
                  style={{
                    padding: "1rem 1.25rem",
                    borderBottom: "1px solid #F1F5F9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: "#FAF5FF",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        backgroundColor: "#EDE9FE",
                        color: "#7C3AED",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Bell size={18} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#4C1D95", margin: 0 }}>
                          Automated Reminders & Action Center
                        </h2>
                        {reminders.length > 0 && (
                          <span
                            style={{
                              backgroundColor: "#EF4444",
                              color: "#FFFFFF",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "10px",
                            }}
                          >
                            {reminders.length} Active
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#6B21A8" }}>
                        Intelligent alerts for overdue invoices and scheduled follow-ups
                      </p>
                    </div>
                  </div>

                  {/* Reminder Tabs Filter */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      onClick={() => setReminderFilter("all")}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        backgroundColor: reminderFilter === "all" ? "#7C3AED" : "transparent",
                        color: reminderFilter === "all" ? "#FFFFFF" : "#6B21A8",
                      }}
                    >
                      All ({reminders.length})
                    </button>
                    <button
                      onClick={() => setReminderFilter("invoice_overdue")}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        backgroundColor: reminderFilter === "invoice_overdue" ? "#7C3AED" : "transparent",
                        color: reminderFilter === "invoice_overdue" ? "#FFFFFF" : "#6B21A8",
                      }}
                    >
                      Invoices ({reminders.filter((r) => r.reminder_type === "invoice_overdue").length})
                    </button>
                    <button
                      onClick={() => setReminderFilter("follow_up_due")}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        backgroundColor: reminderFilter === "follow_up_due" ? "#7C3AED" : "transparent",
                        color: reminderFilter === "follow_up_due" ? "#FFFFFF" : "#6B21A8",
                      }}
                    >
                      Follow-ups ({reminders.filter((r) => r.reminder_type === "follow_up_due").length})
                    </button>
                  </div>
                </div>

                {/* Reminders List Body */}
                <div style={{ padding: "1rem 1.25rem", maxHeight: "280px", overflowY: "auto" }}>
                  {filteredReminders.length === 0 ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                      <CheckCircle2 size={20} />
                      <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                        All caught up! No overdue invoices or pending follow-ups requiring attention.
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {filteredReminders.map((rem) => {
                        const isOverdue = rem.reminder_type === "invoice_overdue";
                        return (
                          <div
                            key={rem.id}
                            className="dashboard-row-hover"
                            style={{
                              backgroundColor: isOverdue ? "#FFF1F2" : "#FFFBEB",
                              border: isOverdue ? "1px solid #FECDD3" : "1px solid #FDE68A",
                              borderRadius: "10px",
                              padding: "10px 14px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "12px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "8px",
                                  backgroundColor: isOverdue ? "#FEE2E2" : "#FEF3C7",
                                  color: isOverdue ? "#E11D48" : "#D97706",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {isOverdue ? <Receipt size={17} /> : <Calendar size={17} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: isOverdue ? "#9F1239" : "#92400E" }}>
                                    {rem.title}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "0.6875rem",
                                      fontWeight: 700,
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      backgroundColor: isOverdue ? "#E11D48" : "#D97706",
                                      color: "#FFFFFF",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {rem.severity}
                                  </span>
                                </div>
                                <div style={{ fontSize: "0.8125rem", color: isOverdue ? "#881337" : "#78350F", marginTop: "2px" }}>
                                  {rem.message}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                              {isOverdue ? (
                                <>
                                  <button
                                    onClick={() => router.push(`/payments`)}
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: "6px",
                                      border: "none",
                                      backgroundColor: "#E11D48",
                                      color: "#FFFFFF",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <CreditCard size={13} />
                                    <span>Record Payment</span>
                                  </button>
                                  <button
                                    onClick={() => router.push(`/invoices?search=${encodeURIComponent(rem.entity_id)}`)}
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: "6px",
                                      border: "1px solid #FDA4AF",
                                      backgroundColor: "#FFFFFF",
                                      color: "#9F1239",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    View Invoice
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleCompleteFollowUp(rem)}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor: "#0D9488",
                                    color: "#FFFFFF",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                >
                                  <Check size={13} />
                                  <span>Mark Complete</span>
                                </button>
                              )}

                              {/* Snooze & Dismiss */}
                              <button
                                onClick={() => handleUpdateReminder(rem.id, "snoozed", 24)}
                                title="Snooze reminder for 24 hours"
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #CBD5E1",
                                  backgroundColor: "#FFFFFF",
                                  color: "#475569",
                                  fontSize: "0.75rem",
                                  fontWeight: 500,
                                  cursor: "pointer",
                                }}
                              >
                                Snooze 24h
                              </button>
                              <button
                                onClick={() => handleUpdateReminder(rem.id, "dismissed")}
                                title="Dismiss reminder"
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#94A3B8",
                                  fontSize: "0.75rem",
                                  cursor: "pointer",
                                  padding: "4px",
                                }}
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Key Metrics KPI Cards Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "1.125rem" }}>
                {/* Card 1: Pipeline Value */}
                <div
                  className="dashboard-kpi-card"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Pipeline Value
                    </span>
                    <div className="kpi-icon-box" style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Briefcase size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#0F172A" }}>
                    <AnimatedCounter value={metrics?.total_pipeline_value || 0} formatter={formatCompactINR} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    <AnimatedCounter value={metrics?.total_deals || 0} /> active deals in pipeline
                  </div>
                </div>

                {/* Card 2: Revenue Collected */}
                <div
                  className="dashboard-kpi-card"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Received Revenue
                    </span>
                    <div className="kpi-icon-box" style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#059669" }}>
                    <AnimatedCounter value={metrics?.total_received || 0} formatter={formatCompactINR} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    Payments collected in period
                  </div>
                </div>

                {/* Card 3: Total Invoiced */}
                <div
                  className="dashboard-kpi-card"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Total Invoiced
                    </span>
                    <div className="kpi-icon-box" style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#0F172A" }}>
                    <AnimatedCounter value={metrics?.total_invoiced || 0} formatter={formatCompactINR} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    Billed across invoices
                  </div>
                </div>

                {/* Card 4: Outstanding Balance */}
                <div
                  className="dashboard-kpi-card"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Outstanding
                    </span>
                    <div className="kpi-icon-box" style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#FEF3C7", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Clock size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#D97706" }}>
                    <AnimatedCounter value={metrics?.outstanding_balance || 0} formatter={formatCompactINR} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    Pending collection balance
                  </div>
                </div>

                {/* Card 5: Overdue Balance */}
                <div
                  className="dashboard-kpi-card"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Overdue Invoices
                    </span>
                    <div className="kpi-icon-box" style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <AlertTriangle size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#DC2626" }}>
                    <AnimatedCounter value={metrics?.overdue_balance || 0} formatter={formatCompactINR} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    Invoices past due date
                  </div>
                </div>

                {/* Card 6: Won Deals / Win Rate */}
                <div
                  className="dashboard-kpi-card"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Won Deals Revenue
                    </span>
                    <div className="kpi-icon-box" style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#CCFBF1", color: "#0F766E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <TrendingUp size={16} />
                    </div>
                  </div>
                  <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#0F766E" }}>
                    <AnimatedCounter value={metrics?.won_deals_value || 0} formatter={formatCompactINR} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    <AnimatedCounter value={metrics?.won_deals_count || 0} /> won (<AnimatedCounter value={metrics?.conversion_rate || 0} formatter={(v) => v.toFixed(0)} />% win rate)
                  </div>
                </div>
              </div>

          {/* 3. Visual Sales Charts Section (2 Columns) */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.25rem" }}>
            {/* Chart 1: Revenue & Collections Trend (Bar Chart SVG) */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "14px",
                border: "1px solid #E2E8F0",
                padding: "1.5rem",
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Revenue & Collections Trend
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748B" }}>
                    Monthly comparison of Invoiced Billed vs Payments Collected
                  </p>
                </div>
                {/* Legend */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "0.75rem", fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: "#3B82F6" }} />
                    <span style={{ color: "#475569" }}>Invoiced</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: "#10B981" }} />
                    <span style={{ color: "#475569" }}>Received</span>
                  </div>
                </div>
              </div>

              {/* Responsive SVG Chart Container */}
              <div style={{ width: "100%", height: "240px", position: "relative", paddingTop: "10px" }}>
                <svg width="100%" height="100%" viewBox="0 0 540 200" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  {[0, 50, 100, 150].map((y) => (
                    <line key={y} x1="30" y1={y} x2="530" y2={y} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                  ))}

                  {/* Monthly Bars */}
                  {salesChart.map((pt, idx) => {
                    const totalBars = salesChart.length;
                    const groupWidth = 480 / totalBars;
                    const xCenter = 40 + idx * groupWidth + groupWidth / 2;

                    const barW = 18;
                    const invH = chartMaxVal > 0 ? (pt.invoiced_amount / chartMaxVal) * 150 : 0;
                    const recH = chartMaxVal > 0 ? (pt.received_amount / chartMaxVal) * 150 : 0;

                    const invY = 170 - invH;
                    const recY = 170 - recH;

                    const isHovered = hoveredChartBar === idx;

                    return (
                      <g
                        key={idx}
                        onMouseEnter={() => setHoveredChartBar(idx)}
                        onMouseLeave={() => setHoveredChartBar(null)}
                        style={{ cursor: "pointer" }}
                      >
                        {/* Invoiced Bar */}
                        <rect
                          className="chart-bar-rect"
                          x={xCenter - barW - 2}
                          y={invY}
                          width={barW}
                          height={Math.max(invH, 2)}
                          rx="3"
                          fill="#3B82F6"
                          opacity={isHovered ? 1 : 0.85}
                          style={{
                            transitionDelay: `${idx * 40}ms`,
                          }}
                        />
                        {/* Received Bar */}
                        <rect
                          className="chart-bar-rect"
                          x={xCenter + 2}
                          y={recY}
                          width={barW}
                          height={Math.max(recH, 2)}
                          rx="3"
                          fill="#10B981"
                          opacity={isHovered ? 1 : 0.85}
                          style={{
                            transitionDelay: `${idx * 40 + 20}ms`,
                          }}
                        />
                        {/* Month Label */}
                        <text
                          x={xCenter}
                          y="190"
                          textAnchor="middle"
                          fontSize="10"
                          fill="#64748B"
                          fontWeight={isHovered ? "bold" : "normal"}
                        >
                          {pt.period.split(" ")[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Floating Tooltip when hovering over a month */}
                {hoveredChartBar !== null && salesChart[hoveredChartBar] && (
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      backgroundColor: "#0F172A",
                      color: "#FFFFFF",
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                      zIndex: 10,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{salesChart[hoveredChartBar].period}:</span>
                    <span>Invoiced: {formatINR(salesChart[hoveredChartBar].invoiced_amount)}</span>
                    <span style={{ color: "#34D399" }}>
                      Received: {formatINR(salesChart[hoveredChartBar].received_amount)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Pipeline Stage Distribution Funnel */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "14px",
                border: "1px solid #E2E8F0",
                padding: "1.5rem",
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Deals by Pipeline Stage
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748B" }}>
                    Stage volume & value across pipeline
                  </p>
                </div>
                <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#2563EB" }}>
                  {formatCompactINR(totalPipelineSum)} Total
                </div>
              </div>

              {/* Stage Progress List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", overflowY: "auto", maxHeight: "240px" }}>
                {pipelineDist.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "#94A3B8", fontSize: "0.8125rem" }}>
                    No deals recorded in pipeline yet.
                  </div>
                ) : (
                  pipelineDist.map((stg, idx) => {
                    const pct = totalPipelineSum > 0 ? (stg.total_value / totalPipelineSum) * 100 : 0;
                    return (
                      <div key={stg.stage_id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: stg.color || "#0D9488" }} />
                            <span style={{ fontWeight: 600, color: "#1E293B" }}>{stg.stage_name}</span>
                            <span style={{ color: "#64748B" }}>({stg.deals_count})</span>
                          </div>
                          <span style={{ fontWeight: 700, color: "#0F172A" }}>
                            {formatCompactINR(stg.total_value)}
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div style={{ width: "100%", height: "6px", backgroundColor: "#F1F5F9", borderRadius: "3px", overflow: "hidden" }}>
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${Math.max(pct, stg.deals_count > 0 ? 5 : 0)}%`,
                              height: "100%",
                              backgroundColor: stg.color || "#0D9488",
                              borderRadius: "3px",
                              transitionDelay: `${idx * 45}ms`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 4. Bottom Grid: Unified Recent Activities Stream & Quick Shortcuts */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.25rem" }}>
            {/* Recent Activities Feed */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "14px",
                border: "1px solid #E2E8F0",
                padding: "1.5rem",
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Live Activity Stream
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748B" }}>
                    Real-time audit events across Payments, Invoices, Deals, and Orders
                  </p>
                </div>
                <span
                  style={{
                    backgroundColor: "#F1F5F9",
                    color: "#475569",
                    padding: "3px 8px",
                    borderRadius: "10px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  Latest {activities.length}
                </span>
              </div>

              {/* Activities List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", maxHeight: "320px", overflowY: "auto" }}>
                {activities.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "#94A3B8", fontSize: "0.8125rem" }}>
                    No recent events logged.
                  </div>
                ) : (
                  activities.map((act) => {
                    const moduleColor =
                      act.module === "Payment"
                        ? { bg: "#ECFDF5", text: "#059669", icon: CreditCard }
                        : act.module === "Invoice"
                        ? { bg: "#EFF6FF", text: "#2563EB", icon: FileText }
                        : act.module === "Deal"
                        ? { bg: "#FAF5FF", text: "#7C3AED", icon: Briefcase }
                        : act.module === "Order"
                        ? { bg: "#FFF7ED", text: "#EA580C", icon: PackageCheck }
                        : { bg: "#F1F5F9", text: "#475569", icon: Calendar };

                    const IconComp = moduleColor.icon;

                    return (
                      <div
                        key={act.id + act.module}
                        className="dashboard-row-hover"
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "6px 8px",
                          borderRadius: "8px",
                          borderBottom: "1px solid #F8FAFC",
                        }}
                      >
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "8px",
                            backgroundColor: moduleColor.bg,
                            color: moduleColor.text,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            marginTop: "2px",
                          }}
                        >
                          <IconComp size={15} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span
                                style={{
                                  fontSize: "0.6875rem",
                                  fontWeight: 700,
                                  backgroundColor: moduleColor.bg,
                                  color: moduleColor.text,
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                {act.module}
                              </span>
                              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#1E293B" }}>
                                {act.title}
                              </span>
                            </div>
                            <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                              {getRelativeTime(act.timestamp)}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.8125rem", color: "#475569", marginTop: "2px", lineHeight: 1.4 }}>
                            {act.description}
                          </div>
                          <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "3px" }}>
                            By {act.user_name || "System"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Operations & System Health Card */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "14px",
                border: "1px solid #E2E8F0",
                padding: "1.5rem",
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  CRM Shortcuts & Modules
                </h3>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748B" }}>
                  Direct jump actions to core workflows
                </p>
              </div>

              {/* Action Buttons Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  onClick={() => router.push("/payments")}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    backgroundColor: "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#0F172A",
                  }}
                >
                  <CreditCard size={16} style={{ color: "#0D9488" }} />
                  <span>Payments Ledger</span>
                </button>

                <button
                  onClick={() => router.push("/invoices")}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    backgroundColor: "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#0F172A",
                  }}
                >
                  <FileText size={16} style={{ color: "#2563EB" }} />
                  <span>Manage Invoices</span>
                </button>

                <button
                  onClick={() => router.push("/deals")}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    backgroundColor: "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#0F172A",
                  }}
                >
                  <Briefcase size={16} style={{ color: "#7C3AED" }} />
                  <span>Deals Pipeline</span>
                </button>

                <button
                  onClick={() => router.push("/follow-ups")}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    backgroundColor: "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#0F172A",
                  }}
                >
                  <Calendar size={16} style={{ color: "#D97706" }} />
                  <span>Follow-ups Tasks</span>
                </button>
              </div>

              {/* Operational Counters Box */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: "10px",
                  padding: "12px",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  fontSize: "0.8125rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                  <span>Total Leads Ingested:</span>
                  <strong style={{ color: "#0F172A" }}>
                    <AnimatedCounter value={metrics?.total_leads || 0} />
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                  <span>Customer Accounts:</span>
                  <strong style={{ color: "#0F172A" }}>
                    <AnimatedCounter value={metrics?.total_customers || 0} />
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                  <span>Pending Follow-ups:</span>
                  <strong style={{ color: metrics?.pending_follow_ups ? "#D97706" : "#059669" }}>
                    <AnimatedCounter value={metrics?.pending_follow_ups || 0} />
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
                  <span>Overdue Follow-ups:</span>
                  <strong style={{ color: metrics?.overdue_follow_ups ? "#DC2626" : "#059669" }}>
                    <AnimatedCounter value={metrics?.overdue_follow_ups || 0} />
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  </div>
</div>
  );
}
