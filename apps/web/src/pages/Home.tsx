import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";
import ChatPreview from "../components/ChatPreview";
import Footer from "../components/Footer";
import { Button } from "@monteai/ui";

export default function Home() {
  return (
    <main className="w-full bg-linear-to-b from-green-50 to-white">
      <Button />
      <Navbar />
      <div className="mx-auto flex max-w-7xl flex-col px-6 py-8 lg:px-8">
        <Hero />
        <Features />
        <ChatPreview />
      </div>
      <Footer />
    </main>
  );
}