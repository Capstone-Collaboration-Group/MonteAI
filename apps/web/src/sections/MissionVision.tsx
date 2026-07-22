export default function MissionVision() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl">

        <div className="text-center">
          <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
            Mission & Vision
          </span>

          <h2 className="mt-6 text-4xl font-bold text-gray-900">
            Our Purpose
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-gray-500">
            MonteAI is committed to transforming academic research through
            intelligent technology while inspiring innovation for future
            researchers.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2">

          <div className="rounded-2xl border border-green-100 bg-white p-10 shadow-sm">
            <h3 className="mb-5 text-3xl font-bold text-green-700">
              Mission
            </h3>

            <p className="leading-8 text-gray-600">
              To empower students, educators, and researchers by providing an
              AI-powered platform that simplifies the research process,
              encourages collaboration, and promotes academic excellence.
            </p>
          </div>

          <div className="rounded-2xl border border-green-100 bg-white p-10 shadow-sm">
            <h3 className="mb-5 text-3xl font-bold text-green-700">
              Vision
            </h3>

            <p className="leading-8 text-gray-600">
              To become the leading intelligent research platform that supports
              innovation, enhances learning, and makes quality research
              accessible to everyone.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}