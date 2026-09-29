import { useCallback } from "react";
import { useAppSelector } from "../../app/hooks";
import {
  useDeleteNotificationMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from "./notifications.api";

/** The notification list (live) and its actions. Same shape as the previous
 * NotificationContext. Only loads once signed in. */
export function useNotifications() {
  const authed = useAppSelector((s) => s.auth.status === "authed");
  const { data: notifications = [] } = useNotificationsQuery(undefined, { skip: !authed });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll] = useMarkAllNotificationsReadMutation();
  const [remove] = useDeleteNotificationMutation();
  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAsRead: useCallback((id: string) => void markRead(id), [markRead]),
    markAllAsRead: useCallback(() => void markAll(), [markAll]),
    removeNotification: useCallback((id: string) => void remove(id), [remove]),
  };
}
