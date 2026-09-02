import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import AboutHero from "../sections/AboutHero";
import Values from "../sections/Values";
import MissionVision from "../sections/MissionVision";
import WhyChoose from "../sections/WhyChoose";
import Team from "../sections/Team";
import Journey from "../sections/Journey";

export default function About() {
  return (
    <main className="w-full bg-gradient-to-b from-green-50 to-white">
      <Navbar />

      <div className="mx-auto flex max-w-7xl flex-col px-6 py-8 lg:px-8">
        <AboutHero />
        <Values />
        <MissionVision />
        <WhyChoose />
        <Team />
        <Journey />
      </div>

      <Footer />
    </main>
  );
}