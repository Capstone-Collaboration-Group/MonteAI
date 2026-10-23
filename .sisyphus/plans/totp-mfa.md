# TOTP MFA (Authenticator App) — Implementation Plan

## Context (from codebase study)

- Server verifies **raw Firebase ID tokens** per request (`FirebaseAuthMiddleware`). There is **no backend session token today** — `/auth/login` is an unused stub. Clients attach `Authorization: Bearer <Firebase ID token>` via per-app interceptors.
- `User` is an abstract EF base mapped **TPC-style** to 4 tables: `Students`, `Faculty`, `ProgramHeads`, `Admins` (`server/Data/AppDbContext.cs`). Properties on `User` land in all 4 tables.
- `RoleAuthorizationMiddleware` resolves role by querying all 4 tables per request and appends the `Role` claim (fallback auth policy requires it).
- `packages/api` has `createApiClient` (401-refresh path) used fully only by mobile; web/desktop use hand-rolled axios interceptors with `getIdToken()`.
- `packages/api/auth/tokenStorage.ts` — in-memory only; `packages/types/auth.ts` has legacy unused `LoginResponseDto`/`AuthTokens`.
- Shared `LoginForm` (`packages/ui`) does Firebase email/password sign-in directly; web + desktop use it. Mobile has its own flow in `AuthSessionContext` + `lib/authService.ts`.
- No test project exists anywhere in the repo.
- Rate limiter infrastructure exists in `Program.cs` (`AddRateLimiter`, `RejectionStatusCode = 429`).

## Decisions (confirmed with user)

1. **Session token model**: backend-issued **access JWT (~60 min) + stateless refresh JWT (~30 days)** for MFA users only. Non-MFA users keep raw Firebase ID tokens — unchanged.
2. **Token persistence**: persistent per platform — `localStorage` (web, desktop) / `AsyncStorage` (mobile) behind a new `TokenStorage` implementation. Same `TokenStorage` interface.
3. Schema stays exactly the 4 requested fields (on the abstract `User` base → all 4 role tables). `RecoveryCodeHashes` stored as a JSON-string column via an EF value converter (no new table).
4. New dependencies: `Otp.NET` (backend, as specified), `qrcode.react` (web + desktop), `react-native-qrcode-svg` (mobile), plus a test stack (`xunit`, `Microsoft.AspNetCore.Mvc.Testing`, `Microsoft.EntityFrameworkCore.InMemory` / Sqlite, `Moq`) — repo has zero tests today.

## Architecture

```
Firebase sign-in (unchanged, client-side)
        │
        ▼
POST /auth/mfa/status            (authenticated — Firebase token OK)
        │
   TotpEnabled? ──no──► proceed with Firebase token (current behavior, zero change)
        │ yes
        ▼
{ mfaRequired: true, pendingToken }   ← pending JWT, 5 min, claim typ=mfa_pending
        │
POST /auth/mfa/verify            (anonymous; pendingToken in BODY + TOTP code or recovery code)
        │ success
        ▼
{ accessToken, refreshToken, expiresAt, user }   ← session JWT pair
        │
Client stores tokens in TokenStorage; apiClient sends session JWT
        │
FirebaseAuthMiddleware: Bearer token validated as OUR JWT when it carries
typ=access / typ=refresh claims (HMAC via data-protection or JwtBearer signing key);
Firebase path continues to work verbatim for non-MFA users.
Firebase-token requests for a uid with TotpEnabled=true → rejected (403 mfa_required).
```

Key middleware change (`FirebaseAuthMiddleware`): after reading the Bearer token, check the unvalidated JWT header/claims — if it's one of ours (`iss=MonteAI`, `typ` claim present), validate with our signing key and build the principal from JWT claims (uid, role, email); otherwise run the existing Firebase `VerifyIdTokenAsync` path. If Firebase path succeeds, resolve the user and **reject when `TotpEnabled`** (this is requirement 8; the role middleware already queries these tables, so reuse that lookup to avoid doubling DB cost — see plan for `RoleAuthorizationMiddleware` adjustment below).

`pendingToken` is `typ=mfa_pending`; every endpoint except `mfa/verify` rejects it (middleware checks `typ` claim: `mfa_pending` → fail auth).

## Backend files

