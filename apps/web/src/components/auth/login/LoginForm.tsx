import { useState } from "react";
import TextInput from "../common/TextInput";
import PasswordInput from "../common/PasswordInput";
import { login } from "../../../services/auth";
import {
  validateStudentNumber,
  normalizeStudentNumber,
} from "../register/RegisterValidation";

type LoginFormProps = {
  onRegisterClick: () => void;
  onForgotPassword: () => void;
};

export default function LoginForm({
  onRegisterClick,
  onForgotPassword,
}: LoginFormProps) {
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (!studentNumber.trim()) {
      setError("Student Number is required.");
      return;
    }

    if (!validateStudentNumber(studentNumber)) {
      setError("Student Number must be in format XX-XXXXX (e.g., 23-00001).");
      return;
    }

    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    try {
      setLoading(true);

      const response = await login({
        studentNumber,
        password,
      });

      console.log("Login Success:", response);

      // TODO:
      // Save token/user data

      // TODO:
      // Navigate to /home
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex w-full max-w-md flex-col">
      <h2 className="text-3xl font-bold text-[#1B1B1C] lg:text-4xl">
        Welcome Back
      </h2>

      <p className="mt-2 text-base text-gray-500">
        Sign in to continue to MonteSkolar.
      </p>

      <form onSubmit={handleLogin} className="mt-10 flex flex-col gap-6">
        <TextInput
          disabled={loading}
          label="Student Number"
          name="studentNumber"
          placeholder="Enter your student number"
          value={studentNumber}
          onChange={(e) =>
            setStudentNumber(normalizeStudentNumber(e.target.value))
          }
        />

        <PasswordInput
          disabled={loading}
          label="Password"
          name="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm font-medium text-[#006400] hover:underline"
          >
            Forgot Password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="
            h-12
            rounded-xl
            bg-[#006400]
            text-white
            font-semibold
            transition
            hover:bg-[#004d00]
          "
        >
          {loading ? "Signing In..." : "Login"}
        </button>

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-300" />

          <span className="text-sm text-gray-500">OR</span>

          <div className="h-px flex-1 bg-gray-300" />
        </div>

        <p className="text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={onRegisterClick}
            className="font-semibold text-[#006400] hover:underline"
          >
            Sign Up
          </button>
        </p>
      </form>
    </section>
  );
}
