import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { X, Mail, Lock, User, ArrowRight, Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { OnboardingPreferences, UserOnboardingData } from "./OnboardingPreferences";

/**
 * Kicks off the backend-hosted Google OAuth flow. The Express server exposes
 * GET /api/auth/google which redirects to Google's consent screen and then
 * returns to /api/auth/google/callback, where the session cookie is set and
 * the user is bounced back to the website. Using a full-page redirect (not
 * fetch) is intentional — OAuth requires the browser to leave the app.
 */
const startGoogleOAuth = () => {
  const base = (typeof import.meta === "object" && (import.meta as any).env?.VITE_API_BASE_URL)
    ? String((import.meta as any).env.VITE_API_BASE_URL).replace(/\/+$/, "")
    : "";
  const returnTo = typeof window !== "undefined" ? window.location.origin : "";
  const qs = returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : "";
  window.location.href = `${base}/api/auth/google${qs}`;
};

/** Google "G" logo — inline SVG so no extra asset request is needed. */
const GoogleGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

const GoogleContinueButton: React.FC<{ label?: string }> = ({ label = "Continue with Google" }) => (
  <button
    type="button"
    id="continue-with-google-btn"
    onClick={startGoogleOAuth}
    className="w-full flex items-center justify-center gap-2.5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold bg-white text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer border border-white/10"
  >
    <GoogleGlyph className="h-4 w-4" />
    <span>{label}</span>
  </button>
);

const AuthDivider: React.FC = () => (
  <div className="flex items-center gap-3 my-4">
    <div className="h-px flex-1 bg-neutral-800" />
    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">or</span>
    <div className="h-px flex-1 bg-neutral-800" />
  </div>
);


interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "signin" | "signup";
  initialStep?: "signin" | "signup" | "forgot";
  initialEmail?: string;
}

type AuthView = "signin" | "signup" | "forgot";
type SignInStep = "email" | "password" | "otp";
type ForgotStep = "email" | "reset";
type SignupStep = "form" | "verify" | "password" | "onboarding" | "redirect";

const inputClass =
  "w-full surface-input rounded-xl pl-11 pr-4 py-3 text-sm placeholder:text-neutral-500 transition-colors focus:outline-none";
