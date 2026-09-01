// apps/desktop/src/App.tsx (or wherever your renderer root component is)
import { Toaster, Sidebar, NotFound, SettingsPage, ProtectedRoute } from "@monteai/ui";
import {
  HashRouter,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import Dashboard from "./renderer/pages/Dashboard";
import Faculty from "./renderer/pages/Faculty";
import Theses from "./renderer/pages/Theses";
import Panelist from "./renderer/pages/Panelist";
import Announcements from "./renderer/pages/Announcements";
import { AuthProvider, queryClient, QueryClientProvider } from "@monteai/hooks";
import Schedule from "./renderer/pages/Schedule";
import  AppSidebar  from "@/renderer/components/AppSidebar";
import ThesisViewer from "./renderer/pages/ThesisViewer";
import Register from "./renderer/pages/Register";
import Login from "./renderer/pages/Login";
import { profileService } from "./renderer/lib/authServices";
import { auth } from "./renderer/lib/firebaseServices";

function NotFoundPage() {
  const navigate = useNavigate();
  return <NotFound onGoHome={() => navigate("/")} />;
}



const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider auth={auth}>
    <HashRouter>
      <Toaster />
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
           <Routes>
          {/* Public routes */}
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          {/* Protected routes — wrapped inside ProtectedRoute */}
          <Route element={<ProtectedRoute profileService={profileService}/>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/theses" element={<Theses />} />
            <Route path="/faculty" element={<Faculty />} />
            <Route path="/panelist" element={<Panelist />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/thesis/view/:thesisId" element={<ThesisViewer />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </main>
      </div>
    </HashRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
