// packages/ui/src/components/auth/RegistrationForm.tsx
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BookUser,
  Building2,
  CalendarDays,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  UserRound,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import type { RegisterUserRequest, RegistrationRole } from "@monteai/types";
import {
  FACULTY_EMAIL_DOMAIN,
  STUDENT_EMAIL_DOMAIN,
  isValidEmailForRole,
} from "@monteai/utils";
import { useAuth } from "@monteai/hooks";
import { Button } from "../Button";
import { Input } from "../Input";
import {
  clearPendingRegistration,
  getPendingRegistration,
  savePendingRegistration,
} from "./pendingRegistration";

type Phase = "form" | "verify" | "completing" | "completeError";

type Message = { type: "success" | "error"; text: string } | null;

type RegistrationFormProps = {
  auth: Auth;
  register: (dto: RegisterUserRequest) => Promise<unknown>;
  onSuccess: () => void;
  /** Returns the current profile if one already exists for the signed-in uid. */
  checkExistingProfile?: () => Promise<unknown>;
  /** Navigate to the login screen (offered when the email is already registered). */
  onGoToLogin?: () => void;
};

type FieldProps = {
  label: string;
  icon: React.ElementType;
  children: ReactNode;
};

const INSTITUTES = [
  "Institute of Computing Studies",
  "Institute of Teaching Education",
  "Institute of Business and Entrepreneurship",
];

const PROGRAMS = [
  "BS Information Technology",
  "BS Computer Science",
  "BS Data Science",
];

const RESEND_COOLDOWN_SECONDS = 60;
const POLL_INTERVAL_MS = 4000;

const initialForm = {
  role: "Student" as RegistrationRole,
  firstName: "",
  middleInitial: "",
  lastName: "",
  suffix: "",
  email: "",
  studentNumber: "",
  institute: "",
  program: "BS Information Technology",
  year: "1",
  section: "",
  password: "",
  confirmPassword: "",
};

function Field({ label, icon: Icon, children }: FieldProps) {
  return (
    <label className="space-y-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </span>
      {children}
    </label>
  );
}

function describeError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "An account with this email already exists. Log in with your password or use a different email.";
      case "auth/invalid-email":
        return "That email address is not valid.";
      case "auth/weak-password":
        return "Password must be at least 6 characters long.";
      case "auth/quota-exceeded":
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "auth/operation-not-allowed":
        return "Email/password sign-up is disabled for this project.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      default:
        return error.message;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Unable to complete registration right now.";
}

function messageBox(message: Message) {
  if (!message) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        message.type === "success"
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message.text}
    </div>
  );
}

