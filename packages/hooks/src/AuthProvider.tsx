// packages/hooks/src/AuthProvider.tsx (component only)
import { useState, useEffect, type ReactNode } from "react";
import type { Auth, User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { AuthContext } from "./authContext";

export function AuthProvider({ auth, children }: { auth: Auth; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, [auth]);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}