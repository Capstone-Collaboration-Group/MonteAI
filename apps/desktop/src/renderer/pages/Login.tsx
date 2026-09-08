// desktop/src/renderer/pages/Login.tsx
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LoginForm, LeftPanel, Modal, Card } from "@monteai/ui";
import { auth } from "../lib/firebaseServices";

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

        <Card className="overflow-hidden rounded-[32px] !border-0 bg-white p-0 !shadow-none">
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