import type { ReactNode } from "react";
import closeIcon from "../../../assets/auth/close.svg";

type RegisterModalProps = {
  children: ReactNode;
  onClose: () => void;
};

export default function RegisterModal({
  children,
  onClose,
}: RegisterModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6 animate-fadeIn">
      <div
        className="
          relative
          w-full
          max-w-287.5
          rounded-[42px]
          border-4
          border-[#4E7D4E]
          bg-white
          shadow-2xl
          animate-scaleIn
        "
      >
        {/* Close Button */}

        <button
          onClick={onClose}
          className="
            absolute
            right-7
            top-7
            transition
            duration-200
            hover:scale-110
            active:scale-95
            cursor-pointer
          "
        >
          <img src={closeIcon} alt="Close" className="h-8 w-8" />
        </button>

        <div className="p-10">{children}</div>
      </div>
    </div>
  );
}
