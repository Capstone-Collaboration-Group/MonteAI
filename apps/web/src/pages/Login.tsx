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
      <div className="flex w-full flex-col items-center justify-between gap-8 lg:flex-row lg:items-stretch">
        <div className="w-full lg:w-1/2">
          <LeftPanel />
        </div>

        <VerticalDivider />

        <div className="w-full flex-1 lg:w-1/2 lg:max-w-md">
          <LoginForm auth={auth} onSuccess={onSuccess} />
        </div>
      </div>
    </Modal>
  );
}