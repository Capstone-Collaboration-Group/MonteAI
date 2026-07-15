// packages/hooks/src/useAuth.tsx  ← .tsx because it returns JSX
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Auth, User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

// auth instance is created per-platform (web/desktop/mobile) and passed in here
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

export const useAuth = () => useContext(AuthContext);