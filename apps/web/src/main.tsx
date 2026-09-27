import { pdfjs } from "react-pdf";
// Bundle the pdf.js worker locally instead of pulling it from cdnjs on every
// load: no CDN round-trip before pages render, the worker always matches the
// repo-pinned pdfjs-dist, and the viewer works offline. Vite emits the file
// as an asset; import.meta.url resolves to it in dev and in the build.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './lib/firebaseServices.ts';
import { apiClient } from './lib/firebaseServices';

export const api = apiClient;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
