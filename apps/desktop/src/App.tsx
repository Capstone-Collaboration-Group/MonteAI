// apps/desktop/src/App.tsx (or wherever your renderer root component is)
import { useMemo } from "react";
import { Toaster, NotFound, SettingsPage, BackupPage } from "@monteai/ui";
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
import AppLayout from "./renderer/components/AppLayout";
import DesktopProtectedRoute from "./renderer/components/DesktopProtectedRoute";
import Welcome from "./renderer/pages/Welcome";
import ThesisViewer from "./renderer/pages/ThesisViewer";
import Register from "./renderer/pages/Register";
import Login from "./renderer/pages/Login";
import { userService } from "./renderer/lib/authServices";
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
            <Routes>
              {/* Public pages never mount the sidebar or protected API queries. */}
              <Route path="/" element={<Welcome />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />

              <Route element={<DesktopProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
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
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </HashRouter>
        </MfaSessionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
