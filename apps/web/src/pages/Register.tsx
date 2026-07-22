import { useState } from "react";

import SuccessModal from "../components/auth/success/SuccessModal";
import RegisterModal from "../components/auth/register/RegisterModal";
import RegisterLeftPanel from "../components/auth/register/RegisterLeftPanel";
import RegisterForm from "../components/auth/register/RegisterForm";
import VerifyModal from "../components/auth/verify/VerifyModal";
import VerticalDivider from "../components/auth/common/VerticalDivider";

type RegisterProps = {
  onClose: () => void;
  onLogin: () => void;
};
export default function Register({ onClose, onLogin }: RegisterProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const [showVerify, setShowVerify] = useState(false);

  const [email, setEmail] = useState("");
  return (
    <RegisterModal onClose={onClose}>
      {showVerify && (
        <VerifyModal
          email={email}
          onBack={() => setShowVerify(false)}
          onSuccess={() => {
            setShowVerify(false);
            setShowSuccess(true);
          }}
        />
      )}

      {showSuccess && (
        <SuccessModal
          onContinue={() => {
            setShowSuccess(false);
            onLogin();
          }}
        />
      )}

      <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">
        <RegisterLeftPanel />

        <VerticalDivider />

        <div className="w-full max-w-md">
          <RegisterForm
            onSuccess={() => {
              setShowVerify(true);
            }}
            onLoginClick={onLogin}
            onEmailChange={setEmail}
          />
        </div>
      </div>
    </RegisterModal>
  );
}
