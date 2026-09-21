import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { OTP_LENGTH, type OtpService } from "@monteai/api";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Radius, FontSize } from "@/constants/theme";

const COOLDOWN_SECONDS = 60;

export default function OtpVerificationScreen({
  email,
  otpService,
  onVerified,
  onBack,
}: {
  email: string;
  otpService: OtpService;
  onVerified: () => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const refs = useRef<(TextInput | null)[]>([]);
  const background = useThemeColor({}, "background");
  const surface = useThemeColor({}, "surface");
  const heading = useThemeColor({}, "onSurface");
  const body = useThemeColor({}, "onSurfaceVariant");
  const primary = useThemeColor({}, "primary");
  const outline = useThemeColor({}, "outlineVariant");

  useEffect(() => {
    const timer = setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (
      (process.env.EXPO_PUBLIC_USE_MOCK ?? (__DEV__ ? "true" : "false")) ===
      "true"
    )
      void otpService.sendOtp(email);
  }, [email, otpService]);

  const updateDigit = (value: string, index: number) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) =>
      current.map((item, position) => (position === index ? digit : item)),
    );
    if (digit) refs.current[index + 1]?.focus();
    setError("");
  };

  const verify = async () => {
    const otp = digits.join("");
    if (otp.length !== OTP_LENGTH)
      return setError("Enter all 6 digits to continue.");
    setBusy(true);
    setError("");
    try {
      if (await otpService.verifyOtp({ email, otp })) onVerified();
      else setError("The code is incorrect or expired. Please try again.");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Unable to verify the code.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown || busy) return;
    setBusy(true);
    try {
      await otpService.resendOtp(email);
      setCooldown(COOLDOWN_SECONDS);
      setError("");
    } catch {
      setError("Unable to resend the code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.nav}>
            <Pressable onPress={onBack} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={24} color={heading} />
            </Pressable>
            <Pressable onPress={onBack} hitSlop={12}>
              <MaterialIcons name="close" size={24} color={heading} />
            </Pressable>
          </View>
          <View style={styles.content}>
            <View style={[styles.icon, { backgroundColor: `${primary}18` }]}>
              <MaterialIcons name="mark-email-read" size={32} color={primary} />
            </View>
            <Text style={[styles.title, { color: heading }]}>
              Verify your email
            </Text>
            <Text style={[styles.copy, { color: body }]}>
              We sent a 6-digit verification code to{`\n`}
              <Text style={{ color: primary, fontWeight: "600" }}>{email}</Text>
            </Text>
            <View style={styles.inputs}>
              {digits.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    refs.current[index] = ref;
                  }}
                  value={digit}
                  onChangeText={(value) => updateDigit(value, index)}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === "Backspace" && !digit)
                      refs.current[index - 1]?.focus();
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                  autoComplete="one-time-code"
                  style={[
                    styles.input,
                    {
                      backgroundColor: surface,
                      borderColor: error ? "#ba1a1a" : outline,
                      color: heading,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.expiry, { color: body }]}>
              <MaterialIcons name="schedule" size={14} color={body} /> Code
              expires in 05:00
            </Text>
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              onPress={() => void verify()}
              disabled={busy}
              style={[
                styles.button,
                { backgroundColor: primary, opacity: busy ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.buttonText}>
                {busy ? "Checking..." : "Verify"}
              </Text>
            </Pressable>
            <Text style={[styles.resend, { color: body }]}>
              Didn&apos;t receive the code?{" "}
              <Text
                onPress={() => void resend()}
                style={{ color: primary, fontWeight: "600" }}
              >
                {cooldown ? `Resend in ${cooldown}s` : "Resend code"}
              </Text>
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: Spacing.lg,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { marginTop: Spacing.xl, fontSize: FontSize.xxl, fontWeight: "600" },
  copy: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    lineHeight: 21,
    textAlign: "center",
  },
  inputs: { flexDirection: "row", gap: 7, marginTop: Spacing.xxl },
  input: {
    width: 42,
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    fontSize: FontSize.xl,
    textAlign: "center",
  },
  expiry: { marginTop: Spacing.lg, fontSize: FontSize.sm },
  error: {
    marginTop: Spacing.sm,
    color: "#ba1a1a",
    fontSize: FontSize.sm,
    textAlign: "center",
  },
  button: {
    alignSelf: "stretch",
    marginTop: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: FontSize.md, fontWeight: "600" },
  resend: { marginTop: Spacing.lg, fontSize: FontSize.sm },
});
