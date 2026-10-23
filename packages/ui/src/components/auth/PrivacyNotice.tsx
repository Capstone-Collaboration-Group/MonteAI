import { useState } from "react";
import { PRIVACY_NOTICE_VERSION } from "@monteai/types";
import { Button } from "../Button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "../common/Modal";

type PrivacyNoticeProps = {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
};

export function PrivacyNotice({
  accepted,
  onAcceptedChange,
}: PrivacyNoticeProps) {
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
          aria-label="I agree to the privacy notice"
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
              privacy notice
            </button>
            .
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Required to create an account · Version {PRIVACY_NOTICE_VERSION}
          </p>
        </div>
      </section>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        size="xl"
        className="max-h-[90dvh]"
        ariaLabelledBy="privacy-notice-title"
      >
        <ModalHeader onClose={() => setIsOpen(false)}>
          <span id="privacy-notice-title">Privacy notice</span>
        </ModalHeader>
        <ModalBody
          className="space-y-4 text-sm leading-relaxed text-on-surface-variant"
        >
          <p className="text-xs text-slate-500">
            Republic Act No. 10173 (Data Privacy Act of 2012) · Version{" "}
            {PRIVACY_NOTICE_VERSION}
          </p>
          <p>
            MonteAI processes information to manage your account and provide
            institutional thesis discovery and research assistance:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Account information, including your name, institutional email,
              student number (if applicable), institute, program, year, and
              section, is stored in account records to create and manage your
              account.
            </li>
            <li>
              Thesis PDFs and thesis metadata, including title, author names,
              abstract, and publication year. PDFs are stored in Azure Blob
              Storage; metadata for approved theses is stored in MonteAI&apos;s
              database and indexed for search. Relevant metadata may be
              retrieved to answer chat questions and provide citations.
            </li>
            <li>
              Chat messages, which are stored and used to process your
              questions, retrieve relevant thesis metadata, and generate
              responses.
            </li>
            <li>
              A TOTP secret, stored in encrypted form when you enable
              authenticator-based two-factor authentication.
            </li>
          </ul>
          <p>
            Account authentication uses Firebase. Account and thesis records
            are stored in Azure SQL, thesis PDFs in Azure Blob Storage, and
            thesis abstracts and related data in Firestore. Pinecone searches
            thesis metadata, and Azure AI services generate chat responses.
          </p>
          <p>
            Thesis PDFs are made available to students in view-only mode;
            student downloads are not offered. Theses are included only after
            research department approval and the authors&apos; separate formal
            consent. This account notice does not replace that manuscript
            consent. MonteAI provides access and discovery and does not claim
            ownership of thesis works.
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
