export default function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="flex flex-col items-center justify-center px-4 py-20 text-center sm:px-6 lg:py-28"
    >
      <h1
        id="hero-heading"
        className="max-w-5xl whitespace-nowrap font-['Inter-ExtraBold',Helvetica] text-[2.1rem] font-extrabold leading-tight tracking-[-0.96px] text-[#1b1b1c] sm:text-[2.8rem] lg:text-[3.5rem]"
      >
        <span>Your AI-Powered </span>
        <span className="text-[#006400]">Thesis Library</span>
      </h1>
      <p className="mt-6 max-w-3xl font-['Inter-Regular',Helvetica] text-lg leading-7 text-[#3f4a3a]">
        Simplify your thesis research journey. Search for published CDM studies,
        get AI-powered answers, and access your institution&#39;s research
        repository anytime, anywhere, all in one platform.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="cursor-pointer rounded-full bg-[#006400] px-10 py-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          aria-label="Launch MonteAI from hero section"
        >
          Launch Now
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-full border-2 border-[#6f7a69] px-10 py-4 text-sm font-semibold text-[#1b1b1c] shadow-sm transition hover:bg-[#f2f2f2]"
          aria-label="Learn more about MonteAI"
        >
          Learn More
        </button>
      </div>
    </section>
  );
}
