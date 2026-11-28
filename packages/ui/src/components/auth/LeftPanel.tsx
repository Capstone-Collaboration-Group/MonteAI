import cdmLogo from '../../assets/cdm-logo.png'

export function LeftPanel() {
  return (
    <section className="mx-auto flex w-full max-w-[420px] flex-col items-start justify-center px-4 py-6 sm:px-6 sm:py-8 lg:py-6">
      {/* CDM Logo */}
      <img
        src={cdmLogo}
        alt="Colegio de Montalban Logo"
        className="mx-auto h-32 w-32 object-contain sm:h-40 sm:w-40 lg:h-44 lg:w-44"
      />

      {/* Title */}
      <h1 className="mt-6 text-3xl font-extrabold text-on-surface sm:mt-8 sm:text-4xl lg:text-5xl">
        MonteSkolar
      </h1>

      {/* Subtitle */}
      <h2 className="mt-2 text-xl font-bold text-on-surface sm:text-2xl">
        Online Thesis Library
      </h2>

      {/* Red Line */}
      <div className="mt-4 h-1 w-36 rounded-full bg-error" />

      {/* Hero Description */}
      <p className="mt-5 text-base leading-7 text-on-surface-variant sm:mt-6 sm:text-lg sm:leading-8">
        Your AI-Powered platform for discovering, organizing, and accessing
        quality thesis anytime, anywhere.
      </p>
    </section>
  );
}
