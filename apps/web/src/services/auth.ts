const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function request<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

export async function login(data: { studentNumber: string; password: string }) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function register(data: {
  studentNumber: string;
  fullName: string;
  email: string;
  institute: string;
  program: string;
  year: string;
  password: string;
}) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function verifyOTP(data: { email: string; otp: string }) {
  return request("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function forgotPassword(email: string) {
  return request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({
      email,
    }),
  });
}

export async function resetPassword(data: { email: string; password: string }) {
  return request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function resendOTP(email: string) {
  return request("/api/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({
      email,
    }),
  });
}
