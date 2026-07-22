import { useState } from "react";

export default function useAuth() {
  const [activeModal, setActiveModal] = useState<
    "login" | "register" | "verify" | "forgot" | "success" | null
  >(null);

  return {
    activeModal,

    openModal: setActiveModal,

    closeModal: () => setActiveModal(null),
  };
}
