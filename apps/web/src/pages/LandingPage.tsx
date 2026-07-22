import { useState } from "react";

import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";
import ChatPreview from "../components/ChatPreview";
import Footer from "../components/Footer";

import Login from "./Login";
import Register from "./Register";
import ForgotPasswordPage from "./ForgotPassword";

type AuthModal =
  "login" | "register" | "forgot" | "verify" | "reset" | "success" | null;

export default function LandingPage() {
  const [activeModal, setActiveModal] = useState<AuthModal>(null);

  return (
    <main className="w-full bg-linear-to-b from-green-50 to-white">
      <Navbar
        onLoginClick={() => setActiveModal("login")}
        onRegisterClick={() => setActiveModal("register")}
      />

      {/* Landing Content */}
      <div className="mx-auto flex max-w-7xl flex-col px-6 py-8 lg:px-8">
        <Hero />
        <Features />
        <ChatPreview />
      </div>

      <Footer />

      {/* ---------------- LOGIN ---------------- */}

      {activeModal === "login" && (
        <Login
          onClose={() => setActiveModal(null)}
          onRegister={() => setActiveModal("register")}
          onForgotPassword={() => setActiveModal("forgot")}
        />
      )}

      {/* ---------------- REGISTER ---------------- */}

      {activeModal === "register" && (
        <Register
          onClose={() => setActiveModal(null)}
          onLogin={() => {
            setActiveModal("login");
          }}
        />
      )}

      {/* ---------------- FORGOT PASSWORD ---------------- */}

      {activeModal === "forgot" && (
        <ForgotPasswordPage onClose={() => setActiveModal(null)} />
      )}
    </main>
  );
}
