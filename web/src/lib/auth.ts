import { apiAuthed, apiPost, tokens } from "./api";

export type Role = "STUDENT" | "TEACHER" | "MODERATOR" | "SUPERADMIN";

export interface AuthUser {
  id: number;
  phone: string;
  full_name: string;
  email: string;
  role: Role;
  locale: string;
  market: string | null;
  is_verified: boolean;
  must_change_password: boolean;
}

interface TokenPair {
  access: string;
  refresh: string;
}

export interface SignupInput {
  phone: string;
  full_name: string;
  password: string;
  market: string;
  locale: string;
}

export const authApi = {
  signup: (body: SignupInput) =>
    apiPost<{ message: string; phone: string }>("/api/auth/signup/", body),
  verify: (phone: string, code: string) =>
    apiPost<TokenPair & { user: AuthUser }>("/api/auth/otp/verify/", { phone, code }),
  resend: (phone: string, purpose: "VERIFY" | "RESET") =>
    apiPost<{ message: string }>("/api/auth/otp/resend/", { phone, purpose }),
  login: (phone: string, password: string) =>
    apiPost<TokenPair & { user: AuthUser }>("/api/auth/login/", { phone, password }),
  resetRequest: (phone: string) =>
    apiPost<{ message: string }>("/api/auth/password/reset/", { phone }),
  resetConfirm: (phone: string, code: string, new_password: string) =>
    apiPost<{ message: string }>("/api/auth/password/reset/confirm/", {
      phone,
      code,
      new_password,
    }),
  me: () => apiAuthed<AuthUser>("/api/auth/me/"),
  changePassword: (old_password: string, new_password: string) =>
    apiAuthed<{ message: string }>("/api/auth/password/change/", {
      method: "POST",
      body: JSON.stringify({ old_password, new_password }),
    }),
};

export function storeSession(pair: TokenPair) {
  tokens.set(pair.access, pair.refresh);
}

export function homePathForRole(locale: string, role: Role): string {
  if (role === "TEACHER") return `/${locale}/teacher`;
  if (role === "MODERATOR" || role === "SUPERADMIN") return `/${locale}/admin`;
  if (role === "STUDENT") return `/${locale}/teachers`;
  return `/${locale}`;
}
