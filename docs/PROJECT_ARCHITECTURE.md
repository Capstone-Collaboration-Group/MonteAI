# Research Assistant and Digital Thesis Repository System — Project Plan
**Document Version:** 1.0.0
**Prepared by:** Charles Bernard Balaguer
**Date:** May 22, 2026
**Classification:** Internal — Development Team

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
11. [Development Phases & Milestones](#11-development-phases--milestones)
12. [Team Structure & Responsibilities](#12-team-structure--responsibilities)
13. [Risk Management](#13-risk-management)
14. [Appendix](#14-appendix)

---

## 1. Executive Summary

This document outlines the complete project plan for **MonteAI, a full-stack, AI-powered Research Assistant System** designed for an Colegio de Montalban. The system enables students and faculty to explore, search, and interact with a curated repository of thesis documents through a conversational AI interface powered by **Retrieval-Augmented Generation (RAG)**.

The system is distributed across three distinct frontends — Web (React + Vite), Mobile (React Native), and Desktop (Electron + Forge) — each targeting a specific user group. The backend is a unified **ASP.NET Core Web API** layer that orchestrates authentication, document management, vector search, and AI inference.

**Key capabilities:**
- PDF ingestion with intelligent abstract-focused chunking and ONNX-based embedding
- Vector similarity search via Pinecone for research discovery
- ChatGPT/Gemini-like conversational interface for assisted research
- Role-based access control for admins, faculty reviewers, and students
- Thesis submission and review workflow managed from the Desktop admin panel

---

## 2. Project Overview

### 2.1 Goals

| Goal | Description |
|------|-------------|
| Research Discovery | Allow students and faculty to search related literature using natural language queries |
| AI-Assisted Research | Provide a conversational interface to answer research questions grounded in indexed documents |
| Thesis Management | Enable admins to manage submissions and assign faculty reviewers |
| Defense Schedule | Enable admins to create defense schedule for theses defense | 
| Role Enforcement | Enforce distinct permissions for students, faculty, and administrators |
| Cross-Platform Access | Deliver a consistent experience across web, mobile, and desktop |

### 2.2 Stakeholders

| Stakeholder | Role | Platform |
|-------------|------|----------|
| Students | Search literature, submit theses, use AI assistant | Mobile, Web |
| Faculty | Review assigned theses, search literature, use AI assistant | Mobile, Web |
| Program Head | Review Institute wide theses, search theses, comment, | Web, Desktop |
| Admin | Manage users, submissions, roles, Schedule Defense, Assign Panelists | Desktop (Electron) |
| Development Team | Build, maintain, and deploy the system | All |

### 2.3 Scope

**In Scope:**
- Multi-platform frontend applications (Web, Mobile, Desktop)
- ASP.NET Core Web API backend
- RAG pipeline: chunking → embedding → upsert → retrieval → generation
- Firebase-based authentication with role propagation
- Pinecone vector store for abstract embeddings
- Azure SQL for relational data (users, theses, roles, submissions)
- Admin desktop tools for thesis and user management
- Chat interface on Web and Desktop only

**Out of Scope:**
- Plagiarism detection engine (future phase)
- Third-party journal indexing (e.g., IEEE, Scopus)
- Real-time collaboration on documents

---

## 3. System Architecture

### 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│                                                                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │  React + Vite   │  │  React Native    │  │ Electron + Forge │    │
│  │  (Web — Public  │  │  (Mobile)        │  │ (Desktop — Admin)│    │
│  │   + Chat)       │  │  Students/Faculty│  │                  │    │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬─────────┘    │
└───────────┼──────────────────┼───────────────────────┼──────────────┘
            │                  │                       │
            └─────────────────┬┘                       │
                              │  HTTPS / REST          │
┌─────────────────────────────┼────────────────────────┼────────────┐
│                    BACKEND LAYER (ASP.NET Core)      │            │
│                              │                       │            │
│  ┌───────────────────────────▼───────────────────────▼──────────┐ │
│  │                    API Gateway / Controllers                 │ │
│  │    AuthController │ ThesisController │ ChatController        │ │
│  │    UserController │ SearchController │ AdminController       │ │
|  |ScheduleController | GroupController  | FacultyController     | |
│  └──────┬──────────────────┬───────────────────┬────────────────┘ │
│         │                  │                   │                  │
│  ┌──────▼──────┐   ┌───────▼────────┐  ┌──────▼──────────────┐    │
│  │  Auth       │   │  RAG Pipeline  │  │  Document Service   │    │
│  │  Service    │   │  Service       │  │  (Upload/Storage)   │    │
│  │ (Firebase)  │   │                │  │                     │    │
│  └──────┬──────┘   └───────┬────────┘  └──────┬──────────────┘    │
│         │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼────────────────────┐
│                         DATA LAYER                                 │
│                                                                    │
│  ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐    │
│  │   Firebase   │   │    Pinecone      │   │  Azure SQL DB    │    │
│  │   Auth       │   │  Vector Store    │   │  (Relational)    │    │
│  │              │   │  (Embeddings)    │   │                  │    │
│  └──────────────┘   └──────────────────┘   └──────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │          Azure Blob Storage (Raw PDF Files)                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 RAG Pipeline Architecture

```
     PDF Upload
         │
         ▼
┌───────────────────┐
│  PDF Extractor    │  ←── Extracts raw text + metadata (title, author, abstract)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Abstract Isolator│  ←── Identifies and extracts the "Abstract" section only
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Text Chunker     │  ←── Splits abstract text into token-safe chunks
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  ONNX Embedder    │  ←── Microsoft.ML.OnnxRuntime generates vector embeddings
│  (Sentence BERT)  │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Pinecone Upsert  │  ←── Stores vector with metadata (title, author, chunk index)
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Azure SQL Insert │  ←── Stores thesis record (title, author, file path, status)
└───────────────────┘
```

---

## 4. Technology Stack

### 4.1 Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Web API | ASP.NET Core 8 (.NET 8) | REST API, business logic, orchestration |
| Authentication | Firebase Authentication | Identity management, JWT token issuance |
| ORM | Entity Framework Core 8 | Azure SQL database access |
| Vector Store Client | Pinecone .NET SDK | Embedding upsert and semantic query |
| Embedder | Microsoft.ML.OnnxRuntime | Local ONNX model inference (Sentence-BERT) |
| PDF Processing | PdfPig / iTextSharp | PDF text extraction and parsing |
| File Storage | Azure Blob Storage SDK | Raw PDF file storage |
| Logging | Serilog + Azure App Insights | Structured logging and monitoring |
| Background Jobs | Hangfire | Async PDF processing pipeline |
| API Documentation | Swashbuckle (Swagger) | Auto-generated API docs |

### 4.2 Frontend

| Platform | Technology | Target Users |
|----------|------------|-------------|
| Web | React 18 + Vite + TypeScript | Public / Students / Faculty |
| Mobile | React Native (Expo) + TypeScript | Students / Faculty |
| Desktop | Electron + Forge + React + TypeScript | Administrators |

**Shared Frontend Libraries:**

| Library | Purpose |
|---------|---------|
| TanStack Query | Server-state management and caching |
| Zustand | Client-side state management |
| Axios | HTTP client for API calls |
| React Hook Form + Zod | Form management and validation |
| TailwindCSS | Styling (Web + Electron) |
| NativeWind | TailwindCSS for React Native |

### 4.3 Databases

| Database | Technology | Data Stored |
|----------|------------|-------------|
| Relational | Azure SQL Database (Gen5) | Users, theses, roles, permissions, submissions, reviews |
| Vector Store | Pinecone (Serverless) | Text chunk embeddings + metadata |
| File Store | Azure Blob Storage | Raw PDF files |
| Auth Store | Firebase Firestore (optional) | Auth metadata, session tokens |

### 4.4 Infrastructure & DevOps

| Component | Technology |
|-----------|------------|
| Cloud Provider | Microsoft Azure |
| API Hosting | Azure App Service |
| CI/CD | GitHub Actions |
| Container | Docker + Azure Container Registry |
| Secrets Management | Azure Key Vault |
| Environment Config | .env + Azure App Configuration |

---

## 5. Module Breakdown

### 5.1 Backend Modules

```
ResearchAssistant.API/
├── Controllers/
│   ├── AuthController.cs
│   ├── ThesisController.cs          ← /theses/ingest now just relays vectors
│   ├── SearchController.cs
│   ├── ChatController.cs
│   ├── UserController.cs
│   └── AdminController.cs
│
├── Services/
│   ├── Auth/
│   │   └── FirebaseAuthService.cs
│   ├── AI/
│   │   ├── PdfExtractorService.cs        ← moved to Electron
│   │   ├── AbstractIsolatorService.cs    ← moved to Electron
│   │   ├── ChunkingService.cs            ← moved to Electron
│   │   ├── EmbeddingService.cs           ← moved to Electron (onnxruntime-node)
│   │   ├── PineconeUpsertService.cs      ← receives vectors[], upserts to Pinecone
│   │   └── RagQueryService.cs             ← query pipeline unchanged
│   ├── Thesis/
│   │   ├── ThesisService.cs
│   │   ├── SubmissionService.cs
│   │   └── ReviewService.cs
│   ├── User/
│   │   ├── UserService.cs
│   │   └── RoleService.cs
│   └── Chat/
│       └── ChatSessionService.cs
│
├── Models/
│   ├── Entities/
│   └── DTOs/
│       └── ThesisIngestDto.cs            ← { title, author, abstract, vectors[] }
│
├── Data/
│   ├── AppDbContext.cs
│   └── Migrations/
│
├── Middleware/
│   ├── FirebaseAuthMiddleware.cs
│   └── RoleAuthorizationMiddleware.cs
│
└── Configuration/
    ├── PineconeConfig.cs
    └── OnnxConfig.cs                 ← removed, ONNX no longer on server
```

### 5.2 Frontend Module Summary

**Web (React + Vite)**
```
src/
├── pages/
│   ├── Landing/          ← Promotional landing page
│   ├── Auth/             ← Login, Register
│   ├── Dashboard/        ← Thesis browser
│   ├── Search/           ← Literature search results
│   └── Chat/             ← AI Chat interface (Web only)
├── components/           ← Reusable UI components
├── hooks/                ← Custom React hooks
├── store/                ← Zustand state
└── services/             ← API service layer
```

**Mobile (React Native + Expo)**
```
mobile/
├── app/
|   ├── (auth)/
│   │   └── index.tsx
│   │── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── search.tsx
│   ├── thesis/
│   │   └── [id].tsx
│   │── _layout.tsx
│   └── modal.tsx
├── components/
├── services/
├── hooks/
├── constants/
└── assets/
```

**Desktop (Electron + Forge)**
```
src/
├── main/                 ← Electron main process
├── renderer/
│   ├── pages/
│   │   ├── Auth/
│   │   ├── Dashboard/
│   │   ├── Submissions/  ← Manage thesis submissions
│   │   ├── Users/        ← Role and permission management
│   │   └── Chat/         ← AI Chat interface (Desktop)
│   └── components/
└── preload/              ← Context bridge scripts
```

---

## 6. AI Pipeline Design

### 6.1 PDF Ingestion Pipeline

**Trigger:** Admin downloads a pending thesis PDF to their local machine via the Desktop app, reviews it, then clicks **Approve**. The approval action fires the full local pipeline on the admin's machine.

**Step 1 — PDF Text Extraction**
- Library: `pdfjs-dist` (Node.js, runs in Electron main process)
- Extracts raw text of Abstract, Intro, Keywords, and Table of Contents, along with bounding box metadata
- Normalizes whitespaces, encoding and removes non-printable characters
- Only the pages needed for abstract isolation are processed - not the full document

```JavaScript
// pipeline/pdfExtractor.js
import * as pdfjs from 'pdfjs-dist';

export async function extractText(filePath) {
    const pdf = await pdfjs.getDocument({url: filePath }).promise;
    let fullText = '';

    // Scan first 5 pages only - adjust this if abstract is deeper
    const pagesToScan = Math.min(pdf.numPages, 5);

    for(let i = 1; i <= pagesToScan; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    return fullText;
}

```
**Step 2 — Abstract Isolation**
- Rule-based section detection: searches for the heading `Abstract` (case-insensitive, supports variations like `ABSTRACT`, `Summary`, `Executive Summary`)
- Captures all text between `Abstract` and the next section heading (e.g., `Introduction`, `Keywords`, `Table of Contents`)
- Fallback: If abstract section not found, logs a warning and flags the document for manual review
- Also extracts title and author from the first page using positional heuristics (largest font block = title, line directly below = author)

```JavaScript
// pipeline/abstractIsolator.js
export function isolateAbstract(rawText) {
    const abstractPattern = 
    /(?:abstract|summary|executive\s+summary)\s*[\n\r]+([\s\S]*?)(?=\n\s*(?:introduction|keywords|table of contents|chapter\s+1|acknowledgements)|$)/i;

    const match = rawText.match(abstractPattern);

    if(!match || !match[1].trim()) {
        return { abstract: null, found: false };
    }

    return { 
        abstract: match[1].trim(),
        found: true
    };
}
export function extractMetadata(firstPageText){
    const lines = firstPageText
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean());
        
    // Heuristic: title = longest line in first 10 lines
    const title = lines.slice(0, 10).reduce((a, b)=> b.length > a.length ? b: a, '');

    //Heuristic: author = line containing "by" or line after title
    const authorLine = lines.find(l => /^(by|submitted by|preparedby)/i.test(l));
    const author = authorLine ? authorLine.replace(/^(by|submitted by|prepared by)\s*/i, '').trim() : lines[lines.indexOf(title) + 1] || 'Unknown';

    return {title, author};
}
```

**Step 3 — Text Chunking**
- Strategy: Fixed-size chunking with overlap
- Chunk size: 512 tokens (configurable)
- Overlap: 50 tokens (preserves context across chunk boundaries)
- Tokenizer: matched to the ONNX model's vocabulary (e.g., WordPiece for BERT-based models)
- Purpose: Prevents exceeding the model's context window during embedding inference

```JavaScript
// Pseudocode — pipeline/chunker.js
export function chunkText(text, chunkSize = 512, overlap = 50) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    let start = 0;

    while (start < words.length) {
        const chunk = words.slice(start, start + chunkSize).join(' ');
        chunks.push(chunk);
        if (start + chunkSize >= words.length) break;
        start += chunkSize - overlap;

    }
    return chunks;
}

// public List<string> ChunkText(string text, int chunkSize = 512, int overlap = 50)
// {
//     var tokens = Tokenize(text);
//     var chunks = new List<string>();
//     int start = 0;

//     while (start < tokens.Count)
//     {
//         var chunkTokens = tokens.Skip(start).Take(chunkSize).ToList();
//         chunks.Add(Detokenize(chunkTokens));
//         start += chunkSize - overlap;
//     }
//     return chunks;
// }
```

**Step 4 — ONNX Embedding**
- Runtime: `onnxruntime-node` (Microsoft's official Node.js ONNX binding—same underlying engine as Microsoft.ML.OnnxRuntime)
- Model: `all-MiniLM-L6-v2` (Sentence-BERT, 384-dimensional embeddings) —bundled inside the Electron app via Forge extraResources
- Singleton session: model is loaded once when the app starts, reused for ever subsequent ingestion — eliminates cold-start after the first thesis
- Each chunk is independently embedded into a 384-dimensional float32 vector
- Mean pooling applied over token embeddings to produce sentence-level representation

```JavaScript
// Pseudocode — pipeline/embedder.js
import * as ort from 'onnxruntime-node';
import path from 'path';
import { app } from 'electron'

let session = null; // singleton — loaded once at startup

export async function getSession() {
    if(!session) {
        const modelPath = app.isPackaged 
            ? path.join(process.resourcePath, 'models', 'all-MiniLM-L6-v2.onnx') : path.join(app.getAppPathI(), 'models' 'all-MiniLM-L6-v2.onnx');

        session = await ort.InferenceSession.create(modelPath);
    }
    return session;
}

export async function generateEmbedding(text) {
    const sess = awit getSession();
    const { inputIds, attentionMask } = tokenize(text); // WordPiece tokenizer
    
    const feeds = {
        input_ids: new ort.Tensor('int64', inputIds, [1, inputIds.length]),
        attention_mask: new ort.Tensor('int64', attentionMask, [1, attentionMask.length],)
    };

    const output = await sess.run(feeds);
    return meanPooling(output['last_hidden_state'], attentionMask); //float32 Array
}
```

**Step 5 — Local Pipeline Orchestration**
Before anything reaches the cloud, the full pipeline runs locally and prduces a clean payload:
```JavaScript
// pipeline/ingestThesis.js
export async function ingestThesis(filePath, thesisId) {    
    // Extract
    const rawText = await extractText(filePath);

    // Isolate abstract + metadata
    const {abstract, found } = isolateAbstract(rawText);
    if(!found) throw new Error('ABSTRACT_NOT_FOUND');

    const { title, author } = extractMetaData(rawText);

    // Chunk
    const chunks = chunkText(abstract);

    const vectors = [];
    for(const [index, chunk] of chunks.entries()) {
        const embedding = await generateEmbedding(chunk);
        vectors.push({ 
            id: `thesis_${thesisId}_chunk_${index}`,
            chunkIndex: index,
            chunkText: chunk,
            embedding: Array.from(embedding),
        });
    }

    return {title, author, abstract, vectors };



}
```
B
**Step 6 — Send to Cloud -> Pinecone Upsert**
- The payload from the local pipeline is sent to the API which then  upserted into Pinecone as a vector record
- Metadata included per vector:

```JavaScript
// handlers/approveThesis.js
ipcMain.handle('approve-thesis', async (event, {thesisId, filePath }) => {
    // Run full pipeline locally
    const { title, author, abstract ,vectors } = await ingestThesis(filePath, thesisId);

    // Send lightweight payload to cloud API
    await api.post('/theses/ingest', {
        thesisId,
        title,
        author,
        abstract, 
        vectors
    });
})

// {
//   "id": "thesis_{thesisId}_chunk_{chunkIndex}",
//   "values": [0.021, -0.043, ...],   // 384-dim float vector
//   "metadata": {
//     "thesisId": "uuid",
//     "title": "Effects of Machine Learning in...",
//     "author": "Juan dela Cruz",
//     "chunkIndex": 2,
//     "chunkText": "This study investigates...",
//     "uploadedAt": "2026-05-22T00:00:00Z"
//   }
// }
```

- Pinecone index configuration: cosine similarity metric, serverless tier (AWS us-east-1 or Azure equivalent)

**Step 7 — Azure SQL Insert**
- Upon successful upsert, a `Thesis` record is persisted in Azure SQL with:
  - Title, Author, Abstract text, file path (Blob URL), upload timestamp, status, uploader ID

### 7.2 RAG Query Pipeline (Chat Interface)

**Trigger:** User submits a message via Chat interface (Web or Desktop)

```
User Message
     │
     ▼
┌────────────────────┐
│ Embed User Query   │  ←── Same ONNX model (all-MiniLM-L6-v2)
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Pinecone Query     │  ←── Top-K similarity search (K=5 default)
│ (Vector Search)    │
└────────┬───────────┘
         │  Returns top-K matching chunks + metadata
         ▼
┌────────────────────┐
│ Context Builder    │  ←── Assembles retrieved chunks into a prompt context
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ LLM Generation     │  ←── Calls external LLM API (OpenAI / Azure OpenAI)
│ (Augmented Prompt) │       with system prompt + context + user query
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Response Streamed  │  ←── Server-Sent Events (SSE) to frontend
│ to Client          │
└────────────────────┘
```

**System Prompt Template:**
```
You are a research assistant for an academic institution. 
Answer the user's question based ONLY on the provided research context below.
If the answer is not found in the context, say so clearly.
Always cite the thesis title and author when referencing a document.

Context:
{retrieved_chunks}

User Question:
{user_message}
```

### 7.3 Literature Search Pipeline

- User enters a natural language search query
- Query is embedded via ONNX → queried against Pinecone
- Top-K results returned with metadata (title, author, abstract snippet)
- Results displayed as thesis cards with relevance-ranked ordering
- Available on: Web, Mobile, Desktop

---

## 7. Database Design

### 7.1 Azure SQL Schema

```sql
-- Users  (will only be used as an abstract class in c# will not create table in the DB)
Table Users {
  Id UNIQUEIDENTIFIER [pk, default: `NEWID()`]
  Email NVARCHAR(256) [not null]
  FirstName NVARCHAR(256)
  MiddleName NVARCHAR(256)
  LastName NVARCHAR(256)
  Role NVARCHAR(50) [not null, default: 'Student', note: 'Student | Faculty | Admin']
  IsActive BIT [default: 1]
  CreatedAt DATETIME2 [default: `GETUTCDATE()`]
  UpdatedAt DATETIME2 [default: `GETUTCDATE()`]
};
-- Admin Table
Table Admin {
  Id uniqueidentifier [pk, default: `NEWID()`]
  Email NVACHAR(256) [not null]
  FirstName nvarchar(256) 
  MiddleInitial nvarchar(256) 
  LastName nvarchar(256)
  Suffix nvarchar(5)
};

-- Student table
Table Students { 
  StudentNumber UNIQUEIDENTIFIER [pk, default: `NEWID()`]
  GroupId UNIQUEIDENTIFIER
  Email NVACHAR(256) [not null]
  FirstName nvarchar(256)
  Position nvarchar(40) 
  MiddleInitial nvarchar(256) 
  LastName nvarchar(256)
  Suffix nvarchar(5)
  Institute nvarchar(50) 
  Program nvarchar(50)
  YearLevel int
  Section nvarchar(3)
};

-- Program Head Table
Table ProgramHeads {
  Id uniqueidentifier [pk, default: `NEWID()`]
  Email nvarchar(256) [not null]
  FirstName nvarchar(256) 
  MiddleInitial nvarchar(256) 
  LastName nvarchar(256)
  Suffix nvarchar(5)
  Institute nvarchar(50) 
  ProgramHandled nvarchar(50)
};

-- Faculty Table
Table Faculty { 
  Id uniqueidentifier [pk, default: `NEWID()`]
  Email nvarchar(256) UNIQUE [not null]
  FirstName nvarchar(256) 
  MiddleInitial nvarchar(256) 
  LastName nvarchar(256)
  Suffix nvarchar(5)
  Institute nvarchar(50) 
};


-- Theses table
CREATE TABLE Theses (
    Id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Title           NVARCHAR(512) NOT NULL,
    Authors         NVARCHAR(512) NOT NULL,
    Abstract        NVARCHAR(MAX),
    FilePath        NVARCHAR(1024) NOT NULL,         -- Firebase Storage URL
    UploadedById    UNIQUEIDENTIFIER REFERENCES Users(Id),
    Status          NVARCHAR(50) DEFAULT 'Pending',  -- Pending | UnderReview | Approved | Rejected
    PineconeStatus NVARCHAR(20) DEFAULT 'None'
    SubmittedAt     DATETIME2 DEFAULT GETUTCDATE(),
    ReviewedAt      DATETIME2 DEFAULT GETUTCDATE(),
    ApprovedAt      DATETIME2 DEFAULT GETUTCDATE(),
    RejectedAt      DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt       DATETIME2 DEFAULT GETUTCDATE()
);

-- Submissions table (student → thesis link)
CREATE TABLE Submissions (
    Id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ThesisId        UNIQUEIDENTIFIER REFERENCES Theses(Id),
    StudentId       UNIQUEIDENTIFIER REFERENCES Users(Id),
    SubmittedAt     DATETIME2 DEFAULT GETUTCDATE(),
    Notes           NVARCHAR(MAX)
);

-- Reviews table
CREATE TABLE Reviews (
    Id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ThesisId        UNIQUEIDENTIFIER REFERENCES Theses(Id),
    ReviewerId      UNIQUEIDENTIFIER REFERENCES Users(Id),  -- Faculty member, and ProgramHead
    Decision        NVARCHAR(50),   -- Approved | Rejected | Revise
    Comments        NVARCHAR(MAX),
    ReviewedAt      DATETIME2,
);

-- Chat Sessions table
CREATE TABLE ChatSessions (
    Id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId          UNIQUEIDENTIFIER REFERENCES Users(Id),
    Title           NVARCHAR(256),
    CreatedAt       DATETIME2 DEFAULT GETUTCDATE()
    LastChatDate    DATETIME2 DEFAULT GETUTCDATE()
);

-- Chat Messages table
CREATE TABLE ChatMessages (
    Id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    SessionId       UNIQUEIDENTIFIER REFERENCES ChatSessions(Id),
    Role            NVARCHAR(20) NOT NULL,  -- user | assistant
    Content         NVARCHAR(MAX) NOT NULL,
    Timestamp       DATETIME2 DEFAULT GETUTCDATE()
);

-- Permissions table
CREATE TABLE Permissions (
    Id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserId          UNIQUEIDENTIFIER REFERENCES Users(Id),
    PermissionKey   NVARCHAR(128) NOT NULL,  -- e.g., "thesis.review", "user.manage"
    GrantedById     UNIQUEIDENTIFIER REFERENCES Users(Id),
    GrantedAt       DATETIME2 DEFAULT GETUTCDATE()
);

-- Schedule 
Table Schedule { 
  ScheduleId uniqueidentifier [pk, default: `NEWID()`]
  ScheduledBy nvarchar(256) [not null]
  GroupId uniqueidentifier 
  Date date [default: `GETUTCDATE()`]
  StartingTime time 
  EndingTime time
  Panelists nvarchar(256) [not null]
  RoomVenue nvarchar(256) [not null]
  AdditionalInformation nvarchar(256)
};

-- Student Researcher Group
Table ResearchGroup { 
  GroupId uniqueidentifier [pk, default: `NEWID()`]
  CreatedAt DATETIME2 [default: `GETUTCDATE()`]
  UpdatedAt DATETIME2 [default: `GETUTCDATE()`]
};
```

### 7.2 Pinecone Index Configuration

| Property | Value |
|----------|-------|
| Index Name | `research-assistant-abstracts` |
| Dimensions | 384 (all-MiniLM-L6-v2) |
| Metric | Cosine |
| Tier | Serverless |
| Namespace | `thesis-abstracts` |
| Metadata Fields | `thesisId`, `title`, `author`, `chunkIndex`, `chunkText`, `uploadedAt` |

---

## 8. API Design

### 8.1 Base URL
```
Format (temporary structure)
https://api.monteai.edu.ph/api/v1
```

### 8.2 Endpoint Summary

#### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/auth/login` | Exchange Firebase token for app JWT | Public |
| POST | `/auth/register` | Create user profile post-Firebase signup | Public |
| POST | `/auth/refresh` | Refresh app JWT | Authenticated |

#### Thesis Management
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/theses` | Upload and submit a thesis PDF | Student |
| GET | `/theses` | List all theses (paginated) | All authenticated |
| GET | `/theses/{id}` | Get thesis detail | All authenticated |
| PATCH | `/theses/{id}/status` | Update thesis status | Admin |
| DELETE | `/theses/{id}` | Delete thesis | Admin |

#### Search & Discovery
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/search?q={query}` | Semantic search via Pinecone | All authenticated |
| GET | `/search/filter` | Filter by author, date, status | All authenticated |

#### Chat
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/chat/sessions` | Create a new chat session | Student, Faculty, Admin |
| GET | `/chat/sessions` | List user's chat sessions | Student, Faculty, Admin |
| GET | `/chat/sessions/{id}` | Get session with messages | Student, Faculty, Admin |
| POST | `/chat/sessions/{id}/messages` | Send message, stream response (SSE) | Student, Faculty, Admin |
| DELETE | `/chat/sessions/{id}` | Delete a session | Owner |

#### User Management
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/users` | List all users | Admin |
| GET | `/users/{id}` | Get user details | Admin |
| PATCH | `/users/{id}/update` | Update User Info | Admin |
| DELETE | `/users/{id}/delete` | Delete User  | Admin |

#### Faculty Management
| Method| | Endpoint | Description | Access |
|---------|----------|-------------|--------|
| GET | `/faculties` | List all faculty staffs | Admin
| GET | `/faculties/{id}` | Get faculty details | Admin |
| PATCH | `/faculties/{id}/assign` | Assign faculty as panelist | Admin |
| DELETE | `/faculties/{id}/revoke` | Revoke Panelist Permission | Admin | 

#### Students Management 
| Method | Endpoint | Description | Access |
|---------|----------|-------------|--------|
| GET | `/students` | List all students | Admin | 
| GET | `/students/{id}` | Get student details | Admin, Student | 
| PATCH | `/students/{id}` | Update user credential | Student
| DELETE | `/students{id}`| Delete user account | Admin, Student |



#### Review Workflow
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/reviews/assign` | Assign faculty reviewer to thesis | Admin |
| GET | `/reviews/my` | Get reviews assigned to current faculty | Faculty |
| POST | `/reviews/{thesisId}` | Submit a review decision | Faculty |

### 8.3 Authentication Flow

```
Client                         Backend                     Firebase
  │                               │                            │
  │──── Login with credentials ──►│                            │
  │                               │──── Verify ID Token ──────►│
  │                               │◄─── Token Valid ───────────│
  │                               │                            │
  │                               │──── Lookup/Create User ──► Azure SQL
  │                               │◄─── User Record ─────────  Azure SQL
  │                               │                            │
  │◄── App JWT (with role claims) ─│                            │
  │                               │                            │
  │──── All subsequent requests ──►│                            │
  │     (Bearer: app JWT)          │──── Validate JWT ─────────►│
```

---

## 9. Platform Specifications

### 9.1 Web — React + Vite

**Purpose:** Promotional landing page + student/faculty research portal with chat

**Pages & Features:**
| Page | Description |
|------|-------------|
| `/` | Landing page — institution branding, system intro, login CTA |
| `/login` | Firebase-backed login form |
| `/register` | Registration with role request (Student/Faculty) |
| `/dashboard` | Thesis browser — search bar, cards grid, filters |
| `/thesis/:id` | Thesis detail — abstract, author, metadata, download link |
| `/search` | Full-text + semantic search results page |
| `/chat` | Chat interface — session list sidebar + message window |
| `/profile` | User profile, session history |

**Chat Interface Requirements (Web):**
- Session management sidebar (create, rename, delete sessions)
- Streaming token response (SSE via `EventSource`)
- Markdown rendering for assistant responses
- Source citations with thesis title + author per response
- "New Chat" button and history persistence via Azure SQL

### 9.2 Mobile — React Native (Expo)

**Purpose:** Portable research companion for students and faculty

**Screens & Features:**
| Screen | Description |
|--------|-------------|
| `Auth` | Login / Register stack |
| `Home` | Feed of recent/approved theses |
| `Search` | Natural language literature search |
| `ThesisDetail` | Full thesis metadata, abstract, download PDF |
| `Profile` | User info, submission history |

**Limitations vs. Web:**
- No chat interface (deferred to Phase 2)
- Read-only access to thesis repository
- Optimized for cellular data (lazy loading, image compression)

### 9.3 Desktop — Electron + Forge

**Purpose:** Admin control panel for thesis and user management

**Windows & Features:**
| Window/Page | Description |
|-------------|-------------|
| `Login` | Admin-only authentication |
| `Dashboard` | System overview: pending submissions, user count, index status |
| `Submissions` | Manage all thesis submissions, update status, trigger ingestion |
| `Users` | View all users, assign roles (Student, Faculty, Admin) |
| `Permissions` | Grant/revoke fine-grained permissions to faculty |
| `Review Assignment` | Assign faculty reviewers to specific theses |
| `Chat` | Admin-accessible AI chat interface |
| `Settings` | System configuration (Pinecone index, ONNX model selection) |

**Electron Security Configuration:**
- `contextIsolation: true`
- `nodeIntegration: false`
- All Node.js API access through preload context bridge
- Auto-updater via Electron Forge publisher

---

## 10. Security & Access Control

### 10.1 Role Definitions

| Role | Capabilities |
|------|--------------|
| `Student` | Upload thesis, view approved theses, search literature, use chat |
| `Faculty` | View theses, review assigned submissions, search, use chat |
| `Admin` | Full access — user management, role assignment, submission control, system config |

### 10.2 Permission Matrix

| Action | Student | Faculty | Admin |
|--------|---------|---------|-------|
| View approved theses | ✅ | ✅ | ✅ |
| Upload thesis | ✅ | ❌ | ✅ |
| Search literature | ✅ | ✅ | ✅ |
| Use chat (Web/Desktop) | ✅ | ✅ | ✅ |
| Review assigned thesis | ❌ | ✅ (if assigned) | ✅ |
| Assign reviewers | ❌ | ❌ | ✅ |
| Manage users & roles | ❌ | ❌ | ✅ |
| Trigger PDF ingestion | ❌ | ❌ | ✅ |
| Access Desktop app | ❌ | ❌ | ✅ |
| Delete thesis | ❌ | ❌ | ✅ |

### 10.3 API Security Layers

1. **Firebase Token Verification** — All requests validated against Firebase public keys
2. **JWT Role Claims** — App-level JWT encodes user role for fast authorization
3. **ASP.NET Core Authorization Policies** — `[Authorize(Policy = "AdminOnly")]` etc.
4. **HTTPS Enforced** — TLS 1.3 minimum on Azure App Service
5. **CORS Policy** — Whitelist of known frontend origins only
6. **Rate Limiting** — Chat endpoint: 30 requests/min per user; Search: 60 requests/min
7. **Azure Key Vault** — All secrets (Pinecone API key, LLM API key, DB connection string) stored in Key Vault, never in code

---

## 11. Development Phases & Milestones

### Phase 1 — Foundation (Weeks 1–4)

**Goal:** Establish infrastructure, authentication, and base API skeleton.

| Task | Owner | Duration |
|------|-------|----------|
| Set up Azure resources (SQL, Blob, App Service, Key Vault) | DevOps | Week 1 |
| Configure Firebase project and auth providers | Backend | Week 1 |
| Scaffold ASP.NET Core Web API project structure | Backend | Week 1 |
| Implement Firebase middleware + JWT issuance | Backend | Week 2 |
| Define and migrate Azure SQL schema (EF Core) | Backend | Week 2 |
| Scaffold React + Vite web project | Frontend | Week 2 |
| Scaffold React Native (Expo) mobile project | Frontend | Week 3 |
| Scaffold Electron + Forge desktop project | Frontend | Week 3 |
| Implement shared API service layer (Axios + React Query) | Frontend | Week 4 |
| Auth flow (Login/Register) across all three platforms | Full-stack | Week 4 |

**Deliverables:** Auth-enabled skeleton apps on all three platforms. API responds to authenticated requests. Azure SQL connected.

---

### Phase 2 — Core Backend & AI Pipeline (Weeks 5–9)

**Goal:** Build and validate the full RAG ingestion pipeline.

| Task | Owner | Duration |
|------|-------|----------|
| PDF extraction service (PdfPig) | Backend/AI | Week 5 |
| Abstract isolation algorithm | Backend/AI | Week 5 |
| Text chunking service with overlap | Backend/AI | Week 6 |
| ONNX embedding service (all-MiniLM-L6-v2) | Backend/AI | Week 6 |
| Pinecone SDK integration + index setup | Backend/AI | Week 7 |
| Upsert pipeline (full end-to-end) | Backend/AI | Week 7 |
| Thesis upload endpoint + Azure Blob integration | Backend | Week 8 |
| Hangfire background job for async ingestion | Backend | Week 8 |
| RAG query pipeline + LLM integration | Backend/AI | Week 9 |
| Streaming chat endpoint (SSE) | Backend | Week 9 |

**Deliverables:** A PDF can be uploaded, chunked, embedded, and upserted to Pinecone. Chat endpoint returns grounded responses via RAG.

---

### Phase 3 — Frontend Features (Weeks 10–15)

**Goal:** Build out all frontend pages and connect them to the live backend.

| Task | Platform | Duration |
|------|----------|----------|
| Landing page (Web) | Web | Week 10 |
| Thesis dashboard & search (Web + Mobile) | Web, Mobile | Week 10–11 |
| Thesis detail page (Web + Mobile) | Web, Mobile | Week 11 |
| Chat interface — session list + message window (Web) | Web | Week 12–13 |
| SSE streaming integration in Chat (Web) | Web | Week 13 |
| Admin dashboard (Desktop) | Desktop | Week 12 |
| Submission management (Desktop) | Desktop | Week 13 |
| User & role management (Desktop) | Desktop | Week 14 |
| Review assignment workflow (Desktop) | Desktop | Week 14 |
| Chat interface (Desktop) | Desktop | Week 15 |

**Deliverables:** All three platforms functional with live backend data. Chat works end-to-end on Web and Desktop.

---

### Phase 4 — QA, Security Audit & Deployment (Weeks 16–18)

**Goal:** Harden, test, and deploy to production.

| Task | Owner | Duration |
|------|-------|----------|
| Unit & integration tests (backend) | Backend | Week 16 |
| E2E tests (Playwright for Web, Detox for Mobile) | QA | Week 16 |
| Security audit (OWASP Top 10 review) | Security | Week 17 |
| Performance testing (K6 load test on chat + search) | QA | Week 17 |
| CI/CD pipelines (GitHub Actions → Azure) | DevOps | Week 17 |
| Electron auto-updater configuration | Frontend | Week 17 |
| Production deployment (Azure App Service) | DevOps | Week 18 |
| Mobile app store submission (Expo EAS) | Frontend | Week 18 |
| User acceptance testing (UAT) with institution | All | Week 18 |

**Deliverables:** Production system live. Mobile app submitted to stores. Admin desktop app distributed via installer.

---

### Summary Gantt Overview

```
Week │  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18
─────┼────────────────────────────────────────────────────────
P1   │ ████████████████
P2   │                 ████████████████████
P3   │                                     ██████████████████
P4   │                                                 ████████
```

**Total Estimated Duration:** 18 Weeks (~4.5 Months)

---

## 12. Team Structure & Responsibilities

| Role | Count | Responsibilities |
|------|-------|-----------------|
| Project Manager | 1 | Sprint planning, stakeholder communication, milestone tracking |
| Senior Backend Engineer | 1 | API design, RAG pipeline, Pinecone & Azure SQL integration |
| Backend Engineer | 1 | Auth, CRUD endpoints, Hangfire jobs, review workflow |
| AI/ML Engineer | 1 | ONNX model setup, chunking, embedding, prompt engineering |
| Senior Frontend Engineer | 1 | Web (React + Vite) architecture and Chat interface |
| Frontend Engineer | 1 | Mobile (React Native) screens |
| Frontend Engineer | 1 | Desktop (Electron) admin panel |
| DevOps Engineer | 1 | Azure infrastructure, CI/CD, Key Vault, monitoring |
| QA Engineer | 1 | Testing strategy, E2E tests, load testing |

**Total Team Size:** 9 members

---

## 13. Risk Management

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Abstract section not detected in PDF | Medium | High | Fallback flag for manual review; regex + heuristic rules; admin re-trigger option |
| Pinecone API downtime | Low | High | Implement retry logic with exponential backoff; cache last query results |
| ONNX model produces poor embeddings | Low | High | Benchmark model before production; allow model swap via config |
| Firebase auth token expiry causes session issues | Medium | Medium | Implement silent token refresh on all clients |
| Azure SQL connection pool exhaustion | Low | High | EF Core connection resiliency + retry policy; monitor with App Insights |
| LLM hallucination in chat responses | Medium | High | Strict system prompt with "answer only from context" instruction; display source citations |
| PDF with no extractable text (scanned image) | Medium | Medium | Detect and reject at upload; inform user to provide text-based PDF |
| Electron app distribution/signing issues | Medium | Low | Use Electron Forge with code signing cert; test on clean Windows VMs |
| Mobile app store rejection | Low | Medium | Follow Apple/Google developer guidelines from the start; use Expo managed workflow |
| Team knowledge gap in ONNX Runtime | Low | Medium | Allocate spike week; reference Microsoft.ML.OnnxRuntime official samples |

---

## 14. Appendix

### A. ONNX Model Selection Rationale

The `all-MiniLM-L6-v2` model was selected for the following reasons:
- Compact size (~22MB ONNX file) — suitable for server-side inference without GPU
- 384-dimensional output — cost-efficient for Pinecone storage vs. larger models
- Strong semantic similarity performance on academic text benchmarks
- Pre-quantized ONNX versions available, compatible with `Microsoft.ML.OnnxRuntime`
- No external API call required — fully self-hosted, no data leaves the server for embedding

### B. Chunking Strategy Justification

Abstract sections in academic theses are typically 150–400 words. A 512-token chunk size ensures:
- Most abstracts fit in a single chunk (minimizing fragmentation)
- Longer abstracts are split with 50-token overlap to preserve sentence continuity
- The embedding model operates within its optimal input range

### C. Environment Variables Reference

```env
# Azure SQL
AZURE_SQL_CONNECTION_STRING=

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=

# Pinecone
PINECONE_API_KEY=
PINECONE_INDEX_NAME=research-assistant-abstracts
PINECONE_ENVIRONMENT=

# LLM (Azure OpenAI or OpenAI)
LLM_API_KEY=
LLM_ENDPOINT=
LLM_DEPLOYMENT_NAME=

# Azure Blob Storage
AZURE_BLOB_CONNECTION_STRING=
AZURE_BLOB_CONTAINER_NAME=thesis-pdfs

# ONNX
ONNX_MODEL_PATH=Models/all-MiniLM-L6-v2.onnx

# App Config
JWT_SECRET=
JWT_EXPIRY_MINUTES=60
APP_ENV=Production
```

### D. Glossary

| Term | Definition |
|------|------------|
| RAG | Retrieval-Augmented Generation — AI technique that grounds LLM responses in retrieved documents |
| ONNX | Open Neural Network Exchange — portable ML model format |
| Pinecone | Managed vector database for semantic similarity search |
| Upsert | Insert or update — used when adding vectors to Pinecone |
| Embedding | A numerical vector representation of text, capturing semantic meaning |
| Chunking | Splitting text into smaller segments for embedding |
| SSE | Server-Sent Events — HTTP streaming protocol used for real-time chat token delivery |
| EF Core | Entity Framework Core — .NET ORM for database access |
| JWT | JSON Web Token — compact, signed token for stateless authentication |

---

*End of Document — MonteAI Research Assistant System Project Plan v1.0.0*

*This document is intended for the core development team. All architecture decisions are subject to revision following technical discovery sessions in Phase 1.*
