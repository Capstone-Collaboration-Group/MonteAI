# MonteAI

RAG-based research/thesis assistant for Colegio de Montalban. pnpm monorepo with three frontends + a separate ASP.NET Core 8 API (`server/` is **not** part of the pnpm workspace).

## Layout

- `apps/web` — React 19 + Vite 8 + Tailwind v4 (public portal, chat)
- `apps/mobile` — Expo SDK 54, expo-router file routing under `apps/mobile/app`
- `apps/desktop` — Electron 41 + Forge + Vite (admin panel; runs the local PDF/RAG pipeline in the main process)
- `packages/*` — shared `@monteai/{api,hooks,types,ui,utils}`, consumed via `workspace:*`. UI/types/hooks/utils export raw `src/index.ts` (no build step).
- `server/` — .NET 8 Web API (Azure SQL, Pinecone, Azure OpenAI, Firebase). Repos/services in `server/Repositories` and `server/Services` are auto-registered by Scrutor as matching interfaces with scoped lifetime — new classes go in those namespaces, don't hand-register.

## Commands (from repo root)

- `pnpm dev:web` / `pnpm dev:mobile` / `pnpm dev:desktop`
- `pnpm dev:android` / `pnpm dev:devclient` — Expo dev-client builds (require a prebuilt native client, not Expo Go)
- `pnpm build:web`, `pnpm build:desktop` (`make` = installer)
- `pnpm lint` — root flat ESLint + desktop (ESLint 8, `ESLINT_USE_FLAT_CONFIG=false`) + mobile (`expo lint`). Root `eslint.config.js` deliberately ignores `apps/desktop/**` and `apps/mobile/**`; each has its own config.
- **No tests and no CI exist.** All `test` scripts are `echo` stubs and `.github/workflows/` is empty. Verify TS via the app's `build`/`tsc -b` and `pnpm lint`.
- Scoped commands use `pnpm --filter <name> <script>` (filter names are `web`, `mobile`, `desktop`, `@monteai/*`).
- Husky hooks: `pre-commit` runs `pnpm typecheck`; `pre-push` runs `pnpm lint`.

## Server

- Run with `dotnet run` from `server/` (https profile → `https://localhost:7085`, Swagger at `/swagger`).
- Requires gitignored files that are absent on fresh clones: `server/appsettings.Development.json` (all API keys/connection strings) and `server/monteai-firebase-credential.json`. `Program.cs` throws `InvalidOperationException` if the Pinecone key is missing.
- All frontends target `https://localhost:7085/api/v1` via `VITE_API_BASE_URL`.
- Auth: default `[Authorize]` policy requires a Firebase token with a `Role` claim. Add CORS origins by editing the hardcoded `MonteSkolarPolicy` list in `Program.cs`.
- In dev the https profile binds both `:7084` (HTTP) and `:7085` (HTTPS); HTTPS redirect is skipped so LAN devices (Expo dev builds) can hit plain HTTP.
- Schema changes: `dotnet ef migrations add <Name>`; snapshots live in `server/Migrations`.
- `docs/PROJECT_ARCHITECTURE.md` describes an older ONNX-on-desktop pipeline and is partly stale — trust the code over it.

## RAG pipeline

- Desktop main process extracts PDF text, isolates the abstract, and chunks it: `apps/desktop/src/pipeline/*` driven by the IPC handler `thesis:approve` in `apps/desktop/src/handlers/approveThesis.ts`.
- Chunks are POSTed to `/thesis/ingest`; the **server** embeds them (Azure OpenAI `text-embedding-3-small`) and upserts to Pinecone. Chat uses Azure OpenAI `Phi-4-mini-instruct` (`Program.cs`). Embedding is NOT done on the desktop anymore.

## Frontend gotchas

- Each app has its own gitignored `.env.local`. `VITE_USE_MOCK=true` swaps in mock services (see `VITE_USE_MOCK` checks in `packages/api/src/*` and each app's `lib/`); keep new services on this live/mock toggle pattern.
- Desktop disables TLS verification in dev (`httpsAgent: { rejectUnauthorized: false }` in `handlers/approveThesis.ts`); browser clients hitting the self-signed dev cert may need manual trust.
- Version mix is intentional: desktop pins TS ~4.5 + ESLint 8; web uses TS ~7, mobile TS ~5.9. Don't "modernize" desktop tooling casually.
- `pdfjs-dist` is pinned repo-wide via the root pnpm `overrides` (4.4.168) — do not bump without checking the desktop/web PDF viewers.
- `.npmrc` / `pnpm-workspace.yaml` set `nodeLinker: hoisted` + `shamefully-hoist=true` (required for Expo/Electron native deps) — do not change.

## Git

- Shared branch is `dev`; feature work happens on `feat/*` branches. PR titles must be prefixed `feat:` / `fix:` / `chore:` / `docs:` (see `.github/pull_request_template.md`).
- All credentials live only in gitignored local files (`.env.local`, `appsettings.Development.json`, `monteai-firebase-credential.json`) — never commit them.
