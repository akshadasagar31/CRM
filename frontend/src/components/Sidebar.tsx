"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  Key,
  FileCode2,
  Settings,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarClock,
  Briefcase,
  TrendingUp,
  PackageCheck,
  Landmark,
  Receipt,
  CreditCard,
  Boxes,
  Package,
  Building2,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import { User } from "@/lib/api";

export type SidebarTab =
  | "dashboard"
  | "leads"
  | "deals"
  | "quotations"
  | "orders"
  | "invoices"
  | "payments"
  | "inventory"
  | "products"
  | "follow-ups"
  | "company"
  | "api-keys"
  | "api-docs"
  | "profile";

interface SubcategoryItem {
  id: SidebarTab | "admin-settings";
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; color?: string; className?: string }>;
  domId: string;
  badge?: string | number | null;
  action?: () => void;
}

interface NavCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties; color?: string; className?: string }>;
  domId: string;
  subcategories: SubcategoryItem[];
}

interface SidebarProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  keyCount?: number;
  leadsCount?: number;
  dealsCount?: number;
  quotationsCount?: number;
  ordersCount?: number;
  invoicesCount?: number;
  paymentsCount?: number;
  inventoryCount?: number;
  remindersCount?: number;
  productsCount?: number;
  followUpsCount?: number;
  user?: User | null;
  onLogout?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenAdminSettings: () => void;
}

// Maps any active tab to its parent category ID
function getParentCategoryId(tab: SidebarTab): string | null {
  if (tab === "leads" || tab === "follow-ups" || tab === "deals") return "leads";
  if (tab === "quotations" || tab === "orders") return "sales";
  if (tab === "invoices" || tab === "payments") return "finance";
  if (tab === "inventory" || tab === "products") return "inventory";
  if (tab === "company" || tab === "api-keys" || tab === "api-docs" || tab === "profile") return "settings";
  return null;
}

// Storage key for persisting expanded categories across CRM pages
const SIDEBAR_EXPANDED_KEY = "crm_sidebar_expanded_categories";

function getStoredExpandedCategories(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, boolean>;
      }
    }
  } catch (err) {
    console.error("Failed to read sidebar state from localStorage", err);
  }
  return null;
}

