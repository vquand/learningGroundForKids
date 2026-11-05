import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";

import {
  createFriendRequest,
  fetchFriendRequests,
  respondFriendRequest,
} from "../src/api/social.ts";
import {
  FRIEND_REQUEST_POLL_INTERVAL_MS,
  buildFriendRequestNotificationCopy,
  clearFamilyOwnedNotificationHandles,
  clearFamilyOwned,
  createFriendRequestObservationState,
  createFriendRequestQueryOptions,
  familyMutation,
  familyOwned,
  friendRequestQueryKey,
  invalidateFriendRequests,
  isFamilyMutationPending,
  observeFriendRequests,
  updateFamilyOwned,
  visibleFamilyValue,
  visibleFamilyValues,
} from "../src/lib/friendRequestNotifications.ts";
import {
  clearPrivateQueryCache,
  familyQueryKey,
  familyScopedQuery,
  profileQueryKey,
} from "../src/lib/familyQueries.ts";
import type { FriendRequest } from "../src/types/social.ts";

function installFetch(responseBodies: unknown[]) {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let responseIndex = 0;
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: typeof input === "string" ? input : input.toString(), init });
    const responseBody = responseBodies[responseIndex++];
    return responseBody === undefined
      ? new Response(null, { status: 204 })
      : Response.json(responseBody);
  }) as typeof fetch;
  return { originalFetch, requests };
}

const request = (overrides: Partial<FriendRequest> = {}): FriendRequest => ({
  id: "request-1",
  requesting_family_id: "requesting-family",
  requesting_scope: "family",
  requesting_profile_id: null,
  requesting_label: "Requester",
  target_family_id: "target-family",
  target_scope: "family",
  target_profile_id: null,
  target_label: "Target",
  target_code: "ABC123",
  requester_message: "Hello",
  status: "pending",
  created_at: "2026-09-21T00:00:00.000Z",
  responded_at: null,
  responded_by_family_id: null,
  ...overrides,
});

