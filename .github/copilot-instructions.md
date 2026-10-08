# MonteAI repository guide

MonteAI is a RAG-based research and thesis assistant for Colegio de Montalban. The root is a pnpm workspace for the frontends and shared TypeScript packages; `server/` is a separate ASP.NET Core 8 API and is not included in that workspace.

## Build, lint, and test

Run these commands from the repository root unless noted:

| Purpose | Command |
| --- | --- |
| Start web / mobile / desktop | `pnpm dev:web` / `pnpm dev:mobile` / `pnpm dev:desktop` |
| Start mobile with a native development client | `pnpm dev:android` or `pnpm dev:devclient` |
| Build web | `pnpm build:web` |
| Package desktop installers | `pnpm build:desktop` |
| Type-check all workspace packages and apps | `pnpm typecheck:all` |
| Type-check all workspace projects recursively | `pnpm typecheck` |
| Lint root-managed code, desktop, and mobile | `pnpm lint` |
| Lint one desktop/mobile app | `pnpm --filter desktop lint` / `pnpm --filter mobile lint` |
| Lint one web file | `pnpm exec eslint apps/web/src/path/to/file.tsx` |
| Type-check one workspace project | `pnpm --filter <workspace> typecheck` |
| Build the server | `dotnet build server/server.sln` |
| Run the server | `dotnet run --project server/server.csproj` |

There is currently no test runner or test project, so there is no single-test command. The `test` scripts in the shared packages are placeholders that exit with an error; do not use them as test evidence. The server solution contains only the API project. Verify TypeScript changes with the relevant app/package type-check or build, and use the lint commands above.

The root ESLint flat config covers the web app and shared package source; it deliberately ignores `apps/desktop` and `apps/mobile`, which use their own lint configurations. Desktop lint also explicitly uses legacy ESLint configuration. Keep these separate toolchains intact.

## Architecture

- `apps/web` is the React/Vite public portal and chat UI. `apps/mobile` is the Expo app, with file-based routes under `apps/mobile/app`. `apps/desktop` is the Electron administration app, split between its main process, preload bridge, and renderer.
- `packages/api` contains the shared Axios client and feature service implementations used by the clients. `packages/types` defines shared request/response types; `packages/hooks`, `packages/ui`, and `packages/utils` provide shared hooks, components, and helpers. These packages are consumed through `workspace:*` and export TypeScript source directly; they do not have a separate build step.
- `server/` owns the versioned REST API, persistence, authentication, and AI/RAG services. EF Core uses Azure SQL; Firebase provides identity and related cloud services; Pinecone stores thesis vectors; Azure OpenAI provides embeddings and chat completions.
- Thesis ingestion crosses process boundaries: desktop main-process code downloads the approved PDF, extracts text, isolates the abstract and metadata, and chunks the text. Its `thesis:approve` IPC handler posts those chunks to `/thesis/ingest`. The server generates embeddings, updates Pinecone and SQL indexing state, and uses permanent blob URLs in vector metadata. Do not move embedding work back to the desktop.
- Chat retrieval and generation run on the server using Pinecone and Azure OpenAI. Keep API request/response changes consistent across controllers/services, `packages/types`, and the relevant client service/UI.

## Repository conventions and constraints

- Keep frontend API calls in the shared API package where a service already exists; expose shared DTOs through `packages/types`. Follow the existing live/mock service split: `VITE_USE_MOCK=true` selects mock behavior, and chat also has `VITE_USE_MOCK_CHAT`. Each app has its own ignored `.env.local`.
- Desktop renderer code must use the preload/IPC bridge for privileged main-process work. Preserve Electron's `contextIsolation: true` and `nodeIntegration: false`; PDF download, extraction, and ingestion orchestration belong in the main process.
- Server repositories and services are discovered by Scrutor using matching interfaces and scoped lifetimes. Put new implementations in `server/Repositories` or `server/Services` with the corresponding interface; avoid duplicate manual registration. Server endpoints are protected by the fallback Firebase authentication policy unless explicitly allowed anonymously or given another policy. Authenticated tokens need a `Role` claim.
- Server development configuration and Firebase credentials are local secrets. Never add credentials to source control. The API expects local configuration for its cloud dependencies; Pinecone configuration is required at startup.
- Frontend API clients use `https://localhost:7085/api/v1` by default. For new browser origins, update the `MonteSkolarPolicy` origins in `server/Program.cs`. In development the API also listens on HTTP port `5084` for LAN devices; HTTPS redirect is skipped in development.
- Preserve the intentional toolchain versions: web uses React 19/Vite 8/Tailwind 4; mobile uses Expo SDK 54; desktop uses Electron Forge and older TypeScript/ESLint versions. The root `pdfjs-dist` override is pinned to `4.4.168` for the PDF viewers. Do not change the pnpm hoisted linker settings, which are required by the native Expo/Electron dependencies.
- Treat `docs/PROJECT_ARCHITECTURE.md` as partly stale: it describes an older ONNX-on-desktop RAG pipeline. Confirm current behavior in the source, especially the desktop pipeline and server AI services. `AGENTS.md` is the repository-wide source of additional working guidance.
- Feature branches use `feat/*`; PR titles use `feat:`, `fix:`, `chore:`, or `docs:` prefixes as documented in `.github/pull_request_template.md`.
