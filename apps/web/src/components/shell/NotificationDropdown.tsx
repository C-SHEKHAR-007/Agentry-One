import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, Info, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import { useNotifications } from "../../contexts/NotificationContext";
import { NotificationType } from "../../api/types";

export function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const getIconForType = (type: NotificationType) => {
    switch (type) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error": return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "info":
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-sm"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto py-1">
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => {
                      if (!notification.read) markAsRead(notification.id);
                      if (notification.link) setOpen(false);
                    }}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                      notification.read ? "opacity-75 hover:bg-white/5" : "bg-primary/5 hover:bg-primary/10"
                    }`}
                  >
                    <div className="mt-0.5">{getIconForType(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${!notification.read ? "font-semibold" : "font-medium"}`}>
                          {notification.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      {notification.link && (
                        <Link
                          to={notification.link}
                          className="text-[11px] text-primary hover:underline mt-1 inline-block"
                        >
                          View details
                        </Link>
                      )}
                    </div>
                    {!notification.read && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
