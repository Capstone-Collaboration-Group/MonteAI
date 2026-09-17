import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { OtpVerification } from "@monteai/ui";
import { otpService, profileService } from "../lib/authService";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? "";
  useEffect(() => {
    void profileService
      .getCurrentProfile()
      .then((profile) => {
        if (profile.isEmailVerified) navigate("/home", { replace: true });
      })
      .catch(() => undefined);
  }, [navigate]);
  if (!email) {
    navigate("/register", { replace: true });
    return null;
  }
  return (
    <OtpVerification
      email={email}
      otpService={otpService}
      onVerified={() => navigate("/home", { replace: true })}
      onBack={() => navigate("/register")}
    />
  );
}
