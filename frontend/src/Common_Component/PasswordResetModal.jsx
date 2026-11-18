import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, LoaderCircle, X } from "lucide-react";
import api from "../api/axiosInstance";
import "./PasswordResetModal.css";

const errorMessage = (error) =>
  error?.response?.data?.detail || error?.message || "Unable to reset the password. Please try again.";

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

function maskPhone(phone) {
  const value = String(phone || "");
  const digitCount = (value.match(/\d/g) || []).length;
  let index = 0;
  return value.replace(/\d/g, (digit) => {
    const masked = index < digitCount - 3;
    index += 1;
    return masked ? "X" : digit;
  });
}

const formatCountdown = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function PasswordResetModal({ phone = "", initialOtp = "", onClose, onSuccess }) {
  const [stage, setStage] = useState("otp");
  const [otp, setOtp] = useState(initialOtp);
  const [digits, setDigits] = useState(Array(6).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(initialOtp && phone ? 120 : 0);
  const [error, setError] = useState(phone ? "" : "Password reset requires an authenticated Settings session. Sign in and open Settings to continue.");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef([]);
  const digitsValue = digits.join("");
  const expired = secondsLeft === 0;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [saving, onClose]);

  useEffect(() => {
    if (stage !== "otp" || !otp || secondsLeft <= 0) return undefined;
    const timer = window.setTimeout(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [stage, otp, secondsLeft]);

  const handleDigitChange = (position, value) => {
    const digitsOnly = value.replace(/\D/g, "");
    if (!digitsOnly) {
      setDigits((current) => current.map((digit, index) => index === position ? "" : digit));
      return;
    }
    if (digitsOnly.length > 1) {
      applyPastedOtp(digitsOnly);
      return;
    }
    setDigits((current) => current.map((digit, index) => index === position ? digitsOnly : digit));
    if (position < 5) inputRefs.current[position + 1]?.focus();
  };

  const applyPastedOtp = (value) => {
    const pasted = value.replace(/\D/g, "").slice(0, 6);
    const next = Array(6).fill("");
    [...pasted].forEach((digit, index) => { next[index] = digit; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handlePaste = (event) => {
    event.preventDefault();
    applyPastedOtp(event.clipboardData.getData("text"));
  };

  const handleOtpKeyDown = (event, position) => {
    if (event.key === "ArrowLeft" && position > 0) {
      event.preventDefault();
      inputRefs.current[position - 1]?.focus();
    } else if (event.key === "ArrowRight" && position < 5) {
      event.preventDefault();
      inputRefs.current[position + 1]?.focus();
    } else if (event.key === "Backspace" && !digits[position] && position > 0) {
      inputRefs.current[position - 1]?.focus();
    }
  };

  const verifyOtp = (event) => {
    event.preventDefault();
    setError("");
    if (expired) {
      setError("OTP has expired. Please request a new OTP.");
      return;
    }
    if (digitsValue !== otp) {
      setError("Incorrect OTP. Please enter the correct 6-digit code.");
      return;
    }
    setStage("reset");
    setError("");
  };

  const resendOtp = () => {
    const nextOtp = generateOtp();
    setOtp(nextOtp);
    setDigits(Array(6).fill(""));
    setSecondsLeft(120);
    setError("");
    window.alert(`Development OTP for ${maskPhone(phone)}: ${nextOtp}`);
    inputRefs.current[0]?.focus();
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError("");
    if (!newPassword || !confirmPassword) {
      setError("Enter and confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/me/settings/reset-password", {
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      onSuccess?.("Your password has been changed successfully.");
      onClose?.();
    } catch (resetError) {
      setError(errorMessage(resetError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="password-reset-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose?.();
    }}>
      <section className="password-reset-modal" role="dialog" aria-modal="true" aria-labelledby="password-reset-title">
        <button className="password-reset-close" type="button" onClick={onClose} disabled={saving} aria-label="Close password reset">
          <X size={19} />
        </button>
        {stage === "otp" ? (
          <>
            <span className="password-reset-kicker">ACCOUNT SECURITY</span>
            <h2 id="password-reset-title">Verify Your Phone Number</h2>
            <p className="password-reset-intro">
              {phone
                ? `Development code generated for your registered phone ${maskPhone(phone)}. Enter the 6-digit code.`
                : "A registered phone number is required to begin verification."}
            </p>
            {phone && otp ? (
              <form className="password-reset-form" onSubmit={verifyOtp}>
                <div className="password-otp-boxes" onPaste={handlePaste} aria-label="6-digit verification code">
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(node) => { inputRefs.current[index] = node; }}
                      aria-label={`OTP digit ${index + 1}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      value={digit}
                      onChange={(event) => handleDigitChange(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(event, index)}
                      required
                    />
                  ))}
                </div>
                <p className={`password-otp-countdown${expired ? " is-expired" : ""}`} aria-live="polite">
                  {expired ? "OTP has expired. Please request a new OTP." : `OTP expires in ${formatCountdown(secondsLeft)}`}
                </p>
                {error && <p className="password-reset-error" role="alert">{error}</p>}
                <div className="password-reset-actions">
                  <button className="password-reset-secondary" type="button" onClick={onClose}>Cancel</button>
                  {expired ? (
                    <button className="password-reset-submit" type="button" onClick={resendOtp}>Resend OTP</button>
                  ) : (
                    <button className="password-reset-submit" type="submit" disabled={digitsValue.length !== 6}>Submit OTP</button>
                  )}
                </div>
              </form>
            ) : (
              <div>
                <p className="password-reset-error" role="alert">{error}</p>
                <div className="password-reset-actions password-reset-actions--end">
                  <button className="password-reset-submit" type="button" onClick={onClose}>Close</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <span className="password-reset-kicker">ACCOUNT SECURITY</span>
            <h2 id="password-reset-title">Reset Your Password</h2>
            <p className="password-reset-intro">Choose a new password for your account.</p>
            <form onSubmit={resetPassword} className="password-reset-form">
              <label>New Password
                <span className="password-reset-input-wrap">
                  <input type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                  <button className="password-reset-visibility" type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide new password" : "Show new password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </span>
                <small>At least 8 characters, including a lowercase letter, a number, and a special character.</small>
              </label>
              <label>Confirm New Password
                <span className="password-reset-input-wrap">
                  <input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  <button className="password-reset-visibility" type="button" onClick={() => setShowConfirmPassword((shown) => !shown)} aria-label={showConfirmPassword ? "Hide confirmation" : "Show confirmation"}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </span>
              </label>
              {error && <p className="password-reset-error" role="alert">{error}</p>}
              <div className="password-reset-actions">
                <button className="password-reset-secondary" type="button" onClick={() => { setStage("otp"); setError(""); }} disabled={saving}>Back</button>
                <button className="password-reset-submit" type="submit" disabled={saving}>
                  {saving ? <><LoaderCircle className="password-reset-spinner" size={16} />Saving…</> : <><KeyRound size={16} />Reset Password</>}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