test("social API uses exact same-origin routes, methods, encoded IDs, and strict bodies", async () => {
  const response = request({ id: "request/1" });
  const { originalFetch, requests } = installFetch([[], response, response]);

  try {
    await fetchFriendRequests();
    await createFriendRequest({
      requestingScope: "profile",
      requestingProfileId: "profile/1",
      targetCode: "  ab-123  ",
      targetScope: "family",
    });
    await respondFriendRequest("request/1", true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(
    requests.map(({ url, init }) => ({
      url,
      method: init?.method ?? "GET",
      body: init?.body,
    })),
    [
      {
        url: "/api/v1/friend-requests",
        method: "GET",
        body: undefined,
      },
      {
        url: "/api/v1/friend-requests",
        method: "POST",
        body: JSON.stringify({
          requesting_scope: "profile",
          requesting_profile_id: "profile/1",
          target_code: "AB-123",
          target_scope: "family",
        }),
      },
      {
        url: "/api/v1/friend-requests/request%2F1/respond",
        method: "POST",
        body: JSON.stringify({ accept: true }),
      },
    ],
  );
});

test("friend request polling runs in the background only for an active family at 15 seconds", () => {
  assert.equal(FRIEND_REQUEST_POLL_INTERVAL_MS, 15_000);
  const active = createFriendRequestQueryOptions("family-1");
  assert.deepEqual(active.queryKey, ["friend-requests", "family-1"]);
  assert.equal(active.enabled, true);
  assert.equal(active.refetchInterval, 15_000);
  assert.equal(active.refetchIntervalInBackground, true);

  const signedOut = createFriendRequestQueryOptions(null);
  assert.deepEqual(signedOut.queryKey, ["friend-requests", null]);
  assert.equal(signedOut.enabled, false);
  assert.equal(signedOut.refetchInterval, false);
  assert.equal(signedOut.refetchIntervalInBackground, false);
});

test("different families have distinct friend request cache keys", () => {
  assert.notDeepEqual(friendRequestQueryKey("family-1"), friendRequestQueryKey("family-2"));
  assert.deepEqual(friendRequestQueryKey("family-1"), ["friend-requests", "family-1"]);
  assert.deepEqual(friendRequestQueryKey("family-2"), ["friend-requests", "family-2"]);
});

test("switching families drops the prior baseline and does not replay existing requests", () => {
  const waitingForInitialFetch = createFriendRequestObservationState("target-family");
  assert.equal(waitingForInitialFetch.familyId, "target-family");
  assert.equal(waitingForInitialFetch.hasEstablishedBaseline, false);

  const initial = observeFriendRequests(
    [request(), request({ id: "outgoing", target_family_id: "other-family" })],
    "target-family",
    waitingForInitialFetch,
  );

  assert.deepEqual(initial.newRequests, []);
  assert.deepEqual([...initial.state.seenRequestIds].sort(), ["outgoing", "request-1"]);
  assert.equal(initial.state.hasEstablishedBaseline, true);

  const subsequent = observeFriendRequests(
    [
      request(),
      request({ id: "new-request" }),
      request({ id: "outgoing", target_family_id: "other-family" }),
    ],
    "target-family",
    initial.state,
  );

  assert.deepEqual(subsequent.newRequests.map((entry) => entry.id), ["new-request"]);

  const switched = observeFriendRequests(
    [request({ id: "family-2-existing", target_family_id: "family-2" })],
    "family-2",
    subsequent.state,
  );

  assert.deepEqual(switched.newRequests, []);
  assert.deepEqual([...switched.state.seenRequestIds], ["family-2-existing"]);
  assert.equal(switched.state.familyId, "family-2");

  const updated = observeFriendRequests(
    [
      request({ id: "family-2-existing", target_family_id: "family-2", requester_message: "Updated" }),
      request({ id: "family-2-new", target_family_id: "family-2" }),
    ],
    "family-2",
    switched.state,
  );

  assert.deepEqual(updated.newRequests.map((entry) => entry.id), ["family-2-new"]);
});

test("family-owned notifications and modals are hidden on the first family-change or sign-out render", () => {
  const notifications = [
    familyOwned("family-1", { id: "notification-1" }),
  ];
  const decisionModal = familyOwned("family-1", {
    request: request({ target_family_id: "family-1" }),
    error: "Try again",
  });

  assert.deepEqual(visibleFamilyValues(notifications, "family-1"), [
    { id: "notification-1" },
  ]);
  assert.deepEqual(visibleFamilyValues(notifications, "family-2"), []);
  assert.deepEqual(visibleFamilyValues(notifications, null), []);
  assert.equal(visibleFamilyValue(decisionModal, "family-2"), null);
  assert.equal(visibleFamilyValue(decisionModal, null), null);
});

test("private query cache cleanup removes catalog results that may include family and profile lessons", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(profileQueryKey("family-1"), [{ id: "profile-a" }]);
  queryClient.setQueryData(familyQueryKey("parent-lessons", "family-1", "profile-a"), [
    { item_id: "lesson-a" },
  ]);
  queryClient.setQueryData(["parent-lesson-catalog"], { legacy: true });
  queryClient.setQueryData(["items"], [{ id: "public-item" }]);
  queryClient.setQueryData(["items", "profile-a"], [{ id: "private-item" }]);
  queryClient.setQueryData(["item", "private-item", "en", "profile-a"], { id: "private-item" });

  await clearPrivateQueryCache(queryClient);

  assert.equal(queryClient.getQueryData(profileQueryKey("family-1")), undefined);
  assert.equal(
    queryClient.getQueryData(familyQueryKey("parent-lessons", "family-1", "profile-a")),
    undefined,
  );
  assert.equal(queryClient.getQueryData(["parent-lesson-catalog"]), undefined);
  assert.equal(queryClient.getQueryData(["items"]), undefined);
  assert.equal(queryClient.getQueryData(["items", "profile-a"]), undefined);
  assert.equal(queryClient.getQueryData(["item", "private-item", "en", "profile-a"]), undefined);
});

test("session cleanup removes private admin learner inspection results", async () => {
  const queryClient = new QueryClient();
  const key = ["admin-inspection", "root", 1, "family-one", "profile-one", "activities"];
  queryClient.setQueryData(key, { activities: [{ id: "private-completion" }] });
  await clearPrivateQueryCache(queryClient);
  assert.equal(queryClient.getQueryData(key), undefined);
});

test("profile cache keys are family-scoped and disabled sessions have no shared profile key", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(profileQueryKey("family-1"), [{ id: "profile-a" }]);

  assert.notDeepEqual(profileQueryKey("family-1"), profileQueryKey("family-2"));
  assert.deepEqual(queryClient.getQueryData(profileQueryKey("family-2")), undefined);
  assert.deepEqual(profileQueryKey(null), ["profiles", null]);
});

test("a late family query result is rejected after a session transition", async () => {
  let snapshot = { familyId: "family-1", sessionGeneration: 1 };
  let resolveRequest: (value: string[]) => void = () => undefined;
  const request = new Promise<string[]>((resolve) => {
    resolveRequest = resolve;
  });
  const guardedRequest = familyScopedQuery(
    "family-1",
    () => request,
    () => snapshot,
  );
  const pending = guardedRequest();

  snapshot = { familyId: "family-2", sessionGeneration: 2 };
  resolveRequest(["family-1-private-data"]);

  await assert.rejects(pending, /no longer active/);
});

