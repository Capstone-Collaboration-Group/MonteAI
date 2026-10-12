// desktop/src/renderer/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LoginForm, LeftPanel, Modal, Card, MfaVerifyStep } from "@monteai/ui";
import { auth } from "../lib/firebaseServices";
import { MfaLoginFlowGate } from "@monteai/hooks";
import { anonymousMfaService } from "../lib/mfaService";

export default function Login() {
  const navigate = useNavigate();
  const [recoveryMode, setRecoveryMode] = useState(false);

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
              <MfaLoginFlowGate verifyMfa={(input) => anonymousMfaService.verify(input)}>
                {({ verify, onCancel }) => (
                  <div className="flex flex-col gap-4">
                    <MfaVerifyStep
                      onVerify={async (code) => {
                        const result = await verify(code);
                        navigate("/");
                        return result;
                      }}
                      onUseRecoveryCode={() => setRecoveryMode(true)}
                      onUseAuthenticator={() => setRecoveryMode(false)}
                      recoveryMode={recoveryMode}
                      helperText={
                        recoveryMode
                          ? "Enter one of the recovery codes you saved when you set up MFA."
                          : undefined
                      }
                    />
                    <button
                      type="button"
                      onClick={onCancel}
                      className="text-sm font-semibold text-primary transition hover:opacity-80"
                    >
                      Use a different account
                    </button>
                  </div>
                )}
              </MfaLoginFlowGate>
              <LoginForm
                auth={auth}
                mfa={{ challenge: (idToken) => anonymousMfaService.challenge(idToken) }}
                onSuccess={() => navigate("/")}
                onResumeRegistration={() => navigate("/register")}
              />
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
}