"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Edit3,
  Check,
  X,
  Upload,
  Trash2,
  Globe,
  Mail,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  DollarSign,
  Briefcase,
} from "lucide-react";
import {
  companyApi,
  CompanyProfile,
  CompanyProfileUpdateInput,
  authApi,
  getStoredUser,
  User,
} from "@/lib/api";
import Sidebar, { SidebarTab } from "@/components/Sidebar";

export default function CompanyPage() {
  const router = useRouter();

  // User and Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("company");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Profile Data State
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<CompanyProfileUpdateInput>({
    company_name: "",
    gst_number: "",
    pan_number: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
    default_currency: "INR",
  });

  // Logo upload state
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoTimestamp, setLogoTimestamp] = useState<number>(Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isAdmin = currentUser?.role?.toLowerCase() === "admin";

  // Load User and Profile
  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await companyApi.get();
      setProfile(data);
      setFormData({
        company_name: data.company_name || "",
        gst_number: data.gst_number || "",
        pan_number: data.pan_number || "",
        email: data.email || "",
        phone: data.phone || "",
        website: data.website || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        country: data.country || "India",
        pincode: data.pincode || "",
        default_currency: data.default_currency || "INR",
      });
      setLogoTimestamp(Date.now());
    } catch (err: any) {
      console.error("Failed to load company profile:", err);
      showToast(err?.message || "Failed to load company profile", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    loadProfile();
  }, [loadProfile]);

  // Handle Logo File Select
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file (PNG, JPEG, WebP, or SVG)", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Logo image size must be under 5MB", "error");
      return;
    }

    setSelectedLogoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setLogoPreviewUrl(objectUrl);
  };

  // Upload Logo directly
  const handleUploadLogoOnly = async () => {
    if (!selectedLogoFile) return;
    try {
      setIsUploadingLogo(true);
      const updated = await companyApi.uploadLogo(selectedLogoFile);
      setProfile(updated);
      setSelectedLogoFile(null);
      setLogoPreviewUrl(null);
      setLogoTimestamp(Date.now());
      showToast("Company logo uploaded and saved to database!");
    } catch (err: any) {
      console.error("Logo upload error:", err);
      showToast(err?.message || "Failed to upload logo", "error");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Remove Logo
  const handleDeleteLogo = async () => {
    if (!window.confirm("Are you sure you want to remove the company logo?")) return;
    try {
      setIsUploadingLogo(true);
      const updated = await companyApi.deleteLogo();
      setProfile(updated);
      setSelectedLogoFile(null);
      setLogoPreviewUrl(null);
      setLogoTimestamp(Date.now());
      showToast("Company logo removed.");
    } catch (err: any) {
      console.error("Logo delete error:", err);
      showToast(err?.message || "Failed to delete logo", "error");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Save Company Profile Changes
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name.trim()) {
      showToast("Company Name is required", "error");
      return;
    }

    try {
      setIsSaving(true);

      // If a new logo file was selected, upload it first
      if (selectedLogoFile) {
        await companyApi.uploadLogo(selectedLogoFile);
        setSelectedLogoFile(null);
        setLogoPreviewUrl(null);
        setLogoTimestamp(Date.now());
      }

      // Update text details
      const updated = await companyApi.update(formData);
      setProfile(updated);
      setIsEditing(false);
      showToast("Company profile updated successfully!");
    } catch (err: any) {
      console.error("Save company profile error:", err);
      showToast(err?.message || "Failed to save company profile", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel Edit
  const handleCancelEdit = () => {
    if (profile) {
      setFormData({
        company_name: profile.company_name || "",
        gst_number: profile.gst_number || "",
        pan_number: profile.pan_number || "",
        email: profile.email || "",
        phone: profile.phone || "",
        website: profile.website || "",
        address: profile.address || "",
        city: profile.city || "",
        state: profile.state || "",
        country: profile.country || "India",
        pincode: profile.pincode || "",
        default_currency: profile.default_currency || "INR",
      });
    }
    setSelectedLogoFile(null);
    setLogoPreviewUrl(null);
    setIsEditing(false);
  };

  // Copy text helper
  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`);
  };

  // Currency symbols map
  const currencySymbols: Record<string, string> = {
    INR: "₹ INR",
    USD: "$ USD",
    EUR: "€ EUR",
    GBP: "£ GBP",
    AED: "AED",
    SGD: "S$ SGD",
    CAD: "C$ CAD",
    AUD: "A$ AUD",
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
          else if (tab === "quotations") router.push("/quotations");
          else if (tab === "orders") router.push("/orders");
          else if (tab === "products") router.push("/products");
          else if (tab === "follow-ups") router.push("/follow-ups");
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
            padding: "14px 28px",
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
          {/* Title & Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                backgroundColor: "#F0FDFA",
                border: "1px solid #CCFBF1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0D9488",
              }}
            >
              <Building2 size={24} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                  Company Profile
                </h1>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 10px",
                    borderRadius: "999px",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    backgroundColor: "#ECFDF5",
                    color: "#059669",
                    border: "1px solid #A7F3D0",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  Active Entity
                </span>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "2px 0 0 0" }}>
                Official organization details, statutory taxation IDs, and billing identity
              </p>
            </div>
          </div>

          {/* Action Header Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={loadProfile}
              disabled={isLoading}
              title="Refresh profile details"
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                backgroundColor: "#FFFFFF",
                color: "#475569",
                fontSize: "0.8125rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>

            {!isEditing ? (
              isAdmin ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#009F9A",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <Edit3 size={15} />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#F1F5F9",
                    color: "#64748B",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <ShieldCheck size={14} color="#94A3B8" />
                  <span>Admin Only Edit</span>
                </div>
              )
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
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
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#009F9A",
                    color: "#FFFFFF",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: isSaving ? "not-allowed" : "pointer",
                    opacity: isSaving ? 0.7 : 1,
                  }}
                >
                  {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Page Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px", maxWidth: "1280px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "360px", color: "#64748B" }}>
              <RefreshCw size={28} className="animate-spin" color="#0D9488" />
              <p style={{ marginTop: "12px", fontSize: "0.875rem", fontWeight: 500 }}>Loading company profile...</p>
            </div>
          ) : !isEditing ? (
            /* ================= VIEW MODE ================= */
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* BRANDING HERO CARD */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "16px",
                  border: "1px solid #E2E8F0",
                  padding: "28px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "24px",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
                  {/* Company Logo / Avatar */}
                  <div
                    style={{
                      width: "96px",
                      height: "96px",
                      borderRadius: "16px",
                      backgroundColor: "#F8FAFC",
                      border: "2px solid #E2E8F0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      position: "relative",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    {profile?.has_logo ? (
                      <img
                        src={`${companyApi.getLogoUrl()}?t=${logoTimestamp}`}
                        alt={profile.company_name}
                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6px" }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Building2 size={44} color="#94A3B8" />
                    )}
                  </div>

                  {/* Company Title & Key Tags */}
                  <div>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
                      {profile?.company_name || "Company Name Not Set"}
                    </h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      {profile?.website && (
                        <a
                          href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "0.8125rem",
                            color: "#0D9488",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          <Globe size={14} />
                          <span>{profile.website.replace(/^https?:\/\//, "")}</span>
                          <ExternalLink size={12} />
                        </a>
                      )}

                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "3px 10px",
                          borderRadius: "6px",
                          backgroundColor: "#F1F5F9",
                          color: "#475569",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        <DollarSign size={13} color="#0D9488" />
                        <span>Currency: {currencySymbols[profile?.default_currency || "INR"] || profile?.default_currency}</span>
                      </span>

                      {profile?.city && profile?.country && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 10px",
                            borderRadius: "6px",
                            backgroundColor: "#F8FAFC",
                            border: "1px solid #E2E8F0",
                            color: "#64748B",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                          }}
                        >
                          <MapPin size={13} />
                          <span>{profile.city}, {profile.country}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Statutory Quick Tags */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "220px" }}>
                  <div
                    style={{
                      backgroundColor: "#F8FAFC",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>GSTIN</span>
                    <strong style={{ fontSize: "0.8125rem", color: "#0F172A", letterSpacing: "0.04em" }}>
                      {profile?.gst_number || "Not Recorded"}
                    </strong>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#F8FAFC",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>PAN</span>
                    <strong style={{ fontSize: "0.8125rem", color: "#0F172A", letterSpacing: "0.04em" }}>
                      {profile?.pan_number || "Not Recorded"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* THREE COLUMN DETAIL CARDS */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "24px" }}>
                {/* 1. Tax & Registration */}
                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "14px",
                    border: "1px solid #E2E8F0",
                    padding: "22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #F1F5F9", paddingBottom: "12px" }}>
                    <div style={{ padding: "8px", borderRadius: "8px", backgroundColor: "#F0FDFA", color: "#0D9488" }}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                        Taxation & Registration
                      </h3>
                      <p style={{ fontSize: "0.6875rem", color: "#64748B", margin: 0 }}>
                        Official tax compliance numbers
                      </p>
                    </div>
                  </div>

                  {/* GST */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      GST Registration Number (GSTIN)
                    </span>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: profile?.gst_number ? "#0F172A" : "#94A3B8" }}>
                        {profile?.gst_number || "— None —"}
                      </span>
                      {profile?.gst_number && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(profile.gst_number, "GST Number")}
                          style={{ background: "none", border: "none", color: "#0D9488", cursor: "pointer", padding: "4px" }}
                          title="Copy GSTIN"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* PAN */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Permanent Account Number (PAN)
                    </span>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: profile?.pan_number ? "#0F172A" : "#94A3B8" }}>
                        {profile?.pan_number || "— None —"}
                      </span>
                      {profile?.pan_number && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(profile.pan_number, "PAN Number")}
                          style={{ background: "none", border: "none", color: "#0D9488", cursor: "pointer", padding: "4px" }}
                          title="Copy PAN"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Default Currency */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Default Transaction Currency
                    </span>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0D9488" }}>
                      {profile?.default_currency || "INR"} ({currencySymbols[profile?.default_currency || "INR"] || profile?.default_currency})
                    </span>
                  </div>
                </div>

                {/* 2. Official Contact Information */}
                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "14px",
                    border: "1px solid #E2E8F0",
                    padding: "22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #F1F5F9", paddingBottom: "12px" }}>
                    <div style={{ padding: "8px", borderRadius: "8px", backgroundColor: "#EFF6FF", color: "#2563EB" }}>
                      <Mail size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                        Contact Channels
                      </h3>
                      <p style={{ fontSize: "0.6875rem", color: "#64748B", margin: 0 }}>
                        Official communication lines
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Corporate Email
                    </span>
                    {profile?.email ? (
                      <a
                        href={`mailto:${profile.email}`}
                        style={{ fontSize: "0.875rem", fontWeight: 600, color: "#2563EB", textDecoration: "none" }}
                      >
                        {profile.email}
                      </a>
                    ) : (
                      <span style={{ fontSize: "0.875rem", color: "#94A3B8" }}>— None —</span>
                    )}
                  </div>

                  {/* Phone */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Contact Phone / Mobile
                    </span>
                    {profile?.phone ? (
                      <a
                        href={`tel:${profile.phone}`}
                        style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0F172A", textDecoration: "none" }}
                      >
                        {profile.phone}
                      </a>
                    ) : (
                      <span style={{ fontSize: "0.875rem", color: "#94A3B8" }}>— None —</span>
                    )}
                  </div>

                  {/* Website */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Official Website
                    </span>
                    {profile?.website ? (
                      <a
                        href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0D9488", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <span>{profile.website}</span>
                        <ExternalLink size={13} />
                      </a>
                    ) : (
                      <span style={{ fontSize: "0.875rem", color: "#94A3B8" }}>— None —</span>
                    )}
                  </div>
                </div>

                {/* 3. Registered Office & Address */}
                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "14px",
                    border: "1px solid #E2E8F0",
                    padding: "22px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #F1F5F9", paddingBottom: "12px" }}>
                    <div style={{ padding: "8px", borderRadius: "8px", backgroundColor: "#FEF3C7", color: "#D97706" }}>
                      <MapPin size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                        Registered Address
                      </h3>
                      <p style={{ fontSize: "0.6875rem", color: "#64748B", margin: 0 }}>
                        Headquarters & postal details
                      </p>
                    </div>
                  </div>

                  {/* Street Address */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                      Street Address
                    </span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: profile?.address ? "#0F172A" : "#94A3B8", lineHeight: 1.5 }}>
                      {profile?.address || "— None —"}
                    </span>
                  </div>

                  {/* City, State & Pincode */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>
                        City
                      </span>
                      <strong style={{ fontSize: "0.875rem", color: "#0F172A" }}>{profile?.city || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>
                        State
                      </span>
                      <strong style={{ fontSize: "0.875rem", color: "#0F172A" }}>{profile?.state || "—"}</strong>
                    </div>
                  </div>

                  {/* Country & Pincode */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>
                        Country
                      </span>
                      <strong style={{ fontSize: "0.875rem", color: "#0F172A" }}>{profile?.country || "India"}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase", display: "block" }}>
                        Pincode / ZIP
                      </span>
                      <strong style={{ fontSize: "0.875rem", color: "#0F172A" }}>{profile?.pincode || "—"}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================= EDIT MODE ================= */
            <form onSubmit={handleSaveChanges} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* EDIT BANNER */}
              <div
                style={{
                  backgroundColor: "#F0FDFA",
                  border: "1px solid #99F6E4",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Building2 size={20} color="#0D9488" />
                  <div>
                    <strong style={{ fontSize: "0.875rem", color: "#0F766E", display: "block" }}>
                      Edit Company Profile
                    </strong>
                    <span style={{ fontSize: "0.75rem", color: "#115E59" }}>
                      Only Administrators can update official organizational and tax records. Changes persist to PostgreSQL.
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: "#FFFFFF",
                      color: "#475569",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    style={{
                      padding: "6px 18px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: "#009F9A",
                      color: "#FFFFFF",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                    }}
                  >
                    {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                    <span>Save</span>
                  </button>
                </div>
              </div>

              {/* LOGO FILE UPLOAD SECTION */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "14px",
                  border: "1px solid #E2E8F0",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                }}
              >
                <div style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: "10px" }}>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0F172A", margin: "0 0 2px 0" }}>
                    Company Logo
                  </h3>
                  <p style={{ fontSize: "0.6875rem", color: "#64748B", margin: 0 }}>
                    File is converted to binary bytes and stored securely in PostgreSQL BYTEA.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
                  {/* Preview Container */}
                  <div
                    style={{
                      width: "110px",
                      height: "110px",
                      borderRadius: "12px",
                      backgroundColor: "#F8FAFC",
                      border: "2px dashed #CBD5E1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {logoPreviewUrl ? (
                      <img
                        src={logoPreviewUrl}
                        alt="Preview"
                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6px" }}
                      />
                    ) : profile?.has_logo ? (
                      <img
                        src={`${companyApi.getLogoUrl()}?t=${logoTimestamp}`}
                        alt="Current Logo"
                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6px" }}
                      />
                    ) : (
                      <Building2 size={36} color="#94A3B8" />
                    )}
                  </div>

                  {/* File Upload Controls */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, minWidth: "260px" }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoFileChange}
                      accept="image/png, image/jpeg, image/webp, image/svg+xml"
                      style={{ display: "none" }}
                    />

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          backgroundColor: "#F8FAFC",
                          color: "#0F172A",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Upload size={14} color="#0D9488" />
                        <span>Choose File...</span>
                      </button>

                      {selectedLogoFile && (
                        <button
                          type="button"
                          onClick={handleUploadLogoOnly}
                          disabled={isUploadingLogo}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 14px",
                            borderRadius: "8px",
                            border: "none",
                            backgroundColor: "#0D9488",
                            color: "#FFFFFF",
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {isUploadingLogo ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                          <span>Upload Now</span>
                        </button>
                      )}

                      {profile?.has_logo && (
                        <button
                          type="button"
                          onClick={handleDeleteLogo}
                          disabled={isUploadingLogo}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "8px 14px",
                            borderRadius: "8px",
                            border: "1px solid #FCA5A5",
                            backgroundColor: "#FEF2F2",
                            color: "#DC2626",
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Remove Logo</span>
                        </button>
                      )}
                    </div>

                    <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                      {selectedLogoFile
                        ? `Selected: ${selectedLogoFile.name} (${Math.round(selectedLogoFile.size / 1024)} KB) - Will be saved upon clicking Save Changes.`
                        : "Supports PNG, JPEG, WebP, or SVG (maximum file size 5MB)."}
                    </span>
                  </div>
                </div>
              </div>

              {/* INPUT FIELDS SECTION */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "14px",
                  border: "1px solid #E2E8F0",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                }}
              >
                {/* 1. Basic Identity */}
                <div>
                  <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 14px 0" }}>
                    Corporate Identity
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                        Company Name <span style={{ color: "#DC2626" }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        required
                        placeholder="e.g. Acme Corp Pvt Ltd"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "#0F172A",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                        Default Currency
                      </label>
                      <select
                        value={formData.default_currency}
                        onChange={(e) => setFormData({ ...formData, default_currency: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "#0F172A",
                          backgroundColor: "#FFFFFF",
                          boxSizing: "border-box",
                        }}
                      >
                        <option value="INR">INR (₹) - Indian Rupee</option>
                        <option value="USD">USD ($) - US Dollar</option>
                        <option value="EUR">EUR (€) - Euro</option>
                        <option value="GBP">GBP (£) - British Pound</option>
                        <option value="AED">AED - UAE Dirham</option>
                        <option value="SGD">SGD (S$) - Singapore Dollar</option>
                        <option value="CAD">CAD (C$) - Canadian Dollar</option>
                        <option value="AUD">AUD (A$) - Australian Dollar</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                        Official Website
                      </label>
                      <input
                        type="text"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        placeholder="e.g. https://www.company.com"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          color: "#0F172A",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Statutory Taxation IDs */}
                <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "16px" }}>
                  <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 14px 0" }}>
                    Statutory & Tax Registration
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                        GST Number (GSTIN)
                      </label>
                      <input
                        type="text"
                        value={formData.gst_number}
                        onChange={(e) => setFormData({ ...formData, gst_number: e.target.value.toUpperCase() })}
                        placeholder="e.g. 27ABCDE1234F1Z5"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "#0F172A",
                          boxSizing: "border-box",
                          letterSpacing: "0.04em",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                        PAN Number
                      </label>
                      <input
                        type="text"
                        value={formData.pan_number}
                        onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                        placeholder="e.g. ABCDE1234F"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          fontWeight: 600,
                          color: "#0F172A",
                          boxSizing: "border-box",
                          letterSpacing: "0.04em",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Contact Information */}
                <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "16px" }}>
                  <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 14px 0" }}>
                    Contact Details
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                        Corporate Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="e.g. info@company.com"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          color: "#0F172A",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                        Official Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="e.g. +91 98765 43210"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          color: "#0F172A",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Registered Address */}
                <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "16px" }}>
                  <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 14px 0" }}>
                    Registered Address
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                        Street / Building / Suite Address
                      </label>
                      <textarea
                        rows={2}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="e.g. Level 4, TechHub Towers, Cyber City"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8125rem",
                          color: "#0F172A",
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                          resize: "vertical",
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                          City
                        </label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="e.g. Pune"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.8125rem",
                            color: "#0F172A",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                          State
                        </label>
                        <input
                          type="text"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          placeholder="e.g. Maharashtra"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.8125rem",
                            color: "#0F172A",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                          Country
                        </label>
                        <input
                          type="text"
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          placeholder="e.g. India"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.8125rem",
                            color: "#0F172A",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                          Pincode / ZIP
                        </label>
                        <input
                          type="text"
                          value={formData.pincode}
                          onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                          placeholder="e.g. 411001"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.8125rem",
                            color: "#0F172A",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM FORM BUTTONS */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "12px",
                    borderTop: "1px solid #E2E8F0",
                    paddingTop: "20px",
                    marginTop: "8px",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    style={{
                      padding: "9px 20px",
                      borderRadius: "8px",
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
                    disabled={isSaving}
                    style={{
                      padding: "9px 26px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "#009F9A",
                      color: "#FFFFFF",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: isSaving ? "not-allowed" : "pointer",
                      opacity: isSaving ? 0.7 : 1,
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
