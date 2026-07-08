import icon3 from "../assets/icon-3.svg";
import icon4 from "../assets/icon-4.svg";

export default function Footer() {
  return (
    <footer className="mt-16 w-full bg-[#f1f1f1]">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="text-left mt-10">
            <div className="[font-family:'Inter-ExtraBold',Helvetica] text-2xl font-extrabold text-[#006400]">
              MonteSkolar
            </div>
            <p className="mt-3 [font-family:'Inter-Regular',Helvetica] text-base leading-6 text-[#3f4a3a] max-w-md">
              Your institution's research, now at your fingertips. Bringing Colegio de Montalban's academic knowledge to life through the power of AI.
            </p>
          </div>

          <div className="text-left mt-10 lg:ml-[200px]">
            <div className="inline-block">
              <div className="[font-family:'Inter-SemiBold',Helvetica] text-sm font-semibold tracking-[0.7px] text-[#1b1b1c]">
                CONTACT
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <img className="h-5 w-5" alt="email icon" src={icon4} aria-hidden="true" />
                  <a
                    className="[font-family:'Inter-Regular',Helvetica] text-base leading-6 text-[#3f4a3a] underline"
                    href="mailto:info@pnm.edu.ph"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    info@pnm.edu.ph
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <img className="h-5 w-5" alt="website icon" src={icon3} aria-hidden="true" />
                  <a
                    className="[font-family:'Inter-Regular',Helvetica] text-base leading-6 text-[#3f4a3a] underline"
                    href="http://pnm.edu.ph"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    pnm.edu.ph
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-15 text-center opacity-60 [font-family:'Inter-Regular',Helvetica] text-base leading-6 text-[#3f4a3a]">
          © 2026 MonteSkolar. All rights reserved.
        </p>
      </div>
    </footer>
  );
}