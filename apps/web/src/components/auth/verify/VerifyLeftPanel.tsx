import cdmLogo from "../../../assets/auth/cdm-logo.png";

export default function VerifyLeftPanel() {
  return (
    <section className="flex w-full max-w-md flex-col items-start justify-center px-4 py-4 sm:px-6 sm:py-6">
      {/* Logo */}

      <img
        src={cdmLogo}
        alt="Colegio de Montalban Logo"
        className="mx-auto h-20 w-20 object-contain sm:h-28 sm:w-28 lg:h-44 lg:w-44"
      />

      {/* Title */}

      <h1 className="mt-4 text-3xl font-extrabold text-[#111111] sm:text-4xl lg:mt-8 lg:text-5xl">
        MonteSkolar
      </h1>

      {/* Subtitle */}

      <h2 className="mt-1 text-lg font-bold text-[#111111] sm:text-xl lg:mt-2 lg:text-2xl">
        Verify Your Email
      </h2>

      {/* Red Line */}

      <div className="mt-3 h-1 w-20 rounded-full bg-[#D62828] sm:w-28 lg:mt-4 lg:w-36" />

      {/* Description */}

      <p className="mt-3 text-sm leading-6 text-[#444444] sm:text-base sm:leading-7 lg:mt-6 lg:text-lg lg:leading-8">
        To keep your account secure, please verify your email address before
        continuing to MonteSkolar.
      </p>
    </section>
  );
}
