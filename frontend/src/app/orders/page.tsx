"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { SidebarTab } from "@/components/Sidebar";
import {
  ordersApi,
  dealsApi,
  authApi,
  Order,
  OrderItem,
  OrderActivity,
  OrderStage,
  OrderPaymentStatus,
  OrderInvoiceStatus,
  Deal,
  User,
} from "@/lib/api";
import {
  Search,
  Plus,
  RefreshCw,
  X,
  Copy,
  Check,
  Calendar,
  DollarSign,
  User as UserIcon,
  Briefcase,
  FileText,
  Trash2,
  ExternalLink,
  Clock,
  PackageCheck,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ChevronDown,
} from "lucide-react";

const ORDER_STAGES: OrderStage[] = [
  "Not Started",
  "Planning",
  "In Progress",
  "Client Review",
  "Revision/Changes",
  "Delivered",
  "Completed",
];

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Not Started": { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
  "Planning": { bg: "#EEF2FF", text: "#4F46E5", border: "#C7D2FE" },
  "In Progress": { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  "Client Review": { bg: "#FAF5FF", text: "#9333EA", border: "#E9D5FF" },
  "Revision/Changes": { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  "Delivered": { bg: "#ECFEFF", text: "#0891B2", border: "#A5F3FC" },
  "Completed": { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
};

const PAYMENT_COLORS: Record<string, { bg: string; text: string }> = {
  "Unpaid": { bg: "#FEF2F2", text: "#DC2626" },
  "Partially Paid": { bg: "#FFFBEB", text: "#D97706" },
  "Paid": { bg: "#ECFDF5", text: "#059669" },
};

const INVOICE_COLORS: Record<string, { bg: string; text: string }> = {
  "Not Invoiced": { bg: "#F1F5F9", text: "#64748B" },
  "Invoiced": { bg: "#EFF6FF", text: "#2563EB" },
};

export default function OrdersPage() {
  const router = useRouter();

  // Auth & Workspace
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("all");
  const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState<string>("all");

  // Drawer state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"items" | "notes" | "timeline">("items");
  const [drawerNotes, setDrawerNotes] = useState("");
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Create Order Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [wonDeals, setWonDeals] = useState<Deal[]>([]);
  const [selectedWonDealId, setSelectedWonDealId] = useState<number | "">("");
  const [createOrderTitle, setCreateOrderTitle] = useState("");
  const [createDeliveryDate, setCreateDeliveryDate] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  // Copied badge state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Initial Auth & load
  useEffect(() => {
    authApi
      .getMe()
      .then((user) => setCurrentUser(user))
      .catch(() => router.push("/login"));
  }, [router]);

  // Load orders
  const loadOrders = useCallback(async () => {
    try {
      const res = await ordersApi.list({
        search: searchQuery.trim() || undefined,
        stage: selectedStage !== "all" ? selectedStage : undefined,
        payment_status: selectedPaymentStatus !== "all" ? selectedPaymentStatus : undefined,
        invoice_status: selectedInvoiceStatus !== "all" ? selectedInvoiceStatus : undefined,
        limit: 100,
      });

      setOrders(res.items || []);
      setTotalOrders(res.total || 0);
      setTotalValue(res.total_value || 0);
      setStageCounts({
        "Not Started": res.not_started_count,
        "Planning": res.planning_count,
        "In Progress": res.in_progress_count,
        "Client Review": res.client_review_count,
        "Revision/Changes": res.revision_count,
        "Delivered": res.delivered_count,
        "Completed": res.completed_count,
      });
    } catch (err: any) {
      console.error("Failed to load orders:", err);
      showToast(err.message || "Failed to load orders", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, selectedStage, selectedPaymentStatus, selectedInvoiceStatus, showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Load Won Deals for Create Modal
  const loadWonDeals = async () => {
    try {
      const res = await dealsApi.list({ status: "won", limit: 100 });
      setWonDeals(res.items || []);
    } catch (err) {
      console.error("Failed to load won deals:", err);
    }
  };

  const handleOpenCreateModal = () => {
    loadWonDeals();
    setSelectedWonDealId("");
    setCreateOrderTitle("");
    setCreateDeliveryDate("");
    setCreateNotes("");
    setIsCreateModalOpen(true);
  };

  const handleSelectWonDeal = (dealIdStr: string) => {
    const id = Number(dealIdStr);
    setSelectedWonDealId(id || "");
    if (id) {
      const matched = wonDeals.find((d) => d.id === id);
      if (matched) {
        setCreateOrderTitle(`Order - ${matched.name}`);
      }
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWonDealId) {
      showToast("Please select a Won Deal to create an order", "error");
      return;
    }

    setIsCreatingOrder(true);
    try {
      const created = await ordersApi.createFromDeal(Number(selectedWonDealId));
      showToast(`Order ${created.order_number} created successfully!`, "success");
      setIsCreateModalOpen(false);
      loadOrders();
      handleOpenDrawer(created.id);
    } catch (err: any) {
      showToast(err.message || "Failed to create order", "error");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Open Order Drawer
  const handleOpenDrawer = async (orderId: number) => {
    setIsDrawerLoading(true);
    setIsDrawerOpen(true);
    setDrawerTab("items");
    try {
      const fullOrder = await ordersApi.get(orderId);
      setSelectedOrder(fullOrder);
      setDrawerNotes(fullOrder.notes || "");
    } catch (err: any) {
      showToast(err.message || "Failed to fetch order details", "error");
      setIsDrawerOpen(false);
    } finally {
      setIsDrawerLoading(false);
    }
  };

  // Stage change in Drawer (only current stage dropdown)
  const handleChangeStage = async (newStage: string) => {
    if (!selectedOrder) return;
    setIsUpdatingStage(true);
    try {
      const updated = await ordersApi.changeStage(selectedOrder.id, newStage);
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      showToast(`Stage updated to ${newStage}`, "success");
      loadOrders();
    } catch (err: any) {
      showToast(err.message || "Failed to update stage", "error");
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Payment Status update in Drawer
  const handleChangePaymentStatus = async (newPaymentStatus: string) => {
    if (!selectedOrder) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await ordersApi.update(selectedOrder.id, { payment_status: newPaymentStatus });
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      showToast(`Payment status updated to ${newPaymentStatus}`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update payment status", "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Invoice Status update in Drawer
  const handleChangeInvoiceStatus = async (newInvoiceStatus: string) => {
    if (!selectedOrder) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await ordersApi.update(selectedOrder.id, { invoice_status: newInvoiceStatus });
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      showToast(`Invoice status updated to ${newInvoiceStatus}`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update invoice status", "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Save Notes
  const handleSaveNotes = async () => {
    if (!selectedOrder) return;
    try {
      const updated = await ordersApi.update(selectedOrder.id, { notes: drawerNotes });
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      showToast("Notes saved successfully", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to save notes", "error");
    }
  };

  // Delete Order
  const handleDeleteOrder = async (orderId: number) => {
    if (!confirm("Are you sure you want to delete this order? This action cannot be undone.")) return;
    try {
      await ordersApi.delete(orderId);
      showToast("Order deleted successfully", "success");
      if (selectedOrder?.id === orderId) {
        setIsDrawerOpen(false);
        setSelectedOrder(null);
      }
      loadOrders();
    } catch (err: any) {
      showToast(err.message || "Failed to delete order", "error");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatCurrency = (val: number, cur: string = "INR") => {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: cur || "INR",
        maximumFractionDigits: 0,
      }).format(val || 0);
    } catch {
      return `₹${Number(val || 0).toLocaleString("en-IN")}`;
    }
  };

  return (
    <div style={{ display: "flex", width: "100%", minHeight: "100vh", backgroundColor: "#F8FAFC" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 20px",
            borderRadius: "8px",
            backgroundColor: toastMessage.type === "error" ? "#DC2626" : "#0D9488",
            color: "#FFFFFF",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {toastMessage.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab="orders"
        onSelectTab={(tab: SidebarTab) => {
          if (tab === "leads") router.push("/leads");
          else if (tab === "deals") router.push("/deals");
          else if (tab === "quotations") router.push("/quotations");
          else if (tab === "orders") {
            // Already on orders
          } else if (tab === "products") router.push("/products");
          else if (tab === "follow-ups") router.push("/follow-ups");
          else if (tab === "company") router.push("/company");
          else if (tab === "api-keys") router.push("/leads?tab=api-keys");
          else if (tab === "api-docs") router.push("/leads?tab=api-docs");
          else if (tab === "profile") router.push("/leads?tab=profile");
        }}
        ordersCount={totalOrders}
        user={currentUser}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenAdminSettings={() => {}}
      />

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        {/* Top Header */}
        <header
          style={{
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #E2E8F0",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  backgroundColor: "#F0FDFA",
                  color: "#0D9488",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PackageCheck size={20} />
              </div>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                Orders & Fulfillment
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  backgroundColor: "#F1F5F9",
                  color: "#475569",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                }}
              >
                {totalOrders} Orders
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: "4px 0 0 0" }}>
              Track delivery stages, deliverables, client review, and invoicing independently.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => {
                setIsRefreshing(true);
                loadOrders();
              }}
              disabled={isRefreshing}
              style={{
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                backgroundColor: "#FFFFFF",
                color: "#64748B",
                cursor: "pointer",
              }}
              title="Refresh Orders"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>

            <button
              onClick={handleOpenCreateModal}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "#0D9488",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              <Plus size={16} />
              <span>Create Order</span>
            </button>
          </div>
        </header>

        {/* Metric Badges Banner */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #E2E8F0",
            padding: "12px 24px",
            display: "flex",
            gap: "24px",
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>Total Orders:</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>{totalOrders}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>In Progress:</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#2563EB" }}>
              {stageCounts["In Progress"] || 0}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>Client Review:</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#9333EA" }}>
              {stageCounts["Client Review"] || 0}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>Delivered:</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0891B2" }}>
              {stageCounts["Delivered"] || 0}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>Completed:</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#059669" }}>
              {stageCounts["Completed"] || 0}
            </span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "0.8125rem", color: "#64748B" }}>Fulfillment Value:</span>
            <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#0F172A" }}>
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #E2E8F0",
            padding: "12px 24px",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {/* Search Input */}
          <div style={{ position: "relative", minWidth: "260px", flex: "1 1 260px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "10px", color: "#94A3B8" }} />
            <input
              type="text"
              placeholder="Search by order #, title, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                fontSize: "0.8125rem",
                color: "#0F172A",
                outline: "none",
              }}
            />
          </div>

          {/* Payment Status Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>Payment:</span>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #E2E8F0",
                fontSize: "0.8125rem",
                backgroundColor: "#FFFFFF",
                color: "#334155",
              }}
            >
              <option value="all">All Payments</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          {/* Invoice Status Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>Invoice:</span>
            <select
              value={selectedInvoiceStatus}
              onChange={(e) => setSelectedInvoiceStatus(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #E2E8F0",
                fontSize: "0.8125rem",
                backgroundColor: "#FFFFFF",
                color: "#334155",
              }}
            >
              <option value="all">All Invoices</option>
              <option value="Not Invoiced">Not Invoiced</option>
              <option value="Invoiced">Invoiced</option>
            </select>
          </div>
        </div>

        {/* Stage Filter Tabs */}
        <div
          style={{
            backgroundColor: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            padding: "8px 24px",
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setSelectedStage("all")}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "0.8125rem",
              fontWeight: 600,
              border: selectedStage === "all" ? "1px solid #0D9488" : "1px solid transparent",
              backgroundColor: selectedStage === "all" ? "#FFFFFF" : "transparent",
              color: selectedStage === "all" ? "#0D9488" : "#64748B",
              cursor: "pointer",
            }}
          >
            All Stages ({totalOrders})
          </button>
          {ORDER_STAGES.map((st) => {
            const count = stageCounts[st] || 0;
            const isSelected = selectedStage.toLowerCase() === st.toLowerCase();
            return (
              <button
                key={st}
                onClick={() => setSelectedStage(st)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  border: isSelected ? "1px solid #0D9488" : "1px solid transparent",
                  backgroundColor: isSelected ? "#FFFFFF" : "transparent",
                  color: isSelected ? "#0D9488" : "#64748B",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {st} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        {/* Orders Table Container */}
        <main style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {isLoading ? (
            <div style={{ height: "300px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#64748B" }}>
              <RefreshCw size={28} className="animate-spin" color="#0D9488" />
              <p style={{ fontSize: "0.875rem", fontWeight: 600 }}>Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px dashed #CBD5E1",
                padding: "60px 24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#F0FDFA",
                  color: "#0D9488",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px auto",
                }}
              >
                <PackageCheck size={24} />
              </div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" }}>
                No orders found
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#64748B", margin: "0 0 20px 0" }}>
                Orders are automatically created when a Deal is marked Won, or you can create one manually from a Won deal.
              </p>
              <button
                onClick={handleOpenCreateModal}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  backgroundColor: "#0D9488",
                  color: "#FFFFFF",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Create First Order
              </button>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Order #</th>
                    <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Title & Customer</th>
                    <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Linked Deal / Quote</th>
                    <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Stage</th>
                    <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payment</th>
                    <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Invoice</th>
                    <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Amount</th>
                    <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Delivery Date</th>
                    <th style={{ padding: "12px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((ord) => {
                    const stageStyle = STAGE_COLORS[ord.stage] || STAGE_COLORS["Not Started"];
                    const payStyle = PAYMENT_COLORS[ord.payment_status] || PAYMENT_COLORS["Unpaid"];
                    const invStyle = INVOICE_COLORS[ord.invoice_status] || INVOICE_COLORS["Not Invoiced"];

                    return (
                      <tr
                        key={ord.id}
                        onClick={() => handleOpenDrawer(ord.id)}
                        style={{
                          borderBottom: "1px solid #F1F5F9",
                          cursor: "pointer",
                          transition: "background-color 0.1s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        {/* Order Number */}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0D9488", fontFamily: "monospace" }}>
                              {ord.order_number}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(ord.order_number, String(ord.id));
                              }}
                              style={{
                                border: "none",
                                background: "none",
                                cursor: "pointer",
                                color: "#94A3B8",
                                padding: "2px",
                              }}
                              title="Copy order number"
                            >
                              {copiedId === String(ord.id) ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>

                        {/* Title & Customer */}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
                            {ord.title}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                            {ord.customer?.name} {ord.customer?.company ? `• ${ord.customer.company}` : ""}
                          </div>
                        </td>

                        {/* Linked Deal / Quote */}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {ord.deal && (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push("/deals");
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.6875rem",
                                  fontWeight: 600,
                                  color: "#0369A1",
                                  backgroundColor: "#F0F9FF",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  width: "fit-content",
                                }}
                              >
                                <Briefcase size={10} />
                                {ord.deal.deal_number}
                              </span>
                            )}
                            {ord.quotation && (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push("/quotations");
                                }}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.6875rem",
                                  fontWeight: 600,
                                  color: "#7C3AED",
                                  backgroundColor: "#FAF5FF",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  width: "fit-content",
                                }}
                              >
                                <FileText size={10} />
                                {ord.quotation.quotation_number}
                              </span>
                            )}
                            {!ord.deal && !ord.quotation && (
                              <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>—</span>
                            )}
                          </div>
                        </td>

                        {/* Stage */}
                        <td style={{ padding: "14px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              backgroundColor: stageStyle.bg,
                              color: stageStyle.text,
                              border: `1px solid ${stageStyle.border}`,
                            }}
                          >
                            {ord.stage}
                          </span>
                        </td>

                        {/* Payment Status */}
                        <td style={{ padding: "14px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              backgroundColor: payStyle.bg,
                              color: payStyle.text,
                            }}
                          >
                            {ord.payment_status}
                          </span>
                        </td>

                        {/* Invoice Status */}
                        <td style={{ padding: "14px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              backgroundColor: invStyle.bg,
                              color: invStyle.text,
                            }}
                          >
                            {ord.invoice_status}
                          </span>
                        </td>

                        {/* Amount */}
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>
                            {formatCurrency(ord.total_amount, ord.currency)}
                          </span>
                        </td>

                        {/* Delivery Date */}
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontSize: "0.8125rem", color: ord.delivery_date ? "#334155" : "#94A3B8" }}>
                            {ord.delivery_date || "Not set"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDrawer(ord.id);
                              }}
                              style={{
                                border: "none",
                                background: "none",
                                cursor: "pointer",
                                color: "#0D9488",
                                padding: "4px",
                              }}
                              title="View Order Details"
                            >
                              <ExternalLink size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOrder(ord.id);
                              }}
                              style={{
                                border: "none",
                                background: "none",
                                cursor: "pointer",
                                color: "#DC2626",
                                padding: "4px",
                              }}
                              title="Delete Order"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Slide-over Order Details Drawer */}
      {isDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(2px)",
          }}
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            style={{
              width: "560px",
              maxWidth: "100%",
              height: "100%",
              backgroundColor: "#FFFFFF",
              boxShadow: "-10px 0 25px rgba(0,0,0,0.1)",
              display: "flex",
              flexDirection: "column",
              animation: "slideInRight 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {isDrawerLoading || !selectedOrder ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RefreshCw size={28} className="animate-spin" color="#0D9488" />
              </div>
            ) : (
              <>
                {/* Drawer Header */}
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 800, color: "#0D9488", fontFamily: "monospace" }}>
                        {selectedOrder.order_number}
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          backgroundColor: STAGE_COLORS[selectedOrder.stage]?.bg || "#F1F5F9",
                          color: STAGE_COLORS[selectedOrder.stage]?.text || "#475569",
                        }}
                      >
                        {selectedOrder.stage}
                      </span>
                    </div>

                    <button
                      onClick={() => setIsDrawerOpen(false)}
                      style={{ border: "none", background: "none", cursor: "pointer", color: "#64748B" }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" }}>
                    {selectedOrder.title}
                  </h2>

                  <div style={{ fontSize: "0.8125rem", color: "#64748B" }}>
                    Customer: <span style={{ fontWeight: 600, color: "#1E293B" }}>{selectedOrder.customer?.name}</span>
                    {selectedOrder.customer?.company && ` • ${selectedOrder.customer.company}`}
                  </div>

                  {/* Cross-entity links */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                    {selectedOrder.deal && (
                      <span
                        onClick={() => router.push("/deals")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "#0284C7",
                          backgroundColor: "#F0F9FF",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <Briefcase size={12} />
                        Deal {selectedOrder.deal.deal_number} ↗
                      </span>
                    )}

                    {selectedOrder.quotation && (
                      <span
                        onClick={() => router.push("/quotations")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "#7C3AED",
                          backgroundColor: "#FAF5FF",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        <FileText size={12} />
                        Quote {selectedOrder.quotation.quotation_number} ↗
                      </span>
                    )}
                  </div>
                </div>

                {/* Stage & Status Controls (Requirement: Single stage dropdown, not full pipeline) */}
                <div
                  style={{
                    padding: "16px 24px",
                    backgroundColor: "#F8FAFC",
                    borderBottom: "1px solid #E2E8F0",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "12px",
                  }}
                >
                  {/* Current Stage Dropdown */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Current Stage
                    </label>
                    <div style={{ position: "relative" }}>
                      <select
                        value={selectedOrder.stage}
                        disabled={isUpdatingStage}
                        onChange={(e) => handleChangeStage(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 24px 7px 10px",
                          borderRadius: "6px",
                          fontSize: "0.8125rem",
                          fontWeight: 700,
                          backgroundColor: "#FFFFFF",
                          color: STAGE_COLORS[selectedOrder.stage]?.text || "#0F172A",
                          border: `1px solid ${STAGE_COLORS[selectedOrder.stage]?.border || "#CBD5E1"}`,
                          cursor: "pointer",
                        }}
                      >
                        {ORDER_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} style={{ position: "absolute", right: "8px", top: "10px", pointerEvents: "none", color: "#64748B" }} />
                    </div>
                  </div>

                  {/* Independent Payment Status Dropdown */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Payment Status
                    </label>
                    <select
                      value={selectedOrder.payment_status}
                      disabled={isUpdatingStatus}
                      onChange={(e) => handleChangePaymentStatus(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        backgroundColor: "#FFFFFF",
                        color: PAYMENT_COLORS[selectedOrder.payment_status]?.text || "#334155",
                        border: "1px solid #E2E8F0",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Unpaid">Unpaid</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>

                  {/* Independent Invoice Status Dropdown */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Invoice Status
                    </label>
                    <select
                      value={selectedOrder.invoice_status}
                      disabled={isUpdatingStatus}
                      onChange={(e) => handleChangeInvoiceStatus(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        backgroundColor: "#FFFFFF",
                        color: INVOICE_COLORS[selectedOrder.invoice_status]?.text || "#334155",
                        border: "1px solid #E2E8F0",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Not Invoiced">Not Invoiced</option>
                      <option value="Invoiced">Invoiced</option>
                    </select>
                  </div>
                </div>

                {/* Key Metrics Strip */}
                <div
                  style={{
                    padding: "12px 24px",
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #E2E8F0",
                    fontSize: "0.8125rem",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748B" }}>Total Value: </span>
                    <strong style={{ color: "#0F172A", fontSize: "0.9375rem" }}>
                      {formatCurrency(selectedOrder.total_amount, selectedOrder.currency)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Delivery: </span>
                    <strong style={{ color: "#0F172A" }}>{selectedOrder.delivery_date || "Not set"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Owner: </span>
                    <strong style={{ color: "#0F172A" }}>{selectedOrder.owner?.name || "Unassigned"}</strong>
                  </div>
                </div>

                {/* Drawer Tab Navigation */}
                <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0", padding: "0 24px" }}>
                  <button
                    onClick={() => setDrawerTab("items")}
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: drawerTab === "items" ? "#0D9488" : "#64748B",
                      borderBottom: drawerTab === "items" ? "2px solid #0D9488" : "2px solid transparent",
                      borderTop: "none",
                      borderLeft: "none",
                      borderRight: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                  >
                    Deliverables & Items ({selectedOrder.items?.length || 0})
                  </button>
                  <button
                    onClick={() => setDrawerTab("notes")}
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: drawerTab === "notes" ? "#0D9488" : "#64748B",
                      borderBottom: drawerTab === "notes" ? "2px solid #0D9488" : "2px solid transparent",
                      borderTop: "none",
                      borderLeft: "none",
                      borderRight: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                  >
                    Notes
                  </button>
                  <button
                    onClick={() => setDrawerTab("timeline")}
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: drawerTab === "timeline" ? "#0D9488" : "#64748B",
                      borderBottom: drawerTab === "timeline" ? "2px solid #0D9488" : "2px solid transparent",
                      borderTop: "none",
                      borderLeft: "none",
                      borderRight: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                  >
                    Timeline & History ({selectedOrder.activities?.length || 0})
                  </button>
                </div>

                {/* Drawer Tab Content */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                  {drawerTab === "items" && (
                    <div>
                      {selectedOrder.items && selectedOrder.items.length > 0 ? (
                        <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                            <thead>
                              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                                <th style={{ padding: "8px 12px", textAlign: "left", color: "#64748B" }}>Item</th>
                                <th style={{ padding: "8px 12px", textAlign: "center", color: "#64748B" }}>Qty</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", color: "#64748B" }}>Price</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", color: "#64748B" }}>GST</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", color: "#64748B" }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedOrder.items.map((it) => (
                                <tr key={it.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                  <td style={{ padding: "10px 12px" }}>
                                    <div style={{ fontWeight: 600, color: "#0F172A" }}>{it.name}</div>
                                    {it.description && <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{it.description}</div>}
                                  </td>
                                  <td style={{ padding: "10px 12px", textAlign: "center" }}>{it.quantity}</td>
                                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatCurrency(it.unit_price, selectedOrder.currency)}</td>
                                  <td style={{ padding: "10px 12px", textAlign: "right" }}>{it.gst_rate}%</td>
                                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>
                                    {formatCurrency(it.total_amount, selectedOrder.currency)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "0.875rem" }}>
                          No line items specified for this order.
                        </div>
                      )}
                    </div>
                  )}

                  {drawerTab === "notes" && (
                    <div>
                      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                        Order Delivery Notes & Scope
                      </label>
                      <textarea
                        rows={6}
                        value={drawerNotes}
                        onChange={(e) => setDrawerNotes(e.target.value)}
                        placeholder="Add instructions, client feedback, or delivery constraints..."
                        style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                      />
                      <button
                        onClick={handleSaveNotes}
                        style={{
                          marginTop: "10px",
                          padding: "8px 16px",
                          borderRadius: "6px",
                          backgroundColor: "#0D9488",
                          color: "#FFFFFF",
                          fontWeight: 600,
                          fontSize: "0.8125rem",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Save Notes
                      </button>
                    </div>
                  )}

                  {drawerTab === "timeline" && (
                    <div>
                      {selectedOrder.activities && selectedOrder.activities.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                          {selectedOrder.activities.map((act) => (
                            <div key={act.id} style={{ display: "flex", gap: "12px" }}>
                              <div
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "50%",
                                  backgroundColor: "#F0FDFA",
                                  color: "#0D9488",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <Clock size={14} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A" }}>
                                  {act.title}
                                </div>
                                {act.description && (
                                  <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "2px" }}>
                                    {act.description}
                                  </div>
                                )}
                                <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "4px" }}>
                                  {new Date(act.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: "30px", textAlign: "center", color: "#64748B", fontSize: "0.875rem" }}>
                          No activity events recorded yet.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Drawer Footer */}
                <div
                  style={{
                    padding: "16px 24px",
                    borderTop: "1px solid #E2E8F0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  <button
                    onClick={() => handleDeleteOrder(selectedOrder.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #FECACA",
                      backgroundColor: "#FEF2F2",
                      color: "#DC2626",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                    Delete Order
                  </button>

                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: "#FFFFFF",
                      color: "#475569",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Order Modal (From Won Deals) */}
      {isCreateModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            padding: "16px",
          }}
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            style={{
              width: "500px",
              maxWidth: "100%",
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <PackageCheck size={18} color="#0D9488" />
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "#0F172A" }}>
                  Create Order from Won Deal
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ padding: "20px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Select Won Deal <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <select
                  value={selectedWonDealId}
                  onChange={(e) => handleSelectWonDeal(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.8125rem",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  <option value="">-- Choose a Won Deal --</option>
                  {wonDeals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.deal_number} • {d.name} ({formatCurrency(d.value, d.currency)})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "0.6875rem", color: "#64748B", marginTop: "4px", display: "block" }}>
                  Only deals currently in 'Won' status can be converted to an active delivery order.
                </span>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Order Title
                </label>
                <input
                  type="text"
                  value={createOrderTitle}
                  onChange={(e) => setCreateOrderTitle(e.target.value)}
                  placeholder="Order project title"
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.8125rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={createDeliveryDate}
                  onChange={(e) => setCreateDeliveryDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.8125rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Initial Notes
                </label>
                <textarea
                  rows={3}
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  placeholder="Scope or kickoff instructions..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.8125rem",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    color: "#475569",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOrder || !selectedWonDealId}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "6px",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {isCreatingOrder ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Order"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
