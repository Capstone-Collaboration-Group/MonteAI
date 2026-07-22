import { useState } from "react";

import Modal from "../components/auth/common/Modal";
import LeftPanel from "../components/auth/login/LeftPanel";
import VerticalDivider from "../components/auth/common/VerticalDivider";

import ForgotPassword from "../components/auth/forgot/ForgotPassword";
import VerifyModal from "../components/auth/verify/VerifyModal";
import ResetPassword from "../components/auth/reset/ResetPassword";
import SuccessModal from "../components/auth/success/SuccessModal";
import Login from "./Login";

type ForgotPasswordPageProps = {
  onClose: () => void;
  onRegister?: () => void;
};

export default function ForgotPasswordPage({
  onClose,
  onRegister,
}: ForgotPasswordPageProps) {
  const [showVerify, setShowVerify] = useState(false);

  const [showReset, setShowReset] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);

  const [showLogin, setShowLogin] = useState(false);

  const [email, setEmail] = useState("");

  return (
    <>
      {showLogin && (
        <Login
          onClose={onClose}
          onRegister={onRegister ?? onClose}
          onForgotPassword={() => setShowLogin(false)}
        />
      )}

      {showVerify && (
        <VerifyModal
          email={email}
          onBack={() => setShowVerify(false)}
          onSuccess={() => {
            setShowVerify(false);
            setShowReset(true);
          }}
        />
      )}

      {showReset && (
        <Modal onClose={() => setShowReset(false)}>
          <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">
            <LeftPanel />

            <VerticalDivider />

            <ResetPassword
              email={email}
              onSuccess={() => {
                setShowReset(false);
                setShowSuccess(true);
              }}
            />
          </div>
        </Modal>
      )}

      {showSuccess && (
        <SuccessModal
          onContinue={() => {
            setShowSuccess(false);
            setShowLogin(true);
          }}
        />
      )}

      {!showLogin && (
        <Modal onClose={onClose}>
          <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">
            <LeftPanel />

            <VerticalDivider />

            <ForgotPassword
              onBack={() => setShowLogin(true)}
              onNext={(userEmail) => {
                setEmail(userEmail);
                setShowVerify(true);
              }}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
