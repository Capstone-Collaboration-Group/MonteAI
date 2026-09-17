import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import OtpVerificationScreen from "@/components/OtpVerificationScreen";
import { otpService } from "@/lib/otpService";
import { useAuthSession } from "@/contexts/AuthSessionContext";

export default function VerifyEmailRoute() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { completeEmailVerification } = useAuthSession();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <OtpVerificationScreen
        email={email ?? ""}
        otpService={otpService}
        onVerified={() => {
          void completeEmailVerification();
          router.replace("/(tabs)/home");
        }}
        onBack={() => router.replace("/auth-entry")}
      />
    </>
  );
}
