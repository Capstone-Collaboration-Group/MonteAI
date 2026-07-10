function Journey() {
  return (
    <section className="bg-slate-50 px-6 py-24">
      <div className="mx-auto max-w-5xl">

        <h2 className="text-center text-3xl md:text-4xl font-bold text-gray-900">
          Our Journey
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-8 text-gray-600">
          Every great project starts with an idea. Here's how MonteAI came to life.
        </p>

        <div className="mt-16 space-y-10">

          <div className="rounded-2xl border-l-4 border-green-600 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-green-700">
               Idea & Research
            </h3>

            <p className="mt-2 text-lg leading-8 text-gray-600">
              We identified common challenges students face during academic research and explored how AI could provide meaningful solutions.
            </p>
          </div>

          <div className="rounded-2xl border-l-4 border-green-600 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-green-700">
               Design & Planning
            </h3>

            <p className="mt-2 text-lg leading-8 text-gray-600">
              Wireframes and user interface designs were created to ensure an intuitive and user-friendly experience.
            </p>
          </div>

          <div className="rounded-2xl border-l-4 border-green-600 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-green-700">
               Development
            </h3>

            <p className="mt-2 text-lg leading-8 text-gray-600">
              The team built MonteAI using modern web technologies, integrating AI-powered features and collaboration tools.
            </p>
          </div>

          <div className="rounded-2xl border-l-4 border-green-600 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-green-700">
               Launch
            </h3>

            <p className="mt-2 text-lg leading-8 text-gray-600">
              MonteAI continues to grow as we improve features and help students conduct research more efficiently.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}

export default Journey;