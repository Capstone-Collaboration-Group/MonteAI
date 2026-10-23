export default function CitingSources() {
  return (
    <section className="py-16" aria-labelledby="citing-sources-heading">
        <h2 id="citing-sources-heading" className="text-3xl font-bold text-gray-900 sm:text-4xl">
          Citing Sources Properly
        </h2>
        <div className="mt-8 h-1 w-16 rounded-full bg-green-600"></div>

        <div className="mt-12 space-y-10">
          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">1</span>
              How MonteAI Cites Sources
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Every MonteAI response includes a <strong>Sources</strong> section listing the theses used to generate the answer.
              Each source shows: thesis title, authors, publication year, and institute.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Click any source to open the full thesis viewer where you can read the abstract, view metadata, and (if available) access the PDF.
            </p>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">2</span>
              APA 7th Edition Citations
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Click the <strong>"Cite"</strong> button on any AI message to generate properly formatted APA 7th edition references.
              The citation modal provides:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 pl-4">
              <li>Individual copy buttons per citation</li>
              <li>"Copy All" button for batch copying</li>
              <li>Formatted references ready for your bibliography</li>
            </ul>
            <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              {`Dela Cruz, J. M., Santos, A. R., & Reyes, K. L. (2024). AI-driven student performance prediction using ensemble learning. [Unpublished undergraduate thesis]. Colegio de Montalban.`}
            </div>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">3</span>
              Academic Integrity Guidelines
            </h3>
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-2">✅ Encouraged Uses</h4>
                <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                  <li>Using MonteAI to <strong>discover relevant theses</strong> for your literature review</li>
                  <li>Reading AI-generated <strong>summaries to identify papers</strong> worth reading in full</li>
                  <li>Using the <strong>Cite feature</strong> to generate accurate APA references</li>
                  <li>Asking for <strong>methodology comparisons</strong> or <strong>research gap identification</strong></li>
                </ul>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-800 mb-2">❌ Avoid</h4>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  <li>Copying AI responses verbatim as your own writing</li>
                  <li>Citing MonteAI as a source — <strong>cite the original theses instead</strong></li>
                  <li>Using AI summaries without <strong>verifying against the full thesis</strong></li>
                  <li>Treating AI-generated content as peer-reviewed evidence</li>
                </ul>
              </div>
            </div>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">4</span>
              Recommended Citation Workflow
            </h3>
            <ol className="list-decimal list-inside space-y-3 text-gray-600 pl-4">
              <li>Ask MonteAI your research question</li>
              <li>Review the <strong>Sources</strong> — click through to read full abstracts/PDFs</li>
              <li>Click <strong>Cite</strong> → <strong>Copy All</strong> for formatted APA references</li>
              <li>Paste into your reference manager (Zotero, Mendeley, etc.)</li>
              <li><strong>Verify each citation</strong> against the original thesis before submitting</li>
            </ol>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Disclaimer:</strong> MonteAI may provide inaccurate info. Always verify key citations from primary sources.
              </p>
            </div>
          </article>
</div>
      </section>
  );
}