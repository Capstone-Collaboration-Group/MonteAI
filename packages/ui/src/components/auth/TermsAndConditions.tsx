import { useState } from "react";
import {
  TERMS_AND_CONDITIONS_VERSION,
  type RegistrationRole,
} from "@monteai/types";
import { Button } from "../Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../common/Modal";

type TermsAndConditionsProps = {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  role: RegistrationRole;
};

export function TermsAndConditions({
  accepted,
  onAcceptedChange,
  role,
}: TermsAndConditionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <section className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => {
            if (accepted) {
              onAcceptedChange(event.target.checked);
            } else {
              setIsOpen(true);
            }
          }}
          required
          aria-label="I agree to the terms and conditions"
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
        />
        <div className="text-sm text-slate-800">
          <p>
            I have read and agree to the{" "}
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
            >
              terms and conditions
            </button>
            .
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Required to create an account · Version{" "}
            {TERMS_AND_CONDITIONS_VERSION}
          </p>
        </div>
      </section>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        size="xl"
        className="max-h-[90dvh]"
        ariaLabelledBy="terms-and-conditions-title"
      >
        <ModalHeader onClose={() => setIsOpen(false)}>
          <span id="terms-and-conditions-title">Terms and Conditions</span>
        </ModalHeader>
        <ModalBody className="space-y-4 text-sm leading-relaxed text-on-surface-variant">
          <p className="text-xs text-slate-500">
            Version {TERMS_AND_CONDITIONS_VERSION}
          </p>
          <p>
            By using MonteAI and MonteSkolar, you agree to the following terms
            and conditions:
          </p>
          {role === "Student" ? (
            <p>
              You must be a currently enrolled student of Colegio de Montalban.
              By checking the box below, you confirm that you are currently
              studying at the said college institution.
            </p>
          ) : (
            <p>
              You must be currently affiliated with Colegio de Montalban as a
              faculty member. By checking the box below, you confirm that you
              are currently affiliated with the college institution.
            </p>
          )}
          <p>
            You are solely responsible for your interactions and the messages
            you send to MonteAI.
          </p>
          <p>
            Do not send any illegal, harmful, threatening, abusive, harassing,
            defamatory, vulgar, obscene, hateful, or racially, ethnically, or
            otherwise objectionable messages to MonteAI.
          </p>
          <p>Do not impersonate any other person or entity on MonteAI.</p>
          <p>
            We reserve the right to terminate access to MonteAI and report
            users who violate our community guidelines to the guidance office.
          </p>
        </ModalBody>
        <ModalFooter className="flex-wrap">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsOpen(false)}
          >
            Not now
          </Button>
          <Button
            type="button"
            onClick={() => {
              onAcceptedChange(true);
              setIsOpen(false);
            }}
          >
            I have read and agree
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
