import cdmLogo from "../../../assets/auth/cdm-logo.png";
import heroImage from "../../../assets/auth/register-hero.png";

export default function RegisterLeftPanel() {
  return (
    <section className="w-full max-w-107.5">
      <img src={cdmLogo} alt="CDM Logo" className="h-28 w-auto" />

      <h1 className="mt-5 text-[52px] font-extrabold text-[#111111]">
        MonteSkolar
      </h1>

      <p className="mt-2 text-xl font-semibold">Online Thesis Library System</p>

      <h2 className="mt-10 text-[60px] leading-16.25 font-extrabold">
        Create your
        <br />
        <span className="text-[#006400]">account</span>
      </h2>

      <div className="mt-4 h-1.25 w-23.75 rounded-full bg-[#FFD500]" />

      <p className="mt-8 text-[26px] leading-10 text-[#555]">
        Join MonteAI and access a world of research, knowledge and innovation.
      </p>

      <img src={heroImage} alt="Register" className="mt-8 w-[320px]" />
    </section>
  );
}