| File | Change |
|---|---|
| `server/Models/Entities/User.cs` | Add `TotpEnabled` (bool, default false), `TotpSecretEncrypted` (string?, max 512), `TotpLastUsedStep` (long, default 0), `RecoveryCodeHashes` (string? backing JSON — expose as `List<string>` via EF value converter in AppDbContext) |
| `server/Data/AppDbContext.cs` | Value converter for `RecoveryCodeHashes` (JSON string), column max lengths |
| `server/Migrations/*_AddUserTotp.cs` | Generated migration (columns on all 4 role tables) |
| `server/Services/Auth/TotpService.cs` + `server/Services/Interfaces/ITotpService.cs` | Scrutor-auto-registered (namespace `server.Services.*`). Responsibilities: generate 160-bit secret + Base32; build `otpauth://` URI; encrypt/decrypt via `IDataProtectionProvider.CreateProtector("MonteAI.TotpSecret.v1")`; verify with ±1 step window + replay check vs `TotpLastUsedStep`; generate 8 recovery codes (format `XXXXX-XXXXX`, uppercase), SHA-256 hash storage helpers |
| `server/Services/Auth/SessionTokenService.cs` + interface | Issue/validate pending + access + refresh JWTs (symmetric key from config `Auth:JwtSigningKey`, `Microsoft.IdentityModel.JsonWebTokens` — already transitively available via the referenced JwtBearer package). Claims: `uid`, `role`, `email`, `typ`, standard `iss/aud/exp`. Refresh = stateless rotation (new pair on `POST /auth/refresh`; old refresh not stored/revocable) |
| `server/Controllers/MfaController.cs` | `[Route("api/v1/auth/mfa")]` — `POST /status`, `POST /enroll`, `POST /enroll/confirm`, `POST /verify` (anonymous, `[AllowAnonymous]`, rate-limited), `POST /disable`, `POST /recovery-codes/regenerate`. Plus `AuthController` additions: `POST /auth/refresh` (anonymous, takes refresh token) |
| `server/Middleware/FirebaseAuthMiddleware.cs` | Dual-path validation (our JWT vs Firebase); reject `typ=mfa_pending` everywhere except verify; on Firebase success + `TotpEnabled=true` → 403 `{ code: "mfa_required" }` |
| `server/Middleware/RoleAuthorizationMiddleware.cs` | Skip 4-table role lookup when the principal already carries a `Role` claim (session-JWT path embeds role at issuance); on the Firebase path, the existing lookup returns the entity — use it to also enforce the TotpEnabled rejection (avoid extra queries) |
| `server/Program.cs` | Register `IDataProtection` (default is fine in dev; document persistence for prod), JWT signing key config section, rate-limit policy `MfaVerifyLimit` (5 per 5 min, partitioned by pending-token uid ?? IP, reuse existing `AddRateLimiter` + 429 status), Swagger already documents Bearer |
| `server/appsettings.json` | Non-secret defaults only (`Auth:TokenLifetimeMinutes=60`, `Auth:RefreshTokenLifetimeDays=30`); signing key via user-secrets/env in dev |
| `server/server.csproj` | Add `Otp.NET` |

**Enrollment flows** (all `[Authorize]`, Firebase token OK while `TotpEnabled=false`; once enabled, session JWT OK):
- `POST /enroll` → reject if `TotpEnabled`; generate + encrypt secret, store (`TotpEnabled` stays false), return `{ secret, otpauthUri }`.
- `POST /enroll/confirm { code }` → verify against pending secret; set `TotpEnabled=true`, `TotpLastUsedStep=step`; generate 8 recovery codes, store SHA-256 hashes; return plaintext codes once.
- `POST /disable { code }` → valid TOTP code required; clear all 4 fields.
- `POST /recovery-codes/regenerate { code }` → valid TOTP required; replace hashes; return new plaintext codes once.
- `POST /status` → `{ totpEnabled }` (drives settings screen state).

**Verify flow**: validate pending token (signature + 5-min exp + `typ=mfa_pending`), rate-limit partition by uid from token. Code → try TOTP (decrypt secret, ±1 window, replay check → update `TotpLastUsedStep`), else try recovery code (constant-time compare against hashes, remove on success). Issue access+refresh JWTs, load profile for the session DTO. Errors: 401 invalid code (generic message), 429 rate-limited, 401 expired/invalid pending token. **Never log secrets/codes** (only success/failure + uid).

## Shared packages

