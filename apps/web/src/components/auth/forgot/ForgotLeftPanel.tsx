import cdmLogo from "../../../assets/auth/cdm-logo.png";

export default function ForgotLeftPanel() {
  return (
    <section className="flex w-full max-w-105 flex-col justify-center">
      {/* Logo */}

      <img
        src={cdmLogo}
        alt="CdM Logo"
        className="mx-auto h-44 w-44 object-contain"
      />

      {/* Title */}

      <h1 className="mt-8 text-5xl font-extrabold text-[#111111]">
        MonteSkolar
      </h1>

      {/* Subtitle */}

      <h2 className="mt-2 text-2xl font-bold text-[#111111]">
        Password Recovery
      </h2>

      {/* Red Line */}

      <div className="mt-4 h-1 w-36 rounded-full bg-[#D62828]" />

      {/* Description */}

      <p className="mt-6 text-lg leading-8 text-[#444444]">
        Forgot your password? No worries. Enter your registered email address
        and we'll send you a verification code to securely reset your password.
      </p>
    </section>
  );
}
