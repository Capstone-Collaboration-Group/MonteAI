export default function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="flex flex-col items-center justify-center px-4 py-20 text-center sm:px-6 lg:py-28"
    >
      <h1
        id="hero-heading"
        className="max-w-5xl whitespace-nowrap font-black text-[2.1rem] leading-tight tracking-[-0.96px] text-on-surface sm:text-[2.8rem] lg:text-[3.5rem]"
      >
        <span>Your AI-Powered </span>
        <span className="text-secondary">Thesis Library</span>
      </h1>
      <p className="mt-6 max-w-3xl font-medium text-lg leading-7 text-on-surface-variant">
        Simplify your thesis research journey. Search for published CDM studies,
        get AI-powered answers, and access your institution&#39;s research
        repository anytime, anywhere, all in one platform.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="cursor-pointer rounded-full bg-secondary px-10 py-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          aria-label="Launch MonteAI from hero section"
        >
          Launch Now
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-full border-2 border-outline px-10 py-4 text-sm font-semibold text-on-surface shadow-sm transition hover:bg-surface-container-high"
          aria-label="Learn more about MonteAI"
        >
          Learn More
        </button>
      </div>
    </section>
  );
}
