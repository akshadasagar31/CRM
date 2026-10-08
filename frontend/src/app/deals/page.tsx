"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
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
  FileText,
  Sliders,
  ChevronUp,
  ChevronDown,
  Power,
} from "lucide-react";
import {
  dealsApi,
  pipelinesApi,
  customersApi,
  leadsApi,
  authApi,
  getToken,
  getStoredUser,
  Deal,
  Pipeline,
  DealStage,
  Customer,
  Lead,
  LeadUserSummary,
  DealNote,
  User,
} from "@/lib/api";
import Sidebar, { SidebarTab } from "@/components/Sidebar";

interface DealsPageProps {
  hideSidebar?: boolean;
  onDealsCountChange?: (count: number) => void;
  onSelectLead?: (leadNumber: string) => void;
}

// 9 PDF Sales Pipeline Stages
const PDF_SALES_STAGES = [
  { name: "New Opportunity", order: 1, probability: 10, color: "#3B82F6", is_won: false, is_lost: false },
  { name: "Requirement Discussion", order: 2, probability: 20, color: "#6366F1", is_won: false, is_lost: false },
  { name: "Quotation Preparation", order: 3, probability: 35, color: "#8B5CF6", is_won: false, is_lost: false },
  { name: "Quotation Sent", order: 4, probability: 50, color: "#06B6D4", is_won: false, is_lost: false },
  { name: "Negotiation", order: 5, probability: 70, color: "#F59E0B", is_won: false, is_lost: false },
  { name: "Quotation Accepted", order: 6, probability: 85, color: "#14B8A6", is_won: false, is_lost: false },
  { name: "Final Amount Confirmed", order: 7, probability: 95, color: "#10B981", is_won: false, is_lost: false },
  { name: "Won", order: 8, probability: 100, color: "#059669", is_won: true, is_lost: false },
  { name: "Lost", order: 9, probability: 0, color: "#EF4444", is_won: false, is_lost: true },
];