| File | Change |
|---|---|
| `packages/types/src/auth.ts` | Add: `MfaStatusResponse`, `MfaEnrollResponse`, `MfaEnrollConfirmRequest/Response`, `MfaVerifyRequest`, `MfaVerifyResponse` (= `{ accessToken, refreshToken, expiresAt, user }`), `MfaDisableRequest`, `MfaRegenerateRequest`, `RefreshRequest/Response`, `LoginResult` union (`{ mfaRequired: false }` \| `{ mfaRequired: true, pendingToken }`) |
| `packages/api/src/auth/mfaService.ts` (new) | `createMfaService(client)`: status, enroll, enrollConfirm, verify, disable, regenerate, refresh — same mock-toggle pattern (`useMock` → mock module) |
| `packages/api/src/auth/mockMfaService.ts` (new) | Mock implementations for `VITE_USE_MOCK` |
| `packages/api/src/auth/tokenStorage.ts` | Keep `createInMemoryTokenStorage`; add `createWebTokenStorage()` (localStorage-backed, SSR-safe) — mobile gets `createAsyncTokenStorage()` in `apps/mobile/lib` (can't import AsyncStorage into shared package cleanly) |
| `packages/api/src/auth/index.ts` + `packages/api/index.ts` | Export new service + storage factory |
| `packages/ui/src/components/auth/MfaVerifyForm.tsx` (new) | 6-digit code input + "Use a recovery code" toggle (switches to text input), error/loading states — styled like `LoginForm`; used by web + desktop login AND settings |
| `packages/ui/src/components/auth/MfaRecoveryCodes.tsx` (new) | One-time recovery-codes display with "save these now" warning + copy button |
| `packages/ui/src/components/auth/MfaEnrollForm.tsx` (new) | QR code (`qrcode.react`) + raw secret fallback + confirm-code step (shared web/desktop) |
| `packages/ui/src/components/auth/LoginForm.tsx` | After Firebase sign-in success: call `mfaService.status()` (via new optional prop `mfaService`); if enabled → call a new `requestLoginChallenge` (POST `/auth/mfa/login-challenge` with Firebase token → returns pendingToken; or reuse `status` response shape — **decision: single `POST /auth/mfa/challenge` endpoint** that validates the Firebase token server-side and returns `{ mfaRequired, pendingToken? }` so the client never guesses) → render `MfaVerifyForm`; on verify success: store tokens via `TokenStorage`, then `onSuccess()`. If not enabled: current behavior untouched |
| `packages/hooks` | No change required (`useAuth` continues to mirror Firebase for non-MFA; session state for MFA users lives in TokenStorage — apps read it via their apiClient) |

**Note on `/auth/mfa/challenge`**: rather than modifying the dead `/auth/login` stub, add `POST /auth/mfa/challenge` (anonymous-adjacent: requires valid Firebase Bearer, but must run *before* the TotpEnabled rejection — implement by giving it `[AllowAnonymous]` and verifying the Firebase token manually inside, OR by exempting this route in middleware. **Preferred: `[Authorize]` + middleware exemption list containing only `mfa/challenge` + `mfa/verify`.** Returns `{ mfaRequired: false }` for non-MFA users (client proceeds as today) or `{ mfaRequired: true, pendingToken }`. This keeps "don't change behavior for non-TOTP users" airtight.)

## App wiring

| App | Files | Change |
|---|---|---|
| **web** | `lib/apiClient.ts` (new, or extend `firebaseServices.ts`) | Build client via `createApiClient({ baseURL, getAuthToken, refreshAuthToken, onAuthExpired })` where `getAuthToken` = TokenStorage access token ?? Firebase `getIdToken()`; `refreshAuthToken` = `POST /auth/refresh` with stored refresh token (on 401-retry path); `onAuthExpired` clears storage. **This also fixes web's missing 401-refresh — minimal, contained change.** |
| | `lib/tokenStorage.ts` (new) | `createWebTokenStorage()` singleton |
| | `lib/mfaService.ts` (new) | `createMfaService(apiClient, useMock)` |
| | `lib/authService.ts` | Pass `mfaService` + storage into `LoginForm` usage |
| | `pages/Login.tsx`, `pages/SettingsPage.tsx` | Login: wire MFA props. Settings: add "Two-factor authentication" section (status → enable/QR/confirm/recovery-codes/disable/regenerate) using shared UI components |
| | `package.json` | add `qrcode.react` |
| **desktop** | `renderer/lib/apiClient.ts` | Same `createApiClient` wiring as web (desktop already exports accessors in `authServices.ts` but never used them — now used) |
| | `renderer/lib/tokenStorage.ts`, `mfaService.ts` (new) | Same pattern (`createWebTokenStorage` — Electron renderer localStorage) |
| | `renderer/pages/Login.tsx`, settings page (find existing route; `AppSidebar` links `/settings`) | Same as web |
| | `package.json` | add `qrcode.react` |
| **mobile** | `lib/tokenStorage.ts` (new) | `createAsyncTokenStorage()` (AsyncStorage, key `monteai.auth.tokens`) |
| | `lib/mfaService.ts` (new) | `createMfaService(createApiClient({ baseURL, getAuthToken, refreshAuthToken }), useMock)` — `getAuthToken` prefers stored session token |
| | `lib/authService.ts` | `getAuthToken`/`refreshAuthToken` prefer TokenStorage session token over Firebase token; `refreshAuthToken` falls back to Firebase refresh when no session token |
| | `contexts/AuthSessionContext.tsx` | On `signInWithStudentNumber` success: call `mfaService.challenge()`; if `mfaRequired` → set `mfaPendingToken` state (memory only), expose to `login.tsx` which shows a new MFA step screen; on verify → persist tokens, continue. Also handle mid-session 401→mfa_required (token expired + Firebase token rejected): clear storage, surface re-auth |
| | `app/login.tsx` | MFA code step (6-digit input, recovery-code toggle) after password step when challenge returns pendingToken |
| | `app/settings/security.tsx` | Add MFA section (same enable/confirm/recovery/disable/regenerate UI, RN-styled per file conventions) |
| | `package.json` | add `react-native-qrcode-svg` (+ `react-native-svg` peer if not present) |

## Commit sequence

1. `feat(server): add TOTP fields to User base + EF migration`
2. `feat(server): ITotpService (secret gen, data-protection encryption, TOTP verify with replay guard, recovery codes)`
3. `feat(server): SessionTokenService (pending/access/refresh JWTs) + auth middleware dual-path + TotpEnabled enforcement`
4. `feat(server): MFA endpoints (challenge/status/enroll/confirm/verify/disable/regenerate/refresh) + rate limiting`
5. `test(server): TotpService unit tests + MFA integration tests (new server.Tests xunit project)`
6. `feat(shared): MFA types + mfaService + persistent TokenStorage + MFA UI components + LoginForm integration`
7. `feat(web): session-aware apiClient + MFA login step + MFA settings section`
8. `feat(desktop): session-aware apiClient + MFA login step + MFA settings section`
9. `feat(mobile): AsyncStorage token storage + MFA challenge in auth session + login step + security settings section`

## Tests

**New project** `server/server.Tests/` (xunit + `Microsoft.AspNetCore.Mvc.Testing` + EF Sqlite in-memory or InMemory provider + Moq for `ILogger` etc.). *Dependency justification: no test infra exists; these are the standard minimal set. Sqlite over InMemory so value converters/JSON columns behave close to prod.*

- `TotpServiceTests`: valid code (compute via Otp.NET itself in test), wrong code, replayed code (same step twice → second fails), code outside ±1 window, encrypt/decrypt round trip, recovery code hash verify + consume.
- `MfaFlowTests` (WebApplicationFactory, **requires small Program.cs testability seams**: environment flag to skip real Firebase credential load + injectable token-verification abstraction `IFirebaseTokenVerifier` wrapping `FirebaseAuth.DefaultInstance` — production behavior unchanged):
  - login/challenge with TOTP disabled → `{ mfaRequired: false }`, Firebase token still works on protected endpoint
  - challenge with TOTP enabled → `{ mfaRequired: true, pendingToken }`, no session tokens in response
  - verify with valid TOTP → session tokens; access token works on protected endpoint
  - verify with recovery code → success; same code again → 401
  - pendingToken used as Bearer on protected endpoint → 401
  - raw Firebase Bearer for TOTP-enabled user on protected endpoint → 403 `mfa_required`
  - 6th verify attempt within 5 min → 429

## Assumptions & notes (for final summary)

- `RecoveryCodeHashes` = JSON array in one `nvarchar(max)` column (value converter), not a child table — stays within the 4 fields you specified.
- Recovery codes: 8 codes, `XXXXX-XXXXX` (Crockford-ish Base32, 50 bits each), stored as SHA-256 hashes; returned exactly once at confirm/regenerate.
- Signing key: 256-bit symmetric, from config (`Auth:JwtSigningKey`) — dev uses user-secrets; prod must supply via env/Key Vault. Data-protection keys: dev ephemeral is fine; prod needs persistent key ring (Azure Blob — infra already uses Azure — or filesystem); documented as manual step.
- `Program.cs` gets two testability seams (Firebase verifier interface + test env guard). No behavior change in production.
- Desktop adminService's tokenless `createApiClient` stays broken-as-is (out of scope, per "keep it like that") — but the shared `createApiClient` wiring in the two apiClients we touch is strictly additive.
- Mobile mock mode (`EXPO_PUBLIC_USE_MOCK`): MFA challenge short-circuits to "not required" so mock sessions behave as today.
- Rate limiting is in-memory fixed-window (matches existing `ChatLimit` pattern) — resets on server restart; per-user partition via pending-token uid.
- Swagger: new endpoints appear automatically; manual smoke via Swagger UI.

## Manual steps after implementation

1. `dotnet ef migrations add AddUserTotp --project server` (if migration not generated in-session) and apply.
2. Set `Auth:JwtSigningKey` in user-secrets / env.
3. Prod: persist data-protection keys; document in deployment notes.
4. `pnpm lint` + `pnpm --filter web build` / desktop `tsc` / mobile typecheck; `dotnet test server/server.Tests`.
