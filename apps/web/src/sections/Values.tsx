import ValueCard from "../components/ValueCard";

function Values() {
  return (
    <section className="bg-slate-50 px-6 py-24">

      <div className="mx-auto max-w-6xl">

        <h2 className="text-center text-3xl md:text-4xl font-bold text-gray-900">
          Our Core Values
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-8 text-gray-600">
          These values shape every feature we build and every decision we make at MonteAI.
        </p>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">

          <ValueCard
            icon="🤖"
            title="Innovation"
            description="We use AI to simplify research and empower smarter learning."
          />

          <ValueCard
            icon="📚"
            title="Excellence"
            description="We strive to deliver reliable and high-quality research tools."
          />

          <ValueCard
            icon="🤝"
            title="Collaboration"
            description="We believe great ideas are created through teamwork."
          />

          <ValueCard
            icon="🔒"
            title="Integrity"
            description="We value security, honesty, and responsible AI development."
          />

        </div>

      </div>

    </section>
  );
}

export default Values;