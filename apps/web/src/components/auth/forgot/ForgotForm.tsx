import { useState } from "react";

import TextInput from "../common/TextInput";

import {
  getStudentNumberError,
  normalizeStudentNumber,
  getEmailError,
} from "../register/RegisterValidation";

type ForgotFormProps = {
  onNext?: (studentNumber: string, email: string) => void;
  onBack?: () => void;
};

export default function ForgotForm({ onNext, onBack }: ForgotFormProps) {
  const [studentNumber, setStudentNumber] = useState("");
  const [email, setEmail] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    // Student Number
    const studentNumberError = getStudentNumberError(studentNumber);
    if (studentNumberError) {
      newErrors.studentNumber = studentNumberError;
    }

    // Email
    const emailError = getEmailError(email);
    if (emailError) {
      newErrors.email = emailError;
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);

    // TODO:
    // Call Forgot Password API

    console.log({
      studentNumber,
      email,
    });

    setTimeout(() => {
      setLoading(false);

      onNext?.(studentNumber, email);
    }, 1000);
  };

  return (
    <section className="flex w-full max-w-md flex-col">
      <h2 className="text-4xl font-bold text-[#1B1B1C]">Forgot Password</h2>

      <p className="mt-2 text-gray-500">
        Enter your Student Number and Email Address.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        {/* Student Number */}

        <TextInput
          label="Student Number"
          name="studentNumber"
          placeholder="Enter Student Number"
          value={studentNumber}
          error={errors.studentNumber}
          onChange={(e) => {
            setStudentNumber(normalizeStudentNumber(e.target.value));

            setErrors((prev) => ({
              ...prev,
              studentNumber: "",
            }));
          }}
        />

        {/* Email */}

        <TextInput
          label="Email Address"
          name="email"
          type="email"
          placeholder="Enter Email Address"
          value={email}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value.trim().toLowerCase());

            setErrors((prev) => ({
              ...prev,
              email: "",
            }));
          }}
        />

        {/* Button */}

        <button
          type="submit"
          disabled={loading}
          className="
            h-12
            rounded-xl
            bg-[#006400]
            text-white
            font-semibold
            transition-all
            duration-200
            hover:bg-[#005300]
            active:scale-95
            disabled:opacity-50
          "
        >
          {loading ? "Sending..." : "Send Verification Code"}
        </button>

        {/* Back */}

        <button
          type="button"
          onClick={onBack}
          className="
            text-[#006400]
            font-semibold
            hover:underline
            transition
          "
        >
          ← Back to Login
        </button>
      </form>
    </section>
  );
}
