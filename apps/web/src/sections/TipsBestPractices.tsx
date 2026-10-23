export default function TipsBestPractices() {
  return (
    <section className="py-16 bg-white" aria-labelledby="tips-heading">
        <h2 id="tips-heading" className="text-3xl font-bold text-gray-900 sm:text-4xl">
          Tips & Best Practices
        </h2>
        <div className="mt-8 h-1 w-16 rounded-full bg-green-600"></div>

        <div className="mt-12 space-y-10">
          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">1</span>
              Chat Management
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600 pl-4">
              <li><strong>Pin important chats</strong> — keeps them at the top of your history</li>
              <li><strong>Rename sessions</strong> — use descriptive titles like "Literature Review: Gamification in CS"</li>
              <li><strong>Delete stale chats</strong> — keeps your sidebar clean and focused</li>
              <li><strong>One topic per chat</strong> — switching topics mid-chat confuses context</li>
            </ul>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">2</span>
              Query Refinement Strategies
            </h3>
            <div className="space-y-3">
              <p className="text-gray-600">If results aren't what you expected, try:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 pl-4">
                <li><strong>Add program filter:</strong> "ICS theses only" or "BSED program"</li>
                <li><strong>Narrow timeframe:</strong> "from 2023 onwards" or "last 2 years"</li>
                <li><strong>Specify methodology:</strong> "qualitative studies", "experimental design", "case study"</li>
                <li><strong>Use synonyms:</strong> "student engagement" → "learner participation", "academic involvement"</li>
                <li><strong>Break complex queries:</strong> Ask 2–3 focused questions instead of one massive one</li>
              </ul>
            </div>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">3</span>
              Mobile App Specific Tips
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600 pl-4">
              <li><strong>Center "+" tab</strong> — tap to instantly start a fresh chat from anywhere</li>
              <li><strong>Sidebar drawer</strong> — swipe from left or tap menu for recent chats, schedules, research group</li>
              <li><strong>Pull to refresh</strong> — available on Home, Library, Chat, Announcements, Schedules</li>
              <li><strong>Offline-first</strong> — recent chats cached; new messages sync when online</li>
            </ul>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">4</span>
              Common Research Workflows
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Literature Review</h4>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                  <li>Query: "Find recent studies on [topic]"</li>
                  <li>Review sources → open full theses</li>
                  <li>Click Cite → Copy All</li>
                  <li>Verify in Zotero/Mendeley</li>
                </ol>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Research Gap Analysis</h4>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                  <li>Query: "What gaps exist in [topic] research?"</li>
                  <li>Use Expand for deeper analysis</li>
                  <li>Cross-reference with Library filter</li>
                  <li>Document findings for proposal</li>
                </ol>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Methodology Selection</h4>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                  <li>Query: "Compare methodologies for [topic]"</li>
                  <li>Note common approaches in your field</li>
                  <li>Filter Library by your program</li>
                  <li>Read full theses for details</li>
                </ol>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Thesis Topic Ideation</h4>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                  <li>Query: "Emerging topics in [field] 2023–2024"</li>
                  <li>Browse recent theses in Library</li>
                  <li>Identify underexplored angles</li>
                  <li>Discuss with advisor</li>
                </ol>
              </div>
            </div>
          </article>

          <article id="troubleshooting" className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">5</span>
              Troubleshooting
            </h3>
            <dl className="space-y-4 text-gray-600">
              <div>
                <dt className="font-semibold">"No relevant theses found"</dt>
                <dd className="mt-1 pl-4">Run <code className="bg-gray-100 px-1.5 py-0.5 rounded">--diagnose-index</code> on server; likely needs <code className="bg-gray-100 px-1.5 py-0.5 rounded">--reingest-all</code></dd>
              </div>
              <div>
                <dt className="font-semibold">"Abstract not available"</dt>
                <dd className="mt-1 pl-4">Run <code className="bg-gray-100 px-1.5 py-0.5 rounded">--repair-abstracts</code> then <code className="bg-gray-100 px-1.5 py-0.5 rounded">--reingest-all</code></dd>
              </div>
              <div>
                <dt className="font-semibold">Rate limited / breaker open</dt>
                <dd className="mt-1 pl-4">Wait 30–60s; the circuit breaker auto-resets. Check Azure OpenAI quota.</dd>
              </div>
              <div>
                <dt className="font-semibold">Mobile app won't install</dt>
                <dd className="mt-1 pl-4">Enable "Install unknown apps" for your browser/file manager; requires Android 8+</dd>
              </div>
</dl>
          </article>
        </div>
      </section>
  );
}