"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle2, LogIn } from "lucide-react";
import { authApi } from "@/lib/api";

function OfficialGoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0, marginRight: "0.625rem" }}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Ensure canonical origin is http://localhost:3000 (auto-redirect from 127.0.0.1:3000)
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hostname === "127.0.0.1") {
      const canonicalUrl = window.location.href.replace("127.0.0.1", "localhost");
      window.location.replace(canonicalUrl);
    }
  }, []);

  // Load official Google Identity Services script
  useEffect(() => {
    const existingScript = document.getElementById("google-gsi-client");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-gsi-client";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setIsLoading(true);

    try {
      await authApi.register(name, email, password);
      setSuccessMsg("Account created successfully! Preparing your Leads dashboard...");
      setTimeout(() => {
        router.push("/leads");
      }, 500);
    } catch (err: any) {
      setError(err.message || "Failed to register account.");
      setIsLoading(false);
    }
  };

  // Helper to format Google OAuth error responses into clear actionable feedback
  const formatGoogleError = (errObj: any): string => {
    const errStr = String(
      errObj?.error_description ||
      errObj?.error ||
      errObj?.message ||
      errObj?.details ||
      (typeof errObj === "string" ? errObj : JSON.stringify(errObj))
    );

    if (
      errStr.includes("invalid_client") ||
      errStr.includes("origin") ||
      errStr.includes("401") ||
      errStr.includes("unregistered_origin")
    ) {
      return "Google OAuth 401 (invalid_client): Ensure your OAuth Client in Google Cloud Console is type 'Web application' and has 'http://localhost:3000' added to 'Authorized JavaScript origins'.";
    }

    if (errStr.includes("popup_closed_by_user") || errStr.includes("access_denied")) {
      return "Google account selection was closed without selecting an account.";
    }

    return `Google Sign-In notice: ${errStr}`;
  };

  // Invoke official Google Identity Services Account Chooser flow
  const handleGoogleClick = () => {
    setError(null);
    const rawClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientId = rawClientId ? rawClientId.trim() : "";

    if (!clientId || clientId.includes("YOUR_GOOGLE_CLIENT_ID")) {
      setError("Google Client ID is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend/.env.local.");
      return;
    }

    const gWindow = typeof window !== "undefined" ? (window as any).google : null;
    if (!gWindow?.accounts) {
      setError("Google Identity Services is loading. Please try again in a moment.");
      return;
    }

    setIsGoogleLoading(true);

    try {
      // 1. Official Google Identity Services OAuth 2.0 token client with prompt="select_account"
      if (gWindow.accounts.oauth2) {
        const client = gWindow.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid email profile",
          prompt: "select_account",
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              setIsGoogleLoading(false);
              setError(formatGoogleError(tokenResponse));
              return;
            }

            if (tokenResponse.access_token) {
              try {
                // Send real Google credential token to the Go backend for verification with Google
                await authApi.loginWithGoogle({
                  credential: tokenResponse.access_token,
                });
                setSuccessMsg("Google account verified! Redirecting to CRM Leads...");
                setTimeout(() => {
                  router.push("/leads");
                }, 400);
              } catch (err: any) {
                setIsGoogleLoading(false);
                setError(err.message || "Google authentication failed. Please try again.");
              }
            } else {
              setIsGoogleLoading(false);
            }
          },
          error_callback: (err: any) => {
            setIsGoogleLoading(false);
            setError(formatGoogleError(err));
          },
        });

        // Request token with real Google account chooser popup
        client.requestAccessToken({ prompt: "select_account" });
        return;
      }

      // 2. Fallback to GIS ID Token flow if oauth2 is unavailable
      if (gWindow.accounts.id) {
        gWindow.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            if (response?.credential) {
              try {
                await authApi.loginWithGoogle({
                  credential: response.credential,
                });
                setSuccessMsg("Google account verified! Redirecting to CRM Leads...");
                setTimeout(() => {
                  router.push("/leads");
                }, 400);
              } catch (err: any) {
                setIsGoogleLoading(false);
                setError(err.message || "Google authentication failed. Please try again.");
              }
            } else {
              setIsGoogleLoading(false);
            }
          },
          auto_select: false,
        });

        gWindow.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setIsGoogleLoading(false);
          }
        });
        return;
      }

      setIsGoogleLoading(false);
      setError("Google Identity Services could not be initialized.");
    } catch (err: any) {
      setIsGoogleLoading(false);
      setError(formatGoogleError(err));
    }
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
              Create your account
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                marginTop: "0.35rem",
                marginBottom: 0,
              }}
            >
              Start tracking, automating, and converting leads
            </p>
          </div>

          {/* Segmented Pill Switcher between Sign In and Register */}
          <div className="auth-switcher">
            <Link href="/login" className="auth-switcher-tab">
              <LogIn size={15} />
              <span>Sign In</span>
            </Link>
            <div className="auth-switcher-tab active">
              <UserPlus size={15} />
              <span>Create Account</span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-danger" id="register-error-alert" style={{ marginBottom: "1.25rem" }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>{error}</div>
            </div>
          )}

          {/* Success Alert */}
          {successMsg && (
            <div className="alert alert-success" id="register-success-alert" style={{ marginBottom: "1.25rem" }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>{successMsg}</div>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" htmlFor="name-input">
                Full Name
              </label>
              <input
                id="name-input"
                type="text"
                className="auth-input-field"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

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

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" htmlFor="password-input">
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  className="auth-input-field"
                  placeholder="Min 6 characters"
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

            <div className="form-group" style={{ marginBottom: "1.25rem" }}>
              <label className="form-label" htmlFor="confirm-password-input">
                Confirm Password
              </label>
              <input
                id="confirm-password-input"
                type={showPassword ? "text" : "password"}
                className="auth-input-field"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {/* Register Account Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading || isGoogleLoading}
              id="btn-register-submit"
            >
              {isLoading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <UserPlus size={17} /> Register Account
                </>
              )}
            </button>
          </form>

          {/* OR Divider Directly Below Register Account */}
          <div style={{ display: "flex", alignItems: "center", margin: "1.25rem 0", gap: "0.75rem" }}>
            <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border-subtle)" }} />
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              OR
            </span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border-subtle)" }} />
          </div>

          {/* Official Google Registration Button */}
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={isLoading || isGoogleLoading}
            id="btn-google-continue"
            className="auth-google-btn"
          >
            {isGoogleLoading ? (
              <span>Connecting with Google...</span>
            ) : (
              <>
                <OfficialGoogleIcon />
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Footer Navigation */}
          <div
            style={{
              marginTop: "1.5rem",
              textAlign: "center",
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
            }}
          >
            Already have an account?{" "}
            <Link
              href="/login"
              style={{
                color: "var(--primary-teal)",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Sign In here
            </Link>
          </div>
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
