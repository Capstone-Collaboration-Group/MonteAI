import { useState } from "react";
import { signInWithEmailAndPassword, type Auth } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {TextInput} from "./TextInput";
import {PasswordInput} from "./PasswordInput";

type LoginFormProps = {
  auth: Auth;
  onSuccess?: () => void;
};

export function LoginForm({ auth, onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onSuccess?.();
    } catch (err) {
      if (err instanceof FirebaseError) {
        setError("Invalid email or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="flex w-full flex-1 max-w-md flex-col lg:max-w-none">
      <h2 className="text-4xl font-bold text-on-surface">Welcome Back</h2>
      <p className="mt-2 text-base text-gray-500">
        Sign in to continue to MonteSkolar.
      </p>

      <form
        onSubmit={handleLogin}
        className="mt-6 flex w-full flex-col gap-6 sm:mt-10"
      >
        <TextInput
          label="Email"
          name="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          label="Password"
          name="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-12 rounded-xl bg-primary font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-60"
        >
          {isSubmitting ? "Signing in..." : "Login"}
        </button>
      </form>
    </section>
  );
}
