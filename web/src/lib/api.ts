export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/** Error carrying the standard Masaar API envelope { error: { code, message } }. */
export class ApiError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(status: number, code: string, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

const ACCESS_KEY = "masaar.access";
const REFRESH_KEY = "masaar.refresh";

export const tokens = {
  access: (): string | null =>
    typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY),
  refresh: (): string | null =>
    typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; detail?: unknown } })
      ?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "error",
      err?.message ?? res.statusText,
      err?.detail,
    );
  }
  return data as T;
}

/** Unauthenticated JSON POST (signup, login, OTP, reset). */
export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse<T>(res);
}

async function refreshAccess(): Promise<boolean> {
  const refresh = tokens.refresh();
  if (!refresh) return false;
  const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { access: string };
  localStorage.setItem(ACCESS_KEY, data.access);
  return true;
}

/** Authenticated multipart request (no JSON content-type; browser sets the boundary). */
export async function apiAuthedForm<T = unknown>(
  path: string,
  form: FormData,
  method: string = "POST",
  retry = true,
): Promise<T> {
  const access = tokens.access();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: access ? { Authorization: `Bearer ${access}` } : {},
    body: form,
  });
  if (res.status === 401 && retry && (await refreshAccess())) {
    return apiAuthedForm<T>(path, form, method, false);
  }
  return parse<T>(res);
}

/** Authenticated request; refreshes the access token once on 401. */
export async function apiAuthed<T = unknown>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const access = tokens.access();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 && retry && (await refreshAccess())) {
    return apiAuthed<T>(path, init, false);
  }
  return parse<T>(res);
}
