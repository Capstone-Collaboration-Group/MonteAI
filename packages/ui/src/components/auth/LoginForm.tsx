import { useCallback, useEffect, useRef, useState } from "react";
import {
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { TextInput } from "./TextInput";
import { PasswordInput } from "./PasswordInput";
import { hasPendingRegistrationFor } from "./pendingRegistration";

type LoginFormProps = {
  auth: Auth;
  onSuccess?: () => void;
  /** Called when the verified user still has a registration awaiting completion. */
  onResumeRegistration?: () => void;
};

const RESEND_COOLDOWN_SECONDS = 60;
const POLL_INTERVAL_MS = 4000;

export function LoginForm({
  auth,
  onSuccess,
  onResumeRegistration,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [checking, setChecking] = useState(false);
  const advancingRef = useRef(false);

  const advance = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    const current = auth.currentUser;
    if (
      current &&
      hasPendingRegistrationFor(current.uid) &&
      onResumeRegistration
    ) {
      onResumeRegistration();
      return;
    }
    onSuccess?.();
  }, [auth, onSuccess, onResumeRegistration]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      if (credential.user.emailVerified) {
        advance();
      } else {
        setUnverifiedEmail(credential.user.email ?? email);
        setResendIn(RESEND_COOLDOWN_SECONDS);
      }
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError("Invalid email or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const recheckVerification = async () => {
    if (checking) return;
    setError(null);
    setNotice(null);
    setChecking(true);
    try {
      const current = auth.currentUser;
      if (!current) {
        throw new Error("Your session ended. Please log in again.");
      }
      await current.reload();
      if (auth.currentUser?.emailVerified) {
        advance();
      } else {
        setError("Email not verified yet. Open the link we sent you, then try again.");
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setChecking(false);
    }
  };

  const resendVerification = async () => {
    if (checking || resendIn > 0) return;
    setError(null);
    setNotice(null);
    setChecking(true);
    try {
      const current = auth.currentUser;
      if (!current) {
        throw new Error("Your session ended. Please log in again.");
      }
      await sendEmailVerification(current);
      setNotice(
        `A new verification link was sent to ${unverifiedEmail ?? current.email}.`,
      );
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Could not resend the verification email. Please try again.",
      );
    } finally {
      setChecking(false);
    }
  };

  const backToForm = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    advancingRef.current = false;
    setUnverifiedEmail(null);
    setNotice(null);
    setError(null);
    setResendIn(0);
    setEmail("");
    setPassword("");
  };

  // Poll while waiting for the email link to be clicked.
  useEffect(() => {
    if (!unverifiedEmail) return;
    const id = window.setInterval(() => {
      (async () => {
        const current = auth.currentUser;
        if (!current) return;
        try {
          await current.reload();
          if (auth.currentUser?.emailVerified) {
            advance();
          }
        } catch {
          // Transient network error — the next tick retries.
        }
      })();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [unverifiedEmail, auth, advance]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (!unverifiedEmail || resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [unverifiedEmail, resendIn]);

  if (unverifiedEmail) {
    return (
      <section className="flex w-full flex-1 max-w-md flex-col lg:max-w-none">
        <h2 className="text-4xl font-bold text-on-surface">Verify your email</h2>
        <p className="mt-2 text-base text-gray-500">
          We sent a verification link to{" "}
          <span className="font-semibold text-on-surface">{unverifiedEmail}</span>
          . Open it in your inbox to activate your account — this page continues
          automatically once verified.
        </p>
        {notice ? (
          <p className="mt-4 text-sm text-green-600">{notice}</p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <div className="mt-6 flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={recheckVerification}
            disabled={checking || isSubmitting}
            className="h-12 rounded-xl bg-primary font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-60"
          >
            {checking ? "Checking..." : "I've verified my email"}
          </button>
          <button
            type="button"
            onClick={resendVerification}
            disabled={checking || resendIn > 0}
            className="h-12 rounded-xl border border-outline-variant bg-white font-semibold text-on-surface transition-all hover:border-primary disabled:opacity-60"
          >
            {resendIn > 0 ? `Resend email (${resendIn}s)` : "Resend email"}
          </button>
          <button
            type="button"
            onClick={backToForm}
            disabled={checking || isSubmitting}
            className="h-12 rounded-xl text-sm font-semibold text-primary transition-all hover:opacity-80 disabled:opacity-60"
          >
            Use a different account
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-1 max-w-md flex-col lg:max-w-none">
      <h2 className="text-4xl font-bold text-on-surface">Welcome Back</h2>
      <p className="mt-2 text-base text-gray-500">
        Sign in to continue to MonteSkolar.
      </p>

      <form
        onSubmit={handleLogin}
        className="mt-6 flex w-full flex-col gap-6 sm:mt-10"
      >
        <TextInput
          label="Email"
          name="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          label="Password"
          name="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 rounded-xl bg-primary font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-60"
        >
          {isSubmitting ? "Signing in..." : "Login"}
        </button>
      </form>
    </section>
  );
}
