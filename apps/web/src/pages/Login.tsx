import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LeftPanel, Modal, Card, LoginForm } from "@monteai/ui";
import { MfaLoginFlowGate } from "@monteai/hooks";
import { auth } from "../lib/firebase";
import { anonymousMfaService } from "../lib/mfaService";
import { MfaStep } from "../components/MfaStep";

export default function Login() {
  const navigate = useNavigate();

  return (
    <Modal onClose={() => navigate('/')}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <button
          onClick={() => navigate('/')}
          className="flex w-fit items-center gap-2 text-sm font-semibold text-primary transition hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </button>

        <Card className="overflow-hidden rounded-[32px] !border-0 bg-white p-0 !shadow-none">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <LeftPanel />

            <div className="p-6 sm:p-8 lg:p-10">
              {/* While an MFA challenge is pending, the gate swaps in the
                  code-entry screen; otherwise the normal login form shows. */}
              <MfaLoginFlowGate verifyMfa={(i) => anonymousMfaService.verify(i)}>
                {({ verify, onCancel, error, pending }) => (
                  <MfaStep
                        verify={async (code) => {
                          const result = await verify(code);
                          navigate("/home");
                          return result;
                        }}
                        onCancel={onCancel}
                        error={error}
                        pending={pending}
                      />
                    )}
                  </MfaLoginFlowGate>

                  <LoginForm
                    auth={auth}
                    mfa={{
                      challenge: (idToken) => anonymousMfaService.challenge(idToken),
                      onCancel: () => {
                        void auth.signOut();
                      },
                    }}
                    onSuccess={() => navigate("/home")}
                    onResumeRegistration={() => navigate("/register")}
                  />
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
}
