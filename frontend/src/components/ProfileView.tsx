"use client";

import React from "react";
import {
  User as UserIcon,
  Mail,
  Shield,
  Key,
  Users,
  LogOut,
  Building,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Database,
  ExternalLink,
} from "lucide-react";
import { User, getToken } from "@/lib/api";
import { SidebarTab } from "./Sidebar";

interface ProfileViewProps {
  user?: User | null;
  onSelectTab: (tab: SidebarTab) => void;
  onLogout?: () => void;
}

export default function ProfileView({ user, onSelectTab, onLogout }: ProfileViewProps) {
  const token = getToken();

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
      {/* Page Title */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-0.02em" }}>
          User Profile & Account
        </h1>
        <p style={{ color: "#64748B", fontSize: "0.875rem", marginTop: "0.375rem" }}>
          Manage your account credentials, workspace membership, and active session
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Left Column: User Card */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "1.75rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.5rem" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0D9488 0%, #2563EB 100%)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "1.75rem",
                boxShadow: "0 4px 12px rgba(13, 148, 136, 0.25)",
              }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
            </div>
            <div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A" }}>
                {user?.name || "Administrator"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "#64748B", fontSize: "0.875rem", marginTop: "0.125rem" }}>
                <Mail size={14} />
                <span>{user?.email || "admin@crmdemo.com"}</span>
              </div>
              <div style={{ marginTop: "0.5rem", display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#CCFBF1", color: "#0F766E", fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", borderRadius: "999px" }}>
                <CheckCircle2 size={12} /> Active Administrator
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem" }}>
              <span style={{ color: "#64748B" }}>User Identifier:</span>
              <span style={{ fontWeight: 600, color: "#0F172A", fontFamily: "monospace" }}>#{user?.id || 1}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem" }}>
              <span style={{ color: "#64748B" }}>Role & Permissions:</span>
              <span style={{ fontWeight: 600, color: "#0F172A" }}>Super Admin (Full Access)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem" }}>
              <span style={{ color: "#64748B" }}>Authentication Scheme:</span>
              <span style={{ fontWeight: 600, color: "#0F172A" }}>JWT Bearer (HS256)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem" }}>
              <span style={{ color: "#64748B" }}>Session Token:</span>
              <span style={{ fontWeight: 600, color: "#0D9488", fontSize: "0.8125rem" }}>
                {token ? "Active (Valid)" : "Not Detected"}
              </span>
            </div>
          </div>

          {onLogout && (
            <div style={{ marginTop: "1.75rem", borderTop: "1px solid #F1F5F9", paddingTop: "1.25rem" }}>
              <button
                onClick={onLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  width: "100%",
                  padding: "0.625rem",
                  borderRadius: "8px",
                  border: "1px solid #FECACA",
                  backgroundColor: "#FEF2F2",
                  color: "#DC2626",
                  fontSize: "0.875rem",
                  fontWeight: 600,
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
                <LogOut size={16} /> Sign Out of All Sessions
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Workspace & Quick Jump */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Workspace Information */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              padding: "1.75rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem" }}>
              <Building size={20} style={{ color: "#0D9488" }} />
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                Workspace Details
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.875rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Workspace Name:</span>
                <span style={{ fontWeight: 600, color: "#0F172A" }}>Universal CRM Default</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Workspace ID:</span>
                <span style={{ fontWeight: 600, color: "#0F172A", fontFamily: "monospace" }}>1</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Database Status:</span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#0F766E", fontWeight: 600 }}>
                  <Database size={13} /> Connected (PostgreSQL)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Multi-tenant Isolation:</span>
                <span style={{ fontWeight: 600, color: "#0F172A" }}>Enabled</span>
              </div>
            </div>
          </div>

          {/* Quick Module Navigation */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              padding: "1.75rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem" }}>
              <Sparkles size={20} style={{ color: "#2563EB" }} />
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                Quick Navigation
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <button
                onClick={() => onSelectTab("leads")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  backgroundColor: "#F8FAFC",
                  color: "#0F172A",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#F1F5F9";
                  e.currentTarget.style.borderColor = "#CBD5E1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#F8FAFC";
                  e.currentTarget.style.borderColor = "#E2E8F0";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Users size={16} style={{ color: "#0D9488" }} />
                  <span>Open Leads Management</span>
                </div>
                <ArrowRight size={15} style={{ color: "#94A3B8" }} />
              </button>

              <button
                onClick={() => onSelectTab("api-keys")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  backgroundColor: "#F8FAFC",
                  color: "#0F172A",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#F1F5F9";
                  e.currentTarget.style.borderColor = "#CBD5E1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#F8FAFC";
                  e.currentTarget.style.borderColor = "#E2E8F0";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Key size={16} style={{ color: "#2563EB" }} />
                  <span>Manage Integration API Keys</span>
                </div>
                <ArrowRight size={15} style={{ color: "#94A3B8" }} />
              </button>

              <button
                onClick={() => onSelectTab("api-docs")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid #E2E8F0",
                  backgroundColor: "#F8FAFC",
                  color: "#0F172A",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#F1F5F9";
                  e.currentTarget.style.borderColor = "#CBD5E1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#F8FAFC";
                  e.currentTarget.style.borderColor = "#E2E8F0";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <ExternalLink size={16} style={{ color: "#7C3AED" }} />
                  <span>Interactive API Documentation</span>
                </div>
                <ArrowRight size={15} style={{ color: "#94A3B8" }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
