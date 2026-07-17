import Modal from "../components/auth/Modal";
import LeftPanel from "../components/auth/LeftPanel";
import VerticalDivider from "../components/auth/VerticalDivider";
import LoginForm from "../components/auth/LoginForm";

type LoginProps = {
  onClose: () => void;
};

export default function Login({ onClose }: LoginProps) {
  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">
        {/* Left Side */}
        <LeftPanel />

        {/* Divider */}
        <VerticalDivider />

        {/* Right Side */}
        <LoginForm />
      </div>
    </Modal>
  );
}
