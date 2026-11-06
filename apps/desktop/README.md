# MonteSkolar desktop

## Build the Windows installation wizard

Build on Windows with Node.js 22.12+ and pnpm. From the repository root:

```powershell
pnpm install
pnpm build:desktop
```

Or run `pnpm make` from `apps/desktop`. Forge builds the Electron app, then the
NSIS maker creates an assisted `.exe` installer with an installation-directory
choice, desktop/Start menu shortcuts, and an uninstaller. The first build needs
internet access to download the installer tooling.

For version 1.0.0 on Windows x64, distribute:

```text
apps/desktop/out/make/nsis/x64/MonteSkolar-1.0.0-x64-Setup.exe
```

The unpacked app is also runnable at
`out/MonteSkolar-win32-x64/MonteSkolar.exe`; keep that entire folder together.
The installer bundles Electron, so users do not need Node.js or pnpm.
If an older Squirrel-based version is installed, uninstall it before installing
this NSIS version to avoid duplicate shortcuts/uninstall entries. Release
installers need a Windows code-signing certificate to avoid unsigned-publisher
warnings; packaging alone does not sign the app.

## Configure the API before distributing

This is a standalone **client**, not an offline copy of the ASP.NET API,
database, or Firebase. Those services must remain reachable.

Vite embeds configuration at build time. To override your development API
without editing `.env.local`, create a gitignored
`apps/desktop/.env.production.local`:

```dotenv
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://your-api-host.example/api/v1
```

Keep the existing `VITE_FIREBASE_*` client configuration in `.env.local`, matching
the Firebase project used by the server. Never add server credentials or
service-account keys to the app. Rebuild after changing configuration.
`localhost` only works when the API is running on the **same computer** as the
installed app. Production APIs need HTTPS with a trusted certificate; the
renderer deliberately does not bypass TLS validation.

Deploy the updated `server/Program.cs` CORS policy along with the app: the
packaged renderer uses the allowlisted `monteskolar://app` origin. Do not replace
this with `AllowAnyOrigin`, a `null`/`file://` allowlist, or disabled web security.

## Startup and saved sign-in

- A fresh install opens the public welcome page without querying protected API
  endpoints or showing the administrative sidebar.
- Successful sign-in (including MFA when enabled) opens `/dashboard`.
- Firebase login and the MFA session persist in the user's local app profile.
  On reopening, the app restores both before requesting the profile, then goes
  directly to the dashboard when the server accepts the session.
- An expired/rejected session asks the user to sign in again. Network/server
  failures show a retryable error instead of leaving pages loading forever.
- Logout clears Firebase/MFA sign-in and the query cache, then returns to the
  welcome page. Use Logout on shared computers. Uninstalling intentionally does
  not delete local app data or backups.
