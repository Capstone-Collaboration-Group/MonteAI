import { LucideMessageCircleQuestionMark, LibraryBig, Calendar } from "lucide-react"
export default function DownloadHero() {
  return (
    <section className="flex flex-col items-center justify-center px-6 py-24">
      <span className="rounded-full border border-green-500 bg-green-100 px-5 py-2 text-sm font-semibold text-green-700">
        Mobile App
      </span>

      <h1 className="mt-6 max-w-4xl text-center text-5xl font-bold leading-tight text-gray-900 md:text-6xl">
        MonteSkolar Mobile App
      </h1>

      <p className="mt-6 max-w-2xl text-center text-xl leading-8 text-gray-500">
        Take your research assistant everywhere. Full MonteAI chat, thesis library, schedules, and research group management — all in your pocket.
      </p>

      <div className="mt-8 h-1 w-24 rounded-full bg-green-600"></div>

      <div className="mt-16 grid w-full max-w-5xl gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
          <div className="text-4xl font-bold text-green-700">
            <LucideMessageCircleQuestionMark 
            className="justify-center m-auto"/>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-gray-900">AI Chat</h3>
          <p className="mt-2 text-gray-500">Full MonteAI conversation with streaming, citations, and history</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
          <div className="text-4xl font-bold text-green-700">
            <LibraryBig 
            className="justify-center m-auto"/>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-gray-900">Thesis Library</h3>
          <p className="mt-2 text-gray-500">Browse, search, filter by program — offline cached</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center">
          <div className="text-4xl font-bold text-green-700">
            <Calendar 
            className="justify-center m-auto"/>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-gray-900">Schedules & Groups</h3>
          <p className="mt-2 text-gray-500">Defense calendar, research group management, announcements</p>
        </div>
      </div>
    </section>
  );
}