const labelClass = "text-[10px] font-bold uppercase tracking-wider text-neutral-400";

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = "signin",
  initialStep = "signin",
  initialEmail,
}) => {
  const {
    signIn,
    signUp,
    verifySignup,
    requestSignupVerification,
    checkEmailForReset,
    requestPasswordReset,
    resetPassword,
    getLoginMethod,
    requestOtp,
    verifyOtp,
    completeOnboarding,
    enterAsGuest,
    authModalError,
    siteConfig,
  } = useApp();

  const [authView, setAuthView] = useState<AuthView>("signin");
  const [signInStep, setSignInStep] = useState<SignInStep>("email");
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const view: AuthView =
      initialStep === "forgot" ? "forgot" : defaultMode === "signup" ? "signup" : "signin";
    setAuthView(view);
    setSignInStep("email");
    setSignupStep("form");
    setForgotStep("email");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setError(authModalError || "");
    setInfo("");
    if (initialEmail) {
      setEmail(initialEmail);
      // Skip straight past the "enter your email" step — whether that lands
      // on a password field or an emailed one-time code still depends on
      // what the account is configured for server-side.
      void continueWithEmail(initialEmail);
    } else {
      setEmail("");
    }
  }, [isOpen, defaultMode, initialStep, initialEmail, authModalError]);

  useEffect(() => {
    if (signInStep === "otp") otpInputRef.current?.focus();
  }, [signInStep]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isStrongPassword = (value: string) =>
    value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value);

  const goToSignIn = () => {
    setAuthView("signin");
    setSignInStep("email");
    setForgotStep("email");
    setError("");
    setInfo("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
  };

  const goToForgot = () => {
    if (!siteConfig.mailerEnabled) {
      setError("Password reset is temporarily unavailable. Please contact support.");
      return;
    }
    setAuthView("forgot");
    setForgotStep("email");
    setError("");
    setInfo("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
  };

  const continueWithEmail = async (candidateEmail: string) => {
    setError("");
    setInfo("");
    if (!candidateEmail || !isValidEmail(candidateEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    const methodResult = await getLoginMethod(candidateEmail);
    if (!methodResult.ok) {
      setSubmitting(false);
      setError(methodResult.error || "Something went wrong.");
      return;
    }
    if (methodResult.method === "otp") {
      const otpResult = await requestOtp(candidateEmail);
      setSubmitting(false);
      if (!otpResult.ok) {
        setError(otpResult.error || "Couldn't send the code.");
        return;
      }
      setInfo(`We sent a 6-digit code to ${candidateEmail}.`);
      setResendCooldown(60);
      setSignInStep("otp");
    } else {
      setSubmitting(false);
      setSignInStep("password");
    }
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    await continueWithEmail(email);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password || password.length < 6) {
      setError("Please enter your password.");
      return;
    }
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Invalid email or password.");
      return;
    }
    // Check if user needs onboarding (first-time login)
    // This will be handled by the context's needsOnboarding state
    onClose();
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp || otp.length < 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setSubmitting(true);
    const result = await verifyOtp(email, otp);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Incorrect code.");
      return;
    }
    onClose();
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !name) {
      setError("Please fill out all required fields.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    // Send OTP verification code to email
    setSubmitting(true);
    console.log("Requesting signup verification for:", email);
    const result = await requestSignupVerification(email, "", name);
    setSubmitting(false);
    console.log("Signup verification request result:", result);
    if (!result.ok) {
      setError(result.error || "Couldn't send verification code. Please try again.");
      return;
    }
    setInfo(`We've sent a 6-digit code to ${email}. Enter it below to verify your email.`);
    setSignupStep("verify");
    setOtp("");
  };

  const handleSignupVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!otp || otp.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    console.log("Verifying signup OTP for:", email);
    const result = await verifySignup(email, otp);
    setSubmitting(false);
    console.log("Signup verification result:", result);
    if (!result.ok) {
      setError(result.error || "Verification failed.");
      return;
    }
    // Show password entry after successful verification
    setInfo("Email verified! Please create a password to complete your profile.");
    setSignupStep("password");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSignupPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isStrongPassword(password)) {
      setError("Password must be 8+ characters with uppercase, lowercase, and a number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    // Show onboarding (age and categories) after password is set
    setInfo("Password set! Please tell us about your preferences.");
    setSignupStep("onboarding");
  };

  const handleOnboardingComplete = async (preferences: UserOnboardingData) => {
    setSubmitting(true);
    setError("");
    
    // First create the account with the preferences
    const result = await signUp(email, password, name);
    if (!result.ok) {
      setSubmitting(false);
      setError(result.error || "Sign up failed.");
      return;
    }

    // If auto-verified, complete onboarding immediately
    if (result.autoVerified) {
      const onboardingResult = await completeOnboarding(preferences);
      if (!onboardingResult.ok) {
        setSubmitting(false);
        setError(onboardingResult.error || "Failed to save preferences.");
        return;
      }
    }

    // Immediate redirect to sign-in
    setSubmitting(false);
    setInfo("Account created! Redirecting to sign in...");
    setSignupStep("redirect");
    
    // Rapid redirect to sign-in view
    setTimeout(() => {
      goToSignIn();
      setEmail(email); // Pre-fill the email for convenience
      setPassword(""); // Clear password for security
      setInfo("");
    }, 800);
  };

  /** Step 1 of forgot flow — an existing account gets an emailed OTP; an
   *  unrecognized email is routed to sign-up instead of shown an error
   *  (the check-email lookup drives this routing decision; it never powers
   *  the actual reset, which is handled by the always-generic
   *  /forgot-password endpoint below). */
  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email || !isValidEmail(email)) {
      setError("Please enter the email address you used to register.");
      return;
    }
    setSubmitting(true);
    console.log("Checking email for password reset:", email);
    const check = await checkEmailForReset(email);
    setSubmitting(false);
    console.log("Email check result:", check);
    if (!check.ok) {
      setError(check.error || "Something went wrong. Please try again.");
      return;
    }
    if (!check.found) {
      setAuthView("signup");
      setSignupStep("form");
      setInfo("We couldn't find an account with that email — let's get you signed up.");
      return;
    }
    setSubmitting(true);
    console.log("Requesting password reset for:", email);
    const reset = await requestPasswordReset(email);
    setSubmitting(false);
    console.log("Password reset request result:", reset);
    if (!reset.ok) {
      setError(reset.error || "Couldn't send reset instructions. Please try again.");
      return;
    }
    setInfo(`We've sent a 6-digit code to ${email}. Enter it below along with your new password.`);
    setForgotStep("reset");
    setOtp("");
    setPassword("");
    setConfirmPassword("");
  };

  /** Step 2 — the emailed OTP code + new password */
  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!otp.trim()) {
      setError("Enter the code sent to your email.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Password must be 8+ characters with uppercase, lowercase, and a number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    console.log("Submitting password reset for:", email, "with OTP:", otp.trim());
    const result = await resetPassword(email, otp.trim(), password);
    setSubmitting(false);
    console.log("Password reset result:", result);
    if (!result.ok) {
      setError(result.error || "Password reset failed. Please check the code and try again.");
      return;
    }
    setInfo("Password updated successfully! Redirecting to sign in...");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setTimeout(() => {
      goToSignIn();
      setSignInStep("password");
      setEmail(email); // Pre-fill email for convenience
      setInfo("");
    }, 2000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setSubmitting(true);
    const otpResult = await requestOtp(email);
    setSubmitting(false);
    if (!otpResult.ok) {
      setError(otpResult.error || "Couldn't resend code.");
      return;
    }
    setInfo(`A new code was sent to ${email}.`);
    setResendCooldown(60);
  };

  const title =
    authView === "forgot"
      ? forgotStep === "email"
        ? "Forgot Password"
        : "Create New Password"
      : authView === "signup"
      ? "Create Your Account"
      : signInStep === "otp"
      ? "Enter Login Code"
      : signInStep === "password"
      ? "Enter Password"
      : "Welcome Back";

  const subtitle =
    authView === "forgot"
      ? forgotStep === "email"
        ? "Enter the email address you used to register"
        : "Enter the code from your email and choose a new password"
      : authView === "signup"
      ? signupStep === "verify"
        ? "Enter the 6-digit code sent to your email"
        : signupStep === "password"
        ? "Create a secure password for your account"
        : signupStep === "onboarding"
 ? "Tell us about your preferences"
        : "Sign up to save your watchlist and preferences"
      : signInStep === "otp"
      ? "Check your inbox for a 6-digit code"
      : signInStep === "password"
      ? `Signing in as ${email}`
      : "Sign in with your Cinemax account";

  const onSubmit =
    authView === "forgot"
      ? forgotStep === "email"
        ? handleForgotEmailSubmit
        : handleForgotResetSubmit
      : authView === "signup"
      ? signupStep === "verify"
        ? handleSignupVerifySubmit
        : signupStep === "password"
        ? handleSignupPasswordSubmit
        : handleSignUpSubmit
      : signInStep === "email"
      ? handleContinue
      : signInStep === "password"
      ? handlePasswordSubmit
      : handleOtpSubmit;

  const submitLabel =
    authView === "forgot"
      ? forgotStep === "email"
        ? "Verify Email"
        : "Save New Password"
      : authView === "signup"
      ? signupStep === "verify"
        ? "Verify Email"
        : signupStep === "password"
        ? "Set Password"
        : "Create Account"
      : signInStep === "email"
      ? "Continue"
      : signInStep === "otp"
      ? "Verify & Sign In"
      : "Sign In";

  return (
    <div id="auth-modal-backdrop" className="fixed inset-0 z-60 flex items-center justify-center modal-backdrop p-4 animate-fade-in">
      <div id="auth-modal" className="relative w-full max-w-md rounded-2xl border surface-panel p-6 md:p-8">

        <button
          id="close-auth-btn"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {(authView === "forgot" || signInStep !== "email") && (
          <button
            id="auth-back-btn"
            onClick={authView === "forgot" ? (forgotStep === "reset" ? () => setForgotStep("email") : goToSignIn) : () => setSignInStep("email")}
            className="absolute left-4 top-4 flex items-center gap-1 rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <div className="text-center mb-6 space-y-2 pt-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl logo-mark font-black text-2xl mx-auto">
            C
          </div>
          <h2 className="font-sans text-xl font-bold tracking-tight">{title}</h2>
          <p className="text-xs text-neutral-500">{subtitle}</p>
        </div>

        {error && <div className="alert-error rounded-xl p-3 text-xs font-semibold mb-4 text-center">{error}</div>}
        {!error && info && <div className="alert-success rounded-xl p-3 text-xs font-semibold mb-4 text-center">{info}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          {authView === "signup" && signupStep === "form" && (
            <div className="space-y-1">
              <label className={labelClass}>Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
              </div>
            </div>
          )}

          {(authView === "signup" && signupStep === "form") ||
          (authView === "signin" && signInStep === "email") ||
          (authView === "forgot" && forgotStep === "email") ? (
            <div className="space-y-1">
              <label className={labelClass}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                  autoFocus
                />
              </div>
            </div>
          ) : null}

          {authView === "signin" && signInStep !== "email" && (
            <div className="space-y-1">
              <label className={labelClass}>Email Address</label>
              <div className="relative flex items-center gap-2 rounded-xl surface-input px-4 py-3">
                <Mail className="h-4 w-4 text-neutral-500 shrink-0" />
                <span className="text-xs text-neutral-300 truncate">{email}</span>
              </div>
            </div>
          )}

          {authView === "forgot" && forgotStep === "reset" && (
            <div className="space-y-1">
              <label className={labelClass}>Registered Email</label>
              <div className="relative flex items-center gap-2 rounded-xl surface-input px-4 py-3">
                <Mail className="h-4 w-4 text-neutral-500 shrink-0" />
                <span className="text-xs text-neutral-300 truncate">{email}</span>
              </div>
            </div>
          )}

          {((authView === "signup" && signupStep === "form") ||
            (authView === "signup" && signupStep === "password") ||
            (authView === "signin" && signInStep === "password") ||
            (authView === "forgot" && forgotStep === "reset")) && (
            <div className="space-y-1">
              <label className={labelClass}>{authView === "forgot" ? "New Password" : "Password"}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  placeholder="8+ chars, upper, lower, number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={8}
                  autoFocus
                />
              </div>
            </div>
          )}

          {(authView === "signup" && signupStep === "password") && (
            <div className="space-y-1">
              <label className={labelClass}>Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={8}
                />
              </div>
            </div>
          )}

          {authView === "forgot" && forgotStep === "reset" && (
            <div className="space-y-1">
              <label className={labelClass}>Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={8}
                />
              </div>
            </div>
          )}

          {((authView === "signup" && signupStep === "verify") ||
            (authView === "signin" && signInStep === "otp") ||
            (authView === "forgot" && forgotStep === "reset")) && (
            <div className="space-y-1">
              <label className={labelClass}>
                {authView === "forgot" ? "Reset Code" : "6-Digit Code"}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode={authView === "forgot" ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  placeholder={authView === "forgot" ? "Paste code from email" : "123456"}
                  value={otp}
                  onChange={(e) =>
                    setOtp(
                      authView === "forgot"
                        ? e.target.value.trim()
                        : e.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  className={`${inputClass} tracking-widest`}
                  required
                />
              </div>
              {authView === "signin" && signInStep === "otp" && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || submitting}
                    className="text-[10px] font-bold text-[#39FF14] hover:underline disabled:text-neutral-600 cursor-pointer disabled:cursor-default"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={submitting}
            className="w-full neon-btn flex items-center justify-center gap-2 font-extrabold py-2.5 sm:py-3.5 rounded-xl text-[11px] sm:text-xs cursor-pointer mt-2 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <span>{submitLabel}</span>
                <ArrowRight className="h-4 w-4 stroke-[3px]" />
              </>
            )}
          </button>

        </form>

        {/* Google OAuth — offered on Sign In (email step) and Sign Up (form step). */}
        {((authView === "signin" && signInStep === "email") ||
          (authView === "signup" && signupStep === "form")) && (
            <>
              <AuthDivider />
              <GoogleContinueButton
                label={authView === "signup" ? "Sign up with Google" : "Continue with Google"}
              />
            </>
        )}

        {authView === "signin" && signInStep === "email" && (
          <>
            <button
              id="auth-forgot-password-btn"
              type="button"
              onClick={goToForgot}
              className="w-full btn-forgot mt-3 py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-xs uppercase tracking-wide cursor-pointer"
            >
              Forgot Password
            </button>
            <div className="text-center mt-5 border-t border-neutral-800 pt-4 text-xs">
              <span className="text-neutral-500">New to Cinemax?</span>
              <button
                id="auth-toggle-view"
                onClick={() => { setError(""); setInfo(""); setAuthView("signup"); setSignupStep("form"); }}
                className="ml-1.5 text-[#39FF14] hover:underline font-bold cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </>
        )}

        {authView === "signup" && (
          <div className="flex items-center justify-between mt-5 border-t border-neutral-800 pt-4 text-xs">
            <button
              type="button"
              onClick={() => { enterAsGuest(); onClose(); }}
              className="text-neutral-400 hover:text-white font-semibold cursor-pointer transition-colors"
            >
              Login as Guest
            </button>
            <div className="text-neutral-500">
              <span>Already have an account?</span>
              <button
                type="button"
                onClick={goToSignIn}
                className="ml-1.5 text-[#39FF14] hover:underline font-bold cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {authView === "forgot" && forgotStep === "email" && (
          <div className="text-center mt-5 border-t border-neutral-800 pt-4 text-xs">
            <span className="text-neutral-500">Remember your password?</span>
            <button type="button" onClick={goToSignIn} className="ml-1.5 text-[#39FF14] hover:underline font-bold cursor-pointer">
              Back to Sign In
            </button>
          </div>
        )}
      </div>

      {/* Onboarding Preferences Modal */}
      <OnboardingPreferences
        isOpen={authView === "signup" && signupStep === "onboarding"}
        onComplete={handleOnboardingComplete}
        onSkip={() => onClose()}
      />
    </div>
  );
};
