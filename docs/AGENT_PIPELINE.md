# MonteAI Agentic RAG Pipeline — Architecture & Data Flow

> Accurate as of this implementation. `docs/PROJECT_ARCHITECTURE.md` is the
> original (partly stale) project plan; this document describes what the code
> actually does today, end to end.

MonteAI is an **agentic, retrieval-augmented research assistant** for thesis
studies at Colegio de Montalban. "Agentic" here means: the assistant **plans**
(multi-step), **acts** (calls tools of its own choosing), **observes** the
results, **remembers** the conversation, and **verifies its own citations**
before answering — instead of the previous single-shot retrieve-then-stuff RAG.

```
┌─────────────────────────────  INDEXING (write path)  ─────────────────────────────┐
│                                                                                     │
│  Desktop (Electron main)                     Server (ASP.NET Core 8)               │
│  ─────────────────────────                    ──────────────────────────────        │
│  admin clicks Approve                                                         │
│    │ GET  /thesis/{id}/download-url  ──────►  ThesisController                  │
│    │ ◄──── 15-min SAS URL                                                     │
│  downloadPdfToTemp (temp file)                                                │
│  extractText        (pdfjs-dist, first 5 pages)                               │
│  isolateAbstract    (regex section heuristics)                                │
│  extractMetadata    (title / authors / year)                                  │
│  chunkText          (512 words, 50 overlap)                                   │
│    │ POST /thesis/ingest  ─────────────────►  ThesisService.IngestAsync         │
│                                              1. load thesis from Azure SQL      │
│                                                 (authoritative FilePath/Title;  │
│                                                 SAS URLs are discarded)         │
│                                              2. cap chunks (default 64)         │
│                                              3. DELETE old vectors (idempotent  │
│                                                 re-ingest; prefix + filter)     │
│                                              4. PineconeService                │
│                                                 .UpsertAbstractsAsync:          │
│                                                 batch-embed (16/request,        │
│                                                   text-embedding-3-small)      │
│                                                 bulk-upsert (100/request,       │
│                                                   cosine, serverless)          │
│                                              5. SQL status → "Indexed"          │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────  CHAT (read path)  ──────────────────────────────────┐
│                                                                                     │
│  Client (web)                                 Server                                │
│  ────────────────                              ─────────────────────────────        │
│  user sends message                                                          │
│    │ POST /chat/sessions/{id}/messages[/stream] ──► ChatController              │
│    │                                            1. ownership check (Firebase    │
│    │                                               uid == session owner)       │
│    │                                            2. load conversation history    │
│    │                                               (prior turns only)          │
│    │                                            3. persist user message;        │
│    │                                               touch LastChatDate          │
│    │                                            4. MonteAiAgentService         │
│    │                                               ┌───────────────────────┐    │
│    │                                               │ AGENT LOOP (≤3 steps)│    │
│    │                                               │  planner (Phi-4-mini) │    │
│    │                                               │   → JSON action        │    │
│    │                                               │  toolbox.Execute       │    │
│    │                                               │   → observation        │    │
│    │                                               │  loop / "final"        │    │
│    │                                               └──────────┬────────────┘    │
│    │                                               guaranteed retrieval if     │
│    │                                               no tool ran                │
│    │                                            5. synthesizer (Phi-4-mini)    │
│    │                                               streams the answer         │
│    │                                            6. grounding pass strips     │
│    │                                               invalid [Source n]         │
│    │                                            7. persist assistant message │
│    │                                               + sources JSON (Firestore) │
│    │ ◄── SSE: sources → delta* → done ────────  (stream variant)               │
│  ChatView renders answer + Sources panel (links to /thesis/view/:id)           │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Component map (file-by-file)

| File | Responsibility |
|---|---|
| `apps/desktop/src/handlers/approveThesis.ts` | Orchestrates the local extraction pipeline and POSTs chunks to `/thesis/ingest`. |
| `apps/desktop/src/pipeline/pdfDownloader.ts` | Downloads the PDF via SAS URL to a temp file; deletes it afterwards. |
| `apps/desktop/src/pipeline/pdfExtractor.ts` | pdfjs-dist text extraction (first 5 pages — enough for cover + abstract). |
| `apps/desktop/src/pipeline/abstractIsolator.ts` | Regex isolation of the abstract + title/authors/year heuristics. |
| `apps/desktop/src/pipeline/chunker.ts` | Word-based fixed-size chunking with overlap. |
| `server/Controllers/ThesisController.cs` | `/thesis/ingest` + thesis CRUD/version endpoints. |
| `server/Services/Theses/ThesisService.cs` | Ingestion hop: SQL-authoritative metadata, chunk cap, delete-then-upsert, status updates. Also deletes vectors when a thesis is deleted. |
| `server/Services/AI/PineconeService.cs` | Embedding + vector store: filtered retrieval with score threshold, batched embed, bulk upsert, delete by prefix/filter. |
| `server/Controllers/ChatController.cs` | Chat endpoints: ownership enforcement, history loading, blocking + SSE streaming message endpoints, source persistence. |
| `server/Services/AI/MonteAiAgentService.cs` | **The agent**: bounded ReAct loop, planner/synthesizer prompts, memory replay, grounding pass. |
| `server/Services/AI/Agent/AgentToolbox.cs` | The agent's tools: `semantic_search`, `keyword_search`, `thesis_metadata`. |
| `server/Services/AI/Agent/AgentPrompts.cs` | Every prompt in one place (planner JSON protocol + synthesizer citation rules). |
| `server/Services/AI/Agent/AgentJson.cs` | Tolerant JSON-protocol parsing (code fences, prose, balanced-brace extraction). |
| `server/Models/Agent/AgentModels.cs` | Agent data contracts (request/result/stream events/planner action). |
| `server/Models/Retrieval/Chunk.cs` | The single shape for retrieved knowledge (text + citation metadata + thesis id). |
| `server/Models/Retrieval/RetrievalOptions.cs` | Query-time filters (topK, threshold, thesisId, year range). |
| `server/Models/DTOs/ChatMessage/ChatSourceDto.cs` | Structured citation attached to assistant messages. |
| `server/Services/Chat/ChatMessageService.cs` | Persists messages + serializes sources; loads conversation history. |
| `packages/types/src/chat-message.ts` | Frontend mirror of the message + source contracts. |
| `packages/api/src/chat/chatService.ts` | Live client: REST + SSE-over-axios streaming with incremental frame parsing. |
| `packages/api/src/chat/mockChatService.ts` | Mock streaming for local development. |
| `packages/ui/src/pages/ChatPage.tsx` | Streaming state machine (optimistic user bubble → placeholder → live deltas → canonical message). |
| `packages/ui/src/components/Chat/ChatView.tsx` | Message bubbles, typing cursor, **Sources citation panel**. |

Auto-registration note: `PineconeService`, `MonteAiAgentService`, and
`AgentToolbox` live in `server.Services.*` namespaces and are wired by the
Scrutor scan in `Program.cs` (matching interfaces, scoped lifetime). The
record types in `server.Models.Agent` are deliberately **outside** those
namespaces so the scanner ignores them.

---

## 2. Indexing flow (PDF → vectors), in order

1. **Download** — `approveThesis.ts` asks the API for a SAS URL (15 min TTL),
   fetches the PDF to `%TEMP%\monteai_thesis_{id}.pdf`.
2. **Extract** — `pdfExtractor.extractText` reads up to 5 pages with pdfjs-dist.
3. **Isolate** — `isolateAbstract` finds the text between an `Abstract` heading
   and the next section (`Introduction`, `Keywords`, …). `extractMetadata`
   pulls title/authors/year from the cover-page text patterns.
   Failure (`ABSTRACT_NOT_FOUND`) surfaces to the admin UI for manual review.
4. **Chunk** — `chunkText(abstract, 512, 50)`: word-based, overlapping.
5. **Ship** — chunks are POSTed to `/thesis/ingest`; the desktop does **not** embed.
6. **Server-side ingest** (`ThesisService.IngestAsync`):
   - loads the thesis from SQL → `FilePath` (permanent blob path) replaces any
     client-provided URL, and `Title`/`ThesisId` are stamped on every chunk;
   - enforces `MaxChunksPerIngest` (default 64);
   - `PineconeService.DeleteThesisVectorsAsync` removes stale vectors
     (metadata-filter delete + prefix-list delete for legacy vectors);
   - `PineconeService.UpsertAbstractsAsync` embeds in batches of 16 and upserts
     in batches of 100. Vector id: `thesis_{thesisId}_chunk_{index}`.
     Metadata: `abstract`, `thesis_id`, `chunk_index`, `uploaded_at`, `title`,
     `url`, `authors`, `publication_year`, `journal`.
   - SQL status is set to `Indexed` only when at least one vector landed
     (response `Status`: `Indexed` / `Partial` / `Failed`).
7. **Deletion sync** — `ThesisService.DeleteAsync` removes the SQL row *and*
   the Pinecone vectors, so the knowledge base never outlives the document.

## 3. Chat flow (question → cited answer), in order

1. **Authorization** — every send verifies the Firebase uid owns the session
   (`CheckOwnershipAsync`); `GET /chat/sessions/{id}` enforces the same.
   Both send endpoints are rate-limited (`ChatLimit`, 30 req/min).
2. **Memory** — prior turns (default last 10) are loaded from Firestore
   *before* the new user message is persisted, then replayed into both the
   planner and the synthesizer prompts.
3. **Agent loop** (up to `MaxAgentIterations` = 3, disabled via config):
   - the planner (Phi-4-mini, temperature 0, ≤250 output tokens) answers with
     strict JSON — `{"tool": "...", "toolArgs": {...}}` or `{"final": true}`;
   - unparseable output degrades gracefully to the single-shot RAG path
     instead of erroring;
   - tool results ("observations") are truncated and fed back into the next
     planning step; every tool also contributes `ChatSourceDto` citations;
   - if **no** tool ran (greeting, immediate `final`, agent disabled), one
     automatic `semantic_search` still runs so research questions can never be
     answered without retrieval.
4. **Tools** (`AgentToolbox`):
   | Tool | Source | Use for |
   |---|---|---|
   | `semantic_search` | Pinecone + embeddings | concepts, topics, research questions; supports `topK`, `yearFrom`, `yearTo`, `thesisId` filters |
   | `keyword_search` | Azure SQL LIKE | exact acronyms, names, titles (hybrid retrieval) |
   | `thesis_metadata` | Azure SQL | drill into one thesis by id |
5. **Synthesis** — the synthesizer (temperature 0.2, ≤800 output tokens)
   receives the numbered sources + conversation + question and writes the
   answer with inline `[Surname et al., year][Source n]` citations.
6. **Grounding pass** — any `[Source n]` that doesn't map to a real retrieved
   source is stripped (free, no LLM call) before the answer is stored/sent.
7. **Persistence + delivery** — the assistant message is stored with its
   sources as JSON (`ChatMessage.SourcesJson`, Firestore). Clients either get
   the complete message (blocking endpoint) or an SSE stream:
   `sources` → `delta*` → `done` (with the persisted message). If the client
   disconnects mid-stream, the partial answer is still persisted.
8. **UI** — `ChatPage` streams deltas into a placeholder bubble; `ChatView`
   renders a typing cursor during streaming and a Sources panel (each source
   deep-links to `/thesis/view/{thesisId}`) under every cited answer. Reloaded
   sessions rehydrate the panel from the stored sources JSON.

## 4. Why the agent uses a JSON protocol (not native function calling)

Phi-4-mini-instruct on Azure AI Foundry does not reliably support the OpenAI
`tools` parameter, so the planner uses a JSON action protocol instead. This
was **validated against the live deployment** — prompting small models is
empirical, and the measurements matter:

| Strategy | Schema compliance |
|---|---|
| Prose instruction only ("reply with ONLY a JSON object") | **0/4** — model answers conversationally |
| Few-shot examples inside the system prompt | 0/4 |
| Assistant-turn prefill (`{`) | 0/4 |
| `ResponseFormat = json_object` alone | valid JSON, but **invented schema** (`thoughts`/`plan`/`actions`) |
| **`json_object` + few-shot as real chat turns + rules in system** | **4/4** exact schema |

The production recipe (in `AgentPrompts` + `MonteAiAgentService.PlanningOptions`)
is therefore: JSON response format (server-enforced) + four in-conversation
few-shot example pairs (including a "next step after tool results" example) +
schema rules repeated in the system prompt.

**Message order matters too.** Conversation history is placed *before* the
few-shot block (see `BuildPlanningMessages`); with history after the examples
the planner treated the conversation as finished and returned `{"final": true}`
for research questions without calling any tool. The current measured behavior
(same recipe, history first): 4/4 valid schema; research/acronym questions
trigger a search tool, greetings finish immediately. The planner sometimes
picks `keyword_search` for a topical question — the empty-result observation
then nudges it to `semantic_search` on the next step, so the loop self-corrects
within the 3-step budget (cost: one extra planner call, fractions of a cent).

The toolbox also tolerates the model's occasional `query`/`term` argument swap,
and observations nudge the planner back on track when it misuses a tool. If the
deployment ever gains native tool support, swapping the planner to
`ChatCompletionOptions.Tools` is a localized change.

## 5. Cost controls (Microsoft Foundry credits)

| Control | Default | Effect |
|---|---|---|
| `MonteAI:Agent:EnableAgentMode` | `true` | `false` collapses to 1 retrieval + 1 LLM call |
| `MonteAI:Agent:MaxAgentIterations` | `3` | hard cap on planner calls per message |
| `MonteAI:Agent:PlanningMaxOutputTokens` | `250` | planner JSON is tiny |
| `MonteAI:Agent:AnswerMaxOutputTokens` | `800` | bounds the answer |
| `MonteAI:Agent:HistoryMessageCount` | `10` | bounds prompt size |
| `MonteAI:Agent:MaxSources` | `8` | bounds citation block |
| `MonteAI:Agent:MaxQueryLength` | `2000` | bounds query embedding |
| `Pinecone:ScoreThreshold` | `0.25` | junk chunks never reach the LLM |
| `Pinecone:EmbeddingBatchSize` | `16` | one embedding call per 16 chunks |
| `Pinecone:MaxChunksPerIngest` | `64` | caps ingestion fan-out |
| `Pinecone:TopK` | `5` | retrieval width |
| Rate limit `ChatLimit` | 30/min | stops runaway clients |
| Tool observation cap | 4000 chars | protects the context window |

Rough per-message cost (typical 2 planner + 1 synthesis call + 1-2 embeddings):
well under **$0.001** at Phi-4-mini / text-embedding-3-small pricing — the
$94 credit budget is dominated by dev/testing volume, not per-message cost.

## 6. Known limits / next steps

- **Abstract-only indexing** — methodology/results sections are not indexed
  yet; chunk them per-section in the desktop pipeline to answer deeper questions.
- **Hybrid ranking** — keyword + semantic results are merged by the agent, but
  there is no cross-encoder rerank (could use Pinecone Rerank later).
- **No evaluation harness** — a golden Q&A set with faithfulness/relevancy
  metrics (RAGAS-style) would quantify answer quality.
- **Ownership on update/delete session** — currently only send + get enforce
  ownership; extend `CheckOwnershipAsync` if needed.
- **SSE client** — the axios/XHR streaming reader is browser-based; a
  Node/Electron-main chat client would need a fetch-based reader.
