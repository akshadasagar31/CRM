"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { authApi } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authApi.login(email, password);
      setSuccessMsg("Authentication successful! Redirecting to Leads...");
      setTimeout(() => {
        router.push("/leads");
      }, 500);
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail("admin@crmdemo.com");
    setPassword("admin123");
    setError(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        backgroundColor: "var(--bg-page)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
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
          </Link>
          <h1 className="heading-md" style={{ color: "var(--text-primary)" }}>Welcome back</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Sign in to access your Leads dashboard
          </p>
        </div>

        {/* Demo Credentials Quick Fill */}
        <div
          style={{
            backgroundColor: "var(--light-teal)",
            border: "1px dashed rgba(0, 159, 154, 0.4)",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--primary-teal)", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
              <Sparkles size={14} /> Demo Credentials
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
              admin@crmdemo.com / admin123
            </div>
          </div>
          <button
            type="button"
            onClick={fillDemoCredentials}
            className="btn btn-secondary"
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
            id="btn-fill-demo"
          >
            Auto-fill
          </button>
        </div>

        {/* Clean White Login Card */}
        <div className="white-card" style={{ padding: "2rem" }}>
          {error && (
            <div className="alert alert-danger" id="login-error-alert">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="alert alert-success" id="login-success-alert">
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>{successMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email-input">
                Email Address
              </label>
              <input
                id="email-input"
                type="email"
                className="form-input"
                placeholder="admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password-input">
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: "2.5rem" }}
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
                    display: "flex",
                    alignItems: "center",
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "1rem", padding: "0.75rem" }}
              disabled={isLoading}
              id="btn-login-submit"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <LogIn size={18} /> Sign In
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Need an account?{" "}
            <Link href="/register" style={{ color: "var(--primary-teal)", fontWeight: 700 }}>
              Create an account
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
          <Link href="/" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            ← Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
