export default function InstallationGuide() {
  return (
    <section className="py-16 bg-white" aria-labelledby="install-heading">
        <h2 id="install-heading" className="text-3xl font-bold text-gray-900 sm:text-4xl">
          Installation Guide
        </h2>
        <div className="mt-8 h-1 w-16 rounded-full bg-green-600"></div>

        <div className="mt-12 space-y-8">
          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">1</span>
              Download the APK
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Click the <strong>Download APK</strong> button above. The file (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">monteskolar.apk</code>) will download to your device's Downloads folder.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> If downloading on desktop, transfer the APK to your phone via USB, Bluetooth, or cloud storage (Google Drive, etc.).
              </p>
            </div>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">2</span>
              Enable Installation from Unknown Sources
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Android blocks installation of apps from outside the Play Store by default. You need to allow it for your browser or file manager:
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-600 pl-4">
              <li>Open <strong>Settings</strong> → <strong>Security</strong> (or <strong>Apps</strong> → <strong>Special app access</strong>)</li>
              <li>Tap <strong>Install unknown apps</strong> (or <strong>Install other apps</strong>)</li>
              <li>Select the app you used to download/open the APK (e.g., <strong>Chrome</strong>, <strong>Files</strong>, <strong>Drive</strong>)</li>
              <li>Toggle <strong>Allow from this source</strong> ON</li>
            </ol>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <strong>Android 13+:</strong> Settings → Security & Privacy → Install unknown apps → Select app → Allow
                <br />
                <strong>Android 8–12:</strong> Settings → Apps → Special access → Install unknown apps → Select app → Allow
              </p>
            </div>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">3</span>
              Install the APK
            </h3>
            <ol className="list-decimal list-inside space-y-3 text-gray-600 pl-4">
              <li>Open your <strong>Files</strong> (or <strong>My Files</strong>) app</li>
              <li>Navigate to <strong>Downloads</strong> folder</li>
              <li>Tap <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">monteskolar.apk</code></li>
              <li>Tap <strong>Install</strong> when prompted</li>
              <li>Wait for installation to complete, then tap <strong>Open</strong></li>
            </ol>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">4</span>
              First Launch & Sign In
            </h3>
            <p className="text-gray-600 leading-relaxed">
              On first launch, you'll see the MonteSkolar splash screen followed by the authentication screen.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 pl-4">
              <li>Enter your <strong>institutional email</strong> (e.g., <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">student@pnm.edu.ph</code>)</li>
              <li>Complete Firebase authentication (email/password or Google sign-in)</li>
              <li>Grant notification permission for defense schedule alerts</li>
              <li>You're in — start chatting with MonteAI from the center <strong>+</strong> tab!</li>
            </ul>
          </article>

          <article className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold">5</span>
              Updates
            </h3>
            <p className="text-gray-600 leading-relaxed">
              MonteSkolar checks for updates on launch. When a new version is available:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 pl-4">
              <li>A banner will appear prompting you to update</li>
              <li>Tap to download the latest APK</li>
              <li>Install over the existing app (your data is preserved)</li>
            </ul>
            <p className="text-gray-600">
              You can also revisit this page to manually download the latest version.
            </p>
</article>
        </div>
      </section>
  );
}