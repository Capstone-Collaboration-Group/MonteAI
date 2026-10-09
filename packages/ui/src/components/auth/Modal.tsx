import { type ReactNode, useEffect, useState } from "react";
import closeIcon from "../../assets/close.svg";

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
};

const ANIM_DURATION = 300; // ms

export function Modal({ children, onClose }: ModalProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // trigger entrance animation
    const id = window.setTimeout(() => setVisible(true), 10);
    return () => window.clearTimeout(id);
  }, []);

  const handleClose = () => {
    // play exit animation then call external onClose
    setClosing(true);
    setVisible(false);
    window.setTimeout(() => onClose(), ANIM_DURATION);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-sm">
      {/* backdrop */}
      <div className={`fixed inset-0 bg-black transition-opacity duration-300 ${visible && !closing ? "opacity-40" : "opacity-0"}`} />

      <div className="box-border flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className={`relative my-2 max-h-[calc(100dvh-4rem)] w-full max-w-[95vw] overflow-y-auto overscroll-contain rounded-[20px] bg-white shadow-2xl transition-all duration-300 ease-out sm:my-3 sm:max-w-6xl sm:rounded-[32px] ${
            visible && !closing ? "translate-y-0 scale-100 opacity-100" : "-translate-y-3 scale-95 opacity-0"
          }`}
        >
          {/* Close Button */}
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full transition duration-200 hover:bg-gray-100 active:scale-95 sm:right-6 sm:top-6"
          >
            <img src={closeIcon} alt="Close" className="h-5 w-5" />
          </button>

          {/* Modal Content */}
          <div className="p-6 sm:p-12">{children}</div>
        </div>
      </div>
    </div>
  );
}
