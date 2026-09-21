import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Mail,
  ShieldCheck,
} from "lucide-react";
import type { OtpService } from "@monteai/api";

const COOLDOWN_SECONDS = 60;

export interface OtpVerificationProps {
  email: string;
  otpService: OtpService;
  onVerified: () => void;
  onBack?: () => void;
}

export function OtpVerification({
  email,
  otpService,
  onVerified,
  onBack,
}: OtpVerificationProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const setCode = (value: string, index: number) => {
    const next = value.replace(/\D/g, "").slice(-1);
    setDigits((current) =>
      current.map((digit, position) => (position === index ? next : digit)),
    );
    if (next) inputs.current[index + 1]?.focus();
    setError(null);
  };

  const pasteCode = (value: string) => {
    const pasted = value.replace(/\D/g, "").slice(0, 6).split("");
    setDigits(Array.from({ length: 6 }, (_, index) => pasted[index] ?? ""));
    inputs.current[Math.min(pasted.length, 6) - 1]?.focus();
  };

  const verify = async () => {
    const otp = digits.join("");
    if (otp.length !== 6) return setError("Enter all 6 digits to continue.");
    setBusy(true);
    setError(null);
    try {
      if (await otpService.verifyOtp({ email, otp })) onVerified();
      else setError("The verification code is incorrect.");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "The code is invalid or expired.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await otpService.resendOtp(email);
      setCooldown(COOLDOWN_SECONDS);
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Unable to resend the code.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-container-low px-4 py-8">
      <section className="w-full max-w-[430px] rounded-[28px] bg-surface px-6 py-8 shadow-xl sm:px-10">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="text-on-surface hover:text-primary"
          >
            <ArrowLeft />
          </button>
          <ShieldCheck className="text-primary" />
        </div>
        <div className="mt-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-on-surface">
            Verify your email
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-on-surface-variant">
            We sent a 6-digit verification code to{" "}
            <strong className="break-all text-primary">{email}</strong>
          </p>
        </div>
        <div
          className="mt-8 flex justify-center gap-2 sm:gap-3"
          onPaste={(event) => {
            event.preventDefault();
            pasteCode(event.clipboardData.getData("text"));
          }}
        >
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              value={digit}
              onChange={(event) => setCode(event.target.value, index)}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && !digit)
                  inputs.current[index - 1]?.focus();
                if (event.key === "Enter") void verify();
              }}
              inputMode="numeric"
              maxLength={1}
              aria-label={`Verification digit ${index + 1}`}
              className="h-12 w-10 rounded-md border border-outline-variant bg-surface text-center text-xl font-semibold text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-12"
            />
          ))}
        </div>
        <p className="mt-5 flex items-center justify-center gap-1 text-xs text-on-surface-variant">
          <Clock3 className="h-3.5 w-3.5" /> Code expires in 05:00
        </p>
        {error && (
          <p role="alert" className="mt-4 text-center text-sm text-error">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void verify()}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-on-primary disabled:opacity-60"
        >
          {busy ? "Checking..." : "Verify"}
          <CheckCircle2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={cooldown > 0 || busy}
          onClick={() => void resend()}
          className="mt-5 w-full text-sm text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-60"
        >
          Didn't receive the code?{" "}
          <span className="font-semibold text-primary">
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </span>
        </button>
      </section>
    </main>
  );
}
