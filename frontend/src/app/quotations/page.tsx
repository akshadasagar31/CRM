"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Edit3,
  Eye,
  CheckCircle2,
  AlertCircle,
  Building,
  User as UserIcon,
  Tag,
  ArrowRight,
  ChevronRight,
  X,
  Phone,
  Mail,
  Check,
  Calendar,
  Clock,
  ExternalLink,
  Copy,
  DollarSign,
  AlertTriangle,
  UserCheck,
  Layers,
  Sparkles,
  MessageSquare,
  Printer,
  Send,
  CheckSquare,
  XCircle,
  Package,
  Receipt,
  ShieldCheck,
  MapPin,
  Percent,
} from "lucide-react";
import {
  quotationsApi,
  dealsApi,
  productsApi,
  customersApi,
  leadsApi,
  companyApi,
  CompanyProfile,
  getApiBaseUrl,
  authApi,
  getToken,
  getStoredUser,
  Quotation,
  QuotationItem,
  QuotationItemInput,
  Deal,
  Product,
  Customer,
  Lead,
  User,
} from "@/lib/api";
import Sidebar, { SidebarTab } from "@/components/Sidebar";

function QuotationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDealIdParam = searchParams.get("deal_id");

  // Auth & Workspace
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("quotations");

  // Data
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form Modal State (Create vs Edit vs Revise)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "revise">("create");
  const [editingQuotationId, setEditingQuotationId] = useState<number | null>(null);
  const [formQuotationNumber, setFormQuotationNumber] = useState("");
  const [enableRoundOff, setEnableRoundOff] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<number | "">("");
  const [quotationTitle, setQuotationTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [customerState, setCustomerState] = useState("Maharashtra");
  const [customerGstin, setCustomerGstin] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState(
    "1. Quotation is valid for 30 days from date of issue.\n2. Payment terms: 50% advance, 50% upon delivery.\n3. Goods & Services Tax (GST) as applicable by Indian Tax Law."
  );
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<QuotationItemInput[]>([]);

  // Drawer / Detail State
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Print / PDF View Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printQuotation, setPrintQuotation] = useState<Quotation | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check Auth & Initial Load
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/");
      return;
    }
    const user = getStoredUser();
    setCurrentUser(user);

    loadAllData();
  }, [router]);

  const hasHandledInitialDealParam = useRef(false);

  // Handle URL deal_id query parameter
  useEffect(() => {
    if (initialDealIdParam && deals.length > 0 && !hasHandledInitialDealParam.current) {
      const dealIdNum = parseInt(initialDealIdParam, 10);
      if (!isNaN(dealIdNum)) {
        const foundDeal = deals.find((d) => d.id === dealIdNum);
        if (foundDeal) {
          hasHandledInitialDealParam.current = true;
          handleOpenCreateModal(foundDeal.id);
        }
      }
    }
  }, [initialDealIdParam, deals]);

  // Load All Relevant Data
  const loadAllData = async () => {
    try {
      setIsLoading(true);
      const [quotesRes, dealsRes, productsRes, customersRes, compRes] = await Promise.all([
        quotationsApi.list().catch(() => ({ items: [] as Quotation[] })),
        dealsApi.list({ limit: 200 }).catch(() => ({ items: [] as Deal[] })),
        productsApi.list({ limit: 200 }).catch(() => ({ items: [] as Product[] })),
        customersApi.list("", 1, 200).catch(() => ({ items: [] as Customer[] })),
        companyApi.get().catch(() => null),
      ]);

      setQuotations(quotesRes.items || []);
      setDeals(dealsRes.items || []);
      setProducts(productsRes.items || []);
      setCustomers(customersRes.items || []);
      if (compRes) {
        setCompanyProfile(compRes);
      }
    } catch (err: any) {
      console.error("Failed to load quotations data:", err);
      showToast(err?.message || "Failed to load quotations data", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllData();
  };

  // Selected Deal for Create Modal (Derived)
  const currentSelectedDeal = useMemo(() => {
    if (!selectedDealId) return null;
    return deals.find((d) => d.id === Number(selectedDealId)) || null;
  }, [selectedDealId, deals]);

  // Find linked customer for the selected deal
  const currentSelectedCustomer = useMemo(() => {
    if (!currentSelectedDeal) return null;
    if (currentSelectedDeal.customer) return currentSelectedDeal.customer;
    if (currentSelectedDeal.customer_id) {
      return customers.find((c) => c.id === currentSelectedDeal.customer_id) || null;
    }
    return null;
  }, [currentSelectedDeal, customers]);

  // Open Create Modal
  const handleOpenCreateModal = (preselectedDealId?: number) => {
    setModalMode("create");
    setEditingQuotationId(null);
    setFormQuotationNumber("");
    setEnableRoundOff(true);

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    const dateStr = defaultDate.toISOString().split("T")[0];

    const dealId = preselectedDealId || (deals.length > 0 ? deals[0].id : "");
    setSelectedDealId(dealId);

    const deal = deals.find((d) => d.id === dealId);
    const linkedCust = deal?.customer || customers.find((c) => c.id === deal?.customer_id);

    setQuotationTitle(deal ? `Quotation - ${deal.name}` : "Sales Quotation");
    setValidUntil(dateStr);
    setCurrency(companyProfile?.default_currency || "INR");
    setCustomerState(linkedCust?.state || companyProfile?.state || "Maharashtra");
    setCustomerGstin(linkedCust?.gstin || "");
    setTermsAndConditions(
      "1. Quotation is valid for 30 days from date of issue.\n2. Payment terms: 50% advance, 50% upon delivery.\n3. Goods & Services Tax (GST) as applicable by Indian Tax Law."
    );
    setNotes("");

    // Initialize with 1 empty item or first product
    if (products.length > 0) {
      const p = products[0];
      const initialPrice = p.selling_price || 0;
      const initialTax = p.tax_rate ?? 18;
      const taxable = initialPrice;
      const lineTotal = taxable + (taxable * initialTax) / 100;
      setLineItems([
        {
          product_id: p.id,
          product_name: p.name,
          sku: p.sku || "",
          hsn_sac: p.hsn_sac || "",
          description: p.description || "",
          quantity: 1,
          unit_price: initialPrice,
          discount_percentage: 0,
          tax_percentage: initialTax,
          line_total: Math.round(lineTotal * 100) / 100,
        },
      ]);
    } else {
      setLineItems([
        {
          product_name: "Service / Product",
          sku: "",
          hsn_sac: "998313",
          description: "",
          quantity: 1,
          unit_price: 1000,
          discount_percentage: 0,
          tax_percentage: 18,
          line_total: 1180,
        },
      ]);
    }

    setIsCreateModalOpen(true);
  };

  // Open Edit Modal (In-place update for Drafts, or Revision for Sent/Accepted)
  const handleOpenEditModal = (quote: Quotation) => {
    // If quote is already Sent or Accepted, preserve history and route to Revision flow
    if (quote.status.toLowerCase() === "sent" || quote.status.toLowerCase() === "accepted") {
      handleOpenReviseModal(quote);
      return;
    }

    setModalMode("edit");
    setEditingQuotationId(quote.id);
    setSelectedDealId(quote.deal_id);
    setFormQuotationNumber(quote.quotation_number);
    setQuotationTitle(quote.title);
    setCurrency(quote.currency || "INR");
    setCustomerState(quote.customer_state || quote.customer?.state || companyProfile?.state || "Maharashtra");
    setCustomerGstin(quote.customer_gstin || quote.customer?.gstin || "");
    setValidUntil(quote.valid_until ? quote.valid_until.split("T")[0] : "");
    setTermsAndConditions(quote.terms_and_conditions || "");
    setNotes(quote.notes || "");
    setEnableRoundOff(Boolean(quote.round_off_amount && quote.round_off_amount !== 0));

    if (quote.items && quote.items.length > 0) {
      setLineItems(
        quote.items.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku || "",
          hsn_sac: it.hsn_sac || "",
          description: it.description || "",
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_percentage: it.discount_percentage,
          tax_percentage: it.tax_percentage,
          line_total: it.line_total,
        }))
      );
    } else if (products.length > 0) {
      const p = products[0];
      setLineItems([
        {
          product_id: p.id,
          product_name: p.name,
          sku: p.sku || "",
          hsn_sac: p.hsn_sac || "",
          description: p.description || "",
          quantity: 1,
          unit_price: p.selling_price || 0,
          discount_percentage: 0,
          tax_percentage: p.tax_rate ?? 18,
          line_total: p.selling_price || 0,
        },
      ]);
    } else {
      setLineItems([
        {
          product_name: "Service / Product",
          sku: "",
          hsn_sac: "998313",
          description: "",
          quantity: 1,
          unit_price: 1000,
          discount_percentage: 0,
          tax_percentage: 18,
          line_total: 1180,
        },
      ]);
    }

    setIsCreateModalOpen(true);
  };

  // Open Revise Modal (Clone into new Draft revision, preserving original history)
  const handleOpenReviseModal = (quote: Quotation) => {
    setModalMode("revise");
    setEditingQuotationId(null);
    setSelectedDealId(quote.deal_id);

    // Calculate next revision number (e.g. QTN-0005 -> QTN-0005-R1, QTN-0005-R1 -> QTN-0005-R2)
    let nextNum = `${quote.quotation_number}-R1`;
    const revMatch = quote.quotation_number.match(/^(.*)-R(\d+)$/i);
    if (revMatch) {
      const base = revMatch[1];
      const revIndex = parseInt(revMatch[2], 10) + 1;
      nextNum = `${base}-R${revIndex}`;
    }
    setFormQuotationNumber(nextNum);
    setQuotationTitle(`${quote.title} (Rev)`);
    setCurrency(quote.currency || "INR");
    setCustomerState(quote.customer_state || quote.customer?.state || companyProfile?.state || "Maharashtra");
    setCustomerGstin(quote.customer_gstin || quote.customer?.gstin || "");

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    setValidUntil(defaultDate.toISOString().split("T")[0]);

    setTermsAndConditions(quote.terms_and_conditions || "");
    setNotes(quote.notes ? `Revision of ${quote.quotation_number}. ${quote.notes}` : `Revision of ${quote.quotation_number}.`);
    setEnableRoundOff(true);

    if (quote.items && quote.items.length > 0) {
      setLineItems(
        quote.items.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku || "",
          hsn_sac: it.hsn_sac || "",
          description: it.description || "",
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_percentage: it.discount_percentage,
          tax_percentage: it.tax_percentage,
          line_total: it.line_total,
        }))
      );
    } else if (products.length > 0) {
      const p = products[0];
      setLineItems([
        {
          product_id: p.id,
          product_name: p.name,
          sku: p.sku || "",
          hsn_sac: p.hsn_sac || "",
          description: p.description || "",
          quantity: 1,
          unit_price: p.selling_price || 0,
          discount_percentage: 0,
          tax_percentage: p.tax_rate ?? 18,
          line_total: p.selling_price || 0,
        },
      ]);
    } else {
      setLineItems([
        {
          product_name: "Service / Product",
          sku: "",
          hsn_sac: "998313",
          description: "",
          quantity: 1,
          unit_price: 1000,
          discount_percentage: 0,
          tax_percentage: 18,
          line_total: 1180,
        },
      ]);
    }

    setIsCreateModalOpen(true);
  };

  // Deal selector change in modal
  const handleDealChange = (dealIdStr: string) => {
    const dId = dealIdStr ? Number(dealIdStr) : "";
    setSelectedDealId(dId);
    if (dId) {
      const deal = deals.find((d) => d.id === dId);
      if (deal) {
        setQuotationTitle(`Quotation - ${deal.name}`);
        const linkedCust = deal.customer || customers.find((c) => c.id === deal.customer_id);
        if (linkedCust?.state) {
          setCustomerState(linkedCust.state);
        }
        if (linkedCust?.gstin) {
          setCustomerGstin(linkedCust.gstin);
        }
      }
    }
  };

  // GST Supply Determination
  const isInterState = useMemo(() => {
    const compState = (companyProfile?.state || "Maharashtra").trim().toLowerCase();
    const custState = (customerState || "").trim().toLowerCase();
    return custState !== "" && compState !== "" && custState !== compState;
  }, [companyProfile?.state, customerState]);

  // Line item manipulation
  const handleAddLineItem = () => {
    if (products.length > 0) {
      const p = products[0];
      const price = p.selling_price || 0;
      const tax = p.tax_rate ?? 18;
      const lineTotal = price + (price * tax) / 100;
      setLineItems((prev) => [
        ...prev,
        {
          product_id: p.id,
          product_name: p.name,
          sku: p.sku || "",
          hsn_sac: p.hsn_sac || "",
          description: p.description || "",
          quantity: 1,
          unit_price: price,
          discount_percentage: 0,
          tax_percentage: tax,
          line_total: Math.round(lineTotal * 100) / 100,
        },
      ]);
    } else {
      setLineItems((prev) => [
        ...prev,
        {
          product_name: "",
          sku: "",
          hsn_sac: "",
          description: "",
          quantity: 1,
          unit_price: 0,
          discount_percentage: 0,
          tax_percentage: 18,
          line_total: 0,
        },
      ]);
    }
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductSelect = (index: number, productIdStr: string) => {
    const prodId = Number(productIdStr);
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const qty = item.quantity || 1;
        const price = prod.selling_price || 0;
        const disc = item.discount_percentage || 0;
        const tax = prod.tax_rate ?? 18;
        const base = qty * price;
        const taxable = base - (base * disc) / 100;
        const gstAmount = (taxable * tax) / 100;
        const total = taxable + gstAmount;
        return {
          ...item,
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku || "",
          hsn_sac: prod.hsn_sac || "",
          description: prod.description || "",
          unit_price: price,
          tax_percentage: tax,
          line_total: Math.round(total * 100) / 100,
        };
      })
    );
  };

  const handleItemFieldChange = (
    index: number,
    field: keyof QuotationItemInput,
    value: any
  ) => {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        const qty = Number(updated.quantity) || 0;
        const price = Number(updated.unit_price) || 0;
        const disc = Number(updated.discount_percentage) || 0;
        const tax = Number(updated.tax_percentage) || 0;
        const base = qty * price;
        const taxable = base - (base * disc) / 100;
        const gstAmount = (taxable * tax) / 100;
        const total = taxable + gstAmount;
        updated.line_total = Math.round(total * 100) / 100;
        return updated;
      })
    );
  };

  // Detailed GST Calculations for Modal
  const lineItemsCalculated = useMemo(() => {
    return lineItems.map((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const disc = Number(item.discount_percentage) || 0;
      const taxRate = Number(item.tax_percentage) || 0;
      const taxable = qty * price * (1 - disc / 100);
      const gstAmount = taxable * (taxRate / 100);
      const cgstAmount = isInterState ? 0 : gstAmount / 2;
      const sgstAmount = isInterState ? 0 : gstAmount / 2;
      const igstAmount = isInterState ? gstAmount : 0;
      const lineTotal = taxable + gstAmount;
      return {
        ...item,
        taxable_amount: Math.round(taxable * 100) / 100,
        gst_amount: Math.round(gstAmount * 100) / 100,
        cgst_amount: Math.round(cgstAmount * 100) / 100,
        sgst_amount: Math.round(sgstAmount * 100) / 100,
        igst_amount: Math.round(igstAmount * 100) / 100,
        line_total: Math.round(lineTotal * 100) / 100,
      };
    });
  }, [lineItems, isInterState]);

  const calculatedSubtotal = useMemo(() => {
    return lineItemsCalculated.reduce((acc, item) => acc + (item.taxable_amount || 0), 0);
  }, [lineItemsCalculated]);

  const calculatedCGST = useMemo(() => {
    return isInterState ? 0 : lineItemsCalculated.reduce((acc, item) => acc + (item.cgst_amount || 0), 0);
  }, [lineItemsCalculated, isInterState]);

  const calculatedSGST = useMemo(() => {
    return isInterState ? 0 : lineItemsCalculated.reduce((acc, item) => acc + (item.sgst_amount || 0), 0);
  }, [lineItemsCalculated, isInterState]);

  const calculatedIGST = useMemo(() => {
    return isInterState ? lineItemsCalculated.reduce((acc, item) => acc + (item.igst_amount || 0), 0) : 0;
  }, [lineItemsCalculated, isInterState]);

  const calculatedTotalGST = useMemo(() => {
    return calculatedCGST + calculatedSGST + calculatedIGST;
  }, [calculatedCGST, calculatedSGST, calculatedIGST]);

  const rawTotal = useMemo(() => {
    return calculatedSubtotal + calculatedTotalGST;
  }, [calculatedSubtotal, calculatedTotalGST]);

  const roundOffAmount = useMemo(() => {
    if (!enableRoundOff) return 0;
    const rounded = Math.round(rawTotal);
    return Math.round((rounded - rawTotal) * 100) / 100;
  }, [enableRoundOff, rawTotal]);

  const calculatedTotal = useMemo(() => {
    return Math.round((rawTotal + roundOffAmount) * 100) / 100;
  }, [rawTotal, roundOffAmount]);

  // Submit Quotation (Handles Create, In-Place Edit, and Revision)
  const handleSubmitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDealId) {
      showToast("Please select a valid Deal for the quotation", "error");
      return;
    }

    if (lineItems.length === 0) {
      showToast("Please add at least one line item to the quotation", "error");
      return;
    }

    for (let i = 0; i < lineItems.length; i++) {
      if (!lineItems[i].product_name || !lineItems[i].product_name.trim()) {
        showToast(`Line item #${i + 1} must have a product name`, "error");
        return;
      }
      if (Number(lineItems[i].quantity) <= 0) {
        showToast(`Line item #${i + 1} must have a quantity greater than 0`, "error");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const parsedValidUntil = validUntil ? (validUntil.includes("T") ? validUntil : `${validUntil}T23:59:59Z`) : undefined;
      const itemsPayload = lineItems.map((item) => ({
        product_id: item.product_id ? Number(item.product_id) : undefined,
        product_name: item.product_name,
        sku: item.sku || "",
        hsn_sac: item.hsn_sac || "",
        description: item.description || "",
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        discount_percentage: Number(item.discount_percentage) || 0,
        tax_percentage: Number(item.tax_percentage) || 0,
      }));

      if (modalMode === "edit" && editingQuotationId) {
        // Direct In-Place Edit
        const updatePayload = {
          quotation_number: formQuotationNumber.trim() || undefined,
          deal_id: Number(selectedDealId),
          title: quotationTitle.trim() || `Quotation for Deal #${selectedDealId}`,
          currency: currency || "INR",
          valid_until: parsedValidUntil,
          terms_and_conditions: termsAndConditions,
          notes: notes,
          customer_state: customerState.trim() || undefined,
          customer_gstin: customerGstin.trim() || undefined,
          round_off_amount: roundOffAmount,
          items: itemsPayload,
        };

        const updated = await quotationsApi.update(editingQuotationId, updatePayload);
        showToast(`Quotation ${updated.quotation_number} updated with GST calculations!`);
        setIsCreateModalOpen(false);
        await loadAllData();
        setSelectedQuotation(updated);
        setIsDrawerOpen(true);
      } else {
        // Create or Revise
        const createPayload = {
          quotation_number: formQuotationNumber.trim() || undefined,
          deal_id: Number(selectedDealId),
          title: quotationTitle.trim() || `Quotation for Deal #${selectedDealId}`,
          currency: currency || "INR",
          valid_until: parsedValidUntil,
          terms_and_conditions: termsAndConditions,
          notes: notes,
          customer_state: customerState.trim() || undefined,
          customer_gstin: customerGstin.trim() || undefined,
          round_off_amount: roundOffAmount,
          items: itemsPayload,
        };

        const newQuote = await quotationsApi.create(createPayload);
        const successMsg = modalMode === "revise"
          ? `Revision ${newQuote.quotation_number} created with GST breakdown!`
          : `Quotation ${newQuote.quotation_number} generated with GST compliance!`;
        showToast(successMsg);
        setIsCreateModalOpen(false);

        // Refresh list
        await loadAllData();

        // Open detail drawer for newly created quote
        setSelectedQuotation(newQuote);
        setIsDrawerOpen(true);
      }
    } catch (err: any) {
      console.error("Save quotation failed:", err);
      showToast(err?.message || "Failed to save quotation", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Change Handler
  const handleStatusChange = async (newStatus: string) => {
    if (!selectedQuotation) return;
    try {
      setIsUpdatingStatus(true);
      const updated = await quotationsApi.changeStatus(selectedQuotation.id, newStatus);
      setSelectedQuotation(updated);
      setQuotations((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      showToast(`Quotation status changed to "${newStatus}". Deal updated.`);
      await loadAllData();
    } catch (err: any) {
      console.error("Update quotation status failed:", err);
      showToast(err?.message || "Failed to update status", "error");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Delete Quotation Handler
  const handleDeleteQuotation = async () => {
    if (!selectedQuotation) return;
    if (!window.confirm(`Are you sure you want to delete quotation ${selectedQuotation.quotation_number}?`)) {
      return;
    }
    try {
      setIsDeleting(true);
      await quotationsApi.delete(selectedQuotation.id);
      showToast(`Quotation ${selectedQuotation.quotation_number} deleted successfully.`);
      setIsDrawerOpen(false);
      setSelectedQuotation(null);
      await loadAllData();
    } catch (err: any) {
      console.error("Delete quotation failed:", err);
      showToast(err?.message || "Failed to delete quotation", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      // Status filter
      if (statusFilter !== "all" && q.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesNum = q.quotation_number.toLowerCase().includes(query);
        const matchesTitle = q.title.toLowerCase().includes(query);
        const matchesDeal = q.deal ? q.deal.name.toLowerCase().includes(query) : false;
        const matchesCustomer = q.customer ? q.customer.name.toLowerCase().includes(query) : false;
        const matchesLead = q.lead_number ? q.lead_number.toLowerCase().includes(query) : false;
        if (!matchesNum && !matchesTitle && !matchesDeal && !matchesCustomer && !matchesLead) {
          return false;
        }
      }
      return true;
    });
  }, [quotations, statusFilter, searchQuery]);

  // Stats Counters
  const stats = useMemo(() => {
    const total = quotations.length;
    const drafts = quotations.filter((q) => q.status.toLowerCase() === "draft").length;
    const sent = quotations.filter((q) => q.status.toLowerCase() === "sent").length;
    const accepted = quotations.filter((q) => q.status.toLowerCase() === "accepted").length;
    const totalValue = quotations.reduce((acc, q) => acc + (q.total_amount || 0), 0);
    const acceptedValue = quotations
      .filter((q) => q.status.toLowerCase() === "accepted")
      .reduce((acc, q) => acc + (q.total_amount || 0), 0);
    return { total, drafts, sent, accepted, totalValue, acceptedValue };
  }, [quotations]);

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft":
        return { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1", label: "Draft" };
      case "sent":
        return { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE", label: "Sent" };
      case "accepted":
        return { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0", label: "Accepted" };
      case "rejected":
        return { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", label: "Rejected" };
      case "expired":
        return { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", label: "Expired" };
      default:
        return { bg: "#F8FAFC", text: "#64748B", border: "#E2E8F0", label: status };
    }
  };

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden", backgroundColor: "#F8FAFC" }}>
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
            gap: "10px",
            padding: "12px 20px",
            borderRadius: "10px",
            backgroundColor: toastMessage.type === "error" ? "#FEF2F2" : "#ECFDF5",
            color: toastMessage.type === "error" ? "#991B1B" : "#065F46",
            border: `1px solid ${toastMessage.type === "error" ? "#FCA5A5" : "#6EE7B7"}`,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          {toastMessage.type === "error" ? <AlertCircle size={18} color="#DC2626" /> : <CheckCircle2 size={18} color="#059669" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Unified Sidebar */}
      <Sidebar
        activeTab={activeSidebarTab}
        onSelectTab={(tab) => {
          setActiveSidebarTab(tab);
          if (tab === "leads") router.push("/leads");
          else if (tab === "deals") router.push("/deals");
          else if (tab === "orders") router.push("/orders");
          else if (tab === "products") router.push("/products");
          else if (tab === "follow-ups") router.push("/follow-ups");
          else if (tab === "company") router.push("/company");
          else if (tab === "api-keys") router.push("/leads?tab=api-keys");
          else if (tab === "api-docs") router.push("/leads?tab=api-docs");
          else if (tab === "profile") router.push("/leads?tab=profile");
        }}
        user={currentUser}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenAdminSettings={() => {}}
      />

      {/* Main Content Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        {/* Top Header / Toolbar */}
        <header
          style={{
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #E2E8F0",
            padding: "14px 24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            position: "sticky",
            top: 0,
            zIndex: 30,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          }}
        >
          {/* Title & Count Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                backgroundColor: "#F0FDFA",
                border: "1px solid #CCFBF1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0D9488",
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                  Quotations
                </h1>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "3px 10px",
                    borderRadius: "999px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    backgroundColor: "#F1F5F9",
                    color: "#475569",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  {filteredQuotations.length} {filteredQuotations.length === 1 ? "Quote" : "Quotes"}
                </span>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "2px 0 0 0" }}>
                Lead → Deal → Quotation Workflow • Select existing Deal to auto-populate Customer & Lead
              </p>
            </div>
          </div>

          {/* Search, Status Tabs, and Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            {/* Search Box */}
            <div style={{ position: "relative", minWidth: "240px" }}>
              <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search quote #, deal, customer..."
                style={{
                  width: "100%",
                  paddingLeft: "36px",
                  paddingRight: "32px",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                  fontSize: "0.8125rem",
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  outline: "none",
                  color: "#0F172A",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94A3B8",
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Quotations"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                color: "#475569",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
            </button>

            {/* New Quotation Button */}
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                backgroundColor: "#009F9A",
                color: "#FFFFFF",
                fontSize: "0.8125rem",
                fontWeight: 600,
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              }}
            >
              <Plus size={16} />
              <span>New Quotation</span>
            </button>
          </div>
        </header>

        {/* Stats Strip */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderBottom: "1px solid #E2E8F0",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {/* Status Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            {[
              { id: "all", label: "All", count: stats.total },
              { id: "draft", label: "Draft", count: stats.drafts },
              { id: "sent", label: "Sent", count: stats.sent },
              { id: "accepted", label: "Accepted", count: stats.accepted },
              { id: "rejected", label: "Rejected", count: quotations.filter((q) => q.status.toLowerCase() === "rejected").length },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    fontSize: "0.75rem",
                    fontWeight: active ? 700 : 500,
                    borderRadius: "20px",
                    backgroundColor: active ? "#0F766E" : "#F1F5F9",
                    color: active ? "#FFFFFF" : "#475569",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "0.7rem",
                      backgroundColor: active ? "rgba(255, 255, 255, 0.25)" : "#E2E8F0",
                      color: active ? "#FFFFFF" : "#64748B",
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Metrics */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "0.8125rem", color: "#64748B" }}>
            <div>
              Total Quoted:{" "}
              <strong style={{ color: "#0F172A", fontWeight: 700 }}>
                ${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
            <div style={{ width: "1px", height: "16px", backgroundColor: "#E2E8F0" }} />
            <div>
              Accepted Value:{" "}
              <strong style={{ color: "#059669", fontWeight: 700 }}>
                ${stats.acceptedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
        </div>

        {/* Quotations List View / Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", gap: "12px", color: "#64748B" }}>
              <RefreshCw size={28} className="animate-spin" color="#009F9A" />
              <span style={{ fontSize: "0.875rem" }}>Loading quotations...</span>
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: "12px",
                border: "1px dashed #CBD5E1",
                padding: "60px 24px",
                textAlign: "center",
                marginTop: "20px",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "#F0FDFA",
                  color: "#0D9488",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "16px",
                }}
              >
                <FileText size={28} />
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" }}>
                {searchQuery || statusFilter !== "all" ? "No quotations found" : "No Quotations Created Yet"}
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#64748B", maxWidth: "460px", margin: "0 0 20px 0", lineHeight: 1.5 }}>
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search terms or filters."
                  : "Quotations must be created by selecting an existing Deal. Customer, Lead, and Requirement will be populated automatically."}
              </p>
              <button
                type="button"
                onClick={() => handleOpenCreateModal()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  backgroundColor: "#009F9A",
                  color: "#FFFFFF",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Plus size={16} />
                <span>Create Quotation from Deal</span>
              </button>
            </div>
          ) : (
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B", fontWeight: 600, textTransform: "uppercase", fontSize: "0.6875rem", letterSpacing: "0.04em" }}>
                      <th style={{ padding: "12px 16px" }}>Quotation #</th>
                      <th style={{ padding: "12px 16px" }}>Title / Ref</th>
                      <th style={{ padding: "12px 16px" }}>Linked Deal</th>
                      <th style={{ padding: "12px 16px" }}>Customer / Company</th>
                      <th style={{ padding: "12px 16px" }}>Lead Ref</th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Amount</th>
                      <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotations.map((quote) => {
                      const badge = getStatusBadge(quote.status);
                      return (
                        <tr
                          key={quote.id}
                          onClick={() => {
                            setSelectedQuotation(quote);
                            setIsDrawerOpen(true);
                          }}
                          style={{
                            borderBottom: "1px solid #F1F5F9",
                            cursor: "pointer",
                            transition: "background-color 0.12s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          {/* Quotation Number */}
                          <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0F766E", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <FileText size={15} color="#0D9488" />
                              <span>{quote.quotation_number}</span>
                            </div>
                          </td>

                          {/* Title */}
                          <td style={{ padding: "14px 16px", color: "#0F172A", fontWeight: 600, maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {quote.title}
                          </td>

                          {/* Linked Deal */}
                          <td style={{ padding: "14px 16px", color: "#334155" }}>
                            {quote.deal ? (
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontWeight: 600, color: "#2563EB" }}>{quote.deal.name}</span>
                                {quote.deal.stage && (
                                  <span style={{ fontSize: "0.6875rem", color: "#64748B" }}>
                                    Stage: {quote.deal.stage.name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>Deal #{quote.deal_id}</span>
                            )}
                          </td>

                          {/* Customer / Company */}
                          <td style={{ padding: "14px 16px", color: "#334155" }}>
                            {quote.customer ? (
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontWeight: 600, color: "#0F172A" }}>{quote.customer.name}</span>
                                {quote.customer.company && (
                                  <span style={{ fontSize: "0.6875rem", color: "#64748B" }}>
                                    {quote.customer.company}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>—</span>
                            )}
                          </td>

                          {/* Originating Lead */}
                          <td style={{ padding: "14px 16px", color: "#64748B" }}>
                            {quote.lead_number ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  backgroundColor: "#F1F5F9",
                                  color: "#334155",
                                  fontWeight: 600,
                                  fontSize: "0.75rem",
                                }}
                              >
                                {quote.lead_number}
                              </span>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td style={{ padding: "14px 16px" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "3px 10px",
                                borderRadius: "999px",
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                backgroundColor: badge.bg,
                                color: badge.text,
                                border: `1px solid ${badge.border}`,
                                textTransform: "uppercase",
                                letterSpacing: "0.03em",
                              }}
                            >
                              {badge.label}
                            </span>
                          </td>

                          {/* Total Amount */}
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap" }}>
                            ${quote.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "14px 16px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              <button
                                type="button"
                                title={quote.status.toLowerCase() === "draft" ? "Edit Quotation" : "Revise Quotation (New Version)"}
                                onClick={() => handleOpenEditModal(quote)}
                                style={{
                                  padding: "6px",
                                  borderRadius: "6px",
                                  border: "1px solid #CBD5E1",
                                  backgroundColor: "#F0FDFA",
                                  color: "#0D9488",
                                  cursor: "pointer",
                                }}
                              >
                                {quote.status.toLowerCase() === "draft" ? <Edit3 size={14} /> : <Copy size={14} />}
                              </button>
                              <button
                                type="button"
                                title="Print / PDF View"
                                onClick={() => {
                                  setPrintQuotation(quote);
                                  setIsPrintModalOpen(true);
                                }}
                                style={{
                                  padding: "6px",
                                  borderRadius: "6px",
                                  border: "1px solid #E2E8F0",
                                  backgroundColor: "#FFFFFF",
                                  color: "#475569",
                                  cursor: "pointer",
                                }}
                              >
                                <Printer size={14} />
                              </button>
                              <button
                                type="button"
                                title="View Details"
                                onClick={() => {
                                  setSelectedQuotation(quote);
                                  setIsDrawerOpen(true);
                                }}
                                style={{
                                  padding: "6px",
                                  borderRadius: "6px",
                                  border: "1px solid #E2E8F0",
                                  backgroundColor: "#FFFFFF",
                                  color: "#0F766E",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} />
                              </button>
                            </div>
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

      {/* CREATE QUOTATION MODAL */}
      {isCreateModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "840px",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
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
                    borderRadius: "10px",
                    backgroundColor: "#F0FDFA",
                    border: "1px solid #CCFBF1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0D9488",
                  }}
                >
                  <FileText size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    {modalMode === "edit"
                      ? `Edit Quotation ${formQuotationNumber ? `(${formQuotationNumber})` : ""}`
                      : modalMode === "revise"
                      ? `Create Quotation Revision (${formQuotationNumber})`
                      : "Create Sales Quotation"}
                  </h2>
                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>
                    {modalMode === "edit"
                      ? "Update line items, pricing, commercial terms, or deal linkage"
                      : modalMode === "revise"
                      ? "Clones line items and terms into a new Draft revision while preserving historical quotes"
                      : "Select an active Deal • Customer, Lead, and Requirement auto-populate automatically"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
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

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitQuotation} style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* DEAL SELECTION (MANDATORY & EXCLUSIVE) */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #CBD5E1",
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>Select Deal (Required)</span>
                  <span style={{ color: "#DC2626" }}>*</span>
                </label>

                <select
                  value={selectedDealId}
                  onChange={(e) => handleDealChange(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    outline: "none",
                  }}
                >
                  <option value="" disabled>
                    -- Choose an existing Deal --
                  </option>
                  {deals.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.name} — (Value: ${deal.value.toLocaleString()}) {deal.customer ? `• ${deal.customer.name}` : ""}
                    </option>
                  ))}
                </select>

                {/* AUTO-POPULATED DEAL CONTEXT CARD */}
                {currentSelectedDeal ? (
                  <div
                    style={{
                      backgroundColor: "#F0FDFA",
                      border: "1px solid #99F6E4",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Auto-Populated Context from Deal
                      </span>
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", backgroundColor: "#CCFBF1", color: "#115E59", fontWeight: 600 }}>
                        Current Stage: {currentSelectedDeal.stage?.name || "New Opportunity"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", fontSize: "0.8125rem" }}>
                      {/* Customer Info */}
                      <div>
                        <div style={{ color: "#64748B", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 600 }}>
                          Customer & Company
                        </div>
                        <div style={{ fontWeight: 700, color: "#0F172A" }}>
                          {currentSelectedCustomer?.name || currentSelectedDeal.customer?.name || "No Customer Linked"}
                        </div>
                        {(currentSelectedCustomer?.company || currentSelectedDeal.customer?.company) && (
                          <div style={{ color: "#475569", fontSize: "0.75rem" }}>
                            {currentSelectedCustomer?.company || currentSelectedDeal.customer?.company}
                          </div>
                        )}
                        {(currentSelectedCustomer?.email || currentSelectedDeal.customer?.email) && (
                          <div style={{ color: "#0D9488", fontSize: "0.75rem" }}>
                            {currentSelectedCustomer?.email || currentSelectedDeal.customer?.email}
                          </div>
                        )}
                      </div>

                      {/* Originating Lead Info */}
                      <div>
                        <div style={{ color: "#64748B", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 600 }}>
                          Originating Lead
                        </div>
                        <div style={{ fontWeight: 700, color: "#0F172A" }}>
                          {currentSelectedDeal.lead_number || "None"}
                        </div>
                        <div style={{ color: "#64748B", fontSize: "0.75rem" }}>
                          Qualified Lead automatically synced
                        </div>
                      </div>

                      {/* Requirement */}
                      <div style={{ gridColumn: "span 2" }}>
                        <div style={{ color: "#64748B", fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 600 }}>
                          Requirement / Scope
                        </div>
                        <div style={{ color: "#1E293B", fontSize: "0.8125rem", fontStyle: currentSelectedDeal.requirement ? "normal" : "italic" }}>
                          {currentSelectedDeal.requirement || "No requirement notes recorded in deal."}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.75rem", color: "#DC2626", fontWeight: 500 }}>
                    * Quotation cannot be created without choosing a Deal. Lead and Customer will be linked from it.
                  </div>
                )}
              </div>

              {/* Quotation Basic Fields & GST Configuration */}
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.8fr 1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                    Quotation #
                  </label>
                  <input
                    type="text"
                    value={formQuotationNumber}
                    onChange={(e) => setFormQuotationNumber(e.target.value)}
                    placeholder="Auto-generated if empty"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#0F172A",
                      boxSizing: "border-box",
                      backgroundColor: "#FFFFFF",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                    Quotation Title / Subject
                  </label>
                  <input
                    type="text"
                    value={quotationTitle}
                    onChange={(e) => setQuotationTitle(e.target.value)}
                    required
                    placeholder="e.g. Enterprise Solution & Implementation Quote"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8125rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8125rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8125rem",
                      boxSizing: "border-box",
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              {/* GST & PLACE OF SUPPLY SECTION */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Receipt size={16} color="#0D9488" />
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A" }}>
                      GST & Statutory Taxation
                    </span>
                    {companyProfile?.gst_number && (
                      <span style={{ fontSize: "0.75rem", color: "#64748B", backgroundColor: "#FFFFFF", padding: "2px 8px", borderRadius: "4px", border: "1px solid #E2E8F0" }}>
                        Supplier GSTIN: <strong style={{ color: "#0F172A" }}>{companyProfile.gst_number}</strong>
                      </span>
                    )}
                  </div>

                  {/* GST Supply Indicator Badge */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      backgroundColor: isInterState ? "#EEF2FF" : "#F0FDFA",
                      color: isInterState ? "#4338CA" : "#0F766E",
                      border: `1px solid ${isInterState ? "#C7D2FE" : "#99F6E4"}`,
                    }}
                  >
                    <span>●</span>
                    <span>
                      {isInterState
                        ? "Inter-State Supply (IGST 100%)"
                        : "Intra-State Supply (CGST 50% + SGST 50%)"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
                  {/* Supplier State */}
                  <div>
                    <label style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                      Supplier State (Company)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={companyProfile?.state || "Maharashtra"}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#F1F5F9",
                        fontSize: "0.8125rem",
                        color: "#475569",
                        boxSizing: "border-box",
                        fontWeight: 600,
                      }}
                    />
                  </div>

                  {/* Place of Supply (Customer State) */}
                  <div>
                    <label style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#0F172A", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                      Place of Supply / Customer State *
                    </label>
                    <input
                      type="text"
                      value={customerState}
                      onChange={(e) => setCustomerState(e.target.value)}
                      placeholder="e.g. Maharashtra, Karnataka, Gujarat"
                      required
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        backgroundColor: "#FFFFFF",
                        fontSize: "0.8125rem",
                        color: "#0F172A",
                        boxSizing: "border-box",
                        fontWeight: 600,
                      }}
                    />
                  </div>

                  {/* Customer GSTIN */}
                  <div>
                    <label style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                      Customer GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      maxLength={15}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        backgroundColor: "#FFFFFF",
                        fontSize: "0.8125rem",
                        color: "#0F172A",
                        boxSizing: "border-box",
                        textTransform: "uppercase",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* LINE ITEMS BUILDER WITH HSN & GST */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Package size={16} color="#0D9488" />
                    <span>Quotation Products & GST Line Items ({lineItems.length})</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 12px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#0F766E",
                      backgroundColor: "#F0FDFA",
                      border: "1px solid #99F6E4",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Item</span>
                  </button>
                </div>

                {/* Items Table */}
                <div style={{ border: "1px solid #E2E8F0", borderRadius: "10px", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B", fontWeight: 600, textAlign: "left" }}>
                        <th style={{ padding: "8px 10px", width: "130px" }}>Catalog</th>
                        <th style={{ padding: "8px 10px" }}>Item Name & Spec</th>
                        <th style={{ padding: "8px 8px", width: "75px" }}>HSN/SAC</th>
                        <th style={{ padding: "8px 8px", width: "55px", textAlign: "center" }}>Qty</th>
                        <th style={{ padding: "8px 8px", width: "85px", textAlign: "right" }}>Unit Price</th>
                        <th style={{ padding: "8px 8px", width: "60px", textAlign: "center" }}>Disc %</th>
                        <th style={{ padding: "8px 8px", width: "85px", textAlign: "right" }}>Taxable</th>
                        <th style={{ padding: "8px 8px", width: "65px", textAlign: "center" }}>GST %</th>
                        <th style={{ padding: "8px 8px", width: "80px", textAlign: "right" }}>GST Amt</th>
                        <th style={{ padding: "8px 10px", width: "95px", textAlign: "right" }}>Total</th>
                        <th style={{ padding: "8px 6px", width: "35px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItemsCalculated.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          {/* Catalog picker */}
                          <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
                            <select
                              value={item.product_id || ""}
                              onChange={(e) => handleProductSelect(idx, e.target.value)}
                              style={{
                                width: "100%",
                                padding: "6px 8px",
                                borderRadius: "6px",
                                border: "1px solid #CBD5E1",
                                fontSize: "0.75rem",
                                backgroundColor: "#FFFFFF",
                              }}
                            >
                              <option value="">-- Custom --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({currency === "INR" ? "₹" : "$"}{p.selling_price})
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Product Name & Description */}
                          <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
                            <input
                              type="text"
                              value={item.product_name}
                              onChange={(e) => handleItemFieldChange(idx, "product_name", e.target.value)}
                              placeholder="Product or Service name"
                              required
                              style={{
                                width: "100%",
                                padding: "6px 8px",
                                borderRadius: "6px",
                                border: "1px solid #CBD5E1",
                                fontSize: "0.75rem",
                                marginBottom: "4px",
                                boxSizing: "border-box",
                              }}
                            />
                            <input
                              type="text"
                              value={item.description || ""}
                              onChange={(e) => handleItemFieldChange(idx, "description", e.target.value)}
                              placeholder="Item description / scope"
                              style={{
                                width: "100%",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid #E2E8F0",
                                fontSize: "0.6875rem",
                                color: "#64748B",
                                boxSizing: "border-box",
                              }}
                            />
                          </td>

                          {/* HSN / SAC */}
                          <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                            <input
                              type="text"
                              value={item.hsn_sac || ""}
                              onChange={(e) => handleItemFieldChange(idx, "hsn_sac", e.target.value)}
                              placeholder="HSN"
                              style={{
                                width: "100%",
                                padding: "6px 6px",
                                borderRadius: "6px",
                                border: "1px solid #CBD5E1",
                                fontSize: "0.75rem",
                                textAlign: "center",
                                boxSizing: "border-box",
                              }}
                            />
                          </td>

                          {/* Qty */}
                          <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => handleItemFieldChange(idx, "quantity", Number(e.target.value))}
                              style={{
                                width: "100%",
                                padding: "6px 4px",
                                borderRadius: "6px",
                                border: "1px solid #CBD5E1",
                                fontSize: "0.75rem",
                                textAlign: "center",
                                boxSizing: "border-box",
                              }}
                            />
                          </td>

                          {/* Unit Price */}
                          <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => handleItemFieldChange(idx, "unit_price", Number(e.target.value))}
                              style={{
                                width: "100%",
                                padding: "6px 6px",
                                borderRadius: "6px",
                                border: "1px solid #CBD5E1",
                                fontSize: "0.75rem",
                                textAlign: "right",
                                boxSizing: "border-box",
                              }}
                            />
                          </td>

                          {/* Discount % */}
                          <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount_percentage || 0}
                              onChange={(e) => handleItemFieldChange(idx, "discount_percentage", Number(e.target.value))}
                              style={{
                                width: "100%",
                                padding: "6px 4px",
                                borderRadius: "6px",
                                border: "1px solid #CBD5E1",
                                fontSize: "0.75rem",
                                textAlign: "center",
                                boxSizing: "border-box",
                              }}
                            />
                          </td>

                          {/* Taxable Amount (Calculated) */}
                          <td style={{ padding: "8px 8px", verticalAlign: "top", textAlign: "right", color: "#334155", fontWeight: 600 }}>
                            {currency === "INR" ? "₹" : "$"}{item.taxable_amount?.toFixed(2)}
                          </td>

                          {/* GST Rate % */}
                          <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={item.tax_percentage || 0}
                              onChange={(e) => handleItemFieldChange(idx, "tax_percentage", Number(e.target.value))}
                              style={{
                                width: "100%",
                                padding: "6px 4px",
                                borderRadius: "6px",
                                border: "1px solid #CBD5E1",
                                fontSize: "0.75rem",
                                textAlign: "center",
                                boxSizing: "border-box",
                              }}
                            />
                          </td>

                          {/* GST Amount (Calculated) */}
                          <td style={{ padding: "8px 8px", verticalAlign: "top", textAlign: "right", color: "#0F766E", fontWeight: 600 }}>
                            +{currency === "INR" ? "₹" : "$"}{item.gst_amount?.toFixed(2)}
                          </td>

                          {/* Line Total */}
                          <td style={{ padding: "8px 10px", verticalAlign: "top", textAlign: "right", fontWeight: 700, color: "#0F172A" }}>
                            {currency === "INR" ? "₹" : "$"}{item.line_total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Delete Item */}
                          <td style={{ padding: "8px 6px", verticalAlign: "top", textAlign: "center" }}>
                            {lineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(idx)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#EF4444",
                                  cursor: "pointer",
                                  padding: "4px",
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Totals Summary Box with Full GST Breakdown */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                  <div
                    style={{
                      width: "360px",
                      backgroundColor: "#F8FAFC",
                      borderRadius: "10px",
                      border: "1px solid #E2E8F0",
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                      <span>Taxable Amount (Subtotal):</span>
                      <strong style={{ color: "#0F172A" }}>{currency === "INR" ? "₹" : "$"}{calculatedSubtotal.toFixed(2)}</strong>
                    </div>

                    {!isInterState ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#0F766E", fontSize: "0.75rem" }}>
                          <span>Central GST (CGST):</span>
                          <strong>+{currency === "INR" ? "₹" : "$"}{calculatedCGST.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#0F766E", fontSize: "0.75rem" }}>
                          <span>State GST (SGST):</span>
                          <strong>+{currency === "INR" ? "₹" : "$"}{calculatedSGST.toFixed(2)}</strong>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#4338CA", fontSize: "0.75rem" }}>
                        <span>Integrated GST (IGST):</span>
                        <strong>+{currency === "INR" ? "₹" : "$"}{calculatedIGST.toFixed(2)}</strong>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", color: "#0F172A", fontWeight: 600, borderTop: "1px dashed #E2E8F0", paddingTop: "4px" }}>
                      <span>Total GST:</span>
                      <strong style={{ color: "#0F766E" }}>+{currency === "INR" ? "₹" : "$"}{calculatedTotalGST.toFixed(2)}</strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 0",
                      }}
                    >
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "#475569", cursor: "pointer", userSelect: "none" }}>
                        <input
                          type="checkbox"
                          checked={enableRoundOff}
                          onChange={(e) => setEnableRoundOff(e.target.checked)}
                          style={{ accentColor: "#0D9488", cursor: "pointer" }}
                        />
                        <span>Auto Round-off</span>
                      </label>
                      {enableRoundOff && (
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: roundOffAmount >= 0 ? "#059669" : "#DC2626" }}>
                          {roundOffAmount >= 0 ? `+${currency === "INR" ? "₹" : "$"}${roundOffAmount.toFixed(2)}` : `-${currency === "INR" ? "₹" : "$"}${Math.abs(roundOffAmount).toFixed(2)}`}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        borderTop: "2px solid #CBD5E1",
                        paddingTop: "8px",
                        fontWeight: 800,
                        fontSize: "1rem",
                        color: "#0F172A",
                      }}
                    >
                      <span>Grand Total:</span>
                      <span style={{ color: "#0D9488" }}>
                        {currency === "INR" ? "₹" : "$"}{calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms and Notes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                    Terms & Conditions
                  </label>
                  <textarea
                    rows={3}
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.75rem",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                    Client Notes / Comments
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional message or instructions for the recipient..."
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.75rem",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px",
                  borderTop: "1px solid #E2E8F0",
                  paddingTop: "16px",
                  marginTop: "8px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    backgroundColor: "#F1F5F9",
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
                  disabled={isSubmitting || !selectedDealId}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "9px 22px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#009F9A",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: !selectedDealId || isSubmitting ? "not-allowed" : "pointer",
                    opacity: !selectedDealId || isSubmitting ? 0.6 : 1,
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>
                    {isSubmitting
                      ? modalMode === "edit"
                        ? "Saving Changes..."
                        : modalMode === "revise"
                        ? "Creating Revision..."
                        : "Generating Quotation..."
                      : modalMode === "edit"
                      ? "Save Changes"
                      : modalMode === "revise"
                      ? "Create Revision"
                      : "Create Quotation"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUOTATION DETAIL DRAWER */}
      {isDrawerOpen && selectedQuotation && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "560px",
              height: "100%",
              backgroundColor: "#FFFFFF",
              boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.15)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#F8FAFC",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      backgroundColor: "#F0FDFA",
                      color: "#0F766E",
                      border: "1px solid #99F6E4",
                    }}
                  >
                    {selectedQuotation.quotation_number}
                  </span>
                  {(() => {
                    const badge = getStatusBadge(selectedQuotation.status);
                    return (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          backgroundColor: badge.bg,
                          color: badge.text,
                          border: `1px solid ${badge.border}`,
                          textTransform: "uppercase",
                        }}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  {selectedQuotation.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
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
            <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Linked Deal Card */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Linked Pipeline Deal
                  </span>
                  <Link
                    href="/deals"
                    style={{
                      fontSize: "0.75rem",
                      color: "#2563EB",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      textDecoration: "none",
                    }}
                  >
                    <span>View Deal</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0F172A" }}>
                  {selectedQuotation.deal?.name || `Deal #${selectedQuotation.deal_id}`}
                </div>
                {selectedQuotation.deal?.stage && (
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    Pipeline Stage: <strong style={{ color: "#334155" }}>{selectedQuotation.deal.stage.name}</strong>
                  </div>
                )}
              </div>

              {/* Customer & Lead Information */}
              {/* Customer & Lead Information */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {/* Customer */}
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
                    Customer & Recipient
                  </span>
                  <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "0.875rem" }}>
                    {selectedQuotation.customer?.name || "No Customer Name"}
                  </div>
                  {selectedQuotation.customer?.company && (
                    <div style={{ fontSize: "0.75rem", color: "#475569" }}>
                      {selectedQuotation.customer.company}
                    </div>
                  )}
                  {selectedQuotation.customer?.email && (
                    <div style={{ fontSize: "0.75rem", color: "#0D9488" }}>
                      {selectedQuotation.customer.email}
                    </div>
                  )}
                </div>

                {/* Lead */}
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
                    Originating Lead
                  </span>
                  <div style={{ fontWeight: 700, color: "#0F172A", fontSize: "0.875rem" }}>
                    {selectedQuotation.lead_number || "—"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    Converted & Linked
                  </div>
                </div>
              </div>

              {/* GST & Place of Supply Summary Card */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #CBD5E1",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  fontSize: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "#0F172A" }}>
                    <Receipt size={14} color="#0D9488" />
                    <span>Place of Supply & GST Profile</span>
                  </div>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: 700,
                      fontSize: "0.6875rem",
                      backgroundColor: selectedQuotation.is_inter_state ? "#EEF2FF" : "#F0FDFA",
                      color: selectedQuotation.is_inter_state ? "#4338CA" : "#0F766E",
                      border: `1px solid ${selectedQuotation.is_inter_state ? "#C7D2FE" : "#99F6E4"}`,
                    }}
                  >
                    {selectedQuotation.is_inter_state ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", color: "#334155" }}>
                  <div>
                    <span style={{ color: "#64748B" }}>Supplier State: </span>
                    <strong>{selectedQuotation.company_state || companyProfile?.state || "Maharashtra"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Place of Supply: </span>
                    <strong style={{ color: "#0F172A" }}>{selectedQuotation.customer_state || selectedQuotation.customer?.state || "Maharashtra"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Company GSTIN: </span>
                    <strong>{selectedQuotation.company_gstin || companyProfile?.gst_number || "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748B" }}>Customer GSTIN: </span>
                    <strong>{selectedQuotation.customer_gstin || selectedQuotation.customer?.gstin || "Unregistered"}</strong>
                  </div>
                </div>
              </div>

              {/* Requirement Section */}
              {selectedQuotation.deal?.requirement && (
                <div
                  style={{
                    backgroundColor: "#FFFBEB",
                    border: "1px solid #FDE68A",
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#92400E", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                    Requirement Specification
                  </span>
                  <p style={{ fontSize: "0.8125rem", color: "#78350F", margin: 0, lineHeight: 1.4 }}>
                    {selectedQuotation.deal.requirement}
                  </p>
                </div>
              )}

              {/* Line Items List with HSN/SAC and GST */}
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0F172A", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                  Quoted Products & GST Items ({selectedQuotation.items?.length || 0})
                </span>
                <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#64748B", textAlign: "left" }}>
                        <th style={{ padding: "8px 10px" }}>Item & Spec</th>
                        <th style={{ padding: "8px 8px", textAlign: "center" }}>HSN</th>
                        <th style={{ padding: "8px 8px", textAlign: "center" }}>Qty</th>
                        <th style={{ padding: "8px 8px", textAlign: "right" }}>Taxable</th>
                        <th style={{ padding: "8px 8px", textAlign: "center" }}>GST %</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedQuotation.items?.map((item) => {
                        const currSym = selectedQuotation.currency === "INR" ? "₹" : "$";
                        return (
                          <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "8px 10px" }}>
                              <div style={{ fontWeight: 600, color: "#0F172A" }}>{item.product_name}</div>
                              {item.sku && <div style={{ fontSize: "0.6875rem", color: "#64748B" }}>SKU: {item.sku}</div>}
                            </td>
                            <td style={{ padding: "8px 8px", textAlign: "center", color: "#475569" }}>
                              {item.hsn_sac || "—"}
                            </td>
                            <td style={{ padding: "8px 8px", textAlign: "center", color: "#475569" }}>
                              {item.quantity}
                            </td>
                            <td style={{ padding: "8px 8px", textAlign: "right", color: "#475569" }}>
                              {currSym}{item.taxable_amount ? item.taxable_amount.toFixed(2) : (item.unit_price * item.quantity).toFixed(2)}
                            </td>
                            <td style={{ padding: "8px 8px", textAlign: "center", color: "#0F766E", fontWeight: 600 }}>
                              {item.gst_rate ?? item.tax_percentage}%
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#0F172A" }}>
                              {currSym}{item.line_total?.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Breakdown with GST Split */}
              {(() => {
                const currSym = selectedQuotation.currency === "INR" ? "₹" : "$";
                const isInter = selectedQuotation.is_inter_state;
                const taxable = selectedQuotation.taxable_amount || selectedQuotation.subtotal || 0;
                const cgst = selectedQuotation.cgst_amount || 0;
                const sgst = selectedQuotation.sgst_amount || 0;
                const igst = selectedQuotation.igst_amount || 0;
                const totalGst = selectedQuotation.total_gst_amount || selectedQuotation.tax_amount || 0;
                const roundOff = selectedQuotation.round_off_amount || 0;

                return (
                  <div
                    style={{
                      backgroundColor: "#F8FAFC",
                      borderRadius: "8px",
                      border: "1px solid #E2E8F0",
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                      <span>Taxable Value (Subtotal):</span>
                      <strong style={{ color: "#0F172A" }}>{currSym}{taxable.toFixed(2)}</strong>
                    </div>

                    {!isInter ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#0F766E", fontSize: "0.75rem" }}>
                          <span>Central GST (CGST):</span>
                          <strong>+{currSym}{cgst.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#0F766E", fontSize: "0.75rem" }}>
                          <span>State GST (SGST):</span>
                          <strong>+{currSym}{sgst.toFixed(2)}</strong>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#4338CA", fontSize: "0.75rem" }}>
                        <span>Integrated GST (IGST):</span>
                        <strong>+{currSym}{igst.toFixed(2)}</strong>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", color: "#0F172A", fontWeight: 600, borderTop: "1px dashed #E2E8F0", paddingTop: "4px" }}>
                      <span>Total GST:</span>
                      <strong style={{ color: "#0F766E" }}>+{currSym}{totalGst.toFixed(2)}</strong>
                    </div>

                    {roundOff !== 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B", fontSize: "0.75rem" }}>
                        <span>Round-off:</span>
                        <strong style={{ color: roundOff >= 0 ? "#059669" : "#DC2626" }}>
                          {roundOff >= 0 ? `+${currSym}${roundOff.toFixed(2)}` : `-${currSym}${Math.abs(roundOff).toFixed(2)}`}
                        </strong>
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        borderTop: "2px solid #CBD5E1",
                        paddingTop: "8px",
                        fontWeight: 800,
                        fontSize: "1rem",
                        color: "#0F172A",
                      }}
                    >
                      <span>Grand Total:</span>
                      <span style={{ color: "#0D9488" }}>
                        {currSym}{selectedQuotation.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Terms and Notes if present */}
              {selectedQuotation.terms_and_conditions && (
                <div>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                    Terms & Conditions
                  </span>
                  <div style={{ fontSize: "0.75rem", color: "#475569", whiteSpace: "pre-line", lineHeight: 1.5, backgroundColor: "#F8FAFC", padding: "10px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                    {selectedQuotation.terms_and_conditions}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#F8FAFC",
                gap: "10px",
              }}
            >
              {/* Delete button */}
              <button
                type="button"
                onClick={handleDeleteQuotation}
                disabled={isDeleting}
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

              {/* Action buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {selectedQuotation.status.toLowerCase() === "draft" ? (
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(selectedQuotation)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#0F766E",
                      backgroundColor: "#F0FDFA",
                      border: "1px solid #99F6E4",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <Edit3 size={14} />
                    <span>Edit</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenReviseModal(selectedQuotation)}
                    title="Create a new draft revision preserving this quote's history"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#0F766E",
                      backgroundColor: "#F0FDFA",
                      border: "1px solid #99F6E4",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <Copy size={14} />
                    <span>Revise</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setPrintQuotation(selectedQuotation);
                    setIsPrintModalOpen(true);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#475569",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  <Printer size={14} />
                  <span>Print / PDF</span>
                </button>

                {selectedQuotation.status.toLowerCase() !== "sent" && selectedQuotation.status.toLowerCase() !== "accepted" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange("Sent")}
                    disabled={isUpdatingStatus}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#FFFFFF",
                      backgroundColor: "#2563EB",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <Send size={14} />
                    <span>Mark Sent</span>
                  </button>
                )}

                {selectedQuotation.status.toLowerCase() !== "accepted" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange("Accepted")}
                    disabled={isUpdatingStatus}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#FFFFFF",
                      backgroundColor: "#059669",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <CheckSquare size={14} />
                    <span>Accept Quote</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT / PDF VIEW MODAL */}
      {isPrintModalOpen && printQuotation && (() => {
        const printCurr = printQuotation.currency === "INR" || !printQuotation.currency ? "₹" : `${printQuotation.currency} `;
        const compName = printQuotation.company_name || companyProfile?.company_name || "CRM Enterprise Solutions";
        const compAddress = printQuotation.company_address || [
          companyProfile?.address,
          companyProfile?.city,
          companyProfile?.state,
          companyProfile?.pincode,
        ].filter(Boolean).join(", ") || "101 Business Hub, Mumbai, Maharashtra 400001";
        const compGstin = printQuotation.company_gstin || companyProfile?.gst_number || companyProfile?.gstin || "27AAPCU1234F1Z5";
        const compPan = printQuotation.company_pan || companyProfile?.pan_number || companyProfile?.pan || "AAPCU1234F";
        const compEmail = companyProfile?.email || "billing@crmenterprise.com";
        const compPhone = companyProfile?.phone || "+91 98765 43210";
        const isInterState = printQuotation.is_inter_state ?? (
          (printQuotation.customer_state || printQuotation.customer?.state || "").trim().toLowerCase() !==
          (printQuotation.company_state || companyProfile?.state || "Maharashtra").trim().toLowerCase()
        );
        const custState = printQuotation.customer_state || printQuotation.customer?.state || "Maharashtra";
        const custGstin = printQuotation.customer_gstin || printQuotation.customer?.gstin || "Unregistered / Consumer";
        const taxableTotal = printQuotation.taxable_amount ?? (printQuotation.subtotal - (printQuotation.discount_amount || 0));

        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 110,
              backgroundColor: "rgba(15, 23, 42, 0.65)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
            }}
          >
            <div
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "14px",
                width: "100%",
                maxWidth: "860px",
                maxHeight: "94vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              }}
            >
              {/* Action Bar */}
              <div
                style={{
                  padding: "14px 24px",
                  backgroundColor: "#0F172A",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #1E293B",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#0F766E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Receipt size={16} color="#FFFFFF" />
                  </div>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                      GST Tax Quotation: {printQuotation.quotation_number}
                    </span>
                    <span style={{ marginLeft: "8px", fontSize: "0.72rem", backgroundColor: isInterState ? "#4C1D95" : "#064E3B", color: "#E0E7FF", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
                      {isInterState ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      backgroundColor: "#0F766E",
                      color: "#FFFFFF",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    <Printer size={15} />
                    <span>Print / PDF Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(false)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#94A3B8",
                      cursor: "pointer",
                      padding: "6px",
                      borderRadius: "6px",
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Document Sheet */}
              <div
                id="printable-quotation"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "36px 44px",
                  backgroundColor: "#FFFFFF",
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                  color: "#1E293B",
                }}
              >
                {/* Header Section */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0F766E", paddingBottom: "20px", marginBottom: "22px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                    {companyProfile?.has_logo || companyProfile?.logo_url ? (
                      <img
                        src={`${getApiBaseUrl()}/company/logo?t=${Date.now()}`}
                        alt={compName}
                        style={{
                          width: "56px",
                          height: "56px",
                          objectFit: "contain",
                          borderRadius: "10px",
                          border: "1px solid #E2E8F0",
                          backgroundColor: "#F8FAFC",
                          padding: "2px",
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "52px",
                          height: "52px",
                          borderRadius: "10px",
                          backgroundColor: "#0F766E",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "1.375rem",
                        }}
                      >
                        {(compName[0] || "C").toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
                        {compName}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px", maxWidth: "380px", lineHeight: 1.4 }}>
                        {compAddress}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "5px", fontSize: "0.75rem", color: "#334155" }}>
                        <span><strong>GSTIN:</strong> <span style={{ fontFamily: "monospace", color: "#0F766E", fontWeight: 700 }}>{compGstin}</span></span>
                        <span><strong>PAN:</strong> <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{compPan}</span></span>
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#64748B", marginTop: "2px" }}>
                        {[compEmail, compPhone].filter(Boolean).join(" • ")}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-block", backgroundColor: "#0F766E", color: "#FFFFFF", fontWeight: 800, fontSize: "0.875rem", letterSpacing: "0.08em", padding: "4px 14px", borderRadius: "6px", textTransform: "uppercase" }}>
                      TAX QUOTATION
                    </div>
                    <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0F172A", marginTop: "6px" }}>
                      #{printQuotation.quotation_number}
                      {Boolean(printQuotation.version && printQuotation.version > 1) && (
                        <span style={{ marginLeft: "6px", fontSize: "0.7rem", color: "#D97706", backgroundColor: "#FEF3C7", padding: "2px 6px", borderRadius: "4px" }}>
                          Rev. v{printQuotation.version}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px" }}>
                      <strong>Date:</strong> {new Date(printQuotation.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                    {printQuotation.valid_until && (
                      <div style={{ fontSize: "0.75rem", color: "#D97706", fontWeight: 600, marginTop: "2px" }}>
                        <strong>Valid Until:</strong> {new Date(printQuotation.valid_until).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    )}
                    <div style={{ fontSize: "0.72rem", color: isInterState ? "#6D28D9" : "#0F766E", fontWeight: 700, marginTop: "6px", backgroundColor: isInterState ? "#F5F3FF" : "#F0FDFA", border: `1px solid ${isInterState ? "#DDD6FE" : "#CCFBF1"}`, padding: "3px 8px", borderRadius: "4px", display: "inline-block" }}>
                      Place of Supply: {custState}
                    </div>
                  </div>
                </div>

                {/* Bill To & Deal Reference Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                  <div style={{ backgroundColor: "#F8FAFC", padding: "14px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                      Bill To (Buyer / Recipient):
                    </div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0F172A" }}>
                      {printQuotation.customer?.name || "Valued Customer"}
                    </div>
                    {printQuotation.customer?.company && (
                      <div style={{ fontSize: "0.8125rem", color: "#334155", fontWeight: 600, marginTop: "2px" }}>
                        {printQuotation.customer.company}
                      </div>
                    )}
                    <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "4px", lineHeight: 1.4 }}>
                      {[printQuotation.customer?.address, printQuotation.customer?.city, custState, printQuotation.customer?.pincode].filter(Boolean).join(", ") || custState}
                    </div>
                    <div style={{ marginTop: "6px", fontSize: "0.75rem", color: "#0F172A", fontWeight: 600 }}>
                      GSTIN: <span style={{ fontFamily: "monospace", color: custGstin === "Unregistered / Consumer" ? "#64748B" : "#0F766E", fontWeight: 700 }}>{custGstin}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "2px" }}>
                      State: <strong>{custState}</strong> (Place of Supply)
                    </div>
                    {(printQuotation.customer?.email || printQuotation.customer?.phone) && (
                      <div style={{ fontSize: "0.72rem", color: "#64748B", marginTop: "4px" }}>
                        {[printQuotation.customer?.phone, printQuotation.customer?.email].filter(Boolean).join(" • ")}
                      </div>
                    )}
                  </div>

                  <div style={{ backgroundColor: "#F8FAFC", padding: "14px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                      Project & Order Reference:
                    </div>
                    <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0F172A" }}>
                      {printQuotation.deal?.name || "Direct Quotation"}
                    </div>
                    {printQuotation.lead_number && (
                      <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "4px" }}>
                        Lead Reference: <strong>{printQuotation.lead_number}</strong>
                      </div>
                    )}
                    <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "2px" }}>
                      Currency: <strong>{printQuotation.currency || "INR"} ({printCurr.trim()})</strong>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "2px" }}>
                      Supply Type: <strong>{isInterState ? "Inter-State (IGST 100%)" : "Intra-State (CGST 50% + SGST 50%)"}</strong>
                    </div>
                    {printQuotation.deal?.requirement && (
                      <div style={{ fontSize: "0.72rem", color: "#64748B", marginTop: "4px", lineHeight: 1.35 }}>
                        <strong>Scope:</strong> {printQuotation.deal.requirement}
                      </div>
                    )}
                  </div>
                </div>

                {/* Line Items Table with GST Columns */}
                <div style={{ marginBottom: "22px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78125rem" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#0F766E", color: "#FFFFFF", textAlign: "left" }}>
                        <th style={{ padding: "8px 10px", width: "30px", borderTopLeftRadius: "6px" }}>#</th>
                        <th style={{ padding: "8px 10px" }}>Item & Description</th>
                        <th style={{ padding: "8px 10px", textAlign: "center" }}>HSN/SAC</th>
                        <th style={{ padding: "8px 10px", textAlign: "center" }}>Qty</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Rate</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Taxable</th>
                        <th style={{ padding: "8px 10px", textAlign: "center" }}>GST %</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>GST Amt</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", borderTopRightRadius: "6px" }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printQuotation.items?.map((item, i) => {
                        const itemTaxable = item.taxable_amount ?? ((item.quantity * item.unit_price) - (item.discount_amount || 0));
                        const itemGstRate = item.gst_rate ?? (item.tax_percentage || 0);
                        const itemGstAmt = item.gst_amount ?? (item.tax_amount || (itemTaxable * itemGstRate / 100));
                        return (
                          <tr key={item.id || i} style={{ borderBottom: "1px solid #E2E8F0" }}>
                            <td style={{ padding: "8px 10px", color: "#64748B" }}>{i + 1}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <div style={{ fontWeight: 700, color: "#0F172A" }}>{item.product_name}</div>
                              {item.description && <div style={{ fontSize: "0.72rem", color: "#64748B" }}>{item.description}</div>}
                              {item.sku && <div style={{ fontSize: "0.68rem", color: "#94A3B8" }}>SKU: {item.sku}</div>}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "center", color: "#475569", fontFamily: "monospace" }}>
                              {item.hsn_sac || "—"}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600 }}>{item.quantity}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>
                              {printCurr}{item.unit_price?.toFixed(2)}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#0F172A", fontWeight: 600 }}>
                              {printCurr}{itemTaxable.toFixed(2)}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "center", color: "#475569" }}>
                              {itemGstRate}%
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#0F766E", fontWeight: 600 }}>
                              {printCurr}{itemGstAmt.toFixed(2)}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#0F172A" }}>
                              {printCurr}{item.line_total?.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* GST TAX BREAKDOWN MATRIX */}
                <div style={{ marginBottom: "22px" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                    GST Tax Breakdown Summary ({isInterState ? "Inter-State Supply: IGST" : "Intra-State Supply: CGST + SGST"})
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem", backgroundColor: "#F8FAFC", borderRadius: "6px", overflow: "hidden", border: "1px solid #E2E8F0" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#F1F5F9", color: "#475569", textAlign: "left", borderBottom: "1px solid #CBD5E1" }}>
                        <th style={{ padding: "6px 8px" }}>HSN/SAC</th>
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>Taxable Value</th>
                        {!isInterState ? (
                          <>
                            <th style={{ padding: "6px 8px", textAlign: "right" }}>CGST Rate</th>
                            <th style={{ padding: "6px 8px", textAlign: "right" }}>CGST Amt</th>
                            <th style={{ padding: "6px 8px", textAlign: "right" }}>SGST Rate</th>
                            <th style={{ padding: "6px 8px", textAlign: "right" }}>SGST Amt</th>
                          </>
                        ) : (
                          <>
                            <th style={{ padding: "6px 8px", textAlign: "right" }}>IGST Rate</th>
                            <th style={{ padding: "6px 8px", textAlign: "right" }}>IGST Amt</th>
                          </>
                        )}
                        <th style={{ padding: "6px 8px", textAlign: "right" }}>Total Tax Amt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printQuotation.items?.map((item, i) => {
                        const itemTaxable = item.taxable_amount ?? ((item.quantity * item.unit_price) - (item.discount_amount || 0));
                        const gstRate = item.gst_rate ?? (item.tax_percentage || 0);
                        const halfRate = gstRate / 2;
                        const cgstAmt = item.cgst_amount ?? (!isInterState ? itemTaxable * (halfRate / 100) : 0);
                        const sgstAmt = item.sgst_amount ?? (!isInterState ? itemTaxable * (halfRate / 100) : 0);
                        const igstAmt = item.igst_amount ?? (isInterState ? itemTaxable * (gstRate / 100) : 0);
                        const totalTax = !isInterState ? (cgstAmt + sgstAmt) : igstAmt;

                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #E2E8F0" }}>
                            <td style={{ padding: "6px 8px", fontFamily: "monospace", color: "#334155" }}>
                              {item.hsn_sac || "General"}
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right", color: "#0F172A" }}>
                              {printCurr}{itemTaxable.toFixed(2)}
                            </td>
                            {!isInterState ? (
                              <>
                                <td style={{ padding: "6px 8px", textAlign: "right", color: "#64748B" }}>{halfRate}%</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", color: "#0F172A" }}>{printCurr}{cgstAmt.toFixed(2)}</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", color: "#64748B" }}>{halfRate}%</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", color: "#0F172A" }}>{printCurr}{sgstAmt.toFixed(2)}</td>
                              </>
                            ) : (
                              <>
                                <td style={{ padding: "6px 8px", textAlign: "right", color: "#64748B" }}>{gstRate}%</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", color: "#0F172A" }}>{printCurr}{igstAmt.toFixed(2)}</td>
                              </>
                            )}
                            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#0F766E" }}>
                              {printCurr}{totalTax.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Bank Details & Totals Summary */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", gap: "24px" }}>
                  <div style={{ flex: 1, backgroundColor: "#F8FAFC", padding: "14px 16px", borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "0.75rem" }}>
                    <div style={{ fontWeight: 700, color: "#475569", marginBottom: "4px" }}>Bank & Payment Details:</div>
                    <div style={{ color: "#64748B", lineHeight: 1.5 }}>
                      Beneficiary: <strong>{compName}</strong><br />
                      Bank: HDFC Bank Ltd • Branch: Fort, Mumbai<br />
                      IFSC: HDFC0000123 • A/C No: 50200012345678<br />
                      Company PAN: <strong>{compPan}</strong>
                    </div>
                  </div>

                  <div style={{ width: "320px", display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.8125rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                      <span>Taxable Value:</span>
                      <strong style={{ color: "#0F172A" }}>{printCurr}{taxableTotal.toFixed(2)}</strong>
                    </div>
                    {!isInterState ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                          <span>CGST:</span>
                          <strong style={{ color: "#0F172A" }}>+{printCurr}{(printQuotation.cgst_amount || 0).toFixed(2)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                          <span>SGST:</span>
                          <strong style={{ color: "#0F172A" }}>+{printCurr}{(printQuotation.sgst_amount || 0).toFixed(2)}</strong>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                        <span>IGST:</span>
                        <strong style={{ color: "#0F172A" }}>+{printCurr}{(printQuotation.igst_amount || 0).toFixed(2)}</strong>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#0F766E", fontWeight: 600 }}>
                      <span>Total GST:</span>
                      <strong>+{printCurr}{(printQuotation.total_gst_amount || printQuotation.tax_amount || 0).toFixed(2)}</strong>
                    </div>
                    {typeof printQuotation.round_off_amount === "number" && printQuotation.round_off_amount !== 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B", fontSize: "0.75rem" }}>
                        <span>Round Off:</span>
                        <span>{printQuotation.round_off_amount > 0 ? `+${printCurr}` : `-${printCurr}`}{Math.abs(printQuotation.round_off_amount).toFixed(2)}</span>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        borderTop: "2px solid #0F766E",
                        paddingTop: "8px",
                        marginTop: "4px",
                        fontWeight: 800,
                        fontSize: "1.125rem",
                        color: "#0F172A",
                      }}
                    >
                      <span>Grand Total:</span>
                      <span style={{ color: "#0F766E" }}>
                        {printCurr}{printQuotation.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Terms and Conditions */}
                {printQuotation.terms_and_conditions && (
                  <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "14px", marginTop: "16px" }}>
                    <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "4px" }}>
                      Terms & Conditions
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#64748B", whiteSpace: "pre-line", lineHeight: 1.45 }}>
                      {printQuotation.terms_and_conditions}
                    </div>
                  </div>
                )}

                {/* Sign-off Boxes */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "28px", paddingTop: "16px", borderTop: "1px solid #E2E8F0" }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>Customer Acceptance:</div>
                    <div style={{ fontSize: "0.7rem", color: "#94A3B8", marginTop: "2px" }}>Sign & date to confirm quote acceptance</div>
                    <div style={{ height: "42px", borderBottom: "1px dashed #CBD5E1", marginTop: "14px" }}></div>
                    <div style={{ fontSize: "0.7rem", color: "#64748B", marginTop: "4px" }}>Authorized Signature & Seal</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0F172A" }}>For {compName}</div>
                    <div style={{ height: "42px", borderBottom: "1px dashed #CBD5E1", marginTop: "14px" }}></div>
                    <div style={{ fontSize: "0.7rem", color: "#64748B", marginTop: "4px" }}>Authorized Signatory</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading quotations...</div>}>
      <QuotationsContent />
    </Suspense>
  );
}
