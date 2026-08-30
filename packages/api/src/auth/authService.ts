// packages/api/src/auth/authService.ts
import type { AxiosInstance } from "axios";
import { signOut, type Auth} from "firebase/auth";
import type {
  LoginDto,
  LoginResponseDto,
  RegisterFormDto,
  VerifyOTPDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "@monteai/types";

export interface AuthService {
  login(dto: LoginDto): Promise<LoginResponseDto>;
  register(dto: RegisterFormDto): Promise<boolean>;
  verifyOtp(dto: VerifyOTPDto): Promise<boolean>;
  resendOtp(email: string): Promise<boolean>;
  forgotPassword(dto: ForgotPasswordDto): Promise<boolean>;
  resetPassword(dto: ResetPasswordDto): Promise<boolean>;
  logout(): Promise<void>;
}

export function createAuthService(client: AxiosInstance, auth: Auth): AuthService {
  return {
    async login(dto) {
      const { data } = await client.post<LoginResponseDto>("/auth/login", dto);
      return data;
    },
    async register(dto) {
      const { data } = await client.post<boolean>("/auth/register", dto);
      return data;
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