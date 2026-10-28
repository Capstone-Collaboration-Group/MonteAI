// apps/desktop/src/App.tsx (or wherever your renderer root component is)
import { useMemo, useState } from "react";
import { Toaster, NotFound, SettingsPage, ProtectedRoute, BackupPage } from "@monteai/ui";
import {
  HashRouter,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import Dashboard from "./renderer/pages/Dashboard";
import About from "./renderer/pages/About";
import Faculty from "./renderer/pages/Faculty";
import Theses from "./renderer/pages/Theses";
import Panelist from "./renderer/pages/Panelist";
import Announcements from "./renderer/pages/Announcements";
import { AuthProvider, queryClient, QueryClientProvider } from "@monteai/hooks";
import Schedule from "./renderer/pages/Schedule";
import ResearchGroups from "./renderer/pages/ResearchGroups";
import  AppSidebar  from "@/renderer/components/AppSidebar";
import ThesisViewer from "./renderer/pages/ThesisViewer";
import Register from "./renderer/pages/Register";
import Login from "./renderer/pages/Login";
import { profileService, userService } from "./renderer/lib/authServices";
import { backupService } from "./renderer/lib/backupService";
import { backupStorage } from "./renderer/lib/backupStorage";
import { backupExporter } from "./renderer/lib/backupExporter";
import { auth } from "./renderer/lib/firebaseServices";
import { MfaSessionProvider } from "./renderer/components/MfaSessionProvider";
import { mfaService } from "./renderer/lib/mfaService";
import type { MfaApi } from "@monteai/ui";

function NotFoundPage() {
  const navigate = useNavigate();
  return <NotFound onGoHome={() => navigate("/")} />;
}



const App = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mfa = useMemo<MfaApi>(
    () => ({
      status: () => mfaService.status(),
      enroll: () => mfaService.enroll(),
      confirmEnroll: (code) => mfaService.confirmEnroll({ code }),
      disable: (code) => mfaService.disable({ code }),
      regenerateRecoveryCodes: (code) => mfaService.regenerateRecoveryCodes({ code }),
    }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider auth={auth}>
        <MfaSessionProvider>
        <HashRouter>
          <Toaster />
          <div className="flex h-screen">
            <AppSidebar
              collapsed={sidebarCollapsed}
              onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
            />
            <main className="min-w-0 flex-1 overflow-y-auto">
              <Routes>
                {/* Public routes */}
                <Route path="/register" element={<Register />} />
                <Route path="/login" element={<Login />} />

                {/* Protected routes — wrapped inside ProtectedRoute */}
                <Route element={<ProtectedRoute profileService={profileService} />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/announcements" element={<Announcements />} />
                  <Route path="/theses" element={<Theses />} />
                  <Route path="/faculty" element={<Faculty />} />
                  <Route path="/research-groups" element={<ResearchGroups />} />
                  <Route path="/panelist" element={<Panelist />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/settings" element={<SettingsPage userService={userService} mfa={mfa} />} />
                  <Route path="/backup" element={<BackupPage backupService={backupService} storage={backupStorage} exporter={backupExporter} />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/thesis/view/:thesisId" element={<ThesisViewer />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </main>
          </div>
        </HashRouter>
        </MfaSessionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
