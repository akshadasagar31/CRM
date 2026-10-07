"use client";

import React from "react";
import {
  Users,
  Key,
  FileCode2,
  Settings,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { User } from "@/lib/api";

export type SidebarTab = "leads" | "api-keys" | "api-docs" | "profile";

interface SidebarProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  keyCount?: number;
  leadsCount?: number;
  user?: User | null;
  onLogout?: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenAdminSettings: () => void;
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  keyCount,
  leadsCount,
  user,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  onOpenAdminSettings,
}: SidebarProps) {
  const navItems = [
    {
      id: "leads" as SidebarTab,
      label: "Leads",
      icon: Users,
      domId: "sidebar-nav-leads",
      badge: leadsCount !== undefined ? leadsCount : null,
    },
    {
      id: "api-keys" as SidebarTab,
      label: "API Keys",
      icon: Key,
      domId: "sidebar-nav-apikeys",
      badge: keyCount !== undefined ? keyCount : null,
    },
    {
      id: "api-docs" as SidebarTab,
      label: "API Documentation",
      icon: FileCode2,
      domId: "sidebar-nav-apidocs",
      badge: "v2.0",
    },
  ];

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
        overflow: "hidden",
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

      {/* Navigation Section */}
      <nav
        style={{
          padding: isCollapsed ? "1rem 0.5rem" : "1.25rem 0.75rem",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
          overflowY: "auto",
          overflowX: "hidden",
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

        {/* Primary Navigation Items */}
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              id={item.domId}
              onClick={() => onSelectTab(item.id)}
              title={isCollapsed ? item.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: isCollapsed ? "center" : "space-between",
                width: "100%",
                padding: isCollapsed ? "0.625rem 0" : "0.625rem 0.75rem",
                borderRadius: "8px",
                border: isActive
                  ? "1px solid rgba(13, 148, 136, 0.25)"
                  : "1px solid transparent",
                backgroundColor: isActive ? "#F0FDFA" : "transparent",
                color: isActive ? "#0D9488" : "#475569",
                fontWeight: isActive ? 700 : 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
                textAlign: "left",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#F8FAFC";
                  e.currentTarget.style.color = "#0F172A";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#475569";
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <Icon
                  size={18}
                  style={{
                    color: isActive ? "#0D9488" : "#64748B",
                    flexShrink: 0,
                  }}
                />
                {!isCollapsed && <span>{item.label}</span>}
              </div>

              {!isCollapsed && item.badge !== null && item.badge !== undefined && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: "999px",
                    backgroundColor: isActive ? "#CCFBF1" : "#F1F5F9",
                    color: isActive ? "#0F766E" : "#64748B",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Separator before Admin Settings */}
        <div style={{ borderTop: "1px solid #F1F5F9", margin: "0.5rem 0" }} />

        {/* Admin Settings Button (Moved into Sidebar) */}
        <button
          id="sidebar-nav-admin-settings"
          onClick={onOpenAdminSettings}
          title="Admin Settings"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: "0.625rem",
            width: "100%",
            padding: isCollapsed ? "0.625rem 0" : "0.625rem 0.75rem",
            borderRadius: "8px",
            border: "1px solid transparent",
            backgroundColor: "transparent",
            color: "#475569",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
            textAlign: "left",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#F8FAFC";
            e.currentTarget.style.color = "#0F172A";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#475569";
          }}
        >
          <Settings size={18} style={{ color: "#64748B", flexShrink: 0 }} />
          {!isCollapsed && <span>Admin Settings</span>}
        </button>
      </nav>

      {/* Sidebar Bottom: Profile Card & Logout */}
      <div
        id="sidebar-user-footer"
        style={{
          padding: isCollapsed ? "0.875rem 0.5rem" : "1rem",
          borderTop: "1px solid #E2E8F0",
          backgroundColor: "#F8FAFC",
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
