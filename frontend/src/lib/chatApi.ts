/**
 * Client for the live chat module (customers ↔ shopkeepers).
 *
 * A single set of endpoints serves both parties — the token passed in decides
 * the caller's role on the server, so these helpers are role-agnostic.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export type ChatRole = "user" | "shop";

export interface ChatThread {
  id: string;
  peer_id: string;
  peer_name: string;
  peer_type: ChatRole;
  last_message: string;
  last_sender: ChatRole | null;
  last_message_at: string | null;
  unread: number;
}

export interface ChatMessage {
  id: string;
  sender: ChatRole;
  mine: boolean;
  content: string;
  created_at: string | null;
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

export function startThread(token: string, shopkeeperId: string) {
  return request<ChatThread>("/api/chat/threads/start", {
    method: "POST",
    body: JSON.stringify({ token, shopkeeper_id: shopkeeperId }),
  });
}

export function listThreads(token: string) {
  return request<{ threads: ChatThread[] }>(`/api/chat/threads?token=${encodeURIComponent(token)}`);
}

export function fetchMessages(token: string, threadId: string) {
  return request<{ thread: ChatThread; messages: ChatMessage[] }>(
    `/api/chat/threads/${threadId}/messages?token=${encodeURIComponent(token)}`,
  );
}

export function sendMessage(token: string, threadId: string, content: string) {
  return request<ChatMessage>(`/api/chat/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ token, content }),
  });
}

export function fetchUnreadCount(token: string) {
  return request<{ unread: number }>(`/api/chat/unread?token=${encodeURIComponent(token)}`);
}
