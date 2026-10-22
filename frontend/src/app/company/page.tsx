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
  Send,
  Clock,
  AlertTriangle,
  Eye,
  Server,
  Shield,
  CheckCheck,
  Key,
} from "lucide-react";
import {
  companyApi,
  CompanyProfile,
  CompanyProfileUpdateInput,
  authApi,
  getStoredUser,
  User,
  emailApi,
  EmailLog,
  DeliverabilityConfig,
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

  // Sub-tab Navigation State
  const [activeSubTab, setActiveSubTab] = useState<"profile" | "emails">("profile");

  // Email Deliverability & Logs State
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [emailTotal, setEmailTotal] = useState<number>(0);
  const [deliverability, setDeliverability] = useState<DeliverabilityConfig | null>(null);
  const [isEmailLoading, setIsEmailLoading] = useState<boolean>(false);
  const [emailStatusFilter, setEmailStatusFilter] = useState<string>("all");
  const [emailTypeFilter, setEmailTypeFilter] = useState<string>("all");
  const [retryingEmailId, setRetryingEmailId] = useState<number | null>(null);
  const [previewEmail, setPreviewEmail] = useState<EmailLog | null>(null);

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

  // Load Email Logs & Deliverability
  const loadEmailData = useCallback(async () => {
    try {
      setIsEmailLoading(true);
      const [logsRes, delivRes] = await Promise.all([
        emailApi.list({
          status: emailStatusFilter === "all" ? undefined : emailStatusFilter,
          email_type: emailTypeFilter === "all" ? undefined : emailTypeFilter,
          limit: 100,
        }),
        emailApi.getDeliverability(),
      ]);
      setEmailLogs(logsRes.logs || logsRes.items || []);
      setEmailTotal(logsRes.total || 0);
      setDeliverability(delivRes);
    } catch (err: any) {
      console.error("Failed to load email data:", err);
      showToast(err?.message || "Failed to load outgoing email records", "error");
    } finally {
      setIsEmailLoading(false);
    }
  }, [emailStatusFilter, emailTypeFilter]);

  useEffect(() => {
    if (activeSubTab === "emails") {
      loadEmailData();
    }
  }, [activeSubTab, loadEmailData]);

  // Handle Retry Email
  const handleRetryEmail = async (id: number) => {
    try {
      setRetryingEmailId(id);
      await emailApi.retry(id);
      showToast("Email queued for immediate retry!");
      await loadEmailData();
    } catch (err: any) {
      console.error("Retry email delivery error:", err);
      showToast(err?.message || "Failed to retry email delivery", "error");
    } finally {
      setRetryingEmailId(null);
    }
  };

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
    <div style={{ display: "flex", width: "100%", minHeight: "100vh", backgroundColor: "#F8FAFC" }}>
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
          else if (tab === "inventory") router.push("/inventory");
          else if (tab === "deals") router.push("/deals");
          else if (tab === "quotations") router.push("/quotations");
          else if (tab === "orders") router.push("/orders");
          else if (tab === "invoices") router.push("/invoices");
          else if (tab === "products") router.push("/products");
          else if (tab === "company") router.push("/company");
          else if (tab === "api-keys") router.push("/leads?tab=api-keys");
          else if (tab === "api-docs") router.push("/leads?tab=api-docs");
          else if (tab === "profile") router.push("/leads?tab=profile");
          else if (tab === "admin-settings") router.push("/admin-settings");
        }}
        user={currentUser}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenAdminSettings={() => router.push("/admin-settings")}
      />

      {/* Main Content Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: "100vh" }}>
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
                backgroundColor: activeSubTab === "profile" ? "#F0FDFA" : "#EEF2FF",
                border: activeSubTab === "profile" ? "1px solid #CCFBF1" : "1px solid #E0E7FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: activeSubTab === "profile" ? "#0D9488" : "#4F46E5",
              }}
            >
              {activeSubTab === "profile" ? <Building2 size={24} /> : <Mail size={24} />}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                  {activeSubTab === "profile" ? "Company Profile" : "Email Deliverability & Outgoing Logs"}
                </h1>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 10px",
                    borderRadius: "999px",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    backgroundColor: activeSubTab === "profile" ? "#ECFDF5" : (deliverability?.mock_mode ? "#FEF3C7" : "#ECFDF5"),
                    color: activeSubTab === "profile" ? "#059669" : (deliverability?.mock_mode ? "#D97706" : "#059669"),
                    border: `1px solid ${activeSubTab === "profile" ? "#A7F3D0" : (deliverability?.mock_mode ? "#FDE68A" : "#A7F3D0")}`,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {activeSubTab === "profile" ? "Active Entity" : (deliverability?.mock_mode ? "Sandbox Mode" : "Live SMTP Active")}
                </span>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "2px 0 0 0" }}>
                {activeSubTab === "profile"
                  ? "Official organization details, statutory taxation IDs, and billing identity"
                  : "Automated SMTP dispatch, Maroto v2 PDF attachments, retry queue, and SPF/DKIM/DMARC audit"}
              </p>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#F1F5F9",
              padding: "4px",
              borderRadius: "10px",
              gap: "4px",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveSubTab("profile")}
              style={{
                padding: "7px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: activeSubTab === "profile" ? "#FFFFFF" : "transparent",
                color: activeSubTab === "profile" ? "#0F172A" : "#64748B",
                fontWeight: activeSubTab === "profile" ? 600 : 500,
                fontSize: "0.8125rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                boxShadow: activeSubTab === "profile" ? "0 1px 3px rgba(0, 0, 0, 0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Building2 size={15} color={activeSubTab === "profile" ? "#009F9A" : "#64748B"} />
              <span>Company Profile</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSubTab("emails");
                loadEmailData();
              }}
              style={{
                padding: "7px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: activeSubTab === "emails" ? "#FFFFFF" : "transparent",
                color: activeSubTab === "emails" ? "#0F172A" : "#64748B",
                fontWeight: activeSubTab === "emails" ? 600 : 500,
                fontSize: "0.8125rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                boxShadow: activeSubTab === "emails" ? "0 1px 3px rgba(0, 0, 0, 0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Mail size={15} color={activeSubTab === "emails" ? "#009F9A" : "#64748B"} />
              <span>Automated Emails & Logs</span>
              {emailTotal > 0 && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    backgroundColor: activeSubTab === "emails" ? "#009F9A" : "#CBD5E1",
                    color: "#FFFFFF",
                    padding: "1px 7px",
                    borderRadius: "999px",
                  }}
                >
                  {emailTotal}
                </span>
              )}
            </button>
          </div>

          {/* Action Header Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={activeSubTab === "profile" ? loadProfile : loadEmailData}
              disabled={activeSubTab === "profile" ? isLoading : isEmailLoading}
              title={activeSubTab === "profile" ? "Refresh profile details" : "Refresh outgoing emails"}
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
              <RefreshCw size={14} className={(activeSubTab === "profile" ? isLoading : isEmailLoading) ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>

            {activeSubTab === "emails" ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#F0FDFA",
                  border: "1px solid #CCFBF1",
                  color: "#0F766E",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                <Clock size={14} color="#0D9488" />
                <span>Scheduler: 60s Ticker Active</span>
              </div>
            ) : !isEditing ? (
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

        {/* Page Body */}
        <div style={{ flex: 1, padding: "28px", maxWidth: "1280px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          {activeSubTab === "emails" ? (
            /* ================= EMAIL DELIVERABILITY & AUDIT LOGS ================= */
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Deliverability & Gateway Card */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "16px",
                  border: "1px solid #E2E8F0",
                  padding: "24px",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        backgroundColor: "#EEF2FF",
                        border: "1px solid #E0E7FF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#4F46E5",
                      }}
                    >
                      <Server size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0F172A", margin: "0 0 4px 0" }}>
                        SMTP Gateway & Deliverability Center
                      </h3>
                      <p style={{ fontSize: "0.8125rem", color: "#64748B", margin: 0 }}>
                        Automated background notifications, Maroto v2 PDF quotation & invoice dispatches, retry handling, and DNS deliverability
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "5px 12px",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        backgroundColor: deliverability?.mock_mode ? "#FEF3C7" : "#ECFDF5",
                        color: deliverability?.mock_mode ? "#B45309" : "#059669",
                        border: `1px solid ${deliverability?.mock_mode ? "#FDE68A" : "#A7F3D0"}`,
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: deliverability?.mock_mode ? "#F59E0B" : "#10B981",
                        }}
                      />
                      {deliverability?.mock_mode ? "Development Sandbox (Mock Console)" : "Production SMTP Gateway"}
                    </span>
                  </div>
                </div>

                {/* Gateway Details Row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                    backgroundColor: "#F8FAFC",
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid #F1F5F9",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                      SMTP Host & Port
                    </span>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1E293B", margin: "4px 0 0 0" }}>
                      {deliverability?.smtp_host || "127.0.0.1"} : {deliverability?.smtp_port || 587}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                      Encryption Protocol
                    </span>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1E293B", margin: "4px 0 0 0" }}>
                      {deliverability?.encryption?.toUpperCase() || "STARTTLS (TLS v1.2+)"}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                      Sender Identity
                    </span>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1E293B", margin: "4px 0 0 0" }}>
                      {deliverability?.from_name || "CRM Admin"} &lt;{deliverability?.from_email || "no-reply@crm.internal"}&gt;
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                      Retry Architecture
                    </span>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1E293B", margin: "4px 0 0 0" }}>
                      3 Attempts (2m, 5m, 15m) + Idempotency
                    </p>
                  </div>
                </div>

                {/* DNS Records Section */}
                <div>
                  <h4 style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 12px 0" }}>
                    DNS Authentication & Anti-Spoofing Protocols
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
                    {/* SPF Record */}
                    <div
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "12px",
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Shield size={16} color="#0D9488" />
                          <strong style={{ fontSize: "0.875rem", color: "#0F172A" }}>SPF Record</strong>
                        </div>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#059669", backgroundColor: "#ECFDF5", padding: "2px 8px", borderRadius: "999px" }}>
                          Configured
                        </span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>
                        Authorizes CRM outbound mail servers to send on behalf of your domain name.
                      </p>
                      <div
                        style={{
                          backgroundColor: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                          color: "#334155",
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          v=spf1 include:_spf.crm.app ~all
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText("v=spf1 include:_spf.crm.app ~all", "SPF Record")}
                          title="Copy SPF Record"
                          style={{ border: "none", background: "none", cursor: "pointer", color: "#64748B", padding: "2px" }}
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>

                    {/* DKIM Record */}
                    <div
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "12px",
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Key size={16} color="#6366F1" />
                          <strong style={{ fontSize: "0.875rem", color: "#0F172A" }}>DKIM Record</strong>
                        </div>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#4F46E5", backgroundColor: "#EEF2FF", padding: "2px 8px", borderRadius: "999px" }}>
                          2048-bit RSA
                        </span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>
                        Cryptographically validates outgoing headers to guarantee email integrity and domain reputation.
                      </p>
                      <div
                        style={{
                          backgroundColor: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                          color: "#334155",
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          crm._domainkey TXT v=DKIM1; k=rsa;
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText("crm._domainkey TXT v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ==", "DKIM Record")}
                          title="Copy DKIM Record"
                          style={{ border: "none", background: "none", cursor: "pointer", color: "#64748B", padding: "2px" }}
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>

                    {/* DMARC Record */}
                    <div
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: "12px",
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <ShieldCheck size={16} color="#059669" />
                          <strong style={{ fontSize: "0.875rem", color: "#0F172A" }}>DMARC Policy</strong>
                        </div>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#059669", backgroundColor: "#ECFDF5", padding: "2px 8px", borderRadius: "999px" }}>
                          Quarantine / Protect
                        </span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>
                        Aligns SPF and DKIM authentication to protect your brand from email spoofing and phishing.
                      </p>
                      <div
                        style={{
                          backgroundColor: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                          color: "#334155",
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          v=DMARC1; p=quarantine; pct=100;
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText("v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@crm.internal", "DMARC Record")}
                          title="Copy DMARC Record"
                          style={{ border: "none", background: "none", cursor: "pointer", color: "#64748B", padding: "2px" }}
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics Summary Strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
                    <Mail size={20} />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>Total Dispatched</span>
                    <h4 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#0F172A", margin: "2px 0 0 0" }}>{emailTotal}</h4>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669" }}>
                    <CheckCheck size={20} />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 600 }}>Delivered Successfully</span>
                    <h4 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#065F46", margin: "2px 0 0 0" }}>
                      {emailLogs.filter((l) => l.status === "sent").length}
                    </h4>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", color: "#D97706" }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#D97706", fontWeight: 600 }}>In Retry / Pending Queue</span>
                    <h4 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#92400E", margin: "2px 0 0 0" }}>
                      {emailLogs.filter((l) => l.status === "pending").length}
                    </h4>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626" }}>
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "#DC2626", fontWeight: 600 }}>Delivery Failures</span>
                    <h4 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#991B1B", margin: "2px 0 0 0" }}>
                      {emailLogs.filter((l) => l.status === "failed").length}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Outgoing Activity Table Card */}
              <div
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "16px",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  overflow: "hidden",
                }}
              >
                {/* Table Header Toolbar */}
                <div
                  style={{
                    padding: "16px 24px",
                    borderBottom: "1px solid #E2E8F0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "14px",
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#0F172A", margin: "0 0 2px 0" }}>
                      Outgoing Email Delivery Logs
                    </h4>
                    <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0 }}>
                      Complete audit trail of all automated quotation, invoice, and follow-up emails
                    </p>
                  </div>

                  {/* Filters */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    {/* Status Filter */}
                    <div style={{ display: "flex", alignItems: "center", backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "2px" }}>
                      {(["all", "sent", "pending", "failed"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setEmailStatusFilter(s)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "none",
                            backgroundColor: emailStatusFilter === s ? "#009F9A" : "transparent",
                            color: emailStatusFilter === s ? "#FFFFFF" : "#64748B",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            textTransform: "capitalize",
                          }}
                        >
                          {s === "all" ? "All Status" : s}
                        </button>
                      ))}
                    </div>

                    {/* Type Filter */}
                    <select
                      value={emailTypeFilter}
                      onChange={(e) => setEmailTypeFilter(e.target.value)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                        backgroundColor: "#FFFFFF",
                        fontSize: "0.75rem",
                        color: "#334155",
                        fontWeight: 500,
                        outline: "none",
                      }}
                    >
                      <option value="all">All Email Types</option>
                      <option value="quotation_finalized">Quotation Finalized</option>
                      <option value="invoice_finalized">Invoice Finalized</option>
                      <option value="follow_up_reminder">Follow-up Reminder</option>
                    </select>

                    <button
                      type="button"
                      onClick={loadEmailData}
                      disabled={isEmailLoading}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        backgroundColor: "#FFFFFF",
                        color: "#475569",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <RefreshCw size={12} className={isEmailLoading ? "animate-spin" : ""} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Table Content */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.8125rem" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569" }}>
                        <th style={{ padding: "12px 18px", fontWeight: 600 }}>Recipient</th>
                        <th style={{ padding: "12px 18px", fontWeight: 600 }}>Notification Type</th>
                        <th style={{ padding: "12px 18px", fontWeight: 600 }}>Subject & Attachment</th>
                        <th style={{ padding: "12px 18px", fontWeight: 600 }}>Status</th>
                        <th style={{ padding: "12px 18px", fontWeight: 600 }}>Attempts / Error</th>
                        <th style={{ padding: "12px 18px", fontWeight: 600 }}>Timestamp</th>
                        <th style={{ padding: "12px 18px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isEmailLoading ? (
                        <tr>
                          <td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#64748B" }}>
                            <RefreshCw size={24} className="animate-spin" color="#0D9488" style={{ margin: "0 auto 8px" }} />
                            <div>Loading email delivery records...</div>
                          </td>
                        </tr>
                      ) : emailLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#64748B" }}>
                            <Mail size={32} color="#CBD5E1" style={{ margin: "0 auto 8px" }} />
                            <div style={{ fontWeight: 600, color: "#334155" }}>No outgoing email logs found</div>
                            <p style={{ fontSize: "0.75rem", color: "#94A3B8", margin: "4px 0 0 0" }}>
                              Automated emails will appear here when quotations or invoices are finalized, or follow-ups reach their scheduled due time.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        emailLogs.map((log) => {
                          const isSent = log.status === "sent";
                          const isFailed = log.status === "failed";
                          const isPending = log.status === "pending";

                          return (
                            <tr
                              key={log.id}
                              style={{
                                borderBottom: "1px solid #F1F5F9",
                                transition: "background-color 0.1s",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                            >
                              {/* Recipient */}
                              <td style={{ padding: "14px 18px" }}>
                                <div style={{ fontWeight: 600, color: "#0F172A" }}>
                                  {log.recipient_name || "Recipient"}
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "#64748B", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                                  <Mail size={12} />
                                  <span>{log.recipient_email}</span>
                                </div>
                              </td>

                              {/* Notification Type */}
                              <td style={{ padding: "14px 18px" }}>
                                {log.email_type === "quotation_finalized" ? (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      padding: "3px 9px",
                                      borderRadius: "6px",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      backgroundColor: "#EEF2FF",
                                      color: "#4F46E5",
                                      border: "1px solid #E0E7FF",
                                    }}
                                  >
                                    <FileText size={12} />
                                    <span>Quotation</span>
                                  </span>
                                ) : log.email_type === "invoice_finalized" ? (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      padding: "3px 9px",
                                      borderRadius: "6px",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      backgroundColor: "#ECFDF5",
                                      color: "#059669",
                                      border: "1px solid #A7F3D0",
                                    }}
                                  >
                                    <DollarSign size={12} />
                                    <span>Invoice</span>
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      padding: "3px 9px",
                                      borderRadius: "6px",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      backgroundColor: "#FFFBEB",
                                      color: "#D97706",
                                      border: "1px solid #FDE68A",
                                    }}
                                  >
                                    <Clock size={12} />
                                    <span>Follow-Up</span>
                                  </span>
                                )}
                              </td>

                              {/* Subject & Attachment */}
                              <td style={{ padding: "14px 18px", maxWidth: "280px" }}>
                                <div
                                  style={{
                                    fontWeight: 500,
                                    color: "#1E293B",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={log.subject}
                                >
                                  {log.subject}
                                </div>
                                {log.has_attachment && (
                                  <div
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      marginTop: "4px",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      backgroundColor: "#FEF2F2",
                                      color: "#B91C1C",
                                      border: "1px solid #FEE2E2",
                                      fontSize: "0.6875rem",
                                      fontWeight: 600,
                                    }}
                                  >
                                    <FileText size={10} />
                                    <span>{log.attachment_name || "Maroto v2 PDF"}</span>
                                  </div>
                                )}
                              </td>

                              {/* Status */}
                              <td style={{ padding: "14px 18px" }}>
                                {isSent ? (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      padding: "3px 10px",
                                      borderRadius: "999px",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      backgroundColor: "#ECFDF5",
                                      color: "#059669",
                                      border: "1px solid #A7F3D0",
                                    }}
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>Delivered</span>
                                  </span>
                                ) : isPending ? (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      padding: "3px 10px",
                                      borderRadius: "999px",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      backgroundColor: "#FFFBEB",
                                      color: "#D97706",
                                      border: "1px solid #FDE68A",
                                    }}
                                  >
                                    <Clock size={13} />
                                    <span>Queued / In Retry</span>
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      padding: "3px 10px",
                                      borderRadius: "999px",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      backgroundColor: "#FEF2F2",
                                      color: "#DC2626",
                                      border: "1px solid #FCA5A5",
                                    }}
                                  >
                                    <AlertCircle size={13} />
                                    <span>Failed</span>
                                  </span>
                                )}
                              </td>

                              {/* Attempts / Error */}
                              <td style={{ padding: "14px 18px" }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#334155" }}>
                                  Attempt {log.retry_count} of {log.max_retries}
                                </div>
                                {log.last_error && (
                                  <div
                                    style={{
                                      fontSize: "0.6875rem",
                                      color: "#DC2626",
                                      maxWidth: "180px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      marginTop: "2px",
                                    }}
                                    title={log.last_error}
                                  >
                                    {log.last_error}
                                  </div>
                                )}
                              </td>

                              {/* Timestamp */}
                              <td style={{ padding: "14px 18px", color: "#64748B", fontSize: "0.75rem" }}>
                                {new Date(log.sent_at || log.created_at).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>

                              {/* Actions */}
                              <td style={{ padding: "14px 18px", textAlign: "right" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewEmail(log)}
                                    title="View Email Message"
                                    style={{
                                      padding: "5px 9px",
                                      borderRadius: "6px",
                                      border: "1px solid #CBD5E1",
                                      backgroundColor: "#FFFFFF",
                                      color: "#475569",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <Eye size={12} />
                                    <span>View</span>
                                  </button>

                                  {(isFailed || isPending) && (
                                    <button
                                      type="button"
                                      onClick={() => handleRetryEmail(log.id)}
                                      disabled={retryingEmailId === log.id}
                                      title="Trigger Immediate Retry"
                                      style={{
                                        padding: "5px 9px",
                                        borderRadius: "6px",
                                        border: "none",
                                        backgroundColor: "#009F9A",
                                        color: "#FFFFFF",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        cursor: retryingEmailId === log.id ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      <RefreshCw size={12} className={retryingEmailId === log.id ? "animate-spin" : ""} />
                                      <span>Retry</span>
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
              </div>
            </div>
          ) : isLoading ? (
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

      {/* Email Message Detail & Audit Modal */}
      {previewEmail && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setPreviewEmail(null)}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
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
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    backgroundColor: "#EEF2FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#4F46E5",
                  }}
                >
                  <Mail size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    Email Audit Log &amp; Preview
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    ID: {previewEmail.id}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewEmail(null)}
                style={{
                  border: "none",
                  backgroundColor: "transparent",
                  color: "#64748B",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "8px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Metadata Summary Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                  backgroundColor: "#F8FAFC",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                    Recipient
                  </span>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A", marginTop: "2px" }}>
                    {previewEmail.recipient_name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{previewEmail.recipient_email}</div>
                </div>

                <div>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                    Status &amp; Retries
                  </span>
                  <div style={{ marginTop: "4px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor:
                          previewEmail.status === "sent" ? "#ECFDF5" : previewEmail.status === "pending" ? "#FFFBEB" : "#FEF2F2",
                        color:
                          previewEmail.status === "sent" ? "#059669" : previewEmail.status === "pending" ? "#D97706" : "#DC2626",
                      }}
                    >
                      {previewEmail.status.toUpperCase()} ({previewEmail.retry_count}/{previewEmail.max_retries})
                    </span>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                    Event Trigger
                  </span>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#334155", marginTop: "2px" }}>
                    {previewEmail.email_type.replace(/_/g, " ").toUpperCase()}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    Entity: {previewEmail.entity_type} #{previewEmail.entity_id}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                    Idempotency Key
                  </span>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.6875rem",
                      color: "#475569",
                      marginTop: "4px",
                      backgroundColor: "#FFFFFF",
                      padding: "4px 6px",
                      borderRadius: "6px",
                      border: "1px solid #E2E8F0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={previewEmail.idempotency_key}
                  >
                    {previewEmail.idempotency_key}
                  </div>
                </div>
              </div>

              {/* PDF Attachment Notice */}
              {previewEmail.has_attachment && (
                <div
                  style={{
                    backgroundColor: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <FileText size={18} color="#DC2626" />
                  <span style={{ fontSize: "0.8125rem", color: "#991B1B", fontWeight: 600 }}>
                    Maroto v2 PDF Attached: {previewEmail.attachment_name || "document.pdf"}
                  </span>
                </div>
              )}

              {/* Error Callout if any */}
              {previewEmail.last_error && (
                <div
                  style={{
                    backgroundColor: "#FEF2F2",
                    border: "1px solid #F87171",
                    borderRadius: "10px",
                    padding: "12px 16px",
                  }}
                >
                  <strong style={{ fontSize: "0.75rem", color: "#991B1B", display: "block" }}>
                    Last Delivery Error:
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "#DC2626", fontFamily: "monospace" }}>
                    {previewEmail.last_error}
                  </span>
                </div>
              )}

              {/* Subject */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "4px" }}>
                  Subject Line
                </label>
                <div
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "#0F172A",
                    backgroundColor: "#F8FAFC",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                  }}
                >
                  {previewEmail.subject}
                </div>
              </div>

              {/* Rendered HTML / Text Body */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "6px" }}>
                  Rendered Email Body
                </label>
                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: "10px",
                    padding: "18px",
                    maxHeight: "360px",
                    overflowY: "auto",
                  }}
                >
                  {previewEmail.body_html ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: previewEmail.body_html }}
                      style={{ fontSize: "0.875rem", color: "#1E293B", lineHeight: "1.5" }}
                    />
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                        fontSize: "0.875rem",
                        color: "#334155",
                      }}
                    >
                      {previewEmail.body_text}
                    </pre>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#F8FAFC",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                {previewEmail.sent_at
                  ? `Delivered on ${new Date(previewEmail.sent_at).toLocaleString()}`
                  : `Queued on ${new Date(previewEmail.created_at).toLocaleString()}`}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {(previewEmail.status === "failed" || previewEmail.status === "pending") && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleRetryEmail(previewEmail.id);
                      setPreviewEmail(null);
                    }}
                    style={{
                      padding: "7px 16px",
                      borderRadius: "8px",
                      border: "none",
                      backgroundColor: "#009F9A",
                      color: "#FFFFFF",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>Retry Dispatch</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPreviewEmail(null)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    backgroundColor: "#FFFFFF",
                    color: "#475569",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
