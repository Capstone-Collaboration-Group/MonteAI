# MonteAI

RAG-based research/thesis assistant for Colegio de Montalban. pnpm monorepo with three frontends + a separate ASP.NET Core 8 API (`server/` is **not** part of the pnpm workspace).

## Layout

- `apps/web` — React 19 + Vite 8 + Tailwind v4 (public portal, chat)
- `apps/mobile` — Expo SDK 54, expo-router file routing under `apps/mobile/app`
- `apps/desktop` — Electron 41 + Forge + Vite (admin panel; approve/reindex calls `POST /thesis/ingest` directly from the renderer)
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

- **Metadata-only ingestion** (reverted from full-text): ONE vector per thesis (`thesis_{id}_meta`). Desktop approve/reindex is a plain renderer API call — `useIngestThesis` → `POST /thesis/ingest`; there is no PDF pipeline, IPC handler, or staging blob anymore. The **server** resolves authors/year/abstract (Firestore → research group → `SubmittedAt`), embeds (Azure OpenAI `text-embedding-3-small`), and upserts to Pinecone synchronously in `ThesisService.IngestAsync`.
- Chat uses Azure AI Foundry **gpt-5-nano agents** via the Responses API (planner + synthesizer agents routed by `LlmClientPool` over the `AzureAI:Deployments` config — see `server/Services/AI/`). Retrieval queries only the metadata namespace. Embedding is NOT done on the desktop. Prompt changes must pass `dotnet run --project server -- --prompt-check` (`--live-offline` skips the live-agent half; full run needs `az login`).
- One-off migration cleanup after deploying a metadata-only build, in this order: (1) `dotnet run --project server -- --purge-fulltext` (flushes the legacy `full-text-chunks` namespace, deletes `*_chunk_*` vectors from the default namespace, deletes lingering staging blobs — reads `Theses.IngestStagingUrl` via raw SQL, so run it BEFORE the migration; skips the blob step gracefully if the column is already gone), (2) `dotnet ef database update` (applies `RemoveIngestStagingUrl`). The purge is idempotent; theses stuck in `Indexing`/`IngestFailed` are re-approved manually by admins.
- Ops runners (all run INSTEAD of the web host): `--reingest-all` (bulk metadata-only re-ingest of every Approved/Indexed thesis — creates `thesis_{id}_meta` and sweeps legacy `*_chunk_*` leftovers; Pending rows skipped), `--repair-abstracts` (one-off Firestore repair for the dotted-key bug: moves literal `abstracts.<n>` fields into the nested `abstracts` map — run before `--reingest-all` if abstracts show as "(abstract not yet available)"), and `--diagnose-index` (read-only inventory: namespace counts, metadata-field audit incl. the Firestore abstract store, SQL status counts, raw scoreboards for sample queries — the first tool to reach for when chat says "no relevant theses"). If chat returns nothing: run `--diagnose-index` first; a common post-revert state is zero `_meta` vectors (fix with `--reingest-all`) or a `Pinecone:ScoreThreshold` above the raw scores.

## Frontend gotchas

- Each app has its own gitignored `.env.local`. `VITE_USE_MOCK=true` swaps in mock services (see `VITE_USE_MOCK` checks in `packages/api/src/*` and each app's `lib/`); keep new services on this live/mock toggle pattern.
- Desktop approve/reindex now goes through the renderer's axios client like every other API call (the old main-process TLS bypass is gone with the IPC handler); browser/renderer clients hitting the self-signed dev cert may need manual trust.
- Version mix is intentional: desktop pins TS ~4.5 + ESLint 8; web uses TS ~7, mobile TS ~5.9. Don't "modernize" desktop tooling casually.
- `pdfjs-dist` is pinned repo-wide via the root pnpm `overrides` (4.4.168) — do not bump without checking the desktop/web PDF viewers.
- `.npmrc` / `pnpm-workspace.yaml` set `nodeLinker: hoisted` + `shamefully-hoist=true` (required for Expo/Electron native deps) — do not change.

## Git

- Shared branch is `dev`; feature work happens on `feat/*` branches. PR titles must be prefixed `feat:` / `fix:` / `chore:` / `docs:` (see `.github/pull_request_template.md`).
- All credentials live only in gitignored local files (`.env.local`, `appsettings.Development.json`, `monteai-firebase-credential.json`) — never commit them.
