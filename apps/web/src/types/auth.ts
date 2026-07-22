export interface RegisterFormData {
  firstName: string;
  middleName: string;
  lastName: string;

  studentNumber: string;
  email: string;

  institute: string;
  program: string;
  year: string;

  password: string;
  confirmPassword: string;
}

export interface LoginFormData {
  studentNumber: string;
  password: string;
}

export interface VerifyOTPData {
  email: string;
  otp: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  password: string;
  confirmPassword: string;
}
