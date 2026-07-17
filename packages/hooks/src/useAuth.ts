// packages/hooks/src/useAuth.ts (new file — note: .ts not .tsx, no JSX here)
import { useContext } from "react";
import { AuthContext } from "./authContext";

export function useAuth() {
  return useContext(AuthContext);
}