type CountdownProps = {
  seconds: number;
};

export default function Countdown({ seconds }: CountdownProps) {
  const minute = Math.floor(seconds / 60);

  const second = seconds % 60;

  return (
    <span className="text-sm text-gray-500">
      {minute}:{second.toString().padStart(2, "0")}
    </span>
  );
}