function persistExpandedCategories(categories: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(categories));
  } catch (err) {
    console.error("Failed to save sidebar state to localStorage", err);
  }
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  keyCount,
  leadsCount,
  dealsCount,
  quotationsCount,
  ordersCount,
  invoicesCount,
  paymentsCount,
  inventoryCount,
  remindersCount,
  productsCount,
  followUpsCount,
  user,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  onOpenAdminSettings,
}: SidebarProps) {
  // Independent multi-expansion state: persisted across route transitions in localStorage
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const parentId = getParentCategoryId(activeTab);
    return parentId ? { [parentId]: true } : { leads: true };
  });

  // Reconcile with localStorage after client mount to prevent SSR hydration mismatch
  useEffect(() => {
    const stored = getStoredExpandedCategories();
    const parentId = getParentCategoryId(activeTab);
    if (stored) {
      if (parentId && stored[parentId] === undefined) {
        setExpandedCategories({ ...stored, [parentId]: true });
      } else {
        setExpandedCategories(stored);
      }
    }
  }, []);

  // Track hovered category in collapsed mode for floating popover menu
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Track last active parent category to automatically expand only on navigation to a new parent
  const lastActiveParentRef = useRef<string | null>(getParentCategoryId(activeTab));

  // Automatically expand active category when navigating to a new/different parent category
  useEffect(() => {
    const parentId = getParentCategoryId(activeTab);
    if (parentId && lastActiveParentRef.current !== parentId) {
      lastActiveParentRef.current = parentId;
      setExpandedCategories((prev) => {
        if (!prev[parentId]) {
          const updated = { ...prev, [parentId]: true };
          persistExpandedCategories(updated);
          return updated;
        }
        return prev;
      });
    }
  }, [activeTab]);

  // Handle Admin Settings click:
  // Triggers drawer on Leads page or navigates to profile/admin settings tab
  const handleAdminSettingsClick = () => {
    if (activeTab === "leads" && onOpenAdminSettings) {
      onOpenAdminSettings();
    } else {
      onSelectTab("profile");
    }
  };

  // Structured Navigation Hierarchy
  const navCategories: NavCategory[] = [
    {
      id: "leads",
      label: "Leads",
      icon: Users,
      domId: "sidebar-nav-leads-category",
      subcategories: [
        {
          id: "leads",
          label: "All Leads",
          icon: Users,
          domId: "sidebar-nav-leads",
          badge: leadsCount !== undefined ? leadsCount : null,
        },
        {
          id: "follow-ups",
          label: "Follow-ups",
          icon: CalendarClock,
          domId: "sidebar-nav-followups",
          badge: followUpsCount !== undefined ? followUpsCount : null,
        },
        {
          id: "deals",
          label: "Deals & Pipeline",
          icon: Briefcase,
          domId: "sidebar-nav-deals",
          badge: dealsCount !== undefined ? dealsCount : null,
        },
      ],
    },
    {
      id: "sales",
      label: "Sales",
      icon: TrendingUp,
      domId: "sidebar-nav-sales-category",
      subcategories: [
        {
          id: "quotations",
          label: "Quotations",
          icon: FileText,
          domId: "sidebar-nav-quotations",
          badge: quotationsCount !== undefined ? quotationsCount : null,
        },
        {
          id: "orders",
          label: "Orders",
          icon: PackageCheck,
          domId: "sidebar-nav-orders",
          badge: ordersCount !== undefined ? ordersCount : null,
        },
      ],
    },
    {
      id: "finance",
      label: "Finance",
      icon: Landmark,
      domId: "sidebar-nav-finance-category",
      subcategories: [
        {
          id: "invoices",
          label: "Invoices",
          icon: Receipt,
          domId: "sidebar-nav-invoices",
          badge: invoicesCount !== undefined ? invoicesCount : null,
        },
        {
          id: "payments",
          label: "Payments",
          icon: CreditCard,
          domId: "sidebar-nav-payments",
          badge: paymentsCount !== undefined ? paymentsCount : null,
        },
      ],
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: Boxes,
      domId: "sidebar-nav-inventory-category",
      subcategories: [
        {
          id: "inventory",
          label: "Inventory Overview",
          icon: Boxes,
          domId: "sidebar-nav-inventory",
          badge: inventoryCount !== undefined ? inventoryCount : null,
        },
        {
          id: "products",
          label: "Products",
          icon: Package,
          domId: "sidebar-nav-products",
          badge: productsCount !== undefined ? productsCount : null,
        },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      domId: "sidebar-nav-settings-category",
      subcategories: [
        {
          id: "company",
          label: "Company Profile",
          icon: Building2,
          domId: "sidebar-nav-company",
          badge: null,
        },
        {
          id: "api-keys",
          label: "API Keys",
          icon: Key,
          domId: "sidebar-nav-apikeys",
          badge: keyCount !== undefined ? keyCount : null,
        },
        {
          id: "api-docs",
          label: "API Documentation",
          icon: FileCode2,
          domId: "sidebar-nav-apidocs",
          badge: "v2.0",
        },
        {
          id: "admin-settings",
          label: "Admin Settings",
          icon: Settings,
          domId: "sidebar-nav-admin-settings",
          badge: null,
          action: handleAdminSettingsClick,
        },
      ],
    },
  ];

  // Toggle expand / collapse for a parent category independently
  const toggleExpand = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = {
        ...prev,
        [catId]: !prev[catId],
      };
      persistExpandedCategories(next);
      return next;
    });
  };

  const isDashboardActive = activeTab === "dashboard";

  return (
    <aside
      id="crm-unified-sidebar"
      style={{
        width: isCollapsed ? "72px" : "260px",
        minWidth: isCollapsed ? "72px" : "260px",
        height: "100vh",
        position: "sticky",
        top: 0,
        backgroundColor: "#FFFFFF",
        borderRight: "1px solid #E2E8F0",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
        flexShrink: 0,
        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "visible", // Permits floating flyouts in collapsed mode
      }}
    >
      {/* Brand Header & Collapse Toggle */}
      <div
        style={{
          padding: isCollapsed ? "1rem 0.5rem" : "1.125rem 1rem 1rem",
          borderBottom: "1px solid #F1F5F9",
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          gap: "0.5rem",
          minHeight: "65px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0D9488 0%, #2563EB 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "1.125rem",
              boxShadow: "0 2px 8px rgba(13, 148, 136, 0.25)",
              flexShrink: 0,
            }}
            title="BizCopilot CRM"
          >
            C
          </div>

          {!isCollapsed && (
            <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 800,
                  color: "#0F172A",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                BizCopilot CRM
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  marginTop: "1px",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "#0D9488",
                }}
              >
                <Sparkles size={11} /> Universal CRM
              </div>
            </div>
          )}
        </div>

        {/* Collapse / Expand Toggle Button */}
        <button
          id="btn-sidebar-toggle-collapse"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            border: "1px solid #E2E8F0",
            backgroundColor: "#F8FAFC",
            color: "#64748B",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#F1F5F9";
            e.currentTarget.style.color = "#0F172A";
            e.currentTarget.style.borderColor = "#CBD5E1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#F8FAFC";
            e.currentTarget.style.color = "#64748B";
            e.currentTarget.style.borderColor = "#E2E8F0";
          }}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Scrollable Navigation Section */}
      <nav
        style={{
          padding: isCollapsed ? "1rem 0.5rem" : "1.25rem 0.75rem",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
          overflowY: "auto",
          overflowX: isCollapsed ? "visible" : "hidden",
          minHeight: 0, // Ensures flex child scrolls smoothly
        }}
      >
        {!isCollapsed && (
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: "#94A3B8",
              letterSpacing: "0.06em",
              marginBottom: "0.25rem",
              paddingLeft: "0.5rem",
              whiteSpace: "nowrap",
            }}
          >
            MODULES
          </div>
        )}

        {/* Standalone Dashboard */}
        <button
          id="sidebar-nav-dashboard"
          onClick={() => onSelectTab("dashboard")}
          title={isCollapsed ? "Dashboard" : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "space-between",
            width: "100%",
            padding: isCollapsed ? "0.625rem 0" : "0.55rem 0.65rem",
            borderRadius: "8px",
            border: isDashboardActive ? "1px solid rgba(13, 148, 136, 0.25)" : "1px solid transparent",
            backgroundColor: isDashboardActive ? "#F0FDFA" : "transparent",
            color: isDashboardActive ? "#0D9488" : "#475569",
            fontWeight: isDashboardActive ? 700 : 600,
            fontSize: "0.875rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
            textAlign: "left",
            whiteSpace: "nowrap",
            outline: "none",
          }}
          onMouseEnter={(e) => {
            if (!isDashboardActive) {
              e.currentTarget.style.backgroundColor = "#F8FAFC";
              e.currentTarget.style.color = "#0F172A";
            }
          }}
          onMouseLeave={(e) => {
            if (!isDashboardActive) {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#475569";
            }
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <LayoutDashboard
              size={18}
              style={{
                color: isDashboardActive ? "#0D9488" : "#64748B",
                flexShrink: 0,
              }}
            />
            {!isCollapsed && <span>Dashboard</span>}
          </div>

          {!isCollapsed && remindersCount !== undefined && remindersCount !== null && (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: "999px",
                backgroundColor: isDashboardActive ? "#CCFBF1" : "#F1F5F9",
                color: isDashboardActive ? "#0F766E" : "#64748B",
              }}
            >
              {remindersCount}
            </span>
          )}
        </button>

        {/* Expandable Parent Categories */}
        {navCategories.map((category) => {
          const isExpanded = !!expandedCategories[category.id];
          const Icon = category.icon;
          // Check if any subcategory under this parent is currently active
          const isChildActive = category.subcategories.some((sub) => sub.id === activeTab);

          return (
            <div
              key={category.id}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
              }}
              onMouseEnter={() => {
                if (isCollapsed) setHoveredCategory(category.id);
              }}
              onMouseLeave={() => {
                if (isCollapsed) setHoveredCategory(null);
              }}
            >
              {/* Parent Category Row (Clicking toggles expand/collapse) */}
              <button
                id={category.domId}
                onClick={() => toggleExpand(category.id)}
                title={isCollapsed ? category.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isCollapsed ? "center" : "space-between",
                  width: "100%",
                  padding: isCollapsed ? "0.625rem 0" : "0.55rem 0.65rem",
                  borderRadius: "8px",
                  border: isChildActive ? "1px solid #E2E8F0" : "1px solid transparent",
                  backgroundColor: isChildActive ? "#F8FAFC" : "transparent",
                  color: isChildActive ? "#0F172A" : "#475569",
                  fontWeight: isChildActive ? 700 : 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isChildActive ? "#F1F5F9" : "#F8FAFC";
                  e.currentTarget.style.color = "#0F172A";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isChildActive ? "#F8FAFC" : "transparent";
                  e.currentTarget.style.color = isChildActive ? "#0F172A" : "#475569";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", overflow: "hidden" }}>
                  <Icon
                    size={18}
                    style={{
                      color: isChildActive ? "#0D9488" : "#64748B",
                      flexShrink: 0,
                    }}
                  />
                  {!isCollapsed && (
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {category.label}
                    </span>
                  )}
                </div>

                {/* Chevron indicating expanded/collapsed state */}
                {!isCollapsed && (
                  <ChevronDown
                    size={15}
                    style={{
                      color: isChildActive ? "#0D9488" : "#94A3B8",
                      transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 0.2s ease",
                      flexShrink: 0,
                    }}
                  />
                )}
              </button>

              {/* Floating Hover Popover in Collapsed Mode (72px) */}
              {isCollapsed && hoveredCategory === category.id && (
                <div
                  style={{
                    position: "absolute",
                    left: "calc(100% + 10px)",
                    top: "0",
                    minWidth: "210px",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
                    padding: "6px",
                    zIndex: 100,
                  }}
                >
                  {/* Category Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 8px",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: "#0F172A",
                    }}
                  >
                    <Icon size={15} color="#0D9488" />
                    <span>{category.label}</span>
                  </div>

                  {/* Subcategories list */}
                  <div
                    style={{
                      borderTop: "1px solid #F1F5F9",
                      marginTop: "4px",
                      paddingTop: "4px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    {category.subcategories.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive = sub.id === activeTab;

                      return (
                        <button
                          key={sub.id}
                          id={sub.domId ? `${sub.domId}-popover` : undefined}
                          onClick={() => {
                            if (sub.action) sub.action();
                            else onSelectTab(sub.id as SidebarTab);
                            setHoveredCategory(null);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            border: isSubActive ? "1px solid rgba(13, 148, 136, 0.25)" : "1px solid transparent",
                            backgroundColor: isSubActive ? "#F0FDFA" : "transparent",
                            color: isSubActive ? "#0D9488" : "#475569",
                            fontSize: "0.8125rem",
                            fontWeight: isSubActive ? 700 : 500,
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.12s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSubActive) {
                              e.currentTarget.style.backgroundColor = "#F8FAFC";
                              e.currentTarget.style.color = "#0F172A";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSubActive) {
                              e.currentTarget.style.backgroundColor = "transparent";
                              e.currentTarget.style.color = "#475569";
                            }
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <SubIcon size={14} style={{ color: isSubActive ? "#0D9488" : "#64748B" }} />
                            <span>{sub.label}</span>
                          </div>
                          {sub.badge !== null && sub.badge !== undefined && (
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 700,
                                padding: "1px 6px",
                                borderRadius: "999px",
                                backgroundColor: isSubActive ? "#CCFBF1" : "#F1F5F9",
                                color: isSubActive ? "#0F766E" : "#64748B",
                              }}
                            >
                              {sub.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Subcategories with Tree Guide Line when Expanded */}
              {!isCollapsed && isExpanded && (
                <div
                  style={{
                    marginLeft: "1.15rem",
                    paddingLeft: "0.75rem",
                    borderLeft: "1.5px solid #E2E8F0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    marginTop: "3px",
                    marginBottom: "4px",
                  }}
                >
                  {category.subcategories.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = sub.id === activeTab;

                    return (
                      <button
                        key={sub.id}
                        id={sub.domId}
                        onClick={() => {
                          if (sub.action) {
                            sub.action();
                          } else {
                            onSelectTab(sub.id as SidebarTab);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          padding: "0.45rem 0.6rem",
                          borderRadius: "6px",
                          border: isSubActive ? "1px solid rgba(13, 148, 136, 0.25)" : "1px solid transparent",
                          backgroundColor: isSubActive ? "#F0FDFA" : "transparent",
                          color: isSubActive ? "#0D9488" : "#64748B",
                          fontWeight: isSubActive ? 700 : 500,
                          fontSize: "0.8125rem",
                          cursor: "pointer",
                          transition: "all 0.12s ease",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                          outline: "none",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSubActive) {
                            e.currentTarget.style.backgroundColor = "#F8FAFC";
                            e.currentTarget.style.color = "#0F172A";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSubActive) {
                            e.currentTarget.style.backgroundColor = "transparent";
                            e.currentTarget.style.color = "#64748B";
                          }
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <SubIcon
                            size={14}
                            style={{
                              color: isSubActive ? "#0D9488" : "#94A3B8",
                              flexShrink: 0,
                            }}
                          />
                          <span>{sub.label}</span>
                        </div>

                        {sub.badge !== null && sub.badge !== undefined && (
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: "999px",
                              backgroundColor: isSubActive ? "#CCFBF1" : "#F1F5F9",
                              color: isSubActive ? "#0F766E" : "#64748B",
                            }}
                          >
                            {sub.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Fixed Sidebar Footer: Profile Card & Logout */}
      <div
        id="sidebar-user-footer"
        style={{
          padding: isCollapsed ? "0.875rem 0.5rem" : "1rem",
          borderTop: "1px solid #E2E8F0",
          backgroundColor: "#F8FAFC",
          flexShrink: 0,
        }}
      >
        {/* Clickable Profile Card */}
        <button
          id="sidebar-profile-card-button"
          onClick={() => onSelectTab("profile")}
          title={`Profile: ${user?.name || "Admin User"}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: "0.625rem",
            marginBottom: "0.625rem",
            width: "100%",
            padding: isCollapsed ? "0.375rem" : "0.5rem",
            borderRadius: "8px",
            border: activeTab === "profile" ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid transparent",
            backgroundColor: activeTab === "profile" ? "#EEF2FF" : "transparent",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (activeTab !== "profile") {
              e.currentTarget.style.backgroundColor = "#F1F5F9";
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== "profile") {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              backgroundColor: "#E0E7FF",
              color: "#4338CA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "0.875rem",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              flexShrink: 0,
            }}
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
          </div>

          {!isCollapsed && (
            <div style={{ overflow: "hidden", flex: 1, whiteSpace: "nowrap" }}>
              <div
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: "#0F172A",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.name || "Alex Morgan"}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#64748B",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.email || "admin@crmdemo.com"}
              </div>
            </div>
          )}
        </button>

        {/* Sign Out Button below Profile Card */}
        {onLogout && (
          <button
            id="btn-sidebar-logout"
            onClick={onLogout}
            title="Sign Out"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.375rem",
              width: "100%",
              padding: "0.45rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#DC2626",
              backgroundColor: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#FEE2E2";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#FEF2F2";
            }}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
