# Headless QA Report

**Run date:** 2026-10-08  
**Scope:** `apps/web` and `apps/desktop`  
**Approach:** Read-only headless browser smoke checks against the running development apps and API. No thesis, announcement, schedule, or account data was submitted, changed, or deleted; no chat prompt was sent.

## Environment and coverage

- Started the web app with `pnpm dev:web` at `http://localhost:5173/`.
- Started the desktop app with `pnpm dev:desktop`. Electron Forge built the main/preload targets; its Vite renderer was reachable at `http://localhost:5174/` because the web app was using port 5173.
- Confirmed the running API Swagger UI responds with HTTP 200 after redirect: `curl.exe -k -L -sS -o NUL -w "HTTP %{http_code}" https://localhost:7085/swagger`.
- Both frontend `.env.local` files had `VITE_USE_MOCK=false`. Existing browser auth state made protected read-only pages available; no credentials were entered or recorded.
- Web pages exercised: landing/login, home, thesis catalog, announcements, and chat shell. Desktop pages exercised: dashboard, thesis catalog, login, and About route.
- The Electron shell was started, but renderer checks used its Vite renderer URL in the headless browser. OS integration and preload/IPC workflows were not validated.

## Findings

| Priority | Finding | Evidence and impact | Resolution |
| --- | --- | --- | --- |
| P1 | **Login submit was clipped at a normal-height viewport.** | At 1128×749, the shared auth modal displayed only the upper part of the form and the Login button was outside the viewport. | **Implemented:** the modal now has a viewport-constrained, internally scrollable surface. |
| P1 | **Desktop dashboard showed hard-coded sample figures as current totals.** | The previous dashboard rendered fixed metrics, activity entries, and submission rows rather than API data. | **Implemented:** dashboard metrics and recent records now derive from the thesis API response, and labels explicitly state the figures are limited to returned records. |
| P2 | **Desktop About navigation led to a 404.** | The sidebar linked to `/about`, but the route was missing. | **Implemented:** added the desktop About page and route. |
| P2 | **Shared fonts and ligature icons failed in the desktop development renderer.** | Font URLs were not being resolved to real font assets; Material Symbols displayed their ligature text. | **Implemented:** corrected local font asset URLs, removed the unused external Material Symbols font dependency, and replaced dashboard ligatures with Lucide icons. |
| P2 | **An empty thesis catalog had no empty state.** | An empty list returned the skeleton indefinitely; load failures were not distinguished from empty results. | **Implemented:** the catalog now renders an empty state after a successful empty response and a retryable error state when loading fails. |
| P3 | **Thesis dates wrapped awkwardly in the catalog table.** | At the tested viewport, dates wrapped across short lines in the narrow date column. | **Implemented:** dates are kept on one line; narrow layouts can scroll the table horizontally. |

## Implementation and validation

- `pnpm build:web` — passed; Vite emitted the four local font files into `apps/web/dist/assets/`.
- `pnpm --filter desktop exec electron-forge package` — passed; production renderer and Electron package built successfully.
- `pnpm --filter desktop typecheck` — passed.
- `pnpm --filter @monteai/ui typecheck` — passed.
- `pnpm --filter desktop lint` — passed after removing the unused sidebar import.
- The desktop dashboard smoke check now displayed live API counts and thesis records, Lucide icons, and no fabricated student/activity figures.
