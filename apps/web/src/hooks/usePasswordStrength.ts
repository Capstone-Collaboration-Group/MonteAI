import { useMemo } from "react";

export default function usePasswordStrength(password: string) {
  return useMemo(() => {
    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) {
      return {
        score,
        label: "Weak",
        color: "#DC2626",
      };
    }

    if (score <= 4) {
      return {
        score,
        label: "Medium",
        color: "#F59E0B",
      };
    }

    return {
      score,
      label: "Strong",
      color: "#006400",
    };
  }, [password]);
}
