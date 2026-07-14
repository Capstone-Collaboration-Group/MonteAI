import { useState } from "react";

import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";
import ChatPreview from "../components/ChatPreview";
import Footer from "../components/Footer";
import Login from "./Login";

export default function Home() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <main className="w-full bg-linear-to-b from-green-50 to-white">
        <Navbar onLoginClick={() => setShowLogin(true)} />

        <div className="mx-auto flex max-w-7xl flex-col px-6 py-8 lg:px-8">
          <Hero />
          <Features />
          <ChatPreview />
        </div>

        <Footer />
      </main>

      {showLogin && <Login onClose={() => setShowLogin(false)} />}
    </>
  );
}
