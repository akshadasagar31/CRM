"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { SidebarTab } from "@/components/Sidebar";
import {
  inventoryApi,
  productsApi,
  ordersApi,
  authApi,
  getToken,
  getStoredUser,
  setStoredUser,
  InventoryStats,
  StockMovement,
  Product,
  Order,
  User,
  StockInInput,
  StockAdjustmentInput,
  StockReturnInput,
} from "@/lib/api";
import {
  Search,
  Plus,
  RefreshCw,
  X,
  Boxes,
  Package,
  Layers,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Clock,
  Filter,
  PackageCheck,
  TrendingUp,
  FileText,
  AlertCircle,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from "lucide-react";

export default function InventoryPage() {
  const router = useRouter();

  // Navigation & User State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "movements" | "alerts">("overview");

  // Data State
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [alerts, setAlerts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Modals State
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedProductForAction, setSelectedProductForAction] = useState<Product | null>(null);

  // Form Inputs: Stock In
  const [stockInQty, setStockInQty] = useState<number>(10);
  const [stockInNotes, setStockInNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Inputs: Adjust Stock
  const [adjustMode, setAdjustMode] = useState<"set" | "delta">("set");
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("Quarterly Audit Correction");
  const [adjustNotes, setAdjustNotes] = useState<string>("");

  // Form Inputs: Return Stock
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnOrderId, setReturnOrderId] = useState<string>("");
  const [returnRestock, setReturnRestock] = useState<boolean>(true);
  const [returnCondition, setReturnCondition] = useState<"good" | "damaged" | "scrap">("good");
  const [returnReason, setReturnReason] = useState<string>("Customer Return");
  const [returnNotes, setReturnNotes] = useState<string>("");

  // Check Auth on Mount & fetch authoritative user profile
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    const stored = getStoredUser();
    if (stored) {
      setCurrentUser(stored);
    }
    authApi
      .getMe()
      .then((u) => {
        if (u && u.id) {
          setCurrentUser(u);
          setStoredUser(u);
        }
      })
      .catch((err) => {
        console.warn("Could not refresh user profile:", err);
      });

    const savedCollapse = localStorage.getItem("crm_sidebar_collapsed");
    if (savedCollapse !== null) {
      setIsSidebarCollapsed(savedCollapse === "true");
    }
  }, [router]);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("crm_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  // Fetch Data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, prodRes, movesRes, alertsRes, catsRes, ordersRes] = await Promise.all([
        inventoryApi.getStats().catch(() => null),
        productsApi.list({ limit: 200 }).catch(() => ({ items: [] })),
        inventoryApi.listMovements({ limit: 100 }).catch(() => ({ items: [] })),
        inventoryApi.getAlerts().catch(() => []),
        productsApi.listCategories().catch(() => []),
        ordersApi.list({ limit: 100 }).catch(() => ({ items: [] })),
      ]);

      if (statsRes) setStats(statsRes);
      if (prodRes && prodRes.items) setProducts(prodRes.items);
      if (movesRes && movesRes.items) setMovements(movesRes.items);
      if (alertsRes) setAlerts(alertsRes);
      if (catsRes) setCategories(catsRes);
      if (ordersRes && ordersRes.items) setDeliveredOrders(ordersRes.items);
    } catch (err: any) {
      showToast(err.message || "Failed to load inventory data", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tab Selection
  const handleSelectTab = (tab: SidebarTab) => {
    if (tab === "inventory") return;
    if (tab === "dashboard") router.push("/dashboard");
    else if (tab === "leads") router.push("/leads");
    else if (tab === "deals") router.push("/deals");
    else if (tab === "quotations") router.push("/quotations");
    else if (tab === "orders") router.push("/orders");
    else if (tab === "invoices") router.push("/invoices");
    else if (tab === "payments") router.push("/payments");
    else if (tab === "products") router.push("/products");
    else if (tab === "follow-ups") router.push("/follow-ups");
    else if (tab === "company") router.push("/company");
    else if (tab === "api-keys") router.push("/leads?tab=api-keys");
    else if (tab === "api-docs") router.push("/leads?tab=api-docs");
    else if (tab === "profile") router.push("/leads?tab=profile");
    else if (tab === "admin-settings") router.push("/admin-settings");
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        searchQuery === "" ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCat = selectedCategory === "all" || p.category === selectedCategory;

      const avail = (p.current_stock || 0) - (p.reserved_stock || 0);
      const threshold = p.low_stock_threshold !== undefined ? p.low_stock_threshold : 10;

      let matchStatus = true;
      if (statusFilter === "out_of_stock") {
        matchStatus = avail <= 0;
      } else if (statusFilter === "low_stock") {
        matchStatus = avail > 0 && avail <= threshold;
      } else if (statusFilter === "in_stock") {
        matchStatus = avail > threshold;
      }

      return matchSearch && matchCat && matchStatus;
    });
  }, [products, searchQuery, selectedCategory, statusFilter]);

  // Filtered Movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (movementTypeFilter !== "all" && m.movement_type !== movementTypeFilter) {
        return false;
      }
      if (searchQuery === "") return true;
      const q = searchQuery.toLowerCase();
      const pName = m.product?.name?.toLowerCase() || "";
      const pSku = m.product?.sku?.toLowerCase() || "";
      const refId = m.reference_id?.toLowerCase() || "";
      const notes = m.notes?.toLowerCase() || "";
      return pName.includes(q) || pSku.includes(q) || refId.includes(q) || notes.includes(q);
    });
  }, [movements, movementTypeFilter, searchQuery]);

  // Quick Action Handlers
  const openStockIn = (product?: Product) => {
    setSelectedProductForAction(product || (products.length > 0 ? products[0] : null));
    setStockInQty(10);
    setStockInNotes("");
    setShowStockInModal(true);
  };

  const openAdjust = (product?: Product) => {
    const target = product || (products.length > 0 ? products[0] : null);
    setSelectedProductForAction(target);
    setAdjustMode("set");
    setAdjustQty(target ? target.current_stock || 0 : 0);
    setAdjustReason("Quarterly Audit Correction");
    setAdjustNotes("");
    setShowAdjustModal(true);
  };

  const openReturn = (product?: Product) => {
    setSelectedProductForAction(product || (products.length > 0 ? products[0] : null));
    setReturnQty(1);
    setReturnOrderId("");
    setReturnRestock(true);
    setReturnCondition("good");
    setReturnReason("Customer Return");
    setReturnNotes("");
    setShowReturnModal(true);
  };

  // Submit: Stock In
  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAction) {
      showToast("Please select a product", "error");
      return;
    }
    if (stockInQty <= 0) {
      showToast("Quantity must be greater than zero", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: StockInInput = {
        product_id: selectedProductForAction.id,
        quantity: Number(stockInQty),
        notes: stockInNotes.trim() ? stockInNotes.trim() : undefined,
      };
      await inventoryApi.stockIn(payload);
      showToast(`Stock in of ${stockInQty} units logged successfully!`, "success");
      setShowStockInModal(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || "Failed to stock in units", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit: Adjust Stock
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAction) {
      showToast("Please select a product", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: StockAdjustmentInput = {
        product_id: selectedProductForAction.id,
        adjustment_type: adjustMode,
        quantity: Number(adjustQty),
        reason: adjustReason,
        notes: adjustNotes.trim() ? adjustNotes.trim() : undefined,
      };
      await inventoryApi.adjust(payload);
      showToast("Inventory stock count adjusted successfully!", "success");
      setShowAdjustModal(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || "Failed to adjust stock", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit: Return Stock
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAction) {
      showToast("Please select a product", "error");
      return;
    }
    if (returnQty <= 0) {
      showToast("Quantity must be greater than zero", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: StockReturnInput = {
        product_id: selectedProductForAction.id,
        order_id: returnOrderId ? Number(returnOrderId) : undefined,
        quantity: Number(returnQty),
        restock: returnRestock,
        condition: returnCondition,
        reason: returnReason,
        notes: returnNotes.trim() ? returnNotes.trim() : undefined,
      };
      await inventoryApi.returnStock(payload);
      showToast(
        returnRestock
          ? `Returned ${returnQty} units and restocked to physical inventory!`
          : `Logged return of ${returnQty} units (${returnCondition} - not restocked)`,
        "success"
      );
      setShowReturnModal(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || "Failed to process customer return", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper: Status Badge Styling
  const getStockStatus = (p: Product) => {
    const avail = (p.current_stock || 0) - (p.reserved_stock || 0);
    const threshold = p.low_stock_threshold !== undefined ? p.low_stock_threshold : 10;
    if (avail <= 0) {
      return {
        label: "Out of Stock",
        bg: "#FEF2F2",
        text: "#DC2626",
        border: "#FECACA",
      };
    }
    if (avail <= threshold) {
      return {
        label: "Low Stock",
        bg: "#FFFBEB",
        text: "#D97706",
        border: "#FDE68A",
      };
    }
    return {
      label: "In Stock",
      bg: "#F0FDF4",
      text: "#16A34A",
      border: "#BBF7D0",
    };
  };

  const getMovementBadge = (type: string) => {
    switch (type) {
      case "stock_in":
        return { label: "STOCK IN", bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" };
      case "reserve":
        return { label: "RESERVE", bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" };
      case "release_reservation":
        return { label: "RELEASE", bg: "#F3F4F6", text: "#4B5563", border: "#E5E7EB" };
      case "dispatch":
        return { label: "DISPATCH", bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" };
      case "return":
        return { label: "RETURN", bg: "#FFF7ED", text: "#C2410C", border: "#FFEDD5" };
      case "adjustment":
        return { label: "ADJUST", bg: "#FEFCE8", text: "#A16207", border: "#FEF08A" };
      default:
        return { label: type.toUpperCase(), bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" };
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F8FAFC" }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "24px",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 18px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            backgroundColor:
              toast.type === "success" ? "#065F46" : toast.type === "error" ? "#991B1B" : "#1E293B",
            color: "#FFFFFF",
            fontSize: "0.875rem",
            fontWeight: 500,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {toast.type === "success" && <CheckCircle2 size={18} style={{ color: "#34D399" }} />}
          {toast.type === "error" && <AlertCircle size={18} style={{ color: "#F87171" }} />}
          {toast.type === "info" && <ShieldCheck size={18} style={{ color: "#60A5FA" }} />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              padding: "2px",
              marginLeft: "6px",
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main CRM Sidebar */}
      <Sidebar
        activeTab="inventory"
        onSelectTab={handleSelectTab}
        inventoryCount={alerts.length > 0 ? alerts.length : undefined}
        user={currentUser}
        onLogout={() => {
          authApi.logout();
          router.push("/login");
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        onOpenAdminSettings={() => router.push("/admin-settings")}
      />

      {/* Content Workspace */}
      <main
        style={{
          flex: 1,
          padding: "2rem",
          maxWidth: "1440px",
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  backgroundColor: "#0D9488",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  boxShadow: "0 4px 12px rgba(13, 148, 136, 0.25)",
                }}
              >
                <Boxes size={22} />
              </div>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                Inventory & Stock Management
              </h1>
            </div>
            <p style={{ color: "#64748B", fontSize: "0.9375rem", marginTop: "4px", marginBottom: 0 }}>
              Synchronized real-time inventory tracking connected to Products catalog and Order fulfillment.
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => fetchData()}
              disabled={isLoading}
              title="Refresh inventory data"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                color: "#475569",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>

            <button
              id="btn-return-stock"
              onClick={() => openReturn()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                color: "#C2410C",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RotateCcw size={15} />
              <span>Customer Return</span>
            </button>

            <button
              id="btn-adjust-stock"
              onClick={() => openAdjust()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                color: "#475569",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Sliders size={15} />
              <span>Adjust Stock</span>
            </button>

            <button
              id="btn-stock-in"
              onClick={() => openStockIn()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 18px",
                backgroundColor: "#0D9488",
                border: "1px solid #0D9488",
                borderRadius: "8px",
                color: "#FFFFFF",
                fontSize: "0.875rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(13, 148, 136, 0.3)",
              }}
            >
              <Plus size={16} />
              <span>+ Stock In</span>
            </button>
          </div>
        </div>

        {/* KPI Stat Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          {/* Total Products */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "1.25rem",
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#64748B" }}>CATALOG PRODUCTS</span>
              <Package size={18} style={{ color: "#0D9488" }} />
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0F172A", marginTop: "8px" }}>
              {stats?.total_products || products.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>Active catalog SKUs</div>
          </div>

          {/* Physical On-Hand Units */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "1.25rem",
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#64748B" }}>PHYSICAL ON-HAND</span>
              <Layers size={18} style={{ color: "#3B82F6" }} />
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0F172A", marginTop: "8px" }}>
              {stats?.total_units?.toLocaleString() ?? 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>Total units in warehouse</div>
          </div>

          {/* Reserved Stock */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "1.25rem",
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#64748B" }}>RESERVED UNITS</span>
              <Clock size={18} style={{ color: "#8B5CF6" }} />
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#8B5CF6", marginTop: "8px" }}>
              {stats?.total_reserved?.toLocaleString() ?? 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>Held for Confirmed orders</div>
          </div>

          {/* Available Stock */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "1.25rem",
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#64748B" }}>AVAILABLE TO SELL</span>
              <CheckCircle2 size={18} style={{ color: "#10B981" }} />
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10B981", marginTop: "8px" }}>
              {stats?.total_available?.toLocaleString() ?? 0}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>On-hand minus reserved</div>
          </div>

          {/* Low Stock Alerts */}
          <div
            style={{
              backgroundColor: alerts.length > 0 ? "#FFFBEB" : "#FFFFFF",
              borderRadius: "12px",
              padding: "1.25rem",
              border: alerts.length > 0 ? "1px solid #FCD34D" : "1px solid #E2E8F0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab("alerts")}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#D97706" }}>LOW STOCK ALERTS</span>
              <AlertTriangle size={18} style={{ color: "#D97706" }} />
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#D97706", marginTop: "8px" }}>
              {stats?.low_stock_count ?? alerts.length}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#B45309", marginTop: "4px" }}>
              {alerts.length > 0 ? "Items require reordering →" : "All products well stocked"}
            </div>
          </div>
        </div>

        {/* Tab Headers */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderBottom: "1px solid #CBD5E1",
            paddingBottom: "4px",
          }}
        >
          <button
            onClick={() => setActiveTab("overview")}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: activeTab === "overview" ? "#0D9488" : "transparent",
              color: activeTab === "overview" ? "#FFFFFF" : "#64748B",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.15s ease",
            }}
          >
            <Boxes size={16} />
            <span>Stock Overview ({filteredProducts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("movements")}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: activeTab === "movements" ? "#0D9488" : "transparent",
              color: activeTab === "movements" ? "#FFFFFF" : "#64748B",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.15s ease",
            }}
          >
            <Clock size={16} />
            <span>Movement Audit History ({movements.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("alerts")}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: activeTab === "alerts" ? "#D97706" : "transparent",
              color: activeTab === "alerts" ? "#FFFFFF" : "#64748B",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.15s ease",
            }}
          >
            <AlertTriangle size={16} />
            <span>Low Stock Alerts ({alerts.length})</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            backgroundColor: "#FFFFFF",
            padding: "1rem",
            borderRadius: "10px",
            border: "1px solid #E2E8F0",
          }}
        >
          {/* Search Box */}
          <div
            style={{
              position: "relative",
              flex: "1 1 260px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search
              size={16}
              style={{ position: "absolute", left: "12px", color: "#94A3B8" }}
            />
            <input
              type="text"
              placeholder={
                activeTab === "movements"
                  ? "Search movements by product, ref, notes..."
                  : "Search products by name, SKU, category..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
          </div>

          {activeTab === "overview" && (
            <>
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.875rem",
                  color: "#334155",
                  backgroundColor: "#FFFFFF",
                  outline: "none",
                }}
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.875rem",
                  color: "#334155",
                  backgroundColor: "#FFFFFF",
                  outline: "none",
                }}
              >
                <option value="all">All Stock Statuses</option>
                <option value="in_stock">In Stock Only</option>
                <option value="low_stock">Low Stock Only</option>
                <option value="out_of_stock">Out of Stock Only</option>
              </select>
            </>
          )}

          {activeTab === "movements" && (
            <select
              value={movementTypeFilter}
              onChange={(e) => setMovementTypeFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.875rem",
                color: "#334155",
                backgroundColor: "#FFFFFF",
                outline: "none",
              }}
            >
              <option value="all">All Movement Types</option>
              <option value="stock_in">Stock In (Purchase/Restock)</option>
              <option value="reserve">Reservation (Order Confirmed)</option>
              <option value="release_reservation">Release Reservation (Order Cancelled)</option>
              <option value="dispatch">Dispatch (Order Delivered)</option>
              <option value="return">Customer Return</option>
              <option value="adjustment">Stock Adjustment (Audit)</option>
            </select>
          )}

          {(searchQuery || selectedCategory !== "all" || statusFilter !== "all" || movementTypeFilter !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setStatusFilter("all");
                setMovementTypeFilter("all");
              }}
              style={{
                padding: "8px 12px",
                backgroundColor: "#F1F5F9",
                border: "none",
                borderRadius: "8px",
                color: "#64748B",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* TAB 1: STOCK OVERVIEW */}
        {activeTab === "overview" && (
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>
                      PRODUCT / SKU
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>
                      CATEGORY
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textAlign: "right" }}>
                      PHYSICAL (ON-HAND)
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textAlign: "right" }}>
                      RESERVED
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textAlign: "right" }}>
                      AVAILABLE TO SELL
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textAlign: "right" }}>
                      SOLD QTY
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textAlign: "center" }}>
                      REORDER LEVEL
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textAlign: "center" }}>
                      STATUS
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textAlign: "right" }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "3rem", textAlign: "center", color: "#94A3B8" }}>
                        <Boxes size={40} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                        <div style={{ fontSize: "1rem", fontWeight: 600, color: "#475569" }}>
                          No products found matching filters
                        </div>
                        <div style={{ fontSize: "0.875rem", marginTop: "4px" }}>
                          Try clearing your search query or status filter.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const avail = (p.current_stock || 0) - (p.reserved_stock || 0);
                      const st = getStockStatus(p);
                      return (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: "1px solid #F1F5F9",
                            transition: "background-color 0.1s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                        >
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "0.875rem" }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                              SKU: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{p.sku}</span> • {p.unit}
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: "0.875rem", color: "#475569" }}>
                            {p.category}
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              fontSize: "0.9375rem",
                              fontWeight: 700,
                              color: "#0F172A",
                              textAlign: "right",
                            }}
                          >
                            {p.current_stock || 0}
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              fontSize: "0.9375rem",
                              fontWeight: 600,
                              color: (p.reserved_stock || 0) > 0 ? "#7C3AED" : "#94A3B8",
                              textAlign: "right",
                            }}
                          >
                            {p.reserved_stock || 0}
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              fontSize: "0.9375rem",
                              fontWeight: 800,
                              color: avail <= 0 ? "#DC2626" : avail <= (p.low_stock_threshold || 10) ? "#D97706" : "#16A34A",
                              textAlign: "right",
                            }}
                          >
                            {avail > 0 ? avail : 0}
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: "#475569",
                              textAlign: "right",
                            }}
                          >
                            {p.sold_quantity || 0}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "center", fontSize: "0.8125rem", color: "#64748B" }}>
                            {p.low_stock_threshold ?? 10} units
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "center" }}>
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: "9999px",
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                backgroundColor: st.bg,
                                color: st.text,
                                border: `1px solid ${st.border}`,
                                display: "inline-block",
                              }}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "right" }}>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                              <button
                                onClick={() => openStockIn(p)}
                                title="Stock In / Restock units"
                                style={{
                                  padding: "6px 10px",
                                  backgroundColor: "#F0FDFA",
                                  border: "1px solid #99F6E4",
                                  borderRadius: "6px",
                                  color: "#0D9488",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                + In
                              </button>
                              <button
                                onClick={() => openAdjust(p)}
                                title="Adjust count or audit"
                                style={{
                                  padding: "6px 10px",
                                  backgroundColor: "#F8FAFC",
                                  border: "1px solid #E2E8F0",
                                  borderRadius: "6px",
                                  color: "#475569",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Adjust
                              </button>
                              <button
                                onClick={() => openReturn(p)}
                                title="Customer return"
                                style={{
                                  padding: "6px 10px",
                                  backgroundColor: "#FFF7ED",
                                  border: "1px solid #FED7AA",
                                  borderRadius: "6px",
                                  color: "#C2410C",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Return
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
        )}

        {/* TAB 2: MOVEMENT HISTORY */}
        {activeTab === "movements" && (
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>
                      DATE / TIME
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>
                      PRODUCT
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textAlign: "center" }}>
                      MOVEMENT
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textAlign: "right" }}>
                      QUANTITY
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textAlign: "center" }}>
                      STOCK BEFORE → AFTER
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>
                      REFERENCE
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>
                      NOTES / REASON
                    </th>
                    <th style={{ padding: "14px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>
                      LOGGED BY
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "3rem", textAlign: "center", color: "#94A3B8" }}>
                        <Clock size={40} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                        <div style={{ fontSize: "1rem", fontWeight: 600, color: "#475569" }}>
                          No stock movement history recorded yet
                        </div>
                        <div style={{ fontSize: "0.875rem", marginTop: "4px" }}>
                          Stock additions, order reservations, deliveries, and adjustments will be logged automatically.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => {
                      const badge = getMovementBadge(m.movement_type);
                      const isPositive =
                        m.movement_type === "stock_in" ||
                        m.movement_type === "return" ||
                        (m.movement_type === "adjustment" && m.quantity > 0);
                      return (
                        <tr
                          key={m.id}
                          style={{
                            borderBottom: "1px solid #F1F5F9",
                            fontSize: "0.875rem",
                          }}
                        >
                          <td style={{ padding: "14px 16px", color: "#64748B", whiteSpace: "nowrap" }}>
                            {new Date(m.created_at).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 700, color: "#0F172A" }}>
                              {m.product?.name || `Product #${m.product_id}`}
                            </div>
                            {m.product?.sku && (
                              <div style={{ fontSize: "0.75rem", color: "#64748B", fontFamily: "monospace" }}>
                                {m.product.sku}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "center" }}>
                            <span
                              style={{
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "0.6875rem",
                                fontWeight: 800,
                                backgroundColor: badge.bg,
                                color: badge.text,
                                border: `1px solid ${badge.border}`,
                                display: "inline-block",
                              }}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "14px 16px",
                              textAlign: "right",
                              fontWeight: 800,
                              color: isPositive ? "#16A34A" : m.movement_type === "reserve" ? "#7C3AED" : "#DC2626",
                            }}
                          >
                            {isPositive ? `+${m.quantity}` : m.movement_type === "reserve" ? `${m.quantity}` : `-${m.quantity}`}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "center", color: "#475569" }}>
                            <span style={{ fontWeight: 600 }}>{m.previous_stock}</span>
                            <span style={{ color: "#94A3B8", margin: "0 6px" }}>→</span>
                            <span style={{ fontWeight: 700, color: "#0F172A" }}>{m.new_stock}</span>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            {m.reference_id ? (
                              <span
                                style={{
                                  backgroundColor: "#F1F5F9",
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  fontFamily: "monospace",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  color: "#334155",
                                }}
                              >
                                {m.reference_id}
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: "14px 16px", color: "#475569", maxWidth: "300px" }}>
                            {m.notes || "—"}
                          </td>
                          <td style={{ padding: "14px 16px", color: "#64748B", fontSize: "0.8125rem" }}>
                            {m.creator?.name || "System"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LOW STOCK ALERTS */}
        {activeTab === "alerts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {alerts.length === 0 ? (
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "12px",
                  padding: "3rem",
                  textAlign: "center",
                  border: "1px solid #E2E8F0",
                }}
              >
                <CheckCircle2 size={48} style={{ color: "#10B981", margin: "0 auto 12px" }} />
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  All Stock Levels Healthy!
                </h3>
                <p style={{ color: "#64748B", fontSize: "0.875rem", marginTop: "4px" }}>
                  None of your active products have breached their configured reorder thresholds.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: "1rem",
                }}
              >
                {alerts.map((p) => {
                  const avail = (p.current_stock || 0) - (p.reserved_stock || 0);
                  const isOut = avail <= 0;
                  return (
                    <div
                      key={p.id}
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: "12px",
                        border: isOut ? "1px solid #FCA5A5" : "1px solid #FCD34D",
                        padding: "1.25rem",
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>
                              {p.name}
                            </h4>
                            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                              SKU: <span style={{ fontFamily: "monospace" }}>{p.sku}</span> • {p.category}
                            </div>
                          </div>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "0.6875rem",
                              fontWeight: 800,
                              backgroundColor: isOut ? "#FEE2E2" : "#FEF3C7",
                              color: isOut ? "#DC2626" : "#D97706",
                            }}
                          >
                            {isOut ? "OUT OF STOCK" : "LOW STOCK"}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: "8px",
                            backgroundColor: "#F8FAFC",
                            padding: "10px",
                            borderRadius: "8px",
                            marginTop: "12px",
                            textAlign: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "0.6875rem", color: "#64748B", fontWeight: 600 }}>ON-HAND</div>
                            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#0F172A" }}>
                              {p.current_stock || 0}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.6875rem", color: "#64748B", fontWeight: 600 }}>RESERVED</div>
                            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#7C3AED" }}>
                              {p.reserved_stock || 0}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.6875rem", color: "#64748B", fontWeight: 600 }}>AVAILABLE</div>
                            <div
                              style={{
                                fontSize: "1rem",
                                fontWeight: 800,
                                color: isOut ? "#DC2626" : "#D97706",
                              }}
                            >
                              {avail > 0 ? avail : 0}
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: "0.75rem", color: "#B45309", marginTop: "8px" }}>
                          ⚠️ Threshold is {p.low_stock_threshold ?? 10} units. Immediate purchase order recommended.
                        </div>
                      </div>

                      <button
                        onClick={() => openStockIn(p)}
                        style={{
                          width: "100%",
                          padding: "10px",
                          backgroundColor: "#0D9488",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: "8px",
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        <Plus size={16} />
                        <span>Quick Restock (+ In)</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: STOCK IN */}
      {showStockInModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "2rem",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    backgroundColor: "#CCFBF1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0D9488",
                  }}
                >
                  <Plus size={20} />
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  Stock In / Restock
                </h3>
              </div>
              <button
                onClick={() => setShowStockInModal(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleStockInSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Product
                </label>
                <select
                  value={selectedProductForAction?.id || ""}
                  onChange={(e) => {
                    const found = products.find((p) => p.id === Number(e.target.value));
                    setSelectedProductForAction(found || null);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (SKU: {p.sku}) — Available: {(p.current_stock || 0) - (p.reserved_stock || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Quantity to Add
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={stockInQty}
                  onChange={(e) => setStockInQty(Number(e.target.value))}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "1rem",
                    fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Reference Notes / PO # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-8491 from supplier, shipment batch 3"
                  value={stockInNotes}
                  onChange={(e) => setStockInNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowStockInModal(false)}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: "#F1F5F9",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "10px 22px",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  <span>Confirm Stock In</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADJUST STOCK */}
      {showAdjustModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "2rem",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    backgroundColor: "#FEF3C7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#D97706",
                  }}
                >
                  <Sliders size={20} />
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  Adjust Physical Stock
                </h3>
              </div>
              <button
                onClick={() => setShowAdjustModal(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Product
                </label>
                <select
                  value={selectedProductForAction?.id || ""}
                  onChange={(e) => {
                    const found = products.find((p) => p.id === Number(e.target.value));
                    setSelectedProductForAction(found || null);
                    if (found && adjustMode === "set") setAdjustQty(found.current_stock || 0);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (On-Hand: {p.current_stock || 0}, Reserved: {p.reserved_stock || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Adjustment Mode
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustMode("set");
                      if (selectedProductForAction) setAdjustQty(selectedProductForAction.current_stock || 0);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: adjustMode === "set" ? "2px solid #0D9488" : "1px solid #CBD5E1",
                      backgroundColor: adjustMode === "set" ? "#F0FDFA" : "#FFFFFF",
                      color: adjustMode === "set" ? "#0D9488" : "#475569",
                      fontWeight: 700,
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                    }}
                  >
                    Exact Count (Set)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustMode("delta");
                      setAdjustQty(0);
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: adjustMode === "delta" ? "2px solid #0D9488" : "1px solid #CBD5E1",
                      backgroundColor: adjustMode === "delta" ? "#F0FDFA" : "#FFFFFF",
                      color: adjustMode === "delta" ? "#0D9488" : "#475569",
                      fontWeight: 700,
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                    }}
                  >
                    Relative Delta (+/-)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  {adjustMode === "set" ? "New Total Physical Stock" : "Change Amount (+ to add, - to subtract)"}
                </label>
                <input
                  type="number"
                  step="1"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "1rem",
                    fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Reason for Adjustment
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  <option value="Quarterly Audit Correction">Quarterly Audit Correction</option>
                  <option value="Physical Count Variance">Physical Count Variance</option>
                  <option value="Damaged in Warehouse">Damaged in Warehouse</option>
                  <option value="Loss / Stolen Item">Loss / Stolen Item</option>
                  <option value="Supplier Replacement">Supplier Replacement</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Audit Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bin verified by manager"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: "#F1F5F9",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "10px 22px",
                    backgroundColor: "#D97706",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  <span>Save Adjustment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CUSTOMER RETURN */}
      {showReturnModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "2rem",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    backgroundColor: "#FFEDD5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#C2410C",
                  }}
                >
                  <RotateCcw size={20} />
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                  Customer Return
                </h3>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Product
                </label>
                <select
                  value={selectedProductForAction?.id || ""}
                  onChange={(e) => {
                    const found = products.find((p) => p.id === Number(e.target.value));
                    setSelectedProductForAction(found || null);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (SKU: {p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Returned Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={returnQty}
                  onChange={(e) => setReturnQty(Number(e.target.value))}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "1rem",
                    fontWeight: 700,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Linked Order (Optional)
                </label>
                <select
                  value={returnOrderId}
                  onChange={(e) => setReturnOrderId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  <option value="">— Standalone Return (No Order Link) —</option>
                  {deliveredOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number}: {o.title} ({o.customer?.name || "Customer"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Restock Toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#F8FAFC",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>
                    Restock into Physical Inventory?
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    If enabled, adds units back to available stock. If disabled, logs return as damaged/scrap.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={returnRestock}
                  onChange={(e) => setReturnRestock(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "#0D9488", cursor: "pointer" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Item Condition
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  <option value="good">Good / Resellable</option>
                  <option value="damaged">Damaged / Non-resellable</option>
                  <option value="scrap">Scrap / Write-off</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Return Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wrong size, customer changed mind"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: "#F1F5F9",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "10px 22px",
                    backgroundColor: "#C2410C",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  <span>Log Return</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