export function RegistrationForm({
  auth,
  register,
  onSuccess,
  checkExistingProfile,
  onGoToLogin,
}: RegistrationFormProps) {
  const [form, setForm] = useState(initialForm);
  const [phase, setPhase] = useState<Phase>("form");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [message, setMessage] = useState<Message>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const completingRef = useRef(false);
  const { user, loading: authLoading } = useAuth();

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    let next = value;
    if (name === "middleInitial" || name === "section") {
      next = value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase();
    }
    if (name === "suffix") {
      next = value.slice(0, 10);
    }
    setForm((prev) => ({ ...prev, [name]: next }));
    setMessage(null);
    setAccountExists(false);
  };

  const handleRoleChange = (role: RegistrationRole) => {
    setForm((prev) => ({ ...prev, role }));
    setMessage(null);
    setAccountExists(false);
  };

  const validate = (): string | null => {
    if (form.password.length < 8) {
      return "Password must be at least 8 characters long.";
    }
    if (form.password !== form.confirmPassword) {
      return "Passwords do not match.";
    }
    if (!isValidEmailForRole(form.email, form.role)) {
      return form.role === "Student"
        ? `Students must register with a ${STUDENT_EMAIL_DOMAIN} email address.`
        : `Faculty must register with a ${FACULTY_EMAIL_DOMAIN} email address.`;
    }
    if (form.middleInitial && !/^[A-Za-z]$/.test(form.middleInitial)) {
      return "Middle initial must be a single letter.";
    }
    if (!form.institute) {
      return "Please select your institute.";
    }
    if (form.role === "Student") {
      if (!form.studentNumber.trim()) {
        return "Student number is required.";
      }
      if (!form.program) {
        return "Please select a program.";
      }
      if (!/^[A-Za-z]$/.test(form.section)) {
        return "Section must be a single letter.";
      }
    }
    return null;
  };

  const buildPayload = (uid: string): RegisterUserRequest => {
    const base: RegisterUserRequest = {
      id: uid,
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role,
      institute: form.institute,
    };
    if (form.middleInitial) base.middleInitial = form.middleInitial;
    if (form.suffix.trim()) base.suffix = form.suffix.trim();
    if (form.role === "Student") {
      base.studentNumber = form.studentNumber.trim();
      base.position = "Member";
      base.program = form.program;
      base.yearLevel = Number(form.year);
      base.section = form.section;
    }
    return base;
  };

  const hydrateForm = useCallback((payload: RegisterUserRequest) => {
    setForm({
      role: payload.role,
      firstName: payload.firstName,
      middleInitial: payload.middleInitial ?? "",
      lastName: payload.lastName,
      suffix: payload.suffix ?? "",
      email: payload.email,
      studentNumber: payload.studentNumber ?? "",
      institute: payload.institute,
      program: payload.program ?? initialForm.program,
      year:
        payload.yearLevel != null ? String(payload.yearLevel) : initialForm.year,
      section: payload.section ?? "",
      password: "",
      confirmPassword: "",
    });
  }, []);

  const completeRegistration = useCallback(async () => {
    if (completingRef.current) return;
    completingRef.current = true;
    setPhase("completing");
    setMessage(null);
    try {
      const pending = getPendingRegistration();
      if (!pending) {
        setPhase("form");
        setMessage({
          type: "error",
          text: "Your registration session expired. Please submit the form again.",
        });
        return;
      }
      await register(pending.payload);
      clearPendingRegistration();
      setMessage({
        type: "success",
        text: "Registration complete. Taking you to your dashboard...",
      });
      window.setTimeout(() => onSuccess(), 900);
    } catch (error) {
      setMessage({ type: "error", text: describeError(error) });
      setPhase("completeError");
    } finally {
      completingRef.current = false;
    }
  }, [register, onSuccess]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setAccountExists(false);
    const problem = validate();
    if (problem) {
      setMessage({ type: "error", text: problem });
      return;
    }
    setLoading(true);
    let createdNew = false;
    try {
      const email = form.email.trim();
      let currentUser: User;
      try {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          form.password,
        );
        currentUser = credential.user;
        createdNew = true;
      } catch (error) {
        if (
          !(error instanceof FirebaseError) ||
          error.code !== "auth/email-already-in-use"
        ) {
          throw error;
        }
        let credential;
        try {
          credential = await signInWithEmailAndPassword(
            auth,
            email,
            form.password,
          );
        } catch {
          throw new Error(
            "An account with this email already exists. Log in with your password or use a different email.",
          );
        }
        currentUser = credential.user;
        try {
          await currentUser.reload();
        } catch {
          // keep the sign-in snapshot if the refresh fails
        }
        currentUser = auth.currentUser ?? currentUser;
      }

      if (!createdNew && checkExistingProfile) {
        try {
          await checkExistingProfile();
          setAccountExists(true);
          setMessage({
            type: "error",
            text: "This email is already registered. Please log in to continue.",
          });
          setPhase("form");
          return;
        } catch {
          // No profile yet for this uid — safe to finish setting it up.
        }
      }

      try {
        await updateProfile(currentUser, {
          displayName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        });
      } catch {
        // Display name is cosmetic — registration continues without it.
      }

      savePendingRegistration({
        uid: currentUser.uid,
        payload: buildPayload(currentUser.uid),
        createdAt: Date.now(),
      });

      if (currentUser.emailVerified) {
        await completeRegistration();
        return;
      }

      try {
        await sendEmailVerification(currentUser);
      } catch (error) {
        clearPendingRegistration();
        if (createdNew) {
          try {
            await currentUser.delete();
          } catch {
            // Best effort — a stale unverified account is resumable later.
          }
        }
        throw error;
      }
      setPhase("verify");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setMessage({ type: "error", text: describeError(error) });
      setPhase("form");
    } finally {
      setLoading(false);
    }
  };

  const recheckVerification = async () => {
    if (checking) return;
    if (!getPendingRegistration()) {
      setPhase("form");
      setMessage({
        type: "error",
        text: "Your registration session expired. Please submit the form again.",
      });
      return;
    }
    setChecking(true);
    try {
      const current = auth.currentUser;
      if (!current) {
        throw new Error("Your session ended. Please submit the form again.");
      }
      await current.reload();
      if (auth.currentUser?.emailVerified) {
        await completeRegistration();
      } else {
        setMessage({
          type: "error",
          text: "Email not verified yet. Open the link we sent you, then try again.",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: describeError(error) });
    } finally {
      setChecking(false);
    }
  };

  const resendVerification = async () => {
    if (checking || resendIn > 0) return;
    setChecking(true);
    try {
      const current = auth.currentUser;
      if (!current) {
        throw new Error("Your session ended. Please submit the form again.");
      }
      await sendEmailVerification(current);
      setMessage({
        type: "success",
        text: `A new verification link was sent to ${form.email}.`,
      });
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setMessage({ type: "error", text: describeError(error) });
    } finally {
      setChecking(false);
    }
  };

  const startOver = async () => {
    clearPendingRegistration();
    const current = auth.currentUser;
    if (current) {
      try {
        await current.delete();
      } catch {
        // Deleting may require a recent sign-in — sign out either way.
      }
    }
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
    setForm((prev) => ({
      ...prev,
      email: "",
      password: "",
      confirmPassword: "",
    }));
    setPhase("form");
    setMessage(null);
    setAccountExists(false);
    setResendIn(0);
  };

  // Auto-detect a pending registration (reload / return via login).
  useEffect(() => {
    if (authLoading) return;
    const pending = getPendingRegistration();
    if (!pending || !user || pending.uid !== user.uid) return;
    let cancelled = false;
    (async () => {
      try {
        await user.reload();
      } catch {
        // A failed refresh just means the manual recheck may be needed.
      }
      if (cancelled) return;
      if (!getPendingRegistration() || !auth.currentUser) return;
      hydrateForm(pending.payload);
      if (auth.currentUser.emailVerified) {
        await completeRegistration();
      } else {
        setPhase("verify");
        setResendIn(RESEND_COOLDOWN_SECONDS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, auth, hydrateForm, completeRegistration]);

  // Poll while waiting for the email link to be clicked.
  useEffect(() => {
    if (phase !== "verify") return;
    const id = window.setInterval(() => {
      (async () => {
        const current = auth.currentUser;
        if (!current || completingRef.current) return;
        try {
          await current.reload();
          if (auth.currentUser?.emailVerified) {
            await completeRegistration();
          }
        } catch {
          // Transient network error — the next tick retries.
        }
      })();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [phase, auth, completeRegistration]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (phase !== "verify" || resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [phase, resendIn]);

  if (phase !== "form") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {phase === "completeError" ? "Almost there" : "Verify your email"}
          </h2>
          {phase === "verify" ? (
            <p className="max-w-md text-sm text-slate-600">
              We sent a verification link to{" "}
              <span className="font-semibold">{form.email}</span>. Open it in
              your inbox to activate your account — this page continues
              automatically once verified.
            </p>
          ) : (
            <p className="max-w-md text-sm text-slate-600">
              {phase === "completing"
                ? "Email verified. Setting up your account..."
                : "We couldn't finish setting up your account."}
            </p>
          )}
        </div>

        {messageBox(message)}

        {phase === "completing" ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating your account...
          </div>
        ) : null}

        {phase === "verify" ? (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              onClick={recheckVerification}
              disabled={checking || loading}
              className="w-full justify-center gap-2 py-3"
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {checking ? "Checking..." : "I've verified my email"}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={resendVerification}
                disabled={checking || resendIn > 0}
                className="flex-1 justify-center py-3"
              >
                {resendIn > 0 ? `Resend email (${resendIn}s)` : "Resend email"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={startOver}
                disabled={checking || loading}
                className="flex-1 justify-center py-3"
              >
                Use a different email
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "completeError" ? (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              onClick={completeRegistration}
              disabled={loading}
              className="w-full justify-center gap-2 py-3"
            >
              Try again
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={startOver}
                disabled={loading}
                className="flex-1 justify-center py-3"
              >
                Start over
              </Button>
              {onGoToLogin ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onGoToLogin}
                  disabled={loading}
                  className="flex-1 justify-center py-3"
                >
                  Go to login
                </Button>
              ) : null}
            </div>
            <p className="text-center text-xs text-slate-500">
              If this email already has an account, log in instead.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {(["Student", "Faculty"] as RegistrationRole[]).map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => handleRoleChange(role)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              form.role === role
                ? "border-primary bg-primary/10 text-primary"
                : "border-gray-300 bg-white text-slate-600 hover:border-primary/50"
            }`}
          >
            {role === "Student" ? (
              <GraduationCap className="h-4 w-4" />
            ) : (
              <BookUser className="h-4 w-4" />
            )}
            {role}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="First name" icon={UserRound}>
          <Input
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            placeholder="Juan"
            required
          />
        </Field>
        <Field label="Last name" icon={UserRound}>
          <Input
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            placeholder="Dela Cruz"
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Middle initial (optional)" icon={UserRound}>
          <Input
            name="middleInitial"
            value={form.middleInitial}
            onChange={handleChange}
            placeholder="D"
            maxLength={1}
          />
        </Field>
        <Field label="Suffix (optional)" icon={UserRound}>
          <Input
            name="suffix"
            value={form.suffix}
            onChange={handleChange}
            placeholder="Jr."
            maxLength={10}
          />
        </Field>
      </div>

      <Field label="Email address" icon={Mail}>
        <Input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder={
            form.role === "Student"
              ? "juan@student.pnm.edu.ph"
              : "juan@pnm.edu.ph"
          }
          required
        />
        <span className="block text-xs text-slate-500">
          Must be a{" "}
          {form.role === "Student" ? STUDENT_EMAIL_DOMAIN : FACULTY_EMAIL_DOMAIN}{" "}
          address.
        </span>
      </Field>

      {form.role === "Student" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Student number" icon={GraduationCap}>
            <Input
              name="studentNumber"
              value={form.studentNumber}
              onChange={handleChange}
              placeholder="2024-00001"
              maxLength={20}
              required
            />
          </Field>
          <Field label="Institute" icon={Building2}>
            <select
              name="institute"
              value={form.institute}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="" disabled>
                Select your institute
              </option>
              {INSTITUTES.map((institute) => (
                <option key={institute}>{institute}</option>
              ))}
            </select>
          </Field>
        </div>
      ) : (
        <Field label="Institute" icon={Building2}>
          <select
            name="institute"
            value={form.institute}
            onChange={handleChange}
            required
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="" disabled>
              Select your institute
            </option>
            {INSTITUTES.map((institute) => (
              <option key={institute}>{institute}</option>
            ))}
          </select>
        </Field>
      )}

      {form.role === "Student" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Program" icon={GraduationCap}>
            <select
              name="program"
              value={form.program}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {PROGRAMS.map((program) => (
                <option key={program}>{program}</option>
              ))}
            </select>
          </Field>
          <Field label="Year level" icon={CalendarDays}>
            <select
              name="year"
              value={form.year}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </Field>
          <Field label="Section" icon={CalendarDays}>
            <Input
              name="section"
              value={form.section}
              onChange={handleChange}
              placeholder="A"
              maxLength={1}
              required
            />
          </Field>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Password" icon={Lock}>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Create a password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </Field>
        <Field label="Confirm password" icon={Lock}>
          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </Field>
      </div>

      {messageBox(message)}

      {accountExists && onGoToLogin ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onGoToLogin}
          className="w-full justify-center py-3"
        >
          Go to login
        </Button>
      ) : null}

      <Button
        type="submit"
        className="w-full justify-center gap-2 py-3"
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
