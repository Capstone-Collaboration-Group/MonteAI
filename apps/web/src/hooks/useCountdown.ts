import { useEffect, useState } from "react";

export default function useCountdown(seconds: number) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft]);

  const reset = () => {
    setTimeLeft(seconds);
  };

  return {
    timeLeft,
    reset,
  };
}
