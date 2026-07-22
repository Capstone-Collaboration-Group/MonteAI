import { useState } from "react";
import * as authService from "../../../services/auth";
import TextInput from "../common/TextInput";

type ForgotPasswordProps = {
  onBack: () => void;

  onNext: (email: string) => void;
};

export default function ForgotPassword({
  onBack,
  onNext,
}: ForgotPasswordProps) {
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (!email) {
      setError("Please enter your email.");

      return;
    }

    const valid =
      email.endsWith("@gmail.com") || email.endsWith("@student.pnm.edu.ph");

    if (!valid) {
      setError("Invalid email.");

      return;
    }

    setLoading(true);

    try {
      await authService.forgotPassword(email);

      onNext(email);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to send verification code.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex w-full max-w-md flex-col">
      <h1 className="text-3xl font-bold lg:text-4xl">Forgot Password</h1>

      <p className="mt-2 text-gray-500">
        Enter your email to receive a verification code.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <TextInput
          label="Email"

          name="email"

          placeholder="example@gmail.com"

          value={email}

          onChange={(e) => setEmail(e.target.value)}
        />

        {error && <p className="text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="
          h-12
          rounded-xl
          bg-[#006400]
          text-white
          font-semibold
          hover:bg-[#005000]
          "
        >
          {loading ? "Sending..." : "Send Verification Code"}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="
text-[#006400]
font-semibold
hover:underline
"
        >
          Back to Login
        </button>
      </form>
    </section>
  );
}