test("notification handles are closed when their family-owned lifecycle ends", () => {
  const closed: string[] = [];
  const handles = [
    familyOwned("family-1", { close: () => closed.push("family-1") }),
    familyOwned("family-2", { close: () => closed.push("family-2") }),
  ];

  clearFamilyOwnedNotificationHandles(handles);

  assert.deepEqual(closed.sort(), ["family-1", "family-2"]);
});

test("OS friend request notifications use generic copy without the private request message", () => {
  const copy = buildFriendRequestNotificationCopy();
  assert.equal(copy.body.includes("requester_message"), false);
  assert.equal(copy.body, "You have a new friend request to review.");
});

test("a late family-1 mutation cannot clear, error, or mark pending family-2 UI", () => {
  const family1Mutation = familyMutation("family-1", {
    requestId: "request-1",
    accept: true,
  });
  const family2Modal = familyOwned("family-2", {
    request: request({ id: "family-2-request", target_family_id: "family-2" }),
    error: null as string | null,
  });

  const afterLateSuccess = clearFamilyOwned(
    family2Modal,
    family1Mutation.originFamilyId,
  );
  const afterLateError = updateFamilyOwned(
    family2Modal,
    family1Mutation.originFamilyId,
    family1Mutation.operationId,
    (modal) => ({ ...modal, error: "Family 1 failed" }),
  );

  assert.strictEqual(afterLateSuccess, family2Modal);
  assert.strictEqual(afterLateError, family2Modal);
  assert.equal(isFamilyMutationPending(true, family1Mutation, "family-2"), false);
  assert.equal(isFamilyMutationPending(true, family1Mutation, "family-1"), true);

  const family1Modal = familyOwned("family-1", {
    request: request({ target_family_id: "family-1" }),
    error: null as string | null,
  });
  const family1ScopedMutation = familyMutation(
    family1Mutation.originFamilyId,
    family1Mutation.request,
    family1Modal.operationId,
  );
  const family1Error = updateFamilyOwned(
    family1Modal,
    family1ScopedMutation.originFamilyId,
    family1ScopedMutation.operationId,
    (modal) => ({ ...modal, error: "Family 1 failed" }),
  );
  assert.equal(family1Error?.value.error, "Family 1 failed");
  assert.equal(
    clearFamilyOwned(
      family1Error,
      family1ScopedMutation.originFamilyId,
      family1ScopedMutation.operationId,
    ),
    null,
  );
});

test("a stale same-family modal mutation cannot change a reopened modal instance", () => {
  const firstModal = familyOwned("family-1", {
    request: request({ target_family_id: "family-1" }),
    error: null as string | null,
  });
  const reopenedModal = familyOwned("family-1", {
    request: request({ id: "new-request", target_family_id: "family-1" }),
    error: null as string | null,
  });
  const staleMutation = familyMutation(
    "family-1",
    { requestId: "request-1", accept: true },
    firstModal.operationId,
  );

  assert.strictEqual(
    clearFamilyOwned(
      reopenedModal,
      staleMutation.originFamilyId,
      staleMutation.operationId,
    ),
    reopenedModal,
  );
  assert.strictEqual(
    updateFamilyOwned(
      reopenedModal,
      staleMutation.originFamilyId,
      staleMutation.operationId,
      (modal) => ({ ...modal, error: "stale" }),
    ),
    reopenedModal,
  );
  assert.notEqual(firstModal.operationId, reopenedModal.operationId);
});

test("friend request invalidation targets only the active family's cache", async () => {
  const queryClient = new QueryClient();
  const firstFamilyKey = friendRequestQueryKey("family-1");
  const secondFamilyKey = friendRequestQueryKey("family-2");
  const family1Mutation = familyMutation("family-1", { targetCode: "ABC123" });
  queryClient.setQueryData(firstFamilyKey, [request({ target_family_id: "family-1" })]);
  queryClient.setQueryData(secondFamilyKey, [request({ target_family_id: "family-2" })]);

  await invalidateFriendRequests(queryClient, family1Mutation.originFamilyId);

  assert.equal(queryClient.getQueryState(firstFamilyKey)?.isInvalidated, true);
  assert.equal(queryClient.getQueryState(secondFamilyKey)?.isInvalidated, false);
});

test("social API and notifications avoid direct database SDKs", () => {
  for (const relativePath of [
    "src/api/social.ts",
    "src/components/FriendRequestNotifications.tsx",
  ]) {
    const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /supa[a-z]*base/i, relativePath);
  }
});
