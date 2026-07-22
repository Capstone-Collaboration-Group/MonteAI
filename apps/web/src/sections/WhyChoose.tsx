export default function WhyChoose() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl">

        <div className="text-center">

          <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
            Why Choose MonteAI
          </span>

          <h2 className="mt-6 text-4xl font-bold text-gray-900">
            Built for Modern Researchers
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-gray-500">
            MonteAI combines artificial intelligence with practical research
            tools to provide a smarter and more efficient research experience.
          </p>

        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2">

          <div className="rounded-xl border border-green-100 bg-white p-8 shadow-sm">
            <h3 className="mb-4 text-xl font-bold">
              Faster Research
            </h3>

            <p className="leading-7 text-gray-600">
              Reduce time spent organizing information and focus more on
              developing quality research.
            </p>
          </div>

          <div className="rounded-xl border border-green-100 bg-white p-8 shadow-sm">
            <h3 className="mb-4 text-xl font-bold">
              AI Assistance
            </h3>

            <p className="leading-7 text-gray-600">
              Receive intelligent suggestions and guidance throughout your
              research journey.
            </p>
          </div>

          <div className="rounded-xl border border-green-100 bg-white p-8 shadow-sm">
            <h3 className="mb-4 text-xl font-bold">
              Collaboration
            </h3>

            <p className="leading-7 text-gray-600">
              Share ideas and work together with classmates and advisers in one
              platform.
            </p>
          </div>

          <div className="rounded-xl border border-green-100 bg-white p-8 shadow-sm">
            <h3 className="mb-4 text-xl font-bold">
              Reliable Results
            </h3>

            <p className="leading-7 text-gray-600">
              Produce organized and high-quality research supported by AI-driven
              insights.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}