import Modal from "../components/auth/common/Modal";
import VerticalDivider from "../components/auth/common/VerticalDivider";

import LeftPanel from "../components/auth/login/LeftPanel";
import LoginForm from "../components/auth/login/LoginForm";

type LoginProps = {
  onClose: () => void;
  onRegister: () => void;
  onForgotPassword: () => void;
};

export default function Login({
  onClose,
  onRegister,
  onForgotPassword,
}: LoginProps) {
  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">
        <LeftPanel />

        <VerticalDivider />

        <LoginForm
          onRegisterClick={onRegister}
          onForgotPassword={onForgotPassword}
        />
      </div>
    </Modal>
  );
}
