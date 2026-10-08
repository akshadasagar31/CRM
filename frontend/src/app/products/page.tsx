"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Edit3,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Tag,
  Hash,
  FileText,
  SlidersHorizontal,
  ExternalLink,
  Check,
  Percent,
  Calendar,
  Clock,
  ArrowUpDown,
} from "lucide-react";
import {
  productsApi,
  authApi,
  getToken,
  getStoredUser,
  setStoredUser,
  Product,
  ProductCreateInput,
  ProductUpdateInput,
  User,
} from "@/lib/api";
import Sidebar, { SidebarTab } from "@/components/Sidebar";

const PRESET_CATEGORIES = [
  "Software",
  "SaaS Subscription",
  "Professional Services",
  "Hardware",
  "Consulting",
  "Support & Maintenance",
  "Implementation",
  "Custom Development",
];

const PRESET_UNITS = [
  "Unit",
  "Per Month",
  "Per User / Month",
  "Per Year",
  "Hour",
  "Day",
  "License",
  "Pack",
  "Project",
];

export default function ProductsPage() {
  const router = useRouter();

  // Auth & Permissions
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("products");

  // Core Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters, Search & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [inspectingProduct, setInspectingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    sku: string;
    category: string;
    customCategory: string;
    description: string;
    unit: string;
    customUnit: string;
    selling_price: string;
    currency: string;
    tax_rate: string;
    hsn_sac: string;
    status: "active" | "inactive";
  }>({
    name: "",
    sku: "",
    category: "Software",
    customCategory: "",
    description: "",
    unit: "Unit",
    customUnit: "",
    selling_price: "0",
    currency: "INR",
    tax_rate: "18",
    hsn_sac: "",
    status: "active",
  });
  const [formError, setFormError] = useState("");

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

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
    // Always fetch latest authenticated user profile from backend to ensure accurate role
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

  const isAdminOrManager = useMemo(() => {
    const userToEvaluate = currentUser || (typeof window !== "undefined" ? getStoredUser() : null);
    if (!userToEvaluate) return false;
    const r = (userToEvaluate.role || "").toLowerCase().trim();
    return r === "admin" || r === "manager" || userToEvaluate.id === 1;
  }, [currentUser]);

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    try {
      const cats = await productsApi.listCategories();
      setCategories(cats || []);
    } catch {
      // Non-fatal
    }
  }, []);

  // Fetch Products
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await productsApi.list({
        search: searchQuery.trim() || undefined,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: currentPage,
        limit: pageSize,
      });

      setProducts(res.items || []);
      setTotalCount(res.total || 0);
      setActiveCount(res.active_count || 0);
      setInactiveCount(res.inactive_count || 0);
      setTotalPages(res.pages || 1);
    } catch (err: any) {
      showToast(err.message || "Failed to load products", "error");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedStatus, sortBy, sortOrder, currentPage, pageSize]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Tab Navigation
  const handleSelectTab = (tab: SidebarTab) => {
    setActiveSidebarTab(tab);
    if (tab === "leads") {
      router.push("/leads");
    } else if (tab === "deals") {
      router.push("/deals");
    } else if (tab === "products") {
      // Current route
    } else if (tab === "quotations") {
      router.push("/quotations");
    } else if (tab === "orders") {
      router.push("/orders");
    } else if (tab === "follow-ups") {
      router.push("/follow-ups");
    } else if (tab === "company") {
      router.push("/company");
    } else {
      router.push(`/leads?tab=${tab}`);
    }
  };

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("crm_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      name: "",
      sku: `PRD-${Date.now().toString().slice(-5)}`,
      category: categories[0] || "Software",
      customCategory: "",
      description: "",
      unit: "Unit",
      customUnit: "",
      selling_price: "0",
      currency: "INR",
      tax_rate: "18",
      hsn_sac: "",
      status: "active",
    });
    setFormError("");
    setEditingProduct(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (p: Product) => {
    const isCustomCat = !PRESET_CATEGORIES.includes(p.category) && !categories.includes(p.category);
    const isCustomUnit = !PRESET_UNITS.includes(p.unit);

    setFormData({
      name: p.name,
      sku: p.sku,
      category: isCustomCat ? "Custom" : p.category,
      customCategory: isCustomCat ? p.category : "",
      description: p.description || "",
      unit: isCustomUnit ? "Custom" : p.unit,
      customUnit: isCustomUnit ? p.unit : "",
      selling_price: String(p.selling_price),
      currency: p.currency || "INR",
      tax_rate: String(p.tax_rate ?? 18),
      hsn_sac: p.hsn_sac || "",
      status: p.status,
    });
    setFormError("");
    setEditingProduct(p);
    setIsAddModalOpen(true);
  };

  // Save Product (Create or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const name = formData.name.trim();
    const sku = formData.sku.trim();
    const category = formData.category === "Custom" ? formData.customCategory.trim() : formData.category.trim();
    const unit = formData.unit === "Custom" ? formData.customUnit.trim() : formData.unit.trim();
    const price = parseFloat(formData.selling_price);
    const tax = parseFloat(formData.tax_rate);

    if (!name) {
      setFormError("Product name is required");
      return;
    }
    if (!sku) {
      setFormError("Product SKU is required");
      return;
    }
    if (!category) {
      setFormError("Category is required");
      return;
    }
    if (!unit) {
      setFormError("Unit is required");
      return;
    }
    if (isNaN(price) || price < 0) {
      setFormError("Selling price must be 0 or greater");
      return;
    }
    if (isNaN(tax) || tax < 0 || tax > 100) {
      setFormError("Tax rate must be between 0 and 100%");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        const updatePayload: ProductUpdateInput = {
          name,
          sku,
          category,
          unit,
          description: formData.description.trim() || undefined,
          selling_price: price,
          currency: formData.currency,
          tax_rate: tax,
          hsn_sac: formData.hsn_sac.trim() || undefined,
          status: formData.status,
        };
        await productsApi.update(editingProduct.id, updatePayload);
        showToast("Product updated successfully");
      } else {
        const createPayload: ProductCreateInput = {
          name,
          sku,
          category,
          unit,
          description: formData.description.trim() || undefined,
          selling_price: price,
          currency: formData.currency,
          tax_rate: tax,
          hsn_sac: formData.hsn_sac.trim() || undefined,
          status: formData.status,
        };
        await productsApi.create(createPayload);
        showToast("Product created successfully");
      }

      setIsAddModalOpen(false);
      setEditingProduct(null);
      fetchProducts();
      fetchCategories();
    } catch (err: any) {
      setFormError(err.message || "Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Toggle Active/Inactive
  const handleToggleStatus = async (p: Product) => {
    if (!isAdminOrManager) return;
    const newStatus = p.status === "active" ? "inactive" : "active";
    try {
      await productsApi.update(p.id, { status: newStatus });
      showToast(`Product set to ${newStatus}`);
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || "Failed to update status", "error");
    }
  };

  // Archive / Delete Product
  const handleConfirmDelete = async () => {
    if (!deletingProduct || !isAdminOrManager) return;
    setIsSubmitting(true);
    try {
      await productsApi.delete(deletingProduct.id);
      showToast(`Product ${deletingProduct.sku} archived successfully`);
      setDeletingProduct(null);
      fetchProducts();
      fetchCategories();
    } catch (err: any) {
      showToast(err.message || "Failed to delete product", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format Currency with ₹ for INR
  const formatCurrency = (val: number, currency = "INR") => {
    const isINR = !currency || currency.toUpperCase() === "INR";
    const symbol = isINR ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency + " ";
    return `${symbol}${val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Category soft pastel pill styling
  const getCategoryBadgeStyle = (category: string): React.CSSProperties => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("soft") || cat.includes("app") || cat.includes("code")) {
      return { backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" };
    }
    if (cat.includes("serv") || cat.includes("onboard")) {
      return { backgroundColor: "#F5F3FF", color: "#6D28D9", border: "1px solid #DDD6FE" };
    }
    if (cat.includes("sub") || cat.includes("saas") || cat.includes("cloud")) {
      return { backgroundColor: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" };
    }
    if (cat.includes("hard") || cat.includes("device") || cat.includes("equip")) {
      return { backgroundColor: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A" };
    }
    if (cat.includes("consult") || cat.includes("advis")) {
      return { backgroundColor: "#ECFEFF", color: "#0E7490", border: "1px solid #A5F3FC" };
    }
    if (cat.includes("supp") || cat.includes("sla") || cat.includes("maint")) {
      return { backgroundColor: "#FFF1F2", color: "#BE123C", border: "1px solid #FECDD3" };
    }
    return { backgroundColor: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1" };
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        height: "100vh",
        backgroundColor: "#F8FAFC",
        color: "#0F172A",
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 18px",
            borderRadius: "12px",
            backgroundColor: toast.type === "success" ? "#ECFDF5" : "#FEF2F2",
            border: `1px solid ${toast.type === "success" ? "#A7F3D0" : "#FCA5A5"}`,
            color: toast.type === "success" ? "#065F46" : "#991B1B",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            fontSize: "0.875rem",
            fontWeight: 600,
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={18} color="#059669" />
          ) : (
            <AlertCircle size={18} color="#DC2626" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{
              background: "none",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "2px",
              marginLeft: "8px",
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Unified CRM Sidebar */}
      <Sidebar
        activeTab={activeSidebarTab}
        onSelectTab={handleSelectTab}
        productsCount={totalCount}
        user={currentUser}
        onLogout={() => {
          authApi.logout();
          router.push("/");
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        onOpenAdminSettings={() => {}}
      />

      {/* Main Content Workspace */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100vh",
          overflowY: "auto",
          backgroundColor: "#F8FAFC",
        }}
      >
        {/* Clean Page Header */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            backgroundColor: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid #E2E8F0",
            padding: "1rem 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #0D9488 0%, #2563EB 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 2px 8px rgba(13, 148, 136, 0.25)",
                flexShrink: 0,
              }}
            >
              <Package size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h1
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: "#0F172A",
                    letterSpacing: "-0.02em",
                    margin: 0,
                  }}
                >
                  Products & Price Book
                </h1>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    backgroundColor: "#CCFBF1",
                    color: "#0F766E",
                  }}
                >
                  {totalCount} Items
                </span>
              </div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#64748B",
                  margin: "2px 0 0 0",
                  fontWeight: 400,
                }}
              >
                Manage standard products, subscriptions, software licenses, and services for quotation building.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {!isAdminOrManager && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  borderRadius: "8px",
                  border: "1px solid #FDE68A",
                  backgroundColor: "#FFFBEB",
                  padding: "6px 12px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#92400E",
                }}
              >
                <Shield size={14} color="#D97706" />
                <span>View Only (Admin / Manager can manage catalog)</span>
              </div>
            )}

            {isAdminOrManager && (
              <button
                id="btn-add-product"
                onClick={handleOpenCreateModal}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0.55rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#0D9488",
                  color: "#FFFFFF",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(13, 148, 136, 0.3)",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0F766E")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0D9488")}
              >
                <Plus size={16} />
                <span>Add Product</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Wrapper */}
        <div style={{ padding: "1.75rem 2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* 4 Clean Modern KPI Cards */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Card 1: Total Products */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Total Products
                </span>
                <span
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    backgroundColor: "#EEF2FF",
                    color: "#4F46E5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Package size={16} />
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
                  {totalCount}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                  in price book
                </span>
              </div>
            </div>

            {/* Card 2: Active Products */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Active Products
                </span>
                <span
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    backgroundColor: "#ECFDF5",
                    color: "#059669",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CheckCircle2 size={16} />
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#047857", letterSpacing: "-0.02em" }}>
                  {activeCount}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 500 }}>
                  ready for quotes
                </span>
              </div>
            </div>

            {/* Card 3: Inactive / Archived */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Inactive / Archived
                </span>
                <span
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    backgroundColor: "#F1F5F9",
                    color: "#64748B",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ToggleLeft size={16} />
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#475569", letterSpacing: "-0.02em" }}>
                  {inactiveCount}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                  hidden from quotes
                </span>
              </div>
            </div>

            {/* Card 4: Categories */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                padding: "1.25rem",
                border: "1px solid #E2E8F0",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Categories
                </span>
                <span
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    backgroundColor: "#F5F3FF",
                    color: "#7C3AED",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Layers size={16} />
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
                  {categories.length}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                  classifications
                </span>
              </div>
            </div>
          </section>

          {/* Unified Toolbar */}
          <section
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "0.875rem 1.25rem",
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            {/* Search Box */}
            <div
              style={{
                position: "relative",
                flex: "1 1 260px",
                maxWidth: "420px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Search
                size={16}
                color="#94A3B8"
                style={{ position: "absolute", left: "12px", pointerEvents: "none" }}
              />
              <input
                id="input-product-search"
                type="text"
                placeholder="Search by product name, SKU, HSN/SAC, category..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "0.5rem 2rem 0.5rem 2.25rem",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#F8FAFC",
                  fontSize: "0.8125rem",
                  color: "#0F172A",
                  outline: "none",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "none",
                    border: "none",
                    color: "#94A3B8",
                    cursor: "pointer",
                    padding: "2px",
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter and Sort Controls */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
              {/* Category Dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>Category:</span>
                <select
                  id="select-filter-category"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "0.45rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    fontSize: "0.8125rem",
                    color: "#334155",
                    cursor: "pointer",
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
              </div>

              {/* Status Dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>Status:</span>
                <select
                  id="select-filter-status"
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "0.45rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    fontSize: "0.8125rem",
                    color: "#334155",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              {/* Sort By Dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>Sort:</span>
                <select
                  id="select-sort-by"
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split("-");
                    setSortBy(field);
                    setSortOrder(order as "asc" | "desc");
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "0.45rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    fontSize: "0.8125rem",
                    color: "#334155",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="selling_price-asc">Price (Low to High)</option>
                  <option value="selling_price-desc">Price (High to Low)</option>
                  <option value="sku-asc">SKU (A-Z)</option>
                </select>
              </div>

              {/* Refresh Button */}
              <button
                id="btn-refresh-products"
                onClick={fetchProducts}
                title="Refresh products list"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#FFFFFF",
                  color: "#475569",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#F1F5F9";
                  e.currentTarget.style.color = "#0F172A";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#FFFFFF";
                  e.currentTarget.style.color = "#475569";
                }}
              >
                <RefreshCw size={14} className={isLoading ? "spin-animation" : ""} />
                <span style={{ marginLeft: "6px", fontWeight: 600 }}>Refresh</span>
              </button>
            </div>
          </section>

          {/* Product Data Table */}
          <section
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "0.8125rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#F8FAFC",
                      borderBottom: "1px solid #E2E8F0",
                      color: "#64748B",
                      fontWeight: 700,
                      fontSize: "0.6875rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <th style={{ padding: "0.875rem 1.25rem" }}>Product & Description</th>
                    <th style={{ padding: "0.875rem 1rem" }}>SKU Code</th>
                    <th style={{ padding: "0.875rem 1rem" }}>HSN / SAC</th>
                    <th style={{ padding: "0.875rem 1rem" }}>Category</th>
                    <th style={{ padding: "0.875rem 1rem" }}>Unit</th>
                    <th style={{ padding: "0.875rem 1rem", textAlign: "right" }}>Selling Price</th>
                    <th style={{ padding: "0.875rem 1rem", textAlign: "center" }}>Tax</th>
                    <th style={{ padding: "0.875rem 1rem", textAlign: "center" }}>Status</th>
                    <th style={{ padding: "0.875rem 1.25rem", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && products.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "3rem", textAlign: "center", color: "#64748B" }}>
                        <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
                        <div style={{ fontWeight: 600 }}>Loading products...</div>
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: "4rem 2rem", textAlign: "center" }}>
                        <div
                          style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "16px",
                            backgroundColor: "#F1F5F9",
                            color: "#94A3B8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 1rem",
                          }}
                        >
                          <Package size={28} />
                        </div>
                        <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1E293B", marginBottom: "0.25rem" }}>
                          No products found
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "#64748B", maxWidth: "360px", margin: "0 auto 1.25rem" }}>
                          {searchQuery || selectedCategory !== "all" || selectedStatus !== "all"
                            ? "Try adjusting your search criteria or resetting the active filters."
                            : "Your product price book is currently empty. Add your first product to get started."}
                        </div>
                        {isAdminOrManager && (
                          <button
                            onClick={handleOpenCreateModal}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "0.55rem 1rem",
                              borderRadius: "8px",
                              border: "none",
                              backgroundColor: "#0D9488",
                              color: "#FFFFFF",
                              fontSize: "0.8125rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            <Plus size={16} />
                            <span>Add First Product</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const isActive = p.status === "active";
                      return (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: "1px solid #F1F5F9",
                            transition: "background-color 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                        >
                          {/* Product Name & Description */}
                          <td style={{ padding: "0.875rem 1.25rem", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                              <div
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  borderRadius: "8px",
                                  backgroundColor: "#F8FAFC",
                                  border: "1px solid #E2E8F0",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#0D9488",
                                  flexShrink: 0,
                                  marginTop: "2px",
                                }}
                              >
                                <Package size={18} />
                              </div>
                              <div>
                                <div
                                  onClick={() => setInspectingProduct(p)}
                                  style={{
                                    fontWeight: 700,
                                    color: "#0F172A",
                                    cursor: "pointer",
                                    lineHeight: 1.3,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = "#0D9488")}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = "#0F172A")}
                                >
                                  {p.name}
                                </div>
                                {p.description ? (
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#64748B",
                                      marginTop: "2px",
                                      maxWidth: "380px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {p.description}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: "0.75rem", color: "#94A3B8", fontStyle: "italic", marginTop: "2px" }}>
                                    No description provided
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* SKU Code */}
                          <td style={{ padding: "0.875rem 1rem", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                padding: "3px 7px",
                                borderRadius: "6px",
                                backgroundColor: "#F1F5F9",
                                color: "#334155",
                                border: "1px solid #E2E8F0",
                              }}
                            >
                              {p.sku}
                            </span>
                          </td>

                          {/* HSN / SAC */}
                          <td style={{ padding: "0.875rem 1rem", verticalAlign: "middle", whiteSpace: "nowrap", color: "#64748B", fontSize: "0.75rem" }}>
                            {p.hsn_sac ? (
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                                {p.hsn_sac}
                              </span>
                            ) : (
                              <span style={{ color: "#CBD5E1" }}>—</span>
                            )}
                          </td>

                          {/* Category Badge */}
                          <td style={{ padding: "0.875rem 1rem", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "999px",
                                ...getCategoryBadgeStyle(p.category),
                              }}
                            >
                              {p.category}
                            </span>
                          </td>

                          {/* Unit */}
                          <td style={{ padding: "0.875rem 1rem", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                color: "#475569",
                                backgroundColor: "#F8FAFC",
                                border: "1px solid #E2E8F0",
                                padding: "2px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              {p.unit}
                            </span>
                          </td>

                          {/* Selling Price */}
                          <td style={{ padding: "0.875rem 1rem", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.01em" }}>
                              {formatCurrency(p.selling_price, p.currency)}
                            </div>
                            <div style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
                              per {p.unit}
                            </div>
                          </td>

                          {/* Tax Rate */}
                          <td style={{ padding: "0.875rem 1rem", verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                backgroundColor: "#F8FAFC",
                                border: "1px solid #E2E8F0",
                                color: "#475569",
                              }}
                            >
                              {p.tax_rate ?? 0}% GST
                            </span>
                          </td>

                          {/* Status Badge & Quick Toggle */}
                          <td style={{ padding: "0.875rem 1rem", verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  fontSize: "0.6875rem",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "999px",
                                  backgroundColor: isActive ? "#ECFDF5" : "#F1F5F9",
                                  color: isActive ? "#047857" : "#64748B",
                                  border: `1px solid ${isActive ? "#A7F3D0" : "#E2E8F0"}`,
                                }}
                              >
                                <span
                                  style={{
                                    width: "6px",
                                    height: "6px",
                                    borderRadius: "50%",
                                    backgroundColor: isActive ? "#10B981" : "#94A3B8",
                                  }}
                                />
                                {isActive ? "Active" : "Inactive"}
                              </span>

                              {isAdminOrManager && (
                                <button
                                  onClick={() => handleToggleStatus(p)}
                                  title={`Click to mark as ${isActive ? "Inactive" : "Active"}`}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: isActive ? "#10B981" : "#94A3B8",
                                    cursor: "pointer",
                                    padding: "2px",
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                >
                                  {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "0.875rem 1.25rem", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              {/* Inspect Button */}
                              <button
                                onClick={() => setInspectingProduct(p)}
                                title="View product details"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "28px",
                                  height: "28px",
                                  borderRadius: "6px",
                                  border: "1px solid #E2E8F0",
                                  backgroundColor: "#FFFFFF",
                                  color: "#475569",
                                  cursor: "pointer",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "#F1F5F9";
                                  e.currentTarget.style.color = "#0F172A";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "#FFFFFF";
                                  e.currentTarget.style.color = "#475569";
                                }}
                              >
                                <Eye size={14} />
                              </button>

                              {/* Edit Button */}
                              {isAdminOrManager && (
                                <button
                                  onClick={() => handleOpenEditModal(p)}
                                  title="Edit product"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "6px",
                                    border: "1px solid #E2E8F0",
                                    backgroundColor: "#FFFFFF",
                                    color: "#0284C7",
                                    cursor: "pointer",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#E0F2FE";
                                    e.currentTarget.style.borderColor = "#BAE6FD";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "#FFFFFF";
                                    e.currentTarget.style.borderColor = "#E2E8F0";
                                  }}
                                >
                                  <Edit3 size={14} />
                                </button>
                              )}

                              {/* Archive Button */}
                              {isAdminOrManager && (
                                <button
                                  onClick={() => setDeletingProduct(p)}
                                  title="Archive product"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "28px",
                                    height: "28px",
                                    borderRadius: "6px",
                                    border: "1px solid #E2E8F0",
                                    backgroundColor: "#FFFFFF",
                                    color: "#DC2626",
                                    cursor: "pointer",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#FEE2E2";
                                    e.currentTarget.style.borderColor = "#FECDD3";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "#FFFFFF";
                                    e.currentTarget.style.borderColor = "#E2E8F0";
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.875rem 1.25rem",
                borderTop: "1px solid #E2E8F0",
                backgroundColor: "#F8FAFC",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.75rem", color: "#64748B" }}>
                <span>
                  Showing {products.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
                  {Math.min(currentPage * pageSize, totalCount)} of {totalCount} products
                </span>
                <span style={{ color: "#CBD5E1" }}>|</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "2px 6px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: "#FFFFFF",
                      fontSize: "0.75rem",
                      color: "#334155",
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Prev / Next controls */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "0.35rem 0.65rem",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: currentPage <= 1 ? "#F1F5F9" : "#FFFFFF",
                    color: currentPage <= 1 ? "#94A3B8" : "#334155",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>

                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155", padding: "0 6px" }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "0.35rem 0.65rem",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: currentPage >= totalPages ? "#F1F5F9" : "#FFFFFF",
                    color: currentPage >= totalPages ? "#94A3B8" : "#334155",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* ADD / EDIT PRODUCT MODAL                                                  */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9000,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#F8FAFC",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    backgroundColor: "#CCFBF1",
                    color: "#0F766E",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Package size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800, color: "#0F172A" }}>
                    {editingProduct ? "Edit Product" : "Add New Product"}
                  </h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                    {editingProduct
                      ? `Update specifications for ${editingProduct.sku}`
                      : "Create a catalog entry available for quotations and invoices"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "1.5rem", overflowY: "auto", maxHeight: "calc(90vh - 140px)" }}>
                {formError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      backgroundColor: "#FEF2F2",
                      border: "1px solid #FECDD3",
                      color: "#B91C1C",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      marginBottom: "1.25rem",
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  {/* Product Name */}
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Product Name <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Enterprise Cloud ERP License"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.75rem",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8125rem",
                        color: "#0F172A",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* SKU / Code */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      SKU / Product Code <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ERP-ENT-001"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                      required
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.75rem",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8125rem",
                        fontFamily: "'JetBrains Mono', monospace",
                        color: "#0F172A",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* HSN / SAC Code */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      HSN / SAC Code (Tax Code)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 998313 (IT Services)"
                      value={formData.hsn_sac}
                      onChange={(e) => setFormData({ ...formData, hsn_sac: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.75rem",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8125rem",
                        color: "#0F172A",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Category <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.75rem",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8125rem",
                        color: "#0F172A",
                        outline: "none",
                        backgroundColor: "#FFFFFF",
                      }}
                    >
                      {PRESET_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="Custom">+ Custom Category</option>
                    </select>
                    {formData.category === "Custom" && (
                      <input
                        type="text"
                        placeholder="Enter category name"
                        value={formData.customCategory}
                        onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                        style={{
                          width: "100%",
                          marginTop: "6px",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          color: "#0F172A",
                          outline: "none",
                        }}
                      />
                    )}
                  </div>

                  {/* Unit */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Unit of Measure <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.75rem",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8125rem",
                        color: "#0F172A",
                        outline: "none",
                        backgroundColor: "#FFFFFF",
                      }}
                    >
                      {PRESET_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      <option value="Custom">+ Custom Unit</option>
                    </select>
                    {formData.unit === "Custom" && (
                      <input
                        type="text"
                        placeholder="e.g. Container / Box"
                        value={formData.customUnit}
                        onChange={(e) => setFormData({ ...formData, customUnit: e.target.value })}
                        style={{
                          width: "100%",
                          marginTop: "6px",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          color: "#0F172A",
                          outline: "none",
                        }}
                      />
                    )}
                  </div>

                  {/* Selling Price */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Selling Price (INR ₹) <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <span style={{ position: "absolute", left: "10px", fontSize: "0.875rem", fontWeight: 700, color: "#64748B" }}>
                        ₹
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={formData.selling_price}
                        onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                        required
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.75rem 0.55rem 1.75rem",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          fontWeight: 700,
                          color: "#0F172A",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  {/* Tax Rate */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      GST / Tax Rate (%)
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="18"
                        value={formData.tax_rate}
                        onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "0.55rem 1.75rem 0.55rem 0.75rem",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          fontWeight: 700,
                          color: "#0F172A",
                          outline: "none",
                        }}
                      />
                      <span style={{ position: "absolute", right: "10px", fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>
                        %
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Status
                    </label>
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "0.5rem 1rem",
                          borderRadius: "8px",
                          border: `1px solid ${formData.status === "active" ? "#10B981" : "#CBD5E1"}`,
                          backgroundColor: formData.status === "active" ? "#ECFDF5" : "#FFFFFF",
                          cursor: "pointer",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: formData.status === "active" ? "#047857" : "#475569",
                        }}
                      >
                        <input
                          type="radio"
                          name="status"
                          value="active"
                          checked={formData.status === "active"}
                          onChange={() => setFormData({ ...formData, status: "active" })}
                          style={{ accentColor: "#10B981" }}
                        />
                        Active (Selectable in Quotes)
                      </label>

                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "0.5rem 1rem",
                          borderRadius: "8px",
                          border: `1px solid ${formData.status === "inactive" ? "#64748B" : "#CBD5E1"}`,
                          backgroundColor: formData.status === "inactive" ? "#F1F5F9" : "#FFFFFF",
                          cursor: "pointer",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: formData.status === "inactive" ? "#334155" : "#475569",
                        }}
                      >
                        <input
                          type="radio"
                          name="status"
                          value="inactive"
                          checked={formData.status === "inactive"}
                          onChange={() => setFormData({ ...formData, status: "inactive" })}
                          style={{ accentColor: "#64748B" }}
                        />
                        Inactive / Archived
                      </label>
                    </div>
                  </div>

                  {/* Description */}
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Description & Deliverables
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Detailed features, inclusions, licensing terms, or delivery notes..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.75rem",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8125rem",
                        color: "#0F172A",
                        outline: "none",
                        resize: "vertical",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "1rem 1.5rem",
                  borderTop: "1px solid #E2E8F0",
                  backgroundColor: "#F8FAFC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: "0.55rem 1rem",
                    borderRadius: "8px",
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
                  disabled={isSubmitting}
                  style={{
                    padding: "0.55rem 1.25rem",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(13, 148, 136, 0.3)",
                  }}
                >
                  {isSubmitting ? "Saving..." : editingProduct ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SLIDE-OVER DETAIL INSPECTION DRAWER                                       */}
      {/* ========================================================================= */}
      {inspectingProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9000,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setInspectingProduct(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              height: "100%",
              backgroundColor: "#FFFFFF",
              boxShadow: "-10px 0 25px rgba(0, 0, 0, 0.15)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#F8FAFC",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    backgroundColor: "#F0FDFA",
                    color: "#0D9488",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #CCFBF1",
                  }}
                >
                  <Package size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800, color: "#0F172A" }}>
                    {inspectingProduct.name}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6875rem", color: "#64748B" }}>
                      SKU: {inspectingProduct.sku}
                    </span>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "999px",
                        backgroundColor: inspectingProduct.status === "active" ? "#ECFDF5" : "#F1F5F9",
                        color: inspectingProduct.status === "active" ? "#047857" : "#64748B",
                      }}
                    >
                      {inspectingProduct.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectingProduct(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {/* Highlight Card: Pricing & Unit */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: "12px",
                  padding: "1.25rem",
                  border: "1px solid #E2E8F0",
                }}
              >
                <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Standard Selling Price
                </span>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0D9488", margin: "4px 0 2px" }}>
                  {formatCurrency(inspectingProduct.selling_price, inspectingProduct.currency)}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                  Per {inspectingProduct.unit} + {inspectingProduct.tax_rate ?? 0}% GST
                </div>
              </div>

              {/* Specifications Grid */}
              <div>
                <h4 style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                  Product Specifications
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "10px",
                    backgroundColor: "#FFFFFF",
                    borderRadius: "10px",
                    border: "1px solid #E2E8F0",
                    padding: "1rem",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.6875rem", color: "#94A3B8", display: "block" }}>Category</span>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#1E293B" }}>
                      {inspectingProduct.category}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: "0.6875rem", color: "#94A3B8", display: "block" }}>HSN / SAC Code</span>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#1E293B", fontFamily: "'JetBrains Mono', monospace" }}>
                      {inspectingProduct.hsn_sac || "Not specified"}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: "0.6875rem", color: "#94A3B8", display: "block" }}>Unit of Measurement</span>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#1E293B" }}>
                      {inspectingProduct.unit}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: "0.6875rem", color: "#94A3B8", display: "block" }}>Tax Classification</span>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#1E293B" }}>
                      {inspectingProduct.tax_rate ?? 0}% GST
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                  Description & Deliverables
                </h4>
                <div
                  style={{
                    backgroundColor: "#F8FAFC",
                    borderRadius: "10px",
                    padding: "1rem",
                    border: "1px solid #E2E8F0",
                    fontSize: "0.8125rem",
                    color: "#334155",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {inspectingProduct.description || "No detailed description added for this product."}
                </div>
              </div>

              {/* Metadata */}
              <div
                style={{
                  marginTop: "auto",
                  paddingTop: "1rem",
                  borderTop: "1px solid #F1F5F9",
                  fontSize: "0.75rem",
                  color: "#94A3B8",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div>Created: {new Date(inspectingProduct.created_at).toLocaleString()}</div>
                <div>Last Updated: {new Date(inspectingProduct.updated_at).toLocaleString()}</div>
              </div>
            </div>

            {/* Drawer Footer */}
            {isAdminOrManager && (
              <div
                style={{
                  padding: "1rem 1.5rem",
                  borderTop: "1px solid #E2E8F0",
                  backgroundColor: "#F8FAFC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <button
                  onClick={() => {
                    const p = inspectingProduct;
                    setInspectingProduct(null);
                    handleOpenEditModal(p);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "0.55rem 1rem",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    color: "#0F172A",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Edit3 size={15} />
                  <span>Edit Product</span>
                </button>

                <button
                  onClick={() => {
                    const p = inspectingProduct;
                    setInspectingProduct(null);
                    setDeletingProduct(p);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "0.55rem 1rem",
                    borderRadius: "8px",
                    border: "1px solid #FECDD3",
                    backgroundColor: "#FEF2F2",
                    color: "#DC2626",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={15} />
                  <span>Archive</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ARCHIVE / DELETE CONFIRMATION MODAL                                       */}
      {/* ========================================================================= */}
      {deletingProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9000,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "1.5rem" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#FEE2E2",
                  color: "#DC2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                }}
              >
                <Trash2 size={24} />
              </div>
              <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.125rem", fontWeight: 800, color: "#0F172A" }}>
                Archive Product?
              </h3>
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748B", lineHeight: 1.5 }}>
                Are you sure you want to archive <strong>{deletingProduct.name}</strong> (SKU:{" "}
                <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>{deletingProduct.sku}</code>)?
              </p>
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  backgroundColor: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  fontSize: "0.75rem",
                  color: "#92400E",
                  lineHeight: 1.4,
                }}
              >
                <strong>Soft Delete:</strong> Existing quotations referencing this SKU will preserve historical records, but it will be hidden from new quotes and product pickers.
              </div>
            </div>

            <div
              style={{
                padding: "1rem 1.5rem",
                borderTop: "1px solid #E2E8F0",
                backgroundColor: "#F8FAFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                disabled={isSubmitting}
                style={{
                  padding: "0.55rem 1rem",
                  borderRadius: "8px",
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
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                style={{
                  padding: "0.55rem 1.25rem",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 6px rgba(220, 38, 38, 0.3)",
                }}
              >
                {isSubmitting ? "Archiving..." : "Yes, Archive Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
