import cdmLogo from "../../../assets/auth/cdm-logo.png";
import heroImage from "../../../assets/auth/register-hero.png";

export default function RegisterLeftPanel() {
  return (
    <section className="flex w-full max-w-md flex-col items-start justify-center px-8 py-8 lg:max-w-lg xl:max-w-xl">
      {/* Logo + Brand Header — text level to the bottom of logo */}
      <div className="flex items-end gap-4">
        <img
          src={cdmLogo}
          alt="Colegio de Montalban Logo"
          className="h-28 w-28 object-contain lg:h-44 lg:w-44"
        />

        <div className="pb-1 lg:pb-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#111111] lg:text-4xl">
            MonteSkolar
          </h1>

          <p className="mt-0.5 text-base font-semibold text-[#666666] lg:text-xl">
            Online Thesis Library System
          </p>
        </div>
      </div>

      <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight text-[#111111] lg:mt-8 lg:text-[52px] lg:leading-tight">
        Create your
        <br />
        <span className="text-[#006400]">account</span>
      </h2>

      <div className="mt-3 h-1 w-20 rounded-full bg-[#F4C542] lg:w-24" />

      <p className="mt-6 text-base leading-7 text-[#666666] lg:mt-8 lg:text-lg lg:leading-8">
        Join MonteAI and access a world of research, knowledge and innovation.
      </p>

      <img
        src={heroImage}
        alt="Register"
        className="mt-5 w-full max-w-[340px] self-center lg:mt-6 lg:max-w-[420px]"
      />
    </section>
  );
}
