import { Toaster, Sidebar } from "@monteai/ui";
import { QueryClientProvider, queryClient} from "@monteai/hooks";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { MessageSquare, Search, MessageCircle, Plus } from "lucide-react";
import { NavLink } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import { NotFound} from "@monteai/ui";
import { recentChats } from "./lib/mock-data"
import CdmLogo  from "./assets/cdm-logo.png"
function NotFoundPage() {
  const navigate = useNavigate();
  return <NotFound onGoHome={() => navigate("/")} />;
}


function AppSidebar() {
  return (
    <Sidebar>
      <Sidebar.Header className="gap-2.5">
       <img
    src={CdmLogo}
    alt="Colegio de Montalban"
    className="h-8.5 w-8.5 shrink-0 rounded-full object-cover"
  />
        <div>
          <p className="text-[15px] font-medium leading-tight">MonteAI</p>
          <p className="text-[11px] leading-tight text-on-surface-variant">Your AI research assistant</p>
        </div>
      </Sidebar.Header>

      <Sidebar.NewChatButton>
        <Plus className="h-4 w-4" /> New chat
      </Sidebar.NewChatButton>

      <Sidebar.Nav>
        <NavLink to="/chat">
          {({ isActive }) => (
            <Sidebar.Item icon={<MessageSquare className="h-4 w-4" />} label="AI Chat" active={isActive} />
          )}
        </NavLink>
        <NavLink to="/thesis">
          {({ isActive }) => (
            <Sidebar.Item icon={<Search className="h-4 w-4" />} label="Find thesis" active={isActive} />
          )}
        </NavLink>
      </Sidebar.Nav>

      <Sidebar.SidebarSectionLabel>Recents</Sidebar.SidebarSectionLabel>
      <Sidebar.Nav className="gap-0.5">
        {recentChats.map((chat) => (
          <Sidebar.Item key={chat.id} icon={<MessageCircle className="h-4 w-4" />} label={chat.title} />
        ))}
      </Sidebar.Nav>
    </Sidebar>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <BrowserRouter>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;