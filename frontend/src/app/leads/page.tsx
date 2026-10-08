"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Edit3,
  Eye,
  LogOut,
  Globe,
  Share2,
  Table as TableIcon,
  PlusCircle,
  X,
  CheckCircle,
  AlertCircle,
  Copy,
  Terminal,
  Send,
  MapPin,
  Phone,
  Mail,
  FileText,
  Clock,
  Layers,
  ShieldAlert,
  Key,
  Check,
  Tag,
  Calendar,
  UserCheck,
  Activity,
  MessageSquare,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Info,
  Download,
  Upload,
  Settings,
  Flame,
  AlertTriangle,
  RotateCcw,
  Sliders,
  ExternalLink,
  ChevronLeft,
  Briefcase,
  DollarSign,
  Building,
  Sparkles,
  PhoneCall,
  MessageCircle,
} from "lucide-react";
import {
  leadsApi,
  authApi,
  getToken,
  getStoredUser,
  getApiBaseUrl,
  copyTextToClipboard,
  Lead,
  LeadUserSummary,
  LeadNote,
  LeadActivity,
  User,
  CustomFieldDefinition,
  LeadStatusItem,
  LeadSourceItem,
  TagItem,
  DuplicateSettings,
  FollowUpItem,
  Pipeline,
  pipelinesApi,
} from "@/lib/api";
import Sidebar, { SidebarTab } from "@/components/Sidebar";
import ProfileView from "@/components/ProfileView";
import ApiKeysPage from "@/app/api-keys/page";
import ApiDocumentationPage from "@/app/api-docs/page";
import FollowUpsPage from "@/app/follow-ups/page";
import DealsPage from "@/app/deals/page";

type ViewType =
  | "all"
  | "my_leads"
  | "unassigned"
  | "hot_leads"
  | "today_followups"
  | "overdue_followups"
  | "trash";

