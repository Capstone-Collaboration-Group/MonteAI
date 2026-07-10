function WhyChoose() {
  return (
    <section className="bg-slate-50 px-6 py-24">
      <div className="mx-auto max-w-7xl">

        <h2 className="text-center text-3xl md:text-4xl font-bold text-gray-900">
          Why Choose MonteAI?
        </h2>

        <p className="mx-auto mt-4 max-w-3xl text-center text-lg leading-8 text-gray-600">
          MonteAI combines artificial intelligence with powerful collaboration
          tools to make academic research easier and more efficient.
        </p>

        <div className="mt-16 grid gap-8 md:grid-cols-2">

          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl">
            <h3 className="text-2xl font-semibold text-green-700">
              Smart Workspace
            </h3>

            <p className="mt-4 text-lg leading-8 text-gray-600">
              Organize documents, references, and research files in one place.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl">
            <h3 className="text-2xl font-semibold text-green-700">
              AI Assistance
            </h3>

            <p className="mt-4 text-lg leading-8 text-gray-600">
              Generate ideas, summarize information, and improve productivity.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl">
            <h3 className="text-2xl font-semibold text-green-700">
              Easy Collaboration
            </h3>

            <p className="mt-4 text-lg leading-8 text-gray-600">
              Work together with classmates or research teams in real time.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl">
            <h3 className="text-2xl font-semibold text-green-700">
              Accurate Research
            </h3>

            <p className="mt-4 text-lg leading-8 text-gray-600">
              Stay organized while producing reliable and well-structured research.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}

export default WhyChoose;