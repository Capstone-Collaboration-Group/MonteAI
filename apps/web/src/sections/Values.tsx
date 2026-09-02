import ValueCard from "../components/ValueCard";

export default function Values() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl">

        <div className="text-center">
          <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
            Our Values
          </span>

          <h2 className="mt-6 text-4xl font-bold text-gray-900">
            The Principles That Drive MonteAI
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-gray-500">
            We believe technology should empower researchers through innovation,
            collaboration, and accessibility.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">

          <ValueCard
            title="Innovation"
            description="We continuously explore AI solutions that simplify academic research and encourage creative thinking."
          />

          <ValueCard
            title="Collaboration"
            description="We believe better research comes from teamwork, communication, and shared knowledge."
          />

          <ValueCard
            title="Accessibility"
            description="Everyone deserves access to intelligent tools that make research easier and more efficient."
          />

        </div>
      </div>
    </section>
  );
}