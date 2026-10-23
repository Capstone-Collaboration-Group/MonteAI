export default function Requirements() {
  return (
    <section className="py-16" aria-labelledby="requirements-heading">
        <h2 id="requirements-heading" className="text-3xl font-bold text-gray-900 sm:text-4xl">
          System Requirements & Compatibility
        </h2>
        <div className="mt-8 h-1 w-16 rounded-full bg-green-600"></div>

        <div className="mt-12 space-y-10">
          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">1</span>
              Minimum Requirements
            </h3>
            <ul className="list-disc list-inside space-y-3 text-gray-600 pl-4">
              <li><strong>OS:</strong> Android 8.0 (Oreo, API 26) or higher</li>
              <li><strong>RAM:</strong> 3 GB minimum (4 GB recommended for smooth chat streaming)</li>
              <li><strong>Storage:</strong> 200 MB free space (app + cached theses + offline data)</li>
              <li><strong>Network:</strong> Internet required for authentication, chat, and sync</li>
              <li><strong>Architecture:</strong> arm64-v8a (64-bit) — most modern devices</li>
            </ul>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">2</span>
              Recommended Specs
            </h3>
            <ul className="list-disc list-inside space-y-3 text-gray-600 pl-4">
              <li><strong>OS:</strong> Android 11+ (better scoped storage, notification handling)</li>
              <li><strong>RAM:</strong> 6 GB+ (handles PDF viewing + chat smoothly)</li>
              <li><strong>Storage:</strong> 500 MB+ (cache more theses for offline)</li>
              <li><strong>Screen:</strong> 5.5"+ for comfortable reading</li>
              <li><strong>Network:</strong> Wi-Fi or 4G/5G for real-time streaming responses</li>
            </ul>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">3</span>
              Tested Devices
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 font-semibold text-gray-900">Device</th>
                    <th className="pb-2 font-semibold text-gray-900">Android</th>
                    <th className="pb-2 font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-2 font-medium text-gray-900">Tecno POVA Curve 5G</td><td className="py-2 text-gray-600">14</td><td className="py-2 text-green-700 font-medium"> Full support</td></tr>
                  
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Most devices running Android 8+ with 3 GB+ RAM will work. Report issues via the in-app Help & Support.
            </p>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">4</span>
              Permissions Used
            </h3>
            <dl className="space-y-3 text-gray-600">
              <div className="flex items-start gap-3">
                <dt className="font-semibold text-gray-900 min-w-[140px]">Internet</dt>
                <dd>Required for all API calls (chat, thesis search, schedules, auth)</dd>
              </div>
              <div className="flex items-start gap-3">
                <dt className="font-semibold text-gray-900 min-w-[140px]">Network State</dt>
                <dd>Detects online/offline for sync and caching</dd>
              </div>
              <div className="flex items-start gap-3">
                <dt className="font-semibold text-gray-900 min-w-[140px]">Notifications</dt>
                <dd>Defense schedule reminders, announcement alerts (optional)</dd>
              </div>
              <div className="flex items-start gap-3">
                <dt className="font-semibold text-gray-900 min-w-[140px]">Foreground Service</dt>
                <dd>Background sync for chat messages (Expo dev-client)</dd>
              </div>
            </dl>
            <p className="text-sm text-gray-500">
              No access to contacts, camera, microphone, location, or storage (uses scoped app storage only).
            </p>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">5</span>
              Known Limitations
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600 pl-4">
              <li><strong>No iOS build yet</strong> — Android only for now</li>
              <li><strong>PDF viewing</strong> requires PDF.js (large files may be slow on low-end devices)</li>
              <li><strong>Offline chat</strong> — you can read cached messages but cannot send new ones offline</li>
              <li><strong>Self-signed cert</strong> — dev builds hit <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">https://localhost:7085</code>; production uses valid TLS</li>
              <li><strong>Expo Go not supported</strong> — requires custom dev client (prebuilt)</li>
            </ul>
          </article>

          <article id="support" className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">6</span>
              Support & Feedback
            </h3>
            <div className="space-y-3">
              <p className="text-gray-600">Having issues? Here's how to get help:</p>
              <ul className="list-disc list-inside space-y-2 text-gray-600 pl-4">
                <li><strong>In-app:</strong> Profile → Help & Support (opens email with device info pre-filled)</li>
                <li><strong>Email:</strong> <a href="mailto:monteai-support@pnm.edu.ph" className="text-green-700 underline">monteai-support@pnm.edu.ph</a></li>
                <li><strong>Include:</strong> Device model, Android version, app version, steps to reproduce</li>
</ul>
            </div>
          </article>
        </div>
      </section>
  );
}