"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { SidebarTab } from "@/components/Sidebar";
import {
  paymentsApi,
  invoicesApi,
  ordersApi,
  companyApi,
  authApi,
  downloadPdfFile,
  PaymentLedgerItem,
  PaymentSummary,
  Invoice,
  Order,
  CompanyProfile,
  User,
} from "@/lib/api";
import { getCleanCustomerName } from "@/lib/titleUtils";
import {
  Search,
  Plus,
  RefreshCw,
  X,
  Printer,
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
  ChevronDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Wallet,
  Eye,
  Loader2,
} from "lucide-react";

// Format Currency INR
const formatINR = (val: number | null | undefined): string => {
  const num = typeof val === "number" && !isNaN(val) ? val : 0;
  return "₹" + num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Convert Number to Words (Indian numbering format)
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

// Payment Method Badge Config
const METHOD_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  "Bank Transfer (NEFT/RTGS/IMPS)": { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  "Bank Transfer": { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  "UPI / QR": { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
  "Credit Card": { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
  "Debit Card": { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  "Cash": { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  "Cheque / DD": { bg: "#FFF7ED", text: "#C2410C", border: "#FFEDD5" },
  "Net Banking": { bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD" },
};

const PAYMENT_METHODS = [
  "Bank Transfer (NEFT/RTGS/IMPS)",
  "UPI / QR",
  "Credit Card",
  "Debit Card",
  "Cash",
  "Cheque / DD",
  "Net Banking",
];

type DateRangeFilter = "all" | "today" | "this_month" | "last_30_days" | "custom";

export default function PaymentsPage() {
  const router = useRouter();

  // User & Company State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Payments Ledger & Summary State
  const [payments, setPayments] = useState<PaymentLedgerItem[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>({
    total_invoiced: 0,
    total_received: 0,
    total_outstanding: 0,
    total_overdue: 0,
    total_payments: 0,
    overdue_invoices_count: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalPayments, setTotalPayments] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  type PaymentViewTab = "ledger" | "outstanding_invoices" | "awaiting_invoice";
  const [viewTab, setViewTab] = useState<PaymentViewTab>("ledger");
  const [awaitingOrders, setAwaitingOrders] = useState<Order[]>([]);
  const [isLoadingAwaitingOrders, setIsLoadingAwaitingOrders] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Record Payment Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [outstandingInvoices, setOutstandingInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | "">("");
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer (NEFT/RTGS/IMPS)");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  // Receipt Modal State
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<PaymentLedgerItem | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (isReceiptModalOpen && selectedReceiptPayment) {
      let active = true;
      setIsPdfLoading(true);
      paymentsApi
        .getPdfBlob(selectedReceiptPayment.id)
        .then((blob) => {
          if (!active) return;
          const url = URL.createObjectURL(blob);
          setPdfBlobUrl(url);
        })
        .catch((err) => {
          console.error("Failed to load payment receipt PDF:", err);
          showToast("Failed to load payment receipt PDF: " + (err?.message || "Error"), "error");
        })
        .finally(() => {
          if (active) setIsPdfLoading(false);
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
  }, [isReceiptModalOpen, selectedReceiptPayment?.id]);

  // Payment Details Drawer State
  const [selectedPaymentForDrawer, setSelectedPaymentForDrawer] = useState<PaymentLedgerItem | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);

  const handleOpenPaymentDrawer = (p: PaymentLedgerItem) => {
    setSelectedPaymentForDrawer(p);
    setIsDetailsDrawerOpen(true);
  };

  const handleClosePaymentDrawer = () => {
    setIsDetailsDrawerOpen(false);
    setSelectedPaymentForDrawer(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDetailsDrawerOpen) {
        handleClosePaymentDrawer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDetailsDrawerOpen]);

  // Void / Delete Payment State
  const [paymentToVoid, setPaymentToVoid] = useState<PaymentLedgerItem | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Auth & Company Initialization
  useEffect(() => {
    authApi
      .getMe()
      .then((u) => setCurrentUser(u))
      .catch(() => router.push("/login"));

    companyApi
      .get()
      .then((c) => setCompanyProfile(c))
      .catch(() => {});
  }, [router]);

  // Compute Active Date Range Strings
  const activeDateRange = useMemo(() => {
    const today = new Date();
    if (dateRangeFilter === "today") {
      const dStr = today.toISOString().split("T")[0];
      return { start: dStr, end: dStr };
    }
    if (dateRangeFilter === "this_month") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];
      return { start: startOfMonth, end: endOfMonth };
    }
    if (dateRangeFilter === "last_30_days") {
      const priorDate = new Date();
      priorDate.setDate(today.getDate() - 30);
      return {
        start: priorDate.toISOString().split("T")[0],
        end: today.toISOString().split("T")[0],
      };
    }
    if (dateRangeFilter === "custom") {
      return {
        start: customStartDate || undefined,
        end: customEndDate || undefined,
      };
    }
    return { start: undefined, end: undefined };
  }, [dateRangeFilter, customStartDate, customEndDate]);

  // Fetch Payments & Summary
  const loadPayments = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await paymentsApi.list({
        search: searchQuery.trim() || undefined,
        method: selectedMethod !== "all" ? selectedMethod : undefined,
        start_date: activeDateRange.start,
        end_date: activeDateRange.end,
        page: currentPage,
        limit: pageSize,
      });

      setPayments(res.items || []);
      setTotalPayments(res.total || 0);
      setTotalPages(res.pages || 1);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to load payments", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, selectedMethod, activeDateRange, currentPage]);

  // Fetch Invoices Eligible for Payment
  const loadOutstandingInvoices = useCallback(async () => {
    setIsLoadingInvoices(true);
    try {
      const res = await invoicesApi.list({ limit: 100 });
      const eligible = (res.items || []).filter(
        (inv) =>
          inv.status !== "Paid" &&
          inv.status !== "Draft" &&
          inv.status !== "Cancelled" &&
          inv.status !== "Refunded" &&
          inv.remaining_balance > 0.01
      );
      setOutstandingInvoices(eligible);
    } catch (err) {
      console.error("Error loading eligible invoices", err);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, []);

  // Fetch Unbilled Orders (Awaiting Invoice)
  const loadAwaitingOrders = useCallback(async () => {
    setIsLoadingAwaitingOrders(true);
    try {
      const res = await ordersApi.list({ invoice_status: "Not Invoiced", limit: 100 });
      setAwaitingOrders(res.items || []);
    } catch (err) {
      console.error("Error loading awaiting orders", err);
    } finally {
      setIsLoadingAwaitingOrders(false);
    }
  }, []);

  const loadAllData = useCallback(() => {
    loadPayments();
    loadOutstandingInvoices();
    loadAwaitingOrders();
  }, [loadPayments, loadOutstandingInvoices, loadAwaitingOrders]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleOpenRecordModal = () => {
    setSelectedInvoiceId("");
    setPaymentAmount("");
    setPaymentMethod("Bank Transfer (NEFT/RTGS/IMPS)");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setReferenceNumber("");
    setPaymentNotes("");
    setRecordError(null);
    setIsRecordModalOpen(true);
    loadOutstandingInvoices();
  };

  const handleOpenRecordModalWithInvoice = (inv: Invoice) => {
    setSelectedInvoiceId(inv.id);
    setPaymentAmount(inv.remaining_balance);
    setPaymentMethod("Bank Transfer (NEFT/RTGS/IMPS)");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setReferenceNumber("");
    setPaymentNotes("");
    setRecordError(null);
    setIsRecordModalOpen(true);
    loadOutstandingInvoices();
  };

  // Selected Invoice Details in Record Modal
  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    return outstandingInvoices.find((i) => i.id === selectedInvoiceId) || null;
  }, [selectedInvoiceId, outstandingInvoices]);

  // When invoice selection changes, auto-fill remaining balance
  const handleSelectInvoice = (id: number) => {
    setSelectedInvoiceId(id);
    setRecordError(null);
    const inv = outstandingInvoices.find((i) => i.id === id);
    if (inv) {
      setPaymentAmount(inv.remaining_balance);
    }
  };

  // Handle Record Payment Submission
  const handleSubmitRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) {
      setRecordError("Please select an invoice to record payment for.");
      return;
    }
    const amt = typeof paymentAmount === "number" ? paymentAmount : parseFloat(paymentAmount as string);
    if (isNaN(amt) || amt <= 0) {
      setRecordError("Please enter a valid payment amount greater than ₹0.");
      return;
    }
    if (selectedInvoice && amt > selectedInvoice.remaining_balance + 0.01) {
      setRecordError(
        `Payment amount (₹${amt.toFixed(2)}) cannot exceed outstanding balance of ₹${selectedInvoice.remaining_balance.toFixed(2)}.`
      );
      return;
    }

    setIsSubmittingPayment(true);
    setRecordError(null);

    try {
      await paymentsApi.recordPayment({
        invoice_id: selectedInvoiceId,
        amount: amt,
        payment_method: paymentMethod,
        payment_date: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        reference_number: referenceNumber.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });

      showToast("Payment recorded successfully!");
      setIsRecordModalOpen(false);
      loadAllData();
    } catch (err: any) {
      setRecordError(err.message || "Failed to record payment. Please try again.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handle Void / Delete Payment
  const handleConfirmVoid = async () => {
    if (!paymentToVoid) return;
    setIsVoiding(true);
    try {
      await paymentsApi.deletePayment(paymentToVoid.id);
      showToast("Payment voided and balance recalculated successfully.");
      setIsVoidModalOpen(false);
      setPaymentToVoid(null);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || "Failed to void payment", "error");
    } finally {
      setIsVoiding(false);
    }
  };

  // Copy Reference Number Helper
  const handleCopyRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRefId(ref);
    setTimeout(() => setCopiedRefId(null), 2000);
  };

  // Export Ledger to CSV
  const handleExportCSV = () => {
    if (payments.length === 0) {
      showToast("No payments available to export", "error");
      return;
    }

    const headers = [
      "Receipt ID",
      "Payment Date",
      "Invoice Number",
      "Customer Name",
      "Payment Method",
      "Amount Paid",
      "Reference Number",
      "Invoice Grand Total",
      "Invoice Status",
      "Recorded By",
      "Notes",
    ];

    const rows = payments.map((p) => [
      `PAY-${String(p.id).padStart(5, "0")}`,
      new Date(p.payment_date).toLocaleDateString("en-IN"),
      p.invoice_number,
      `"${p.customer_name.replace(/"/g, '""')}"`,
      p.payment_method,
      p.amount.toFixed(2),
      `"${(p.reference_number || "").replace(/"/g, '""')}"`,
      p.invoice_grand_total.toFixed(2),
      p.invoice_status,
      p.recorder?.name || "System",
      `"${(p.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Payments_Ledger_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isAdminOrManager = currentUser?.role === "admin" || currentUser?.role === "manager";

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "Inter, sans-serif" }}>
      {/* Toast Notification */}
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
        activeTab="payments"
        onSelectTab={(tab: SidebarTab) => {
          if (tab === "dashboard") router.push("/dashboard");
          else if (tab === "leads") router.push("/leads");
          else if (tab === "deals") router.push("/deals");
          else if (tab === "quotations") router.push("/quotations");
          else if (tab === "orders") router.push("/orders");
          else if (tab === "invoices") router.push("/invoices");
          else if (tab === "payments") {
            // Already on payments
          } else if (tab === "inventory") router.push("/inventory");
          else if (tab === "products") router.push("/products");
          else if (tab === "follow-ups") router.push("/follow-ups");
          else if (tab === "company") router.push("/company");
          else if (tab === "api-keys") router.push("/leads?tab=api-keys");
          else if (tab === "api-docs") router.push("/leads?tab=api-docs");
          else if (tab === "profile") router.push("/leads?tab=profile");
          else if (tab === "admin-settings") router.push("/admin-settings");
        }}
        paymentsCount={summary.overdue_invoices_count > 0 ? summary.overdue_invoices_count : undefined}
        user={currentUser}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenAdminSettings={() => router.push("/admin-settings")}
      />

      {/* Main Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: "100vh" }}>
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
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                backgroundColor: "#EFF6FF",
                color: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CreditCard size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                Payments & Collections
              </h1>
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748B" }}>
                Real-time collection ledger, payment reconciliations, and instant receipt generation
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={loadPayments}
              disabled={isRefreshing}
              title="Refresh ledger"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                backgroundColor: "#FFFFFF",
                color: "#475569",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={15} className={isRefreshing ? "spin-animation" : ""} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                backgroundColor: "#FFFFFF",
                color: "#475569",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>

            <button
              id="btn-record-payment"
              onClick={handleOpenRecordModal}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#0D9488",
                color: "#FFFFFF",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(13, 148, 136, 0.25)",
              }}
            >
              <Plus size={16} />
              <span>Record Payment</span>
            </button>
          </div>
        </header>

        {/* View Area */}
        <div style={{ flex: 1, padding: "1.75rem 2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* 1. Summary Cards Section */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem" }}>
            {/* Card 1: Total Invoiced */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Total Invoiced
                </span>
                <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FileText size={18} />
                </div>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
                {formatINR(summary.total_invoiced)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Total billed across issued invoices
              </div>
            </div>

            {/* Card 2: Received */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Total Received
                </span>
                <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#059669", letterSpacing: "-0.02em" }}>
                {formatINR(summary.total_received)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Collected across {summary.total_payments} payment transactions
              </div>
            </div>

            {/* Card 3: Outstanding */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Outstanding Balance
                </span>
                <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "#FEF3C7", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={18} />
                </div>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#D97706", letterSpacing: "-0.02em" }}>
                {formatINR(summary.total_outstanding)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Pending collection on active invoices
              </div>
            </div>

            {/* Card 4: Overdue */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Overdue Amount
                </span>
                <div style={{ width: "34px", height: "34px", borderRadius: "8px", backgroundColor: "#FEE2E2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#DC2626", letterSpacing: "-0.02em" }}>
                {formatINR(summary.total_overdue)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Across {summary.overdue_invoices_count} overdue invoices past due date
              </div>
            </div>
          </div>

          {/* View Tab Switcher */}
          <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid #E2E8F0", paddingBottom: "12px" }}>
            <button
              onClick={() => setViewTab("ledger")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 700,
                cursor: "pointer",
                border: viewTab === "ledger" ? "1px solid #0D9488" : "1px solid #E2E8F0",
                backgroundColor: viewTab === "ledger" ? "#F0FDFA" : "#FFFFFF",
                color: viewTab === "ledger" ? "#0F766E" : "#64748B",
                boxShadow: viewTab === "ledger" ? "0 1px 2px rgba(13, 148, 136, 0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Receipt size={16} />
              <span>Payments Ledger</span>
              <span
                style={{
                  backgroundColor: viewTab === "ledger" ? "#0D9488" : "#E2E8F0",
                  color: viewTab === "ledger" ? "#FFFFFF" : "#475569",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                {totalPayments}
              </span>
            </button>

            <button
              onClick={() => setViewTab("outstanding_invoices")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 700,
                cursor: "pointer",
                border: viewTab === "outstanding_invoices" ? "1px solid #D97706" : "1px solid #E2E8F0",
                backgroundColor: viewTab === "outstanding_invoices" ? "#FFFBEB" : "#FFFFFF",
                color: viewTab === "outstanding_invoices" ? "#B45309" : "#64748B",
                boxShadow: viewTab === "outstanding_invoices" ? "0 1px 2px rgba(217, 119, 6, 0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Clock size={16} />
              <span>Outstanding Invoices</span>
              {outstandingInvoices.length > 0 && (
                <span
                  style={{
                    backgroundColor: viewTab === "outstanding_invoices" ? "#D97706" : "#FEF3C7",
                    color: viewTab === "outstanding_invoices" ? "#FFFFFF" : "#92400E",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  {outstandingInvoices.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setViewTab("awaiting_invoice")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 700,
                cursor: "pointer",
                border: viewTab === "awaiting_invoice" ? "1px solid #7C3AED" : "1px solid #E2E8F0",
                backgroundColor: viewTab === "awaiting_invoice" ? "#F5F3FF" : "#FFFFFF",
                color: viewTab === "awaiting_invoice" ? "#6D28D9" : "#64748B",
                boxShadow: viewTab === "awaiting_invoice" ? "0 1px 2px rgba(124, 58, 237, 0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Layers size={16} />
              <span>Awaiting Invoice</span>
              {awaitingOrders.length > 0 && (
                <span
                  style={{
                    backgroundColor: viewTab === "awaiting_invoice" ? "#7C3AED" : "#EDE9FE",
                    color: viewTab === "awaiting_invoice" ? "#FFFFFF" : "#5B21B6",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  {awaitingOrders.length}
                </span>
              )}
            </button>
          </div>

          {viewTab === "ledger" && (
            <>
              {/* 2. Filters & Search Bar */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              padding: "1rem 1.25rem",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            {/* Left Controls: Search & Method */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", flex: 1, minWidth: "300px" }}>
              {/* Search Input */}
              <div style={{ position: "relative", flex: 1, maxWidth: "340px" }}>
                <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                <input
                  type="text"
                  placeholder="Search invoice, customer, reference, notes..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
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

              {/* Payment Method Filter */}
              <select
                value={selectedMethod}
                onChange={(e) => {
                  setSelectedMethod(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.875rem",
                  backgroundColor: "#FFFFFF",
                  color: "#334155",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Payment Methods</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Right Controls: Quick Date Filters */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              {[
                { id: "all", label: "All Time" },
                { id: "today", label: "Today" },
                { id: "this_month", label: "This Month" },
                { id: "last_30_days", label: "Last 30 Days" },
                { id: "custom", label: "Custom Range" },
              ].map((btn) => {
                const isActive = dateRangeFilter === btn.id;
                return (
                  <button
                    key={btn.id}
                    onClick={() => {
                      setDateRangeFilter(btn.id as DateRangeFilter);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: isActive ? "1px solid #0D9488" : "1px solid #E2E8F0",
                      backgroundColor: isActive ? "#F0FDFA" : "#FFFFFF",
                      color: isActive ? "#0D9488" : "#475569",
                      fontWeight: isActive ? 600 : 500,
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                    }}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Range Inputs (Shown when custom is selected) */}
            {dateRangeFilter === "custom" && (
              <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", paddingTop: "0.5rem", borderTop: "1px solid #F1F5F9" }}>
                <span style={{ fontSize: "0.8125rem", color: "#64748B", fontWeight: 500 }}>From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                />
                <span style={{ fontSize: "0.8125rem", color: "#64748B", fontWeight: 500 }}>To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                />
              </div>
            )}
          </div>

          {/* 3. Payment Ledger Table Section */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Table Header Bar */}
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: "1px solid #F1F5F9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  Payment Records
                </h2>
                <span
                  style={{
                    backgroundColor: "#F1F5F9",
                    color: "#475569",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {totalPayments} entries
                </span>
              </div>
            </div>

            {/* Table Container */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Payment Date
                    </th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Receipt / ID
                    </th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Invoice #
                    </th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Customer
                    </th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Method
                    </th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>
                      Amount Paid
                    </th>
                    <th style={{ padding: "12px 16px", fontWeight: 700, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "3rem", textAlign: "center", color: "#94A3B8" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                          <RefreshCw size={24} className="spin-animation" style={{ color: "#0D9488" }} />
                          <span>Loading payments ledger...</span>
                        </div>
                      </td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "4rem 2rem", textAlign: "center", color: "#64748B" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
                            <Wallet size={28} />
                          </div>
                          <div style={{ fontWeight: 600, fontSize: "1rem", color: "#1E293B" }}>
                            No payment records found
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#64748B", maxWidth: "380px" }}>
                            {searchQuery || selectedMethod !== "all" || dateRangeFilter !== "all"
                              ? "Try adjusting your search criteria or date filters to find matching payments."
                              : "No payments recorded yet. Record full or partial collections against issued invoices."}
                          </div>
                          <button
                            onClick={handleOpenRecordModal}
                            style={{
                              marginTop: "8px",
                              padding: "8px 16px",
                              borderRadius: "8px",
                              border: "none",
                              backgroundColor: "#0D9488",
                              color: "#FFFFFF",
                              fontWeight: 600,
                              fontSize: "0.875rem",
                              cursor: "pointer",
                            }}
                          >
                            + Record First Payment
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => {
                      const methodBadge = METHOD_BADGES[p.payment_method] || {
                        bg: "#F1F5F9",
                        text: "#475569",
                        border: "#CBD5E1",
                      };
                      const formattedDate = new Date(p.payment_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });

                      return (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: "1px solid #F1F5F9",
                            cursor: "pointer",
                            transition: "background-color 0.15s ease",
                          }}
                          onClick={() => handleOpenPaymentDrawer(p)}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          {/* Payment Date */}
                          <td style={{ padding: "12px 16px", color: "#1E293B", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 600 }}>{formattedDate}</div>
                            <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                              {new Date(p.payment_date).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>

                          {/* Receipt ID */}
                          <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                fontFamily: "monospace",
                                fontSize: "0.8125rem",
                                fontWeight: 700,
                                color: "#0369A1",
                                backgroundColor: "#F0F9FF",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                border: "1px solid #BAE6FD",
                              }}
                            >
                              PAY-{String(p.id).padStart(5, "0")}
                            </span>
                          </td>

                          {/* Linked Invoice */}
                          <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => router.push(`/invoices?search=${encodeURIComponent(p.invoice_number)}`)}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                color: "#2563EB",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                textDecoration: "underline",
                              }}
                            >
                              <span>{p.invoice_number}</span>
                              <ExternalLink size={12} />
                            </button>
                            <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                              Status: {p.invoice_status}
                            </div>
                          </td>

                          {/* Customer */}
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ fontWeight: 600, color: "#1E293B" }}>{p.customer_name}</div>
                            <div style={{ fontSize: "0.75rem", color: "#64748B", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              {p.reference_number && (
                                <span style={{ fontFamily: "monospace", color: "#475569" }}>Ref: {p.reference_number}</span>
                              )}
                              {p.recorded_by && (
                                <span style={{ color: "#94A3B8" }}>• By {p.recorded_by}</span>
                              )}
                            </div>
                          </td>

                          {/* Method Badge */}
                          <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                borderRadius: "12px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                backgroundColor: methodBadge.bg,
                                color: methodBadge.text,
                                border: `1px solid ${methodBadge.border}`,
                              }}
                            >
                              {p.payment_method}
                            </span>
                          </td>

                          {/* Amount Paid */}
                          <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: "1rem", fontWeight: 800, color: "#0F766E" }}>
                              {formatINR(p.amount)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "12px 16px", textAlign: "center", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <button
                                onClick={() => handleOpenPaymentDrawer(p)}
                                title="View Payment Details"
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #CBD5E1",
                                  backgroundColor: "#F8FAFC",
                                  color: "#334155",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                }}
                              >
                                <Eye size={13} />
                                <span>Details</span>
                              </button>

                              {/* Print / View Receipt */}
                              <button
                                onClick={() => {
                                  setSelectedReceiptPayment(p);
                                  setIsReceiptModalOpen(true);
                                }}
                                title="View & Print Payment Receipt"
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #CBD5E1",
                                  backgroundColor: "#FFFFFF",
                                  color: "#334155",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: 500,
                                }}
                              >
                                <Printer size={13} />
                                <span>Receipt</span>
                              </button>

                              {/* Void Payment (Admin/Manager only) */}
                              {isAdminOrManager && (
                                <button
                                  onClick={() => {
                                    setPaymentToVoid(p);
                                    setIsVoidModalOpen(true);
                                  }}
                                  title="Void payment (Rollback balances)"
                                  style={{
                                    padding: "6px",
                                    borderRadius: "6px",
                                    border: "1px solid #FCA5A5",
                                    backgroundColor: "#FEF2F2",
                                    color: "#DC2626",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Trash2 size={13} />
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div
                style={{
                  padding: "1rem 1.25rem",
                  borderTop: "1px solid #F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.875rem",
                  color: "#64748B",
                }}
              >
                <div>
                  Showing page {currentPage} of {totalPages} ({totalPayments} total)
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: currentPage <= 1 ? "#F1F5F9" : "#FFFFFF",
                      color: currentPage <= 1 ? "#94A3B8" : "#334155",
                      cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                    }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: currentPage >= totalPages ? "#F1F5F9" : "#FFFFFF",
                      color: currentPage >= totalPages ? "#94A3B8" : "#334155",
                      cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
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

          {/* ========================================================= */}
          {/* TAB 2: OUTSTANDING INVOICES                               */}
          {/* ========================================================= */}
          {viewTab === "outstanding_invoices" && (
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "1rem 1.25rem",
                  borderBottom: "1px solid #F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Invoices with Outstanding Balance
                  </h2>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.8125rem", color: "#64748B" }}>
                    Active issued invoices pending full or partial payment collection
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      backgroundColor: "#FEF3C7",
                      color: "#92400E",
                      padding: "4px 10px",
                      borderRadius: "12px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}
                  >
                    Total Pending: {formatINR(summary.total_outstanding)}
                  </span>
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Invoice # & Due Date
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Customer
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Sales Lineage
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "right" }}>
                        Total & Outstanding
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "center" }}>
                        Status
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "center" }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingInvoices ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "#94A3B8" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                            <RefreshCw size={24} className="spin-animation" style={{ color: "#0D9488" }} />
                            <span>Loading outstanding invoices...</span>
                          </div>
                        </td>
                      </tr>
                    ) : outstandingInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "4rem 2rem", textAlign: "center", color: "#64748B" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                            <CheckCircle2 size={36} style={{ color: "#059669" }} />
                            <div style={{ fontWeight: 600, fontSize: "1rem", color: "#1E293B" }}>
                              All Invoices Settled
                            </div>
                            <div style={{ fontSize: "0.875rem", color: "#64748B" }}>
                              There are currently no active invoices with pending balances.
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      outstandingInvoices.map((inv) => (
                        <tr
                          key={inv.id}
                          style={{
                            borderBottom: "1px solid #F1F5F9",
                            transition: "background-color 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          {/* Invoice # & Due Date */}
                          <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => router.push(`/invoices?search=${encodeURIComponent(inv.invoice_number)}`)}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                color: "#2563EB",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                textDecoration: "underline",
                              }}
                            >
                              <span>{inv.invoice_number}</span>
                              <ExternalLink size={12} />
                            </button>
                            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "3px" }}>
                              Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                            </div>
                          </td>

                          {/* Customer */}
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 600, color: "#1E293B" }}>{inv.customer_name}</div>
                            {inv.customer_email && (
                              <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{inv.customer_email}</div>
                            )}
                          </td>

                          {/* Lineage */}
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {inv.lead_number && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/leads?search=${encodeURIComponent(inv.lead_number!)}`);
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.6875rem",
                                    fontWeight: 600,
                                    backgroundColor: "#EFF6FF",
                                    color: "#1D4ED8",
                                    border: "1px solid #DBEAFE",
                                    cursor: "pointer",
                                  }}
                                  title={`Origin Lead: ${inv.lead_number}`}
                                >
                                  <span>Lead: {inv.lead_number}</span>
                                </button>
                              )}
                              {inv.deal?.deal_number && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/deals?search=${encodeURIComponent(inv.deal!.deal_number)}`);
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.6875rem",
                                    fontWeight: 600,
                                    backgroundColor: "#F0FDF4",
                                    color: "#15803D",
                                    border: "1px solid #DCFCE7",
                                    cursor: "pointer",
                                  }}
                                  title={`Origin Deal: ${inv.deal.deal_number}`}
                                >
                                  <span>Deal: {inv.deal.deal_number}</span>
                                </button>
                              )}
                              {inv.quotation?.quotation_number && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/quotations?search=${encodeURIComponent(inv.quotation!.quotation_number)}`);
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.6875rem",
                                    fontWeight: 600,
                                    backgroundColor: "#FEF3C7",
                                    color: "#92400E",
                                    border: "1px solid #FDE68A",
                                    cursor: "pointer",
                                  }}
                                  title={`Origin Quotation: ${inv.quotation.quotation_number}`}
                                >
                                  <span>Quote: {inv.quotation.quotation_number}</span>
                                </button>
                              )}
                              {inv.order?.order_number && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/orders?search=${encodeURIComponent(inv.order!.order_number)}`);
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.6875rem",
                                    fontWeight: 600,
                                    backgroundColor: "#F3E8FF",
                                    color: "#7E22CE",
                                    border: "1px solid #E9D5FF",
                                    cursor: "pointer",
                                  }}
                                  title={`Origin Order: ${inv.order.order_number}`}
                                >
                                  <span>Order: {inv.order.order_number}</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Total & Outstanding */}
                          <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 600, color: "#1E293B" }}>
                              {formatINR(inv.grand_total)}
                            </div>
                            <div style={{ fontSize: "0.75rem", marginTop: "2px" }}>
                              <span style={{ fontWeight: 700, color: "#D97706" }}>
                                Due: {formatINR(inv.remaining_balance)}
                              </span>
                              {inv.amount_paid > 0 && (
                                <span style={{ color: "#059669", marginLeft: "4px" }}>
                                  (Paid: {formatINR(inv.amount_paid)})
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                borderRadius: "12px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                backgroundColor: inv.status === "Overdue" ? "#FEE2E2" : "#FEF3C7",
                                color: inv.status === "Overdue" ? "#DC2626" : "#B45309",
                                border: `1px solid ${inv.status === "Overdue" ? "#FECACA" : "#FDE68A"}`,
                              }}
                            >
                              {inv.status}
                            </span>
                          </td>

                          {/* Action */}
                          <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => handleOpenRecordModalWithInvoice(inv)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "none",
                                backgroundColor: "#0D9488",
                                color: "#FFFFFF",
                                fontSize: "0.8125rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                boxShadow: "0 1px 3px rgba(13, 148, 136, 0.2)",
                              }}
                            >
                              <Plus size={14} />
                              <span>Record Payment</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: AWAITING INVOICE (UNBILLED ORDERS)                 */}
          {/* ========================================================= */}
          {viewTab === "awaiting_invoice" && (
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "1rem 1.25rem",
                  borderBottom: "1px solid #F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Orders Awaiting Invoice
                  </h2>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.8125rem", color: "#64748B" }}>
                    Accepted orders automatically created from quotations that have not yet been billed
                  </p>
                </div>
                <span
                  style={{
                    backgroundColor: "#F5F3FF",
                    color: "#6D28D9",
                    padding: "4px 10px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  {awaitingOrders.length} Unbilled Orders
                </span>
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Order #
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Title / Customer
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase" }}>
                        Sales Origin & Lineage
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "right" }}>
                        Order Amount
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "center" }}>
                        Stage
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "center" }}>
                        Billing Status
                      </th>
                      <th style={{ padding: "12px 16px", fontWeight: 600, color: "#475569", fontSize: "0.75rem", textTransform: "uppercase", textAlign: "center" }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingAwaitingOrders ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "3rem", textAlign: "center", color: "#94A3B8" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                            <RefreshCw size={24} className="spin-animation" style={{ color: "#7C3AED" }} />
                            <span>Loading unbilled orders...</span>
                          </div>
                        </td>
                      </tr>
                    ) : awaitingOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "4rem 2rem", textAlign: "center", color: "#64748B" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                            <CheckCircle2 size={36} style={{ color: "#059669" }} />
                            <div style={{ fontWeight: 600, fontSize: "1rem", color: "#1E293B" }}>
                              No Orders Awaiting Invoice
                            </div>
                            <div style={{ fontSize: "0.875rem", color: "#64748B" }}>
                              All accepted orders have had invoices generated.
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      awaitingOrders.map((ord) => (
                        <tr
                          key={ord.id}
                          style={{
                            borderBottom: "1px solid #F1F5F9",
                            transition: "background-color 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          {/* Order # */}
                          <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => router.push(`/orders?search=${encodeURIComponent(ord.order_number)}`)}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                color: "#2563EB",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                textDecoration: "underline",
                              }}
                            >
                              <span>{ord.order_number}</span>
                              <ExternalLink size={12} />
                            </button>
                          </td>

                          {/* Title / Customer */}
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 600, color: "#1E293B" }}>{getCleanCustomerName(ord.customer, ord.title)}</div>
                            <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                              {ord.customer?.company ? `Company: ${ord.customer.company}` : (ord.customer?.name ? `Customer: ${ord.customer.name}` : "—")}
                            </div>
                          </td>

                          {/* Lineage */}
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {ord.lead_number && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/leads?search=${encodeURIComponent(ord.lead_number!)}`);
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.6875rem",
                                    fontWeight: 600,
                                    backgroundColor: "#EFF6FF",
                                    color: "#1D4ED8",
                                    border: "1px solid #DBEAFE",
                                    cursor: "pointer",
                                  }}
                                  title={`Origin Lead: ${ord.lead_number}`}
                                >
                                  <span>Lead: {ord.lead_number}</span>
                                </button>
                              )}
                              {ord.deal?.deal_number && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/deals?search=${encodeURIComponent(ord.deal!.deal_number)}`);
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.6875rem",
                                    fontWeight: 600,
                                    backgroundColor: "#F0FDF4",
                                    color: "#15803D",
                                    border: "1px solid #DCFCE7",
                                    cursor: "pointer",
                                  }}
                                  title={`Origin Deal: ${ord.deal.deal_number}`}
                                >
                                  <span>Deal: {ord.deal.deal_number}</span>
                                </button>
                              )}
                              {ord.quotation?.quotation_number && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/quotations?search=${encodeURIComponent(ord.quotation!.quotation_number)}`);
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontSize: "0.6875rem",
                                    fontWeight: 600,
                                    backgroundColor: "#FEF3C7",
                                    color: "#92400E",
                                    border: "1px solid #FDE68A",
                                    cursor: "pointer",
                                  }}
                                  title={`Origin Quotation: ${ord.quotation.quotation_number}`}
                                >
                                  <span>Quote: {ord.quotation.quotation_number}</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Order Amount */}
                          <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap", fontWeight: 700, color: "#1E293B" }}>
                            {formatINR(ord.total_amount)}
                          </td>

                          {/* Stage */}
                          <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                borderRadius: "12px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                backgroundColor: "#F1F5F9",
                                color: "#475569",
                                border: "1px solid #CBD5E1",
                              }}
                            >
                              {ord.stage}
                            </span>
                          </td>

                          {/* Billing Status Badge: Awaiting Invoice */}
                          <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                backgroundColor: "#F5F3FF",
                                color: "#6D28D9",
                                border: "1px solid #DDD6FE",
                              }}
                            >
                              <Clock size={12} />
                              <span>Awaiting Invoice</span>
                            </span>
                          </td>

                          {/* Action */}
                          <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => router.push("/invoices")}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "none",
                                backgroundColor: "#0D9488",
                                color: "#FFFFFF",
                                fontSize: "0.8125rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                boxShadow: "0 1px 3px rgba(13, 148, 136, 0.2)",
                              }}
                            >
                              <Plus size={14} />
                              <span>Create Invoice</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. RECORD PAYMENT MODAL                                   */}
      {/* ========================================================= */}
      {isRecordModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
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
              maxWidth: "560px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
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
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Record Customer Payment
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748B" }}>
                    Log full or partial collections and update invoice statuses
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94A3B8",
                  padding: "4px",
                  borderRadius: "6px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitRecordPayment} style={{ padding: "1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Error Banner */}
              {recordError && (
                <div
                  style={{
                    backgroundColor: "#FEF2F2",
                    border: "1px solid #FECACA",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    color: "#B91C1C",
                    fontSize: "0.8125rem",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>{recordError}</span>
                </div>
              )}

              {/* 1. Invoice Selection */}
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Select Outstanding Invoice <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => handleSelectInvoice(Number(e.target.value))}
                  disabled={isLoadingInvoices}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                    backgroundColor: "#FFFFFF",
                    color: "#1E293B",
                    outline: "none",
                  }}
                >
                  <option value="">
                    {isLoadingInvoices ? "Loading eligible invoices..." : "-- Select an invoice --"}
                  </option>
                  {outstandingInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.customer_name} (Balance: {formatINR(inv.remaining_balance)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice Summary Box */}
              {selectedInvoice && (
                <div
                  style={{
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "8px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.6875rem", color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>Total Billed</div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0F172A" }}>
                      {formatINR(selectedInvoice.grand_total)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.6875rem", color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>Already Paid</div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#059669" }}>
                      {formatINR(selectedInvoice.amount_paid)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.6875rem", color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>Remaining Balance</div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: "#D97706" }}>
                      {formatINR(selectedInvoice.remaining_balance)}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Payment Amount & Quick Actions */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#334155" }}>
                    Payment Amount (₹) <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  {selectedInvoice && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(selectedInvoice.remaining_balance)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0D9488",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Pay Full Balance ({formatINR(selectedInvoice.remaining_balance)})
                    </button>
                  )}
                </div>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#64748B",
                      fontWeight: 600,
                    }}
                  >
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                      setPaymentAmount(val);
                      setRecordError(null);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 28px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "1rem",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* 3. Payment Method & Date (Two Column) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Payment Method <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.875rem",
                      backgroundColor: "#FFFFFF",
                      outline: "none",
                    }}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Payment Date <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.875rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* 4. Reference Number (Duplicate Checked) */}
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Reference Number / UTR / Cheque #
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR-982348234, CHQ-001290, UPI-TXN-7634"
                  value={referenceNumber}
                  onChange={(e) => {
                    setReferenceNumber(e.target.value);
                    setRecordError(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px", display: "block" }}>
                  Used for duplicate protection across payments
                </span>
              </div>

              {/* 5. Notes / Remarks */}
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Internal Notes & Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional payment notes or bank receipt details..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Modal Footer Actions */}
              <div
                style={{
                  paddingTop: "1rem",
                  borderTop: "1px solid #F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  disabled={isSubmittingPayment}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    color: "#475569",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: isSubmittingPayment ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(13, 148, 136, 0.25)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {isSubmittingPayment ? (
                    <>
                      <RefreshCw size={15} className="spin-animation" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <span>Confirm & Record</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. PAYMENT RECEIPT MODAL (PRINTABLE VOUCHER)              */}
      {/* ========================================================= */}
      {isReceiptModalOpen && selectedReceiptPayment && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 10000,
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
              maxWidth: "880px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              display: "flex",
              flexDirection: "column",
              height: "90vh",
              maxHeight: "900px",
              overflow: "hidden",
            }}
          >
            {/* Modal Header with Print & Download Buttons */}
            <div
              className="no-print"
              style={{
                padding: "0.875rem 1.5rem",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#F8FAFC",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Receipt size={20} style={{ color: "#0D9488" }} />
                <span style={{ fontWeight: 700, fontSize: "1rem", color: "#0F172A" }}>
                  Payment Receipt Voucher (PAY-{String(selectedReceiptPayment.id).padStart(5, "0")})
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  id="btn-download-receipt-pdf"
                  onClick={async () => {
                    if (!selectedReceiptPayment) return;
                    setIsDownloadingPdf(true);
                    try {
                      await downloadPdfFile(
                        `/payments/${selectedReceiptPayment.id}/pdf?action=download`,
                        `Payment-Receipt-PAY-${String(selectedReceiptPayment.id).padStart(5, "0")}.pdf`
                      );
                    } catch (err: any) {
                      alert("Failed to download PDF: " + (err?.message || "Unknown error"));
                    } finally {
                      setIsDownloadingPdf(false);
                    }
                  }}
                  disabled={isDownloadingPdf || isPdfLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "6px",
                    backgroundColor: "#FFFFFF",
                    color: "#0F172A",
                    border: "1px solid #CBD5E1",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    cursor: (isDownloadingPdf || isPdfLoading) ? "not-allowed" : "pointer",
                    opacity: (isDownloadingPdf || isPdfLoading) ? 0.7 : 1,
                  }}
                >
                  {isDownloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>Download PDF</span>
                </button>
                <button
                  id="btn-print-receipt-pdf"
                  onClick={() => {
                    const iframe = document.getElementById("payment-receipt-pdf-frame") as HTMLIFrameElement;
                    if (iframe && iframe.contentWindow) {
                      iframe.contentWindow.focus();
                      iframe.contentWindow.print();
                    } else if (pdfBlobUrl) {
                      const printWin = window.open(pdfBlobUrl, "_blank");
                      printWin?.print();
                    }
                  }}
                  disabled={isPdfLoading || !pdfBlobUrl}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "6px",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "0.8125rem",
                    cursor: (isPdfLoading || !pdfBlobUrl) ? "not-allowed" : "pointer",
                    opacity: (isPdfLoading || !pdfBlobUrl) ? 0.7 : 1,
                  }}
                >
                  <Printer size={14} />
                  <span>Print Document</span>
                </button>
                <button
                  id="btn-close-receipt-modal"
                  onClick={() => setIsReceiptModalOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748B",
                    padding: "4px",
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Maroto PDF Viewer Body */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                backgroundColor: "#525659",
                overflow: "hidden",
              }}
            >
              {isPdfLoading ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    backgroundColor: "#F8FAFC",
                  }}
                >
                  <Loader2 size={36} className="animate-spin" style={{ color: "#0D9488" }} />
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748B", fontWeight: 500 }}>
                    Generating Payment Receipt PDF via Maroto...
                  </p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  id="payment-receipt-pdf-frame"
                  src={pdfBlobUrl}
                  title="Payment Receipt PDF Preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    backgroundColor: "#525659",
                  }}
                />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    backgroundColor: "#F8FAFC",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#EF4444", fontWeight: 500 }}>
                    Failed to load receipt PDF.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. VOID PAYMENT CONFIRMATION MODAL                        */}
      {/* ========================================================= */}
      {isVoidModalOpen && paymentToVoid && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "440px",
              padding: "1.5rem",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#DC2626" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
                Void Payment #{paymentToVoid.id}?
              </h3>
            </div>

            <p style={{ margin: 0, fontSize: "0.875rem", color: "#475569", lineHeight: 1.5 }}>
              Are you sure you want to void this payment of{" "}
              <strong>{formatINR(paymentToVoid.amount)}</strong> recorded against invoice{" "}
              <strong>{paymentToVoid.invoice_number}</strong>?
            </p>

            <div
              style={{
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: "8px",
                padding: "10px 12px",
                fontSize: "0.8125rem",
                color: "#991B1B",
              }}
            >
              ⚠️ This will reverse the payment, recalculate the outstanding balance on the invoice, and rollback linked order statuses within an atomic transaction.
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", marginTop: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                disabled={isVoiding}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#FFFFFF",
                  color: "#475569",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={isVoiding}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#DC2626",
                  color: "#FFFFFF",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: isVoiding ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {isVoiding ? (
                  <>
                    <RefreshCw size={14} className="spin-animation" />
                    <span>Voiding...</span>
                  </>
                ) : (
                  <span>Yes, Void Payment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* PAYMENT / RECEIPT DETAILS CENTERED MODAL                                  */}
      {/* ========================================================================= */}
      {isDetailsDrawerOpen && selectedPaymentForDrawer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            padding: "1.5rem",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
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
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
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
                  <Receipt size={22} />
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
                      PAY-{String(selectedPaymentForDrawer.id).padStart(5, "0")}
                    </span>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        backgroundColor: "#DCFCE7",
                        color: "#15803D",
                        border: "1px solid #BBF7D0",
                        textTransform: "uppercase",
                      }}
                    >
                      Received
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800, color: "#0F172A" }}>
                    {selectedPaymentForDrawer.customer_name}
                  </h3>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={handleClosePaymentDrawer}
                  title="Close modal (Esc)"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748B",
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

            {/* Modal Scrollable Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Highlight Amount Card */}
              <div
                style={{
                  backgroundColor: "#F0FDFA",
                  borderRadius: "12px",
                  border: "1px solid #99F6E4",
                  padding: "18px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0D9488", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Total Amount Received
                  </div>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0F766E", marginTop: "2px" }}>
                    {formatINR(selectedPaymentForDrawer.amount)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                    Paid on {new Date(selectedPaymentForDrawer.payment_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <span
                  style={{
                    padding: "6px 16px",
                    borderRadius: "999px",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    backgroundColor: "#CCFBF1",
                    color: "#0F766E",
                    border: "1px solid #5EEAD4",
                  }}
                >
                  {selectedPaymentForDrawer.payment_method}
                </span>
              </div>

              {/* 2-Column Overview Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "16px", alignItems: "start" }}>
                {/* Left Column: Transaction Details, Customer, Notes */}
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Customer Information */}
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "16px" }}>
                    <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "6px" }}>
                      Customer & Payer
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>
                      {selectedPaymentForDrawer.customer_name}
                    </div>
                  </div>

                  {/* Transaction & Reference Details */}
                  <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "16px" }}>
                    <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "12px" }}>
                      Transaction Reference & Recording
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "#64748B" }}>Reference / UTR / Cheque</div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                          {selectedPaymentForDrawer.reference_number ? (
                            <>
                              <span style={{ fontFamily: "monospace" }}>{selectedPaymentForDrawer.reference_number}</span>
                              <button
                                onClick={() => handleCopyRef(selectedPaymentForDrawer.reference_number!)}
                                title="Copy"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#0D9488", padding: "2px" }}
                              >
                                <Copy size={13} />
                              </button>
                            </>
                          ) : (
                            <span style={{ color: "#94A3B8" }}>— None provided —</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "#64748B" }}>Recorded By</div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <UserIcon size={14} color="#64748B" />
                          <span>{selectedPaymentForDrawer.recorder?.name || selectedPaymentForDrawer.recorded_by || "System Admin"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Notes */}
                  {selectedPaymentForDrawer.notes && (
                    <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "16px" }}>
                      <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "6px" }}>
                        Payment Remarks / Notes
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "#334155", lineHeight: 1.5, backgroundColor: "#F8FAFC", padding: "10px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                        {selectedPaymentForDrawer.notes}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Complete Sales Lineage Tracking */}
                <div style={{ backgroundColor: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0", padding: "16px" }}>
                  <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Layers size={13} color="#0D9488" />
                    Connected Sales Lineage
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {/* Linked Invoice */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", padding: "10px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <div>
                        <div style={{ fontSize: "0.6875rem", color: "#64748B", fontWeight: 600 }}>LINKED INVOICE</div>
                        <div style={{ fontWeight: 700, color: "#2563EB", fontSize: "0.875rem" }}>
                          {selectedPaymentForDrawer.invoice_number}
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/invoices?search=${encodeURIComponent(selectedPaymentForDrawer.invoice_number)}`)}
                        style={{
                          padding: "5px 10px",
                          backgroundColor: "#EFF6FF",
                          border: "1px solid #BFDBFE",
                          borderRadius: "6px",
                          color: "#1D4ED8",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span>View Invoice</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>

                    {/* Linked Order */}
                    {selectedPaymentForDrawer.order_number && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", padding: "10px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                        <div>
                          <div style={{ fontSize: "0.6875rem", color: "#64748B", fontWeight: 600 }}>LINKED ORDER</div>
                          <div style={{ fontWeight: 700, color: "#7E22CE", fontSize: "0.875rem" }}>
                            {selectedPaymentForDrawer.order_number}
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/orders?search=${encodeURIComponent(selectedPaymentForDrawer.order_number!)}`)}
                          style={{
                            padding: "5px 10px",
                            backgroundColor: "#FAF5FF",
                            border: "1px solid #E9D5FF",
                            borderRadius: "6px",
                            color: "#7E22CE",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span>View Order</span>
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    )}

                    {/* Origin Quotation */}
                    {selectedPaymentForDrawer.quotation_number && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", padding: "10px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                        <div>
                          <div style={{ fontSize: "0.6875rem", color: "#64748B", fontWeight: 600 }}>ACCEPTED QUOTATION</div>
                          <div style={{ fontWeight: 700, color: "#92400E", fontSize: "0.875rem" }}>
                            {selectedPaymentForDrawer.quotation_number}
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/quotations?search=${encodeURIComponent(selectedPaymentForDrawer.quotation_number!)}`)}
                          style={{
                            padding: "5px 10px",
                            backgroundColor: "#FEF3C7",
                            border: "1px solid #FDE68A",
                            borderRadius: "6px",
                            color: "#92400E",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span>View Quote</span>
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    )}

                    {/* Origin Deal */}
                    {selectedPaymentForDrawer.deal_number && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", padding: "10px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                        <div>
                          <div style={{ fontSize: "0.6875rem", color: "#64748B", fontWeight: 600 }}>ORIGIN DEAL</div>
                          <div style={{ fontWeight: 700, color: "#15803D", fontSize: "0.875rem" }}>
                            {selectedPaymentForDrawer.deal_number}
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/deals?search=${encodeURIComponent(selectedPaymentForDrawer.deal_number!)}`)}
                          style={{
                            padding: "5px 10px",
                            backgroundColor: "#F0FDF4",
                            border: "1px solid #DCFCE7",
                            borderRadius: "6px",
                            color: "#15803D",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span>View Deal</span>
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    )}

                    {/* Origin Lead */}
                    {selectedPaymentForDrawer.lead_number && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", padding: "10px 14px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                        <div>
                          <div style={{ fontSize: "0.6875rem", color: "#64748B", fontWeight: 600 }}>ORIGIN LEAD</div>
                          <div style={{ fontWeight: 700, color: "#1D4ED8", fontSize: "0.875rem" }}>
                            #{selectedPaymentForDrawer.lead_number}
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/leads?search=${encodeURIComponent(selectedPaymentForDrawer.lead_number!)}`)}
                          style={{
                            padding: "5px 10px",
                            backgroundColor: "#EFF6FF",
                            border: "1px solid #DBEAFE",
                            borderRadius: "6px",
                            color: "#1D4ED8",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span>View Lead</span>
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #E2E8F0",
                backgroundColor: "#F8FAFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={handleClosePaymentDrawer}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#FFFFFF",
                  color: "#475569",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedReceiptPayment(selectedPaymentForDrawer);
                  setIsReceiptModalOpen(true);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#0D9488",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 6px rgba(13, 148, 136, 0.25)",
                }}
              >
                <Printer size={15} />
                <span>Print Payment Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
