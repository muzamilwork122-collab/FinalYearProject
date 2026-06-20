/**
 * Client for the shopkeeper + admin modules.
 *
 * Sessions are kept separate from the regular user session (AuthContext):
 *  - shopkeepers persist `shop_token` / `shop_account`
 *  - admins persist `admin_token`
 * so a logged-in customer, shopkeeper, and admin never collide on one device.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export interface ShopkeeperAccount {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  shop_name: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string | null;
  reviewed_at: string | null;
  // Present on /shopkeepers/me + /login + /register (account view)
  phone?: string;
  category?: string | null;
  shop_phone?: string | null;
  website?: string | null;
  address?: string;
  city?: string | null;
  country?: string | null;
  opening_hours?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Fired whenever the shopkeeper session is created or cleared, so persistent
 *  UI (Header, ChatNotifier) can react without a full page reload. */
export const SHOP_SESSION_EVENT = "shop-session-changed";

export interface ShopkeeperApplication extends ShopkeeperAccount {
  phone: string;
  category: string | null;
  shop_phone: string | null;
  website: string | null;
  address: string;
  city: string | null;
  country: string | null;
  opening_hours: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  document_type: string | null;
  document_number: string | null;
  document_image: string | null;
  is_active: boolean;
}

export interface AdminStats {
  users: number;
  users_inactive: number;
  analyses: number;
  shopkeepers_total: number;
  shopkeepers_pending: number;
  shopkeepers_approved: number;
  shopkeepers_rejected: number;
  shopkeepers_inactive: number;
}

export interface AdminProfile {
  name: string;
  email: string;
  avatar?: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string | null;
  analyses_count: number;
}

export interface AdminAnalysis {
  id: string;
  created_at: string;
  phone_model: string | null;
  severity: string;
  damage_score: number;
  confidence: number;
  repair_cost_usd: number | null;
}

export interface AdminUserDetail extends AdminUser {
  recent_analyses: AdminAnalysis[];
}

export interface ShopRegisterPayload {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  shop_name: string;
  category?: string;
  shop_phone?: string;
  website?: string;
  address: string;
  city?: string;
  country?: string;
  opening_hours?: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  document_type?: string;
  document_number?: string;
  document_image?: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || "Request failed. Please try again.");
  }
  return data as T;
}

// ── Shopkeeper session ─────────────────────────────────────────────────────

export function getShopToken(): string | null {
  return localStorage.getItem("shop_token");
}

export function getShopAccount(): ShopkeeperAccount | null {
  try {
    const raw = localStorage.getItem("shop_account");
    return raw ? (JSON.parse(raw) as ShopkeeperAccount) : null;
  } catch {
    return null;
  }
}

export function setShopSession(token: string, account: ShopkeeperAccount): void {
  localStorage.setItem("shop_token", token);
  localStorage.setItem("shop_account", JSON.stringify(account));
  window.dispatchEvent(new Event(SHOP_SESSION_EVENT));
}

export function clearShopSession(): void {
  localStorage.removeItem("shop_token");
  localStorage.removeItem("shop_account");
  window.dispatchEvent(new Event(SHOP_SESSION_EVENT));
}

export function registerShopkeeper(payload: ShopRegisterPayload) {
  return request<{ token: string; shopkeeper: ShopkeeperAccount }>("/api/shopkeepers/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginShopkeeper(email: string, password: string) {
  return request<{ token: string; shopkeeper: ShopkeeperAccount }>("/api/shopkeepers/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchShopkeeperMe(token: string) {
  return request<ShopkeeperAccount>(`/api/shopkeepers/me?token=${encodeURIComponent(token)}`);
}

// ── Admin session ────────────────────────────────────────────────────────

export function getAdminToken(): string | null {
  return localStorage.getItem("admin_token");
}

export function getAdminProfile(): AdminProfile | null {
  try {
    const raw = localStorage.getItem("admin_profile");
    return raw ? (JSON.parse(raw) as AdminProfile) : null;
  } catch {
    return null;
  }
}

export function setAdminSession(token: string, profile: AdminProfile): void {
  localStorage.setItem("admin_token", token);
  localStorage.setItem("admin_profile", JSON.stringify(profile));
}

export function clearAdminSession(): void {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_profile");
}

export function loginAdmin(email: string, password: string) {
  return request<{ token: string; admin: AdminProfile }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchAdminProfile(token: string) {
  return request<AdminProfile>(`/api/admin/profile?token=${encodeURIComponent(token)}`);
}

export function updateAdminProfile(
  token: string,
  name: string,
  email: string,
  avatar: string | null,
) {
  return request<{ token: string; admin: AdminProfile }>("/api/admin/profile", {
    method: "PATCH",
    body: JSON.stringify({ token, name, email, avatar }),
  });
}

export function changeAdminPassword(token: string, currentPassword: string, newPassword: string) {
  return request<{ message: string }>("/api/admin/change-password", {
    method: "POST",
    body: JSON.stringify({ token, current_password: currentPassword, new_password: newPassword }),
  });
}

export function fetchAdminStats(token: string) {
  return request<AdminStats>(`/api/admin/stats?token=${encodeURIComponent(token)}`);
}

export function fetchAdminShopkeepers(token: string, status?: string, active?: string) {
  const statusQuery = status ? `&status=${encodeURIComponent(status)}` : "";
  const activeQuery = active ? `&active=${encodeURIComponent(active)}` : "";
  return request<ShopkeeperApplication[]>(
    `/api/admin/shopkeepers?token=${encodeURIComponent(token)}${statusQuery}${activeQuery}`,
  );
}

export function approveShopkeeper(token: string, shopId: string) {
  return request<ShopkeeperApplication>(`/api/admin/shopkeepers/${shopId}/approve`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function rejectShopkeeper(token: string, shopId: string, reason: string) {
  return request<ShopkeeperApplication>(`/api/admin/shopkeepers/${shopId}/reject`, {
    method: "POST",
    body: JSON.stringify({ token, reason }),
  });
}

export function setShopkeeperActive(token: string, shopId: string, isActive: boolean) {
  return request<ShopkeeperApplication>(`/api/admin/shopkeepers/${shopId}/active`, {
    method: "POST",
    body: JSON.stringify({ token, is_active: isActive }),
  });
}

export function fetchAdminUsers(token: string, active?: string) {
  const activeQuery = active ? `&active=${encodeURIComponent(active)}` : "";
  return request<AdminUser[]>(`/api/admin/users?token=${encodeURIComponent(token)}${activeQuery}`);
}

export function fetchAdminUserDetail(token: string, userId: string) {
  return request<AdminUserDetail>(
    `/api/admin/users/${userId}?token=${encodeURIComponent(token)}`,
  );
}

export function setUserActive(token: string, userId: string, isActive: boolean) {
  return request<AdminUser>(`/api/admin/users/${userId}/active`, {
    method: "POST",
    body: JSON.stringify({ token, is_active: isActive }),
  });
}
