import { useEffect, useRef } from "react";

type OTPInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
};

export default function OTPInput({ value, onChange }: OTPInputProps) {
  const inputRefs = useRef<HTMLInputElement[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const digit = e.target.value.replace(/\D/g, "");

    if (!digit) return;

    const otp = [...value];
    otp[index] = digit;

    onChange(otp);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === "Backspace") {
      const otp = [...value];
      otp[index] = "";
      onChange(otp);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData("Text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (pasted.length !== 6) return;

    onChange(pasted.split(""));
  };

  return (
    <div className="flex justify-center gap-4">
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            if (el) inputRefs.current[index] = el;
          }}
          maxLength={1}
          value={digit}
          onPaste={handlePaste}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onChange={(e) => handleChange(index, e)}
          className="
          h-14
          w-14
          rounded-xl
          border
          border-[#D9D9D9]
          text-center
          text-2xl
          font-bold
          outline-none
          transition
          focus:border-[#006400]
          focus:ring-2
          focus:ring-[#006400]/20
          "
        />
      ))}
    </div>
  );
}
