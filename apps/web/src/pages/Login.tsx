import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import LeftPanel from "../components/auth/LeftPanel";
import Modal from "../components/auth/Modal";
import { Card } from "@monteai/ui";
import { auth } from "../lib/firebase";
import LoginForm from "../components/auth/LoginForm";

export default function Login() {
  const navigate = useNavigate();

  return (
    <Modal onClose={() => navigate(-1)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <button
          onClick={() => navigate(-1)}
          className="flex w-fit items-center gap-2 text-sm font-semibold text-primary transition hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </button>

        <Card className="overflow-hidden rounded-[32px] border-none bg-white p-0 shadow-[0_20px_70px_rgba(0,100,0,0.12)]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <LeftPanel />

            <div className="p-6 sm:p-8 lg:p-10">
              <LoginForm auth={auth} onSuccess={() => navigate("/home")} />
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
}
