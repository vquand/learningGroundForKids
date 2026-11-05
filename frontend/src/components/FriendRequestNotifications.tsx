import { useUiLanguage } from '../hooks/useUiLanguage';
import { uiText } from '../i18n/uiText';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createFriendRequestObservationState,
  createFriendRequestQueryOptions,
  buildFriendRequestNotificationCopy,
  clearFamilyOwnedNotificationHandles,
  familyOwned,
  friendRequestQueryKey,
  observeFriendRequests,
  visibleFamilyValues,
} from "../lib/friendRequestNotifications";
import type {
  ClosableNotification,
  FamilyOwned,
} from "../lib/friendRequestNotifications";
import { useFamilyStore } from "../stores/familyStore";
import { useCalendarNotificationAlerts } from "../hooks/useCalendarNotifications";
import type { FriendRequest } from "../types/social";

interface PendingNotification {
  id: string;
  title: string;
  body: string;
}

function browserNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function FriendRequestNotifications() {
  useUiLanguage();
  const queryClient = useQueryClient();
  const familyId = useFamilyStore((s) => s.familyId);
  useCalendarNotificationAlerts();
  const [pendingNotifications, setPendingNotifications] = useState<
    Array<FamilyOwned<PendingNotification>>
  >([]);
  const browserNotificationHandlesRef = useRef<
    Array<FamilyOwned<ClosableNotification>>
  >([]);
  const observationStateRef = useRef(createFriendRequestObservationState());

  useEffect(() => {
    return () => {
      clearFamilyOwnedNotificationHandles(browserNotificationHandlesRef.current);
      browserNotificationHandlesRef.current = [];
    };
  }, []);

  const { data: friendRequests = [], isSuccess } = useQuery(
    createFriendRequestQueryOptions(familyId),
  );

  const showIncomingRequest = useCallback((request: FriendRequest, originFamilyId: string) => {
    const { title, body } = buildFriendRequestNotificationCopy();

    setPendingNotifications((current) => {
      if (
        current.some(
          (entry) =>
            entry.familyId === originFamilyId && entry.value.id === request.id,
        )
      ) return current;
      return [
        ...current,
        familyOwned(originFamilyId, { id: request.id, title, body }),
      ];
    });

    if (
      browserNotificationsSupported() &&
      Notification.permission === "granted" &&
      document.visibilityState !== "visible"
    ) {
      const notification = new Notification(title, { body, tag: `friend-request-${request.id}` });
      const ownedNotification = familyOwned(originFamilyId, notification);
      browserNotificationHandlesRef.current = [
        ...browserNotificationHandlesRef.current,
        ownedNotification,
      ];
      const closeNotification = () => {
        notification.close();
        browserNotificationHandlesRef.current = browserNotificationHandlesRef.current.filter(
          (entry) => entry.operationId !== ownedNotification.operationId,
        );
      };
      notification.onclick = () => {
        window.focus();
        closeNotification();
      };
    }
  }, []);

  useEffect(() => {
    const previousFamilyId = observationStateRef.current.familyId;
    if (previousFamilyId !== familyId) {
      clearFamilyOwnedNotificationHandles(browserNotificationHandlesRef.current);
      browserNotificationHandlesRef.current = [];
      observationStateRef.current = createFriendRequestObservationState(familyId);
      setPendingNotifications([]);

      if (previousFamilyId) {
        const previousQuery = {
          queryKey: friendRequestQueryKey(previousFamilyId),
          exact: true,
        } as const;
        void queryClient.cancelQueries(previousQuery);
        queryClient.removeQueries(previousQuery);
      }
    }

    if (!familyId) return;
    if (!isSuccess) return;

    const observation = observeFriendRequests(
      friendRequests,
      familyId,
      observationStateRef.current,
    );
    observationStateRef.current = observation.state;

    for (const request of observation.newRequests) {
      showIncomingRequest(request, familyId);
    }
  }, [familyId, friendRequests, isSuccess, queryClient, showIncomingRequest]);

  const visiblePendingNotifications = visibleFamilyValues(pendingNotifications, familyId);
  if (!visiblePendingNotifications.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-3 px-4">
      {visiblePendingNotifications.map((notification) => (
        <div
          key={notification.id}
          className="pointer-events-auto w-full max-w-md rounded-3xl border border-sky-200 bg-white/95 p-4 shadow-lg backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-2xl">💌</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-sky-700">{notification.title}</p>
              <p className="mt-1 text-sm text-gray-700">{notification.body}</p>
              <Link
                to="/"
                className="mt-3 inline-flex text-sm font-semibold text-sky-600 hover:text-sky-700"
                onClick={() => {
                  setPendingNotifications((current) =>
                    current.filter(
                      (entry) =>
                        entry.familyId !== familyId || entry.value.id !== notification.id,
                    ),
                  );
                }}
              >
                {uiText("Review request")}</Link>
            </div>
            <button
              type="button"
              className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label={uiText("Dismiss friend request notification")}
              onClick={() => {
                setPendingNotifications((current) =>
                  current.filter(
                    (entry) =>
                      entry.familyId !== familyId || entry.value.id !== notification.id,
                  ),
                );
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export async function requestFriendRequestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!browserNotificationsSupported()) return "unsupported";
  return Notification.requestPermission();
}

export function getFriendRequestNotificationPermission(): NotificationPermission | "unsupported" {
  if (!browserNotificationsSupported()) return "unsupported";
  return Notification.permission;
}
