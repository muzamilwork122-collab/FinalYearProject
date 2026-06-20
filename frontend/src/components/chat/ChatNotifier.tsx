import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getShopToken, SHOP_SESSION_EVENT } from "@/lib/shopApi";
import { type ChatRole } from "@/lib/chatApi";
import { useChatNotifications } from "@/hooks/useChatNotifications";

/**
 * Headless global notifier. Renders nothing — it just polls for incoming chat
 * messages and raises background desktop notifications anywhere in the app.
 *
 * The in-app surface is the header notification bell; this is the single
 * OS-level notification source for the session. It runs everywhere except
 * `/admin` (no chat there).
 */
export default function ChatNotifier() {
  const { token: userToken } = useAuth();
  const location = useLocation();
  const [shopToken, setShopToken] = useState<string | null>(() => getShopToken());

  // Keep the shop session in sync (login/logout happens on the /shop page).
  useEffect(() => {
    const sync = () => setShopToken(getShopToken());
    window.addEventListener(SHOP_SESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SHOP_SESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Customer session takes precedence; a pure shopkeeper still gets notified.
  const role: ChatRole = userToken ? "user" : "shop";
  const onOwnedSurface = location.pathname.startsWith("/admin");
  const activeToken = onOwnedSurface ? null : userToken ?? shopToken;

  // Ask for desktop-notification permission once a chat session exists.
  useEffect(() => {
    if (activeToken && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [activeToken]);

  useChatNotifications(activeToken, role);

  return null;
}
