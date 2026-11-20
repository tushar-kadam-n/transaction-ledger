import type { Account, CreateAccountPayload } from "./types/account";
import type { CreateTransactionResponse, GlobalTransactionHistoryResponse, TransactionExportFilters, TransactionHistoryResponse, TransactionPayload, TransactionType } from "./types/transaction";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

export type AuthUser = { email: string };
export type AuthTokenResponse = { access_token: string; token_type: string; expires_in: number; expires_at: string };
export type AuthError = Error & { status?: number };

let accessToken: string | null = null;
let onAuthenticationFailure: (() => void) | undefined;
let refreshPromise: Promise<AuthTokenResponse> | null = null;

export function setAccessToken(token: string | null) { accessToken = token; }
export function getAccessToken() { return accessToken; }
export function setAuthenticationFailureHandler(handler: () => void) { onAuthenticationFailure = handler; }

function csrfToken() {
  const cookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${CSRF_COOKIE_NAME}=`));
  return cookie ? decodeURIComponent(cookie.slice(CSRF_COOKIE_NAME.length + 1)) : null;
}

function errorMessage(status: number, body: unknown, fallback: string) {
  if (typeof body === "object" && body !== null && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return "Please check the highlighted fields and try again.";
  }
  return status >= 500 ? "The service is temporarily unavailable. Please try again." : fallback;
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch { throw new Error("Unable to reach the server. Check that the local backend is running."); }
  const body = await readBody(response);
  if (response.ok) return body as T;
  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    try {
      const refreshed = await refreshAccessToken();
      setAccessToken(refreshed.access_token);
      return request<T>(path, init, false);
    } catch {
      setAccessToken(null);
      onAuthenticationFailure?.();
    }
  }
  const error = new Error(errorMessage(response.status, body, "The request could not be completed.")) as AuthError;
  error.status = response.status;
  throw error;
}

async function requestBlob(path: string, retry = true): Promise<Blob> {
  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: "include" });
  } catch { throw new Error("Unable to reach the server. Check that the local backend is running."); }
  if (response.ok) return response.blob();
  if (response.status === 401 && retry) {
    try {
      const refreshed = await refreshAccessToken();
      setAccessToken(refreshed.access_token);
      return requestBlob(path, false);
    } catch {
      setAccessToken(null);
      onAuthenticationFailure?.();
    }
  }
  throw new Error("Unable to export transactions.");
}

export async function register(payload: { email: string; password: string; confirm_password: string }) { return request<{ message?: string }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }); }
export async function verifyEmail(token: string) { return request<{ message?: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }); }
export async function login(payload: { email: string; password: string }) { return request<AuthTokenResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) }); }

export async function refreshAccessToken(): Promise<AuthTokenResponse> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const token = csrfToken();
    return request<AuthTokenResponse>("/auth/refresh", { method: "POST", headers: token ? { [CSRF_HEADER_NAME]: token } : undefined }, false);
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function logout() {
  const token = csrfToken();
  return request<{ message?: string }>("/auth/logout", { method: "POST", headers: token ? { [CSRF_HEADER_NAME]: token } : undefined }, false);
}
export async function forgotPassword(email: string) { return request<{ message?: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }); }
export async function resetPassword(payload: { token: string; password: string; confirm_password: string }) { return request<{ message?: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }); }

export async function getAccounts(): Promise<Account[]> { return request<Account[]>("/accounts", { cache: "no-store" }); }
export async function createTransaction(accountId: string, transaction: TransactionPayload): Promise<CreateTransactionResponse> { return request<CreateTransactionResponse>(`/accounts/${accountId}/transactions`, { method: "POST", body: JSON.stringify(transaction) }); }
export async function getTransactions(accountId: string, page = 1, limit = 10, type?: TransactionType): Promise<TransactionHistoryResponse> { return { account_id: accountId, ...(await getAllTransactions(page, limit, accountId, type)) }; }
export async function getAllTransactions(page = 1, limit = 10, accountId?: string, type?: TransactionType, search?: string, startDate?: string, endDate?: string): Promise<GlobalTransactionHistoryResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (accountId) params.append("account_id", accountId); if (type) params.append("type", type); if (search) params.append("search", search); if (startDate) params.append("start_date", startDate); if (endDate) params.append("end_date", endDate);
  return request<GlobalTransactionHistoryResponse>(`/transactions?${params}`, { cache: "no-store" });
}
export async function exportTransactionsCsv(filters: TransactionExportFilters): Promise<Blob> {
  const params = new URLSearchParams(); if (filters.accountId) params.set("account_id", filters.accountId); if (filters.type) params.set("type", filters.type); if (filters.search) params.set("search", filters.search); if (filters.startDate) params.set("start_date", filters.startDate); if (filters.endDate) params.set("end_date", filters.endDate);
  return requestBlob(`/transactions/export?${params}`);
}
export async function createAccount(payload: CreateAccountPayload): Promise<Account> { return request<Account>("/accounts", { method: "POST", body: JSON.stringify(payload) }); }
