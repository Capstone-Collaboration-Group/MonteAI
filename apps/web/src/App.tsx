import "./App.css";

import Hero from "./sections/Hero";
import Values from "./sections/Values";
import MissionVision from "./sections/MisionVision";
import WhyChoose from "./sections/WhyChoose";
import Team from "./sections/Team";
import Journey from "./sections/Journey";

function App() {
  return (
    <>

      <main>
        <Hero />
        <Values />
        <MissionVision />
        <WhyChoose />
        <Team />
        <Journey />
      </main>

    </>
  );
}

export default App;