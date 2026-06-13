import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createApiClient } from "@monteai/api";
import './index.css'
import App from './App.tsx'

export const api = createApiClient(import.meta.env.VITE_API_URL)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
