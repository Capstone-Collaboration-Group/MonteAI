// layouts/AppLayout.tsx
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Sidebar } from "@monteai/ui";
import { MessageSquare, Search, MessageCircle, Plus } from "lucide-react";
import { recentChats } from "../../lib/mock-data";
import CdmLogo from "../../assets/cdm-logo.png"

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

export default function AppLayout() {
  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}