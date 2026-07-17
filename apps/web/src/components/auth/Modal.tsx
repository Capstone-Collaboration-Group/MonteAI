import type { ReactNode } from "react";
import closeIcon from "../../assets/close.svg";

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
};

export default function Modal({ children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
      <div className="relative w-full max-w-6xl rounded-[32px] border-[3px] border-[#9BC39B] bg-white shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-6 right-6 flex h-9 w-9 items-center justify-center rounded-full transition duration-200 hover:bg-gray-100 active:scale-95"
        >
          <img src={closeIcon} alt="Close" className="h-5 w-5" />
        </button>

        {/* Modal Content */}
        <div className="p-12">{children}</div>
      </div>
    </div>
  );
}
