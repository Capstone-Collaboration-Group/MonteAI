## MonteAI packages
```
MonteAI.packages/
├── api/                  
│   ├── src/
│   │   ├── admin
│   │   │   ├── adminService.ts     ← live service
│   │   │   ├── index.ts            ← module exports
│   │   │   ├── mockAdinService.ts   ← mock service 
│   │   │   └── types.ts            ← interface types
│   │   │
│   │   ├── announcement
│   │   │   ├── announcementService.ts
│   │   │   ├── index.ts
│   │   │   ├── mockAnnouncementService.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── auth
│   │   │   ├── authService.ts
│   │   │   ├── firebaseTokenAccessors.ts
│   │   │   ├── profileService.ts
│   │   │   └── tokenStorage.ts
│   │   │
│   │   ├── chat
│   │   │   ├── chatService.ts
│   │   │   ├── index.ts
│   │   │   ├── mockChatService.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── review
│   │   │   ├── reviewService.ts
│   │   │   ├── index.ts
│   │   │   ├── mockReviewService.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── submission
│   │   │   ├── submissionService.ts
│   │   │   ├── index.ts
│   │   │   ├── mockSubmissionService.ts
│   │   │   └── types.ts
│   │   │
│   │   └── thesis
│   │       ├── thesisService.ts
│   │       ├── index.ts
│   │       ├── mockThesisService.ts
│   │       └── types.ts
│   │       
│   ├── index.ts               exports modules
│   ├── node_modules/
│   └── package.json 
│
├── hooks/
│   ├── src/
│   │   ├── chat/
│   │   │   └── useChat.ts
│   │   │
│   │   ├── faculty/
│   │   │   └── useFaculty.ts
│   │   │
│   │   ├── panelist-schedule/
│   │   │   └── usePanelistSchedule.ts
│   │   │
│   │   ├── research-group/
│   │   │   └── useuseResearchGroup.ts
│   │   │
│   │   ├── schedule/
│   │   │   └── useSchedule.ts
│   │   │
│   │   ├── review/
│   │   │   └── useReview.ts
│   │   │
│   │   ├── submission/
│   │   │   └── useSubmission.ts
│   │   │
│   │   └── thesis/
│   │       └── useTheses.ts
│   │ 
│   ├── authContext.ts
│   ├── AuthProvider.tsx
│   ├── index.ts
│   ├── queryClient.ts
│   ├── useAuth.ts
│   ├── useUserProfile.ts
│   └── package.json
│
├── types/
│   ├── package.json
│   └── src/
│       ├── admin.ts
│       ├── announcement.ts
│       ├── auth-guards.ts
│       ├── chat-message.ts
│       ├── chat-session.ts
│       ├── faculty.ts
│       ├── index.ts
│       ├── member-row.ts
│       ├── panelist-schedule.ts
│       ├── program-head.ts
│       ├── research-group.ts
│       ├── review.ts
│       ├── schedule.ts
│       ├── student.ts
│       ├── submission.ts
│       ├── theme.ts
│       ├── thesis.ts
│       └── user.ts
│   
│
├── ui/
│   ├── node_modules/
│   ├── package.json
│   └── src/
│       ├── components/
│       │   ├── Chat/
│       │   │   └── ChatView.tsx
│       │   ├── common/
│       │   ├── Faculty/
│       │   ├── Panelist/
│       │   ├── Schedule/
│       │   ├── Settings/
│       │   ├── Sidebar/
│       │   ├── Thesis/
│       │   ├── Button.tsx
│       │   ├── Card.tsx
│       │   ├── Hamburgertsx
│       │   ├── Header.tsx
│       │   ├── Input.tsx
│       │   ├── NotificationButton.tsx
│       │   └── Toaster.tsx/
│       │   
│       ├── pages/
│       │   ├── ChatPage.tsx
│       │   ├── FacultyPage.tsx
│       │   ├── index.ts
│       │   ├── NotFound.tsx
│       │   ├── PanelistPage.tsx
│       │   ├── SettingsPage.tsx
│       │   ├── ThesisCatalogPage.tsx
│       │   ├── ThesisPDFViewer.tsx         <--need to implement here
│       │  
│       ├── styles/
│       └── index.ts
│   
│
└── utils/
    ├── src/            <--- helper scripts
    │   ├── cn.ts
    │   ├── formatDate.ts
    │   ├── fullNameHelper.ts
    │   ├── handle404.ts
    │   ├── index.ts
    │   ├── truncate.ts
    └── package.json 
```



## MonteAI server

```
MonteAI.server/
├── Configuration/
│ 
├── Controllers/        <--- All API Controllers
│ 
├── Data/               <--- AppDbContext
│ 
├── Mappings/           <--- Uses Automapper
│ 
├── Middleware/         <--- Firebase Auth and Role Authorization Middleware
│ 
├── Migrations/         <--- DB Migrations
│ 
├── Models/             
│   ├── DTOs/
│   └── Entites/
│ 
├── Repositories/       <--- Data Layer
│  
├── Services/           
│   ├── Auth/
│   │   └── FirebaseAuthService.cs
│   ├── AI/
│   │   ├── PdfExtractorService.cs        ← moved to Electron
│   │   ├── AbstractIsolatorService.cs    ← moved to Electron
│   │   ├── ChunkingService.cs            ← moved to Electron
│   │   ├── PineconeUpsertService.cs      ← receives vectors[], upserts to Pinecone
│   │   └── RagQueryService.cs            ← query pipeline unchanged
│   ├── Interfaces/
│   │   └── IService.cs                   ← Interface
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
└── Repositories/                        ← class files that have direct access to database
    ├── Interface/                       ← Interface files that will be inherited
    └── StudentRepository.cs
```