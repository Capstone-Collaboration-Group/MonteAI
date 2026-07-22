import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './lib/firebaseServices.ts';
import { createApiClient } from "@monteai/api";
import "./index.css";


export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
