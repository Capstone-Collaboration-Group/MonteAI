import Modal from "../components/auth/common/Modal";

import LeftPanel from "../components/auth/login/LeftPanel";

import VerticalDivider from "../components/auth/common/VerticalDivider";

import ResetPassword from "../components/auth/reset/ResetPassword";

type Props = {
  email: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ResetPasswordPage({
  email,
  onClose,
  onSuccess,
}: Props) {
  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between">
        <LeftPanel />

        <VerticalDivider />

        <ResetPassword email={email} onSuccess={onSuccess} />
      </div>
    </Modal>
  );
}
