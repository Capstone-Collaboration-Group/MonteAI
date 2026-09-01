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
    <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 sm:p-6 transition-opacity duration-${ANIM_DURATION}`}>
      {/* backdrop */}
      <div className={`absolute inset-0 bg-black transition-opacity ${visible && !closing ? "opacity-40" : "opacity-0"}`} />

      <div
        className={`relative w-full max-w-[95vw] sm:max-w-6xl rounded-[20px] sm:rounded-[32px] bg-white shadow-2xl transition-all duration-300 ease-out ${
          visible && !closing ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-3 scale-95"
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          aria-label="Close"
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full transition duration-200 hover:bg-gray-100 active:scale-95 sm:top-6 sm:right-6"
        >
          <img src={closeIcon} alt="Close" className="h-5 w-5" />
        </button>

        {/* Modal Content */}
        <div className="p-6 sm:p-12">{children}</div>
      </div>
    </div>
  );
}
