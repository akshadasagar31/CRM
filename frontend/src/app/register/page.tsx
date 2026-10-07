"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { authApi } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      <div style={{ width: "100%", maxWidth: "440px" }}>
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
          <h1 className="heading-md" style={{ color: "var(--text-primary)" }}>Create Account</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Sign up to manage and capture leads
          </p>
        </div>

        {/* Clean White Register Card */}
        <div className="white-card" style={{ padding: "2rem" }}>
          {error && (
            <div className="alert alert-danger" id="register-error-alert">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="alert alert-success" id="register-success-alert">
              <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>{successMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name-input">
                Full Name
              </label>
              <input
                id="name-input"
                type="text"
                className="form-input"
                placeholder="e.g. Jordan Miller"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="register-email-input">
                Work Email Address
              </label>
              <input
                id="register-email-input"
                type="email"
                className="form-input"
                placeholder="jordan@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="register-password-input">
                Password <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Min 6 chars</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="register-password-input"
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Create password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: "2.5rem" }}
                  minLength={6}
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

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password-input">
                Confirm Password
              </label>
              <input
                id="confirm-password-input"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "1rem", padding: "0.75rem" }}
              disabled={isLoading}
              id="btn-register-submit"
            >
              {isLoading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <UserPlus size={18} /> Register Account
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--primary-teal)", fontWeight: 700 }}>
              Sign In here
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
