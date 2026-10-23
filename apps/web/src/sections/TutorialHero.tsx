export default function TutorialHero() {
  return (
    <section className="flex flex-col items-center justify-center px-6 py-24">
      <span className="rounded-full border border-green-500 bg-green-100 px-5 py-2 text-sm font-semibold text-green-700">
        Tutorial & Guide
      </span>

      <h1 className="mt-6 max-w-4xl text-center text-5xl font-bold leading-tight text-gray-900 md:text-6xl">
        How to use MonteAI Effectively
      </h1>

      <p className="mt-6 max-w-2xl text-center text-xl leading-8 text-gray-500">
        Learn how to effectively use MonteAI for your research — from asking the right questions to citing sources properly.
      </p>

      <div className="mt-8 h-1 w-24 rounded-full bg-green-600"></div>

      <div className="mt-16 grid w-full max-w-5xl gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Getting Started</h3>
          <p className="mt-2 text-gray-500">Access MonteAI and start your first conversation.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Effective Querying</h3>
          <p className="mt-2 text-gray-500">Learn to ask questions that get accurate, relevant results.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">Citing Sources</h3>
          <p className="mt-2 text-gray-500">Properly attribute AI-assisted research in your work.</p>
        </div>
      </div>
    </section>
  );
}