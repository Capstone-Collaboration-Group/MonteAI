import { useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Loader2,
  Mail,
  UserRound,
} from "lucide-react";
import { LeftPanel, Modal, Button, Card, Input } from "@monteai/ui";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import type { RegisterFormDto } from "@monteai/types";
import { auth } from "../lib/firebase";
import { authService } from "../lib/authService";

type FieldProps = {
  label: string;
  icon: React.ElementType;
  children: ReactNode;
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

const initialForm = {
  fullName: "",
  studentNumber: "",
  email: "",
  institute: "Institute of Computing",
  program: "BS Information Technology",
  year: "1",
  password: "",
  confirmPassword: "",
};

export default function Register() {
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const navigate = useNavigate();

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (form.password.length < 8) {
      setMessage({
        type: "error",
        text: "Password must be at least 8 characters long.",
      });
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password,
      );
      await updateProfile(userCredential.user, {
        displayName: form.fullName.trim(),
      });

      const [firstName, ...rest] = form.fullName.trim().split(/\s+/);
      const lastName = rest.pop() ?? firstName;
      const middleInitial = rest.length > 0 ? rest[0][0] : "";

      const payload = {
        Id: userCredential.user.uid,
        Email: form.email.trim(),
        FirstName: firstName ?? form.fullName.trim(),
        MiddleInitial: middleInitial,
        LastName: lastName,
        Role: "Student",
        StudentNumber: form.studentNumber.trim(),
        Institute: form.institute,
        Program: form.program,
        YearLevel: Number(form.year),
        fullName: form.fullName.trim(),
        studentNumber: form.studentNumber.trim(),
        institute: form.institute,
        program: form.program,
        year: form.year,
        password: form.password,
      } as unknown as RegisterFormDto;

      await authService.register(payload);
      setMessage({
        type: "success",
        text: "Registration complete. You can continue to your dashboard.",
      });
      window.setTimeout(() => navigate("/home"), 900);
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "Unable to complete registration right now.";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={() => navigate(-1)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <button
          onClick={() => navigate(-1)}
          className="flex w-fit items-center gap-2 text-sm font-semibold text-primary transition hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </button>

        <Card className="overflow-hidden rounded-[32px] border-none bg-white p-0 shadow-[0_20px_70px_rgba(0,100,0,0.12)]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <LeftPanel />

            <div className="p-6 sm:p-8 lg:p-10">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Full name" icon={UserRound}>
                    <Input
                      name="fullName"
                      value={form.fullName}
                      onChange={handleChange}
                      placeholder="Juan Dela Cruz"
                      required
                    />
                  </Field>

                  <Field label="Student number" icon={GraduationCap}>
                    <Input
                      name="studentNumber"
                      value={form.studentNumber}
                      onChange={handleChange}
                      placeholder="2024-00001"
                      required
                    />
                  </Field>
                </div>

                <Field label="Email address" icon={Mail}>
                  <Input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="student@pnm.edu.ph"
                    required
                  />
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Institute" icon={Building2}>
                    <select
                      name="institute"
                      value={form.institute}
                      onChange={handleChange}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option>Institute of Computing Studies</option>
                      <option>Institute of Teaching Education</option>
                      <option>
                        Institute of Business and Entrepreneurship
                      </option>
                    </select>
                  </Field>

                  <Field label="Program" icon={GraduationCap}>
                    <select
                      name="program"
                      value={form.program}
                      onChange={handleChange}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option>BS Information Technology</option>
                      <option>BS Computer Science</option>
                      <option>BS Data Science</option>
                    </select>
                  </Field>
                </div>

                <Field label="Year level" icon={CalendarDays}>
                  <select
                    name="year"
                    value={form.year}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </Field>

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

                {message ? (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}
                  >
                    {message.text}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="w-full justify-center gap-2 py-3"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {loading ? "Creating account..." : "Create account"}
                </Button>
              </form>

              <p className="mt-5 text-sm text-slate-600">
                Already have an account?{" "}
                <Link
                  to="/"
                  className="font-semibold text-primary hover:underline"
                >
                  Return to login
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
}
