// packages/api/src/auth/authService.ts
import type { AxiosInstance } from "axios";
import { signOut, type Auth} from "firebase/auth";
import type {
  LoginDto,
  LoginResponseDto,
  RegisterUserRequest,
  RegisterUserResponse,
  VerifyOTPDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "@monteai/types";
import { createFirebaseTokenAccessors } from "./firebaseTokenAccessors";
import { RegistrationError, sanitizeRegistrationError } from "./registrationError";

export interface AuthService {
  login(dto: LoginDto): Promise<LoginResponseDto>;
  register(dto: RegisterUserRequest): Promise<RegisterUserResponse>;
  verifyOtp(dto: VerifyOTPDto): Promise<boolean>;
  resendOtp(email: string): Promise<boolean>;
  forgotPassword(dto: ForgotPasswordDto): Promise<boolean>;
  resetPassword(dto: ResetPasswordDto): Promise<boolean>;
  logout(): Promise<void>;
}

export function createAuthService(client: AxiosInstance, auth: Auth): AuthService {
  const { getFreshFirebaseIdToken } = createFirebaseTokenAccessors(auth);
  return {
    async login(dto) {
      const { data } = await client.post<LoginResponseDto>("/auth/login", dto);
      return data;
    },
    async register(dto) {
      try {
        const token = await getFreshFirebaseIdToken();
        const user = auth.currentUser;
        if (!token || !user) throw new RegistrationError("authentication_required", 401);
        if (!user.emailVerified) throw new RegistrationError("email_unverified", 403);
        if (
          dto.id !== user.uid ||
          dto.email.trim().toLowerCase() !== user.email?.trim().toLowerCase()
        ) throw new RegistrationError("identity_mismatch", 400);

        const { data } = await client.post<RegisterUserResponse>("/auth/register", dto, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return data;
      } catch (error) {
        throw sanitizeRegistrationError(error);
      }
    },
    async verifyOtp(dto) {
      const { data } = await client.post<boolean>("/auth/verify-email", dto);
      return data;
    },
    async resendOtp(email) {
      const { data } = await client.post<boolean>("/auth/resend-otp", { email });
      return data;
    },
    async forgotPassword(dto) {
      const { data } = await client.post<boolean>("/auth/forgot-password", dto);
      return data;
    },
    async resetPassword(dto) {
      const { data } = await client.post<boolean>("/auth/reset-password", dto);
      return data;
    },
    async logout() {
      await client.post("/auth/logout");  // notifies the backend
      await signOut(auth);               // clears Firebase session client-side
    },
    
  };
}
