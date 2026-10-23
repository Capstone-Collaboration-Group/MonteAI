export default function HowToQuery() {
  return (
    <section className="py-16 bg-white" aria-labelledby="how-to-query-heading">
        <h2 id="how-to-query-heading" className="text-3xl font-bold text-gray-900 sm:text-4xl">
          How to Query Effectively
        </h2>
        <div className="mt-8 h-1 w-16 rounded-full bg-green-600"></div>

        <div className="mt-12 space-y-10">
          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">1</span>
              Be Specific & Contextual
            </h3>
            <p className="text-gray-600 leading-relaxed">
              MonteAI searches thesis <strong>metadata</strong> (titles, authors, abstracts, years, institutes). The more context you provide, the better the results.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-800 mb-2">❌ Too Vague</h4>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  <li>"Find studies about AI"</li>
                  <li>"Show me theses on education"</li>
                  <li>"What about climate change?"</li>
                </ul>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2">✅ Specific & Contextual</h4>
                <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                  <li>"Find studies on <strong>gamification in computer science education</strong> for undergraduate students"</li>
                  <li>"Show me <strong>IoT-based smart irrigation</strong> theses from the <strong>ICS program</strong> (2022–2024)"</li>
                  <li>"What are the <strong>student benefits of cloud platforms</strong> in <strong>remote learning</strong> contexts?"</li>
                </ul>
              </div>
            </div>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">2</span>
              Use Natural Language Questions
            </h3>
            <p className="text-gray-600 leading-relaxed">
              MonteAI understands natural language. Ask like you would ask a research librarian:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 pl-4">
              <li><strong>Comparative:</strong> "Compare the methodologies used in recent machine learning theses for crop disease detection"</li>
              <li><strong>Gap analysis:</strong> "What research gaps exist in studies about student engagement in online learning?"</li>
              <li><strong>Trend identification:</strong> "What are the emerging topics in computer science theses from 2023–2024?"</li>
              <li><strong>Methodology search:</strong> "Find theses that used mixed-methods approach for evaluating educational apps"</li>
            </ul>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">3</span>
              Leverage Follow-up & Expand
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Each AI response has two powerful actions:
            </p>
            <ul className="list-disc list-inside space-y-3 text-gray-600 pl-4">
              <li>
                <strong>Expand</strong> — Click to get more detail, examples, and depth on the same topic.
                <br /><span className="text-sm text-gray-500">Use when the answer is good but you need more depth.</span>
              </li>
              <li>
                <strong>Cite</strong> — Opens APA 7th edition formatted citations for all sources used.
                <br /><span className="text-sm text-gray-500">Use when writing your literature review or bibliography.</span>
              </li>
            </ul>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Pro tip:</strong> After an Expand, you can Expand again for even more depth. The agent maintains full conversation context.
              </p>
            </div>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">4</span>
              Filter by Program (Library Tab)
            </h3>
            <p className="text-gray-600 leading-relaxed">
              In the <strong>Library</strong> tab, use the <strong>Filter Results</strong> button to narrow theses by program (ICS, BSED, BEED, etc.). This filters at the database level before search.
            </p>
          </article>
</div>
      </section>
  );
}