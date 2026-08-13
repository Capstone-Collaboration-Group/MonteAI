import { Toaster, NotFound, SettingsPage } from "@monteai/ui";
import { AuthProvider, QueryClientProvider, queryClient } from "@monteai/hooks";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import AppLayout from "./components/layouts/AppLayout";
import LandingPage from "./pages/LandingPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import { auth } from "./lib/firebase";
import About from "./pages/About";
import Schedule from "./pages/Schedule";
import Register from "./pages/Register";
import SubmitThesis from "./pages/SubmitThesis";
import Login from "./pages/Login";
import ThesisViewer from "./pages/ThesisViewer";

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
          <Route path="/thesis/view/:thesisId" element={<ThesisViewer />} />
           <Route element={<AppLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/thesis" element={<div>Thesis page</div>} />
              <Route path="/submit" element={<SubmitThesis />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

          {/* Authenticated — sidebar layout, gated by Firebase auth state */}
          <Route element={<ProtectedRoute />}>
           
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
