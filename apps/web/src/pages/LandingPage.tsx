import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";
import ChatPreview from "../components/ChatPreview";
import Footer from "../components/Footer";
import { useState } from "react";
import Modal from "../components/auth/Modal";
import LeftPanel from "../components/auth/LeftPanel";
import VerticalDivider from "../components/auth/VerticalDivider";
import LoginForm from "../components/auth/LoginForm";

export default function LandingPage() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <main className="w-full bg-linear-to-b from-green-50 to-white">
      <Navbar onLoginClick={() => setIsLoginOpen(true)} />

      <div className="mx-auto flex max-w-7xl flex-col px-6 py-8 lg:px-8">
        <Hero />
        <Features />
        <ChatPreview />
      </div>

      <Footer />

      {isLoginOpen && (
        <Modal onClose={() => setIsLoginOpen(false)}>
          <div className="flex items-center justify-center">
            <LeftPanel />
            <VerticalDivider />
            <LoginForm />
          </div>
        </Modal>
      )}
    </main>
  );
}