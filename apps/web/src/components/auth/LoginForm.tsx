import { useState } from "react";
import TextInput from "./TextInput";
import PasswordInput from "./PasswordInput";

export default function LoginForm() {
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    console.log({
      studentNumber,
      password,
    });

    // TODO:
    // Call your login API here later
  };

  return (
    <section className="flex w-full max-w-md flex-col">
      {/* Heading */}
      <h2 className="text-4xl font-bold text-[#1B1B1C]">Welcome Back</h2>

      <p className="mt-2 text-base text-gray-500">
        Sign in to continue to MonteSkolar.
      </p>

      {/* Form */}
      <form onSubmit={handleLogin} className="mt-10 flex flex-col gap-6">
        {/* Student Number */}
        <TextInput
          label="Student Number"
          name="studentNumber"
          placeholder="Enter your student number"
          value={studentNumber}
          onChange={(e) => setStudentNumber(e.target.value)}
        />

        {/* Password */}
        <PasswordInput
          label="Password"
          name="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* Forgot Password */}
        <div className="flex justify-end">
          <button
            type="button"
            className="text-sm font-medium text-[#006400] transition hover:underline"
          >
            Forgot Password?
          </button>
        </div>

        {/* Login Button */}
        <button
          type="submit"
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
            cursor-pointer
          "
        >
          Login
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-300" />

          <span className="text-sm text-gray-500">OR</span>

          <div className="h-px flex-1 bg-gray-300" />
        </div>

        {/* Register */}
        <p className="text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <button
            type="button"
            className="font-semibold text-[#006400] hover:underline"
          >
            Sign Up
          </button>
        </p>
      </form>
    </section>
  );
}
