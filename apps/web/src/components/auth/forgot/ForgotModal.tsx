import Modal from "../common/Modal";
import VerticalDivider from "../common/VerticalDivider";

import ForgotLeftPanel from "./ForgotLeftPanel";
import ForgotPassword from "./ForgotPassword";

type ForgotModalProps = {
  onClose: () => void;
  onBackToLogin: () => void;
  onVerify: () => void;
};

export default function ForgotModal({
  onClose,
  onBackToLogin,
  onVerify,
}: ForgotModalProps) {
  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">
        {/* Left Side */}
        <ForgotLeftPanel />

        {/* Divider */}
        <VerticalDivider />

        {/* Right Side */}
        <ForgotPassword
          onVerify={onVerify}
          onBackToLogin={onBackToLogin}
        />
      </div>
    </Modal>
  );
}