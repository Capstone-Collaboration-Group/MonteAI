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

      <div className="flex items-center justify-between">
        <RegisterLeftPanel />

        <VerticalDivider />

        <div className="w-130">
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
