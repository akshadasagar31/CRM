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
  CheckCircle2,
  Terminal,
  Layers,
  LogIn,
  ChevronDown,
  LayoutDashboard,
  Building2,
  Phone,
  Mail,
  FileText,
  Sparkles,
  Flame,
  Check,
  ShieldAlert,
} from "lucide-react";
import { getToken } from "@/lib/api";

export default function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(!!getToken());
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#FFFFFF" }}>
      {/* Fixed/Sticky Top Navigation Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          height: "64px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            width: "100%",
            margin: "0 auto",
            padding: "0 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Brand Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "9px",
                background: "linear-gradient(135deg, var(--primary-teal) 0%, var(--primary-blue) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: "1.125rem",
                boxShadow: "0 2px 8px rgba(0, 159, 154, 0.25)",
              }}
            >
              C
            </div>
            <span style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.025em" }}>
              CRM
            </span>
          </Link>

          {/* In-Page Navigation Links (Stay on Landing Page) */}
          <nav style={{ display: "flex", alignItems: "center", gap: "2.25rem" }}>
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, "features")}
              className="nav-link-hover"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Features
            </a>
            <a
              href="#channels"
              onClick={(e) => scrollToSection(e, "channels")}
              className="nav-link-hover"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Channels
            </a>
            <a
              href="#webhook"
              onClick={(e) => scrollToSection(e, "webhook")}
              className="nav-link-hover"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Webhook API
            </a>
          </nav>

          {/* Prominent High-Contrast Sign In Action */}
          <div>
            {isAuthenticated ? (
              <Link
                href="/leads"
                className="btn btn-primary interactive-cta"
                id="btn-header-leads"
                style={{
                  padding: "0.55rem 1.35rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  boxShadow: "0 2px 8px rgba(0, 159, 154, 0.2)",
                }}
              >
                <LayoutDashboard size={16} /> Open Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <Link
                href="/login"
                className="btn btn-primary interactive-cta"
                id="btn-header-signin"
                style={{
                  padding: "0.55rem 1.45rem",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  backgroundColor: "var(--primary-teal)",
                  boxShadow: "0 2px 10px rgba(0, 159, 154, 0.3)",
                }}
              >
                <LogIn size={16} /> Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Modern Full-Viewport Hero (Clean 2-Column Desktop Layout) */}
      <section
        style={{
          height: "calc(100vh - 64px)",
          minHeight: "620px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem 2rem",
          position: "relative",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* Ambient Animated Blurred Radial Gradient Spheres */}
        <div
          className="animate-float-orb-1"
          style={{
            position: "absolute",
            top: "8%",
            left: "5%",
            width: "520px",
            height: "520px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 159, 154, 0.12) 0%, rgba(255, 255, 255, 0) 70%)",
            filter: "blur(60px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          className="animate-float-orb-2"
          style={{
            position: "absolute",
            bottom: "5%",
            right: "5%",
            width: "560px",
            height: "560px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0, 159, 227, 0.10) 0%, rgba(255, 255, 255, 0) 70%)",
            filter: "blur(70px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Subtle Tech Micro-Grid Overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(#CBD5E1 0.75px, transparent 0.75px)",
            backgroundSize: "28px 28px",
            opacity: 0.35,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Content Container (Balanced 2-Column Layout) */}
        <div
          style={{
            maxWidth: "1280px",
            width: "100%",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: "3.5rem",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Left Column: Headline, Description & Call To Action */}
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.3rem 0.85rem",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--light-teal)",
                border: "1px solid rgba(0, 159, 154, 0.25)",
                fontSize: "0.75rem",
                color: "var(--primary-teal)",
                fontWeight: 700,
                marginBottom: "1.25rem",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              <Sparkles size={13} />
              <span>Modern Inbound CRM Engine</span>
            </div>

            <h1
              style={{
                fontSize: "3rem",
                fontWeight: 800,
                color: "var(--text-primary)",
                lineHeight: 1.12,
                letterSpacing: "-0.035em",
                marginBottom: "1.25rem",
              }}
            >
              Universal Lead Management,{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, var(--primary-teal) 0%, var(--primary-blue) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Simplified
              </span>
            </h1>

            <p
              style={{
                fontSize: "1.125rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                marginBottom: "2.25rem",
                maxWidth: "540px",
              }}
            >
              Centralize inbound inquiries with strict phone number duplicate detection and real-time webhook ingestion into PostgreSQL.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <Link
                href={isAuthenticated ? "/leads" : "/login"}
                className="btn btn-primary interactive-cta"
                id="btn-hero-cta"
                style={{
                  padding: "0.875rem 2rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  boxShadow: "0 4px 15px rgba(0, 159, 154, 0.28)",
                }}
              >
                {isAuthenticated ? (
                  <>
                    <LayoutDashboard size={18} /> Open CRM Dashboard <ArrowRight size={16} />
                  </>
                ) : (
                  <>
                    <LogIn size={18} /> Sign In to Access CRM <ArrowRight size={16} />
                  </>
                )}
              </Link>

              <a
                href="#features"
                onClick={(e) => scrollToSection(e, "features")}
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  textDecoration: "none",
                  padding: "0.85rem 1rem",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary-teal)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                Explore Features <ChevronDown size={16} />
              </a>
            </div>
          </div>

          {/* Right Column: Visually Impressive Glassmorphic CRM Preview with Floating Micro-Badges */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            {/* Top-Right Floating Micro-Badge */}
            <div
              className="animate-badge-float-1"
              style={{
                position: "absolute",
                top: "-18px",
                right: "-12px",
                zIndex: 10,
                backgroundColor: "#FFFFFF",
                padding: "0.6rem 0.95rem",
                borderRadius: "12px",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                boxShadow: "0 8px 24px rgba(239, 68, 68, 0.12), 0 2px 6px rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#DC2626",
              }}
            >
              <ShieldAlert size={16} />
              <span>Duplicate Blocked: Phone Exists (409)</span>
            </div>

            {/* Bottom-Left Floating Micro-Badge */}
            <div
              className="animate-badge-float-2"
              style={{
                position: "absolute",
                bottom: "-18px",
                left: "-12px",
                zIndex: 10,
                backgroundColor: "#FFFFFF",
                padding: "0.6rem 0.95rem",
                borderRadius: "12px",
                border: "1px solid rgba(0, 159, 154, 0.25)",
                boxShadow: "0 8px 24px rgba(0, 159, 154, 0.12), 0 2px 6px rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--primary-teal)",
              }}
            >
              <CheckCircle2 size={16} />
              <span>Webhook Ingested: POST /api/webhooks/lead (201)</span>
            </div>

            {/* Main CRM Glass Window Frame */}
            <div
              className="hero-glass-window"
              style={{
                width: "100%",
                maxWidth: "470px",
                overflow: "hidden",
              }}
            >
              {/* Window Header with macOS-style Control Dots */}
              <div
                style={{
                  padding: "0.85rem 1.25rem",
                  backgroundColor: "rgba(244, 247, 251, 0.8)",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#EF4444", display: "inline-block" }} />
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#F59E0B", display: "inline-block" }} />
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#10B981", display: "inline-block" }} />
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", marginLeft: "0.25rem" }}>
                    Lead Record Preview • Fictional Demo
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    color: "#059669",
                    backgroundColor: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  Verified Unique
                </span>
              </div>

              {/* Window Content (100% Fictional Placeholder Record) */}
              <div style={{ padding: "1.5rem" }}>
                <div style={{ marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-primary)" }}>
                      Acme Sample Technologies
                    </div>
                    <span className="badge-source website" style={{ fontSize: "0.6875rem", padding: "3px 8px" }}>
                      website
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    <span>Fictional demonstration record</span>
                    <span>•</span>
                    <span style={{ color: "#B45309", backgroundColor: "#FEF3C7", padding: "1px 6px", borderRadius: "4px", fontSize: "0.6875rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "2px" }}>
                      <Flame size={11} /> Hot Lead (94)
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    <Phone size={15} color="var(--primary-teal)" />
                    <span>Phone (Primary Key): <strong>+1 (555) 0100</strong></span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    <Mail size={15} color="var(--primary-teal)" />
                    <span>Email: <strong>contact@example.com</strong></span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                    <FileText size={15} color="var(--primary-teal)" />
                    <span>Inquiry: Enterprise CRM implementation</span>
                  </div>
                </div>

                {/* Card Sub-Bar */}
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "var(--bg-elevated)",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary-teal)", fontWeight: 700 }}>
                    <ShieldCheck size={15} />
                    <span>Duplicate Prevention Active</span>
                  </div>
                  <span className="badge-status in-progress">Contacted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section Below The Fold */}
      <section
        id="features"
        style={{
          padding: "5rem 2rem",
          maxWidth: "1280px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>
            Platform Capabilities
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "560px", margin: "0 auto" }}>
            Engineered with strict data integrity, real-time validations, and instantaneous query execution.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.5rem",
            textAlign: "left",
          }}
        >
          <div className="white-card" style={{ padding: "1.75rem" }}>
            <div style={{ color: "var(--primary-teal)", marginBottom: "0.75rem" }}>
              <Zap size={26} />
            </div>
            <div style={{ fontWeight: 700, fontSize: "1.0625rem", color: "var(--text-primary)", marginBottom: "0.35rem" }}>
              Number Primary Key
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.55 }}>
              Strict unique phone number enforcement prevents duplicate leads across all channels.
            </div>
          </div>

          <div className="white-card" style={{ padding: "1.75rem" }}>
            <div style={{ color: "var(--primary-blue)", marginBottom: "0.75rem" }}>
              <Terminal size={26} />
            </div>
            <div style={{ fontWeight: 700, fontSize: "1.0625rem", color: "var(--text-primary)", marginBottom: "0.35rem" }}>
              Generic Webhook API
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.55 }}>
              <code>POST /api/webhooks/lead</code> ingests leads via API keys with instant schema validation.
            </div>
          </div>

          <div className="white-card" style={{ padding: "1.75rem" }}>
            <div style={{ color: "var(--primary-teal)", marginBottom: "0.75rem" }}>
              <ShieldCheck size={26} />
            </div>
            <div style={{ fontWeight: 700, fontSize: "1.0625rem", color: "var(--text-primary)", marginBottom: "0.35rem" }}>
              JWT Security
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.55 }}>
              HMAC-SHA256 tokens and bcrypt salt rounds guard CRM dashboards and API routes.
            </div>
          </div>

          <div className="white-card" style={{ padding: "1.75rem" }}>
            <div style={{ color: "#D97706", marginBottom: "0.75rem" }}>
              <Layers size={26} />
            </div>
            <div style={{ fontWeight: 700, fontSize: "1.0625rem", color: "var(--text-primary)", marginBottom: "0.35rem" }}>
              Protected Dashboard
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.55 }}>
              Dedicated workspace with server-side pagination, saved views, and activity audit trails.
            </div>
          </div>
        </div>
      </section>

      {/* Ingestion Channels Section */}
      <section
        id="channels"
        style={{
          padding: "5rem 2rem",
          backgroundColor: "var(--bg-page)",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>
              Multi-Channel Ingestion
            </h2>
            <p style={{ color: "var(--text-secondary)", maxWidth: "560px", margin: "0 auto" }}>
              Accept lead data across multiple touchpoints into your unified CRM repository.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
            <div className="white-card" style={{ padding: "1.75rem", borderTop: "4px solid var(--primary-blue)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ padding: "0.45rem", borderRadius: "8px", backgroundColor: "var(--source-website-bg)", color: "var(--source-website-color)" }}>
                  <Globe size={22} />
                </div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>Website Contact Form</h3>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                Connect customer forms on your landing page directly to the webhook endpoint.
              </p>
              <div style={{ backgroundColor: "var(--bg-elevated)", padding: "0.6rem 0.85rem", borderRadius: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                POST /api/webhooks/lead
              </div>
            </div>

            <div className="white-card" style={{ padding: "1.75rem", borderTop: "4px solid #8B5CF6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ padding: "0.45rem", borderRadius: "8px", backgroundColor: "var(--source-social-bg)", color: "var(--source-social-color)" }}>
                  <Share2 size={22} />
                </div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>Social Media Ads</h3>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                Ingest Instagram, Facebook, and LinkedIn sponsored campaign leads seamlessly.
              </p>
              <div style={{ backgroundColor: "var(--bg-elevated)", padding: "0.6rem 0.85rem", borderRadius: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                POST /api/webhooks/lead
              </div>
            </div>

            <div className="white-card" style={{ padding: "1.75rem", borderTop: "4px solid var(--primary-teal)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ padding: "0.45rem", borderRadius: "8px", backgroundColor: "var(--source-sheets-bg)", color: "var(--source-sheets-color)" }}>
                  <TableIcon size={22} />
                </div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>Google Sheets</h3>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                Auto-sync on new row submissions via Google Apps Script HTTP POST triggers.
              </p>
              <div style={{ backgroundColor: "var(--bg-elevated)", padding: "0.6rem 0.85rem", borderRadius: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                POST /api/webhooks/lead
              </div>
            </div>

            <div className="white-card" style={{ padding: "1.75rem", borderTop: "4px solid #D97706" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ padding: "0.45rem", borderRadius: "8px", backgroundColor: "var(--source-manual-bg)", color: "var(--source-manual-color)" }}>
                  <PlusCircle size={22} />
                </div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>Manual Entry</h3>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                Sales reps can manually input inbound calls, offline leads, or direct referrals.
              </p>
              <div style={{ backgroundColor: "var(--bg-elevated)", padding: "0.6rem 0.85rem", borderRadius: "6px", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                POST /api/leads
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Webhook API Section */}
      <section id="webhook" style={{ padding: "5rem 2rem", maxWidth: "960px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h2 className="heading-lg" style={{ marginBottom: "0.5rem" }}>
            Generic Webhook API
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Standardized endpoint: <code>POST /api/webhooks/lead</code>
          </p>
        </div>

        <div className="white-card" style={{ padding: "1.75rem" }}>
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

          <div className="code-block" style={{ marginBottom: "1.25rem" }}>
{`{
  "number": "+1 (555) 0100",        // Required unique primary key (fictional example)
  "name": "Acme Sample Tech",
  "email": "inquiry@example.com",
  "requirement": "Enterprise CRM integration",
  "source": "website",             // website | social_media | google_sheets | manual
  "city": "Sample City"
}`}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary-teal)", fontSize: "0.875rem", fontWeight: 600 }}>
            <CheckCircle2 size={16} />
            <span>Returns HTTP 201 Created on success, or HTTP 409 Conflict if Number already exists</span>
          </div>
        </div>
      </section>

      {/* Clean Footer */}
      <footer style={{ marginTop: "auto", borderTop: "1px solid var(--border-subtle)", padding: "2rem 1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8125rem", backgroundColor: "#FFFFFF" }}>
        <p>CRM — Lead Management System.</p>
        <p style={{ marginTop: "0.25rem" }}>Built with Next.js, Go (Gin), PostgreSQL 17 & JWT Authentication.</p>
      </footer>
    </div>
  );
}
