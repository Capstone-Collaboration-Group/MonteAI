import cdmLogo from "../../assets/cdm-logo.png";

export default function LeftPanel() {
  return (
    <section className="flex w-full max-w-[420px] flex-col items-start justify-center px-6 py-6">
      {/* CDM Logo */}
      <img
        src={cdmLogo}
        alt="Colegio de Montalban Logo"
        className="mx-auto h-44 w-44 object-contain"
      />

      {/* Title */}
      <h1 className="mt-8 text-5xl font-extrabold text-[#111111]">
        MonteSkolar
      </h1>

      {/* Subtitle */}
      <h2 className="mt-2 text-2xl font-bold text-[#111111]">
        Online Thesis Library
      </h2>

      {/* Red Line */}
      <div className="mt-4 h-1 w-36 rounded-full bg-[#D62828]" />

      {/* Hero Description */}
      <p className="mt-6 text-lg leading-8 text-[#444444]">
        Your AI-Powered platform for discovering, organizing, and accessing
        quality thesis anytime, anywhere.
      </p>
    </section>
  );
}
