import AboutFeatureCard from "../components/AboutFeatureCard";

export default function AboutHero() {
  return (
    <section className="flex flex-col items-center justify-center px-6 py-24">
      <span className="rounded-full border border-green-500 bg-green-100 px-5 py-2 text-sm font-semibold text-green-700">
        About Us
      </span>

      <h1 className="mt-6 max-w-4xl text-center text-5xl font-bold leading-tight text-gray-900 md:text-6xl">
        Empowering Researchers Through AI Innovation
      </h1>

      <p className="mt-6 max-w-2xl text-center text-xl leading-8 text-gray-500">
        MonteAI empowers students, educators, and researchers by streamlining
        the research process through artificial intelligence. Our mission is to
        make academic research faster, smarter, and more accessible for
        everyone.
      </p>

      <div className="mt-8 h-1 w-24 rounded-full bg-green-600"></div>

      <div className="mt-16 grid w-full max-w-5xl gap-6 md:grid-cols-3">
        <AboutFeatureCard
          title="AI-Powered Research"
          description="Generate ideas, organize information, and speed up your research using AI."
        />

        <AboutFeatureCard
          title="Easy Collaboration"
          description="Work with classmates and researchers in one organized workspace."
        />

        <AboutFeatureCard
          title="Smart Insights"
          description="Analyze data and discover useful insights with intelligent tools."
        />
      </div>
    </section>
  );
}