export default function GettingStarted() {
  return (
    <section className="py-16" aria-labelledby="getting-started-heading">
        <h2 id="getting-started-heading" className="text-3xl font-bold text-gray-900 sm:text-4xl">
          Getting Started with MonteAI
        </h2>
        <div className="mt-8 h-1 w-16 rounded-full bg-green-600"></div>

        <div className="mt-12 space-y-10">
          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">1</span>
              Access MonteAI
            </h3>
            <p className="text-gray-600 leading-relaxed">
              MonteAI is available through the <strong>MonteSkolar web portal</strong> at <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">monteai.pnm.edu.ph</code>.
              You can also access it via the <strong>MonteSkolar mobile app</strong> (Android) for on-the-go research assistance.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 pl-4">
              <li><strong>Web:</strong> Log in with your institutional credentials (Firebase authentication)</li>
              <li><strong>Mobile:</strong> Download the APK from the <a href="/download-app" className="text-green-700 underline hover:text-green-900">Download App page</a> and install on Android</li>
              <li><strong>Authentication:</strong> Use your student/faculty email to sign in — no separate account needed</li>
            </ul>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">2</span>
              Start a New Chat
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Once logged in, click the <strong>"+ New Chat"</strong> button (center tab on mobile, sidebar on web) to begin a fresh conversation.
              MonteAI remembers your chat history — you can pin, rename, or delete sessions from the chat menu.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>Tip:</strong> Each chat session maintains its own context. Start a new chat when switching research topics to keep responses focused.
              </p>
            </div>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">3</span>
              Ask Your First Question
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Type your research question in the input bar and press Enter or click Send. MonteAI will:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-600 pl-4">
              <li>Analyze your query and search the thesis database</li>
              <li>Retrieve relevant thesis metadata (titles, authors, abstracts, years)</li>
              <li>Synthesize a comprehensive answer with source citations</li>
              <li>Display source theses as clickable cards for deep diving</li>
            </ol>
          </article>
</div>
      </section>
  );
}