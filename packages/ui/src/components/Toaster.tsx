import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return <SonnerToaster position="top-right" richColors closeButton />;
}

export { toast } from "sonner"; // re-export the trigger function