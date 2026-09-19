import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ArrowLeft, BarChart3, Lock, Mail, ShieldCheck, Sparkles, User as UserIcon } from "lucide-react";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devVerificationUrl, setDevVerificationUrl] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, register, resetPassword, confirmPasswordReset, loginWithGoogle, currentUser, loading: authLoading, handleOAuthRedirect } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && currentUser) {
      navigate("/", { replace: true });
    }
  }, [authLoading, currentUser, navigate]);

  useEffect(() => {
    const resetParam = searchParams.get("reset");
    if (resetParam) {
      setIsResetPassword(true);
      setIsLogin(false);
      setResetToken(resetParam);
      window.history.replaceState({}, document.title, "/login");
      return;
    }
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      try {
        const redirected = await handleOAuthRedirect();
        if (redirected) return;
      } catch (err: any) {
        setError(err.message || "Failed to authenticate with Google");
      }
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const queryParams = new URLSearchParams(window.location.search);
      const oauthError = hashParams.get("error") || queryParams.get("error") || hashParams.get("error_description") || queryParams.get("error_description");
      if (oauthError) {
        setError(decodeURIComponent(oauthError).replace(/\+/g, " "));
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setDevVerificationUrl("");
    setDevResetUrl("");
    setLoading(true);

    try {
      if (isResetPassword && resetToken) {
        if (resetPasswordValue !== resetConfirmPassword) throw new Error("Passwords do not match");
        if (resetPasswordValue.length < 6) throw new Error("Password must be at least 6 characters");
        await confirmPasswordReset(resetToken, resetPasswordValue);
        setMessage("Password updated successfully. You can now sign in.");
        setIsResetPassword(false);
        setIsLogin(true);
        setResetToken("");
      } else if (isForgotPassword) {
        const result = await resetPassword(email);
        setMessage(result.message);
        setDevResetUrl(result.devResetUrl || "");
      } else if (isLogin) {
        await login(email, password);
      } else {
        if (!name.trim()) throw new Error("Full name is required");
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        const result = await register(name, email, password);
        setMessage(result.message);
        setDevVerificationUrl(result.verificationUrl || "");
        setIsLogin(true);
        setConfirmPassword("");
      }
    } catch (err: any) {
      setError(err.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError("");
      setLoading(true);
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || "Failed to authenticate with Google");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans transition-colors duration-300" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1fr_440px] lg:px-8">
        <div className="hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-black uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
            <Sparkles size={14} />
            STRAWBERRY Finance
          </div>
          <h1 className="mt-7 max-w-2xl text-6xl font-black leading-tight" style={{ color: "var(--text-primary)" }}>
            Smart money tracking with a fresh daily rhythm.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
            Manage expenses, debtors, recurring payments, reports, and AI insights from one polished workspace.
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-2 gap-4">
            {[
              { icon: BarChart3, label: "Live reports", value: "Clear cashflow" },
              { icon: ShieldCheck, label: "Private data", value: "Protected access" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-sm">
                <item.icon size={24} style={{ color: "var(--accent)" }} />
                <p className="mt-4 text-sm font-black uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                  {item.label}
                </p>
                <p className="mt-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

      <div className="w-full sm:mx-auto sm:max-w-md">
        <div className="mb-7 text-center lg:hidden">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-xl font-black shadow-lg" style={{ background: "linear-gradient(135deg, var(--accent), #38bdf8)", color: "var(--accent-contrast)" }}>
            S
          </div>
          <p className="mt-4 text-2xl font-black" style={{ color: "var(--text-primary)" }}>
            STRAWBERRY
          </p>
        </div>
        <div
          className="rounded-[2rem] border px-5 py-7 shadow-xl sm:px-8"
          style={{
            background: "linear-gradient(180deg, var(--bg-surface), var(--bg-elevated))",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div className="mb-8">
            <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
              {isResetPassword ? "Set New Password" : isForgotPassword ? "Account Recovery" : isLogin ? "Welcome Back" : "Create Workspace"}
            </p>
            <h2 className="mt-2 text-3xl font-black" style={{ color: "var(--text-primary)" }}>
              {isResetPassword
                ? "Set your new password"
                : isForgotPassword
                  ? "Reset your password"
                  : isLogin
                    ? "Sign in to STRAWBERRY"
                    : "Start with STRAWBERRY"}
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {isResetPassword ? "Enter and confirm your new password." : isForgotPassword ? "Enter your email and I will send a reset link." : "Your financial workspace is ready when you are."}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-green-500/10 border border-green-500/50 text-green-500 px-4 py-3 rounded-xl text-sm">
                {message}
                {devVerificationUrl && (
                  <a
                    href={devVerificationUrl}
                    className="mt-2 block font-bold underline"
                    style={{ color: "var(--accent)" }}
                  >
                    Open development verification link
                  </a>
                )}
                {devResetUrl && (
                  <a
                    href={devResetUrl}
                    className="mt-2 block font-bold underline"
                    style={{ color: "var(--accent)" }}
                  >
                    Open development password reset link
                  </a>
                )}
              </div>
            )}

            {!isResetPassword && !isLogin && !isForgotPassword && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label
                  className="block text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Full Name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="app-input rounded-2xl block w-full pl-10 sm:text-sm py-3.5 transition-all"
                    style={{
                      background: "var(--bg-elevated)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            {isResetPassword ? (
              <>
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>New Password</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
                    </div>
                    <input
                      type="password"
                      required
                      value={resetPasswordValue}
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                      className="app-input rounded-2xl block w-full pl-10 sm:text-sm py-3.5 transition-all"
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                      placeholder="Enter new password"
                    />
                  </div>
                </div>
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Confirm Password</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
                    </div>
                    <input
                      type="password"
                      required
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      className="app-input rounded-2xl block w-full pl-10 sm:text-sm py-3.5 transition-all"
                      style={{
                        background: "var(--bg-elevated)",
                        borderColor: resetConfirmPassword && resetPasswordValue !== resetConfirmPassword ? "#ef4444" : "var(--border)",
                        color: "var(--text-primary)",
                      }}
                      placeholder="Confirm new password"
                    />
                  </div>
                  {resetConfirmPassword && resetPasswordValue !== resetConfirmPassword && (
                    <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Email address</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="app-input rounded-2xl block w-full pl-10 sm:text-sm py-3.5 transition-all"
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                {!isForgotPassword && (
                  <div>
                    <label className="block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Password</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="app-input rounded-2xl block w-full pl-10 sm:text-sm py-3.5 transition-all"
                        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                )}

                {!isLogin && !isForgotPassword && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Confirm Password</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5" style={{ color: "var(--text-muted)" }} />
                      </div>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="app-input rounded-2xl block w-full pl-10 sm:text-sm py-3.5 transition-all"
                        style={{
                          background: "var(--bg-elevated)",
                          borderColor: confirmPassword && password !== confirmPassword ? "#ef4444" : "var(--border)",
                          color: "var(--text-primary)",
                        }}
                        placeholder="••••••••"
                      />
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                    )}
                  </div>
                )}

                {isLogin && !isForgotPassword && (
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs font-medium transition-colors"
                      style={{ color: "var(--accent)" }}
                    >
                      Forgot your password?
                    </button>
                  </div>
                )}
              </>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="app-button-primary w-full flex justify-center py-3.5 px-4 rounded-2xl text-sm font-black transition-all hover:-translate-y-0.5 disabled:opacity-50"
              >
                {loading
                  ? "Processing..."
                  : isResetPassword
                    ? "Set new password"
                    : isForgotPassword
                      ? "Send reset link"
                      : isLogin
                        ? "Sign in"
                        : "Sign up"}
              </button>
            </div>
          </form>

          {(isResetPassword || isForgotPassword) ? (
            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsForgotPassword(false); setIsResetPassword(false); setResetToken(""); }}
                className="flex items-center justify-center space-x-2 text-sm transition-colors mx-auto"
                style={{ color: "var(--text-muted)" }}
              >
                <ArrowLeft size={16} />
                <span>Back to sign in</span>
              </button>
            </div>
          ) : (
            <>
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t" style={{ borderColor: "var(--border)" }} />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span
                      className="px-3"
                      style={{ background: "var(--bg-surface)", color: "var(--text-muted)" }}
                    >
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex justify-center py-3.5 px-4 border rounded-2xl shadow-sm text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </button>
                </div>
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={() => { setIsLogin(!isLogin); setConfirmPassword(""); }}
                  className="text-sm transition-colors"
                  style={{ color: "var(--accent)" }}
                >
                  {isLogin
                    ? "Don't have an account? Sign up"
                    : "Already have an account? Sign in"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
