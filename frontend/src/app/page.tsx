"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Globe,
  Share2,
  Table as TableIcon,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Database,
  CheckCircle2,
  Terminal,
  Layers,
} from "lucide-react";
import { getToken } from "@/lib/api";

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(!!getToken());
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#FFFFFF" }}>
      {/* Top Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "#FFFFFF",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "1rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, var(--primary-teal) 0%, var(--primary-blue) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: "1rem",
              }}
            >
              C
            </div>
            <span style={{ fontSize: "1.375rem", fontWeight: "800", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              CRM
            </span>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}>
            <Link href="/leads" style={{ color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
              Leads
            </Link>
            <Link href="/api-docs" style={{ color: "#0D9488", fontSize: "0.875rem", fontWeight: 700, textDecoration: "none" }}>
              API Documentation
            </Link>
            <Link href="/api-keys" style={{ color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
              API Keys
            </Link>
            <a href="#channels" style={{ color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
              Channels
            </a>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {isAuthenticated ? (
              <Link href="/leads" className="btn btn-primary" id="btn-header-leads">
                Open Leads Dashboard <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-secondary" id="btn-header-login">
                  Log In
                </Link>
                <Link href="/register" className="btn btn-primary" id="btn-header-register">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        style={{
          padding: "5rem 1.5rem 4rem",
          maxWidth: "1100px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.35rem 0.85rem",
            borderRadius: "var(--radius-full)",
            backgroundColor: "var(--light-teal)",
            border: "1px solid rgba(0, 159, 154, 0.3)",
            fontSize: "0.8125rem",
            color: "var(--primary-teal)",
            fontWeight: 700,
            marginBottom: "1.5rem",
          }}
        >
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--primary-teal)" }} className="animate-pulse" />
          Modern Lead Management System
        </div>

        <h1 className="heading-xl" style={{ maxWidth: "840px", margin: "0 auto 1.25rem", color: "var(--text-primary)" }}>
          Capture, Track & Organize Leads With Unique Number Validation
        </h1>

        <p
          style={{
            fontSize: "1.125rem",
            color: "var(--text-secondary)",
            maxWidth: "680px",
            margin: "0 auto 2.25rem",
            lineHeight: 1.6,
          }}
        >
          Centralize inquiries in real-time from <strong>Website Forms</strong>, <strong>Social Media</strong>, <strong>Google Sheets</strong>, and manual entry directly into your structured PostgreSQL CRM.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "3.5rem" }}>
          <Link href={isAuthenticated ? "/leads" : "/login"} className="btn btn-primary" style={{ padding: "0.875rem 2rem", fontSize: "1rem" }} id="btn-hero-cta">
            {isAuthenticated ? "Go to Leads Dashboard" : "Launch CRM Leads"} <ArrowRight size={18} />
          </Link>
          <a href="#webhook" className="btn btn-secondary" style={{ padding: "0.875rem 1.75rem", fontSize: "1rem" }} id="btn-hero-webhook">
            <Terminal size={18} color="var(--primary-teal)" /> Explore Webhook
          </a>
        </div>

        {/* Feature Cards Grid */}
        <div
          id="features"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.25rem",
            textAlign: "left",
          }}
        >
          <div className="white-card" style={{ padding: "1.5rem" }}>
            <div style={{ color: "var(--primary-teal)", marginBottom: "0.5rem" }}>
              <Zap size={24} />
            </div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
              Number Primary Key
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", lineHeight: 1.5 }}>
              Strict unique phone number enforcement prevents duplicate leads across all channels.
            </div>
          </div>

          <div className="white-card" style={{ padding: "1.5rem" }}>
            <div style={{ color: "var(--primary-blue)", marginBottom: "0.5rem" }}>
              <Terminal size={24} />
            </div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
              Generic Webhook API
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", lineHeight: 1.5 }}>
              POST /api/webhooks/lead ingests leads with automated validation into PostgreSQL.
            </div>
          </div>

          <div className="white-card" style={{ padding: "1.5rem" }}>
            <div style={{ color: "var(--primary-teal)", marginBottom: "0.5rem" }}>
              <ShieldCheck size={24} />
            </div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
              JWT Security
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", lineHeight: 1.5 }}>
              Encrypted password hashing and standard token authentication protect all operations.
            </div>
          </div>

          <div className="white-card" style={{ padding: "1.5rem" }}>
            <div style={{ color: "#D97706", marginBottom: "0.5rem" }}>
              <Layers size={24} />
            </div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
              Dedicated Leads Sidebar
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.8125rem", lineHeight: 1.5 }}>
              Distraction-free dashboard with only the Leads module and complete CRUD capabilities.
            </div>
          </div>
        </div>
      </section>

      {/* 4 Ingestion Channels */}
      <section id="channels" style={{ padding: "4rem 1.5rem", backgroundColor: "var(--bg-page)", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>
              4 Multi-Channel Ingestion Sources
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto" }}>
              Accept lead data across multiple touchpoints into your unified CRM repository.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
            <div className="white-card" style={{ padding: "1.75rem", borderTop: "4px solid var(--primary-blue)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.5rem", borderRadius: "8px", backgroundColor: "var(--source-website-bg)", color: "var(--source-website-color)" }}>
                  <Globe size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>Website Contact Form</h3>
                  <span className="badge-source website">Source: website</span>
                </div>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                Connect customer forms on your landing page directly to the webhook endpoint.
              </p>
              <div style={{ backgroundColor: "var(--bg-elevated)", padding: "0.65rem 0.85rem", borderRadius: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                POST /api/webhooks/lead
              </div>
            </div>

            <div className="white-card" style={{ padding: "1.75rem", borderTop: "4px solid #8B5CF6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.5rem", borderRadius: "8px", backgroundColor: "var(--source-social-bg)", color: "var(--source-social-color)" }}>
                  <Share2 size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>Social Media Ads</h3>
                  <span className="badge-source social_media">Source: social_media</span>
                </div>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                Ingest Instagram, Facebook, and LinkedIn sponsored campaign leads seamlessly.
              </p>
              <div style={{ backgroundColor: "var(--bg-elevated)", padding: "0.65rem 0.85rem", borderRadius: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                POST /api/webhooks/lead
              </div>
            </div>

            <div className="white-card" style={{ padding: "1.75rem", borderTop: "4px solid var(--primary-teal)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.5rem", borderRadius: "8px", backgroundColor: "var(--source-sheets-bg)", color: "var(--source-sheets-color)" }}>
                  <TableIcon size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>Google Sheets</h3>
                  <span className="badge-source google_sheets">Source: google_sheets</span>
                </div>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                Auto-sync on new row submissions via Google Apps Script HTTP POST triggers.
              </p>
              <div style={{ backgroundColor: "var(--bg-elevated)", padding: "0.65rem 0.85rem", borderRadius: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                POST /api/webhooks/lead
              </div>
            </div>

            <div className="white-card" style={{ padding: "1.75rem", borderTop: "4px solid #D97706" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ padding: "0.5rem", borderRadius: "8px", backgroundColor: "var(--source-manual-bg)", color: "var(--source-manual-color)" }}>
                  <PlusCircle size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>Manual Entry</h3>
                  <span className="badge-source manual">Source: manual</span>
                </div>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                Sales reps can manually input inbound calls, offline leads, or direct referrals.
              </p>
              <div style={{ backgroundColor: "var(--bg-elevated)", padding: "0.65rem 0.85rem", borderRadius: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                POST /api/leads
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Webhook API Section */}
      <section id="webhook" style={{ padding: "4rem 1.5rem", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>
            Generic Webhook API
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Standardized endpoint: <code>POST /api/webhooks/lead</code>
          </p>
        </div>

        <div className="white-card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ backgroundColor: "var(--primary-teal)", color: "#FFFFFF", fontWeight: 800, fontSize: "0.75rem", padding: "3px 8px", borderRadius: "4px" }}>
                POST
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
                /api/webhooks/lead
              </span>
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Content-Type: application/json</span>
          </div>

          <div className="code-block" style={{ marginBottom: "1rem" }}>
{`{
  "number": "+1 (555) 234-5678",  // Required unique primary key
  "name": "Jane Cooper",
  "email": "jane.cooper@enterprise.com",
  "requirement": "Looking for customized CRM implementation",
  "source": "website",             // website | social_media | google_sheets | manual
  "city": "San Francisco"
}`}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary-teal)", fontSize: "0.875rem", fontWeight: 600 }}>
            <CheckCircle2 size={16} />
            <span>Returns HTTP 201 Created on success, or HTTP 409 Conflict if Number already exists</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: "auto", borderTop: "1px solid var(--border-subtle)", padding: "1.75rem 1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8125rem", backgroundColor: "#FFFFFF" }}>
        <p>CRM — Lead Management System.</p>
        <p style={{ marginTop: "0.25rem" }}>Built with Next.js, Go (Gin), PostgreSQL 17 & JWT Authentication.</p>
      </footer>
    </div>
  );
}
