import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { forgotPassword, register, resetPassword, verifyEmail } from "../../api";
import { useAuth } from "../../auth";

type Props = { navigate: (path: string) => void };

function AuthShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span className="brand-icon">T</span><span>Transaction Ledger</span></div><p className="eyebrow">SECURE WORKSPACE</p><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>{children}</section></main>;
}

function Field({ label, type = "text", value, onChange, autoComplete, error }: { label: string; type?: string; value: string; onChange: (value: string) => void; autoComplete?: string; error?: string }) {
  return <label className="auth-field"><span>{label}</span><input type={type} value={value} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />{error && <small className="field-error">{error}</small>}</label>;
}

function validatePassword(password: string, confirmation: string) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirmation) return "Passwords do not match.";
  return "";
}

export function LoginView({ navigate }: Props) {
  const { login } = useAuth(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); if (!email.trim() || !password) { setError("Enter your email and password."); return; } setSubmitting(true); try { await login(email, password); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to sign in."); } finally { setSubmitting(false); } }
  return <AuthShell title="Welcome back" subtitle="Sign in to manage your accounts and transactions."><form className="auth-form" onSubmit={submit}><Field label="Email" value={email} onChange={setEmail} autoComplete="email" type="email" /><Field label="Password" value={password} onChange={setPassword} autoComplete="current-password" type="password" />{error && <p className="form-error">{error}</p>}<button className="primary-button auth-submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button></form><div className="auth-links"><button onClick={() => navigate("/forgot-password")}>Forgot password?</button><span>New here?</span><button onClick={() => navigate("/register")}>Create an account</button></div></AuthShell>;
}

export function RegisterView({ navigate }: Props) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); const passwordError = validatePassword(password, confirmation); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) || passwordError) { setError(!email.trim() ? "Enter a valid email address." : passwordError || "Enter a valid email address."); return; } setSubmitting(true); try { await register({ email: email.trim(), password, confirm_password: confirmation }); setSuccess("Your account was created. Check your email for a verification link."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create your account."); } finally { setSubmitting(false); } }
  return <AuthShell title="Create your account" subtitle="Start keeping your financial activity organized.">{success ? <div className="auth-result success"><p>{success}</p><button className="primary-button" onClick={() => navigate("/login")}>Continue to sign in</button></div> : <form className="auth-form" onSubmit={submit}><Field label="Email" value={email} onChange={setEmail} autoComplete="email" type="email" /><Field label="Password" value={password} onChange={setPassword} autoComplete="new-password" type="password" /><Field label="Confirm password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" type="password" />{error && <p className="form-error">{error}</p>}<button className="primary-button auth-submit" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</button></form>}<div className="auth-links"><span>Already have an account?</span><button onClick={() => navigate("/login")}>Sign in</button></div></AuthShell>;
}

export function ForgotPasswordView({ navigate }: Props) {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); if (!email.trim()) { setError("Enter your email address."); return; } setSubmitting(true); try { await forgotPassword(email.trim()); setMessage("A password reset link has been sent if an account exists for this email address."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to submit your request."); } finally { setSubmitting(false); } }
  return <AuthShell title="Reset your password" subtitle="We’ll help you get back into your account.">{message ? <div className="auth-result success"><p>{message}</p></div> : <form className="auth-form" onSubmit={submit}><Field label="Email" value={email} onChange={setEmail} autoComplete="email" type="email" />{error && <p className="form-error">{error}</p>}<button className="primary-button auth-submit" disabled={submitting}>{submitting ? "Sending…" : "Send reset link"}</button></form>}<div className="auth-links"><button onClick={() => navigate("/login")}>Back to sign in</button></div></AuthShell>;
}

export function VerifyEmailView({ navigate }: Props) {
  const token = new URLSearchParams(window.location.search).get("token"); const [status, setStatus] = useState<"loading" | "success" | "error">("loading"); const [error, setError] = useState("");
  useEffect(() => { if (!token) { setError("This verification link is missing its token."); setStatus("error"); return; } verifyEmail(token).then(() => setStatus("success")).catch((caught) => { setError(caught instanceof Error ? caught.message : "This verification link is invalid or expired."); setStatus("error"); }); }, [token]);
  return <AuthShell title="Verify your email" subtitle="Confirm your email address to activate your account."><div className="auth-result">{status === "loading" && <p>Verifying your email…</p>}{status === "success" && <><p className="success-text">Your email has been verified.</p><button className="primary-button" onClick={() => navigate("/login")}>Continue to sign in</button></>}{status === "error" && <><p className="form-error">{error}</p><button className="secondary-button" onClick={() => navigate("/login")}>Back to sign in</button></>}</div></AuthShell>;
}

export function ResetPasswordView({ navigate }: Props) {
  const token = new URLSearchParams(window.location.search).get("token"); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [error, setError] = useState(token ? "" : "This reset link is missing its token."); const [success, setSuccess] = useState(false); const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); const passwordError = validatePassword(password, confirmation); if (!token) { setError("This reset link is missing its token."); return; } if (passwordError) { setError(passwordError); return; } setError(""); setSubmitting(true); try { await resetPassword({ token, password, confirm_password: confirmation }); setSuccess(true); } catch (caught) { setError(caught instanceof Error ? caught.message : "This reset link is invalid or expired."); } finally { setSubmitting(false); } }
  return <AuthShell title="Choose a new password" subtitle="Use a new password of at least eight characters.">{success ? <div className="auth-result success"><p>Your password has been reset. You can now sign in.</p><button className="primary-button" onClick={() => navigate("/login")}>Continue to sign in</button></div> : <form className="auth-form" onSubmit={submit}><Field label="New password" value={password} onChange={setPassword} autoComplete="new-password" type="password" /><Field label="Confirm password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" type="password" />{error && <p className="form-error">{error}</p>}<button className="primary-button auth-submit" disabled={submitting || !token}>{submitting ? "Resetting…" : "Reset password"}</button></form>}</AuthShell>;
}
