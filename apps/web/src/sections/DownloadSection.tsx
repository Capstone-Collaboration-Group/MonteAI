export default function DownloadSection() {
  const apkUrl = "https://github.com/your-org/monteai/releases/latest/download/monteskolar.apk";
  const version = "1.0.0";
  const buildDate = "October 2026";
  const fileSize = "45 MB";

  return (
    <section className="py-16" aria-labelledby="download-heading">
        <h2 id="download-heading" className="text-3xl font-bold text-gray-900 sm:text-4xl">
          Download MonteSkolar
        </h2>
        <div className="mt-8 h-1 w-16 rounded-full bg-green-600"></div>

        <div className="mt-12">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl bg-green-100 flex items-center justify-center">
                  <svg className="h-10 w-10 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">MonteSkolar v{version}</h3>
                  <p className="text-gray-500">Android APK • {fileSize} • Built {buildDate}</p>
                </div>
              </div>

              <a
                href={apkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-3 text-white font-semibold text-lg shadow-lg hover:bg-green-800 transition-colors"
                download
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download APK
              </a>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3 text-center">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Version</p>
                <p className="font-semibold text-gray-900">{version}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Size</p>
                <p className="font-semibold text-gray-900">{fileSize}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">Updated</p>
                <p className="font-semibold text-gray-900">{buildDate}</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This is a development build. Enable "Install unknown apps" for your browser or file manager after downloading.
                The app requires Android 8.0 (API 26) or higher.
              </p>
            </div>
</div>
        </div>
      </section>
  );
}