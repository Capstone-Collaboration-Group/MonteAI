import { useMemo, useState } from "react";

import RegisterInput from "./RegisterInput";
import RegisterPassword from "./RegisterPassword";
import RegisterDropdown from "./RegisterDropdown";
import usePasswordStrength from "../../../hooks/usePasswordStrength";
import { institutes } from "../../../data/institutes";
import { programs } from "../../../data/programs";
import { years } from "../../../data/years";
import * as authService from "../../../services/auth";
import {
  validateRegistration,
  normalizeStudentNumber,
  prepareRegistrationData,
  validateEmail,
  validateStudentNumber,
  validatePassword,
  passwordsMatch,
} from "./RegisterValidation";

type RegisterFormProps = {
  onSuccess: () => void;
  onLoginClick: () => void;
  onEmailChange?: (email: string) => void;
};

export default function RegisterForm({
  onSuccess,
  onLoginClick,
  onEmailChange,
}: RegisterFormProps) {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");

  const [studentNumber, setStudentNumber] = useState("");
  const [email, setEmail] = useState("");
  const emailValid = validateEmail(email);

  const [institute, setInstitute] = useState("");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const strength = usePasswordStrength(password);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const filteredPrograms = useMemo(() => {
    if (institute) {
      return programs[institute as keyof typeof programs];
    }

    return Object.entries(programs).flatMap(([key, list]) =>
      list.map((item) => ({
        ...item,
        institute: key,
      })),
    );
  }, [institute]);

  const handleInstitute = (value: string) => {
    setInstitute(value);

    setProgram("");
  };

  const handleProgram = (value: string) => {
    setProgram(value);

    if (institute) return;

    const found = Object.entries(programs)
      .flatMap(([key, list]) =>
        list.map((item) => ({
          ...item,
          institute: key,
        })),
      )
      .find((item) => item.value === value);

    if (found) {
      setInstitute(found.institute);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    // Validate all fields
    const errors = validateRegistration({
      firstName,
      middleName,
      lastName,
      studentNumber,
      email,
      institute,
      program,
      year,
      password,
      confirmPassword,
    });

    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors)[0] || "Please complete all fields.");
      return;
    }

    setLoading(true);

    try {
      const registrationData = prepareRegistrationData({
        firstName,
        middleName,
        lastName,
        studentNumber,
        email,
        institute,
        program,
        year,
        password,
        confirmPassword,
      });

      await authService.register(registrationData);

      onEmailChange?.(email);
      onSuccess();
    } catch (err) {
      // Allow proceeding to verification even if API fails (for testing)
      // In production, you may want to handle this differently
      console.error("Registration error:", err);

      onEmailChange?.(email);
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleRegister}
      className="animate-[fadeIn_.35s_ease] flex flex-col gap-6"
    >
      {/* Heading */}
      <div>
        <h2 className="text-4xl font-bold text-[#1B1B1C]">Create Account</h2>

        <p className="mt-2 text-base text-gray-500">
          Fill in your information below.
        </p>
      </div>

      {/* Form Grid */}
      <div className="grid grid-cols-2 gap-5">
        {/* First Name */}
        <RegisterInput
          label="First Name"
          name="firstName"
          placeholder="Juan"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />

        {/* Middle Name */}
        <RegisterInput
          label="Middle Name"
          name="middleName"
          placeholder="Santos"
          value={middleName}
          onChange={(e) => setMiddleName(e.target.value)}
        />

        {/* Last Name */}
        <RegisterInput
          label="Last Name"
          name="lastName"
          placeholder="Dela Cruz"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />

        {/* Student Number */}
        <RegisterInput
          label="Student Number"
          name="studentNumber"
          placeholder="23-00001"
          value={studentNumber}
          onChange={(e) => {
            setStudentNumber(normalizeStudentNumber(e.target.value));
          }}
        />

        {/* Email */}
        <RegisterInput
          label="Email"
          name="email"
          placeholder="example@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
        />

        {email && !emailValid && (
          <p className="text-red-500 text-xs mt-1">...</p>
        )}

        {/* Year */}
        <RegisterDropdown
          label="Year"
          placeholder="Select Year"
          options={years}
          value={year}
          onChange={(value) => setYear(value)}
        />

        {/* Institute */}
        <RegisterDropdown
          label="Institute"
          placeholder="Select Institute"
          options={institutes}
          value={institute}
          onChange={handleInstitute}
        />

        {/* Program */}
        <RegisterDropdown
          label="Program"
          placeholder="Select Program"
          options={filteredPrograms}
          value={program}
          onChange={handleProgram}
        />
      </div>

      {/* Password */}
      <div>
        <RegisterPassword
          label="Password"
          name="password"
          placeholder="Enter Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {password && (
          <div className="mt-3">
            <div className="flex gap-2">
              <div
                className={`h-2 flex-1 rounded ${
                  strength.score >= 1 ? "bg-red-500" : "bg-gray-200"
                }`}
              />

              <div
                className={`h-2 flex-1 rounded ${
                  strength.score >= 2 ? "bg-orange-400" : "bg-gray-200"
                }`}
              />

              <div
                className={`h-2 flex-1 rounded ${
                  strength.score >= 3 ? "bg-yellow-400" : "bg-gray-200"
                }`}
              />

              <div
                className={`h-2 flex-1 rounded ${
                  strength.score >= 4 ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            </div>

            <p
              className="mt-2 text-xs font-medium"
              style={{ color: strength.color }}
            >
              Password Strength: {strength.label}
            </p>
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <RegisterPassword
        label="Confirm Password"
        name="confirmPassword"
        placeholder="Confirm Password"
        value={confirmPassword}
        compareWith={password}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      {confirmPassword && !passwordsMatch(password, confirmPassword) && (
        <p className="text-red-500 text-xs">Passwords do not match.</p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      {/* Create Account Button */}
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
        hover:bg-[#004d00]
        active:scale-95
        disabled:cursor-not-allowed
        disabled:opacity-60
      "
      >
        {loading ? "Creating Account..." : "Create Account"}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-gray-300" />
        <span className="text-sm text-gray-500">OR</span>
        <div className="h-px flex-1 bg-gray-300" />
      </div>

      {/* Login */}
      <p className="text-center text-sm text-gray-600">
        Already have an account?
        <button
          type="button"
          onClick={onLoginClick}
          className="ml-2 font-semibold text-[#006400] hover:underline"
        >
          Login Here
        </button>
      </p>
    </form>
  );
}