export default function DealsPage({
  hideSidebar = false,
  onDealsCountChange,
  onSelectLead,
}: DealsPageProps = {}) {
  const router = useRouter();

  // Auth & Workspace
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [teamUsers, setTeamUsers] = useState<LeadUserSummary[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("deals");

  // Core Data
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipeline, setActivePipeline] = useState<Pipeline | null>(null);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("all");

  // Drag and drop state
  const [draggedDealId, setDraggedDealId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);

  // Detail Drawer State (View vs Edit Mode)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [linkedLead, setLinkedLead] = useState<Lead | null>(null);
  const [dealNotes, setDealNotes] = useState<DealNote[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [isSavingDeal, setIsSavingDeal] = useState(false);
  const [isDeletingDeal, setIsDeletingDeal] = useState(false);

  // Drawer Form fields (for Edit Mode)
  const [drawerDealName, setDrawerDealName] = useState("");
  const [drawerCustomerId, setDrawerCustomerId] = useState<number | "">("");
  const [drawerOwnerId, setDrawerOwnerId] = useState<number | "">("");
  const [drawerValue, setDrawerValue] = useState<number | "">("");
  const [drawerStageId, setDrawerStageId] = useState<number | "">("");
  const [drawerCloseDate, setDrawerCloseDate] = useState("");
  const [drawerPriority, setDrawerPriority] = useState("Medium");
  const [drawerSource, setDrawerSource] = useState("Website");
  const [drawerRequirement, setDrawerRequirement] = useState("");
  const [drawerNewNote, setDrawerNewNote] = useState("");
  const [drawerLostReason, setDrawerLostReason] = useState("");

  // New Deal Modal State
  const [isNewDealModalOpen, setIsNewDealModalOpen] = useState(false);
  const [isSubmittingNewDeal, setIsSubmittingNewDeal] = useState(false);
  const [newDealName, setNewDealName] = useState("");
  const [newDealCustomerId, setNewDealCustomerId] = useState<number | "">("");
  const [newDealStageId, setNewDealStageId] = useState<number | "">("");
  const [newDealOwnerId, setNewDealOwnerId] = useState<number | "">("");
  const [newDealValue, setNewDealValue] = useState<number | "">("");
  const [newDealPriority, setNewDealPriority] = useState("Medium");
  const [newDealCloseDate, setNewDealCloseDate] = useState("");
  const [newDealRequirement, setNewDealRequirement] = useState("");

  // Quick Customer Creation inline in modal
  const [isCreatingInlineCustomer, setIsCreatingInlineCustomer] = useState(false);
  const [inlineCustName, setInlineCustName] = useState("");
  const [inlineCustCompany, setInlineCustCompany] = useState("");
  const [inlineCustEmail, setInlineCustEmail] = useState("");
  const [inlineCustPhone, setInlineCustPhone] = useState("");

  // Stage Customization Modal State
  const [isCustomizeStagesModalOpen, setIsCustomizeStagesModalOpen] = useState(false);
  const [editingStages, setEditingStages] = useState<DealStage[]>([]);
  const [isSavingCustomStages, setIsSavingCustomStages] = useState(false);
  const [newCustomStageName, setNewCustomStageName] = useState("");
  const [newCustomStageColor, setNewCustomStageColor] = useState("#3B82F6");
  const [newCustomStageProbability, setNewCustomStageProbability] = useState<number>(50);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Auth & Initial Load
  useEffect(() => {
    const token = getToken();
    if (!token && !hideSidebar) {
      router.push("/login");
      return;
    }
    const stored = getStoredUser();
    if (stored) setCurrentUser(stored);

    authApi.getMe().then((res) => {
      if (res && res.id) setCurrentUser(res);
    }).catch(() => {});

    authApi.getUsers().then((users: LeadUserSummary[]) => {
      if (Array.isArray(users)) setTeamUsers(users);
    }).catch(() => {});

    loadAllData();
  }, [hideSidebar, router]);

  // Load Pipelines, Customers, Deals
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [pipeListRes, custList] = await Promise.all([
        pipelinesApi.list().catch(() => [] as Pipeline[]),
        customersApi.list("", 1, 100).catch(() => ({ items: [] })),
      ]);

      const pipeList: Pipeline[] = [...pipeListRes];

      if (custList && custList.items) {
        setCustomers(custList.items);
      }

      let activePipe: Pipeline | null = null;
      if (pipeList.length > 0) {
        activePipe = pipeList.find((p) => p.is_default) || pipeList[0];
      } else {
        activePipe = await pipelinesApi.create({ name: "Sales Pipeline", is_default: true });
        pipeList.push(activePipe);
      }

      setPipelines(pipeList);

      // Load stages from active pipeline
      let pipelineStages: DealStage[] = [];
      try {
        const fetchedPipe = await pipelinesApi.get(activePipe.id);
        pipelineStages = fetchedPipe.stages || [];
      } catch {
        pipelineStages = activePipe.stages || [];
      }

      if (!pipelineStages || pipelineStages.length === 0) {
        pipelineStages = await ensurePdfSalesStages(activePipe);
      }
      pipelineStages.sort((a, b) => a.stage_order - b.stage_order);
      setStages(pipelineStages);
      setActivePipeline(activePipe);

      // Load Deals
      await loadDeals(activePipe.id);
    } catch (err: any) {
      showToast(err.message || "Failed to load pipeline data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Ensure active pipeline contains all 9 PDF stages
  const ensurePdfSalesStages = async (pipeline: Pipeline): Promise<DealStage[]> => {
    try {
      let currentStages: DealStage[] = pipeline.stages || [];
      if (!currentStages || currentStages.length === 0) {
        currentStages = await pipelinesApi.get(pipeline.id).then((p) => p.stages || []).catch(() => []);
      }

      const updatedStages: DealStage[] = [];

      for (const target of PDF_SALES_STAGES) {
        let matched = currentStages.find((s) => s.name.trim().toLowerCase() === target.name.toLowerCase());

        if (!matched) {
          if (target.name === "New Opportunity") {
            matched = currentStages.find((s) =>
              ["qualified", "lead in", "discovery", "new"].includes(s.name.trim().toLowerCase())
            );
          } else if (target.name === "Requirement Discussion") {
            matched = currentStages.find((s) =>
              ["requirement", "contact made", "demo / proposal", "demo"].includes(s.name.trim().toLowerCase())
            );
          } else if (target.name === "Negotiation") {
            matched = currentStages.find((s) =>
              ["negotiation", "review"].includes(s.name.trim().toLowerCase())
            );
          } else if (target.name === "Won") {
            matched = currentStages.find((s) => s.is_won || ["closed won", "won"].includes(s.name.trim().toLowerCase()));
          } else if (target.name === "Lost") {
            matched = currentStages.find((s) => s.is_lost || ["closed lost", "lost"].includes(s.name.trim().toLowerCase()));
          }
        }

        if (matched) {
          if (
            matched.name !== target.name ||
            matched.stage_order !== target.order ||
            matched.color !== target.color
          ) {
            try {
              const updated = await pipelinesApi.updateStage(matched.id, {
                name: target.name,
                stage_order: target.order,
                color: target.color,
                is_won: target.is_won,
                is_lost: target.is_lost,
              });
              updatedStages.push(updated);
            } catch {
              updatedStages.push({
                ...matched,
                name: target.name,
                stage_order: target.order,
                color: target.color,
              });
            }
          } else {
            updatedStages.push(matched);
          }
        } else {
          try {
            const created = await pipelinesApi.createStage(pipeline.id, {
              name: target.name,
              stage_order: target.order,
              probability: target.probability,
              color: target.color,
              is_won: target.is_won,
              is_lost: target.is_lost,
            });
            updatedStages.push(created);
          } catch (createErr) {
            console.error("Failed to create PDF stage:", target.name, createErr);
          }
        }
      }

      updatedStages.sort((a, b) => a.stage_order - b.stage_order);
      return updatedStages;
    } catch (err) {
      console.error("Error ensuring PDF stages:", err);
      return pipeline.stages || [];
    }
  };

  // Open Stage Customization Modal
  const handleOpenCustomizeStages = () => {
    setEditingStages([...stages].map((s) => ({ ...s })).sort((a, b) => a.stage_order - b.stage_order));
    setNewCustomStageName("");
    setNewCustomStageColor("#3B82F6");
    setNewCustomStageProbability(50);
    setIsCustomizeStagesModalOpen(true);
  };

  const handleMoveStageUp = (index: number) => {
    if (index <= 0) return;
    const list = [...editingStages];
    const temp = list[index - 1];
    list[index - 1] = list[index];
    list[index] = temp;
    list.forEach((s, idx) => {
      s.stage_order = idx + 1;
    });
    setEditingStages(list);
  };

  const handleMoveStageDown = (index: number) => {
    if (index >= editingStages.length - 1) return;
    const list = [...editingStages];
    const temp = list[index + 1];
    list[index + 1] = list[index];
    list[index] = temp;
    list.forEach((s, idx) => {
      s.stage_order = idx + 1;
    });
    setEditingStages(list);
  };

  const handleToggleStageActive = (stageId: number) => {
    setEditingStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, is_active: s.is_active === false ? true : false } : s))
    );
  };

  const handleUpdateStageName = (stageId: number, name: string) => {
    setEditingStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, name } : s)));
  };

  const handleUpdateStageColor = (stageId: number, color: string) => {
    setEditingStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, color } : s)));
  };

  const handleUpdateStageProbability = (stageId: number, probability: number) => {
    setEditingStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, probability } : s)));
  };

  const handleAddNewCustomStage = async () => {
    const trimmed = newCustomStageName.trim();
    if (!trimmed) {
      showToast("Please enter a stage name", "error");
      return;
    }
    if (!activePipeline) return;

    try {
      const nextOrder = editingStages.length + 1;
      const created = await pipelinesApi.createStage(activePipeline.id, {
        name: trimmed,
        stage_order: nextOrder,
        probability: Number(newCustomStageProbability) || 50,
        color: newCustomStageColor || "#3B82F6",
        is_won: false,
        is_lost: false,
        is_active: true,
      });

      setEditingStages((prev) => [...prev, created]);
      setNewCustomStageName("");
      showToast(`Stage "${trimmed}" created successfully`);
    } catch (err: any) {
      showToast(err.message || "Failed to add stage", "error");
    }
  };

  const handleSaveCustomizedStages = async () => {
    if (!activePipeline) return;
    setIsSavingCustomStages(true);
    try {
      // 1. Update each stage in order
      for (const st of editingStages) {
        await pipelinesApi.updateStage(st.id, {
          name: st.name,
          stage_order: st.stage_order,
          probability: st.probability,
          color: st.color,
          is_active: st.is_active !== false,
        });
      }

      // 2. Reorder stages
      const stageIds = editingStages.map((s) => s.id);
      await pipelinesApi.reorderStages(activePipeline.id, stageIds);

      // 3. Refresh pipeline stages from backend
      const freshPipe = await pipelinesApi.get(activePipeline.id);
      const freshStages = (freshPipe.stages || []).sort((a, b) => a.stage_order - b.stage_order);
      setStages(freshStages);
      showToast("Stages updated successfully", "success");
      setIsCustomizeStagesModalOpen(false);

      // Reload Deals
      await loadDeals(activePipeline.id);
    } catch (err: any) {
      showToast(err.message || "Failed to save stages", "error");
    } finally {
      setIsSavingCustomStages(false);
    }
  };

  const handleQuickChangeStage = async (targetStageName: string) => {
    if (!selectedDeal || !activePipeline) return;
    const target = stages.find(
      (s) => s.name.trim().toLowerCase() === targetStageName.trim().toLowerCase()
    );
    if (!target) {
      showToast(`Stage "${targetStageName}" not found in current pipeline`, "error");
      return;
    }
    try {
      const updated = await dealsApi.changeStage(selectedDeal.id, target.id);
      setSelectedDeal(updated);
      setDrawerStageId(target.id);
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      showToast(`Stage updated to "${target.name}"`);
      await loadDeals();
    } catch (err: any) {
      showToast(err.message || "Failed to update stage", "error");
    }
  };

  const loadDeals = async (pipelineId?: number) => {
    try {
      const res = await dealsApi.list({
        pipeline_id: pipelineId || activePipeline?.id,
        limit: 200,
      });
      const rawItems = res.items || [];
      const uniqueDeals: Deal[] = [];
      const seen = new Set<number>();
      for (const d of rawItems) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          uniqueDeals.push(d);
        }
      }
      setDeals(uniqueDeals);
      if (onDealsCountChange) onDealsCountChange(uniqueDeals.length);
    } catch (err: any) {
      console.error("Failed to load deals:", err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDeals();
    setIsRefreshing(false);
  };

  // Filtered Deals with strict ID deduplication
  const filteredDeals = useMemo(() => {
    const seen = new Set<number>();
    return deals.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);

      if (selectedPriority !== "all" && d.priority !== selectedPriority) return false;
      if (selectedOwnerId !== "all" && String(d.owner_id) !== selectedOwnerId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const contactName = (d.customer?.name || "").toLowerCase();
        const companyName = (d.customer?.company || "").toLowerCase();
        const dealName = (d.name || "").toLowerCase();
        const leadNum = (d.lead_number || "").toLowerCase();
        if (!contactName.includes(q) && !companyName.includes(q) && !dealName.includes(q) && !leadNum.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [deals, selectedPriority, selectedOwnerId, searchQuery]);

  // Group deals strictly by stage so each deal appears in exactly ONE column
  const dealsByStage = useMemo(() => {
    const map: Record<number, Deal[]> = {};
    stages.forEach((s) => {
      map[s.id] = [];
    });

    const assignedDealIds = new Set<number>();

    filteredDeals.forEach((deal) => {
      if (assignedDealIds.has(deal.id)) return;

      if (map[deal.stage_id]) {
        map[deal.stage_id].push(deal);
        assignedDealIds.add(deal.id);
      } else if (stages.length > 0) {
        const firstStageId = stages[0].id;
        if (!map[firstStageId]) map[firstStageId] = [];
        map[firstStageId].push(deal);
        assignedDealIds.add(deal.id);
      }
    });

    return map;
  }, [stages, filteredDeals]);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, dealId: number) => {
    e.dataTransfer.setData("text/plain", String(dealId));
    e.dataTransfer.effectAllowed = "move";
    setDraggedDealId(dealId);
  };

  const handleDragEnd = () => {
    setDraggedDealId(null);
    setDragOverStageId(null);
  };

  const handleDragOver = (e: React.DragEvent, stageId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDragLeave = (stageId: number) => {
    if (dragOverStageId === stageId) {
      setDragOverStageId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: number) => {
    e.preventDefault();
    setDragOverStageId(null);
    const dealIdStr = e.dataTransfer.getData("text/plain");
    const dealId = Number(dealIdStr) || draggedDealId;
    setDraggedDealId(null);

    if (!dealId) return;

    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === targetStageId) return;

    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    // Optimistic UI update
    const previousDeals = [...deals];
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage_id: targetStageId, stage: targetStage } : d))
    );

    try {
      const updated = await dealsApi.changeStage(dealId, targetStageId);
      setDeals((prev) => prev.map((d) => (d.id === dealId ? updated : d)));
      if (selectedDeal && selectedDeal.id === dealId) {
        setSelectedDeal(updated);
        setDrawerStageId(targetStageId);
      }
      showToast(targetStage.is_won ? `🎉 Moved to ${targetStage.name}!` : `Moved to ${targetStage.name}`);
    } catch (err: any) {
      setDeals(previousDeals);
      showToast(err.message || "Failed to update stage", "error");
    }
  };

  // Populate drawer form state
  const populateDrawerForm = (deal: Deal, lead?: Lead | null) => {
    setDrawerDealName(deal.name);
    setDrawerCustomerId(deal.customer_id);
    setDrawerOwnerId(deal.owner_id || "");
    setDrawerValue(deal.value !== undefined ? deal.value : "");
    setDrawerStageId(deal.stage_id);
    setDrawerCloseDate(deal.expected_close_date ? deal.expected_close_date.split("T")[0] : "");
    setDrawerPriority(deal.priority || "Medium");
    setDrawerSource(lead?.source || "Website");
    setDrawerRequirement(deal.requirement || "");
    setDrawerNewNote("");
    setDrawerLostReason(deal.lost_reason || "");
  };

  // Open Detail Drawer (starts in View Mode)
  const handleOpenDrawer = async (deal: Deal) => {
    setSelectedDeal(deal);
    setIsEditMode(false);
    populateDrawerForm(deal);
    setLinkedLead(null);
    setDealNotes([]);
    setIsDrawerOpen(true);

    setIsDrawerLoading(true);
    try {
      // Parallel fetch lead info and deal notes
      const promises: Promise<any>[] = [
        dealsApi.listNotes(deal.id).catch(() => []),
      ];

      if (deal.lead_number) {
        promises.push(leadsApi.getOne(deal.lead_number).catch(() => null));
      }

      const [notes, lead] = await Promise.all(promises);
      setDealNotes(notes || []);
      if (lead) {
        setLinkedLead(lead);
        populateDrawerForm(deal, lead);
      }
    } catch (err) {
      console.warn("Could not fetch deal details:", err);
    } finally {
      setIsDrawerLoading(false);
    }
  };

  // Switch to Edit Mode
  const handleStartEdit = () => {
    if (selectedDeal) {
      populateDrawerForm(selectedDeal, linkedLead);
    }
    setIsEditMode(true);
  };

  // Cancel Editing (reverts to View Mode)
  const handleCancelEdit = () => {
    if (selectedDeal) {
      populateDrawerForm(selectedDeal, linkedLead);
    }
    setIsEditMode(false);
  };

  // Save changes from Detail Drawer
  const handleSaveDeal = async () => {
    if (!selectedDeal) return;
    if (!drawerDealName.trim()) {
      showToast("Deal name is required", "error");
      return;
    }

    setIsSavingDeal(true);
    try {
      const stageChanged = drawerStageId !== selectedDeal.stage_id;

      // 1. Update Deal via dealsApi.update
      const updated = await dealsApi.update(selectedDeal.id, {
        name: drawerDealName.trim(),
        customer_id: typeof drawerCustomerId === "number" ? drawerCustomerId : undefined,
        owner_id: drawerOwnerId ? Number(drawerOwnerId) : undefined,
        value: drawerValue !== "" ? Number(drawerValue) : 0,
        priority: drawerPriority,
        expected_close_date: drawerCloseDate ? new Date(drawerCloseDate).toISOString() : undefined,
        requirement: drawerRequirement.trim(),
        lost_reason: drawerLostReason.trim() || undefined,
      });

      let finalDeal = updated;

      // 2. If stage changed via dropdown
      if (stageChanged && typeof drawerStageId === "number") {
        finalDeal = await dealsApi.changeStage(selectedDeal.id, drawerStageId, drawerLostReason.trim());
      }

      // 3. Update linked lead source if changed
      if (selectedDeal.lead_number && drawerSource) {
        try {
          await leadsApi.update(selectedDeal.lead_number, {
            source: drawerSource as any,
          });
          if (linkedLead) {
            setLinkedLead({ ...linkedLead, source: drawerSource as any });
          }
        } catch (leadErr) {
          console.warn("Could not update lead source:", leadErr);
        }
      }

      // 4. Create new note if user typed one
      if (drawerNewNote.trim()) {
        try {
          const newNote = await dealsApi.createNote(selectedDeal.id, drawerNewNote.trim());
          setDealNotes((prev) => [newNote, ...prev]);
          setDrawerNewNote("");
        } catch (noteErr) {
          console.warn("Could not save note:", noteErr);
        }
      }

      // Re-fetch deal to ensure fresh relations (customer, owner, stage)
      try {
        const fresh = await dealsApi.get(selectedDeal.id);
        finalDeal = fresh;
      } catch {}

      setDeals((prev) => prev.map((d) => (d.id === finalDeal.id ? finalDeal : d)));
      setSelectedDeal(finalDeal);
      setIsEditMode(false);
      showToast("Deal updated successfully");
    } catch (err: any) {
      showToast(err.message || "Failed to update deal", "error");
    } finally {
      setIsSavingDeal(false);
    }
  };

  // Delete Deal from Detail Drawer with confirmation
  const handleDeleteDeal = async () => {
    if (!selectedDeal) return;
    const confirmMessage = `Are you sure you want to delete deal "${selectedDeal.name}"?\n\nThis action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeletingDeal(true);
    try {
      await dealsApi.delete(selectedDeal.id);
      const updatedDeals = deals.filter((d) => d.id !== selectedDeal.id);
      setDeals(updatedDeals);
      if (onDealsCountChange) onDealsCountChange(updatedDeals.length);
      setIsDrawerOpen(false);
      setSelectedDeal(null);
      setIsEditMode(false);
      showToast("Deal deleted successfully");
    } catch (err: any) {
      showToast(err.message || "Failed to delete deal", "error");
    } finally {
      setIsDeletingDeal(false);
    }
  };

  // Open Create Deal Modal
  const handleOpenCreateModal = (preselectedStageId?: number) => {
    setNewDealName("");
    setNewDealCustomerId(customers.length > 0 ? customers[0].id : "");
    setNewDealStageId(preselectedStageId || (stages.length > 0 ? stages[0].id : ""));
    setNewDealOwnerId(currentUser?.id || "");
    setNewDealValue("");
    setNewDealPriority("Medium");
    setNewDealCloseDate("");
    setNewDealRequirement("");
    setIsCreatingInlineCustomer(false);
    setInlineCustName("");
    setInlineCustCompany("");
    setInlineCustEmail("");
    setInlineCustPhone("");
    setIsNewDealModalOpen(true);
  };

  // Create New Deal
  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealName.trim()) {
      showToast("Please provide a Deal name", "error");
      return;
    }

    if (!activePipeline) {
      showToast("Pipeline is not ready", "error");
      return;
    }

    setIsSubmittingNewDeal(true);
    try {
      let custId = typeof newDealCustomerId === "number" ? newDealCustomerId : null;

      if (isCreatingInlineCustomer) {
        if (!inlineCustName.trim()) {
          showToast("Customer name is required", "error");
          setIsSubmittingNewDeal(false);
          return;
        }
        const newCust = await customersApi.create({
          name: inlineCustName.trim(),
          company: inlineCustCompany.trim() || undefined,
          email: inlineCustEmail.trim() || undefined,
          phone: inlineCustPhone.trim() || undefined,
        });
        setCustomers((prev) => [newCust, ...prev]);
        custId = newCust.id;
      }

      if (!custId) {
        showToast("Please select or create a customer/contact", "error");
        setIsSubmittingNewDeal(false);
        return;
      }

      const stageIdToUse = typeof newDealStageId === "number" ? newDealStageId : stages[0]?.id;
      if (!stageIdToUse) {
        showToast("Stage is required", "error");
        setIsSubmittingNewDeal(false);
        return;
      }

      const created = await dealsApi.create({
        name: newDealName.trim(),
        customer_id: custId,
        pipeline_id: activePipeline.id,
        stage_id: stageIdToUse,
        owner_id: newDealOwnerId ? Number(newDealOwnerId) : undefined,
        value: newDealValue !== "" ? Number(newDealValue) : 0,
        priority: newDealPriority,
        expected_close_date: newDealCloseDate ? new Date(newDealCloseDate).toISOString() : undefined,
        requirement: newDealRequirement.trim(),
      });

      const updatedDeals = [created, ...deals.filter((d) => d.id !== created.id)];
      setDeals(updatedDeals);
      if (onDealsCountChange) onDealsCountChange(updatedDeals.length);
      setIsNewDealModalOpen(false);
      showToast(`Deal "${created.name}" created successfully`);
    } catch (err: any) {
      showToast(err.message || "Failed to create deal", "error");
    } finally {
      setIsSubmittingNewDeal(false);
    }
  };

  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard`);
  };

  // Helper: Format currency
  const formatCurrency = (val: number, currency = "INR") => {
    const isINR = !currency || currency.toUpperCase() === "INR";
    const symbol = isINR ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency + " ";
    return `${symbol}${val.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#F8FAFC",
        color: "#0F172A",
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
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
            padding: "12px 18px",
            borderRadius: "12px",
            backgroundColor: toastMessage.type === "error" ? "#FEF2F2" : "#ECFDF5",
            border: `1px solid ${toastMessage.type === "error" ? "#FCA5A5" : "#A7F3D0"}`,
            color: toastMessage.type === "error" ? "#991B1B" : "#065F46",
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
      {!hideSidebar && (
        <Sidebar
          activeTab={activeSidebarTab}
          onSelectTab={(tab) => {
            setActiveSidebarTab(tab);
            if (tab === "leads") router.push("/leads");
            else if (tab === "quotations") router.push("/quotations");
            else if (tab === "orders") router.push("/orders");
            else if (tab === "products") router.push("/products");
            else if (tab === "follow-ups") router.push("/follow-ups");
            else if (tab === "company") router.push("/company");
            else if (tab === "api-keys") router.push("/leads?tab=api-keys");
            else if (tab === "api-docs") router.push("/leads?tab=api-docs");
            else if (tab === "profile") router.push("/leads?tab=profile");
          }}
          dealsCount={deals.length}
          user={currentUser}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenAdminSettings={() => {}}
        />
      )}

      {/* Main Content View */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        {/* Top Header / Toolbar styled exactly matching Leads and Products pages */}
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
                backgroundColor: "#EFF6FF",
                border: "1px solid #DBEAFE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2563EB",
              }}
            >
              <Briefcase size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                  Deals & Pipeline
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
                  {filteredDeals.length} {filteredDeals.length === 1 ? "Deal" : "Deals"}
                </span>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "2px 0 0 0" }}>
                9-Stage Sales Kanban • Click card to view & edit details
              </p>
            </div>
          </div>

          {/* Search, Filters, and Add Button */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            {/* Search Box */}
            <div style={{ position: "relative", minWidth: "240px" }}>
              <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search lead or company..."
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
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
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

            {/* Owner Filter */}
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              style={{
                padding: "8px 12px",
                fontSize: "0.8125rem",
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                color: "#334155",
                fontWeight: 500,
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All Owners</option>
              {teamUsers.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name || u.email}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              style={{
                padding: "8px 12px",
                fontSize: "0.8125rem",
                backgroundColor: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                color: "#334155",
                fontWeight: 500,
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Pipeline"
              style={{
                padding: "8px 10px",
                color: "#475569",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} color={isRefreshing ? "#2563EB" : "#475569"} />
            </button>

            {/* Customize Stages Button */}
            <button
              onClick={handleOpenCustomizeStages}
              title="Customize Pipeline Stages"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#1E293B",
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Sliders size={15} color="#009F9A" />
              <span>Customize Stages</span>
            </button>

            {/* + Add Deal Button */}
            <button
              onClick={() => handleOpenCreateModal()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "#009F9A",
                border: "none",
                borderRadius: "8px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                cursor: "pointer",
                transition: "background-color 0.15s ease",
              }}
            >
              <Plus size={16} />
              <span>Add Deal</span>
            </button>
          </div>
        </header>

        {/* 9-Stage Kanban Board Container */}
        <main
          style={{
            flex: 1,
            overflowX: "auto",
            overflowY: "hidden",
            padding: "20px 24px",
            backgroundColor: "#F1F5F9",
          }}
        >
          {isLoading ? (
            <div style={{ height: "400px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#64748B" }}>
              <RefreshCw size={32} color="#009F9A" className="animate-spin" />
              <p style={{ fontSize: "0.875rem", fontWeight: 600 }}>Loading 9-Stage Kanban pipeline...</p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "16px", minWidth: "max-content", height: "100%", alignItems: "stretch" }}>
              {stages
                .filter((stage) => stage.is_active !== false || (dealsByStage[stage.id] && dealsByStage[stage.id].length > 0))
                .map((stage) => {
                  const stageDeals = dealsByStage[stage.id] || [];
                  const isDragTarget = dragOverStageId === stage.id;
                  const isDisabled = stage.is_active === false;

                  return (
                    <div
                      key={stage.id}
                      onDragOver={(e) => handleDragOver(e, stage.id)}
                      onDragLeave={() => handleDragLeave(stage.id)}
                      onDrop={(e) => handleDrop(e, stage.id)}
                      style={{
                        width: "270px",
                        display: "flex",
                        flexDirection: "column",
                        borderRadius: "12px",
                        border: isDragTarget ? "2px dashed #009F9A" : "1px solid #E2E8F0",
                        backgroundColor: isDragTarget ? "#E6FFFA" : "#F8FAFC",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                        height: "100%",
                        overflow: "hidden",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {/* Column Header */}
                      <div
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid #E2E8F0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          backgroundColor: "#FFFFFF",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                          <span
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "999px",
                              backgroundColor: stage.color || "#009F9A",
                              flexShrink: 0,
                            }}
                          />
                          <h2
                            title={stage.name}
                            style={{
                              fontSize: "0.8125rem",
                              fontWeight: 700,
                              color: isDisabled ? "#64748B" : "#0F172A",
                              margin: 0,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {stage.name}
                          </h2>
                          {isDisabled && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "1px 5px",
                                borderRadius: "4px",
                                fontSize: "0.625rem",
                                fontWeight: 700,
                                backgroundColor: "#FEF2F2",
                                color: "#DC2626",
                                border: "1px solid #FECACA",
                                flexShrink: 0,
                              }}
                            >
                              Disabled
                            </span>
                          )}
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "2px 7px",
                              borderRadius: "999px",
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              backgroundColor: "#F1F5F9",
                              color: "#475569",
                            }}
                          >
                            {stageDeals.length}
                          </span>
                        </div>

                      {/* Quick Add to Column */}
                      <button
                        onClick={() => handleOpenCreateModal(stage.id)}
                        title={`Add Deal to ${stage.name}`}
                        style={{
                          width: "26px",
                          height: "26px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "6px",
                          border: "none",
                          backgroundColor: "transparent",
                          color: "#64748B",
                          cursor: "pointer",
                          transition: "background-color 0.15s",
                        }}
                      >
                        <Plus size={15} />
                      </button>
                    </div>

                    {/* Column Body: Deals List */}
                    <div
                      style={{
                        padding: "10px",
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        overflowY: "auto",
                      }}
                    >
                      {stageDeals.length === 0 ? (
                        <div
                          style={{
                            flex: 1,
                            minHeight: "120px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "8px",
                            border: "1px dashed #CBD5E1",
                            color: "#94A3B8",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            padding: "16px",
                            textAlign: "center",
                          }}
                        >
                          Drop deals here
                        </div>
                      ) : (
                        stageDeals.map((deal) => {
                          const contactName =
                            deal.customer?.name ||
                            (deal.lead_number ? `Lead ${deal.lead_number}` : deal.name);
                          const companyName = deal.customer?.company || deal.name;
                          const isBeingDragged = draggedDealId === deal.id;

                          return (
                            <div
                              key={deal.id}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, deal.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => handleOpenDrawer(deal)}
                              style={{
                                backgroundColor: "#FFFFFF",
                                borderRadius: "10px",
                                border: "1px solid #E2E8F0",
                                padding: "12px 14px",
                                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                                cursor: "grab",
                                opacity: isBeingDragged ? 0.4 : 1,
                                transition: "box-shadow 0.15s ease, border-color 0.15s ease, transform 0.15s ease",
                                userSelect: "none",
                              }}
                            >
                              {/* Primary Title: Lead/Contact Name */}
                              <div
                                style={{
                                  fontSize: "0.875rem",
                                  fontWeight: 600,
                                  color: "#0F172A",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  marginBottom: "4px",
                                }}
                              >
                                {contactName}
                              </div>

                              {/* Secondary Subtitle: Company Name */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  fontSize: "0.75rem",
                                  color: "#64748B",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                <Building size={13} color="#94A3B8" style={{ flexShrink: 0 }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{companyName}</span>
                              </div>

                              {/* Card Badges: Deal Number, Lead Badge, Deal Value */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  flexWrap: "wrap",
                                  gap: "6px",
                                  marginTop: "8px",
                                  paddingTop: "6px",
                                  borderTop: "1px solid #F1F5F9",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", backgroundColor: "#F1F5F9", padding: "1px 5px", borderRadius: "4px" }}>
                                    {deal.deal_number}
                                  </span>
                                  {deal.lead_number && (
                                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#009F9A", backgroundColor: "#E6FFFA", padding: "1px 5px", borderRadius: "4px" }}>
                                      Lead #{deal.lead_number}
                                    </span>
                                  )}
                                </div>
                                {deal.value > 0 && (
                                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0F766E" }}>
                                    {formatCurrency(deal.value, deal.currency)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* DETAIL DRAWER: View Mode & Edit Mode with Full CRUD                       */}
      {/* ========================================================================= */}
      {isDrawerOpen && selectedDeal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9000,
            display: "flex",
            justifyContent: "flex-end",
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "580px",
              backgroundColor: "#FFFFFF",
              height: "100%",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid #E2E8F0",
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid #E2E8F0",
                backgroundColor: "#F8FAFC",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                    {selectedDeal.deal_number}
                  </span>
                  {selectedDeal.stage && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        backgroundColor: selectedDeal.stage.color || "#009F9A",
                      }}
                    >
                      {selectedDeal.stage.name}
                    </span>
                  )}
                  {selectedDeal.priority && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        backgroundColor: "#E2E8F0",
                        color: "#334155",
                      }}
                    >
                      {selectedDeal.priority}
                    </span>
                  )}
                  {isEditMode && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        backgroundColor: "#FEF3C7",
                        color: "#D97706",
                        border: "1px solid #FDE68A",
                      }}
                    >
                      Editing Mode
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                  {selectedDeal.name}
                </h2>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {!isEditMode && (
                  <button
                    onClick={handleStartEdit}
                    title="Edit Deal"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#009F9A",
                      backgroundColor: "#E8F7F5",
                      border: "1px solid #A7F3D0",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <Edit3 size={14} />
                    <span>Edit</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsDrawerOpen(false);
                    setIsEditMode(false);
                  }}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#64748B",
                    cursor: "pointer",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                backgroundColor: "#F8FAFC",
              }}
            >
              {isDrawerLoading ? (
                <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "#64748B", fontSize: "0.875rem" }}>
                  <RefreshCw size={24} className="animate-spin" color="#009F9A" />
                  <span>Loading deal details...</span>
                </div>
              ) : isEditMode ? (
                /* ========================================================================= */
                /* EDIT MODE                                                                */
                /* ========================================================================= */
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {/* Card: Deal Information Form */}
                  <div
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      padding: "18px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        paddingBottom: "12px",
                        borderBottom: "1px solid #F1F5F9",
                        marginBottom: "14px",
                      }}
                    >
                      <Briefcase size={16} color="#009F9A" />
                      <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                        Edit Deal Information
                      </h3>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {/* Deal Name */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                          Deal Name <span style={{ color: "#EF4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={drawerDealName}
                          onChange={(e) => setDrawerDealName(e.target.value)}
                          placeholder="e.g. Enterprise License"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: "0.8125rem",
                            backgroundColor: "#F8FAFC",
                            border: "1px solid #CBD5E1",
                            borderRadius: "8px",
                            outline: "none",
                            color: "#0F172A",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      {/* Customer / Lead Dropdown */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                          Customer / Lead
                        </label>
                        <select
                          value={drawerCustomerId}
                          onChange={(e) => setDrawerCustomerId(e.target.value ? Number(e.target.value) : "")}
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            fontSize: "0.8125rem",
                            backgroundColor: "#F8FAFC",
                            border: "1px solid #CBD5E1",
                            borderRadius: "8px",
                            outline: "none",
                            color: "#0F172A",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="">Select customer...</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.company ? `(${c.company})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Value & Stage */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                            Deal Value
                          </label>
                          <div style={{ position: "relative" }}>
                            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "0.75rem", fontWeight: 700, color: "#94A3B8" }}>
                              {selectedDeal.currency || "₹"}
                            </span>
                            <input
                              type="number"
                              value={drawerValue}
                              onChange={(e) => setDrawerValue(e.target.value === "" ? "" : Number(e.target.value))}
                              placeholder="0"
                              style={{
                                width: "100%",
                                paddingLeft: "26px",
                                paddingRight: "10px",
                                paddingTop: "8px",
                                paddingBottom: "8px",
                                fontSize: "0.8125rem",
                                backgroundColor: "#F8FAFC",
                                border: "1px solid #CBD5E1",
                                borderRadius: "8px",
                                outline: "none",
                                color: "#0F172A",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                            Stage
                          </label>
                          <select
                            value={drawerStageId}
                            onChange={(e) => setDrawerStageId(Number(e.target.value))}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              fontSize: "0.8125rem",
                              backgroundColor: "#F8FAFC",
                              border: "1px solid #CBD5E1",
                              borderRadius: "8px",
                              outline: "none",
                              color: "#0F172A",
                              fontWeight: 500,
                              cursor: "pointer",
                              boxSizing: "border-box",
                            }}
                          >
                            {stages
                              .filter((st) => st.is_active !== false || st.id === drawerStageId)
                              .map((st) => (
                                <option key={st.id} value={st.id}>
                                  {st.name} {st.is_active === false ? "(Disabled)" : ""}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* Owner & Priority */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                            Owner
                          </label>
                          <select
                            value={drawerOwnerId}
                            onChange={(e) => setDrawerOwnerId(e.target.value ? Number(e.target.value) : "")}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              fontSize: "0.8125rem",
                              backgroundColor: "#F8FAFC",
                              border: "1px solid #CBD5E1",
                              borderRadius: "8px",
                              outline: "none",
                              color: "#0F172A",
                              cursor: "pointer",
                              boxSizing: "border-box",
                            }}
                          >
                            <option value="">Unassigned</option>
                            {teamUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name || u.email}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                            Priority
                          </label>
                          <select
                            value={drawerPriority}
                            onChange={(e) => setDrawerPriority(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              fontSize: "0.8125rem",
                              backgroundColor: "#F8FAFC",
                              border: "1px solid #CBD5E1",
                              borderRadius: "8px",
                              outline: "none",
                              color: "#0F172A",
                              cursor: "pointer",
                              boxSizing: "border-box",
                            }}
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                          </select>
                        </div>
                      </div>

                      {/* Close Date & Source */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                            Expected Close Date
                          </label>
                          <input
                            type="date"
                            value={drawerCloseDate}
                            onChange={(e) => setDrawerCloseDate(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              fontSize: "0.8125rem",
                              backgroundColor: "#F8FAFC",
                              border: "1px solid #CBD5E1",
                              borderRadius: "8px",
                              outline: "none",
                              color: "#0F172A",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                            Lead Source
                          </label>
                          <select
                            value={drawerSource}
                            onChange={(e) => setDrawerSource(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              fontSize: "0.8125rem",
                              backgroundColor: "#F8FAFC",
                              border: "1px solid #CBD5E1",
                              borderRadius: "8px",
                              outline: "none",
                              color: "#0F172A",
                              cursor: "pointer",
                              boxSizing: "border-box",
                            }}
                          >
                            <option value="Website">Website</option>
                            <option value="Referral">Referral</option>
                            <option value="Cold Call">Cold Call</option>
                            <option value="Social Media">Social Media</option>
                            <option value="Google Ads">Google Ads</option>
                            <option value="Direct">Direct</option>
                          </select>
                        </div>
                      </div>

                      {/* Lost Reason if Lost */}
                      {(stages.find((s) => s.id === drawerStageId)?.is_lost || drawerLostReason) && (
                        <div>
                          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#DC2626", marginBottom: "4px" }}>
                            Lost Reason
                          </label>
                          <input
                            type="text"
                            value={drawerLostReason}
                            onChange={(e) => setDrawerLostReason(e.target.value)}
                            placeholder="e.g. Price too high, chose competitor"
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              fontSize: "0.8125rem",
                              backgroundColor: "#FEF2F2",
                              border: "1px solid #FCA5A5",
                              borderRadius: "8px",
                              outline: "none",
                              color: "#991B1B",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                      )}

                      {/* Requirement */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                          Requirement
                        </label>
                        <textarea
                          rows={3}
                          value={drawerRequirement}
                          onChange={(e) => setDrawerRequirement(e.target.value)}
                          placeholder="Client specifications or requirements..."
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: "0.8125rem",
                            backgroundColor: "#F8FAFC",
                            border: "1px solid #CBD5E1",
                            borderRadius: "8px",
                            outline: "none",
                            color: "#0F172A",
                            resize: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      {/* Add Note */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                          Add Deal Note
                        </label>
                        <textarea
                          rows={2}
                          value={drawerNewNote}
                          onChange={(e) => setDrawerNewNote(e.target.value)}
                          placeholder="Type a new note to attach to this deal..."
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: "0.8125rem",
                            backgroundColor: "#F8FAFC",
                            border: "1px solid #CBD5E1",
                            borderRadius: "8px",
                            outline: "none",
                            color: "#0F172A",
                            resize: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ========================================================================= */
                /* VIEW MODE                                                                */
                /* ========================================================================= */
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {/* Quick Stage Progression Buttons */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "8px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>
                      Quick Move:
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleQuickChangeStage("Negotiation")}
                        style={{
                          padding: "5px 10px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          borderRadius: "6px",
                          border: "1px solid #FCD34D",
                          backgroundColor: "#FEF3C7",
                          color: "#92400E",
                          cursor: "pointer",
                        }}
                      >
                        Negotiation
                      </button>
                      <button
                        onClick={() => handleQuickChangeStage("Final Amount Confirmed")}
                        style={{
                          padding: "5px 10px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          borderRadius: "6px",
                          border: "1px solid #6EE7B7",
                          backgroundColor: "#ECFDF5",
                          color: "#065F46",
                          cursor: "pointer",
                        }}
                      >
                        Final Amount
                      </button>
                      <button
                        onClick={() => handleQuickChangeStage("Won")}
                        style={{
                          padding: "5px 10px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          borderRadius: "6px",
                          border: "1px solid #A7F3D0",
                          backgroundColor: "#D1FAE5",
                          color: "#047857",
                          cursor: "pointer",
                        }}
                      >
                        Won 🎉
                      </button>
                      <button
                        onClick={() => handleQuickChangeStage("Lost")}
                        style={{
                          padding: "5px 10px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          borderRadius: "6px",
                          border: "1px solid #FECACA",
                          backgroundColor: "#FEF2F2",
                          color: "#991B1B",
                          cursor: "pointer",
                        }}
                      >
                        Lost
                      </button>
                    </div>
                  </div>

                  {/* Card 1: Deal Information Overview */}
                  <div
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      padding: "18px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingBottom: "12px",
                        borderBottom: "1px solid #F1F5F9",
                        marginBottom: "14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Briefcase size={16} color="#009F9A" />
                        <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                          Deal Information
                        </h3>
                      </div>
                      <span
                        style={{
                          fontSize: "1rem",
                          fontWeight: 700,
                          color: "#009F9A",
                        }}
                      >
                        {formatCurrency(selectedDeal.value || 0, selectedDeal.currency)}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.8125rem" }}>
                      <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                        <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, display: "block", marginBottom: "2px" }}>Stage</span>
                        <span style={{ fontWeight: 600, color: selectedDeal.stage?.color || "#0F172A" }}>
                          {selectedDeal.stage?.name || "N/A"}
                        </span>
                      </div>

                      <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                        <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, display: "block", marginBottom: "2px" }}>Owner</span>
                        <span style={{ fontWeight: 600, color: "#0F172A" }}>
                          {selectedDeal.owner?.name || "Unassigned"}
                        </span>
                      </div>

                      <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                        <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, display: "block", marginBottom: "2px" }}>Expected Close</span>
                        <span style={{ fontWeight: 600, color: "#0F172A" }}>
                          {selectedDeal.expected_close_date
                            ? new Date(selectedDeal.expected_close_date).toLocaleDateString()
                            : "Not set"}
                        </span>
                      </div>

                      <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                        <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, display: "block", marginBottom: "2px" }}>Priority</span>
                        <span style={{ fontWeight: 600, color: "#0F172A" }}>
                          {selectedDeal.priority || "Medium"}
                        </span>
                      </div>
                    </div>

                    {/* Lost Reason if lost */}
                    {selectedDeal.lost_reason && (
                      <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5" }}>
                        <span style={{ fontSize: "0.6875rem", color: "#DC2626", fontWeight: 600, display: "block", marginBottom: "2px" }}>Lost Reason</span>
                        <p style={{ color: "#991B1B", margin: 0, fontSize: "0.8125rem" }}>{selectedDeal.lost_reason}</p>
                      </div>
                    )}

                    {/* Requirement text */}
                    {selectedDeal.requirement && (
                      <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                        <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, display: "block", marginBottom: "2px" }}>Requirement</span>
                        <p style={{ color: "#334155", margin: 0, fontSize: "0.8125rem", lineHeight: 1.5 }}>
                          {selectedDeal.requirement}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Lead & Contact Information */}
                  <div
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      padding: "18px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingBottom: "12px",
                        borderBottom: "1px solid #F1F5F9",
                        marginBottom: "14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Building size={16} color="#009F9A" />
                        <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                          Lead & Contact Details
                        </h3>
                      </div>

                      {selectedDeal.lead_number && (
                        <Link
                          href={`/leads?search=${selectedDeal.lead_number}`}
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 700,
                            color: "#009F9A",
                            backgroundColor: "#E8F7F5",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            border: "1px solid #A7F3D0",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span>Lead #{selectedDeal.lead_number}</span>
                          <ExternalLink size={11} />
                        </Link>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.8125rem" }}>
                      {/* Name & Company */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                          <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, display: "block", marginBottom: "2px" }}>Contact Name</span>
                          <span style={{ fontWeight: 600, color: "#0F172A" }}>
                            {selectedDeal.customer?.name || linkedLead?.name || "N/A"}
                          </span>
                        </div>

                        <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                          <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, display: "block", marginBottom: "2px" }}>Company</span>
                          <span style={{ fontWeight: 600, color: "#0F172A" }}>
                            {selectedDeal.customer?.company || (linkedLead?.custom_fields?.company as string) || "N/A"}
                          </span>
                        </div>
                      </div>

                      {/* Phone & Email */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, display: "block", marginBottom: "2px" }}>Phone</span>
                            {selectedDeal.customer?.phone || linkedLead?.phone ? (
                              <a
                                href={`tel:${selectedDeal.customer?.phone || linkedLead?.phone}`}
                                style={{ fontWeight: 600, color: "#009F9A", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}
                              >
                                {selectedDeal.customer?.phone || linkedLead?.phone}
                              </a>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>N/A</span>
                            )}
                          </div>
                          {(selectedDeal.customer?.phone || linkedLead?.phone) && (
                            <button
                              onClick={() => handleCopyText(selectedDeal.customer?.phone || linkedLead?.phone || "", "Phone")}
                              style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: "4px" }}
                              title="Copy Phone"
                            >
                              <Copy size={13} />
                            </button>
                          )}
                        </div>

                        <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, display: "block", marginBottom: "2px" }}>Email</span>
                            {selectedDeal.customer?.email || linkedLead?.email ? (
                              <a
                                href={`mailto:${selectedDeal.customer?.email || linkedLead?.email}`}
                                style={{ fontWeight: 600, color: "#009F9A", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}
                              >
                                {selectedDeal.customer?.email || linkedLead?.email}
                              </a>
                            ) : (
                              <span style={{ color: "#94A3B8" }}>N/A</span>
                            )}
                          </div>
                          {(selectedDeal.customer?.email || linkedLead?.email) && (
                            <button
                              onClick={() => handleCopyText(selectedDeal.customer?.email || linkedLead?.email || "", "Email")}
                              style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: "4px" }}
                              title="Copy Email"
                            >
                              <Copy size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Source & Status */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                          <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, display: "block", marginBottom: "2px" }}>Lead Source</span>
                          <span style={{ fontWeight: 600, color: "#334155" }}>
                            {linkedLead?.source || "Website / Converted"}
                          </span>
                        </div>

                        <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                          <span style={{ fontSize: "0.6875rem", color: "#94A3B8", fontWeight: 500, display: "block", marginBottom: "2px" }}>Lead Status</span>
                          <span style={{ fontWeight: 600, color: "#334155" }}>
                            {linkedLead?.status || "Converted"}
                          </span>
                        </div>
                      </div>

                      {/* Open Full Lead */}
                      {selectedDeal.lead_number && (
                        <div style={{ paddingTop: "4px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectLead) {
                                onSelectLead(selectedDeal.lead_number!);
                              } else {
                                router.push(`/leads?search=${selectedDeal.lead_number}`);
                              }
                            }}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              padding: "8px 14px",
                              fontSize: "0.8125rem",
                              fontWeight: 600,
                              color: "#009F9A",
                              backgroundColor: "#E8F7F5",
                              border: "1px solid #A7F3D0",
                              borderRadius: "8px",
                              cursor: "pointer",
                            }}
                          >
                            <span>Open Full Lead Record</span>
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Deal Notes */}
                  {dealNotes.length > 0 && (
                    <div
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        padding: "18px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          paddingBottom: "12px",
                          borderBottom: "1px solid #F1F5F9",
                          marginBottom: "14px",
                        }}
                      >
                        <MessageSquare size={16} color="#009F9A" />
                        <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                          Deal Notes ({dealNotes.length})
                        </h3>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {dealNotes.map((note) => (
                          <div
                            key={note.id}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "8px",
                              backgroundColor: "#F8FAFC",
                              border: "1px solid #F1F5F9",
                            }}
                          >
                            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#334155", lineHeight: 1.5 }}>
                              {note.content}
                            </p>
                            <span style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "4px", display: "block" }}>
                              {new Date(note.created_at).toLocaleString()}
                              {note.user ? ` • ${note.user.name || note.user.email}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer: Actions */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E2E8F0",
                backgroundColor: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Delete Deal (Always available with confirmation) */}
              <button
                type="button"
                onClick={handleDeleteDeal}
                disabled={isDeletingDeal}
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
                <Trash2 size={15} />
                <span>{isDeletingDeal ? "Deleting..." : "Delete Deal"}</span>
              </button>

              {/* View Mode Footer vs Edit Mode Footer */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {isEditMode ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSavingDeal}
                      style={{
                        padding: "8px 16px",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#475569",
                        backgroundColor: "#F1F5F9",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDeal}
                      disabled={isSavingDeal}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 18px",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#FFFFFF",
                        backgroundColor: "#009F9A",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      {isSavingDeal ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      <span>{isSavingDeal ? "Saving..." : "Save Changes"}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsDrawerOpen(false)}
                      style={{
                        padding: "8px 16px",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#475569",
                        backgroundColor: "#F1F5F9",
                        border: "1px solid #E2E8F0",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedDeal) {
                          router.push(`/quotations?deal_id=${selectedDeal.id}`);
                        }
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 16px",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#0F766E",
                        backgroundColor: "#F0FDFA",
                        border: "1px solid #99F6E4",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      <FileText size={14} />
                      <span>Create Quotation</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 18px",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#FFFFFF",
                        backgroundColor: "#009F9A",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      <Edit3 size={14} />
                      <span>Edit Deal</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NEW DEAL MODAL                                                            */}
      {/* ========================================================================= */}
      {isNewDealModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(2px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #E2E8F0",
                backgroundColor: "#F8FAFC",
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
                    borderRadius: "10px",
                    backgroundColor: "#E8F7F5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#009F9A",
                  }}
                >
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Create New Deal
                  </h3>
                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "2px 0 0 0" }}>
                    Add a deal to the 9-stage pipeline
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsNewDealModalOpen(false)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "#64748B",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateDeal} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "75vh", overflowY: "auto" }}>
              {/* Deal Name */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Deal Name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newDealName}
                  onChange={(e) => setNewDealName(e.target.value)}
                  placeholder="e.g. Enterprise License Deal"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "0.8125rem",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    outline: "none",
                    color: "#0F172A",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Customer Selection or Inline Creation */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                    Customer / Lead <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingInlineCustomer(!isCreatingInlineCustomer)}
                    style={{ background: "none", border: "none", color: "#009F9A", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                    {isCreatingInlineCustomer ? "Select existing customer" : "+ Create new customer"}
                  </button>
                </div>

                {!isCreatingInlineCustomer ? (
                  <select
                    value={newDealCustomerId}
                    onChange={(e) => setNewDealCustomerId(e.target.value ? Number(e.target.value) : "")}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "0.8125rem",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      outline: "none",
                      color: "#0F172A",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">Select a customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ padding: "12px", backgroundColor: "#E8F7F5", borderRadius: "10px", border: "1px solid #A7F3D0", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <input
                        type="text"
                        placeholder="Contact Name *"
                        required
                        value={inlineCustName}
                        onChange={(e) => setInlineCustName(e.target.value)}
                        style={{ padding: "6px 10px", fontSize: "0.75rem", backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", boxSizing: "border-box" }}
                      />
                      <input
                        type="text"
                        placeholder="Company Name"
                        value={inlineCustCompany}
                        onChange={(e) => setInlineCustCompany(e.target.value)}
                        style={{ padding: "6px 10px", fontSize: "0.75rem", backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={inlineCustEmail}
                        onChange={(e) => setInlineCustEmail(e.target.value)}
                        style={{ padding: "6px 10px", fontSize: "0.75rem", backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", boxSizing: "border-box" }}
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        value={inlineCustPhone}
                        onChange={(e) => setInlineCustPhone(e.target.value)}
                        style={{ padding: "6px 10px", fontSize: "0.75rem", backgroundColor: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Stage & Value */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Pipeline Stage
                  </label>
                  <select
                    value={newDealStageId}
                    onChange={(e) => setNewDealStageId(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "0.8125rem",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      outline: "none",
                      color: "#0F172A",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    {stages
                      .filter((st) => st.is_active !== false)
                      .map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Deal Value (₹ / $)
                  </label>
                  <input
                    type="number"
                    value={newDealValue}
                    onChange={(e) => setNewDealValue(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="10000"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: "0.8125rem",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      outline: "none",
                      color: "#0F172A",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Owner & Priority */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Owner
                  </label>
                  <select
                    value={newDealOwnerId}
                    onChange={(e) => setNewDealOwnerId(e.target.value ? Number(e.target.value) : "")}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "0.8125rem",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      outline: "none",
                      color: "#0F172A",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">Unassigned</option>
                    {teamUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Priority
                  </label>
                  <select
                    value={newDealPriority}
                    onChange={(e) => setNewDealPriority(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "0.8125rem",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      outline: "none",
                      color: "#0F172A",
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Expected Close Date */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Expected Close Date
                </label>
                <input
                  type="date"
                  value={newDealCloseDate}
                  onChange={(e) => setNewDealCloseDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "0.8125rem",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    outline: "none",
                    color: "#0F172A",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Requirement / Notes */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Requirement / Notes
                </label>
                <textarea
                  rows={2}
                  value={newDealRequirement}
                  onChange={(e) => setNewDealRequirement(e.target.value)}
                  placeholder="Client requirements or scope..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "0.8125rem",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    outline: "none",
                    color: "#0F172A",
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div style={{ paddingTop: "10px", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsNewDealModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#475569",
                    backgroundColor: "#F1F5F9",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewDeal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 18px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "#FFFFFF",
                    backgroundColor: "#009F9A",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  {isSubmittingNewDeal ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>{isSubmittingNewDeal ? "Creating..." : "Create Deal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CUSTOMIZE STAGES MODAL                                                    */}
      {/* ========================================================================= */}
      {isCustomizeStagesModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(3px)",
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
              border: "1px solid #E2E8F0",
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
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    backgroundColor: "#E8F7F5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#009F9A",
                  }}
                >
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Customize Pipeline Stages
                  </h3>
                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "2px 0 0 0" }}>
                    Reorder, rename, adjust win probability, set colors, and enable/disable stages
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCustomizeStagesModalOpen(false)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  backgroundColor: "transparent",
                  color: "#64748B",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Stages List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                backgroundColor: "#F8FAFC",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {editingStages.map((stage, index) => {
                  const isDisabled = stage.is_active === false;

                  return (
                    <div
                      key={stage.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        backgroundColor: "#FFFFFF",
                        borderRadius: "10px",
                        border: `1px solid ${isDisabled ? "#FECACA" : "#E2E8F0"}`,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                        opacity: isDisabled ? 0.75 : 1,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {/* Order Controls */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <button
                          type="button"
                          onClick={() => handleMoveStageUp(index)}
                          disabled={index === 0}
                          title="Move stage up"
                          style={{
                            background: "none",
                            border: "none",
                            padding: "2px",
                            color: index === 0 ? "#CBD5E1" : "#475569",
                            cursor: index === 0 ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStageDown(index)}
                          disabled={index === editingStages.length - 1}
                          title="Move stage down"
                          style={{
                            background: "none",
                            border: "none",
                            padding: "2px",
                            color: index === editingStages.length - 1 ? "#CBD5E1" : "#475569",
                            cursor: index === editingStages.length - 1 ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>

                      {/* Order Number */}
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#94A3B8",
                          width: "20px",
                          textAlign: "center",
                        }}
                      >
                        {index + 1}
                      </span>

                      {/* Color Picker Swatch */}
                      <input
                        type="color"
                        value={stage.color || "#3B82F6"}
                        onChange={(e) => handleUpdateStageColor(stage.id, e.target.value)}
                        title="Choose stage color"
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          cursor: "pointer",
                          padding: "2px",
                          backgroundColor: "#FFFFFF",
                          flexShrink: 0,
                        }}
                      />

                      {/* Stage Name Input */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <input
                          type="text"
                          value={stage.name}
                          onChange={(e) => handleUpdateStageName(stage.id, e.target.value)}
                          placeholder="Stage Name"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: "#0F172A",
                            backgroundColor: "#F8FAFC",
                            border: "1px solid #CBD5E1",
                            borderRadius: "8px",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      {/* Probability % Input */}
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", width: "90px", flexShrink: 0 }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={stage.probability}
                          onChange={(e) => handleUpdateStageProbability(stage.id, Number(e.target.value))}
                          title="Win Probability (%)"
                          style={{
                            width: "55px",
                            padding: "8px 6px",
                            fontSize: "0.8125rem",
                            textAlign: "center",
                            color: "#0F172A",
                            backgroundColor: "#F8FAFC",
                            border: "1px solid #CBD5E1",
                            borderRadius: "8px",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                        <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>%</span>
                      </div>

                      {/* Active / Disabled Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleStageActive(stage.id)}
                        title={isDisabled ? "Click to enable stage" : "Click to disable stage"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "7px 12px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          borderRadius: "8px",
                          border: `1px solid ${isDisabled ? "#FCA5A5" : "#A7F3D0"}`,
                          backgroundColor: isDisabled ? "#FEF2F2" : "#ECFDF5",
                          color: isDisabled ? "#DC2626" : "#059669",
                          cursor: "pointer",
                          flexShrink: 0,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <Power size={13} />
                        <span>{isDisabled ? "Disabled" : "Active"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add New Custom Stage Box */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px dashed #CBD5E1",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginTop: "6px",
                }}
              >
                <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Plus size={15} color="#009F9A" />
                  <span>Add New Stage</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <input
                    type="color"
                    value={newCustomStageColor}
                    onChange={(e) => setNewCustomStageColor(e.target.value)}
                    title="Stage Color"
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      cursor: "pointer",
                      padding: "2px",
                      backgroundColor: "#FFFFFF",
                      flexShrink: 0,
                    }}
                  />
                  <input
                    type="text"
                    value={newCustomStageName}
                    onChange={(e) => setNewCustomStageName(e.target.value)}
                    placeholder="e.g. Contract Review"
                    style={{
                      flex: 1,
                      minWidth: "160px",
                      padding: "8px 12px",
                      fontSize: "0.8125rem",
                      color: "#0F172A",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newCustomStageProbability}
                      onChange={(e) => setNewCustomStageProbability(Number(e.target.value))}
                      placeholder="50"
                      title="Win Probability %"
                      style={{
                        width: "60px",
                        padding: "8px 8px",
                        fontSize: "0.8125rem",
                        textAlign: "center",
                        color: "#0F172A",
                        backgroundColor: "#F8FAFC",
                        border: "1px solid #CBD5E1",
                        borderRadius: "8px",
                        outline: "none",
                      }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>%</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddNewCustomStage}
                    style={{
                      padding: "8px 16px",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "#009F9A",
                      backgroundColor: "#E8F7F5",
                      border: "1px solid #A7F3D0",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Stage</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "10px",
                backgroundColor: "#FFFFFF",
              }}
            >
              <button
                type="button"
                onClick={() => setIsCustomizeStagesModalOpen(false)}
                disabled={isSavingCustomStages}
                style={{
                  padding: "8px 16px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#475569",
                  backgroundColor: "#F1F5F9",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomizedStages}
                disabled={isSavingCustomStages}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 20px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "#FFFFFF",
                  backgroundColor: "#009F9A",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                {isSavingCustomStages ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{isSavingCustomStages ? "Saving Changes..." : "Save Pipeline Stages"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
