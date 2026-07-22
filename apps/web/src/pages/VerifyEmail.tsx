import VerifyModal from "../components/auth/verify/VerifyModal";

type VerifyEmailProps = {
  email: string;
  onBack: () => void;
  onSuccess: () => void;
};

export default function VerifyEmail({
  email,
  onBack,
  onSuccess,
}: VerifyEmailProps) {
  return <VerifyModal email={email} onBack={onBack} onSuccess={onSuccess} />;
}
