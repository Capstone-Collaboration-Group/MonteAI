import { useState } from "react";

import Modal from "../common/Modal";
import OTPInput from "./OTPInput";
import Countdown from "./Countdown";
import * as authService from "../../../services/auth";
import useCountdown from "../../../hooks/useCountdown";

import verifyImage from "../../../assets/auth/verify-email.svg";

type VerifyModalProps = {
  email: string;
  onBack: () => void;
  onSuccess: () => void;
};

export default function VerifyModal({
  email,
  onBack,
  onSuccess,
}: VerifyModalProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const { timeLeft, reset } = useCountdown(90);

  const verifyOTP = async () => {
    setError("");

    const code = otp.join("");

    if (code.length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      await authService.verifyOTP({
        email,
        otp: code,
      });

      onSuccess();
    } catch {
      setError("Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    try {
      await authService.resendOTP(email);

      reset();

      setOtp(["", "", "", "", "", ""]);

      setError("");
    } catch (error) {
      console.error(error);

      setError("Unable to resend verification code.");
    }
  };

  return (
    <Modal onClose={onBack} maxWidth="max-w-sm sm:max-w-md">
      <div className="mx-auto flex w-full max-w-sm sm:max-w-md flex-col items-center">
        {/* Illustration */}
        <img
          src={verifyImage}
          alt="Verify Email"
          className="mb-4 h-24 w-24 object-contain sm:h-32 sm:w-32"
        />

        {/* Title */}
        <h2 className="text-2xl font-bold text-[#1B1B1C] sm:text-3xl">
          Verify Email
        </h2>

        {/* Description */}
        <p className="mt-2 text-center text-sm text-gray-500 leading-6 sm:mt-3 sm:text-base sm:leading-7">
          We've sent a verification code to
        </p>

        <p className="font-semibold text-[#006400]">{email}</p>

        {/* OTP */}
        <div className="mt-6 sm:mt-8">
          <OTPInput value={otp} onChange={setOtp} />
        </div>

        {/* Error */}
        {error && (
          <p className="mt-3 text-center text-sm text-red-500 sm:mt-4">
            {error}
          </p>
        )}

        {/* Countdown */}
        <div className="mt-4 sm:mt-6">
          <Countdown seconds={timeLeft} />
        </div>

        {/* Resend */}
        <button
          type="button"
          disabled={timeLeft > 0}
          onClick={resendCode}
          className="
            mt-2
            font-semibold
            text-[#006400]
            transition
            hover:underline
            disabled:cursor-not-allowed
            disabled:opacity-40
          "
        >
          Resend Code
        </button>

        {/* Verify */}
        <button
          type="button"
          onClick={verifyOTP}
          disabled={loading}
          className="
            mt-8
            h-12
            w-full
            rounded-xl
            bg-[#006400]
            text-white
            font-semibold
            transition
            hover:bg-[#004F00]
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {loading ? "Verifying..." : "Verify Email"}
        </button>

        {/* Change Email */}
        <button
          type="button"
          onClick={onBack}
          className="
            mt-5
            text-sm
            font-medium
            text-gray-500
            transition
            hover:text-[#006400]
            hover:underline
          "
        >
          Change Email
        </button>
      </div>
    </Modal>
  );
}
