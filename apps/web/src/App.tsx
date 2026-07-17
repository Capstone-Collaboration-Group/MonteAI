import { Toaster } from "@monteai/ui";
import { QueryClientProvider, queryClient} from "@monteai/hooks";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import AppLayout from "./components/layouts/AppLayout";
import LandingPage from "./pages/LandingPage";
import { NotFound} from "@monteai/ui";
import Home from "./pages/Home";
import Chat from "./pages/Chat";

function NotFoundPage() {
  const navigate = useNavigate();
  return <NotFound onGoHome={() => navigate("/")} />;
}


const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <BrowserRouter>
      <Routes>
        {/* Public — no sidebar */}
        <Route path="/" element={<LandingPage />} />

        {/* Authenticated — sidebar layout */}
        <Route element={<AppLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/thesis" element={<div>Thesis page</div>} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);


export default App;
