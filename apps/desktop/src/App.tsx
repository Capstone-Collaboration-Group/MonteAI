// apps/desktop/src/App.tsx (or wherever your renderer root component is)
import { Toaster, Sidebar, NotFound} from "@monteai/ui";
import { HashRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Users, Settings } from "lucide-react";
import Dashboard from "./renderer/pages/Dashboard";
import Faculty from "./renderer/pages/Faculty";
import Schedule from "./renderer/pages/Schedule";
import Theses from "./renderer/pages/Theses";
function NotFoundPage() {
  const navigate = useNavigate();
  return <NotFound onGoHome={() => navigate("/")} />;
}

function AppSidebar() {
  return (
    <Sidebar>
      <Sidebar.Header className="gap-2.5">
        <img
          src="/cdm-logo.png"
          alt="Colegio de Montalban"
          className="h-8.5 w-8.5 shrink-0 rounded-full object-cover"
        />
        <div>
          <p className="text-[15px] font-medium leading-tight">MonteSkolar</p>
          <p className="text-[11px] leading-tight text-on-surface-variant">Admin console</p>
        </div>
      </Sidebar.Header>

      <Sidebar.Nav>
        <NavLink to="/">
          {({ isActive }) => (
            <Sidebar.Item icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" active={isActive} />
          )}
        </NavLink>
        <NavLink to="/theses">
          {({ isActive }) => (
            <Sidebar.Item icon={<FileText className="h-4 w-4" />} label="Theses" active={isActive} />
          )}
        </NavLink>
        <NavLink to="/panelists">
          {({ isActive }) => (
            <Sidebar.Item icon={<Users className="h-4 w-4" />} label="Panelists" active={isActive} />
          )}
        </NavLink>
        <NavLink to="/faculty">
          {({ isActive }) => (
            <Sidebar.Item icon={<Users className="h-4 w-4" />} label="Faculty" active={isActive} />
          )}
        </NavLink>
      </Sidebar.Nav>

      <Sidebar.Footer>
        <NavLink to="/settings">
          {({ isActive }) => (
            <Sidebar.Item icon={<Settings className="h-4 w-4" />} label="Settings" active={isActive} />
          )}
        </NavLink>
      </Sidebar.Footer>
    </Sidebar>
  );
}

const App = () => (
  <HashRouter>
    <Toaster />
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/Theses" element={<Theses />} />
          <Route path="/Faculty" element={<Faculty />} />
          <Route path="/Schedule" element={<Schedule />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  </HashRouter>
);


export default App;