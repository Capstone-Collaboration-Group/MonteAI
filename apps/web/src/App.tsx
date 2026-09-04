import { Toaster, NotFound } from "@monteai/ui";
import { AuthProvider, QueryClientProvider, queryClient } from "@monteai/hooks";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import AppLayout from "./components/layouts/AppLayout";
import LandingPage from "./pages/LandingPage";
import { ProtectedRoute } from "@monteai/ui";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import { auth } from "./lib/firebase";
import About from "./pages/About";
import Schedule from "./pages/Schedule";
import Register from "./pages/Register";
import SubmitThesis from "./pages/SubmitThesis";
import Login from "./pages/Login";
import Announcements from "./pages/Announcements";
import ThesisViewer from "./pages/ThesisViewer";
import Theses from "./pages/ThesesPage";
import { profileService } from "./lib/authService";
import SettingsPage from "./pages/SettingsPage";

function NotFoundPage() {
  const navigate = useNavigate();
  return <NotFound onGoHome={() => navigate("/")} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider auth={auth}>
      <Toaster />
      <BrowserRouter>
        <Routes>
          {/* Public — no sidebar */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          
          {/* Authenticated — sidebar layout, gated by Firebase auth state */}
          <Route element={<ProtectedRoute profileService={profileService}/>}>

          <Route element={<AppLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/thesis/view/:thesisId" element={<ThesisViewer />} />
              <Route path="/submit" element={<SubmitThesis />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/theses" element={<Theses />} />
              <Route path="/announcements" element={<Announcements />} />
              <Route path="/settings" element={<SettingsPage />} />
          </Route>

          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
