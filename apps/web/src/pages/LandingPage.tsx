import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";
import ChatPreview from "../components/ChatPreview";
import Footer from "../components/Footer";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import Login  from "./Login";

export default function LandingPage() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <main className="w-full bg-linear-to-b from-green-50 to-white">
      <Navbar onLoginClick={() => setIsLoginOpen(true)} />

      <div className="mx-auto flex max-w-7xl flex-col px-6 py-8 lg:px-8">
        <Hero />
        <Features />
        <ChatPreview />
      </div>

      <Footer />

    </main>
  );
}