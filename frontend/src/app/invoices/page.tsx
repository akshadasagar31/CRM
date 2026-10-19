"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { SidebarTab } from "@/components/Sidebar";
import {
  invoicesApi,
  ordersApi,
  quotationsApi,
  customersApi,
  companyApi,
  authApi,
  Invoice,
  InvoiceItem,
  InvoicePayment,
  InvoiceStatus,
  CompanyProfile,
  Customer,
  Order,
  Quotation,
  User,
  getApiBaseUrl,
  downloadPdfFile,
  printPdfBlob,
} from "@/lib/api";
import { getCleanCustomerName } from "@/lib/titleUtils";
import {
  Search,
  Plus,
  RefreshCw,
  X,
  Printer,
  Mail,
  Receipt,
  DollarSign,
  Calendar,
  CreditCard,
  Building,
  User as UserIcon,
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Briefcase,
  PackageCheck,
  ChevronDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  Percent,
  Download,
  Loader2,
} from "lucide-react";

// Status Badges & Colors
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Draft: { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
  "Issued/Sent": { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  Unpaid: { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" },
  "Partially Paid": { bg: "#EDE9FE", text: "#7C3AED", border: "#DDD6FE" },
  Paid: { bg: "#DCFCE7", text: "#15803D", border: "#BBF7D0" },
  Overdue: { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" },
  Cancelled: { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" },
  Refunded: { bg: "#FCE7F3", text: "#BE185D", border: "#FBCFE8" },
};

const ALL_STATUSES: InvoiceStatus[] = [
  "Draft",
  "Issued/Sent",
  "Unpaid",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
  "Refunded",
];

// Helper: Format INR Currency
const formatINR = (val: number | null | undefined): string => {
  const num = typeof val === "number" && !isNaN(val) ? val : 0;
  return "₹" + num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Helper: Convert Number to Words (Indian numbering format)
const numberToWordsINR = (num: number): string => {
  if (num === 0) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const inWords = (n: number): string => {
    let str = "";
    if (n >= 10000000) {
      str += inWords(Math.floor(n / 10000000)) + " Crore ";
      n %= 10000000;
    }
    if (n >= 100000) {
      str += inWords(Math.floor(n / 100000)) + " Lakh ";
      n %= 100000;
    }
    if (n >= 1000) {
      str += inWords(Math.floor(n / 1000)) + " Thousand ";
      n %= 1000;
    }
    if (n >= 100) {
      str += inWords(Math.floor(n / 100)) + " Hundred ";
      n %= 100;
    }
    if (n > 0) {
      if (n < 20) {
        str += a[n] + " ";
      } else {
        str += b[Math.floor(n / 10)] + (n % 10 > 0 ? " " + a[n % 10] : "") + " ";
      }
    }
    return str.trim();
  };

  const rupees = Math.floor(Math.abs(num));
  const paise = Math.round((Math.abs(num) - rupees) * 100);

  let result = "Rupees " + inWords(rupees);
  if (paise > 0) {
    result += " and " + inWords(paise) + " Paise";
  }
  return result + " Only";
};

export default function InvoicesPage() {
  const router = useRouter();

  // Auth & Workspace
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Invoices List State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalInvoices, setTotalInvoices] = useState(0);

  // Metrics
  const [totalInvoiced, setTotalInvoiced] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [totalOverdue, setTotalOverdue] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // View Tabs & Unbilled Orders
  const [viewTab, setViewTab] = useState<"invoices" | "ready_to_invoice">("invoices");
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [isLoadingReadyOrders, setIsLoadingReadyOrders] = useState(false);

  // Drawer & Detail View
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"items" | "payments" | "gst" | "notes">("items");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Payment Recording Modal / Form
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<string>("Bank Transfer");
  const [paymentRefNumber, setPaymentRefNumber] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Create Invoice Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"from_order" | "from_quote" | "custom">("from_order");
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [quotesList, setQuotesList] = useState<Quotation[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | "">("");
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | "">("");
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  // Custom Invoice Form State
  const [customCustomerId, setCustomCustomerId] = useState<number | "">("");
  const [customInvoiceDate, setCustomInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [customDueDate, setCustomDueDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  );
  const [customPlaceOfSupply, setCustomPlaceOfSupply] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [customTerms, setCustomTerms] = useState(
    "1. Payment due within 15 days of invoice date.\n2. Please mention Invoice number in payment reference.\n3. Goods once sold will not be taken back."
  );
  const [customItems, setCustomItems] = useState<
    Array<{
      name: string;
      description: string;
      hsn_sac: string;
      quantity: number;
      unit_price: number;
      discount_pct: number;
      gst_rate: number;
    }>
  >([
    {
      name: "",
      description: "",
      hsn_sac: "",
      quantity: 1,
      unit_price: 0,
      discount_pct: 0,
      gst_rate: 18,
    },
  ]);

  // Printable Tax Invoice Document View Modal
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState<number | null>(null);

  const handleSendEmail = async (inv: Invoice) => {
    setIsSendingEmail(inv.id);
    try {
      const res = await invoicesApi.sendEmail(inv.id);
      showToast(res.message || "Invoice PDF email queued for delivery!", "success");
      loadInvoices();
      if (selectedInvoice && selectedInvoice.id === inv.id) {
        setSelectedInvoice({ ...selectedInvoice, status: "Sent" });
      }
    } catch (err: any) {
      showToast(err.message || "Failed to send invoice email", "error");
    } finally {
      setIsSendingEmail(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  useEffect(() => {
    if (isPrintModalOpen && printInvoice) {
      let active = true;
      setPdfLoading(true);
      invoicesApi.getPdfBlob(printInvoice.id)
        .then((blob: Blob) => {
          if (!active) return;
          const url = URL.createObjectURL(blob);
          setPdfBlobUrl(url);
        })
        .catch((err: any) => {
          console.error("Failed to load invoice PDF:", err);
          showToast("Failed to load invoice PDF: " + (err?.message || "Unknown error"), "error");
        })
        .finally(() => {
          if (active) setPdfLoading(false);
        });

      return () => {
        active = false;
        if (pdfBlobUrl) {
          URL.revokeObjectURL(pdfBlobUrl);
        }
      };
    } else {
      setPdfBlobUrl(null);
    }
  }, [isPrintModalOpen, printInvoice?.id]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check Auth & Load Company Profile
  useEffect(() => {
    authApi
      .getMe()
      .then((u) => setCurrentUser(u))
      .catch(() => router.push("/login"));

    companyApi
      .get()
      .then((comp) => {
        setCompanyProfile(comp);
        if (comp.state) {
          setCustomPlaceOfSupply(comp.state);
        }
      })
      .catch(() => {});
  }, [router]);

  // Load Invoices
  const loadInvoices = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await invoicesApi.list({
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        search: searchQuery.trim() || undefined,
        page: currentPage,
        limit: 20,
      });

      setInvoices(res.items || []);
      setTotalInvoices(res.total || 0);
      setTotalPages(res.pages || 1);
      setTotalInvoiced(res.total_invoiced || 0);
      setTotalPaid(res.total_paid || 0);
      setTotalOutstanding(res.total_outstanding || 0);
      setTotalOverdue(res.total_overdue || 0);
    } catch (err: any) {
      showToast(err.message || "Failed to load invoices", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedStatus, searchQuery, currentPage]);

  const loadReadyOrders = useCallback(async () => {
    setIsLoadingReadyOrders(true);
    try {
      const res = await ordersApi.list({ invoice_status: "Not Invoiced", limit: 100 });
      setReadyOrders(res.items || []);
    } catch (err) {
      console.error("Failed to load ready orders", err);
    } finally {
      setIsLoadingReadyOrders(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
    loadReadyOrders();
  }, [loadInvoices, loadReadyOrders]);

  // Load reference data for create modal
  const loadCreatePrerequisites = async () => {
    try {
      const [ordRes, qRes, custRes] = await Promise.all([
        ordersApi.list({ limit: 100 }),
        quotationsApi.list({ status: "Accepted", limit: 100 }),
        customersApi.list("", 1, 100),
      ]);
      setOrdersList(ordRes.items || []);
      setQuotesList(qRes.items || []);
      setCustomersList(custRes.items || []);
    } catch (err) {
      console.error("Failed to load create prerequisites", err);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    loadCreatePrerequisites();
    setIsCreateModalOpen(true);
  };

  // Open Create Modal from Ready for Invoice queue
  const handleOpenCreateFromReadyOrder = async (ord: Order) => {
    await loadCreatePrerequisites();
    setCreateMode("from_order");
    setSelectedOrderId(ord.id);
    setIsCreateModalOpen(true);
  };

  // Handle Quick Create from Order
  const handleCreateFromOrder = async () => {
    if (!selectedOrderId) {
      showToast("Please select an order", "error");
      return;
    }
    try {
      setIsCreatingInvoice(true);
      const created = await invoicesApi.createFromOrder(Number(selectedOrderId));
      showToast(`Invoice ${created.invoice_number} created successfully!`);
      setIsCreateModalOpen(false);
      setSelectedOrderId("");
      loadInvoices();
      loadReadyOrders();
      setSelectedInvoice(created);
      setIsDrawerOpen(true);
    } catch (err: any) {
      showToast(err.message || "Failed to create invoice from order", "error");
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  // Handle Quick Create from Quotation
  const handleCreateFromQuotation = async () => {
    if (!selectedQuoteId) {
      showToast("Please select an accepted quotation", "error");
      return;
    }
    try {
      setIsCreatingInvoice(true);
      const created = await invoicesApi.createFromQuotation(Number(selectedQuoteId));
      showToast(`Invoice ${created.invoice_number} created successfully!`);
      setIsCreateModalOpen(false);
      setSelectedQuoteId("");
      loadInvoices();
      setSelectedInvoice(created);
      setIsDrawerOpen(true);
    } catch (err: any) {
      showToast(err.message || "Failed to create invoice from quotation", "error");
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  // Handle Custom Invoice Creation
  const handleCreateCustomInvoice = async () => {
    if (!customCustomerId) {
      showToast("Please select a customer", "error");
      return;
    }
    const cust = customersList.find((c) => c.id === customCustomerId);
    if (!cust) {
      showToast("Selected customer not found", "error");
      return;
    }

    const validItems = customItems.filter((i) => i.name.trim() && i.quantity > 0 && i.unit_price >= 0);
    if (validItems.length === 0) {
      showToast("Please provide at least one valid line item", "error");
      return;
    }

    try {
      setIsCreatingInvoice(true);
      const created = await invoicesApi.create({
        customer_id: cust.id,
        customer_name: cust.name,
        customer_email: cust.email || undefined,
        customer_phone: cust.phone || undefined,
        customer_company: cust.company || undefined,
        customer_address: cust.address || undefined,
        customer_gstin: cust.gstin || undefined,
        place_of_supply: customPlaceOfSupply.trim() || undefined,
        invoice_date: customInvoiceDate,
        due_date: customDueDate || undefined,
        notes: customNotes.trim() || undefined,
        terms_conditions: customTerms.trim() || undefined,
        currency: "INR",
        items: validItems.map((it) => ({
          name: it.name.trim(),
          description: it.description.trim() || undefined,
          hsn_sac: it.hsn_sac.trim() || undefined,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          discount_pct: Number(it.discount_pct || 0),
          gst_rate: Number(it.gst_rate || 0),
        })),
      });

      showToast(`Invoice ${created.invoice_number} created successfully!`);
      setIsCreateModalOpen(false);
      loadInvoices();
      setSelectedInvoice(created);
      setIsDrawerOpen(true);
    } catch (err: any) {
      showToast(err.message || "Failed to create invoice", "error");
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  // Change Invoice Status
  const handleChangeStatus = async (invoiceId: number, newStatus: string) => {
    try {
      setIsUpdatingStatus(true);
      const updated = await invoicesApi.changeStatus(invoiceId, newStatus);
      showToast(`Invoice status updated to ${newStatus}`);
      setSelectedInvoice(updated);
      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? updated : inv)));
      loadInvoices();
    } catch (err: any) {
      showToast(err.message || "Failed to update status", "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Open Payment Modal
  const handleOpenPaymentModal = () => {
    if (!selectedInvoice) return;
    setPaymentAmount(selectedInvoice.remaining_balance > 0 ? selectedInvoice.remaining_balance.toString() : "");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("Bank Transfer");
    setPaymentRefNumber("");
    setPaymentNotes("");
    setIsPaymentModalOpen(true);
  };

  // Record Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid payment amount greater than zero", "error");
      return;
    }

    try {
      setIsSubmittingPayment(true);
      const updated = await invoicesApi.recordPayment(selectedInvoice.id, {
        amount: amt,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference_number: paymentRefNumber.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });

      showToast(`Payment of ${formatINR(amt)} recorded successfully!`);
      setIsPaymentModalOpen(false);
      setSelectedInvoice(updated);
      setInvoices((prev) => prev.map((inv) => (inv.id === updated.id ? updated : inv)));
      loadInvoices();
    } catch (err: any) {
      showToast(err.message || "Failed to record payment", "error");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Delete Invoice
  const handleDeleteInvoice = async (invoiceId: number) => {
    if (!confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) {
      return;
    }
    try {
      await invoicesApi.delete(invoiceId);
      showToast("Invoice deleted successfully");
      setIsDrawerOpen(false);
      setSelectedInvoice(null);
      loadInvoices();
    } catch (err: any) {
      showToast(err.message || "Failed to delete invoice", "error");
    }
  };

  // Open Print Modal
  const handleOpenPrintModal = async (inv: Invoice) => {
    try {
      const detailed = await invoicesApi.get(inv.id);
      setPrintInvoice(detailed);
      setIsPrintModalOpen(true);
    } catch {
      setPrintInvoice(inv);
      setIsPrintModalOpen(true);
    }
  };

  // Check if invoice is inter-state
  const isInterState = useMemo(() => {
    if (!printInvoice) return false;
    const compState = (printInvoice.company_state || companyProfile?.state || "").trim().toLowerCase();
    const placeOfSupply = (printInvoice.place_of_supply || "").trim().toLowerCase();
    if (!compState || !placeOfSupply) return false;
    return compState !== placeOfSupply;
  }, [printInvoice, companyProfile]);

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#F8FAFC", overflow: "hidden" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: toastMessage.type === "success" ? "#0F766E" : "#DC2626",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {toastMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toastMessage.text}
        </div>
      )}

      {/* Unified Sidebar */}
      <Sidebar
        activeTab="invoices"
        onSelectTab={(tab: SidebarTab) => {
          if (tab === "dashboard") router.push("/dashboard");
          else if (tab === "leads") router.push("/leads");
          else if (tab === "deals") router.push("/deals");
          else if (tab === "quotations") router.push("/quotations");
          else if (tab === "orders") router.push("/orders");
          else if (tab === "invoices") {
            // Already on invoices
          } else if (tab === "payments") router.push("/payments");
          else if (tab === "inventory") router.push("/inventory");
          else if (tab === "products") router.push("/products");
          else if (tab === "follow-ups") router.push("/follow-ups");
          else if (tab === "company") router.push("/company");
          else if (tab === "api-keys") router.push("/leads?tab=api-keys");
          else if (tab === "api-docs") router.push("/leads?tab=api-docs");
          else if (tab === "profile") router.push("/leads?tab=profile");
        }}
        invoicesCount={totalInvoices}
        user={currentUser}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenAdminSettings={() => {}}
      />

      {/* Main Content Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        {/* Top Header */}
        <header
          style={{
            height: "65px",
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #E2E8F0",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "#F0FDFA",
                border: "1px solid #99F6E4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0F766E",
              }}
            >
              <Receipt size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                Invoices & Billing
              </h1>
              <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>
                GST Tax Invoices, Payment Tracking & Financial Reconciliation
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              id="btn-refresh-invoices"
              onClick={loadInvoices}
              disabled={isRefreshing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Refresh Invoices"
            >
              <RefreshCw size={14} className={isRefreshing ? "spin-animation" : ""} />
              <span>Refresh</span>
            </button>

            <button
              id="btn-create-invoice"
              onClick={handleOpenCreateModal}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                backgroundColor: "#0D9488",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "#FFFFFF",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(13, 148, 136, 0.2)",
                transition: "all 0.15s ease",
              }}
            >
              <Plus size={16} />
              <span>Create Invoice</span>
            </button>
          </div>
        </header>

        {/* Scrollable Body Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* KPI Metrics Strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            {/* Metric 1: Total Invoiced */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "16px 20px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Total Invoiced
              </div>
              <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
                {formatINR(totalInvoiced)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>
                Across {totalInvoices} invoices
              </div>
            </div>

            {/* Metric 2: Total Received / Paid */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "16px 20px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#15803D", textTransform: "uppercase" }}>
                Total Paid / Received
              </div>
              <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#15803D", marginTop: "4px" }}>
                {formatINR(totalPaid)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>
                Settled payments
              </div>
            </div>

            {/* Metric 3: Outstanding Balance */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "16px 20px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#D97706", textTransform: "uppercase" }}>
                Outstanding Balance
              </div>
              <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#D97706", marginTop: "4px" }}>
                {formatINR(totalOutstanding)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>
                Pending collection
              </div>
            </div>

            {/* Metric 4: Overdue Amount */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "16px 20px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#DC2626", textTransform: "uppercase" }}>
                Overdue Invoices
              </div>
              <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#DC2626", marginTop: "4px" }}>
                {formatINR(totalOverdue)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#DC2626", marginTop: "4px", fontWeight: 600 }}>
                Requires urgent follow-up
              </div>
            </div>
          </div>

          {/* View Tab Switcher: All Invoices vs Ready for Invoice */}
          <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid #E2E8F0", paddingBottom: "12px" }}>
            <button
              onClick={() => setViewTab("invoices")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 700,
                cursor: "pointer",
                border: viewTab === "invoices" ? "1px solid #0D9488" : "1px solid #E2E8F0",
                backgroundColor: viewTab === "invoices" ? "#F0FDFA" : "#FFFFFF",
                color: viewTab === "invoices" ? "#0F766E" : "#64748B",
                boxShadow: viewTab === "invoices" ? "0 1px 2px rgba(13, 148, 136, 0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Receipt size={16} />
              <span>All Invoices</span>
              <span
                style={{
                  backgroundColor: viewTab === "invoices" ? "#0D9488" : "#E2E8F0",
                  color: viewTab === "invoices" ? "#FFFFFF" : "#475569",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                {totalInvoices}
              </span>
            </button>

            <button
              onClick={() => setViewTab("ready_to_invoice")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 700,
                cursor: "pointer",
                border: viewTab === "ready_to_invoice" ? "1px solid #4F46E5" : "1px solid #E2E8F0",
                backgroundColor: viewTab === "ready_to_invoice" ? "#EEF2FF" : "#FFFFFF",
                color: viewTab === "ready_to_invoice" ? "#4338CA" : "#64748B",
                boxShadow: viewTab === "ready_to_invoice" ? "0 1px 2px rgba(79, 70, 229, 0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <PackageCheck size={16} />
              <span>Ready for Invoice</span>
              <span
                style={{
                  backgroundColor: viewTab === "ready_to_invoice" ? "#4F46E5" : "#E2E8F0",
                  color: viewTab === "ready_to_invoice" ? "#FFFFFF" : "#475569",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                {readyOrders.length}
              </span>
            </button>
          </div>

          {viewTab === "ready_to_invoice" ? (
            /* ======================================================== */
            /* READY FOR INVOICE QUEUE (Unbilled Orders)               */
            /* ======================================================== */
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0F172A", margin: "0 0 2px 0" }}>
                    Unbilled Orders Awaiting Invoice Generation
                  </h3>
                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>
                    These orders have accepted quotations and are ready to be billed without creating empty database invoices.
                  </p>
                </div>
                <button
                  onClick={loadReadyOrders}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    color: "#475569",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={12} className={isLoadingReadyOrders ? "spin-animation" : ""} /> Refresh
                </button>
              </div>

              {isLoadingReadyOrders ? (
                <div style={{ padding: "60px 0", textAlign: "center", color: "#64748B" }}>
                  <RefreshCw size={24} className="spin-animation" style={{ margin: "0 auto 12px" }} />
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>Loading unbilled orders...</p>
                </div>
              ) : readyOrders.length === 0 ? (
                <div style={{ padding: "60px 0", textAlign: "center" }}>
                  <PackageCheck size={40} style={{ color: "#CBD5E1", margin: "0 auto 12px" }} />
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1E293B", margin: "0 0 4px 0" }}>
                    No Unbilled Orders
                  </h3>
                  <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: 0 }}>
                    All accepted quotations and fulfillment orders have been fully invoiced.
                  </p>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Order #</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Title & Customer</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Origin & Lineage</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Order Stage</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Billing Status</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Amount</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readyOrders.map((ord) => (
                      <tr key={ord.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            onClick={() => router.push("/orders")}
                            style={{
                              fontWeight: 700,
                              color: "#0D9488",
                              fontFamily: "monospace",
                              cursor: "pointer",
                            }}
                          >
                            {ord.order_number}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, color: "#0F172A" }}>{getCleanCustomerName(ord.customer, ord.title)}</div>
                          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                            {ord.customer?.name} {ord.customer?.company ? `• ${ord.customer.company}` : ""}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {(ord.lead_number || ord.deal?.lead_number || ord.quotation?.lead_number) && (
                              <span
                                onClick={() => router.push(`/leads?search=${encodeURIComponent(ord.lead_number || ord.deal?.lead_number || ord.quotation?.lead_number || "")}`)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "#F0FDFA",
                                  color: "#0D9488",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  width: "fit-content",
                                }}
                                title="Originating Lead"
                              >
                                <UserIcon size={10} /> {ord.lead_number || ord.deal?.lead_number || ord.quotation?.lead_number}
                              </span>
                            )}
                            {ord.deal && (
                              <span
                                onClick={() => router.push("/deals")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "#F0F9FF",
                                  color: "#0284C7",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  width: "fit-content",
                                }}
                                title="Linked Deal"
                              >
                                <Briefcase size={10} /> {ord.deal.deal_number}
                              </span>
                            )}
                            {ord.quotation && (
                              <span
                                onClick={() => router.push("/quotations")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "#FAF5FF",
                                  color: "#7C3AED",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  width: "fit-content",
                                }}
                                title="Accepted Quotation"
                              >
                                <FileText size={10} /> {ord.quotation.quotation_number}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              backgroundColor: "#F1F5F9",
                              color: "#475569",
                            }}
                          >
                            {ord.stage}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              backgroundColor: "#EEF2FF",
                              color: "#4F46E5",
                              border: "1px solid #C7D2FE",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Clock size={11} /> Ready for Invoice
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: "#0F172A" }}>
                          {formatINR(ord.total_amount)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <button
                            onClick={() => handleOpenCreateFromReadyOrder(ord)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              backgroundColor: "#0D9488",
                              color: "#FFFFFF",
                              border: "none",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              boxShadow: "0 1px 2px rgba(13, 148, 136, 0.2)",
                            }}
                          >
                            <Plus size={12} /> Create Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <>
          {/* Search & Status Filters */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "10px",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            {/* Search Input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#F8FAFC",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                padding: "6px 12px",
                flex: "1 1 280px",
                maxWidth: "400px",
              }}
            >
              <Search size={16} color="#64748B" />
              <input
                id="input-search-invoices"
                type="text"
                placeholder="Search by invoice #, customer name, notes..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  border: "none",
                  outline: "none",
                  backgroundColor: "transparent",
                  fontSize: "0.8125rem",
                  width: "100%",
                  color: "#0F172A",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", overflowX: "auto", flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setSelectedStatus("all");
                  setCurrentPage(1);
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: selectedStatus === "all" ? "1px solid #0D9488" : "1px solid #E2E8F0",
                  backgroundColor: selectedStatus === "all" ? "#CCFBF1" : "#FFFFFF",
                  color: selectedStatus === "all" ? "#0F766E" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                All ({totalInvoices})
              </button>
              {ALL_STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setSelectedStatus(st);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: selectedStatus === st ? `1px solid ${STATUS_COLORS[st]?.border || "#0D9488"}` : "1px solid #E2E8F0",
                    backgroundColor: selectedStatus === st ? STATUS_COLORS[st]?.bg || "#F1F5F9" : "#FFFFFF",
                    color: selectedStatus === st ? STATUS_COLORS[st]?.text || "#0F172A" : "#64748B",
                    transition: "all 0.15s ease",
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices Data Table */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "10px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              overflow: "hidden",
            }}
          >
            {isLoading ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: "#64748B" }}>
                <RefreshCw size={24} className="spin-animation" style={{ margin: "0 auto 12px" }} />
                <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>Loading invoices...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center" }}>
                <Receipt size={40} style={{ color: "#CBD5E1", margin: "0 auto 12px" }} />
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#1E293B", margin: "0 0 4px 0" }}>
                  No Invoices Found
                </h3>
                <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: "0 0 16px 0" }}>
                  {searchQuery || selectedStatus !== "all"
                    ? "Try adjusting your filters or search keywords."
                    : "Create your first GST Tax Invoice from an Order, Quotation, or manually."}
                </p>
                <button
                  onClick={handleOpenCreateModal}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  + Create Invoice
                </button>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Invoice # & Dates</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Customer</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Source</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569" }}>Status</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", textAlign: "right" }}>Total & Balance</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const stColor = STATUS_COLORS[inv.status] || { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" };
                    const isOverdue = inv.status === "Overdue" || (inv.remaining_balance > 0 && inv.due_date && new Date(inv.due_date) < new Date());

                    return (
                      <tr
                        key={inv.id}
                        style={{
                          borderBottom: "1px solid #F1F5F9",
                          transition: "background-color 0.15s ease",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setIsDrawerOpen(true);
                        }}
                      >
                        {/* Invoice Number & Dates */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: "#0F766E",
                              backgroundColor: "#CCFBF1",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Receipt size={13} />
                            {inv.invoice_number}
                          </span>
                          <div style={{ fontSize: "0.75rem", color: isOverdue ? "#DC2626" : "#64748B", fontWeight: isOverdue ? 700 : 400, marginTop: "4px" }}>
                            Date: {inv.invoice_date?.slice(0, 10)} {inv.due_date ? `• Due: ${inv.due_date.slice(0, 10)}` : ""} {isOverdue && "⚠️"}
                          </div>
                        </td>

                        {/* Customer */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, color: "#0F172A" }}>{inv.customer?.name || inv.customer_name}</div>
                          {(inv.customer?.company || inv.customer_company) && (
                            <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{inv.customer?.company || inv.customer_company}</div>
                          )}
                        </td>

                        {/* Linked Source (Lead / Deal / Quotation / Order) */}
                        <td style={{ padding: "12px 16px" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                            {(inv.lead_number || inv.deal?.lead_number) && (
                              <span
                                onClick={() => router.push(`/leads?search=${encodeURIComponent(inv.lead_number || inv.deal?.lead_number || "")}`)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "#F0FDFA",
                                  color: "#0F766E",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  width: "fit-content",
                                }}
                                title="Originating Lead"
                              >
                                <UserIcon size={10} /> {inv.lead_number || inv.deal?.lead_number}
                              </span>
                            )}
                            {inv.deal && (
                              <span
                                onClick={() => router.push("/deals")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "#F0F9FF",
                                  color: "#0284C7",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  width: "fit-content",
                                }}
                                title="Linked Deal"
                              >
                                <Briefcase size={10} /> {inv.deal.deal_number}
                              </span>
                            )}
                            {inv.quotation && (
                              <span
                                onClick={() => router.push("/quotations")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "#FAF5FF",
                                  color: "#7C3AED",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  width: "fit-content",
                                }}
                                title="Accepted Quotation"
                              >
                                <FileText size={10} /> {inv.quotation.quotation_number}
                              </span>
                            )}
                            {inv.order && (
                              <span
                                onClick={() => router.push("/orders")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "#EFF6FF",
                                  color: "#1D4ED8",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  width: "fit-content",
                                }}
                                title="Linked Order"
                              >
                                <PackageCheck size={10} /> {inv.order.order_number}
                              </span>
                            )}
                            {!inv.order && !inv.quotation && !inv.deal && !inv.lead_number && (
                              <span style={{ color: "#94A3B8", fontSize: "0.75rem" }}>Direct Invoice</span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: "999px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              backgroundColor: stColor.bg,
                              color: stColor.text,
                              border: `1px solid ${stColor.border}`,
                            }}
                          >
                            {inv.status}
                          </span>
                        </td>

                        {/* Total & Balance */}
                        <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 700, color: "#0F172A" }}>
                            {formatINR(inv.grand_total)}
                          </div>
                          <div style={{ fontSize: "0.75rem", marginTop: "2px" }}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: inv.remaining_balance > 0 ? (isOverdue ? "#DC2626" : "#D97706") : "#15803D",
                              }}
                            >
                              Due: {formatINR(inv.remaining_balance)}
                            </span>
                            {inv.amount_paid > 0 && (
                              <span style={{ color: "#15803D", marginLeft: "4px" }}>
                                (Paid: {formatINR(inv.amount_paid)})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            {/* Print / View Tax Invoice Document */}
                            <button
                              onClick={() => handleOpenPrintModal(inv)}
                              title="Print GST Tax Invoice"
                              style={{
                                padding: "5px 8px",
                                borderRadius: "6px",
                                border: "1px solid #CBD5E1",
                                backgroundColor: "#FFFFFF",
                                color: "#0F766E",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              <Printer size={13} /> Print
                            </button>

                            {/* Email Tax Invoice PDF */}
                            <button
                              onClick={() => handleSendEmail(inv)}
                              disabled={isSendingEmail === inv.id}
                              title="Email Tax Invoice PDF to Customer"
                              style={{
                                padding: "5px 8px",
                                borderRadius: "6px",
                                border: "1px solid #CBD5E1",
                                backgroundColor: isSendingEmail === inv.id ? "#F1F5F9" : "#FFFFFF",
                                color: "#2563EB",
                                cursor: isSendingEmail === inv.id ? "wait" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              {isSendingEmail === inv.id ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />} Email
                            </button>

                            {/* View / Detail */}
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setIsDrawerOpen(true);
                              }}
                              title="Open Detail Drawer"
                              style={{
                                padding: "5px 8px",
                                borderRadius: "6px",
                                border: "1px solid #CBD5E1",
                                backgroundColor: "#FFFFFF",
                                color: "#475569",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#F8FAFC",
                  borderTop: "1px solid #E2E8F0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.8125rem",
                }}
              >
                <span style={{ color: "#64748B" }}>
                  Page {currentPage} of {totalPages}
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: currentPage <= 1 ? "#F1F5F9" : "#FFFFFF",
                      cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: currentPage >= totalPages ? "#F1F5F9" : "#FFFFFF",
                      cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* INVOICE DETAIL CENTERED MODAL                            */}
      {/* ======================================================== */}
      {isDrawerOpen && selectedInvoice && (
        <div
          id="invoice-detail-drawer-overlay"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            id="invoice-detail-drawer"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "1000px",
              maxHeight: "90vh",
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid #E2E8F0",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#F8FAFC",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    backgroundColor: "#CCFBF1",
                    color: "#0F766E",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Receipt size={20} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 800,
                        color: "#0F766E",
                        backgroundColor: "#CCFBF1",
                        padding: "2px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      {selectedInvoice.invoice_number}
                    </span>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        backgroundColor: STATUS_COLORS[selectedInvoice.status]?.bg || "#F1F5F9",
                        color: STATUS_COLORS[selectedInvoice.status]?.text || "#475569",
                        border: `1px solid ${STATUS_COLORS[selectedInvoice.status]?.border || "#CBD5E1"}`,
                        textTransform: "uppercase",
                      }}
                    >
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    {selectedInvoice.customer?.name || selectedInvoice.customer_name}
                  </h2>
                  {(selectedInvoice.customer?.company || selectedInvoice.customer_company) && (
                    <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                      {selectedInvoice.customer?.company || selectedInvoice.customer_company}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  title="Close modal (Esc)"
                  style={{
                    padding: "6px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#64748B",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body (Internally Scrollable) */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* 2-Column Overview Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "16px", alignItems: "start" }}>
                {/* Left Column: Customer & Sales Lineage */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Customer & Billing Snapshot */}
                  <div
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: "10px",
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Customer & Billing Info
                    </span>
                    <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "0.875rem" }}>
                      {selectedInvoice.customer?.name || selectedInvoice.customer_name}
                    </div>
                    {(selectedInvoice.customer?.company || selectedInvoice.customer_company) && (
                      <div style={{ fontSize: "0.75rem", color: "#475569" }}>
                        {selectedInvoice.customer?.company || selectedInvoice.customer_company}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px", fontSize: "0.75rem" }}>
                      <div>
                        <span style={{ color: "#64748B" }}>GSTIN: </span>
                        <strong style={{ color: "#0F172A" }}>{selectedInvoice.customer_gstin || "Unregistered"}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748B" }}>Place of Supply: </span>
                        <strong style={{ color: "#0F172A" }}>{selectedInvoice.place_of_supply || "Not specified"}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Sales Origin & Lineage Card */}
                  <div
                    style={{
                      padding: "12px 14px",
                      backgroundColor: "#F8FAFC",
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Layers size={13} color="#0D9488" />
                        Sales Origin & Lineage
                      </span>
                      <span style={{ fontSize: "0.6875rem", color: "#64748B" }}>End-to-End Tracking</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.75rem" }}>
                      {/* Originating Lead */}
                      <div style={{ backgroundColor: "#FFFFFF", padding: "8px 10px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                        <div style={{ color: "#64748B", fontSize: "0.6875rem", marginBottom: "2px" }}>Originating Lead</div>
                        {selectedInvoice.lead_number || selectedInvoice.deal?.lead_number ? (
                          <div
                            onClick={() => router.push(`/leads?search=${encodeURIComponent(selectedInvoice.lead_number || selectedInvoice.deal?.lead_number || "")}`)}
                            style={{ fontWeight: 700, color: "#0D9488", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <UserIcon size={12} />
                            {selectedInvoice.lead_number || selectedInvoice.deal?.lead_number}
                          </div>
                        ) : (
                          <div style={{ color: "#94A3B8" }}>—</div>
                        )}
                      </div>

                      {/* Linked Deal */}
                      <div style={{ backgroundColor: "#FFFFFF", padding: "8px 10px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                        <div style={{ color: "#64748B", fontSize: "0.6875rem", marginBottom: "2px" }}>Linked Deal</div>
                        {selectedInvoice.deal ? (
                          <div
                            onClick={() => router.push("/deals")}
                            style={{ fontWeight: 700, color: "#0284C7", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <Briefcase size={12} />
                            {selectedInvoice.deal.deal_number}
                          </div>
                        ) : (
                          <div style={{ color: "#94A3B8" }}>—</div>
                        )}
                      </div>

                      {/* Accepted Quotation */}
                      <div style={{ backgroundColor: "#FFFFFF", padding: "8px 10px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                        <div style={{ color: "#64748B", fontSize: "0.6875rem", marginBottom: "2px" }}>Quotation</div>
                        {selectedInvoice.quotation ? (
                          <div
                            onClick={() => router.push("/quotations")}
                            style={{ fontWeight: 700, color: "#7C3AED", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <FileText size={12} />
                            {selectedInvoice.quotation.quotation_number}
                          </div>
                        ) : (
                          <div style={{ color: "#94A3B8" }}>—</div>
                        )}
                      </div>

                      {/* Linked Order */}
                      <div style={{ backgroundColor: "#FFFFFF", padding: "8px 10px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                        <div style={{ color: "#64748B", fontSize: "0.6875rem", marginBottom: "2px" }}>Linked Order</div>
                        {selectedInvoice.order ? (
                          <div
                            onClick={() => router.push("/orders")}
                            style={{ fontWeight: 700, color: "#1D4ED8", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <PackageCheck size={12} />
                            {selectedInvoice.order.order_number}
                          </div>
                        ) : (
                          <div style={{ color: "#94A3B8" }}>—</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Financial Summary & Dates */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Financial Balance Summary Card */}
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "10px",
                      backgroundColor: "#F8FAFC",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                        Grand Total
                      </div>
                      <div style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#0F172A", marginTop: "2px" }}>
                        {formatINR(selectedInvoice.grand_total)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#15803D", textTransform: "uppercase" }}>
                        Amount Paid
                      </div>
                      <div style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#15803D", marginTop: "2px" }}>
                        {formatINR(selectedInvoice.amount_paid)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#D97706", textTransform: "uppercase" }}>
                        Balance Due
                      </div>
                      <div
                        style={{
                          fontSize: "1.0625rem",
                          fontWeight: 800,
                          color: selectedInvoice.remaining_balance > 0 ? "#DC2626" : "#15803D",
                          marginTop: "2px",
                        }}
                      >
                        {formatINR(selectedInvoice.remaining_balance)}
                      </div>
                    </div>
                  </div>

                  {/* Dates & Payment Terms Card */}
                  <div
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: "10px",
                      padding: "14px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      fontSize: "0.75rem",
                    }}
                  >
                    <div>
                      <span style={{ color: "#64748B", display: "block" }}>Invoice Date:</span>
                      <strong style={{ color: "#0F172A" }}>
                        {selectedInvoice.invoice_date || new Date(selectedInvoice.created_at).toLocaleDateString()}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", display: "block" }}>Due Date:</span>
                      <strong style={{ color: selectedInvoice.due_date && new Date(selectedInvoice.due_date) < new Date() && selectedInvoice.remaining_balance > 0 ? "#DC2626" : "#0F172A" }}>
                        {selectedInvoice.due_date || "Immediate"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid #E2E8F0",
                  backgroundColor: "#F8FAFC",
                  borderRadius: "8px 8px 0 0",
                  padding: "0 12px",
                }}
              >
                {[
                  { id: "items", label: "Line Items & Taxes" },
                  { id: "payments", label: `Payments (${selectedInvoice.payments?.length || 0})` },
                  { id: "gst", label: "GST & Billing Details" },
                  { id: "notes", label: "Notes & Terms" },
                ].map((tb) => (
                  <button
                    key={tb.id}
                    onClick={() => setDrawerTab(tb.id as any)}
                    style={{
                      padding: "10px 16px",
                      fontSize: "0.8125rem",
                      fontWeight: drawerTab === tb.id ? 700 : 500,
                      color: drawerTab === tb.id ? "#0D9488" : "#64748B",
                      borderBottom: drawerTab === tb.id ? "2px solid #0D9488" : "2px solid transparent",
                      background: "none",
                      borderTop: "none",
                      borderLeft: "none",
                      borderRight: "none",
                      cursor: "pointer",
                    }}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>

              {/* Drawer Tab Content */}
              <div>
                {drawerTab === "items" && (
                  <div>
                    <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                            <th style={{ padding: "8px 10px", textAlign: "left" }}>Item & Description</th>
                            <th style={{ padding: "8px 10px", textAlign: "center" }}>HSN/SAC</th>
                            <th style={{ padding: "8px 10px", textAlign: "center" }}>Qty</th>
                            <th style={{ padding: "8px 10px", textAlign: "right" }}>Rate</th>
                            <th style={{ padding: "8px 10px", textAlign: "center" }}>GST %</th>
                            <th style={{ padding: "8px 10px", textAlign: "right" }}>Tax Amt</th>
                            <th style={{ padding: "8px 10px", textAlign: "right" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.items?.map((it, idx) => (
                            <tr key={it.id || idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "8px 10px" }}>
                                <div style={{ fontWeight: 600, color: "#0F172A" }}>{it.product_name || it.name}</div>
                              </td>
                              <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748B" }}>
                                {it.hsn_sac || "—"}
                              </td>
                              <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>{it.quantity}</td>
                              <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatINR(it.unit_price)}</td>
                              <td style={{ padding: "8px 10px", textAlign: "center", color: "#0F766E", fontWeight: 600 }}>{it.gst_rate}%</td>
                              <td style={{ padding: "8px 10px", textAlign: "right", color: "#64748B" }}>
                                {formatINR((it.cgst_amount || 0) + (it.sgst_amount || 0) + (it.igst_amount || 0))}
                              </td>
                              <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#0F172A" }}>
                                {formatINR(it.total_amount ?? it.line_total ?? 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Financial Breakdown */}
                    <div
                      style={{
                        marginTop: "16px",
                        padding: "14px 18px",
                        backgroundColor: "#F8FAFC",
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ color: "#64748B" }}>Subtotal (Taxable):</span>
                        <strong style={{ color: "#1E293B" }}>{formatINR(selectedInvoice.subtotal)}</strong>
                      </div>

                      {selectedInvoice.discount_amount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ color: "#64748B" }}>Discount:</span>
                          <strong style={{ color: "#DC2626" }}>-{formatINR(selectedInvoice.discount_amount)}</strong>
                        </div>
                      )}

                      {selectedInvoice.cgst_amount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ color: "#64748B" }}>CGST:</span>
                          <strong style={{ color: "#1E293B" }}>{formatINR(selectedInvoice.cgst_amount)}</strong>
                        </div>
                      )}

                      {selectedInvoice.sgst_amount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ color: "#64748B" }}>SGST:</span>
                          <strong style={{ color: "#1E293B" }}>{formatINR(selectedInvoice.sgst_amount)}</strong>
                        </div>
                      )}

                      {selectedInvoice.igst_amount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ color: "#64748B" }}>IGST:</span>
                          <strong style={{ color: "#1E293B" }}>{formatINR(selectedInvoice.igst_amount)}</strong>
                        </div>
                      )}

                      {selectedInvoice.round_off !== 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span style={{ color: "#64748B" }}>Round Off:</span>
                          <strong style={{ color: "#1E293B" }}>{formatINR(selectedInvoice.round_off)}</strong>
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          paddingTop: "8px",
                          marginTop: "8px",
                          borderTop: "2px solid #CBD5E1",
                          fontSize: "0.9375rem",
                        }}
                      >
                        <strong style={{ color: "#0F172A" }}>Grand Total:</strong>
                        <strong style={{ color: "#0F766E", fontSize: "1rem" }}>
                          {formatINR(selectedInvoice.grand_total)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {drawerTab === "payments" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#475569", margin: 0 }}>
                        Payment History Audit Trail
                      </h4>
                      <button
                        onClick={handleOpenPaymentModal}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "6px",
                          backgroundColor: "#15803D",
                          color: "#FFFFFF",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        + Record Payment
                      </button>
                    </div>

                    {!selectedInvoice.payments || selectedInvoice.payments.length === 0 ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "#64748B" }}>
                        <CreditCard size={32} style={{ color: "#CBD5E1", margin: "0 auto 8px" }} />
                        <p style={{ margin: 0, fontSize: "0.8125rem" }}>No payments recorded yet for this invoice.</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {selectedInvoice.payments.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              padding: "12px 16px",
                              backgroundColor: "#F8FAFC",
                              border: "1px solid #E2E8F0",
                              borderRadius: "8px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, color: "#15803D", fontSize: "0.9375rem" }}>
                                {formatINR(p.amount)}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                                {p.payment_method} • {p.payment_date}
                                {p.reference_number && ` • Ref: ${p.reference_number}`}
                              </div>
                              {p.notes && (
                                <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "4px" }}>
                                  <em>{p.notes}</em>
                                </div>
                              )}
                            </div>
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                color: "#15803D",
                                backgroundColor: "#DCFCE7",
                                padding: "2px 8px",
                                borderRadius: "999px",
                              }}
                            >
                              Recorded
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {drawerTab === "gst" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "0.8125rem" }}>
                    {/* Customer GST Snapshot */}
                    <div style={{ padding: "14px 18px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>Customer Billing Info</div>
                      <div style={{ color: "#64748B" }}>Customer: <strong style={{ color: "#1E293B" }}>{selectedInvoice.customer?.name || selectedInvoice.customer_name}</strong></div>
                      <div style={{ color: "#64748B", marginTop: "4px" }}>GSTIN: <strong style={{ color: "#1E293B" }}>{selectedInvoice.customer_gstin || "Unregistered"}</strong></div>
                      <div style={{ color: "#64748B", marginTop: "4px" }}>Place of Supply: <strong style={{ color: "#1E293B" }}>{selectedInvoice.place_of_supply || "Not specified"}</strong></div>
                      {selectedInvoice.customer_address && (
                        <div style={{ color: "#64748B", marginTop: "4px" }}>Address: {selectedInvoice.customer_address}</div>
                      )}
                    </div>

                    {/* Company Profile Snapshot */}
                    <div style={{ padding: "14px 18px", backgroundColor: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>Issuer Company Snapshot</div>
                      <div style={{ color: "#64748B" }}>Company: <strong style={{ color: "#1E293B" }}>{selectedInvoice.company_name || companyProfile?.company_name}</strong></div>
                      <div style={{ color: "#64748B", marginTop: "4px" }}>GSTIN: <strong style={{ color: "#1E293B" }}>{selectedInvoice.company_gstin || companyProfile?.gst_number || "Not set"}</strong></div>
                      <div style={{ color: "#64748B", marginTop: "4px" }}>PAN: <strong style={{ color: "#1E293B" }}>{selectedInvoice.company_pan || companyProfile?.pan_number || "Not set"}</strong></div>
                      <div style={{ color: "#64748B", marginTop: "4px" }}>State: {selectedInvoice.company_state || companyProfile?.state || "Not set"}</div>
                    </div>
                  </div>
                )}

                {drawerTab === "notes" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "0.8125rem" }}>
                    <div>
                      <label style={{ display: "block", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                        Invoice Notes
                      </label>
                      <div style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: "6px", border: "1px solid #E2E8F0", minHeight: "60px", whiteSpace: "pre-wrap" }}>
                        {selectedInvoice.notes || "No notes provided."}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                        Terms & Conditions
                      </label>
                      <div style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: "6px", border: "1px solid #E2E8F0", minHeight: "60px", whiteSpace: "pre-wrap" }}>
                        {selectedInvoice.terms_conditions || "Standard payment terms apply."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Fixed Footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#F8FAFC",
                gap: "10px",
                flexShrink: 0,
              }}
            >
              {/* Left: Close & Delete */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  style={{
                    padding: "8px 16px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#475569",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteInvoice(selectedInvoice.id)}
                  title="Delete Invoice"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#DC2626",
                    backgroundColor: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>

              {/* Right: Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B" }}>Status:</label>
                  <select
                    value={selectedInvoice.status}
                    disabled={isUpdatingStatus}
                    onChange={(e) => handleChangeStatus(selectedInvoice.id, e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      border: "1px solid #CBD5E1",
                      backgroundColor: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    {ALL_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  id="btn-drawer-record-payment"
                  type="button"
                  onClick={handleOpenPaymentModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#15803D",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(21, 128, 61, 0.2)",
                  }}
                >
                  <DollarSign size={14} /> Record Payment
                </button>

                <button
                  type="button"
                  onClick={() => handleSendEmail(selectedInvoice)}
                  disabled={isSendingEmail === selectedInvoice.id}
                  title="Send Tax Invoice PDF to Customer Email"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#2563EB",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: isSendingEmail === selectedInvoice.id ? "wait" : "pointer",
                  }}
                >
                  <Mail size={14} /> {isSendingEmail === selectedInvoice.id ? "Sending..." : "Email PDF"}
                </button>

                <button
                  id="btn-drawer-print"
                  type="button"
                  onClick={() => handleOpenPrintModal(selectedInvoice)}
                  title="Print Tax Invoice"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#0F766E",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Printer size={14} /> Print / PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* RECORD PAYMENT MODAL                                     */}
      {/* ======================================================== */}
      {isPaymentModalOpen && selectedInvoice && (
        <div
          id="record-payment-modal-overlay"
          onClick={() => setIsPaymentModalOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            id="record-payment-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "480px",
              maxWidth: "95%",
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <DollarSign size={18} color="#15803D" />
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>
                  Record Payment for {selectedInvoice.invoice_number}
                </h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} style={{ padding: "20px" }}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                    fontWeight: 700,
                  }}
                />
                <div style={{ fontSize: "0.72rem", color: "#64748B", marginTop: "4px" }}>
                  Current Outstanding Balance: <strong>{formatINR(selectedInvoice.remaining_balance)}</strong>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8125rem",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8125rem",
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Transaction / Reference # (Optional)
                </label>
                <input
                  type="text"
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  placeholder="e.g. UTR1982736452, CHQ-0021"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.8125rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Additional notes about this payment..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.8125rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
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
                  disabled={isSubmittingPayment}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "#15803D",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isSubmittingPayment ? "Recording..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CREATE INVOICE MODAL                                     */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <div
          id="create-invoice-modal-overlay"
          onClick={() => setIsCreateModalOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            id="create-invoice-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "720px",
              maxWidth: "95%",
              maxHeight: "90vh",
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Receipt size={18} color="#0D9488" />
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#0F172A" }}>
                  Create New GST Tax Invoice
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #E2E8F0",
                backgroundColor: "#F8FAFC",
                padding: "0 24px",
              }}
            >
              <button
                onClick={() => setCreateMode("from_order")}
                style={{
                  padding: "10px 16px",
                  fontSize: "0.8125rem",
                  fontWeight: createMode === "from_order" ? 700 : 500,
                  color: createMode === "from_order" ? "#0D9488" : "#64748B",
                  borderBottom: createMode === "from_order" ? "2px solid #0D9488" : "2px solid transparent",
                  background: "none",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                }}
              >
                From Order
              </button>
              <button
                onClick={() => setCreateMode("from_quote")}
                style={{
                  padding: "10px 16px",
                  fontSize: "0.8125rem",
                  fontWeight: createMode === "from_quote" ? 700 : 500,
                  color: createMode === "from_quote" ? "#0D9488" : "#64748B",
                  borderBottom: createMode === "from_quote" ? "2px solid #0D9488" : "2px solid transparent",
                  background: "none",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                }}
              >
                From Accepted Quotation
              </button>
              <button
                onClick={() => setCreateMode("custom")}
                style={{
                  padding: "10px 16px",
                  fontSize: "0.8125rem",
                  fontWeight: createMode === "custom" ? 700 : 500,
                  color: createMode === "custom" ? "#0D9488" : "#64748B",
                  borderBottom: createMode === "custom" ? "2px solid #0D9488" : "2px solid transparent",
                  background: "none",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                }}
              >
                Manual Custom Invoice
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
              {/* Option 1: Create from Order */}
              {createMode === "from_order" && (
                <div>
                  <p style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: 0 }}>
                    Select an existing Order. All line items, customer details, quantities, rates, and GST breakdown will automatically be imported.
                  </p>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                      Select Order *
                    </label>
                    <select
                      id="select-order-to-invoice"
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value ? Number(e.target.value) : "")}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8125rem",
                        backgroundColor: "#FFFFFF",
                      }}
                    >
                      <option value="">-- Choose an Order --</option>
                      {ordersList.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.order_number} - {getCleanCustomerName(ord.customer, ord.title)} - {formatINR(ord.total_amount)} [{ord.stage}]
                        </option>
                      ))}
                    </select>
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
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-confirm-create-from-order"
                      disabled={!selectedOrderId || isCreatingInvoice}
                      onClick={handleCreateFromOrder}
                      style={{
                        padding: "8px 20px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: !selectedOrderId ? "#94A3B8" : "#0D9488",
                        color: "#FFFFFF",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        cursor: !selectedOrderId ? "not-allowed" : "pointer",
                      }}
                    >
                      {isCreatingInvoice ? "Creating..." : "Generate Invoice from Order"}
                    </button>
                  </div>
                </div>
              )}

              {/* Option 2: Create from Quotation */}
              {createMode === "from_quote" && (
                <div>
                  <p style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: 0 }}>
                    Select an accepted quotation. All approved pricing, items, and customer information will be copied directly into a tax invoice.
                  </p>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                      Select Accepted Quotation *
                    </label>
                    <select
                      id="select-quote-to-invoice"
                      value={selectedQuoteId}
                      onChange={(e) => setSelectedQuoteId(e.target.value ? Number(e.target.value) : "")}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8125rem",
                        backgroundColor: "#FFFFFF",
                      }}
                    >
                      <option value="">-- Choose an Accepted Quotation --</option>
                      {quotesList.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.quotation_number} - {getCleanCustomerName(q.customer, q.title)} - {formatINR(q.total_amount)}
                        </option>
                      ))}
                    </select>
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
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-confirm-create-from-quote"
                      disabled={!selectedQuoteId || isCreatingInvoice}
                      onClick={handleCreateFromQuotation}
                      style={{
                        padding: "8px 20px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: !selectedQuoteId ? "#94A3B8" : "#0D9488",
                        color: "#FFFFFF",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        cursor: !selectedQuoteId ? "not-allowed" : "pointer",
                      }}
                    >
                      {isCreatingInvoice ? "Creating..." : "Generate Invoice from Quote"}
                    </button>
                  </div>
                </div>
              )}

              {/* Option 3: Custom Invoice */}
              {createMode === "custom" && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                        Customer *
                      </label>
                      <select
                        value={customCustomerId}
                        onChange={(e) => setCustomCustomerId(e.target.value ? Number(e.target.value) : "")}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          backgroundColor: "#FFFFFF",
                        }}
                      >
                        <option value="">-- Choose Customer --</option>
                        {customersList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.company ? `(${c.company})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                        Place of Supply (State)
                      </label>
                      <input
                        type="text"
                        value={customPlaceOfSupply}
                        onChange={(e) => setCustomPlaceOfSupply(e.target.value)}
                        placeholder="e.g. Maharashtra, Karnataka"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                        Invoice Date *
                      </label>
                      <input
                        type="date"
                        value={customInvoiceDate}
                        onChange={(e) => setCustomInvoiceDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={customDueDate}
                        onChange={(e) => setCustomDueDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                        }}
                      />
                    </div>
                  </div>

                  {/* Line Items */}
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>
                        Line Items & Taxes *
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setCustomItems((prev) => [
                            ...prev,
                            {
                              name: "",
                              description: "",
                              hsn_sac: "",
                              quantity: 1,
                              unit_price: 0,
                              discount_pct: 0,
                              gst_rate: 18,
                            },
                          ])
                        }
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border: "1px solid #99F6E4",
                          backgroundColor: "#F0FDFA",
                          color: "#0F766E",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        + Add Line Item
                      </button>
                    </div>

                    {customItems.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "10px",
                          backgroundColor: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "6px",
                          marginBottom: "8px",
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Item Name *"
                          value={item.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomItems((prev) => prev.map((it, i) => (i === idx ? { ...it, name: val } : it)));
                          }}
                          style={{
                            padding: "6px 8px",
                            borderRadius: "4px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.75rem",
                          }}
                        />

                        <input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setCustomItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it)));
                          }}
                          style={{
                            padding: "6px 8px",
                            borderRadius: "4px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.75rem",
                          }}
                        />

                        <input
                          type="number"
                          placeholder="Rate (₹)"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setCustomItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unit_price: val } : it)));
                          }}
                          style={{
                            padding: "6px 8px",
                            borderRadius: "4px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.75rem",
                          }}
                        />

                        <select
                          value={item.gst_rate}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setCustomItems((prev) => prev.map((it, i) => (i === idx ? { ...it, gst_rate: val } : it)));
                          }}
                          style={{
                            padding: "6px 8px",
                            borderRadius: "4px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.75rem",
                            backgroundColor: "#FFFFFF",
                          }}
                        >
                          <option value="0">0% GST</option>
                          <option value="5">5% GST</option>
                          <option value="12">12% GST</option>
                          <option value="18">18% GST</option>
                          <option value="28">28% GST</option>
                        </select>

                        {customItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setCustomItems((prev) => prev.filter((_, i) => i !== idx))}
                            style={{
                              padding: "4px",
                              border: "none",
                              background: "none",
                              color: "#DC2626",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
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
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!customCustomerId || isCreatingInvoice}
                      onClick={handleCreateCustomInvoice}
                      style={{
                        padding: "8px 20px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: !customCustomerId ? "#94A3B8" : "#0D9488",
                        color: "#FFFFFF",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        cursor: !customCustomerId ? "not-allowed" : "pointer",
                      }}
                    >
                      {isCreatingInvoice ? "Creating..." : "Save & Generate Invoice"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PRINTABLE GST TAX INVOICE MODAL (Maroto v2 Engine)       */}
      {/* ======================================================== */}
      {isPrintModalOpen && printInvoice && (
        <div
          id="print-invoice-modal-overlay"
          onClick={() => setIsPrintModalOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(6px)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            id="print-invoice-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "1000px",
              maxWidth: "100%",
              height: "92vh",
              backgroundColor: "#0F172A",
              borderRadius: "14px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
              border: "1px solid #1E293B",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Top Toolbar */}
            <div
              style={{
                padding: "12px 20px",
                backgroundColor: "#0F172A",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #1E293B",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#0D9488", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Receipt size={17} color="#FFFFFF" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                      Invoice PDF: {printInvoice.invoice_number}
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        backgroundColor: printInvoice.is_inter_state ? "#4C1D95" : "#065F46",
                        color: "#FFFFFF",
                        fontWeight: 600,
                      }}
                    >
                      {printInvoice.is_inter_state ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)"}
                    </span>
                    <span style={{ fontSize: "0.7rem", backgroundColor: "#1E293B", color: "#94A3B8", padding: "2px 8px", borderRadius: "10px" }}>
                      Maroto v2 Engine
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {/* Download PDF Button */}
                <button
                  type="button"
                  id="btn-download-invoice-pdf"
                  disabled={isDownloadingPdf}
                  onClick={async () => {
                    try {
                      setIsDownloadingPdf(true);
                      await downloadPdfFile(
                        `/invoices/${printInvoice.id}/pdf?action=download`,
                        `Invoice-${printInvoice.invoice_number}.pdf`
                      );
                      showToast("Invoice PDF downloaded successfully!", "success");
                    } catch (err: any) {
                      showToast("Failed to download PDF: " + (err?.message || "Error"), "error");
                    } finally {
                      setIsDownloadingPdf(false);
                    }
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#1E293B",
                    color: "#F8FAFC",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    border: "1px solid #334155",
                    cursor: isDownloadingPdf ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isDownloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>Download PDF</span>
                </button>

                {/* Print PDF Button */}
                <button
                  type="button"
                  id="btn-execute-print"
                  onClick={() => {
                    const iframe = document.getElementById("invoice-pdf-frame") as HTMLIFrameElement | null;
                    if (iframe && iframe.contentWindow) {
                      iframe.contentWindow.focus();
                      iframe.contentWindow.print();
                    } else if (pdfBlobUrl) {
                      const printWindow = window.open(pdfBlobUrl, "_blank");
                      printWindow?.focus();
                      printWindow?.print();
                    }
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                >
                  <Printer size={14} />
                  <span>Print Document</span>
                </button>

                <button
                  type="button"
                  id="btn-close-invoice-modal"
                  onClick={() => setIsPrintModalOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94A3B8",
                    cursor: "pointer",
                    padding: "6px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Document Body (Maroto v2 PDF Viewport) */}
            <div
              style={{
                flex: 1,
                position: "relative",
                backgroundColor: "#334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {pdfLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "#F8FAFC" }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: "#2DD4BF" }} />
                  <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Generating Tax Invoice PDF with Maroto v2...</span>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  id="invoice-pdf-frame"
                  src={pdfBlobUrl}
                  title={`Invoice-${printInvoice.invoice_number}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    backgroundColor: "#525659",
                  }}
                />
              ) : (
                <div style={{ color: "#EF4444", fontSize: "0.875rem" }}>
                  Unable to preview PDF document. Please try clicking "Download PDF".
                </div>
              )}
            </div>
          </div>
        </div>
      )}

            {/* Global CSS for Print and Spinners */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-tax-invoice, #printable-tax-invoice * {
            visibility: visible;
          }
          #printable-tax-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20mm;
          }
        }
      `}</style>
    </div>
  );
}
