import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createApiClient } from "@monteai/api";

import "./index.css";
import App from "./App";

export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);