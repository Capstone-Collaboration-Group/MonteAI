import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";
import ChatPreview from "../components/ChatPreview";
import LandingShowcase from "../components/LandingShowcase";
import Footer from "../components/Footer";

export default function LandingPage() {
  return (
    <main className="w-full bg-surface overflow-x-hidden">
      <Navbar />
      <Hero />
      <LandingShowcase />
      <Features />
      <ChatPreview />
      <Footer />
    </main>
  );
}
