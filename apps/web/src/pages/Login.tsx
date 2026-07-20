import type { Auth } from "firebase/auth";
import Modal from "../components/auth/Modal";
import LeftPanel from "../components/auth/LeftPanel";
import VerticalDivider from "../components/auth/VerticalDivider";
import LoginForm from "../components/auth/LoginForm";

type LoginProps = {
  auth: Auth;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function Login({ auth, onClose, onSuccess }: LoginProps) {
  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">
        <LeftPanel />
        <VerticalDivider />
        <LoginForm auth={auth} onSuccess={onSuccess} />
      </div>
    </Modal>
  );
}