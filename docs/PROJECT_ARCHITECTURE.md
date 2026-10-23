# Research Assistant and Digital Thesis Repository System — Architecture
**Document Version:** 2.0.0 (As-Built)
**Prepared by:** Charles Bernard Balaguer
**Date:** October 10, 2026
**Classification:** Internal — Development Team

> Version 2.0.0 rewrites this document to match the **current implemented system**. The v1.0 plan (ONNX embedding on the desktop, app-JWT auth, Hangfire, Zustand, chat on desktop) is superseded. Where the code and the old plan differ, **the code is authoritative**.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Overview](#2-project-overview)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Module Breakdown](#5-module-breakdown)
6. [AI Pipeline Design](#6-ai-pipeline-design)
7. [Database Design](#7-database-design)
8. [API Design](#8-api-design)
9. [Platform Specifications](#9-platform-specifications)
10. [Security & Access Control](#10-security--access-control)
11. [Implementation Status & Known Gaps](#11-implementation-status--known-gaps)
12. [Appendix](#12-appendix)

---

## 1. Executive Summary

**MonteAI** (product name *MonteSkolar*) is a full-stack, AI-powered research assistant for the Colegio de Montalban / PNM. Students and faculty explore, search, and converse with a curated thesis repository through a RAG-powered agent, while admins manage submissions, users, scheduling, and knowledge-base ingestion from a desktop panel.

The system is distributed across three frontends — **Web** (React + Vite, public portal + chat), **Mobile** (Expo, student companion), and **Desktop** (Electron + Forge, admin/panelist control) — sharing a pnpm monorepo of workspace packages (`@monteai/*`). The backend is a single **ASP.NET Core 8** API that orchestrates Firebase authentication, Azure SQL persistence, Azure Blob file storage, Pinecone vector search, and Azure OpenAI inference.

**Implemented key capabilities:**
- Hybrid RAG ingestion: PDF text extraction, abstract isolation, and chunking run in the Electron main process; the **server embeds chunks** (Azure OpenAI `text-embedding-3-small`) and upserts Pinecone
- Agentic RAG chat: Phi-4-mini planner with `semantic_search` / `keyword_search` / `thesis_metadata` tools, grounded synthesis with numbered citations, SSE streaming (Web)
- Thesis lifecycle: student submission with group gates, version/revision workflow, review decisions, admin approve/reject/revision → indexing
- Defense scheduling with panelist assignments; announcements; research groups with advisers
- Role-based access via Firebase tokens + per-request role claim injection (Student, Faculty, ProgramHead, Admin)
- Response caching (Redis) for GET APIs, rate limiting on chat/proceedings, hybrid SQL + Firestore + Blob + Pinecone persistence

---

## 2. Project Overview

### 2.1 Goals

| Goal | Description |
|------|-------------|
| Research Discovery | Natural-language literature search over indexed thesis abstracts (semantic + keyword) |
| AI-Assisted Research | Conversational agent grounded strictly in repository content with source citations |
| Thesis Management | Students submit/upload/revise; admins and reviewers control status and indexing |
| Defense Scheduling | Admins/program heads create defense schedules and assign panelists |
| Role Enforcement | Distinct permissions for Student, Faculty, ProgramHead, and Admin |
| Cross-Platform Access | Web portal (students/faculty), mobile companion (students), desktop admin panel |

### 2.2 Stakeholders

| Stakeholder | Role | Platform |
|-------------|------|----------|
| Students | Submit theses, browse, search, chat, view schedules | Mobile, Web |
| Faculty | View theses, review, chat, panelist duties | Web, Desktop |
| Program Head | Institute-wide review, announcements, scheduling | Web, Desktop |
| Admin | Users, submissions, ingestion, schedules, panelists, announcements | Desktop |
| Development Team | Build, maintain, deploy | All |

### 2.3 Scope

**In scope (implemented):**
- Multi-platform frontends over a unified ASP.NET Core API
- RAG pipeline: chunk (desktop) → embed + upsert (server) → retrieve → agentic generation
- Firebase authentication with role propagation; role tables in Azure SQL
- Pinecone vector store; Azure SQL relational store; Azure Blob PDFs; Firestore for chat messages, versioned abstracts, and PDF annotations
- Admin desktop tools (thesis moderation + ingestion trigger, faculty/program-head/group management, scheduling, announcements)
- Chat interface on **Web** (streaming) and **Mobile** (blocking); literature search on all three platforms

**Out of scope / not built:**
- Plagiarism detection; third-party journal indexing; real-time document collaboration
- Chat on Desktop (planned earlier; never implemented — see [§11](#11-implementation-status--known-gaps))
- Background job processing (Hangfire was planned; ingestion runs synchronously)
- Tests and CI/CD pipelines (none exist yet)

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER                                │
│  ┌───────────────────┐  ┌────────────────────┐  ┌────────────────────┐  │
│  │  React + Vite     │  │  Expo (React Nat.) │  │ Electron + Forge   │  │
│  │  apps/web         │  │  apps/mobile       │  │ apps/desktop       │  │
│  │  Public + Student │  │  Student companion │  │ Admin/Panelist +   │  │
│  │  portal + Chat    │  │                    │  │ local PDF pipeline │  │
│  └─────────┬─────────┘  └─────────┬──────────┘  └─────────┬──────────┘  │
└────────────┼──────────────────────┼───────────────────────┼─────────────┘
             │   HTTPS / REST + SSE (Firebase ID tokens)    │
┌────────────┼──────────────────────┼───────────────────────┼─────────────┐
│            ▼          BACKEND (ASP.NET Core 8 — server/)  ▼             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Controllers (api/v1/*)                                          │   │
│  │  Auth · User · Chat · Thesis · Proceedings · Announcement        │   │
│  │  Faculty · Student · ProgramHead · Admin · ResearchGroup         │   │
│  │  Review · Schedule · PanelistSchedule · Submission · Abstracs    │   │
│  └───────┬──────────────┬───────────────────┬───────────────┬───────┘   │
│  ┌───────▼──────┐ ┌─────▼──────────────┐ ┌──▼────────────┐ ┌▼─────────┐ │
│  │ FirebaseAuth │ │ RAG / Agent        │ │ Thesis Service │ │ Blob     │ │
│  │ Middleware +  │ │ MonteAiAgentService│ │ Submission/    │ │ Service  │ │
│  │ Role Inject  │ │ PineconeService    │ │ Review/Schedule│ │ (Azure)  │ │
│  └───────┬──────┘ └─────┬──────────────┘ └──┬────────────┘ └┬─────────┘ │
│          │              │                    │               │           │
│   Middleware: RoleAuthorization · HttpGetCache (Redis) · RateLimiter     │
└──────────┼──────────────┼────────────────────┼───────────────┼───────────┘
┌──────────▼──────────────▼────────────────────▼───────────────▼───────────┐
│                              DATA LAYER                                  │
│  Firebase Auth   Azure SQL (EF Core)   Firestore   Pinecone   Azure Blob│
│  (ID tokens)     (users/theses/etc.)   (chat msgs, (vectors)  (PDFs,    │
│                                        abstracts,             SAS URLs) │
│                                        annotations)                     │
│  Redis (distributed cache for GET responses)                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Request Pipeline (Program.cs)

```
UseRouting → Serilog request logging → UseHttpsRedirection (non-Dev only)
→ UseCors("MonteSkolarPolicy") → UseAuthentication ("Firebase" scheme)
→ UseRoleAuthorization()  ← injects ClaimTypes.Role from role tables
→ UseAuthorization → UseRateLimiter → HttpGetCacheMiddleware → MapControllers
```

- **Auth scheme:** custom `"Firebase"` (`FirebaseAuthMiddleware`) verifies the Firebase ID token on every request (`checkRevoked: true`). There is **no app-level JWT** — clients send `Authorization: Bearer <Firebase ID token>` directly.
- **Policies:** FallbackPolicy requires an authenticated user **with a Role claim** (effectively every endpoint). Named policies: `Reviewer` (Faculty/Admin/ProgramHead), `Proceedings` (all roles), `FirebaseAuthenticated`.
- **GET cache:** per-user SHA-256 cache keys over Redis; invalidates on mutations except chat/proceedings; emits `X-MonteAI-Cache: HIT|MISS`.
- **Rate limits (FixedWindow):** Health 5/min, Chat 30/min, Proceedings 10/min (per user).

---

## 4. Technology Stack

### 4.1 Backend (`server/`)

| Component | Technology | Purpose |
|-----------|------------|---------|
| Web API | ASP.NET Core 8 (.NET 8) | REST API, business logic, orchestration |
| Authentication | Firebase Admin SDK | ID-token verification; role claims injected per request |
| ORM | Entity Framework Core 8 | Azure SQL access (10 migrations; `EnableRetryOnFailure`) |
| Vector store client | Pinecone .NET SDK | Abstract-chunk upsert + similarity query |
| Embeddings | Azure OpenAI `text-embedding-3-small` | Server-side embedding of chunks and queries |
| Chat LLM | Azure OpenAI `Phi-4-mini-instruct` | Agent planner + grounded answer synthesis |
| PDF generation | PdfSharpCore | Proceedings documents |
| File storage | Azure Blob Storage SDK | PDF storage + short-lived SAS download URLs |
| Document data | Google Firestore | Chat messages, versioned abstracts, PDF annotations |
| Caching | StackExchange Redis (dev: in-memory) | Distributed GET-response cache |
| Logging | Serilog (console + rolling file `logs/`) | Structured logging |
| API docs | Swashbuckle / Swagger | Dev-only Swagger UI at `/swagger` |
| DI | Scrutor | Auto-registers `Repositories`/`Services` as matching interfaces (scoped); `IBlobService` singleton |

**Not used:** Hangfire, ONNX, App Insights, Key Vault (secrets live in gitignored `appsettings.Development.json`).

### 4.2 Frontend

| Platform | Technology | Target users |
|----------|------------|--------------|
| Web (`apps/web`) | React 19, Vite 8, TypeScript 7, Tailwind v4, react-router 7 | Students / Faculty (public landing + portal + chat) |
| Mobile (`apps/mobile`) | Expo SDK 54, expo-router 6, React Native 0.81, TypeScript 5.9 | Students (companion app) |
| Desktop (`apps/desktop`) | Electron 41, Electron Forge 7, Vite 5, TypeScript 4.5, Tailwind v4 | Admins / Program Heads / Faculty panelists |

### 4.3 Shared Packages (`packages/*`)

| Package | Contents |
|---------|----------|
| `@monteai/types` | DTOs (`CreateX/UpdateX/XResponseDto`), role guards, theme tokens |
| `@monteai/utils` | `cn`, `handle404`, `getApiErrorMessage`, date/name helpers, email domain rules (`@pnm.edu.ph` / `@student.pnm.edu.ph`) |
| `@monteai/api` | `createApiClient` (Bearer interceptor + 401 refresh/retry) and per-domain factories `createXService(client, useMock)` — mock/live toggle |
| `@monteai/hooks` | `AuthProvider`/`useAuth`, `useUserProfile`, TanStack Query hooks per domain (`useTheses`, `useChatSessions`, …) |
| `@monteai/ui` | Design system + pre-wired pages (`ThesisCatalogPage`, `ChatPage`, `SchedulePage`, `FacultyPage`, …) taking services as props |

Layering: `types → utils → api → hooks → ui`. Packages export raw `src/index.ts` (no build step). Mobile consumes only `api` + `types`.

### 4.4 Databases & Stores

| Store | Technology | Data stored |
|-------|------------|-------------|
| Relational | Azure SQL (EF Core) | Role tables, ResearchGroups, Theses, ThesisVersions, Submissions, Reviews, Schedules, PanelistSchedules, ChatSessions, Announcements |
| Document | Firebase Firestore | Chat messages (`chat_sessions/{id}/messages`), versioned abstracts (`thesis_abstracts/{thesisId}`), PDF annotations (`theses/{id}/versions/{vid}/annotations`) |
| Vector | Pinecone (serverless, cosine) | Abstract chunk embeddings + metadata |
| Files | Azure Blob Storage | Raw PDF files (blob path stored; SAS URLs generated on demand) |
| Cache | Redis (dev: memory) | GET response cache |
| Auth | Firebase Authentication | Identity, tokens, refresh-token revocation |

### 4.5 DevOps (current)

| Component | Status |
|-----------|--------|
| Cloud | Microsoft Azure (SQL, Blob, OpenAI) + GCP Firestore + Pinecone |
| API hosting | `dotnet run` / Dockerfile present; no deployed CI/CD yet |
| CI/CD | None (`.github/workflows/` empty) |
| Secrets | Gitignored `server/appsettings.Development.json` + Firebase credential JSON |
| Tooling | pnpm workspaces, Husky (`pre-commit` typecheck, `pre-push` lint) |

---

## 5. Module Breakdown

### 5.1 Backend (`server/`)

```
server/
├── Program.cs                     ← host wiring: Azure AI, Pinecone, Firebase,
│                                    Redis, EF, rate limits, CORS, Scrutor, cache
├── Configuration/
│   ├── PineconeConfig.cs          ← index name, TopK, thresholds, batch caps
│   ├── MonteAiAgentConfig.cs      ← agent iterations, temps, token caps
│   └── HttpGetCacheOptions.cs     ← TTL, size cap, excluded prefixes
├── Controllers/                   ← see §8 for routes/endpoints
│   Auth · User · Chat · Thesis · Abstracs · Proceedings · Announcement
│   Faculty · Student · ProgramHead · Admin · ResearchGroup · Review
│   Schedule · PanelistSchedule · Submission   (+ empty SearchController.cs)
├── Data/
│   ├── AppDbContext.cs            ← DbSets for all SQL entities
│   └── Migrations/                ← 10 EF migrations (2026-06-20 → 2026-09-07)
├── Mappings/MappingProfile.cs     ← AutoMapper (thesis authors from group members)
├── Middleware/
│   ├── FirebaseAuthMiddleware.cs  ← "Firebase" auth scheme, verifies ID tokens
│   ├── RoleAuthorizationMiddleware.cs ← probes role tables, injects Role claim
│   └── HttpGetCacheMiddleware.cs  ← Redis GET cache + generation invalidation
├── Models/
│   ├── Entities/                  ← User (abstract) + Student/Faculty/ProgramHead/Admin,
│   │                                 Thesis, ThesisVersion, ResearchGroup, Submission,
│   │                                 Review, Schedule, PanelistSchedule, ChatSession,
│   │                                 ChatMessage (Firestore), Announcement
│   ├── DTOs/                      ← per-domain Create/Update/Response + ChatSourceDto,
│   │                                 ThesisChunkDto, IngestThesisDto(s)
│   ├── Agent/AgentModels.cs       ← AgentChatRequest/Result, stream events
│   └── Retrieval/                 ← Chunk record, RetrievalOptions
├── Services/
│   ├── AI/
│   │   ├── PineconeService.cs     ← embed+query+delete; year-filter workaround
│   │   └── MonteAiAgentService.cs ← planner loop, synthesis, SSE streaming, grounding
│   ├── AI/Agent/                  ← AgentToolbox (3 tools), AgentPrompts, AgentJson
│   ├── Theses/                    ← ThesisService (submit/search/ingest/versions),
│   │                                 ThesisAbstractService (Firestore abstracts),
│   │                                 AbstractChunker, BlobService, ProceedingsService,
│   │                                 AnnotationReader, ReviewService, SubmissionService
│   ├── Chat/                      ← ChatSessionService (SQL), ChatMessageService (Firestore)
│   ├── Schedules/                 ← ScheduleService, PanelistScheduleService
│   └── User/                      ← Student/Faculty/Admin/ProgramHead/ResearchGroup services
└── Repositories/                  ← EF repositories per domain (Interfaces/ subfolder;
                                     Scrutor auto-registers as scoped)
```

**Notable:** `SearchController.cs`, `Services/Auth/FirebaseAuthService.cs`, `Services/User/RoleService.cs`, and `Services/User/UserService.cs` are empty placeholder files. Search lives in `ThesisController` and the agent tools instead.

### 5.2 Web (`apps/web`)

```
src/
├── main.tsx · App.tsx             ← router (BrowserRouter); pdf.js worker bundled
├── pages/                         ← LandingPage, Home, Chat, About, Login, Register,
│                                    SubmitThesis, Schedule, ThesesPage, ThesisViewer,
│                                    Announcements, ResearchGroups, SettingsPage
├── components/                    ← landing pieces, ThesisSubmissionModal flow,
│                                    layouts/AppLayout.tsx (sidebar + chat sessions)
├── sections/                      ← About page sections
├── lib/                           ← Firebase init, per-domain service facades
│   └── chat/                      ← chatService facade (stale liveChatService remains)
└── services/api.tsx               ← dead stub
```

Most authenticated screens are thin wrappers around `@monteai/ui` pages with services injected. Protected routes render inside `AppLayout`.

### 5.3 Mobile (`apps/mobile`)

```
app/
├── _layout.tsx                    ← root: AuthSessionProvider → AppShell
├── auth-entry.tsx · login.tsx · sign-up.tsx · modal.tsx
├── (tabs)/                        ← custom tab bar: home, library, chat, announcements,
│                                    profile (+ hidden routes: schedules, research-group)
├── settings/                      ← index, profile, appearance, notifications,
│                                    security, change-password, help, about
└── thesis/                        ← [id].tsx (detail + PDF viewer), submit-thesis.tsx

components/ · lib/ (service facades + firebase + authService + chatService)
contexts/AuthSessionContext.tsx · hooks/ · constants/
```

No TanStack Query or `@monteai/ui` — screens use local state and RN components. Services built with `createApiClient` (token + refresh).

### 5.4 Desktop (`apps/desktop`)

```
src/
├── main.ts                        ← window; contextIsolation on, nodeIntegration off;
│                                    registers thesis:approve IPC handler
├── preload.ts → preload/thesis.ts ← contextBridge: window.thesisApi.approveThesis
├── pipeline/                      ← pdfDownloader, pdfExtractor (pdfjs legacy build),
│                                    abstractIsolator, chunker (512 words / 50 overlap)
├── handlers/approveThesis.ts      ← IPC: SAS download → extract → isolate → chunk
│                                    → POST /thesis/ingest (server embeds + upserts)
├── renderer.tsx · App.tsx         ← HashRouter; ProtectedRoute gate
├── renderer/pages/                ← Login, Register, Dashboard, Theses, Faculty,
│                                    ResearchGroups, Panelist, Schedule, Announcements,
│                                    Settings, About, ThesisViewer (+ BackupPage from UI)
├── renderer/components/           ← AppSidebar, etc.
├── renderer/lib/                  ← apiClient, Firebase init, per-domain facades
└── hooks/                         ← useApproveThesis, useRejectThesis, useRequestRevision
```

No chat route. Forge packaging hardens fuses (`RunAsNode=false`, `OnlyLoadAppFromAsar=true`, etc.).

---

## 6. AI Pipeline Design

### 6.1 Ingestion Pipeline (as built)

Ingestion is **split** between the desktop (local text work) and the server (embedding + persistence). Embedding never runs on the client.

```
Student: POST /thesis/submit (PDF → Azure Blob; Status=Pending)
                │
Admin (Desktop): clicks Approve on a thesis
                │  IPC 'thesis:approve' (src/handlers/approveThesis.ts)
                ▼
┌─────────────────────────────┐
│ 1. GET /thesis/{id}/download-url  → short-lived SAS URL      │
│ 2. pdfDownloader → temp PDF in os.tmpdir()                   │
│ 3. pdfExtractor (pdfjs-dist) → text, first 5 pages only      │
│ 4. abstractIsolator → regex Abstract → Intro/Keywords/Ch.1   │
│    + title/author/year heuristics                            │
│ 5. chunker → 512-word chunks, 50-word overlap                │
└─────────────────────────────┘
                │  POST /thesis/ingest { thesisId, chunks[] }
                ▼  (Admin-only; server is authoritative for metadata)
┌─────────────────────────────┐
│ ThesisService.IngestAsync                                    │
│  • load SQL record (title/abstract/group authors)            │
│  • cap chunks (MaxChunksPerIngest = 64)                      │
│  • PineconeService.UpsertAbstractsAsync:                     │
│      - batch embed (16/call) text-embedding-3-small,         │
│        embedding text = title/authors/year header + abstract │
│      - vector id: thesis_{id}_chunk_{i}                      │
│      - metadata: thesis_id, title, authors, abstract,        │
│        publication_year, journal, url (permanent blob path)  │
│      - delete-then-upsert for idempotence (≤100/request)     │
│  • Status = "Indexed", PineconeStatus/IndexedAt updated      │
└─────────────────────────────┘
```

Admin archival uploads (`POST /thesis/submit` as Admin) auto-chunk server-side via `AbstractChunker` and ingest immediately with rollback on failure.

### 6.2 Agent Query Pipeline (Chat)

Triggered by `POST /api/v1/Chat/sessions/{id}/messages` (blocking) or `.../messages/stream` (SSE). Implemented by `MonteAiAgentService` with Phi-4-mini-instruct.

```
User message
   │  sanitize (cap 2000 chars) → prompt-injection blocklist → canned refusal
   ▼
Planner loop (≤ 3 iterations, temp 0, JSON output)
   │  chooses a tool per turn:
   │   • semantic_search  → embed query (Azure OpenAI) → Pinecone TopK
   │                         (score threshold 0.25; optional year filter)
   │   • keyword_search   → EF LIKE over title/abstract
   │   • thesis_metadata  → full SQL record by id
   │  guaranteed fallback: one semantic_search if no tool ran
   ▼
Source merge (dedupe by thesis, order by score, cap 8)
   ▼
Synthesis (temp 0.2, ≤ 800 tokens): answer from retrieved context only,
   numbered [Source n] citations
   ▼
Grounding pass: strip invalid citations (no-LLM hallucination guard)
   ▼
Persist assistant message to Firestore (with SourcesJson) → respond
SSE events: sources → delta* → done (web client parses frames via axios)
```

Agent knobs live in `MonteAI:Agent` config (enable flag, iterations, temperatures, token caps, history size). Retrieval knobs in `Pinecone` config (TopK default 5, threshold 0.25).

### 6.3 Literature Search

`GET /api/v1/Thesis/search?q=&mode=exact|semantic`
- **exact** — SQL catalog search; **semantic** — Pinecone TopK 50 → distinct thesis ids → hydrated from SQL
- Available on Web, Mobile, and Desktop thesis catalogs

---

## 7. Database Design

### 7.1 Azure SQL (EF Core, as migrated)

Role IDs are Firebase UIDs (`NVARCHAR(128)`, not DB-generated). `User` is an **abstract C# base class** (TPC-style); there is no `Users` table — each role has its own table.

```
Admins(Id pk = Firebase UID, Email, FirstName, MiddleInitial, LastName, Suffix,
       Position, Role, IsActive, CreatedAt, UpdatedAt)

Faculties(Id pk, Email, FirstName, MiddleInitial, LastName, Suffix, Institute,
          Role, IsActive, timestamps)

ProgramHeads(Id pk, Email, …, Institute, ProgramHandled, Role, IsActive, timestamps)

Students(Id pk, StudentNumber unique, GroupId? → ResearchGroups, Email, FirstName,
         MiddleInitial, LastName, Suffix, Position, Institute, Program, YearLevel,
         Section, Role, IsActive, timestamps)

ResearchGroups(Id pk, GroupName, ResearchTitle, AdviserId? → Faculties (SetNull),
               LeaderId → Students (Restrict), CreatedAt, UpdatedAt)
               ↔ Students.GroupId (Cascade)

Theses(Id pk, Title, Abstract  ← Firestore doc GUID (legacy: raw text),
       FilePath (blob path), UploadedById, Status, PineconeStatus, GroupId?,
       SubmittedAt?, ReviewedAt?, ApprovedAt?, RejectedAt?, IndexedAt?, UpdatedAt)
       ↔ Submissions (Cascade)

ThesisVersions(Id pk, ThesisId, VersionNumber, FilePath, UploadedById?,
               UploadedAt, ChangeNote)

Submissions(Id pk, ThesisId, StudentNumber → Students, SubmittedAt, Notes)

Reviews(Id pk, ThesisId, ReviewerId, Decision, Comments, ReviewedAt?)

Schedules(ScheduleId pk, ScheduledBy, GroupId?, Date, StartTime, EndingTime,
          RoomVenue, AdditionalInformation) ↔ PanelistSchedules

PanelistSchedules(composite pk: ScheduleId + PanelistId, PanelistType
                  (faculty|program-head|admin), Role?, CreatedAt)

ChatSessions(Id pk, UserId, Title, CreatedAt, LastChatDate)
  — messages are NOT in SQL (see Firestore)

Announcements(Id pk, Subject, Content, AttachmentUrls (JSON list), Category,
              Priority, CreatedAt?, LastModified?,
              CreatedByAdminId? | CreatedByProgramHeadId?  ← check constraint: exactly one)
```

**Status values** (Thesis.Status): `Pending`, `UnderReview`, `Approved`, `Rejected`, `Revision`, `Indexed` (set after successful ingestion).

### 7.2 Firestore Layout

| Path | Contents |
|------|----------|
| `thesis_abstracts/{thesisId}` | Map field `abstracts` keyed by version number; `authors`, `publicationYear` |
| `chat_sessions/{sessionId}/messages/{messageId}` | `role`, `content`, `timestamp`, `SourcesJson` (serialized citations) |
| `theses/{thesisId}/versions/{versionId}/annotations` | Panelist PDF annotations (read by `AnnotationReader` for proceedings) |

### 7.3 Pinecone Index

| Property | Value |
|----------|-------|
| Index name | `research-assistant-abstracts` |
| Dimensions | 1536 (`text-embedding-3-small`) |
| Metric | Cosine |
| Vector ID | `thesis_{thesisId}_chunk_{chunkIndex}` |
| Metadata | `thesis_id`, `title`, `authors`, `abstract`, `publication_year`, `journal`, `url` |
| Notes | `url` is the permanent blob path (never SAS); year filtering uses a string `$in` list workaround |

---

## 8. API Design

### 8.1 Base URL & Conventions

- Prefix: `api/v1/{Controller}` for all controllers except `AbstracsController` (`api/Abstracs`) and `ProceedingsController` (hardcoded `api/v1/thesis`)
- Auth: `Authorization: Bearer <Firebase ID token>` on every request (no app JWT exchange)
- JSON: case-insensitive property names; string enums
- Only anonymous endpoints: `GET /health` (header-guarded), Swagger (Dev), `POST /api/v1/Auth/resolve-login`

### 8.2 Endpoints (as implemented)

#### Auth — `api/v1/Auth`
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/auth/register` | Self-register Student/Faculty profile (email-domain checks) | FirebaseAuthenticated |
| POST | `/auth/register/admin-or-programhead` | Create Admin/ProgramHead profile | Admin |
| POST | `/auth/login` | No-op (token already verified by middleware) | — |
| POST | `/auth/resolve-login` | Student-number → email resolution (mobile) | Anonymous |
| GET | `/auth/me` | Probe role tables, return profile | Authenticated |

#### User — `api/v1/User`
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/user/me` | Current profile | Authenticated |
| PUT | `/user/me` | Partial profile update (role/email/status stripped) | Authenticated |
| POST | `/user/revoke-sessions` | Firebase refresh-token revocation | Authenticated |

#### Chat — `api/v1/Chat` (ChatLimit: 30/min)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/chat/sessions` | List user's sessions | Owner |
| GET | `/chat/sessions/{id}` | Session + messages (Firestore) | Owner |
| POST | `/chat/sessions/create` | Create session (owner = token uid) | Owner |
| POST | `/chat/sessions/{id}/messages` | Blocking agent response | Owner |
| POST | `/chat/sessions/{id}/messages/stream` | SSE: sources → delta → done | Owner |
| PUT | `/chat/sessions/{id}/update` | Rename/update session | Owner |
| DELETE | `/chat/sessions/{id}/delete` | Delete session | Owner |

#### Thesis — `api/v1/Thesis`
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/thesis` | List theses (first 20) | All authenticated |
| GET | `/thesis/search?q=&mode=` | Exact (SQL) or semantic (Pinecone) search | All authenticated |
| GET | `/thesis/my` | Current student's thesis | Student, Admin |
| GET | `/thesis/{id}` | Thesis detail (abstract resolved from Firestore) | All authenticated |
| POST | `/thesis/submit` | Upload PDF (magic-byte validated), blob storage + rollback | Student, Admin |
| POST | `/thesis/ingest` | Ingest chunks → embed → Pinecone → Indexed | **Admin** |
| PUT | `/thesis/update/details/{id}` | Update details (+ best-effort reindex) | Student, Admin |
| PATCH | `/thesis/update/status/{id}` | Status transitions | Reviewer policy |
| DELETE | `/thesis/delete/{id}` | Delete thesis + vectors + blobs + side data | Admin |
| GET | `/thesis/{id}/download-url` | 15-min SAS URL | All authenticated |
| GET | `/thesis/{id}/versions` · `/versions/latest` · `/versions/single/{versionId}` | Version listing/detail | Authenticated |
| GET | `/thesis/versions/{versionId}/download-url` | Version SAS URL | Authenticated |
| POST | `/thesis/{thesisId}/versions` | Upload revision PDF | Student |
| DELETE | `/thesis/versions/{thesisId}` | Prune all but latest | Authenticated |
| DELETE | `/thesis/{thesisId}/versions/{versionId}` | Delete a version (latest-only) | Student, Admin |

#### Proceedings — `api/v1/thesis` (Proceedings policy + 10/min)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/thesis/{thesisId}/proceedings` | Generate proceedings PDF (PdfSharpCore + Firestore annotations) | Proceedings policy (group members for students) |

#### Abstracts — `api/Abstracs` (debug)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/abstracs/upsert/{thesisId}` | Direct Pinecone upsert bypass | Admin |

#### Announcement — `api/v1/Announcement`
| Method | Endpoint | Access |
|--------|----------|--------|
| GET `/announcement`, GET `/announcement/{id}` | All authenticated |
| POST `/announcement/create`, PATCH `/announcement/update/{id}`, DELETE `/announcement/delete/{id}` | Admin, ProgramHead |

#### Faculty — `api/v1/Faculty`
| Method | Endpoint | Access |
|--------|----------|--------|
| GET `/faculty`, GET `/faculty/{id}`, PATCH `/faculty/update/{id}` | Admin, Faculty, ProgramHead |
| DELETE `/faculty/delete/{id}` | Admin |

#### Student — `api/v1/Student`
| Method | Endpoint | Access |
|--------|----------|--------|
| GET `/student` (directory w/ search/program), GET `/student/{id}` | Student, Faculty, ProgramHead, Admin |

#### Program Head — `api/v1/ProgramHead`
| Method | Endpoint | Access |
|--------|----------|--------|
| GET `/programhead`, GET `/programhead/{id}` | Authenticated (role-gated) |
| POST `/programhead/create`, POST `/programhead/update/{id}`, POST `/programhead/delete/{id}` | Admin (update also ProgramHead) |

#### Admin — `api/v1/Admin`
| Method | Endpoint | Access |
|--------|----------|--------|
| GET `/admin`, GET `/admin/{id}`, PATCH `/admin/update/{id}`, DELETE `/admin/delete/{id}` | Admin |

#### Research Group — `api/v1/ResearchGroup`
| Method | Endpoint | Access |
|--------|----------|--------|
| GET `/researchgroup`, GET `/researchgroup/{id}` | Student, Faculty, ProgramHead, Admin |
| POST `/researchgroup/create`, DELETE `/researchgroup/{id}` | Student, Admin |
| PATCH `/researchgroup/update/{id}` | Student, ProgramHead, Admin |
| POST `/researchgroup/{id}/members`, DELETE `/researchgroup/{id}/members/{studentId}` | Student, ProgramHead, Admin |

#### Review — `api/v1/Review`
| Method | Endpoint | Access |
|--------|----------|--------|
| GET `/review`, GET `/review/{id}` | Authenticated |
| POST `/review/create`, PATCH `/review/update/{id}`, DELETE `/review/delete/{id}` | Reviewer policy |

#### Schedule — `api/v1/Schedule`
| Method | Endpoint | Access |
|--------|----------|--------|
| GET `/schedule`, GET `/schedule/{id}` | Authenticated |
| POST `/schedule/create`, PATCH `/schedule/update/{id}`, PATCH `/schedule/update-times/{id}`, DELETE `/schedule/delete/{id}` | Admin, ProgramHead |

#### Panelist Schedule — `api/v1/PanelistSchedule`
| Method | Endpoint | Access |
|--------|----------|--------|
| GET `/panelistschedule`, GET `/panelistschedule/{scheduleId}` | Authenticated |
| POST `/panelistschedule/create`, PATCH `/panelistschedule/update/{scheduleId}`, DELETE `/panelistschedule/delete/{scheduleId}&{panelistId}` | Admin, ProgramHead |

#### Submission — `api/v1/Submission`
| Method | Endpoint | Access |
|--------|----------|--------|
| GET `/submission`, GET `/submission/{id}`, GET `/submission/{studentNumber}/{thesisId}` | Authenticated |
| POST `/submission/create`, PUT `/submission/update/{id}`, DELETE `/submission/delete/{id}` | Student, Admin |

#### Health
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/health` | Anonymous (requires `X-Ping-Secret` header matching config) |

### 8.3 Authentication Flow (as built)

```
Client                                Backend                    Firebase / SQL
  │── login (Firebase SDK) ─────────────│── verify credentials ──► Firebase Auth
  │◄── ID token ────────────────────────│◄── token ──────────────
  │                                     │
  │── every request: Bearer <token> ───►│ VerifyIdTokenAsync(checkRevoked)
  │                                     │ RoleAuthorizationMiddleware:
  │                                     │   probe Student→Faculty→ProgramHead→Admin
  │                                     │   (first IsActive profile wins) → Role claim
  │                                     │ FallbackPolicy requires Role claim
  │◄── response ────────────────────────│
```

Clients refresh tokens via `getIdToken(true)`; `@monteai/api`'s `createApiClient` retries once on 401 after refresh (mobile uses this; web/desktop renderer use hand-rolled interceptors).

---

## 9. Platform Specifications

### 9.1 Web (`apps/web`)

| Route | Description |
|-------|-------------|
| `/`, `/about` | Public landing + about (institution branding) |
| `/login`, `/register` | Firebase email/password auth |
| `/home` | Portal home |
| `/theses`, `/thesis/view/:thesisId` | Thesis catalog + PDF viewer with annotations |
| `/chat/:sessionId?` | AI chat — session sidebar, SSE streaming, source citations |
| `/submit` | Student thesis submission flow (group-aware modal) |
| `/schedule` | Defense schedule calendar |
| `/announcements`, `/research-groups`, `/settings` | Announcements, groups, account settings |

**Chat (Web):** session create/rename/delete; streaming via axios `onDownloadProgress` frame parsing (`sources`/`delta`/`done`); markdown rendering; citations panel; fallback to blocking send. Messages persisted server-side (Firestore).

### 9.2 Mobile (`apps/mobile`)

| Screen | Description |
|--------|-------------|
| `auth-entry`, `login`, `sign-up` | Auth stack (student-number login via `resolve-login`; email verification flow) |
| `(tabs)/home` | Feed |
| `(tabs)/library` | Thesis catalog + search |
| `(tabs)/chat` | AI chat (**blocking** send, no SSE); drawer with recents |
| `(tabs)/announcements` | Announcements |
| `(tabs)/profile` + `settings/*` | Profile, appearance, security, change password, help, about |
| `thesis/[id]` | Detail + WebView PDF viewer with annotations/sections sheets |
| `submit-thesis` | Submission flow |
| `schedules`, `research-group` | Hidden tab routes (push navigation) |

**Limitations vs. Web:** no SSE streaming; no admin/panelist features; no `@monteai/hooks`/`ui`; cleartext HTTP enabled for LAN dev API.

### 9.3 Desktop (`apps/desktop`)

| Route | Description |
|-------|-------------|
| `/login`, `/register` | Admin/faculty auth |
| `/` | Dashboard |
| `/theses` | Thesis moderation: approve (runs local pipeline), reject, request revision, edit, delete, upload |
| `/faculty`, `/research-groups` | Faculty & group management |
| `/panelist`, `/schedule` | Panelist assignments, defense schedules |
| `/announcements` | Announcement management |
| `/thesis/view/:thesisId` | PDF viewer with annotations |
| `/settings`, `/backup`, `/about` | Settings, backup panel, about |

**Not implemented:** chat route, fine-grained permissions UI, review-assignment UI (reviews exist in API/UI primitives only partially).

**Electron security:** `contextIsolation: true`, `nodeIntegration: false`, single narrow IPC surface (`window.thesisApi.approveThesis`), Forge fuses hardened, asar-only loading.

---

## 10. Security & Access Control

### 10.1 Roles

| Role | Capabilities (implemented) |
|------|----------------------------|
| `Student` | Submit/revise theses, browse, search, chat, view schedules/groups, annotations |
| `Faculty` | Browse, search, chat, review (Reviewer policy), panelist duties, annotations |
| `ProgramHead` | Institute-wide browse, announcements, scheduling, group oversight |
| `Admin` | Full: users/roles, submissions, ingestion trigger, schedules, panelists, announcements, deletes |

### 10.2 Enforcement Layers

1. **Firebase ID-token verification** (`FirebaseAuthMiddleware`, revocation-checked)
2. **Role claim injection** (`RoleAuthorizationMiddleware` probes role tables per request)
3. **ASP.NET authorization** — FallbackPolicy (auth + role claim) plus `Roles=` attributes and `Reviewer`/`Proceedings`/`FirebaseAuthenticated` policies
4. **Domain rules** — ownership checks on chat sessions; student submission gates (year level, group membership, one thesis per group); email-domain rules at registration (`@student.pnm.edu.ph` / `@pnm.edu.ph`)
5. **Rate limiting** — Chat 30/min, Proceedings 10/min, Health 5/min
6. **Prompt-injection blocklist** in the agent (canned refusals for code/extraction/translation attacks)
7. **CORS** — hardcoded origin whitelist (`MonteSkolarPolicy`) including localhost dev ports and `monteskolar.pnm.edu.ph`
8. **HTTPS** — enforced outside Development; dev binds HTTP :5084 + HTTPS :7085
9. **Blob SAS** — short-lived (15 min) download URLs; permanent blob paths only in vector metadata

### 10.3 Not Implemented (vs. original plan)

- App-level JWT issuance (Firebase tokens are used directly)
- Azure Key Vault (secrets in gitignored local config)
- App Insights; fine-grained `Permissions` table; HTTPS-only enforcement in dev

---

## 11. Implementation Status & Known Gaps

### Delivered

- Auth + role system across all three platforms (Firebase, student-number login on mobile)
- Full thesis lifecycle: submit → moderate (approve/reject/revision) → versioned revisions → ingestion → Indexed
- RAG ingestion pipeline (desktop extract/chunk + server embed/upsert) end-to-end
- Agentic chat with tools, citations, grounding, SSE streaming (web), history persistence
- Semantic + exact literature search
- Research groups, defense schedules, panelist schedules, announcements
- Proceedings PDF generation with Firestore annotations
- Shared package system (`@monteai/*`) with mock/live service toggle
- Redis GET cache, EF retry policies, Serilog, Docker profile, Swagger (dev)

### Gaps / tech debt (authoritative list)

| Area | Gap |
|------|-----|
| Desktop chat | No chat UI on desktop (planned in v1; chat exists on Web + Mobile only) |
| Mobile streaming | Chat uses blocking endpoint, no SSE |
| Tests / CI | Zero tests anywhere; `.github/workflows/` empty |
| Background jobs | No Hangfire/queues — ingestion is synchronous in the request |
| Dead code | Empty `SearchController`/`FirebaseAuthService`/`RoleService`/`UserService`; stale web `lib/chat/liveChatService.ts`, `services/api.tsx`; unused Google `StorageClient` DI registration |
| Route quirks | `AbstracsController` typo route without v1; PanelistSchedule delete uses `&` in route; ProgramHead update/delete use POST |
| Desktop ingest auth | Main-process ingest client sends no Firebase token (works only if endpoint policy changes or token is attached later) |
| Undeclared deps | Desktop imports `firebase`/`react-pdf` without declaring them (relies on hoisted node_modules) |
| Docs drift | Older sections of any pre-2.0 copies of this document describing ONNX/app-JWT/Hangfire are obsolete |

---

## 12. Appendix

### A. Environment Variables

**Server** (`server/appsettings.Development.json`, gitignored):
```json
{
  "ConnectionStrings": { "DefaultConnection": "..." },
  "AzureAI": { "Endpoint": "...", "ApiKey": "...", "DeploymentName": "phi-4-mini-instruct" },
  "AzureAIEmbedding": { "Endpoint": "...", "EmbeddingDeploymentName": "text-embedding-3-small", "ApiKey": "..." },
  "Pinecone": { "ApiKey": "...", "IndexName": "research-assistant-abstracts", "Host": "..." },
  "Firebase": { "AdminKeyPath": "monteai-firebase-credential.json", "ProjectId": "..." },
  "AzureStorage": { "ConnectionString": "...", "ContainerName": "..." },
  "Redis": { "Configuration": "..." },
  "MonteAI": { "Agent": { "EnableAgentMode": true, ... } }
}
```

**Frontends** (per-app gitignored `.env.local`):
- Web/Desktop: `VITE_API_BASE_URL`, `VITE_FIREBASE_*` (6 keys), `VITE_USE_MOCK`
- Mobile: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_FIREBASE_*` (6 keys), `EXPO_PUBLIC_USE_MOCK` (defaults true in `__DEV__`)

### B. Commands

```bash
pnpm dev:web | dev:mobile | dev:desktop     # run frontends
pnpm build:web | build:desktop              # builds (desktop `make` = installer)
pnpm lint                                   # root + desktop + mobile lint
dotnet run                                  # API from server/ (HTTPS :7085, Swagger /swagger)
dotnet ef migrations add <Name>            # schema changes
```

### C. Glossary

| Term | Definition |
|------|------------|
| RAG | Retrieval-Augmented Generation — LLM answers grounded in retrieved documents |
| Agent loop | LLM planner choosing tools iteratively before answering |
| Pinecone | Managed vector database for similarity search |
| Upsert | Insert-or-update of vectors |
| SSE | Server-Sent Events for token streaming |
| SAS | Shared Access Signature — short-lived blob URL |
| Scrutor | Assembly-scanning DI registration for .NET |

---

*End of Document — MonteAI Architecture (As-Built) v2.0.0*
