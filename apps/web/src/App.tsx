import { Toaster } from "@monteai/ui";
import { AuthProvider, QueryClientProvider, queryClient } from "@monteai/hooks";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import AppLayout from "./components/layouts/AppLayout";
import LandingPage from "./pages/LandingPage";
import { NotFound } from "@monteai/ui";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import { auth } from "./lib/firebase";
import About from "./pages/About";
import Schedule from "./pages/Schedule";

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

        {/* Authenticated — sidebar layout, gated by Firebase auth state */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/thesis" element={<div>Thesis page</div>} />
            <Route path="/schedule" element={<Schedule />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
    
  </QueryClientProvider>
);

export default App;