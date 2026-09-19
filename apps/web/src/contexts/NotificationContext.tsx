import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Notification, NotificationType } from "../api/types";
import { api } from "../api/client";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { status } = useAuth();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.get<Notification[]>("/notifications");
      setNotifications(data);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, []);

  // Fetch initial notifications
  useEffect(() => {
    if (status === "authed") {
      fetchNotifications();
    }
  }, [status, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch (err) {
      console.error("Failed to mark notification as read", err);
      // Revert on failure
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.post("/notifications/mark-all-read");
    } catch (err) {
      console.error("Failed to mark all as read", err);
      // We'd ideally revert to previous state, but a refetch is safer
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const removeNotification = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.delete(`/notifications/${id}`);
    } catch (err) {
      console.error("Failed to delete notification", err);
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const seenIds = useRef<Set<string>>(new Set());

  // Real-time SSE connection for notifications
  useEffect(() => {
    if (status !== "authed") return;

    const source = new EventSource("/api/notifications/stream");

    source.onmessage = (event) => {
      try {
        const newNotification = JSON.parse(event.data) as Notification;
        
        setNotifications((prev) => {
          if (seenIds.current.has(newNotification.id)) return prev;
          
          seenIds.current.add(newNotification.id);
          
          toast[newNotification.type === "info" ? "message" : newNotification.type](
            newNotification.title, 
            { description: newNotification.message }
          );

          return [newNotification, ...prev];
        });
      } catch (err) {
        console.error("Failed to parse SSE notification", err);
      }
    };

    source.onerror = (err) => {
      console.error("SSE connection error", err);
    };

    return () => {
      source.close();
    };
  }, [status]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAsRead, markAllAsRead, removeNotification }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
