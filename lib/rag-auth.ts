/**
 * RAG 后端鉴权：通过 Next.js 代理调用登录、注册、刷新、个人资料等接口。
 */

export type RagUser = {
  ID: number;
  username: string;
  email: string;
  role: number;
  avatar: string;
  status: number;
  CreatedAt?: string;
  UpdatedAt?: string;
};

export type LoginResponse = {
  token: string;
  expire: string;
  user: RagUser;
};

export type RegisterResponse = {
  user_id: number;
};

const RAG_USER_KEY = "rag-user";
const RAG_TOKEN_KEY = "rag-token";

export function getStoredRagToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(RAG_TOKEN_KEY);
}

export function getStoredRagUser(): RagUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(RAG_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RagUser;
  } catch {
    return null;
  }
}

export function setStoredRagAuth(token: string, user: RagUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RAG_TOKEN_KEY, token);
  localStorage.setItem(RAG_USER_KEY, JSON.stringify(user));
}

export function clearStoredRagAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RAG_TOKEN_KEY);
  localStorage.removeItem(RAG_USER_KEY);
}

export async function ragLogin(
  baseURL: string,
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseURL, email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Login failed");
  }
  return data as LoginResponse;
}

export async function ragRegister(
  baseURL: string,
  username: string,
  email: string,
  password: string
): Promise<RegisterResponse> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseURL, username, email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Register failed");
  }
  return data as RegisterResponse;
}

export async function ragRefresh(baseURL: string, token: string): Promise<LoginResponse> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ baseURL }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Refresh failed");
  }
  return data as LoginResponse;
}

export async function ragGetProfile(baseURL: string, token: string): Promise<{ user: RagUser }> {
  const url = new URL("/api/user/profile", window.location.origin);
  url.searchParams.set("baseURL", baseURL);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Get profile failed");
  }
  return data as { user: RagUser };
}

export async function ragUpdateProfile(
  baseURL: string,
  token: string,
  patch: { username?: string; avatar?: string }
): Promise<{ user: RagUser }> {
  const res = await fetch("/api/user/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ baseURL, ...patch }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Update profile failed");
  }
  return data as { user: RagUser };
}