export default function UniversalLeadsPage() {
  const router = useRouter();

  // Authentication & Current User
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [crmUsers, setCrmUsers] = useState<LeadUserSummary[]>([]);

  // Metadata / Workspace Configuration State
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusItem[]>([]);
  const [sources, setSources] = useState<LeadSourceItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [duplicateSettings, setDuplicateSettings] = useState<DuplicateSettings>({
    check_phone: true,
    check_email: true,
    action: "prevent",
  });

  // Leads Data & Pagination State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalLeads, setTotalLeads] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({
    all: 0,
    my_leads: 0,
    unassigned: 0,
    hot_leads: 0,
    today_followups: 0,
    overdue_followups: 0,
    trash: 0,
  });

  // Filter & Search State
  const [currentView, setCurrentView] = useState<ViewType>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [selectedFollowUpFilter, setSelectedFollowUpFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Multi-Selection State for Bulk Actions
  const [selectedLeadNumbers, setSelectedLeadNumbers] = useState<Set<string>>(new Set());

  // Configurable Column Visibility
  const [isColumnChooserOpen, setIsColumnChooserOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    phone: true,
    email: true,
    status: true,
    score: true,
    owner: true,
    source: true,
    tags: true,
    follow_up: true,
    lead_age: true,
    created_at: false,
    city: false,
  });

  // UI Toast & Error Modals
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
    actionText?: string;
    onAction?: () => void;
  } | null>(null);
  const [duplicateErrorPopup, setDuplicateErrorPopup] = useState<string | null>(null);

  // Modals & Drawers State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<"overview" | "custom_fields" | "notes" | "timeline" | "followups">("overview");
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"update_status" | "assign_owner" | "add_tags" | "soft_delete" | "restore" | "delete_permanent">("update_status");
  const [bulkStatusValue, setBulkStatusValue] = useState("Qualified");
  const [bulkOwnerValue, setBulkOwnerValue] = useState<number>(0);
  const [bulkTagsValue, setBulkTagsValue] = useState("");

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<"custom_fields" | "statuses" | "sources" | "tags" | "duplicates">("custom_fields");

  // Follow-up scheduling modal
  const [isScheduleFollowUpOpen, setIsScheduleFollowUpOpen] = useState(false);
  const [followUpFormData, setFollowUpFormData] = useState({
    title: "Follow-up Call",
    follow_up_type: "Call",
    due_date: "",
    notes: "",
  });

  // Active Lead for Details / Edit
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [activeNotes, setActiveNotes] = useState<LeadNote[]>([]);
  const [activeActivities, setActiveActivities] = useState<LeadActivity[]>([]);
  const [activeFollowUps, setActiveFollowUps] = useState<FollowUpItem[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [isNotesLoading, setIsNotesLoading] = useState(false);

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    number: "",
    name: "",
    email: "",
    phone: "",
    requirement: "",
    source: "Website",
    city: "",
    status: "New",
    owner_id: "" as string,
    score: 50,
    tagsText: "",
    follow_up_date: "",
    follow_up_type: "Call",
    follow_up_notes: "",
    lost_reason: "",
    customFieldsValues: {} as Record<string, any>,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin New Field Form
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

  // CSV Import State
  const [importCsvText, setImportCsvText] = useState("");
  const [importStrategy, setImportStrategy] = useState<"skip" | "update" | "error">("skip");
  const [importResult, setImportResult] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Single-page layout active tab state
  const [activeTab, setActiveTab] = useState<SidebarTab>("leads");
  const [keyCount, setKeyCount] = useState<number | undefined>(undefined);
  const [followUpsCount, setFollowUpsCount] = useState<number | undefined>(undefined);
  const [dealsCount, setDealsCount] = useState<number | undefined>(undefined);
  const [productsCount, setProductsCount] = useState<number | undefined>(undefined);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Convert Lead to Deal Modal State
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [convDealName, setConvDealName] = useState("");
  const [convDealValue, setConvDealValue] = useState<number | "">(10000);
  const [convPipelineId, setConvPipelineId] = useState<number | "">("");
  const [convStageId, setConvStageId] = useState<number | "">("");
  const [convExpectedCloseDate, setConvExpectedCloseDate] = useState("");
  const [convPriority, setConvPriority] = useState("Medium");
  const [convCustomerName, setConvCustomerName] = useState("");
  const [convCustomerCompany, setConvCustomerCompany] = useState("");
  const [convCustomerEmail, setConvCustomerEmail] = useState("");
  const [convCustomerPhone, setConvCustomerPhone] = useState("");
  const [convPipelines, setConvPipelines] = useState<Pipeline[]>([]);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab") as SidebarTab | null;
      if (tabParam === "products") {
        router.push("/products");
        return;
      }
      if (tabParam === "deals") {
        router.push("/deals");
        return;
      }
      if (tabParam && ["leads", "follow-ups", "api-keys", "api-docs", "profile"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
      const savedCollapse = localStorage.getItem("crm_sidebar_collapsed");
      if (savedCollapse !== null) {
        setIsSidebarCollapsed(savedCollapse === "true");
      }
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

  const handleSelectTab = (tab: SidebarTab) => {
    if (tab === "products") {
      router.push("/products");
      return;
    }
    if (tab === "deals") {
      router.push("/deals");
      return;
    }
    if (tab === "quotations") {
      router.push("/quotations");
      return;
    }
    if (tab === "orders") {
      router.push("/orders");
      return;
    }
    if (tab === "company") {
      router.push("/company");
      return;
    }
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "leads") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.pushState(null, "", url.toString());
    }
  };

  const handleLogout = () => {
    authApi.logout();
    router.push("/");
  };

  // Debounced search timeout
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Toast Helper
  const showToast = (
    type: "success" | "error",
    text: string,
    actionText?: string,
    onAction?: () => void
  ) => {
    setToastMessage({ type, text, actionText, onAction });
    setTimeout(() => setToastMessage(null), actionText ? 8000 : 4000);
  };

  // 1. Initial Load: Check auth & fetch metadata
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    const stored = getStoredUser();
    if (stored) setUser(stored);

    authApi
      .getMe()
      .then((u) => {
        setUser(u);
        setIsAuthChecking(false);
      })
      .catch(() => {
        router.push("/login");
      });

    // Fetch workspace team & configs
    loadMetadata();
  }, [router]);

  const loadMetadata = async () => {
    try {
      const [usersData, cfsData, statusesData, sourcesData, tagsData, dupData] = await Promise.all([
        authApi.getUsers().catch(() => []),
        leadsApi.getCustomFields().catch(() => []),
        leadsApi.getStatuses().catch(() => []),
        leadsApi.getSources().catch(() => []),
        leadsApi.getTags().catch(() => []),
        leadsApi.getDuplicateSettings().catch(() => ({ check_phone: true, check_email: true, action: "prevent" as const })),
      ]);

      setCrmUsers(usersData);
      setCustomFields(cfsData);
      setStatuses(statusesData);
      setSources(sourcesData);
      setTags(tagsData);
      setDuplicateSettings(dupData);
    } catch (err) {
      console.error("Error loading workspace metadata:", err);
    }
  };

  // 2. Fetch Leads with all query params
  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const res = await leadsApi.getAll({
        search: searchTerm.trim() || undefined,
        source: selectedSource !== "all" ? selectedSource : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        owner_id: selectedOwnerId !== "all" ? Number(selectedOwnerId) : undefined,
        tag: selectedTag.trim() || undefined,
        follow_up_status: selectedFollowUpFilter !== "all" ? selectedFollowUpFilter : undefined,
        view: currentView,
        include_deleted: currentView === "trash",
        sort_by: sortField,
        sort_order: sortOrder,
        page,
        limit,
      });

      setLeads(res.items);
      setTotalLeads(res.total);
      setTotalPages(res.pages);
      if (res.view_counts) {
        setViewCounts(res.view_counts);
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to load leads");
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger fetch when filters or view change
  useEffect(() => {
    if (!isAuthChecking) {
      fetchLeads();
    }
  }, [
    isAuthChecking,
    currentView,
    selectedSource,
    selectedStatus,
    selectedOwnerId,
    selectedTag,
    selectedFollowUpFilter,
    sortField,
    sortOrder,
    page,
    limit,
  ]);

  // Handle Search input debounce
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchLeads();
    }, 350);
  };

  // Selection Checkboxes
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeadNumbers(new Set(leads.map((l) => l.number)));
    } else {
      setSelectedLeadNumbers(new Set());
    }
  };

  const handleToggleSelectOne = (number: string) => {
    const updated = new Set(selectedLeadNumbers);
    if (updated.has(number)) {
      updated.delete(number);
    } else {
      updated.add(number);
    }
    setSelectedLeadNumbers(updated);
  };

  // Open Details Drawer
  const handleOpenDetails = async (lead: Lead, tab: "overview" | "custom_fields" | "notes" | "timeline" | "followups" = "overview") => {
    setActiveLead(lead);
    setDetailsTab(tab);
    setIsDetailsDrawerOpen(true);
    setIsNotesLoading(true);

    try {
      const [fullLead, notes, activities, followUps] = await Promise.all([
        leadsApi.getOne(lead.number),
        leadsApi.getNotes(lead.number).catch(() => []),
        leadsApi.getActivities(lead.number).catch(() => []),
        leadsApi.getFollowUps(lead.number).catch(() => []),
      ]);
      setActiveLead(fullLead);
      setActiveNotes(notes);
      setActiveActivities(activities);
      setActiveFollowUps(followUps);
    } catch (err) {
      console.error("Error loading lead details:", err);
    } finally {
      setIsNotesLoading(false);
    }
  };

  // Add Note Handler
  const handleAddNote = async () => {
    if (!activeLead || !newNoteText.trim()) return;
    try {
      const added = await leadsApi.createNote(activeLead.number, newNoteText.trim());
      setActiveNotes([added, ...activeNotes]);
      setNewNoteText("");
      showToast("success", "Note saved");
      // Refresh activities
      const acts = await leadsApi.getActivities(activeLead.number);
      setActiveActivities(acts);
    } catch (err: any) {
      showToast("error", err.message || "Failed to add note");
    }
  };

  // Open Create Lead Modal
  const handleOpenAddModal = () => {
    setFormData({
      number: "",
      name: "",
      email: "",
      phone: "",
      requirement: "",
      source: "Website",
      city: "",
      status: "New",
      owner_id: user?.id ? String(user.id) : "",
      score: 50,
      tagsText: "",
      follow_up_date: "",
      follow_up_type: "Call",
      follow_up_notes: "",
      lost_reason: "",
      customFieldsValues: {},
    });
    setIsAddModalOpen(true);
  };

  // Submit Lead Create
  const handleCreateLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const tagsArray = formData.tagsText
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      let followUpDatePayload: string | null | undefined = undefined;
      if (formData.follow_up_date && formData.follow_up_date.trim()) {
        const parsed = new Date(formData.follow_up_date);
        followUpDatePayload = !isNaN(parsed.getTime()) ? parsed.toISOString() : formData.follow_up_date.trim();
      }

      const created = await leadsApi.create({
        number: formData.number.trim(),
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || formData.number.trim(),
        requirement: formData.requirement.trim(),
        source: formData.source,
        city: formData.city.trim(),
        status: formData.status,
        owner_id: formData.owner_id ? Number(formData.owner_id) : null,
        score: formData.score,
        tags: tagsArray,
        follow_up_date: followUpDatePayload,
        follow_up_type: formData.follow_up_type,
        follow_up_notes: formData.follow_up_notes,
        custom_fields: formData.customFieldsValues,
      });

      if (formData.status.toLowerCase() === "qualified") {
        showToast(
          "success",
          `Lead #${created.number} marked Qualified! Deal automatically created in New Opportunity.`,
          "View Deal in Pipeline",
          () => router.push("/deals")
        );
      } else {
        showToast("success", `Lead #${created.number} created successfully`);
      }
      setIsAddModalOpen(false);
      fetchLeads();
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes("already exists")) {
        setDuplicateErrorPopup(err.message);
      } else {
        showToast("error", err.message || "Failed to create lead");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (lead: Lead) => {
    setActiveLead(lead);
    setFormData({
      number: lead.number,
      name: lead.name,
      email: lead.email,
      phone: lead.phone || lead.number,
      requirement: lead.requirement,
      source: lead.source,
      city: lead.city,
      status: lead.status,
      owner_id: lead.owner_id ? String(lead.owner_id) : "",
      score: lead.score,
      tagsText: (lead.tags || []).join(", "),
      follow_up_date: lead.follow_up_date || "",
      follow_up_type: lead.follow_up_type || "Call",
      follow_up_notes: lead.follow_up_notes || "",
      lost_reason: lead.lost_reason || "",
      customFieldsValues: { ...(lead.custom_fields || {}) },
    });
    setIsEditModalOpen(true);
  };

  // Open Convert Lead Modal
  const openConvertLeadModal = async (lead: Lead) => {
    setLeadToConvert(lead);
    setConvDealName(`${lead.name} - Deal`);
    setConvCustomerName(lead.name);
    setConvCustomerEmail(lead.email);
    setConvCustomerPhone(lead.phone || "");
    setConvCustomerCompany("");
    setConvDealValue(10000);
    setConvPriority("Medium");
    setConvExpectedCloseDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));

    try {
      const pipes = await pipelinesApi.list();
      setConvPipelines(pipes);
      if (pipes.length > 0) {
        const def = pipes.find((p) => p.is_default) || pipes[0];
        setConvPipelineId(def.id);
        if (def.stages && def.stages.length > 0) {
          setConvStageId(def.stages[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading pipelines for conversion:", err);
    }

    setIsConvertModalOpen(true);
  };

  // Submit Lead Conversion
  const handleExecuteLeadConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadToConvert || !convDealName.trim() || !convPipelineId || !convStageId) {
      showToast("error", "Please fill all required conversion fields");
      return;
    }

    setIsConverting(true);
    try {
      const res = await leadsApi.convertToDeal(leadToConvert.number, {
        deal_name: convDealName.trim(),
        deal_value: Number(convDealValue) || 0,
        pipeline_id: Number(convPipelineId),
        stage_id: Number(convStageId),
        priority: convPriority,
        expected_close_date: convExpectedCloseDate ? new Date(convExpectedCloseDate).toISOString() : undefined,
        owner_id: leadToConvert.owner_id || undefined,
        requirement: leadToConvert.requirement,
        customer_name: convCustomerName.trim() || leadToConvert.name,
        customer_email: convCustomerEmail.trim() || leadToConvert.email,
        customer_phone: convCustomerPhone.trim() || undefined,
        customer_company: convCustomerCompany.trim() || undefined,
      });

      // Update local lead status
      setLeads((prev) =>
        prev.map((l) => (l.number === leadToConvert.number ? { ...l, status: "Converted" } : l))
      );
      if (activeLead && activeLead.number === leadToConvert.number) {
        setActiveLead({ ...activeLead, status: "Converted" });
      }

      setIsConvertModalOpen(false);
      showToast("success", `🎉 Converted to Deal "${res.deal.deal_number}" and Customer "${res.customer.name}"!`);
    } catch (err: any) {
      showToast("error", err.message || "Failed to convert lead");
    } finally {
      setIsConverting(false);
    }
  };

  // Submit Lead Edit
  const handleEditLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead) return;
    setIsSubmitting(true);
    try {
      const tagsArray = formData.tagsText
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      let followUpDatePayload: string | null | undefined = undefined;
      if (formData.follow_up_date && formData.follow_up_date.trim()) {
        const parsed = new Date(formData.follow_up_date);
        followUpDatePayload = !isNaN(parsed.getTime()) ? parsed.toISOString() : formData.follow_up_date.trim();
      } else if (activeLead.follow_up_date && !formData.follow_up_date) {
        followUpDatePayload = null;
      }

      const updated = await leadsApi.update(activeLead.number, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        requirement: formData.requirement.trim(),
        source: formData.source,
        city: formData.city.trim(),
        status: formData.status,
        owner_id: formData.owner_id ? Number(formData.owner_id) : null,
        score: formData.score,
        lost_reason: formData.status.toLowerCase() === "lost" ? formData.lost_reason : undefined,
        tags: tagsArray,
        follow_up_date: followUpDatePayload,
        follow_up_type: formData.follow_up_type,
        follow_up_notes: formData.follow_up_notes,
        custom_fields: formData.customFieldsValues,
      });

      if (formData.status.toLowerCase() === "qualified") {
        showToast(
          "success",
          "Lead marked Qualified! Deal automatically created in New Opportunity.",
          "View Deal in Pipeline",
          () => router.push("/deals")
        );
      } else {
        showToast("success", "Lead updated successfully");
      }
      setIsEditModalOpen(false);
      // Immediately reflect updated lead in the table state and active lead drawer
      setLeads((prev) =>
        prev.map((l) => (l.number === updated.number ? updated : l))
      );
      if (activeLead.number === updated.number) {
        setActiveLead(updated);
      }
      fetchLeads();
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes("already exists")) {
        setDuplicateErrorPopup(err.message);
      } else {
        showToast("error", err.message || "Failed to update lead");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Soft Delete / Permanent Delete
  const handleDeleteLead = async (lead: Lead, permanent: boolean = false) => {
    const confirmMsg = permanent
      ? `Permanently delete lead ${lead.name} (${lead.number})? This cannot be undone.`
      : `Move lead ${lead.name} to trash?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await leadsApi.delete(lead.number, permanent);
      showToast("success", permanent ? "Lead deleted permanently" : "Lead moved to trash");
      if (isDetailsDrawerOpen) setIsDetailsDrawerOpen(false);
      fetchLeads();
    } catch (err: any) {
      showToast("error", err.message || "Delete failed");
    }
  };

  // Restore Lead from Trash
  const handleRestoreLead = async (lead: Lead) => {
    try {
      await leadsApi.restore(lead.number);
      showToast("success", `Lead ${lead.name} restored from trash`);
      if (isDetailsDrawerOpen) setIsDetailsDrawerOpen(false);
      fetchLeads();
    } catch (err: any) {
      showToast("error", err.message || "Restore failed");
    }
  };

  // Bulk Action Execution
  const handleExecuteBulkAction = async () => {
    if (selectedLeadNumbers.size === 0) return;
    setIsSubmitting(true);
    try {
      const numbersList = Array.from(selectedLeadNumbers);
      const payload: any = {
        lead_numbers: numbersList,
        action: bulkActionType,
      };

      if (bulkActionType === "update_status") {
        payload.status = bulkStatusValue;
      } else if (bulkActionType === "assign_owner") {
        payload.owner_id = bulkOwnerValue ? Number(bulkOwnerValue) : null;
      } else if (bulkActionType === "add_tags") {
        payload.tags = bulkTagsValue.split(",").map((t) => t.trim()).filter((t) => t);
      }

      const res = await leadsApi.bulkAction(payload);
      if (bulkActionType === "update_status" && bulkStatusValue.toLowerCase() === "qualified") {
        showToast(
          "success",
          `Updated ${numbersList.length} leads to Qualified! Deals automatically created in New Opportunity.`,
          "View Deals in Pipeline",
          () => router.push("/deals")
        );
      } else {
        showToast("success", res.message);
      }
      setIsBulkModalOpen(false);
      setSelectedLeadNumbers(new Set());
      fetchLeads();
    } catch (err: any) {
      showToast("error", err.message || "Bulk action failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Schedule Next Follow-up Handler
  const handleScheduleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead) return;
    try {
      const createdFup = await leadsApi.createFollowUp(activeLead.number, {
        title: followUpFormData.title,
        follow_up_type: followUpFormData.follow_up_type,
        due_date: followUpFormData.due_date,
        notes: followUpFormData.notes,
      });
      setActiveFollowUps([createdFup, ...activeFollowUps]);
      setIsScheduleFollowUpOpen(false);
      showToast("success", "Follow-up scheduled");
      // Refresh lead details
      const ref = await leadsApi.getOne(activeLead.number);
      setActiveLead(ref);
      fetchLeads();
    } catch (err: any) {
      showToast("error", err.message || "Failed to schedule follow-up");
    }
  };

  // Mark Follow-up Completed
  const handleToggleFollowUpCompleted = async (fup: FollowUpItem) => {
    if (!activeLead) return;
    try {
      const updated = await leadsApi.updateFollowUp(activeLead.number, fup.id, {
        completed: !fup.completed,
      });
      setActiveFollowUps(activeFollowUps.map((item) => (item.id === fup.id ? updated : item)));
      showToast("success", updated.completed ? "Marked as completed" : "Reopened");
      fetchLeads();
    } catch (err: any) {
      showToast("error", err.message || "Failed to update follow-up");
    }
  };

  // Execute CSV Import
  const handleExecuteImport = async () => {
    if (!importCsvText.trim()) return;
    setIsSubmitting(true);
    setImportResult(null);
    try {
      // Simple client-side CSV parse to objects
      const lines = importCsvText.trim().split("\n");
      if (lines.length < 2) throw new Error("CSV must contain at least a header row and one data row.");

      const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
      const parsedRows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const vals = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
        const rowObj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          if (vals[idx] !== undefined) rowObj[h] = vals[idx];
        });
        parsedRows.push(rowObj);
      }

      const res = await leadsApi.importLeads({
        leads: parsedRows,
        duplicate_strategy: importStrategy,
      });

      setImportResult(res);
      showToast("success", `Import completed: ${res.imported_count} imported, ${res.skipped_count} skipped.`);
      fetchLeads();
    } catch (err: any) {
      showToast("error", err.message || "Import failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export Leads to CSV (Authenticated)
  const handleExportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await leadsApi.exportLeads({
        search: searchTerm,
        source: selectedSource,
        status: selectedStatus,
        owner_id: selectedOwnerId,
        tag: selectedTag,
        follow_up_status: selectedFollowUpFilter,
        view: currentView,
      });
      showToast("success", "Leads exported successfully!");
    } catch (err: any) {
      showToast("error", err?.message || "Failed to export leads.");
    } finally {
      setIsExporting(false);
    }
  };

  // Admin: Create Custom Field Definition
  const handleCreateCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const opts = newCustomField.options
        ? newCustomField.options.split(",").map((o) => o.trim()).filter((o) => o)
        : [];
      await leadsApi.createCustomField({
        field_key: newCustomField.field_key.trim(),
        field_label: newCustomField.field_label.trim(),
        field_type: newCustomField.field_type,
        options: opts,
        required: newCustomField.required,
        section: newCustomField.section,
      });
      showToast("success", "Custom field added");
      setNewCustomField({
        field_key: "",
        field_label: "",
        field_type: "Text",
        options: "",
        required: false,
        section: "Custom Details",
      });
      loadMetadata();
    } catch (err: any) {
      showToast("error", err.message || "Failed to add field");
    }
  };

  // Admin: Delete Custom Field
  const handleDeleteCustomField = async (id: number) => {
    if (!window.confirm("Delete this custom field and its recorded values?")) return;
    try {
      await leadsApi.deleteCustomField(id);
      showToast("success", "Custom field deleted");
      loadMetadata();
    } catch (err: any) {
      showToast("error", err.message || "Delete failed");
    }
  };

  // Admin: Add Lead Status
  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusInput.name.trim()) return;
    try {
      await leadsApi.createStatus({
        name: newStatusInput.name.trim(),
        color: newStatusInput.color,
      });
      showToast("success", "Status added");
      setNewStatusInput({ name: "", color: "#0D9488" });
      loadMetadata();
    } catch (err: any) {
      showToast("error", err.message || "Failed to add status");
    }
  };

  // Admin: Add Source
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceInput.trim()) return;
    try {
      await leadsApi.createSource({ name: newSourceInput.trim() });
      showToast("success", "Source added");
      setNewSourceInput("");
      loadMetadata();
    } catch (err: any) {
      showToast("error", err.message || "Failed to add source");
    }
  };

  // Admin: Add Tag
  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagInput.name.trim()) return;
    try {
      await leadsApi.createTag({
        name: newTagInput.name.trim(),
        color: newTagInput.color,
      });
      showToast("success", "Tag added");
      setNewTagInput({ name: "", color: "#6366F1" });
      loadMetadata();
    } catch (err: any) {
      showToast("error", err.message || "Failed to add tag");
    }
  };

  // Admin: Update Duplicate Settings
  const handleSaveDuplicateSettings = async () => {
    try {
      await leadsApi.updateDuplicateSettings(duplicateSettings);
      showToast("success", "Duplicate check rules saved");
    } catch (err: any) {
      showToast("error", err.message || "Failed to save settings");
    }
  };

  // Helper: Status badge color
  const getStatusColor = (statusName: string) => {
    const matched = statuses.find((s) => s.name.toLowerCase() === statusName.toLowerCase());
    return matched ? matched.color : "#64748B";
  };

  // Helper: Score Badge styling
  const renderScoreBadge = (score: number) => {
    let color = "#64748B";
    let bg = "#F1F5F9";
    let icon = "❄️";
    let label = "Cold";

    if (score >= 70) {
      color = "#DC2626";
      bg = "#FEF2F2";
      icon = "🔥";
      label = "Hot";
    } else if (score >= 40) {
      color = "#D97706";
      bg = "#FFFBEB";
      icon = "⚡";
      label = "Warm";
    }

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          padding: "0.15rem 0.5rem",
          borderRadius: "999px",
          fontSize: "0.6875rem",
          fontWeight: 700,
          backgroundColor: bg,
          color,
          border: `1px solid ${color}33`,
        }}
        title={`Lead Score: ${score}/100`}
      >
        <span>{icon}</span> {score}
      </span>
    );
  };

  if (isAuthChecking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <RefreshCw size={28} className="animate-spin" color="#0D9488" />
          <span style={{ fontSize: "0.875rem", color: "#64748B", fontWeight: 600 }}>Loading Universal CRM...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", color: "#0F172A", display: "flex", width: "100%" }}>
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
            gap: "0.75rem",
            padding: "0.75rem 1.25rem",
            borderRadius: "8px",
            backgroundColor: toastMessage.type === "success" ? "#0F766E" : "#B91C1C",
            color: "#FFFFFF",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            fontSize: "0.875rem",
            fontWeight: 600,
            animation: "slideIn 0.2s ease-out",
          }}
        >
          {toastMessage.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
          {toastMessage.actionText && toastMessage.onAction && (
            <button
              onClick={() => {
                toastMessage.onAction?.();
                setToastMessage(null);
              }}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.4)",
                color: "#FFFFFF",
                borderRadius: "4px",
                padding: "0.25rem 0.6rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                marginLeft: "0.5rem",
              }}
            >
              {toastMessage.actionText} →
            </button>
          )}
        </div>
      )}

      {/* Duplicate Error Modal */}
      {duplicateErrorPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "1.75rem",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              border: "1px solid #FEE2E2",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", color: "#DC2626" }}>
              <ShieldAlert size={28} />
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#991B1B" }}>Duplicate Detected</h3>
            </div>
            <p style={{ fontSize: "0.875rem", color: "#475569", lineHeight: 1.6, margin: "0 0 1.5rem 0" }}>
              {duplicateErrorPopup}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setDuplicateErrorPopup(null)}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "6px",
                  backgroundColor: "#0D9488",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Acknowledge & Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Unified Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        keyCount={keyCount}
        followUpsCount={followUpsCount}
        dealsCount={dealsCount}
        productsCount={productsCount}
        leadsCount={leads.length}
        user={user}
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        onOpenAdminSettings={() => setIsAdminSettingsOpen(true)}
      />

      {/* Main Screen Content Wrapper */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, width: "100%" }}>
        {/* Streamlined Topbar */}
        <header
          style={{
            borderBottom: "1px solid #E2E8F0",
            backgroundColor: "#FFFFFF",
            position: "sticky",
            top: 0,
            zIndex: 40,
            padding: "0.75rem 1.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
              {activeTab === "leads" && "Leads Management"}
              {activeTab === "deals" && "Deals & Sales Pipeline"}
              {activeTab === "follow-ups" && "Scheduled Follow-ups"}
              {activeTab === "api-keys" && "API Keys & Integrations"}
              {activeTab === "api-docs" && "Interactive API Documentation"}
              {activeTab === "profile" && "Account & Profile"}
            </h1>
            <span
              style={{
                padding: "0.125rem 0.5rem",
                borderRadius: "999px",
                fontSize: "0.6875rem",
                fontWeight: 700,
                backgroundColor: "#CCFBF1",
                color: "#0F766E",
              }}
            >
              Universal CRM
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={() => handleSelectTab("profile")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.25rem 0.5rem",
                borderRadius: "6px",
                border: "1px solid #E2E8F0",
                backgroundColor: "#F8FAFC",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: "#E0E7FF",
                  color: "#4338CA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                }}
              >
                {user?.name ? user.name[0].toUpperCase() : "U"}
              </div>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#334155" }}>
                {user?.name || "User"}
              </span>
            </button>
          </div>
        </header>

        {/* Tab 1: Leads View (Keep-Alive) */}
        <div style={{ display: activeTab === "leads" ? "block" : "none", width: "100%" }}>

      {/* Main Container */}
      <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "1.5rem", width: "100%", flex: 1, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Top Actions Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.02em" }}>
              Universal Lead Management
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#64748B", margin: "0.25rem 0 0 0" }}>
              Industry-flexible lead tracking with custom fields, duplicate control, follow-ups, and automated timeline.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
            <button
              onClick={() => setIsImportModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 0.875rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <Upload size={15} /> Import CSV
            </button>

            <button
              onClick={handleExportCsv}
              disabled={isExporting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 0.875rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: isExporting ? "#94A3B8" : "#334155",
                cursor: isExporting ? "not-allowed" : "pointer",
                opacity: isExporting ? 0.7 : 1,
              }}
            >
              <Download size={15} /> {isExporting ? "Exporting..." : "Export CSV"}
            </button>

            <button
              onClick={handleOpenAddModal}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#0D9488",
                color: "#FFFFFF",
                fontSize: "0.8125rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(13, 148, 136, 0.2)",
              }}
            >
              <Plus size={16} /> Create Lead
            </button>
          </div>
        </div>

        {/* Saved Views Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
          {[
            { id: "all", label: "All Leads", count: viewCounts.all },
            { id: "my_leads", label: "My Leads", count: viewCounts.my_leads },
            { id: "unassigned", label: "Unassigned", count: viewCounts.unassigned },
            { id: "hot_leads", label: "Hot Leads 🔥", count: viewCounts.hot_leads },
            { id: "today_followups", label: "Today's Follow-ups", count: viewCounts.today_followups },
            { id: "overdue_followups", label: "Overdue Follow-ups ⚠️", count: viewCounts.overdue_followups },
            { id: "trash", label: "Trash / Deleted", count: viewCounts.trash },
          ].map((viewItem) => {
            const isActive = currentView === viewItem.id;
            return (
              <button
                key={viewItem.id}
                onClick={() => {
                  setCurrentView(viewItem.id as ViewType);
                  setPage(1);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.4rem 0.875rem",
                  borderRadius: "999px",
                  fontSize: "0.8125rem",
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? "1px solid #0D9488" : "1px solid #E2E8F0",
                  backgroundColor: isActive ? "#0D9488" : "#FFFFFF",
                  color: isActive ? "#FFFFFF" : "#475569",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{viewItem.label}</span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    padding: "0.1rem 0.4rem",
                    borderRadius: "999px",
                    backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "#F1F5F9",
                    color: isActive ? "#FFFFFF" : "#64748B",
                  }}
                >
                  {viewItem.count || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "10px",
            border: "1px solid #E2E8F0",
            padding: "0.875rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          {/* Search Box */}
          <div style={{ position: "relative", minWidth: "280px", flex: "1 1 280px" }}>
            <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input
              type="text"
              placeholder="Search by name, phone, email, custom fields..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: "100%",
                padding: "0.45rem 0.5rem 0.45rem 2.1rem",
                fontSize: "0.8125rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                outline: "none",
              }}
            />
          </div>

          {/* Filter Dropdowns */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "0.45rem 0.625rem",
                fontSize: "0.8125rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                color: "#334155",
                fontWeight: 500,
              }}
            >
              <option value="all">Status: All</option>
              {statuses.map((st) => (
                <option key={st.id} value={st.name}>
                  Status: {st.name}
                </option>
              ))}
            </select>

            {/* Source Filter */}
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "0.45rem 0.625rem",
                fontSize: "0.8125rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                color: "#334155",
                fontWeight: 500,
              }}
            >
              <option value="all">Source: All</option>
              {sources.map((src) => (
                <option key={src.id} value={src.name}>
                  Source: {src.name}
                </option>
              ))}
            </select>

            {/* Owner Filter */}
            <select
              value={selectedOwnerId}
              onChange={(e) => {
                setSelectedOwnerId(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "0.45rem 0.625rem",
                fontSize: "0.8125rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                color: "#334155",
                fontWeight: 500,
              }}
            >
              <option value="all">Owner: All</option>
              <option value="0">Unassigned</option>
              {crmUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            {/* Follow-up State Filter */}
            <select
              value={selectedFollowUpFilter}
              onChange={(e) => {
                setSelectedFollowUpFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "0.45rem 0.625rem",
                fontSize: "0.8125rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                color: "#334155",
                fontWeight: 500,
              }}
            >
              <option value="all">Follow-up: All</option>
              <option value="overdue">Overdue ⚠️</option>
              <option value="due_today">Due Today</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>

            {/* Column Chooser Button */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setIsColumnChooserOpen(!isColumnChooserOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#FFFFFF",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                <Sliders size={14} /> Columns
              </button>

              {isColumnChooserOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    marginTop: "0.375rem",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                    padding: "0.75rem",
                    width: "200px",
                    zIndex: 50,
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                    Toggle Columns
                  </div>
                  {Object.keys(visibleColumns).map((colKey) => (
                    <label key={colKey} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", padding: "0.25rem 0", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={visibleColumns[colKey]}
                        onChange={(e) => setVisibleColumns({ ...visibleColumns, [colKey]: e.target.checked })}
                      />
                      <span style={{ textTransform: "capitalize" }}>{colKey.replace("_", " ")}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchLeads()}
              title="Refresh leads list"
              style={{
                padding: "0.45rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                backgroundColor: "#FFFFFF",
                cursor: "pointer",
                color: "#64748B",
              }}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Bulk Action Bar (Visible when >= 1 lead selected) */}
        {selectedLeadNumbers.size > 0 && (
          <div
            style={{
              backgroundColor: "#0F172A",
              color: "#FFFFFF",
              borderRadius: "8px",
              padding: "0.75rem 1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              animation: "slideDown 0.15s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <CheckSquare size={18} color="#0D9488" />
              <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                {selectedLeadNumbers.size} leads selected
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <button
                onClick={() => {
                  setBulkActionType("update_status");
                  setIsBulkModalOpen(true);
                }}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "4px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Change Status
              </button>

              <button
                onClick={() => {
                  setBulkActionType("assign_owner");
                  setIsBulkModalOpen(true);
                }}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "4px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Assign Owner
              </button>

              <button
                onClick={() => {
                  setBulkActionType("add_tags");
                  setIsBulkModalOpen(true);
                }}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "4px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: "#FFFFFF",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Add Tags
              </button>

              <button
                onClick={() => {
                  setBulkActionType(currentView === "trash" ? "restore" : "soft_delete");
                  setIsBulkModalOpen(true);
                }}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "4px",
                  border: "1px solid #EF4444",
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  color: "#FECACA",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {currentView === "trash" ? "Restore Selected" : "Delete Selected"}
              </button>

              <button
                onClick={() => setSelectedLeadNumbers(new Set())}
                style={{
                  padding: "0.35rem 0.5rem",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "#94A3B8",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Leads Table Card */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E2E8F0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {isLoading ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "#64748B" }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 1rem auto" }} />
              <div>Fetching leads...</div>
            </div>
          ) : leads.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "#64748B" }}>
              <Users size={40} style={{ color: "#CBD5E1", margin: "0 auto 1rem auto" }} />
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1E293B", marginBottom: "0.375rem" }}>
                No leads found
              </div>
              <div style={{ fontSize: "0.875rem", maxWidth: "400px", margin: "0 auto" }}>
                Try adjusting your search criteria or create a new lead to start tracking.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", textAlign: "left" }}>
                <thead style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569" }}>
                  <tr>
                    <th style={{ padding: "0.75rem 1rem", width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={leads.length > 0 && selectedLeadNumbers.size === leads.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    {visibleColumns.name && (
                      <th
                        onClick={() => {
                          setSortField("name");
                          setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                        }}
                        style={{ padding: "0.75rem 1rem", fontWeight: 700, cursor: "pointer" }}
                      >
                        Lead Name
                      </th>
                    )}
                    {visibleColumns.phone && <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Phone / Contact</th>}
                    {visibleColumns.email && <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Email</th>}
                    {visibleColumns.status && <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Status</th>}
                    {visibleColumns.score && <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Score</th>}
                    {visibleColumns.owner && <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Owner</th>}
                    {visibleColumns.source && <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Source</th>}
                    {visibleColumns.tags && <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Tags</th>}
                    {visibleColumns.follow_up && <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Next Follow-up</th>}
                    {visibleColumns.lead_age && <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Age / Last Touch</th>}
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 700 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const isSelected = selectedLeadNumbers.has(lead.number);
                    const statusColor = getStatusColor(lead.status);

                    // Follow-up overdue detection
                    const isOverdue =
                      lead.follow_up_date &&
                      !lead.follow_up_completed &&
                      new Date(lead.follow_up_date) < new Date();

                    return (
                      <tr
                        key={lead.number}
                        style={{
                          borderBottom: "1px solid #F1F5F9",
                          backgroundColor: isSelected ? "#F0FDFA" : "transparent",
                          transition: "background-color 0.1s ease",
                        }}
                      >
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(lead.number)}
                          />
                        </td>

                        {visibleColumns.name && (
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <button
                                onClick={() => handleOpenDetails(lead, "overview")}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  font: "inherit",
                                  textAlign: "left",
                                  fontWeight: 700,
                                  color: "#0F172A",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                              >
                                {lead.name}
                              </button>
                              <span style={{ fontSize: "0.6875rem", color: "#64748B", fontFamily: "monospace" }}>
                                #{lead.number}
                              </span>
                            </div>
                          </td>
                        )}

                        {visibleColumns.phone && (
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                              <span style={{ fontFamily: "monospace", color: "#334155", fontWeight: 600 }}>
                                {lead.phone || lead.number}
                              </span>
                              <a
                                href={`tel:${lead.phone || lead.number}`}
                                title="Call lead"
                                style={{ color: "#0D9488", display: "inline-flex" }}
                              >
                                <PhoneCall size={13} />
                              </a>
                              <a
                                href={`https://wa.me/${(lead.phone || lead.number).replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                title="WhatsApp chat"
                                style={{ color: "#16A34A", display: "inline-flex" }}
                              >
                                <MessageCircle size={13} />
                              </a>
                            </div>
                          </td>
                        )}

                        {visibleColumns.email && (
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <a
                              href={`mailto:${lead.email}`}
                              style={{ color: "#2563EB", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                            >
                              <Mail size={13} /> {lead.email}
                            </a>
                          </td>
                        )}

                        {visibleColumns.status && (
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.2rem 0.5rem",
                                borderRadius: "999px",
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                backgroundColor: `${statusColor}18`,
                                color: statusColor,
                                border: `1px solid ${statusColor}33`,
                              }}
                            >
                              {lead.status}
                            </span>
                            {lead.deal_number && (
                              <div style={{ marginTop: "4px" }}>
                                <Link
                                  href="/deals"
                                  title={`Linked Deal: ${lead.deal_number} (${lead.deal_stage || ""})`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                    padding: "0.15rem 0.45rem",
                                    borderRadius: "4px",
                                    fontSize: "0.6875rem",
                                    fontWeight: 700,
                                    backgroundColor: lead.deal_stage_color ? `${lead.deal_stage_color}18` : "#EFF6FF",
                                    color: lead.deal_stage_color || "#2563EB",
                                    border: `1px solid ${lead.deal_stage_color ? `${lead.deal_stage_color}40` : "#BFDBFE"}`,
                                    textDecoration: "none",
                                  }}
                                >
                                  <Briefcase size={10} />
                                  <span>{lead.deal_number}</span>
                                  {lead.deal_stage && (
                                    <span style={{ fontWeight: 600, opacity: 0.85 }}>• {lead.deal_stage}</span>
                                  )}
                                </Link>
                              </div>
                            )}
                          </td>
                        )}

                        {visibleColumns.score && (
                          <td style={{ padding: "0.75rem 1rem" }}>
                            {renderScoreBadge(lead.score)}
                          </td>
                        )}

                        {visibleColumns.owner && (
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <span style={{ color: lead.owner ? "#334155" : "#94A3B8", fontWeight: 500 }}>
                              {lead.owner ? lead.owner.name : "Unassigned"}
                            </span>
                          </td>
                        )}

                        {visibleColumns.source && (
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                color: "#475569",
                                backgroundColor: "#F1F5F9",
                                padding: "0.15rem 0.45rem",
                                borderRadius: "4px",
                              }}
                            >
                              {lead.source}
                            </span>
                          </td>
                        )}

                        {visibleColumns.tags && (
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                              {lead.tags && lead.tags.length > 0 ? (
                                lead.tags.slice(0, 3).map((tg, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      fontSize: "0.6875rem",
                                      backgroundColor: "#EEF2FF",
                                      color: "#4F46E5",
                                      padding: "0.1rem 0.35rem",
                                      borderRadius: "4px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {tg}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: "#CBD5E1" }}>—</span>
                              )}
                            </div>
                          </td>
                        )}

                        {visibleColumns.follow_up && (
                          <td style={{ padding: "0.75rem 1rem" }}>
                            {lead.follow_up_date ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                                <Clock size={13} color={isOverdue ? "#DC2626" : "#64748B"} />
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    fontWeight: isOverdue ? 700 : 500,
                                    color: isOverdue ? "#DC2626" : "#334155",
                                  }}
                                >
                                  {new Date(lead.follow_up_date).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                                {isOverdue && (
                                  <span
                                    style={{
                                      fontSize: "0.625rem",
                                      backgroundColor: "#FEE2E2",
                                      color: "#B91C1C",
                                      padding: "0.05rem 0.3rem",
                                      borderRadius: "3px",
                                      fontWeight: 800,
                                    }}
                                  >
                                    OVERDUE
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>No follow-up</span>
                            )}
                          </td>
                        )}

                        {visibleColumns.lead_age && (
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                              {lead.lead_age_days === 0 ? "Created today" : `${lead.lead_age_days}d ago`}
                            </div>
                          </td>
                        )}

                        {/* Row Action Buttons */}
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.375rem" }}>
                            <button
                              onClick={() => handleOpenDetails(lead, "overview")}
                              title="View full details"
                              style={{
                                background: "none",
                                border: "none",
                                padding: "0.25rem",
                                cursor: "pointer",
                                color: "#0D9488",
                              }}
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(lead)}
                              title="Edit lead"
                              style={{
                                background: "none",
                                border: "none",
                                padding: "0.25rem",
                                cursor: "pointer",
                                color: "#475569",
                              }}
                            >
                              <Edit3 size={16} />
                            </button>

                            <button
                              onClick={() => openConvertLeadModal(lead)}
                              title="Convert to Customer & Deal"
                              style={{
                                background: "none",
                                border: "none",
                                padding: "0.25rem",
                                cursor: "pointer",
                                color: "#4F46E5",
                              }}
                            >
                              <Briefcase size={16} />
                            </button>

                            {currentView === "trash" ? (
                              <button
                                onClick={() => handleRestoreLead(lead)}
                                title="Restore from trash"
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: "0.25rem",
                                  cursor: "pointer",
                                  color: "#059669",
                                }}
                              >
                                <RotateCcw size={16} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDeleteLead(lead, false)}
                                title="Move to trash"
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: "0.25rem",
                                  cursor: "pointer",
                                  color: "#DC2626",
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer with Pagination */}
          <div
            style={{
              padding: "0.75rem 1.25rem",
              borderTop: "1px solid #E2E8F0",
              backgroundColor: "#F8FAFC",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.8125rem",
              color: "#64748B",
            }}
          >
            <div>
              Showing {leads.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalLeads)} of {totalLeads} leads
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span>Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: page <= 1 ? "#F1F5F9" : "#FFFFFF",
                    cursor: page <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Prev
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: page >= totalPages ? "#F1F5F9" : "#FFFFFF",
                    cursor: page >= totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    {/* End of Leads View (Keep-Alive) */}

        {/* Tab 2: Deals & Sales Pipeline View (Keep-Alive) */}
        <div style={{ display: activeTab === "deals" ? "block" : "none", width: "100%" }}>
          <DealsPage hideSidebar={true} onDealsCountChange={(cnt) => setDealsCount(cnt)} />
        </div>

        {/* Tab 3: Follow-ups View (Keep-Alive) */}
        <div style={{ display: activeTab === "follow-ups" ? "block" : "none", width: "100%" }}>
          <FollowUpsPage hideSidebar={true} onFollowUpsCountChange={(cnt) => setFollowUpsCount(cnt)} />
        </div>

        {/* Tab 3: API Keys View (Keep-Alive) */}
        <div style={{ display: activeTab === "api-keys" ? "block" : "none", width: "100%" }}>
          <ApiKeysPage hideSidebar={true} onKeyCountChange={(cnt) => setKeyCount(cnt)} />
        </div>

        {/* Tab 3: API Documentation View (Keep-Alive) */}
        <div style={{ display: activeTab === "api-docs" ? "block" : "none", width: "100%" }}>
          <ApiDocumentationPage hideNavbar={true} />
        </div>

        {/* Tab 4: Profile View (Keep-Alive) */}
        <div style={{ display: activeTab === "profile" ? "block" : "none", width: "100%" }}>
          <ProfileView user={user} onSelectTab={handleSelectTab} onLogout={handleLogout} />
        </div>
      </div>
      {/* End of Main Screen Content Wrapper */}

      {/* ========================================================================= */}
      {/* LEAD DETAIL DRAWER / SLIDE-OVER                                           */}
      {/* ========================================================================= */}
      {isDetailsDrawerOpen && activeLead && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            zIndex: 9000,
            display: "flex",
            justifyContent: "flex-end",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "680px",
              backgroundColor: "#FFFFFF",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.15)",
              overflowY: "auto",
            }}
          >
            {/* Drawer Header */}
            <div style={{ padding: "1.5rem", borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.6rem",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        backgroundColor: `${getStatusColor(activeLead.status)}22`,
                        color: getStatusColor(activeLead.status),
                      }}
                    >
                      {activeLead.status}
                    </span>
                    {renderScoreBadge(activeLead.score)}
                    <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                      Source: <strong>{activeLead.source}</strong>
                    </span>
                    {activeLead.deal_number && (
                      <Link
                        href="/deals"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "0.2rem 0.6rem",
                          borderRadius: "999px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          backgroundColor: activeLead.deal_stage_color ? `${activeLead.deal_stage_color}18` : "#EFF6FF",
                          color: activeLead.deal_stage_color || "#2563EB",
                          border: `1px solid ${activeLead.deal_stage_color ? `${activeLead.deal_stage_color}40` : "#BFDBFE"}`,
                          textDecoration: "none",
                        }}
                      >
                        <Briefcase size={12} />
                        <span>Deal {activeLead.deal_number}</span>
                        {activeLead.deal_stage && (
                          <span style={{ fontWeight: 600, opacity: 0.85 }}>({activeLead.deal_stage})</span>
                        )}
                        <ExternalLink size={10} />
                      </Link>
                    )}
                  </div>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                    {activeLead.name}
                  </h2>
                  <div style={{ fontSize: "0.8125rem", color: "#64748B", fontFamily: "monospace" }}>
                    #{activeLead.number}
                  </div>
                </div>

                <button
                  onClick={() => setIsDetailsDrawerOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.25rem",
                    color: "#64748B",
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Quick Contact & Action Buttons */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
                <a
                  href={`tel:${activeLead.phone || activeLead.number}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "6px",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <PhoneCall size={14} /> Call
                </a>

                <a
                  href={`https://wa.me/${(activeLead.phone || activeLead.number).replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "6px",
                    backgroundColor: "#16A34A",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>

                <a
                  href={`mailto:${activeLead.email}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "6px",
                    backgroundColor: "#2563EB",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <Mail size={14} /> Email
                </a>

                <button
                  onClick={() => {
                    setFollowUpFormData({
                      title: `Follow up with ${activeLead.name}`,
                      follow_up_type: "Call",
                      due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
                      notes: "",
                    });
                    setIsScheduleFollowUpOpen(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    color: "#334155",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Calendar size={14} /> Schedule Follow-up
                </button>

                <button
                  onClick={() => handleOpenEditModal(activeLead)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    color: "#334155",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Edit3 size={14} /> Edit
                </button>

                {activeLead.status.toLowerCase() !== "qualified" ? (
                  <button
                    onClick={async () => {
                      try {
                        const updated = await leadsApi.update(activeLead.number, { status: "Qualified" });
                        setActiveLead(updated);
                        fetchLeads();
                        showToast(
                          "success",
                          "Lead marked Qualified! Deal automatically created in New Opportunity.",
                          "View Deal in Pipeline",
                          () => router.push("/deals")
                        );
                      } catch (err: any) {
                        showToast("error", err.message || "Failed to mark as qualified");
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.4rem 0.75rem",
                      borderRadius: "6px",
                      backgroundColor: "#059669",
                      color: "#FFFFFF",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "none",
                    }}
                  >
                    <CheckCircle size={14} /> Mark Qualified
                  </button>
                ) : (
                  <button
                    onClick={() => router.push("/deals")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.4rem 0.75rem",
                      borderRadius: "6px",
                      backgroundColor: "#0284C7",
                      color: "#FFFFFF",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "none",
                    }}
                  >
                    <Briefcase size={14} /> View Deal in Pipeline →
                  </button>
                )}

                <button
                  onClick={() => openConvertLeadModal(activeLead)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "6px",
                    backgroundColor: "#4F46E5",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "none",
                  }}
                >
                  <Briefcase size={14} /> Convert to Deal
                </button>
              </div>

              {/* Navigation Tabs */}
              <div style={{ display: "flex", gap: "1rem", marginTop: "1.25rem", borderBottom: "1px solid #E2E8F0" }}>
                {[
                  { id: "overview", label: "Overview" },
                  { id: "custom_fields", label: "Custom Fields" },
                  { id: "notes", label: `Notes (${activeNotes.length})` },
                  { id: "followups", label: `Follow-ups (${activeFollowUps.length})` },
                  { id: "timeline", label: "Timeline" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setDetailsTab(t.id as any)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "0.5rem 0",
                      fontSize: "0.8125rem",
                      fontWeight: detailsTab === t.id ? 700 : 500,
                      color: detailsTab === t.id ? "#0D9488" : "#64748B",
                      borderBottom: detailsTab === t.id ? "2px solid #0D9488" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer Body Content */}
            <div style={{ padding: "1.5rem", flex: 1 }}>
              {detailsTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  {/* Lead requirement callout */}
                  <div style={{ backgroundColor: "#F8FAFC", borderRadius: "8px", padding: "1rem", border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", marginBottom: "0.25rem" }}>
                      Requirement / Notes
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#1E293B", lineHeight: 1.6 }}>
                      {activeLead.requirement}
                    </div>
                  </div>

                  {/* Core Field Pairs */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>Assigned Owner</div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
                        {activeLead.owner ? activeLead.owner.name : "Unassigned"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>City / Location</div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
                        {activeLead.city || "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>Created At</div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
                        {new Date(activeLead.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>Last Touched</div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A" }}>
                        {new Date(activeLead.last_activity_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {activeLead.status.toLowerCase() === "lost" && activeLead.lost_reason && (
                    <div style={{ backgroundColor: "#FEF2F2", borderRadius: "8px", padding: "1rem", border: "1px solid #FEE2E2" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#DC2626", textTransform: "uppercase", marginBottom: "0.25rem" }}>
                        Disqualification / Lost Reason
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "#991B1B" }}>
                        {activeLead.lost_reason}
                      </div>
                    </div>
                  )}

                  {/* Custom Fields Summary */}
                  {activeLead.custom_field_details && activeLead.custom_field_details.length > 0 && (
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", marginBottom: "0.75rem" }}>
                        Industry & Business Specifications
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                        {activeLead.custom_field_details.map((cf, idx) => (
                          <div key={idx} style={{ padding: "0.625rem", borderRadius: "6px", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                            <div style={{ fontSize: "0.6875rem", color: "#64748B" }}>{cf.field_label}</div>
                            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A" }}>
                              {cf.value ? String(cf.value) : "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailsTab === "custom_fields" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ fontSize: "0.875rem", color: "#64748B" }}>
                    Universal custom fields for this business:
                  </div>

                  {customFields.map((cfDef) => {
                    const currentVal = activeLead.custom_fields?.[cfDef.field_key];
                    return (
                      <div key={cfDef.id} style={{ padding: "0.875rem", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>{cfDef.field_label}</span>
                          <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>{cfDef.field_type}</span>
                        </div>
                        <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: currentVal ? "#0F172A" : "#94A3B8" }}>
                          {currentVal ? String(currentVal) : "Not specified"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {detailsTab === "notes" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Add note textarea */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <textarea
                      placeholder="Add an internal note about this lead..."
                      rows={3}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        fontSize: "0.8125rem",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        outline: "none",
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={handleAddNote}
                        disabled={!newNoteText.trim()}
                        style={{
                          padding: "0.45rem 1rem",
                          borderRadius: "6px",
                          backgroundColor: "#0D9488",
                          color: "#FFFFFF",
                          fontSize: "0.8125rem",
                          fontWeight: 700,
                          border: "none",
                          cursor: newNoteText.trim() ? "pointer" : "not-allowed",
                          opacity: newNoteText.trim() ? 1 : 0.6,
                        }}
                      >
                        Save Note
                      </button>
                    </div>
                  </div>

                  {/* Notes List */}
                  {activeNotes.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
                      No internal notes recorded yet.
                    </div>
                  ) : (
                    activeNotes.map((note) => (
                      <div key={note.id} style={{ padding: "0.875rem", borderRadius: "8px", border: "1px solid #E2E8F0", backgroundColor: "#FFFFFF" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155" }}>
                            {note.user ? note.user.name : "Staff Member"}
                          </span>
                          <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
                            {new Date(note.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "#1E293B", lineHeight: 1.5 }}>
                          {note.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailsTab === "followups" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A" }}>
                      Scheduled Follow-ups
                    </span>
                    <button
                      onClick={() => setIsScheduleFollowUpOpen(true)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.35rem 0.75rem",
                        borderRadius: "6px",
                        backgroundColor: "#0D9488",
                        color: "#FFFFFF",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} /> Schedule Follow-up
                    </button>
                  </div>

                  {activeFollowUps.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
                      No follow-up tasks scheduled.
                    </div>
                  ) : (
                    activeFollowUps.map((fup) => (
                      <div
                        key={fup.id}
                        style={{
                          padding: "0.875rem",
                          borderRadius: "8px",
                          border: "1px solid #E2E8F0",
                          backgroundColor: fup.completed ? "#F8FAFC" : "#FFFFFF",
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                          <input
                            type="checkbox"
                            checked={fup.completed}
                            onChange={() => handleToggleFollowUpCompleted(fup)}
                            style={{ marginTop: "3px" }}
                          />
                          <div>
                            <div
                              style={{
                                fontSize: "0.875rem",
                                fontWeight: 700,
                                color: fup.completed ? "#94A3B8" : "#0F172A",
                                textDecoration: fup.completed ? "line-through" : "none",
                              }}
                            >
                              {fup.title}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                              {fup.follow_up_type} • Due: {new Date(fup.due_date).toLocaleString()}
                            </div>
                            {fup.notes && (
                              <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "4px" }}>
                                {fup.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "999px",
                            backgroundColor: fup.completed ? "#DCFCE7" : "#FEF3C7",
                            color: fup.completed ? "#15803D" : "#B45309",
                          }}
                        >
                          {fup.completed ? "Completed" : "Pending"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {detailsTab === "timeline" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {activeActivities.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: "0.875rem" }}>
                      No activity recorded yet.
                    </div>
                  ) : (
                    activeActivities.map((act) => (
                      <div
                        key={act.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          borderRadius: "6px",
                          backgroundColor: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                        }}
                      >
                        <Activity size={16} color="#0D9488" style={{ marginTop: "2px", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1E293B" }}>
                              {act.title}
                            </span>
                            <span style={{ fontSize: "0.6875rem", color: "#94A3B8" }}>
                              {new Date(act.created_at).toLocaleString()}
                            </span>
                          </div>
                          {act.description && (
                            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                              {act.description}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE LEAD MODAL                                                         */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "1.75rem",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#0F172A" }}>
                Create New Lead
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLeadSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Core fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Lead Number / Phone ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+1-555-0192"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value, phone: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Lead Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Morgan Freeman"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="morgan@enterprise.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    City / Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="New York"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                  Requirement / Inquired Service *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Details of client requirements or project specifications..."
                  value={formData.requirement}
                  onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  >
                    {statuses.map((st) => (
                      <option key={st.id} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Lead Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  >
                    {sources.map((src) => (
                      <option key={src.id} value={src.name}>
                        {src.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Assign Owner
                  </label>
                  <select
                    value={formData.owner_id}
                    onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  >
                    <option value="">Unassigned</option>
                    {crmUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Lead Quality Score (0 - 100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.score}
                    onChange={(e) => setFormData({ ...formData, score: Number(e.target.value) })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Tags (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="Hot, VIP, Enterprise"
                    value={formData.tagsText}
                    onChange={(e) => setFormData({ ...formData, tagsText: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>
              </div>

              {/* Dynamic Industry Custom Fields Section */}
              {customFields.length > 0 && (
                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "1rem", marginTop: "0.5rem" }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A", marginBottom: "0.75rem" }}>
                    Industry Custom Fields
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    {customFields.map((cf) => {
                      if (cf.field_type === "Dropdown" && cf.options && cf.options.length > 0) {
                        return (
                          <div key={cf.id}>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                              {cf.field_label}
                            </label>
                            <select
                              value={formData.customFieldsValues[cf.field_key] || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  customFieldsValues: {
                                    ...formData.customFieldsValues,
                                    [cf.field_key]: e.target.value,
                                  },
                                })
                              }
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                            >
                              <option value="">Select option</option>
                              {cf.options.map((opt, oi) => (
                                <option key={oi} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }

                      return (
                        <div key={cf.id}>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                            {cf.field_label} ({cf.field_type})
                          </label>
                          <input
                            type={cf.field_type === "Number" || cf.field_type === "Currency" ? "text" : "text"}
                            placeholder={`Enter ${cf.field_label.toLowerCase()}`}
                            value={formData.customFieldsValues[cf.field_key] || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                customFieldsValues: {
                                  ...formData.customFieldsValues,
                                  [cf.field_key]: e.target.value,
                                },
                              })
                            }
                            style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
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
                    padding: "0.5rem 1.25rem",
                    borderRadius: "6px",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    border: "none",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmitting ? "Saving..." : "Create Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT LEAD MODAL                                                           */}
      {/* ========================================================================= */}
      {isEditModalOpen && activeLead && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "1.75rem",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#0F172A" }}>
                Edit Lead Details (#{activeLead.number})
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditLeadSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Lead Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    City / Location
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                  Requirement
                </label>
                <textarea
                  required
                  rows={2}
                  value={formData.requirement}
                  onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  >
                    {statuses.map((st) => (
                      <option key={st.id} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Score (0 - 100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.score}
                    onChange={(e) => setFormData({ ...formData, score: Number(e.target.value) })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Assign Owner
                  </label>
                  <select
                    value={formData.owner_id}
                    onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  >
                    <option value="">Unassigned</option>
                    {crmUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.status.toLowerCase() === "lost" && (
                <div style={{ backgroundColor: "#FEF2F2", padding: "0.75rem", borderRadius: "6px", border: "1px solid #FEE2E2" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#DC2626", marginBottom: "0.25rem" }}>
                    Disqualification / Lost Reason *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Why was this lead lost or disqualified?"
                    value={formData.lost_reason}
                    onChange={(e) => setFormData({ ...formData, lost_reason: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #FCA5A5", fontSize: "0.8125rem" }}
                  />
                </div>
              )}

              {/* Dynamic Industry Custom Fields */}
              {customFields.length > 0 && (
                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "1rem" }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A", marginBottom: "0.75rem" }}>
                    Custom Fields
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    {customFields.map((cf) => {
                      if (cf.field_type === "Dropdown" && cf.options && cf.options.length > 0) {
                        return (
                          <div key={cf.id}>
                            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                              {cf.field_label}
                            </label>
                            <select
                              value={formData.customFieldsValues[cf.field_key] || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  customFieldsValues: {
                                    ...formData.customFieldsValues,
                                    [cf.field_key]: e.target.value,
                                  },
                                })
                              }
                              style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                            >
                              <option value="">Select option</option>
                              {cf.options.map((opt, oi) => (
                                <option key={oi} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      }

                      return (
                        <div key={cf.id}>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                            {cf.field_label}
                          </label>
                          <input
                            type="text"
                            value={formData.customFieldsValues[cf.field_key] || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                customFieldsValues: {
                                  ...formData.customFieldsValues,
                                  [cf.field_key]: e.target.value,
                                },
                              })
                            }
                            style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
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
                    padding: "0.5rem 1.25rem",
                    borderRadius: "6px",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    border: "none",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BULK ACTION MODAL                                                         */}
      {/* ========================================================================= */}
      {isBulkModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "1.75rem",
              maxWidth: "480px",
              width: "100%",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0 0 1rem 0", color: "#0F172A" }}>
              Apply Bulk Action to {selectedLeadNumbers.size} Leads
            </h2>

            {bulkActionType === "update_status" && (
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.375rem" }}>
                  Select New Status
                </label>
                <select
                  value={bulkStatusValue}
                  onChange={(e) => setBulkStatusValue(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                >
                  {statuses.map((st) => (
                    <option key={st.id} value={st.name}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {bulkActionType === "assign_owner" && (
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.375rem" }}>
                  Select Team Member
                </label>
                <select
                  value={bulkOwnerValue}
                  onChange={(e) => setBulkOwnerValue(Number(e.target.value))}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                >
                  <option value={0}>Unassigned</option>
                  {crmUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {bulkActionType === "add_tags" && (
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.375rem" }}>
                  Tags to Add (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="BulkProcessed, Q4Campaign"
                  value={bulkTagsValue}
                  onChange={(e) => setBulkTagsValue(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                />
              </div>
            )}

            {bulkActionType === "soft_delete" && (
              <p style={{ fontSize: "0.875rem", color: "#DC2626" }}>
                Are you sure you want to move {selectedLeadNumbers.size} leads to Trash?
              </p>
            )}

            {bulkActionType === "restore" && (
              <p style={{ fontSize: "0.875rem", color: "#059669" }}>
                Restore {selectedLeadNumbers.size} selected leads from trash?
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#FFFFFF",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteBulkAction}
                disabled={isSubmitting}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "6px",
                  backgroundColor: bulkActionType === "soft_delete" ? "#DC2626" : "#0D9488",
                  color: "#FFFFFF",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  border: "none",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Processing..." : "Confirm & Execute"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CSV IMPORT MODAL                                                          */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "1.75rem",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#0F172A" }}>
                Import Leads via CSV
              </h2>
              <button onClick={() => setIsImportModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: "0 0 1rem 0" }}>
              Paste raw CSV text or upload below. Required column: <code>number</code> (or <code>phone</code>). Optional columns: <code>name</code>, <code>email</code>, <code>city</code>, <code>requirement</code>, <code>source</code>, plus any configured custom fields.
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                Duplicate Resolution Strategy
              </label>
              <select
                value={importStrategy}
                onChange={(e) => setImportStrategy(e.target.value as any)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
              >
                <option value="skip">Skip duplicates (Safe)</option>
                <option value="update">Overwrite / Update existing leads</option>
                <option value="error">Abort on duplicate conflict</option>
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>
                  Paste CSV Data
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setImportCsvText(
                      `number,name,email,city,requirement,source,industry\n+1-555-8001,Alpha Tech,contact@alpha.com,Boston,Needs cloud CRM,Website,Technology\n+1-555-8002,Apex Properties,apex@properties.io,Dallas,Luxury real estate leads,Referral,Real Estate`
                    )
                  }
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "0.6875rem",
                    color: "#0D9488",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Load Sample CSV
                </button>
              </div>
              <textarea
                rows={8}
                placeholder="number,name,email,city,requirement,source..."
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "0.8125rem",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontFamily: "monospace",
                }}
              />
            </div>

            {importResult && (
              <div style={{ backgroundColor: "#F8FAFC", borderRadius: "8px", padding: "1rem", border: "1px solid #E2E8F0", marginBottom: "1rem", fontSize: "0.8125rem" }}>
                <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "0.25rem" }}>Import Summary:</div>
                <div>Processed: {importResult.total_processed}</div>
                <div style={{ color: "#059669" }}>Imported: {importResult.imported_count}</div>
                <div style={{ color: "#D97706" }}>Skipped: {importResult.skipped_count}</div>
                {importResult.errors?.length > 0 && (
                  <div style={{ color: "#DC2626", marginTop: "0.25rem" }}>
                    Errors: {importResult.errors.length} rows failed.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                onClick={() => setIsImportModalOpen(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  backgroundColor: "#FFFFFF",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={isSubmitting || !importCsvText.trim()}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "6px",
                  backgroundColor: "#0D9488",
                  color: "#FFFFFF",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  border: "none",
                  cursor: isSubmitting || !importCsvText.trim() ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Importing..." : "Start Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCHEDULE FOLLOW-UP DIALOG                                                 */}
      {/* ========================================================================= */}
      {isScheduleFollowUpOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "1.75rem",
              maxWidth: "460px",
              width: "100%",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0 0 1rem 0", color: "#0F172A" }}>
              Schedule Follow-up Task
            </h2>

            <form onSubmit={handleScheduleFollowUpSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="Demo Review Call"
                  value={followUpFormData.title}
                  onChange={(e) => setFollowUpFormData({ ...followUpFormData, title: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Activity Type
                  </label>
                  <select
                    value={followUpFormData.follow_up_type}
                    onChange={(e) => setFollowUpFormData({ ...followUpFormData, follow_up_type: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  >
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Demo">Demo</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Due Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={followUpFormData.due_date}
                    onChange={(e) => setFollowUpFormData({ ...followUpFormData, due_date: e.target.value })}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Agenda, questions to address..."
                  value={followUpFormData.notes}
                  onChange={(e) => setFollowUpFormData({ ...followUpFormData, notes: e.target.value })}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsScheduleFollowUpOpen(false)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "0.5rem 1.25rem",
                    borderRadius: "6px",
                    backgroundColor: "#0D9488",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADMIN SETTINGS MODAL (CUSTOM FIELDS, STATUSES, SOURCES, TAGS, DUPLICATES) */}
      {/* ========================================================================= */}
      {isAdminSettingsOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "1.75rem",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Settings size={20} color="#0D9488" />
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#0F172A" }}>
                  Lead Module Admin Settings
                </h2>
              </div>
              <button onClick={() => setIsAdminSettingsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                <X size={18} />
              </button>
            </div>

            {/* Admin Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #E2E8F0", paddingBottom: "0.5rem", marginBottom: "1.25rem" }}>
              {[
                { id: "custom_fields", label: "Custom Fields" },
                { id: "statuses", label: "Lead Statuses" },
                { id: "sources", label: "Lead Sources" },
                { id: "tags", label: "Tags" },
                { id: "duplicates", label: "Duplicate Rules" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAdminTab(tab.id as any)}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "6px",
                    border: "none",
                    fontSize: "0.8125rem",
                    fontWeight: adminTab === tab.id ? 700 : 500,
                    backgroundColor: adminTab === tab.id ? "#0D9488" : "transparent",
                    color: adminTab === tab.id ? "#FFFFFF" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Custom Fields */}
            {adminTab === "custom_fields" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <form onSubmit={handleCreateCustomField} style={{ backgroundColor: "#F8FAFC", padding: "1rem", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A", marginBottom: "0.75rem" }}>
                    Add New Business Custom Field
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#475569" }}>Field Label *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Project Budget"
                        value={newCustomField.field_label}
                        onChange={(e) =>
                          setNewCustomField({
                            ...newCustomField,
                            field_label: e.target.value,
                            field_key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_"),
                          })
                        }
                        style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#475569" }}>Field Slug / Key *</label>
                      <input
                        type="text"
                        required
                        placeholder="project_budget"
                        value={newCustomField.field_key}
                        onChange={(e) => setNewCustomField({ ...newCustomField, field_key: e.target.value })}
                        style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "0.8125rem", fontFamily: "monospace" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#475569" }}>Field Type</label>
                      <select
                        value={newCustomField.field_type}
                        onChange={(e) => setNewCustomField({ ...newCustomField, field_type: e.target.value })}
                        style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
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
                      <label style={{ display: "block", fontSize: "0.6875rem", fontWeight: 700, color: "#475569" }}>Options (Comma-separated for Dropdown)</label>
                      <input
                        type="text"
                        placeholder="Tier 1, Tier 2, Tier 3"
                        value={newCustomField.options}
                        onChange={(e) => setNewCustomField({ ...newCustomField, options: e.target.value })}
                        style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      style={{
                        padding: "0.45rem 1rem",
                        borderRadius: "6px",
                        backgroundColor: "#0D9488",
                        color: "#FFFFFF",
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Save Custom Field
                    </button>
                  </div>
                </form>

                {/* List existing custom fields */}
                <div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#475569", marginBottom: "0.5rem" }}>
                    Active Custom Fields ({customFields.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {customFields.map((cf) => (
                      <div
                        key={cf.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.625rem 0.875rem",
                          borderRadius: "6px",
                          border: "1px solid #E2E8F0",
                          backgroundColor: "#FFFFFF",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A" }}>
                            {cf.field_label}{" "}
                            <span style={{ fontSize: "0.6875rem", fontFamily: "monospace", color: "#64748B" }}>
                              ({cf.field_key})
                            </span>
                          </div>
                          <div style={{ fontSize: "0.6875rem", color: "#64748B" }}>
                            Type: {cf.field_type} {cf.options?.length > 0 ? `• [${cf.options.join(", ")}]` : ""}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteCustomField(cf.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#DC2626",
                            padding: "4px",
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Lead Statuses */}
            {adminTab === "statuses" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <form onSubmit={handleAddStatus} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                      Status Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Under Contract"
                      value={newStatusInput.name}
                      onChange={(e) => setNewStatusInput({ ...newStatusInput, name: e.target.value })}
                      style={{ width: "100%", padding: "0.45rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                      Color
                    </label>
                    <input
                      type="color"
                      value={newStatusInput.color}
                      onChange={(e) => setNewStatusInput({ ...newStatusInput, color: e.target.value })}
                      style={{ width: "50px", height: "34px", padding: 0, borderRadius: "6px", border: "1px solid #CBD5E1", cursor: "pointer" }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      padding: "0.45rem 1rem",
                      borderRadius: "6px",
                      backgroundColor: "#0D9488",
                      color: "#FFFFFF",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      height: "34px",
                    }}
                  >
                    Add Status
                  </button>
                </form>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {statuses.map((st) => (
                    <div
                      key={st.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: st.color }} />
                        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A" }}>{st.name}</span>
                      </div>
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Delete status ${st.name}?`)) return;
                          await leadsApi.deleteStatus(st.id);
                          loadMetadata();
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Lead Sources */}
            {adminTab === "sources" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <form onSubmit={handleAddSource} style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    required
                    placeholder="New lead source (e.g. LinkedIn Ads)"
                    value={newSourceInput}
                    onChange={(e) => setNewSourceInput(e.target.value)}
                    style={{ flex: 1, padding: "0.45rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: "0.45rem 1rem",
                      borderRadius: "6px",
                      backgroundColor: "#0D9488",
                      color: "#FFFFFF",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Add Source
                  </button>
                </form>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {sources.map((src) => (
                    <div
                      key={src.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>{src.name}</span>
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Delete source ${src.name}?`)) return;
                          await leadsApi.deleteSource(src.id);
                          loadMetadata();
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: Tags */}
            {adminTab === "tags" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <form onSubmit={handleAddTag} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                      Tag Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. VIP Client"
                      value={newTagInput.name}
                      onChange={(e) => setNewTagInput({ ...newTagInput, name: e.target.value })}
                      style={{ width: "100%", padding: "0.45rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                      Color
                    </label>
                    <input
                      type="color"
                      value={newTagInput.color}
                      onChange={(e) => setNewTagInput({ ...newTagInput, color: e.target.value })}
                      style={{ width: "50px", height: "34px", padding: 0, borderRadius: "6px", border: "1px solid #CBD5E1", cursor: "pointer" }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      padding: "0.45rem 1rem",
                      borderRadius: "6px",
                      backgroundColor: "#0D9488",
                      color: "#FFFFFF",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      height: "34px",
                    }}
                  >
                    Add Tag
                  </button>
                </form>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {tags.map((tg) => (
                    <div
                      key={tg.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.3rem 0.625rem",
                        borderRadius: "999px",
                        backgroundColor: `${tg.color}18`,
                        color: tg.color,
                        border: `1px solid ${tg.color}33`,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      <span>{tg.name}</span>
                      <button
                        onClick={async () => {
                          await leadsApi.deleteTag(tg.id);
                          loadMetadata();
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: tg.color, padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 5: Duplicate Rules */}
            {adminTab === "duplicates" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: 0 }}>
                  Configure automatic duplicate check prevention across Manual Creation, CSV Import, and External Webhooks.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.8125rem", fontWeight: 600, color: "#1E293B", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={duplicateSettings.check_phone}
                      onChange={(e) => setDuplicateSettings({ ...duplicateSettings, check_phone: e.target.checked })}
                    />
                    Check Duplicate Phone Number (normalizes +1 (555) 0192 to +15550192)
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", fontSize: "0.8125rem", fontWeight: 600, color: "#1E293B", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={duplicateSettings.check_email}
                      onChange={(e) => setDuplicateSettings({ ...duplicateSettings, check_email: e.target.checked })}
                    />
                    Check Duplicate Email Address (case-insensitive)
                  </label>

                  <div style={{ marginTop: "0.5rem" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                      Duplicate Action
                    </label>
                    <select
                      value={duplicateSettings.action}
                      onChange={(e) => setDuplicateSettings({ ...duplicateSettings, action: e.target.value as any })}
                      style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                    >
                      <option value="prevent">Prevent (Reject with HTTP 409 Conflict)</option>
                      <option value="warn">Warn (Allow insertion with warning log)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={handleSaveDuplicateSettings}
                    style={{
                      padding: "0.5rem 1.25rem",
                      borderRadius: "6px",
                      backgroundColor: "#0D9488",
                      color: "#FFFFFF",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Save Duplicate Rules
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONVERT LEAD TO CUSTOMER & DEAL MODAL                                      */}
      {/* ========================================================================= */}
      {isConvertModalOpen && leadToConvert && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 150,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setIsConvertModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              maxWidth: "560px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
                    Convert Lead to Deal
                  </h3>
                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>
                    Creates a Customer record and starts a Deal in your sales pipeline.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConvertModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteLeadConversion} style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                  Deal Name *
                </label>
                <input
                  type="text"
                  required
                  value={convDealName}
                  onChange={(e) => setConvDealName(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                />
              </div>

              {/* Target Pipeline & Stage */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Target Pipeline *
                  </label>
                  <select
                    required
                    value={convPipelineId}
                    onChange={(e) => {
                      const pId = Number(e.target.value);
                      setConvPipelineId(pId);
                      const pipe = convPipelines.find((p) => p.id === pId);
                      if (pipe && pipe.stages && pipe.stages.length > 0) {
                        setConvStageId(pipe.stages[0].id);
                      }
                    }}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem", backgroundColor: "#FFFFFF" }}
                  >
                    {convPipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Initial Stage *
                  </label>
                  <select
                    required
                    value={convStageId}
                    onChange={(e) => setConvStageId(Number(e.target.value))}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem", backgroundColor: "#FFFFFF" }}
                  >
                    {convPipelines
                      .find((p) => p.id === convPipelineId)
                      ?.stages?.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.probability}%)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Deal Value & Priority */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Deal Value ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={convDealValue}
                    onChange={(e) => setConvDealValue(e.target.value === "" ? "" : Number(e.target.value))}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "0.25rem" }}>
                    Priority
                  </label>
                  <select
                    value={convPriority}
                    onChange={(e) => setConvPriority(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.8125rem", backgroundColor: "#FFFFFF" }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Customer Details Section */}
              <div style={{ backgroundColor: "#F8FAFC", padding: "1rem", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 0.5rem 0" }}>
                  Customer Details (New or Linked)
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={convCustomerName}
                    onChange={(e) => setConvCustomerName(e.target.value)}
                    style={{ padding: "0.45rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.75rem" }}
                  />
                  <input
                    type="text"
                    placeholder="Company"
                    value={convCustomerCompany}
                    onChange={(e) => setConvCustomerCompany(e.target.value)}
                    style={{ padding: "0.45rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.75rem" }}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={convCustomerEmail}
                    onChange={(e) => setConvCustomerEmail(e.target.value)}
                    style={{ padding: "0.45rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.75rem" }}
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={convCustomerPhone}
                    onChange={(e) => setConvCustomerPhone(e.target.value)}
                    style={{ padding: "0.45rem", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "0.75rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
                  style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid #CBD5E1", backgroundColor: "#FFFFFF", fontSize: "0.8125rem", fontWeight: 600, color: "#475569", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConverting}
                  style={{
                    padding: "0.5rem 1.25rem",
                    borderRadius: "6px",
                    backgroundColor: "#4F46E5",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {isConverting ? "Converting..." : "Convert to Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
