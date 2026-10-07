"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { authApi } from "@/lib/api";

type AuthMode = "login" | "forgot-step1" | "forgot-step2" | "reset-success";

export default function LoginPage() {
  const router = useRouter();

  // Login states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forgot Password flow states
  const [mode, setMode] = useState<AuthMode>("login");
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Normal login submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authApi.login(email, password);
      setSuccessMsg("Authentication successful! Redirecting to CRM Dashboard...");
      const redirectUrl =
        typeof window !== "undefined" && new URLSearchParams(window.location.search).get("redirect")
          ? (new URLSearchParams(window.location.search).get("redirect") as string)
          : "/leads";
      setTimeout(() => {
        router.push(redirectUrl);
      }, 450);
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
      setIsLoading(false);
    }
  };

  // Step 1: Verify registered email address exists in CRM database
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setResetError("Please enter your registered email address.");
      return;
    }

    setIsResetLoading(true);

    try {
      await authApi.verifyEmail(cleanEmail);
      setIsResetLoading(false);
      setResetError(null);
      setMode("forgot-step2");
    } catch (err: any) {
      setIsResetLoading(false);
      setResetError(err.message || "No account found with this email address. Please check and try again.");
    }
  };

  // Step 2: Set New Password & Confirm Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (newPassword.length < 6) {
      setResetError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match. Please re-enter.");
      return;
    }

    setIsResetLoading(true);

    try {
      const res = await authApi.resetPassword(resetEmail.trim(), newPassword, confirmPassword);
      setIsResetLoading(false);
      setResetSuccess(res.message || "Password updated successfully!");
      setMode("reset-success");
    } catch (err: any) {
      setIsResetLoading(false);
      setResetError(err.message || "Failed to reset password. Please try again.");
    }
  };

  // Transition back to Sign In view
  const returnToLogin = () => {
    setMode("login");
    setResetError(null);
    setResetSuccess(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="auth-page-wrapper">
      {/* Background Floating Gradient Orbs */}
      <div className="auth-orb-1" aria-hidden="true" />
      <div className="auth-orb-2" aria-hidden="true" />

      {/* Single Elevated Centered Authentication Card */}
      <div className="auth-card">
        <div className="auth-card-content">
          {/* Brand Header */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.625rem",
                marginBottom: "0.75rem",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, var(--primary-teal) 0%, var(--primary-blue) 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: "1.125rem",
                  boxShadow: "0 4px 12px rgba(0, 159, 154, 0.25)",
                }}
              >
                C
              </div>
              <span
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.025em",
                }}
              >
                CRM
              </span>
            </Link>

            <h1
              style={{
                fontSize: "1.375rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.015em",
                margin: 0,
              }}
            >
              {mode === "login" && "Welcome back"}
              {mode === "forgot-step1" && "Reset your password"}
              {mode === "forgot-step2" && "Create new password"}
              {mode === "reset-success" && "Password updated"}
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                marginTop: "0.35rem",
                marginBottom: 0,
              }}
            >
              {mode === "login" && "Sign in to manage and convert your CRM leads"}
              {mode === "forgot-step1" && "Step 1 of 2: Verify your registered CRM email address"}
              {mode === "forgot-step2" && "Step 2 of 2: Enter your new password below"}
              {mode === "reset-success" && "Your credentials have been securely updated"}
            </p>
          </div>

          {/* ========================================================================= */}
          {/* VIEW: LOGIN                                                               */}
          {/* ========================================================================= */}
          {mode === "login" && (
            <>
              {/* Segmented Pill Switcher between Sign In and Register */}
              <div className="auth-switcher">
                <div className="auth-switcher-tab active">
                  <LogIn size={15} />
                  <span>Sign In</span>
                </div>
                <Link href="/register" className="auth-switcher-tab">
                  <UserPlus size={15} />
                  <span>Create Account</span>
                </Link>
              </div>

              {/* Alerts */}
              {error && (
                <div className="alert alert-danger" id="login-error-alert" style={{ marginBottom: "1.25rem" }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>{error}</div>
                </div>
              )}

              {successMsg && (
                <div className="alert alert-success" id="login-success-alert" style={{ marginBottom: "1.25rem" }}>
                  <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>{successMsg}</div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" htmlFor="email-input">
                    Work Email Address
                  </label>
                  <input
                    id="email-input"
                    type="email"
                    className="auth-input-field"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "0.5rem" }}>
                  <label className="form-label" htmlFor="password-input">
                    Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="password-input"
                      type={showPassword ? "text" : "password"}
                      className="auth-input-field"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{ paddingRight: "2.75rem" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-secondary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.25rem" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email || "");
                      setResetError(null);
                      setMode("forgot-step1");
                    }}
                    id="link-forgot-password"
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontSize: "0.8125rem",
                      color: "var(--primary-teal)",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "color 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary-teal-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--primary-teal)")}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={isLoading}
                  id="btn-login-submit"
                >
                  {isLoading ? (
                    <span>Signing in...</span>
                  ) : (
                    <>
                      <LogIn size={17} /> Sign In
                    </>
                  )}
                </button>
              </form>

              {/* Footer Navigation */}
              <div
                style={{
                  marginTop: "1.5rem",
                  textAlign: "center",
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                }}
              >
                Need an account?{" "}
                <Link
                  href="/register"
                  style={{
                    color: "var(--primary-teal)",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Create an account
                </Link>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* VIEW: FORGOT PASSWORD - STEP 1 (VERIFY EMAIL)                              */}
          {/* ========================================================================= */}
          {mode === "forgot-step1" && (
            <div>
              {resetError && (
                <div className="alert alert-danger" id="reset-error-alert" style={{ marginBottom: "1.25rem" }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>{resetError}</div>
                </div>
              )}

              <form onSubmit={handleVerifyEmail}>
                <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                  <label className="form-label" htmlFor="reset-email-input">
                    Registered Email Address
                  </label>
                  <input
                    id="reset-email-input"
                    type="email"
                    className="auth-input-field"
                    placeholder="Enter your registered email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem", display: "block" }}>
                    We will verify that this email exists in the CRM database before resetting.
                  </span>
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={isResetLoading}
                  id="btn-verify-email"
                >
                  {isResetLoading ? (
                    <span>Verifying Email...</span>
                  ) : (
                    <>
                      <KeyRound size={17} /> Verify & Continue
                    </>
                  )}
                </button>
              </form>

              <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
                <button
                  type="button"
                  onClick={returnToLogin}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW: FORGOT PASSWORD - STEP 2 (SET NEW PASSWORD)                          */}
          {/* ========================================================================= */}
          {mode === "forgot-step2" && (
            <div>
              {/* Verified Account Pill */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  backgroundColor: "var(--light-teal)",
                  border: "1px solid rgba(0, 159, 154, 0.25)",
                  borderRadius: "10px",
                  padding: "0.6rem 0.85rem",
                  marginBottom: "1.25rem",
                  fontSize: "0.8125rem",
                  color: "var(--primary-teal)",
                  fontWeight: 600,
                }}
              >
                <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Verified: <strong style={{ color: "#0F172A" }}>{resetEmail}</strong>
                </div>
              </div>

              {resetError && (
                <div className="alert alert-danger" id="reset-error-alert" style={{ marginBottom: "1.25rem" }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>{resetError}</div>
                </div>
              )}

              <form onSubmit={handleResetPassword}>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label" htmlFor="new-password-input">
                    New Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="new-password-input"
                      type={showNewPassword ? "text" : "password"}
                      className="auth-input-field"
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoFocus
                      style={{ paddingRight: "2.75rem" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-secondary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                  <label className="form-label" htmlFor="confirm-new-password-input">
                    Confirm New Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="confirm-new-password-input"
                      type={showConfirmPassword ? "text" : "password"}
                      className="auth-input-field"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      style={{ paddingRight: "2.75rem" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-secondary)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={isResetLoading}
                  id="btn-update-password"
                >
                  {isResetLoading ? (
                    <span>Updating Password...</span>
                  ) : (
                    <>
                      <KeyRound size={17} /> Update Password
                    </>
                  )}
                </button>
              </form>

              <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
                <button
                  type="button"
                  onClick={returnToLogin}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  <ArrowLeft size={14} /> Cancel & Return to Sign In
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW: RESET SUCCESS                                                       */}
          {/* ========================================================================= */}
          {mode === "reset-success" && (
            <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "var(--success-bg)",
                  border: "2px solid var(--success-border)",
                  color: "var(--success)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                }}
              >
                <CheckCircle2 size={30} />
              </div>

              <h2
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: "0.5rem",
                }}
              >
                Password Changed Successfully
              </h2>

              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  marginBottom: "1.5rem",
                }}
              >
                {resetSuccess || "Your password has been updated in PostgreSQL. You can now sign in with your new credentials."}
              </p>

              <button
                type="button"
                onClick={() => {
                  setEmail(resetEmail);
                  setPassword("");
                  returnToLogin();
                }}
                className="auth-submit-btn"
                id="btn-return-login-success"
              >
                <LogIn size={17} /> Sign In with New Password
              </button>
            </div>
          )}
        </div>

        {/* Back to Homepage */}
        <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
          <Link
            href="/"
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-muted)",
              textDecoration: "none",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            ← Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
