import { useState } from "react";

import OTPInput from "./OTPInput";
import Countdown from "./Countdown";

type VerifyFormProps = {
  email: string;
  onSuccess?: () => void;
};

export default function VerifyForm({ email, onSuccess }: VerifyFormProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const [error, setError] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  // ===============================
  // VERIFY BUTTON
  // ===============================

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = otp.join("");

    if (code.length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setError("");

    setIsLoading(true);

    try {
      // =====================================
      // TODO:
      // Call Verify Email API
      //
      // await verifyEmail(email, code)
      // =====================================

      console.log({
        email,
        code,
      });

      setTimeout(() => {
        setIsLoading(false);

        onSuccess?.();
      }, 1000);
    } catch {
      setIsLoading(false);

      setError("Invalid verification code.");
    }
  };

  return (
    <section className="flex w-full max-w-130 flex-col">
      {/* Heading */}

      <h2 className="text-4xl font-bold text-[#1B1B1C]">Verify Email</h2>

      <p className="mt-3 text-gray-500 leading-7">
        We sent a verification code to
      </p>

      <p className="font-semibold text-[#006400] mt-1">{email}</p>

      <form onSubmit={handleVerify} className="mt-10 flex flex-col gap-6">
        {/* OTP */}

        <OTPInput
          value={otp}
          onChange={(value) => {
            setOtp(value);

            if (error) {
              setError("");
            }
          }}
        />

        {/* Error */}

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Verify */}

        <button
          type="submit"
          disabled={isLoading}
          className="
            h-12
            rounded-xl
            bg-[#006400]
            text-white
            font-semibold
            transition-all
            duration-200
            hover:bg-[#005000]
            active:scale-95
            disabled:opacity-50
            disabled:cursor-not-allowed
          "
        >
          {isLoading ? "Verifying..." : "Verify Email"}
        </button>

        {/* Countdown */}

        <Countdown
          onResend={() => {
            console.log("Resend OTP");
          }}
        />
      </form>
    </section>
  );
}
