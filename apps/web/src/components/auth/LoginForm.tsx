import { useState } from "react";
import { signInWithEmailAndPassword, type Auth } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import TextInput from "./TextInput";
import PasswordInput from "./PasswordInput";

type LoginFormProps = {
  auth: Auth;
  onSuccess?: () => void;
};

export default function LoginForm({ auth, onSuccess }: LoginFormProps) {
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
    <section className="flex w-full max-w-md flex-col">
      <h2 className="text-4xl font-bold text-[#1B1B1C]">Welcome Back</h2>
      <p className="mt-2 text-base text-gray-500">Sign in to continue to MonteSkolar.</p>

      <form onSubmit={handleLogin} className="mt-10 flex flex-col gap-6">
        <TextInput label="Email" name="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordInput label="Password" name="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="h-12 rounded-xl bg-[#006400] font-semibold text-white transition-all hover:bg-[#004d00] disabled:opacity-60">
          {isSubmitting ? "Signing in..." : "Login"}
        </button>
      </form>
    </section>
  );
}