import { useState } from "react";
import * as authService from "../../../services/auth";
import RegisterPassword from "../register/RegisterPassword";
import {
  validatePassword,
  passwordsMatch,
  getPasswordError,
  getConfirmPasswordError,
} from "../common/Password";

type ResetPasswordProps = {
  email: string;
  onSuccess: () => void;
};

export default function ResetPassword({
  email,
  onSuccess,
}: ResetPasswordProps) {
  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    // Validate password
    const passwordError = getPasswordError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // Validate confirm password
    const confirmPasswordError = getConfirmPasswordError(
      password,
      confirmPassword,
    );
    if (confirmPasswordError) {
      setError(confirmPasswordError);
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword({
        email,
        password,
      });

      onSuccess();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to reset password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full max-w-md">
      <h1 className="text-4xl font-bold">Reset Password</h1>

      <p className="mt-2 text-gray-500">
        Create a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <RegisterPassword
          label="New Password"
          name="password"
          placeholder="Enter new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <RegisterPassword
          label="Confirm Password"
          name="confirmPassword"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && <p className="text-red-500 font-medium">{error}</p>}

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
        hover:bg-[#005000]
        disabled:opacity-50
        "
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </section>
  );
}
