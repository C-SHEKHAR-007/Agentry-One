import { toast } from "sonner";
import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { openStream } from "../../services/realtime/stream";
import type { Notification } from "../../models";

/** Notifications for the signed-in user. The list stays live: while it has a
 * subscriber, the notifications stream prepends new ones (with a toast). */
export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    notifications: build.query<Notification[], void>({
      query: () => routes.notifications.list,
      providesTags: [{ type: "Notification", id: "LIST" }],
      async onCacheEntryAdded(_arg, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        try {
          await cacheDataLoaded;
        } catch {
          return; // the list failed to load (e.g. signed out) -- no stream
        }
        const close = openStream<Notification>(routes.streams.notifications, (n) => {
          let isNew = false;
          updateCachedData((list) => {
            if (list.some((x) => x.id === n.id)) return;
            isNew = true;
            list.unshift(n);
          });
          if (isNew) toast[n.type === "info" ? "message" : n.type](n.title, { description: n.message });
        });
        await cacheEntryRemoved;
        close();
      },
    }),
    markNotificationRead: build.mutation<void, string>({
      query: (id) => ({ url: routes.notifications.read(id), method: "PATCH" }),
      // Optimistic: flip it now, roll back if the server refuses.
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          notificationsApi.util.updateQueryData("notifications", undefined, (list) => {
            const n = list.find((x) => x.id === id);
            if (n) n.read = true;
          }),
        );
        queryFulfilled.catch(patch.undo);
      },
    }),
    markAllNotificationsRead: build.mutation<void, void>({
      query: () => ({ url: routes.notifications.readAll, method: "POST" }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          notificationsApi.util.updateQueryData("notifications", undefined, (list) => {
            for (const n of list) n.read = true;
          }),
        );
        // On failure a refetch is safer than guessing what changed.
        queryFulfilled.catch(() => {
          patch.undo();
          dispatch(notificationsApi.util.invalidateTags([{ type: "Notification", id: "LIST" }]));
        });
      },
    }),
    deleteNotification: build.mutation<void, string>({
      query: (id) => ({ url: routes.notifications.detail(id), method: "DELETE" }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          notificationsApi.util.updateQueryData("notifications", undefined, (list) => list.filter((x) => x.id !== id)),
        );
        queryFulfilled.catch(() => {
          patch.undo();
          dispatch(notificationsApi.util.invalidateTags([{ type: "Notification", id: "LIST" }]));
        });
      },
    }),
  }),
});

export const {
  useNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useDeleteNotificationMutation,
} = notificationsApi;
