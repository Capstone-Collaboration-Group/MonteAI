import type { ReactNode } from "react";
import closeIcon from "../../../assets/close.svg";

type RegisterModalProps = {
  children: ReactNode;
  onClose: () => void;
};

export default function RegisterModal({
  children,
  onClose,
}: RegisterModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-fadeIn">
      <div
        className="
          relative
          w-full
          max-w-287.5
          max-h-[85vh]
          overflow-y-auto
          rounded-[36px]
          border-[3px]
          border-[#9BC39B]
          bg-white
          shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)]
          animate-scaleIn
        "
      >
        {/* Close Button */}

        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-6 right-6 flex h-9 w-9 items-center justify-center rounded-full transition duration-200 hover:bg-gray-100 active:scale-95"
        >
          <img src={closeIcon} alt="Close" className="h-5 w-5" />
        </button>

        <div className="p-5 sm:p-8 lg:p-12">{children}</div>
      </div>
    </div>
  );
}
