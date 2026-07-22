import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from "@monteai/hooks";
import './index.css'
import App from './App.tsx'
import { auth } from './lib/firebase';
import './lib/firebaseServices.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider auth={auth}>
      <App />
    </AuthProvider>
  </StrictMode>,
)
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
