import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LeftPanel, Modal, Card, RegistrationForm } from "@monteai/ui";
import { auth } from "../lib/firebase";
import { checkExistingSignupProfile, registerPendingProfile, studentIdVerification } from "../lib/registrationService";

export default function Register() {
  const navigate = useNavigate();
  const [lifetime] = useState(() => new AbortController());
  const leave = (path: string) => { lifetime.abort(); navigate(path); };

  return (
    <Modal onCloseRequest={() => lifetime.abort()} onClose={() => navigate('/')}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <button
          type="button"
          onClick={() => leave('/')}
          className="flex w-fit translate-y-2 items-center gap-2 text-sm font-semibold text-primary transition hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </button>

        <Card className="overflow-hidden rounded-[32px] !border-0 bg-white p-0 !shadow-none">
          <div className="grid min-w-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <LeftPanel />

            <div className="min-w-0 p-4 sm:p-8 lg:p-10">
              <RegistrationForm
                auth={auth}
                register={registerPendingProfile}
                checkExistingProfile={checkExistingSignupProfile}
                studentIdVerification={studentIdVerification}
                lifetimeSignal={lifetime.signal}
                onSuccess={() => { if (!lifetime.signal.aborted) navigate('/home', { replace: true }); }}
                onGoToLogin={() => leave('/login')}
              />
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
}
